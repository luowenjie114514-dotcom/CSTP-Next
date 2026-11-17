@echo off
rem CSTPN: Rollback session list search
rem Usage: CSTPN-rollback-srh.cmd            run with defaults
rem        CSTPN-rollback-srh.cmd -DryRun    dry run, no file writes
rem        CSTPN-rollback-srh.cmd -Target D:\kits\cst-pilot
setlocal
chcp 65001 >nul
where pwsh >nul 2>nul
if errorlevel 1 goto legacy
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-srh.ps1" %*
goto finish
:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-srh.ps1" %*
:finish
set CODE=%errorlevel%
if not "%~1"=="" exit /b %CODE%
echo.
pause
exit /b %CODE%
