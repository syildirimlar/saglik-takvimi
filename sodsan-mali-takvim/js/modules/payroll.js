/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Personel ve Bordro Süreci Modülü - 60 Personel, Maaş (10'u), Avans (25'i) ve 8 Adımlı Bordro Takibi
 */

const PayrollModule = (function() {

    function render(targetContainerId = "payrollView") {
        const container = document.getElementById(targetContainerId);
        if (!container) return;

        const data = SODSAN_DB.getPayrollData();
        const steps = data.steps || [];
        const completedStepsCount = steps.filter(s => s.done).length;

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h2>Personel ve Bordro Yönetim Süreci</h2>
                    <span class="sub-text">Maaş (Ayın 10'u), Avans (Ayın 25'i) ve 8 aşamalı yasal bordro-puantaj akışı.</span>
                </div>
                <div class="header-actions">
                    <button class="btn btn-primary" onclick="App.openPayrollSettingsModal()">
                        ⚙️ Personel & Bütçe Ayarları
                    </button>
                </div>
            </div>

            <!-- PERSONEL & BORDRO BİLGİ KARTLARI -->
            <div class="kpi-strip">
                <div class="kpi-mini-card">
                    <span class="kpi-label">Toplam Personel Sayısı</span>
                    <strong class="kpi-val text-primary">${data.employeeCount || 60} Kişi</strong>
                </div>
                <div class="kpi-mini-card">
                    <span class="kpi-label">Aylık Net Maaş Bütçesi</span>
                    <strong class="kpi-val text-dark">${(data.estimatedTotalNetSalary ? data.estimatedTotalNetSalary.toLocaleString('tr-TR') + ' ₺' : 'Girilmedi')}</strong>
                </div>
                <div class="kpi-mini-card">
                    <span class="kpi-label">Aylık Avans Bütçesi (25'i)</span>
                    <strong class="kpi-val text-info">${(data.estimatedTotalAdvance ? data.estimatedTotalAdvance.toLocaleString('tr-TR') + ' ₺' : 'Girilmedi')}</strong>
                </div>
                <div class="kpi-mini-card highlight-card">
                    <span class="kpi-label">Aylık SGK Prim Tahakkuku</span>
                    <strong class="kpi-val text-danger">${(data.estimatedTotalSGK ? data.estimatedTotalSGK.toLocaleString('tr-TR') + ' ₺' : 'Girilmedi')}</strong>
                </div>
            </div>

            <!-- BORDRO İÇ SÜREÇ İLERLEME ÇUBUĞU (8 ADIM) -->
            <div class="payroll-process-card mt-3">
                <div class="card-header">
                    <div>
                        <h3>8 Aşamalı Aylık Bordro Süreç Takibi (${data.currentPeriod || 'Ekim 2026'})</h3>
                        <span class="card-subtitle">Puantajdan SGK prim ödemesine kadar tüm kurumsal adımların kontrolü</span>
                    </div>
                    <span class="badge badge-primary">${completedStepsCount} / 8 Tamamlandı</span>
                </div>
                <div class="card-body">
                    <div class="stepper-horizontal">
                        ${steps.map((s, idx) => `
                            <div class="step-node ${s.done ? 'step-done' : ''}">
                                <div class="node-circle" onclick="App.togglePayrollStep(${s.id})">
                                    ${s.done ? '✓' : s.id}
                                </div>
                                <div class="node-content">
                                    <span class="node-title">${s.step}</span>
                                    <span class="node-day">Ayın ${s.targetDay}'i</span>
                                    ${s.doneDate ? `<span class="text-xs text-success">${s.doneDate}</span>` : '<span class="text-xs text-muted">Bekliyor</span>'}
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <!-- ADIM DETAYLARI LİSTESİ -->
                    <div class="step-details-table mt-4">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th width="50">No</th>
                                    <th>Aşama</th>
                                    <th width="120">Hedef Gün</th>
                                    <th width="120">Durum</th>
                                    <th>Açıklama / Not</th>
                                    <th width="120">İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${steps.map(s => `
                                    <tr class="${s.done ? 'row-done' : ''}">
                                        <td><strong>#${s.id}</strong></td>
                                        <td><strong>${s.step}</strong></td>
                                        <td>Ayın ${s.targetDay}'i</td>
                                        <td>
                                            <span class="badge ${s.done ? 'badge-success' : 'badge-secondary'}">
                                                ${s.done ? '✓ Tamamlandı' : '⏳ Bekliyor'}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="text-sm">${s.note || '-'}</span>
                                        </td>
                                        <td>
                                            <button class="btn btn-xs ${s.done ? 'btn-outline' : 'btn-success'}" onclick="App.togglePayrollStep(${s.id})">
                                                ${s.done ? 'Geri Al' : 'Tamamlandı Yap'}
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- SABİT PERSONEL ÖDEME RUTİNLERİ KUTULARI -->
            <div class="two-column-grid mt-4">
                <div class="routine-card">
                    <div class="routine-card-header">
                        <span class="routine-icon">💰</span>
                        <h4>Her Ayın 10'u: Maaş Ödemesi</h4>
                    </div>
                    <p class="text-sm text-muted">
                        ${data.employeeCount || 60} fabrika ve ofis personelinin banka toplu ödeme talimatı hazırlanır. Garanti BBVA havuz hesabından saat 11:00'e kadar ödemeler hesaplara aktarılır.
                    </p>
                    <div class="badge-row mt-2">
                        <span class="badge badge-success">Sabit Gün: 10</span>
                        <span class="badge badge-outline">Banka: Garanti BBVA</span>
                    </div>
                </div>

                <div class="routine-card">
                    <div class="routine-card-header">
                        <span class="routine-icon">💳</span>
                        <h4>Her Ayın 25'i: Maaş Avansı</h4>
                    </div>
                    <p class="text-sm text-muted">
                        Personelin avans talepleri toplanır, onaylanan tutarlar toplu liste halinde bankaya sunulur ve hesaplara yatırılır.
                    </p>
                    <div class="badge-row mt-2">
                        <span class="badge badge-primary">Sabit Gün: 25</span>
                        <span class="badge badge-outline">Mahsup: Ayın 10'undaki Maaş</span>
                    </div>
                </div>
            </div>
        `;
    }

    return {
        render
    };
})();
