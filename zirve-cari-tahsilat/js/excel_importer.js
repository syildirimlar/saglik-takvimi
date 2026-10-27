/**
 * ZİRVE EXCEL & PDF İÇE AKTARICI (Zirve Multi-Format Importer)
 * 
 * Zirve Yazılım'dan alınan:
 * 1) Çoklu Cari Hesap Ekstresi (PDF veya Excel - onlarca/yüzlerce carili döküm)
 * 2) Tekil Cari Hesap Ekstresi (PDF veya Excel)
 * 3) Cari Bakiye Listesi / Mizan (Excel, CSV veya PDF)
 * 4) Fatura ve Çek/Senet Listeleri
 * 
 * formatlarını %100 yerel ve çevrimdışı olarak ayrıştırır; tüm cari kartları,
 * borç/alacak bakiyelerini, vadeli hareketleri, faturaları ve çek/senetleri oluşturur.
 */

window.ZirveExcelImporter = {
    cleanStr(val) {
        if (val === null || val === undefined) return "";
        return String(val).trim();
    },

    cleanNum(val) {
        if (typeof val === "number") return isNaN(val) ? 0 : val;
        if (!val) return 0;
        let s = String(val).trim().replace(/\s/g, "");
        if (!s) return 0;

        let isNegative = false;
        if (/^\(.*\)$/.test(s) || s.endsWith("-")) {
            isNegative = true;
            s = s.replace(/[()\-]/g, "");
        }

        // 1. Hem nokta hem virgül varsa (örn: 1.250.500,50 veya 1,250,500.50)
        if (s.includes(",") && s.includes(".")) {
            if (s.lastIndexOf(".") < s.lastIndexOf(",")) {
                // Türkçe: 1.250.500,50 -> 1250500.50
                s = s.replace(/\./g, "").replace(",", ".");
            } else {
                // İngilizce: 1,250,500.50 -> 1250500.50
                s = s.replace(/,/g, "");
            }
        } else if (s.includes(",")) {
            const commaCount = (s.match(/,/g) || []).length;
            if (commaCount > 1) {
                s = s.replace(/,/g, "");
            } else {
                s = s.replace(",", ".");
            }
        } else if (s.includes(".")) {
            const dotCount = (s.match(/\./g) || []).length;
            if (dotCount > 1) {
                // Çoklu nokta: 2.659.000 -> 2659000
                s = s.replace(/\./g, "");
            } else {
                // Tek nokta: Eğer 3 basamaklı ise binliktir (150.000 -> 150000)
                const parts = s.split(".");
                if (parts[1] && parts[1].length === 3) {
                    s = s.replace(".", "");
                }
            }
        }

        const num = parseFloat(s);
        if (isNaN(num)) return 0;
        const res = Math.round(num * 100) / 100;
        return isNegative ? -res : res;
    },

    parseDate(val) {
        if (!val) return "";
        if (val instanceof Date) return val.toISOString().slice(0, 10);
        // Excel seri tarih sayısı (örn: 45200)
        if (typeof val === "number" && val > 20000 && val < 60000) {
            const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
            return dateObj.toISOString().slice(0, 10);
        }
        const s = String(val).trim();
        // GG.AA.YYYY veya GG/AA/YYYY
        const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
        if (m) {
            const day = m[1].padStart(2, "0");
            const month = m[2].padStart(2, "0");
            const year = m[3];
            return `${year}-${month}-${day}`;
        }
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        return "";
    },

    findColumnIndex(headers, possibleNames) {
        for (let i = 0; i < headers.length; i++) {
            const h = (headers[i] || "").toString().toLowerCase().replace(/[\s_\-.]/g, "");
            for (const cand of possibleNames) {
                const c = cand.toLowerCase().replace(/[\s_\-.]/g, "");
                if (h === c || h.includes(c)) return i;
            }
        }
        return -1;
    },

    getSavedConfig(app, kod, unvan) {
        if (!app) return null;
        if (typeof app.getCariConfig === "function") {
            const found = app.getCariConfig(kod, unvan);
            if (found) return found;
        }
        if (app.state && app.state.cariConfigs) {
            if (kod && app.state.cariConfigs[kod]) return app.state.cariConfigs[kod];
            const norm = String(kod || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            if (norm && app.state.cariConfigs[norm]) return app.state.cariConfigs[norm];
        }
        return null;
    },

    getApp(appInstance) {
        if (appInstance && appInstance.state) return appInstance;
        if (typeof window !== "undefined" && window.App && window.App.state) return window.App;
        if (typeof App !== "undefined" && App.state) return App;
        return null;
    },

    async processFile(file, appInstance) {
        const ext = file.name.split('.').pop().toLowerCase();
        let parsedData = null;

        if (ext === "csv" || ext === "txt") {
            const text = await file.text();
            parsedData = this.parseCsv(text);
        } else if (ext === "xlsx" || ext === "xls") {
            parsedData = await this.parseExcel(file);
        } else if (ext === "pdf") {
            parsedData = await this.parsePdf(file, appInstance);
        } else {
            throw new Error("Desteklenmeyen dosya türü (" + ext + "). Lütfen Zirve'den aldığınız .xlsx, .xls, .csv veya .pdf dosyasını yükleyin.");
        }

        return this.importData(parsedData, file.name, appInstance);
    },

    async parseExcel(file) {
        if (!window.XLSX) {
            throw new Error("Excel kütüphanesi yüklenemedi. Sayfayı yenileyip tekrar deneyiniz.");
        }
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        return XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
    },

    parseCsv(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return [];
        const sample = lines[0];
        const sep = (sample.match(/;/g) || []).length > (sample.match(/,/g) || []).length ? ";" : (sample.includes("\t") ? "\t" : ",");
        return lines.map(line => {
            return line.split(sep).map(col => col.replace(/^["']|["']$/g, "").trim());
        });
    },

    async parsePdf(file, appInstance) {
        if (!window.pdfjsLib) {
            throw new Error("PDF kütüphanesi hazır değil. Lütfen sayfayı yenileyiniz.");
        }
        if (window.pdfjsLib.GlobalWorkerOptions) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';
        }

        const buffer = await file.arrayBuffer();
        let pdf;
        try {
            pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
        } catch (workerErr) {
            console.warn("PDF worker fallback devrede:", workerErr);
            pdf = await window.pdfjsLib.getDocument({
                data: buffer,
                disableFontFace: true,
                isEvalSupported: false,
                useWorkerFetch: false
            }).promise;
        }

        const structuredRows = [];
        let calibratedBounds = null;

        for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const textContent = await page.getTextContent();

            // Sayfadaki metinleri Y koordinatına göre grupla (3 pt tolerans)
            const lineMap = {};
            for (const item of textContent.items) {
                const str = (item.str || "").trim();
                if (!str) continue;
                const y = Math.round(item.transform[5] / 3) * 3;
                if (!lineMap[y]) lineMap[y] = [];
                lineMap[y].push({ x: item.transform[4], text: str, width: item.width });
            }

            // Yukarıdan aşağıya (azalan Y) sırala
            const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);

            for (const y of sortedYs) {
                const lineItems = lineMap[y].sort((a, b) => a.x - b.x);
                const fullLineText = lineItems.map(it => it.text).join(" ").trim();
                if (!fullLineText) continue;

                // 1. Zirve Üst Bilgi Satırları (Firma, Rapor Tarihi, Sayfa No)
                if (fullLineText.includes("Firma :") || fullLineText.includes("Sayfa No :") || fullLineText === "Cari Hesap Ekstresi" || fullLineText.toLowerCase() === "basla") {
                    const mFirma = fullLineText.match(/Firma\s*:\s*([^Sayfa]+)/i);
                    const app = this.getApp(appInstance);
                    if (mFirma && app && app.state && app.state.settings && !app.state.settings.ownFirmName) {
                        app.state.settings.ownFirmName = mFirma[1].trim();
                        const firmSub = document.getElementById("headerFirmSubtitle");
                        if (firmSub) firmSub.textContent = mFirma[1].trim();
                    }
                    continue;
                }

                // 2. Cari Başlık Satırı: "Cari Kodu : 120 03 039 Cari Adı : AD AUTO TOTAL SRL"
                const mCari = fullLineText.match(/(?:Cari\s*Kodu?|Hesap\s*Kodu?)\s*:\s*(.*?)\s*(?:Cari\s*(?:Ad[ıi]?|Ünvan[ıi]?)|Hesap\s*Ad[ıi]?)\s*:\s*(.*)/i);
                if (mCari) {
                    structuredRows.push({
                        type: "CARI_HEADER",
                        kod: mCari[1].trim(),
                        unvan: mCari[2].trim(),
                        fullText: fullLineText
                    });
                    continue;
                }

                // Tekil veya bölünmüş "Cari Kodu :" kontrolü
                const mKodOnly = fullLineText.match(/^(?:Cari\s*Kodu?|Hesap\s*Kodu?)\s*:\s*([^\n;]+)/i);
                if (mKodOnly && !fullLineText.includes("Cari Adı") && !fullLineText.includes("Cari Ünvan")) {
                    structuredRows.push({
                        type: "CARI_HEADER_KOD_ONLY",
                        kod: mKodOnly[1].trim(),
                        fullText: fullLineText
                    });
                    continue;
                }

                // 3. Tablo Kolon Başlık Satırı: "Tarih Evrak No Evrak Türü Açıklama Dvz. Cinsi Borç Alacak Bakiye B/A Vade Tarihi"
                const lower = fullLineText.toLowerCase();
                if (lower.includes("tarih") && (lower.includes("borç") || lower.includes("borc") || lower.includes("alacak") || lower.includes("bakiye"))) {
                    let posTarih = 35, posEvrak = 90, posTur = 160, posAcik = 250, posDvz = 325;
                    let posBorc = 390, posAlacak = 460, posBakiye = 530, posBA = 562, posVade = 595;

                    for (const it of lineItems) {
                        const t = it.text.toLowerCase();
                        if (t === "tarih") posTarih = it.x;
                        else if (t.includes("evrak") && t.includes("no")) posEvrak = it.x;
                        else if (t.includes("tür") || t.includes("tur")) posTur = it.x;
                        else if (t.includes("açıklama") || t.includes("aciklama")) posAcik = it.x;
                        else if (t.includes("dvz") || t.includes("cinsi") || t.includes("döviz")) posDvz = it.x;
                        else if (t === "borç" || t === "borc") posBorc = it.x;
                        else if (t === "alacak") posAlacak = it.x;
                        else if (t === "bakiye") posBakiye = it.x;
                        else if (t === "b/a" || t === "ba") posBA = it.x;
                        else if (t.includes("vade")) posVade = it.x;
                    }

                    calibratedBounds = {
                        tar_no: (posTarih + posEvrak) / 2,
                        no_tur: (posEvrak + posTur) / 2,
                        tur_acik: (posTur + posAcik) / 2,
                        acik_dvz: (posAcik + posDvz) / 2,
                        dvz_borc: (posDvz + posBorc) / 2,
                        borc_alacak: (posBorc + posAlacak) / 2,
                        alacak_bakiye: (posAlacak + posBakiye) / 2,
                        bakiye_ba: (posBakiye + posBA) / 2,
                        ba_vade: (posBA + posVade) / 2
                    };
                    continue;
                }

                // Varsayılan Zirve A4 Ekstre Kolon Aralıkları
                const b = calibratedBounds || {
                    tar_no: 65,
                    no_tur: 130,
                    tur_acik: 200,
                    acik_dvz: 310,
                    dvz_borc: 355,
                    borc_alacak: 425,
                    alacak_bakiye: 495,
                    bakiye_ba: 556,
                    ba_vade: 572
                };

                // 4. Cari Toplam Satırı: "Toplam Tutarlar : 659.830,35 581.327,26 78.503,09 B"
                if (fullLineText.includes("Toplam Tutarlar") || fullLineText.includes("Toplam:") || fullLineText.includes("Genel Toplam")) {
                    const grid = ["", "", "", "", "", "", "", "", "", ""];
                    for (const it of lineItems) {
                        const x = it.x;
                        if (x >= b.dvz_borc && x < b.borc_alacak) grid[5] = it.text;
                        else if (x >= b.borc_alacak && x < b.alacak_bakiye) grid[6] = it.text;
                        else if (x >= b.alacak_bakiye && x < b.bakiye_ba) grid[7] = it.text;
                        else if (x >= b.bakiye_ba && x < b.ba_vade) grid[8] = it.text;
                    }
                    structuredRows.push({
                        type: "CARI_SUMMARY",
                        borc: grid[5],
                        alacak: grid[6],
                        bakiye: grid[7],
                        ba: grid[8],
                        fullText: fullLineText
                    });
                    continue;
                }

                // 5. Cari Hareket Satırı (Tarihle başlayan satırlar: "19.02.2026 SOD2026...")
                const dateMatch = fullLineText.match(/^(\d{2}[.\/-]\d{2}[.\/-]\d{4})/);
                if (dateMatch) {
                    if (fullLineText.includes("Nakli Yekün") && !fullLineText.match(/\d+,\d{2}/)) {
                        continue; // Bakiye/tutar içermeyen boş nakli yekün
                    }

                    const grid = ["", "", "", "", "", "", "", "", "", ""];
                    for (const it of lineItems) {
                        const x = it.x;
                        let col = 3; // varsayılan açıklama
                        if (x < b.tar_no) col = 0;
                        else if (x < b.no_tur) col = 1;
                        else if (x < b.tur_acik) col = 2;
                        else if (x < b.acik_dvz) col = 3;
                        else if (x < b.dvz_borc) col = 4;
                        else if (x < b.borc_alacak) col = 5;
                        else if (x < b.alacak_bakiye) col = 6;
                        else if (x < b.bakiye_ba) col = 7;
                        else if (x < b.ba_vade) col = 8;
                        else col = 9;

                        grid[col] = (grid[col] ? grid[col] + " " : "") + it.text;
                    }

                    structuredRows.push({
                        type: "TRANSACTION",
                        row: grid,
                        fullText: fullLineText
                    });
                }
            }
        }
        return structuredRows;
    },

    async importData(data, fileName, appInstance) {
        const app = this.getApp(appInstance);
        if (!app || !app.state) {
            throw new Error("Uygulama belleği (App.state) bulunamadı. Lütfen sayfayı yenileyiniz.");
        }
        if (!Array.isArray(app.state.cariler)) app.state.cariler = [];
        if (!Array.isArray(app.state.hareketler)) app.state.hareketler = [];
        if (!Array.isArray(app.state.faturalar)) app.state.faturalar = [];
        if (!Array.isArray(app.state.ceksenetler)) app.state.ceksenetler = [];

        if (!data || data.length === 0) {
            throw new Error("Dosyada işlenecek veri bulunamadı.");
        }

        // A) Eğer yapılandırılmış PDF satırları ise (CARI_HEADER ve TRANSACTION akışı)
        if (data.length > 0 && data[0].type) {
            return await this.importStructuredStream(data, fileName, app);
        }

        // B) Eğer 2D Matris ise (Excel veya CSV)
        if (Array.isArray(data)) {
            // Önce içinde "Cari Kodu :" şeritleri olan bir Çoklu Cari Ekstresi mi kontrol et
            let hasMultiCariHeaders = false;
            for (let r = 0; r < Math.min(30, data.length); r++) {
                const rowStr = (data[r] || []).join(" ");
                if (rowStr.match(/(?:Cari\s*Kodu?|Hesap\s*Kodu?)\s*:/i)) {
                    hasMultiCariHeaders = true;
                    break;
                }
            }

            if (hasMultiCariHeaders) {
                return await this.importMultiCariExcel(data, fileName, app);
            } else {
                return await this.importFlatTable(data, fileName, app);
            }
        }

        throw new Error("Dosya formatı ayrıştırılamadı.");
    },

    /**
     * Çoklu Cari Hesap Ekstresi (PDF Akışı)
     */
    async importStructuredStream(structuredRows, fileName, appInstance) {
        const app = this.getApp(appInstance);
        if (!app || !app.state) {
            throw new Error("Uygulama belleği (App.state) bulunamadı. Lütfen sayfayı yenileyiniz.");
        }

        // 1. Kullanıcının daha önce girdiği tüm vade, ödeme şekli, grup, söz ve notları kalıcı config'e aktar
        for (const oldC of (app.state.cariler || [])) {
            if (oldC.userConfigured || (oldC.odemeSekli && oldC.odemeSekli !== "") || oldC.cariGrup || oldC.odemeSozuTarihi || oldC.ozelNot) {
                if (typeof app.setCariConfig === "function") {
                    app.setCariConfig(oldC);
                }
            }
        }

        // 2. Yeni rapor yüklendiğinde eski hareket ve carileri temizle (son rapor aktif olsun, mükerrerlik birikmesin)
        app.state.cariler = [];
        app.state.hareketler = [];
        app.state.faturalar = [];
        app.state.ceksenetler = [];

        let currentCari = null;
        let importedCariler = 0;
        let importedHareketler = 0;
        let importedFaturalar = 0;
        let importedCekSenet = 0;

        for (const entry of structuredRows) {
            if (entry.type === "CARI_HEADER") {
                const kod = this.cleanStr(entry.kod);
                const unvan = this.cleanStr(entry.unvan);

                currentCari = app.state.cariler.find(c =>
                    c.kod === kod || (c.unvan && c.unvan.toUpperCase() === unvan.toUpperCase())
                );

                if (!currentCari) {
                    const saved = this.getSavedConfig(app, kod, unvan) || {};
                    currentCari = {
                        id: "C-" + kod.replace(/[^a-zA-Z0-9]/g, "") + "-" + Math.floor(Math.random() * 10000),
                        kod,
                        unvan: unvan || kod,
                        vkn: "",
                        telefon: saved.telefon || "",
                        email: saved.email || "",
                        yetkili: saved.yetkili || "",
                        cariGrup: saved.cariGrup || "",
                        cariTipi: saved.cariTipi || (kod.startsWith("320") ? "TEDARIKCI" : "MUSTERI"),
                        vadeGunu: saved.vadeGunu !== undefined ? saved.vadeGunu : 30,
                        vadeKurali: saved.vadeKurali || (saved.odemeSekli && saved.odemeSekli.includes("10") ? "TAKIP_EDEN_10" : "STANDART"),
                        odemeSekli: saved.odemeSekli || "",
                        odemeSozuTarihi: saved.odemeSozuTarihi || null,
                        odemeSozuTutar: saved.odemeSozuTutar || null,
                        ozelNot: saved.ozelNot || "",
                        userConfigured: !!(saved.odemeSekli || saved.userConfigured),
                        doviz: "TRY",
                        kaynak: `Zirve Ekstre (${fileName})`
                    };
                    app.state.cariler.push(currentCari);
                    importedCariler++;
                }
            } else if (entry.type === "CARI_HEADER_KOD_ONLY") {
                const kod = this.cleanStr(entry.kod);
                currentCari = app.state.cariler.find(c => c.kod === kod);
                if (!currentCari) {
                    const saved = this.getSavedConfig(app, kod, "") || {};
                    currentCari = {
                        id: "C-" + kod.replace(/[^a-zA-Z0-9]/g, "") + "-" + Math.floor(Math.random() * 10000),
                        kod,
                        unvan: kod,
                        vkn: "",
                        telefon: saved.telefon || "",
                        email: saved.email || "",
                        yetkili: saved.yetkili || "",
                        cariGrup: saved.cariGrup || "",
                        cariTipi: saved.cariTipi || (kod.startsWith("320") ? "TEDARIKCI" : "MUSTERI"),
                        vadeGunu: saved.vadeGunu !== undefined ? saved.vadeGunu : 30,
                        vadeKurali: saved.vadeKurali || (saved.odemeSekli && saved.odemeSekli.includes("10") ? "TAKIP_EDEN_10" : "STANDART"),
                        odemeSekli: saved.odemeSekli || "",
                        odemeSozuTarihi: saved.odemeSozuTarihi || null,
                        odemeSozuTutar: saved.odemeSozuTutar || null,
                        ozelNot: saved.ozelNot || "",
                        userConfigured: !!(saved.odemeSekli || saved.userConfigured),
                        doviz: "TRY",
                        kaynak: `Zirve Ekstre (${fileName})`
                    };
                    app.state.cariler.push(currentCari);
                    importedCariler++;
                }
            } else if (entry.type === "TRANSACTION") {
                if (!currentCari) {
                    currentCari = {
                        id: "C-GENEL-" + Math.floor(Math.random() * 10000),
                        kod: "GENEL",
                        unvan: "Genel / Tanımsız Cari",
                        vkn: "",
                        telefon: "",
                        vadeGunu: 30,
                        doviz: "TRY",
                        kaynak: `Zirve Ekstre (${fileName})`
                    };
                    app.state.cariler.push(currentCari);
                    importedCariler++;
                }

                const r = entry.row;
                const tarih = this.parseDate(r[0]) || new Date().toISOString().slice(0, 10);
                const evrakNo = this.cleanStr(r[1]) || "";
                const evrakTuru = this.cleanStr(r[2]) || "Cari İşlem";
                const aciklama = this.cleanStr(r[3]) || "";
                const dovizRaw = this.cleanStr(r[4]).toUpperCase();
                const evrakDoviz = (dovizRaw.includes("EUR") || dovizRaw.includes("EURO")) ? "EUR" : (dovizRaw.includes("USD") ? "USD" : "TRY");
                // Zirve Cari Ekstresindeki Borç ve Alacak tutarları resmi TL defter kayıtlarıdır.
                const doviz = "TRY";

                let borc = this.cleanNum(r[5]);
                let alacak = this.cleanNum(r[6]);
                const bakiye = this.cleanNum(r[7]);
                const ba = this.cleanStr(r[8]).toUpperCase();
                const vade = this.parseDate(r[9]) || tarih;

                // Açılış / devir satırında borç/alacak boş olup bakiye dolu olabilir
                if (borc === 0 && alacak === 0 && bakiye > 0) {
                    if (ba.includes("A")) alacak = bakiye;
                    else borc = bakiye;
                }

                if (borc > 0 || alacak > 0) {
                    // Zirve işlem türünü eşle
                    let islemTuru = "CARI_ISLEM";
                    const etUpper = evrakTuru.toUpperCase();
                    if (etUpper.includes("SATIŞ") || etUpper.includes("İHRACAT") || etUpper.includes("PERAKENDE")) islemTuru = "SATIS_FATURA";
                    else if (etUpper.includes("ALIŞ") || etUpper.includes("GİDER")) islemTuru = "ALIS_FATURA";
                    else if (etUpper.includes("SATIŞ İADE")) islemTuru = "ALIS_FATURA";
                    else if (etUpper.includes("ALIŞ İADE")) islemTuru = "SATIS_FATURA";
                    else if (etUpper.includes("GELEN HAVALE") || etUpper.includes("TAHSİLAT")) islemTuru = "TAHSILAT";
                    else if (etUpper.includes("GÖNDERİLEN HAVALE") || etUpper.includes("ÖDEME")) islemTuru = "ODEME";
                    else if (etUpper.includes("ÇEK-SENET GİRİŞ")) islemTuru = "CEK_SENET";
                    else if (etUpper.includes("ÇEK-SENET ÇIK")) islemTuru = "CEK_SENET";
                    else if (etUpper.includes("AÇILIŞ") || etUpper.includes("DEVİR")) islemTuru = borc > 0 ? "DEVIR_BORC" : "DEVIR_ALACAK";
                    else if (etUpper.includes("DEKONT") || etUpper.includes("VİRMAN")) islemTuru = borc > 0 ? "ODEME" : "TAHSILAT";

                    // Cari hareket ekle
                    app.state.hareketler.push({
                        id: "HAR-" + Date.now() + "-" + Math.floor(Math.random() * 1000000),
                        cariId: currentCari.id,
                        cariKod: currentCari.kod,
                        cariUnvan: currentCari.unvan,
                        tarih,
                        vadeTarihi: vade,
                        evrakNo: evrakNo || ("EVR-" + (importedHareketler + 1)),
                        islemTuru,
                        aciklama: aciklama || evrakTuru,
                        borc,
                        alacak,
                        doviz: "TRY",
                        orijinalDoviz: evrakDoviz,
                        kur: 1,
                        kaynak: `Zirve Ekstre (${fileName})`
                    });
                    importedHareketler++;

                    // Fatura takibine ekle
                    if ((islemTuru === "SATIS_FATURA" || islemTuru === "ALIS_FATURA") && evrakNo && evrakNo.length >= 4) {
                        const yon = islemTuru === "SATIS_FATURA" ? "SATIS" : "ALIS";
                        const tutar = borc > 0 ? borc : alacak;
                        if (!app.state.faturalar.some(f => f.faturaNo === evrakNo && f.cariId === currentCari.id)) {
                            app.state.faturalar.push({
                                id: "FAT-" + evrakNo + "-" + Math.floor(Math.random() * 1000),
                                faturaNo: evrakNo,
                                tarih,
                                vadeTarihi: vade,
                                yon,
                                cariId: currentCari.id,
                                cariUnvan: currentCari.unvan,
                                doviz,
                                genelToplam: tutar,
                                tlTutar: tutar,
                                aciklama: aciklama || evrakTuru
                            });
                            importedFaturalar++;
                        }
                    }

                    // Çek-Senet portföyüne ekle
                    if (islemTuru === "CEK_SENET" && (etUpper.includes("GİRİŞ") || etUpper.includes("ÇIK"))) {
                        const yon = etUpper.includes("GİRİŞ") ? "ALINAN" : "VERILEN";
                        const csTutar = alacak > 0 ? alacak : borc;
                        if (csTutar > 0 && !app.state.ceksenetler.some(cs => cs.evrakNo === evrakNo && cs.cariId === currentCari.id)) {
                            app.state.ceksenetler.push({
                                id: "CS-" + (evrakNo || Math.floor(Math.random() * 100000)),
                                cariId: currentCari.id,
                                cariUnvan: currentCari.unvan,
                                yon,
                                tur: yon === "ALINAN" ? "ALINAN CEK" : "VERILEN CEK",
                                vadeTarihi: vade,
                                banka: aciklama || (yon === "ALINAN" ? "Alınan Çek" : "Verilen Çek"),
                                evrakNo: evrakNo || ("ÇK-" + Math.floor(Math.random() * 10000)),
                                tutar: csTutar,
                                durum: yon === "ALINAN" ? "PORTFOYDE" : "ODENECEK"
                            });
                            importedCekSenet++;
                        }
                    }
                }
            } else if (entry.type === "CARI_SUMMARY") {
                if (currentCari) {
                    const bakiyeVal = this.cleanNum(entry.bakiye);
                    const baSign = this.cleanStr(entry.ba).toUpperCase();
                    currentCari.toplamBorc = this.cleanNum(entry.borc);
                    currentCari.toplamAlacak = this.cleanNum(entry.alacak);
                    currentCari.netBakiye = baSign.includes("B") ? bakiyeVal : -bakiyeVal;
                    currentCari.bakiyeYonu = baSign.includes("B") ? "ALACAKLIYIZ" : "BORCLUYUZ";
                }
            }
        }

        if (!app.state.settings) app.state.settings = {};
        app.state.settings.activeReport = {
            fileName: fileName,
            fileType: "PDF Ekstresi",
            uploadTime: new Date().toLocaleString("tr-TR"),
            carilerCount: importedCariler,
            hareketlerCount: importedHareketler,
            faturalarCount: importedFaturalar,
            ceksenetCount: importedCekSenet
        };

        if (typeof app.syncCariConfigs === "function") app.syncCariConfigs();
        if (typeof app.saveState === "function") await app.saveState();
        if (typeof app.recalculateAndRenderAll === "function") app.recalculateAndRenderAll();

        return {
            cariler: importedCariler,
            hareketler: importedHareketler,
            faturalar: importedFaturalar,
            ceksenet: importedCekSenet,
            totalCariler: app.state.cariler.length,
            isEkstre: true
        };
    },

    /**
     * Çoklu Cari Excel Ekstresi
     */
    async importMultiCariExcel(matrix, fileName, appInstance) {
        const app = this.getApp(appInstance);
        if (!app || !app.state) {
            throw new Error("Uygulama belleği (App.state) bulunamadı. Lütfen sayfayı yenileyiniz.");
        }

        // Kullanıcının daha önce girdiği tüm vade, ödeme şekli, grup, söz ve notları kalıcı config'e aktar
        for (const oldC of (app.state.cariler || [])) {
            if (oldC.userConfigured || (oldC.odemeSekli && oldC.odemeSekli !== "") || oldC.cariGrup || oldC.odemeSozuTarihi || oldC.ozelNot) {
                if (typeof app.setCariConfig === "function") {
                    app.setCariConfig(oldC);
                }
            }
        }

        app.state.cariler = [];
        app.state.hareketler = [];
        app.state.faturalar = [];
        app.state.ceksenetler = [];

        let currentCari = null;
        let importedCariler = 0;
        let importedHareketler = 0;

        let colTarih = 0, colEvrak = 1, colTur = 2, colAcik = 3, colDvz = 4;
        let colBorc = 5, colAlacak = 6, colBakiye = 7, colBA = 8, colVade = 9;

        for (let r = 0; r < matrix.length; r++) {
            const row = matrix[r] || [];
            const rowStr = row.map(c => this.cleanStr(c)).join(" ");
            if (!rowStr) continue;

            // Cari Başlığı
            const mCari = rowStr.match(/(?:Cari\s*Kodu?|Hesap\s*Kodu?)\s*:\s*(.*?)\s*(?:Cari\s*(?:Ad[ıi]?|Ünvan[ıi]?)|Hesap\s*Ad[ıi]?)\s*:\s*(.*)/i);
            if (mCari) {
                const kod = mCari[1].trim();
                const unvan = mCari[2].trim();

                currentCari = app.state.cariler.find(c =>
                    c.kod === kod || (c.unvan && c.unvan.toUpperCase() === unvan.toUpperCase())
                );

                if (!currentCari) {
                    const saved = this.getSavedConfig(app, kod, unvan) || {};
                    currentCari = {
                        id: "C-" + kod.replace(/[^a-zA-Z0-9]/g, "") + "-" + Math.floor(Math.random() * 10000),
                        kod,
                        unvan: unvan || kod,
                        vkn: "",
                        telefon: saved.telefon || "",
                        email: saved.email || "",
                        yetkili: saved.yetkili || "",
                        cariGrup: saved.cariGrup || "",
                        cariTipi: saved.cariTipi || (kod.startsWith("320") ? "TEDARIKCI" : "MUSTERI"),
                        vadeGunu: saved.vadeGunu !== undefined ? saved.vadeGunu : 30,
                        vadeKurali: saved.vadeKurali || (saved.odemeSekli && saved.odemeSekli.includes("10") ? "TAKIP_EDEN_10" : "STANDART"),
                        odemeSekli: saved.odemeSekli || "",
                        odemeSozuTarihi: saved.odemeSozuTarihi || null,
                        odemeSozuTutar: saved.odemeSozuTutar || null,
                        ozelNot: saved.ozelNot || "",
                        userConfigured: !!(saved.odemeSekli || saved.userConfigured),
                        doviz: "TRY",
                        kaynak: `Zirve Excel (${fileName})`
                    };
                    app.state.cariler.push(currentCari);
                    importedCariler++;
                }
                continue;
            }

            // Tablo Kolon Başlığı
            const lower = rowStr.toLowerCase();
            if (lower.includes("tarih") && (lower.includes("borç") || lower.includes("borc") || lower.includes("alacak"))) {
                colTarih = this.findColumnIndex(row, ["tarih"]);
                colEvrak = this.findColumnIndex(row, ["evrak no", "belge no"]);
                colTur = this.findColumnIndex(row, ["evrak türü", "işlem türü"]);
                colAcik = this.findColumnIndex(row, ["açıklama"]);
                colDvz = this.findColumnIndex(row, ["dvz", "cinsi", "döviz"]);
                colBorc = this.findColumnIndex(row, ["borç", "borc"]);
                colAlacak = this.findColumnIndex(row, ["alacak"]);
                colBakiye = this.findColumnIndex(row, ["bakiye"]);
                colBA = this.findColumnIndex(row, ["b/a", "ba"]);
                colVade = this.findColumnIndex(row, ["vade tarihi", "vade"]);
                continue;
            }

            // Toplam Tutarlar
            if (rowStr.includes("Toplam Tutarlar") || rowStr.includes("Genel Toplam")) {
                continue;
            }

            // Hareket Satırı
            if (currentCari) {
                const tarihRaw = colTarih !== -1 ? row[colTarih] : row[0];
                const tarih = this.parseDate(tarihRaw);
                if (tarih) {
                    const evrakNo = colEvrak !== -1 ? this.cleanStr(row[colEvrak]) : "";
                    const evrakTuru = colTur !== -1 ? this.cleanStr(row[colTur]) : "Cari İşlem";
                    const aciklama = colAcik !== -1 ? this.cleanStr(row[colAcik]) : "";
                    const borc = colBorc !== -1 ? this.cleanNum(row[colBorc]) : 0;
                    const alacak = colAlacak !== -1 ? this.cleanNum(row[colAlacak]) : 0;
                    const vadeRaw = colVade !== -1 ? row[colVade] : null;
                    const vade = this.parseDate(vadeRaw) || tarih;

                    if (borc > 0 || alacak > 0) {
                        app.state.hareketler.push({
                            id: "HAR-" + Date.now() + "-" + Math.floor(Math.random() * 1000000),
                            cariId: currentCari.id,
                            cariKod: currentCari.kod,
                            cariUnvan: currentCari.unvan,
                            tarih,
                            vadeTarihi: vade,
                            evrakNo: evrakNo || ("EVR-" + (importedHareketler + 1)),
                            islemTuru: borc > 0 ? "SATIS_FATURA" : "TAHSILAT",
                            aciklama: aciklama || evrakTuru,
                            borc,
                            alacak,
                            doviz: "TRY",
                            kur: 1,
                            kaynak: `Zirve Excel (${fileName})`
                        });
                        importedHareketler++;
                    }
                }
            }
        }

        if (!app.state.settings) app.state.settings = {};
        app.state.settings.activeReport = {
            fileName: fileName,
            fileType: "Excel Ekstresi",
            uploadTime: new Date().toLocaleString("tr-TR"),
            carilerCount: importedCariler,
            hareketlerCount: importedHareketler,
            faturalarCount: app.state.faturalar.length,
            ceksenetCount: app.state.ceksenetler.length
        };

        if (typeof app.syncCariConfigs === "function") app.syncCariConfigs();
        if (typeof app.saveState === "function") await app.saveState();
        if (typeof app.recalculateAndRenderAll === "function") app.recalculateAndRenderAll();

        return {
            cariler: importedCariler,
            hareketler: importedHareketler,
            totalCariler: app.state.cariler.length,
            isEkstre: true
        };
    },

    /**
     * Düz Tablo / Mizan / Cari Bakiye Listesi
     */
    async importFlatTable(matrix, fileName, appInstance) {
        const app = this.getApp(appInstance);
        if (!app || !app.state) {
            throw new Error("Uygulama belleği (App.state) bulunamadı. Lütfen sayfayı yenileyiniz.");
        }

        // Kullanıcının daha önce girdiği tüm vade, ödeme şekli, grup, söz ve notları kalıcı config'e aktar
        for (const oldC of (app.state.cariler || [])) {
            if (oldC.userConfigured || (oldC.odemeSekli && oldC.odemeSekli !== "") || oldC.cariGrup || oldC.odemeSozuTarihi || oldC.ozelNot) {
                if (typeof app.setCariConfig === "function") {
                    app.setCariConfig(oldC);
                }
            }
        }

        app.state.cariler = [];
        app.state.hareketler = [];
        app.state.faturalar = [];
        app.state.ceksenetler = [];
        let headerRowIdx = -1;
        let colKod = -1, colUnvan = -1, colBorc = -1, colAlacak = -1, colBakiye = -1, colBA = -1;
        let colVkn = -1, colTel = -1;

        for (let r = 0; r < Math.min(15, matrix.length); r++) {
            const row = matrix[r].map(c => this.cleanStr(c));
            const idxKod = this.findColumnIndex(row, ["carikod", "kod", "hesapkodu", "firmakodu", "musterikodu", "crk", "hesapno"]);
            const idxUnvan = this.findColumnIndex(row, ["cariunvan", "unvan", "unvani", "firmaunvani", "hesapismi", "hesapadi", "firmaadi", "musteriadi", "musteri", "adsoyad"]);
            const idxBorc = this.findColumnIndex(row, ["borctoplam", "borctutar", "borc", "yerelborc", "borcbakiye", "debit"]);
            const idxAlacak = this.findColumnIndex(row, ["alacaktoplam", "alacaktutar", "alacak", "yerelalacak", "alacakbakiye", "credit"]);

            if (idxKod !== -1 || idxUnvan !== -1) {
                headerRowIdx = r;
                colKod = idxKod;
                colUnvan = idxUnvan;
                colBorc = idxBorc;
                colAlacak = idxAlacak;
                colBakiye = this.findColumnIndex(row, ["bakiye", "netbakiye", "kalan", "sonbakiye", "balance"]);
                colBA = this.findColumnIndex(row, ["ba", "borcalacak", "yon", "b/a", "durum"]);
                colVkn = this.findColumnIndex(row, ["vkn", "vergino", "tckimlikno", "tcno"]);
                colTel = this.findColumnIndex(row, ["telefon", "tel", "gsm"]);
                break;
            }
        }

        if (headerRowIdx === -1) {
            headerRowIdx = 0;
            const r0 = matrix[0].map(c => this.cleanStr(c));
            colKod = this.findColumnIndex(r0, ["kod", "hesap"]);
            colUnvan = this.findColumnIndex(r0, ["unvan", "adi", "isim"]);
            colBorc = this.findColumnIndex(r0, ["borc"]);
            colAlacak = this.findColumnIndex(r0, ["alacak"]);

            if (colKod === -1 && colUnvan === -1) {
                throw new Error("Dosyada Cari Kodu veya Cari Ünvan sütunları bulunamadı. Lütfen Zirve'den standart Cari Bakiye Listesi veya Cari Ekstre alıp yükleyin.");
            }
        }

        let importedCariler = 0;
        let importedHareketler = 0;

        for (let r = headerRowIdx + 1; r < matrix.length; r++) {
            const row = matrix[r];
            if (!row || row.length === 0) continue;

            let kod = colKod !== -1 ? this.cleanStr(row[colKod]) : "";
            let unvan = colUnvan !== -1 ? this.cleanStr(row[colUnvan]) : "";

            const rowText = row.join(" ").toLowerCase();
            if (rowText.includes("genel toplam") || rowText.includes("toplam:") || rowText.includes("nakli yekün")) {
                continue;
            }
            if (!kod && !unvan) continue;
            if (!kod) kod = "CR-" + (r + 1);
            if (!unvan) unvan = kod;

            let cari = app.state.cariler.find(c => c.kod === kod || c.unvan.toUpperCase() === unvan.toUpperCase());
            if (!cari) {
                const saved = this.getSavedConfig(app, kod, unvan) || {};
                cari = {
                    id: "C-" + kod.replace(/[^a-zA-Z0-9]/g, "") + "-" + Math.floor(Math.random() * 10000),
                    kod,
                    unvan,
                    vkn: colVkn !== -1 ? this.cleanStr(row[colVkn]) : "",
                    telefon: colTel !== -1 ? this.cleanStr(row[colTel]) : (saved.telefon || ""),
                    email: saved.email || "",
                    yetkili: saved.yetkili || "",
                    cariGrup: saved.cariGrup || "",
                    cariTipi: saved.cariTipi || (kod.startsWith("320") ? "TEDARIKCI" : "MUSTERI"),
                    vadeGunu: saved.vadeGunu !== undefined ? saved.vadeGunu : 30,
                    vadeKurali: saved.vadeKurali || (saved.odemeSekli && saved.odemeSekli.includes("10") ? "TAKIP_EDEN_10" : "STANDART"),
                    odemeSekli: saved.odemeSekli || "",
                    odemeSozuTarihi: saved.odemeSozuTarihi || null,
                    odemeSozuTutar: saved.odemeSozuTutar || null,
                    ozelNot: saved.ozelNot || "",
                    userConfigured: !!(saved.odemeSekli || saved.userConfigured),
                    doviz: "TRY",
                    kaynak: `Zirve Mizan (${fileName})`
                };
                app.state.cariler.push(cari);
                importedCariler++;
            }

            let borc = colBorc !== -1 ? this.cleanNum(row[colBorc]) : 0;
            let alacak = colAlacak !== -1 ? this.cleanNum(row[colAlacak]) : 0;

            if (borc === 0 && alacak === 0 && colBakiye !== -1) {
                const bakiyeVal = this.cleanNum(row[colBakiye]);
                const baSign = colBA !== -1 ? this.cleanStr(row[colBA]).toUpperCase() : "";
                if (baSign.includes("A") || bakiyeVal < 0) {
                    alacak = Math.abs(bakiyeVal);
                } else {
                    borc = Math.abs(bakiyeVal);
                }
            }

            if (borc > 0 || alacak > 0) {
                app.state.hareketler.push({
                    id: "HAR-DEV-" + Date.now() + "-" + r,
                    cariId: cari.id,
                    cariKod: cari.kod,
                    cariUnvan: cari.unvan,
                    tarih: new Date().getFullYear() + "-01-01",
                    vadeTarihi: new Date().toISOString().slice(0, 10),
                    evrakNo: "DEVIR-" + new Date().getFullYear(),
                    islemTuru: borc >= alacak ? "DEVIR_BORC" : "DEVIR_ALACAK",
                    aciklama: `Zirve Bakiye / Mizan Aktarımı (${fileName})`,
                    borc,
                    alacak,
                    doviz: "TRY",
                    kur: 1,
                    kaynak: `Zirve Mizan (${fileName})`
                });
                importedHareketler++;
            }
        }

        if (!app.state.settings) app.state.settings = {};
        app.state.settings.activeReport = {
            fileName: fileName,
            fileType: "Bakiye Listesi / Mizan",
            uploadTime: new Date().toLocaleString("tr-TR"),
            carilerCount: importedCariler,
            hareketlerCount: importedHareketler,
            faturalarCount: app.state.faturalar.length,
            ceksenetCount: app.state.ceksenetler.length
        };

        if (typeof app.syncCariConfigs === "function") app.syncCariConfigs();
        if (typeof app.saveState === "function") await app.saveState();
        if (typeof app.recalculateAndRenderAll === "function") app.recalculateAndRenderAll();

        return {
            cariler: importedCariler,
            hareketler: importedHareketler,
            totalCariler: app.state.cariler.length,
            isEkstre: false
        };
    }
};
