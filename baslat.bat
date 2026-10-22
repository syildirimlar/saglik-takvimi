@echo off
chcp 65001 > nul
echo ========================================================
echo SODSAN Fabrika İçi Portal Başlatılıyor...
echo ========================================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
