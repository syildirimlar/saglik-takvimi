/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Ana Uygulama Orkestratörü (Master App Controller, Router & Modals)
 */

const App = (function() {

    let currentTab = "dashboard";

    function init() {
        SODSAN_DB.init();
        CalendarModule.init();
        updateNotificationBadges();
        switchTab("dashboard");

        // Global Arama Olayı
        const searchInput = document.getElementById("globalSearchInput");
        if (searchInput) {
            searchInput.addEventListener("input", function(e) {
                handleGlobalSearch(e.target.value);
            });
        }
    }

    function switchTab(tabName, options = {}) {
        currentTab = tabName;

        // Sekme butonlarını güncelle
        document.querySelectorAll(".nav-tab").forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
        });

        // Tüm view divlerini gizle
        document.querySelectorAll(".view-container").forEach(view => {
            view.style.display = "none";
        });

        // Hedef view'i göster ve modülünü render et
        const targetView = document.getElementById(tabName + "View");
        if (targetView) {
            targetView.style.display = "block";
        }

        switch (tabName) {
            case "dashboard":
                DashboardModule.render();
                break;
            case "tasks":
                if (options.filterStatus) TasksModule.setFilter({ status: options.filterStatus });
                else if (options.filterDate) TasksModule.setFilter({ date: options.filterDate });
                else TasksModule.render();
                break;
            case "invoices":
                if (options.filterStatus) InvoicesModule.setFilter(options.filterStatus);
                else InvoicesModule.render();
                break;
            case "payments":
                PaymentsModule.render();
                break;
            case "taxes":
                TaxesModule.render();
                break;
            case "advisor":
                AdvisorModule.render();
                break;
            case "payroll":
                PayrollModule.render();
                break;
            case "calendar":
                CalendarModule.init();
                CalendarModule.render();
                break;
            case "missing_info":
                MissingInfoModule.render();
                break;
            case "reports":
                ReportsModule.render();
                break;
            case "security":
                AuditAuthModule.render();
                break;
        }

        updateNotificationBadges();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function refresh() {
        switchTab(currentTab);
        updateNotificationBadges();
    }

    // Bildirim ve Sayaç Rozetleri (Section 16)
    function updateNotificationBadges() {
        const activeDate = SODSAN_DB.getActiveDate();
        const allTasks = SODSAN_DB.getAllTasks();
        const allInvoices = SODSAN_DB.getInvoices();
        const allPayments = SODSAN_DB.getPayments();
        const allTaxes = SODSAN_DB.getTaxes();

        // Gecikenler
        const overdueTasks = allTasks.filter(t => t.dueDate < activeDate && t.status !== "Tamamlandı" && t.status !== "İptal edildi");
        const overdueInvoices = allInvoices.filter(i => i.dueDate < activeDate && i.status !== "Ödendi");
        const totalOverdue = overdueTasks.length + overdueInvoices.length;

        // Bugün Yapılacak / Ödenecekler
        const todayTasks = allTasks.filter(t => t.date === activeDate && t.status !== "Tamamlandı");
        const todayPayments = allPayments.filter(p => p.dueDate === activeDate && p.status !== "Ödendi");
        const todayInvoices = allInvoices.filter(i => i.dueDate === activeDate && i.status !== "Ödendi");

        // Menü sayaçları
        const cntTasksEl = document.getElementById("cntTasks");
        if (cntTasksEl) cntTasksEl.innerText = todayTasks.length;

        const cntInvoicesEl = document.getElementById("cntInvoices");
        if (cntInvoicesEl) cntInvoicesEl.innerText = allInvoices.filter(i => i.status !== "Ödendi").length;

        const cntPaymentsEl = document.getElementById("cntPayments");
        if (cntPaymentsEl) cntPaymentsEl.innerText = allPayments.filter(p => p.status !== "Ödendi").length;

        const cntOverdueEl = document.getElementById("cntOverdueNav");
        if (cntOverdueEl) {
            cntOverdueEl.innerText = totalOverdue;
            cntOverdueEl.style.display = totalOverdue > 0 ? "inline-block" : "none";
        }

        // Bildirim Zil Rozeti
        const bellBadge = document.getElementById("notificationBellBadge");
        if (bellBadge) {
            const notifCount = totalOverdue + todayTasks.length + todayPayments.length;
            bellBadge.innerText = notifCount;
            bellBadge.style.display = notifCount > 0 ? "inline-block" : "none";
        }
    }

    // TARİH SİMÜLASYONU VE SEÇİMİ
    function changeActiveDate(newIsoDateStr) {
        if (!newIsoDateStr) return;
        SODSAN_DB.setActiveDate(newIsoDateStr);
        if (typeof CalendarModule !== 'undefined') {
            CalendarModule.selectDate(newIsoDateStr);
        }
        refresh();
        showToast(`Çalışma tarihi ${newIsoDateStr} olarak değiştirildi.`, "info");
    }

    function resetToRealDate() {
        const realToday = SODSAN_DB.getRealToday();
        SODSAN_DB.setActiveDate(realToday);
        if (typeof CalendarModule !== 'undefined') {
            CalendarModule.jumpToToday();
        } else {
            refresh();
        }
        showToast("Gerçek sistem tarihine dönüldü: " + realToday, "success");
    }

    // GÖREV İŞLEMLERİ
    function toggleTask(taskId) {
        const t = SODSAN_DB.toggleTaskStatus(taskId);
        refresh();
        showToast(`"${t.title}" -> ${t.status}`, "success");
    }

    function archiveTask(taskId) {
        if (confirm("Bu görev arşive taşınsın mı? (Daha sonra Güvenlik & Arşiv bölümünden geri yüklenebilir)")) {
            SODSAN_DB.deleteTask(taskId);
            refresh();
            showToast("Görev arşive taşındı.", "info");
        }
    }

    // GÜNLÜK 12 MUHASEBE RUTİNİ
    function openDailyRoutineModal(dateStr) {
        const activeDate = dateStr || SODSAN_DB.getActiveDate();
        const templates = SODSAN_DB.getDailyRoutineTemplates();
        const doneStatus = SODSAN_DB.getDailyRoutineStatus(activeDate);

        let html = `
            <div class="modal-backdrop" id="dailyRoutineModal">
                <div class="modal-dialog modal-md">
                    <div class="modal-header">
                        <div>
                            <h3>12 Günlük Standart Muhasebe Rutini</h3>
                            <span class="text-xs text-muted">${DashboardModule.formatDateDisplay(activeDate)} Tarihli Kontrol Listesi</span>
                        </div>
                        <button class="modal-close" onclick="App.closeModal('dailyRoutineModal')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="flex-between mb-3">
                            <span class="text-sm">Muhasebe personelinin sabah ve gün içi zorunlu rutinleri:</span>
                            <button class="btn btn-xs btn-success" onclick="App.completeAllDailyRoutines('${activeDate}')">✓ Tümünü Tamamla</button>
                        </div>
                        <div class="daily-check-grid">
                            ${templates.map(tmpl => {
                                const isDone = !!doneStatus[tmpl.id];
                                return `
                                    <div class="routine-check-row ${isDone ? 'done-row' : ''}">
                                        <input type="checkbox" id="chk_${tmpl.id}" ${isDone ? 'checked' : ''} onchange="App.toggleRoutineItem('${activeDate}', '${tmpl.id}')">
                                        <label for="chk_${tmpl.id}" class="routine-label">
                                            <strong>${tmpl.title}</strong>
                                            <span class="routine-desc-text">${tmpl.description}</span>
                                        </label>
                                        <span class="badge ${isDone ? 'badge-success' : 'badge-secondary'} badge-xs">
                                            ${isDone ? 'Tamamlandı' : 'Bekliyor'}
                                        </span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.closeModal('dailyRoutineModal')">Kapat</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", html);
    }

    function toggleRoutineItem(dateStr, routineId) {
        SODSAN_DB.toggleDailyRoutineItem(dateStr, routineId);
        refresh();
        const modal = document.getElementById("dailyRoutineModal");
        if (modal) modal.remove();
        openDailyRoutineModal(dateStr);
    }

    function completeAllDailyRoutines(dateStr) {
        SODSAN_DB.completeAllDailyRoutines(dateStr);
        refresh();
        const modal = document.getElementById("dailyRoutineModal");
        if (modal) modal.remove();
        showToast("Bugünkü 12 muhasebe rutini tek tıkla tamamlandı!", "success");
    }

    // GÖREV DÜZENLEME / EKLEME MODALI
    function openTaskEditModal(taskId) {
        const task = taskId ? SODSAN_DB.getTaskById(taskId) : null;
        const activeDate = SODSAN_DB.getActiveDate();

        let html = `
            <div class="modal-backdrop" id="taskEditModal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>${task ? 'Görevi Düzenle' : 'Yeni Görev Ekle'}</h3>
                        <button class="modal-close" onclick="App.closeModal('taskEditModal')">&times;</button>
                    </div>
                    <form onsubmit="App.handleSaveTask(event, '${taskId || ''}')">
                        <div class="modal-body">
                            <div class="form-group mb-2">
                                <label class="form-label">Görev Başlığı *</label>
                                <input type="text" id="taskTitle" class="form-control" required value="${task ? task.title : ''}" placeholder="Örn: Fabrika yemek faturası kontrolü">
                            </div>
                            <div class="form-grid-2 mb-2">
                                <div>
                                    <label class="form-label">Tarih *</label>
                                    <input type="date" id="taskDate" class="form-control" required value="${task ? task.date : activeDate}">
                                </div>
                                <div>
                                    <label class="form-label">Son Tarih (Termin) *</label>
                                    <input type="date" id="taskDueDate" class="form-control" required value="${task ? task.dueDate : activeDate}">
                                </div>
                            </div>
                            <div class="form-grid-3 mb-2">
                                <div>
                                    <label class="form-label">Kategori</label>
                                    <select id="taskCategory" class="form-control">
                                        <option value="Fatura" ${task && task.category === 'Fatura' ? 'selected' : ''}>Fatura</option>
                                        <option value="Ödeme" ${task && task.category === 'Ödeme' ? 'selected' : ''}>Ödeme</option>
                                        <option value="Tedarikçi" ${task && task.category === 'Tedarikçi' ? 'selected' : ''}>Tedarikçi</option>
                                        <option value="Vergi" ${task && task.category === 'Vergi' ? 'selected' : ''}>Vergi</option>
                                        <option value="SGK" ${task && task.category === 'SGK' ? 'selected' : ''}>SGK</option>
                                        <option value="Maaş" ${task && task.category === 'Maaş' ? 'selected' : ''}>Maaş</option>
                                        <option value="Avans" ${task && task.category === 'Avans' ? 'selected' : ''}>Avans</option>
                                        <option value="Kredi kartı" ${task && task.category === 'Kredi kartı' ? 'selected' : ''}>Kredi Kartı</option>
                                        <option value="Mali Müşavir" ${task && task.category === 'Mali Müşavir' ? 'selected' : ''}>Mali Müşavir</option>
                                        <option value="Banka" ${task && task.category === 'Banka' ? 'selected' : ''}>Banka</option>
                                        <option value="Cari" ${task && task.category === 'Cari' ? 'selected' : ''}>Cari</option>
                                        <option value="Evrak" ${task && task.category === 'Evrak' ? 'selected' : ''}>Evrak</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="form-label">Öncelik</label>
                                    <select id="taskPriority" class="form-control">
                                        <option value="Normal" ${task && task.priority === 'Normal' ? 'selected' : ''}>Normal</option>
                                        <option value="Yüksek" ${task && task.priority === 'Yüksek' ? 'selected' : ''}>Yüksek</option>
                                        <option value="Acil" ${task && task.priority === 'Acil' ? 'selected' : ''}>Acil</option>
                                        <option value="Düşük" ${task && task.priority === 'Düşük' ? 'selected' : ''}>Düşük</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="form-label">Durum</label>
                                    <select id="taskStatus" class="form-control">
                                        <option value="Bekliyor" ${task && task.status === 'Bekliyor' ? 'selected' : ''}>Bekliyor</option>
                                        <option value="Devam ediyor" ${task && task.status === 'Devam ediyor' ? 'selected' : ''}>Devam ediyor</option>
                                        <option value="Tamamlandı" ${task && task.status === 'Tamamlandı' ? 'selected' : ''}>Tamamlandı</option>
                                        <option value="Gecikti" ${task && task.status === 'Gecikti' ? 'selected' : ''}>Gecikti</option>
                                        <option value="İptal edildi" ${task && task.status === 'İptal edildi' ? 'selected' : ''}>İptal edildi</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group mb-2">
                                <label class="form-label">Sorumlu Kişi</label>
                                <input type="text" id="taskAssignedTo" class="form-control" value="${task ? task.assignedTo : 'Muhasebe'}" placeholder="Salih, Muhasebe Uzmanı vb.">
                            </div>
                            <div class="form-group mb-2">
                                <label class="form-label">Açıklama</label>
                                <textarea id="taskDescription" class="form-control" rows="2" placeholder="Görev detayları...">${task ? task.description : ''}</textarea>
                            </div>
                            <div class="form-group mb-2">
                                <label class="form-label">Not</label>
                                <input type="text" id="taskNote" class="form-control" value="${task ? (task.note || '') : ''}" placeholder="Örn: Evrak posta ile bekleniyor">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="App.closeModal('taskEditModal')">İptal</button>
                            <button type="submit" class="btn btn-primary">Kaydet</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", html);
    }

    function handleSaveTask(event, taskId) {
        event.preventDefault();
        const task = {
            id: taskId || null,
            title: document.getElementById("taskTitle").value.trim(),
            date: document.getElementById("taskDate").value,
            dueDate: document.getElementById("taskDueDate").value,
            category: document.getElementById("taskCategory").value,
            priority: document.getElementById("taskPriority").value,
            status: document.getElementById("taskStatus").value,
            assignedTo: document.getElementById("taskAssignedTo").value.trim(),
            description: document.getElementById("taskDescription").value.trim(),
            note: document.getElementById("taskNote").value.trim(),
            completedAt: (document.getElementById("taskStatus").value === "Tamamlandı") ? new Date().toISOString().slice(0, 16) : null
        };
        SODSAN_DB.saveTask(task);
        closeModal("taskEditModal");
        refresh();
        showToast("Görev başarıyla kaydedildi.", "success");
    }

    // FATURA İŞLEMLERİ
    function openInvoiceEditModal(invId) {
        const inv = invId ? SODSAN_DB.getInvoices().find(i => i.id === invId) : null;
        const activeDate = SODSAN_DB.getActiveDate();

        let html = `
            <div class="modal-backdrop" id="invoiceEditModal">
                <div class="modal-dialog modal-md">
                    <div class="modal-header">
                        <h3>${inv ? 'Faturayı Düzenle' : 'Yeni Fatura Girişi'}</h3>
                        <button class="modal-close" onclick="App.closeModal('invoiceEditModal')">&times;</button>
                    </div>
                    <form onsubmit="App.handleSaveInvoice(event, '${invId || ''}')">
                        <div class="modal-body">
                            <div class="form-grid-2 mb-2">
                                <div>
                                    <label class="form-label">Firma Unvanı *</label>
                                    <input type="text" id="invCompany" class="form-control" required value="${inv ? inv.company : ''}" placeholder="Firma Unvanı">
                                </div>
                                <div>
                                    <label class="form-label">Vergi Numarası (VKN)</label>
                                    <input type="text" id="invTaxNo" class="form-control" value="${inv ? (inv.taxNo || '') : ''}" placeholder="10 haneli VKN">
                                </div>
                            </div>
                            <div class="form-grid-2 mb-2">
                                <div>
                                    <label class="form-label">Fatura Numarası *</label>
                                    <input type="text" id="invNumber" class="form-control" required value="${inv ? inv.invoiceNo : ''}" placeholder="Örn: CSM202600004123">
                                </div>
                                <div>
                                    <label class="form-label">Fatura Tarihi *</label>
                                    <input type="date" id="invDate" class="form-control" required value="${inv ? inv.date : activeDate}">
                                </div>
                            </div>
                            <div class="form-group mb-2">
                                <label class="form-label">Fatura Açıklaması</label>
                                <input type="text" id="invDesc" class="form-control" value="${inv ? inv.description : ''}" placeholder="Örn: 5 Ton DKP sac hammaddesi alımı">
                            </div>
                            <div class="form-grid-3 mb-2">
                                <div>
                                    <label class="form-label">Matrah (KDV Hariç ₺) *</label>
                                    <input type="number" step="0.01" id="invAmount" class="form-control" required value="${inv ? inv.amount : ''}" oninput="App.calculateInvoiceTotal()">
                                </div>
                                <div>
                                    <label class="form-label">KDV Oranı (%)</label>
                                    <select id="invVatRate" class="form-control" onchange="App.calculateInvoiceTotal()">
                                        <option value="20" ${!inv || inv.vatRate === 20 ? 'selected' : ''}>%20</option>
                                        <option value="10" ${inv && inv.vatRate === 10 ? 'selected' : ''}>%10</option>
                                        <option value="1" ${inv && inv.vatRate === 1 ? 'selected' : ''}>%1</option>
                                        <option value="0" ${inv && inv.vatRate === 0 ? 'selected' : ''}>%0 (Muaf/İstisna)</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="form-label">Genel Toplam (₺)</label>
                                    <input type="number" step="0.01" id="invTotalAmount" class="form-control font-bold" readonly value="${inv ? inv.totalAmount : ''}">
                                </div>
                            </div>
                            <div class="form-grid-2 mb-2">
                                <div>
                                    <label class="form-label">Vade Tarihi *</label>
                                    <input type="date" id="invDueDate" class="form-control" required value="${inv ? inv.dueDate : activeDate}">
                                </div>
                                <div>
                                    <label class="form-label">Ödeme Durumu</label>
                                    <select id="invStatus" class="form-control">
                                        <option value="Bekliyor" ${inv && inv.status === 'Bekliyor' ? 'selected' : ''}>Bekliyor</option>
                                        <option value="Kaydedildi" ${inv && inv.status === 'Kaydedildi' ? 'selected' : ''}>Kaydedildi</option>
                                        <option value="Ödeme bekliyor" ${!inv || inv.status === 'Ödeme bekliyor' ? 'selected' : ''}>Ödeme bekliyor</option>
                                        <option value="Ödendi" ${inv && inv.status === 'Ödendi' ? 'selected' : ''}>Ödendi</option>
                                        <option value="Gecikti" ${inv && inv.status === 'Gecikti' ? 'selected' : ''}>Gecikti</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group mb-2">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="invAccounting" ${!inv || inv.accountingRecorded ? 'checked' : ''}>
                                    <span>Muhasebe sistemine (Zirve vb.) kaydedildi</span>
                                </label>
                            </div>
                            <div class="form-group mb-2">
                                <label class="form-label">Not</label>
                                <input type="text" id="invNote" class="form-control" value="${inv ? (inv.note || '') : ''}" placeholder="Cuma ödeme listesine alınacak vb.">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="App.closeModal('invoiceEditModal')">İptal</button>
                            <button type="submit" class="btn btn-success">Faturayı Kaydet</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", html);
    }

    function calculateInvoiceTotal() {
        const amount = parseFloat(document.getElementById("invAmount").value) || 0;
        const rate = parseFloat(document.getElementById("invVatRate").value) || 0;
        const vat = amount * (rate / 100);
        const total = amount + vat;
        document.getElementById("invTotalAmount").value = total.toFixed(2);
    }

    function handleSaveInvoice(event, invId) {
        event.preventDefault();
        const amount = parseFloat(document.getElementById("invAmount").value) || 0;
        const vatRate = parseFloat(document.getElementById("invVatRate").value) || 20;
        const vatAmount = amount * (vatRate / 100);
        const totalAmount = amount + vatAmount;

        const invoice = {
            id: invId || null,
            company: document.getElementById("invCompany").value.trim(),
            taxNo: document.getElementById("invTaxNo").value.trim(),
            invoiceNo: document.getElementById("invNumber").value.trim(),
            date: document.getElementById("invDate").value,
            description: document.getElementById("invDesc").value.trim(),
            amount: amount,
            vatRate: vatRate,
            vatAmount: vatAmount,
            totalAmount: totalAmount,
            dueDate: document.getElementById("invDueDate").value,
            status: document.getElementById("invStatus").value,
            accountingRecorded: document.getElementById("invAccounting").checked,
            note: document.getElementById("invNote").value.trim(),
            recordDate: SODSAN_DB.getActiveDate()
        };

        SODSAN_DB.saveInvoice(invoice);
        closeModal("invoiceEditModal");
        refresh();
        showToast("Fatura başarıyla kaydedildi.", "success");
    }

    function archiveInvoice(invId) {
        if (confirm("Bu fatura arşive taşınsın mı?")) {
            SODSAN_DB.deleteInvoice(invId);
            refresh();
            showToast("Fatura arşive taşındı.", "info");
        }
    }

    function openPayInvoiceModal(invId) {
        const inv = SODSAN_DB.getInvoices().find(i => i.id === invId);
        if (!inv) return;
        const activeDate = SODSAN_DB.getActiveDate();

        let html = `
            <div class="modal-backdrop" id="payInvoiceModal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>Fatura Ödemesini Gerçekleştir</h3>
                        <button class="modal-close" onclick="App.closeModal('payInvoiceModal')">&times;</button>
                    </div>
                    <form onsubmit="App.handleExecuteInvoicePayment(event, '${invId}')">
                        <div class="modal-body">
                            <div class="invoice-summary-box mb-3">
                                <h4>${inv.company}</h4>
                                <p class="text-sm">Fatura No: <strong>${inv.invoiceNo}</strong> | Vade: <strong>${inv.dueDate}</strong></p>
                                <div class="amount-large text-danger">${inv.totalAmount.toLocaleString('tr-TR')} ₺</div>
                            </div>
                            <div class="form-grid-2 mb-2">
                                <div>
                                    <label class="form-label">Ödeme Tarihi *</label>
                                    <input type="date" id="payDate" class="form-control" required value="${activeDate}">
                                </div>
                                <div>
                                    <label class="form-label">Ödeme Yapılan Banka *</label>
                                    <select id="payBank" class="form-control" required>
                                        <option value="Garanti BBVA">Garanti BBVA (Ticari Vadesiz)</option>
                                        <option value="İş Bankası">Türkiye İş Bankası</option>
                                        <option value="Yapı Kredi">Yapı Kredi Bankası</option>
                                        <option value="Ziraat Bankası">Ziraat Bankası</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-grid-2 mb-2">
                                <div>
                                    <label class="form-label">Ödeme Yöntemi</label>
                                    <select id="payMethod" class="form-control">
                                        <option value="Havale / EFT">Havale / EFT</option>
                                        <option value="FAST">FAST</option>
                                        <option value="Otomatik Talimat">Otomatik Ödeme Talimatı</option>
                                        <option value="Kredi Kartı">Kurumsal Kredi Kartı</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="form-label">Banka Dekont No</label>
                                    <input type="text" id="payReceipt" class="form-control" placeholder="Örn: DEK-2026-1023">
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="App.closeModal('payInvoiceModal')">İptal</button>
                            <button type="submit" class="btn btn-success">Ödemeyi Onayla & Faturayı Kapat</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", html);
    }

    function handleExecuteInvoicePayment(event, invId) {
        event.preventDefault();
        const inv = SODSAN_DB.getInvoices().find(i => i.id === invId);
        if (!inv) return;

        const payDate = document.getElementById("payDate").value;
        const bank = document.getElementById("payBank").value;
        const method = document.getElementById("payMethod").value;
        const receipt = document.getElementById("payReceipt").value.trim();

        // Faturayı ödendi yap
        inv.status = "Ödendi";
        inv.paymentDate = payDate;
        SODSAN_DB.saveInvoice(inv);

        // Ödeme tablosuna işle
        SODSAN_DB.savePayment({
            date: payDate,
            entity: inv.company,
            category: "Tedarikçi",
            description: `Fatura ${inv.invoiceNo} ödemesi (${inv.description || ''})`,
            amount: inv.totalAmount,
            bank: bank,
            account: "Ticari Vadesiz TL",
            method: method,
            dueDate: inv.dueDate,
            status: "Ödendi",
            receiptNo: receipt || ("DEK-" + Date.now().toString().slice(-6)),
            note: "Fatura üzerinden kapatıldı"
        });

        closeModal("payInvoiceModal");
        refresh();
        showToast(`${inv.company} faturası başarıyla ödendi ve muhasebeleştirildi.`, "success");
    }

    // ÖDEME İŞLEMLERİ
    function openPaymentEditModal(payId) {
        const pay = payId ? SODSAN_DB.getPayments().find(p => p.id === payId) : null;
        const activeDate = SODSAN_DB.getActiveDate();

        let html = `
            <div class="modal-backdrop" id="paymentEditModal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>${pay ? 'Ödeme Kaydını Düzenle' : 'Yeni Ödeme Planla'}</h3>
                        <button class="modal-close" onclick="App.closeModal('paymentEditModal')">&times;</button>
                    </div>
                    <form onsubmit="App.handleSavePayment(event, '${payId || ''}')">
                        <div class="modal-body">
                            <div class="form-grid-2 mb-2">
                                <div>
                                    <label class="form-label">Firma / Kurum *</label>
                                    <input type="text" id="pEntity" class="form-control" required value="${pay ? pay.entity : ''}" placeholder="Örn: Garanti BBVA Kredi Kartı">
                                </div>
                                <div>
                                    <label class="form-label">Ödeme Türü *</label>
                                    <select id="pCategory" class="form-control">
                                        <option value="Tedarikçi" ${pay && pay.category === 'Tedarikçi' ? 'selected' : ''}>Tedarikçi</option>
                                        <option value="Kredi kartı" ${pay && pay.category === 'Kredi kartı' ? 'selected' : ''}>Kredi Kartı</option>
                                        <option value="Vergi" ${pay && pay.category === 'Vergi' ? 'selected' : ''}>Vergi</option>
                                        <option value="SGK" ${pay && pay.category === 'SGK' ? 'selected' : ''}>SGK</option>
                                        <option value="Maaş" ${pay && pay.category === 'Maaş' ? 'selected' : ''}>Maaş</option>
                                        <option value="Avans" ${pay && pay.category === 'Avans' ? 'selected' : ''}>Avans</option>
                                        <option value="Elektrik" ${pay && pay.category === 'Elektrik' ? 'selected' : ''}>Elektrik</option>
                                        <option value="Su" ${pay && pay.category === 'Su' ? 'selected' : ''}>Su</option>
                                        <option value="Doğalgaz" ${pay && pay.category === 'Doğalgaz' ? 'selected' : ''}>Doğalgaz</option>
                                        <option value="İnternet" ${pay && pay.category === 'İnternet' ? 'selected' : ''}>İnternet</option>
                                        <option value="Telefon" ${pay && pay.category === 'Telefon' ? 'selected' : ''}>Telefon</option>
                                        <option value="Diğer" ${pay && pay.category === 'Diğer' ? 'selected' : ''}>Diğer</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-grid-2 mb-2">
                                <div>
                                    <label class="form-label">Tutar (₺) *</label>
                                    <input type="number" step="0.01" id="pAmount" class="form-control font-bold" required value="${pay ? pay.amount : ''}">
                                </div>
                                <div>
                                    <label class="form-label">Son Ödeme Tarihi *</label>
                                    <input type="date" id="pDueDate" class="form-control" required value="${pay ? pay.dueDate : activeDate}">
                                </div>
                            </div>
                            <div class="form-grid-2 mb-2">
                                <div>
                                    <label class="form-label">Banka</label>
                                    <input type="text" id="pBank" class="form-control" value="${pay ? (pay.bank || '') : 'Garanti BBVA'}" placeholder="Garanti BBVA, İş vb.">
                                </div>
                                <div>
                                    <label class="form-label">Hesap / IBAN</label>
                                    <input type="text" id="pAccount" class="form-control" value="${pay ? (pay.account || '') : 'Ticari Vadesiz TL'}">
                                </div>
                            </div>
                            <div class="form-grid-2 mb-2">
                                <div>
                                    <label class="form-label">Ödeme Yöntemi</label>
                                    <input type="text" id="pMethod" class="form-control" value="${pay ? (pay.method || '') : 'Havale/EFT'}">
                                </div>
                                <div>
                                    <label class="form-label">Durum</label>
                                    <select id="pStatus" class="form-control">
                                        <option value="Bekliyor" ${pay && pay.status === 'Bekliyor' ? 'selected' : ''}>Bekliyor</option>
                                        <option value="Onay Bekliyor" ${pay && pay.status === 'Onay Bekliyor' ? 'selected' : ''}>Onay Bekliyor</option>
                                        <option value="Ödendi" ${pay && pay.status === 'Ödendi' ? 'selected' : ''}>Ödendi</option>
                                        <option value="Gecikti" ${pay && pay.status === 'Gecikti' ? 'selected' : ''}>Gecikti</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group mb-2">
                                <label class="form-label">Açıklama</label>
                                <textarea id="pDesc" class="form-control" rows="2">${pay ? (pay.description || '') : ''}</textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="App.closeModal('paymentEditModal')">İptal</button>
                            <button type="submit" class="btn btn-success">Kaydet</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", html);
    }

    function handleSavePayment(event, payId) {
        event.preventDefault();
        const payment = {
            id: payId || null,
            entity: document.getElementById("pEntity").value.trim(),
            category: document.getElementById("pCategory").value,
            amount: parseFloat(document.getElementById("pAmount").value) || 0,
            dueDate: document.getElementById("pDueDate").value,
            date: document.getElementById("pDueDate").value,
            bank: document.getElementById("pBank").value.trim(),
            account: document.getElementById("pAccount").value.trim(),
            method: document.getElementById("pMethod").value.trim(),
            status: document.getElementById("pStatus").value,
            description: document.getElementById("pDesc").value.trim()
        };
        SODSAN_DB.savePayment(payment);
        closeModal("paymentEditModal");
        refresh();
        showToast("Ödeme planı başarıyla kaydedildi.", "success");
    }

    function markPaymentPaid(payId) {
        const pay = SODSAN_DB.getPayments().find(p => p.id === payId);
        if (pay) {
            pay.status = "Ödendi";
            pay.receiptNo = "DEK-" + Date.now().toString().slice(-6);
            SODSAN_DB.savePayment(pay);
            refresh();
            showToast(`${pay.entity} ödemesi "Ödendi" olarak güncellendi.`, "success");
        }
    }

    function revertPaymentStatus(payId) {
        const pay = SODSAN_DB.getPayments().find(p => p.id === payId);
        if (pay) {
            pay.status = "Bekliyor";
            SODSAN_DB.savePayment(pay);
            refresh();
            showToast(`${pay.entity} durumu beklemeye alındı.`, "info");
        }
    }

    function archivePayment(payId) {
        if (confirm("Bu ödeme kaydı arşive taşınsın mı?")) {
            SODSAN_DB.deletePayment(payId);
            refresh();
            showToast("Ödeme kaydı arşive taşındı.", "info");
        }
    }

    // PERŞEMBE TEDARİKÇİ ÖDEME LİSTESİ MODALI (Section 3 & 6)
    function openThursdayListModal() {
        const unpaidInvoices = SODSAN_DB.getInvoices().filter(i => i.status !== "Ödendi");
        const totalPayable = unpaidInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);

        let html = `
            <div class="modal-backdrop" id="thursdayModal">
                <div class="modal-dialog modal-lg">
                    <div class="modal-header">
                        <div>
                            <h3>📋 Haftalık Tedarikçi Ödeme Listesi</h3>
                            <span class="text-xs text-muted">Perşembe Günü Hazırlanır, Yönetici Onayına Sunulur ve Cuma Günü Bankadan Ödenir.</span>
                        </div>
                        <button class="modal-close" onclick="App.closeModal('thursdayModal')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="kpi-mini-card mb-3">
                            <span class="kpi-label">Onaya Hazır Toplam Tedarikçi Borcu</span>
                            <strong class="kpi-val text-primary">${totalPayable.toLocaleString('tr-TR')} ₺</strong>
                        </div>
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th width="40"><input type="checkbox" checked onchange="App.toggleAllThursdayChecks(this)"></th>
                                        <th>Firma Unvanı</th>
                                        <th width="120">Fatura No</th>
                                        <th width="100">Vade</th>
                                        <th width="120" class="text-right">Tutar (₺)</th>
                                        <th width="100">Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${unpaidInvoices.map(i => `
                                        <tr>
                                            <td class="text-center"><input type="checkbox" checked class="thu-check" value="${i.id}"></td>
                                            <td><strong>${i.company}</strong></td>
                                            <td><code class="code-pill">${i.invoiceNo}</code></td>
                                            <td>${i.dueDate}</td>
                                            <td class="text-right font-bold">${i.totalAmount.toLocaleString('tr-TR')} ₺</td>
                                            <td><span class="badge badge-warning">${i.status}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="window.print()">🖨️ Listeyi Yazdır</button>
                        <button class="btn btn-success" onclick="App.approveThursdayList()">✓ Yönetici Olarak Listeyi Onayla</button>
                        <button class="btn btn-outline" onclick="App.closeModal('thursdayModal')">Kapat</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", html);
    }

    function toggleAllThursdayChecks(masterChk) {
        document.querySelectorAll(".thu-check").forEach(c => c.checked = masterChk.checked);
    }

    function approveThursdayList() {
        const checkedBoxes = document.querySelectorAll(".thu-check:checked");
        const count = checkedBoxes.length;
        closeModal("thursdayModal");
        refresh();
        showToast(`Tedarikçi ödeme listesi (${count} fatura) Salih Bey tarafından onaylandı. Cuma günü banka talimatı verilebilir.`, "success");
    }

    // VERGİ TOGGLE İŞLEMLERİ
    function toggleTaxDeclaration(taxId) {
        const tax = SODSAN_DB.getTaxes().find(t => t.id === taxId);
        if (tax) {
            tax.declSubmitted = !tax.declSubmitted;
            SODSAN_DB.saveTax(tax);
            refresh();
            showToast(`${tax.type} beyannamesi durumu güncellendi.`, "info");
        }
    }

    function toggleTaxPayment(taxId) {
        const tax = SODSAN_DB.getTaxes().find(t => t.id === taxId);
        if (tax) {
            tax.paid = !tax.paid;
            tax.status = (tax.paid && tax.declSubmitted) ? "Tamamlandı" : "Bekliyor";
            SODSAN_DB.saveTax(tax);
            refresh();
            showToast(`${tax.type} ödeme durumu güncellendi.`, "success");
        }
    }

    function toggleTaxAdvisor(taxId) {
        const tax = SODSAN_DB.getTaxes().find(t => t.id === taxId);
        if (tax) {
            tax.advisorChecked = !tax.advisorChecked;
            SODSAN_DB.saveTax(tax);
            refresh();
            showToast(`${tax.type} Mali Müşavir kontrolü teyit edildi.`, "info");
        }
    }

    // MALİ MÜŞAVİR İŞLEMLERİ
    function openAdvisorDetailModal(visitId) {
        const v = SODSAN_DB.getAdvisorVisits().find(vis => vis.id === visitId);
        if (!v) return;

        let html = `
            <div class="modal-backdrop" id="advDetailModal">
                <div class="modal-dialog modal-md">
                    <div class="modal-header">
                        <div>
                            <h3>${v.title}</h3>
                            <span class="text-xs text-muted">Tarih: ${v.date} | Durum: ${v.status}</span>
                        </div>
                        <button class="modal-close" onclick="App.closeModal('advDetailModal')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="prep-checklist-box mb-3">
                            <h4>📋 Hazırlanacak Evrak ve Kayıtlar:</h4>
                            <div class="checklist-items mt-2">
                                ${(v.preparationChecklist || [
                                    { item: "Eksik faturalar", checked: true },
                                    { item: "Banka ekstreleri", checked: true },
                                    { item: "Cari hesap mutabakatları", checked: true },
                                    { item: "Bordro icmali ve SGK MPHB taslağı", checked: true }
                                ]).map((c, idx) => `
                                    <label class="check-item ${c.checked ? 'item-checked' : ''}">
                                        <input type="checkbox" ${c.checked ? 'checked' : ''} onchange="App.toggleAdvisorChecklistItem('${v.id}', ${idx})">
                                        <span>${c.item}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        ${v.topicsDiscussed ? `
                            <div class="mb-2"><strong>Görüşülen Konular:</strong> <p class="text-sm">${v.topicsDiscussed}</p></div>
                        ` : ''}
                        ${v.missingItems ? `
                            <div class="mb-2"><strong>Eksik Kalanlar:</strong> <p class="text-sm text-danger">${v.missingItems}</p></div>
                        ` : ''}
                        ${v.pendingSODSAN ? `
                            <div class="mb-2"><strong>SODSAN'ın Yapacakları:</strong> <p class="text-sm">${v.pendingSODSAN}</p></div>
                        ` : ''}
                        ${v.pendingAdvisor ? `
                            <div class="mb-2"><strong>Mali Müşavirden Beklenenler:</strong> <p class="text-sm">${v.pendingAdvisor}</p></div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.closeModal('advDetailModal')">Kapat</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", html);
    }

    function toggleAdvisorChecklistItem(visitId, itemIdx) {
        const v = SODSAN_DB.getAdvisorVisits().find(vis => vis.id === visitId);
        if (v && v.preparationChecklist && v.preparationChecklist[itemIdx]) {
            v.preparationChecklist[itemIdx].checked = !v.preparationChecklist[itemIdx].checked;
            SODSAN_DB.saveAdvisorVisit(v);
            refresh();
        }
    }

    function saveAdvisorNotes(event, visitId) {
        event.preventDefault();
        const v = SODSAN_DB.getAdvisorVisits().find(vis => vis.id === visitId);
        if (v) {
            v.topicsDiscussed = document.getElementById("advTopics").value;
            v.missingItems = document.getElementById("advMissing").value;
            v.pendingAdvisor = document.getElementById("advPendingAdvisor").value;
            v.pendingSODSAN = document.getElementById("advPendingSODSAN").value;
            v.nextVisitDate = document.getElementById("advNextDate").value;
            v.status = document.getElementById("advStatus").value;
            SODSAN_DB.saveAdvisorVisit(v);
            refresh();
            showToast("Mali müşavir tutanak ve kararları kaydedildi.", "success");
        }
    }

    // BORDRO STEP TOGGLE
    function togglePayrollStep(stepId) {
        const data = SODSAN_DB.getPayrollData();
        const step = data.steps.find(s => s.id === stepId);
        if (step) {
            SODSAN_DB.updatePayrollStep(stepId, !step.done);
            refresh();
            showToast(`Bordro Adım #${stepId} güncellendi.`, "info");
        }
    }

    function openPayrollSettingsModal() {
        const data = SODSAN_DB.getPayrollData();
        let html = `
            <div class="modal-backdrop" id="payrollSettingsModal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>Personel & Bordro Parametreleri</h3>
                        <button class="modal-close" onclick="App.closeModal('payrollSettingsModal')">&times;</button>
                    </div>
                    <form onsubmit="App.handleSavePayrollSettings(event)">
                        <div class="modal-body">
                            <div class="form-group mb-2">
                                <label class="form-label">Toplam Personel Sayısı</label>
                                <input type="number" id="pEmpCount" class="form-control" value="${data.employeeCount || 60}" required>
                            </div>
                            <div class="form-group mb-2">
                                <label class="form-label">Aylık Tahmini Toplam Net Maaş (₺)</label>
                                <input type="number" id="pEstSalary" class="form-control" value="${data.estimatedTotalNetSalary || ''}" placeholder="0.00">
                            </div>
                            <div class="form-group mb-2">
                                <label class="form-label">Aylık Tahmini Toplam Avans (₺)</label>
                                <input type="number" id="pEstAdvance" class="form-control" value="${data.estimatedTotalAdvance || ''}" placeholder="0.00">
                            </div>
                            <div class="form-group mb-2">
                                <label class="form-label">Aylık Tahmini SGK Prim Tahakkuku (₺)</label>
                                <input type="number" id="pEstSGK" class="form-control" value="${data.estimatedTotalSGK || ''}" placeholder="0.00">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="App.closeModal('payrollSettingsModal')">İptal</button>
                            <button type="submit" class="btn btn-primary">Kaydet</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", html);
    }

    function handleSavePayrollSettings(e) {
        e.preventDefault();
        const count = parseInt(document.getElementById("pEmpCount").value, 10);
        const salary = parseFloat(document.getElementById("pEstSalary").value);
        const advance = parseFloat(document.getElementById("pEstAdvance").value);
        const sgk = parseFloat(document.getElementById("pEstSGK").value);

        SODSAN_DB.updatePayrollSettings(count, salary, advance, sgk);
        closeModal("payrollSettingsModal");
        refresh();
        showToast("Personel ve bütçe parametreleri güncellendi.", "success");
    }

    // EKSİK BİLGİ DÜZENLEME MODALI (Section 13)
    function openEditMissingInfoModal(itemId) {
        const item = SODSAN_DB.getMissingInfoItems().find(m => m.id === itemId);
        if (!item) return;

        let html = `
            <div class="modal-backdrop" id="missingEditModal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>Eksik Bilgi Tanımla: ${item.subject}</h3>
                        <button class="modal-close" onclick="App.closeModal('missingEditModal')">&times;</button>
                    </div>
                    <form onsubmit="App.handleSaveMissingInfo(event, '${itemId}')">
                        <div class="modal-body">
                            <div class="mb-2 text-sm text-muted">
                                ${item.currentNote}
                            </div>
                            <div class="form-group mb-2">
                                <label class="form-label">Belirlenen Değer / Tarih *</label>
                                <input type="text" id="miValue" class="form-control" required value="${item.enteredValue || ''}" placeholder="Örn: Her ayın 18'i">
                            </div>
                            <div class="form-group mb-2">
                                <label class="form-label">Durum</label>
                                <select id="miStatus" class="form-control">
                                    <option value="Tanımlandı">Tanımlandı (Takvime Aktar)</option>
                                    <option value="Bilgi Bekleniyor">Hala Bilgi Bekleniyor</option>
                                </select>
                            </div>
                            <div class="form-group mb-2">
                                <label class="form-label">Açıklama / Aksiyon Planı</label>
                                <input type="text" id="miAction" class="form-control" value="${item.actionPlan}">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="App.closeModal('missingEditModal')">İptal</button>
                            <button type="submit" class="btn btn-primary">Kaydet & Takvime Ekle</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", html);
    }

    function handleSaveMissingInfo(e, itemId) {
        e.preventDefault();
        const item = SODSAN_DB.getMissingInfoItems().find(m => m.id === itemId);
        if (item) {
            item.enteredValue = document.getElementById("miValue").value.trim();
            item.status = document.getElementById("miStatus").value;
            item.actionPlan = document.getElementById("miAction").value.trim();
            SODSAN_DB.saveMissingInfoItem(item);

            // Otomatik Takvime Görev Olarak Ekle (Section 13)
            SODSAN_DB.saveTask({
                title: `${item.subject}: ${item.enteredValue}`,
                date: SODSAN_DB.getActiveDate(),
                dueDate: SODSAN_DB.getActiveDate(),
                category: item.category || "Diğer",
                priority: "Normal",
                status: "Bekliyor",
                assignedTo: "Muhasebe",
                description: `Eksik bilgiler modülünden yeni parametre tanımlandı: ${item.enteredValue}. ${item.actionPlan}`,
                note: "Eksik Bilgiler Tablosundan otomatik oluşturuldu."
            });

            closeModal("missingEditModal");
            refresh();
            showToast(`"${item.subject}" kaydedildi ve takvime otomatik işlendi!`, "success");
        }
    }

    // ARŞİV GERİ YÜKLEME
    function restoreArchivedItem(itemType, id) {
        if (itemType === "Görev") {
            SODSAN_DB.restoreTask(id);
        } else if (itemType === "Fatura") {
            const inv = SODSAN_DB.getInvoices().find(i => i.id === id);
            if (inv) { inv.isDeleted = false; SODSAN_DB.save(); }
        } else if (itemType === "Ödeme") {
            const p = SODSAN_DB.getPayments().find(pay => pay.id === id);
            if (p) { p.isDeleted = false; SODSAN_DB.save(); }
        }
        refresh();
        showToast("Kayıt başarıyla geri yüklendi.", "success");
    }

    function confirmResetDefaults() {
        if (confirm("DİKKAT: Tüm veriler sıfırlanıp 2026 başlangıç ayarlarına dönülecektir. Onaylıyor musunuz?")) {
            SODSAN_DB.resetDefaults();
            refresh();
            showToast("Veriler başlangıç ayarlarına döndürüldü.", "info");
        }
    }

    // GLOBAL SEARCH (Section 15)
    function handleGlobalSearch(query) {
        const results = SODSAN_DB.globalSearch(query);
        const searchDrop = document.getElementById("searchResultsDropdown");
        if (!searchDrop) return;

        if (!results) {
            searchDrop.style.display = "none";
            return;
        }

        const totalHits = results.tasks.length + results.invoices.length + results.payments.length + results.taxes.length;

        let html = `
            <div class="search-drop-header">
                <strong>"${query}" için Arama Sonuçları (${totalHits} eşleşme)</strong>
                <button class="btn-close-sm" onclick="document.getElementById('searchResultsDropdown').style.display='none'">&times;</button>
            </div>
            <div class="search-drop-body">
        `;

        if (totalHits === 0) {
            html += `<div class="p-3 text-muted text-center">Eşleşen kayıt bulunamadı.</div>`;
        } else {
            if (results.invoices.length > 0) {
                html += `<div class="search-sec-title">🧾 Faturalar (${results.invoices.length})</div>`;
                results.invoices.slice(0, 4).forEach(inv => {
                    html += `
                        <div class="search-hit-item" onclick="App.switchTab('invoices'); document.getElementById('searchResultsDropdown').style.display='none';">
                            <strong>${inv.company}</strong> - ${inv.totalAmount.toLocaleString('tr-TR')} ₺ (Fatura: ${inv.invoiceNo})
                        </div>
                    `;
                });
            }
            if (results.payments.length > 0) {
                html += `<div class="search-sec-title">💸 Ödemeler (${results.payments.length})</div>`;
                results.payments.slice(0, 4).forEach(p => {
                    html += `
                        <div class="search-hit-item" onclick="App.switchTab('payments'); document.getElementById('searchResultsDropdown').style.display='none';">
                            <strong>${p.entity}</strong> - ${p.amount.toLocaleString('tr-TR')} ₺ (${p.category})
                        </div>
                    `;
                });
            }
            if (results.tasks.length > 0) {
                html += `<div class="search-sec-title">📋 Görevler (${results.tasks.length})</div>`;
                results.tasks.slice(0, 4).forEach(t => {
                    html += `
                        <div class="search-hit-item" onclick="App.switchTab('tasks'); document.getElementById('searchResultsDropdown').style.display='none';">
                            <strong>${t.title}</strong> (${t.date})
                        </div>
                    `;
                });
            }
        }

        html += `</div>`;
        searchDrop.innerHTML = html;
        searchDrop.style.display = "block";
    }

    // MODAL KAPATMA YARDIMCISI
    function closeModal(modalId) {
        const el = document.getElementById(modalId);
        if (el) el.remove();
    }

    // TOAST BİLDİRİMİ
    function showToast(message, type = "info") {
        const existing = document.querySelector(".toast-notification");
        if (existing) existing.remove();

        const toast = document.createElement("div");
        toast.className = `toast-notification toast-${type}`;
        toast.innerText = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add("toast-show");
        }, 10);
        setTimeout(() => {
            toast.classList.remove("toast-show");
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // HIZLI MODAL TETİKLEYİCİLERİ
    function openQuickTaskModal(dateStr) {
        openTaskEditModal();
        if (dateStr) {
            setTimeout(() => {
                const dInput = document.getElementById("taskDate");
                const dueInput = document.getElementById("taskDueDate");
                if (dInput) dInput.value = dateStr;
                if (dueInput) dueInput.value = dateStr;
            }, 50);
        }
    }

    function openQuickInvoiceModal() {
        openInvoiceEditModal();
    }

    // EXCEL YÜKLEME AÇILIR PENCERESİ
    function openExcelImportModal() {
        let html = `
            <div class="modal-backdrop" id="excelImportModal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>Excel'den Veri Yükle (Import)</h3>
                        <button class="modal-close" onclick="App.closeModal('excelImportModal')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="text-sm text-muted mb-3">
                            SODSAN_2026_Mali_Isler_Takvimi_Guncel.xlsx veya uyumlu Excel dosyasını seçiniz. Fatura, görev ve vergi sekmeleri otomatik taranacaktır.
                        </p>
                        <input type="file" id="excelFileInput" accept=".xlsx, .xls" class="form-control mb-3">
                        <div id="importResult" class="text-sm"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="App.closeModal('excelImportModal')">İptal</button>
                        <button class="btn btn-primary" onclick="App.executeExcelImport()">İçeri Aktar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", html);
    }

    function executeExcelImport() {
        const fileInput = document.getElementById("excelFileInput");
        if (!fileInput || !fileInput.files[0]) {
            alert("Lütfen bir Excel dosyası seçiniz!");
            return;
        }
        ExcelService.handleExcelImport(fileInput.files[0], (success, msg) => {
            if (success) {
                closeModal("excelImportModal");
                refresh();
                showToast(msg, "success");
            } else {
                document.getElementById("importResult").innerHTML = `<span class="text-danger">${msg}</span>`;
            }
        });
    }

    return {
        init,
        switchTab,
        refresh,
        changeActiveDate,
        resetToRealDate,
        toggleTask,
        archiveTask,
        openDailyRoutineModal,
        toggleRoutineItem,
        completeAllDailyRoutines,
        openTaskEditModal,
        handleSaveTask,
        openInvoiceEditModal,
        calculateInvoiceTotal,
        handleSaveInvoice,
        archiveInvoice,
        openPayInvoiceModal,
        handleExecuteInvoicePayment,
        openPaymentEditModal,
        handleSavePayment,
        markPaymentPaid,
        revertPaymentStatus,
        archivePayment,
        openThursdayListModal,
        toggleAllThursdayChecks,
        approveThursdayList,
        toggleTaxDeclaration,
        toggleTaxPayment,
        toggleTaxAdvisor,
        openAdvisorDetailModal,
        toggleAdvisorChecklistItem,
        saveAdvisorNotes,
        togglePayrollStep,
        openPayrollSettingsModal,
        handleSavePayrollSettings,
        openEditMissingInfoModal,
        handleSaveMissingInfo,
        restoreArchivedItem,
        confirmResetDefaults,
        handleGlobalSearch,
        closeModal,
        showToast,
        openQuickTaskModal,
        openQuickInvoiceModal,
        openExcelImportModal,
        executeExcelImport
    };
})();

// Sayfa yüklendiğinde başlat
window.addEventListener("DOMContentLoaded", () => {
    App.init();
});
