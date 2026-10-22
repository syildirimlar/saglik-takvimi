@echo off
chcp 65001 > nul
echo ========================================================
echo SODSAN Fabrika Portalı - Bağımsız GitHub Yükleme Aracı
echo ========================================================
echo.
set GIT_PATH="C:\Users\sodsa\AppData\Local\Programs\Git\cmd\git.exe"

echo 1. Portal kodları bağımsız sürüm dalına (portal-release) ayrıştırılıyor...
%GIT_PATH% subtree split --prefix=sodsan-fabrika-portal -b portal-release 2>nul

echo.
echo 2. https://github.com/syildirimlar/sodsan-portal adresine yükleniyor...
%GIT_PATH% push git@github.com:syildirimlar/sodsan-portal.git portal-release:main --force

echo.
if %ERRORLEVEL% equ 0 (
    echo [BAŞARILI] SODSAN Portalı bağımsız olarak yüklendi!
    echo.
    echo Canlı Yayın Adresiniz:
    echo 👉 https://syildirimlar.github.io/sodsan-portal/
    echo.
) else (
    echo [BİLGİ] Eğer henüz oluşturmadıysanız:
    echo 1. https://github.com/new adresine gidin.
    echo 2. Repository name kısmına "sodsan-portal" yazın.
    echo 3. Yeşil "Create repository" butonuna basın.
    echo 4. Ardından bu dosyayı tekrar çalıştırın.
)

echo.
pause
