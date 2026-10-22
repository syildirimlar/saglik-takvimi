/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Excel Servisi - SheetJS İle Çok Sekmeli XLSX Dışa/İçe Aktarma (Import/Export)
 */

const ExcelService = (function() {

    function exportFullWorkbook() {
        if (typeof XLSX === 'undefined') {
            alert("Excel kütüphanesi yüklenemedi!");
            return;
        }

        const wb = XLSX.utils.book_new();

        // 1. Sekme: Günlük ve Dönemsel Görevler
        const tasks = SODSAN_DB.getAllTasks().map(t => ({
            "Tarih": t.date,
            "Görev": t.title,
            "Kategori": t.category,
            "Açıklama": t.description || "",
            "Sorumlu": t.assignedTo || "",
            "Öncelik": t.priority || "Normal",
            "Durum": t.status,
            "Son Tarih": t.dueDate || "",
            "Tamamlanma Tarihi": t.completedAt || "",
            "Not": t.note || ""
        }));
        const wsTasks = XLSX.utils.json_to_sheet(tasks);
        XLSX.utils.book_append_sheet(wb, wsTasks, "Görevler");

        // 2. Sekme: 2026 Vergi ve SGK Takvimi
        const taxes = SODSAN_DB.getTaxes().map(tx => ({
            "Dönem": tx.period,
            "Vergi / Yükümlülük Türü": tx.type,
            "Beyanname Tarihi": tx.declDate,
            "Son Ödeme Tarihi": tx.dueDate,
            "Tahmini Tutar (₺)": tx.estAmount,
            "Beyanname Verildi mi?": tx.declSubmitted ? "Evet" : "Hayır",
            "Ödeme Yapıldı mı?": tx.paid ? "Evet" : "Hayır",
            "Mali Müşavir Kontrolü": tx.advisorChecked ? "Evet" : "Hayır",
            "Durum": tx.status,
            "Not": tx.note || ""
        }));
        const wsTaxes = XLSX.utils.json_to_sheet(taxes);
        XLSX.utils.book_append_sheet(wb, wsTaxes, "Vergi ve SGK Takvimi");

        // 3. Sekme: Ödeme Takip Listesi
        const payments = SODSAN_DB.getPayments().map(p => ({
            "Tarih": p.date,
            "Firma / Kurum": p.entity,
            "Ödeme Türü": p.category,
            "Açıklama": p.description || "",
            "Tutar (₺)": p.amount,
            "Banka": p.bank || "",
            "Hesap": p.account || "",
            "Ödeme Yöntemi": p.method || "",
            "Son Ödeme Tarihi": p.dueDate,
            "Durum": p.status,
            "Dekont No": p.receiptNo || "",
            "Not": p.note || ""
        }));
        const wsPayments = XLSX.utils.json_to_sheet(payments);
        XLSX.utils.book_append_sheet(wb, wsPayments, "Ödeme Takibi");

        // 4. Sekme: Fatura Takip Listesi
        const invoices = SODSAN_DB.getInvoices().map(inv => ({
            "Fatura Tarihi": inv.date,
            "Firma": inv.company,
            "Vergi No": inv.taxNo || "",
            "Fatura No": inv.invoiceNo,
            "Açıklama": inv.description || "",
            "Matrah (₺)": inv.amount,
            "KDV Oranı (%)": inv.vatRate || 20,
            "KDV Tutarı (₺)": inv.vatAmount,
            "Genel Toplam (₺)": inv.totalAmount,
            "Vade Tarihi": inv.dueDate,
            "Kayıt Tarihi": inv.recordDate || "",
            "Ödeme Durumu": inv.status,
            "Muhasebe Kaydı": inv.accountingRecorded ? "Kaydedildi" : "Bekliyor",
            "Not": inv.note || ""
        }));
        const wsInvoices = XLSX.utils.json_to_sheet(invoices);
        XLSX.utils.book_append_sheet(wb, wsInvoices, "Fatura Takibi");

        // 5. Sekme: Mali Müşavir Ziyaretleri
        const visits = SODSAN_DB.getAdvisorVisits().map(v => ({
            "Ziyaret Tarihi": v.date,
            "Başlık": v.title,
            "Amaç": v.purpose,
            "Görüşülen Konular": v.topicsDiscussed || "",
            "Eksik Kalanlar": v.missingItems || "",
            "Mali Müşavirden Beklenenler": v.pendingAdvisor || "",
            "SODSAN'ın Yapacakları": v.pendingSODSAN || "",
            "Sonraki Ziyaret": v.nextVisitDate || "",
            "Durum": v.status
        }));
        const wsVisits = XLSX.utils.json_to_sheet(visits);
        XLSX.utils.book_append_sheet(wb, wsVisits, "Mali Müşavir");

        // 6. Sekme: Personel ve Bordro
        const payrollData = SODSAN_DB.getPayrollData();
        const payrollSteps = (payrollData.steps || []).map(s => ({
            "Aşama No": s.id,
            "Süreç Adımı": s.step,
            "Hedef Gün": `Her Ayın ${s.targetDay}'i`,
            "Tamamlandı mı?": s.done ? "Evet" : "Hayır",
            "Tamamlanma Tarihi": s.doneDate || "",
            "Not": s.note || ""
        }));
        const wsPayroll = XLSX.utils.json_to_sheet(payrollSteps);
        XLSX.utils.book_append_sheet(wb, wsPayroll, "Bordro Süreci");

        // 7. Sekme: Eksik Bilgiler Tablosu
        const missing = SODSAN_DB.getMissingInfoItems().map(m => ({
            "Konu / Yükümlülük": m.subject,
            "Kategori": m.category,
            "Mevcut Durum": m.status,
            "Açıklama": m.currentNote,
            "Aksiyon Planı": m.actionPlan,
            "Tanımlanan Değer": m.enteredValue || "Henüz Girilmedi"
        }));
        const wsMissing = XLSX.utils.json_to_sheet(missing);
        XLSX.utils.book_append_sheet(wb, wsMissing, "Eksik Bilgiler");

        // Dosya Adı: SODSAN_2026_Mali_Isler_Takvimi_Guncel.xlsx
        const fileName = "SODSAN_2026_Mali_Isler_Takvimi_Guncel.xlsx";
        XLSX.writeFile(wb, fileName);
    }

    function exportInvoicesExcel() {
        const invoices = SODSAN_DB.getInvoices().map(inv => ({
            "Fatura Tarihi": inv.date,
            "Firma": inv.company,
            "Vergi No": inv.taxNo || "",
            "Fatura No": inv.invoiceNo,
            "Açıklama": inv.description || "",
            "Matrah": inv.amount,
            "KDV (%)": inv.vatRate || 20,
            "KDV Tutarı": inv.vatAmount,
            "Genel Toplam": inv.totalAmount,
            "Vade Tarihi": inv.dueDate,
            "Durum": inv.status,
            "Muhasebe Kaydı": inv.accountingRecorded ? "Evet" : "Hayır",
            "Not": inv.note || ""
        }));
        const ws = XLSX.utils.json_to_sheet(invoices);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Faturalar");
        XLSX.writeFile(wb, "SODSAN_Fatura_Listesi.xlsx");
    }

    function exportTaxesExcel() {
        const taxes = SODSAN_DB.getTaxes().map(tx => ({
            "Dönem": tx.period,
            "Tür": tx.type,
            "Beyanname": tx.declDate,
            "Son Ödeme": tx.dueDate,
            "Tutar": tx.estAmount,
            "Beyanname Verildi": tx.declSubmitted ? "Evet" : "Hayır",
            "Ödendi": tx.paid ? "Evet" : "Hayır",
            "Mali Müşavir Kontrolü": tx.advisorChecked ? "Evet" : "Hayır",
            "Durum": tx.status
        }));
        const ws = XLSX.utils.json_to_sheet(taxes);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Vergiler");
        XLSX.writeFile(wb, "SODSAN_2026_Vergi_Takvimi.xlsx");
    }

    function exportFullReportExcel() {
        exportFullWorkbook();
    }

    // Excel'den İçe Aktarma (Import XLSX)
    function handleExcelImport(file, callback) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                let importedCount = 0;

                // Fatura sekmesini tara
                if (workbook.SheetNames.includes("Fatura Takibi") || workbook.SheetNames.includes("Faturalar")) {
                    const sheetName = workbook.SheetNames.find(n => n.includes("Fatura"));
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                    rows.forEach(r => {
                        SODSAN_DB.saveInvoice({
                            date: r["Fatura Tarihi"] || r["Tarih"] || "2026-10-21",
                            company: r["Firma"] || r["Cari Unvan"] || "Bilinmeyen Firma",
                            taxNo: String(r["Vergi No"] || r["VKN"] || ""),
                            invoiceNo: String(r["Fatura No"] || "FAT-" + Date.now()),
                            description: r["Açıklama"] || "",
                            amount: parseFloat(r["Matrah"] || r["Tutar"] || 0),
                            vatRate: parseFloat(r["KDV Oranı (%)"] || 20),
                            vatAmount: parseFloat(r["KDV Tutarı"] || 0),
                            totalAmount: parseFloat(r["Genel Toplam (₺)"] || r["Genel Toplam"] || 0),
                            dueDate: r["Vade Tarihi"] || "2026-10-30",
                            status: r["Ödeme Durumu"] || "Ödeme bekliyor",
                            accountingRecorded: true,
                            note: r["Not"] || "Excel'den aktarıldı"
                        });
                        importedCount++;
                    });
                }

                // Görevler sekmesini tara
                if (workbook.SheetNames.includes("Görevler")) {
                    const rows = XLSX.utils.sheet_to_json(workbook.Sheets["Görevler"]);
                    rows.forEach(r => {
                        SODSAN_DB.saveTask({
                            date: r["Tarih"] || "2026-10-21",
                            dueDate: r["Son Tarih"] || r["Tarih"] || "2026-10-21",
                            title: r["Görev"] || r["Başlık"] || "Görev",
                            category: r["Kategori"] || "Diğer",
                            priority: r["Öncelik"] || "Normal",
                            status: r["Durum"] || "Bekliyor",
                            assignedTo: r["Sorumlu"] || "Muhasebe",
                            description: r["Açıklama"] || "",
                            note: r["Not"] || ""
                        });
                        importedCount++;
                    });
                }

                if (callback) callback(true, `Excel başarıyla aktarıldı! (${importedCount} kayıt güncellendi)`);
            } catch (err) {
                console.error("Excel import error:", err);
                if (callback) callback(false, "Excel dosyası okunamadı: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    return {
        exportFullWorkbook,
        exportInvoicesExcel,
        exportTaxesExcel,
        exportFullReportExcel,
        handleExcelImport
    };
})();
