/**
 * SODSAN Mali İşler ve Muhasebe Takip Sistemi
 * Gerçek 2026 İnteraktif Takvim Modülü - Aylık Görünüm, Renkli Rozetler ve Gün Detayı
 */

const CalendarModule = (function() {

    let currentYear = 2026;
    let currentMonth = 9; // 0-indexed, 9 = Ekim (October)
    let selectedDate = "2026-10-21";

    const MONTH_NAMES = [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ];

    const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

    function init(year, month) {
        if (year !== undefined) currentYear = year;
        if (month !== undefined) currentMonth = month;
        const activeDate = SODSAN_DB.getActiveDate();
        if (activeDate) {
            selectedDate = activeDate;
            const parts = activeDate.split('-');
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
            calendarCells.push({
                day: daysInPrevMonth - i,
                isCurrentMonth: false,
                isPrev: true,
                isoDate: ""
            });
        }

        // Bu ayın günleri
        for (let day = 1; day <= daysInMonth; day++) {
            const mStr = String(currentMonth + 1).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            const iso = `${currentYear}-${mStr}-${dStr}`;

            // O güne ait olaylar
            const dayTasks = allTasks.filter(t => t.date === iso);
            const dayPayments = allPayments.filter(p => p.dueDate === iso);
            const dayInvoices = allInvoices.filter(i => i.dueDate === iso);
            const dayTaxes = allTaxes.filter(t => t.dueDate === iso);

            calendarCells.push({
                day: day,
                isCurrentMonth: true,
                isoDate: iso,
                tasks: dayTasks,
                payments: dayPayments,
                invoices: dayInvoices,
                taxes: dayTaxes,
                isToday: (iso === activeSystemDate),
                isSelected: (iso === selectedDate)
            });
        }

        // Sonraki ayın günleri (42 hücreye tamamlamak için)
        const remaining = 42 - calendarCells.length;
        for (let i = 1; i <= remaining; i++) {
            calendarCells.push({
                day: i,
                isCurrentMonth: false,
                isNext: true,
                isoDate: ""
            });
        }

        // Seçili günün olayları
        const selectedDayEvents = getEventsForDate(selectedDate);

        container.innerHTML = `
            <div class="calendar-wrapper">
                
                <!-- SOL ANA TAKVİM IZGARASI -->
                <div class="calendar-main-pane">
                    
                    <!-- TAKVİM ÜST BAR (AY GEÇİŞLERİ) -->
                    <div class="cal-header">
                        <div class="cal-nav-group">
                            <button class="btn btn-outline btn-sm" onclick="CalendarModule.prevMonth()">◀ Önceki Ay</button>
                            <h3 class="cal-title">${MONTH_NAMES[currentMonth]} ${currentYear}</h3>
                            <button class="btn btn-outline btn-sm" onclick="CalendarModule.nextMonth()">Sonraki Ay ▶</button>
                            <button class="btn btn-primary btn-sm ml-2" onclick="CalendarModule.jumpToToday()">Bugüne Git</button>
                        </div>

                        <!-- RENK KODU LEJANTI (Section 11) -->
                        <div class="cal-legend">
                            <span class="legend-item"><span class="legend-dot dot-red"></span> Vergi</span>
                            <span class="legend-item"><span class="legend-dot dot-purple"></span> SGK</span>
                            <span class="legend-item"><span class="legend-dot dot-green"></span> Maaş/Avans</span>
                            <span class="legend-item"><span class="legend-dot dot-blue"></span> Tedarikçi</span>
                            <span class="legend-item"><span class="legend-dot dot-orange"></span> Kredi Kartı</span>
                            <span class="legend-item"><span class="legend-dot dot-teal"></span> Mali Müşavir</span>
                            <span class="legend-item"><span class="legend-dot dot-indigo"></span> Fatura</span>
                        </div>
                    </div>

                    <!-- GÜN İSİMLERİ -->
                    <div class="cal-grid-header">
                        ${DAY_NAMES.map(d => `<div class="cal-day-name">${d}</div>`).join('')}
                    </div>

                    <!-- GÜN HÜCRELERİ (7x6) -->
                    <div class="cal-grid">
                        ${calendarCells.map(cell => {
                            if (!cell.isCurrentMonth) {
                                return `<div class="cal-cell cell-muted"><span class="cell-num">${cell.day}</span></div>`;
                            }

                            const hasEvents = (cell.tasks.length > 0 || cell.payments.length > 0 || cell.taxes.length > 0);
                            const isPast = (cell.isoDate < activeSystemDate);

                            return `
                                <div class="cal-cell ${cell.isToday ? 'cell-today' : ''} ${cell.isSelected ? 'cell-selected' : ''} ${isPast ? 'cell-past' : ''}" onclick="CalendarModule.selectDate('${cell.isoDate}')">
                                    <div class="cell-top">
                                        <span class="cell-num">${cell.day}</span>
                                        ${cell.isToday ? '<span class="today-tag">BUGÜN</span>' : ''}
                                    </div>
                                    <div class="cell-badges">
                                        ${(cell.taxes || []).map(t => `
                                            <span class="event-badge badge-tax" title="Vergi: ${t.type}">
                                                🏛️ ${t.type.slice(0, 10)}
                                            </span>
                                        `).join('')}
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
                        }).join('')}
                    </div>
                </div>

                <!-- SAĞ PANEL: SEÇİLEN GÜNÜN DETAYI (Section 11) -->
                <div class="calendar-side-pane">
                    <div class="side-pane-header">
                        <div>
                            <span class="text-xs text-muted">SEÇİLEN GÜN</span>
                            <h4>${DashboardModule.formatDateDisplay(selectedDate)}</h4>
                        </div>
                        <button class="btn btn-primary btn-xs" onclick="App.openQuickTaskModal('${selectedDate}')">+ Görev</button>
                    </div>

                    <div class="side-pane-body">
                        ${selectedDayEvents.length === 0 ? `
                            <div class="empty-state-mini text-center py-4">
                                📅 Bu gün için tanımlı herhangi bir görev veya ödeme bulunmamaktadır.
                                <br><br>
                                <button class="btn btn-outline btn-sm" onclick="App.openQuickTaskModal('${selectedDate}')">+ Bu Güne Görev Ekle</button>
                            </div>
                        ` : `
                            <div class="day-events-list">
                                ${selectedDayEvents.map(ev => `
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
                                        </div>
                                    </div>
                                `).join('')}
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
        const taxes = SODSAN_DB.getTaxes().filter(t => t.dueDate === dateStr);

        taxes.forEach(t => {
            events.push({
                type: 'TAX',
                id: t.id,
                title: `${t.type} (${t.period})`,
                category: "Vergi/SGK",
                badgeClass: "cat-vergi",
                status: t.paid ? "Ödendi" : "Bekliyor",
                statusBadgeClass: t.paid ? "badge-success" : "badge-danger",
                isDone: t.paid,
                amount: t.estAmount,
                description: `Beyanname: ${t.declDate}, Son Ödeme: ${t.dueDate}`
            });
        });

        tasks.forEach(t => {
            events.push({
                type: 'TASK',
                id: t.id,
                title: t.title,
                category: t.category,
                badgeClass: getCategoryBadgeClass(t.category),
                status: t.status,
                statusBadgeClass: t.status === "Tamamlandı" ? "badge-success" : "badge-secondary",
                isDone: t.status === "Tamamlandı",
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
                badgeClass: "cat-fatura",
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
        render();
    }

    function jumpToToday() {
        const active = SODSAN_DB.getActiveDate();
        selectedDate = active;
        const parts = active.split('-');
        currentYear = parseInt(parts[0], 10);
        currentMonth = parseInt(parts[1], 10) - 1;
        render();
    }

    return {
        init,
        render,
        prevMonth,
        nextMonth,
        selectDate,
        jumpToToday
    };
})();
