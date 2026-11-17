@echo off
rem CSTPN: Install session list search
rem Usage: CSTPN-apply-srh.cmd            run with defaults
rem        CSTPN-apply-srh.cmd -DryRun    dry run, no file writes
rem        CSTPN-apply-srh.cmd -Target D:\kits\cst-pilot
setlocal
chcp 65001 >nul
where pwsh >nul 2>nul
if errorlevel 1 goto legacy
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-apply-srh.ps1" %*
goto finish
:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-apply-srh.ps1" %*
:finish
set CODE=%errorlevel%
if not "%~1"=="" exit /b %CODE%
echo.
pause
exit /b %CODE%
