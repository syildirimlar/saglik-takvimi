@echo off
chcp 65001 >nul
title Pi's Pie - Yedek Parca Arastirma + B2B Kaynak Analiz Sistemi (Port 8890)
echo ================================================================
echo   Pi's Pie - YEDEK PARCA ARASTIRMA + B2B KAYNAK ANALIZ SISTEMI
echo   Port: http://localhost:8890
echo   Mod: ARASTIR - ESLESTIR - KARSILASTIR - RAPORLA - EXCEL
echo   WooCommerce Yazma: DEVRE DISI (Salt-Okunur)
echo ================================================================
echo.
echo Canli Scraper Sunucusu (Port 8890) baslatiliyor...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [HATA] Sunucu calisirken bir hata olustu. Hata Kodu: %ERRORLEVEL%
)
pause
