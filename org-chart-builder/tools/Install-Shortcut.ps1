# Creates an "Org Chart Builder" desktop shortcut that opens the app in its own Edge window (no tabs/address bar).
param([string]$Url = "http://localhost:8010/")
$answer = Read-Host "Org Chart Builder address (press Enter for $Url)"
if ($answer) { $Url = $answer }
if ($Url -notmatch '^https?://') { $Url = "http://$Url" }

# Keep a local copy of the icon so the shortcut still looks right when the shared drive is offline.
$appData = Join-Path $env:LOCALAPPDATA "OrgChartBuilder"
New-Item -ItemType Directory -Force -Path $appData | Out-Null
$icon = Join-Path $appData "OrgChartBuilder.ico"
Copy-Item -Force (Join-Path $PSScriptRoot "..\app\icons\OrgChartBuilder.ico") $icon

$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1

# The Desktop may be redirected to OneDrive or by Group Policy; GetFolderPath returns the real one.
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath("Desktop")) "Org Chart Builder.lnk"))
if ($edge) { $lnk.TargetPath = $edge; $lnk.Arguments = "--app=$Url" } else { $lnk.TargetPath = $Url }
$lnk.IconLocation = "$icon,0"
$lnk.Description = "Org Chart Builder"
$lnk.Save()
Write-Host "Done - 'Org Chart Builder' is on your desktop. Pin it to the taskbar from there if you like."
