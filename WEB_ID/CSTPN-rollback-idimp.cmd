@echo off
rem CSTPN: 回滚会话 ID + 导入补丁
rem 用法：CSTPN-rollback-idimp.cmd            使用默认参数运行
rem       CSTPN-rollback-idimp.cmd -DryRun    只预演，不写文件
rem       CSTPN-rollback-idimp.cmd -Target D:\kits\cst-pilot
setlocal
chcp 65001 >nul
echo. & echo   移除 WEB_ID 与 WEB_INP & echo.
where pwsh >nul 2>nul
if errorlevel 1 goto legacy
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-idimp.ps1" %*
goto finish
:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-idimp.ps1" %*
:finish
set CODE=%errorlevel%
if not "%~1"=="" exit /b %CODE%
echo.
pause
exit /b %CODE%
