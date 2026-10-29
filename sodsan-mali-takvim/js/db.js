/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Veritabanı ve Yerel Depolama Yöneticisi (Database & State Management)
 */

const SODSAN_DB = (function() {
    const DB_KEY = "sodsan_mali_takvim_db_v5";

    function formatLocalISO(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function getRealToday() {
        return formatLocalISO(new Date());
    }

    let state = {
        settings: {},
        users: [],
        currentUser: null,
        activeDate: getRealToday(), // Gerçek sistem tarihi veya kullanıcının seçtiği gün
        tasks: [],
        invoices: [],
        payments: [],
        taxes: [],
        advisorVisits: [],
        payrollData: {},
        missingInfoItems: [],
        dailyRoutineTemplates: [],
        auditLogs: [],
        dailyRoutinesDone: {} // Format: { "YYYY-MM-DD": { "DR_1": true, ... } }
    };

    function init() {
        try {
            localStorage.removeItem("sodsan_mali_takvim_db_v1");
            localStorage.removeItem("sodsan_mali_takvim_db_v2");
            localStorage.removeItem("sodsan_mali_takvim_db_v3");
            localStorage.removeItem("sodsan_mali_takvim_db_v4");
        } catch(e) {}

        const realToday = getRealToday();
        const stored = localStorage.getItem(DB_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                state = Object.assign(state, parsed);
                state.invoices = (state.invoices || []).filter(i => !i.id || !i.id.startsWith("FAT_2026_00"));
                state.payments = (state.payments || []).filter(p => !p.id || !p.id.startsWith("PAY_2026_10_0"));
            } catch (e) {
                console.error("Depolama verisi okunamadı, varsayılanlar yükleniyor:", e);
                loadInitialSeed();
            }
        } else {
            loadInitialSeed();
        }

        // Sistem tarihini bugünden başlat:
        // Eğer kullanıcı mevcut oturumunda (session) geçici bir tarih seçmemişse her zaman GERÇEK BUGÜN alınır!
        let sessionDate = null;
        try {
            sessionDate = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem("sodsan_simulated_date") : null;
        } catch(e) {}
        state.activeDate = sessionDate || realToday;

        // Aktif kullanıcıyı ayarla
        if (!state.currentUser && state.users && state.users.length > 0) {
            state.currentUser = state.users[0]; // Salih (Yönetici)
        }

        ensureRoutinesGeneratedForYear(2026);
        save();
    }

    function getTodayISO() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function loadInitialSeed() {
        state.settings = JSON.parse(JSON.stringify(SODSAN_INITIAL_DATA.settings));
        state.users = JSON.parse(JSON.stringify(SODSAN_INITIAL_DATA.users));
        state.currentUser = state.users[0];
        state.dailyRoutineTemplates = JSON.parse(JSON.stringify(SODSAN_INITIAL_DATA.dailyRoutineTemplates));
        state.missingInfoItems = JSON.parse(JSON.stringify(SODSAN_INITIAL_DATA.missingInfoItems));
        state.taxes = JSON.parse(JSON.stringify(SODSAN_INITIAL_DATA.taxes2026));
        state.advisorVisits = JSON.parse(JSON.stringify(SODSAN_INITIAL_DATA.advisorVisits));
        state.payrollData = JSON.parse(JSON.stringify(SODSAN_INITIAL_DATA.payrollData));
        state.invoices = JSON.parse(JSON.stringify(SODSAN_INITIAL_DATA.seedInvoices));
        state.payments = JSON.parse(JSON.stringify(SODSAN_INITIAL_DATA.seedPayments));
        state.tasks = [];
        state.auditLogs = [];
        state.dailyRoutinesDone = {};

        logAction("Sistem", "Başlatma", "Sistem", "SYS", "2026 Mali İşler Başlangıç Veri Seti Yüklendi.");
    }

    function save() {
        try {
            localStorage.setItem(DB_KEY, JSON.stringify(state));
        } catch (err) {
            console.error("Kayıt hatası:", err);
        }
    }

    // Yıl boyunca tüm sabit SODSAN rutinlerini otomatik oluştur
    function ensureRoutinesGeneratedForYear(year) {
        const existingRoutineIds = new Set(state.tasks.map(t => t.routineKey).filter(Boolean));
        const realToday = getRealToday();

        // 12 Ay için döngü
        for (let month = 1; month <= 12; month++) {
            const mStr = String(month).padStart(2, '0');

            // 1) Her ayın 7'si: GES Kesilen Faturaların Ödeme Kontrolü
            const key7 = `ROUTINE_${year}_${mStr}_07_GES_KONTROL`;
            const date7 = `${year}-${mStr}-07`;
            const isPast7 = (date7 < realToday);
            const isToday7 = (date7 === realToday);
            if (!existingRoutineIds.has(key7)) {
                state.tasks.push({
                    id: "TSK_" + key7,
                    routineKey: key7,
                    date: date7,
                    dueDate: date7,
                    title: `GES Kesilen Faturaların Ödemesinin Kontrolü`,
                    category: "GES",
                    priority: "Yüksek",
                    status: isPast7 ? "Tamamlandı" : (isToday7 ? "Devam ediyor" : "Bekliyor"),
                    assignedTo: "Muhasebe / Finans",
                    description: "UEDAŞ'a kesilen GES (Güneş Enerjisi Santrali) üretim fatura ödemelerinin banka hesabına geçip geçmediğinin kontrolü.",
                    note: "Banka hesap hareketlerinden UEDAŞ üretim bedeli transferi teyit edilir.",
                    completedAt: isPast7 ? `${date7} 15:00` : null,
                    isDeleted: false
                });
            }

            // 2) Her ayın 8'i: Mali Müşavir Ziyareti
            const key8 = `ROUTINE_${year}_${mStr}_08_MUSAVIR`;
            const date8 = `${year}-${mStr}-08`;
            const isPast8 = (date8 < realToday);
            if (!existingRoutineIds.has(key8)) {
                state.tasks.push({
                    id: "TSK_" + key8,
                    routineKey: key8,
                    date: date8,
                    dueDate: date8,
                    title: `Mali Müşavir 1. Aylık Ziyareti (${month}. Ay)`,
                    category: "Mali Müşavir",
                    priority: "Yüksek",
                    status: isPast8 ? "Tamamlandı" : "Bekliyor",
                    assignedTo: "Salih / Muhasebe",
                    description: "Muhasebe kayıtlarının kontrolü, evrak kontrolü, eksik kayıtların kontrolü, mali müşavirle gerekli konuların görüşülmesi.",
                    note: "Ziyaret öncesi eksik evrak ve banka ekstreleri hazır edilmeli.",
                    completedAt: isPast8 ? `${date8} 17:00` : null,
                    isDeleted: false
                });
            }

            // 3) Her ayın 10'u: Maaş Ödemesi
            const key10 = `ROUTINE_${year}_${mStr}_10_MAAS`;
            const date10 = `${year}-${mStr}-10`;
            const isPast10 = (date10 < realToday);
            if (!existingRoutineIds.has(key10)) {
                state.tasks.push({
                    id: "TSK_" + key10,
                    routineKey: key10,
                    date: date10,
                    dueDate: date10,
                    title: `Personel Maaş Ödemesi (${month}. Ay - 60 Kişi)`,
                    category: "Maaş",
                    priority: "Acil",
                    status: isPast10 ? "Tamamlandı" : "Bekliyor",
                    assignedTo: "Muhasebe / Banka",
                    description: "60 fabrika çalışanının net maaş transfer dosyasının bankaya iletilmesi ve hesap bakiyesinin teyidi.",
                    note: "Garanti BBVA toplu ödeme kanalı kullanılır.",
                    completedAt: isPast10 ? `${date10} 11:30` : null,
                    isDeleted: false
                });
            }

            // 4) Her ayın 15'i: UEDAŞ Elektrik Faturalarının İşlenmesi ve Avans Mahsup Kontrolü
            const key15 = `ROUTINE_${year}_${mStr}_15_UEDAS_FATURA`;
            const date15 = `${year}-${mStr}-15`;
            const isPast15 = (date15 < realToday);
            const isToday15 = (date15 === realToday);
            if (!existingRoutineIds.has(key15)) {
                state.tasks.push({
                    id: "TSK_" + key15,
                    routineKey: key15,
                    date: date15,
                    dueDate: date15,
                    title: `UEDAŞ Elektrik Faturalarının İşlenmesi & Avans Mahsup Kontrolü`,
                    category: "Elektrik",
                    priority: "Yüksek",
                    status: isPast15 ? "Tamamlandı" : (isToday15 ? "Devam ediyor" : "Bekliyor"),
                    assignedTo: "Muhasebe",
                    description: "UEDAŞ'tan gelen elektrik faturalarının muhasebe sistemine kaydedilmesi ve ödenen avans tutarına göre alacak / borç durumunun kontrol edilmesi.",
                    note: "Ödenen avans tutarı ile gerçekleşen fatura karşılaştırılarak net bakiye çıkarılır.",
                    completedAt: isPast15 ? `${date15} 16:30` : null,
                    isDeleted: false
                });
            }

            // 5) Her ayın 16'sı: GES Faturalarının UEDAŞ'a Kesilmesi
            const key16 = `ROUTINE_${year}_${mStr}_16_GES_FATURA`;
            const date16 = `${year}-${mStr}-16`;
            const isPast16 = (date16 < realToday);
            const isToday16 = (date16 === realToday);
            if (!existingRoutineIds.has(key16)) {
                state.tasks.push({
                    id: "TSK_" + key16,
                    routineKey: key16,
                    date: date16,
                    dueDate: date16,
                    title: `GES Faturalarının UEDAŞ'a Kesilmesi`,
                    category: "GES",
                    priority: "Yüksek",
                    status: isPast16 ? "Tamamlandı" : (isToday16 ? "Devam ediyor" : "Bekliyor"),
                    assignedTo: "Muhasebe",
                    description: "Güneş Enerjisi Santrali (GES) aylık elektrik üretim faturalarının UEDAŞ'a e-Fatura olarak kesilmesi ve resmi portaldan gönderilmesi.",
                    note: "Üretim verileri ve endeks teyidiyle e-Fatura kesilir.",
                    completedAt: isPast16 ? `${date16} 17:00` : null,
                    isDeleted: false
                });
            }

            // 6) Her ayın 16'sı: SODSAN Telefon Faturası Ziraat Otomatik Ödeme Kontrolü
            const key16Tel = `ROUTINE_${year}_${mStr}_16_TELEFON_ZIRAAT`;
            if (!existingRoutineIds.has(key16Tel)) {
                state.tasks.push({
                    id: "TSK_" + key16Tel,
                    routineKey: key16Tel,
                    date: date16,
                    dueDate: date16,
                    title: `SODSAN Telefon Faturası Ziraat Otomatik Ödeme Kontrolü`,
                    category: "Fatura",
                    priority: "Yüksek",
                    status: isPast16 ? "Tamamlandı" : (isToday16 ? "Devam ediyor" : "Bekliyor"),
                    assignedTo: "Muhasebe",
                    description: "Ziraat Bankası otomatik talimat kontrolü: SODSAN telefon faturası için hesap bakiyesi kontrol edilir, otomatik çekim teyit edilir, gerçekleşmediyse manuel ödenir.",
                    note: "Ziraat Bankası otomatik ödeme talimatı.",
                    completedAt: isPast16 ? `${date16} 16:00` : null,
                    isDeleted: false
                });
            }

            // 7) Her ayın 19'u: Vodafone Faturası Ziraat Otomatik Ödeme Kontrolü
            const key19Vod = `ROUTINE_${year}_${mStr}_19_VODAFONE_ZIRAAT`;
            const date19 = `${year}-${mStr}-19`;
            const isPast19 = (date19 < realToday);
            const isToday19 = (date19 === realToday);
            if (!existingRoutineIds.has(key19Vod)) {
                state.tasks.push({
                    id: "TSK_" + key19Vod,
                    routineKey: key19Vod,
                    date: date19,
                    dueDate: date19,
                    title: `Vodafone Faturası Ziraat Otomatik Ödeme Kontrolü`,
                    category: "Fatura",
                    priority: "Yüksek",
                    status: isPast19 ? "Tamamlandı" : (isToday19 ? "Devam ediyor" : "Bekliyor"),
                    assignedTo: "Muhasebe",
                    description: "Ziraat Bankası otomatik talimat kontrolü: Vodafone kurumsal hat faturası için hesap bakiyesi kontrol edilir, otomatik çekim teyit edilir, gerçekleşmediyse manuel ödenir.",
                    note: "Ziraat Bankası otomatik ödeme talimatı.",
                    completedAt: isPast19 ? `${date19} 16:00` : null,
                    isDeleted: false
                });
            }

            // 8) Her ayın 20'si: Kredi Kartı Ödemeleri + Banka Kontrolleri
            const key20 = `ROUTINE_${year}_${mStr}_20_KK`;
            const date20 = `${year}-${mStr}-20`;
            const isPast20 = (date20 < realToday);
            if (!existingRoutineIds.has(key20)) {
                state.tasks.push({
                    id: "TSK_" + key20,
                    routineKey: key20,
                    date: date20,
                    dueDate: date20,
                    title: `Kredi Kartı Ödemesi & Ekstre / Bakiye Kontrolü`,
                    category: "Kredi kartı",
                    priority: "Yüksek",
                    status: isPast20 ? "Tamamlandı" : "Bekliyor",
                    assignedTo: "Muhasebe",
                    description: "Şirket kredi kartları ekstre kontrolü, banka vadesiz hesap bakiyeleri kontrolü ve otomatik ödeme talimatlarının teyidi.",
                    note: "Ekstre borçları ve virmanlar kontrol edildi.",
                    completedAt: isPast20 ? `${date20} 16:00` : null,
                    isDeleted: false
                });
            }

            // 9) Her ayın 21'i: Mali Müşavir Ziyareti (Vergi/SGK/Bordro Kontrolü)
            const key21 = `ROUTINE_${year}_${mStr}_21_MUSAVIR`;
            const date21 = `${year}-${mStr}-21`;
            const isPast21 = (date21 < realToday);
            const isToday21 = (date21 === realToday);
            if (!existingRoutineIds.has(key21)) {
                state.tasks.push({
                    id: "TSK_" + key21,
                    routineKey: key21,
                    date: date21,
                    dueDate: date21,
                    title: `Mali Müşavir 2. Aylık Ziyareti (${month}. Ay)`,
                    category: "Mali Müşavir",
                    priority: "Yüksek",
                    status: isPast21 ? "Tamamlandı" : (isToday21 ? "Devam ediyor" : "Bekliyor"),
                    assignedTo: "Salih / Mali Müşavir",
                    description: "Vergi kontrolü, SGK kontrolü, Bordro kontrolü, Yaklaşan ödeme ve beyanname kontrolü.",
                    note: isToday21 ? "BUGÜN: Toplantı yapılacak, vergi ve SGK tutarları netleştirilecek." : "",
                    completedAt: isPast21 ? `${date21} 17:30` : null,
                    isDeleted: false
                });
            }

            // 10) Her ayın 22'si: SODSAN Merkez Su Faturası Ziraat Otomatik Ödeme Kontrolü
            const key22SuM = `ROUTINE_${year}_${mStr}_22_SU_MERKEZ_ZIRAAT`;
            const date22 = `${year}-${mStr}-22`;
            const isPast22 = (date22 < realToday);
            const isToday22 = (date22 === realToday);
            if (!existingRoutineIds.has(key22SuM)) {
                state.tasks.push({
                    id: "TSK_" + key22SuM,
                    routineKey: key22SuM,
                    date: date22,
                    dueDate: date22,
                    title: `SODSAN Merkez Su Faturası Ziraat Otomatik Ödeme Kontrolü`,
                    category: "Fatura",
                    priority: "Yüksek",
                    status: isPast22 ? "Tamamlandı" : (isToday22 ? "Devam ediyor" : "Bekliyor"),
                    assignedTo: "Muhasebe",
                    description: "Ziraat Bankası otomatik talimat kontrolü: SODSAN Merkez su faturası için hesap bakiyesi kontrol edilir, otomatik çekim teyit edilir, gerçekleşmediyse manuel ödenir.",
                    note: "Ziraat Bankası otomatik ödeme talimatı.",
                    completedAt: isPast22 ? `${date22} 16:00` : null,
                    isDeleted: false
                });
            }

            // 11) Her ayın 22'si: SODSAN Şube Su Faturası Ziraat Otomatik Ödeme Kontrolü
            const key22SuS = `ROUTINE_${year}_${mStr}_22_SU_SUBE_ZIRAAT`;
            if (!existingRoutineIds.has(key22SuS)) {
                state.tasks.push({
                    id: "TSK_" + key22SuS,
                    routineKey: key22SuS,
                    date: date22,
                    dueDate: date22,
                    title: `SODSAN Şube Su Faturası Ziraat Otomatik Ödeme Kontrolü`,
                    category: "Fatura",
                    priority: "Yüksek",
                    status: isPast22 ? "Tamamlandı" : (isToday22 ? "Devam ediyor" : "Bekliyor"),
                    assignedTo: "Muhasebe",
                    description: "Ziraat Bankası otomatik talimat kontrolü: SODSAN Şube su faturası için hesap bakiyesi kontrol edilir, otomatik çekim teyit edilir, gerçekleşmediyse manuel ödenir.",
                    note: "Ziraat Bankası otomatik ödeme talimatı.",
                    completedAt: isPast22 ? `${date22} 16:00` : null,
                    isDeleted: false
                });
            }

            // 8) Her ayın 25'i: Maaş Avansı
            const key25 = `ROUTINE_${year}_${mStr}_25_AVANS`;
            const date25 = `${year}-${mStr}-25`;
            const isPast25 = (date25 < realToday);
            if (!existingRoutineIds.has(key25)) {
                state.tasks.push({
                    id: "TSK_" + key25,
                    routineKey: key25,
                    date: date25,
                    dueDate: date25,
                    title: `Personel Maaş Avansı Ödemesi (${month}. Ay)`,
                    category: "Avans",
                    priority: "Yüksek",
                    status: isPast25 ? "Tamamlandı" : "Bekliyor",
                    assignedTo: "Muhasebe / İK",
                    description: "Avans talep eden 60 fabrika çalışanının avans listesinin hazırlanması ve bankadan transferi.",
                    note: "25'i hafta sonuna geliyorsa Cuma günü liste hazırlanır.",
                    completedAt: isPast25 ? `${date25} 14:00` : null,
                    isDeleted: false
                });
            }

            // 9) Her ayın 26'sı: Elektrik Faturası Ödeme Günü (Borçluysak Ödeme / Alacaklıysak Mahsup Kontrolü)
            const key26 = `ROUTINE_${year}_${mStr}_26_ELEKTRIK_ODEME`;
            const date26 = `${year}-${mStr}-26`;
            const isPast26 = (date26 < realToday);
            const isToday26 = (date26 === realToday);
            if (!existingRoutineIds.has(key26)) {
                state.tasks.push({
                    id: "TSK_" + key26,
                    routineKey: key26,
                    date: date26,
                    dueDate: date26,
                    title: `Elektrik Faturası Ödeme Günü (Borçluysak Ödeme / Alacaklıysak Mahsup Kontrolü)`,
                    category: "Elektrik",
                    priority: "Acil",
                    status: isPast26 ? "Tamamlandı" : (isToday26 ? "Devam ediyor" : "Bekliyor"),
                    assignedTo: "Muhasebe / Finans",
                    description: "Elektrik faturası ödeme günü: Borçluysak bankadan ödeme yapılması; alacaklıysak banka ve cari hesaptan bakiye ve mahsup kontrolünün yapılması.",
                    note: "Borç/alacak durumuna göre banka talimatı verilir veya mahsup teyit edilir.",
                    completedAt: isPast26 ? `${date26} 15:30` : null,
                    isDeleted: false
                });
            }
        }

        // 6) Haftalık Rutinler: Her Perşembe (Ödeme Listesi) ve Her Cuma (Tedarikçi Ödemesi)
        const d = new Date(year, 0, 1);
        while (d.getFullYear() === year) {
            const dayOfWeek = d.getDay(); // 4 = Perşembe, 5 = Cuma
            const isoDate = formatLocalISO(d);
            const isPast = (isoDate < realToday);
            const isToday = (isoDate === realToday);

            if (dayOfWeek === 4) { // Perşembe
                const keyThu = `ROUTINE_${isoDate}_THU_LIST`;
                if (!existingRoutineIds.has(keyThu)) {
                    state.tasks.push({
                        id: "TSK_" + keyThu,
                        routineKey: keyThu,
                        date: isoDate,
                        dueDate: isoDate,
                        title: `Tedarikçi Ödeme Listesi Hazırlanması & Onaya Sunulması`,
                        category: "Ödeme",
                        priority: "Yüksek",
                        status: isPast ? "Tamamlandı" : (isToday ? "Bekliyor" : "Bekliyor"),
                        assignedTo: "Muhasebe / Salih (Onay)",
                        description: "Cuma günü ödenecek hammadde, koli, nakliye ve hizmet faturalarının taranması, listenin hazırlanıp yönetici onayına sunulması.",
                        note: "Onaylanan liste Cuma sabahı banka talimatına dönüştürülür.",
                        completedAt: isPast ? `${isoDate} 16:30` : null,
                        isDeleted: false
                    });
                }
            } else if (dayOfWeek === 5) { // Cuma
                const keyFri = `ROUTINE_${isoDate}_FRI_PAY`;
                if (!existingRoutineIds.has(keyFri)) {
                    state.tasks.push({
                        id: "TSK_" + keyFri,
                        routineKey: keyFri,
                        date: isoDate,
                        dueDate: isoDate,
                        title: `Tedarikçi Faturalarının Bankadan Ödenmesi`,
                        category: "Tedarikçi",
                        priority: "Yüksek",
                        status: isPast ? "Tamamlandı" : "Bekliyor",
                        assignedTo: "Muhasebe / Finans",
                        description: "Perşembe günü onaylanan tedarikçi ödeme listesi doğrultusunda Garanti/İş Bankası havale/EFT işlemlerinin yapılması.",
                        note: "Dekontlar ilgili cari kartlara işlenmelidir.",
                        completedAt: isPast ? `${isoDate} 15:00` : null,
                        isDeleted: false
                    });
                }
            }

            d.setDate(d.getDate() + 1);
        }

        // 7) Vergi & SGK Beyan/Ödeme Görevlerini Senkronize Et
        state.taxes.forEach(tax => {
            const taxKey = `TAX_TASK_${tax.id}`;
            if (!existingRoutineIds.has(taxKey)) {
                state.tasks.push({
                    id: "TSK_" + taxKey,
                    routineKey: taxKey,
                    date: tax.dueDate,
                    dueDate: tax.dueDate,
                    title: `Vergi/SGK: ${tax.type} (${tax.period})`,
                    category: tax.type.includes("SGK") ? "SGK" : "Vergi",
                    priority: "Acil",
                    status: tax.status === "Tamamlandı" ? "Tamamlandı" : "Bekliyor",
                    assignedTo: "Mali Müşavir / Muhasebe",
                    description: `${tax.period} dönemi ${tax.type}. Beyanname tarihi: ${tax.declDate}, Son ödeme: ${tax.dueDate}. Tahmini Tutar: ${tax.estAmount.toLocaleString('tr-TR')} ₺`,
                    note: tax.note || "",
                    completedAt: tax.status === "Tamamlandı" ? `${tax.dueDate} 12:00` : null,
                    isDeleted: false
                });
            }
        });
    }

    // AUDIT LOG
    function logAction(user, action, targetType, targetId, details) {
        const entry = {
            id: "LOG_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            timestamp: new Date().toISOString(),
            user: typeof user === 'string' ? user : (user ? user.name : "Sistem"),
            role: user && user.role ? user.role : "Yonetici",
            action: action, // Ekleme, Güncelleme, Tamamlama, Silme, vb.
            targetType: targetType, // Görev, Fatura, Ödeme, Vergi, vb.
            targetId: targetId,
            details: details
        };
        state.auditLogs.unshift(entry);
        if (state.auditLogs.length > 500) {
            state.auditLogs.pop(); // Son 500 kaydı tut
        }
        save();
    }

    // API METOTLARI
    return {
        init,
        save,

        // Settings & State
        getSettings: () => state.settings,
        updateSettings: (newSettings) => {
            state.settings = Object.assign(state.settings, newSettings);
            save();
            logAction(state.currentUser, "Güncelleme", "Ayarlar", "SETTING", "Sistem ayarları güncellendi.");
        },

        getRealToday: getRealToday,
        formatLocalISO: formatLocalISO,
        getActiveDate: () => state.activeDate || getRealToday(),
        setActiveDate: (dateStr) => {
            if (!dateStr) return;
            state.activeDate = dateStr;
            const realToday = getRealToday();
            try {
                if (dateStr === realToday) {
                    sessionStorage.removeItem("sodsan_simulated_date");
                } else {
                    sessionStorage.setItem("sodsan_simulated_date", dateStr);
                }
            } catch(e) {}
            save();
        },

        getCurrentUser: () => state.currentUser || state.users[0],
        setCurrentUser: (userId) => {
            const found = state.users.find(u => u.id === userId);
            if (found) {
                state.currentUser = found;
                save();
                logAction(found, "Oturum Değişimi", "Kullanıcı", found.id, `Aktif kullanıcı: ${found.name} (${found.role})`);
            }
        },
        getUsers: () => state.users,

        // Tasks
        getTasks: (filterDate, includeDeleted = false) => {
            return state.tasks.filter(t => {
                if (!includeDeleted && t.isDeleted) return false;
                if (filterDate && t.date !== filterDate) return false;
                return true;
            });
        },
        getAllTasks: () => state.tasks.filter(t => !t.isDeleted),
        getTaskById: (id) => state.tasks.find(t => t.id === id),
        saveTask: (task) => {
            const isNew = !task.id;
            if (isNew) {
                task.id = "TSK_" + Date.now();
                task.isDeleted = false;
                state.tasks.unshift(task);
                logAction(state.currentUser, "Ekleme", "Görev", task.id, `Yeni görev oluşturuldu: "${task.title}"`);
            } else {
                const idx = state.tasks.findIndex(t => t.id === task.id);
                if (idx !== -1) {
                    state.tasks[idx] = Object.assign(state.tasks[idx], task);
                    logAction(state.currentUser, "Güncelleme", "Görev", task.id, `Görev güncellendi: "${task.title}" (${task.status})`);
                }
            }
            save();
            return task;
        },
        toggleTaskStatus: (taskId, newStatus) => {
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = newStatus || (task.status === "Tamamlandı" ? "Bekliyor" : "Tamamlandı");
                task.completedAt = (task.status === "Tamamlandı") ? new Date().toISOString().replace('T', ' ').slice(0, 16) : null;
                save();
                logAction(state.currentUser, "Durum Değişimi", "Görev", task.id, `Görev "${task.title}" durumu: ${task.status}`);
            }
            return task;
        },
        deleteTask: (taskId) => {
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                task.isDeleted = true;
                task.deletedAt = new Date().toISOString();
                task.deletedBy = state.currentUser ? state.currentUser.name : "Kullanıcı";
                save();
                logAction(state.currentUser, "Arşive Taşıma", "Görev", task.id, `Görev arşive taşındı: "${task.title}"`);
            }
        },
        restoreTask: (taskId) => {
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                task.isDeleted = false;
                delete task.deletedAt;
                delete task.deletedBy;
                save();
                logAction(state.currentUser, "Geri Yükleme", "Görev", task.id, `Görev arşivden geri yüklendi: "${task.title}"`);
            }
        },

        // Daily Routine 12 Tasks Checklist for a given date
        getDailyRoutineStatus: (dateStr) => {
            return state.dailyRoutinesDone[dateStr] || {};
        },
        toggleDailyRoutineItem: (dateStr, routineId) => {
            if (!state.dailyRoutinesDone[dateStr]) {
                state.dailyRoutinesDone[dateStr] = {};
            }
            const current = !!state.dailyRoutinesDone[dateStr][routineId];
            state.dailyRoutinesDone[dateStr][routineId] = !current;
            save();
            const tmpl = state.dailyRoutineTemplates.find(t => t.id === routineId);
            const title = tmpl ? tmpl.title : routineId;
            logAction(state.currentUser, "Günlük Rutin", "Rutin", routineId, `${dateStr} tarihinde "${title}" ${!current ? 'Tamamlandı' : 'Beklemeye Alındı'}`);
            return state.dailyRoutinesDone[dateStr];
        },
        completeAllDailyRoutines: (dateStr) => {
            if (!state.dailyRoutinesDone[dateStr]) {
                state.dailyRoutinesDone[dateStr] = {};
            }
            state.dailyRoutineTemplates.forEach(t => {
                state.dailyRoutinesDone[dateStr][t.id] = true;
            });
            save();
            logAction(state.currentUser, "Toplu Tamamlama", "Rutin", dateStr, `${dateStr} tarihindeki 12 günlük muhasebe işi tek tıkla tamamlandı.`);
        },
        getDailyRoutineTemplates: () => state.dailyRoutineTemplates,

        // Invoices
        getInvoices: () => state.invoices.filter(i => !i.isDeleted),
        saveInvoice: (invoice) => {
            const isNew = !invoice.id;
            if (isNew) {
                invoice.id = "FAT_" + Date.now();
                invoice.isDeleted = false;
                state.invoices.unshift(invoice);
                logAction(state.currentUser, "Ekleme", "Fatura", invoice.id, `Yeni fatura eklendi: ${invoice.company} - ${invoice.totalAmount} ₺`);
            } else {
                const idx = state.invoices.findIndex(i => i.id === invoice.id);
                if (idx !== -1) {
                    state.invoices[idx] = Object.assign(state.invoices[idx], invoice);
                    logAction(state.currentUser, "Güncelleme", "Fatura", invoice.id, `Fatura güncellendi: ${invoice.invoiceNo} (${invoice.status})`);
                }
            }
            save();
            return invoice;
        },
        deleteInvoice: (id) => {
            const inv = state.invoices.find(i => i.id === id);
            if (inv) {
                inv.isDeleted = true;
                inv.deletedAt = new Date().toISOString();
                inv.deletedBy = state.currentUser ? state.currentUser.name : "Kullanıcı";
                save();
                logAction(state.currentUser, "Arşive Taşıma", "Fatura", id, `Fatura arşive taşındı: ${inv.company} (${inv.invoiceNo})`);
            }
        },

        // Payments
        getPayments: () => state.payments.filter(p => !p.isDeleted),
        savePayment: (payment) => {
            const isNew = !payment.id;
            if (isNew) {
                payment.id = "PAY_" + Date.now();
                payment.isDeleted = false;
                state.payments.unshift(payment);
                logAction(state.currentUser, "Ekleme", "Ödeme", payment.id, `Yeni ödeme eklendi: ${payment.entity} - ${payment.amount} ₺ (${payment.category})`);
            } else {
                const idx = state.payments.findIndex(p => p.id === payment.id);
                if (idx !== -1) {
                    state.payments[idx] = Object.assign(state.payments[idx], payment);
                    logAction(state.currentUser, "Güncelleme", "Ödeme", payment.id, `Ödeme güncellendi: ${payment.entity} (${payment.status})`);
                }
            }
            save();
            return payment;
        },
        deletePayment: (id) => {
            const p = state.payments.find(pay => pay.id === id);
            if (p) {
                p.isDeleted = true;
                p.deletedAt = new Date().toISOString();
                p.deletedBy = state.currentUser ? state.currentUser.name : "Kullanıcı";
                save();
                logAction(state.currentUser, "Arşive Taşıma", "Ödeme", id, `Ödeme arşive taşındı: ${p.entity}`);
            }
        },

        // Taxes
        getTaxes: () => state.taxes,
        saveTax: (tax) => {
            const idx = state.taxes.findIndex(t => t.id === tax.id);
            if (idx !== -1) {
                state.taxes[idx] = Object.assign(state.taxes[idx], tax);
                logAction(state.currentUser, "Güncelleme", "Vergi", tax.id, `Vergi/SGK güncellendi: ${tax.type} (${tax.period}) - ${tax.status}`);
            } else {
                tax.id = "TX_" + Date.now();
                state.taxes.push(tax);
                logAction(state.currentUser, "Ekleme", "Vergi", tax.id, `Yeni vergi takvimi kaydı: ${tax.type}`);
            }
            save();
        },

        // Advisor Visits
        getAdvisorVisits: () => state.advisorVisits,
        saveAdvisorVisit: (visit) => {
            const idx = state.advisorVisits.findIndex(v => v.id === visit.id);
            if (idx !== -1) {
                state.advisorVisits[idx] = Object.assign(state.advisorVisits[idx], visit);
                logAction(state.currentUser, "Güncelleme", "Mali Müşavir", visit.id, `Mali müşavir ziyareti güncellendi: ${visit.date}`);
            } else {
                visit.id = "ADV_" + Date.now();
                state.advisorVisits.push(visit);
                logAction(state.currentUser, "Ekleme", "Mali Müşavir", visit.id, `Yeni ziyaret planlandı: ${visit.date}`);
            }
            save();
        },

        // Payroll
        getPayrollData: () => state.payrollData,
        updatePayrollStep: (stepId, isDone, note) => {
            const step = state.payrollData.steps.find(s => s.id === stepId);
            if (step) {
                step.done = isDone;
                step.doneDate = isDone ? new Date().toISOString().slice(0, 10) : null;
                if (note !== undefined) step.note = note;
                save();
                logAction(state.currentUser, "Bordro Süreci", "Bordro", String(stepId), `Bordro Adım ${stepId} (${step.step}) -> ${isDone ? 'Tamamlandı' : 'Beklemede'}`);
            }
        },
        updatePayrollSettings: (employeeCount, estSalary, estAdvance, estSGK) => {
            state.payrollData.employeeCount = employeeCount;
            state.settings.employeeCount = employeeCount;
            if (estSalary) state.payrollData.estimatedTotalNetSalary = estSalary;
            if (estAdvance) state.payrollData.estimatedTotalAdvance = estAdvance;
            if (estSGK) state.payrollData.estimatedTotalSGK = estSGK;
            save();
            logAction(state.currentUser, "Bordro Ayarı", "Bordro", "CONF", `Personel sayısı: ${employeeCount} olarak güncellendi.`);
        },

        // Missing Info Module
        getMissingInfoItems: () => state.missingInfoItems,
        saveMissingInfoItem: (item) => {
            const idx = state.missingInfoItems.findIndex(m => m.id === item.id);
            if (idx !== -1) {
                state.missingInfoItems[idx] = Object.assign(state.missingInfoItems[idx], item);
                logAction(state.currentUser, "Eksik Bilgi", "Bilgi", item.id, `Eksik bilgi güncellendi: "${item.subject}" -> ${item.enteredValue}`);
            } else {
                item.id = "MI_" + Date.now();
                state.missingInfoItems.push(item);
                logAction(state.currentUser, "Eksik Bilgi", "Bilgi", item.id, `Yeni eksik bilgi kaydı: "${item.subject}"`);
            }
            save();
        },

        // Audit Logs
        getAuditLogs: () => state.auditLogs,

        // Soft Deleted Archive
        getArchivedItems: () => {
            const tasks = state.tasks.filter(t => t.isDeleted).map(t => ({ ...t, itemType: "Görev" }));
            const invoices = state.invoices.filter(i => i.isDeleted).map(i => ({ ...i, itemType: "Fatura", title: `${i.company} (${i.invoiceNo})` }));
            const payments = state.payments.filter(p => p.isDeleted).map(p => ({ ...p, itemType: "Ödeme", title: `${p.entity} (${p.amount} ₺)` }));
            return [...tasks, ...invoices, ...payments].sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
        },

        // Global Search across all entities
        globalSearch: (query) => {
            if (!query || query.trim().length < 2) return null;
            const q = query.toLowerCase().trim();
            const results = {
                tasks: state.tasks.filter(t => !t.isDeleted && (
                    (t.title && t.title.toLowerCase().includes(q)) ||
                    (t.description && t.description.toLowerCase().includes(q)) ||
                    (t.category && t.category.toLowerCase().includes(q)) ||
                    (t.note && t.note.toLowerCase().includes(q))
                )),
                invoices: state.invoices.filter(i => !i.isDeleted && (
                    (i.company && i.company.toLowerCase().includes(q)) ||
                    (i.invoiceNo && i.invoiceNo.toLowerCase().includes(q)) ||
                    (i.description && i.description.toLowerCase().includes(q)) ||
                    (i.taxNo && i.taxNo.includes(q)) ||
                    (i.note && i.note.toLowerCase().includes(q))
                )),
                payments: state.payments.filter(p => !p.isDeleted && (
                    (p.entity && p.entity.toLowerCase().includes(q)) ||
                    (p.description && p.description.toLowerCase().includes(q)) ||
                    (p.bank && p.bank.toLowerCase().includes(q)) ||
                    (p.receiptNo && p.receiptNo.toLowerCase().includes(q)) ||
                    (p.note && p.note.toLowerCase().includes(q))
                )),
                taxes: state.taxes.filter(t => (
                    (t.type && t.type.toLowerCase().includes(q)) ||
                    (t.period && t.period.toLowerCase().includes(q)) ||
                    (t.note && t.note.toLowerCase().includes(q))
                )),
                missingInfo: state.missingInfoItems.filter(m => (
                    (m.subject && m.subject.toLowerCase().includes(q)) ||
                    (m.currentNote && m.currentNote.toLowerCase().includes(q)) ||
                    (m.enteredValue && m.enteredValue.toLowerCase().includes(q))
                ))
            };
            return results;
        },

        // Full State Backup & Restore
        exportStateJSON: () => JSON.stringify(state, null, 2),
        importStateJSON: (jsonStr) => {
            try {
                const parsed = JSON.parse(jsonStr);
                state = Object.assign(state, parsed);
                save();
                logAction(state.currentUser, "Yedek Geri Yükleme", "Sistem", "SYS", "JSON yedeğinden tüm sistem geri yüklendi.");
                return true;
            } catch (e) {
                console.error("İçe aktarma hatası:", e);
                return false;
            }
        },
        resetDefaults: () => {
            loadInitialSeed();
            ensureRoutinesGeneratedForYear(2026);
            save();
        }
    };
})();
