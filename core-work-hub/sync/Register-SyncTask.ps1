#Requires -Version 7.0
<#
.SYNOPSIS
  Registers the Service Desk sync in Windows Task Scheduler on Nick's PC:
  every 15 minutes, 7:00–18:00, Monday–Friday, as the current user (so it can read the
  Credential Manager entry and the shared folder). Run once, in a normal (non-admin) PowerShell 7.
#>
param(
  [Parameter(Mandatory)] [string] $HubFolder,
  [Parameter(Mandatory)] [string] $BaseUrl,
  [Parameter(Mandatory)] [string[]] $Groups,
  [ValidateSet('OnPrem', 'Cloud')] [string] $Edition = 'OnPrem',
  [string] $Start = '07:00',
  [int] $Hours = 11,
  [string] $TaskName = 'Core Work Hub - Service Desk sync'
)
$script = Join-Path $PSScriptRoot 'Sync-ServiceDesk.ps1'
$groupArg = ($Groups | ForEach-Object { "'" + $_.Replace("'", "''") + "'" }) -join ','
$cmd = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command `"& '$script' -HubFolder '$HubFolder' -BaseUrl '$BaseUrl' -Groups $groupArg -Edition $Edition`""
$action = New-ScheduledTaskAction -Execute (Get-Command pwsh).Source -Argument $cmd
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday -At $Start
$trigger.Repetition = (New-ScheduledTaskTrigger -Once -At $Start -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Hours $Hours)).Repetition
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Reads Service Desk (read-only) and writes tickets.json for the Core Work Hub.' -Force | Out-Null
Write-Host "Registered '$TaskName'. Run it now with: Start-ScheduledTask -TaskName '$TaskName'"
