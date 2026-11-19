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
  [int] $EveryMinutes = 15,
  [string] $TaskName = 'Core Work Hub - copy Service Desk export'
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Source)) { throw "Can't see $Source. Sync the SharePoint folder to this PC first (SharePoint -> Sync), then copy the file's path (right-click -> Copy as path)." }
if (-not (Test-Path -LiteralPath $HubFolder)) { throw "Can't reach the hub folder $HubFolder." }
# Keep the script next to the hub, outside the package folder, so the task survives the package being moved.
$appDir = Join-Path $env:LOCALAPPDATA 'CoreWorkHub'
New-Item -ItemType Directory -Path $appDir -Force | Out-Null
$script = Join-Path $appDir 'Copy-ExportToHub.ps1'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Copy-ExportToHub.ps1') -Destination $script -Force
$q = { param($s) "'" + $s.Replace("'", "''") + "'" }
$cmd = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"& $(& $q $script) -Source $(& $q $Source) -HubFolder $(& $q $HubFolder) -Name $(& $q $Name)`""
$action = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -Argument $cmd
$trigger = New-ScheduledTaskTrigger -Daily -At '00:00'
$trigger.Repetition = (New-ScheduledTaskTrigger -Once -At '00:00' -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes) -RepetitionDuration (New-TimeSpan -Hours 23 -Minutes 59)).Repetition
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Copies the Service Desk export from SharePoint into the Core Work Hub import folder.' -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Host "Registered '$TaskName' (every $EveryMinutes minutes) and ran it once."
Write-Host "Check: $HubFolder\import\$Name should appear; log: $appDir\export-copy.log"
