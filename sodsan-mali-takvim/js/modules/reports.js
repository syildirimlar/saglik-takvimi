/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Raporlama ve Finansal Analiz Modülü - Nakit Akışı, Kategori Dağılımı ve Projeksiyon
 */

const ReportsModule = (function() {

    function render(targetContainerId = "reportsView") {
        const container = document.getElementById(targetContainerId);
        if (!container) return;

        const activeDate = SODSAN_DB.getActiveDate();
        const activeMonth = activeDate.slice(0, 7); // "2026-10"

        const allPayments = SODSAN_DB.getPayments();
        const allInvoices = SODSAN_DB.getInvoices();

        // Bu ay yapılan ödemeler (status == Ödendi ve date starts with activeMonth)
        const thisMonthPaid = allPayments.filter(p => p.status === "Ödendi" && p.dueDate && p.dueDate.startsWith(activeMonth));
        const totalPaidMonth = thisMonthPaid.reduce((s, p) => s + (p.amount || 0), 0);

        // Bu ay yapılacak (bekleyen) ödemeler
        const thisMonthPending = allPayments.filter(p => p.status !== "Ödendi" && p.dueDate && p.dueDate.startsWith(activeMonth));
        const totalPendingMonth = thisMonthPending.reduce((s, p) => s + (p.amount || 0), 0);

        // Bekleyen ve Gecikenler
        const overduePayments = allPayments.filter(p => p.dueDate < activeDate && p.status !== "Ödendi");
        const overdueInvoices = allInvoices.filter(i => i.dueDate < activeDate && i.status !== "Ödendi");
        const totalOverdue = overduePayments.reduce((s, p) => s + (p.amount || 0), 0) + overdueInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);

        // Kategori Bazlı Dağılım (Tüm aktif ay için)
        const categories = [
            { name: "Tedarikçi", cat: "Tedarikçi" },
            { name: "Vergi", cat: "Vergi" },
            { name: "SGK", cat: "SGK" },
            { name: "Maaş", cat: "Maaş" },
            { name: "Avans", cat: "Avans" },
            { name: "Kredi kartı", cat: "Kredi kartı" },
            { name: "Elektrik", cat: "Elektrik" },
            { name: "Su", cat: "Su" },
            { name: "Diğer", cat: "Diğer" }
        ];

        const catData = categories.map(c => {
            const sum = allPayments
                .filter(p => p.category === c.cat && p.dueDate && p.dueDate.startsWith(activeMonth))
                .reduce((s, p) => s + (p.amount || 0), 0);
            return { name: c.name, amount: sum };
        }).filter(c => c.amount > 0);

        const totalMonthBudget = totalPaidMonth + totalPendingMonth;

        // Yaklaşan 7 ve 30 Günlük Projeksiyon
        const next7Days = getUpcomingDates(activeDate, 7);
        const next30Days = getUpcomingDates(activeDate, 30);
        const upcoming7Amount = allPayments.filter(p => next7Days.includes(p.dueDate) && p.status !== "Ödendi").reduce((s, p) => s + (p.amount || 0), 0);
        const upcoming30Amount = allPayments.filter(p => next30Days.includes(p.dueDate) && p.status !== "Ödendi").reduce((s, p) => s + (p.amount || 0), 0);

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h2>Mali İşler & Nakit Çıkış Raporları</h2>
                    <span class="sub-text">${activeMonth} Dönemi İçin Nakit Akışı, Kategori Dağılımı ve 7-30 Günlük Finansal Projeksiyon.</span>
                </div>
                <div class="header-actions">
                    <button class="btn btn-outline" onclick="window.print()">
                        🖨️ Raporu Yazdır / PDF
                    </button>
                    <button class="btn btn-primary" onclick="ExcelService.exportFullReportExcel()">
                        📥 Raporu Excel'e İndir
                    </button>
                </div>
            </div>

            <!-- ANA METRİK KARTLARI -->
            <div class="kpi-strip">
                <div class="kpi-mini-card">
                    <span class="kpi-label">Bu Ay Yapılan (Ödenen)</span>
                    <strong class="kpi-val text-success">${totalPaidMonth.toLocaleString('tr-TR')} ₺</strong>
                    <span class="text-xs text-muted">${thisMonthPaid.length} Kalem Ödeme</span>
                </div>
                <div class="kpi-mini-card">
                    <span class="kpi-label">Bu Ay Yapılacak (Kalan)</span>
                    <strong class="kpi-val text-primary">${totalPendingMonth.toLocaleString('tr-TR')} ₺</strong>
                    <span class="text-xs text-muted">${thisMonthPending.length} Bekleyen Kalem</span>
                </div>
                <div class="kpi-mini-card ${totalOverdue > 0 ? 'highlight-danger' : ''}">
                    <span class="kpi-label">Geciken Ödeme Tutarı</span>
                    <strong class="kpi-val text-danger">${totalOverdue.toLocaleString('tr-TR')} ₺</strong>
                    <span class="text-xs text-danger">${overduePayments.length + overdueInvoices.length} Geciken Kayıt</span>
                </div>
                <div class="kpi-mini-card highlight-card">
                    <span class="kpi-label">Aylık Toplam Ödeme Yükü</span>
                    <strong class="kpi-val text-dark">${totalMonthBudget.toLocaleString('tr-TR')} ₺</strong>
                    <span class="text-xs text-muted">Maaş, Tedarikçi, SGK, Vergi</span>
                </div>
            </div>

            <!-- PROJEKSİYON VE KATEGORİ DAĞILIMI -->
            <div class="two-column-grid mt-4">
                
                <!-- KATEGORİ BAZLI HARCAMA DAĞILIMI -->
                <div class="col-card">
                    <div class="card-header">
                        <h3>📊 Bu Ayın Ödeme Türü Dağılımı</h3>
                        <span class="badge badge-outline">${activeMonth}</span>
                    </div>
                    <div class="card-body">
                        <div class="cat-distribution-list">
                            ${catData.map(c => {
                                const pct = totalMonthBudget > 0 ? Math.round((c.amount / totalMonthBudget) * 100) : 0;
                                return `
                                    <div class="cat-bar-item mb-3">
                                        <div class="flex-between text-sm mb-1">
                                            <strong>${c.name}</strong>
                                            <span><strong>${c.amount.toLocaleString('tr-TR')} ₺</strong> (%${pct})</span>
                                        </div>
                                        <div class="progress-bar">
                                            <div class="progress-fill fill-${c.name.toLowerCase().replace(/\\s+/g, '-')}" style="width: ${pct}%"></div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <!-- 7 GÜNLÜK VE 30 GÜNLÜK NAKİT ÇIKIŞ PROJEKSİYONU -->
                <div class="col-card">
                    <div class="card-header">
                        <h3>⏳ Yaklaşan Nakit İhtiyacı Projeksiyonu</h3>
                        <span class="badge badge-primary">Planlama</span>
                    </div>
                    <div class="card-body">
                        <div class="proj-highlight-box mb-4">
                            <div class="proj-box-inner">
                                <span class="proj-header-sm">Gelecek 7 Gün İçinde Gerekli Nakit:</span>
                                <h3 class="text-primary mt-1">${upcoming7Amount.toLocaleString('tr-TR')} ₺</h3>
                                <p class="text-xs text-muted">Tedarikçi Cuma ödemeleri ve acil faturalar dahil.</p>
                            </div>
                        </div>

                        <div class="proj-highlight-box">
                            <div class="proj-box-inner">
                                <span class="proj-header-sm">Gelecek 30 Gün İçinde Gerekli Nakit:</span>
                                <h3 class="text-dark mt-1">${upcoming30Amount.toLocaleString('tr-TR')} ₺</h3>
                                <p class="text-xs text-muted">Personel net maaşları (10'u), avanslar (25'i), SGK ve Vergi beyannameleri dahil.</p>
                            </div>
                        </div>

                        <div class="bank-advice-box mt-3">
                            <small class="text-muted">
                                💡 <strong>Finans Notu:</strong> Vadesiz hesap bakiyeleri her sabah kontrol edilmeli, Cuma günkü tedarikçi havaleleri öncesinde Perşembe günü bakiye tamamlanmalıdır.
                            </small>
                        </div>
                    </div>
                </div>

            </div>
        `;
    }

    function getUpcomingDates(baseIsoStr, count) {
        const parts = baseIsoStr.split('-');
        const dates = [];
        for (let i = 1; i <= count; i++) {
            const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            d.setDate(d.getDate() + i);
            dates.push(d.toISOString().slice(0, 10));
        }
        return dates;
    }

    return {
        render
    };
})();
