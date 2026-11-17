@echo off
rem CSTPN: 一键撤回对 cst-pilot 的全部修改。
rem 用法：CSTPN-rollback-oa-login-text.cmd            撤回同目录 cst-pilot 的修改
rem       CSTPN-rollback-oa-login-text.cmd -DryRun    只预演，不写文件
rem       CSTPN-rollback-oa-login-text.cmd -Target D:\kits\cst-pilot
setlocal
chcp 65001 >nul
if not "%~1"=="" goto run
echo.
echo   即将撤回 CSTP Next 对 cst-pilot 的修改：
echo     - 账户页文案「OA登录」恢复为「重新扫码登录」/「扫码登录」
echo     - 删除入口脚本 CSTPN-cstoa-open-auth.js
echo     - 移除 index.html 里的对应引用
echo   只想预演请先运行：CSTPN-rollback-oa-login-text.cmd -DryRun
echo.
pause
:run
where pwsh >nul 2>nul
if errorlevel 1 goto legacy
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-oa-login-text.ps1" %*
goto finish
:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-oa-login-text.ps1" %*
:finish
set CODE=%errorlevel%
echo.
pause
exit /b %CODE%
