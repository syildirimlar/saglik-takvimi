// SODSAN Fabrika Portalı - İK ve Fazla Mesai Yönetim Modülü (overtime.js)
import { appState, playAlertSound, logSystemAction, isManagerOrHr, getCurrentUserEmployee } from './data.js';

export class OvertimeModule {
  constructor() {
    this.filterStatus = "ALL";
    this.filterDept = "ALL";
  }

  init() {
    this.populateDepartmentSelect();
    this.populateEmployeeChecklist();
    this.bindEvents();
    this.render();
  }

  populateDepartmentSelect() {
    const modalDeptSelect = document.getElementById("overtime-department");
    const filterDeptSelect = document.getElementById("filter-overtime-dept");

    if (modalDeptSelect) {
      modalDeptSelect.innerHTML = appState.state.departments.map(dep => `
        <option value="${dep.id}">${dep.icon} ${dep.name}</option>
      `).join("");

      // Ustanın departmanını varsayılan seç
      const currentUser = appState.state.currentUser;
      if (currentUser && currentUser.departmentId) {
        modalDeptSelect.value = currentUser.departmentId;
      }
    }

    if (filterDeptSelect) {
      const currentVal = this.filterDept;
      filterDeptSelect.innerHTML = `<option value="ALL">Tüm Departmanlar</option>` +
        appState.state.departments.map(dep => `
          <option value="${dep.id}">${dep.icon} ${dep.name}</option>
        `).join("");
      filterDeptSelect.value = currentVal;
    }
  }

  populateEmployeeChecklist() {
    const container = document.getElementById("overtime-employee-checklist");
    if (!container) return;

    const isAuthorized = isManagerOrHr();
    const myEmp = getCurrentUserEmployee();
    const btnSelectAll = document.getElementById("btn-overtime-select-all");
    const btnClearAll = document.getElementById("btn-overtime-clear-all");

    // Standart Personel Girişi: Kendi profili doğrudan seçili gelir
    if (!isAuthorized) {
      if (btnSelectAll) btnSelectAll.classList.add("hidden");
      if (btnClearAll) btnClearAll.classList.add("hidden");

      if (!myEmp) {
        const u = appState.state.currentUser;
        container.innerHTML = `
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            <strong>${u?.name || "Kullanıcı"}</strong> hesabına ait çalışan kaydı bulunamadı.
          </div>
        `;
        this.updateSelectedEmployeeCount();
        return;
      }

      const dep = appState.state.departments.find(d => d.id === myEmp.departmentId) || { name: "", icon: "🏢" };
      container.innerHTML = `
        <div class="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs">
          <div class="flex items-center gap-2">
            <input type="checkbox" name="overtime-emp" value="${myEmp.id}" data-name="${myEmp.name}" data-dept="${myEmp.departmentId}" checked class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-default">
            <span class="text-slate-900 font-extrabold flex items-center gap-1.5">
              <span>👤</span> <span>${myEmp.name}</span>
            </span>
          </div>
          <span class="text-[11px] text-slate-500 font-medium">${dep.icon} ${dep.name}</span>
        </div>
      `;
      this.updateSelectedEmployeeCount();
      return;
    }

    // YETKİLİ PERSONEL (ADMIN / İK / YÖNETİCİ): Tüm personelleri seçebilir
    if (btnSelectAll) btnSelectAll.classList.remove("hidden");
    if (btnClearAll) btnClearAll.classList.remove("hidden");

    const modalDeptSelect = document.getElementById("overtime-department");
    const selectedDeptId = modalDeptSelect ? modalDeptSelect.value : null;

    let employees = appState.state.employees || [];
    if (selectedDeptId) {
      // Önce seçili departmandakiler, sonra diğerleri
      employees = [...employees].sort((a, b) => {
        if (a.departmentId === selectedDeptId && b.departmentId !== selectedDeptId) return -1;
        if (a.departmentId !== selectedDeptId && b.departmentId === selectedDeptId) return 1;
        return a.name.localeCompare(b.name, "tr");
      });
    }

    container.innerHTML = employees.map(emp => {
      const dep = appState.state.departments.find(d => d.id === emp.departmentId) || { name: "", icon: "🏢" };
      const isMyDept = selectedDeptId && emp.departmentId === selectedDeptId;

      return `
        <label class="flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:bg-blue-50/50 cursor-pointer transition text-xs select-none ${isMyDept ? 'bg-white font-medium' : 'bg-slate-50 opacity-80'}">
          <div class="flex items-center gap-2">
            <input type="checkbox" name="overtime-emp" value="${emp.id}" data-name="${emp.name}" data-dept="${emp.departmentId}" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer">
            <span class="text-slate-800 font-bold">${emp.name}</span>
          </div>
          <span class="text-[10px] text-slate-500 font-medium">${dep.icon} ${dep.name}</span>
        </label>
      `;
    }).join("");

    // Personel sayacı güncelleme
    const checkboxes = container.querySelectorAll("input[name='overtime-emp']");
    checkboxes.forEach(cb => {
      cb.addEventListener("change", () => this.updateSelectedEmployeeCount());
    });
    this.updateSelectedEmployeeCount();
  }

