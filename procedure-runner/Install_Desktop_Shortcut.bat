@echo off
rem Puts a "Procedure Runner" shortcut (with the app icon) on your desktop. Share this with the team.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\Install-Shortcut.ps1"
pause
