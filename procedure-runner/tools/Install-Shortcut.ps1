# Creates a "Procedure Runner" desktop shortcut that opens the app in its own Edge window (no tabs/address bar).
param([string]$Url = "http://localhost:8000/")
$answer = Read-Host "Procedure Runner address (press Enter for $Url)"
if ($answer) { $Url = $answer }
if ($Url -notmatch '^https?://') { $Url = "http://$Url" }

# Keep a local copy of the icon so the shortcut still looks right if the share is offline.
$appData = Join-Path $env:LOCALAPPDATA "ProcedureRunner"
New-Item -ItemType Directory -Force -Path $appData | Out-Null
$icon = Join-Path $appData "ProcedureRunner.ico"
Copy-Item -Force (Join-Path $PSScriptRoot "..\app\icons\ProcedureRunner.ico") $icon

$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1

$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath("Desktop")) "Procedure Runner.lnk"))
if ($edge) { $lnk.TargetPath = $edge; $lnk.Arguments = "--app=$Url" } else { $lnk.TargetPath = $Url }
$lnk.IconLocation = "$icon,0"
$lnk.Description = "Core Team Procedure Runner"
$lnk.Save()
Write-Host "Done - 'Procedure Runner' is on your desktop. Pin it to the taskbar from there if you like."
