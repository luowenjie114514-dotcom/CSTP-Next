@echo off
rem CSTPN: 回滚导出补丁
rem 用法：CSTPN-rollback-export.cmd            使用默认参数运行
rem       CSTPN-rollback-export.cmd -DryRun    只预演，不写文件
rem       CSTPN-rollback-export.cmd -Target D:\kits\cst-pilot
setlocal
chcp 65001 >nul
echo. & echo   移除导出增强 & echo.
where pwsh >nul 2>nul
if errorlevel 1 goto legacy
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-export.ps1" %*
goto finish
:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CSTPN-rollback-export.ps1" %*
:finish
set CODE=%errorlevel%
if not "%~1"=="" exit /b %CODE%
echo.
pause
exit /b %CODE%
