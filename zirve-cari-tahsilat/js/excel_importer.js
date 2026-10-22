/**
 * ZİRVE EXCEL & PDF İÇE AKTARICI (Zirve File Importer)
 * Zirve Yazılım'dan alınan Excel (.xlsx, .xls), CSV, Metin (.txt) ve PDF (.pdf)
 * formatındaki Cari Bakiye Listesi, Cari Hesap Ekstresi, Mizan veya Fatura dökümlerini
 * otomatik analiz eder, cari kartları, borç/alacak bakiyelerini ve hareketleri oluşturur.
 */

window.ZirveExcelImporter = {
    cleanStr(val) {
        if (val === null || val === undefined) return "";
        return String(val).trim();
    },

    cleanNum(val) {
        if (typeof val === "number") return val;
        if (!val) return 0;
        let s = String(val).trim().replace(/\s/g, "");
        // Türkçe format: 1.250,50 -> 1250.50
        if (s.includes(",") && s.includes(".")) {
            if (s.indexOf(".") < s.indexOf(",")) {
                s = s.replace(/\./g, "").replace(",", ".");
            } else {
                s = s.replace(/,/g, "");
            }
        } else if (s.includes(",")) {
            s = s.replace(",", ".");
        }
        // Parantez içi negatif sayı: (150.00) -> -150.00
        if (/^\(.*\)$/.test(s)) {
            s = "-" + s.replace(/[()]/g, "");
        }
        const num = parseFloat(s);
        return isNaN(num) ? 0 : num;
    },

    parseDate(val) {
        if (!val) return "";
        if (val instanceof Date) return val.toISOString().slice(0, 10);
        // Excel serial date number (e.g. 45200)
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

    async processFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        let rows = [];

        if (ext === "csv" || ext === "txt") {
            const text = await file.text();
            rows = this.parseCsv(text);
        } else if (ext === "xlsx" || ext === "xls") {
            rows = await this.parseExcel(file);
        } else if (ext === "pdf") {
            rows = await this.parsePdf(file);
        } else {
            throw new Error("Desteklenmeyen dosya türü (" + ext + "). Lütfen Zirve'den aldığınız .xlsx, .xls, .csv veya .pdf dosyasını yükleyin.");
        }

        return this.importRows(rows, file.name);
    },

    async parseExcel(file) {
        if (!window.XLSX) {
            throw new Error("Excel kütüphanesi yüklenemedi. Lütfen internet bağlantınızı kontrol ediniz veya sayfayı yenileyiniz.");
        }
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        return XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
    },

    async parsePdf(file) {
        if (!window.pdfjsLib) {
            throw new Error("PDF okuyucu kütüphanesi yüklenemedi. Sayfayı yenileyip tekrar deneyiniz.");
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';
        const buffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
        const rows = [];

        for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const textContent = await page.getTextContent();

            // PDF satırlarını Y koordinatlarına göre grupla
            const lineMap = {};
            for (const item of textContent.items) {
                const y = Math.round(item.transform[5] / 3) * 3; // Küçük Y farklarını tolere et
                if (!lineMap[y]) lineMap[y] = [];
                lineMap[y].push({ x: item.transform[4], text: item.str });
            }

            // Yukarıdan aşağıya Y azalan sırala
            const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
            for (const y of sortedYs) {
                const lineItems = lineMap[y].sort((a, b) => a.x - b.x);
                const cells = lineItems.map(it => it.text.trim()).filter(Boolean);
                if (cells.length > 0) rows.push(cells);
            }
        }
        return rows;
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

    importRows(matrix, fileName) {
        if (!matrix || matrix.length < 2) {
            throw new Error("Dosyada işlenecek veri bulunamadı.");
        }

        // 1. Zirve Tekil Cari Ekstresi Kontrolü:
        // Eğer ilk 5 satırda "Cari Kodu: ..." ve "Cari Ünvanı: ..." yazıyorsa tekil cari ekstresidir.
        let singleCariKod = "";
        let singleCariUnvan = "";

        for (let r = 0; r < Math.min(8, matrix.length); r++) {
            const rowStr = matrix[r].join(" ");
            const mKod = rowStr.match(/(?:Cari\s*Kodu?|Hesap\s*Kodu?)\s*[:=]\s*([^\s,;]+)/i);
            if (mKod) singleCariKod = mKod[1].trim();
            const mUnv = rowStr.match(/(?:Cari\s*Ünvan[ıi]?|Ünvan[ıi]?|Hesap\s*Ad[ıi]?)\s*[:=]\s*([^;,\n]+)/i);
            if (mUnv) singleCariUnvan = mUnv[1].trim();
        }

        // 2. Başlık Satırını Bul
        let headerRowIdx = -1;
        let colKod = -1, colUnvan = -1, colBorc = -1, colAlacak = -1, colBakiye = -1, colBA = -1;
        let colTarih = -1, colVade = -1, colEvrak = -1, colAciklama = -1, colIslemTuru = -1;
        let colVkn = -1, colTel = -1;

        for (let r = 0; r < Math.min(15, matrix.length); r++) {
            const row = matrix[r].map(c => this.cleanStr(c));
            const idxKod = this.findColumnIndex(row, ["carikod", "kod", "hesapkodu", "firmakodu", "musterikodu", "crk", "hesapno"]);
            const idxUnvan = this.findColumnIndex(row, ["cariunvan", "unvan", "unvani", "firmaunvani", "hesapismi", "hesapadi", "firmaadi", "musteriadi", "musteri", "adsoyad"]);
            const idxBorc = this.findColumnIndex(row, ["borctoplam", "borctutar", "borc", "yerelborc", "borcbakiye", "debit"]);
            const idxAlacak = this.findColumnIndex(row, ["alacaktoplam", "alacaktutar", "alacak", "yerelalacak", "alacakbakiye", "credit"]);
            const idxTarih = this.findColumnIndex(row, ["tarih", "islemtarihi", "evraktarihi", "tar", "date"]);

            // Eğer kod ve ünvan varsa ya da tekil ekstre olup tarih + borç varsa
            if ((idxKod !== -1 && idxUnvan !== -1) || (singleCariKod && idxTarih !== -1 && (idxBorc !== -1 || idxAlacak !== -1))) {
                headerRowIdx = r;
                colKod = idxKod;
                colUnvan = idxUnvan;
                colBorc = idxBorc;
                colAlacak = idxAlacak;
                colBakiye = this.findColumnIndex(row, ["bakiye", "netbakiye", "kalan", "sonbakiye", "balance"]);
                colBA = this.findColumnIndex(row, ["ba", "borcalacak", "yon", "b/a", "durum"]);
                colTarih = idxTarih;
                colVade = this.findColumnIndex(row, ["vadetarihi", "vade", "odemetarihi", "vadtar", "duedate"]);
                colEvrak = this.findColumnIndex(row, ["evrakno", "belgeno", "fisno", "faturano", "serino", "no"]);
                colAciklama = this.findColumnIndex(row, ["aciklama", "aciklama1", "not", "detay", "description"]);
                colIslemTuru = this.findColumnIndex(row, ["islemturu", "tur", "tipi", "modul", "islem", "hareketturu"]);
                colVkn = this.findColumnIndex(row, ["vkn", "vergino", "tckimlikno", "tcno", "vergidairesi"]);
                colTel = this.findColumnIndex(row, ["telefon", "tel", "gsm", "ceptel"]);
                break;
            }
        }

        if (headerRowIdx === -1) {
            // Eğer başlık bulunamadıysa ilk satırı varsayılan kabul edip sayısal/metin kolon tahmin et
            headerRowIdx = 0;
            const r0 = matrix[0].map(c => this.cleanStr(c));
            colKod = this.findColumnIndex(r0, ["kod", "hesap"]);
            colUnvan = this.findColumnIndex(r0, ["unvan", "adi", "isim", "aciklama"]);
            colBorc = this.findColumnIndex(r0, ["borc"]);
            colAlacak = this.findColumnIndex(r0, ["alacak"]);
            colTarih = this.findColumnIndex(r0, ["tarih", "tar"]);
            colEvrak = this.findColumnIndex(r0, ["evrak", "fis", "fatura"]);

            if (colKod === -1 && colUnvan === -1 && !singleCariKod) {
                throw new Error("Dosyada Cari Kodu ve Cari Ünvan sütunları bulunamadı. Lütfen Zirve'den standart Cari Bakiye Listesi veya Cari Ekstre alıp yükleyin.");
            }
        }

        const isEkstre = colTarih !== -1 && (colEvrak !== -1 || colBorc !== -1 || colAlacak !== -1);
        let importedCariler = 0;
        let importedHareketler = 0;

        for (let r = headerRowIdx + 1; r < matrix.length; r++) {
            const row = matrix[r];
            if (!row || row.length === 0) continue;

            let kod = colKod !== -1 ? this.cleanStr(row[colKod]) : singleCariKod;
            let unvan = colUnvan !== -1 ? this.cleanStr(row[colUnvan]) : (singleCariUnvan || kod);

            // Alt toplam ve boş satırları atla
            const rowText = row.join(" ").toLowerCase();
            if (rowText.includes("genel toplam") || rowText.includes("toplam:") || rowText.includes("nakli yekün") || rowText.includes("sayfa toplamı")) {
                continue;
            }
            if (!kod && !unvan) continue;
            if (!kod && unvan) kod = "CR-" + (r + 1);
            if (!unvan && kod) unvan = kod;

            // Cari kartı ekle veya güncelle
            let cari = window.App.state.cariler.find(c => c.kod === kod || c.unvan.toUpperCase() === unvan.toUpperCase());
            if (!cari) {
                cari = {
                    id: "C-FILE-" + kod.replace(/[^a-zA-Z0-9]/g, "") + "-" + Math.floor(Math.random() * 10000),
                    kod,
                    unvan,
                    vkn: colVkn !== -1 ? this.cleanStr(row[colVkn]) : "",
                    telefon: colTel !== -1 ? this.cleanStr(row[colTel]) : "",
                    vadeGunu: 30,
                    doviz: "TRY",
                    kaynak: `Zirve (${fileName})`
                };
                window.App.state.cariler.push(cari);
                importedCariler++;
            }

            let borc = colBorc !== -1 ? this.cleanNum(row[colBorc]) : 0;
            let alacak = colAlacak !== -1 ? this.cleanNum(row[colAlacak]) : 0;

            // Eğer Borç ve Alacak ayrı değil tek bir Bakiye sütunu varsa:
            if (borc === 0 && alacak === 0 && colBakiye !== -1) {
                const bakiyeVal = this.cleanNum(row[colBakiye]);
                const baSign = colBA !== -1 ? this.cleanStr(row[colBA]).toUpperCase() : "";
                if (baSign.includes("A") || bakiyeVal < 0) {
                    alacak = Math.abs(bakiyeVal);
                } else {
                    borc = Math.abs(bakiyeVal);
                }
            }

            if (isEkstre) {
                // Cari Hareket Satırı
                const tarih = (colTarih !== -1 ? this.parseDate(row[colTarih]) : "") || new Date().toISOString().slice(0, 10);
                const vade = (colVade !== -1 ? this.parseDate(row[colVade]) : "") || tarih;
                const evrak = colEvrak !== -1 ? this.cleanStr(row[colEvrak]) : ("EVR-" + (r + 1));
                const acik = colAciklama !== -1 ? this.cleanStr(row[colAciklama]) : "Zirve Ekstre Kaydı";
                const tur = colIslemTuru !== -1 ? this.cleanStr(row[colIslemTuru]) : (borc > 0 ? "SATIS_FATURA" : "TAHSILAT");

                if (borc > 0 || alacak > 0) {
                    window.App.state.hareketler.push({
                        id: "HAR-FILE-" + Date.now() + "-" + r,
                        cariId: cari.id,
                        cariKod: cari.kod,
                        cariUnvan: cari.unvan,
                        tarih,
                        vadeTarihi: vade,
                        evrakNo: evrak,
                        islemTuru: tur,
                        aciklama: acik,
                        borc,
                        alacak,
                        doviz: "TRY",
                        kur: 1,
                        kaynak: `Zirve (${fileName})`
                    });
                    importedHareketler++;
                }
            } else {
                // Sadece Cari Bakiye / Mizan Listesi (Devir veya Bakiye olarak ekle)
                if (borc > 0 || alacak > 0) {
                    // Mevcut devir kaydı varsa güncelle veya yenisini ekle
                    window.App.state.hareketler.push({
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
        }

        window.App.saveState();
        window.App.recalculateAndRenderAll();

        return {
            cariler: importedCariler,
            hareketler: importedHareketler,
            totalCariler: window.App.state.cariler.length,
            isEkstre
        };
    }
};
