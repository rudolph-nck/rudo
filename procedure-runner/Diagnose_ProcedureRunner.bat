@echo off
rem Shows which Procedure Runner is running, from which folder and data folder, and what to fix.
rem The report is also saved as diagnose.txt next to this file - send it to whoever is helping you.
setlocal
cd /d "%~dp0"
where py >nul 2>nul && (set "PY=py") || (set "PY=python")
where %PY% >nul 2>nul || (echo Python is not installed on this PC - install it from the Software Center or python.org. & pause & exit /b 1)
%PY% server.py --diagnose > "%~dp0diagnose.txt" 2>&1
type "%~dp0diagnose.txt"
echo.
echo Saved to %~dp0diagnose.txt
pause
endlocal
