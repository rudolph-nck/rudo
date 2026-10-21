@echo off
rem Starts the Org Chart Builder team server in this window and opens the app.
rem Keep the window open while people use the chart; closing it stops the server.
rem If the server is already running, this just opens the app.
rem Teammates open the "Teammates" address printed below. The chart is saved in .\data (change with --data).
title Org Chart Builder server
setlocal
cd /d "%~dp0"
set "PORT=8010"
set "URL=http://localhost:%PORT%/"
set "OPEN=powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\Open-App.ps1" -Url %URL%"

powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing %URL%api/ping -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo Org Chart Builder is already running - opening it.
  %OPEN% -Delay 0
  exit /b 0
)

where py >nul 2>nul && (set "PY=py") || (set "PY=python")
where %PY% >nul 2>nul || (
  echo Python is not installed on this PC. Install it from https://www.python.org/downloads/ ^(tick "Add python.exe to PATH"^), then try again.
  pause
  exit /b 1
)

echo Starting Org Chart Builder. Keep this window open while people use the chart - close it to stop the server.
echo.
rem open the app once the server has had a moment to start
start "" /b %OPEN% -Delay 2
%PY% server.py --port %PORT%
if errorlevel 1 (
  echo.
  echo The server stopped with an error. Is port %PORT% already used by another program?
  pause
)
endlocal
