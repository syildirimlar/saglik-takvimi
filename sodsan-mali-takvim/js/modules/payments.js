/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Ödeme Yönetimi Modülü - Tedarikçi, Personel, Vergi, SGK ve Otomatik Faturalar
 */

const PaymentsModule = (function() {

    let filterCategory = "ALL";
    let filterStatus = "ALL";
    let searchQuery = "";

    function render(targetContainerId = "paymentsView") {
        const container = document.getElementById(targetContainerId);
        if (!container) return;

        const activeDate = SODSAN_DB.getActiveDate();
        let payments = SODSAN_DB.getPayments();

        // Filtreleme
        if (filterCategory !== "ALL") {
            payments = payments.filter(p => p.category === filterCategory);
        }

        if (filterStatus !== "ALL") {
            if (filterStatus === "Gecikti") {
                payments = payments.filter(p => p.dueDate < activeDate && p.status !== "Ödendi");
            } else {
                payments = payments.filter(p => p.status === filterStatus);
            }
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            payments = payments.filter(p => (
                (p.entity && p.entity.toLowerCase().includes(q)) ||
                (p.description && p.description.toLowerCase().includes(q)) ||
                (p.bank && p.bank.toLowerCase().includes(q)) ||
                (p.receiptNo && p.receiptNo.toLowerCase().includes(q)) ||
                (p.note && p.note.toLowerCase().includes(q))
            ));
        }

        // Hesaplamalar
        const totalPending = payments.filter(p => p.status !== "Ödendi").reduce((s, p) => s + (p.amount || 0), 0);
        const totalPaid = payments.filter(p => p.status === "Ödendi").reduce((s, p) => s + (p.amount || 0), 0);

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h2>Ödeme Takibi & Nakit Yönetimi</h2>
                    <span class="sub-text">Tedarikçi ödemeleri, personel maaş/avansları, vergiler ve otomatik talimatlı faturalar.</span>
                </div>
                <div class="header-actions">
                    <button class="btn btn-warning" onclick="App.openThursdayListModal()">
                        📋 Perşembe Tedarikçi Ödeme Listesi
                    </button>
                    <button class="btn btn-success" onclick="App.openPaymentEditModal()">
                        + Yeni Ödeme Planla
                    </button>
                </div>
            </div>

            <!-- KPI ŞERİDİ -->
            <div class="kpi-strip">
                <div class="kpi-mini-card">
                    <span class="kpi-label">Toplam Ödeme Sayısı</span>
                    <strong class="kpi-val">${payments.length} Adet</strong>
                </div>
                <div class="kpi-mini-card">
                    <span class="kpi-label">Ödenen Toplam</span>
                    <strong class="kpi-val text-success">${totalPaid.toLocaleString('tr-TR')} ₺</strong>
                </div>
                <div class="kpi-mini-card highlight-card">
                    <span class="kpi-label">Bekleyen / Planlı Ödemeler</span>
                    <strong class="kpi-val text-danger">${totalPending.toLocaleString('tr-TR')} ₺</strong>
                </div>
                <div class="kpi-mini-card">
                    <span class="kpi-label">Banka Havuzları</span>
                    <strong class="kpi-val text-muted">Garanti, İş, Ziraat</strong>
                </div>
            </div>

            <!-- OTOMATİK TALİMAT BİLGİLENDİRME KUTUSU (Section 7) -->
            <div class="info-alert-card mb-3">
                <div class="info-icon">⚡</div>
                <div class="info-text">
                    <strong>Otomatik Fatura Kontrol Kuralı:</strong>
                    <span>SODSAN elektrik, su, doğalgaz ve internet faturaları otomatik ödeme talimatındadır. Faturanın son ödeme günü geldiğinde hesap bakiyesini kontrol ediniz; ödeme gerçekleşmemişse manuel ödemeyi işaretleyiniz.</span>
                </div>
            </div>

            <!-- FİLTRE VE ARAMA -->
            <div class="filter-bar">
                <div class="filter-item">
                    <label>Ödeme Türü:</label>
                    <select onchange="PaymentsModule.setCategory(this.value)">
                        <option value="ALL">Tüm Türler</option>
                        <option value="Tedarikçi" ${filterCategory === 'Tedarikçi' ? 'selected' : ''}>Tedarikçi</option>
                        <option value="Kredi kartı" ${filterCategory === 'Kredi kartı' ? 'selected' : ''}>Kredi Kartı</option>
                        <option value="Vergi" ${filterCategory === 'Vergi' ? 'selected' : ''}>Vergi</option>
                        <option value="SGK" ${filterCategory === 'SGK' ? 'selected' : ''}>SGK</option>
                        <option value="Maaş" ${filterCategory === 'Maaş' ? 'selected' : ''}>Maaş</option>
                        <option value="Avans" ${filterCategory === 'Avans' ? 'selected' : ''}>Avans</option>
                        <option value="Elektrik" ${filterCategory === 'Elektrik' ? 'selected' : ''}>Elektrik</option>
                        <option value="Su" ${filterCategory === 'Su' ? 'selected' : ''}>Su</option>
                        <option value="Doğalgaz" ${filterCategory === 'Doğalgaz' ? 'selected' : ''}>Doğalgaz</option>
                        <option value="İnternet" ${filterCategory === 'İnternet' ? 'selected' : ''}>İnternet</option>
                        <option value="Telefon" ${filterCategory === 'Telefon' ? 'selected' : ''}>Telefon</option>
                        <option value="Diğer" ${filterCategory === 'Diğer' ? 'selected' : ''}>Diğer</option>
                    </select>
                </div>
                <div class="filter-item">
                    <label>Durum:</label>
                    <select onchange="PaymentsModule.setStatus(this.value)">
                        <option value="ALL">Tüm Durumlar</option>
                        <option value="Bekliyor" ${filterStatus === 'Bekliyor' ? 'selected' : ''}>Bekliyor</option>
                        <option value="Onay Bekliyor" ${filterStatus === 'Onay Bekliyor' ? 'selected' : ''}>Onay Bekliyor</option>
                        <option value="Ödendi" ${filterStatus === 'Ödendi' ? 'selected' : ''}>Ödendi</option>
                        <option value="Gecikti" ${filterStatus === 'Gecikti' ? 'selected' : ''}>Gecikti</option>
                    </select>
                </div>
                <div class="filter-item search-item">
                    <label>Firma / Kurum Ara:</label>
                    <input type="text" placeholder="Firma, banka, açıklama..." value="${searchQuery}" oninput="PaymentsModule.search(this.value)">
                </div>
            </div>

            <!-- ÖDEME TABLOSU -->
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th width="100">Plan Tarihi</th>
                            <th>Firma / Kurum</th>
                            <th width="120">Tür</th>
                            <th>Açıklama</th>
                            <th width="120" class="text-right">Tutar</th>
                            <th width="140">Banka / Hesap</th>
                            <th width="130">Yöntem</th>
                            <th width="100">Son Ödeme</th>
                            <th width="110">Durum</th>
                            <th width="140">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payments.length === 0 ? `
                            <tr>
                                <td colspan="10" class="text-center py-4 text-muted">
                                    Seçilen filtrelere uygun ödeme kaydı bulunamadı.
                                </td>
                            </tr>
                        ` : payments.map(p => {
                            const isOverdue = (p.dueDate < activeDate && p.status !== "Ödendi");
                            const statusClass = {
                                "Bekliyor": "badge-secondary",
                                "Onay Bekliyor": "badge-warning",
                                "Ödendi": "badge-success",
                                "Gecikti": "badge-danger",
                                "İptal": "badge-gray"
                            }[p.status] || "badge-secondary";

                            return `
                                <tr class="${p.status === 'Ödendi' ? 'row-done' : (isOverdue ? 'row-overdue' : '')}">
                                    <td><strong>${p.date}</strong></td>
                                    <td>
                                        <strong>${p.entity}</strong>
                                        ${p.receiptNo ? `<div class="text-xs text-muted">Dekont: ${p.receiptNo}</div>` : ''}
                                    </td>
                                    <td><span class="category-badge cat-${p.category.toLowerCase().replace(/\\s+/g, '-')}">${p.category}</span></td>
                                    <td>
                                        <span class="text-sm">${p.description || '-'}</span>
                                        ${p.note ? `<div class="text-xs text-muted">📌 ${p.note}</div>` : ''}
                                    </td>
                                    <td class="text-right font-bold text-danger">${(p.amount || 0).toLocaleString('tr-TR')} ₺</td>
                                    <td>
                                        <div class="bank-pill">
                                            <strong>${p.bank || 'Banka Yok'}</strong>
                                            <span class="text-xs text-muted">${p.account || '-'}</span>
                                        </div>
                                    </td>
                                    <td><span class="text-xs font-semibold">${p.method || 'Havale/EFT'}</span></td>
                                    <td>
                                        <strong class="${isOverdue ? 'text-danger' : ''}">${p.dueDate}</strong>
                                        ${isOverdue ? '<span class="badge badge-danger badge-xs block mt-1">Gecikti</span>' : ''}
                                    </td>
                                    <td>
                                        <span class="badge ${isOverdue ? 'badge-danger' : statusClass}">${isOverdue ? 'Gecikti' : p.status}</span>
                                    </td>
                                    <td>
                                        <div class="action-btn-group">
                                            ${p.status !== 'Ödendi' ? `
                                                <button class="btn btn-xs btn-success" onclick="App.markPaymentPaid('${p.id}')" title="Ödendi İşaretle">
                                                    Öde
                                                </button>
                                            ` : `
                                                <button class="btn btn-xs btn-outline" onclick="App.revertPaymentStatus('${p.id}')" title="Geri Al">
                                                    Geri Al
                                                </button>
                                            `}
                                            <button class="btn btn-xs btn-outline" onclick="App.openPaymentEditModal('${p.id}')" title="Düzenle">✏️</button>
                                            <button class="btn btn-xs btn-outline text-danger" onclick="App.archivePayment('${p.id}')" title="Arşive Taşı">🗑️</button>
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

    function setCategory(cat) {
        filterCategory = cat;
        render();
    }

    function setStatus(st) {
        filterStatus = st;
        render();
    }

    function search(q) {
        searchQuery = q;
        render();
    }

    return {
        render,
        setCategory,
        setStatus,
        search
    };
})();
