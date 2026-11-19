<#
.SYNOPSIS
  Copies the hourly Service Desk export (e.g. "Core - All.csv") from a SharePoint folder synced by OneDrive
  into the hub folder's import\ folder. Any open Core Work Hub then imports it automatically.

.DESCRIPTION
  * Copies only when the export changed (time or size), so it is safe to run every 15 minutes.
  * Copies to a temporary name first and then swaps it in, so the hub never reads half a file.
  * Skips a file that changed in the last 30 seconds (the export may still be writing it).
  * Works in Windows PowerShell 5.1 (built into Windows) and PowerShell 7. No credentials involved.

.EXAMPLE
  powershell -File .\Copy-ExportToHub.ps1 -Source 'C:\Users\nick\Contoso\IT - Documents\Exports\Core - All.csv' -HubFolder '\\fileserver\IT\CoreWorkHub'
#>
param(
  [Parameter(Mandatory)] [string] $Source,
  [Parameter(Mandatory)] [string] $HubFolder,
  # Name the hub looks for (hub-config.json autoImport.file; default "Core - All.csv").
  [string] $Name = 'Core - All.csv',
  [string] $LogFile = (Join-Path $env:LOCALAPPDATA 'CoreWorkHub\export-copy.log')
)
$ErrorActionPreference = 'Stop'
function Write-Log([string] $Message) {
  $dir = Split-Path $LogFile
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Add-Content -LiteralPath $LogFile -Value ('{0:u}  {1}' -f (Get-Date), $Message)
}
try {
  if (-not (Test-Path -LiteralPath $Source)) { Write-Log "Export not found: $Source (is the SharePoint folder synced on this PC?)"; exit 1 }
  $src = Get-Item -LiteralPath $Source
  if (((Get-Date).ToUniversalTime() - $src.LastWriteTimeUtc).TotalSeconds -lt 30) { Write-Log 'Export is still being written; will copy next run.'; exit 0 }

  $destDir = Join-Path $HubFolder 'import'
  if (-not (Test-Path -LiteralPath $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  $dest = Join-Path $destDir $Name
  if (Test-Path -LiteralPath $dest) {
    $d = Get-Item -LiteralPath $dest
    if ($d.Length -eq $src.Length -and $d.LastWriteTimeUtc -eq $src.LastWriteTimeUtc) { exit 0 }  # unchanged
  }
  $tmp = "$dest.copying"   # not .csv, so the hub ignores it
  Copy-Item -LiteralPath $Source -Destination $tmp -Force
  (Get-Item -LiteralPath $tmp).LastWriteTimeUtc = $src.LastWriteTimeUtc
  Move-Item -LiteralPath $tmp -Destination $dest -Force
  Write-Log ("Copied export ({0:N0} bytes, exported {1:u}) to {2}" -f $src.Length, $src.LastWriteTime, $dest)
} catch {
  Write-Log "FAILED: $($_.Exception.Message)"
  exit 1
}
