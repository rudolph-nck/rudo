@echo off
rem Puts a "Core Work Hub" icon on your desktop. Run it once, from the shared hub folder.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0app\Install-DesktopIcon.ps1" -HubFolder "%~dp0."
pause
