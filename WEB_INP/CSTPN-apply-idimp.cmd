@echo off
rem CSTPN: 安装会话导入补丁
rem 用法：CSTPN-apply-idimp.cmd            使用默认参数运行
rem       CSTPN-apply-idimp.cmd -DryRun    只预演，不写文件
rem       CSTPN-apply-idimp.cmd -Target D:\kits\cst-pilot
setlocal
chcp 65001 >nul
echo. & echo   （与 WEB_ID 相同脚本，装两者） & echo.
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
