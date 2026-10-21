@echo off
rem Starts the Org Chart Builder team server from this folder and opens it in the browser.
rem Teammates open the "Teammates" address printed below. The chart is saved in .\data (change with --data).
setlocal
cd /d "%~dp0"
set "PORT=8010"
where py >nul 2>nul && (set "PY=py") || (set "PY=python")
start "" "http://localhost:%PORT%/"
%PY% server.py --port %PORT%
if errorlevel 1 (
  echo.
  echo The server stopped with an error. Is Python installed, or is port %PORT% already in use?
  pause
)
endlocal
