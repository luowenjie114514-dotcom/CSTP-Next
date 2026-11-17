@echo off
rem CSTPN: Rollback dynamic-code login entry
rem Usage: CSTPN-rollback-otp.cmd            run with defaults
rem        CSTPN-rollback-otp.cmd -DryRun    dry run, no file writes
rem        CSTPN-rollback-otp.cmd -Target D:\kits\cst-pilot
setlocal
chcp 65001 >nul
where pwsh >nul 2>nul
if errorlevel 1 goto legacy
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-otp.ps1" %*
goto finish
:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-otp.ps1" %*
:finish
set CODE=%errorlevel%
if not "%~1"=="" exit /b %CODE%
echo.
pause
exit /b %CODE%
