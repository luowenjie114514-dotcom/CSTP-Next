@echo off
rem CSTPN: Install dynamic-code login entry
rem Usage: CSTPN-apply-otp.cmd            run with defaults
rem        CSTPN-apply-otp.cmd -DryRun    dry run, no file writes
rem        CSTPN-apply-otp.cmd -Target D:\kits\cst-pilot
setlocal
chcp 65001 >nul
where pwsh >nul 2>nul
if errorlevel 1 goto legacy
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-apply-otp.ps1" %*
goto finish
:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-apply-otp.ps1" %*
:finish
set CODE=%errorlevel%
if not "%~1"=="" exit /b %CODE%
echo.
pause
exit /b %CODE%
