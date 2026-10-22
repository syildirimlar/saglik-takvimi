# 🏢 Zirve Cari Hesap, Fatura, Tahsilat ve Ödeme Yönetim Sistemi

Bu sistem, **Zirve Finansman / Ticari / Müşavir** kurulu bilgisayarda hiçbir ek kurulum gerektirmeden çalışan; alacak ve borçları sadece tekil faturalara göre değil, **Cari Hesap Hareketleri (Devir, Alış/Satış Faturası, Banka Havale/EFT, Kasa Tahsilat/Tediye, Çek/Senet)** temelinde takip eden yerel finans otomasyonudur.

---

## 🚀 Zirve'nin Kurulu Olduğu Bilgisayarda Nasıl Çalıştırılır?

1. **`zirve-cari-tahsilat`** klasörünü USB bellek veya ağ üzerinden Zirve'nin kurulu olduğu bilgisayara kopyalayın.
2. Klasörün içindeki **`baslat.bat`** dosyasına çift tıklayın.
3. Otomatik olarak yerel sunucu (`http://localhost:8090/`) açılır.
4. Üst menüden **`🔌 Zirve SQL & e-Fatura Bağlantısı`** sekmesine tıklayın:
   - **`🔍 Bilgisayardaki Zirve SQL'i Otomatik Bul`** butonuna basın. Sistem `.\ZIRVESQL` veya `.\SQLEXPRESS` sunucusunu ve içindeki Firma/Dönem veritabanlarını otomatik listeler.
   - Firma veritabanınızı seçip **`⚡ Zirve'den Carileri ve Hareketleri Çek`** butonuna bastığınızda tüm **Cari Kartlar (`CARI`)** ve **Cari Hareketler (`CARIHAR`)** Salt-Okunur (Read-Only) olarak programa aktarılır.
   - Ayrıca `C:\zirve` altındaki **UBL-TR e-Fatura XML** dosyalarını tek tuşla tarayabilir veya sürükle-bırak ile yükleyebilirsiniz.

---

## ✨ Temel Özellikler

1. **Cari Hareket Temelli Bakiye (`Toplam Borç - Toplam Alacak`):**
   - Bir carinin gerçek borcu veya alacağı; devir bakiyesi, faturalar, gelen/giden banka havaleleri, nakit tahsilatlar ve çek/senet hareketlerinin tamamı üzerinden hesaplanır.
2. **FIFO (İlk Giren İlk Çıkar) Yaşlandırma ve Açık Fatura Mahsubu:**
   - Müşteriden gelen "Cari hesaba mahsuben" tahsilatlar veya çekler, carinin en eski borç hareketlerinden (Devir ve eski faturalardan) başlayarak otomatik mahsup edilir.
   - Böylece kalan net cari bakiyenin hangi tarihten/faturadan kaldığı ve kaç gün geciktiği (`1-30 Gün`, `31-60 Gün`, `60+ Gün`) otomatik hesaplanır.
3. **Detaylı Cari Hesap Ekstresi & WhatsApp Mutabakat:**
   - Herhangi bir cariye tıkladığınızda **Yürüyen Bakiyeli (B/A) Cari Hesap Ekstresi** açılır.
   - Tek tuşla **Yazdır / PDF** çıktısı alabilir veya **WhatsApp Mutabakat / Hatırlatma** mesajı gönderebilirsiniz.
4. **Ödeme Sözü ve Nakit Akışı Takvimi:**
   - Carilere özel ödeme/tahsilat sözü tarihi ve takip notu girebilir, haftalık/aylık ödeme takviminde tüm beklenen nakit giriş-çıkışlarını izleyebilirsiniz.
5. **Çek / Senet & Döviz (USD / EUR / TRY) Desteği:**
   - Alınan müşteri çek/senetleri ve verilen kendi çek/senetleriniz hem portföyde hem de ilgili cari hesap hareketlerinde takip edilir.
