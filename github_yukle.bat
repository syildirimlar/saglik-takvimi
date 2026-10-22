@echo off
chcp 65001 > nul
echo ========================================================
echo SODSAN Fabrika Portalı - GitHub'a Yükleme Aracı
echo ========================================================
echo.
cd ..
git add sodsan-fabrika-portal/
git commit -m "SODSAN Fabrika İçi Portal ilk tam sürüm yüklendi"
git push origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo [BASARILI] Kodlar GitHub hesabınıza başarıyla yüklendi!
) else (
    echo [BILGI] Değişiklik yok veya yükleme sırasında bir uyarı oluştu.
)

echo.
pause
