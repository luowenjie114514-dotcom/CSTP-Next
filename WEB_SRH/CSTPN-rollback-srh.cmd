@echo off
rem CSTPN: 回滚会话列表搜索
rem 用法：CSTPN-rollback-srh.cmd            使用默认参数运行
rem       CSTPN-rollback-srh.cmd -DryRun    只预演，不写文件
rem       CSTPN-rollback-srh.cmd -Target D:\kits\cst-pilot
setlocal
chcp 65001 >nul
where pwsh >nul 2>nul
if errorlevel 1 goto legacy
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-srh.ps1" %*
goto finish
:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-srh.ps1" %*
:finish
set CODE=%errorlevel%
if not "%~1"=="" exit /b %CODE%
echo.
pause
exit /b %CODE%
