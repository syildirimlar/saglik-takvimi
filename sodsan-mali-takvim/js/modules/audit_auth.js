/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Yetkilendirme, Denetim İzi (Audit Log) ve Arşiv Modülü
 */

const AuditAuthModule = (function() {

    function render(targetContainerId = "securityView") {
        const container = document.getElementById(targetContainerId);
        if (!container) return;

        const currentUser = SODSAN_DB.getCurrentUser();
        const users = SODSAN_DB.getUsers();
        const auditLogs = SODSAN_DB.getAuditLogs();
        const archivedItems = SODSAN_DB.getArchivedItems();

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h2>Kullanıcı Yetkilendirme, Denetim İzi & Veri Güvenliği</h2>
                    <span class="sub-text">Finansal veri güvenliği, kullanıcı rolleri, detaylı işlem logları ve silinen kayıtlar arşivi.</span>
                </div>
                <div class="header-actions">
                    <button class="btn btn-outline" onclick="App.exportAuditLogExcel()">
                        📥 Denetim İzini Excel'e İndir
                    </button>
                    <button class="btn btn-outline text-danger" onclick="App.confirmResetDefaults()">
                        🔄 Verileri Sıfırla (Fabrika Ayarları)
                    </button>
                </div>
            </div>

            <!-- AKTİF KULLANICI SEÇİM KARTI -->
            <div class="user-role-card mb-4">
                <div class="card-header">
                    <h3>👤 Aktif Kullanıcı & Rol Yönetimi</h3>
                    <span class="badge badge-primary">Mevcut Rol: ${currentUser.role}</span>
                </div>
                <div class="card-body">
                    <p class="text-sm text-muted mb-3">
                        Sistemde yapılan her değişiklik, fatura kaydı ve ödeme onayı aktif kullanıcının imzasıyla log kayıtlarına işlenir.
                    </p>
                    <div class="user-switch-grid">
                        ${users.map(u => `
                            <div class="user-card-pill ${u.id === currentUser.id ? 'active-user-pill' : ''}" onclick="SODSAN_DB.setCurrentUser('${u.id}'); App.refresh();">
                                <span class="user-avatar-lg">${u.avatar}</span>
                                <div class="user-meta">
                                    <strong>${u.name}</strong>
                                    <span class="text-xs text-muted">${u.email}</span>
                                    <span class="badge ${u.role === 'Yonetici' ? 'badge-danger' : 'badge-info'} mt-1">${u.role}</span>
                                </div>
                                ${u.id === currentUser.id ? '<span class="active-indicator">✓ Aktif</span>' : '<button class="btn btn-xs btn-outline">Seç</button>'}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- İKİ KOLON: DENETİM İZİ VE SİLİNENLER ARŞİVİ -->
            <div class="two-column-grid">
                
                <!-- DENETİM İZİ (AUDIT LOG) -->
                <div class="col-card">
                    <div class="card-header">
                        <h3>📜 İşlem Geçmişi (Denetim İzi)</h3>
                        <span class="badge badge-secondary">${auditLogs.length} Kayıt</span>
                    </div>
                    <div class="card-body">
                        <div class="log-timeline-list">
                            ${auditLogs.length === 0 ? `
                                <div class="empty-state-mini">Henüz kaydedilmiş işlem geçmişi bulunmuyor.</div>
                            ` : auditLogs.slice(0, 30).map(log => `
                                <div class="log-timeline-item">
                                    <div class="log-meta-row">
                                        <span class="log-user"><strong>${log.user}</strong> (${log.role})</span>
                                        <span class="log-time">${log.timestamp.replace('T', ' ').slice(0, 19)}</span>
                                    </div>
                                    <div class="log-action-row">
                                        <span class="badge badge-xs ${getActionBadge(log.action)}">${log.action}</span>
                                        <span class="log-target">${log.targetType} #${log.targetId}</span>
                                    </div>
                                    <p class="log-details">${log.details}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- SİLİNEN KAYITLAR ARŞİVİ (SOFT DELETE) -->
                <div class="col-card">
                    <div class="card-header">
                        <h3>🗄️ Arşiv & Silinen Kayıtlar</h3>
                        <span class="badge badge-warning">${archivedItems.length} Arşivlenmiş</span>
                    </div>
                    <div class="card-body">
                        <p class="text-xs text-muted mb-2">
                            Veri güvenliği gereği silinen fatura, ödeme ve görevler kalıcı yok edilmez. Yanlışlıkla silinen kayıtlar buradan anında geri yüklenebilir.
                        </p>
                        ${archivedItems.length === 0 ? `
                            <div class="empty-state-mini text-success">
                                🗄️ Arşiv kutusu temiz. Silinmiş kayıt bulunmuyor.
                            </div>
                        ` : `
                            <div class="archive-list">
                                ${archivedItems.map(item => `
                                    <div class="archive-item">
                                        <div class="archive-meta">
                                            <span class="badge badge-outline">${item.itemType}</span>
                                            <strong>${item.title || item.entity || item.company}</strong>
                                            <span class="text-xs text-muted">Silen: ${item.deletedBy || 'Bilinmiyor'} (${(item.deletedAt || '').slice(0, 10)})</span>
                                        </div>
                                        <button class="btn btn-xs btn-success" onclick="App.restoreArchivedItem('${item.itemType}', '${item.id}')">
                                            ♻️ Geri Yükle
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>

            </div>
        `;
    }

    function getActionBadge(action) {
        if (!action) return "badge-secondary";
        if (action.includes("Ekleme")) return "badge-success";
        if (action.includes("Güncelleme")) return "badge-info";
        if (action.includes("Silme") || action.includes("Arşiv")) return "badge-danger";
        if (action.includes("Tamamlama")) return "badge-teal";
        return "badge-secondary";
    }

    return {
        render
    };
})();
