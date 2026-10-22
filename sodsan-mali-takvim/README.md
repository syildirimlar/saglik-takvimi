# 🏢 SODSAN Mali İşler ve Muhasebe Takip Programı

SODSAN için özel olarak geliştirilmiş, muhasebe ve finans personelinin her sabah açtığında **“Bugün hangi işleri yapmalıyım, hangi ödemeler var, hangi işler gecikti ve yaklaşan önemli tarihler neler?”** sorularının cevabını tek ekranda sunan profesyonel **Mali İşler İş Takip Sistemidir**.

---

## 🚀 Hızlı Başlatma

1. Klasördeki **`baslat.bat`** dosyasına çift tıklayın (Önerilen).
   - Program yerel HTTP sunucusunu (`http://localhost:8086/`) başlatır ve tarayıcınızı otomatik açar.
2. Veya **`index.html`** dosyasına doğrudan çift tıklayarak herhangi bir tarayıcıda (Chrome, Edge, Firefox, Brave) anında çalıştırabilirsiniz.
3. **Sıfır Kurulum / %100 Çevrimdışı:** İnternet bağlantısı, harici kütüphane veya Node.js gerektirmez.

---

## 🧭 Temel Sistem Mimarisi & 20 Modül Özeti

### 1. Ana Ekran (Dashboard & Kokpit)
- En üstte **BUGÜN: [Gün, tarih]** (Örn: `Çarşamba – 21 Ekim 2026`) yer alır.
- Sistem gerçek tarihten otomatik beslenir; kullanıcı tarih seçici ile başka günleri de inceleyebilir.
- **9 Temel Görev Kartı:**
  1. **Bugün Yapılacaklar** (Planlı görevler ve 12 rutin durum ilerlemesi)
  2. **Bugün Ödenecekler** (Vadesi bugün dolan faturalar, toplam tutar ve anında ödeme)
  3. **Yarın Yapılacaklar** (Yarının iş ve ödeme hazırlığı)
  4. **Bu Hafta Yapılacaklar** (Haftalık ödeme toplamı ve rutinler)
  5. **Geciken İşler** (Kritik kırmızı alarm kartı, vadesi geçen borçlar ve işler)
  6. **Yaklaşan Ödemeler** (Gelecek 7 gün ve 30 günlük nakit çıkış projeksiyonu)
  7. **Yaklaşan Vergiler** (GİB / SGK en yakın vergi sayacı ve kalan gün)
  8. **Mali Müşavir Ziyareti** (8'i ve 21'i ziyaret sayacı, hazırlık listesi butonu)
  9. **Bekleyen Onaylar** (Perşembe ödeme listesi onay mekanizması)

### 2. Günlük Görev Sistemi
- Tarih, görev adı, kategori, açıklama, sorumlu kişi, öncelik, durum, son tarih, tamamlanma tarihi ve not alanları.
- Durumlar: `Bekliyor`, `Devam ediyor`, `Tamamlandı`, `Gecikti`, `İptal edildi`.
- Tek tıkla tamamlanabilir. Tamamlanan görevler kaybolmaz, sistem geçmişinde saklanır.

### 3. SODSAN'ın Sabit Rutinleri (2026 Boyunca Otomatik Tanımlı)
- **Her ayın 8'i:** Mali Müşavir Ziyareti (Muhasebe ve evrak kontrolü).
- **Her ayın 10'u:** Personel Maaş Ödemesi (60 kişi banka toplu transferi).
- **Her ayın 20'si:** Kredi Kartı Ödemesi + Banka bakiyesi, ekstre ve otomatik ödeme kontrolleri.
- **Her ayın 21'i:** Mali Müşavir Ziyareti (Vergi, SGK, bordro ve beyanname kontrolü).
- **Her ayın 25'i:** Personel Maaş Avansı Ödemesi.
- **Her Perşembe:** Cuma tedarikçi ödemeleri için ödeme listesi hazırlama ve onaya sunma.
- **Her Cuma:** Onaylanan tedarikçi faturalarının bankadan havale/EFT ile ödenmesi.

