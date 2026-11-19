# Creates a "Core Work Hub" desktop shortcut for the current user.
# The shortcut runs pythonw (no console window) on app\hub_server.py in the shared hub folder.
param([Parameter(Mandatory)] [string] $HubFolder)

$hub = (Resolve-Path -LiteralPath $HubFolder).ProviderPath
$server = Join-Path $hub 'app\hub_server.py'
if (-not (Test-Path -LiteralPath $server)) { Write-Host "Can't find $server. Run this from the shared hub folder."; exit 1 }

$py = (Get-Command pythonw -ErrorAction SilentlyContinue).Source
if (-not $py) { $py = (Get-Command pyw -ErrorAction SilentlyContinue).Source }

$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut((Join-Path $desktop 'Core Work Hub.lnk'))
if ($py) {
  $lnk.TargetPath = $py
  $lnk.Arguments = '"' + $server + '" --folder "' + $hub + '"'
} else {
  # No pythonw on PATH: fall back to the batch file (it looks for py/python too).
  $lnk.TargetPath = Join-Path $hub 'Core Work Hub.bat'
}
$lnk.WorkingDirectory = $env:USERPROFILE
# Keep a local copy of the icon: Windows often shows a blank icon when it lives on a network drive.
$iconDir = Join-Path $env:LOCALAPPDATA 'CoreWorkHub'
New-Item -ItemType Directory -Path $iconDir -Force | Out-Null
$icon = Join-Path $iconDir 'CoreWorkHub.ico'
Copy-Item -LiteralPath (Join-Path $hub 'app\CoreWorkHub.ico') -Destination $icon -Force
$lnk.IconLocation = $icon + ',0'
$lnk.Description = 'IT Core Work Hub'
$lnk.Save()
# Ask Explorer to redraw icons so the new one shows without signing out.
try { Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\ie4uinit.exe') -ArgumentList '-show' -WindowStyle Hidden -ErrorAction Stop } catch { }

if ($py) { Write-Host 'Desktop icon created: "Core Work Hub".' }
else { Write-Host 'Desktop icon created, but Python 3 was not found. Ask IT to install Python 3.8 or later.' }
