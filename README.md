# 📅 Sağlık & Yaşam Takvim Programı

Kişisel semptom, alışkanlık ve günlük olaylarınızı (özellikle **WC kullanımı**, **baş ağrısı** ve **aklınıza gelen her türlü özel durumu**) kaydedip geriye dönük detaylı grafiklerle raporlayabileceğiniz modern, yerel ve gizlilik odaklı bir takip sistemidir.

---

## 🚀 Hızlı Başlatma

1. Klasördeki **`baslat.bat`** dosyasına çift tıklayın veya **`index.html`** dosyasını herhangi bir web tarayıcısında (Chrome, Edge, Firefox, Brave vb.) açın.
2. Program hiçbir kurulum, Node.js veya internet bağlantısı gerektirmez; **%100 çevrimdışı** olarak kendi bilgisayarınızda çalışır.

---

## ✨ Temel Özellikler

### 1. 📆 İnteraktif Takvim Görünümü
- **Aylık Takvim:** Ay ve yıl bazında tüm günleri gösterir. Günlerin üzerinde gerçekleşen olaylar renkli rozetler ve sayaçlarla yer alır (Örn: `[🚽 3]`, `[🤕 1]`).
- **Seçilen Günün Detayları & Akışı (Timeline):** Takvimde herhangi bir güne tıkladığınızda, o günün saat saat tüm kayıtları sağ panelde listelenir.
- **Hızlı Gün Kaydı:** Takvimdeki herhangi bir günün köşesindeki `➕` butonuna basarak doğrudan o güne kayıt yapabilirsiniz.

### 2. 🚽 Tuvalet (WC) Takibi
- **Tuvalet Tipi:** Küçük (İdrar), Büyük (Dışkı) veya İkisi Birlikte.
- **Durum / Kıvam:** Normal, Kabız / Sert, Yumuşak, Sıvı / İshal, Ağrılı / Zorlanma.
- **Hızlı Kayıt:** Üst çubuktaki mavi **"🚽 WC Kaydet"** butonuna basarak tek tıkla şimdiki zamanla ekleyebilirsiniz.

### 3. 🤕 Baş Ağrısı & Semptom Takibi
- **Ağrı Şiddeti (1 - 10 Renkli Skala):** 1 (Çok Hafif) ile 10 (Dayanılmaz / Şiddetli) arasında renkli slider ile anlık görsel puanlama.
- **Ağrı Bölgesi:** Şakaklar, Alın, Tek Taraflı (Migren), Ense ve Boyun, Göz Arkası, Tepe vb.
- **Olası Tetikleyiciler:** Uykusuzluk, Stres, Ekran Süresi, Susuzluk, Açlık, Lodos/Hava değişimi vb.
- **İlaç Bilgisi:** İlaç / ağrı kesici alındı mı? (Hangi ilacın alındığı ve dozu).

### 4. 🏃 Spor & Egzersiz Takibi
- **Hızlı Buton:** Üst çubuktaki yeşil **"🏃 Spor"** butonu ile anında kayıt.
- **Spor Türü:** Yürüyüş, Koşu, Fitness / Ağırlık, Yoga & Esneme, Yüzme, Bisiklet, Pilates vb.
- **Süre ve Efor:** Dakika cinsinden süre ve yoğunluk (Hafif Tempo, Orta Seviye, Yüksek/Terletici).
- **Raporlama:** Raporlar sekmesinde toplam egzersiz dakikası ve ortalaması analiz edilir.

### 5. 💆 Masaj & Kas Rahatlaması Takibi
- **Hızlı Buton:** Üst çubuktaki pembe **"💆 Masaj"** butonu ile anında kayıt.
- **Masaj Bölgesi:** Boyun & Omuz, Sırt & Bel, Baş & Şakak (Migren masajı), Tüm Vücut vb.
- **Rahatlama Seviyesi (1 - 10):** Masajın baş ağrısına ve kas gerginliğine ne kadar iyi geldiğini puanlayabilme.
- **Uygulama Yöntemi:** Kendim, Masaj Aleti/Tabancası, Masör/Profesyonel vb.