### 4. Günlük 12 Standart Muhasebe Rutini
1. Gelen faturaları kontrol et
2. Gelen faturaları muhasebe sistemine kaydet
3. Fatura bilgilerini kontrol et
4. Cari hesapları kontrol et
5. Banka hareketlerini kontrol et
6. Kasa hareketlerini kontrol et
7. Otomatik ödeme talimatlarını kontrol et
8. Banka bakiyelerini kontrol et
9. Bekleyen ödemeleri kontrol et
10. Geciken ödemeleri kontrol et
11. Mali müşavirden gelen talepleri kontrol et
12. Eksik evrakları kontrol et
*(Dashboard'dan tek tıkla modal olarak açılır ve "Tümünü Tamamla" veya tek tek işaretleme yapılabilir).*

### 5. Fatura Takibi
- Fatura tarihi, firma, VKN, fatura no, açıklama, matrah, KDV (% ve tutar), genel toplam, vade tarihi, kayıt tarihi, ödeme tarihi, ödeme durumu, muhasebe kayıt durumu ve notlar.
- Vadesi yaklaşanlar ana ekranda, gecikenler alarm listesinde gösterilir.
- Faturadan doğrudan "Ödeme Yap" bağlantısı.

### 6. Ödeme Takibi & Perşembe Listesi
- Türler: Tedarikçi, Kredi kartı, Vergi, SGK, Maaş, Avans, Elektrik, Su, Doğalgaz, İnternet, Telefon, Diğer.
- **Perşembe Tedarikçi Ödeme Listesi:** Cuma günü yapılacak ödemeler Perşembe günü listelenir, yönetici (Salih Bey) tek tıkla onaylar, Cuma günü toplu veya tekli ödenebilir.

### 7. Otomatik Fatura Kontrolü
- Fabrika elektrik (Enerjisa), su (İSKİ), internet vb. faturaları otomatik ödeme talimatındadır.
- Son ödeme günü sistem personeli uyarır: "Bugün otomatik ödeme kontrolü yapılmalı".

### 8. 2026 Vergi ve SGK Takvimi
- Gelir İdaresi Başkanlığı (GİB) ve SGK resmi mevzuatına uygun 2026 takvimi:
  - KDV-1 & KDV-2 (Her ayın 28'i)
  - Muhtasar ve Prim Hizmet Beyannamesi (MPHB - Her ayın 26'sı)
  - Kurumlar Geçici Vergi (17 Şubat, 18 Mayıs, 17 Ağustos, 17 Kasım)
  - Kurumlar Vergisi Yıllık Beyannamesi (30 Nisan)
  - SGK Prim Ödemeleri (Ay sonu)
  - Damga Vergisi ve Yıllık Defter Tasdikleri
- "Beyanname Verildi mi?", "Ödeme Yapıldı mı?", "Mali Müşavir Kontrolü" onay kutuları.

### 9. Mali Müşavir Modülü (Ayın 8'i ve 21'i)
- Her ziyaret öncesi hazırlanacak evrak kontrol listesi (Eksik faturalar, banka ekstreleri, cari mutabakatlar, bordro icmali).
- Ziyaret tutanağı: Görüşülen konular, eksik kalanlar, mali müşavirden beklenenler, SODSAN'ın yapacakları, bir sonraki ziyaret tarihi.

### 10. Personel ve Bordro (60 Personel)
- Personel sayısı: 60 (Ayarlardan değiştirilebilir).
- 10'u Maaş, 25'i Avans takibi.
- 8 Aşamalı Süreç İlerleme Çubuğu: Puantaj -> Bordro Hazırlığı -> İç Kontrol -> Müşavir Kontrolü -> Maaş Banka Talimatı -> Avans -> SGK Bildirimi -> SGK Ödeme.

### 11. 2026 Gerçek İnteraktif Takvim
- 12 Ay (Ocak - Aralık 2026 ve sonrası) takvim ızgarası.
- Renk kodlu rozetler: Kırmızı (Vergi), Mor (SGK), Yeşil (Maaş/Avans), Mavi (Tedarikçi), Turuncu (Kredi Kartı), Teal (Mali Müşavir), İndigo (Fatura).
- Güne tıklandığında sağ panelde o günün tüm olay akışı açılır.

### 12. 2026 Kalan Günler & Geçmişin Korunması
- 21 Ekim 2026'dan sonraki kalan aylar (Ekim, Kasım, Aralık) öne çıkarılır. Geçmiş hiçbir görev ve ödeme silinmez.

### 13. Eksik Bilgiler Modülü
- Excel'deki "Eksik Bilgiler" sekmesinin dinamik formu.
- Kredi/leasing taksitleri, elektrik/su/internet günleri, belediye harçları gibi veriler netleştikçe sisteme girilir.
- Yeni bir parametre girildiğinde program otomatik olarak bunu takvime ve görevlere ekler.
- *Sabit Kurallar:* Kira ödemesi yoktur (kendi mülkü) ve çek kullanılmamaktadır (peşin banka havalesi).

### 14. Finansal Raporlar & Projeksiyon
- Bu ay ödenen, kalan, geciken toplam tutarlar.
- Kategori bazlı harcama dağılımı (Maaş, Tedarikçi, SGK, Vergi).
- Gelecek 7 gün ve 30 günlük nakit çıkış projeksiyonu.
- Yazdırma ve PDF rapor desteği.

### 15. Genel Arama (Global Search)
- Üst arama çubuğundan firma adı, vergi no, fatura no, görev veya dekont yazıldığında tüm sistemde anında arama yapar.

### 16. Akıllı Bildirimler
- Vadesi geçen işler, yarınki ödemeler, yaklaşan vergi günleri ve mali müşavir ziyareti için anlık rozet ve sayaçlar.

### 17. Veri Güvenliği, Yetkilendirme & Arşiv
- Kullanıcı değiştirme: **Salih (Yönetici)**, **Muhasebe Uzmanı**, **Mali Müşavir**.
- **Denetim İzi (Audit Log):** Kim, ne zaman, hangi kaydı değiştirdi/ekledi loglanır.
- **Arşiv (Soft Delete):** Yanlışlıkla silinen kayıtlar yok olmaz, arşivden tek tıkla geri yüklenir.

### 18. Excel İçe / Dışa Aktarım
- **`SODSAN_2026_Mali_Isler_Takvimi_Guncel.xlsx`** dosyasını tek tıkla çok sekmeli tam Excel tablosu olarak indirebilirsiniz.
- Mevcut Excel dosyanızı doğrudan yükleyerek sisteme aktarabilirsiniz (SheetJS entegre).

---

## 🔒 Güvenlik & Yerel Depolama

Tüm veriler tarayıcınızın `localStorage` alanında güvenle saklanır. Harici sunucuya hiçbir finansal veri aktarılmaz. "Excel Dışa Aktar" butonu ile istediğiniz an tüm sistemin eksiksiz yedeğini alabilirsiniz.
