# 🏭 SODSAN Fabrika İçi Operasyon & Haberleşme Portalı

Fabrika içi operasyonel iletişimi hızlandıran, malzeme hareketlerini kaydeden, forklift çağrılarını yöneten, usta-İK izin onay süreçlerini dijitalleştiren ve makine bakım takvimini tek merkezden yöneten **Hafif Fabrika İntraneti / MES Portalı**.

---

## 🚀 Hızlı Başlatma (Bilgisayarınızda)

1. `sodsan-fabrika-portal` klasörü içindeki **`baslat.bat`** dosyasına çift tıklayın.
2. Otomatik olarak yerel sunucu başlar ve varsayılan tarayıcınızda (`http://localhost:8089/`) açılır.
3. Herhangi bir program (Node.js, Python vb.) kurmanıza **gerek yoktur**, tamamen bağımsız çalışır.

---

## 📱 Cep Telefonu veya Tabletten Kullanma (PWA)

*   **Tarayıcıdan Açma:** Telefonunuzdan veya tabletinizden fabrikanın yerel ağındaki IP adresini veya GitHub Pages linkini açın.
*   **Ana Ekrana Ekle (Uygulama Gibi):**
    *   **Android (Chrome):** Sağ üstteki 3 noktaya basıp **"Ana Ekrana Ekle"** veya **"Uygulamayı Yükle"** deyin.
    *   **iPhone (Safari):** Alttaki Paylaş butonuna basıp **"Ana Ekrana Ekle"** seçeneğini seçin.
*   Böylece telefonunuzda tıpkı App Store / Play Store'dan yüklenmiş gerçek bir mobil uygulama gibi logosuyla yer alır.

---

## 🔑 Hazır Test Kullanıcıları & Roller

Sağ üstteki **👤 Kullanıcı Değiştir** butonuna tıklayarak istediğiniz role tek tıkla geçiş yapabilirsiniz:

| Kullanıcı Adı | İsim | Rolü | Departmanı | Yetki Alanı |
| :--- | :--- | :--- | :--- | :--- |
| `admin` | Sistem Yöneticisi | **ADMIN** | Fabrika Yönetimi | Tüm paneller, kullanıcı ve departman açma/silme, yedekleme. |
| `ik_elif` | Elif Hanım | **IK** | İdari Kısım | İzin onaylama, revize isteme, iş gücü grafiği ve personel bakiye takibi. |
| `usta_ahmet` | Ahmet Usta | **USTA** | Kesim & Sünger | Personeli adına izin talep etme, ürün girişi, sarf malzeme isteme, forklift çağırma. |
| `usta_mehmet`| Mehmet Usta | **USTA** | Montaj & Hatlar | Personeli adına izin talep etme, malzeme hareketi ve sarf malzeme isteme. |
| `forklift_ali`| Ali K. | **FORKLIFT**| Sevkiyat | Forklift çağrılarını görme, "Yoldayım" ve "Tamamlandı" işaretleme. |
| `bakim_kemal`| Kemal Usta | **BAKIM** | Bakım & Onarım | Makine bakım planlarını takvime girme, arıza takiplerini yönetme. |
| `depo_hasan` | Hasan Bey | **USTA** | Hammadde Depo | Gelen hammadde/kimyasal ve sevkiyat kayıtlarını girme. |

*(Tüm varsayılan kullanıcıların giriş şifresi: `1234`)*

---

## ✨ Ana Modüller

### 1. 📅 En Üst Panel: İnteraktif Aylık Takvim & Bakım Planı
*   Tüm ayı gösterir; önceki ve sonraki aylara geçilebilir.
*   **Makine Bakımları:** CNC kesim, pres, hat bakımları kırmızı rozetle görünür.
*   **Sevkiyat Randevuları:** Tır ve konteyner yükleme günleri mavi rozetle işaretlenir.
*   **İzinli Personel:** İK tarafından onaylanan izinler otomatik olarak ilgili günlerde sarı rozetle listelenir.
*   Güne tıklandığında sağ panelde o günün saat saat detayları açılır.

### 2. 📦 Gelen & Giden Ürünler (Canlı Akış)
*   Departman seçimiyle gelen malzeme, sevk edilen ürün veya departman içi transfer kaydedilir.
*   **Seçmeli Birim Menüsü:** `Adet`, `Tonaj (Ton / Kg)`, `Metre`, `Koli / Paket`, `Palet`, `Rulo`.
*   Tedarikçi firma, sevk irsaliye numarası ve departman notları filtrelenebilir.

### 3. 🛒 Sarf Malzeme İhtiyaç Panosu
*   Usta ve sorumluların acil ihtiyaçlarını (koli bandı, cırt kelepçe, poşet, eldiven vb.) yazdığı ortak pano.
*   **Durum Takibi:** *Talep Edildi* $\rightarrow$ *Sipariş Verildi* $\rightarrow$ *Teslim Edildi*.

### 4. 🏖️ İK & İzin Yönetimi
*   **Usta Girişi:** Ustalar altındaki çalışan adına tarih aralığı seçerek talep açar. Gün sayısı otomatik hesaplanır.
*   **İK Karar Mekanizması:** İK paneline düşen talep tek tıkla **Onayla**, **Revize İste** veya **Reddet** yapılabilir (İK notu ekleme imkanıyla).
*   **İzin Bakiye Çizelgesi:** Çalışanın hak ettiği, kullandığı ve kalan izin günleri anlık düşülür.
*   **Kapasite Göstergesi:** Fabrikadaki anlık aktif çalışan ve izinli personel yüzdesini dairesel grafik ile gösterir.

### 5. 🚜 Forklift Çağrı Paneli & Telegram Entegrasyonu
*   Hatta malzeme bittiğinde veya palet çekilmesi gerektiğinde aciliyet seviyesi (*Normal*, *Acil*, *🚨 Hat Durdu / Kritik*) seçilerek çağrı yapılır.
*   Tarayıcıda otomatik sesli alarm çalar.
*   **Telegram Entegrasyonu:** Bot token ve grup/chat ID tanımlandığında doğrudan forklift operatörlerinin Telegram grubuna mesaj düşer.

### 6. ⚙️ Admin & Yönetim Paneli
*   Yeni departman tanımlama, ikon ve isim belirleme.
*   Yeni kullanıcı açma, şifre değiştirme, departman ve rol atama.
*   **Yedekleme:** Tek tıkla tüm fabrika verilerini `JSON` formatında bilgisayara indirme ve geri yükleme.
