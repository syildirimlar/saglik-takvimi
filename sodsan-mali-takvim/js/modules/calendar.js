/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Gerçek 2026 İnteraktif Takvim Modülü - Aylık Görünüm, Renkli Rozetler ve Gün Detayı
 */

const CalendarModule = (function() {

    let currentYear = 2026;
    let currentMonth = 9; // 0-indexed, 9 = Ekim (October)
    let selectedDate = null;
    let isSidePaneOpen = true;

    const MONTH_NAMES = [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ];

    const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

    function getISOWeekNumber(d) {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    }

    function formatTaxBadge(tax, iso) {
        const isDecl = (tax.declDate === iso);
        const isDue = (tax.dueDate === iso);
        const isSgk = tax.type.includes("SGK");
        let label = "";
        let badgeClass = isSgk ? "badge-sgk" : "badge-tax";

        if (isSgk) {
            label = (isDecl && isDue) ? "👥 SGK Beyan/Ödeme" : (isDecl ? "👥 SGK Bildirge" : "👥 SGK Prim Ödeme");
        } else if (tax.type.includes("Muhtasar")) {
            label = "📑 MPHB (Muhtasar)";
        } else if (tax.type.includes("KDV")) {
            label = "🏛️ KDV 1-2";
        } else if (tax.type.includes("Geçici")) {
            label = "📊 Geçici Vergi";
        } else if (tax.type.includes("Kurumlar")) {
            label = "🏛️ Kurumlar V.";
        } else if (tax.type.includes("Damga")) {
            label = "📜 Damga Vergisi";
        } else if (tax.type.includes("Tasdik")) {
            label = "⚖️ Defter Tasdiki";
        } else {
            label = "🏛️ " + tax.type.slice(0, 14);
        }

        const roleText = (isDecl && isDue) ? "Beyan ve Son Ödeme" : (isDecl ? "Beyanname Son Günü" : "Son Ödeme Günü");
        return `<span class="event-badge ${badgeClass}" title="${tax.type} (${tax.period}) - ${roleText}">${label}</span>`;
    }

    function init(year, month) {
        const realToday = SODSAN_DB.getRealToday();
        const activeDate = SODSAN_DB.getActiveDate() || realToday;
        selectedDate = selectedDate || activeDate;
        isSidePaneOpen = false; // Başlangıçta takvim tam ekran genişliğinde ve ferah açılsın
        
        if (year !== undefined && month !== undefined) {
            currentYear = year;
            currentMonth = month;
        } else {
            const parts = (selectedDate || activeDate).split('-');
            currentYear = parseInt(parts[0], 10);
            currentMonth = parseInt(parts[1], 10) - 1;
        }
    }

    function render(targetContainerId = "calendarView") {
        const container = document.getElementById(targetContainerId);
        if (!container) return;

        const allTasks = SODSAN_DB.getAllTasks();
        const allPayments = SODSAN_DB.getPayments();
        const allInvoices = SODSAN_DB.getInvoices();
        const allTaxes = SODSAN_DB.getTaxes();
        const activeSystemDate = SODSAN_DB.getActiveDate();
        const realToday = SODSAN_DB.getRealToday();

        if (!selectedDate) {
            selectedDate = activeSystemDate || realToday;
        }

        // Ayın ilk günü ve toplam gün sayısı
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        let startingDay = firstDayOfMonth.getDay() - 1; // 0 = Pazartesi
        if (startingDay === -1) startingDay = 6; // Pazar ise 6

        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

        // Gün hücreleri dizisi
        const calendarCells = [];

        // Önceki ayın günleri
        for (let i = startingDay - 1; i >= 0; i--) {
            const pDate = new Date(currentYear, currentMonth - 1, daysInPrevMonth - i);
            const pIso = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;
            calendarCells.push({
                day: daysInPrevMonth - i,
                isCurrentMonth: false,
                isPrev: true,
                isoDate: pIso
            });
        }

        // Bu ayın günleri
        for (let day = 1; day <= daysInMonth; day++) {
            const mStr = String(currentMonth + 1).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            const iso = `${currentYear}-${mStr}-${dStr}`;

            // O güne ait olaylar: Vergi, Beyanname, Ödeme, Görev
            const dayTasks = allTasks.filter(t => t.date === iso);
            const dayPayments = allPayments.filter(p => p.dueDate === iso);
            const dayInvoices = allInvoices.filter(i => i.dueDate === iso);
            const dayTaxes = allTaxes.filter(t => t.dueDate === iso || t.declDate === iso);

            const isToday = (iso === realToday);
            const isSelected = (iso === selectedDate);
            const isActiveDate = (iso === activeSystemDate && activeSystemDate !== realToday);
            const isPast = (iso < realToday);

            calendarCells.push({
                day: day,
                isCurrentMonth: true,
                isoDate: iso,
                tasks: dayTasks,
                payments: dayPayments,
                invoices: dayInvoices,
                taxes: dayTaxes,
                isToday: isToday,
                isSelected: isSelected,
                isActiveDate: isActiveDate,
                isPast: isPast
            });
        }

        // Sonraki ayın günleri (42 hücreye tamamlamak için)
        const remaining = 42 - calendarCells.length;
        for (let i = 1; i <= remaining; i++) {
            const nDate = new Date(currentYear, currentMonth + 1, i);
            const nIso = `${nDate.getFullYear()}-${String(nDate.getMonth() + 1).padStart(2, '0')}-${String(nDate.getDate()).padStart(2, '0')}`;
            calendarCells.push({
                day: i,
                isCurrentMonth: false,
                isNext: true,
                isoDate: nIso
            });
        }

        // Seçili günün olayları
        const selectedDayEvents = getEventsForDate(selectedDate);

        container.innerHTML = `
            <div class="calendar-wrapper">
                
                <!-- SOL ANA TAKVİM IZGARASI -->
                <div class="calendar-main-pane">
                    
                    <!-- TAKVİM ÜST BAR (AY GEÇİŞLERİ VE GÜN DETAYI) -->
                    <div class="cal-header">
                        <div class="cal-nav-group">
                            <button class="btn btn-outline btn-sm" onclick="CalendarModule.prevMonth()">◀ Önceki Ay</button>
                            <h3 class="cal-title">${MONTH_NAMES[currentMonth]} ${currentYear}</h3>
                            <button class="btn btn-outline btn-sm" onclick="CalendarModule.nextMonth()">Sonraki Ay ▶</button>
                            <button class="btn btn-primary btn-sm ml-1" onclick="CalendarModule.jumpToToday()">Bugüne Git</button>
                            <button class="btn btn-outline btn-sm ml-1" onclick="CalendarModule.toggleSidePane()" title="Seçili günün işlem ve vergi detaylarını aç/kapat">
                                📋 Gün Detayı (${DashboardModule.formatDateDisplay(selectedDate)})
                            </button>
                        </div>

                        <!-- RENK KODU LEJANTI (Section 11) -->
                        <div class="cal-legend">
                            <span class="legend-item"><span class="legend-dot dot-red"></span> Vergi</span>
                            <span class="legend-item"><span class="legend-dot dot-purple"></span> SGK</span>
                            <span class="legend-item"><span class="legend-dot dot-green"></span> Maaş/Avans</span>
                            <span class="legend-item"><span class="legend-dot dot-blue"></span> Tedarikçi</span>
                            <span class="legend-item"><span class="legend-dot dot-orange"></span> Kredi Kartı</span>
                            <span class="legend-item"><span class="legend-dot dot-teal"></span> Mali Müşavir</span>
                            <span class="legend-item"><span class="legend-dot dot-ges"></span> GES (7 & 16)</span>
                            <span class="legend-item"><span class="legend-dot dot-electric"></span> Elektrik (15 & 26)</span>
                            <span class="legend-item"><span class="legend-dot dot-water"></span> Su (22)</span>
                            <span class="legend-item"><span class="legend-dot dot-phone"></span> Telefon/GSM (16 & 19)</span>
                            <span class="legend-item"><span class="legend-dot dot-indigo"></span> Fatura</span>
                        </div>
                    </div>

                    <!-- GÜN İSİMLERİ -->
                    <div class="cal-grid-header">
                        <div class="cal-day-name" style="font-weight: 800; color: #64748b;" title="Hafta Numarası (ISO 8601)">Hf</div>
                        ${DAY_NAMES.map(d => `<div class="cal-day-name">${d}</div>`).join('')}
                    </div>

                    <!-- GÜN HÜCRELERİ (8x6) -->
                    <div class="cal-grid">
                        ${[0, 1, 2, 3, 4, 5].map(w => {
                            const weekRow = calendarCells.slice(w * 7, (w + 1) * 7);
                            const monIso = weekRow[0].isoDate;
                            let weekNum = 1;
                            let isCurWeek = false;
                            if (monIso) {
                                const monParts = monIso.split('-');
                                const monDate = new Date(parseInt(monParts[0], 10), parseInt(monParts[1], 10) - 1, parseInt(monParts[2], 10));
                                weekNum = getISOWeekNumber(monDate);
                                const realNow = new Date();
                                const curWeekNum = getISOWeekNumber(realNow);
                                isCurWeek = (weekNum === curWeekNum && monDate.getFullYear() === realNow.getFullYear());
                            }

                            const weekHtml = `
                                <div class="cal-week-cell ${isCurWeek ? 'cell-current-week' : ''}" title="${weekNum}. Hafta">
                                    <span class="week-label">HF</span>
                                    <span class="week-num">${weekNum}</span>
                                </div>
                            `;

                            const daysHtml = weekRow.map(cell => {
                                if (!cell.isCurrentMonth) {
                                    return `<div class="cal-cell cell-muted"><span class="cell-num">${cell.day}</span></div>`;
                                }

                                const hasEvents = (cell.tasks.length > 0 || cell.payments.length > 0 || cell.taxes.length > 0);
                                const isPast = (cell.isoDate < realToday);

                                return `
                                    <div class="cal-cell ${cell.isToday ? 'cell-today' : ''} ${cell.isSelected ? 'cell-selected' : ''} ${isPast ? 'cell-past' : ''}" onclick="CalendarModule.selectDate('${cell.isoDate}')">
                                        <div class="cell-top">
                                            <span class="cell-num">${cell.day}</span>
                                            ${cell.isToday ? '<span class="today-tag">BUGÜN</span>' : (cell.isActiveDate ? '<span class="today-tag" style="background:#f59e0b;">SEÇİLİ</span>' : '')}
                                        </div>
                                        <div class="cell-badges">
                                            ${(cell.taxes || []).map(t => formatTaxBadge(t, cell.isoDate)).join('')}
                                            ${(cell.tasks || []).slice(0, 2).map(t => {
                                                const catClass = getCategoryBadgeClass(t.category);
                                                return `
                                                    <span class="event-badge ${catClass}" title="${t.title}">
                                                        ${t.title.slice(0, 18)}..
                                                    </span>
                                                `;
                                            }).join('')}
                                            ${(cell.tasks && cell.tasks.length > 2) ? `
                                                <span class="event-badge badge-more">+${cell.tasks.length - 2} görev</span>
                                            ` : ''}
                                            ${(cell.payments || []).map(p => `
                                                <span class="event-badge badge-payment" title="Ödeme: ${p.entity}">
                                                    💸 ${(p.amount || 0).toLocaleString('tr-TR')} ₺
                                                </span>
                                            `).join('')}
                                        </div>
                                    </div>
                                `;
                            }).join('');

                            return weekHtml + daysHtml;
                        }).join('')}
                    </div>
                </div>

                <!-- BACKDROP (MOBİL & DAR EKRAN İÇİN) -->
                <div class="side-pane-backdrop ${isSidePaneOpen ? '' : 'backdrop-hidden'}" onclick="CalendarModule.closeSidePane()"></div>

                <!-- SAĞ PANEL: SEÇİLEN GÜNÜN DETAYI (Section 11) -->
                <div class="calendar-side-pane ${isSidePaneOpen ? '' : 'pane-closed'}" id="calendarSidePane">
                    <div class="side-pane-header">
                        <div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span class="text-xs text-muted">SEÇİLEN GÜN</span>
                                <span class="badge badge-primary" style="font-size:10px; padding:2px 6px;">${selectedDayEvents.length} Kayıt</span>
                            </div>
                            <h4 style="margin:2px 0 0 0; font-size:15px;">${DashboardModule.formatDateDisplay(selectedDate)}</h4>
                        </div>
                        <div class="side-pane-header-actions" style="display:flex; gap:6px; align-items:center;">
                            <button class="btn btn-primary btn-xs" onclick="App.openQuickTaskModal('${selectedDate}')">+ Görev</button>
                            <button class="btn btn-outline btn-xs" onclick="CalendarModule.closeSidePane()" title="Paneli Kapat" style="font-weight:bold; font-size:12px; padding:3px 7px;">✕ Kapat</button>
                        </div>
                    </div>

                    <div class="side-pane-body">
                        ${selectedDayEvents.length === 0 ? `
                            <div class="empty-state-mini text-center py-4">
                                <div style="font-size:32px; margin-bottom:8px;">📅</div>
                                <div style="font-weight:600; color:var(--text-muted); margin-bottom:6px;">Kayıt Bulunmuyor</div>
                                <p class="text-xs text-muted">Bu gün için tanımlı vergi, SGK beyanı, ödeme veya görev bulunmamaktadır.</p>
                                <button class="btn btn-outline btn-sm mt-3" onclick="App.openQuickTaskModal('${selectedDate}')">+ Bu Güne Görev Ekle</button>
                            </div>
                        ` : `
                            <div class="day-events-list">
                                ${selectedDayEvents.map(ev => {
                                    if (ev.type === 'TAX') {
                                        const t = ev.taxObj;
                                        const isSgk = t.type.includes("SGK");
                                        const cardClass = isSgk ? "card-sgk-duty" : "card-tax-duty";
                                        const isDone = t.paid && t.declSubmitted;
                                        return `
                                            <div class="day-event-card ${cardClass} ${isDone ? 'event-done' : ''}">
                                                <div class="event-header-row">
                                                    <span class="category-badge ${isSgk ? 'badge-sgk' : 'badge-tax'}">
                                                        ${isSgk ? '👥 SGK Yükümlülüğü' : '🏛️ Vergi Yükümlülüğü'}
                                                    </span>
                                                    <span class="badge ${ev.statusBadgeClass}">${ev.status}</span>
                                                </div>
                                                <h5 class="event-title mt-1 ${isDone ? 'strike' : ''}">${t.type} (${t.period})</h5>
                                                
                                                <div style="font-size:11.5px; margin:4px 0 6px 0; padding:4px 8px; background:rgba(0,0,0,0.03); border-radius:4px; font-weight:600; color:${ev.isDueDay ? '#dc2626' : '#2563eb'};">
                                                    📌 ${ev.roleDesc}
                                                </div>

                                                <div class="tax-checklist-box">
                                                    <div class="tax-check-row">
                                                        <span>1. Beyanname / Bildirge:</span>
                                                        <span style="font-weight:600; color:${t.declSubmitted ? '#16a34a' : '#ea580c'};">
                                                            ${t.declSubmitted ? '✓ Verildi' : '⏳ Verilmedi'}
                                                        </span>
                                                    </div>
                                                    <div class="tax-check-row">
                                                        <span>2. Banka Ödemesi:</span>
                                                        <span style="font-weight:600; color:${t.paid ? '#16a34a' : '#dc2626'};">
                                                            ${t.paid ? '✓ Ödendi' : '⏳ Ödenmedi'}
                                                        </span>
                                                    </div>
                                                    <div class="tax-check-row">
                                                        <span>3. Mali Müşavir Kontrolü:</span>
                                                        <span style="font-weight:600; color:${t.advisorChecked ? '#16a34a' : '#64748b'};">
                                                            ${t.advisorChecked ? '✓ Teyit Edildi' : 'Bekliyor'}
                                                        </span>
                                                    </div>
                                                    <div style="border-top:1px dashed var(--border); margin-top:4px; padding-top:4px; font-size:11px; color:var(--text-muted);">
                                                        Beyanname: <strong>${t.declDate}</strong> | Son Ödeme: <strong>${t.dueDate}</strong>
                                                    </div>
                                                </div>

                                                ${ev.amount ? `<div class="event-amount text-danger font-bold mt-2">${ev.amount.toLocaleString('tr-TR')} ₺</div>` : ''}

                                                <div class="tax-action-btns">
                                                    <button class="btn btn-xs ${t.declSubmitted ? 'btn-outline' : 'btn-primary'}" onclick="App.toggleTaxDeclaration('${t.id}')">
                                                        ${t.declSubmitted ? '↩ Beyan Geri Al' : '✓ Beyanname Verildi'}
                                                    </button>
                                                    <button class="btn btn-xs ${t.paid ? 'btn-outline' : 'btn-success'}" onclick="App.toggleTaxPayment('${t.id}')">
                                                        ${t.paid ? '↩ Ödeme Geri Al' : '💸 Ödeme Yapıldı'}
                                                    </button>
                                                    <button class="btn btn-xs ${t.advisorChecked ? 'btn-outline' : 'btn-secondary'}" onclick="App.toggleTaxAdvisor('${t.id}')">
                                                        ${t.advisorChecked ? '↩ Müşavir Geri Al' : '📋 Müşavir Onay'}
                                                    </button>
                                                </div>
                                            </div>
                                        `;
                                    }

                                    return `
                                        <div class="day-event-card ${ev.isDone ? 'event-done' : ''}">
                                            <div class="event-header-row">
                                                <span class="category-badge ${ev.badgeClass}">${ev.category}</span>
                                                <span class="badge ${ev.statusBadgeClass}">${ev.status}</span>
                                            </div>
                                            <h5 class="event-title mt-1 ${ev.isDone ? 'strike' : ''}">${ev.title}</h5>
                                            ${ev.description ? `<p class="event-desc text-xs text-muted">${ev.description}</p>` : ''}
                                            ${ev.amount ? `<div class="event-amount text-danger font-bold">${ev.amount.toLocaleString('tr-TR')} ₺</div>` : ''}
                                            <div class="event-actions mt-2">
                                                ${ev.type === 'TASK' ? `
                                                    <button class="btn btn-xs ${ev.isDone ? 'btn-outline' : 'btn-success'}" onclick="App.toggleTask('${ev.id}')">
                                                        ${ev.isDone ? 'Geri Al' : '✓ Tamamla'}
                                                    </button>
                                                ` : ''}
                                                ${ev.type === 'PAYMENT' && !ev.isDone ? `
                                                    <button class="btn btn-xs btn-success" onclick="App.markPaymentPaid('${ev.id}')">
                                                        Öde
                                                    </button>
                                                ` : ''}
                                                ${ev.type === 'INVOICE' && !ev.isDone ? `
                                                    <button class="btn btn-xs btn-outline" onclick="App.navigateTo('invoices')">
                                                        Faturalarda Gör
                                                    </button>
                                                ` : ''}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}
                    </div>
                </div>

            </div>
        `;
    }

    function getEventsForDate(dateStr) {
        const events = [];
        const tasks = SODSAN_DB.getAllTasks().filter(t => t.date === dateStr);
        const payments = SODSAN_DB.getPayments().filter(p => p.dueDate === dateStr);
        const invoices = SODSAN_DB.getInvoices().filter(i => i.dueDate === dateStr);
        const taxes = SODSAN_DB.getTaxes().filter(t => t.dueDate === dateStr || t.declDate === dateStr);

        taxes.forEach(t => {
            const isDecl = (t.declDate === dateStr);
            const isDue = (t.dueDate === dateStr);
            let roleDesc = "";
            if (isDecl && isDue) {
                roleDesc = "Beyanname ve Son Ödeme Günü";
            } else if (isDecl) {
                roleDesc = "Beyanname / Bildirge Son Günü";
            } else {
                roleDesc = "Son Ödeme Günü";
            }
            const isSgk = t.type.includes("SGK");

            events.push({
                type: 'TAX',
                id: t.id,
                taxObj: t,
                title: `${t.type} (${t.period})`,
                category: isSgk ? "SGK" : "Vergi",
                badgeClass: isSgk ? "badge-sgk" : "badge-tax",
                status: t.paid ? "Ödendi" : (t.declSubmitted ? "Beyan Edildi" : "Bekliyor"),
                statusBadgeClass: t.paid ? "badge-success" : (t.declSubmitted ? "badge-info" : "badge-danger"),
                isDone: t.paid && t.declSubmitted,
                amount: t.estAmount,
                roleDesc: roleDesc,
                isDeclDay: isDecl,
                isDueDay: isDue,
                description: `Beyanname Son: ${t.declDate} | Son Ödeme: ${t.dueDate} | Müşavir: ${t.advisorChecked ? 'Kontrol Edildi' : 'Bekliyor'}`
            });
        });

        tasks.forEach(t => {
            if (t.id && t.id.startsWith("TAX_TASK_")) {
                const taxId = t.id.replace("TAX_TASK_", "");
                if (taxes.some(tax => tax.id === taxId)) {
                    return; // Skip duplicate generic tax task
                }
            }
            events.push({
                type: 'TASK',
                id: t.id,
                title: t.title,
                category: t.category,
                badgeClass: getCategoryBadgeClass(t.category),
                status: t.status,
                statusBadgeClass: t.status === "Tamamlandı" ? "badge-success" : "badge-secondary",
                isDone: t.status === "Tamamlandı",
                amount: t.amount,
                description: t.description
            });
        });

        payments.forEach(p => {
            events.push({
                type: 'PAYMENT',
                id: p.id,
                title: `Ödeme: ${p.entity}`,
                category: p.category,
                badgeClass: getCategoryBadgeClass(p.category),
                status: p.status,
                statusBadgeClass: p.status === "Ödendi" ? "badge-success" : "badge-danger",
                isDone: p.status === "Ödendi",
                amount: p.amount,
                description: `${p.bank || ''} ${p.account || ''} - ${p.description || ''}`
            });
        });

        invoices.forEach(i => {
            events.push({
                type: 'INVOICE',
                id: i.id,
                title: `Fatura Vadesi: ${i.company}`,
                category: "Fatura",
                badgeClass: "badge-invoice",
                status: i.status,
                statusBadgeClass: i.status === "Ödendi" ? "badge-success" : "badge-warning",
                isDone: i.status === "Ödendi",
                amount: i.totalAmount,
                description: `Fatura No: ${i.invoiceNo} - ${i.description || ''}`
            });
        });

        return events;
    }

    function getCategoryBadgeClass(category) {
        if (!category) return "badge-secondary";
        const c = category.toLowerCase();
        if (c.includes("vergi")) return "badge-tax";
        if (c.includes("sgk")) return "badge-sgk";
        if (c.includes("maaş") || c.includes("avans")) return "badge-payroll";
        if (c.includes("tedarikçi")) return "badge-supplier";
        if (c.includes("kredi kart")) return "badge-card";
        if (c.includes("mali müşavir")) return "badge-teal";
        if (c.includes("ges") || c.includes("enerji")) return "badge-ges";
        if (c.includes("elektrik") || c.includes("uedaş") || c.includes("uedas")) return "badge-electric";
        if (c.includes("su")) return "badge-water";
        if (c.includes("telefon") || c.includes("vodafone") || c.includes("iletişim")) return "badge-phone";
        if (c.includes("fatura")) return "badge-invoice";
        return "badge-secondary";
    }

    function prevMonth() {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        render();
    }

    function nextMonth() {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        render();
    }

    function selectDate(isoDateStr) {
        selectedDate = isoDateStr;
        isSidePaneOpen = true;
        render();
    }

    function closeSidePane() {
        isSidePaneOpen = false;
        render();
    }

    function openSidePane() {
        isSidePaneOpen = true;
        render();
    }

    function toggleSidePane() {
        isSidePaneOpen = !isSidePaneOpen;
        render();
    }

    function jumpToToday() {
        const realToday = SODSAN_DB.getRealToday();
        selectedDate = realToday;
        SODSAN_DB.setActiveDate(realToday);
        const parts = realToday.split('-');
        currentYear = parseInt(parts[0], 10);
        currentMonth = parseInt(parts[1], 10) - 1;
        render();
        if (typeof App !== 'undefined' && App.refresh) {
            App.refresh();
        }
    }

    return {
        init,
        render,
        prevMonth,
        nextMonth,
        selectDate,
        closeSidePane,
        openSidePane,
        toggleSidePane,
        jumpToToday
    };
})();
