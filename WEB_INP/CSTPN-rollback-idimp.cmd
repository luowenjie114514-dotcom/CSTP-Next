@echo off
rem CSTPN: Rollback session import patch
rem Usage: CSTPN-rollback-idimp.cmd            run with defaults
rem        CSTPN-rollback-idimp.cmd -DryRun    dry run, no file writes
rem        CSTPN-rollback-idimp.cmd -Target D:\kits\cst-pilot
rem Note: same script as WEB_ID
setlocal
chcp 65001 >nul
where pwsh >nul 2>nul
if errorlevel 1 goto legacy
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-idimp.ps1" %*
goto finish
:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-idimp.ps1" %*
:finish
set CODE=%errorlevel%
if not "%~1"=="" exit /b %CODE%
echo.
pause
exit /b %CODE%
