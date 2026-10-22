/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Mali Müşavir Modülü - 8'i ve 21'i Ziyaretleri, Hazırlık Listesi ve Toplantı Tutanakları
 */

const AdvisorModule = (function() {

    function render(targetContainerId = "advisorView") {
        const container = document.getElementById(targetContainerId);
        if (!container) return;

        const activeDate = SODSAN_DB.getActiveDate();
        const visits = SODSAN_DB.getAdvisorVisits();

        // 21 Ekim için bugünkü ziyaret
        const todayVisit = visits.find(v => v.date === activeDate);
        const nextVisits = visits.filter(v => v.date > activeDate).sort((a, b) => a.date.localeCompare(b.date));
        const pastVisits = visits.filter(v => v.date < activeDate).sort((a, b) => b.date.localeCompare(a.date));

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h2>Mali Müşavir Koordinasyon & Denetim Modülü</h2>
                    <span class="sub-text">Mali müşavir ayda iki kez (Her ayın 8'i ve 21'i) fabrikaya gelmektedir. Ziyaret hazırlığı, kontrol adımları ve tutanak takibi.</span>
                </div>
                <div class="header-actions">
                    <button class="btn btn-teal" onclick="App.openNewAdvisorVisitModal()">
                        + Yeni Ziyaret Kaydı Aç
                    </button>
                </div>
            </div>

            <!-- BUGÜNKÜ ZİYARET (Varsa) -->
            ${todayVisit ? `
                <div class="advisor-hero-card">
                    <div class="hero-header">
                        <div class="hero-badge">⚡ BUGÜN ZİYARET GÜNÜ (21 EKİM)</div>
                        <h3>${todayVisit.title}</h3>
                        <p class="hero-purpose">🎯 <strong>Ziyaret Amacı:</strong> ${todayVisit.purpose}</p>
                    </div>

                    <div class="hero-body-grid">
                        <!-- ZİYARET ÖNCESİ HAZIRLIK LİSTESİ -->
                        <div class="prep-checklist-box">
                            <h4>📋 Ziyaret Öncesi Hazırlanacak Evrak & Kayıtlar</h4>
                            <span class="text-xs text-muted">Mali müşavir gelmeden önce muhasebe personelinin hazırlaması gereken maddeler:</span>
                            <div class="checklist-items mt-2">
                                ${(todayVisit.preparationChecklist || []).map((c, idx) => `
                                    <label class="check-item ${c.checked ? 'item-checked' : ''}">
                                        <input type="checkbox" ${c.checked ? 'checked' : ''} onchange="App.toggleAdvisorChecklistItem('${todayVisit.id}', ${idx})">
                                        <span>${c.item}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <!-- TOPLANTI TUTANAĞI & NOTLAR -->
                        <div class="visit-minutes-box">
                            <h4>✍️ Ziyaret Notları & Aksiyon Planı</h4>
                            <form onsubmit="App.saveAdvisorNotes(event, '${todayVisit.id}')">
                                <div class="form-group mb-2">
                                    <label class="form-label-xs">Görüşülen Konular:</label>
                                    <textarea id="advTopics" class="form-control-sm" rows="2" placeholder="Görüşülen konular...">${todayVisit.topicsDiscussed || ''}</textarea>
                                </div>
                                <div class="form-group mb-2">
                                    <label class="form-label-xs">Eksik Kalan Evrak / Bilgiler:</label>
                                    <textarea id="advMissing" class="form-control-sm" rows="2" placeholder="Eksik kalanlar...">${todayVisit.missingItems || ''}</textarea>
                                </div>
                                <div class="form-grid-2 mb-2">
                                    <div>
                                        <label class="form-label-xs">Mali Müşavirden Beklenenler:</label>
                                        <input type="text" id="advPendingAdvisor" class="form-control-sm" value="${todayVisit.pendingAdvisor || ''}" placeholder="Tahakkuk fişleri, KDV iade listesi vb.">
                                    </div>
                                    <div>
                                        <label class="form-label-xs">SODSAN'ın Yapması Gerekenler:</label>
                                        <input type="text" id="advPendingSODSAN" class="form-control-sm" value="${todayVisit.pendingSODSAN || ''}" placeholder="Cari mutabakat, imza vb.">
                                    </div>
                                </div>
                                <div class="form-grid-2 mb-2">
                                    <div>
                                        <label class="form-label-xs">Bir Sonraki Kontrol Tarihi:</label>
                                        <input type="date" id="advNextDate" class="form-control-sm" value="${todayVisit.nextVisitDate || '2026-11-08'}">
                                    </div>
                                    <div>
                                        <label class="form-label-xs">Ziyaret Durumu:</label>
                                        <select id="advStatus" class="form-control-sm">
                                            <option value="Bekliyor" ${todayVisit.status === 'Bekliyor' ? 'selected' : ''}>Bekliyor</option>
                                            <option value="Devam ediyor" ${todayVisit.status === 'Devam ediyor' ? 'selected' : ''}>Devam ediyor</option>
                                            <option value="Tamamlandı" ${todayVisit.status === 'Tamamlandı' ? 'selected' : ''}>Tamamlandı</option>
                                        </select>
                                    </div>
                                </div>
                                <button type="submit" class="btn btn-teal btn-sm btn-block">Tutanak ve Kararları Kaydet</button>
                            </form>
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- GELECEK VE GEÇMİŞ ZİYARETLER LİSTESİ -->
            <div class="two-column-grid mt-4">
                <div class="col-card">
                    <div class="card-header">
                        <h3>📅 Yaklaşan Planlı Ziyaretler</h3>
                        <span class="badge badge-teal">${nextVisits.length} Ziyaret</span>
                    </div>
                    <div class="card-body">
                        ${nextVisits.length === 0 ? `
                            <div class="empty-state-mini">Planlanmış gelecek ziyaret bulunmuyor.</div>
                        ` : `
                            <ul class="clean-list">
                                ${nextVisits.map(v => `
                                    <li class="p-2 border-b">
                                        <div class="flex-between">
                                            <strong>${v.title}</strong>
                                            <span class="badge badge-outline">${v.date}</span>
                                        </div>
                                        <p class="text-xs text-muted mb-1">${v.purpose}</p>
                                        <button class="btn btn-xs btn-outline" onclick="App.openAdvisorDetailModal('${v.id}')">Detay & Hazırlık</button>
                                    </li>
                                `).join('')}
                            </ul>
                        `}
                    </div>
                </div>

                <div class="col-card">
                    <div class="card-header">
                        <h3>📜 Geçmiş Ziyaretler & Tutanaklar</h3>
                        <span class="badge badge-secondary">${pastVisits.length} Tamamlanan</span>
                    </div>
                    <div class="card-body">
                        ${pastVisits.length === 0 ? `
                            <div class="empty-state-mini">Geçmiş ziyaret kaydı bulunmuyor.</div>
                        ` : `
                            <ul class="clean-list">
                                ${pastVisits.map(v => `
                                    <li class="p-2 border-b">
                                        <div class="flex-between">
                                            <strong>${v.title}</strong>
                                            <span class="badge badge-success">✓ ${v.date}</span>
                                        </div>
                                        <p class="text-xs text-muted mb-1">${v.topicsDiscussed || v.purpose}</p>
                                        ${v.missingItems ? `<div class="text-xs text-danger">Eksik: ${v.missingItems}</div>` : ''}
                                        <button class="btn btn-xs btn-outline mt-1" onclick="App.openAdvisorDetailModal('${v.id}')">Tutanağı Oku</button>
                                    </li>
                                `).join('')}
                            </ul>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    return {
        render
    };
})();
