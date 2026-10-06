@echo off
chcp 65001 > nul
echo ========================================================
echo Sağlık & Yaşam Takvimi - GitHub'a Yükleme Aracı
echo ========================================================
echo.
set GIT_PATH="C:\Users\sodsa\AppData\Local\Programs\Git\cmd\git.exe"

echo GitHub'a bağlanılıyor ve kodlar gönderiliyor...
%GIT_PATH% branch -M main
%GIT_PATH% remote remove origin 2>nul
%GIT_PATH% remote add origin git@github.com:syildirimlar/saglik-takvimi.git
%GIT_PATH% push -u origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo [BASARILI] Kodlar GitHub hesabınıza (syildirimlar/saglik-takvimi) başarıyla yüklendi!
) else (
    echo [HATA] Yükleme başarısız oldu. Lütfen önce tarayıcıda açılan sayfada "Create repository" butonuna bastığınızdan emin olun.
)

echo.
pause
