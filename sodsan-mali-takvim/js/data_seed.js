/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Başlangıç Veri Seti (Seed Data) - 2026 Mali Takvimi ve SODSAN Sabit Rutinleri
 * Not: Örnek/hayali fatura veya uydurma ödemeler temizlenmiştir.
 */

const SODSAN_INITIAL_DATA = {
    settings: {
        companyName: "SODSAN OTO PLASTİK YEDEK PARÇA SAN. VE TİC. LTD. ŞTİ.",
        employeeCount: 60,
        gesPaymentCheckDay: 7, // Her ayın 7'si: GES faturalarının ödeme kontrolü
        advisorFirstVisitDay: 8, // Her ayın 8'i: Mali müşavir ziyareti
        salaryDay: 10, // Her ayın 10'u: Maaş ödemesi
        uedasInvoiceProcessDay: 15, // Her ayın 15'i: UEDAŞ elektrik faturalarının işlenmesi & avans alacak/borç kontrolü
        phoneInvoiceDay: 16, // Her ayın 16'sı: SODSAN telefon Ziraat otomatik ödeme kontrolü
        gesInvoiceDay: 16, // Her ayın 16'sı: GES faturalarının UEDAŞ'a kesilmesi
        vodafoneInvoiceDay: 19, // Her ayın 19'u: Vodafone Ziraat otomatik ödeme kontrolü
        creditCardPaymentDay: 20, // Her ayın 20'si: Kredi kartı ödemeleri
        advisorSecondVisitDay: 21, // Her ayın 21'i: Mali müşavir ziyareti
        waterInvoiceDayMerkez: 22, // Her ayın 22'si: SODSAN merkez su faturası Ziraat otomatik ödeme kontrolü
        waterInvoiceDaySube: 22, // Her ayın 22'si: SODSAN şube su faturası Ziraat otomatik ödeme kontrolü
        advanceDay: 25, // Her ayın 25'i: Maaş avansı
        electricityPaymentDay: 26, // Her ayın 26'sı: Elektrik faturası ödeme / borç-alacak mahsup günü
        supplierPaymentDayName: "Cuma", // Her Cuma: Tedarikçi fatura ödemesi
        supplierListDayName: "Perşembe", // Her Perşembe: Tedarikçi ödeme listesi hazırlama ve onaya sunma
        hasRent: false, // Şirket mülkü (Kira ödemesi yok)
        usesCheques: false // Çek kullanılmıyor
    },

    users: [
        { id: "usr_1", name: "Salih (Yönetici)", role: "Yonetici", email: "yonetim@sodsan.com", avatar: "👔" },
        { id: "usr_2", name: "Muhasebe Uzmanı", role: "Muhasebe", email: "muhasebe@sodsan.com", avatar: "💼" },
        { id: "usr_3", name: "Mali Müşavir", role: "MaliMusavir", email: "musavir@sodsan.com", avatar: "📊" }
    ],

    // 12 Günlük Tekrarlanan Standart Muhasebe Görevleri
    dailyRoutineTemplates: [
        { id: "DR_1", title: "Gelen faturaları kontrol et", category: "Fatura", priority: "Yüksek", description: "GİB portal, e-Fatura/e-Arşiv gelen kutusu ve posta evraklarını tara." },
        { id: "DR_2", title: "Gelen faturaları muhasebe sistemine kaydet", category: "Fatura", priority: "Yüksek", description: "Kontrol edilen e-faturaları ve kağıt faturaları Zirve/muhasebe programına işle." },
        { id: "DR_3", title: "Fatura bilgilerini kontrol et", category: "Fatura", priority: "Normal", description: "Vergi no, unvan, KDV oranı, tevkifat ve ürün kalemleri doğruluğunu teyit et." },
        { id: "DR_4", title: "Cari hesapları kontrol et", category: "Cari", priority: "Normal", description: "Tedarikçi ve müşteri cari hesap ekstrelerini ve bakiye uyumunu incele." },
        { id: "DR_5", title: "Banka hareketlerini kontrol et", category: "Banka", priority: "Yüksek", description: "Tüm banka hesaplarındaki (Garanti, İş, Yapı Kredi) gelen/giden havaleleri kontrol et." },
        { id: "DR_6", title: "Kasa hareketlerini kontrol et", category: "Kasa", priority: "Normal", description: "Nakit kasa giriş-çıkış makbuzlarını ve güncel kasa mevcudunu say/kontrol et." },
        { id: "DR_7", title: "Otomatik ödeme talimatlarını kontrol et", category: "Banka", priority: "Yüksek", description: "Bugün vadesi gelen otomatik fatura talimatı var mı kontrol et, hesap bakiyesi kontrolü yap." },
        { id: "DR_8", title: "Banka bakiyelerini kontrol et", category: "Banka", priority: "Yüksek", description: "Günlük nakit akışı ve bekleyen ödemeler için bankalardaki hazır değerleri doğrula." },
        { id: "DR_9", title: "Bekleyen ödemeleri kontrol et", category: "Ödeme", priority: "Yüksek", description: "Bugün veya bu hafta yapılması planlanan onaylı ödeme listelerini gözden geçir." },
        { id: "DR_10", title: "Geciken ödemeleri kontrol et", category: "Ödeme", priority: "Acil", description: "Vadesi geçmiş alacak ve borç faturalarını tespit et, gerekli aksiyonu al." },
        { id: "DR_11", title: "Mali müşavirden gelen talepleri kontrol et", category: "Mali Müşavir", priority: "Normal", description: "Mali müşavirin talep ettiği evrak, mutabakat ve bilgi eksikliklerini karşıla." },
        { id: "DR_12", title: "Eksik evrakları kontrol et", category: "Evrak", priority: "Normal", description: "İrsaliyesi gelip faturası gelmeyen, dekontu eksik veya onaysız fişleri tespit et." }
    ],

    // Eksik Bilgiler Tablosu (Excel'deki Eksik Bilgiler Sekmesi)
    missingInfoItems: [
        {
            id: "MI_1",
            subject: "Kredi / Leasing Taksit Tarihleri",
            category: "Finansman",
            status: "Bilgi Bekleniyor",
            currentNote: "Şirkete ait aktif kredi veya leasing sözleşmelerinin aylık taksit günleri ve tutarları henüz girilmedi.",
            actionPlan: "Banka kredi geri ödeme planları temin edildiğinde sisteme sabit takvim olarak eklenecek.",
            isFixed: false,
            enteredValue: ""
        },
        {
            id: "MI_2",
            subject: "Elektrik ve GES (UEDAŞ) Takvimi",
            category: "Elektrik & GES",
            status: "Tanımlandı & Takvimde",
            currentNote: "Her ayın 15'i UEDAŞ faturalarının işlenmesi & avans alacak/borç kontrolü, 16'sı GES faturalarının UEDAŞ'a kesilmesi, 26'sı Elektrik faturası ödeme/mahsup günü, 7'si GES faturalarının ödeme kontrolü olarak takvime bağlandı.",
            actionPlan: "Rutin görevler her ay otomatik oluşturulmaktadır.",
            isFixed: true,
            enteredValue: "7, 15, 16 ve 26. günler"
        },
        {
            id: "MI_3",
            subject: "Su Faturaları Son Ödeme Tarihi (Merkez & Şube)",
            category: "Otomatik Fatura / Su",
            status: "Tanımlandı & Takvimde",
            currentNote: "Her ayın 22'si SODSAN Merkez ve Şube su faturaları Ziraat Bankası otomatik ödemede. Hesap bakiyesi ve otomatik çekim kontrolü takvime bağlandı.",
            actionPlan: "Rutin görevler her ay otomatik oluşturulmaktadır.",
            isFixed: true,
            enteredValue: "Her ayın 22'si (Ziraat Bankası)"
        },
        {
            id: "MI_4",
            subject: "Telefon ve GSM (Vodafone) Faturaları Son Ödeme Tarihi",
            category: "Otomatik Fatura / İletişim",
            status: "Tanımlandı & Takvimde",
            currentNote: "Her ayın 16'sı SODSAN Telefon, her ayın 19'u Vodafone faturası Ziraat Bankası otomatik ödemede. Hesap bakiyesi ve otomatik çekim kontrolü takvime bağlandı.",
            actionPlan: "Rutin görevler her ay otomatik oluşturulmaktadır.",
            isFixed: true,
            enteredValue: "16'sı Telefon, 19'u Vodafone (Ziraat Bankası)"
        },
        {
            id: "MI_5",
            subject: "Doğalgaz Faturası Son Ödeme Tarihi",
            category: "Otomatik Fatura",
            status: "Otomatik Talimatta (Kış Sezonu)",
            currentNote: "Fabrika ısınma ve proses doğalgaz faturası son ödeme kontrolü.",
            actionPlan: "İGDAŞ fatura bildiriminde son ödeme takvime girilecek.",
            isFixed: false,
            enteredValue: ""
        },
        {
            id: "MI_6",
            subject: "Bordro Hazırlama İç Termin Tarihleri",
            category: "Bordro / İK",
            status: "Tanımlandı",
            currentNote: "Puantaj kapama tarihi her ayın 3'ü, iç bordro kontrolü 5'i, mali müşavir kontrolü 8'i olarak planlandı.",
            actionPlan: "İç bordro kontrolü tamamlanıp onaylandıktan sonra ayın 10'unda maaş banka talimatı verilir.",
            isFixed: true,
            enteredValue: "Her ayın 1-5 arası"
        },
        {
            id: "MI_7",
            subject: "Şirkete Özel Harç ve Yerel Vergiler",
            category: "Vergi / Belediye",
            status: "Bilgi Bekleniyor",
            currentNote: "Belediye Çevre Temizlik Vergisi (ÇTV) ve İlan Reklam Vergisi 1. ve 2. taksit tarihleri.",
            actionPlan: "Mayıs ve Kasım ayları sonuna 2 taksit olarak takvime işlenecektir.",
            isFixed: false,
            enteredValue: ""
        },
        {
            id: "MI_8",
            subject: "Kira Ödemesi",
            category: "Mülk",
            status: "Gereksiz (Kira Yok)",
            currentNote: "SODSAN şirket mülkü kendi adına kayıtlı olduğundan fabrika/ofis kira ödemesi bulunmamaktadır.",
            actionPlan: "Takvimden ve gider planından muaf tutulmuştur.",
            isFixed: true,
            enteredValue: "Kira Ödemesi Yoktur"
        },
        {
            id: "MI_9",
            subject: "Çek / Senet Ödemeleri",
            category: "Finansman",
            status: "Gereksiz (Çek Kullanılmıyor)",
            currentNote: "Şirket politikasında çek veya senet ile ödeme yöntemi uygulanmamaktadır.",
            actionPlan: "Tüm tedarikçi ödemeleri Cuma günleri doğrudan banka havalesi/EFT ile yapılmaktadır.",
            isFixed: true,
            enteredValue: "Çek Kullanılmamaktadır"
        }
    ],

    // 2026 Resmi Vergi ve SGK Takvimi (Tüm Yıl - GİB ve SGK Resmi Mevzuatına Uygun)
    taxes2026: [
        // OCAK 2026
        { id: "TX_2026_01_1", period: "Aralık 2025", type: "Muhtasar ve Prim Hizmet (MPHB)", declDate: "2026-01-26", dueDate: "2026-01-26", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Aralık dönemi bordro muhtasar ve SGK bildirimi" },
        { id: "TX_2026_01_2", period: "Aralık 2025", type: "KDV-1 & KDV-2", declDate: "2026-01-28", dueDate: "2026-01-28", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Aralık 2025 KDV beyannamesi ve ödemesi" },
        { id: "TX_2026_01_3", period: "Aralık 2025", type: "Damga Vergisi", declDate: "2026-01-26", dueDate: "2026-01-26", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Sözleşme damga vergileri" },
        { id: "TX_2026_01_4", period: "Aralık 2025", type: "SGK Primleri", declDate: "2026-01-26", dueDate: "2026-02-02", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Aralık SGK primi" },

        // ŞUBAT 2026
        { id: "TX_2026_02_1", period: "2025/4. Dönem", type: "Geçici Vergi (Kurumlar)", declDate: "2026-02-17", dueDate: "2026-02-17", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "2025 yılı 4. geçici vergi" },
        { id: "TX_2026_02_2", period: "Ocak 2026", type: "Muhtasar ve Prim Hizmet (MPHB)", declDate: "2026-02-26", dueDate: "2026-02-26", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Ocak bordro ve muhtasar" },
        { id: "TX_2026_02_3", period: "Ocak 2026", type: "KDV-1 & KDV-2", declDate: "2026-02-28", dueDate: "2026-03-02", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Haftasonuna geldiğinden 2 Mart Pazartesi" },
        { id: "TX_2026_02_4", period: "Ocak 2026", type: "SGK Primleri", declDate: "2026-02-26", dueDate: "2026-03-02", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Ocak SGK primleri" },

        // MART 2026
        { id: "TX_2026_03_1", period: "Şubat 2026", type: "Muhtasar ve Prim Hizmet (MPHB)", declDate: "2026-03-26", dueDate: "2026-03-26", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Şubat ayı MPHB" },
        { id: "TX_2026_03_2", period: "Şubat 2026", type: "KDV-1 & KDV-2", declDate: "2026-03-28", dueDate: "2026-03-30", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Şubat KDV ödemesi" },
        { id: "TX_2026_03_3", period: "Şubat 2026", type: "SGK Primleri", declDate: "2026-03-26", dueDate: "2026-03-31", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Şubat SGK ödemesi" },

        // NİSAN 2026
        { id: "TX_2026_04_1", period: "Mart 2026", type: "Muhtasar ve Prim Hizmet (MPHB)", declDate: "2026-04-27", dueDate: "2026-04-27", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "26 Pazar olduğundan 27 Pazartesi" },
        { id: "TX_2026_04_2", period: "Mart 2026", type: "KDV-1 & KDV-2", declDate: "2026-04-28", dueDate: "2026-04-28", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Mart ayı KDV" },
        { id: "TX_2026_04_3", period: "2025 Yıllık", type: "Kurumlar Vergisi Beyannamesi", declDate: "2026-04-30", dueDate: "2026-04-30", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "2025 Yılı Kurumlar Vergisi Yıllık Beyan ve Ödemesi" },
        { id: "TX_2026_04_4", period: "Mart 2026", type: "SGK Primleri", declDate: "2026-04-27", dueDate: "2026-04-30", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Mart ayı SGK primi" },

        // MAYIS 2026
        { id: "TX_2026_05_1", period: "2026/1. Dönem", type: "Geçici Vergi (Kurumlar)", declDate: "2026-05-18", dueDate: "2026-05-18", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "1. Çeyrek Kurumlar Geçici Vergi" },
        { id: "TX_2026_05_2", period: "Nisan 2026", type: "Muhtasar ve Prim Hizmet (MPHB)", declDate: "2026-05-26", dueDate: "2026-05-26", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Nisan ayı bordro ve stopaj" },
        { id: "TX_2026_05_3", period: "Nisan 2026", type: "KDV-1 & KDV-2", declDate: "2026-05-28", dueDate: "2026-05-28", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Nisan ayı KDV" },
        { id: "TX_2026_05_4", period: "Nisan 2026", type: "SGK Primleri", declDate: "2026-05-26", dueDate: "2026-06-01", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Nisan ayı SGK ödemesi" },

        // HAZİRAN 2026
        { id: "TX_2026_06_1", period: "Mayıs 2026", type: "Muhtasar ve Prim Hizmet (MPHB)", declDate: "2026-06-26", dueDate: "2026-06-26", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Mayıs ayı MPHB" },
        { id: "TX_2026_06_2", period: "Mayıs 2026", type: "KDV-1 & KDV-2", declDate: "2026-06-29", dueDate: "2026-06-29", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "28 Pazar -> 29 Pazartesi" },
        { id: "TX_2026_06_3", period: "Mayıs 2026", type: "SGK Primleri", declDate: "2026-06-26", dueDate: "2026-06-30", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Mayıs ayı SGK primi" },
        { id: "TX_2026_06_4", period: "2025 Yılı", type: "Yevmiye Defteri Kapanış Tasdiki", declDate: "2026-06-30", dueDate: "2026-06-30", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Noter yevmiye kapanış tasdiki" },

        // TEMMUZ 2026
        { id: "TX_2026_07_1", period: "Haziran 2026", type: "Muhtasar ve Prim Hizmet (MPHB)", declDate: "2026-07-27", dueDate: "2026-07-27", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "26 Pazar -> 27 Pazartesi" },
        { id: "TX_2026_07_2", period: "Haziran 2026", type: "KDV-1 & KDV-2", declDate: "2026-07-28", dueDate: "2026-07-28", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Haziran ayı KDV" },
        { id: "TX_2026_07_3", period: "Haziran 2026", type: "SGK Primleri", declDate: "2026-07-27", dueDate: "2026-07-31", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Haziran SGK primi" },

        // AĞUSTOS 2026
        { id: "TX_2026_08_1", period: "2026/2. Dönem", type: "Geçici Vergi (Kurumlar)", declDate: "2026-08-17", dueDate: "2026-08-17", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "2. Çeyrek Geçici Vergi" },
        { id: "TX_2026_08_2", period: "Temmuz 2026", type: "Muhtasar ve Prim Hizmet (MPHB)", declDate: "2026-08-26", dueDate: "2026-08-26", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Temmuz bordro stopaj" },
        { id: "TX_2026_08_3", period: "Temmuz 2026", type: "KDV-1 & KDV-2", declDate: "2026-08-28", dueDate: "2026-08-28", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Temmuz ayı KDV" },
        { id: "TX_2026_08_4", period: "Temmuz 2026", type: "SGK Primleri", declDate: "2026-08-26", dueDate: "2026-08-31", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Temmuz SGK primi" },

        // EYLÜL 2026
        { id: "TX_2026_09_1", period: "Ağustos 2026", type: "Muhtasar ve Prim Hizmet (MPHB)", declDate: "2026-09-28", dueDate: "2026-09-28", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "26 Cumartesi -> 28 Pazartesi" },
        { id: "TX_2026_09_2", period: "Ağustos 2026", type: "KDV-1 & KDV-2", declDate: "2026-09-28", dueDate: "2026-09-28", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Ağustos ayı KDV" },
        { id: "TX_2026_09_3", period: "Ağustos 2026", type: "SGK Primleri", declDate: "2026-09-28", dueDate: "2026-09-30", estAmount: 0, status: "Tamamlandı", declSubmitted: true, paid: true, advisorChecked: true, note: "Ağustos ayı SGK ödemesi" },

        // EKİM 2026 (ŞU ANKİ AKTİF DÖNEM - 21 EKİM 2026)
        { id: "TX_2026_10_1", period: "Eylül 2026", type: "Muhtasar ve Prim Hizmet (MPHB)", declDate: "2026-10-26", dueDate: "2026-10-26", estAmount: 0, status: "Bekliyor", declSubmitted: false, paid: false, advisorChecked: false, note: "21 Ekim Mali Müşavir ziyaretinde tahakkuk tutarı kontrol edilecek." },
        { id: "TX_2026_10_2", period: "Eylül 2026", type: "Damga Vergisi", declDate: "2026-10-26", dueDate: "2026-10-26", estAmount: 0, status: "Bekliyor", declSubmitted: false, paid: false, advisorChecked: false, note: "Eylül ayı damga vergisi beyan ve ödemesi" },
        { id: "TX_2026_10_3", period: "Eylül 2026", type: "KDV-1 & KDV-2", declDate: "2026-10-28", dueDate: "2026-10-28", estAmount: 0, status: "Bekliyor", declSubmitted: false, paid: false, advisorChecked: false, note: "Eylül ayı KDV beyannamesi ve ödemesi." },
        { id: "TX_2026_10_4", period: "Eylül 2026", type: "SGK Primleri", declDate: "2026-10-26", dueDate: "2026-11-02", estAmount: 0, status: "Bekliyor", declSubmitted: false, paid: false, advisorChecked: false, note: "31 Ekim Cumartesi olduğundan 2 Kasım Pazartesi son gün." },

        // KASIM 2026
        { id: "TX_2026_11_1", period: "2026/3. Dönem", type: "Geçici Vergi (Kurumlar)", declDate: "2026-11-17", dueDate: "2026-11-17", estAmount: 0, status: "Bekliyor", declSubmitted: false, paid: false, advisorChecked: false, note: "3. Çeyrek Geçici Vergi beyanı ve ödemesi" },
        { id: "TX_2026_11_2", period: "Ekim 2026", type: "Muhtasar ve Prim Hizmet (MPHB)", declDate: "2026-11-26", dueDate: "2026-11-26", estAmount: 0, status: "Bekliyor", declSubmitted: false, paid: false, advisorChecked: false, note: "Ekim ayı bordro ve stopaj beyanı" },
        { id: "TX_2026_11_3", period: "Ekim 2026", type: "KDV-1 & KDV-2", declDate: "2026-11-30", dueDate: "2026-11-30", estAmount: 0, status: "Bekliyor", declSubmitted: false, paid: false, advisorChecked: false, note: "28 Cumartesi -> 30 Pazartesi" },
        { id: "TX_2026_11_4", period: "Ekim 2026", type: "SGK Primleri", declDate: "2026-11-26", dueDate: "2026-11-30", estAmount: 0, status: "Bekliyor", declSubmitted: false, paid: false, advisorChecked: false, note: "Ekim ayı SGK primi ödemesi" },

        // ARALIK 2026
        { id: "TX_2026_12_1", period: "Kasım 2026", type: "Muhtasar ve Prim Hizmet (MPHB)", declDate: "2026-12-28", dueDate: "2026-12-28", estAmount: 0, status: "Bekliyor", declSubmitted: false, paid: false, advisorChecked: false, note: "26 Cumartesi -> 28 Pazartesi" },
        { id: "TX_2026_12_2", period: "Kasım 2026", type: "KDV-1 & KDV-2", declDate: "2026-12-28", dueDate: "2026-12-28", estAmount: 0, status: "Bekliyor", declSubmitted: false, paid: false, advisorChecked: false, note: "Kasım ayı KDV beyanı ve ödemesi" },
        { id: "TX_2026_12_3", period: "Kasım 2026", type: "SGK Primleri", declDate: "2026-12-28", dueDate: "2026-12-31", estAmount: 0, status: "Bekliyor", declSubmitted: false, paid: false, advisorChecked: false, note: "Kasım ayı SGK primleri" },
        { id: "TX_2026_12_4", period: "2027 Yılı", type: "Yeni Yıl Defter Açılış Tasdiki", declDate: "2026-12-31", dueDate: "2026-12-31", estAmount: 0, status: "Bekliyor", declSubmitted: false, paid: false, advisorChecked: false, note: "2027 yılı yasal defterlerin noter tasdikleri" }
    ],

    // Mali Müşavir Ziyaretleri (Her ayın 8'i ve 21'i)
    advisorVisits: [
        {
            id: "ADV_2026_10_08",
            date: "2026-10-08",
            title: "Mali Müşavir 1. Aylık Ziyareti (Ekim)",
            status: "Tamamlandı",
            purpose: "Muhasebe kayıtlarının kontrolü, evrak kontrolü, eksik kayıtların kontrolü, mali müşavirle görüşme",
            topicsDiscussed: "",
            missingItems: "",
            pendingSODSAN: "",
            pendingAdvisor: "",
            nextVisitDate: "2026-10-21",
            completedAt: "2026-10-08 17:30",
            notes: ""
        },
        {
            id: "ADV_2026_10_21",
            date: "2026-10-21",
            title: "Mali Müşavir 2. Aylık Ziyareti (Ekim - BUGÜN!)",
            status: "Devam ediyor",
            purpose: "Vergi kontrolü, SGK kontrolü, Bordro kontrolü, Yaklaşan ödeme ve beyanname kontrolü",
            preparationChecklist: [
                { item: "Eksik faturaların tespit edilmesi ve listelenmesi", checked: false },
                { item: "Banka ekstreleri ve muhasebe kayıtlarının teyidi", checked: false },
                { item: "Cari hesap mutabakatlarının gözden geçirilmesi", checked: false },
                { item: "Eylül dönemi bordro icmali ve SGK MPHB taslağının hazırlanması", checked: false },
                { item: "Yaklaşan KDV ve Muhtasar beyanname tutarlarının netleştirilmesi", checked: false },
                { item: "Eksik evrak ve imza kontrolü", checked: false },
                { item: "Bekleyen muhasebe kayıtlarının onaylanması", checked: false }
            ],
            topicsDiscussed: "",
            missingItems: "",
            pendingSODSAN: "",
            pendingAdvisor: "",
            nextVisitDate: "2026-11-08",
            completedAt: "",
            notes: ""
        },
        {
            id: "ADV_2026_11_08",
            date: "2026-11-08",
            title: "Mali Müşavir 1. Aylık Ziyareti (Kasım)",
            status: "Bekliyor",
            purpose: "Muhasebe kayıtlarının kontrolü, evrak kontrolü, eksik kayıtların kontrolü, mali müşavirle görüşme",
            topicsDiscussed: "",
            missingItems: "",
            pendingSODSAN: "",
            pendingAdvisor: "",
            nextVisitDate: "2026-11-21",
            completedAt: "",
            notes: ""
        },
        {
            id: "ADV_2026_11_21",
            date: "2026-11-21",
            title: "Mali Müşavir 2. Aylık Ziyareti (Kasım)",
            status: "Bekliyor",
            purpose: "Vergi kontrolü, SGK kontrolü, Bordro kontrolü, 3. Dönem Geçici Vergi ve yaklaşan beyannameler",
            topicsDiscussed: "",
            missingItems: "",
            pendingSODSAN: "",
            pendingAdvisor: "",
            nextVisitDate: "2026-12-08",
            completedAt: "",
            notes: ""
        }
    ],

    // Personel ve Bordro Verisi (60 Personel)
    payrollData: {
        employeeCount: 60,
        currentPeriod: "2026-10",
        salaryDay: 10,
        advanceDay: 25,
        estimatedTotalNetSalary: 0,
        estimatedTotalAdvance: 0,
        estimatedTotalSGK: 0,
        steps: [
            { id: 1, step: "Puantaj Kontrolü ve Kapatılması", targetDay: 3, done: false, doneDate: null, note: "" },
            { id: 2, step: "Bordro Hazırlığı (İç Muhasebe)", targetDay: 5, done: false, doneDate: null, note: "" },
            { id: 3, step: "İç Bordro & İK Kontrolü", targetDay: 6, done: false, doneDate: null, note: "" },
            { id: 4, step: "Mali Müşavir Bordro Kontrolü", targetDay: 8, done: false, doneDate: null, note: "" },
            { id: 5, step: "Maaş Banka Talimatı & Ödeme", targetDay: 10, done: false, doneDate: null, note: "" },
            { id: 6, step: "Maaş Avans Hazırlığı & Ödeme", targetDay: 25, done: false, doneDate: null, note: "" },
            { id: 7, step: "SGK MPHB Bildirimi", targetDay: 26, done: false, doneDate: null, note: "" },
            { id: 8, step: "SGK Prim Ödemesi", targetDay: 31, done: false, doneDate: null, note: "" }
        ]
    },

    // Örnek / mock faturalar kaldırılmıştır. Gerçek faturalar kullanıcı tarafından girilecektir.
    seedInvoices: [],

    // Örnek / mock ödemeler kaldırılmıştır. Gerçek ödemeler kullanıcı tarafından girilecektir.
    seedPayments: []
};
