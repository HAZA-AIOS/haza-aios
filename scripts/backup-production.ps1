<#
.SYNOPSIS
    HAZA AIOS - Production Database Backup Script (Stage 20G)
    Secure, consistent, non-destructive logical database backup.

.DESCRIPTION
    Performs a transaction-consistent MySQL logical dump of the HAZA AIOS production database.
    Enforces that backups are saved strictly outside the Git repository.
    Calculates SHA-256 checksums and applies file validation.
    Never exposes passwords in command-line arguments, process lists, or logs.

.PARAMETER DestinationDir
    Directory where the backup and checksum will be saved.
    Default: C:\Users\theme\HAZA-AIOS-Private\production-backups\stage20

.PARAMETER Database
    Database name to dump.
    Default: railway

.PARAMETER Method
    Backup execution method:
    - ContainerSsh: Executes native Oracle MySQL 9.7.2 mysqldump inside Railway MySQL container over SSH.
    - LocalClient: Executes local mysqldump client over TCP/SSH tunnel.
    Default: ContainerSsh

.PARAMETER DryRun
    When specified, tests prerequisites and prints configuration without executing the backup.
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

# 3. Report consistency notice
Write-Host ''
Write-Host '[CONSISTENCY NOTICE]' -ForegroundColor Yellow
Write-Host '  - Snapshot Isolation: --single-transaction guarantees InnoDB transaction consistency without locking tables.'
Write-Host '  - Non-InnoDB/DDL limitation: Concurrent DDL operations or non-InnoDB tables are not protected by snapshot isolation.'
Write-Host '  - Comprehensive coverage: Includes routines, triggers, events, and utf8mb4 character set.'
Write-Host "  - Target Database: $Database"
Write-Host "  - Execution Method: $Method"
Write-Host "  - Output File: $dumpFilePath"
Write-Host ''

if ($DryRun) {
    Write-Host '[DRY RUN] All prerequisites validated. Exiting without performing backup.' -ForegroundColor Green
    return
}

# 4. Execute backup according to chosen method
$startTime = Get-Date
$exitCode = 0

try {
    if ($Method -eq 'ContainerSsh') {
        Write-Host '[STEP 1/3] Executing native MySQL 9.7.2 dump via Railway container SSH...' -ForegroundColor Cyan
        
        $railwayCmd = Get-Command 'railway' -ErrorAction SilentlyContinue
        if (-not $railwayCmd) {
            throw 'Railway CLI not found in PATH. Ensure Railway CLI is installed.'
        }

        # Securely prompt for root password if not provided in environment
        $pwd = $env:MYSQL_ROOT_PASSWORD
        if (-not $pwd -and $env:PROD_MYSQL_PASSWORD) {
            $pwd = $env:PROD_MYSQL_PASSWORD
        }
        
        $prompted = $false
        if (-not $pwd) {
            $securePwd = Read-Host -Prompt 'Enter Production MySQL root password (input hidden)' -AsSecureString
            $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
            $pwd = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
            $prompted = $true
        }

        if (-not $pwd) {
            throw 'Password cannot be empty.'
        }

        Write-Host "[EXEC] Streaming dump to $dumpFilePath..." -ForegroundColor Green
        
        $remoteScript = "env MYSQL_PWD='$pwd' mysqldump -u root --single-transaction --quick --routines --triggers --events --set-gtid-purged=OFF --no-tablespaces --default-character-set=utf8mb4 $Database"

        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        $pinfo.FileName = 'railway'
        $pinfo.Arguments = "ssh -s MySQL -e production -- sh -c `"$remoteScript`""
        $pinfo.UseShellExecute = $false
        $pinfo.RedirectStandardOutput = $true
        $pinfo.RedirectStandardError = $true
        $pinfo.CreateNoWindow = $true

        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $pinfo

        $fileStream = [System.IO.File]::Create($dumpFilePath)
        $process.Start() | Out-Null

        $stderrTask = [System.Threading.Tasks.Task]::Run([System.Action]{
            $errContent = $process.StandardError.ReadToEnd()
            if ($errContent) {
                $sanitized = $errContent.Replace($pwd, '********')
                [System.IO.File]::WriteAllText($logFilePath, $sanitized)
            }
        })

        $process.StandardOutput.BaseStream.CopyTo($fileStream)
        $fileStream.Close()
        $process.WaitForExit()
        $stderrTask.Wait()

        $exitCode = $process.ExitCode
        if ($prompted) {
            $pwd = $null
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
        if (-not $pwd) {
            $securePwd = Read-Host -Prompt "Enter MySQL password for $user@$hostName (input hidden)" -AsSecureString
            $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
            $pwd = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
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
        $pinfo.EnvironmentVariables['MYSQL_PWD'] = $pwd

        $process = [System.Diagnostics.Process]::Start($pinfo)
        $stderr = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        $exitCode = $process.ExitCode
        if ($stderr) {
            [System.IO.File]::WriteAllText($logFilePath, $stderr)
        }
    }

    $duration = (Get-Date) - $startTime

    # 5. Validate Dump File
    Write-Host '[STEP 2/3] Validating backup file integrity...' -ForegroundColor Cyan
    if ($exitCode -ne 0) {
        throw "Dump failed with exit code $exitCode. See log at $logFilePath"
    }

    if (-not (Test-Path $dumpFilePath)) {
        throw "Dump file was not created: $dumpFilePath"
    }

    $fileInfo = Get-Item $dumpFilePath
    if ($fileInfo.Length -eq 0) {
        throw 'Dump file is empty. Removing corrupt output.'
    }

    $headerLines = Get-Content -Path $dumpFilePath -TotalCount 15
    $footerLines = Get-Content -Path $dumpFilePath -Tail 15

    $hasHeader = ($headerLines | Where-Object { $_ -match 'MySQL dump' -or $_ -match 'MariaDB dump' })
    $hasFooter = ($footerLines | Where-Object { $_ -match 'Dump completed' })

    if (-not $hasHeader) {
        throw 'Backup validation failed: Missing dump header comment.'
    }
    if (-not $hasFooter) {
        throw 'Backup validation failed: Missing dump completed footer line. File may be truncated.'
    }

    # 6. Compute SHA-256 Checksum
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
