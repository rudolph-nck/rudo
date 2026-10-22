# Creates a "Procedure Runner" desktop shortcut with the app icon.
#  1) This PC runs Procedure Runner: the shortcut boots the server quietly in the background and opens the app window.
#     Optionally it also starts in the background when you sign in to Windows.
#  2) Connect to an address: the shortcut opens a teammate's or server's Procedure Runner in its own Edge window.
$root = Split-Path -Parent $PSScriptRoot
$appData = Join-Path $env:LOCALAPPDATA "ProcedureRunner"
New-Item -ItemType Directory -Force -Path $appData | Out-Null
$icon = Join-Path $appData "ProcedureRunner.ico"   # local copy so the shortcut still looks right if the share is offline
Copy-Item -Force (Join-Path $root "app\icons\ProcedureRunner.ico") $icon

Write-Host ""
Write-Host "How will this PC use Procedure Runner?"
Write-Host "  1) Run it on this PC - starts in the background when you open it (recommended)"
Write-Host "  2) Connect to a teammate's or server address"
$mode = Read-Host "Choose 1 or 2 (Enter = 1)"
$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath("Desktop")
$lnk = $shell.CreateShortcut((Join-Path $desktop "Procedure Runner.lnk"))
$ps = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$launcher = Join-Path $root "tools\Launch-ProcedureRunner.ps1"

if ($mode -ne "2") {
  $lnk.TargetPath = $ps
  $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""
  $lnk.WindowStyle = 7   # minimized: no console flash
  $lnk.WorkingDirectory = $root
  $auto = Read-Host "Also start Procedure Runner in the background when you sign in to Windows? (y/N)"
  if ($auto -match '^[yY]') {
    $st = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath("Startup")) "Procedure Runner (background).lnk"))
    $st.TargetPath = $ps
    $st.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`" -Background"
    $st.WindowStyle = 7; $st.WorkingDirectory = $root; $st.IconLocation = "$icon,0"; $st.Description = "Starts the Procedure Runner server at sign-in"
    $st.Save()
    Write-Host "Added to Windows startup. Remove it any time from Task Manager > Startup apps."
  }
} else {
  $Url = "http://localhost:8000/"
  $answer = Read-Host "Procedure Runner address (e.g. http://teammate-pc:8000/)"
  if ($answer) { $Url = $answer }
  if ($Url -notmatch '^https?://') { $Url = "http://$Url" }
  $edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($edge) { $lnk.TargetPath = $edge; $lnk.Arguments = "--app=$Url" } else { $lnk.TargetPath = $Url }
}
$lnk.IconLocation = "$icon,0"
$lnk.Description = "Core Team Procedure Runner"
$lnk.Save()
Write-Host "Done - 'Procedure Runner' is on your desktop. Right-click it > Pin to taskbar if you like."
