@echo off
rem CSTPN: 安装动态码登录入口
rem 用法：CSTPN-apply-otp.cmd            使用默认参数运行
rem       CSTPN-apply-otp.cmd -DryRun    只预演，不写文件
rem       CSTPN-apply-otp.cmd -Target D:\kits\cst-pilot
setlocal
chcp 65001 >nul
echo. & echo   CSTOA 扫码卡片下方新增动态码入口 & echo.
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
