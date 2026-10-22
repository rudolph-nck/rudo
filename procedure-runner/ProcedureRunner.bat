@echo off
rem Desktop launcher: starts Procedure Runner quietly in the background (if it isn't already running)
rem and opens it in its own app window. Settings: ProcedureRunner.cfg (see README). Stop it with Stop_ProcedureRunner.bat.
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0tools\Launch-ProcedureRunner.ps1" %*
