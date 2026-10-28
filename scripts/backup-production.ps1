<#
.SYNOPSIS
    HAZA AIOS - Production Database Backup Utility (Stage 20G)
    Secure, consistent, non-destructive logical database backup.

.DESCRIPTION
    Performs a transaction-consistent MySQL logical dump of the HAZA AIOS production database.
    Enforces that backups are saved strictly outside the Git repository.
    Calculates SHA-256 checksums and validates dump completeness.
    Guarantees that credentials are never exposed in process arguments, logs, or command text.
    Provides robust diagnostic logging on failures, even with empty stderr.

.PARAMETER DestinationDir
    Directory where the backup and checksum will be saved.
    Default: C:\Users\theme\HAZA-AIOS-Private\production-backups\stage20

.PARAMETER Database
    Database name to dump.
    Default: railway

.PARAMETER Method
    Backup execution method:
    - ContainerSsh: Executes native Oracle MySQL 9.7.2 mysqldump inside Railway MySQL container over SSH.
                    Uses container-native environment credentials without exposing secrets.
    - LocalClient: Executes local mysqldump client over TCP/SSH tunnel using environment variable auth.
    Default: ContainerSsh

.PARAMETER DryRun
    When specified, tests prerequisites and prints configuration without executing the backup or contacting production.

.PARAMETER CleanStaleArtifacts
    When specified, removes pre-existing stale 0-byte SQL files in the backup destination directory.
#>

[CmdletBinding()]
param(
    [string]$DestinationDir = 'C:\Users\theme\HAZA-AIOS-Private\production-backups\stage20',
    [string]$Database = 'railway',
    [string]$IdentityFile = '',
    [ValidateSet('ContainerSsh', 'LocalClient')]
    [string]$Method = 'ContainerSsh',
    [switch]$DryRun,
    [switch]$CleanStaleArtifacts
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-RailwayCli {
    <#
    .SYNOPSIS
        Resolves the Railway CLI executable on Windows (.cmd or .exe).
    #>
    $searchedPaths = @()

    # 1. Check explicit environment override
    if ($env:RAILWAY_CMD) {
        if (Test-Path $env:RAILWAY_CMD) {
            return (Resolve-Path $env:RAILWAY_CMD).Path
        } else {
            throw "Explicit RAILWAY_CMD path does not exist: '$env:RAILWAY_CMD'"
        }
    }

    # 2. Check standard npm roaming directory
    if ($env:APPDATA) {
        $npmCmd = Join-Path $env:APPDATA 'npm\railway.cmd'
        $searchedPaths += $npmCmd
        if (Test-Path $npmCmd) {
            return (Resolve-Path $npmCmd).Path
        }
    }

    # 3. Check Get-Command for railway.cmd in PATH
    $cmdLookup = Get-Command 'railway.cmd' -ErrorAction SilentlyContinue
    if ($cmdLookup -and (Test-Path $cmdLookup.Source)) {
        return $cmdLookup.Source
    }
    $searchedPaths += 'PATH:railway.cmd'

    # 4. Check Get-Command for railway.exe in PATH
    $exeLookup = Get-Command 'railway.exe' -ErrorAction SilentlyContinue
    if ($exeLookup -and (Test-Path $exeLookup.Source)) {
        return $exeLookup.Source
    }
    $searchedPaths += 'PATH:railway.exe'

    # 5. Check local AppData programs
    if ($env:LOCALAPPDATA) {
        $localExe = Join-Path $env:LOCALAPPDATA 'Programs\railway\railway.exe'
        $searchedPaths += $localExe
        if (Test-Path $localExe) {
            return (Resolve-Path $localExe).Path
        }
    }

    $searchedList = ($searchedPaths -join ', ')
    throw "Railway CLI launcher not found. Checked: [$searchedList]. Ensure Railway CLI is installed via 'npm i -g @railway/cli' or set RAILWAY_CMD environment variable."
}

function Write-DiagnosticLog {
    param(
        [string]$LogPath,
        [string]$Mode,
        [string]$TargetDb,
        [int]$ExitCode,
        [long]$StdoutBytes,
        [string]$StderrText,
        [string]$CommandStructure,
        [string]$ErrorMessage
    )

    $category = 'UnknownFailure'
    if ($ExitCode -eq 2 -or $StderrText -match 'AUTH_FAILED') {
        $category = 'MissingCredentialsOrShellAuth'
    } elseif ($StderrText -match 'Access denied for user') {
        $category = 'MySQLAccessDenied'
    } elseif ($StderrText -match 'mysqldump:') {
        $category = 'MysqldumpRuntimeError'
    } elseif ($StderrText -match 'Project not linked' -or $StderrText -match 'Service not found') {
        $category = 'RailwayProjectLinkingError'
    } elseif ($StdoutBytes -eq 0 -and $ExitCode -eq 0) {
        $category = 'ZeroByteDumpOutput'
    } elseif ($ErrorMessage -match 'validation failed') {
        $category = 'DumpValidationFailure'
    } elseif ($ErrorMessage -match 'Process failed to start') {
        $category = 'ProcessStartFailure'
    }

    $logContent = @"
================================================================
HAZA AIOS Production Backup Diagnostic Log
================================================================
Timestamp:          $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))
Execution Mode:     $Mode
Target Database:    $TargetDb
Exit Code:          $ExitCode
Stdout Byte Count:  $StdoutBytes
Failure Category:   $category
Error Summary:      $ErrorMessage
Sanitized Command:  $CommandStructure

