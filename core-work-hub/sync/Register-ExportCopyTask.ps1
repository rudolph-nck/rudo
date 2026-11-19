<#
.SYNOPSIS
  Schedules Copy-ExportToHub.ps1 every 15 minutes, all day, as the current user (who has the SharePoint
  folder synced). Run once in a normal (non-admin) PowerShell window. Windows PowerShell 5.1 is fine.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\Register-ExportCopyTask.ps1 -Source 'C:\Users\nick\Contoso\IT - Documents\Exports\Core - All.csv' -HubFolder '\\fileserver\IT\CoreWorkHub'
#>
param(
  [Parameter(Mandatory)] [string] $Source,
  [Parameter(Mandatory)] [string] $HubFolder,
  [string] $Name = 'Core - All.csv',
  # When -Source is a folder: which export to take (newest match).
  [string] $Pattern = 'Core - All*.csv',
  [int] $EveryMinutes = 15,
  [string] $TaskName = 'Core Work Hub - copy Service Desk export'
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Source)) { throw "Can't see $Source. Sync the SharePoint folder to this PC first (SharePoint -> Sync), then copy the file's path (right-click -> Copy as path)." }
if (-not (Test-Path -LiteralPath $HubFolder -PathType Container)) { throw "Can't reach the hub folder $HubFolder." }
# A mapped drive (e.g. I:\Core\Hub) may not exist for a scheduled task: use the network path behind it.
if ($HubFolder -match '^([A-Za-z]):(.*)$') {
  $drive = Get-PSDrive -Name $Matches[1] -PSProvider FileSystem -ErrorAction SilentlyContinue
  if ($drive -and $drive.DisplayRoot -like '\\*') {
    $unc = $drive.DisplayRoot.TrimEnd('\') + $Matches[2]
    if (Test-Path -LiteralPath $unc -PathType Container) {
      Write-Host "Using the network path for ${HubFolder}: $unc"
      $HubFolder = $unc
    }
  }
}
if (-not (Test-Path -LiteralPath (Join-Path $HubFolder 'index.html'))) { Write-Warning "$HubFolder has no index.html. Is this the Core Work Hub folder?" }
if (Test-Path -LiteralPath $Source -PathType Container) {
  $found = Get-ChildItem -LiteralPath $Source -File -Filter $Pattern | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  if ($found) { Write-Host "Export found: $($found.Name) (last written $($found.LastWriteTime))" }
  else { Write-Warning "No '$Pattern' in $Source yet. The task will pick it up (or the newest CSV there) once the export arrives." }
}
# Keep the script next to the hub, outside the package folder, so the task survives the package being moved.
$appDir = Join-Path $env:LOCALAPPDATA 'CoreWorkHub'
New-Item -ItemType Directory -Path $appDir -Force | Out-Null
$script = Join-Path $appDir 'Copy-ExportToHub.ps1'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Copy-ExportToHub.ps1') -Destination $script -Force
$q = { param($s) "'" + $s.Replace("'", "''") + "'" }
$cmd = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"& $(& $q $script) -Source $(& $q $Source) -HubFolder $(& $q $HubFolder) -Name $(& $q $Name) -Pattern $(& $q $Pattern)`""
$action = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -Argument $cmd
$trigger = New-ScheduledTaskTrigger -Daily -At '00:00'
$trigger.Repetition = (New-ScheduledTaskTrigger -Once -At '00:00' -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes) -RepetitionDuration (New-TimeSpan -Hours 23 -Minutes 59)).Repetition
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Copies the Service Desk export from SharePoint into the Core Work Hub import folder.' -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Host "Registered '$TaskName' (every $EveryMinutes minutes) and ran it once."
Write-Host "Check: $HubFolder\import\$Name should appear; log: $appDir\export-copy.log"
