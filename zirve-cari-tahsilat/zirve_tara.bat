@echo off
chcp 65001 > nul
title Zirve Otomatik Veritabani ve Dokum Tarayici
echo ============================================================================
echo   ZIRVE SQL VERITABANI VE TABLO DOKUM TARAYICI BASLATILIYOR...
echo ============================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0zirve_tara.ps1"
