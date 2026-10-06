@echo off
chcp 65001 > nul
echo Sağlık & Yaşam Takvim Programı Başlatılıyor...
start "" "%~dp0index.html"
exit
