@echo off
chcp 65001 > nul
title Zirve Cari Hesap, Fatura, Tahsilat ve Odeme Sistemi
echo ============================================================================
echo   ZIRVE CARI HESAP, FATURA, TAHSILAT VE ODEME YONETIM SISTEMI BASLATILIYOR
echo ============================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
