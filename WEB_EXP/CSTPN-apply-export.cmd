@echo off
rem CSTPN: Install export patch
rem Usage: CSTPN-apply-export.cmd            run with defaults
rem        CSTPN-apply-export.cmd -DryRun    dry run, no file writes
rem        CSTPN-apply-export.cmd -Target D:\kits\cst-pilot
rem Note: session export (PNG/HTML/JSON)
setlocal
chcp 65001 >nul
where pwsh >nul 2>nul
if errorlevel 1 goto legacy
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-apply-export.ps1" %*
goto finish
:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-apply-export.ps1" %*
:finish
set CODE=%errorlevel%
if not "%~1"=="" exit /b %CODE%
echo.
pause
exit /b %CODE%
