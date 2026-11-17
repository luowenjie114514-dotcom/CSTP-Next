@echo off
rem CSTPN: Install session import patch
rem Usage: CSTPN-apply-idimp.cmd            run with defaults
rem        CSTPN-apply-idimp.cmd -DryRun    dry run, no file writes
rem        CSTPN-apply-idimp.cmd -Target D:\kits\cst-pilot
rem Note: same script as WEB_ID, installs both
setlocal
chcp 65001 >nul
where pwsh >nul 2>nul
if errorlevel 1 goto legacy
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-apply-idimp.ps1" %*
goto finish
:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-apply-idimp.ps1" %*
:finish
set CODE=%errorlevel%
if not "%~1"=="" exit /b %CODE%
echo.
pause
exit /b %CODE%