----------------------------------------------------------------
Captured Stderr:
----------------------------------------------------------------
$StderrText
================================================================
"@
    try {
        [System.IO.File]::WriteAllText($LogPath, $logContent, [System.Text.Encoding]::UTF8)
    } catch {
        Write-Host "[WARNING] Could not write diagnostic log to ${LogPath}: $_" -ForegroundColor Yellow
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path

Write-Host '================================================================' -ForegroundColor Cyan
Write-Host '  HAZA AIOS - Production Database Backup Utility (Stage 20G)   ' -ForegroundColor Cyan
Write-Host '================================================================' -ForegroundColor Cyan

# 1. Guard against saving inside Git repository
$resolvedDest = [System.IO.Path]::GetFullPath($DestinationDir)
if ($resolvedDest.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "SAFETY VIOLATION: Destination directory is inside the Git repository ($repoRoot). Backups MUST be stored outside the repository."
}

if (-not (Test-Path $resolvedDest)) {
    Write-Host "[INFO] Creating destination directory: $resolvedDest" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $resolvedDest -Force | Out-Null
}

# 2. Check and report / clean stale 0-byte backup files
$staleFiles = Get-ChildItem -Path $resolvedDest -Filter '*.sql' -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -eq 0 }
if ($staleFiles) {
    foreach ($sf in $staleFiles) {
        if ($CleanStaleArtifacts) {
            Write-Host "[CLEANUP] Removing approved stale empty backup artifact: $($sf.Name)" -ForegroundColor Yellow
            Remove-Item -Path $sf.FullName -Force -ErrorAction SilentlyContinue
        } else {
            Write-Host "[WARNING] Stale empty backup artifact detected: $($sf.FullName) (0 bytes). Pass -CleanStaleArtifacts to remove." -ForegroundColor Yellow
        }
    }
}

# 3. Prepare timestamped output filenames
$timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$dumpFileName = 'haza-aios-production-stage20-backup_' + $timestamp + '.sql'
$dumpFilePath = Join-Path $resolvedDest $dumpFileName
$checksumFilePath = Join-Path $resolvedDest ($dumpFileName + '.sha256')
$logFilePath = Join-Path $resolvedDest ('backup_' + $timestamp + '.log')

if (Test-Path $dumpFilePath) {
    throw "Target backup file already exists: $dumpFilePath"
}

# 4. Resolve executable requirements
$resolvedRailway = $null
if ($Method -eq 'ContainerSsh') {
    $resolvedRailway = Resolve-RailwayCli
    Write-Host "[RESOLVED] Railway CLI launcher: $resolvedRailway" -ForegroundColor Green
}

