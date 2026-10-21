# Creates an "Org Chart Builder" desktop shortcut with the app icon.
#  1) On the PC that hosts the chart: the shortcut runs Start_OrgChartBuilder.bat, which opens the server console
#     and then the app (if the server is already running it just opens the app).
#  2) On a teammate's PC: the shortcut opens the host's address in its own Edge window.
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Write-Host ""
Write-Host "  1) This PC runs Org Chart Builder (the shortcut starts the server console and opens the app)"
Write-Host "  2) Connect to Org Chart Builder running on another PC"
$choice = Read-Host "Choose 1 or 2 (press Enter for 1)"

# Keep a local copy of the icon so the shortcut still looks right when the shared drive is offline.
$appData = Join-Path $env:LOCALAPPDATA "OrgChartBuilder"
New-Item -ItemType Directory -Force -Path $appData | Out-Null
$icon = Join-Path $appData "OrgChartBuilder.ico"
Copy-Item -Force (Join-Path $root "app\icons\OrgChartBuilder.ico") $icon

# The Desktop may be redirected to OneDrive or by Group Policy; GetFolderPath returns the real one.
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath("Desktop")) "Org Chart Builder.lnk"))
if ($choice -eq "2") {
  $Url = Read-Host "Address of the PC running it (e.g. http://hr-pc-07:8010/)"
  if ($Url -notmatch '^https?://') { $Url = "http://$Url" }
  $edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($edge) { $lnk.TargetPath = $edge; $lnk.Arguments = "--app=$Url" } else { $lnk.TargetPath = $Url }
  $lnk.Description = "Org Chart Builder ($Url)"
} else {
  $lnk.TargetPath = Join-Path $root "Start_OrgChartBuilder.bat"
  $lnk.WorkingDirectory = $root
  $lnk.WindowStyle = 1
  $lnk.Description = "Start the Org Chart Builder server and open the app"
}
$lnk.IconLocation = "$icon,0"
$lnk.Save()
Write-Host ""
Write-Host "Done - 'Org Chart Builder' is on your desktop. Pin it to the taskbar from there if you like."
