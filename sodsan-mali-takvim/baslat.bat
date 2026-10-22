@echo off
title SODSAN Mali Isler ve Muhasebe Takip Programi
cd /d "%~dp0"
echo ==========================================================
echo  SODSAN MALI ISLER VE MUHASEBE TAKIP PROGRAMI
echo  Baslatiliyor...
echo ==========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Sunucu baslatilamadi, uygulama varsayilan tarayicida aciliyor...
    start "" "%~dp0index.html"
)
pause