  updateSelectedEmployeeCount() {
    const checked = document.querySelectorAll("input[name='overtime-emp']:checked");
    const countBadge = document.getElementById("overtime-selected-count-badge");
    if (countBadge) {
      countBadge.textContent = `${checked.length} Personel Seçildi`;
      if (checked.length > 0) {
        countBadge.className = "text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700";
      } else {
        countBadge.className = "text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500";
      }
    }
  }

  bindEvents() {
    const btnOpenModal = document.getElementById("btn-open-request-overtime");
    const form = document.getElementById("form-request-overtime");
    const modalDeptSelect = document.getElementById("overtime-department");
    const startTimeInput = document.getElementById("overtime-start-time");
    const endTimeInput = document.getElementById("overtime-end-time");
    const filterStatus = document.getElementById("filter-overtime-status");
    const filterDept = document.getElementById("filter-overtime-dept");
    const btnSelectAll = document.getElementById("btn-overtime-select-all");
    const btnClearAll = document.getElementById("btn-overtime-clear-all");
    const checkTransport = document.getElementById("overtime-need-transport");
    const checkMeal = document.getElementById("overtime-need-meal");
    const transportContainer = document.getElementById("overtime-transport-detail-container");

    // İK Alt Sekme Geçiş Butonları (İzinler vs Fazla Mesai)
    const subtabBtnLeave = document.getElementById("subtab-btn-leave");
    const subtabBtnOvertime = document.getElementById("subtab-btn-overtime");
    const subpaneLeave = document.getElementById("subpane-leave");
    const subpaneOvertime = document.getElementById("subpane-overtime");

    if (subtabBtnLeave && subtabBtnOvertime && subpaneLeave && subpaneOvertime) {
      subtabBtnLeave.addEventListener("click", () => {
        subtabBtnLeave.classList.add("bg-white", "text-blue-700", "shadow-sm");
        subtabBtnLeave.classList.remove("text-slate-600");
        subtabBtnOvertime.classList.remove("bg-white", "text-blue-700", "shadow-sm");
        subtabBtnOvertime.classList.add("text-slate-600");

        subpaneLeave.classList.remove("hidden");
        subpaneOvertime.classList.add("hidden");

        if (window.portalApp && window.portalApp.leave) {
          window.portalApp.leave.render();
        }
      });

      subtabBtnOvertime.addEventListener("click", () => {
        subtabBtnOvertime.classList.add("bg-white", "text-blue-700", "shadow-sm");
        subtabBtnOvertime.classList.remove("text-slate-600");
        subtabBtnLeave.classList.remove("bg-white", "text-blue-700", "shadow-sm");
        subtabBtnLeave.classList.add("text-slate-600");

        subpaneOvertime.classList.remove("hidden");
        subpaneLeave.classList.add("hidden");

        this.render();
      });
    }

    if (btnOpenModal) {
      btnOpenModal.addEventListener("click", () => {
        this.populateDepartmentSelect();
        this.populateEmployeeChecklist();

        // Varsayılan bugünün tarihi
        const dateInput = document.getElementById("overtime-date");
        if (dateInput && !dateInput.value) {
          dateInput.value = new Date().toISOString().split("T")[0];
        }

        this.calculateHours();

        const modal = document.getElementById("modal-request-overtime");
        if (modal) modal.classList.add("show");
      });
    }

    if (modalDeptSelect) {
      modalDeptSelect.addEventListener("change", () => {
        this.populateEmployeeChecklist();
      });
    }

    if (startTimeInput) startTimeInput.addEventListener("change", () => this.calculateHours());
    if (endTimeInput) endTimeInput.addEventListener("change", () => this.calculateHours());

    // Hızlı Mesai Nedeni Butonları (Chips)
    document.querySelectorAll("[data-chip-reason]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const text = e.currentTarget.getAttribute("data-chip-reason");
        const reasonInput = document.getElementById("overtime-reason");
        if (reasonInput) {
          reasonInput.value = text;
        }
      });
    });

    // Tümünü Seç / Temizle Butonları
    if (btnSelectAll) {
      btnSelectAll.addEventListener("click", () => {
        document.querySelectorAll("input[name='overtime-emp']").forEach(cb => {
          cb.checked = true;
        });
        this.updateSelectedEmployeeCount();
      });
    }

    if (btnClearAll) {
      btnClearAll.addEventListener("click", () => {
        document.querySelectorAll("input[name='overtime-emp']").forEach(cb => {
          cb.checked = false;
        });
        this.updateSelectedEmployeeCount();
      });
    }

    // Servis Detay Alanı Gizle/Göster
    if (checkTransport && transportContainer) {
      checkTransport.addEventListener("change", (e) => {
        if (e.target.checked) {
          transportContainer.classList.remove("hidden");
        } else {
          transportContainer.classList.add("hidden");
        }
      });
    }

    if (filterStatus) {
      filterStatus.addEventListener("change", (e) => {
        this.filterStatus = e.target.value;
        this.render();
      });
    }

    if (filterDept) {
      filterDept.addEventListener("change", (e) => {
        this.filterDept = e.target.value;
        this.render();
      });
    }

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveOvertimeRequest();
      });
    }
  }

  calculateHours() {
    const startTimeInput = document.getElementById("overtime-start-time");
    const endTimeInput = document.getElementById("overtime-end-time");
    const hoursInput = document.getElementById("overtime-hours");
    const hoursBadge = document.getElementById("overtime-hours-badge");

    if (!startTimeInput || !endTimeInput || !hoursInput) return;

    const startVal = startTimeInput.value;
    const endVal = endTimeInput.value;

    if (!startVal || !endVal) return;

    const [startH, startM] = startVal.split(":").map(Number);
    const [endH, endM] = endVal.split(":").map(Number);

    let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    if (diffMinutes <= 0) {
      // Gece vardiyası (ertesi güne sarkma)
      diffMinutes += 24 * 60;
    }

    const calculatedHours = Math.round((diffMinutes / 60) * 10) / 10;
    hoursInput.value = calculatedHours;

    if (hoursBadge) {
      hoursBadge.textContent = `${calculatedHours} Saat`;
    }
  }

  saveOvertimeRequest() {
    const isAuthorized = isManagerOrHr();
    const myEmp = getCurrentUserEmployee();

    let checkedEmployees = Array.from(document.querySelectorAll("input[name='overtime-emp']:checked"));

    // Yetkisiz kullanıcılar için sıkı denetim:
    if (!isAuthorized) {
      if (!myEmp) {
        alert("Yetki Hatası: Sistemde adınıza kayıtlı çalışan profili bulunamadı. Mesai talebi oluşturulamaz.");
        return;
      }
      // Checkbox disabled olduğunda da myEmp'i garantiye al
      if (checkedEmployees.length === 0) {
        checkedEmployees = [{ value: myEmp.id, getAttribute: (attr) => attr === "data-name" ? myEmp.name : "" }];
      } else {
        const hasOthers = checkedEmployees.some(cb => cb.value !== myEmp.id);
        if (hasOthers || checkedEmployees.length > 1) {
          alert("Lütfen yalnızca kendi adınıza fazla mesai talebi oluşturunuz.");
          return;
        }
      }
    }

    if (checkedEmployees.length === 0) {
      alert("Lütfen fazla mesaiye kalacak en az 1 personel seçiniz.");
      return;
    }

    const employeeIds = checkedEmployees.map(cb => cb.value);
    const employeeNames = checkedEmployees.map(cb => cb.getAttribute("data-name") || (myEmp ? myEmp.name : "")).join(", ");
    const deptId = document.getElementById("overtime-department").value;
    const dateVal = document.getElementById("overtime-date").value;
    const startVal = document.getElementById("overtime-start-time").value;
    const endVal = document.getElementById("overtime-end-time").value;
    const hoursVal = parseFloat(document.getElementById("overtime-hours").value) || 0;
    const rateTypeVal = document.getElementById("overtime-rate-type").value;
    const reasonVal = document.getElementById("overtime-reason").value.trim();
    const needTransportVal = document.getElementById("overtime-need-transport").checked;
    const transportDetailVal = document.getElementById("overtime-transport-detail").value.trim();
    const needMealVal = document.getElementById("overtime-need-meal").checked;
    const mealDetailVal = document.getElementById("overtime-meal-detail").value.trim();
    const notesVal = document.getElementById("overtime-notes").value.trim();

    if (!dateVal || !startVal || !endVal || hoursVal <= 0) {
      alert("Lütfen mesai tarihi ve saat aralığını eksiksiz giriniz.");
      return;
    }

    if (!reasonVal) {
      alert("Lütfen mesai gerekçesini / iş emri açıklamasını yazınız.");
      return;
    }

    const newReq = {
      id: "ot_" + Date.now(),
      employeeIds: employeeIds,
      employeeNames: employeeNames,
      departmentId: deptId,
      requestedBy: appState.state.currentUser.name,
      date: dateVal,
      startTime: startVal,
      endTime: endVal,
      hours: hoursVal,
      rateType: rateTypeVal,
      reason: reasonVal,
      needTransport: needTransportVal,
      transportDetail: needTransportVal ? (transportDetailVal || "Servis talep edildi") : "Servis yok",
      needMeal: needMealVal,
      mealDetail: needMealVal ? (mealDetailVal || "Fabrika yemeği / Kumanya talep edildi") : "Yemek yok",
      status: "Beklemede",
      requestDate: new Date().toISOString(),
      notes: notesVal,
      processedBy: null,
      hrNotes: null
    };

    if (!appState.state.overtimeRequests) {
      appState.state.overtimeRequests = [];
    }

    appState.state.overtimeRequests.unshift(newReq);
    appState.saveState();

    playAlertSound("call");

    logSystemAction(
      "MESAİ_TALEBİ",
      `${appState.state.currentUser.name}, "${employeeNames}" için ${dateVal} tarihinde ${hoursVal} saat (${rateTypeVal}) fazla mesai talebi açtı. Gerekçe: ${reasonVal}`,
      { overtimeId: newReq.id, hours: hoursVal, employees: employeeNames }
    );

    // Formu temizle ve modalı kapat
    document.getElementById("form-request-overtime").reset();
    document.getElementById("modal-request-overtime").classList.remove("show");

    this.render();

    alert("Fazla mesai talebi başarıyla oluşturuldu ve İK onay ekranına iletildi.");
  }

  processHrAction(overtimeId, newStatus) {
    const req = appState.state.overtimeRequests.find(r => r.id === overtimeId);
    if (!req) return;

    let hrNote = prompt(`İşlem: ${newStatus}\nLütfen İK karar notunu ekleyin (opsiyonel):`);
    if (hrNote === null) return; // İptal edildi

    req.status = newStatus;
    req.processedBy = appState.state.currentUser.name;
    req.hrNotes = `${appState.state.currentUser.name}: ${hrNote || 'İşlem tamamlandı.'}`;

    appState.saveState();

    if (newStatus === "Onaylandı") {
      playAlertSound("notification");
    }

    const actionKey = newStatus === "Onaylandı" ? "MESAİ_ONAYLANDI" : (newStatus === "Revize İstendi" ? "MESAİ_REVİZE_İSTENDİ" : "MESAİ_REDDEDİLDİ");

    logSystemAction(
      actionKey,
      `${req.employeeNames} personellerinin ${req.date} tarihli (${req.hours} saat) mesai talebi ${appState.state.currentUser.name} tarafından "${newStatus}" olarak işlendi.${hrNote ? ' Not: ' + hrNote : ''}`,
      { overtimeId: req.id, status: newStatus, hrNote }
    );

    this.render();

    // Takvim modülü açıksa güncelle
    if (window.portalApp && window.portalApp.calendar) {
      window.portalApp.calendar.render();
    }
  }

  deleteOvertimeRequest(overtimeId) {
    if (!isManagerOrHr()) {
      alert("Yetki Hatası: Yalnızca İK veya Yönetici personeller mesai talebini silebilir!");
      return;
    }

    const req = appState.state.overtimeRequests.find(r => r.id === overtimeId);
    if (!req) return;

    if (confirm(`"${req.employeeNames}" için açılan mesai talebini silmek istediğinize emin misiniz?`)) {
      appState.state.overtimeRequests = appState.state.overtimeRequests.filter(r => r.id !== overtimeId);
      appState.saveState();

      logSystemAction(
        "MESAİ_SİLME",
        `${req.employeeNames} personellerinin ${req.date} tarihli mesai talebi silindi.`,
        { overtimeId }
      );

      this.render();
    }
  }

  render() {
    this.renderRequestsList();
    this.renderStatistics();
    this.renderEmployeeOvertimeTable();
    this.updatePendingBadge();
  }

  updatePendingBadge() {
    const badge = document.getElementById("overtime-pending-badge");
    if (!badge) return;

    const pendingCount = (appState.state.overtimeRequests || []).filter(r => r.status === "Beklemede").length;
    if (pendingCount > 0) {
      badge.textContent = `${pendingCount} Yeni`;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  renderStatistics() {
    const statsContainer = document.getElementById("overtime-stats-summary");
    if (!statsContainer) return;

    const list = appState.state.overtimeRequests || [];
    const approvedList = list.filter(r => r.status === "Onaylandı");
    const pendingList = list.filter(r => r.status === "Beklemede");

    // Toplam onaylanan mesai saati (her personelin saatleri toplamı)
    let totalApprovedPersonHours = 0;
    approvedList.forEach(r => {
      const personCount = (r.employeeIds && r.employeeIds.length) || 1;
      totalApprovedPersonHours += (r.hours * personCount);
    });

    // Mesaiye kalan benzersiz personel sayısı
    const uniqueEmployees = new Set();
    approvedList.forEach(r => {
      if (r.employeeIds) {
        r.employeeIds.forEach(id => uniqueEmployees.add(id));
      }
    });

    statsContainer.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-3.5 rounded-xl shadow-sm">
          <div class="text-[11px] font-bold uppercase tracking-wider text-blue-100">Toplam Onaylı Mesai</div>
          <div class="text-2xl font-black mt-1">${totalApprovedPersonHours.toFixed(1)} <span class="text-sm font-semibold">Adam/Saat</span></div>
          <div class="text-[10px] text-blue-100 mt-0.5">Fabrika geneli tamamlanan</div>
        </div>

        <div class="bg-gradient-to-br from-amber-500 to-amber-700 text-white p-3.5 rounded-xl shadow-sm">
          <div class="text-[11px] font-bold uppercase tracking-wider text-amber-100">İK Onayı Bekleyen</div>
          <div class="text-2xl font-black mt-1">${pendingList.length} <span class="text-sm font-semibold">Talep</span></div>
          <div class="text-[10px] text-amber-100 mt-0.5">Karar verilmeyi bekliyor</div>
        </div>

        <div class="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-3.5 rounded-xl shadow-sm">
          <div class="text-[11px] font-bold uppercase tracking-wider text-emerald-100">Onaylanan Görev</div>
          <div class="text-2xl font-black mt-1">${approvedList.length} <span class="text-sm font-semibold">Vardiya</span></div>
          <div class="text-[10px] text-emerald-100 mt-0.5">İK tarafından onaylandı</div>
        </div>

        <div class="bg-gradient-to-br from-purple-500 to-purple-700 text-white p-3.5 rounded-xl shadow-sm">
          <div class="text-[11px] font-bold uppercase tracking-wider text-purple-100">Mesaili Personel</div>
          <div class="text-2xl font-black mt-1">${uniqueEmployees.size} <span class="text-sm font-semibold">Çalışan</span></div>
          <div class="text-[10px] text-purple-100 mt-0.5">Bu ay fazla mesai yapan</div>
        </div>
      </div>
    `;
  }

  renderRequestsList() {
    const container = document.getElementById("overtime-requests-list");
    if (!container) return;

    let items = [...(appState.state.overtimeRequests || [])].sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));

    if (this.filterStatus !== "ALL") {
      items = items.filter(r => r.status === this.filterStatus);
    }

    if (this.filterDept !== "ALL") {
      items = items.filter(r => r.departmentId === this.filterDept);
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
          <p class="text-3xl mb-2">⏰</p>
          <p class="font-bold text-slate-600">Seçili filtrelere uygun fazla mesai talebi bulunmuyor.</p>
          <p class="text-xs text-slate-400 mt-1">Ustalar yukarıdaki "+ Mesai Talebi Aç" butonuyla yeni talep oluşturabilir.</p>
        </div>
      `;
      return;
    }

    const currentUser = appState.state.currentUser || {};
    const isHrOrAdmin = currentUser.role === "IK" || currentUser.role === "ADMIN";

    container.innerHTML = items.map(req => {
      const dep = appState.state.departments.find(d => d.id === req.departmentId) || { name: "-", icon: "🏢" };
      const personCount = (req.employeeIds && req.employeeIds.length) || 1;
      const totalBatchHours = (req.hours * personCount).toFixed(1);

      let statusBadge = "";
      if (req.status === "Beklemede") {
        statusBadge = `<span class="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">⏳ İK Onayı Bekliyor</span>`;
      } else if (req.status === "Onaylandı") {
        statusBadge = `<span class="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">✅ Onaylandı</span>`;
      } else if (req.status === "Revize İstendi") {
        statusBadge = `<span class="bg-purple-100 text-purple-800 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">🔄 Revize İstendi</span>`;
      } else {
        statusBadge = `<span class="bg-red-100 text-red-800 text-xs px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">❌ Reddedildi</span>`;
      }

      const reqDateFormatted = new Date(req.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

      return `
        <div class="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 hover:border-slate-300 transition">
          <!-- Üst Başlık & Durum -->
          <div class="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-base font-extrabold text-slate-900">${req.employeeNames}</span>
                <span class="text-[11px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">${personCount} Personel</span>
                <span class="text-[11px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded">${req.rateType}</span>
              </div>
              <div class="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                <span>Departman: <b class="text-slate-700">${dep.icon} ${dep.name}</b></span>
                <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">👤 Talep Eden Usta: ${req.requestedBy}</span>
                ${req.processedBy ? `<span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">👔 İK Sorumlusu: ${req.processedBy}</span>` : ''}
              </div>
            </div>
            <div>${statusBadge}</div>
          </div>

          <!-- Mesai Zamanı ve Bilgileri -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg text-xs">
            <div>
              <span class="text-slate-400 block font-medium">Mesai Tarihi:</span>
              <span class="font-bold text-slate-800">${reqDateFormatted}</span>
            </div>
            <div>
              <span class="text-slate-400 block font-medium">Saat Aralığı:</span>
              <span class="font-bold text-slate-800">${req.startTime} - ${req.endTime}</span>
            </div>
            <div>
              <span class="text-slate-400 block font-medium">Kişi Başı Süre:</span>
              <span class="font-bold text-blue-700">${req.hours} Saat</span>
            </div>
            <div>
              <span class="text-slate-400 block font-medium">Toplam İş Gücü:</span>
              <span class="font-bold text-indigo-700">${totalBatchHours} Adam/Saat</span>
            </div>
          </div>

          <!-- Mesai Nedeni / Gerekçesi -->
          <div class="text-xs bg-amber-50/60 p-2.5 rounded-lg border border-amber-100 text-slate-700">
            <span class="font-bold text-amber-900 block mb-0.5">⚡ Mesai Gerekçesi & İş Emri:</span>
            <span>${req.reason}</span>
          </div>

          <!-- Lojistik & Yemek Rozetleri -->
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <div class="px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 ${req.needTransport ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500'}">
              <span>🚌</span>
              <span><b>Servis:</b> ${req.needTransport ? req.transportDetail : 'Gerek Yok (Kendi İmkanı)'}</span>
            </div>
            <div class="px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 ${req.needMeal ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-500'}">
              <span>🍲</span>
              <span><b>Yemek:</b> ${req.needMeal ? req.mealDetail : 'Gerek Yok'}</span>
            </div>
          </div>

          ${req.notes ? `
            <div class="text-xs text-slate-500 italic">
              <b>Usta Notu:</b> ${req.notes}
            </div>
          ` : ''}

          ${req.hrNotes ? `
            <div class="text-xs text-blue-900 bg-blue-50/70 p-2.5 rounded-lg border border-blue-200">
              <span class="font-bold block mb-0.5">👔 İK Değerlendirme & Karar Notu:</span>
              <span>${req.hrNotes}</span>
            </div>
          ` : ''}

          <!-- İK Karar Butonları -->
          ${isHrOrAdmin && req.status === "Beklemede" ? `
            <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              <button data-action-overtime="Onaylandı" data-overtime-id="${req.id}" class="flex-1 min-w-[120px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 shadow-sm">
                <span>✓</span> <span>Onayla</span>
              </button>
              <button data-action-overtime="Revize İstendi" data-overtime-id="${req.id}" class="flex-1 min-w-[120px] bg-purple-600 hover:bg-purple-700 text-white text-xs py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 shadow-sm">
                <span>🔄</span> <span>Revize İste</span>
              </button>
              <button data-action-overtime="Reddedildi" data-overtime-id="${req.id}" class="flex-1 min-w-[120px] bg-red-600 hover:bg-red-700 text-white text-xs py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 shadow-sm">
                <span>✕</span> <span>Reddet</span>
              </button>
              <button data-delete-overtime="${req.id}" class="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs py-2 px-3 rounded-lg font-bold transition">
                <span>🗑️</span>
              </button>
            </div>
          ` : (isHrOrAdmin ? `
            <div class="flex justify-end pt-1">
              <button data-delete-overtime="${req.id}" class="text-slate-400 hover:text-red-600 text-xs font-semibold transition">
                Talebi Sistemden Sil
              </button>
            </div>
          ` : '')}
        </div>
      `;
    }).join("");

    // İK Buton Dinleyicileri
    container.querySelectorAll("[data-action-overtime]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-overtime-id");
        const status = e.currentTarget.getAttribute("data-action-overtime");
        this.processHrAction(id, status);
      });
    });

    container.querySelectorAll("[data-delete-overtime]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-delete-overtime");
        this.deleteOvertimeRequest(id);
      });
    });
  }

  renderEmployeeOvertimeTable() {
    const tbody = document.getElementById("overtime-employee-table-body");
    if (!tbody) return;

    const employees = appState.state.employees || [];
    const overtimeRequests = appState.state.overtimeRequests || [];
    const approvedRequests = overtimeRequests.filter(r => r.status === "Onaylandı");

    // Personel bazında saatleri topla
    const employeeHoursMap = {};
    const employeeShiftCountMap = {};

    employees.forEach(emp => {
      employeeHoursMap[emp.id] = 0;
      employeeShiftCountMap[emp.id] = 0;
    });

    approvedRequests.forEach(req => {
      if (req.employeeIds && Array.isArray(req.employeeIds)) {
        req.employeeIds.forEach(empId => {
          if (employeeHoursMap[empId] !== undefined) {
            employeeHoursMap[empId] += req.hours;
            employeeShiftCountMap[empId] += 1;
          }
        });
      }
    });

    tbody.innerHTML = employees.map(emp => {
      const dep = appState.state.departments.find(d => d.id === emp.departmentId) || { name: "-", icon: "" };
      const hours = employeeHoursMap[emp.id] || 0;
      const shifts = employeeShiftCountMap[emp.id] || 0;

      // Aylık yasal limit uyarısı (Örn: 22.5 saat üzeri dikkat, 45 saat üzeri kritik)
      let statusBadge = `<span class="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded">Normal</span>`;
      if (hours >= 25) {
        statusBadge = `<span class="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded">⚠️ Yüksek Mesai</span>`;
      } else if (hours >= 12) {
        statusBadge = `<span class="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded">Orta Düzey</span>`;
      }

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
          <td class="py-2.5 px-3">
            <span class="font-bold text-slate-800">${emp.name}</span>
          </td>
          <td class="py-2.5 px-3 text-slate-600 font-medium">
            ${dep.icon} ${dep.name}
          </td>
          <td class="py-2.5 px-3 text-center font-bold text-slate-700">
            ${shifts} Vardiya
          </td>
          <td class="py-2.5 px-3 text-center">
            <span class="font-extrabold text-blue-700 text-sm">${hours.toFixed(1)}</span> <span class="text-slate-400 text-[11px]">Saat</span>
          </td>
          <td class="py-2.5 px-3 text-center">
            ${statusBadge}
          </td>
        </tr>
      `;
    }).join("");
  }
}
