@echo off
rem Core Work Hub: starts the small Python helper (no console window) and opens the hub in Edge.
rem Needs Python 3.8 or later. Nothing is installed; the helper stops itself after 30 idle minutes.
setlocal
set "HUB=%~dp0."
where pythonw >nul 2>nul && (start "" pythonw "%HUB%\app\hub_server.py" --folder "%HUB%" & exit /b 0)
where pyw >nul 2>nul && (start "" pyw -3 "%HUB%\app\hub_server.py" --folder "%HUB%" & exit /b 0)
where python >nul 2>nul && (start "" /min python "%HUB%\app\hub_server.py" --folder "%HUB%" & exit /b 0)
echo Python 3 was not found on this PC. Ask IT to install Python 3.8 or later, then try again.
pause
