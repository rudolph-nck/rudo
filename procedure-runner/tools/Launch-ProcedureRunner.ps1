# Procedure Runner desktop launcher.
#   (no switch)   boot the server in the background if it isn't running, then open the app in its own window
#   -Background   boot the server only (used by the "start when I sign in" shortcut)
#   -Stop         stop the background server
# Optional settings in ProcedureRunner.cfg next to the app (one per line): PORT=8000, HOST=127.0.0.1, DATA=I:\Core\ProcedureRunner\data
param([switch]$Background, [switch]$Stop)
$root = Split-Path -Parent $PSScriptRoot
$cfg = @{ PORT = '8000'; HOST = '127.0.0.1'; DATA = 'data' }
$cfgFile = Join-Path $root 'ProcedureRunner.cfg'
if (Test-Path $cfgFile) {
  Get-Content $cfgFile | Where-Object { $_ -notmatch '^\s*[#;]' } | ForEach-Object { if ($_ -match '^\s*([A-Za-z]+)\s*=\s*(.*?)\s*$') { $cfg[$matches[1].ToUpper()] = $matches[2] } }
}
$port = [int]$cfg.PORT
$data = if ([IO.Path]::IsPathRooted($cfg.DATA)) { $cfg.DATA } else { Join-Path $root $cfg.DATA }
$url = "http://localhost:$port/"
$logDir = Join-Path $env:LOCALAPPDATA 'ProcedureRunner'   # logs stay on this PC, so several people can share one data folder
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Say($msg) { Add-Type -AssemblyName PresentationFramework; [void][System.Windows.MessageBox]::Show($msg, 'Procedure Runner') }
function Get-Running { try { $r = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri "$($url)api/ping").Content | ConvertFrom-Json; if ($r.server -eq 'procedure-runner') { $r } else { $null } } catch { $null } }
function Test-Server { [bool](Get-Running) }
function Same-Path($a, $b) { if (-not $a -or -not $b) { return $false }; try { return [IO.Path]::GetFullPath($a).TrimEnd('\').ToLower() -eq [IO.Path]::GetFullPath($b).TrimEnd('\').ToLower() } catch { return $false } }
$myVersion = if ((Get-Content (Join-Path $root 'server.py') -Raw) -match 'VERSION = "([^"]+)"') { $matches[1] } else { '' }

if ($Stop) {
  $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
  $stopped = 0
  foreach ($p in $pids) { $proc = Get-Process -Id $p -ErrorAction SilentlyContinue; if ($proc -and $proc.ProcessName -match '^(py|pyw|python|pythonw)\d*$') { Stop-Process -Id $p -Force; $stopped++ } }
  if ($stopped) { Say "Procedure Runner stopped." } else { Say "Procedure Runner wasn't running on port $port." }
  exit 0
}

# A copy that is already running is only reused if it is this version, from this folder, on this data folder.
# Otherwise (typically the hidden background server of an older version) it is stopped, so the new version really loads.
$running = Get-Running
if ($running -and -not ($running.version -eq $myVersion -and (Same-Path $running.appDir $root) -and (Same-Path $running.dataDir $data))) {
  $oldPid = if ($running.pid) { [int]$running.pid } else { Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1 } # older versions don't report their pid
  $old = if ($oldPid) { Get-Process -Id $oldPid -ErrorAction SilentlyContinue } else { $null }
  if ($old -and $old.ProcessName -match '^(py|pyw|python|pythonw)\d*$') {
    Stop-Process -Id $old.Id -Force
    for ($i = 0; $i -lt 20 -and (Test-Server); $i++) { Start-Sleep -Milliseconds 250 }
  } else {
    Say "An older Procedure Runner ($($running.version), $($running.appDir)) is using port $port and couldn't be stopped automatically.`n`nRun Stop_ProcedureRunner.bat from that folder, then open Procedure Runner again."
    exit 1
  }
}
if (-not (Test-Server)) {
  # Prefer the windowless Python (pyw / pythonw) so no console window ever appears
  $py = $null; $pre = @()
  foreach ($c in @(@('pyw', '-3'), @('pythonw', $null), @('py', '-3'), @('python', $null))) {
    $cmd = Get-Command $c[0] -ErrorAction SilentlyContinue | Where-Object { $_.Source -notmatch 'WindowsApps' } | Select-Object -First 1
    if ($cmd) { $py = $cmd; if ($c[1]) { $pre = @($c[1]) }; break }
  }
  if (-not $py) { Say "Python 3 isn't installed on this PC.`n`nInstall it from the Software Center (or python.org), then open Procedure Runner again."; exit 1 }
  New-Item -ItemType Directory -Force -Path $data | Out-Null
  $argList = $pre + @("`"$(Join-Path $root 'server.py')`"", '--port', "$port", '--host', $cfg.HOST, '--data', "`"$data`"")
  Start-Process -FilePath $py.Source -ArgumentList $argList -WorkingDirectory $root -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'server.log') -RedirectStandardError (Join-Path $logDir 'server-errors.log')
  $ok = $false
  for ($i = 0; $i -lt 60 -and -not $ok; $i++) { Start-Sleep -Milliseconds 250; $ok = Test-Server }
  if (-not $ok) {
    $err = (Get-Content (Join-Path $logDir 'server.log'), (Join-Path $logDir 'server-errors.log') -Tail 6 -ErrorAction SilentlyContinue) -join "`n"
    Say "Procedure Runner didn't start on port $port.`n`n$err`n`nLogs: $logDir"
    exit 1
  }
}
if ($Background) { exit 0 }

$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($edge) { Start-Process -FilePath $edge -ArgumentList "--app=$url" } else { Start-Process $url }
