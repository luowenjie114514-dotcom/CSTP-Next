@echo off
rem CSTPN: 补丁管理器
rem 启动时自动从 GitHub 同步清单；找不到 cst-pilot 会弹目录选择框。
rem 用法：CSTPN-manager.cmd              交互式
rem       CSTPN-manager.cmd -NoSync      跳过远程同步
rem       CSTPN-manager.cmd -Target D:\kits\cst-pilot
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
