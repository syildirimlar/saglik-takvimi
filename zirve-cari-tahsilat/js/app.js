/**
 * ZİRVE CARİ HESAP, FATURA, TAHSİLAT VE ÖDEME YÖNETİM SİSTEMİ
 * Cari Hareket Temelli Bakiye, FIFO Yaşlandırma, Zirve SQL & UBL-TR e-Fatura Entegrasyonu
 */

const App = window.App = {
    state: {
        settings: {
            ownFirmName: "SODSAN",
            ownFirmVkn: "",
            zirveXmlPath: "C:\\zirve",
            sqlServer: ".\\ZIRVESQL",
            sqlAuthType: "windows",
            sqlUser: "sa",
            sqlDatabase: "",
            lastSyncTime: null,
            rates: { USD: 36.50, EUR: 39.80 }
        },
        cariler: [],
        hareketler: [],
        faturalar: [],
        ceksenetler: [],
        cariConfigs: {}
    },

    activeEkstreCariId: null,
    computedCarilerMap: {},
    selectedAliciIds: new Set(),
    selectedSaticiIds: new Set(),

    vadeOptions: [
        { value: "CEK_10", label: "📑 Çek: Takip Eden Ayın 10'u (Önerilen)", days: 0, rule: "TAKIP_EDEN_10" },
        { value: "CEK_10_0", label: "📑 Çek: Takip Eden Ayın 10'u", days: 0, rule: "TAKIP_EDEN_10" },
        { value: "CEK_10_30", label: "📑 Çek: Takip Eden Ayın 10'u + 30G", days: 30, rule: "TAKIP_EDEN_10" },
        { value: "CEK_10_45", label: "📑 Çek: Takip Eden Ayın 10'u + 45G", days: 45, rule: "TAKIP_EDEN_10" },
        { value: "CEK_10_60", label: "📑 Çek: Takip Eden Ayın 10'u + 60G", days: 60, rule: "TAKIP_EDEN_10" },
        { value: "CEK_10_90", label: "📑 Çek: Takip Eden Ayın 10'u + 90G", days: 90, rule: "TAKIP_EDEN_10" },
        { value: "CEK_10_120", label: "📑 Çek: Takip Eden Ayın 10'u + 120G", days: 120, rule: "TAKIP_EDEN_10" },
        { value: "CEK_30", label: "📑 30 Günlük Çek (Fatura Tarihinden)", days: 30, rule: "STANDART" },
        { value: "CEK_60", label: "📑 60 Günlük Çek (Fatura Tarihinden)", days: 60, rule: "STANDART" },
        { value: "CEK_90", label: "📑 90 Günlük Çek (Fatura Tarihinden)", days: 90, rule: "STANDART" },
        { value: "CEK_120", label: "📑 120 Günlük Çek (Fatura Tarihinden)", days: 120, rule: "STANDART" },
        { value: "NAKIT_PESIN", label: "⚡ Peşin / Havale / EFT (Aynı Gün)", days: 0, rule: "STANDART" },
        { value: "NAKIT_5", label: "💵 Nakit: Faturadan Sonra 5 Gün", days: 5, rule: "STANDART" },
        { value: "NAKIT_15", label: "💵 Nakit: Faturadan İtibaren 15 Gün", days: 15, rule: "STANDART" },
        { value: "NAKIT_30", label: "💵 Nakit: Faturadan İtibaren 30 Gün", days: 30, rule: "STANDART" },
        { value: "NAKIT_45", label: "💵 Nakit: Faturadan İtibaren 45 Gün", days: 45, rule: "STANDART" },
        { value: "NAKIT_60", label: "💵 Nakit: Faturadan İtibaren 60 Gün", days: 60, rule: "STANDART" },
        { value: "NAKIT_90", label: "💵 Nakit: Faturadan İtibaren 90 Gün", days: 90, rule: "STANDART" },
        { value: "KREDI_KARTI", label: "💳 Kredi Kartı / DBS", days: 0, rule: "STANDART" },
        { value: "ACIK_HESAP", label: "⏳ Serbest Açık Hesap (30 Gün)", days: 30, rule: "STANDART" }
    ],

    async init() {
        this.setupDragAndDrop();
        await this.loadState();
        this.syncCariConfigs();
        this.applySettingsToUi();
        this.populateBulkVadeSelects();
        this.recalculateAndRenderAll();
        if (window.CloudBridge) {
            await window.CloudBridge.init();
        }
        this.startAutoSyncLoop();
    },

    normalizeKod(kod) {
        if (!kod) return "";
        return String(kod).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    },

    normalizeUnvan(unvan) {
        if (!unvan) return "";
        let s = String(unvan).trim();
        const trMap = {
            'ç':'c', 'Ç':'c',
            'ğ':'g', 'Ğ':'g',
            'ı':'i', 'I':'i', 'İ':'i', 'i':'i',
            'ö':'o', 'Ö':'o',
            'ş':'s', 'Ş':'s',
            'ü':'u', 'Ü':'u'
        };
        s = s.replace(/[çÇğĞıIİiöÖşŞüÜ]/g, m => trMap[m] || m);
        return s.replace(/[^a-zA-Z0-9]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
    },

    getCariConfig(kod, unvan) {
        if (!this.state.cariConfigs) this.state.cariConfigs = {};
        const configs = this.state.cariConfigs;

        // 1. Doğrudan exact kod ile ara
        if (kod && configs[kod]) return configs[kod];

        const normKod = this.normalizeKod(kod);
        if (normKod) {
            // 2. Normalleştirilmiş kod key'i ile ara
            if (configs[normKod]) return configs[normKod];
            // 3. Mevcut configlerin kodlarını normalleştirerek eşleştir
            for (const [k, cfg] of Object.entries(configs)) {
                if (k.startsWith("_")) continue;
                if (this.normalizeKod(k) === normKod || (cfg.kod && this.normalizeKod(cfg.kod) === normKod)) {
                    return cfg;
                }
            }
        }

        // 4. Ünvan ile ara (hem özel map hem de config nesneleri içinden)
        const normUnvan = this.normalizeUnvan(unvan);
        if (normUnvan) {
            if (this.state.cariConfigsByUnvan && this.state.cariConfigsByUnvan[normUnvan]) {
                return this.state.cariConfigsByUnvan[normUnvan];
            }
            for (const [k, cfg] of Object.entries(configs)) {
                if (k.startsWith("_")) continue;
                if (cfg.unvan && this.normalizeUnvan(cfg.unvan) === normUnvan) {
                    return cfg;
                }
            }
        }

        return null;
    },

    setCariConfig(c, configData = {}) {
        if (!this.state.cariConfigs) this.state.cariConfigs = {};
        if (!this.state.cariConfigsByUnvan) this.state.cariConfigsByUnvan = {};

        const kod = (c && c.kod) || configData.kod || "";
        const unvan = (c && c.unvan) || configData.unvan || "";
        const normKod = this.normalizeKod(kod);
        const normUnvan = this.normalizeUnvan(unvan);

        const currentSaved = this.getCariConfig(kod, unvan) || {};

        const merged = {
            kod: kod || currentSaved.kod || "",
            normKod: normKod || currentSaved.normKod || "",
            unvan: unvan || currentSaved.unvan || "",
            cariGrup: configData.cariGrup !== undefined ? configData.cariGrup : ((c && c.cariGrup) !== undefined ? c.cariGrup : (currentSaved.cariGrup || "")),
            cariTipi: configData.cariTipi !== undefined ? configData.cariTipi : ((c && c.cariTipi) || currentSaved.cariTipi || (kod.startsWith("320") ? "TEDARIKCI" : "MUSTERI")),
            odemeSekli: configData.odemeSekli !== undefined ? configData.odemeSekli : ((c && c.odemeSekli) !== undefined ? c.odemeSekli : (currentSaved.odemeSekli || "")),
            vadeGunu: configData.vadeGunu !== undefined ? configData.vadeGunu : ((c && c.vadeGunu) !== undefined ? c.vadeGunu : (currentSaved.vadeGunu !== undefined ? currentSaved.vadeGunu : 30)),
            vadeKurali: configData.vadeKurali !== undefined ? configData.vadeKurali : ((c && c.vadeKurali) !== undefined ? c.vadeKurali : (currentSaved.vadeKurali || "STANDART")),
            odemeSozuTarihi: configData.odemeSozuTarihi !== undefined ? configData.odemeSozuTarihi : ((c && c.odemeSozuTarihi) !== undefined ? c.odemeSozuTarihi : (currentSaved.odemeSozuTarihi || null)),
            odemeSozuTutar: configData.odemeSozuTutar !== undefined ? configData.odemeSozuTutar : ((c && c.odemeSozuTutar) !== undefined ? c.odemeSozuTutar : (currentSaved.odemeSozuTutar || null)),
            ozelNot: configData.ozelNot !== undefined ? configData.ozelNot : ((c && c.ozelNot) !== undefined ? c.ozelNot : (currentSaved.ozelNot || "")),
            telefon: configData.telefon !== undefined ? configData.telefon : ((c && c.telefon) !== undefined ? c.telefon : (currentSaved.telefon || "")),
            email: configData.email !== undefined ? configData.email : ((c && c.email) !== undefined ? c.email : (currentSaved.email || "")),
            yetkili: configData.yetkili !== undefined ? configData.yetkili : ((c && (c.yetkili || c.yetkiliKisi)) !== undefined ? (c.yetkili || c.yetkiliKisi) : (currentSaved.yetkili || "")),
            userConfigured: true,
            updatedAt: new Date().toISOString()
        };

        if (kod) this.state.cariConfigs[kod] = merged;
        if (normKod) this.state.cariConfigs[normKod] = merged;
        if (normUnvan) this.state.cariConfigsByUnvan[normUnvan] = merged;

        // Canlı cari nesnesine de anında yansıt
        if (c) {
            c.cariGrup = merged.cariGrup;
            c.cariTipi = merged.cariTipi;
            c.odemeSekli = merged.odemeSekli;
            c.vadeGunu = merged.vadeGunu;
            c.vadeKurali = merged.vadeKurali;
            c.odemeSozuTarihi = merged.odemeSozuTarihi;
            c.odemeSozuTutar = merged.odemeSozuTutar;
            c.ozelNot = merged.ozelNot;
            c.telefon = merged.telefon;
            c.email = merged.email;
            c.yetkili = merged.yetkili;
            c.userConfigured = true;
        }

        return merged;
    },

    applyCariConfig(c) {
        if (!c) return false;
        const saved = this.getCariConfig(c.kod, c.unvan);
        if (!saved) return false;

        if (saved.odemeSekli) c.odemeSekli = saved.odemeSekli;
        if (saved.vadeGunu !== undefined) c.vadeGunu = saved.vadeGunu;
        if (saved.vadeKurali) c.vadeKurali = saved.vadeKurali;
        if (saved.cariGrup) c.cariGrup = saved.cariGrup;
        if (saved.cariTipi) c.cariTipi = saved.cariTipi;
        if (saved.odemeSozuTarihi) c.odemeSozuTarihi = saved.odemeSozuTarihi;
        if (saved.odemeSozuTutar) c.odemeSozuTutar = saved.odemeSozuTutar;
        if (saved.ozelNot) c.ozelNot = saved.ozelNot;
        if (saved.telefon) c.telefon = saved.telefon;
        if (saved.email) c.email = saved.email;
        if (saved.yetkili) {
            c.yetkili = saved.yetkili;
            c.yetkiliKisi = saved.yetkili;
        }
        c.userConfigured = true;
        return true;
    },

    syncCariConfigs() {
        if (!this.state.cariConfigs) this.state.cariConfigs = {};
        if (!this.state.cariConfigsByUnvan) this.state.cariConfigsByUnvan = {};

        for (const c of (this.state.cariler || [])) {
            const hasApplied = this.applyCariConfig(c);
            if (!hasApplied && (c.userConfigured || (c.odemeSekli && c.odemeSekli !== "") || c.cariGrup || c.odemeSozuTarihi || c.ozelNot)) {
                this.setCariConfig(c);
            }
        }
    },

    populateBulkVadeSelects() {
        const optsHtml = `<option value="">-- Vade / Şart Seçiniz --</option>` +
            this.vadeOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join("");
        const aSel = document.getElementById("aliciBulkVade");
        const sSel = document.getElementById("saticiBulkVade");
        if (aSel) aSel.innerHTML = optsHtml;
        if (sSel) sSel.innerHTML = optsHtml;

        const ekstrePm = document.getElementById("ekstrePaymentMethod");
        if (ekstrePm) ekstrePm.innerHTML = this.vadeOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join("");
    },

    async startAutoSyncLoop() {
        // Eğer daha önce Zirve veritabanı seçildiyse açılışta ve her 5 dakikada bir arka planda otomatik güncelle
        const runSilentSync = async () => {
            const s = this.state.settings || {};
            if (!s.sqlDatabase) return;
            try {
                const res = await fetch("/api/sql/sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        server: s.sqlServer || ".\\ZIRVESQL",
                        authType: s.sqlAuthType || "windows",
                        user: s.sqlUser || "sa",
                        password: s.sqlPassword || "",
                        database: s.sqlDatabase
                    })
                });
                const data = await res.json();
                if (data && data.ok) {
                    const promiseMap = {};
                    for (const oldC of this.state.cariler) {
                        if (oldC.odemeSozuTarihi || oldC.ozelNot) {
                            promiseMap[oldC.kod] = {
                                odemeSozuTarihi: oldC.odemeSozuTarihi,
                                odemeSozuTutar: oldC.odemeSozuTutar,
                                ozelNot: oldC.ozelNot
                            };
                        }
                    }
                    for (const zc of (data.cariler || [])) {
                        const existing = this.state.cariler.find(c => c.kod === zc.kod || c.id === zc.id);
                        const savedNotes = promiseMap[zc.kod] || {};
                        if (existing) Object.assign(existing, zc, savedNotes);
                        else this.state.cariler.push({ ...zc, ...savedNotes });
                    }
                    this.state.hareketler = this.state.hareketler.filter(h => !String(h.id).startsWith("ZRV-H-"));
                    for (const zh of (data.hareketler || [])) {
                        this.state.hareketler.push(zh);
                    }
                    this.state.settings.lastSyncTime = new Date().toLocaleTimeString("tr-TR");
                    this.saveState();
                    this.recalculateAndRenderAll();
                    this.setServerBadge(true, `Canlı: ${s.sqlDatabase} (${this.state.settings.lastSyncTime})`);
                }
            } catch (e) {}
        };
        await runSilentSync();
        setInterval(runSilentSync, 5 * 60 * 1000);
    },

    async loadState() {
        // 1. Önce yerel sunucudan (/api/data) okumayı dene
        try {
            const res = await fetch("/api/data");
            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.cariler)) {
                    // Eski örnek/demo verisi varsa temizle
                    const hasDemo = data.cariler.some(c => c.id === "C-101" || (c.unvan && c.unvan.includes("ÖZKAN METAL")));
                    if (hasDemo) {
                        data.cariler = [];
                        data.hareketler = [];
                        data.faturalar = [];
                        data.ceksenetler = [];
                    }
                    // Zirve ekstre hareketlerinin para birimini TL olarak doğrula (çift kur çarpımını engelle)
                    if (Array.isArray(data.hareketler)) {
                        for (const h of data.hareketler) {
                            if (h.doviz && h.doviz !== "TRY" && (!h.kur || h.kur === 1)) {
                                h.orijinalDoviz = h.doviz;
                                h.doviz = "TRY";
                                h.kur = 1;
                            }
                        }
                    }
                    this.state = data;
                    if (!this.state.cariConfigs) this.state.cariConfigs = {};
                    if (!this.state.cariConfigsByUnvan) this.state.cariConfigsByUnvan = {};
                    this.setServerBadge(true, "Hazır");
                    return;
                }
            }
        } catch (e) {
            // Doğrudan index.html açıldıysa localStorage'a bak
        }

        // 2. LocalStorage kontrol et
        const localRaw = localStorage.getItem("zirve_cari_tahsilat_db_v1");
        if (localRaw) {
            try {
                const parsed = JSON.parse(localRaw);
                if (parsed && Array.isArray(parsed.cariler) && parsed.cariler.length > 0) {
                    // Eski örnek/demo verisi varsa temizle
                    const hasDemo = parsed.cariler.some(c => c.id === "C-101" || (c.unvan && c.unvan.includes("ÖZKAN METAL")));
                    if (hasDemo) {
                        parsed.cariler = [];
                        parsed.hareketler = [];
                        parsed.faturalar = [];
                        parsed.ceksenetler = [];
                        localStorage.setItem("zirve_cari_tahsilat_db_v1", JSON.stringify(parsed));
                    } else {
                        if (Array.isArray(parsed.hareketler)) {
                            for (const h of parsed.hareketler) {
                                if (h.doviz && h.doviz !== "TRY" && (!h.kur || h.kur === 1)) {
                                    h.orijinalDoviz = h.doviz;
                                    h.doviz = "TRY";
                                    h.kur = 1;
                                }
                            }
                        }
                        this.state = parsed;
                        if (!this.state.cariConfigs) this.state.cariConfigs = {};
                        if (!this.state.cariConfigsByUnvan) this.state.cariConfigsByUnvan = {};
                        return;
                    }
                }
            } catch (e) {}
        }

        // 3. Web / GitHub Pages ortamında depodaki hazır veritabanından (data/zirve_finans_db.json) yükle
        try {
            const resStatic = await fetch("./data/zirve_finans_db.json?v=" + Date.now());
            if (resStatic.ok) {
                const staticData = await resStatic.json();
                if (staticData && Array.isArray(staticData.cariler) && staticData.cariler.length > 0) {
                    this.state = staticData;
                    if (!this.state.cariConfigs) this.state.cariConfigs = {};
                    if (!this.state.cariConfigsByUnvan) this.state.cariConfigsByUnvan = {};
                    try { localStorage.setItem("zirve_cari_tahsilat_db_v1", JSON.stringify(this.state)); } catch(e) {}
                    this.setServerBadge(true, "Web/Bulut Hazır");
                    return;
                }
            }
        } catch (e) {}

        // 4. Sıfır kurulum: Temiz başla
        this.state.cariler = [];
        this.state.hareketler = [];
        this.state.faturalar = [];
        this.state.ceksenetler = [];
        if (!this.state.cariConfigs) this.state.cariConfigs = {};
        if (!this.state.cariConfigsByUnvan) this.state.cariConfigsByUnvan = {};
        this.state.initialized = true;
    },

    async clearAllData() {
        if (!confirm("Tüm cari hesaplar, hareketler ve faturalar sıfırlansın mı? Bu işlem geri alınamaz.")) return;
        this.state.cariler = [];
        this.state.hareketler = [];
        this.state.faturalar = [];
        this.state.ceksenetler = [];
        await this.saveState();
        this.recalculateAndRenderAll();
        alert("Tüm veriler temizlendi. Zirve'den yeni rapor yükleyebilirsiniz.");
    },

    async saveStateLocallyOnly() {
        this.state.initialized = true;
        try {
            localStorage.setItem("zirve_cari_tahsilat_db_v1", JSON.stringify(this.state));
        } catch (e) {}

        try {
            await fetch("/api/data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(this.state)
            });
        } catch (e) {}
    },

    async saveState() {
        await this.saveStateLocallyOnly();
        if (window.CloudBridge && (window.CloudBridge.roomId || window.CloudBridge.binId)) {
            window.CloudBridge.pushToCloud(false);
        }
    },

    setServerBadge(online, text) {
        const dot = document.getElementById("sqlStatusDot");
        const txt = document.getElementById("sqlStatusText");
        if (dot) dot.style.background = online ? "#10b981" : "#f59e0b";
        if (txt) txt.textContent = text;
    },

    applySettingsToUi() {
        const s = this.state.settings || {};
        if (s.rates) {
            const usdEl = document.getElementById("rateUSD");
            const eurEl = document.getElementById("rateEUR");
            if (usdEl) usdEl.value = (parseFloat(s.rates.USD) || 38.4520).toFixed(4);
            if (eurEl) eurEl.value = (parseFloat(s.rates.EUR) || 41.6815).toFixed(4);
        }
        const fn = document.getElementById("ownFirmName"); if (fn) fn.value = s.ownFirmName || "SODSAN";
        const vkn = document.getElementById("ownFirmVkn"); if (vkn) vkn.value = s.ownFirmVkn || "";
        const xp = document.getElementById("zirveXmlPath"); if (xp) xp.value = s.zirveXmlPath || "C:\\zirve";
        const srv = document.getElementById("sqlServerInput"); if (srv) srv.value = s.sqlServer || ".\\ZIRVESQL";
        const auth = document.getElementById("sqlAuthType"); if (auth) auth.value = s.sqlAuthType || "windows";
        const usr = document.getElementById("sqlUserInput"); if (usr) usr.value = s.sqlUser || "sa";
        const smCheck = document.getElementById("shiftMonthEndInvoicesCheck");
        if (smCheck) smCheck.checked = s.shiftMonthEndInvoices !== false;
        this.toggleSqlAuthInputs();
    },

    toggleShiftMonthEndInvoices(checked) {
        if (!this.state.settings) this.state.settings = {};
        this.state.settings.shiftMonthEndInvoices = checked;
        this.saveState();
        this.recalculateAndRenderAll();
        this.showToast(checked
            ? "✅ Ay sonu teamül kuralı aktif: Ayın son 2 günü kesilen faturalar bir sonraki ay başı kabul edilir."
            : "ℹ️ Ay sonu teamül kuralı kapatıldı: Faturalar doğrudan kesildiği gün baz alınarak hesaplanır.");
    },

    saveSettings() {
        this.state.settings.ownFirmName = document.getElementById("ownFirmName").value.trim();
        this.state.settings.ownFirmVkn = document.getElementById("ownFirmVkn").value.trim();
        this.state.settings.zirveXmlPath = document.getElementById("zirveXmlPath").value.trim();
        this.saveState();
    },

    updateRates() {
        const usdVal = parseFloat(document.getElementById("rateUSD").value) || 38.4520;
        const eurVal = parseFloat(document.getElementById("rateEUR").value) || 41.6815;
        this.state.settings.rates = { USD: usdVal, EUR: eurVal };
        this.saveState();
        this.recalculateAndRenderAll();
    },

    async fetchLiveRates() {
        const btn = document.getElementById("btnLiveRate");
        if (btn) btn.textContent = "⏳ Alınıyor...";
        try {
            const resp = await fetch("https://open.er-api.com/v6/latest/USD");
            if (!resp.ok) throw new Error("Kur servisi yanıt vermedi (" + resp.status + ")");
            const data = await resp.json();
            if (data && data.rates && data.rates.TRY) {
                const usdNum = parseFloat(data.rates.TRY);
                const eurNum = parseFloat(data.rates.TRY / data.rates.EUR);
                const usdStr = usdNum.toFixed(4);
                const eurStr = eurNum.toFixed(4);
                
                const usdInput = document.getElementById("rateUSD");
                const eurInput = document.getElementById("rateEUR");
                if (usdInput) usdInput.value = usdStr;
                if (eurInput) eurInput.value = eurStr;

                this.state.settings.rates = { USD: parseFloat(usdStr), EUR: parseFloat(eurStr) };
                await this.saveState();
                this.recalculateAndRenderAll();
                
                alert(`✅ Canlı Döviz Kurları Başarıyla Alındı!\n\n• USD / TRY: ${usdStr} ₺\n• EUR / TRY: ${eurStr} ₺\n\nTüm dövizli cariler, faturalar ve bakiyeler güncel kurla (4 basamak hassasiyetle) anında hesaplandı.`);
            } else {
                throw new Error("Kur verisi çözümlenemedi.");
            }
        } catch (e) {
            console.warn("Canlı kur alma hatası:", e);
            alert("⚠️ Canlı kur servisine ulaşılamadı (" + e.message + "). Kurları kutulardan elle yazıp 'Enter'a basabilirsiniz.");
        } finally {
            if (btn) btn.textContent = "🔄 Canlı Kur";
        }
    },

    getTlEquivalent(amount, currency, customRate) {
        const val = parseFloat(amount) || 0;
        const cur = (currency || "TRY").toUpperCase();
        // Zirve Cari Ekstresi raporundaki Borç ve Alacak tutarları resmi yasal defter TL tutarıdır.
        // Bu nedenle TL cinsinden ekstre kayıtlarında kurlarla tekrar çarpma yapılmaz.
        if (cur === "TRY" || cur === "TRL" || cur === "TL" || !cur) return val;
        // Eğer kullanıcı manuel döviz işlemi girmiş ve özel kur belirtmişse
        if (customRate && customRate > 1) return val * customRate;
        // Ekstre kayıtlarında kur tanımsız veya 1 ise, tutar zaten TL defter tutarıdır
        return val;
    },

    formatMoney(amount, currency = "TRY") {
        const val = parseFloat(amount) || 0;
        const cur = (currency || "TRY").toUpperCase();
        const sym = cur === "USD" ? "$" : cur === "EUR" ? "€" : "₺";
        return val.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + sym;
    },

    formatDisplayDate(val) {
        if (!val) return "-";
        if (typeof val === "string" && val.includes("-")) {
            const parts = val.split("-");
            if (parts.length === 3 && parts[0].length === 4) {
                return `${parts[2]}.${parts[1]}.${parts[0]}`;
            }
        }
        return val;
    },

    daysDiffFromToday(dateStr) {
        if (!dateStr) return 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let s = String(dateStr).trim();
        const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
        if (m) s = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        else if (s.length > 10) s = s.slice(0, 10);

        const target = new Date(s + "T00:00:00");
        if (isNaN(target.getTime())) return 0;
        target.setHours(0, 0, 0, 0);
        // Pozitifse vade geçmiş (gecikme gün sayısı), negatifse vadeye kalan gün
        return Math.round((today - target) / (1000 * 60 * 60 * 24));
    },

    getVadeDurumu(vadeTarihi) {
        if (!vadeTarihi) {
            return {
                diff: 0,
                days: 0,
                isOverdue: false,
                isToday: false,
                text: "-",
                badgeClass: "badge-neutral",
                html: `<span style="color:var(--text-muted); font-size:11.5px;">-</span>`
            };
        }
        const diffDays = this.daysDiffFromToday(vadeTarihi);

        if (diffDays > 0) {
            return {
                diff: diffDays,
                days: diffDays,
                isOverdue: true,
                isToday: false,
                vadeTarihi,
                text: `${diffDays} gün gecikti`,
                badgeClass: "badge-warn",
                html: `<span class="badge badge-warn" style="font-weight:600; white-space:nowrap;">⚠️ ${diffDays} gün gecikti</span>`
            };
        } else if (diffDays < 0) {
            const rem = Math.abs(diffDays);
            return {
                diff: diffDays,
                days: rem,
                isOverdue: false,
                isToday: false,
                vadeTarihi,
                text: `${rem} gün kaldı`,
                badgeClass: "badge-neutral",
                html: `<span class="badge badge-neutral" style="color:#38bdf8; font-weight:600; white-space:nowrap;">⏳ ${rem} gün kaldı</span>`
            };
        } else {
            return {
                diff: 0,
                days: 0,
                isOverdue: false,
                isToday: true,
                vadeTarihi,
                text: "Bugün vadeli",
                badgeClass: "badge-warn",
                html: `<span class="badge badge-warn" style="background:#f59e0b; color:#fff; font-weight:600; white-space:nowrap;">🔔 Bugün vadeli</span>`
            };
        }
    },

    /**
     * CARİ HAREKET TEMELLİ HESAPLAMA VE FIFO YAŞLANDIRMA MOTORU
     * Seçilen ödeme opsiyonunu ve vade gününü doğrudan FATURA TARİHİ üzerinden hesaplar:
     * - Ayın 10'u çek kuralı ise: Faturayı takip eden ayın 10'una ek gün ekler
     * - Standart vade ise: Fatura tarihine doğrudan vade günü (30, 45, 60G vb.) ekler
     */
    getEffectiveVadeTarihi(islemTarihi, cari) {
        if (!islemTarihi) return islemTarihi;
        let isoDate = islemTarihi;
        if (typeof isoDate !== "string") isoDate = String(isoDate);
        isoDate = isoDate.trim();

        // Eğer GG.AA.YYYY veya GG/AA/YYYY ise YYYY-MM-DD'ye çevir
        const mDMY = isoDate.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
        if (mDMY) {
            isoDate = `${mDMY[3]}-${mDMY[2].padStart(2, '0')}-${mDMY[1].padStart(2, '0')}`;
        } else if (isoDate.length > 10) {
            isoDate = isoDate.slice(0, 10);
        }

        // --- AYIN SON 2 GÜNÜ TEAMÜL KURALI ---
        // Ayın son 2 gününde kesilen faturalar ticari teamül gereği
        // bir sonraki ayın 1'inde kesilmiş / mal teslim alınmış kabul edilir.
        const shiftMonthEnd = this.state.settings?.shiftMonthEndInvoices !== false; // varsayılan aktif
        if (shiftMonthEnd) {
            const p = isoDate.split("-").map(Number);
            if (p.length === 3 && p[0] > 1900) {
                let y = p[0];
                let m = p[1]; // 1-12
                let d = p[2]; // 1-31
                // O ayın kaç gün çektiğini bul (28, 29, 30, 31)
                const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
                if (d >= daysInMonth - 1) {
                    // Ayın son 2 günü (Örn: 29-30 Eylül veya 30-31 Ekim)
                    m += 1;
                    if (m > 12) {
                        m = 1;
                        y += 1;
                    }
                    d = 1;
                    isoDate = `${y}-${String(m).padStart(2, '0')}-01`;
                }
            }
        }

        const optVal = (cari && cari.odemeSekli) || "CEK_10";
        const opt = this.vadeOptions.find(o => o.value === optVal);

        const rule = (opt && opt.rule) || (cari && cari.vadeKurali) || (optVal.includes("10") ? "TAKIP_EDEN_10" : "STANDART");
        const termDays = opt ? opt.days : ((cari && parseInt(cari.vadeGunu, 10)) !== undefined && !isNaN(parseInt(cari.vadeGunu, 10)) ? parseInt(cari.vadeGunu, 10) : 0);

        // 1. KURAL: Çalışılan ayı takip eden ayın 10'u + Ek Günler (Örn: Çek: Takip Eden Ayın 10'u)
        if (rule === "TAKIP_EDEN_10" || optVal.startsWith("CEK_10") || optVal.includes("TAKIP_EDEN")) {
            const parts = isoDate.split("-").map(Number);
            if (parts.length === 3 && parts[0] > 1900) {
                let y = parts[0];
                let m = parts[1]; // 1-12
                // Faturanın kesildiği ayı takip eden ay
                m += 1;
                if (m > 12) {
                    m = 1;
                    y += 1;
                }
                // Takip eden ayın 10'u
                const base10 = new Date(Date.UTC(y, m - 1, 10));

                let extraDays = 0;
                if (opt) {
                    extraDays = opt.days;
                } else if (optVal === "CEK_10" || optVal === "CEK_10_0") {
                    extraDays = 0;
                } else if (optVal.includes("120") || termDays === 120) extraDays = 120;
                else if (optVal.includes("90") || termDays === 90) extraDays = 90;
                else if (optVal.includes("60") || termDays === 60) extraDays = 60;
                else if (optVal.includes("45") || termDays === 45) extraDays = 45;
                else if (optVal.includes("30") || termDays === 30) extraDays = 30;
                else if (termDays > 0) extraDays = termDays;

                if (extraDays > 0) {
                    base10.setUTCDate(base10.getUTCDate() + extraDays);
                }
                return base10.toISOString().slice(0, 10);
            }
        }

        // 2. KURAL: Fatura tarihinden itibaren direkt gün ekleme (Örn: 30, 45, 60, 90 günlük nakit / çek)
        if (termDays > 0) {
            const d = new Date(isoDate + "T00:00:00Z");
            if (!isNaN(d.getTime())) {
                d.setUTCDate(d.getUTCDate() + termDays);
                return d.toISOString().slice(0, 10);
            }
        }

        // 0 gün veya peşin ise doğrudan fatura tarihi vadedir
        return isoDate;
    },

    computeAll() {
        const map = {};
        for (const c of this.state.cariler) {
            map[c.id] = {
                ...c,
                toplamBorc: 0,
                toplamAlacak: 0,
                netBakiye: 0, // >0 ise Müşteri bize borçlu (Alacaklıyız), <0 ise Biz tedarikçiye borçluyuz (Borçluyuz)
                bakiyeYonu: "KAPALI", // "ALACAKLIYIZ", "BORCLUYUZ", "KAPALI"
                hareketListesi: [],
                acikKalemler: [],
                enEskiAcikVade: null,
                maxGecikmeGunu: 0,
                aging: {
                    overdue60Plus: 0,
                    overdue31_60: 0,
                    overdue1_30: 0,
                    upcoming0_30: 0,
                    upcoming31Plus: 0
                }
            };
        }

        // Hareketleri ilgili carilere bağla (Eğer cari kart yoksa otomatik oluştur)
        const sortedHar = [...this.state.hareketler].sort((a, b) => (a.tarih || "").localeCompare(b.tarih || ""));

        for (const h of sortedHar) {
            let cariId = h.cariId;
            if (!cariId || !map[cariId]) {
                const hKod = String(h.cariKod || '').trim().toUpperCase();
                const hRef = String(h.cariRef || '').trim().toUpperCase();

                const found = this.state.cariler.find(c => {
                    const cKod = String(c.kod || '').trim().toUpperCase();
                    const cRef = String(c.ref || '').trim().toUpperCase();
                    return (hKod && cKod === hKod) ||
                           (hRef && cRef === hRef) ||
                           (hKod && cRef && cRef === hKod) ||
                           (hRef && cKod && cKod === hRef) ||
                           (h.cariUnvan && c.unvan && c.unvan.trim().toUpperCase() === h.cariUnvan.trim().toUpperCase());
                });

                if (found) {
                    cariId = found.id;
                    h.cariId = cariId;
                    if (!h.cariUnvan || h.cariUnvan === h.cariKod) {
                        h.cariUnvan = found.unvan;
                    }
                } else {
                    const newId = "C-" + (h.cariKod || h.cariRef || Math.random().toString(36).substring(2, 8));
                    const newCari = {
                        id: newId,
                        kod: h.cariKod || h.cariRef || newId,
                        ref: h.cariRef || "",
                        unvan: h.cariUnvan || h.cariKod || "Bilinmeyen Cari",
                        vkn: "",
                        telefon: "",
                        vadeGunu: 30,
                        doviz: h.doviz || "TRY",
                        kaynak: h.kaynak || "Otomatik"
                    };
                    this.state.cariler.push(newCari);
                    map[newId] = {
                        ...newCari,
                        toplamBorc: 0,
                        toplamAlacak: 0,
                        netBakiye: 0,
                        bakiyeYonu: "KAPALI",
                        hareketListesi: [],
                        acikKalemler: [],
                        enEskiAcikVade: null,
                        maxGecikmeGunu: 0,
                        aging: { overdue60Plus: 0, overdue31_60: 0, overdue1_30: 0, upcoming0_30: 0, upcoming31Plus: 0 }
                    };
                    cariId = newId;
                    h.cariId = newId;
                }
            }

            const cObj = map[cariId];
            const borcTl = this.getTlEquivalent(h.borc || 0, h.doviz, h.kur);
            const alacakTl = this.getTlEquivalent(h.alacak || 0, h.doviz, h.kur);

            cObj.toplamBorc += borcTl;
            cObj.toplamAlacak += alacakTl;
            cObj.hareketListesi.push({
                ...h,
                borcTl,
                alacakTl
            });
        }

        // Her cari için FIFO açık kalem ve yaşlandırma hesapla
        const faturaDurumMap = {}; // evrakNo -> { odenen, kalan, durum }

        for (const cariId of Object.keys(map)) {
            const c = map[cariId];
            c.toplamBorc = Math.round(c.toplamBorc * 100) / 100;
            c.toplamAlacak = Math.round(c.toplamAlacak * 100) / 100;
            c.netBakiye = Math.round((c.toplamBorc - c.toplamAlacak) * 100) / 100;

            if (c.netBakiye > 0.05) {
                c.bakiyeYonu = "ALACAKLIYIZ"; // Müşteri bize borçlu
                // FIFO: Tüm alacak hareketleri (Tahsilat/Havale/Çek) en eski borç hareketlerini (Devir/Satış Faturası) kapatır
                let kalanTahsilatHavuzu = c.toplamAlacak;
                for (const h of c.hareketListesi) {
                    if (h.borcTl > 0) {
                        const kapanan = Math.min(h.borcTl, kalanTahsilatHavuzu);
                        const acikKalan = Math.round((h.borcTl - kapanan) * 100) / 100;
                        kalanTahsilatHavuzu = Math.max(0, Math.round((kalanTahsilatHavuzu - kapanan) * 100) / 100);

                        if (h.evrakNo) {
                            faturaDurumMap[h.evrakNo] = {
                                kapanan,
                                kalan: acikKalan,
                                durum: acikKalan <= 0.05 ? "KAPALI" : (kapanan > 0.05 ? "KISMI" : "ACIK")
                            };
                        }

                        if (acikKalan > 0.05) {
                            const rawVade = h.vadeTarihi || h.tarih;
                            const vade = (c.odemeSekli || c.vadeGunu || c.vadeKurali)
                                ? this.getEffectiveVadeTarihi(h.tarih, c)
                                : rawVade;
                            const gecikme = this.daysDiffFromToday(vade);
                            c.acikKalemler.push({ ...h, acikKalan, vade, gecikme });
                            if (!c.enEskiAcikVade || vade < c.enEskiAcikVade) c.enEskiAcikVade = vade;
                            if (gecikme > c.maxGecikmeGunu) c.maxGecikmeGunu = gecikme;
                            this.addToAgingBuckets(c.aging, acikKalan, gecikme);
                        }
                    }
                }
            } else if (c.netBakiye < -0.05) {
                c.bakiyeYonu = "BORCLUYUZ"; // Biz tedarikçiye borçluyuz
                // FIFO: Tüm borç hareketlerimiz (Yaptığımız Ödemeler/EFT/Verilen Çek) en eski alacak hareketlerini (Alış Faturası/Devir) kapatır
                let kalanOdemeHavuzu = c.toplamBorc;
                for (const h of c.hareketListesi) {
                    if (h.alacakTl > 0) {
                        const kapanan = Math.min(h.alacakTl, kalanOdemeHavuzu);
                        const acikKalan = Math.round((h.alacakTl - kapanan) * 100) / 100;
                        kalanOdemeHavuzu = Math.max(0, Math.round((kalanOdemeHavuzu - kapanan) * 100) / 100);

                        if (h.evrakNo) {
                            faturaDurumMap[h.evrakNo] = {
                                kapanan,
                                kalan: acikKalan,
                                durum: acikKalan <= 0.05 ? "KAPALI" : (kapanan > 0.05 ? "KISMI" : "ACIK")
                            };
                        }

                        if (acikKalan > 0.05) {
                            const rawVade = h.vadeTarihi || h.tarih;
                            const vade = (c.odemeSekli || c.vadeGunu || c.vadeKurali)
                                ? this.getEffectiveVadeTarihi(h.tarih, c)
                                : rawVade;
                            const gecikme = this.daysDiffFromToday(vade);
                            c.acikKalemler.push({ ...h, acikKalan, vade, gecikme });
                            if (!c.enEskiAcikVade || vade < c.enEskiAcikVade) c.enEskiAcikVade = vade;
                            if (gecikme > c.maxGecikmeGunu) c.maxGecikmeGunu = gecikme;
                            this.addToAgingBuckets(c.aging, acikKalan, gecikme);
                        }
                    }
                }
            } else {
                c.bakiyeYonu = "KAPALI";
                for (const h of c.hareketListesi) {
                    if (h.evrakNo) {
                        const tutar = Math.max(h.borcTl, h.alacakTl);
                        faturaDurumMap[h.evrakNo] = { kapanan: tutar, kalan: 0, durum: "KAPALI" };
                    }
                }
            }

            // Cari hesap türü: ALICI (Müşteri) veya SATICI (Tedarikçi)
            if (c.kod.startsWith("120")) {
                c.hesapTuru = "ALICI";
            } else if (c.kod.startsWith("320")) {
                c.hesapTuru = "SATICI";
            } else if (c.bakiyeYonu === "ALACAKLIYIZ") {
                c.hesapTuru = "ALICI";
            } else if (c.bakiyeYonu === "BORCLUYUZ") {
                c.hesapTuru = "SATICI";
            } else {
                c.hesapTuru = c.netBakiye >= 0 ? "ALICI" : "SATICI";
            }
        }

        this.computedCarilerMap = map;
        this.faturaDurumMap = faturaDurumMap;
    },

    addToAgingBuckets(agingObj, amount, gecikmeGunu) {
        if (gecikmeGunu > 60) agingObj.overdue60Plus += amount;
        else if (gecikmeGunu > 30) agingObj.overdue31_60 += amount;
        else if (gecikmeGunu >= 1) agingObj.overdue1_30 += amount;
        else if (gecikmeGunu >= -30) agingObj.upcoming0_30 += amount;
        else agingObj.upcoming31Plus += amount;
    },

    recalculateAndRenderAll() {
        this.computeAll();

        const carilerList = Object.values(this.computedCarilerMap);
        const alicilarCount = carilerList.filter(c => c.hesapTuru === "ALICI").length;
        const saticilarCount = carilerList.filter(c => c.hesapTuru === "SATICI").length;

        const elA = document.getElementById("cntAlicilar"); if (elA) elA.textContent = alicilarCount;
        const elS = document.getElementById("cntSaticilar"); if (elS) elS.textContent = saticilarCount;
        const elC = document.getElementById("cntCariler"); if (elC) elC.textContent = this.state.cariler.length;
        const elH = document.getElementById("cntHareketler"); if (elH) elH.textContent = this.state.hareketler.length;
        const elF = document.getElementById("cntFaturalar"); if (elF) elF.textContent = this.state.faturalar.length;
        const elCS = document.getElementById("cntCekSenet"); if (elCS) elCS.textContent = this.state.ceksenetler.length;

        this.renderActiveReportBar();
        this.renderDashboard();
        this.renderAlicilar();
        this.renderSaticilar();
        this.renderCariler();
        this.renderHatirlatici();
        this.renderHareketler();
        this.renderFaturalar();
        this.renderYaslandirmaAndCalendar();
        this.renderCekSenet();
    },

    renderActiveReportBar() {
        const banner = document.getElementById("activeReportBanner");
        if (!banner) return;
        const rep = (this.state.settings && this.state.settings.activeReport) || null;
        if (rep && (rep.fileName || rep.carilerCount > 0)) {
            banner.style.display = "flex";
            const nameEl = document.getElementById("activeReportName");
            const detEl = document.getElementById("activeReportDetails");
            if (nameEl) nameEl.textContent = `📄 ${rep.fileName || "Zirve Raporu"}`;
            if (detEl) {
                detEl.textContent = `• Yüklenme: ${rep.uploadTime || "-"} • ${this.state.cariler.length} Cari Hesap • ${this.state.hareketler.length} Hareket • ${this.state.faturalar.length} Fatura`;
            }
        } else if (this.state.cariler.length > 0) {
            banner.style.display = "flex";
            const nameEl = document.getElementById("activeReportName");
            const detEl = document.getElementById("activeReportDetails");
            if (nameEl) nameEl.textContent = "📄 Kayıtlı Zirve Raporu";
            if (detEl) {
                detEl.textContent = `• ${this.state.cariler.length} Cari Hesap • ${this.state.hareketler.length} Hareket • ${this.state.faturalar.length} Fatura`;
            }
        } else {
            banner.style.display = "none";
        }
    },

    switchTab(tabName) {
        document.querySelectorAll(".nav-tab").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.tab === tabName);
        });
        document.querySelectorAll(".tab-panel").forEach(panel => {
            panel.classList.toggle("active", panel.id === "tab-" + tabName);
        });
    },

    filterCarilerByRole(role) {
        document.getElementById("cariFilterStatus").value = role;
        this.switchTab("cariler");
        this.renderCariler();
    },

    // ================= 1. DASHBOARD RENDER =================
    renderDashboard() {
        const cariler = Object.values(this.computedCarilerMap);
        let topAlacak = 0;
        let topBorc = 0;
        let gecikenAlacak = 0;
        let gecikenBorc = 0;
        let alacakliCariSayisi = 0;
        let borcluCariSayisi = 0;

        for (const c of cariler) {
            if (c.bakiyeYonu === "ALACAKLIYIZ") {
                topAlacak += c.netBakiye;
                alacakliCariSayisi++;
                gecikenAlacak += (c.aging.overdue1_30 + c.aging.overdue31_60 + c.aging.overdue60Plus);
            } else if (c.bakiyeYonu === "BORCLUYUZ") {
                const absBorc = Math.abs(c.netBakiye);
                topBorc += absBorc;
                borcluCariSayisi++;
                gecikenBorc += (c.aging.overdue1_30 + c.aging.overdue31_60 + c.aging.overdue60Plus);
            }
        }

        const netPozisyon = topAlacak - topBorc;
        const portfoyCek = this.state.ceksenetler
            .filter(x => x.yon === "ALINAN" && x.durum === "PORTFOYDE")
            .reduce((s, x) => s + (parseFloat(x.tutar) || 0), 0);
        const odenecekCek = this.state.ceksenetler
            .filter(x => x.yon === "VERILEN" && x.durum === "ODENECEK")
            .reduce((s, x) => s + (parseFloat(x.tutar) || 0), 0);

        const dashKpiEl = document.getElementById("dashboardKpis");
        if (dashKpiEl) {
            dashKpiEl.innerHTML = `
            <div class="kpi-card alacak">
                <div class="kpi-label">Toplam Cari Alacak</div>
                <div class="kpi-value text-alacak">${this.formatMoney(topAlacak)}</div>
                <div class="kpi-sub">
                    <span>${alacakliCariSayisi} Borçlu Müşteri Carisi</span>
                    <span>Geciken: ${this.formatMoney(gecikenAlacak)}</span>
                </div>
            </div>
            <div class="kpi-card borc">
                <div class="kpi-label">Toplam Cari Borç</div>
                <div class="kpi-value text-borc">${this.formatMoney(topBorc)}</div>
                <div class="kpi-sub">
                    <span>${borcluCariSayisi} Alacaklı Tedarikçi Carisi</span>
                    <span>Geciken: ${this.formatMoney(gecikenBorc)}</span>
                </div>
            </div>
            <div class="kpi-card net">
                <div class="kpi-label">Net Finansal Pozisyon</div>
                <div class="kpi-value ${netPozisyon >= 0 ? 'text-alacak' : 'text-borc'}">
                    ${netPozisyon >= 0 ? '+' : ''}${this.formatMoney(netPozisyon)}
                </div>
                <div class="kpi-sub">
                    <span>Alacak - Borç Farkı</span>
                    <span>${netPozisyon >= 0 ? 'Net Alacaklıyız' : 'Net Borçluyuz'}</span>
                </div>
            </div>
            <div class="kpi-card geciken">
                <div class="kpi-label">Vadesi Geçen Alacaklar</div>
                <div class="kpi-value text-warn">${this.formatMoney(gecikenAlacak)}</div>
                <div class="kpi-sub">
                    <span>FIFO Yaşlandırma</span>
                    <span>Vadesi Geçen Borç: ${this.formatMoney(gecikenBorc)}</span>
                </div>
            </div>
            <div class="kpi-card cek">
                <div class="kpi-label">Portföydeki Çek / Senet</div>
                <div class="kpi-value" style="color:#c084fc;">${this.formatMoney(portfoyCek)}</div>
                <div class="kpi-sub">
                    <span>Alınan Portföy</span>
                    <span>Verilen Çek: ${this.formatMoney(odenecekCek)}</span>
                </div>
            </div>
        `;
        }

        // En yüksek alacaklı olduğumuz 6 cari
        const alacaklilar = cariler
            .filter(c => c.bakiyeYonu === "ALACAKLIYIZ")
            .sort((a, b) => b.netBakiye - a.netBakiye)
            .slice(0, 6);

        const dashTopAlacakEl = document.getElementById("dashTopAlacakBody");
        if (dashTopAlacakEl) {
            dashTopAlacakEl.innerHTML = alacaklilar.map(c => `
            <tr>
                <td>
                    <strong><a href="javascript:void(0)" onclick="App.openCariEkstre('${c.id}')" style="color:#60a5fa; text-decoration:none;">${c.unvan}</a></strong>
                    <div style="font-size:11px; color:var(--text-muted);">${c.kod}</div>
                </td>
                <td>
                    ${c.enEskiAcikVade
                        ? this.getVadeDurumu(c.enEskiAcikVade).html
                        : `<span class="badge badge-neutral">Vadesinde</span>`}
                </td>
                <td class="num text-alacak">${this.formatMoney(c.netBakiye)}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="App.openCariEkstre('${c.id}')">Ekstre</button>
                    <button class="btn btn-success btn-sm" onclick="App.openQuickTransactionModal('TAHSILAT', '${c.id}')">Tahsilat</button>
                </td>
            </tr>
        `).join("") || `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">Açık alacak bakiyesi yok</td></tr>`;
        }

        // En yüksek borçlu olduğumuz 6 cari
        const borclular = cariler
            .filter(c => c.bakiyeYonu === "BORCLUYUZ")
            .sort((a, b) => a.netBakiye - b.netBakiye)
            .slice(0, 6);

        const dashTopBorcEl = document.getElementById("dashTopBorcBody");
        if (dashTopBorcEl) {
            dashTopBorcEl.innerHTML = borclular.map(c => `
            <tr>
                <td>
                    <strong><a href="javascript:void(0)" onclick="App.openCariEkstre('${c.id}')" style="color:#60a5fa; text-decoration:none;">${c.unvan}</a></strong>
                    <div style="font-size:11px; color:var(--text-muted);">${c.kod}</div>
                </td>
                <td>
                    ${c.enEskiAcikVade
                        ? this.getVadeDurumu(c.enEskiAcikVade).html
                        : `<span class="badge badge-neutral">Vadesinde</span>`}
                </td>
                <td class="num text-borc">${this.formatMoney(Math.abs(c.netBakiye))}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="App.openCariEkstre('${c.id}')">Ekstre</button>
                    <button class="btn btn-danger btn-sm" onclick="App.openQuickTransactionModal('ODEME', '${c.id}')">Öde</button>
                </td>
            </tr>
        `).join("") || `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">Açık borç bakiyesi yok</td></tr>`;
        }

        // Ajanda
        const agendaItems = this.buildCashflowItems().slice(0, 7);
        const dashAgendaEl = document.getElementById("dashAgendaBody");
        if (dashAgendaEl) {
            dashAgendaEl.innerHTML = agendaItems.map(item => `
            <tr>
                <td><strong>${item.tarih}</strong></td>
                <td><span class="badge ${item.yon === 'GIRIS' ? 'badge-alacak' : 'badge-borc'}">${item.turLabel}</span></td>
                <td>${item.cariUnvan} <span style="color:var(--text-muted); font-size:11.5px;">(${item.aciklama})</span></td>
                <td class="num ${item.yon === 'GIRIS' ? 'text-alacak' : 'text-borc'}">${this.formatMoney(item.tutar)}</td>
                <td>${item.gunDiff > 0 ? `<span class="badge badge-warn">${item.gunDiff}g gecikti</span>` : `<span class="badge badge-neutral">${Math.abs(item.gunDiff)}g kaldı</span>`}</td>
            </tr>
        `).join("") || `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Planlanan vade kaydı yok</td></tr>`;
        }

        // Son hareketler
        const recentHar = [...this.state.hareketler]
            .sort((a, b) => (b.tarih || "").localeCompare(a.tarih || ""))
            .slice(0, 7);

        const dashRecentHarEl = document.getElementById("dashRecentHarBody");
        if (dashRecentHarEl) {
            dashRecentHarEl.innerHTML = recentHar.map(h => {
                const c = this.computedCarilerMap[h.cariId] || { unvan: h.cariUnvan || h.cariKod };
                return `
                <tr>
                    <td>${h.tarih}</td>
                    <td><strong>${c.unvan}</strong></td>
                    <td><span class="badge badge-neutral">${this.getHarTypeLabel(h.islemTuru)}</span></td>
                    <td class="num ${h.borc > 0 ? 'text-alacak' : ''}">${h.borc > 0 ? this.formatMoney(h.borc, h.doviz) : '-'}</td>
                    <td class="num ${h.alacak > 0 ? 'text-borc' : ''}">${h.alacak > 0 ? this.formatMoney(h.alacak, h.doviz) : '-'}</td>
                </tr>
            `;
            }).join("") || `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Henüz cari hareket kaydı yok</td></tr>`;
        }
    },

    // ================= ALICILAR (MÜŞTERİLER - 120 GRUBU) RENDER =================
    renderAlicilar() {
        const q = (document.getElementById("aliciSearch")?.value || "").toLowerCase().trim();
        const grupFilter = document.getElementById("aliciFilterGrup")?.value || "ALL";
        const odemeFilter = document.getElementById("aliciFilterOdeme")?.value || "ALL";
        const statusFilter = document.getElementById("aliciFilterStatus")?.value || "ALL";
        const dovizFilter = document.getElementById("aliciFilterDoviz")?.value || "ALL";

        let list = Object.values(this.computedCarilerMap).filter(c => c.hesapTuru === "ALICI");

        // Grup filtresini dinamik doldur
        const allGroups = new Set();
        Object.values(this.computedCarilerMap).forEach(c => { if (c.cariGrup) allGroups.add(c.cariGrup); });
        const grupSelect = document.getElementById("aliciFilterGrup");
        if (grupSelect && grupSelect.options.length <= 1) {
            allGroups.forEach(g => {
                const opt = document.createElement("option");
                opt.value = g;
                opt.textContent = `📁 ${g}`;
                grupSelect.appendChild(opt);
            });
        }

        if (q) {
            list = list.filter(c =>
                (c.unvan || "").toLowerCase().includes(q) ||
                (c.kod || "").toLowerCase().includes(q) ||
                (c.vkn || "").toLowerCase().includes(q) ||
                (c.cariGrup || "").toLowerCase().includes(q) ||
                (c.ozelNot || "").toLowerCase().includes(q)
            );
        }

        if (grupFilter !== "ALL") {
            list = list.filter(c => (c.cariGrup || "") === grupFilter);
        }

        if (odemeFilter === "CEK_10") {
            list = list.filter(c => (c.odemeSekli || "").startsWith("CEK_10"));
        } else if (odemeFilter === "CEK") {
            list = list.filter(c => (c.odemeSekli || "").startsWith("CEK"));
        } else if (odemeFilter === "NAKIT") {
            list = list.filter(c => !c.odemeSekli || c.odemeSekli.startsWith("NAKIT") || c.odemeSekli === "PESIN");
        } else if (odemeFilter === "SOZLU") {
            list = list.filter(c => c.odemeSozuTarihi || c.ozelNot);
        }

        if (statusFilter === "ALACAKLIYIZ") list = list.filter(c => c.netBakiye > 0.05);
        else if (statusFilter === "GECIKEN") list = list.filter(c => c.netBakiye > 0.05 && c.maxGecikmeGunu > 0);
        else if (statusFilter === "KAPALI") list = list.filter(c => Math.abs(c.netBakiye) <= 0.05);

        if (dovizFilter !== "ALL") {
            list = list.filter(c => (c.doviz || "TRY") === dovizFilter);
        }

        list.sort((a, b) => b.netBakiye - a.netBakiye);

        const tbody = document.getElementById("alicilarTableBody");
        if (!tbody) return;

        tbody.innerHTML = list.map(c => {
            const isChecked = this.selectedAliciIds.has(c.id);
            const selVal = c.odemeSekli || "CEK_10";

            let gecikmeHtml = `<span class="badge badge-neutral">Kapalı</span>`;
            if (c.netBakiye > 0.05) {
                if (c.enEskiAcikVade) {
                    const info = this.getVadeDurumu(c.enEskiAcikVade);
                    gecikmeHtml = `
                        <div style="font-weight:600; font-size:12px; white-space:nowrap;">📅 ${this.formatDisplayDate(c.enEskiAcikVade)}</div>
                        <div style="margin-top:2px;">${info.html}</div>
                    `;
                } else {
                    gecikmeHtml = `<span style="color:var(--text-muted); font-size:11.5px;">Vadesinde</span>`;
                }
            }

            const sozHtml = c.odemeSozuTarihi
                ? `<div style="font-size:11.5px; color:#38bdf8;"><strong>📅 Söz:</strong> ${c.odemeSozuTarihi} ${c.odemeSozuTutar ? `(${this.formatMoney(c.odemeSozuTutar)})` : ''}</div>`
                : '';
            const notHtml = c.ozelNot
                ? `<div style="font-size:11px; color:var(--text-muted); max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${c.ozelNot}">📝 ${c.ozelNot}</div>`
                : '';

            return `
                <tr class="${isChecked ? 'row-selected' : ''}">
                    <td style="text-align:center;">
                        <input type="checkbox" class="alici-row-check" value="${c.id}" ${isChecked ? 'checked' : ''} onchange="App.toggleRowSelectAlici('${c.id}', this.checked)">
                    </td>
                    <td><code style="font-weight:600; color:#93c5fd;">${c.kod}</code></td>
                    <td>
                        <strong><a href="javascript:void(0)" onclick="App.openCariEkstre('${c.id}')" style="color:#60a5fa; text-decoration:none;">${c.unvan}</a></strong>
                        ${c.vkn ? `<div style="font-size:11px; color:var(--text-muted);">VKN: ${c.vkn}</div>` : ''}
                    </td>
                    <td>
                        ${c.cariGrup ? `<span class="badge-group">${c.cariGrup}</span>` : `<span style="color:var(--text-muted); font-size:11px;">-</span>`}
                    </td>
                    <td>
                        <select class="cari-vade-select" onchange="App.onInlineCariVadeChange('${c.id}', this.value)" title="Ödeme şekli ve vadesini anında değiştirmek için tıklayın">
                            ${this.vadeOptions.map(opt => `<option value="${opt.value}" ${selVal === opt.value ? 'selected' : ''}>${opt.label}</option>`).join("")}
                        </select>
                    </td>
                    <td class="num">${this.formatMoney(c.toplamBorc)}</td>
                    <td class="num text-borc">${this.formatMoney(c.toplamAlacak)}</td>
                    <td class="num ${c.netBakiye > 0.05 ? 'text-alacak' : ''}" style="font-weight:700; font-size:13.5px;">
                        ${this.formatMoney(c.netBakiye)}
                    </td>
                    <td>${gecikmeHtml}</td>
                    <td>${sozHtml}${notHtml || (!sozHtml ? '<span style="color:var(--text-muted); font-size:11px;">-</span>' : '')}</td>
                    <td style="white-space:nowrap;">
                        <button class="btn btn-outline btn-sm" onclick="App.openCariVadeModal('${c.id}')" title="Vade, Grup ve Not Düzenle">⚙️ Vade / Not</button>
                        <button class="btn btn-outline btn-sm" onclick="App.openCariEkstre('${c.id}')">Ekstre</button>
                        <button class="btn btn-success btn-sm" onclick="App.openQuickTransactionModal('TAHSILAT', '${c.id}')">+ Tahsilat</button>
                    </td>
                </tr>
            `;
        }).join("") || `<tr><td colspan="11" style="text-align:center; padding:24px; color:var(--text-muted);">Aramaya uygun müşteri carisi bulunamadı</td></tr>`;

        this.updateBulkBar("alici");
    },

    // ================= SATICILAR (TEDARİKÇİLER - 320 GRUBU) RENDER =================
    renderSaticilar() {
        const q = (document.getElementById("saticiSearch")?.value || "").toLowerCase().trim();
        const grupFilter = document.getElementById("saticiFilterGrup")?.value || "ALL";
        const odemeFilter = document.getElementById("saticiFilterOdeme")?.value || "ALL";
        const statusFilter = document.getElementById("saticiFilterStatus")?.value || "ALL";
        const dovizFilter = document.getElementById("saticiFilterDoviz")?.value || "ALL";

        let list = Object.values(this.computedCarilerMap).filter(c => c.hesapTuru === "SATICI");

        // Grup filtresini dinamik doldur
        const allGroups = new Set();
        Object.values(this.computedCarilerMap).forEach(c => { if (c.cariGrup) allGroups.add(c.cariGrup); });
        const grupSelect = document.getElementById("saticiFilterGrup");
        if (grupSelect && grupSelect.options.length <= 1) {
            allGroups.forEach(g => {
                const opt = document.createElement("option");
                opt.value = g;
                opt.textContent = `📁 ${g}`;
                grupSelect.appendChild(opt);
            });
        }

        if (q) {
            list = list.filter(c =>
                (c.unvan || "").toLowerCase().includes(q) ||
                (c.kod || "").toLowerCase().includes(q) ||
                (c.vkn || "").toLowerCase().includes(q) ||
                (c.cariGrup || "").toLowerCase().includes(q) ||
                (c.ozelNot || "").toLowerCase().includes(q)
            );
        }

        if (grupFilter !== "ALL") {
            list = list.filter(c => (c.cariGrup || "") === grupFilter);
        }

        if (odemeFilter === "CEK_10") {
            list = list.filter(c => (c.odemeSekli || "").startsWith("CEK_10"));
        } else if (odemeFilter === "CEK") {
            list = list.filter(c => (c.odemeSekli || "").startsWith("CEK"));
        } else if (odemeFilter === "NAKIT") {
            list = list.filter(c => !c.odemeSekli || c.odemeSekli.startsWith("NAKIT") || c.odemeSekli === "PESIN");
        } else if (odemeFilter === "SOZLU") {
            list = list.filter(c => c.odemeSozuTarihi || c.ozelNot);
        }

        if (statusFilter === "BORCLUYUZ") list = list.filter(c => c.netBakiye < -0.05);
        else if (statusFilter === "GECIKEN") list = list.filter(c => c.netBakiye < -0.05 && c.maxGecikmeGunu > 0);
        else if (statusFilter === "KAPALI") list = list.filter(c => Math.abs(c.netBakiye) <= 0.05);

        if (dovizFilter !== "ALL") {
            list = list.filter(c => (c.doviz || "TRY") === dovizFilter);
        }

        list.sort((a, b) => a.netBakiye - b.netBakiye);

        const tbody = document.getElementById("saticilarTableBody");
        if (!tbody) return;

        tbody.innerHTML = list.map(c => {
            const isChecked = this.selectedSaticiIds.has(c.id);
            const selVal = c.odemeSekli || "CEK_10";
            const absBorc = Math.abs(c.netBakiye);

            let gecikmeHtml = `<span class="badge badge-neutral">Kapalı</span>`;
            if (c.netBakiye < -0.05) {
                if (c.enEskiAcikVade) {
                    const info = this.getVadeDurumu(c.enEskiAcikVade);
                    gecikmeHtml = `
                        <div style="font-weight:600; font-size:12px; white-space:nowrap;">📅 ${this.formatDisplayDate(c.enEskiAcikVade)}</div>
                        <div style="margin-top:2px;">${info.html}</div>
                    `;
                } else {
                    gecikmeHtml = `<span style="color:var(--text-muted); font-size:11.5px;">Vadesinde</span>`;
                }
            }

            const sozHtml = c.odemeSozuTarihi
                ? `<div style="font-size:11.5px; color:#f87171;"><strong>📅 Söz:</strong> ${c.odemeSozuTarihi} ${c.odemeSozuTutar ? `(${this.formatMoney(c.odemeSozuTutar)})` : ''}</div>`
                : '';
            const notHtml = c.ozelNot
                ? `<div style="font-size:11px; color:var(--text-muted); max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${c.ozelNot}">📝 ${c.ozelNot}</div>`
                : '';

            return `
                <tr class="${isChecked ? 'row-selected' : ''}">
                    <td style="text-align:center;">
                        <input type="checkbox" class="satici-row-check" value="${c.id}" ${isChecked ? 'checked' : ''} onchange="App.toggleRowSelectSatici('${c.id}', this.checked)">
                    </td>
                    <td><code style="font-weight:600; color:#fca5a5;">${c.kod}</code></td>
                    <td>
                        <strong><a href="javascript:void(0)" onclick="App.openCariEkstre('${c.id}')" style="color:#60a5fa; text-decoration:none;">${c.unvan}</a></strong>
                        ${c.vkn ? `<div style="font-size:11px; color:var(--text-muted);">VKN: ${c.vkn}</div>` : ''}
                    </td>
                    <td>
                        ${c.cariGrup ? `<span class="badge-group">${c.cariGrup}</span>` : `<span style="color:var(--text-muted); font-size:11px;">-</span>`}
                    </td>
                    <td>
                        <select class="cari-vade-select" onchange="App.onInlineCariVadeChange('${c.id}', this.value)" title="Vade ve ödeme kuralını anında değiştirmek için tıklayın">
                            ${this.vadeOptions.map(opt => `<option value="${opt.value}" ${selVal === opt.value ? 'selected' : ''}>${opt.label}</option>`).join("")}
                        </select>
                    </td>
                    <td class="num text-alacak">${this.formatMoney(c.toplamAlacak)}</td>
                    <td class="num">${this.formatMoney(c.toplamBorc)}</td>
                    <td class="num ${c.netBakiye < -0.05 ? 'text-borc' : ''}" style="font-weight:700; font-size:13.5px;">
                        ${this.formatMoney(absBorc)}
                    </td>
                    <td>${gecikmeHtml}</td>
                    <td>${sozHtml}${notHtml || (!sozHtml ? '<span style="color:var(--text-muted); font-size:11px;">-</span>' : '')}</td>
                    <td style="white-space:nowrap;">
                        <button class="btn btn-outline btn-sm" onclick="App.openCariVadeModal('${c.id}')" title="Vade, Grup ve Not Düzenle">⚙️ Vade / Not</button>
                        <button class="btn btn-outline btn-sm" onclick="App.openCariEkstre('${c.id}')">Ekstre</button>
                        <button class="btn btn-danger btn-sm" onclick="App.openQuickTransactionModal('ODEME', '${c.id}')">- Ödeme</button>
                    </td>
                </tr>
            `;
        }).join("") || `<tr><td colspan="11" style="text-align:center; padding:24px; color:var(--text-muted);">Aramaya uygun tedarikçi carisi bulunamadı</td></tr>`;

        this.updateBulkBar("satici");
    },

    toggleRowSelectAlici(cariId, checked) {
        if (checked) this.selectedAliciIds.add(cariId);
        else this.selectedAliciIds.delete(cariId);
        this.updateBulkBar("alici");
    },

    toggleRowSelectSatici(cariId, checked) {
        if (checked) this.selectedSaticiIds.add(cariId);
        else this.selectedSaticiIds.delete(cariId);
        this.updateBulkBar("satici");
    },

    toggleSelectAllAlicilar(checked) {
        const boxes = document.querySelectorAll(".alici-row-check");
        boxes.forEach(b => {
            b.checked = checked;
            if (checked) this.selectedAliciIds.add(b.value);
            else this.selectedAliciIds.delete(b.value);
        });
        this.updateBulkBar("alici");
    },

    toggleSelectAllSaticilar(checked) {
        const boxes = document.querySelectorAll(".satici-row-check");
        boxes.forEach(b => {
            b.checked = checked;
            if (checked) this.selectedSaticiIds.add(b.value);
            else this.selectedSaticiIds.delete(b.value);
        });
        this.updateBulkBar("satici");
    },

    updateBulkBar(type) {
        const set = type === "alici" ? this.selectedAliciIds : this.selectedSaticiIds;
        const cntEl = document.getElementById(type + "SelectedCount");
        if (cntEl) cntEl.textContent = set.size;
    },

    async onInlineCariVadeChange(cariId, optValue) {
        const c = this.state.cariler.find(x => x.id === cariId);
        if (!c) return;
        const opt = this.vadeOptions.find(o => o.value === optValue);
        const days = opt ? opt.days : 30;
        const rule = opt ? opt.rule : (optValue && optValue.includes("10") ? "TAKIP_EDEN_10" : "STANDART");

        this.setCariConfig(c, {
            odemeSekli: optValue,
            vadeGunu: days,
            vadeKurali: rule,
            cariGrup: c.cariGrup || "",
            cariTipi: c.cariTipi || (c.kod.startsWith("320") ? "TEDARIKCI" : "MUSTERI")
        });

        await this.saveState();
        this.recalculateAndRenderAll();
        this.showToast(`✅ "${c.unvan}" vade seçeneği kalıcı olarak kaydedildi: ${opt ? opt.label : optValue}`);
    },

    async onBulkVadeDropdownChange(type, selVade) {
        if (!selVade) return;
        const set = type === "alici" ? this.selectedAliciIds : this.selectedSaticiIds;
        // Eğer cari kutucukları işaretliyse doğrudan otomatik uygula!
        if (set.size > 0) {
            await this.applyBulkAssign(type);
        }
    },

    async applyBulkAssign(type) {
        const set = type === "alici" ? this.selectedAliciIds : this.selectedSaticiIds;
        const selVade = document.getElementById(type + "BulkVade")?.value;
        const selGrup = (document.getElementById(type + "BulkGrup")?.value || "").trim();

        if (set.size === 0) {
            const roleName = type === "alici" ? "müşterilere" : "tedarikçilere";
            const targetList = Object.values(this.computedCarilerMap).filter(c => c.hesapTuru === (type === "alici" ? "ALICI" : "SATICI"));
            if (targetList.length === 0) {
                alert("Uygulanacak cari bulunamadı.");
                return;
            }
            const confirmAll = confirm(`İşaretli kutucuk bulunamadı.\nBu sekmedeki TÜM (${targetList.length}) ${roleName} '${selVade ? selVade : 'seçilen kuralı'}' otomatik uygulamak istiyor musunuz?`);
            if (!confirmAll) return;
            targetList.forEach(c => set.add(c.id));
        }

        if (!selVade && !selGrup) {
            alert("Lütfen atanacak Vade Kuralını veya Cari Grubunu seçiniz.");
            return;
        }

        const opt = this.vadeOptions.find(o => o.value === selVade);
        let count = 0;

        for (const cariId of Array.from(set)) {
            const c = this.state.cariler.find(x => x.id === cariId);
            if (!c) continue;

            const updateData = {};
            if (selVade) {
                updateData.odemeSekli = selVade;
                updateData.vadeGunu = opt ? opt.days : (selVade.startsWith("CEK_10") ? 0 : (c.vadeGunu || 0));
                updateData.vadeKurali = opt ? opt.rule : (selVade.includes("10") ? "TAKIP_EDEN_10" : "STANDART");
            }
            if (selGrup) {
                updateData.cariGrup = selGrup;
            }

            this.setCariConfig(c, updateData);
            count++;
        }

        set.clear();
        this.updateBulkBar(type);
        // Checkboxları da temizle
        const chkClass = type === "alici" ? ".alici-row-check" : ".satici-row-check";
        document.querySelectorAll(chkClass).forEach(b => { b.checked = false; });
        const allChk = document.getElementById(type === "alici" ? "selectAllAlicilar" : "selectAllSaticilar");
        if (allChk) allChk.checked = false;

        await this.saveState();
        this.recalculateAndRenderAll();
        this.showToast(`✅ ${count} adet cariye '${opt ? opt.label : selVade}' kuralı uygulandı ve kalıcı kaydedildi.`);
    },

    showToast(msg) {
        const t = document.getElementById("appToast");
        if (!t) return;
        t.textContent = msg;
        t.style.display = "block";
        t.style.opacity = "1";
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            t.style.opacity = "0";
            setTimeout(() => { t.style.display = "none"; }, 300);
        }, 3200);
    },

    exportAlicilarCsv() {
        const list = Object.values(this.computedCarilerMap).filter(c => c.hesapTuru === "ALICI");
        let csv = "\uFEFFMusteri Kodu;Musteri Unvani;VKN;Cari Grubu;Odeme Sekli;Vade Gunu;Toplam Satis;Tahsilat;Net Alacak;Gecikme Gunu;Ozel Not\n";
        for (const c of list) {
            csv += `"${c.kod}";"${(c.unvan || '').replace(/"/g, '""')}";"${c.vkn || ''}";"${c.cariGrup || ''}";"${c.odemeSekli || ''}";"${c.vadeGunu || 30}";"${(c.toplamBorc || 0).toFixed(2)}";"${(c.toplamAlacak || 0).toFixed(2)}";"${(c.netBakiye || 0).toFixed(2)}";"${c.maxGecikmeGunu || 0}";"${(c.ozelNot || '').replace(/"/g, '""')}"\n`;
        }
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `SODSAN_Musteriler_Alicilar_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    },

    exportSaticilarCsv() {
        const list = Object.values(this.computedCarilerMap).filter(c => c.hesapTuru === "SATICI");
        let csv = "\uFEFFTedarikci Kodu;Tedarikci Unvani;VKN;Cari Grubu;Odeme Sekli;Vade Gunu;Toplam Alis;Yapilan Odeme;Net Borcumuz;Gecikme Gunu;Ozel Not\n";
        for (const c of list) {
            csv += `"${c.kod}";"${(c.unvan || '').replace(/"/g, '""')}";"${c.vkn || ''}";"${c.cariGrup || ''}";"${c.odemeSekli || ''}";"${c.vadeGunu || 30}";"${(c.toplamAlacak || 0).toFixed(2)}";"${(c.toplamBorc || 0).toFixed(2)}";"${Math.abs(c.netBakiye || 0).toFixed(2)}";"${c.maxGecikmeGunu || 0}";"${(c.ozelNot || '').replace(/"/g, '""')}"\n`;
        }
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `SODSAN_Tedarikciler_Saticilar_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    },

    // ================= 2. CARİ HESAPLAR RENDER =================
    renderCariler() {
        const q = (document.getElementById("cariSearch")?.value || "").toLowerCase().trim();
        const statusFilter = document.getElementById("cariFilterStatus")?.value || "ALL";
        const odemeFilter = document.getElementById("cariFilterOdemeSekli")?.value || "ALL";
        const dovizFilter = document.getElementById("cariFilterDoviz")?.value || "ALL";

        let list = Object.values(this.computedCarilerMap);

        if (q) {
            list = list.filter(c =>
                (c.unvan || "").toLowerCase().includes(q) ||
                (c.kod || "").toLowerCase().includes(q) ||
                (c.vkn || "").toLowerCase().includes(q) ||
                (c.ozelNot || "").toLowerCase().includes(q)
            );
        }

        if (statusFilter === "ALACAKLIYIZ") list = list.filter(c => c.bakiyeYonu === "ALACAKLIYIZ");
        else if (statusFilter === "BORCLUYUZ") list = list.filter(c => c.bakiyeYonu === "BORCLUYUZ");
        else if (statusFilter === "GECIKEN") list = list.filter(c => c.bakiyeYonu !== "KAPALI" && c.maxGecikmeGunu > 0);
        else if (statusFilter === "KAPALI") list = list.filter(c => c.bakiyeYonu === "KAPALI");

        if (odemeFilter === "CEK") {
            list = list.filter(c => (c.odemeSekli || "").startsWith("CEK"));
        } else if (odemeFilter === "NAKIT") {
            list = list.filter(c => !c.odemeSekli || c.odemeSekli === "NAKIT" || c.odemeSekli === "PESIN");
        } else if (odemeFilter === "SOZLU") {
            list = list.filter(c => c.odemeSozuTarihi || c.ozelNot);
        }

        if (dovizFilter !== "ALL") {
            list = list.filter(c => (c.doviz || "TRY") === dovizFilter);
        }

        list.sort((a, b) => Math.abs(b.netBakiye) - Math.abs(a.netBakiye));

        document.getElementById("carilerTableBody").innerHTML = list.map(c => {
            const absBakiye = Math.abs(c.netBakiye);
            let yonBadge = `<span class="badge badge-neutral">Kapalı</span>`;
            if (c.bakiyeYonu === "ALACAKLIYIZ") {
                yonBadge = `<span class="badge badge-alacak">Alacaklı (Tahsil Edilecek)</span>`;
            } else if (c.bakiyeYonu === "BORCLUYUZ") {
                yonBadge = `<span class="badge badge-borc">Borçlu (Ödenecek)</span>`;
            }

            let odemeBadge = `<span class="badge badge-nakit">💵 Nakit (30G)</span>`;
            if (c.odemeSekli) {
                if (c.odemeSekli.startsWith("CEK")) {
                    const days = c.vadeGunu || c.odemeSekli.split("_")[1] || 60;
                    odemeBadge = `<span class="badge badge-cek">📑 ${days}G Çek</span>`;
                } else if (c.odemeSekli === "KREDI_KARTI") {
                    odemeBadge = `<span class="badge badge-purple">💳 K.Kartı</span>`;
                } else if (c.odemeSekli === "PESIN") {
                    odemeBadge = `<span class="badge badge-alacak">⚡ Peşin</span>`;
                } else if (c.odemeSekli === "OZEL") {
                    odemeBadge = `<span class="badge badge-neutral">✏️ Özel (${c.vadeGunu || 30}G)</span>`;
                } else {
                    odemeBadge = `<span class="badge badge-nakit">💵 Nakit (${c.vadeGunu || 30}G)</span>`;
                }
            } else if (c.vadeGunu) {
                odemeBadge = `<span class="badge badge-neutral">Vade: ${c.vadeGunu}G</span>`;
            }

            let gecikmeHtml = `<span style="color:var(--text-muted);">-</span>`;
            if (c.bakiyeYonu !== "KAPALI" && c.enEskiAcikVade) {
                const info = this.getVadeDurumu(c.enEskiAcikVade);
                gecikmeHtml = `
                    <div style="font-weight:600; font-size:12px; white-space:nowrap;">📅 ${this.formatDisplayDate(c.enEskiAcikVade)}</div>
                    <div style="margin-top:2px;">${info.html}</div>
                `;
            }

            const sozHtml = c.odemeSozuTarihi
                ? `<div><span class="badge badge-purple">Söz: ${c.odemeSozuTarihi} (${this.formatMoney(c.odemeSozuTutar || absBakiye)})</span></div>`
                : "";
            const notHtml = c.ozelNot ? `<div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">${c.ozelNot}</div>` : "";

            return `
                <tr>
                    <td><code>${c.kod}</code></td>
                    <td>
                        <strong><a href="javascript:void(0)" onclick="App.openCariEkstre('${c.id}')" style="color:#60a5fa; text-decoration:none;">${c.unvan}</a></strong>
                        <div style="font-size:11.5px; color:var(--text-muted);">
                            ${c.vkn ? `VKN: ${c.vkn}` : ''} ${c.telefon ? `• Tel: ${c.telefon}` : ''} • ${c.hareketListesi.length} hareket
                        </div>
                    </td>
                    <td>${odemeBadge}</td>
                    <td class="num">${this.formatMoney(c.toplamBorc)}</td>
                    <td class="num">${this.formatMoney(c.toplamAlacak)}</td>
                    <td class="num ${c.bakiyeYonu === 'ALACAKLIYIZ' ? 'text-alacak' : (c.bakiyeYonu === 'BORCLUYUZ' ? 'text-borc' : '')}">
                        ${this.formatMoney(absBakiye)} ${c.bakiyeYonu === 'ALACAKLIYIZ' ? '(B)' : (c.bakiyeYonu === 'BORCLUYUZ' ? '(A)' : '')}
                    </td>
                    <td>${yonBadge}</td>
                    <td>${gecikmeHtml}</td>
                    <td>${sozHtml}${notHtml}</td>
                    <td>
                        <div style="display:flex; gap:5px; flex-wrap:wrap;">
                            <button class="btn btn-primary btn-sm" onclick="App.openCariEkstre('${c.id}')">Ekstre</button>
                            <button class="btn btn-outline btn-sm" onclick="App.openCariVadeModal('${c.id}')" title="Vade ve Ödeme Şekli Ayarla">⚙️ Vade/Şart</button>
                            <button class="btn btn-success btn-sm" onclick="App.openQuickTransactionModal('TAHSILAT', '${c.id}')" title="Müşteriden Tahsilat">+Tahsilat</button>
                            <button class="btn btn-danger btn-sm" onclick="App.openQuickTransactionModal('ODEME', '${c.id}')" title="Tedarikçiye Ödeme">-Ödeme</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("") || `<tr><td colspan="10" style="text-align:center; padding:24px; color:var(--text-muted);">Henüz cari hesap verisi yüklenmedi. Zirve'den aldığınız Excel veya PDF dosyasını yükleyin.</td></tr>`;
    },

    // ================= CARİ EKSTRE MODAL =================
    openCariEkstre(cariId) {
        const c = this.computedCarilerMap[cariId];
        if (!c) return;
        this.activeEkstreCariId = cariId;

        document.getElementById("ekstreCariTitle").textContent = `${c.unvan} (${c.kod})`;
        document.getElementById("ekstreCariSub").textContent = `VKN: ${c.vkn || '-'} | Telefon: ${c.telefon || '-'} | Kaynak: ${c.kaynak || 'Yerel'}`;

        const pmEl = document.getElementById("ekstrePaymentMethod");
        if (pmEl) {
            pmEl.value = c.odemeSekli || "CEK_10";
            if (!pmEl.value && pmEl.options.length > 0) pmEl.selectedIndex = 0;
        }
        const tdEl = document.getElementById("ekstreTermDays");
        if (tdEl) tdEl.value = c.vadeGunu !== undefined ? c.vadeGunu : 60;

        document.getElementById("ekstrePromiseDate").value = c.odemeSozuTarihi || "";
        document.getElementById("ekstrePromiseAmount").value = c.odemeSozuTutar || "";
        document.getElementById("ekstreCariNote").value = c.ozelNot || "";

        document.getElementById("btnEkstreTahsilat").onclick = () => {
            this.closeModal("cariEkstreModal");
            this.openQuickTransactionModal("TAHSILAT", cariId);
        };
        document.getElementById("btnEkstreOdeme").onclick = () => {
            this.closeModal("cariEkstreModal");
            this.openQuickTransactionModal("ODEME", cariId);
        };
        document.getElementById("btnEkstreWhatsapp").onclick = () => {
            this.sendWhatsappMutabakat(cariId);
        };

        const absNet = Math.abs(c.netBakiye);
        const vadeDurumu = c.enEskiAcikVade ? this.getVadeDurumu(c.enEskiAcikVade) : null;
        document.getElementById("ekstreKpiRow").innerHTML = `
            <div class="kpi-card">
                <div class="kpi-label">Toplam Borç (Satış / Ödeme / Devir)</div>
                <div class="kpi-value">${this.formatMoney(c.toplamBorc)}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Toplam Alacak (Alış / Tahsilat)</div>
                <div class="kpi-value">${this.formatMoney(c.toplamAlacak)}</div>
            </div>
            <div class="kpi-card ${c.bakiyeYonu === 'ALACAKLIYIZ' ? 'alacak' : (c.bakiyeYonu === 'BORCLUYUZ' ? 'borc' : '')}">
                <div class="kpi-label">Net Cari Bakiye (${c.bakiyeYonu === 'ALACAKLIYIZ' ? 'Müşteri Bize Borçlu' : (c.bakiyeYonu === 'BORCLUYUZ' ? 'Biz Tedarikçiye Borçluyuz' : 'Mutabık')})</div>
                <div class="kpi-value ${c.bakiyeYonu === 'ALACAKLIYIZ' ? 'text-alacak' : (c.bakiyeYonu === 'BORCLUYUZ' ? 'text-borc' : '')}">
                    ${this.formatMoney(absNet)} ${c.bakiyeYonu === 'ALACAKLIYIZ' ? '(B)' : (c.bakiyeYonu === 'BORCLUYUZ' ? '(A)' : '')}
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Faturadan Hesaplanan Vade Durumu</div>
                <div class="kpi-value" style="font-size:13.5px; font-weight:600; margin-top:2px;">
                    ${vadeDurumu ? `📅 ${this.formatDisplayDate(c.enEskiAcikVade)} • ${vadeDurumu.text}` : '<span style="color:var(--text-muted); font-size:12px;">Açık Bakiye Yok (Kapalı)</span>'}
                </div>
            </div>
        `;

        // Yürüyen bakiyeli (Running Balance) ekstre satırları
        let running = 0;
        const rowsHtml = c.hareketListesi.map(h => {
            running = Math.round((running + h.borcTl - h.alacakTl) * 100) / 100;
            const ba = running > 0.05 ? "B (Alacağımız)" : (running < -0.05 ? "A (Borcumuz)" : "0");
            const effVade = this.getEffectiveVadeTarihi(h.tarih, c);
            const vadeInfo = this.getVadeDurumu(effVade);
            return `
                <tr>
                    <td class="cell-date">${this.formatDisplayDate(h.tarih)}</td>
                    <td class="cell-date">
                        <div style="font-weight:600;">${this.formatDisplayDate(effVade)}</div>
                        <div style="margin-top:2px;">${vadeInfo.html}</div>
                    </td>
                    <td class="cell-code"><code>${h.evrakNo || '-'}</code></td>
                    <td class="nowrap"><span class="badge badge-neutral">${this.getHarTypeLabel(h.islemTuru)}</span></td>
                    <td style="max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${h.aciklama || ''}">${h.aciklama || '-'}</td>
                    <td class="num ${h.borcTl > 0 ? 'text-alacak' : ''}">${h.borcTl > 0 ? this.formatMoney(h.borcTl) : '-'}</td>
                    <td class="num ${h.alacakTl > 0 ? 'text-borc' : ''}">${h.alacakTl > 0 ? this.formatMoney(h.alacakTl) : '-'}</td>
                    <td class="num"><strong>${this.formatMoney(Math.abs(running))}</strong></td>
                    <td class="nowrap"><span class="badge ${running > 0.05 ? 'badge-alacak' : (running < -0.05 ? 'badge-borc' : 'badge-neutral')}">${ba}</span></td>
                </tr>
            `;
        }).join("");

        document.getElementById("ekstreTableBody").innerHTML = rowsHtml || `<tr><td colspan="9" style="text-align:center;">Bu cariye ait hareket bulunmuyor.</td></tr>`;
        document.getElementById("cariEkstreModal").classList.add("active");
    },

    saveCariPromise() {
        const cariId = this.activeEkstreCariId;
        if (!cariId) return;
        const target = this.state.cariler.find(c => c.id === cariId);
        if (!target) return;

        const pmEl = document.getElementById("ekstrePaymentMethod");
        const tdEl = document.getElementById("ekstreTermDays");
        const optValue = pmEl ? pmEl.value : (target.odemeSekli || "CEK_10");
        const opt = this.vadeOptions.find(o => o.value === optValue);

        const sozDate = document.getElementById("ekstrePromiseDate")?.value || null;
        const sozAmount = parseFloat(document.getElementById("ekstrePromiseAmount")?.value) || null;
        const ozelNot = (document.getElementById("ekstreCariNote")?.value || "").trim();
        const termDays = tdEl ? (parseInt(tdEl.value, 10) || (opt ? opt.days : 30)) : (opt ? opt.days : 30);
        const termRule = opt ? opt.rule : (optValue && optValue.includes("10") ? "TAKIP_EDEN_10" : "STANDART");

        this.setCariConfig(target, {
            odemeSekli: optValue,
            vadeGunu: termDays,
            vadeKurali: termRule,
            odemeSozuTarihi: sozDate,
            odemeSozuTutar: sozAmount,
            ozelNot: ozelNot
        });

        this.saveState();
        this.recalculateAndRenderAll();
        this.openCariEkstre(cariId);
        this.showToast(`✅ "${target.unvan}" vade ve ödeme şartları güncellendi. Tüm fatura vadeleri ve kalan günler yeniden hesaplandı.`);
    },

    onEkstrePaymentMethodChange() {
        const val = document.getElementById("ekstrePaymentMethod")?.value;
        const termEl = document.getElementById("ekstreTermDays");
        if (!termEl) return;
        const opt = this.vadeOptions.find(o => o.value === val);
        if (opt) {
            termEl.value = opt.days;
        } else if (val === "PESIN") {
            termEl.value = 0;
        }
    },

    toggleEkstreFullscreen() {
        const box = document.querySelector("#cariEkstreModal .modal-box");
        if (box) {
            box.classList.toggle("fullscreen");
            if (box.classList.contains("fullscreen")) {
                box.style.width = "100vw";
                box.style.height = "100vh";
                box.style.maxWidth = "100vw";
                box.style.maxHeight = "100vh";
                box.style.borderRadius = "0";
            } else {
                box.style.width = "";
                box.style.height = "";
                box.style.maxWidth = "";
                box.style.maxHeight = "";
                box.style.borderRadius = "";
            }
        }
    },

    sendWhatsappMutabakat(cariId) {
        const c = this.computedCarilerMap[cariId];
        if (!c) return;
        const abs = this.formatMoney(Math.abs(c.netBakiye));
        const durumMetni = c.bakiyeYonu === "ALACAKLIYIZ"
            ? `cari hesabınızda *${abs} BORÇ* bakiyeniz görünmektedir.`
            : c.bakiyeYonu === "BORCLUYUZ"
            ? `cari hesabınızda *${abs} ALACAK* bakiyeniz görünmektedir.`
            : `cari hesap bakiyeniz *0,00 TL (Mutabık)* görünmektedir.`;

        const msg = `Sayın *${c.unvan}* yetkilisi,\n\n${this.state.settings.ownFirmName || 'Şirketimiz'} kayıtlarına göre güncel ${durumMetni}\n\nMutabakatınızı veya ödeme planınızı paylaşmanızı rica eder, iyi çalışmalar dileriz.`;
        const cleanPhone = (c.telefon || "").replace(/\D/g, "");
        const phoneParam = cleanPhone ? (cleanPhone.startsWith("0") ? "9" + cleanPhone : cleanPhone) : "";
        const url = `https://wa.me/${phoneParam}?text=${encodeURIComponent(msg)}`;
        window.open(url, "_blank");
    },

    // ================= CARİ VADE & ÖDEME ŞEKLİ MODAL =================
    openCariVadeModal(cariId) {
        const c = this.state.cariler.find(x => x.id === cariId) || this.computedCarilerMap[cariId];
        if (!c) return;

        const comp = this.computedCarilerMap[cariId] || c;
        const absBakiye = Math.abs(comp.netBakiye || 0);

        document.getElementById("cvmCariId").value = c.id;
        document.getElementById("cvmTitle").textContent = `${c.unvan} (${c.kod})`;
        document.getElementById("cvmSub").textContent = `Güncel Net Bakiye: ${this.formatMoney(absBakiye)} TL | Durum: ${comp.bakiyeYonu || 'Açık'}`;

        document.getElementById("cvmRol").value = c.cariTipi || (c.kod.startsWith("320") ? "TEDARIKCI" : "MUSTERI");
        const grupEl = document.getElementById("cvmGrup");
        if (grupEl) grupEl.value = c.cariGrup || "";

        document.getElementById("cvmOdemeSekli").value = c.odemeSekli || "CEK_10";
        document.getElementById("cvmVadeGunu").value = c.vadeGunu !== undefined ? c.vadeGunu : 60;
        document.getElementById("cvmOdemeGunu").value = c.vadeKurali || c.odemeGunuKurali || "TAKIP_EDEN_10";
        document.getElementById("cvmSozTarihi").value = c.odemeSozuTarihi || "";
        document.getElementById("cvmSozTutar").value = c.odemeSozuTutar || (absBakiye > 0 ? absBakiye : "");
        document.getElementById("cvmYetkili").value = c.yetkiliKisi || c.yetkili || "";
        document.getElementById("cvmTel").value = c.telefon || "";
        document.getElementById("cvmNot").value = c.ozelNot || "";

        document.getElementById("cariVadeModal").classList.add("active");
    },

    onCvmOdemeSekliChange() {
        const sekil = document.getElementById("cvmOdemeSekli")?.value;
        const vg = document.getElementById("cvmVadeGunu");
        const og = document.getElementById("cvmOdemeGunu");
        if (!vg) return;

        const opt = this.vadeOptions.find(o => o.value === sekil);
        if (opt) {
            vg.value = opt.days;
            if (og) og.value = opt.rule;
        } else if (sekil && sekil.startsWith("CEK_10_")) {
            const days = parseInt(sekil.replace("CEK_10_", ""), 10) || 0;
            vg.value = days;
            if (og) og.value = "TAKIP_EDEN_10";
        }
    },

    fillCvmCurrentBalance() {
        const cariId = document.getElementById("cvmCariId")?.value;
        const comp = this.computedCarilerMap[cariId];
        if (comp) {
            document.getElementById("cvmSozTutar").value = Math.abs(comp.netBakiye || 0).toFixed(2);
        }
    },

    async saveCariVadeModal() {
        const cariId = document.getElementById("cvmCariId")?.value;
        const target = this.state.cariler.find(c => c.id === cariId);
        if (!target) return;

        const rol = document.getElementById("cvmRol").value;
        const grup = (document.getElementById("cvmGrup")?.value || "").trim();
        const odemeSekli = document.getElementById("cvmOdemeSekli").value;
        const vadeGunu = parseInt(document.getElementById("cvmVadeGunu").value, 10) || 0;
        const vadeKurali = document.getElementById("cvmOdemeGunu").value;
        const sozTarihi = document.getElementById("cvmSozTarihi").value || null;
        const sozTutar = parseFloat(document.getElementById("cvmSozTutar").value) || null;
        const yetkili = document.getElementById("cvmYetkili").value.trim();
        const tel = document.getElementById("cvmTel").value.trim();
        const not = document.getElementById("cvmNot").value.trim();

        // Kalıcı Cari Ayarlarına Kaydet
        this.setCariConfig(target, {
            cariTipi: rol,
            cariGrup: grup,
            odemeSekli: odemeSekli,
            vadeGunu: vadeGunu,
            vadeKurali: vadeKurali,
            odemeSozuTarihi: sozTarihi,
            odemeSozuTutar: sozTutar,
            yetkili: yetkili,
            telefon: tel,
            ozelNot: not
        });

        this.closeModal("cariVadeModal");
        await this.saveState();
        this.recalculateAndRenderAll();
        this.showToast(`✅ "${target.unvan}" vade ve grup bilgileri kalıcı olarak kaydedildi.`);
    },

    copyWhatsAppReminderText(cariId) {
        const c = this.computedCarilerMap[cariId] || this.state.cariler.find(x => x.id === cariId);
        if (!c) return;

        const isAlacak = c.bakiyeYonu === "ALACAKLIYIZ";
        const abs = this.formatMoney(Math.abs(c.netBakiye));
        const vade = c.odemeSozuTarihi || c.enEskiAcikVade || "Vadesi gelen";
        let sekil = "ödeme";
        if (c.odemeSekli && c.odemeSekli.startsWith("CEK")) {
            sekil = `${c.vadeGunu || 60} günlük çek ödemesi`;
        } else if (c.odemeSekli === "NAKIT") {
            sekil = "nakit / havale ödemesi";
        }

        let msg = "";
        if (isAlacak) {
            msg = `Sayın ${c.unvan} yetkilisi,\n\n${this.state.settings.ownFirmName || 'SODSAN'} cari hesabınızda ${vade} vadeli ${abs} tutarında ${sekil} bulunmaktadır.\n\nMutabakat ve ödeme planınız ile ilgili bilgi vermenizi rica eder, iyi çalışmalar dileriz.\n\n${this.state.settings.ownFirmName || 'SODSAN STANDART OTO DÖŞEME A.Ş.'}`;
        } else {
            msg = `Sayın ${c.unvan} yetkilisi,\n\n${this.state.settings.ownFirmName || 'SODSAN'} olarak cari hesabınızdaki ${abs} tutarındaki ödemeniz ${vade} tarihinde planlanmıştır.\nBilgilerinize sunar, iyi çalışmalar dileriz.`;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(msg).then(() => {
                alert("📋 Hatırlatma metni panoya kopyalandı!\n\nWhatsApp, SMS veya e-posta ile yapıştırıp gönderebilirsiniz:\n\n" + msg);
            }).catch(() => {
                prompt("Metni kopyalayınız (Ctrl+C):", msg);
            });
        } else {
            prompt("Metni kopyalayınız (Ctrl+C):", msg);
        }
    },

    // ================= VADE & ÖDEME HATIRLATICI TAKVİMİ RENDER =================
    renderHatirlatici() {
        const tbody = document.getElementById("hatirlaticiTableBody");
        if (!tbody) return;

        const q = (document.getElementById("hatirlaticiSearch")?.value || "").toLowerCase().trim();
        const roleFilter = document.getElementById("hatirlaticiFilterRole")?.value || "ALL";
        const timeFilter = document.getElementById("hatirlaticiFilterTime")?.value || "ALL";
        const typeFilter = document.getElementById("hatirlaticiFilterType")?.value || "ALL";

        const cariler = Object.values(this.computedCarilerMap);
        let items = [];

        let totalGecikenAlacak = 0;
        let countGecikenAlacak = 0;
        let totalGecikenBorc = 0;
        let countGecikenBorc = 0;
        let totalBuHaftaAlacak = 0;
        let totalBuHaftaBorc = 0;
        let totalDueCount = 0;

        for (const c of cariler) {
            if (c.bakiyeYonu === "KAPALI") continue;

            const isAlacak = c.bakiyeYonu === "ALACAKLIYIZ";
            const role = c.cariTipi || (c.kod.startsWith("320") ? "TEDARIKCI" : "MUSTERI");
            const absBakiye = Math.abs(c.netBakiye);

            const effectiveDate = c.odemeSozuTarihi || c.enEskiAcikVade || new Date().toISOString().slice(0, 10);
            const daysDiff = this.daysDiffFromToday(effectiveDate);

            if (isAlacak) {
                if (daysDiff > 0) {
                    totalGecikenAlacak += absBakiye;
                    countGecikenAlacak++;
                    totalDueCount++;
                } else if (daysDiff >= -7) {
                    totalBuHaftaAlacak += absBakiye;
                    totalDueCount++;
                }
            } else {
                if (daysDiff > 0) {
                    totalGecikenBorc += absBakiye;
                    countGecikenBorc++;
                    totalDueCount++;
                } else if (daysDiff >= -7) {
                    totalBuHaftaBorc += absBakiye;
                    totalDueCount++;
                }
            }

            if (q) {
                const matchQ = (c.unvan || "").toLowerCase().includes(q) ||
                               (c.kod || "").toLowerCase().includes(q) ||
                               (c.ozelNot || "").toLowerCase().includes(q) ||
                               (c.yetkiliKisi || "").toLowerCase().includes(q);
                if (!matchQ) continue;
            }

            if (roleFilter === "ALACAK" && !isAlacak) continue;
            if (roleFilter === "BORC" && isAlacak) continue;

            if (timeFilter === "GECIKEN" && daysDiff <= 0) continue;
            if (timeFilter === "BUGUN" && daysDiff !== 0) continue;
            if (timeFilter === "BU_HAFTA" && (daysDiff < -7 || daysDiff > 0)) continue;
            if (timeFilter === "BU_AY" && (daysDiff < -30 || daysDiff > 0)) continue;

            if (typeFilter === "CEK" && !(c.odemeSekli || "").startsWith("CEK")) continue;
            if (typeFilter === "NAKIT" && (c.odemeSekli || "").startsWith("CEK")) continue;

            items.push({
                cari: c,
                isAlacak,
                role,
                absBakiye,
                effectiveDate,
                daysDiff,
                odemeSekli: c.odemeSekli || "NAKIT",
                vadeGunu: c.vadeGunu || 30
            });
        }

        items.sort((a, b) => b.daysDiff - a.daysDiff);

        const kpisEl = document.getElementById("hatirlaticiKpis");
        if (kpisEl) {
            kpisEl.innerHTML = `
                <div class="kpi-card borc" style="border-left: 4px solid #ef4444;">
                    <div class="kpi-label">🚨 Vadesi Geçen Müşteri Alacakları</div>
                    <div class="kpi-value text-borc">${this.formatMoney(totalGecikenAlacak)}</div>
                    <div class="kpi-sub">
                        <span><strong>${countGecikenAlacak} Müşteri</strong> aranmayı bekliyor</span>
                    </div>
                </div>
                <div class="kpi-card borc" style="border-left: 4px solid #f59e0b;">
                    <div class="kpi-label">⚠️ Vadesi Geçen Tedarikçi Borçlarımız</div>
                    <div class="kpi-value text-warn">${this.formatMoney(totalGecikenBorc)}</div>
                    <div class="kpi-sub">
                        <span><strong>${countGecikenBorc} Tedarikçi</strong> için ödeme gecikti</span>
                    </div>
                </div>
                <div class="kpi-card alacak" style="border-left: 4px solid #10b981;">
                    <div class="kpi-label">📅 Bu Hafta Beklenen Müşteri Tahsilatları</div>
                    <div class="kpi-value text-alacak">${this.formatMoney(totalBuHaftaAlacak)}</div>
                    <div class="kpi-sub">
                        <span>Önümüzdeki 7 gün içinde tahsil edilecek</span>
                    </div>
                </div>
                <div class="kpi-card" style="border-left: 4px solid #3b82f6;">
                    <div class="kpi-label">📅 Bu Hafta Yapılacak Ödemelerimiz</div>
                    <div class="kpi-value text-info">${this.formatMoney(totalBuHaftaBorc)}</div>
                    <div class="kpi-sub">
                        <span>Önümüzdeki 7 gün içinde nakit/çek çıkışı</span>
                    </div>
                </div>
            `;
        }

        const cntBadge = document.getElementById("cntHatirlatici");
        if (cntBadge) cntBadge.textContent = totalDueCount;

        tbody.innerHTML = items.map(it => {
            const c = it.cari;
            const rolBadge = it.isAlacak
                ? `<span class="badge badge-alacak">Müşteri (Alacak)</span>`
                : `<span class="badge badge-borc">Tedarikçi (Borç)</span>`;

            let odemeBadge = `<span class="badge badge-nakit">💵 Nakit / EFT</span>`;
            if (it.odemeSekli.startsWith("CEK")) {
                const days = it.vadeGunu || it.odemeSekli.split("_")[1] || 60;
                odemeBadge = `<span class="badge badge-cek">📑 ${days} Günlük Çek</span>`;
            } else if (it.odemeSekli === "KREDI_KARTI") {
                odemeBadge = `<span class="badge badge-purple">💳 Kredi Kartı / DBS</span>`;
            } else if (it.odemeSekli === "PESIN") {
                odemeBadge = `<span class="badge badge-alacak">⚡ Peşin</span>`;
            }

            let durumBadge = "";
            if (it.daysDiff > 0) {
                durumBadge = `<span class="badge badge-today">🚨 ${it.daysDiff} Gün Gecikti</span>`;
            } else if (it.daysDiff === 0) {
                durumBadge = `<span class="badge badge-warn">⚠️ BUGÜN VADESİ</span>`;
            } else if (it.daysDiff >= -7) {
                durumBadge = `<span class="badge badge-week">📅 ${Math.abs(it.daysDiff)} Gün Kaldı</span>`;
            } else {
                durumBadge = `<span class="badge badge-neutral">${Math.abs(it.daysDiff)} Gün Kaldı</span>`;
            }

            const notMetni = c.ozelNot
                ? `<div style="font-size:12px; font-weight:500;">${c.ozelNot}</div>`
                : `<div style="font-size:11.5px; color:var(--text-muted); font-style:italic;">Takip notu girilmedi</div>`;
            const yetkiliMetni = c.yetkiliKisi ? `<div style="font-size:11px; color:#94a3b8;">Yetkili: ${c.yetkiliKisi}</div>` : '';

            return `
                <tr>
                    <td>
                        <strong><a href="javascript:void(0)" onclick="App.openCariEkstre('${c.id}')" style="color:#60a5fa; text-decoration:none;">${c.unvan}</a></strong>
                        <div style="font-size:11.5px; color:var(--text-muted);">
                            <code>${c.kod}</code> ${c.telefon ? `• Tel: ${c.telefon}` : ''}
                        </div>
                    </td>
                    <td>${rolBadge}</td>
                    <td>${odemeBadge}</td>
                    <td class="num ${it.isAlacak ? 'text-alacak' : 'text-borc'}">
                        <strong>${this.formatMoney(it.absBakiye)}</strong>
                    </td>
                    <td>
                        <strong style="color:#f1f5f9;">${it.effectiveDate}</strong>
                        ${c.odemeSozuTarihi ? `<div style="font-size:11px; color:#c084fc;">(Söz Tarihi)</div>` : `<div style="font-size:11px; color:var(--text-muted);">(Fatura Vadesi)</div>`}
                    </td>
                    <td>${durumBadge}</td>
                    <td>
                        ${notMetni}
                        ${yetkiliMetni}
                    </td>
                    <td>
                        <div style="display:flex; gap:5px; flex-wrap:wrap;">
                            <button class="btn btn-outline btn-sm" onclick="App.openCariVadeModal('${c.id}')" title="Vade ve Ödeme Şeklini Düzenle">⚙️ Vade / Şart</button>
                            <button class="btn btn-outline btn-sm" onclick="App.copyWhatsAppReminderText('${c.id}')" title="WhatsApp veya SMS Hatırlatma Metnini Kopyala">💬 Not Kopyala</button>
                            <button class="btn btn-primary btn-sm" onclick="App.openCariEkstre('${c.id}')">Ekstre</button>
                            ${it.isAlacak
                                ? `<button class="btn btn-success btn-sm" onclick="App.openQuickTransactionModal('TAHSILAT', '${c.id}')">+Tahsilat</button>`
                                : `<button class="btn btn-danger btn-sm" onclick="App.openQuickTransactionModal('ODEME', '${c.id}')">-Ödeme</button>`
                            }
                        </div>
                    </td>
                </tr>
            `;
        }).join("") || `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">Seçilen filtrelere uygun vadesi yaklaşan veya geciken cari bulunmuyor.</td></tr>`;
    },

    exportHatirlaticiCsv() {
        const cariler = Object.values(this.computedCarilerMap).filter(c => c.bakiyeYonu !== "KAPALI");
        let csv = "\uFEFFCari Kod;Cari Unvan;Rol;Odeme Sekli;Vade Gunu;Net Bakiye;Vade/Soz Tarihi;Gecikme Gunu;Yetkili;Telefon;Ozel Not\n";
        for (const c of cariler) {
            const role = c.cariTipi || (c.kod.startsWith("320") ? "TEDARIKCI" : "MUSTERI");
            const v = c.odemeSozuTarihi || c.enEskiAcikVade || "";
            const days = this.daysDiffFromToday(v);
            csv += `"${c.kod}";"${(c.unvan || '').replace(/"/g, '""')}";"${role}";"${c.odemeSekli || 'NAKIT'}";"${c.vadeGunu || 30}";"${Math.abs(c.netBakiye || 0).toFixed(2)}";"${v}";"${days > 0 ? days : 0}";"${(c.yetkiliKisi || '').replace(/"/g, '""')}";"${c.telefon || ''}";"${(c.ozelNot || '').replace(/"/g, '""')}"\n`;
        }
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `SODSAN_Vade_Hatirlatici_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    },

    // ================= 3. CARİ HAREKETLER RENDER =================
    getHarTypeLabel(code) {
        const map = {
            SATIS_FATURA: "Satış Faturası",
            ALIS_FATURA: "Alış Faturası",
            TAHSILAT: "Tahsilat / Havale",
            ODEME: "Ödeme / EFT",
            CEK_SENET: "Çek / Senet",
            DEVIR: "Devir / Dekont",
            DEVIR_BORC: "Devir (Borç)",
            DEVIR_ALACAK: "Devir (Alacak)"
        };
        return map[code] || code || "Cari Hareket";
    },

    renderHareketler() {
        const q = (document.getElementById("harSearch")?.value || "").toLowerCase().trim();
        const typeFilter = document.getElementById("harFilterType")?.value || "ALL";
        const dStart = document.getElementById("harDateStart")?.value || "";
        const dEnd = document.getElementById("harDateEnd")?.value || "";

        let list = [...this.state.hareketler];

        if (q) {
            list = list.filter(h => {
                const c = this.computedCarilerMap[h.cariId] || {};
                return (c.unvan || h.cariUnvan || "").toLowerCase().includes(q) ||
                       (h.evrakNo || "").toLowerCase().includes(q) ||
                       (h.aciklama || "").toLowerCase().includes(q);
            });
        }

        if (typeFilter !== "ALL") {
            list = list.filter(h => {
                if (typeFilter === "DEVIR") return (h.islemTuru || "").includes("DEVIR");
                return h.islemTuru === typeFilter;
            });
        }

        if (dStart) list = list.filter(h => (h.tarih || "") >= dStart);
        if (dEnd) list = list.filter(h => (h.tarih || "") <= dEnd);

        list.sort((a, b) => (b.tarih || "").localeCompare(a.tarih || ""));

        document.getElementById("hareketlerTableBody").innerHTML = list.map(h => {
            const c = this.computedCarilerMap[h.cariId] || { unvan: h.cariUnvan || h.cariKod };
            const effVade = this.getEffectiveVadeTarihi(h.tarih, c);
            const vadeInfo = this.getVadeDurumu(effVade);
            return `
                <tr>
                    <td class="cell-date">${this.formatDisplayDate(h.tarih)}</td>
                    <td class="cell-date">
                        <div style="font-weight:600;">${this.formatDisplayDate(effVade)}</div>
                        <div style="font-size:10.5px; margin-top:2px;">${vadeInfo.html}</div>
                    </td>
                    <td class="cell-code"><code>${h.evrakNo || '-'}</code></td>
                    <td><strong><a href="javascript:void(0)" onclick="App.openCariEkstre('${h.cariId}')" style="color:#60a5fa; text-decoration:none;">${c.unvan}</a></strong></td>
                    <td class="nowrap"><span class="badge badge-neutral">${this.getHarTypeLabel(h.islemTuru)}</span></td>
                    <td style="max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${h.aciklama || ''}">${h.aciklama || '-'}</td>
                    <td class="num ${h.borc > 0 ? 'text-alacak' : ''}">${h.borc > 0 ? this.formatMoney(h.borc, h.doviz) : '-'}</td>
                    <td class="num ${h.alacak > 0 ? 'text-borc' : ''}">${h.alacak > 0 ? this.formatMoney(h.alacak, h.doviz) : '-'}</td>
                    <td class="nowrap"><span style="font-size:11.5px; color:var(--text-muted);">${h.kaynak || 'Manuel'}</span></td>
                    <td class="nowrap">
                        <button class="btn btn-outline btn-sm" onclick="App.deleteHareket('${h.id}')" title="Hareketi Sil">🗑️</button>
                    </td>
                </tr>
            `;
        }).join("") || `<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--text-muted);">Hareket bulunamadı.</td></tr>`;
    },

    clearHareketFilters() {
        document.getElementById("harSearch").value = "";
        document.getElementById("harFilterType").value = "ALL";
        document.getElementById("harDateStart").value = "";
        document.getElementById("harDateEnd").value = "";
        this.renderHareketler();
    },

    deleteHareket(harId) {
        if (!confirm("Bu cari hareketi silmek istediğinize emin misiniz? Cari bakiye yeniden hesaplanacaktır.")) return;
        const har = this.state.hareketler.find(x => x.id === harId);
        this.state.hareketler = this.state.hareketler.filter(x => x.id !== harId);
        if (har && har.evrakNo) {
            this.state.faturalar = this.state.faturalar.filter(f => f.faturaNo !== har.evrakNo);
        }
        this.saveState();
        this.recalculateAndRenderAll();
    },

    // ================= 4. ALIŞ & SATIŞ FATURALARI RENDER =================
    renderFaturalar() {
        const q = (document.getElementById("fatSearch")?.value || "").toLowerCase().trim();
        const yonFilter = document.getElementById("fatFilterYon")?.value || "ALL";
        const durumFilter = document.getElementById("fatFilterDurum")?.value || "ALL";

        let list = [...this.state.faturalar];

        if (q) {
            list = list.filter(f =>
                (f.faturaNo || "").toLowerCase().includes(q) ||
                (f.cariUnvan || "").toLowerCase().includes(q) ||
                (f.aciklama || "").toLowerCase().includes(q)
            );
        }

        if (yonFilter !== "ALL") {
            list = list.filter(f => f.yon === yonFilter);
        }

        const enriched = list.map(f => {
            const fifo = (this.faturaDurumMap && this.faturaDurumMap[f.faturaNo]) || {
                kapanan: 0,
                kalan: f.tlTutar || f.genelToplam,
                durum: "ACIK"
            };
            const c = this.computedCarilerMap[f.cariId] || this.state.cariler.find(x => x.id === f.cariId);
            const effVade = this.getEffectiveVadeTarihi(f.tarih, c);
            const gecikme = this.daysDiffFromToday(effVade);
            const vadeInfo = this.getVadeDurumu(effVade);
            return { ...f, effVade, fifo, gecikme, vadeInfo };
        });

        const filtered = enriched.filter(f => {
            if (durumFilter === "ACIK") return f.fifo.durum !== "KAPALI";
            if (durumFilter === "GECIKMIS") return f.fifo.durum !== "KAPALI" && f.gecikme > 0;
            if (durumFilter === "KAPALI") return f.fifo.durum === "KAPALI";
            return true;
        });

        filtered.sort((a, b) => (b.tarih || "").localeCompare(a.tarih || ""));

        document.getElementById("faturalarTableBody").innerHTML = filtered.map(f => {
            let durumBadge = `<span class="badge badge-alacak">Kapandı</span>`;
            if (f.fifo.durum === "KISMI") {
                durumBadge = `<span class="badge badge-warn">Kısmi Açık (${f.gecikme > 0 ? f.gecikme + 'g gecikti' : 'Vadeli'})</span>`;
            } else if (f.fifo.durum === "ACIK") {
                durumBadge = f.gecikme > 0
                    ? `<span class="badge badge-borc">Açık (${f.gecikme} gün gecikti)</span>`
                    : `<span class="badge badge-neutral">Açık (Vadeli)</span>`;
            }

            return `
                <tr>
                    <td class="cell-date">${this.formatDisplayDate(f.tarih)}</td>
                    <td class="cell-date">
                        <div style="font-weight:600;">${this.formatDisplayDate(f.effVade || f.tarih)}</div>
                        <div style="font-size:10.5px; margin-top:2px;">${f.vadeInfo ? f.vadeInfo.html : ''}</div>
                    </td>
                    <td class="cell-code"><code>${f.faturaNo}</code></td>
                    <td class="nowrap">
                        <span class="badge ${f.yon === 'SATIS' ? 'badge-alacak' : 'badge-borc'}">
                            ${f.yon === 'SATIS' ? 'Satış' : 'Alış'}
                        </span>
                    </td>
                    <td><strong><a href="javascript:void(0)" onclick="App.openCariEkstre('${f.cariId}')" style="color:#60a5fa; text-decoration:none;">${f.cariUnvan}</a></strong></td>
                    <td class="num">${this.formatMoney(f.tlTutar || f.genelToplam)}</td>
                    <td class="num" style="color:#94a3b8;">${this.formatMoney(f.fifo.kapanan)}</td>
                    <td class="num ${f.fifo.kalan > 0 ? (f.yon === 'SATIS' ? 'text-alacak' : 'text-borc') : ''}">
                        <strong>${this.formatMoney(f.fifo.kalan)}</strong>
                    </td>
                    <td class="nowrap">${durumBadge}</td>
                    <td class="nowrap">
                        <button class="btn btn-outline btn-sm" onclick="App.openCariEkstre('${f.cariId}')">Cari Ekstre</button>
                    </td>
                </tr>
            `;
        }).join("") || `<tr><td colspan="10" style="text-align:center; padding:24px; color:var(--text-muted);">Henüz fatura kaydı bulunmuyor. Zirve'den fatura veya ekstre dosyası yükleyin.</td></tr>`;
    },

    // ================= 5. YAŞLANDIRMA & NAKİT AKIŞI TAKVİMİ =================
    renderYaslandirmaAndCalendar() {
        const cariler = Object.values(this.computedCarilerMap).filter(c => c.bakiyeYonu !== "KAPALI");

        const sumAlacak = { overdue60Plus: 0, overdue31_60: 0, overdue1_30: 0, upcoming0_30: 0, upcoming31Plus: 0 };
        const sumBorc = { overdue60Plus: 0, overdue31_60: 0, overdue1_30: 0, upcoming0_30: 0, upcoming31Plus: 0 };

        for (const c of cariler) {
            const target = c.bakiyeYonu === "ALACAKLIYIZ" ? sumAlacak : sumBorc;
            target.overdue60Plus += c.aging.overdue60Plus;
            target.overdue31_60 += c.aging.overdue31_60;
            target.overdue1_30 += c.aging.overdue1_30;
            target.upcoming0_30 += c.aging.upcoming0_30;
            target.upcoming31Plus += c.aging.upcoming31Plus;
        }

        const renderBuckets = (b, colorClass) => `
            <div class="aging-box"><div class="title">60+ Gün Gecikmiş</div><div class="amt ${colorClass}">${this.formatMoney(b.overdue60Plus)}</div></div>
            <div class="aging-box"><div class="title">31-60 Gün Gecikmiş</div><div class="amt ${colorClass}">${this.formatMoney(b.overdue31_60)}</div></div>
            <div class="aging-box"><div class="title">1-30 Gün Gecikmiş</div><div class="amt ${colorClass}">${this.formatMoney(b.overdue1_30)}</div></div>
            <div class="aging-box"><div class="title">Vadesi Gelmemiş (0-30g)</div><div class="amt">${this.formatMoney(b.upcoming0_30)}</div></div>
            <div class="aging-box"><div class="title">Vadesi Gelmemiş (31+g)</div><div class="amt">${this.formatMoney(b.upcoming31Plus)}</div></div>
        `;

        document.getElementById("alacakAgingBoxes").innerHTML = renderBuckets(sumAlacak, "text-alacak");
        document.getElementById("borcAgingBoxes").innerHTML = renderBuckets(sumBorc, "text-borc");

        document.getElementById("agingMatrixBody").innerHTML = cariler
            .sort((a, b) => Math.abs(b.netBakiye) - Math.abs(a.netBakiye))
            .map(c => `
                <tr>
                    <td><strong><a href="javascript:void(0)" onclick="App.openCariEkstre('${c.id}')" style="color:#60a5fa; text-decoration:none;">${c.unvan}</a></strong></td>
                    <td><span class="badge ${c.bakiyeYonu === 'ALACAKLIYIZ' ? 'badge-alacak' : 'badge-borc'}">${c.bakiyeYonu === 'ALACAKLIYIZ' ? 'Alacağımız' : 'Borcumuz'}</span></td>
                    <td class="num">${this.formatMoney(c.aging.overdue60Plus)}</td>
                    <td class="num">${this.formatMoney(c.aging.overdue31_60)}</td>
                    <td class="num">${this.formatMoney(c.aging.overdue1_30)}</td>
                    <td class="num">${this.formatMoney(c.aging.upcoming0_30)}</td>
                    <td class="num">${this.formatMoney(c.aging.upcoming31Plus)}</td>
                    <td class="num ${c.bakiyeYonu === 'ALACAKLIYIZ' ? 'text-alacak' : 'text-borc'}"><strong>${this.formatMoney(Math.abs(c.netBakiye))}</strong></td>
                </tr>
            `).join("") || `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">Henüz açık bakiyeli cari hesap bulunmuyor. Zirve'den rapor yükleyin.</td></tr>`;

        // Nakit Akışı Takvimi
        const calItems = this.buildCashflowItems();
        document.getElementById("cashflowCalendarBody").innerHTML = calItems.map(item => `
            <tr>
                <td><strong>${item.tarih}</strong></td>
                <td>
                    ${item.gunDiff > 0
                        ? `<span class="badge badge-warn">${item.gunDiff} gün gecikti</span>`
                        : item.gunDiff === 0
                        ? `<span class="badge badge-purple">Bugün</span>`
                        : `<span class="badge badge-neutral">${Math.abs(item.gunDiff)} gün kaldı</span>`}
                </td>
                <td><span class="badge ${item.yon === 'GIRIS' ? 'badge-alacak' : 'badge-borc'}">${item.turLabel}</span></td>
                <td><strong>${item.cariUnvan}</strong></td>
                <td>${item.aciklama}</td>
                <td class="num text-alacak">${item.yon === 'GIRIS' ? this.formatMoney(item.tutar) : '-'}</td>
                <td class="num text-borc">${item.yon === 'CIKIS' ? this.formatMoney(item.tutar) : '-'}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="App.openCariEkstre('${item.cariId}')">Cariye Git</button>
                </td>
            </tr>
        `).join("") || `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">Takvimde kayıtlı açık işlem bulunmuyor.</td></tr>`;
    },

    buildCashflowItems() {
        const items = [];
        const cariler = Object.values(this.computedCarilerMap);

        for (const c of cariler) {
            if (c.bakiyeYonu === "KAPALI") continue;

            // 1. Eğer cari için özel Ödeme Sözü Tarihi girilmişse onu öncelikli göster
            if (c.odemeSozuTarihi) {
                items.push({
                    tarih: c.odemeSozuTarihi,
                    gunDiff: this.daysDiffFromToday(c.odemeSozuTarihi),
                    yon: c.bakiyeYonu === "ALACAKLIYIZ" ? "GIRIS" : "CIKIS",
                    turLabel: "Ödeme Sözü",
                    cariId: c.id,
                    cariUnvan: c.unvan,
                    aciklama: c.ozelNot || "Cari ödeme sözü",
                    tutar: c.odemeSozuTutar || Math.abs(c.netBakiye)
                });
            }

            // 2. Carinin FIFO sonrası kalan açık kalemleri
            for (const ak of c.acikKalemler) {
                items.push({
                    tarih: ak.vade,
                    gunDiff: ak.gecikme,
                    yon: c.bakiyeYonu === "ALACAKLIYIZ" ? "GIRIS" : "CIKIS",
                    turLabel: c.bakiyeYonu === "ALACAKLIYIZ" ? "Tahsil Edilecek (FIFO)" : "Ödenecek (FIFO)",
                    cariId: c.id,
                    cariUnvan: c.unvan,
                    aciklama: `${ak.evrakNo || ''} - ${ak.aciklama || ''}`,
                    tutar: ak.acikKalan
                });
            }
        }

        // 3. Portföydeki çek/senetler
        for (const cs of this.state.ceksenetler) {
            if (cs.durum === "PORTFOYDE" || cs.durum === "ODENECEK") {
                items.push({
                    tarih: cs.vadeTarihi,
                    gunDiff: this.daysDiffFromToday(cs.vadeTarihi),
                    yon: cs.yon === "ALINAN" ? "GIRIS" : "CIKIS",
                    turLabel: cs.yon === "ALINAN" ? "Alınan Çek/Senet" : "Verilen Çek/Senet",
                    cariId: cs.cariId,
                    cariUnvan: cs.cariUnvan,
                    aciklama: `${cs.banka} (${cs.evrakNo})`,
                    tutar: parseFloat(cs.tutar) || 0
                });
            }
        }

        items.sort((a, b) => (a.tarih || "").localeCompare(a.tarih || ""));
        return items;
    },

    // ================= 6. ÇEK / SENET RENDER =================
    renderCekSenet() {
        const alinanPortfoy = this.state.ceksenetler
            .filter(x => x.yon === "ALINAN" && x.durum === "PORTFOYDE")
            .reduce((s, x) => s + (parseFloat(x.tutar) || 0), 0);
        const verilenOdenecek = this.state.ceksenetler
            .filter(x => x.yon === "VERILEN" && x.durum === "ODENECEK")
            .reduce((s, x) => s + (parseFloat(x.tutar) || 0), 0);

        document.getElementById("treasuryKpis").innerHTML = `
            <div class="kpi-card alacak">
                <div class="kpi-label">Portföydeki Çek / Senetler</div>
                <div class="kpi-value text-alacak">${this.formatMoney(alinanPortfoy)}</div>
            </div>
            <div class="kpi-card borc">
                <div class="kpi-label">Ödenecek Çek / Senetler</div>
                <div class="kpi-value text-borc">${this.formatMoney(verilenOdenecek)}</div>
            </div>
            <div class="kpi-card net">
                <div class="kpi-label">Net Çek / Senet Pozisyonu</div>
                <div class="kpi-value">${this.formatMoney(alinanPortfoy - verilenOdenecek)}</div>
            </div>
        `;

        document.getElementById("cekSenetTableBody").innerHTML = this.state.ceksenetler.map(cs => `
            <tr>
                <td><strong>${cs.vadeTarihi}</strong></td>
                <td><span class="badge ${cs.yon === 'ALINAN' ? 'badge-alacak' : 'badge-borc'}">${cs.tur}</span></td>
                <td><strong>${cs.cariUnvan}</strong></td>
                <td>${cs.banka} - <code>${cs.evrakNo}</code></td>
                <td class="num">${this.formatMoney(cs.tutar)}</td>
                <td><span class="badge badge-purple">${cs.durum}</span></td>
                <td>
                    ${(cs.durum === 'PORTFOYDE' || cs.durum === 'ODENECEK')
                        ? `<button class="btn btn-success btn-sm" onclick="App.completeCekSenet('${cs.id}')">Tamamlandı</button>`
                        : `<span style="color:var(--text-muted); font-size:12px;">Tamamlandı</span>`}
                </td>
            </tr>
        `).join("") || `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">Henüz çek veya senet kaydı bulunmuyor.</td></tr>`;
    },

    openCekSenetModal(defaultDirection) {
        this.populateCariSelect("csCariId");
        document.getElementById("csKind").value = defaultDirection === "VERILEN" ? "VERILEN_CEK" : "ALINAN_CEK";
        document.getElementById("csDueDate").value = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        document.getElementById("csBank").value = "";
        document.getElementById("csDocNo").value = "ÇK-" + Math.floor(Math.random() * 9000 + 1000);
        document.getElementById("csAmount").value = "";
        document.getElementById("cekSenetModal").classList.add("active");
    },

    saveCekSenet() {
        const cariId = document.getElementById("csCariId").value;
        const cari = this.state.cariler.find(c => c.id === cariId);
        if (!cari) return alert("Lütfen cari hesap seçin.");

        const kind = document.getElementById("csKind").value;
        const vade = document.getElementById("csDueDate").value;
        const banka = document.getElementById("csBank").value.trim() || "Banka Çeki";
        const docNo = document.getElementById("csDocNo").value.trim() || "ÇK-001";
        const amount = parseFloat(document.getElementById("csAmount").value) || 0;
        const postToCari = document.getElementById("csPostToCari").value === "YES";

        if (amount <= 0) return alert("Lütfen geçerli bir tutar girin.");

        const yon = kind.startsWith("ALINAN") ? "ALINAN" : "VERILEN";
        const csObj = {
            id: "CS-" + Date.now(),
            cariId: cari.id,
            cariUnvan: cari.unvan,
            yon,
            tur: kind.replace("_", " "),
            vadeTarihi: vade,
            banka,
            evrakNo: docNo,
            tutar: amount,
            durum: yon === "ALINAN" ? "PORTFOYDE" : "ODENECEK"
        };
        this.state.ceksenetler.push(csObj);

        if (postToCari) {
            // Alınan çek müşterinin cari hesabını alacaklandırır (borcunu düşürür). Verilen çek tedarikçi carisini borçlandırır.
            this.state.hareketler.push({
                id: "HAR-" + Date.now(),
                cariId: cari.id,
                cariKod: cari.kod,
                cariUnvan: cari.unvan,
                tarih: new Date().toISOString().slice(0, 10),
                vadeTarihi: vade,
                evrakNo: docNo,
                islemTuru: "CEK_SENET",
                aciklama: `${csObj.tur} (${banka} - Vade: ${vade})`,
                borc: yon === "VERILEN" ? amount : 0,
                alacak: yon === "ALINAN" ? amount : 0,
                doviz: "TRY",
                kur: 1,
                kaynak: "Çek/Senet Bordrosu"
            });
        }

        this.closeModal("cekSenetModal");
        this.saveState();
        this.recalculateAndRenderAll();
    },

    completeCekSenet(id) {
        const item = this.state.ceksenetler.find(x => x.id === id);
        if (!item) return;
        item.durum = item.yon === "ALINAN" ? "TAHSIL_EDILDI" : "ODENDI";
        this.saveState();
        this.recalculateAndRenderAll();
    },

    // ================= HIZLI TAHSİLAT / ÖDEME / CARİ HAREKET GİRİŞİ =================
    populateCariSelect(selectId, selectedCariId = "") {
        const sel = document.getElementById(selectId);
        if (!sel) return;
        sel.innerHTML = this.state.cariler
            .slice()
            .sort((a, b) => a.unvan.localeCompare(b.unvan, "tr"))
            .map(c => {
                const comp = this.computedCarilerMap[c.id];
                const bakiyeTxt = comp ? ` (${this.formatMoney(Math.abs(comp.netBakiye))} ${comp.bakiyeYonu === 'ALACAKLIYIZ' ? 'Alacağımız' : (comp.bakiyeYonu === 'BORCLUYUZ' ? 'Borcumuz' : '0')})` : "";
                return `<option value="${c.id}" ${c.id === selectedCariId ? 'selected' : ''}>${c.unvan} [${c.kod}]${bakiyeTxt}</option>`;
            }).join("");
    },

    openQuickTransactionModal(defaultType = "TAHSILAT", preselectedCariId = "") {
        this.populateCariSelect("trCariId", preselectedCariId);
        document.getElementById("trType").value = defaultType;
        const today = new Date().toISOString().slice(0, 10);
        document.getElementById("trDate").value = today;
        document.getElementById("trDueDate").value = today;
        document.getElementById("trDocNo").value = (defaultType === "TAHSILAT" ? "THS-" : defaultType === "ODEME" ? "ODM-" : "EVR-") + Math.floor(Math.random() * 9000 + 1000);

        if (preselectedCariId && this.computedCarilerMap[preselectedCariId]) {
            const c = this.computedCarilerMap[preselectedCariId];
            document.getElementById("trAmount").value = Math.abs(c.netBakiye) > 0 ? Math.abs(c.netBakiye) : "";
        } else {
            document.getElementById("trAmount").value = "";
        }

        document.getElementById("trDesc").value = "";
        this.onTrTypeChange();
        document.getElementById("transactionModal").classList.add("active");
    },

    onTrTypeChange() {
        const t = document.getElementById("trType").value;
        const titleEl = document.getElementById("transModalTitle");
        if (t === "TAHSILAT") titleEl.textContent = "🟢 Müşteriden Tahsilat / Gelen Havale Girişi";
        else if (t === "ODEME") titleEl.textContent = "🔴 Tedarikçiye Ödeme / Gönderilen EFT Girişi";
        else titleEl.textContent = "📑 Cari Hesap Hareketi Girişi";
    },

    saveTransaction() {
        const cariId = document.getElementById("trCariId").value;
        const cari = this.state.cariler.find(c => c.id === cariId);
        if (!cari) return alert("Lütfen bir cari hesap seçin.");

        const type = document.getElementById("trType").value;
        const channel = document.getElementById("trChannel").value;
        const tarih = document.getElementById("trDate").value || new Date().toISOString().slice(0, 10);
        const vade = document.getElementById("trDueDate").value || tarih;
        const amount = parseFloat(document.getElementById("trAmount").value) || 0;
        const cur = document.getElementById("trCurrency").value || "TRY";
        const docNo = document.getElementById("trDocNo").value.trim() || ("EVR-" + Date.now());
        const desc = document.getElementById("trDesc").value.trim() || `${channel} ile ${this.getHarTypeLabel(type)}`;

        if (amount <= 0) return alert("Lütfen 0'dan büyük bir tutar girin.");

        // Muhasebe Cari Mantığı:
        // Satış Faturası, Tedarikçiye Ödeme, Devir Borç -> Cari BORÇLANIR (borc = amount)
        // Alış Faturası, Müşteriden Tahsilat, Devir Alacak -> Cari ALACAKLANIR (alacak = amount)
        let borc = 0;
        let alacak = 0;
        if (type === "ODEME" || type === "SATIS_FATURA" || type === "DEVIR_BORC") {
            borc = amount;
        } else {
            alacak = amount;
        }

        const newHar = {
            id: "HAR-" + Date.now(),
            cariId: cari.id,
            cariKod: cari.kod,
            cariUnvan: cari.unvan,
            tarih,
            vadeTarihi: vade,
            evrakNo: docNo,
            islemTuru: type,
            aciklama: desc,
            borc,
            alacak,
            doviz: cur,
            kur: cur === "TRY" ? 1 : (this.state.settings.rates[cur] || 1),
            kaynak: channel
        };

        this.state.hareketler.push(newHar);

        if (type === "SATIS_FATURA" || type === "ALIS_FATURA") {
            this.state.faturalar.push({
                id: "FAT-" + Date.now(),
                faturaNo: docNo,
                tarih,
                vadeTarihi: vade,
                yon: type === "SATIS_FATURA" ? "SATIS" : "ALIS",
                cariId: cari.id,
                cariUnvan: cari.unvan,
                doviz: cur,
                genelToplam: amount,
                tlTutar: this.getTlEquivalent(amount, cur),
                aciklama: desc
            });
        }

        this.closeModal("transactionModal");
        this.saveState();
        this.recalculateAndRenderAll();
    },

    openManualInvoiceModal() {
        this.openQuickTransactionModal("SATIS_FATURA");
    },

    // ================= YENİ CARİ KART MODAL =================
    openCariModal() {
        document.getElementById("cmKod").value = "120.01." + String(this.state.cariler.length + 1).padStart(3, "0");
        document.getElementById("cmVkn").value = "";
        document.getElementById("cmUnvan").value = "";
        document.getElementById("cmTel").value = "";
        document.getElementById("cmVade").value = "30";
        document.getElementById("cmDevirBorc").value = "0";
        document.getElementById("cmDevirAlacak").value = "0";
        document.getElementById("cariModal").classList.add("active");
    },

    saveCariCard() {
        const kod = document.getElementById("cmKod").value.trim() || ("CR-" + Date.now());
        const unvan = document.getElementById("cmUnvan").value.trim();
        if (!unvan) return alert("Lütfen cari ünvanını girin.");

        const devirBorc = parseFloat(document.getElementById("cmDevirBorc").value) || 0;
        const devirAlacak = parseFloat(document.getElementById("cmDevirAlacak").value) || 0;

        const newCari = {
            id: "C-" + Date.now(),
            kod,
            unvan,
            vkn: document.getElementById("cmVkn").value.trim(),
            telefon: document.getElementById("cmTel").value.trim(),
            vadeGunu: parseInt(document.getElementById("cmVade").value, 10) || 30,
            doviz: "TRY",
            kaynak: "Manuel"
        };
        this.state.cariler.push(newCari);

        if (devirBorc > 0 || devirAlacak > 0) {
            this.state.hareketler.push({
                id: "HAR-DEV-" + Date.now(),
                cariId: newCari.id,
                cariKod: newCari.kod,
                cariUnvan: newCari.unvan,
                tarih: new Date().getFullYear() + "-01-01",
                vadeTarihi: new Date().toISOString().slice(0, 10),
                evrakNo: "DEVIR-" + new Date().getFullYear(),
                islemTuru: devirBorc > 0 ? "DEVIR_BORC" : "DEVIR_ALACAK",
                aciklama: "Açılış Devir Bakiyesi",
                borc: devirBorc,
                alacak: devirAlacak,
                doviz: "TRY",
                kur: 1,
                kaynak: "Açılış Devri"
            });
        }

        this.closeModal("cariModal");
        this.saveState();
        this.recalculateAndRenderAll();
    },

    closeModal(id) {
        document.getElementById(id)?.classList.remove("active");
    },

    // ================= EXCEL / PDF / CSV / MİZAN YÜKLEME =================
    async handleAnyFileSelected(file) {
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === "xml") {
            await this.handleXmlFilesSelected([file]);
            return;
        }

        await this.handleExcelFileSelected(file);
    },

    async handleExcelFileSelected(file) {
        if (!file) return;
        try {
            const res = await window.ZirveExcelImporter.processFile(file, this);
            let msg = `✅ Zirve Dosyası Başarıyla İçe Aktarıldı!\n\n• ${res.cariler} Cari Hesap işlendi.\n• ${res.hareketler} Cari Hareket / İşlem kaydedildi.`;
            if (res.faturalar) msg += `\n• ${res.faturalar} Fatura yaşlandırmaya alındı.`;
            if (res.ceksenet) msg += `\n• ${res.ceksenet} Çek/Senet portföye eklendi.`;
            msg += `\n• Toplam Aktif Cari: ${res.totalCariler || this.state.cariler.length}\n\nTüm bakiyeler, gecikmiş vadeler ve nakit akışı takvimi otomatik hesaplandı.`;
            alert(msg);
        } catch (e) {
            alert("❌ Dosya okuma hatası: " + e.message);
        }
    },

    // ================= SÜRÜKLE & BIRAK (DRAG & DROP) =================
    setupDragAndDrop() {
        const dropzones = [document.getElementById("globalDropzone"), document.getElementById("xmlDropzone")].filter(Boolean);

        dropzones.forEach(dz => {
            dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("dragover"); });
            dz.addEventListener("dragleave", () => { dz.classList.remove("dragover"); });
            dz.addEventListener("drop", async e => {
                e.preventDefault();
                dz.classList.remove("dragover");
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    for (const f of e.dataTransfer.files) {
                        await this.handleAnyFileSelected(f);
                    }
                }
            });
        });

        // Tüm pencereye sürüklemeyi de destekle
        window.addEventListener("dragover", e => e.preventDefault());
        window.addEventListener("drop", async e => {
            // Eğer belirli bir input hedeflenmediyse
            if (e.target.tagName !== "INPUT" && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const first = e.dataTransfer.files[0];
                const ext = first.name.split('.').pop().toLowerCase();
                if (["xlsx", "xls", "csv", "pdf", "xml", "txt"].includes(ext)) {
                    e.preventDefault();
                    await this.handleAnyFileSelected(first);
                }
            }
        });
    },

    async handleXmlFilesSelected(fileList) {
        let added = 0;
        let skipped = 0;
        for (const file of fileList) {
            try {
                const text = await file.text();
                const res = this.ingestSingleUblXml(text);
                if (res === "ADDED") added++;
                else skipped++;
            } catch (e) {
                console.error("XML okuma hatası:", file.name, e);
            }
        }
        this.saveState();
        this.recalculateAndRenderAll();
        alert(`XML Aktarımı Tamamlandı:\n• ${added} yeni e-Fatura Cari Hesaplara ve Faturalara işlendi.\n• ${skipped} mükerrer fatura atlandı.`);
    },

    ingestSingleUblXml(xmlString) {
        const parsed = window.UblParser.parseXml(
            xmlString,
            this.state.settings.ownFirmVkn,
            this.state.settings.ownFirmName
        );

        // Mükerrer kontrolü
        const exists = this.state.faturalar.some(f =>
            (parsed.ettn && f.ettn === parsed.ettn) ||
            (f.faturaNo === parsed.faturaNo && f.cariUnvan === parsed.karsiTaraf.unvan)
        );
        if (exists) return "SKIPPED";

        // Cari kartı bul veya oluştur
        let cari = this.state.cariler.find(c =>
            (parsed.karsiTaraf.vkn && c.vkn === parsed.karsiTaraf.vkn) ||
            c.unvan.toUpperCase() === (parsed.karsiTaraf.unvan || "").toUpperCase()
        );

        if (!cari) {
            cari = {
                id: "C-XML-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
                kod: (parsed.yon === "SATIS" ? "120.01." : "320.01.") + String(this.state.cariler.length + 1).padStart(3, "0"),
                unvan: parsed.karsiTaraf.unvan || "e-Fatura Carisi",
                vkn: parsed.karsiTaraf.vkn || "",
                vergiDairesi: parsed.karsiTaraf.vergiDairesi || "",
                telefon: parsed.karsiTaraf.tel || "",
                email: parsed.karsiTaraf.email || "",
                vadeGunu: 30,
                doviz: parsed.doviz || "TRY",
                kaynak: "Zirve e-Fatura XML"
            };
            this.state.cariler.push(cari);
        }

        // Vade tarihi yoksa cari vade gününü ekle
        let vadeTarihi = parsed.vadeTarihi;
        if (!vadeTarihi) {
            const dt = new Date(parsed.tarih);
            dt.setDate(dt.getDate() + (cari.vadeGunu || 30));
            vadeTarihi = dt.toISOString().slice(0, 10);
        }

        // 1. Faturalar tablosuna ekle
        this.state.faturalar.push({
            id: "FAT-XML-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
            faturaNo: parsed.faturaNo,
            ettn: parsed.ettn,
            tarih: parsed.tarih,
            vadeTarihi,
            yon: parsed.yon,
            cariId: cari.id,
            cariUnvan: cari.unvan,
            doviz: parsed.doviz,
            kur: parsed.kur,
            matrah: parsed.matrah,
            kdv: parsed.kdv,
            genelToplam: parsed.genelToplam,
            tlTutar: parsed.tlTutar,
            aciklama: parsed.kalemler.map(k => k.ad).slice(0, 2).join(", ") || parsed.aciklama
        });

        // 2. Cari Hareketlere ekle (Satış faturası cariyi borçlandırır, Alış faturası cariyi alacaklandırır)
        this.state.hareketler.push({
            id: "HAR-XML-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
            cariId: cari.id,
            cariKod: cari.kod,
            cariUnvan: cari.unvan,
            tarih: parsed.tarih,
            vadeTarihi,
            evrakNo: parsed.faturaNo,
            islemTuru: parsed.yon === "SATIS" ? "SATIS_FATURA" : "ALIS_FATURA",
            aciklama: `e-Fatura (${parsed.kalemler.map(k => k.ad).slice(0, 2).join(", ") || parsed.faturaTipKodu})`,
            borc: parsed.yon === "SATIS" ? parsed.genelToplam : 0,
            alacak: parsed.yon === "ALIS" ? parsed.genelToplam : 0,
            doviz: parsed.doviz,
            kur: parsed.kur,
            kaynak: "Zirve e-Fatura XML"
        });

        return "ADDED";
    },

    // ================= 7. ZİRVE SQL & KLASÖR SENKRONİZASYONU =================
    toggleSqlAuthInputs() {
        const isSql = document.getElementById("sqlAuthType").value === "sql";
        document.querySelectorAll(".sql-auth-field").forEach(el => {
            el.style.display = isSql ? "flex" : "none";
        });
    },

    getSqlConfigFromUi() {
        return {
            server: document.getElementById("sqlServerInput").value.trim() || ".\\ZIRVESQL",
            authType: document.getElementById("sqlAuthType").value,
            user: document.getElementById("sqlUserInput").value.trim(),
            password: document.getElementById("sqlPassInput").value,
            database: document.getElementById("sqlDatabaseSelect").value,
            customCariTable: document.getElementById("sqlCustomCariTable")?.value || "",
            customCariHarTable: document.getElementById("sqlCustomCariHarTable")?.value || ""
        };
    },

    async onDatabaseSelected() {
        const db = document.getElementById("sqlDatabaseSelect").value;
        if (db) {
            await this.inspectCurrentDatabaseTables(false);
        }
    },

    async inspectCurrentDatabaseTables(showAlert = true) {
        const cfg = this.getSqlConfigFromUi();
        if (!cfg.database) {
            if (showAlert) alert("Lütfen önce bir veritabanı seçin.");
            return;
        }

        const mapSec = document.getElementById("tableMappingSection");
        const badgeArea = document.getElementById("tableListBadgeArea");
        const cariSel = document.getElementById("sqlCustomCariTable");
        const harSel = document.getElementById("sqlCustomCariHarTable");

        if (badgeArea) badgeArea.innerHTML = `<span class="text-info">Tablolar listeleniyor...</span>`;
        if (mapSec) mapSec.style.display = "block";

        try {
            const res = await fetch("/api/sql/tables", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cfg)
            });
            const data = await res.json();
            if (!data.ok) {
                if (badgeArea) badgeArea.innerHTML = `<span class="text-borc">Hata: ${data.error}</span>`;
                return;
            }

            const tables = data.tables || [];
            let cariOptions = `<option value="">-- Otomatik Bul --</option>`;
            let harOptions = `<option value="">-- Otomatik Bul --</option>`;
            let badgesHtml = "";

            let autoCariGuess = "";
            let autoHarGuess = "";

            tables.forEach(t => {
                const name = t.TableName || t.name;
                const rows = t.RowCnt !== undefined ? t.RowCnt : t.rows;
                const upper = name.toUpperCase();

                const isCariCand = upper === "CARI" || upper.includes("CARIKART") || upper === "TBLCARI" || (upper.includes("CARI") && !upper.includes("HAR"));
                const isHarCand = upper === "CARIHAR" || upper.includes("CARI_HAREKET") || upper.includes("CHAREKET") || upper.includes("HAREKET");

                if (isCariCand && !autoCariGuess) autoCariGuess = name;
                if (isHarCand && !autoHarGuess) autoHarGuess = name;

                cariOptions += `<option value="${name}">${name} (${rows} kayıt)${isCariCand ? ' ⭐' : ''}</option>`;
                harOptions += `<option value="${name}">${name} (${rows} kayıt)${isHarCand ? ' ⭐' : ''}</option>`;

                badgesHtml += `
                    <span class="badge ${isCariCand ? 'badge-alacak' : isHarCand ? 'badge-borc' : 'badge-neutral'}" style="margin:2px; cursor:pointer;" onclick="App.quickSelectTable('${name}', '${isCariCand ? 'cari' : isHarCand ? 'har' : ''}')">
                        ${name} (${rows})
                    </span>
                `;
            });

            if (cariSel) {
                cariSel.innerHTML = cariOptions;
                if (autoCariGuess) cariSel.value = autoCariGuess;
            }
            if (harSel) {
                harSel.innerHTML = harOptions;
                if (autoHarGuess) harSel.value = autoHarGuess;
            }
            if (badgeArea) {
                badgeArea.innerHTML = `
                    <div style="margin-bottom:6px; color:var(--text-muted);">
                        Bulunan <strong>${tables.length}</strong> tablo (Kayıt sayılarıyla): Bir tabloya tıklayarak da atayabilirsiniz:
                    </div>
                    ${badgesHtml || 'Hiç tablo bulunamadı.'}
                `;
            }
        } catch (e) {
            if (badgeArea) badgeArea.innerHTML = `<span class="text-borc">Tablolar alınamadı: ${e.message}</span>`;
        }
    },

    quickSelectTable(tableName, hintType) {
        if (hintType === "cari" || (!hintType && tableName.toUpperCase().includes("CARI") && !tableName.toUpperCase().includes("HAR"))) {
            const sel = document.getElementById("sqlCustomCariTable");
            if (sel) sel.value = tableName;
        } else {
            const sel = document.getElementById("sqlCustomCariHarTable");
            if (sel) sel.value = tableName;
        }
    },

    setSqlServerName(name) {
        const inp = document.getElementById("sqlServerInput");
        if (inp) {
            inp.value = name;
        }
        this.loadSqlDatabases();
    },

    async discoverZirveSql() {
        const box = document.getElementById("sqlDiscoveryResult");
        box.innerHTML = `<div class="badge badge-neutral">🔍 Bilgisayardaki SQL Server servisleri taranıyor...</div>`;
        try {
            const res = await fetch("/api/sql/discover", { method: "POST" });
            const data = await res.json();
            if (!data.ok) {
                box.innerHTML = `<div class="badge badge-borc">Hata: ${data.error}</div>`;
                return;
            }

            const instances = data.instances || [];
            const services = data.services || [];

            let badgeHtml = "";
            let autoSelected = false;

            // 1. Zirve için bulunan SQL Instance'ları
            instances.forEach(inst => {
                const isZirve = inst.server.toUpperCase().includes("ZIRVE");
                const isDinamo = inst.server.toUpperCase().includes("DINAMO");

                if (!isDinamo) {
                    badgeHtml += `
                        <button type="button" class="btn btn-sm ${isZirve ? 'btn-success' : 'btn-outline'}" style="margin:2px;" onclick="App.setSqlServerName('${inst.server}')">
                            ${isZirve ? '🎯 ZİRVE:' : '🔌'} ${inst.server} (${inst.databases?.length || 0} DB)
                        </button>
                    `;
                    if (!autoSelected) {
                        document.getElementById("sqlServerInput").value = inst.server;
                        document.getElementById("sqlAuthType").value = inst.authType;
                        if (inst.user) document.getElementById("sqlUserInput").value = inst.user;
                        if (inst.password) document.getElementById("sqlPassInput").value = inst.password;
                        this.toggleSqlAuthInputs();

                        const dbSel = document.getElementById("sqlDatabaseSelect");
                        if (dbSel && inst.databases) {
                            dbSel.innerHTML = `<option value="">-- Veritabanı Seçin --</option>` + inst.databases.map(db => `<option value="${db}">${db}</option>`).join("");
                        }
                        autoSelected = true;
                    }
                }
            });

            let statusTxt = "";
            if (autoSelected) {
                statusTxt = `
                    <div style="background:var(--bg-card); border:1px solid #10b981; border-radius:8px; padding:10px 14px; margin-bottom:8px;">
                        <span style="color:#10b981; font-weight:700;">✅ Tespit Edilen SQL Sunucuları:</span>
                        <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                            ${badgeHtml}
                        </div>
                    </div>
                `;
            } else {
                statusTxt = `
                    <div class="badge badge-warn" style="padding:10px 14px; display:block; line-height:1.5;">
                        ⚠️ <strong>Zirve SQL otomatik algılanamadı.</strong><br>
                        Zirve genellikle <code>.\\ZIRVESQL</code> veya ağdaki bir sunucuda çalışır.<br>
                        Lütfen Zirve'nin kurulu olduğu bilgisayarı veya instance adını yukarıdan seçiniz.
                    </div>
                `;
            }

            box.innerHTML = statusTxt;
        } catch (e) {
            box.innerHTML = `<div class="badge badge-warn">Yerel sunucuya bağlanılamadı. baslat.bat açık olmalıdır.</div>`;
        }
    },

    setZirveLocation(mode) {
        const srvInput = document.getElementById("sqlServerInput");
        const btnScan = document.getElementById("btnScanNetwork");
        const authSel = document.getElementById("sqlAuthType");
        if (mode === "network") {
            if (btnScan) btnScan.style.display = "inline-flex";
            if (srvInput && (srvInput.value === ".\\ZIRVESQL" || srvInput.value === "localhost\\ZIRVESQL" || !srvInput.value)) {
                srvInput.value = "";
                srvInput.placeholder = "Örn: 192.168.1.100\\ZIRVESQL veya ANA-BILGISAYAR\\ZIRVESQL";
            }
            if (authSel) {
                authSel.value = "sql";
                this.toggleSqlAuthInputs();
            }
        } else {
            if (btnScan) btnScan.style.display = "none";
            if (srvInput && !srvInput.value) {
                srvInput.value = ".\\ZIRVESQL";
            }
            const netBox = document.getElementById("networkScanResultBox");
            if (netBox) netBox.style.display = "none";
        }
    },

    async scanNetworkForSql() {
        const box = document.getElementById("networkScanResultBox");
        if (box) {
            box.style.display = "block";
            box.innerHTML = `<span class="text-info">🌐 Yerel ağdaki bilgisayarlar taranıyor...</span>`;
        }
        try {
            const res = await fetch("/api/sql/scan-network", { method: "POST" });
            const data = await res.json();
            if (data && data.servers && data.servers.length > 0) {
                let html = `<div style="background:var(--bg-card); border:1px solid #10b981; border-radius:8px; padding:12px; margin-top:8px;">`;
                html += `<div style="font-weight:700; color:#10b981; margin-bottom:8px;">🎯 Ağda SQL Servisi Açık ${data.servers.length} Bilgisayar Bulundu:</div>`;
                data.servers.forEach(s => {
                    html += `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; background:var(--bg-body); padding:8px 12px; border-radius:6px;">
                            <span>🖥️ Sunucu IP: <strong>${s.ip}</strong> (Öneri: <code>${s.suggestedServer}</code>)</span>
                            <button class="btn btn-success btn-sm" onclick="App.selectNetworkServer('${s.suggestedServer}')">Bu Sunucuya Bağlan</button>
                        </div>
                    `;
                });
                html += `</div>`;
                if (box) box.innerHTML = html;
            } else {
                if (box) box.innerHTML = `
                    <div class="badge badge-warn" style="margin-top:8px; padding:10px 14px; display:block; line-height:1.5;">
                        ℹ️ Ağ üzerinde otomatik SQL portu açık cihaz bulunamadı.<br>
                        Lütfen Zirve'nin kurulu olduğu ana bilgisayarın IP adresini veya adını doğrudan kutucuğa yazınız (Örn: <code>192.168.1.104\\ZIRVESQL</code>).
                    </div>
                `;
            }
        } catch (e) {
            if (box) box.innerHTML = `<div class="badge badge-borc">Ağ tarama hatası: ${e.message}</div>`;
        }
    },

    selectNetworkServer(serverName) {
        document.getElementById("sqlServerInput").value = serverName;
        this.autoScanAndConnect();
    },

    async autoScanAndConnect() {
        const box = document.getElementById("autoScanResultBox");
        if (box) {
            box.style.display = "block";
            box.innerHTML = `
                <div style="background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.3); border-radius:8px; padding:16px; text-align:center;">
                    <div style="font-size:15px; font-weight:700; color:#3b82f6; margin-bottom:6px;">
                        ⏳ Zirve SQL Sunucusu ve Tüm Veritabanları Taranıyor...
                    </div>
                    <div style="font-size:12px; color:var(--text-muted);">
                        Sistem Zirve SQL üzerindeki tüm firma ve yıl veritabanlarını sırayla inceliyor, Cari Kart ve Cari Hareket tablolarını tespit ediyor...
                    </div>
                </div>
            `;
        }

        const cfg = this.getSqlConfigFromUi();
        try {
            const res = await fetch("/api/sql/autodetect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cfg)
            });
            const data = await res.json();

            // Eğer sistem çalışan bir şifre / sunucu bulduysa arayüze otomatik uygula
            if (data && data.workingConfig) {
                const wc = data.workingConfig;
                if (wc.server) document.getElementById("sqlServerInput").value = wc.server;
                if (wc.authType) document.getElementById("sqlAuthType").value = wc.authType;
                if (wc.user) document.getElementById("sqlUserInput").value = wc.user;
                if (wc.password) document.getElementById("sqlPassInput").value = wc.password;
                this.toggleSqlAuthInputs();
            }

            if (!data.ok) {
                if (box) {
                    box.innerHTML = `
                        <div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); border-radius:8px; padding:14px; line-height:1.6;">
                            <div style="font-weight:700; color:#ef4444; margin-bottom:6px;">❌ Zirve SQL Sunucusuna Bağlanılamadı</div>
                            <div style="font-size:12px; color:var(--text-main); margin-bottom:8px;">
                                ${data.error || 'SQL sunucusuna ulaşılamadı.'}
                            </div>
                            <div style="font-size:12px; color:var(--text-muted); background:var(--bg-card); padding:10px; border-radius:6px;">
                                <strong>💡 Hızlı Çözüm:</strong><br>
                                1. <strong>Zirve bu bilgisayarda mı kurulu?</strong> Zirve programının açık olduğunu ve SQL servisinin çalıştığını kontrol ediniz.<br>
                                2. <strong>Zirve ağdaki başka bilgisayarda mı kurulu?</strong> Yukarıdan <em>"Ağdaki Başka Bilgisayarda / Sunucuda"</em> seçeneğini işaretleyip ana bilgisayarın IP adresini yazınız (Örn: <code>192.168.1.100\\ZIRVESQL</code>) ya da <strong>"🌐 Ağda SQL Sunucusu Ara"</strong> butonuna basınız.<br>
                                3. <strong>En Kolay Yol:</strong> Bu <code>zirve-cari-tahsilat</code> klasörünü Zirve'nin kurulu olduğu ana bilgisayara kopyalayıp orada <code>baslat.bat</code> ile çalıştırırsanız tek tıkla doğrudan bağlanır.
                            </div>
                        </div>
                    `;
                }
                return;
            }

            const candidates = data.candidates || [];
            if (candidates.length === 0) {
                if (box) {
                    box.innerHTML = `
                        <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:8px; padding:16px;">
                            <div style="font-weight:700; color:#ef4444; margin-bottom:6px;">⚠️ Aktif Cari / Hareket Bulunamadı</div>
                            <div style="font-size:12px; color:var(--text-muted); line-height:1.6;">
                                SQL sunucusundaki (${cfg.server}) veritabanları tarandı ancak standart Zirve Cari tablosu tespit edilemedi.<br>
                                Zirve programının çalıştığından ve doğru SQL sunucu adının girildiğinden emin olunuz. Dilerseniz aşağıdaki manuel tablodan seçim yapabilirsiniz.
                            </div>
                        </div>
                    `;
                }
                return;
            }

            let cardsHtml = `
                <div style="background:var(--bg-card); border:2px solid #10b981; border-radius:10px; padding:16px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <div style="font-weight:700; color:#10b981; font-size:15px;">
                            🎯 Bulunan Zirve Firma / Dönem Veritabanları (${candidates.length} Adet)
                        </div>
                        <span style="font-size:11px; color:var(--text-muted);">En güncel hareket içerenler en üsttedir</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
            `;

            candidates.forEach((cand, idx) => {
                const isTop = idx === 0;
                const sonTarihStr = cand.sonTarih ? new Date(cand.sonTarih).toLocaleDateString("tr-TR") : "-";
                cardsHtml += `
                    <div style="background:var(--bg-body); border:1px solid ${isTop ? '#10b981' : 'var(--border)'}; border-radius:8px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <div style="max-width:70%;">
                            <div style="font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px;">
                                <span>📁 ${cand.database}</span>
                                ${isTop ? '<span class="badge badge-alacak" style="font-size:10px; padding:2px 8px;">EN GÜNCEL (ÖNERİLEN)</span>' : ''}
                            </div>
                            <div style="font-size:12px; color:var(--text-muted); margin-top:4px; line-height:1.5;">
                                👥 <strong>${cand.cariCount}</strong> Cari Kart (<code>${cand.cariTable || '-'}</code>) &nbsp;|&nbsp;
                                📑 <strong>${cand.harCount}</strong> Hareket (<code>${cand.harTable || '-'}</code>) &nbsp;|&nbsp;
                                📅 Son İşlem: <strong>${sonTarihStr}</strong>
                                ${cand.sampleCari ? `<br><span style="color:var(--text-main);">Örnek Cari: <em>${cand.sampleCari}</em></span>` : ''}
                            </div>
                        </div>
                        <div>
                            <button class="btn btn-success btn-sm" style="font-weight:700; padding:8px 16px;" onclick="App.connectToCandidate('${cand.database}', '${cand.cariTable || ''}', '${cand.harTable || ''}')">
                                ⚡ Canlı Bağlan & Dökümü Getir
                            </button>
                        </div>
                    </div>
                `;
            });

            cardsHtml += `
                    </div>
                </div>
            `;

            if (box) box.innerHTML = cardsHtml;

            // Eğer sadece 1 adet veritabanı adayı varsa doğrudan otomatik bağlan
            if (candidates.length === 1 && candidates[0].cariCount > 0) {
                const c = candidates[0];
                await this.connectToCandidate(c.database, c.cariTable, c.harTable);
            }
        } catch (e) {
            if (box) {
                box.innerHTML = `
                    <div class="badge badge-warn" style="padding:12px; display:block; line-height:1.6;">
                        ⚠️ <strong>Otomatik tarama yanıt vermedi (${e.message}).</strong><br>
                        Doğrudan aşağıdaki <strong>"1. Firma / Dönem Veritabanlarını Listele"</strong> butonuna basıp firmanızın veritabanını seçerek hemen bağlanabilirsiniz.
                    </div>
                `;
            }
        }
    },

    async connectToCandidate(dbName, cariTable, harTable) {
        const sel = document.getElementById("sqlDatabaseSelect");
        if (sel) {
            let exists = false;
            for (let i = 0; i < sel.options.length; i++) {
                if (sel.options[i].value === dbName) { exists = true; break; }
            }
            if (!exists) {
                const opt = document.createElement("option");
                opt.value = dbName;
                opt.textContent = dbName;
                sel.appendChild(opt);
            }
            sel.value = dbName;
        }

        const cariSel = document.getElementById("sqlCustomCariTable");
        if (cariSel && cariTable) {
            let exists = false;
            for (let i = 0; i < cariSel.options.length; i++) {
                if (cariSel.options[i].value === cariTable) { exists = true; break; }
            }
            if (!exists) {
                const opt = document.createElement("option");
                opt.value = cariTable;
                opt.textContent = cariTable;
                cariSel.appendChild(opt);
            }
            cariSel.value = cariTable;
        }

        const harSel = document.getElementById("sqlCustomCariHarTable");
        if (harSel && harTable) {
            let exists = false;
            for (let i = 0; i < harSel.options.length; i++) {
                if (harSel.options[i].value === harTable) { exists = true; break; }
            }
            if (!exists) {
                const opt = document.createElement("option");
                opt.value = harTable;
                opt.textContent = harTable;
                harSel.appendChild(opt);
            }
            harSel.value = harTable;
        }

        // Zirve SQL senkronizasyonunu başlat
        await this.syncFromZirveSql();

        // Cari kartlar tabına otomatik geçiş yap ve kullanıcıyı karşıla
        if (this.state.cariler.length > 0) {
            this.switchTab("cariler");
            alert(`✅ ${dbName} veritabanına başarıyla bağlanıldı!\n\nToplam ${this.state.cariler.length} cari hesap ve ${this.state.hareketler.length} cari hareket canlı olarak çekildi.\n\nSistem artık arka planda her 5 dakikada bir güncel verileri otomatik çekmeye devam edecektir.`);
        }
    },

    async loadSqlDatabases() {
        const cfg = this.getSqlConfigFromUi();
        const logBox = document.getElementById("sqlSyncLogBox");
        logBox.innerHTML = `<span class="text-info">SQL sunucusuna bağlanılıyor (${cfg.server})...</span>`;
        try {
            const res = await fetch("/api/sql/databases", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cfg)
            });
            const data = await res.json();
            if (!data.ok) {
                logBox.innerHTML = `<span class="text-borc">❌ SQL Bağlantı Hatası: ${data.error}</span>`;
                return;
            }
            const sel = document.getElementById("sqlDatabaseSelect");
            sel.innerHTML = `<option value="">-- Veritabanı Seçin --</option>` + (data.databases || []).map(d => `<option value="${d.name}">${d.name}</option>`).join("");
            logBox.innerHTML = `<span class="text-alacak">✅ ${(data.databases || []).length} adet Firma/Dönem veritabanı bulundu. Şimdi firmanızı seçip 2. butona tıklayın.</span>`;
        } catch (e) {
            logBox.innerHTML = `<span class="text-borc">❌ Sunucu hatası: baslat.bat açık olduğundan emin olun.</span>`;
        }
    },

    async syncFromZirveSql() {
        const cfg = this.getSqlConfigFromUi();
        if (!cfg.database) return alert("Lütfen önce Zirve Firma / Dönem veritabanını seçin.");

        const logBox = document.getElementById("sqlSyncLogBox");
        logBox.innerHTML = `<span class="text-info">⏳ Zirve SQL [${cfg.database}] veritabanından Cari Kartlar ve Cari Hareketler çekiliyor...</span>`;

        try {
            const res = await fetch("/api/sql/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cfg)
            });
            const data = await res.json();
            if (!data.ok) {
                logBox.innerHTML = `<span class="text-borc">❌ Senkronizasyon Hatası: ${data.error}</span>`;
                return;
            }

            const cariCount = (data.cariler || []).length;
            const harCount = (data.hareketler || []).length;

            if (cariCount === 0 && harCount === 0) {
                // Tabloları hemen listele ve kullanıcıya göster
                await this.inspectCurrentDatabaseTables(false);
                logBox.innerHTML = `
                    <div class="badge badge-warn" style="padding:12px 14px; display:block; line-height:1.6;">
                        ⚠️ <strong>[${cfg.database}] veritabanında otomatik Cari tablosu tespit edilemedi (0 kayıt).</strong><br>
                        • <strong>Çözüm:</strong> Yukarıda açılan <em>"Veritabanı Tablo Eşleştirme Sihirbazı"</em>ndan firmanızın Cari Kart tablosunu ve Cari Hareket tablosunu listeden seçip tekrar <strong>"2. ⚡ Zirve'den Carileri ve Hareketleri Çek"</strong> butonuna basınız.<br>
                        • <em>İpucu:</em> Bazı Zirve kurulumlarında Cari Kartlar <code>ZIRVE_GENEL</code> veya ana firma veritabanında, hareketler ise yıl veritabanında (Örn: <code>FIRMA_2026</code>) tutulur.
                    </div>
                `;
                return;
            }

            // Mevcut özel notları ve ödeme sözlerini koruyarak Carileri ve Hareketleri birleştir
            const promiseMap = {};
            for (const oldC of this.state.cariler) {
                if (oldC.odemeSozuTarihi || oldC.ozelNot) {
                    promiseMap[oldC.kod] = {
                        odemeSozuTarihi: oldC.odemeSozuTarihi,
                        odemeSozuTutar: oldC.odemeSozuTutar,
                        ozelNot: oldC.ozelNot
                    };
                }
            }

            let newCariCount = 0;
            for (const zc of (data.cariler || [])) {
                const existing = this.state.cariler.find(c => c.kod === zc.kod || c.id === zc.id);
                const savedNotes = promiseMap[zc.kod] || {};
                if (existing) {
                    Object.assign(existing, zc, savedNotes);
                } else {
                    this.state.cariler.push({ ...zc, ...savedNotes });
                    newCariCount++;
                }
            }

            // Zirve SQL'den gelen hareketleri güncelle (Manuel eklenenleri koru, ZRV-H olanları yenile)
            this.state.hareketler = this.state.hareketler.filter(h => !String(h.id).startsWith("ZRV-H-"));
            for (const zh of (data.hareketler || [])) {
                this.state.hareketler.push(zh);
            }

            this.state.settings.sqlServer = cfg.server;
            this.state.settings.sqlDatabase = cfg.database;
            this.state.settings.lastSyncTime = new Date().toLocaleString("tr-TR");

            this.saveState();
            this.recalculateAndRenderAll();
            this.setServerBadge(true, `Zirve SQL: ${cfg.database}`);

            logBox.innerHTML = `
                <div class="badge badge-alacak" style="padding:10px 14px; display:block;">
                    ✅ <strong>Zirve SQL Senkronizasyonu Başarılı!</strong><br>
                    • Okunan Cari Kart Tablosu: <code>${data.detectedTables?.cariTable || '-'}</code> (<strong>${cariCount}</strong> Cari Aktarıldı)<br>
                    • Okunan Cari Hareket Tablosu: <code>${data.detectedTables?.cariHarTable || '-'}</code> (<strong>${harCount}</strong> Cari Hareket Aktarıldı)
                </div>
            `;
        } catch (e) {
            logBox.innerHTML = `<span class="text-borc">❌ Bağlantı hatası: ${e.message}</span>`;
        }
    },

    async scanZirveXmlFolder() {
        const path = document.getElementById("zirveXmlPath").value.trim() || "C:\\zirve";
        this.saveSettings();
        try {
            const res = await fetch("/api/xml/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path })
            });
            const data = await res.json();
            if (!data.ok) {
                alert("Klasör tarama uyarısı: " + data.error);
                return;
            }
            let added = 0;
            for (const f of (data.files || [])) {
                if (this.ingestSingleUblXml(f.xml) === "ADDED") added++;
            }
            this.saveState();
            this.recalculateAndRenderAll();
            alert(`${path} klasöründe ${data.totalXmlFound} adet e-Fatura XML bulundu, ${added} yeni fatura cari hesaplara işlendi.`);
        } catch (e) {
            alert("Klasör taraması için baslat.bat üzerinden çalıştırılmalıdır.");
        }
    },

    // ================= DIŞA / İÇE AKTARIM VE DEMO VERİLER =================
    exportCarilerCsv() {
        const rows = [["Cari Kod", "Cari Unvan", "VKN", "Toplam Borc", "Toplam Alacak", "Net Bakiye", "Durum", "En Eski Vade", "Gecikme Gunu", "Odeme Sozu", "Not"]];
        for (const c of Object.values(this.computedCarilerMap)) {
            rows.push([
                c.kod,
                `"${(c.unvan || '').replace(/"/g, '""')}"`,
                c.vkn || "",
                c.toplamBorc,
                c.toplamAlacak,
                Math.abs(c.netBakiye),
                c.bakiyeYonu,
                c.enEskiAcikVade || "",
                c.maxGecikmeGunu || 0,
                c.odemeSozuTarihi || "",
                `"${(c.ozelNot || '').replace(/"/g, '""')}"`
            ]);
        }
        const csvContent = "\uFEFF" + rows.map(r => r.join(";")).join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `Zirve_Cari_Bakiyeler_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    },

    exportFullBackupJson() {
        const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: "application/json;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `Zirve_Cari_Tahsilat_Yedek_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
    },

    async importBackupJson(file) {
        if (!file) return;
        try {
            const txt = await file.text();
            const parsed = JSON.parse(txt);
            if (parsed && Array.isArray(parsed.cariler)) {
                this.state = parsed;
                this.saveState();
                this.recalculateAndRenderAll();
                alert("Yedek başarıyla geri yüklendi.");
            }
        } catch (e) {
            alert("Geçersiz yedek dosyası.");
        }
    },

    loadDemoData(confirmReset = false) {
        if (confirmReset && !confirm("Mevcut veriler örnek Zirve cari ve fatura verileriyle değiştirilsin mi?")) return;

        this.state.cariler = [
            { id: "C-101", kod: "120.01.001", unvan: "ÖZKAN METAL MAKİNA SAN. VE TİC. A.Ş.", vkn: "6840192831", telefon: "05324102030", vadeGunu: 30, doviz: "TRY", kaynak: "Zirve SQL (CARI)", odemeSozuTarihi: "2026-10-15", odemeSozuTutar: 185000, ozelNot: "Muhasebe müdürü Hasan Bey Cuma EFT geçeceğini teyit etti." },
            { id: "C-102", kod: "120.01.002", unvan: "BURSA OTOMOTİV YAN SANAYİ LTD. ŞTİ.", vkn: "1900482716", telefon: "05336221144", vadeGunu: 45, doviz: "TRY", kaynak: "Zirve SQL (CARI)", odemeSozuTarihi: "2026-10-20", odemeSozuTutar: 120000, ozelNot: "Ara tahsilat alındı, kalan bakiye ayın 20'sinde." },
            { id: "C-103", kod: "120.01.003", unvan: "MARMARA ENDÜSTRİYEL KALIP TİC. A.Ş.", vkn: "6120938475", telefon: "05423119988", vadeGunu: 30, doviz: "TRY", kaynak: "Zirve SQL (CARI)" },
            { id: "C-201", kod: "320.01.001", unvan: "AKÇELİK DEMİR ÇELİK TEDARİK SAN. A.Ş.", vkn: "0192837465", telefon: "05329008877", vadeGunu: 30, doviz: "TRY", kaynak: "Zirve SQL (CARI)", odemeSozuTarihi: "2026-10-18", odemeSozuTutar: 210000, ozelNot: "Hammadde alımı cari ödemesi planlandı." },
            { id: "C-202", kod: "320.01.002", unvan: "ANADOLU KİMYA VE YÜZEY İŞLEM LTD. ŞTİ.", vkn: "0948271635", telefon: "05442223311", vadeGunu: 30, doviz: "TRY", kaynak: "Zirve SQL (CARI)" },
            { id: "C-203", kod: "320.01.003", unvan: "ULUSOY ENERJİ VE LOJİSTİK HİZMETLERİ A.Ş.", vkn: "8837465912", telefon: "05301112233", vadeGunu: 15, doviz: "TRY", kaynak: "Zirve SQL (CARI)" }
        ];

        this.state.hareketler = [
            // C-101 ÖZKAN METAL: Devir Borç + 2 Satış Faturası - 1 Gelen Havale - 1 Alınan Çek
            { id: "ZRV-H-1", cariId: "C-101", cariKod: "120.01.001", tarih: "2026-08-01", vadeTarihi: "2026-08-15", evrakNo: "DEVIR-2026", islemTuru: "DEVIR_BORC", aciklama: "Dönem Başı Cari Devir Borcu", borc: 95000, alacak: 0, doviz: "TRY", kur: 1, kaynak: "Zirve SQL (CARIHAR)" },
            { id: "ZRV-H-2", cariId: "C-101", cariKod: "120.01.001", tarih: "2026-08-20", vadeTarihi: "2026-09-20", evrakNo: "GIB202600000142", islemTuru: "SATIS_FATURA", aciklama: "Satış Faturası (Pres & Sac İşleme)", borc: 240000, alacak: 0, doviz: "TRY", kur: 1, kaynak: "Zirve SQL (CARIHAR)" },
            { id: "ZRV-H-3", cariId: "C-101", cariKod: "120.01.001", tarih: "2026-09-05", vadeTarihi: "2026-09-05", evrakNo: "BNK-9021", islemTuru: "TAHSILAT", aciklama: "Garanti BBVA Gelen Havale (Cari Hesaba Mahsuben)", borc: 0, alacak: 150000, doviz: "TRY", kur: 1, kaynak: "Zirve SQL (CARIHAR)" },
            { id: "ZRV-H-4", cariId: "C-101", cariKod: "120.01.001", tarih: "2026-09-25", vadeTarihi: "2026-10-25", evrakNo: "GIB202600000198", islemTuru: "SATIS_FATURA", aciklama: "Satış Faturası (Lazer Kesim & Montaj)", borc: 165000, alacak: 0, doviz: "TRY", kur: 1, kaynak: "Zirve SQL (CARIHAR)" },

            // C-102 BURSA OTOMOTİV
            { id: "ZRV-H-5", cariId: "C-102", cariKod: "120.01.002", tarih: "2026-09-01", vadeTarihi: "2026-10-01", evrakNo: "GIB202600000155", islemTuru: "SATIS_FATURA", aciklama: "Otomotiv Aparat Satış Faturası", borc: 210000, alacak: 0, doviz: "TRY", kur: 1, kaynak: "Zirve SQL (CARIHAR)" },
            { id: "ZRV-H-6", cariId: "C-102", cariKod: "120.01.002", tarih: "2026-09-18", vadeTarihi: "2026-10-30", evrakNo: "ÇK-77412", islemTuru: "CEK_SENET", aciklama: "Alınan Müşteri Çeki (İş Bankası)", borc: 0, alacak: 90000, doviz: "TRY", kur: 1, kaynak: "Zirve SQL (CARIHAR)" },

            // C-103 MARMARA ENDÜSTRİYEL
            { id: "ZRV-H-7", cariId: "C-103", cariKod: "120.01.003", tarih: "2026-10-02", vadeTarihi: "2026-11-02", evrakNo: "GIB202600000215", islemTuru: "SATIS_FATURA", aciklama: "Kalıp Bakım ve Revizyon Faturası", borc: 78500, alacak: 0, doviz: "TRY", kur: 1, kaynak: "Zirve SQL (CARIHAR)" },

            // C-201 AKÇELİK DEMİR ÇELİK (Tedarikçi: Alış Faturası alacaklandırır, Ödeme borçlandırır)
            { id: "ZRV-H-8", cariId: "C-201", cariKod: "320.01.001", tarih: "2026-08-12", vadeTarihi: "2026-09-12", evrakNo: "AKC2026000491", islemTuru: "ALIS_FATURA", aciklama: "DKP Sac Hammadde Alış Faturası", borc: 0, alacak: 320000, doviz: "TRY", kur: 1, kaynak: "Zirve SQL (CARIHAR)" },
            { id: "ZRV-H-9", cariId: "C-201", cariKod: "320.01.001", tarih: "2026-09-10", vadeTarihi: "2026-09-10", evrakNo: "EFT-4401", islemTuru: "ODEME", aciklama: "Akbank Gönderilen EFT (Cari Hesaba Mahsuben)", borc: 110000, alacak: 0, doviz: "TRY", kur: 1, kaynak: "Zirve SQL (CARIHAR)" },

            // C-202 ANADOLU KİMYA
            { id: "ZRV-H-10", cariId: "C-202", cariKod: "320.01.002", tarih: "2026-09-22", vadeTarihi: "2026-10-22", evrakNo: "AND2026001108", islemTuru: "ALIS_FATURA", aciklama: "Endüstriyel Boya ve Kimyasal Alış Faturası", borc: 0, alacak: 64000, doviz: "TRY", kur: 1, kaynak: "Zirve SQL (CARIHAR)" }
        ];

        this.state.faturalar = [
            { id: "FAT-1", faturaNo: "GIB202600000142", tarih: "2026-08-20", vadeTarihi: "2026-09-20", yon: "SATIS", cariId: "C-101", cariUnvan: "ÖZKAN METAL MAKİNA SAN. VE TİC. A.Ş.", doviz: "TRY", genelToplam: 240000, tlTutar: 240000, aciklama: "Pres & Sac İşleme" },
            { id: "FAT-2", faturaNo: "GIB202600000198", tarih: "2026-09-25", vadeTarihi: "2026-10-25", yon: "SATIS", cariId: "C-101", cariUnvan: "ÖZKAN METAL MAKİNA SAN. VE TİC. A.Ş.", doviz: "TRY", genelToplam: 165000, tlTutar: 165000, aciklama: "Lazer Kesim & Montaj" },
            { id: "FAT-3", faturaNo: "GIB202600000155", tarih: "2026-09-01", vadeTarihi: "2026-10-01", yon: "SATIS", cariId: "C-102", cariUnvan: "BURSA OTOMOTİV YAN SANAYİ LTD. ŞTİ.", doviz: "TRY", genelToplam: 210000, tlTutar: 210000, aciklama: "Otomotiv Aparat Satışı" },
            { id: "FAT-4", faturaNo: "GIB202600000215", tarih: "2026-10-02", vadeTarihi: "2026-11-02", yon: "SATIS", cariId: "C-103", cariUnvan: "MARMARA ENDÜSTRİYEL KALIP TİC. A.Ş.", doviz: "TRY", genelToplam: 78500, tlTutar: 78500, aciklama: "Kalıp Bakım ve Revizyon" },
            { id: "FAT-5", faturaNo: "AKC2026000491", tarih: "2026-08-12", vadeTarihi: "2026-09-12", yon: "ALIS", cariId: "C-201", cariUnvan: "AKÇELİK DEMİR ÇELİK TEDARİK SAN. A.Ş.", doviz: "TRY", genelToplam: 320000, tlTutar: 320000, aciklama: "DKP Sac Hammadde Alımı" },
            { id: "FAT-6", faturaNo: "AND2026001108", tarih: "2026-09-22", vadeTarihi: "2026-10-22", yon: "ALIS", cariId: "C-202", cariUnvan: "ANADOLU KİMYA VE YÜZEY İŞLEM LTD. ŞTİ.", doviz: "TRY", genelToplam: 64000, tlTutar: 64000, aciklama: "Endüstriyel Boya ve Kimyasal" }
        ];

        this.state.ceksenetler = [
            { id: "CS-1", cariId: "C-102", cariUnvan: "BURSA OTOMOTİV YAN SANAYİ LTD. ŞTİ.", yon: "ALINAN", tur: "ALINAN CEK", vadeTarihi: "2026-10-30", banka: "İş Bankası Nilüfer Şb.", evrakNo: "ÇK-77412", tutar: 90000, durum: "PORTFOYDE" },
            { id: "CS-2", cariId: "C-201", cariUnvan: "AKÇELİK DEMİR ÇELİK TEDARİK SAN. A.Ş.", yon: "VERILEN", tur: "VERILEN CEK", vadeTarihi: "2026-11-15", banka: "Garanti BBVA OSB Şb.", evrakNo: "ÇK-99104", tutar: 85000, durum: "ODENECEK" }
        ];

        this.saveState();
        if (confirmReset) this.recalculateAndRenderAll();
    }
};

window.App = App;
window.addEventListener("DOMContentLoaded", () => App.init());