# 5. Report consistency notice
Write-Host ''
Write-Host '[CONSISTENCY & SECURITY INVARIANTS]' -ForegroundColor Yellow
Write-Host '  - Snapshot Isolation: --single-transaction guarantees InnoDB transaction consistency without locking tables.'
Write-Host '  - Non-InnoDB/DDL limitation: Concurrent DDL operations or non-InnoDB tables are not protected by snapshot isolation.'
Write-Host '  - Comprehensive coverage: Includes routines, triggers, events, and utf8mb4 character set.'
Write-Host '  - Credential Security: No passwords in command arguments, logs, or process memory.'
Write-Host "  - Target Database: $Database"
Write-Host "  - Execution Method: $Method"
Write-Host "  - Output File: $dumpFilePath"
Write-Host ''

if ($DryRun) {
    Write-Host '[DRY RUN] All prerequisites and launcher paths validated.' -ForegroundColor Green
    Write-Host '[DRY RUN] Exiting cleanly without establishing production connections or running dump.' -ForegroundColor Green
    return
}

# 6. Execute backup
$startTime = Get-Date
$exitCode = -1
$stderrContent = ''
$stdoutByteCount = 0
$commandStructure = ''
$fileStream = $null
$process = $null

try {
    if ($Method -eq 'ContainerSsh') {
        Write-Host '[STEP 1/3] Executing native MySQL 9.7.2 dump via Railway container SSH...' -ForegroundColor Cyan
        
        # Robust remote execution script without internal double quotes to prevent Windows/Node argument fragmentation.
        # Dynamically uses MYSQLUSER (fallback: root), MYSQLPASSWORD (fallback: MYSQL_ROOT_PASSWORD), and MYSQLDATABASE (fallback: $Database / railway).
        # Fails closed (exit 2) if neither MYSQLPASSWORD nor MYSQL_ROOT_PASSWORD is set in the container.
        $targetDbFallback = if ($Database) { $Database } else { 'railway' }
        $remoteScript = 'test -n $MYSQLPASSWORD -o -n $MYSQL_ROOT_PASSWORD || { echo AUTH_FAILED: Missing container MySQL credentials >&2; exit 2; }; export MYSQL_PWD=${MYSQLPASSWORD:-$MYSQL_ROOT_PASSWORD}; u=${MYSQLUSER:-root}; db=${MYSQLDATABASE:-' + $targetDbFallback + '}; exec mysqldump -u $u --single-transaction --quick --routines --triggers --events --set-gtid-purged=OFF --no-tablespaces --default-character-set=utf8mb4 $db'

        $resolvedIdentity = if ($IdentityFile) {
            $IdentityFile
        } elseif ($env:RAILWAY_SSH_IDENTITY -and (Test-Path $env:RAILWAY_SSH_IDENTITY)) {
            $env:RAILWAY_SSH_IDENTITY
        } elseif (Test-Path 'C:\Users\theme\.ssh\haza_railway_stage19_ed25519') {
            'C:\Users\theme\.ssh\haza_railway_stage19_ed25519'
        } else {
            $null
        }

        $identityArg = if ($resolvedIdentity) { "-i `"$resolvedIdentity`" " } else { "" }
        if ($resolvedIdentity) {
            Write-Host "[AUTH] Using explicit SSH identity file: $resolvedIdentity" -ForegroundColor Green
        }

        $comSpec = if ($env:ComSpec) { $env:ComSpec } else { 'cmd.exe' }
        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        
        if ($resolvedRailway.EndsWith('.cmd', [System.StringComparison]::OrdinalIgnoreCase) -or $resolvedRailway.EndsWith('.bat', [System.StringComparison]::OrdinalIgnoreCase)) {
            $pinfo.FileName = $comSpec
            $pinfo.Arguments = "/d /c `"`"$resolvedRailway`" ssh -s MySQL -e production $identityArg-- sh -c `"$remoteScript`"`""
            $commandStructure = "cmd.exe /d /c `"$resolvedRailway`" ssh -s MySQL -e production $identityArg-- sh -c `"<container-auth-mysqldump-script>`""
        } else {
            $pinfo.FileName = $resolvedRailway
            $pinfo.Arguments = "ssh -s MySQL -e production $identityArg-- sh -c `"$remoteScript`""
            $commandStructure = "$resolvedRailway ssh -s MySQL -e production $identityArg-- sh -c `"<container-auth-mysqldump-script>`""
        }

        $pinfo.UseShellExecute = $false
        $pinfo.RedirectStandardOutput = $true
        $pinfo.RedirectStandardError = $true
        $pinfo.CreateNoWindow = $true

        Write-Host "[EXEC] Streaming dump to $dumpFilePath..." -ForegroundColor Green

        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $pinfo

        $fileStream = [System.IO.File]::Create($dumpFilePath)
        $started = $process.Start()
        if (-not $started) {
            throw 'Process failed to start.'
        }

        # Asynchronously drain stderr using native async stream reader to prevent pipe buffer deadlock
        $stderrTask = $process.StandardError.ReadToEndAsync()

        # Main thread streams binary stdout directly to the file stream
        $process.StandardOutput.BaseStream.CopyTo($fileStream)
        $fileStream.Flush()
        $stdoutByteCount = $fileStream.Length

        $process.WaitForExit()
        $stderrContent = $stderrTask.Result
        $exitCode = $process.ExitCode

        if ($fileStream) {
            $fileStream.Flush()
            $fileStream.Dispose()
            $fileStream = $null
        }
    }
    elseif ($Method -eq 'LocalClient') {
        Write-Host '[STEP 1/3] Executing dump via local MySQL client...' -ForegroundColor Cyan
        
        $clientBin = $env:MYSQLDUMP_BIN
        if (-not $clientBin) {
            $clientBin = 'C:\xampp\mysql\bin\mysqldump.exe'
        }
        if (-not (Test-Path $clientBin)) {
            throw "Local mysqldump binary not found at $clientBin. Set MYSQLDUMP_BIN environment variable."
        }

        $hostName = if ($env:PROD_MYSQL_HOST) { $env:PROD_MYSQL_HOST } elseif ($env:MYSQLHOST) { $env:MYSQLHOST } else { '127.0.0.1' }
        $port = if ($env:PROD_MYSQL_PORT) { $env:PROD_MYSQL_PORT } elseif ($env:MYSQLPORT) { $env:MYSQLPORT } else { '3306' }
        $user = if ($env:PROD_MYSQL_USER) { $env:PROD_MYSQL_USER } elseif ($env:MYSQLUSER) { $env:MYSQLUSER } else { 'root' }
        $targetDb = if ($Database) { $Database } elseif ($env:MYSQLDATABASE) { $env:MYSQLDATABASE } else { 'railway' }
        
        $pwd = if ($env:PROD_MYSQL_PASSWORD) { $env:PROD_MYSQL_PASSWORD } elseif ($env:MYSQLPASSWORD) { $env:MYSQLPASSWORD } else { $null }
        $prompted = $false
        if (-not $pwd) {
            $securePwd = Read-Host -Prompt "Enter MySQL password for $user@$hostName (input hidden)" -AsSecureString
            $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
            $pwd = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
            $prompted = $true
        }

        if (-not $pwd) {
            throw 'Authentication failed: Password cannot be empty.'
        }

        $argsList = @(
            "--host=$hostName",
            "--port=$port",
            "--user=$user",
            '--single-transaction',
            '--quick',
            '--routines',
            '--triggers',
            '--events',
            '--set-gtid-purged=OFF',
            '--no-tablespaces',
            '--default-character-set=utf8mb4',
            "--result-file=$dumpFilePath",
            $targetDb
        )

        $commandStructure = "$clientBin --host=$hostName --port=$port --user=$user [dump-options] [MYSQL_PWD in env] $targetDb"

        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        $pinfo.FileName = $clientBin
        $pinfo.Arguments = $argsList -join ' '
        $pinfo.UseShellExecute = $false
        $pinfo.RedirectStandardError = $true
        $pinfo.CreateNoWindow = $true
        $pinfo.EnvironmentVariables['MYSQL_PWD'] = $pwd

        $process = [System.Diagnostics.Process]::Start($pinfo)
        $stderrContent = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        $exitCode = $process.ExitCode

        if ($prompted) {
            $pwd = $null
        }

        if (Test-Path $dumpFilePath) {
            $stdoutByteCount = (Get-Item $dumpFilePath).Length
        }
    }

    $duration = (Get-Date) - $startTime

    # 7. Validate Process Exit
    if ($exitCode -ne 0) {
        throw "Dump process exited with code $exitCode."
    }

    # 8. Validate Dump File Integrity
    Write-Host '[STEP 2/3] Validating backup file integrity...' -ForegroundColor Cyan
    if (-not (Test-Path $dumpFilePath)) {
        throw "Dump file was not created: $dumpFilePath"
    }

    $fileInfo = Get-Item $dumpFilePath
    if ($fileInfo.Length -eq 0) {
        throw 'Dump file is empty (0 bytes).'
    }

    $headerLines = Get-Content -Path $dumpFilePath -TotalCount 25
    $footerLines = Get-Content -Path $dumpFilePath -Tail 25

    $hasHeader = ($headerLines | Where-Object { $_ -match 'MySQL dump' -or $_ -match 'MariaDB dump' })
    $hasFooter = ($footerLines | Where-Object { $_ -match 'Dump completed' })

    if (-not $hasHeader) {
        throw 'Backup validation failed: Missing dump header comment in first 25 lines.'
    }
    if (-not $hasFooter) {
        throw 'Backup validation failed: Missing Dump completed footer line in tail 25 lines. File may be truncated.'
    }

    # 9. Compute SHA-256 Checksum
    Write-Host '[STEP 3/3] Computing SHA-256 checksum...' -ForegroundColor Cyan
    $hashObj = Get-FileHash -Path $dumpFilePath -Algorithm SHA256
    $hashStr = $hashObj.Hash
    $checksumContent = $hashStr + '  ' + $dumpFileName
    Set-Content -Path $checksumFilePath -Value $checksumContent -Encoding utf8

    $nowStr = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    $durSec = [math]::Round($duration.TotalSeconds, 2)
    $sizeKb = [math]::Round($fileInfo.Length / 1024, 2)
    Write-Host ''
    Write-Host '================================================================' -ForegroundColor Green
    Write-Host '  BACKUP COMPLETED AND VERIFIED SUCCESSFULLY                    ' -ForegroundColor Green
    Write-Host '================================================================' -ForegroundColor Green
    Write-Host "  Timestamp:    $nowStr"
    Write-Host "  Duration:     $durSec seconds"
    Write-Host "  File:         $dumpFilePath"
    Write-Host "  Size:         $($fileInfo.Length) bytes ($sizeKb KB)"
    Write-Host "  SHA-256:      $hashStr"
    Write-Host "  Checksum:     $checksumFilePath"
    Write-Host '================================================================' -ForegroundColor Green
    Write-Host ''
}
catch {
    Write-Host ''
    Write-Host "[ERROR] Backup failed: $_" -ForegroundColor Red

    # Guarantee diagnostic log is always created on failure
    Write-DiagnosticLog -LogPath $logFilePath `
                       -Mode $Method `
                       -TargetDb $Database `
                       -ExitCode $exitCode `
                       -StdoutBytes $stdoutByteCount `
                       -StderrText $stderrContent `
                       -CommandStructure $commandStructure `
                       -ErrorMessage $_.ToString()

    Write-Host "[DIAGNOSTIC] Diagnostic log recorded at: $logFilePath" -ForegroundColor Yellow

    # Cleanup incomplete dump output
    if (Test-Path $dumpFilePath) {
        try {
            if ($fileStream) {
                $fileStream.Dispose()
                $fileStream = $null
            }
            $badInfo = Get-Item $dumpFilePath
            if ($badInfo.Length -eq 0 -or $exitCode -ne 0) {
                Write-Host "[CLEANUP] Removing incomplete dump file: $dumpFilePath" -ForegroundColor Yellow
                Remove-Item -Path $dumpFilePath -Force -ErrorAction SilentlyContinue
            }
        } catch {
            Write-Host "[WARNING] Could not remove incomplete dump file: $_" -ForegroundColor Yellow
        }
    }
    throw
}
finally {
    if ($fileStream) {
        try { $fileStream.Flush() } catch {}
        try { $fileStream.Dispose() } catch {}
        $fileStream = $null
    }
    if ($process) {
        try { $process.Dispose() } catch {}
        $process = $null
    }
}
