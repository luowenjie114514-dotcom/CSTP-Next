@echo off
rem CST Pilot: 为同目录的 cst-pilot 增加 CSTOA 动态验证码登录（Web）。
rem 用法：apply-cstoa-totp.cmd            直接为同目录的 cst-pilot 打补丁
rem       apply-cstoa-totp.cmd -DryRun    只预演，不写文件
rem       apply-cstoa-totp.cmd -Target D:\kits\cst-pilot
setlocal
chcp 65001 >nul
if not "%~1"=="" goto run
echo.
echo   即将为同目录的 cst-pilot 打补丁：新增 CSTOA 动态验证码登录。
echo   原文件会先备份到 cst-pilot\patch-backup-cstoa-totp-时间戳，可回滚。
echo   只想预演请先运行：apply-cstoa-totp.cmd -DryRun
echo.
pause
:run
where pwsh >nul 2>nul
if errorlevel 1 goto legacy
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-cstoa-totp.ps1" %*
goto finish
:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-cstoa-totp.ps1" %*
:finish
set CODE=%errorlevel%
echo.
pause
exit /b %CODE%
