@echo off
title SODSAN PDKS ve Maas Hesaplama Otomasyonu
cd /d "%~dp0"
echo SODSAN PDKS Baslatiliyor...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
