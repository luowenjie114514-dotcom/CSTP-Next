@echo off
rem CSTPN: Patch Manager
rem Usage: CSTPN-manager.cmd            run with defaults
rem        CSTPN-manager.cmd -DryRun    dry run, no file writes
rem        CSTPN-manager.cmd -Target D:\kits\cst-pilot
rem Note: reads catalog from GitHub; prompts for folder if cst-pilot not found
setlocal
chcp 65001 >nul
where pwsh >nul 2>nul
if errorlevel 1 goto legacy
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-manager.ps1" %*
goto finish
:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-manager.ps1" %*
:finish
set CODE=%errorlevel%
if not "%~1"=="" exit /b %CODE%
echo.
pause
exit /b %CODE%
