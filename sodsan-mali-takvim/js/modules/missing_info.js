/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Eksik Bilgiler Modülü - Excel'deki Bilinmeyen Parametreler ve Otomatik Takvime İşleme
 */

const MissingInfoModule = (function() {

    function render(targetContainerId = "missingInfoView") {
        const container = document.getElementById(targetContainerId);
        if (!container) return;

        const items = SODSAN_DB.getMissingInfoItems();

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h2>Eksik Bilgiler & Parametre Tamamlama Modülü</h2>
                    <span class="sub-text">Excel'deki "Eksik Bilgiler" sekmesinin dinamik karşılığıdır. Şirket verileri netleştikçe buradan güncellenir ve takvime otomatik yansıtılır.</span>
                </div>
                <div class="header-actions">
                    <button class="btn btn-primary" onclick="App.openNewMissingInfoModal()">
                        + Yeni Bilgi / Yükümlülük Ekle
                    </button>
                </div>
            </div>

            <!-- BİLGİLENDİRME BANNERI -->
            <div class="info-alert-card mb-4">
                <div class="info-icon">💡</div>
                <div class="info-text">
                    <strong>Otomatik Takvim Entegrasyonu:</strong>
                    <span>Buraya yeni bir elektrik faturası günü, kredi taksit tarihi veya vergi girildiğinde sistem otomatik olarak 2026 yılı takvimine ilgili görevleri ve kontrolleri oluşturur.</span>
                </div>
            </div>

            <!-- TABLO -->
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th width="50">No</th>
                            <th width="220">Konu / Yükümlülük</th>
                            <th width="140">Kategori</th>
                            <th width="160">Mevcut Durum</th>
                            <th>Açıklama & Detay</th>
                            <th width="180">Tanımlanan Değer</th>
                            <th width="120">İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, idx) => {
                            const isDefined = item.isFixed || (item.enteredValue && item.enteredValue.trim().length > 0 && !item.enteredValue.includes("Bekleniyor"));
                            const statusBadge = isDefined ? 'badge-success' : 'badge-warning';

                            return `
                                <tr>
                                    <td><strong>#${idx + 1}</strong></td>
                                    <td>
                                        <strong>${item.subject}</strong>
                                    </td>
                                    <td>
                                        <span class="category-badge cat-${item.category.toLowerCase().replace(/\\s+/g, '-')}">
                                            ${item.category}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="badge ${statusBadge}">${item.status}</span>
                                    </td>
                                    <td>
                                        <div class="text-sm">${item.currentNote}</div>
                                        <div class="text-xs text-muted mt-1">📌 Aksiyon: ${item.actionPlan}</div>
                                    </td>
                                    <td>
                                        ${item.enteredValue ? `
                                            <span class="code-pill">${item.enteredValue}</span>
                                        ` : `
                                            <span class="text-danger text-xs font-bold">⚠️ Henüz Girilmedi</span>
                                        `}
                                    </td>
                                    <td>
                                        <button class="btn btn-xs btn-outline" onclick="App.openEditMissingInfoModal('${item.id}')">
                                            ${item.enteredValue ? '✏️ Güncelle' : '➕ Değer Gir'}
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <!-- SABİT KURAL ÖZETLERİ -->
            <div class="two-column-grid mt-4">
                <div class="routine-card">
                    <div class="routine-card-header">
                        <span class="routine-icon">🏢</span>
                        <h4>Kira Ödemesi: YOKTUR</h4>
                    </div>
                    <p class="text-sm text-muted">
                        SODSAN fabrika ve yönetim binası şirketin kendi mülkü olduğundan herhangi bir kira tahakkuku veya stopajı bulunmamaktadır.
                    </p>
                    <span class="badge badge-success mt-2">✓ Sabit Kural Olarak İşlendi</span>
                </div>

                <div class="routine-card">
                    <div class="routine-card-header">
                        <span class="routine-icon">📜</span>
                        <h4>Çek / Senet: KULLANILMIYOR</h4>
                    </div>
                    <p class="text-sm text-muted">
                        Şirket finansal prensipleri gereği çek veya senet düzenlenmemektedir. Tüm tedarikçi borçları her Cuma günü banka üzerinden havale/EFT ile nakit kapatılmaktadır.
                    </p>
                    <span class="badge badge-success mt-2">✓ Sabit Kural Olarak İşlendi</span>
                </div>
            </div>
        `;
    }

    return {
        render
    };
})();
