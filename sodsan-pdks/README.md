# 🏢 SODSAN Personel, PDKS ve Maaş Hesaplama Otomasyonu

Bu uygulama, SODSAN için MAGIC FACE MF 835 terminali, Perkotek PDKS veritabanı yedeği (`.DAT`), PDKS aylık PDF raporları ve muhasebe hak ediş tablosunu (`.ODS` / `.XLSX`) tek bir güvenli, yerel ve modern web arayüzünde birleştiren otomasyondur.

---

## 🚀 Hızlı Başlatma

1. Klasördeki **`baslat.bat`** dosyasına çift tıklayın.
2. Otomatik olarak yerel sunucu başlar ve varsayılan tarayıcınızda (Chrome, Edge vb.) şu adresi açar:
   **`http://localhost:8085/`**
3. Dilerseniz alternatif olarak doğrudan **`index.html`** dosyasına çift tıklayarak da açabilirsiniz.

---

## ✨ Temel Modüller ve Özellikler

### 1. 📊 Genel Bakış (Dashboard)
- Aktif personel sayısı (66 kayıtlı personel)
- Toplam fazla mesai saatleri ve hakediş tutarları
- Bankaya yatacak net tutarlar ve avans toplamları
- Eksik basım, çakışan hareket ve gecikme uyarıları

### 2. 📥 Çoklu Kaynak Veri Aktarımı
- **Perkotek MySQL (.DAT):** 66 personel kartını ve 25.496 ham giriş-çıkış logunu güvenle içe aktarır. Biyometrik ve şifre verilerini filtreler.
- **PDKS Aylık (.PDF) Raporu:** 56 sayfalık kişi bazında devam kontrol raporunu okur; vardiya, resmi tatil ve fazla mesaileri sisteme aktarır.
- **Muhasebe Tablosu (.ODS / .XLSX):** Orijinal 21 sütunlu muhasebe şablonunu ve önceki dönem parametrelerini yükler.
- **Tek Tıkla Otomatik Yükleme:** `kaynak_dosyalar/` klasöründeki dosyaları tek tuşla sisteme alır.

### 3. 👥 Personel Yönetimi
- Personel kartları, kart numaraları (00001 - 00061+), işe giriş tarihleri, kayıtlı maaşlar, servis ve ulaşım türleri.
- Anlık arama ve filtreleme.

### 4. 📅 Günlük ve Aylık Puantaj Motoru
- Gündüz vardiyası (`07:30 - 17:30 H.İÇİ`)
- Gece vardiyası (`17:15 - 07:30 H.İÇİ` - gece yarısını geçen vardiya devirleri)
- Cumartesi mesaisi (`07:30 - 17:30 CMRTS.` - 8 saat fazla mesai)
- İzin türleri: Hafta Tatili, Yıllık İzin, Raporlu, Ücretsiz İzin, Devamsızlık
- PDF raporundaki sonuçlarla mutabakat ve fark analizi

### 5. 💰 Maaş ve Muhasebe Bordrosu (21 Sütunlu Orijinal Şema)
- Standart **225 saat** aylık çalışma normu
- Fazla mesai ücreti formülü: `(Maaş / 225) * 1.5 * Mesai Saati`
- Resmi bayram mesai ücreti formülü: `(Maaş / 225) * 2.0 * Bayram Mesai Saati`
- Banka yatan formülü: `Maaş - Avans + Mesai + Bayram - BES/İcra - Kesinti`
- Ulaşım ücreti: `Bilet Adedi * Birim Fiyat` (Minibüs: 40, Otobüs: 52, Mudanya Otobüs: 53, Mudanya Minibüs: 65 TL)
- Toplam hak ediş / elden ödeme mutabakatı
- Canlı düzenlenebilir hücreler (Avans, BES/İcra, Prim vb.) ve anlık yeniden hesaplama

### 6. 📤 Muhasebeye Dışa Aktarma
- Tek tıkla **LibreOffice ODS** (`.ods`) veya **Excel** (`.xlsx`) formatında dışa aktarma.
- Hücre formülleri korunarak muhasebeciye gönderilmeye hazır çıktı üretilir.

### 7. 📜 Denetim İzi (Audit Log) & Ayarlar
- Yapılan her düzeltme, kullanıcı, tarih ve eski/yeni değerleriyle yerel veritabanında saklanır.
- Katsayılar ve ulaşım fiyatları ayarlar menüsünden değiştirilebilir.
