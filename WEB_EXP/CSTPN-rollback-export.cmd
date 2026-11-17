@echo off
rem CSTPN: Rollback export patch
rem Usage: CSTPN-rollback-export.cmd            run with defaults
rem        CSTPN-rollback-export.cmd -DryRun    dry run, no file writes
rem        CSTPN-rollback-export.cmd -Target D:\kits\cst-pilot
setlocal
chcp 65001 >nul
where pwsh >nul 2>nul
if errorlevel 1 goto legacy
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-export.ps1" %*
goto finish
:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-export.ps1" %*
:finish
set CODE=%errorlevel%
if not "%~1"=="" exit /b %CODE%
echo.
pause
exit /b %CODE%
