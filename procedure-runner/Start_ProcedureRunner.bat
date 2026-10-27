@echo off
rem Starts the Procedure Runner team server from this folder and opens it in the browser once it is ready.
rem If an older copy is still running (e.g. the desktop app's background server), it is stopped first.
rem Teammates open the "Teammates" address printed below. Port / data folder: ProcedureRunner.cfg (optional).
setlocal
cd /d "%~dp0"
where py >nul 2>nul && (set "PY=py") || (set "PY=python")
%PY% server.py --open
if errorlevel 1 (
  echo.
  echo The server stopped with an error. Is Python installed? Run Diagnose_ProcedureRunner.bat to see what is going on.
  pause
)
endlocal
