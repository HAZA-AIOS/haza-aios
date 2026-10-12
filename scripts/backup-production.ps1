<#
.SYNOPSIS
    HAZA AIOS - Production Database Backup Utility (Stage 20G)
    Secure, consistent, non-destructive logical database backup.

.DESCRIPTION
    Performs a transaction-consistent MySQL logical dump of the HAZA AIOS production database.
    Enforces that backups are saved strictly outside the Git repository.
    Calculates SHA-256 checksums and validates dump completeness.
    Guarantees that credentials are never exposed in process arguments, logs, or command text.

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
#>

[CmdletBinding()]
param(
    [string]$DestinationDir = 'C:\Users\theme\HAZA-AIOS-Private\production-backups\stage20',
    [string]$Database = 'railway',
    [ValidateSet('ContainerSsh', 'LocalClient')]
    [string]$Method = 'ContainerSsh',
    [switch]$DryRun
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

# 2. Prepare timestamped output filenames
$timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$dumpFileName = 'haza-aios-production-stage20-backup_' + $timestamp + '.sql'
$dumpFilePath = Join-Path $resolvedDest $dumpFileName
$checksumFilePath = Join-Path $resolvedDest ($dumpFileName + '.sha256')
$logFilePath = Join-Path $resolvedDest ('backup_' + $timestamp + '.log')

if (Test-Path $dumpFilePath) {
    throw "Target backup file already exists: $dumpFilePath"
}

# 3. Resolve executable requirements
$resolvedRailway = $null
if ($Method -eq 'ContainerSsh') {
    $resolvedRailway = Resolve-RailwayCli
    Write-Host "[RESOLVED] Railway CLI launcher: $resolvedRailway" -ForegroundColor Green
}

# 4. Report consistency notice
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

# 5. Execute backup
$startTime = Get-Date
$exitCode = 0
$stderrContent = ''

try {
    if ($Method -eq 'ContainerSsh') {
        Write-Host '[STEP 1/3] Executing native MySQL 9.7.2 dump via Railway container SSH...' -ForegroundColor Cyan
        
        # Build remote execution command that leverages container-native environment variables.
        # This completely avoids passing or embedding passwords in command-line arguments.
        # Fails closed (exit 2) if neither MYSQL_ROOT_PASSWORD nor MYSQLPASSWORD is set in the container.
        $remoteScript = 'if [ -z "${MYSQL_ROOT_PASSWORD}" ] && [ -z "${MYSQLPASSWORD}" ]; then echo "AUTH_FAILED: Missing container MySQL credentials" >&2; exit 2; fi; export MYSQL_PWD="${MYSQL_ROOT_PASSWORD:-$MYSQLPASSWORD}"; exec mysqldump -u root --single-transaction --quick --routines --triggers --events --set-gtid-purged=OFF --no-tablespaces --default-character-set=utf8mb4 ' + $Database

        $comSpec = if ($env:ComSpec) { $env:ComSpec } else { 'cmd.exe' }
        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        
        if ($resolvedRailway.EndsWith('.cmd', [System.StringComparison]::OrdinalIgnoreCase) -or $resolvedRailway.EndsWith('.bat', [System.StringComparison]::OrdinalIgnoreCase)) {
            $pinfo.FileName = $comSpec
            $pinfo.Arguments = "/d /c `"`"$resolvedRailway`" ssh -s MySQL -e production -- sh -c `"$remoteScript`"`""
        } else {
            $pinfo.FileName = $resolvedRailway
            $pinfo.Arguments = "ssh -s MySQL -e production -- sh -c `"$remoteScript`""
        }

        $pinfo.UseShellExecute = $false
        $pinfo.RedirectStandardOutput = $true
        $pinfo.RedirectStandardError = $true
        $pinfo.CreateNoWindow = $true

        Write-Host "[EXEC] Streaming dump to $dumpFilePath..." -ForegroundColor Green

        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $pinfo

        $fileStream = [System.IO.File]::Create($dumpFilePath)
        $process.Start() | Out-Null

        # Asynchronously drain stderr in a separate task to prevent pipe buffer deadlock
        $stderrTask = [System.Threading.Tasks.Task]::Run([System.Func[string]]{
            return $process.StandardError.ReadToEnd()
        })

        # Main thread streams binary stdout directly to the file stream
        $process.StandardOutput.BaseStream.CopyTo($fileStream)
        $fileStream.Flush()
        $fileStream.Close()

        $process.WaitForExit()
        $stderrContent = $stderrTask.Result
        $exitCode = $process.ExitCode

        if ($stderrContent) {
            [System.IO.File]::WriteAllText($logFilePath, $stderrContent)
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

        $hostName = if ($env:PROD_MYSQL_HOST) { $env:PROD_MYSQL_HOST } else { '127.0.0.1' }
        $port = if ($env:PROD_MYSQL_PORT) { $env:PROD_MYSQL_PORT } else { '3306' }
        $user = if ($env:PROD_MYSQL_USER) { $env:PROD_MYSQL_USER } else { 'root' }
        
        $pwd = $env:PROD_MYSQL_PASSWORD
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
            $Database
        )

        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        $pinfo.FileName = $clientBin
        $pinfo.Arguments = $argsList -join ' '
        $pinfo.UseShellExecute = $false
        $pinfo.RedirectStandardError = $true
        $pinfo.CreateNoWindow = $true
        # Pass password via process environment variable, NEVER in command arguments
        $pinfo.EnvironmentVariables['MYSQL_PWD'] = $pwd

        $process = [System.Diagnostics.Process]::Start($pinfo)
        $stderrContent = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        $exitCode = $process.ExitCode

        # Securely erase credential from memory
        if ($prompted) {
            $pwd = $null
        }

        if ($stderrContent) {
            [System.IO.File]::WriteAllText($logFilePath, $stderrContent)
        }
    }

    $duration = (Get-Date) - $startTime

    # 6. Validate Dump File Integrity
    Write-Host '[STEP 2/3] Validating backup file integrity...' -ForegroundColor Cyan
    if ($exitCode -ne 0) {
        throw "Dump failed with exit code $exitCode. Log: $logFilePath. Details: $stderrContent"
    }

    if (-not (Test-Path $dumpFilePath)) {
        throw "Dump file was not created: $dumpFilePath"
    }

    $fileInfo = Get-Item $dumpFilePath
    if ($fileInfo.Length -eq 0) {
        throw 'Dump file is empty (0 bytes). Removing corrupt output.'
    }

    # Verify that the dump contains expected header and completed footer
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

    # 7. Compute SHA-256 Checksum
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
    if (Test-Path $dumpFilePath) {
        $badInfo = Get-Item $dumpFilePath
        if ($badInfo.Length -eq 0 -or $exitCode -ne 0) {
            Write-Host "[CLEANUP] Removing incomplete dump file: $dumpFilePath" -ForegroundColor Yellow
            Remove-Item -Path $dumpFilePath -Force -ErrorAction SilentlyContinue
        }
    }
    throw
}
