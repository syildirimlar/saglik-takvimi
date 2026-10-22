/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Vergi ve SGK Takvimi Modülü - 2026 Yılı Resmi GİB & SGK Mevzuat Yükümlülükleri
 */

const TaxesModule = (function() {

    let filterType = "ALL";
    let filterStatus = "ALL";

    function render(targetContainerId = "taxesView") {
        const container = document.getElementById(targetContainerId);
        if (!container) return;

        const activeDate = SODSAN_DB.getActiveDate();
        let taxes = SODSAN_DB.getTaxes();

        if (filterType !== "ALL") {
            taxes = taxes.filter(t => t.type.includes(filterType));
        }

        if (filterStatus !== "ALL") {
            taxes = taxes.filter(t => t.status === filterStatus);
        }

        // Toplam tahmini vergi yükü
        const totalEstAmount = taxes.reduce((s, t) => s + (t.estAmount || 0), 0);
        const totalPaidAmount = taxes.filter(t => t.paid).reduce((s, t) => s + (t.estAmount || 0), 0);
        const totalPendingAmount = taxes.filter(t => !t.paid).reduce((s, t) => s + (t.estAmount || 0), 0);

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h2>2026 Vergi & SGK Yasal Takvimi</h2>
                    <span class="sub-text">GİB (Gelir İdaresi Başkanlığı) ve SGK resmi mevzuatına göre hazırlanmış 2026 beyanname ve ödeme takvimi.</span>
                </div>
                <div class="header-actions">
                    <button class="btn btn-outline" onclick="ExcelService.exportTaxesExcel()">
                        📥 Vergi Takvimini Excel'e İndir
                    </button>
                    <button class="btn btn-primary" onclick="App.openTaxEditModal()">
                        + Vergi / Yükümlülük Ekle
                    </button>
                </div>
            </div>

            <!-- KPI ŞERİDİ -->
            <div class="kpi-strip">
                <div class="kpi-mini-card">
                    <span class="kpi-label">Yıllık Beyanname Sayısı</span>
                    <strong class="kpi-val">${taxes.length} Adet</strong>
                </div>
                <div class="kpi-mini-card">
                    <span class="kpi-label">Ödenen Vergi/SGK Toplamı</span>
                    <strong class="kpi-val text-success">${totalPaidAmount.toLocaleString('tr-TR')} ₺</strong>
                </div>
                <div class="kpi-mini-card highlight-card">
                    <span class="kpi-label">Kalan / Yaklaşan Yükümlülük</span>
                    <strong class="kpi-val text-primary">${totalPendingAmount.toLocaleString('tr-TR')} ₺</strong>
                </div>
                <div class="kpi-mini-card">
                    <span class="kpi-label">Mevzuat Güvencesi</span>
                    <strong class="kpi-val text-muted">2026 GİB / SGK</strong>
                </div>
            </div>

            <!-- FİLTRELER -->
            <div class="filter-bar">
                <div class="filter-item">
                    <label>Vergi Türü:</label>
                    <select onchange="TaxesModule.setType(this.value)">
                        <option value="ALL">Tüm Vergi ve Yükümlülükler</option>
                        <option value="KDV">KDV-1 & KDV-2</option>
                        <option value="Muhtasar">Muhtasar ve Prim Hizmet (MPHB)</option>
                        <option value="Geçici">Geçici Vergi (Kurumlar)</option>
                        <option value="Kurumlar">Kurumlar Vergisi Yıllık</option>
                        <option value="SGK">SGK Primleri</option>
                        <option value="Damga">Damga Vergisi</option>
                        <option value="Tasdik">Defter Tasdikleri</option>
                    </select>
                </div>
                <div class="filter-item">
                    <label>Durum:</label>
                    <select onchange="TaxesModule.setStatus(this.value)">
                        <option value="ALL">Tüm Durumlar</option>
                        <option value="Bekliyor">Bekleyenler</option>
                        <option value="Tamamlandı">Tamamlananlar</option>
                    </select>
                </div>
            </div>

            <!-- VERGİ TABLOSU -->
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th width="110">Dönem</th>
                            <th>Yükümlülük Türü</th>
                            <th width="120">Beyanname</th>
                            <th width="120">Son Ödeme</th>
                            <th width="120" class="text-right">Tahmini Tutar</th>
                            <th width="130" class="text-center">Beyanname Verildi?</th>
                            <th width="120" class="text-center">Ödeme Yapıldı?</th>
                            <th width="130" class="text-center">Mali Müşavir</th>
                            <th width="100">Durum</th>
                            <th width="90">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${taxes.map(t => {
                            const isOverdue = (t.dueDate < activeDate && !t.paid);
                            const isUpcomingSoon = (t.dueDate >= activeDate && getDayDiff(activeDate, t.dueDate) <= 7 && !t.paid);

                            return `
                                <tr class="${t.paid ? 'row-done' : (isOverdue ? 'row-overdue' : (isUpcomingSoon ? 'row-highlight' : ''))}">
                                    <td><strong>${t.period}</strong></td>
                                    <td>
                                        <div class="tax-type-cell">
                                            <strong>${t.type}</strong>
                                            ${t.note ? `<p class="text-xs text-muted">📌 ${t.note}</p>` : ''}
                                        </div>
                                    </td>
                                    <td><span class="code-pill">${t.declDate}</span></td>
                                    <td>
                                        <strong class="${isOverdue ? 'text-danger' : (isUpcomingSoon ? 'text-warning' : '')}">${t.dueDate}</strong>
                                        ${isUpcomingSoon ? '<span class="badge badge-warning badge-xs block mt-1">Yaklaştı</span>' : ''}
                                    </td>
                                    <td class="text-right font-bold">${t.estAmount.toLocaleString('tr-TR')} ₺</td>
                                    <td class="text-center">
                                        <input type="checkbox" ${t.declSubmitted ? 'checked' : ''} onchange="App.toggleTaxDeclaration('${t.id}')">
                                        <span class="text-xs ${t.declSubmitted ? 'text-success' : 'text-muted'}">${t.declSubmitted ? 'Verildi' : 'Bekliyor'}</span>
                                    </td>
                                    <td class="text-center">
                                        <input type="checkbox" ${t.paid ? 'checked' : ''} onchange="App.toggleTaxPayment('${t.id}')">
                                        <span class="text-xs ${t.paid ? 'text-success' : 'text-muted'}">${t.paid ? 'Ödendi' : 'Bekliyor'}</span>
                                    </td>
                                    <td class="text-center">
                                        <input type="checkbox" ${t.advisorChecked ? 'checked' : ''} onchange="App.toggleTaxAdvisor('${t.id}')">
                                        <span class="text-xs ${t.advisorChecked ? 'text-success' : 'text-muted'}">${t.advisorChecked ? 'Onaylı' : 'Bekliyor'}</span>
                                    </td>
                                    <td>
                                        <span class="badge ${t.paid && t.declSubmitted ? 'badge-success' : (isOverdue ? 'badge-danger' : 'badge-secondary')}">
                                            ${t.paid && t.declSubmitted ? 'Tamamlandı' : (isOverdue ? 'Gecikti' : 'Bekliyor')}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="btn btn-xs btn-outline" onclick="App.openTaxEditModal('${t.id}')" title="Düzenle">✏️</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    function getDayDiff(d1Str, d2Str) {
        const d1 = new Date(d1Str);
        const d2 = new Date(d2Str);
        return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
    }

    function setType(type) {
        filterType = type;
        render();
    }

    function setStatus(status) {
        filterStatus = status;
        render();
    }

    return {
        render,
        setType,
        setStatus
    };
})();
