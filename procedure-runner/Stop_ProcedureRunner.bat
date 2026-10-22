@echo off
rem Stops the background Procedure Runner server started by the desktop launcher.
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0tools\Launch-ProcedureRunner.ps1" -Stop
