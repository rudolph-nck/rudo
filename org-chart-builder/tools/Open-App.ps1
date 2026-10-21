# Opens Org Chart Builder in its own Edge window (no tabs/address bar), or the default browser if Edge isn't installed.
param([string]$Url = "http://localhost:8010/", [int]$Delay = 0)
if ($Delay -gt 0) { Start-Sleep -Seconds $Delay }
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if ($edge) { Start-Process $edge "--app=$Url" } else { Start-Process $Url }