### 6. 🏷️ Aklınıza Gelen Başka Şeyleri Ekleme (Özel Kategoriler)
- "Kategoriler & Özel Alanlar" sekmesinden istediğiniz her türlü durumu tek tıkla ekleyebilirsiniz:
  - Örnekler: **Kahve**, **Su**, **İlaç**, **Alerji**, **Mide Yanması**, **Ruh Hali/Stres**, **Sigara**, **Uyku Süresi**...
  - **Özelleştirme:** İstediğiniz emojiyi/ikonu seçin, rengini belirleyin.
  - **Opsiyonel 1-10 Şiddet Skalası:** İlgili durumda şiddet derecesi takip edilsin mi?
  - **Opsiyonel Miktar / Birim:** İlgili durumda sayı girilsin mi? (Örn: fincan, bardak, adet, mg, km, dakika).

### 5. 📊 Kapsamlı Raporlama & İstatistikler
- **Dönem Filtreleri:** Son 7 Gün, Son 30 Gün, Bu Ay, Geçen Ay, Son 90 Gün, Tüm Zamanlar veya Özel Tarih Aralığı.
- **Özet Metrik Kartları:**
  - Toplam Olay Sayısı
  - Günde Ortalama WC Sıklığı
  - Baş Ağrısı Sayısı ve Ortalama Şiddet Derecesi
  - Olayların En Sık Yaşandığı Saat Dilimi (Örn: 14:00 - 15:00)
- **Akıllı Sağlık İçgörüleri:** Girilen verileri otomatik analiz ederek örüntüleri metin olarak özetler (Örn: "Baş ağrılarının %60'ında uykusuzluk tetikleyici kaydedilmiş", "Günde ortalama 3.2 kez tuvalet kullanımı var").
- **Grafikler (%100 Çevrimdışı İnteraktif SVG):**
  1. **📈 Günlük Trend Grafiği:** Gün gün vaka sayılarının dağılımı.
  2. **⏰ Saat Dağılım Analizi (00:00 - 23:00):** Olayların günün hangi saatlerinde yoğunlaştığını gösteren 24 saatlik çubuk analiz.
  3. **🍩 Kategori Halka Grafiği:** Hangi olayın ne oranda yaşandığının yüzdelik dağılımı.
  4. **⚡ Baş Ağrısı Şiddet Analizi:** Hafif, Orta, Şiddetli ve Çok Şiddetli ağrıların oranları.
- **Rapor Tablosu:** Kategorilerin toplam adetleri, günlük ortalamaları ve en sık görüldüğü saatler.
- **🖨️ Yazdır / PDF İndir:** Raporu doktorunuza göstermek veya arşivlemek için temiz, tek tuşla yazdırılabilir format.
- **📊 Excel / CSV İndir:** Türkçe Excel ile tam uyumlu (UTF-8 BOM) CSV dökümü.

### 6. 📋 Tüm Kayıtlar & Arama
- Tüm geçmiş kayıtlarınızı tarih, saat, kategori, notlar ve tetikleyicilere göre anlık olarak arayabilir, en yeniye veya en yüksek şiddete göre sıralayabilir, düzenleyebilir veya silebilirsiniz.

### 7. 💾 Yedekleme & Gizlilik
- **%100 Yerel Depolama (LocalStorage):** Verileriniz internete veya herhangi bir sunucuya gönderilmez, tamamen tarayıcınızda güvendedir.
- **JSON Yedekleme:** Tek tıkla tüm takvim kayıtlarınızı ve özel kategorilerinizi bilgisayarınıza indirebilirsiniz.
- **Yedekten Geri Yükleme:** İndirdiğiniz yedeği başka bir tarayıcıya veya bilgisayara aktarabilirsiniz.
- **✨ Örnek Veri Yükleme:** Sistemi ve grafikleri hemen test edebilmeniz için 30 günlük simülasyon verisi yükleme seçeneği.

---

## 🎨 Gece / Gündüz Modu (Dark Mode)
Sağ üst köşedeki **🌙 / ☀️** butonuna tıklayarak baş ağrısı ve göz yorgunluğu yaşamamak için Karanlık Moda geçebilirsiniz.
