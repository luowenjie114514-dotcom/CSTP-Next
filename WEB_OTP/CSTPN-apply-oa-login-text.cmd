@echo off
rem CSTPN: 把 CST Pilot Web 端的「扫码登录」文案改为「OA登录」，并新增动态码登录入口。
rem 用法：CSTPN-apply-oa-login-text.cmd            为同目录的 cst-pilot 打补丁
rem       CSTPN-apply-oa-login-text.cmd -DryRun    只预演，不写文件
rem       CSTPN-apply-oa-login-text.cmd -Target D:\kits\cst-pilot
setlocal
chcp 65001 >nul
if not "%~1"=="" goto run
echo.
echo   即将为同目录的 cst-pilot 打补丁：
echo     - 账户页按钮「重新扫码登录」「扫码登录」改为「OA登录」
echo     - 登录页 CSTOA 扫码卡片下方新增「使用动态码登录（CSTP Next）」
echo   原文件会先备份到 cst-pilot\patch-backup-oa-text-时间戳，可回滚。
echo   只想预演请先运行：CSTPN-apply-oa-login-text.cmd -DryRun
echo.
pause
:run
where pwsh >nul 2>nul
if errorlevel 1 goto legacy
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-apply-oa-login-text.ps1" %*
goto finish
:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-apply-oa-login-text.ps1" %*
:finish
set CODE=%errorlevel%
echo.
pause
exit /b %CODE%
