// SODSAN Fabrika Portalı - Planlama & Operasyon Takvimi Modülü (calendar.js)
import { appState, logSystemAction, playAlertSound } from './data.js';

export class CalendarModule {
  constructor() {
    this.currentDate = new Date();
    this.selectedDate = new Date();
    this.monthNames = [
      "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
      "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ];
    this.dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  }

  init() {
    this.bindEvents();
    this.render();
  }

  isUserManager() {
    const user = appState.state.currentUser;
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "YONETICI" || user.role === "BAKIM") return true;
    const roleDef = appState.state.roles.find(r => r.key === user.role);
    return roleDef && roleDef.permissions && (roleDef.permissions.canAddMaintenance || roleDef.permissions.canAccessAdmin);
  }

  bindEvents() {
    const prevBtn = document.getElementById("cal-prev-month");
    const nextBtn = document.getElementById("cal-next-month");
    const todayBtn = document.getElementById("cal-today-btn");
    const addEventBtn = document.getElementById("btn-add-calendar-event");
    const modalDayAddBtn = document.getElementById("btn-modal-day-add-event");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
      });
    }

    if (todayBtn) {
      todayBtn.addEventListener("click", () => {
        this.currentDate = new Date();
        this.selectedDate = new Date();
        this.render();
      });
    }

    if (addEventBtn) {
      addEventBtn.addEventListener("click", () => {
        this.openAddEventModal();
      });
    }

    if (modalDayAddBtn) {
      modalDayAddBtn.addEventListener("click", () => {
        const modalDay = document.getElementById("modal-day-events");
        if (modalDay) modalDay.classList.remove("show");
        this.openAddEventModal(this.formatDateKey(this.selectedDate));
      });
    }

    // Modal Form Gönderimi (Yeni Plan Ekleme)
    const formAdd = document.getElementById("form-add-event");
    if (formAdd) {
      formAdd.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveNewEvent();
      });
    }

    // Modal Form Gönderimi (Yetkili Plan Düzenleme)
    const formEdit = document.getElementById("form-edit-calendar-event");
    if (formEdit) {
      formEdit.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveEditedEvent();
      });
    }
  }

  formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  render() {
    const titleEl = document.getElementById("cal-month-title");
    const gridEl = document.getElementById("cal-grid");

    if (!titleEl || !gridEl) return;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    titleEl.textContent = `${this.monthNames[month]} ${year}`;

    // Hafta Başlıkları ve Gün Hücreleri
    gridEl.innerHTML = "";

    // Başlıklar
    this.dayNames.forEach(name => {
      const headerCell = document.createElement("div");
      headerCell.className = "calendar-day-header";
      headerCell.textContent = name;
      gridEl.appendChild(headerCell);
    });

    // Ayın ilk günü (Pazartesi = 1, Pazar = 7)
    const firstDayOfMonth = new Date(year, month, 1);
    let startDayIndex = firstDayOfMonth.getDay() - 1;
    if (startDayIndex === -1) startDayIndex = 6; // Pazar düzeltmesi

    // Önceki aydan kalan günler
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, daysInPrevMonth - i);
      gridEl.appendChild(this.createDayCell(prevDate, true));
    }

    // Bu ayın günleri
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const currentCellDate = new Date(year, month, day);
      gridEl.appendChild(this.createDayCell(currentCellDate, false));
    }

    // Bir sonraki aydan tamamlayıcı günler (42 hücreye tamamlamak için)
    const totalCellsSoFar = startDayIndex + daysInMonth;
    const remainingCells = 42 - totalCellsSoFar;
    for (let i = 1; i <= remainingCells; i++) {
      const nextDate = new Date(year, month + 1, i);
      gridEl.appendChild(this.createDayCell(nextDate, true));
    }

    // Yan paneldeki seçili gün detayını da güncelle
    this.renderSelectedDayDetails();
  }

  createDayCell(date, isOtherMonth) {
    const cell = document.createElement("div");
    const dateKey = this.formatDateKey(date);
    const todayKey = this.formatDateKey(new Date());
    const selectedKey = this.formatDateKey(this.selectedDate);

    cell.className = "calendar-day-cell cursor-pointer hover:bg-blue-50/40 transition group";
    if (isOtherMonth) cell.classList.add("other-month");
    if (dateKey === todayKey) cell.classList.add("today");
    if (dateKey === selectedKey) cell.classList.add("active-day");

    // Gün Numarası
    const dayNum = document.createElement("div");
    dayNum.className = "flex justify-between items-center text-xs font-bold text-slate-700 group-hover:text-blue-700";
    dayNum.innerHTML = `<span>${date.getDate()}</span>`;

    // O güne ait tüm olayları topla
    const events = (appState.state.calendarEvents || []).filter(e => e.date === dateKey);
    const leaves = (appState.state.leaveRequests || []).filter(l => 
      l.status === "Onaylandı" && dateKey >= l.startDate && dateKey <= l.endDate
    );
    const overtimes = (appState.state.overtimeRequests || []).filter(o => 
      o.status === "Onaylandı" && o.date === dateKey
    );
    const breakdowns = (appState.state.breakdowns || []).filter(b => 
      b.reportedTime && b.reportedTime.startsWith(dateKey)
    );
    const products = (appState.state.products || []).filter(p => 
      p.date && p.date.startsWith(dateKey)
    );

    const badgesContainer = document.createElement("div");
    badgesContainer.className = "flex flex-col gap-1 overflow-hidden mt-1";

    // KÜÇÜK SİMGELER HALİNDE TAKVİM HÜCRESİNDE GÖSTER
    // 1. Sevkiyatlar, Bakımlar & Eğitimler
    events.forEach(ev => {
      const isMaint = ev.type === "MAKINABAKIM";
      const isShip = ev.type === "SEVKIYAT";
      const isEdu = ev.type === "EGITIM";
      const badge = document.createElement("div");
      badge.className = `calendar-badge text-[10px] font-bold py-0.5 px-1.5 rounded truncate flex items-center gap-1 ${
        isMaint ? 'bg-red-100 text-red-800 border border-red-200' :
        isShip ? 'bg-blue-100 text-blue-800 border border-blue-200' :
        isEdu ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
        'bg-slate-100 text-slate-800 border border-slate-200'
      }`;
      const icon = isMaint ? '🛠️' : isShip ? '🚚' : isEdu ? '🎓' : '📌';
      badge.title = `${ev.title} (${ev.status || 'Planlandı'})`;
      badge.innerHTML = `<span>${icon}</span> <span class="truncate">${ev.title}</span>`;
      badgesContainer.appendChild(badge);
    });

    // 2. Makina Arızaları
    breakdowns.forEach(brk => {
      const isResolved = brk.status === "Giderildi";
      const badge = document.createElement("div");
      badge.className = `calendar-badge text-[10px] font-bold py-0.5 px-1.5 rounded truncate flex items-center gap-1 ${
        isResolved ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-200 text-red-900 border border-red-300 animate-pulse'
      }`;
      badge.title = `Arıza: ${brk.machineName} - ${brk.status}`;
      badge.innerHTML = `<span>🚨</span> <span class="truncate">${brk.machineName}</span>`;
      badgesContainer.appendChild(badge);
    });

    // 3. İzinler
    leaves.forEach(l => {
      const badge = document.createElement("div");
      badge.className = "calendar-badge text-[10px] font-bold py-0.5 px-1.5 rounded truncate flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200";
      badge.title = `${l.employeeName} (${l.leaveType})`;
      badge.innerHTML = `<span>🏖️</span> <span class="truncate">${l.employeeName}</span>`;
      badgesContainer.appendChild(badge);
    });

    // 4. Fazla Mesailer
    overtimes.forEach(ot => {
      const badge = document.createElement("div");
      badge.className = "calendar-badge text-[10px] font-bold py-0.5 px-1.5 rounded truncate flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-200";
      badge.title = `Mesai: ${ot.employeeNames} (${ot.hours}s)`;
      badge.innerHTML = `<span>⏰</span> <span class="truncate">${ot.employeeNames}</span>`;
      badgesContainer.appendChild(badge);
    });

    // 5. Ürün Giriş / Çıkışları
    if (products.length > 0) {
      const badge = document.createElement("div");
      badge.className = "calendar-badge text-[10px] font-bold py-0.5 px-1.5 rounded truncate flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-200";
      badge.innerHTML = `<span>📦</span> <span class="truncate">${products.length} Ürün Hareketi</span>`;
      badgesContainer.appendChild(badge);
    }

    cell.appendChild(dayNum);
    cell.appendChild(badgesContainer);

    // Tıklanınca seçili günü değiştir ve ÖN EKRANDA (MODAL) OLAYLARI AÇ
    cell.addEventListener("click", () => {
      this.selectedDate = date;
      this.render();
      this.openDayModal(date);
    });

    return cell;
  }

  openDayModal(date) {
    const modal = document.getElementById("modal-day-events");
    const titleEl = document.getElementById("modal-day-title");
    const listEl = document.getElementById("modal-day-events-list");

    if (!modal || !titleEl || !listEl) return;

    const options = { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' };
    const dateFormatted = date.toLocaleDateString('tr-TR', options);
    const dateKey = this.formatDateKey(date);

    titleEl.textContent = `📅 ${dateFormatted}`;

    const events = (appState.state.calendarEvents || []).filter(e => e.date === dateKey);
    const leaves = (appState.state.leaveRequests || []).filter(l => 
      l.status === "Onaylandı" && dateKey >= l.startDate && dateKey <= l.endDate
    );
    const overtimes = (appState.state.overtimeRequests || []).filter(o => 
      o.status === "Onaylandı" && o.date === dateKey
    );
    const breakdowns = (appState.state.breakdowns || []).filter(b => 
      b.reportedTime && b.reportedTime.startsWith(dateKey)
    );
    const products = (appState.state.products || []).filter(p => 
      p.date && p.date.startsWith(dateKey)
    );

    const totalCount = events.length + leaves.length + overtimes.length + breakdowns.length + products.length;

    if (totalCount === 0) {
      listEl.innerHTML = `
        <div class="text-center py-8 text-slate-400">
          <p class="text-3xl mb-2">📅</p>
          <p class="text-sm font-bold text-slate-700">Bu güne kayıtlı herhangi bir olay bulunmuyor.</p>
          <p class="text-xs text-slate-400 mt-1">Aşağıdaki "+ Bu Güne Plan Ekle" butonuna basarak yeni sevkiyat veya bakım ekleyebilirsiniz.</p>
        </div>
      `;
      modal.classList.add("show");
      return;
    }

    const canEdit = this.isUserManager();

    listEl.innerHTML = `
      <p class="text-xs text-slate-500 font-medium mb-1">Bu tarihte <b>${totalCount}</b> kayıtlı olay ve hareket bulunuyor. Ayrıntıları görmek için olay kartına tıklayınız:</p>
      
      <!-- Takvim Etkinlikleri (Sevkiyat, Bakım & Eğitim) -->
      ${events.map(ev => {
        const isMaint = ev.type === "MAKINABAKIM";
        const isShip = ev.type === "SEVKIYAT";
        const isEdu = ev.type === "EGITIM";
        const icon = isMaint ? '🛠️' : isShip ? '🚚' : isEdu ? '🎓' : '📌';
        const typeLabel = isMaint ? 'Makine Bakımı' : isShip ? 'Sevkiyat' : isEdu ? 'Personel Eğitimi' : (ev.type || 'Plan');
        const borderCls = isMaint ? 'border-red-300 bg-red-50/40' : isShip ? 'border-blue-300 bg-blue-50/40' : isEdu ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200 bg-slate-50';
        const badgeCls = isMaint ? 'bg-red-100 text-red-800' : isShip ? 'bg-blue-100 text-blue-800' : isEdu ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-800';

        return `
          <div class="rounded-xl border ${borderCls} p-3.5 shadow-sm transition space-y-2 cursor-pointer hover:shadow" data-event-card="${ev.id}">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-xl">${icon}</span>
                <div>
                  <h4 class="font-extrabold text-slate-900 text-sm">${ev.title}</h4>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded ${badgeCls}">
                    ${typeLabel} &bull; ${ev.status || 'Planlandı'}
                  </span>
                </div>
              </div>
              
              <div class="flex items-center gap-1.5" onclick="event.stopPropagation()">
                ${canEdit ? `
                  <button data-open-edit-event="${ev.id}" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-2.5 rounded-lg shadow-sm transition flex items-center gap-1">
                    <span>✏️</span> <span>Düzenle</span>
                  </button>
                ` : ''}
              </div>
            </div>

            <!-- Tıklayınca Açılan Detay Paneli -->
            <div id="event-detail-${ev.id}" class="pt-2 border-t border-slate-200/60 text-xs space-y-1 text-slate-700">
              ${ev.notes ? `<p class="bg-white/80 p-2 rounded border border-slate-100"><b>Açıklama / Not:</b> ${ev.notes}</p>` : ''}
              <div class="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                <span>👤 Sorumlu: <b class="text-slate-800">${ev.responsible || 'Belirtilmedi'}</b></span>
                ${ev.createdBy ? `<span>👤 Ekleyen: <b class="text-slate-800">${ev.createdBy}</b></span>` : ''}
                <span>📅 Tarih: <b>${ev.date}</b></span>
              </div>
            </div>
          </div>
        `;
      }).join("")}

      <!-- Makina Arızaları -->
      ${breakdowns.map(brk => `
        <div class="rounded-xl border border-red-300 bg-red-50/50 p-3.5 shadow-sm space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-xl">🚨</span>
              <div>
                <h4 class="font-extrabold text-red-950 text-sm">Arıza: ${brk.machineName}</h4>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-red-200 text-red-900 uppercase">
                  ${brk.urgency} &bull; ${brk.status}
                </span>
              </div>
            </div>
          </div>
          <div class="pt-2 border-t border-red-200/60 text-xs space-y-1 text-slate-700">
            <p><b>Konum:</b> ${brk.location} &bull; <b>Tür:</b> ${brk.faultType}</p>
            <p class="italic text-slate-600">"${brk.description}"</p>
            <p class="text-[11px] text-slate-500">Bildiren: <b>${brk.reportedBy}</b> ${brk.assignedTechnician ? `&bull; Müdahale Eden: <b>${brk.assignedTechnician}</b>` : ''}</p>
          </div>
        </div>
      `).join("")}

      <!-- İzinli Personel -->
      ${leaves.map(l => `
        <div class="rounded-xl border border-amber-300 bg-amber-50/50 p-3.5 shadow-sm space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-xl">🏖️</span>
            <div>
              <h4 class="font-bold text-slate-900 text-sm">${l.employeeName} (${l.leaveType})</h4>
              <p class="text-xs text-amber-800 font-medium">${l.startDate} &rarr; ${l.endDate} (${l.daysCount} Gün İzinli)</p>
            </div>
          </div>
          ${l.notes ? `<p class="text-[11px] text-slate-600 italic">Not: ${l.notes}</p>` : ''}
        </div>
      `).join("")}

      <!-- Fazla Mesailer -->
      ${overtimes.map(ot => `
        <div class="rounded-xl border border-rose-300 bg-rose-50/50 p-3.5 shadow-sm space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-xl">⏰</span>
            <div>
              <h4 class="font-bold text-slate-900 text-sm">Mesai: ${ot.employeeNames}</h4>
              <p class="text-xs text-rose-800 font-medium">${ot.startTime} - ${ot.endTime} (${ot.hours} Saat)</p>
            </div>
          </div>
          <p class="text-xs text-slate-700">Gerekçe: <b>${ot.reason}</b></p>
          <div class="text-[11px] text-slate-500 flex gap-2">
            <span>Usta: <b>${ot.requestedBy}</b></span>
            <span>Servis: <b>${ot.needTransport ? 'Var' : 'Yok'}</b></span>
            <span>Yemek: <b>${ot.needMeal ? 'Var' : 'Yok'}</b></span>
          </div>
        </div>
      `).join("")}

      <!-- Ürün Hareketleri -->
      ${products.map(p => `
        <div class="rounded-xl border border-emerald-300 bg-emerald-50/50 p-3 shadow-sm flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="text-lg">📦</span>
            <div>
              <div class="font-bold text-slate-900">${p.productName}</div>
              <div class="text-[11px] text-slate-500">${p.type === 'GELEN' ? '📥 Gelen Ürün' : '📤 Giden Sevkiyat'} &bull; Firma: <b>${p.company || p.supplier || '-'}</b></div>
            </div>
          </div>
          <div class="font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
            ${p.amount} ${p.unit}
          </div>
        </div>
      `).join("")}
    `;

    // Düzenleme Butonu Dinleyicileri
    listEl.querySelectorAll("[data-open-edit-event]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const evId = e.currentTarget.getAttribute("data-open-edit-event");
        this.openEditEventModal(evId);
      });
    });

    modal.classList.add("show");
  }

  openEditEventModal(eventId) {
    const ev = (appState.state.calendarEvents || []).find(x => x.id === eventId);
    if (!ev) return;

    document.getElementById("edit-event-id").value = ev.id;
    document.getElementById("edit-event-date").value = ev.date || this.formatDateKey(new Date());
    document.getElementById("edit-event-title").value = ev.title || "";
    document.getElementById("edit-event-type").value = ev.type || "MAKINABAKIM";
    document.getElementById("edit-event-status").value = ev.status || "Planlandı";
    document.getElementById("edit-event-responsible").value = ev.responsible || "";
    document.getElementById("edit-event-notes").value = ev.notes || "";

    const modal = document.getElementById("modal-edit-calendar-event");
    if (modal) modal.classList.add("show");
  }

  saveEditedEvent() {
    const id = document.getElementById("edit-event-id").value;
    const ev = (appState.state.calendarEvents || []).find(x => x.id === id);
    if (!ev) return;

    const newDate = document.getElementById("edit-event-date").value;
    const newTitle = document.getElementById("edit-event-title").value.trim();
    const newType = document.getElementById("edit-event-type").value;
    const newStatus = document.getElementById("edit-event-status").value;
    const newResponsible = document.getElementById("edit-event-responsible").value.trim();
    const newNotes = document.getElementById("edit-event-notes").value.trim();

    if (!newTitle || !newDate) {
      alert("Lütfen başlık ve tarih alanlarını eksiksiz giriniz.");
      return;
    }

    const changes = [];
    if (ev.title !== newTitle) changes.push(`Başlık: "${ev.title}" -> "${newTitle}"`);
    if (ev.date !== newDate) changes.push(`Tarih: ${ev.date} -> ${newDate}`);
    if (ev.type !== newType) changes.push(`Tür: ${ev.type} -> ${newType}`);
    if (ev.status !== newStatus) changes.push(`Durum: ${ev.status} -> ${newStatus}`);
    if (ev.responsible !== newResponsible) changes.push(`Sorumlu: ${ev.responsible} -> ${newResponsible}`);

    ev.title = newTitle;
    ev.date = newDate;
    ev.type = newType;
    ev.status = newStatus;
    ev.responsible = newResponsible;
    ev.notes = newNotes;
    ev.lastEditedBy = appState.state.currentUser.name;
    ev.lastEditedAt = new Date().toISOString();

    appState.saveState();

    logSystemAction(
      "TAKVİM_DÜZENLEME",
      `Yetkili ${appState.state.currentUser.name}, "${newTitle}" takvim planını güncelledi. (${changes.length > 0 ? changes.join(", ") : "Bilgiler teyit edildi"})`,
      { eventId: id, changes }
    );

    // Telegram Bot Bildirimi (Düzenleme)
    if (changes.length > 0) {
      this.sendTelegramEventNotification({
        ...ev,
        title: `[GÜNCELLENDİ] ${newTitle}`,
        notes: `Düzenleme Notu: ${changes.join(", ")}${newNotes ? '\n' + newNotes : ''}`
      });
    }

    playAlertSound("call");

    document.getElementById("form-edit-calendar-event").reset();
    document.getElementById("modal-edit-calendar-event").classList.remove("show");

    // Takvimi ve açık ön ekran modalını güncelle
    this.render();
    this.openDayModal(this.selectedDate);
  }

  renderSelectedDayDetails() {
    const container = document.getElementById("selected-day-timeline");
    const dateLabel = document.getElementById("selected-day-label");
    if (!container || !dateLabel) return;

    const dateKey = this.formatDateKey(this.selectedDate);
    const options = { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' };
    dateLabel.textContent = this.selectedDate.toLocaleDateString('tr-TR', options);

    const events = (appState.state.calendarEvents || []).filter(e => e.date === dateKey);
    const leaves = (appState.state.leaveRequests || []).filter(l => 
      l.status === "Onaylandı" && dateKey >= l.startDate && dateKey <= l.endDate
    );
    const overtimes = (appState.state.overtimeRequests || []).filter(o => 
      o.status === "Onaylandı" && o.date === dateKey
    );
    const breakdowns = (appState.state.breakdowns || []).filter(b => 
      b.reportedTime && b.reportedTime.startsWith(dateKey)
    );

    if (events.length === 0 && leaves.length === 0 && overtimes.length === 0 && breakdowns.length === 0) {
      container.innerHTML = `
        <div class="text-center py-6 text-slate-400 text-sm">
          <p>Bu güne ait planlanmış bakım, sevkiyat veya arıza bulunmuyor.</p>
          <button id="btn-quick-add-event" class="mt-2 text-blue-600 font-bold text-xs hover:underline">
            + Yeni Plan / Bakım Ekle
          </button>
        </div>
      `;
      const quickBtn = document.getElementById("btn-quick-add-event");
      if (quickBtn) quickBtn.addEventListener("click", () => this.openAddEventModal());
      return;
    }

    const canEdit = this.isUserManager();

    let html = `<div class="space-y-2.5">`;

    // Etkinlikler
    events.forEach(ev => {
      const isMaintenance = ev.type === "MAKINABAKIM";
      const isShip = ev.type === "SEVKIYAT";
      const isEdu = ev.type === "EGITIM";
      const icon = isMaintenance ? '🛠️' : isShip ? '🚚' : isEdu ? '🎓' : '📌';
      const borderCls = isMaintenance ? 'border-red-200 bg-red-50/50' : isShip ? 'border-blue-200 bg-blue-50/50' : isEdu ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200 bg-slate-50';
      const badgeCls = isMaintenance ? 'bg-red-200 text-red-800' : isShip ? 'bg-blue-200 text-blue-800' : isEdu ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-200 text-slate-800';

      html += `
        <div class="p-3 rounded-xl border ${borderCls} text-sm flex justify-between items-start">
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-base">${icon}</span>
              <span class="font-bold text-slate-800">${ev.title}</span>
              <span class="text-xs px-2 py-0.5 rounded-full ${badgeCls} font-medium">
                ${ev.type === 'EGITIM' ? 'Eğitim' : ev.type}
              </span>
            </div>
            ${ev.notes ? `<p class="text-xs text-slate-600 mt-1">${ev.notes}</p>` : ''}
            <div class="text-[11px] text-slate-500 mt-1.5 flex flex-wrap gap-2">
              <span>Sorumlu: <b>${ev.responsible || 'Belirtilmedi'}</b></span>
              ${ev.createdBy ? `<span class="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold">👤 Ekleyen: ${ev.createdBy}</span>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-1">
            ${canEdit ? `<button data-quick-edit-event="${ev.id}" class="text-blue-600 hover:text-blue-800 p-1 text-xs font-bold" title="Düzenle">✏️</button>` : ''}
            <button data-delete-event="${ev.id}" class="text-slate-400 hover:text-red-600 text-xs p-1" title="Sil">✕</button>
          </div>
        </div>
      `;
    });

    // İzinler
    leaves.forEach(l => {
      html += `
        <div class="p-3 rounded-xl border border-amber-200 bg-amber-50/50 text-sm flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-base">🏖️</span>
            <div>
              <div class="font-bold text-slate-800">${l.employeeName} - ${l.leaveType}</div>
              <div class="text-xs text-slate-500">${l.startDate} ile ${l.endDate} arası (${l.daysCount} Gün)</div>
            </div>
          </div>
          <span class="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">İzinli</span>
        </div>
      `;
    });

    // Fazla Mesailer
    overtimes.forEach(ot => {
      html += `
        <div class="p-3 rounded-xl border border-rose-200 bg-rose-50/60 text-sm space-y-1.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="text-base">⏰</span>
              <span class="font-bold text-slate-800">${ot.employeeNames}</span>
            </div>
            <span class="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">${ot.hours} Saat</span>
          </div>
          <div class="text-xs text-slate-600">
            <b>Saat:</b> ${ot.startTime} - ${ot.endTime} &bull; <b>Gerekçe:</b> ${ot.reason}
          </div>
        </div>
      `;
    });

    // Makina Arızaları
    breakdowns.forEach(brk => {
      const isResolved = brk.status === "Giderildi";
      html += `
        <div class="p-3 rounded-xl border ${isResolved ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/70'} text-xs space-y-1">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="text-base">🚨</span>
              <span class="font-extrabold ${isResolved ? 'text-emerald-900' : 'text-red-900'}">${brk.machineName}</span>
            </div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded ${isResolved ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800 animate-pulse'}">
              ${brk.status}
            </span>
          </div>
          <div class="text-slate-700"><b>Konum:</b> ${brk.location} &bull; <b>Tür:</b> ${brk.faultType}</div>
          <p class="text-slate-600 italic">${brk.description}</p>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;

    // Hızlı Düzenleme Butonları
    container.querySelectorAll("[data-quick-edit-event]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-quick-edit-event");
        this.openEditEventModal(id);
      });
    });

    // Silme Butonları
    container.querySelectorAll("[data-delete-event]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-delete-event");
        const target = appState.state.calendarEvents.find(x => x.id === id);
        if (confirm("Bu etkinlik/bakım kaydını silmek istediğinize emin misiniz?")) {
          if (target) {
            logSystemAction("TAKVİM_SİLME", `${appState.state.currentUser.name}, "${target.title}" plan/bakım kaydını sildi.`, { eventId: id, title: target.title });
          }
          appState.state.calendarEvents = appState.state.calendarEvents.filter(x => x.id !== id);
          appState.saveState();
          this.render();
        }
      });
    });
  }

  openAddEventModal(presetDateKey = null) {
    const modal = document.getElementById("modal-add-event");
    const dateInput = document.getElementById("event-date");

    if (dateInput) {
      dateInput.value = presetDateKey || this.formatDateKey(this.selectedDate);
    }

    if (modal) modal.classList.add("show");
  }

  saveNewEvent() {
    const titleInput = document.getElementById("event-title");
    const typeSelect = document.getElementById("event-type");
    const dateInput = document.getElementById("event-date");
    const respInput = document.getElementById("event-responsible");
    const notesInput = document.getElementById("event-notes");

    const title = titleInput.value.trim();
    const type = typeSelect.value;
    const date = dateInput.value;
    const responsible = respInput.value.trim();
    const notes = notesInput.value.trim();

    if (!title || !date) {
      alert("Lütfen başlık ve tarih alanlarını eksiksiz doldurunuz.");
      return;
    }

    const newEvent = {
      id: "ev_" + Date.now(),
      title,
      type,
      date,
      responsible: responsible || "Belirtilmedi",
      status: "Planlandı",
      notes,
      createdBy: appState.state.currentUser.name
    };

    if (!Array.isArray(appState.state.calendarEvents)) {
      appState.state.calendarEvents = [];
    }

    appState.state.calendarEvents.push(newEvent);
    appState.saveState();

    logSystemAction(
      "TAKVİM_EKLE",
      `${appState.state.currentUser.name}, "${title}" (${type} - ${date}) plan/bakım kaydını takvime ekledi.`,
      { title, type, date, responsible }
    );

    // Telegram Bot Bildirimi (İlgili Birimlere)
    this.sendTelegramEventNotification(newEvent);

    playAlertSound("call");

    document.getElementById("form-add-event").reset();
    document.getElementById("modal-add-event").classList.remove("show");

    this.render();
  }

  // Takvime eklenen plan, bakım veya eğitimleri Telegram üzerinden ilgili birimlere iletir
  async sendTelegramEventNotification(event) {
    const config = appState.state.telegramConfig;
    if (!config || !config.enabled || !config.botToken || !config.chatId) return;
    if (config.notifyCalendar === false) {
      console.log("Takvim etkinlikleri Telegram bildirimi kullanıcı tercihiyle kapalı.");
      return;
    }

    let typeLabel = "📌 Takvim Planı";
    let typeEmoji = "📅";
    if (event.type === "MAKINABAKIM") {
      typeLabel = "🛠️ Makine Periyodik Bakımı";
      typeEmoji = "🛠️";
    } else if (event.type === "SEVKIYAT") {
      typeLabel = "🚚 Sevkiyat / Randevu";
      typeEmoji = "🚚";
    } else if (event.type === "EGITIM") {
      typeLabel = "🎓 Personel Eğitimi / İSG";
      typeEmoji = "🎓";
    } else if (event.type === "TOPLANTI") {
      typeLabel = "👥 Departman Toplantısı";
      typeEmoji = "👥";
    } else if (event.type === "IK") {
      typeLabel = "👔 İK & Denetim";
      typeEmoji = "👔";
    }

    const escapeHtml = (str) => String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const htmlMessage = `
${typeEmoji} <b>PLANLAMA & OPERASYON TAKVİMİ BİLDİRİMİ</b>
─────────────────────
📌 <b>Başlık:</b> ${escapeHtml(event.title)}
🏷️ <b>Tür:</b> ${escapeHtml(typeLabel)}
📆 <b>Tarih:</b> ${escapeHtml(event.date)}
👤 <b>Sorumlu:</b> ${escapeHtml(event.responsible || 'Belirtilmedi')}
✍️ <b>Kaydeden:</b> ${escapeHtml(event.createdBy || appState.state.currentUser.name)}
${event.notes ? `💬 <b>Açıklama / Not:</b> ${escapeHtml(event.notes)}\n` : ''}⏰ <b>Kayıt Zamanı:</b> ${timeStr}
`.trim();

    const plainMessage = `
${typeEmoji} PLANLAMA & OPERASYON TAKVİMİ BİLDİRİMİ
─────────────────────
📌 Başlık: ${event.title}
🏷️ Tür: ${typeLabel}
📆 Tarih: ${event.date}
👤 Sorumlu: ${event.responsible || 'Belirtilmedi'}
✍️ Kaydeden: ${event.createdBy || appState.state.currentUser.name}
${event.notes ? `💬 Not: ${event.notes}\n` : ''}⏰ Kayıt Zamanı: ${timeStr}
`.trim();

    try {
      const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: htmlMessage,
          parse_mode: "HTML"
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || (data && !data.ok)) {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: config.chatId,
            text: plainMessage
          })
        });
      }
    } catch (err) {
      console.warn("Telegram takvim bildirimi gönderilemedi:", err);
    }
  }
}
