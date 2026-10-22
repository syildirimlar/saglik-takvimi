@echo off
chcp 65001 >nul
title Zirve Veritabani Teshis ve Tablo Inceleme Araci
echo ============================================================================
echo   ZIRVE VERITABANI TESHIS VE TABLO INCELEME ARACI
echo ============================================================================
echo.
echo Zirve SQL sunucusuna baglaniliyor ve veritabani semasi inceleniyor...
echo Lutfen bekleyiniz...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0zirve_tani.ps1"

echo.
pause
