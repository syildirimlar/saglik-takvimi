@echo off
chcp 65001 > nul
echo ========================================================
echo SODSAN Cari & Tahsilat Portalı - Bağımsız GitHub Yükleme Aracı
echo ========================================================
echo.
set GIT_PATH="C:\Users\sodsa\AppData\Local\Programs\Git\cmd\git.exe"

echo 1. Kodlar bağımsız sürüm dalına (cari-tahsilat-release) ayrıştırılıyor...
%GIT_PATH% add zirve-cari-tahsilat
%GIT_PATH% commit -m "chore: SODSAN Cari & Tahsilat bagimsiz surum" 2>nul
%GIT_PATH% subtree split --prefix=zirve-cari-tahsilat -b cari-tahsilat-release 2>nul

echo.
echo 2. https://github.com/syildirimlar/sodsan-cari-tahsilat adresine yükleniyor...
%GIT_PATH% push git@github.com:syildirimlar/sodsan-cari-tahsilat.git cari-tahsilat-release:main --force

echo.
if %ERRORLEVEL% equ 0 (
    echo [BAŞARILI] SODSAN Cari & Tahsilat Portalı diğer projelerden tamamen bağımsız olarak yüklendi!
    echo.
    echo Canlı İnternet Yayın Adresiniz:
    echo 👉 https://syildirimlar.github.io/sodsan-cari-tahsilat/
    echo.
    echo (GitHub Settings -> Pages kısmında Source: Deploy from branch, Branch: main olarak seçiniz)
) else (
    echo [BİLGİ] Eğer GitHub hesabınızda bu depo henüz açılmadıysa:
    echo 1. https://github.com/new adresine gidin.
    echo 2. Repository name kısmına "sodsan-cari-tahsilat" yazın (Public seçin).
    echo 3. Yeşil "Create repository" butonuna basın.
    echo 4. Ardından bu .bat dosyasını tekrar çalıştırın.
)

echo.
pause
