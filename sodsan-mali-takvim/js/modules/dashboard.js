/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Dashboard Modülü - 9 Temel Kart ve Günlük Operasyon Özeti
 */

const DashboardModule = (function() {
    
    const TURKISH_DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const TURKISH_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

    function formatDateDisplay(isoDateStr) {
        if (!isoDateStr) return "";
        const parts = isoDateStr.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dateObj = new Date(y, m, d);
        const dayName = TURKISH_DAYS[dateObj.getDay()];
        const monthName = TURKISH_MONTHS[m];
        return `${dayName} – ${d} ${monthName} ${y}`;
    }

    function render() {
        const activeDate = SODSAN_DB.getActiveDate();
        const container = document.getElementById("dashboardView");
        if (!container) return;

        // Hesaplamalar
        const allTasks = SODSAN_DB.getAllTasks();
        const allInvoices = SODSAN_DB.getInvoices();
        const allPayments = SODSAN_DB.getPayments();
        const allTaxes = SODSAN_DB.getTaxes();
        const advisorVisits = SODSAN_DB.getAdvisorVisits();

        // 1. Bugün Yapılacaklar (Tarih = activeDate olan ve Tamamlanmamış görevler)
        const todayTasks = allTasks.filter(t => t.date === activeDate);
        const todayTasksPending = todayTasks.filter(t => t.status !== "Tamamlandı" && t.status !== "İptal edildi");
        
        // Günlük 12 Rutin durumu
        const dailyRoutinesDone = SODSAN_DB.getDailyRoutineStatus(activeDate);
        const dailyTemplates = SODSAN_DB.getDailyRoutineTemplates();
        const dailyDoneCount = Object.values(dailyRoutinesDone).filter(Boolean).length;
        const dailyTotalCount = dailyTemplates.length;

        // 2. Bugün Ödenecekler (Vadesi activeDate olan faturalar ve ödemeler)
        const todayPayments = allPayments.filter(p => p.dueDate === activeDate && p.status !== "Ödendi");
        const todayInvoices = allInvoices.filter(i => i.dueDate === activeDate && i.status !== "Ödendi");
        const todayPaymentTotal = todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const todayInvoiceTotal = todayInvoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);
        const grandTodayPayable = todayPaymentTotal + todayInvoiceTotal;

        // 3. Yarın Yapılacaklar
        const tomorrowDate = getOffsetDate(activeDate, 1);
        const tomorrowTasks = allTasks.filter(t => t.date === tomorrowDate && t.status !== "Tamamlandı");
        const tomorrowPayments = allPayments.filter(p => p.dueDate === tomorrowDate && p.status !== "Ödendi");

        // 4. Bu Hafta Yapılacaklar
        const weekDates = getWeekDates(activeDate);
        const weekTasks = allTasks.filter(t => weekDates.includes(t.date) && t.status !== "Tamamlandı");
        const weekPayments = allPayments.filter(p => weekDates.includes(p.dueDate) && p.status !== "Ödendi");
        const weekPaymentTotal = weekPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        // 5. Geciken İşler & Ödemeler (Vadesi activeDate'ten önce ve açık kalanlar)
        const overdueTasks = allTasks.filter(t => t.dueDate < activeDate && t.status !== "Tamamlandı" && t.status !== "İptal edildi");
        const overdueInvoices = allInvoices.filter(i => i.dueDate < activeDate && i.status !== "Ödendi");
        const overduePayments = allPayments.filter(p => p.dueDate < activeDate && p.status !== "Ödendi");
        const overdueTotalAmount = overdueInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0) + overduePayments.reduce((s, p) => s + (p.amount || 0), 0);

        // 6. Yaklaşan Ödemeler (Gelecek 7 gün ve 30 gün)
        const next7Days = getUpcomingDates(activeDate, 7);
        const next30Days = getUpcomingDates(activeDate, 30);
        const upcoming7Payments = allPayments.filter(p => next7Days.includes(p.dueDate) && p.status !== "Ödendi");
        const upcoming7Invoices = allInvoices.filter(i => next7Days.includes(i.dueDate) && i.status !== "Ödendi");
        const total7DaysPayable = upcoming7Payments.reduce((s, p) => s + (p.amount || 0), 0) + upcoming7Invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);

        const upcoming30Payments = allPayments.filter(p => next30Days.includes(p.dueDate) && p.status !== "Ödendi");
        const upcoming30Invoices = allInvoices.filter(i => next30Days.includes(i.dueDate) && i.status !== "Ödendi");
        const total30DaysPayable = upcoming30Payments.reduce((s, p) => s + (p.amount || 0), 0) + upcoming30Invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);

        // 7. Yaklaşan Vergiler (GİB / SGK)
        const upcomingTaxes = allTaxes.filter(t => t.dueDate >= activeDate && t.status !== "Tamamlandı").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        const nextTax = upcomingTaxes.length > 0 ? upcomingTaxes[0] : null;

        // 8. Mali Müşavir Ziyareti
        const todayVisit = advisorVisits.find(v => v.date === activeDate);
        const nextVisit = advisorVisits.filter(v => v.date >= activeDate && v.status !== "Tamamlandı").sort((a, b) => a.date.localeCompare(b.date))[0];

        // 9. Bekleyen Onaylar
        const pendingApprovals = [
            ...allPayments.filter(p => p.status === "Onay Bekliyor"),
            ...allTasks.filter(t => t.status === "Onay Bekliyor")
        ];

        // HTML Çıktısı
        container.innerHTML = `
            <!-- ÜST TARİH KONTROL ŞERİDİ -->
            <div class="today-banner">
                <div class="today-title-group">
                    <span class="today-badge">AKTİF ÇALIŞMA GÜNÜ</span>
                    <h2 class="today-date-text" id="todayHeaderDate">BUGÜN: ${formatDateDisplay(activeDate)}</h2>
                    <span class="sub-text">Sistemdeki tüm görev, ödeme ve bildirimler bu tarihe göre dinamik hesaplanmaktadır.</span>
                </div>
                <div class="today-controls">
                    <label for="dateSimulatorInput">Tarih Değiştir:</label>
                    <input type="date" id="dateSimulatorInput" value="${activeDate}" onchange="App.changeActiveDate(this.value)">
                    <button class="btn btn-outline btn-sm" onclick="App.resetToRealDate()" title="Gerçek sistem gününe geri dön">Bugüne Dön</button>
                    <button class="btn btn-primary btn-sm" onclick="App.openQuickTaskModal()">+ Yeni Görev</button>
                    <button class="btn btn-success btn-sm" onclick="App.openQuickInvoiceModal()">+ Fatura Ekle</button>
                </div>
            </div>

            <!-- KRİTİK GECİKME UYARISI BANNERI (Varsa) -->
            ${(overdueTasks.length > 0 || overdueInvoices.length > 0) ? `
                <div class="alert-banner alert-danger">
                    <div class="alert-icon">⚠️</div>
                    <div class="alert-content">
                        <strong>DİKKAT: Vadesi Geçmiş ${overdueTasks.length + overdueInvoices.length} Adet İşlem Bulunmaktadır!</strong>
                        <span>Toplam Geciken Ödeme Tutarı: <strong>${overdueTotalAmount.toLocaleString('tr-TR')} ₺</strong>. Lütfen geciken görev ve tedarikçi faturalarını ivedilikle inceleyiniz.</span>
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="App.switchTab('tasks', { filterStatus: 'Gecikti' })">Gecikenleri Göster</button>
                </div>
            ` : ''}

            <!-- 9 TEMEL DASHBOARD KARTI -->
            <div class="dashboard-grid">
                
                <!-- 1. KART: BUGÜN YAPILACAKLAR -->
                <div class="dash-card card-primary">
                    <div class="card-header">
                        <div class="card-icon">📋</div>
                        <div class="card-title">
                            <h3>Bugün Yapılacaklar</h3>
                            <span class="card-subtitle">${todayTasksPending.length} Planlı Görev & ${dailyDoneCount}/${dailyTotalCount} Günlük Rutin</span>
                        </div>
                        <span class="badge ${todayTasksPending.length === 0 ? 'badge-success' : 'badge-primary'}">${todayTasksPending.length} Görev</span>
                    </div>
                    <div class="card-body">
                        <!-- Günlük 12 Muhasebe Rutini İlerleme Çubuğu -->
                        <div class="routine-progress-box">
                            <div class="routine-progress-label">
                                <span>12 Günlük Standart Muhasebe İşi</span>
                                <strong>%${Math.round((dailyDoneCount / dailyTotalCount) * 100)}</strong>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${(dailyDoneCount / dailyTotalCount) * 100}%"></div>
                            </div>
                            <div class="routine-actions">
                                <button class="btn-link" onclick="App.openDailyRoutineModal('${activeDate}')">Listeyi Aç & İşaretle</button>
                                ${dailyDoneCount < dailyTotalCount ? `<button class="btn-link-success" onclick="App.completeAllDailyRoutines('${activeDate}')">✓ Tümünü Tamamla</button>` : '<span class="text-success font-bold">✓ Tamamı Tamamlandı</span>'}
                            </div>
                        </div>

                        <!-- Bugünün Özel Görevleri -->
                        <div class="mini-task-list">
                            ${todayTasks.length === 0 ? `
                                <div class="empty-state-mini">Bugün için eklenmiş özel görev bulunmuyor.</div>
                            ` : todayTasks.slice(0, 4).map(t => `
                                <div class="mini-task-item ${t.status === 'Tamamlandı' ? 'done' : ''}">
                                    <input type="checkbox" ${t.status === 'Tamamlandı' ? 'checked' : ''} onchange="App.toggleTask('${t.id}')">
                                    <div class="task-info">
                                        <span class="task-title ${t.status === 'Tamamlandı' ? 'strike' : ''}">${t.title}</span>
                                        <span class="task-cat cat-${t.category.toLowerCase().replace(/\\s+/g, '-')}">${t.category}</span>
                                    </div>
                                    <span class="priority-dot priority-${t.priority.toLowerCase()}"></span>
                                </div>
                            `).join('')}
                            ${todayTasks.length > 4 ? `
                                <div class="text-center pt-2">
                                    <a href="javascript:void(0)" onclick="App.switchTab('tasks', { filterDate: '${activeDate}' })">+${todayTasks.length - 4} diğer görevi gör...</a>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-outline btn-block" onclick="App.switchTab('tasks', { filterDate: '${activeDate}' })">Tüm Günlük Görevleri Yönet</button>
                    </div>
                </div>

                <!-- 2. KART: BUGÜN ÖDENECEKLER -->
                <div class="dash-card card-warning">
                    <div class="card-header">
                        <div class="card-icon">💸</div>
                        <div class="card-title">
                            <h3>Bugün Ödenecekler</h3>
                            <span class="card-subtitle">Vadesi Bugün Dolacak Faturalar & Ödemeler</span>
                        </div>
                        <span class="badge ${grandTodayPayable > 0 ? 'badge-danger' : 'badge-success'}">${grandTodayPayable.toLocaleString('tr-TR')} ₺</span>
                    </div>
                    <div class="card-body">
                        ${(todayPayments.length === 0 && todayInvoices.length === 0) ? `
                            <div class="empty-state-mini">Bugün vadesi gelen herhangi bir ödeme yükümlülüğü yoktur.</div>
                        ` : `
                            <div class="mini-payment-list">
                                ${todayPayments.map(p => `
                                    <div class="mini-pay-row">
                                        <div class="pay-main">
                                            <strong>${p.entity}</strong>
                                            <span class="text-muted">${p.category} | ${p.bank || 'Banka Belirtilmedi'}</span>
                                        </div>
                                        <div class="pay-amount">
                                            <span class="amount-val">${p.amount.toLocaleString('tr-TR')} ₺</span>
                                            <button class="btn btn-xs btn-success" onclick="App.markPaymentPaid('${p.id}')">Öde</button>
                                        </div>
                                    </div>
                                `).join('')}
                                ${todayInvoices.map(i => `
                                    <div class="mini-pay-row">
                                        <div class="pay-main">
                                            <strong>${i.company}</strong>
                                            <span class="text-muted">Fatura: ${i.invoiceNo}</span>
                                        </div>
                                        <div class="pay-amount">
                                            <span class="amount-val">${i.totalAmount.toLocaleString('tr-TR')} ₺</span>
                                            <button class="btn btn-xs btn-success" onclick="App.openPayInvoiceModal('${i.id}')">Öde</button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-outline btn-block" onclick="App.switchTab('payments')">Ödeme Listesini Aç</button>
                    </div>
                </div>

                <!-- 3. KART: YARIN YAPILACAKLAR -->
                <div class="dash-card card-info">
                    <div class="card-header">
                        <div class="card-icon">🌅</div>
                        <div class="card-title">
                            <h3>Yarın Yapılacaklar</h3>
                            <span class="card-subtitle">${formatDateDisplay(tomorrowDate)}</span>
                        </div>
                        <span class="badge badge-info">${tomorrowTasks.length} İşlem</span>
                    </div>
                    <div class="card-body">
                        ${tomorrowTasks.length === 0 && tomorrowPayments.length === 0 ? `
                            <div class="empty-state-mini">Yarın için planlanmış özel bir görev veya ödeme bulunmamaktadır.</div>
                        ` : `
                            <ul class="clean-list">
                                ${tomorrowTasks.map(t => `
                                    <li>
                                        <span class="bullet">▪</span>
                                        <div class="list-item-content">
                                            <strong>${t.title}</strong>
                                            <span class="text-muted">${t.category} - ${t.assignedTo}</span>
                                        </div>
                                    </li>
                                `).join('')}
                                ${tomorrowPayments.map(p => `
                                    <li>
                                        <span class="bullet text-danger">▪</span>
                                        <div class="list-item-content">
                                            <strong>Ödeme: ${p.entity}</strong>
                                            <span class="text-danger">${p.amount.toLocaleString('tr-TR')} ₺ (${p.category})</span>
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        `}
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-outline btn-block" onclick="App.changeActiveDate('${tomorrowDate}')">Yarına Git</button>
                    </div>
                </div>

                <!-- 4. KART: BU HAFTA YAPILACAKLAR -->
                <div class="dash-card">
                    <div class="card-header">
                        <div class="card-icon">📅</div>
                        <div class="card-title">
                            <h3>Bu Hafta Yapılacaklar</h3>
                            <span class="card-subtitle">Haftalık Sabit Rutinler ve Ödemeler</span>
                        </div>
                        <span class="badge badge-secondary">${weekTasks.length} Görev</span>
                    </div>
                    <div class="card-body">
                        <div class="routine-highlights">
                            <div class="routine-pill">
                                <strong>Perşembe:</strong> Tedarikçi Ödeme Listesi Hazırlığı & Onay
                            </div>
                            <div class="routine-pill">
                                <strong>Cuma:</strong> Onaylanan Tedarikçi Faturalarının Bankadan Ödenmesi
                            </div>
                        </div>
                        <div class="mini-stat-row mt-3">
                            <div>
                                <span class="stat-label">Haftalık Ödeme Toplamı:</span>
                                <span class="stat-value text-primary">${weekPaymentTotal.toLocaleString('tr-TR')} ₺</span>
                            </div>
                            <div>
                                <span class="stat-label">Bekleyen Görev:</span>
                                <span class="stat-value">${weekTasks.length} Adet</span>
                            </div>
                        </div>
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-outline btn-block" onclick="App.switchTab('calendar')">Haftalık Takvime Git</button>
                    </div>
                </div>

                <!-- 5. KART: GECİKEN İŞLER & ÖDEMELER -->
                <div class="dash-card ${overdueTasks.length > 0 || overdueInvoices.length > 0 ? 'card-danger highlight-danger' : ''}">
                    <div class="card-header">
                        <div class="card-icon">🔴</div>
                        <div class="card-title">
                            <h3>Geciken İşler</h3>
                            <span class="card-subtitle">Vadesi Geçtiği Halde Kapanmayan Kayıtlar</span>
                        </div>
                        <span class="badge badge-danger">${overdueTasks.length + overdueInvoices.length} Kayıt</span>
                    </div>
                    <div class="card-body">
                        ${overdueTasks.length === 0 && overdueInvoices.length === 0 ? `
                            <div class="empty-state-mini text-success">🎉 Harika! Geciken hiçbir görev veya ödeme bulunmuyor.</div>
                        ` : `
                            <div class="overdue-list">
                                ${overdueInvoices.map(i => `
                                    <div class="overdue-item">
                                        <div class="overdue-meta">
                                            <strong>${i.company}</strong>
                                            <span class="text-danger">Vade: ${i.dueDate} (Gecikti)</span>
                                        </div>
                                        <span class="badge badge-danger">${i.totalAmount.toLocaleString('tr-TR')} ₺</span>
                                    </div>
                                `).join('')}
                                ${overdueTasks.map(t => `
                                    <div class="overdue-item">
                                        <div class="overdue-meta">
                                            <strong>${t.title}</strong>
                                            <span class="text-muted">Son Tarih: ${t.dueDate}</span>
                                        </div>
                                        <button class="btn btn-xs btn-outline" onclick="App.toggleTask('${t.id}')">Tamamla</button>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-outline btn-block" onclick="App.switchTab('invoices', { filterStatus: 'Gecikti' })">Geciken Faturaları Çöz</button>
                    </div>
                </div>

                <!-- 6. KART: YAKLAŞAN ÖDEMELER (7 VE 30 GÜN) -->
                <div class="dash-card">
                    <div class="card-header">
                        <div class="card-icon">📊</div>
                        <div class="card-title">
                            <h3>Yaklaşan Ödemeler</h3>
                            <span class="card-subtitle">Nakit Akışı ve Çıkış Projeksiyonu</span>
                        </div>
                        <span class="badge badge-primary">Nakit Çıkışı</span>
                    </div>
                    <div class="card-body">
                        <div class="cash-projection-grid">
                            <div class="projection-box">
                                <span class="proj-title">Gelecek 7 Gün</span>
                                <span class="proj-val text-primary">${total7DaysPayable.toLocaleString('tr-TR')} ₺</span>
                                <span class="proj-sub">${upcoming7Payments.length + upcoming7Invoices.length} Adet Ödeme/Fatura</span>
                            </div>
                            <div class="projection-box">
                                <span class="proj-title">Gelecek 30 Gün</span>
                                <span class="proj-val text-dark">${total30DaysPayable.toLocaleString('tr-TR')} ₺</span>
                                <span class="proj-sub">Maaş, Vergi, Tedarikçi, SGK</span>
                            </div>
                        </div>
                        <div class="quick-breakdown mt-2">
                            <small class="text-muted">💡 Maaş (10'u), Avans (25'i), Tedarikçi (Cuma) ve Yasal Vergiler takvime göre hesaplanır.</small>
                        </div>
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-outline btn-block" onclick="App.switchTab('reports')">Detaylı Finans Raporuna Git</button>
                    </div>
                </div>

                <!-- 7. KART: YAKLAŞAN VERGİLER & SGK -->
                <div class="dash-card card-purple">
                    <div class="card-header">
                        <div class="card-icon">🏛️</div>
                        <div class="card-title">
                            <h3>Yaklaşan Vergiler</h3>
                            <span class="card-subtitle">2026 Resmi GİB & SGK Takvimi</span>
                        </div>
                        <span class="badge badge-purple">${upcomingTaxes.length} Vergi</span>
                    </div>
                    <div class="card-body">
                        ${!nextTax ? `
                            <div class="empty-state-mini">Bu dönem için yaklaşan vergi yükümlülüğü bulunmuyor.</div>
                        ` : `
                            <div class="next-tax-card">
                                <div class="tax-badge-row">
                                    <span class="badge badge-warning">EN YAKIN VERGİ</span>
                                    <span class="days-left-pill ${getDayDifference(activeDate, nextTax.dueDate) <= 5 ? 'critical' : ''}">
                                        ${getDayDifferenceText(activeDate, nextTax.dueDate)}
                                    </span>
                                </div>
                                <h4 class="mt-2 mb-1">${nextTax.type}</h4>
                                <div class="tax-details-grid">
                                    <div><span>Dönem:</span> <strong>${nextTax.period}</strong></div>
                                    <div><span>Beyanname:</span> <strong>${nextTax.declDate}</strong></div>
                                    <div><span>Son Ödeme:</span> <strong class="text-danger">${nextTax.dueDate}</strong></div>
                                    <div><span>Tahmini Tutar:</span> <strong>${nextTax.estAmount.toLocaleString('tr-TR')} ₺</strong></div>
                                </div>
                                <div class="advisor-check-status mt-2">
                                    <span>Mali Müşavir Kontrolü: </span>
                                    ${nextTax.advisorChecked ? '<strong class="text-success">✓ Onaylandı</strong>' : '<strong class="text-warning">⏳ Ziyarette Görüşülecek</strong>'}
                                </div>
                            </div>
                        `}
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-outline btn-block" onclick="App.switchTab('taxes')">Vergi & SGK Takvimini Aç</button>
                    </div>
                </div>

                <!-- 8. KART: MALİ MÜŞAVİR ZİYARETİ (8'İ VE 21'İ) -->
                <div class="dash-card card-teal">
                    <div class="card-header">
                        <div class="card-icon">🤝</div>
                        <div class="card-title">
                            <h3>Mali Müşavir Ziyareti</h3>
                            <span class="card-subtitle">Her Ayın 8'i ve 21'i</span>
                        </div>
                        <span class="badge badge-teal">${todayVisit ? 'BUGÜN ZİYARET VAR' : 'Planlı'}</span>
                    </div>
                    <div class="card-body">
                        ${todayVisit ? `
                            <div class="advisor-today-alert">
                                <span class="advisor-ping">🟢</span>
                                <div>
                                    <strong>BUGÜN MALİ MÜŞAVİR ZİYARET GÜNÜ!</strong>
                                    <p class="mb-1 text-sm">${todayVisit.purpose}</p>
                                    <span class="text-xs text-muted">Durum: <strong>${todayVisit.status}</strong></span>
                                </div>
                            </div>
                            <div class="mt-2 text-center">
                                <button class="btn btn-teal btn-sm btn-block" onclick="App.openAdvisorDetailModal('${todayVisit.id}')">Ziyaret Hazırlık Listesini Aç</button>
                            </div>
                        ` : (nextVisit ? `
                            <div class="advisor-upcoming-info">
                                <span class="text-muted">Bir Sonraki Ziyaret:</span>
                                <h4>${formatDateDisplay(nextVisit.date)}</h4>
                                <p class="text-sm text-muted">${nextVisit.purpose}</p>
                                <span class="badge badge-outline">${getDayDifferenceText(activeDate, nextVisit.date)}</span>
                            </div>
                            <div class="mt-2 text-center">
                                <button class="btn btn-outline btn-sm btn-block" onclick="App.openAdvisorDetailModal('${nextVisit.id}')">Hazırlanacak Evrakları Gör</button>
                            </div>
                        ` : `
                            <div class="empty-state-mini">Planlanmış aktif ziyaret bulunmuyor.</div>
                        `)}
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-outline btn-block" onclick="App.switchTab('advisor')">Mali Müşavir Modülünü Aç</button>
                    </div>
                </div>

                <!-- 9. KART: BEKLEYEN ONAYLAR -->
                <div class="dash-card">
                    <div class="card-header">
                        <div class="card-icon">✍️</div>
                        <div class="card-title">
                            <h3>Bekleyen Onaylar</h3>
                            <span class="card-subtitle">Yönetici & Bordro Onay Süreçleri</span>
                        </div>
                        <span class="badge ${pendingApprovals.length > 0 ? 'badge-warning' : 'badge-secondary'}">${pendingApprovals.length} Onay</span>
                    </div>
                    <div class="card-body">
                        ${pendingApprovals.length === 0 ? `
                            <div class="empty-state-mini">Şu an onay bekleyen herhangi bir ödeme listesi veya işlem bulunmamaktadır.</div>
                        ` : `
                            <ul class="clean-list">
                                ${pendingApprovals.map(p => `
                                    <li>
                                        <span class="bullet text-warning">▪</span>
                                        <div class="list-item-content">
                                            <strong>${p.entity || p.title}</strong>
                                            <span class="text-muted">${p.amount ? p.amount.toLocaleString('tr-TR') + ' ₺' : p.category}</span>
                                        </div>
                                        <button class="btn btn-xs btn-success" onclick="App.approveItem('${p.id}')">Onayla</button>
                                    </li>
                                `).join('')}
                            </ul>
                        `}
                        <div class="approval-note-box mt-3">
                            <small class="text-muted">📌 Perşembe günleri hazırlanan Cuma Tedarikçi Ödeme Listesi doğrudan burada Yönetici onayına sunulur.</small>
                        </div>
                    </div>
                    <div class="card-footer">
                        <button class="btn btn-outline btn-block" onclick="App.openThursdayListModal()">Haftalık Ödeme Listesini Gözden Geçir</button>
                    </div>
                </div>

            </div>
        `;
    }

    // Yardımcı Tarih Fonksiyonları
    function getOffsetDate(baseIsoStr, days) {
        const parts = baseIsoStr.split('-');
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
    }

    function getWeekDates(baseIsoStr) {
        const parts = baseIsoStr.split('-');
        const curr = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const day = curr.getDay();
        const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Pazartesi
        const monday = new Date(curr.setDate(diff));
        
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const next = new Date(monday);
            next.setDate(monday.getDate() + i);
            dates.push(next.toISOString().slice(0, 10));
        }
        return dates;
    }

    function getUpcomingDates(baseIsoStr, count) {
        const dates = [];
        for (let i = 1; i <= count; i++) {
            dates.push(getOffsetDate(baseIsoStr, i));
        }
        return dates;
    }

    function getDayDifference(dateStr1, dateStr2) {
        const d1 = new Date(dateStr1);
        const d2 = new Date(dateStr2);
        const diffTime = d2 - d1;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    function getDayDifferenceText(dateStr1, dateStr2) {
        const diff = getDayDifference(dateStr1, dateStr2);
        if (diff === 0) return "BUGÜN SON GÜN!";
        if (diff === 1) return "YARIN";
        if (diff < 0) return `${Math.abs(diff)} GÜN GECİKTİ`;
        return `${diff} gün kaldı`;
    }

    return {
        render,
        formatDateDisplay
    };
})();
