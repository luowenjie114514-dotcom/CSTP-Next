@echo off
rem CSTPN: 补丁管理器
rem 用法：CSTPN-manager.cmd            使用默认参数运行
rem       CSTPN-manager.cmd -DryRun    只预演，不写文件
rem       CSTPN-manager.cmd -Target D:\kits\cst-pilot
setlocal
chcp 65001 >nul
echo. & echo   交互式启用或回滚各补丁 & echo.
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
