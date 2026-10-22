/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Görev Yönetimi Modülü - Günlük İşler, Rutinler ve Arşiv
 */

const TasksModule = (function() {

    let currentFilter = {
        date: "",
        category: "ALL",
        status: "ALL",
        priority: "ALL",
        search: ""
    };

    function setFilter(newFilter) {
        currentFilter = Object.assign(currentFilter, newFilter);
        render();
    }

    function render(targetContainerId = "tasksView") {
        const container = document.getElementById(targetContainerId);
        if (!container) return;

        const activeDate = SODSAN_DB.getActiveDate();
        let tasks = SODSAN_DB.getAllTasks();

        // Filtreleme
        if (currentFilter.date === "TODAY") {
            tasks = tasks.filter(t => t.date === activeDate);
        } else if (currentFilter.date && currentFilter.date !== "ALL") {
            tasks = tasks.filter(t => t.date === currentFilter.date);
        }

        if (currentFilter.category !== "ALL") {
            tasks = tasks.filter(t => t.category === currentFilter.category);
        }

        if (currentFilter.status !== "ALL") {
            if (currentFilter.status === "Gecikti") {
                tasks = tasks.filter(t => t.dueDate < activeDate && t.status !== "Tamamlandı" && t.status !== "İptal edildi");
            } else {
                tasks = tasks.filter(t => t.status === currentFilter.status);
            }
        }

        if (currentFilter.priority !== "ALL") {
            tasks = tasks.filter(t => t.priority === currentFilter.priority);
        }

        if (currentFilter.search) {
            const q = currentFilter.search.toLowerCase();
            tasks = tasks.filter(t => (
                (t.title && t.title.toLowerCase().includes(q)) ||
                (t.description && t.description.toLowerCase().includes(q)) ||
                (t.assignedTo && t.assignedTo.toLowerCase().includes(q)) ||
                (t.note && t.note.toLowerCase().includes(q))
            ));
        }

        // Sıralama: Bekleyenler ve Aciller üstte, tamamlananlar altta
        tasks.sort((a, b) => {
            if (a.status === "Tamamlandı" && b.status !== "Tamamlandı") return 1;
            if (a.status !== "Tamamlandı" && b.status === "Tamamlandı") return -1;
            return a.date.localeCompare(b.date);
        });

        const dailyRoutinesDone = SODSAN_DB.getDailyRoutineStatus(activeDate);
        const dailyTemplates = SODSAN_DB.getDailyRoutineTemplates();
        const dailyDoneCount = Object.values(dailyRoutinesDone).filter(Boolean).length;

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h2>Günlük Görev Sistemi & İş Takibi</h2>
                    <span class="sub-text">Muhasebe operasyonlarının, dönemsel rutinlerin ve acil aksiyonların yönetimi.</span>
                </div>
                <div class="header-actions">
                    <button class="btn btn-outline" onclick="App.openDailyRoutineModal('${activeDate}')">
                        📋 12 Günlük Rutini Aç (${dailyDoneCount}/12)
                    </button>
                    <button class="btn btn-primary" onclick="App.openTaskEditModal()">
                        + Yeni Görev Ekle
                    </button>
                </div>
            </div>

            <!-- FİLTRE VE ARAMA ÇUBUĞU -->
            <div class="filter-bar">
                <div class="filter-item">
                    <label>Tarih:</label>
                    <select id="taskFilterDate" onchange="TasksModule.setFilter({ date: this.value })">
                        <option value="ALL" ${currentFilter.date === 'ALL' || !currentFilter.date ? 'selected' : ''}>Tüm Tarihler (2026)</option>
                        <option value="TODAY" ${currentFilter.date === 'TODAY' ? 'selected' : ''}>Bugün (${activeDate})</option>
                    </select>
                </div>
                <div class="filter-item">
                    <label>Kategori:</label>
                    <select onchange="TasksModule.setFilter({ category: this.value })">
                        <option value="ALL">Tüm Kategoriler</option>
                        <option value="Fatura">Fatura</option>
                        <option value="Ödeme">Ödeme</option>
                        <option value="Tedarikçi">Tedarikçi</option>
                        <option value="Vergi">Vergi</option>
                        <option value="SGK">SGK</option>
                        <option value="Maaş">Maaş</option>
                        <option value="Avans">Avans</option>
                        <option value="Kredi kartı">Kredi Kartı</option>
                        <option value="Mali Müşavir">Mali Müşavir</option>
                        <option value="Banka">Banka</option>
                        <option value="Cari">Cari</option>
                        <option value="Evrak">Evrak</option>
                    </select>
                </div>
                <div class="filter-item">
                    <label>Durum:</label>
                    <select onchange="TasksModule.setFilter({ status: this.value })">
                        <option value="ALL">Tüm Durumlar</option>
                        <option value="Bekliyor" ${currentFilter.status === 'Bekliyor' ? 'selected' : ''}>Bekliyor</option>
                        <option value="Devam ediyor" ${currentFilter.status === 'Devam ediyor' ? 'selected' : ''}>Devam ediyor</option>
                        <option value="Tamamlandı" ${currentFilter.status === 'Tamamlandı' ? 'selected' : ''}>Tamamlandı</option>
                        <option value="Gecikti" ${currentFilter.status === 'Gecikti' ? 'selected' : ''}>Gecikti</option>
                        <option value="İptal edildi" ${currentFilter.status === 'İptal edildi' ? 'selected' : ''}>İptal edildi</option>
                    </select>
                </div>
                <div class="filter-item">
                    <label>Öncelik:</label>
                    <select onchange="TasksModule.setFilter({ priority: this.value })">
                        <option value="ALL">Tüm Öncelikler</option>
                        <option value="Acil">Acil</option>
                        <option value="Yüksek">Yüksek</option>
                        <option value="Normal">Normal</option>
                        <option value="Düşük">Düşük</option>
                    </select>
                </div>
                <div class="filter-item search-item">
                    <label>Ara:</label>
                    <input type="text" placeholder="Görev adı, açıklama, sorumlu..." value="${currentFilter.search}" oninput="TasksModule.setFilter({ search: this.value })">
                </div>
            </div>

            <!-- GÖREV LİSTESİ TABLOSU -->
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th width="40">Durum</th>
                            <th width="100">Tarih</th>
                            <th>Görev Adı & Açıklama</th>
                            <th width="120">Kategori</th>
                            <th width="130">Sorumlu</th>
                            <th width="90">Öncelik</th>
                            <th width="110">Son Tarih</th>
                            <th width="150">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tasks.length === 0 ? `
                            <tr>
                                <td colspan="8" class="text-center py-4 text-muted">
                                    Seçilen filtrelere uygun görev bulunamadı.
                                </td>
                            </tr>
                        ` : tasks.map(t => {
                            const isOverdue = (t.dueDate < activeDate && t.status !== "Tamamlandı" && t.status !== "İptal edildi");
                            const statusBadgeClass = {
                                "Bekliyor": "badge-secondary",
                                "Devam ediyor": "badge-info",
                                "Tamamlandı": "badge-success",
                                "Gecikti": "badge-danger",
                                "İptal edildi": "badge-gray"
                            }[t.status] || "badge-secondary";

                            return `
                                <tr class="${t.status === 'Tamamlandı' ? 'row-done' : (isOverdue ? 'row-overdue' : '')}">
                                    <td class="text-center">
                                        <input type="checkbox" ${t.status === 'Tamamlandı' ? 'checked' : ''} onchange="App.toggleTask('${t.id}')" title="Tamamlandı olarak işaretle">
                                    </td>
                                    <td><strong>${t.date}</strong></td>
                                    <td>
                                        <div class="task-title-cell ${t.status === 'Tamamlandı' ? 'strike' : ''}">
                                            <strong>${t.title}</strong>
                                            ${t.description ? `<p class="task-desc-sm">${t.description}</p>` : ''}
                                            ${t.note ? `<div class="task-note-pill">📌 ${t.note}</div>` : ''}
                                            ${t.completedAt ? `<small class="text-success">Tamamlanma: ${t.completedAt}</small>` : ''}
                                        </div>
                                    </td>
                                    <td><span class="category-badge cat-${t.category.toLowerCase().replace(/\\s+/g, '-')}">${t.category}</span></td>
                                    <td><span class="user-pill">${t.assignedTo || 'Belirtilmedi'}</span></td>
                                    <td>
                                        <span class="priority-badge priority-${t.priority.toLowerCase()}">${t.priority}</span>
                                    </td>
                                    <td>
                                        <span class="${isOverdue ? 'text-danger font-bold' : ''}">${t.dueDate}</span>
                                        ${isOverdue ? '<span class="badge badge-danger badge-xs block mt-1">Gecikti</span>' : ''}
                                    </td>
                                    <td>
                                        <div class="action-btn-group">
                                            <button class="btn btn-xs ${t.status === 'Tamamlandı' ? 'btn-outline' : 'btn-success'}" onclick="App.toggleTask('${t.id}')">
                                                ${t.status === 'Tamamlandı' ? 'Geri Al' : 'Tamamla'}
                                            </button>
                                            <button class="btn btn-xs btn-outline" onclick="App.openTaskEditModal('${t.id}')" title="Düzenle">✏️</button>
                                            <button class="btn btn-xs btn-outline text-danger" onclick="App.archiveTask('${t.id}')" title="Arşive Taşı">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <div class="list-summary-bar">
                <span>Toplam <strong>${tasks.length}</strong> adet görev listelendi.</span>
                <span class="text-muted">Tamamlanan görevler sistem geçmişinde saklanır ve asla kaybolmaz.</span>
            </div>
        `;
    }

    return {
        render,
        setFilter
    };
})();
