/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Fatura Takip Modülü - Alış/Gider Faturaları, KDV, Vade ve Ödeme Entegrasyonu
 */

const InvoicesModule = (function() {

    let filterStatus = "ALL";
    let searchQuery = "";

    function render(targetContainerId = "invoicesView") {
        const container = document.getElementById(targetContainerId);
        if (!container) return;

        const activeDate = SODSAN_DB.getActiveDate();
        let invoices = SODSAN_DB.getInvoices();

        // Filtreleme
        if (filterStatus !== "ALL") {
            if (filterStatus === "Gecikti") {
                invoices = invoices.filter(i => i.dueDate < activeDate && i.status !== "Ödendi");
            } else {
                invoices = invoices.filter(i => i.status === filterStatus);
            }
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            invoices = invoices.filter(i => (
                (i.company && i.company.toLowerCase().includes(q)) ||
                (i.invoiceNo && i.invoiceNo.toLowerCase().includes(q)) ||
                (i.taxNo && i.taxNo.includes(q)) ||
                (i.description && i.description.toLowerCase().includes(q)) ||
                (i.note && i.note.toLowerCase().includes(q))
            ));
        }

        // Toplamlar
        const totalBase = invoices.reduce((sum, i) => sum + (i.amount || 0), 0);
        const totalVat = invoices.reduce((sum, i) => sum + (i.vatAmount || 0), 0);
        const grandTotal = invoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h2>Fatura Takibi & Borç Yönetimi</h2>
                    <span class="sub-text">Tedarikçi, genel gider ve hammadde faturalarının vadeleri, KDV dağılımı ve ödeme durumları.</span>
                </div>
                <div class="header-actions">
                    <button class="btn btn-outline" onclick="ExcelService.exportInvoicesExcel()">
                        📥 Faturaları Excel'e İndir
                    </button>
                    <button class="btn btn-success" onclick="App.openInvoiceEditModal()">
                        + Yeni Fatura Kaydet
                    </button>
                </div>
            </div>

            <!-- FATURA METRİK KARTLARI -->
            <div class="kpi-strip">
                <div class="kpi-mini-card">
                    <span class="kpi-label">Toplam Fatura Sayısı</span>
                    <strong class="kpi-val">${invoices.length} Adet</strong>
                </div>
                <div class="kpi-mini-card">
                    <span class="kpi-label">Toplam Matrah (KDV Hariç)</span>
                    <strong class="kpi-val">${totalBase.toLocaleString('tr-TR')} ₺</strong>
                </div>
                <div class="kpi-mini-card">
                    <span class="kpi-label">Toplam KDV Tutarı</span>
                    <strong class="kpi-val text-info">${totalVat.toLocaleString('tr-TR')} ₺</strong>
                </div>
                <div class="kpi-mini-card highlight-card">
                    <span class="kpi-label">Genel Toplam (Ödenecek)</span>
                    <strong class="kpi-val text-primary">${grandTotal.toLocaleString('tr-TR')} ₺</strong>
                </div>
            </div>

            <!-- FİLTRE VE ARAMA -->
            <div class="filter-bar">
                <div class="filter-item">
                    <label>Durum Filtresi:</label>
                    <select onchange="InvoicesModule.setFilter(this.value)">
                        <option value="ALL" ${filterStatus === 'ALL' ? 'selected' : ''}>Tüm Faturalar</option>
                        <option value="Bekliyor" ${filterStatus === 'Bekliyor' ? 'selected' : ''}>Bekliyor</option>
                        <option value="Kaydedildi" ${filterStatus === 'Kaydedildi' ? 'selected' : ''}>Kaydedildi</option>
                        <option value="Ödeme bekliyor" ${filterStatus === 'Ödeme bekliyor' ? 'selected' : ''}>Ödeme Bekliyor</option>
                        <option value="Ödendi" ${filterStatus === 'Ödendi' ? 'selected' : ''}>Ödendi</option>
                        <option value="Gecikti" ${filterStatus === 'Gecikti' ? 'selected' : ''}>Geciken Faturalar</option>
                    </select>
                </div>
                <div class="filter-item search-item">
                    <label>Firma / Fatura Ara:</label>
                    <input type="text" placeholder="Firma adı, VKN, Fatura No..." value="${searchQuery}" oninput="InvoicesModule.search(this.value)">
                </div>
            </div>

            <!-- FATURA TABLOSU -->
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th width="90">Fatura Tarihi</th>
                            <th>Firma & Vergi No</th>
                            <th width="140">Fatura No</th>
                            <th>Açıklama</th>
                            <th width="100" class="text-right">Matrah (₺)</th>
                            <th width="80" class="text-right">KDV</th>
                            <th width="120" class="text-right">Genel Toplam</th>
                            <th width="100">Vade Tarihi</th>
                            <th width="110">Muhasebe</th>
                            <th width="110">Durum</th>
                            <th width="130">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoices.length === 0 ? `
                            <tr>
                                <td colspan="11" class="text-center py-4 text-muted">
                                    Arama veya filtre kriterine uygun fatura bulunamadı.
                                </td>
                            </tr>
                        ` : invoices.map(i => {
                            const isOverdue = (i.dueDate < activeDate && i.status !== "Ödendi");
                            const statusClass = {
                                "Bekliyor": "badge-secondary",
                                "Kaydedildi": "badge-info",
                                "Ödeme bekliyor": "badge-warning",
                                "Ödendi": "badge-success",
                                "Gecikti": "badge-danger"
                            }[i.status] || "badge-secondary";

                            return `
                                <tr class="${i.status === 'Ödendi' ? 'row-done' : (isOverdue ? 'row-overdue' : '')}">
                                    <td><strong>${i.date}</strong></td>
                                    <td>
                                        <div class="company-cell">
                                            <strong>${i.company}</strong>
                                            <span class="text-muted text-xs">VKN: ${i.taxNo || '-'}</span>
                                        </div>
                                    </td>
                                    <td><code class="code-pill">${i.invoiceNo}</code></td>
                                    <td>
                                        <span class="text-sm">${i.description || '-'}</span>
                                        ${i.note ? `<div class="text-xs text-muted">📌 ${i.note}</div>` : ''}
                                    </td>
                                    <td class="text-right">${(i.amount || 0).toLocaleString('tr-TR')} ₺</td>
                                    <td class="text-right">
                                        <span class="text-xs text-muted">%${i.vatRate || 20}</span><br>
                                        <strong>${(i.vatAmount || 0).toLocaleString('tr-TR')} ₺</strong>
                                    </td>
                                    <td class="text-right font-bold text-primary">
                                        ${(i.totalAmount || 0).toLocaleString('tr-TR')} ₺
                                    </td>
                                    <td>
                                        <strong class="${isOverdue ? 'text-danger' : ''}">${i.dueDate}</strong>
                                        ${isOverdue ? '<span class="badge badge-danger badge-xs block mt-1">Gecikti</span>' : ''}
                                    </td>
                                    <td>
                                        ${i.accountingRecorded ? '<span class="badge badge-success">✓ Kayıtlı</span>' : '<span class="badge badge-warning">⏳ Kayıt Bekliyor</span>'}
                                    </td>
                                    <td>
                                        <span class="badge ${isOverdue ? 'badge-danger' : statusClass}">${isOverdue ? 'Gecikti' : i.status}</span>
                                    </td>
                                    <td>
                                        <div class="action-btn-group">
                                            ${i.status !== 'Ödendi' ? `
                                                <button class="btn btn-xs btn-success" onclick="App.openPayInvoiceModal('${i.id}')" title="Ödeme Yap">
                                                    Öde
                                                </button>
                                            ` : `
                                                <span class="text-xs text-success">✓ Ödendi</span>
                                            `}
                                            <button class="btn btn-xs btn-outline" onclick="App.openInvoiceEditModal('${i.id}')" title="Düzenle">✏️</button>
                                            <button class="btn btn-xs btn-outline text-danger" onclick="App.archiveInvoice('${i.id}')" title="Arşive Taşı">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    function setFilter(status) {
        filterStatus = status;
        render();
    }

    function search(query) {
        searchQuery = query;
        render();
    }

    return {
        render,
        setFilter,
        search
    };
})();
