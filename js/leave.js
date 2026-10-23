// SODSAN Fabrika Portalı - İK ve İzin Yönetim Modülü (leave.js)
import { appState, playAlertSound, logSystemAction, getRoleInfo, isManagerOrHr, getCurrentUserEmployee } from './data.js';

export class LeaveModule {
  constructor() {
    this.filterStatus = "ALL";
    this.activeEmpTab = "FIELD"; // "FIELD" (Saha/Çalışan) veya "OFFICE" (İdari, Usta, Bakım vb.)
    this.empSearchQuery = "";
    this.pendingImportEmployees = [];
  }

  init() {
    if (appState && typeof appState.syncUsersToEmployees === "function") {
      appState.syncUsersToEmployees();
    }
    this.populateEmployeeSelect();
    this.populateDepartmentSelect();
    this.bindEvents();
    this.render();
  }

  populateEmployeeSelect() {
    const empSelect = document.getElementById("leave-employee");
    if (!empSelect) return;

    const employees = appState.state.employees || [];
    const myEmp = getCurrentUserEmployee();
    const isAuthorized = isManagerOrHr();

    // Yetki bilgilendirme rozeti
    let noticeEl = document.getElementById("leave-permission-notice");
    if (!noticeEl) {
      noticeEl = document.createElement("div");
      noticeEl.id = "leave-permission-notice";
      noticeEl.className = "text-[11px] font-semibold mt-1 p-2 rounded-lg";
      empSelect.parentNode.appendChild(noticeEl);
    }

    if (noticeEl) {
      noticeEl.innerHTML = "";
      noticeEl.className = "hidden";
    }

    if (isAuthorized) {
      // YETKİLİ PERSONEL: Tüm çalışanlar listelenir
      empSelect.disabled = false;
      empSelect.innerHTML = `<option value="">-- Personel Seçiniz --</option>`;
      employees.forEach(emp => {
        const dep = appState.state.departments.find(d => d.id === emp.departmentId) || { name: "" };
        const isMe = myEmp && emp.id === myEmp.id;
        empSelect.innerHTML += `
          <option value="${emp.id}" data-dept="${emp.departmentId}" data-remaining="${emp.remainingLeave}" ${isMe ? 'selected' : ''}>
            ${emp.name} (${dep.name || 'Genel'} - Kalan: ${emp.remainingLeave} Gün)
          </option>
        `;
      });

      if (myEmp && !empSelect.value) {
        empSelect.value = myEmp.id;
      }
    } else {
      // STANDART PERSONEL: Kendi profili doğrudan seçili gelir
      if (myEmp) {
        const dep = appState.state.departments.find(d => d.id === myEmp.departmentId) || { name: "" };
        empSelect.innerHTML = `
          <option value="${myEmp.id}" data-dept="${myEmp.departmentId}" data-remaining="${myEmp.remainingLeave}" selected>
            ${myEmp.name} (${dep.name || 'Genel'} - Kalan İzin: ${myEmp.remainingLeave} Gün)
          </option>
        `;
        empSelect.value = myEmp.id;
        empSelect.disabled = true;
      } else {
        empSelect.innerHTML = `<option value="">-- Çalışan profiliniz bulunamadı --</option>`;
        empSelect.disabled = true;
      }
    }
  }

  populateDepartmentSelect() {
    const depSelect = document.getElementById("employee-department");
    if (!depSelect) return;
    depSelect.innerHTML = "";
    appState.state.departments.forEach(dep => {
      depSelect.innerHTML += `<option value="${dep.id}">${dep.icon} ${dep.name}</option>`;
    });
  }

  bindEvents() {
    const btnOpenModal = document.getElementById("btn-open-request-leave");
    const form = document.getElementById("form-request-leave");
    const empSelect = document.getElementById("leave-employee");
    const startDateInput = document.getElementById("leave-start-date");
    const endDateInput = document.getElementById("leave-end-date");
    const daysCountInput = document.getElementById("leave-days-count");
    const filterStatus = document.getElementById("filter-leave-status");

    // 50+ Personel Sekmeleri Dinleyicileri (Saha vs İdari/Usta)
    const tabFieldBtn = document.getElementById("emp-tab-field");
    const tabOfficeBtn = document.getElementById("emp-tab-office");
    const searchInput = document.getElementById("search-employee-name");
    const clearSearchBtn = document.getElementById("clear-search-emp");

    if (tabFieldBtn && tabOfficeBtn) {
      tabFieldBtn.addEventListener("click", () => {
        this.activeEmpTab = "FIELD";
        tabFieldBtn.className = "px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 bg-white text-blue-700 shadow-sm";
        tabOfficeBtn.className = "px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 text-slate-600 hover:text-slate-900";
        this.renderBalancesTable();
      });

      tabOfficeBtn.addEventListener("click", () => {
        this.activeEmpTab = "OFFICE";
        tabOfficeBtn.className = "px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 bg-white text-blue-700 shadow-sm";
        tabFieldBtn.className = "px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 text-slate-600 hover:text-slate-900";
        this.renderBalancesTable();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.empSearchQuery = (e.target.value || "").trim().toLowerCase();
        if (clearSearchBtn) {
          if (this.empSearchQuery.length > 0) {
            clearSearchBtn.classList.remove("hidden");
          } else {
            clearSearchBtn.classList.add("hidden");
          }
        }
        this.renderBalancesTable();
      });
    }

    if (clearSearchBtn && searchInput) {
      clearSearchBtn.addEventListener("click", () => {
        searchInput.value = "";
        this.empSearchQuery = "";
        clearSearchBtn.classList.add("hidden");
        this.renderBalancesTable();
      });
    }

    // Excel Şablonu İndirme & Toplu Personel Yükleme Dinleyicileri
    const btnDownloadTemplate = document.getElementById("btn-download-emp-excel-template");
    const btnModalDownloadTemplate = document.getElementById("btn-modal-download-excel-template");
    const btnOpenImportExcel = document.getElementById("btn-open-import-emp-excel");
    const inputExcelFile = document.getElementById("input-emp-excel-file");
    const dropZoneExcel = document.getElementById("drop-zone-excel");
    const btnConfirmImport = document.getElementById("btn-confirm-import-excel");

    if (btnDownloadTemplate) {
      btnDownloadTemplate.addEventListener("click", () => this.downloadExcelTemplate());
    }

    if (btnModalDownloadTemplate) {
      btnModalDownloadTemplate.addEventListener("click", () => this.downloadExcelTemplate());
    }

    if (btnOpenImportExcel) {
      btnOpenImportExcel.addEventListener("click", () => {
        this.pendingImportEmployees = [];
        const previewWrap = document.getElementById("import-preview-container");
        if (previewWrap) previewWrap.classList.add("hidden");
        const confirmBtn = document.getElementById("btn-confirm-import-excel");
        if (confirmBtn) confirmBtn.disabled = true;
        const fileInput = document.getElementById("input-emp-excel-file");
        if (fileInput) fileInput.value = "";

        const modal = document.getElementById("modal-import-emp-excel");
        if (modal) modal.classList.add("show");
      });
    }

    if (inputExcelFile) {
      inputExcelFile.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleExcelFile(e.target.files[0]);
        }
      });
    }

    if (dropZoneExcel) {
      dropZoneExcel.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZoneExcel.classList.add("border-blue-500", "bg-blue-50/50");
      });

      dropZoneExcel.addEventListener("dragleave", () => {
        dropZoneExcel.classList.remove("border-blue-500", "bg-blue-50/50");
      });

      dropZoneExcel.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZoneExcel.classList.remove("border-blue-500", "bg-blue-50/50");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleExcelFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (btnConfirmImport) {
      btnConfirmImport.addEventListener("click", () => this.confirmImportExcel());
    }

    // Yeni Personel Ekleme Dinleyicileri
    const btnOpenAddEmp = document.getElementById("btn-open-add-employee");
    const formAddEmp = document.getElementById("form-add-employee");

    if (btnOpenAddEmp) {
      btnOpenAddEmp.addEventListener("click", () => {
        this.populateDepartmentSelect();
        const modal = document.getElementById("modal-add-employee");
        if (modal) modal.classList.add("show");
      });
    }

    if (formAddEmp) {
      formAddEmp.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveNewEmployee();
      });
    }

    if (btnOpenModal) {
      btnOpenModal.addEventListener("click", () => {
        this.populateEmployeeSelect();
        const modal = document.getElementById("modal-request-leave");
        if (modal) modal.classList.add("show");
      });
    }

    // Tarih seçildiğinde gün sayısını otomatik hesapla
    const calculateDays = () => {
      if (startDateInput && endDateInput && daysCountInput) {
        const start = new Date(startDateInput.value);
        const end = new Date(endDateInput.value);
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          const diffTime = Math.abs(end - start);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          daysCountInput.value = diffDays;
        }
      }
    };

    if (startDateInput) startDateInput.addEventListener("change", calculateDays);
    if (endDateInput) endDateInput.addEventListener("change", calculateDays);

    if (filterStatus) {
      filterStatus.addEventListener("change", (e) => {
        this.filterStatus = e.target.value;
        this.render();
      });
    }

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveLeaveRequest();
      });
    }
  }

  saveNewEmployee() {
    const nameInput = document.getElementById("employee-name");
    const deptSelect = document.getElementById("employee-department");
    const totalLeaveInput = document.getElementById("employee-total-leave");
    const hireDateInput = document.getElementById("employee-hire-date");

    const name = nameInput ? nameInput.value.trim() : "";
    const departmentId = deptSelect ? deptSelect.value : "";
    const totalLeave = parseInt(totalLeaveInput ? totalLeaveInput.value : 14) || 14;
    const hireDate = (hireDateInput && hireDateInput.value) ? hireDateInput.value : new Date().toISOString().split("T")[0];

    if (!name || !departmentId) {
      alert("Lütfen personel adını ve departmanını eksiksiz giriniz.");
      return;
    }

    if (!Array.isArray(appState.state.employees)) {
      appState.state.employees = [];
    }

    const newEmp = {
      id: "emp_" + Date.now(),
      name,
      departmentId,
      role: "PERSONEL",
      totalLeave,
      usedLeave: 0,
      remainingLeave: totalLeave,
      hireDate
    };

    appState.state.employees.push(newEmp);
    appState.saveState();

    const depObj = appState.state.departments.find(d => d.id === departmentId) || { name: "" };
    const uName = appState.state.currentUser ? appState.state.currentUser.name : "Yetkili";
    logSystemAction(
      "PERSONEL_EKLE",
      `${uName}, "${name}" (${depObj.name}) isimli yeni personeli izin çizelgesine ekledi.`,
      { name, department: depObj.name, totalLeave, hireDate }
    );

    playAlertSound("call");

    document.getElementById("form-add-employee").reset();
    document.getElementById("modal-add-employee").classList.remove("show");

    this.populateEmployeeSelect();
    this.render();
  }

  render() {
    this.renderRequestsList();
    this.renderBalancesTable();
    this.renderWorkforceChart();
  }

  renderRequestsList() {
    const container = document.getElementById("leave-requests-list");
    if (!container) return;

    let items = [...appState.state.leaveRequests].sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));

    if (this.filterStatus !== "ALL") {
      items = items.filter(r => r.status === this.filterStatus);
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
          <p class="text-2xl mb-1">🏖️</p>
          <p class="font-medium">Kayıtlı izin talebi bulunmuyor.</p>
        </div>
      `;
      return;
    }

    const user = appState.state.currentUser;
    const isHrOrAdmin = user ? (user.role === "IK" || user.role === "ADMIN") : true;

    container.innerHTML = items.map(req => {
      const dep = appState.state.departments.find(d => d.id === req.departmentId) || { name: "", icon: "🏢" };
      
      let statusBadge = "";
      if (req.status === "Beklemede") {
        statusBadge = `<span class="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold">⏳ İK Onayı Bekliyor</span>`;
      } else if (req.status === "Onaylandı") {
        statusBadge = `<span class="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold">✅ Onaylandı</span>`;
      } else if (req.status === "Revize İstendi") {
        statusBadge = `<span class="bg-purple-100 text-purple-800 text-xs px-2.5 py-1 rounded-full font-bold">🔄 Revize İstendi</span>`;
      } else {
        statusBadge = `<span class="bg-red-100 text-red-800 text-xs px-2.5 py-1 rounded-full font-bold">❌ Reddedildi</span>`;
      }

      return `
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-black text-slate-900 text-base">${req.employeeName}</span>
                <span class="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded">${req.leaveType}</span>
              </div>
              <div class="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                <span>Departman: <b>${dep.name}</b></span>
                <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">👤 Talep Eden Usta: ${req.requestedBy}</span>
                ${req.processedBy ? `<span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">👔 İK Sorumlusu: ${req.processedBy}</span>` : ''}
              </div>
            </div>
            <div>${statusBadge}</div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg text-xs">
            <div>
              <span class="text-slate-400 block font-medium">Başlangıç:</span>
              <span class="font-bold text-slate-700">${req.startDate}</span>
            </div>
            <div>
              <span class="text-slate-400 block font-medium">Bitiş:</span>
              <span class="font-bold text-slate-700">${req.endDate}</span>
            </div>
            <div>
              <span class="text-slate-400 block font-medium">Toplam Süre:</span>
              <span class="font-bold text-blue-700">${req.daysCount} Gün</span>
            </div>
          </div>

          ${req.notes ? `
            <div class="text-xs text-slate-600 bg-amber-50/50 p-2 rounded border border-amber-100">
              <b>Usta Notu:</b> ${req.notes}
            </div>
          ` : ''}

          ${req.hrNotes ? `
            <div class="text-xs text-slate-700 bg-blue-50/50 p-2 rounded border border-blue-100">
              <b>İK Notu:</b> ${req.hrNotes}
            </div>
          ` : ''}

          ${isHrOrAdmin && req.status === "Beklemede" ? `
            <div class="flex gap-2 pt-2 border-t border-slate-100">
              <button data-action-leave="Onaylandı" data-leave-id="${req.id}" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1">
                ✓ Onayla
              </button>
              <button data-action-leave="Revize İstendi" data-leave-id="${req.id}" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1">
                🔄 Revize İste
              </button>
              <button data-action-leave="Reddedildi" data-leave-id="${req.id}" class="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1">
                ✕ Reddet
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join("");

    // İK Aksiyon Dinleyicileri
    container.querySelectorAll("[data-action-leave]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-leave-id");
        const newStatus = e.currentTarget.getAttribute("data-action-leave");
        this.processHrAction(id, newStatus);
      });
    });
  }

  processHrAction(leaveId, newStatus) {
    const req = appState.state.leaveRequests.find(r => r.id === leaveId);
    if (!req) return;

    let hrNote = prompt(`İşlem: ${newStatus}\nLütfen İK notu ekleyin (opsiyonel):`);
    if (hrNote === null) return; // İptal edildi

    const uName = appState.state.currentUser ? appState.state.currentUser.name : "İK Yöneticisi";
    req.status = newStatus;
    req.processedBy = uName;
    req.hrNotes = `${uName}: ${hrNote || 'İşlem tamamlandı.'}`;

    // Eğer Onaylandı ise ve Yıllık İzin ise çalışanın kalan iznini düşür
    if (newStatus === "Onaylandı" && req.leaveType === "Yıllık İzin") {
      const emp = appState.state.employees.find(e => e.id === req.employeeId);
      if (emp) {
        emp.usedLeave += req.daysCount;
        emp.remainingLeave = Math.max(0, emp.totalLeave - emp.usedLeave);
      }
    }

    appState.saveState();

    logSystemAction(
      "İZİN_ONAYI",
      `${uName}, "${req.employeeName}" personelinin izin talebini [${newStatus}] olarak güncelledi.`,
      { employee: req.employeeName, status: newStatus, hrNote }
    );

    playAlertSound("call");
    this.render();
  }

  renderBalancesTable() {
    const tableBody = document.getElementById("leave-balances-table-body");
    if (!tableBody) return;

    const employees = appState.state.employees || [];

    // Sayaçları güncelle
    const fieldCount = employees.filter(e => (e.role || "PERSONEL") === "PERSONEL").length;
    const officeCount = employees.filter(e => (e.role || "PERSONEL") !== "PERSONEL").length;

    const badgeTotal = document.getElementById("emp-total-badge");
    const badgeField = document.getElementById("count-emp-field");
    const badgeOffice = document.getElementById("count-emp-office");

    if (badgeTotal) badgeTotal.textContent = `${employees.length} Çalışan`;
    if (badgeField) badgeField.textContent = fieldCount;
    if (badgeOffice) badgeOffice.textContent = officeCount;

    if (employees.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="py-10 text-center text-slate-400 text-xs font-medium bg-slate-50/50">
            <p class="text-2xl mb-1.5">👥</p>
            <p class="text-sm font-bold text-slate-700">Personel İzin Bakiye Çizelgesinde Kayıt Bulunmuyor</p>
            <p class="text-xs text-slate-400 mt-1">Fabrika çalışanlarınızı eklemek için yukarıdaki <b>"+ Yeni Personel Ekle"</b> butonunu kullanabilirsiniz.</p>
          </td>
        </tr>
      `;
      return;
    }

    // Aktif sekmeye göre filtrele (Saha Personeli vs İdari / Usta / Diğer Roller)
    let filtered = employees.filter(emp => {
      const role = emp.role || "PERSONEL";
      if (this.activeEmpTab === "FIELD") {
        return role === "PERSONEL";
      } else {
        return role !== "PERSONEL";
      }
    });

    // Canlı arama filtresi (50+ personel için)
    if (this.empSearchQuery) {
      filtered = filtered.filter(emp => {
        const dep = appState.state.departments.find(d => d.id === emp.departmentId) || { name: "" };
        const roleInfo = getRoleInfo(emp.role);
        const searchStr = `${emp.name} ${dep.name} ${roleInfo.title || ''} ${emp.role || ''}`.toLowerCase();
        return searchStr.includes(this.empSearchQuery);
      });
    }

    if (filtered.length === 0) {
      const tabLabel = this.activeEmpTab === "FIELD" ? "Saha Personeli / Çalışan" : "İdari, Usta & Diğer Roller";
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="py-8 text-center text-slate-400 text-xs font-medium bg-slate-50/50">
            <p class="text-xl mb-1">🔍</p>
            <p class="font-bold text-slate-700">Bu sekmede (${tabLabel}) eşleşen personel bulunamadı.</p>
            ${this.empSearchQuery ? `<p class="text-xs text-slate-400 mt-1">"${this.empSearchQuery}" aramasına uygun sonuç yok.</p>` : ''}
          </td>
        </tr>
      `;
      return;
    }

    const currentUserId = appState.state.currentUser ? appState.state.currentUser.id : null;
    const currentUserName = appState.state.currentUser ? appState.state.currentUser.name : "";
    const isHrOrAdmin = appState.state.currentUser && (appState.state.currentUser.role === "ADMIN" || appState.state.currentUser.role === "IK");

    tableBody.innerHTML = filtered.map(emp => {
      const dep = appState.state.departments.find(d => d.id === emp.departmentId) || { name: "-" };
      const roleInfo = getRoleInfo(emp.role);
      const isMe = (currentUserId && (emp.userId === currentUserId || emp.id === currentUserId)) || (currentUserName && emp.name === currentUserName);
      const percentUsed = emp.totalLeave > 0 ? Math.min(100, Math.round((emp.usedLeave / emp.totalLeave) * 100)) : 0;

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-sm">
          <td class="py-3 px-3 font-bold text-slate-800">
            <div class="flex items-center gap-1.5">
              <span>${emp.name}</span>
              ${isMe ? `<span class="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">SİZ</span>` : ''}
            </div>
          </td>
          <td class="py-3 px-3 whitespace-nowrap">
            <span class="${roleInfo.badge || 'bg-slate-100 text-slate-800'} text-[11px] font-bold px-2 py-0.5 rounded inline-block">
              ${roleInfo.title}
            </span>
          </td>
          <td class="py-3 px-3 text-slate-600 text-xs font-medium whitespace-nowrap">${dep.name}</td>
          <td class="py-3 px-3 text-center font-medium">${emp.totalLeave} Gün</td>
          <td class="py-3 px-3 text-center text-slate-500">${emp.usedLeave} Gün</td>
          <td class="py-3 px-3 text-center font-black ${emp.remainingLeave <= 3 ? 'text-red-600' : 'text-emerald-700'}">
            ${emp.remainingLeave} Gün
          </td>
          <td class="py-3 px-3">
            <div class="w-24 bg-slate-100 rounded-full h-2 overflow-hidden mx-auto">
              <div class="bg-blue-600 h-2 rounded-full" style="width: ${percentUsed}%"></div>
            </div>
            <div class="text-[10px] text-center text-slate-400 mt-0.5">%${percentUsed} kullanıldı</div>
          </td>
          <td class="py-3 px-3 text-center whitespace-nowrap">
            ${isHrOrAdmin ? `
              <button data-delete-employee="${emp.id}" class="text-red-500 hover:text-red-700 font-bold text-xs p-1 rounded hover:bg-red-50 transition" title="Personeli Kaldır">
                🗑️ Sil
              </button>
            ` : `
              <span class="text-slate-400 text-[11px]">-</span>
            `}
          </td>
        </tr>
      `;
    }).join("");

    // Personel Silme Dinleyicileri (Sadece İK ve Admin)
    tableBody.querySelectorAll("[data-delete-employee]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const empId = e.currentTarget.getAttribute("data-delete-employee");
        const target = appState.state.employees.find(emp => emp.id === empId);
        if (!target) return;

        if (confirm(`"${target.name}" personelini izin çizelgesinden silmek istediğinize emin misiniz?`)) {
          const uName = appState.state.currentUser ? appState.state.currentUser.name : "Yetkili";
          logSystemAction("PERSONEL_SİLME", `${uName}, "${target.name}" isimli personeli çizelgeden sildi.`);
          appState.state.employees = appState.state.employees.filter(emp => emp.id !== empId);
          appState.saveState();
          this.populateEmployeeSelect();
          this.render();
        }
      });
    });
  }

  renderWorkforceChart() {
    const chartContainer = document.getElementById("workforce-distribution-chart");
    if (!chartContainer) return;

    // Fabrika geneli izinli ve aktif personel oranları
    const totalStaff = (appState.state.employees || []).length;
    const todayKey = new Date().toISOString().split("T")[0];

    const activeLeaves = appState.state.leaveRequests.filter(l => 
      l.status === "Onaylandı" && todayKey >= l.startDate && todayKey <= l.endDate
    ).length;

    const workingStaff = Math.max(0, totalStaff - activeLeaves);
    const capacityPercent = totalStaff > 0 ? Math.round((workingStaff / totalStaff) * 100) : 100;

    chartContainer.innerHTML = `
      <div class="flex flex-col md:flex-row items-center justify-between gap-6 p-4">
        <div class="flex items-center gap-4">
          <div class="relative w-28 h-28 flex items-center justify-center">
            <!-- Dairesel Gösterge (SVG) -->
            <svg class="w-28 h-28 transform -rotate-90">
              <circle cx="56" cy="56" r="46" stroke="#e2e8f0" stroke-width="12" fill="transparent"/>
              <circle cx="56" cy="56" r="46" stroke="#16a34a" stroke-width="12" fill="transparent"
                stroke-dasharray="289" stroke-dashoffset="${289 - (289 * capacityPercent) / 100}"
                stroke-linecap="round"/>
            </svg>
            <div class="absolute text-center">
              <span class="text-xl font-extrabold text-slate-800">%${capacityPercent}</span>
              <span class="block text-[10px] text-slate-400 font-semibold uppercase">Kapasite</span>
            </div>
          </div>

          <div class="space-y-1.5 text-xs">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span>
              <span class="text-slate-600 font-medium">Sahada Aktif Çalışan: <b>${workingStaff} Kişi</b></span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
              <span class="text-slate-600 font-medium">Bugün İzinli / Raporlu: <b>${activeLeaves} Kişi</b></span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-slate-300 inline-block"></span>
              <span class="text-slate-600 font-medium">Toplam Kayıtlı Personel: <b>${totalStaff} Kişi</b></span>
            </div>
          </div>
        </div>

        <div class="bg-blue-50 border border-blue-100 p-3 rounded-xl text-xs text-slate-700 max-w-sm">
          <p class="font-bold text-blue-900 mb-1">💡 Usta & İK Notu</p>
          Ustalar çalışanları adına buradan talep açtığında İK paneline anlık uyarı düşer. İK onayladığında izin takvime otomatik işlenir.
        </div>
      </div>
    `;
  }

  saveLeaveRequest() {
    const empSelect = document.getElementById("leave-employee");
    const empId = empSelect.value;
    const isAuthorized = isManagerOrHr();
    const myEmp = getCurrentUserEmployee();

    // Sıkı Yetki Kontrolü: Yetkisiz kullanıcı başkası adına izin açamaz
    if (!isAuthorized) {
      if (!myEmp || empId !== myEmp.id) {
        alert("Lütfen yalnızca kendi adınıza izin talebi oluşturunuz.");
        return;
      }
    }

    const leaveType = document.getElementById("leave-type").value;
    const startDate = document.getElementById("leave-start-date").value;
    const endDate = document.getElementById("leave-end-date").value;
    const daysCount = parseInt(document.getElementById("leave-days-count").value) || 1;
    const notes = document.getElementById("leave-notes").value.trim();

    if (!empId || !startDate || !endDate) {
      alert("Lütfen personel ve tarih aralığını eksiksiz seçiniz.");
      return;
    }

    const employee = appState.state.employees.find(e => e.id === empId);
    const uName = appState.state.currentUser ? appState.state.currentUser.name : "Personel";
    const userDeptId = appState.state.currentUser ? appState.state.currentUser.departmentId : "";

    const newRequest = {
      id: "leave_" + Date.now(),
      employeeId: empId,
      employeeName: employee ? employee.name : "Personel",
      departmentId: employee ? employee.departmentId : userDeptId,
      requestedBy: uName,
      leaveType,
      startDate,
      endDate,
      daysCount,
      status: "Beklemede",
      requestDate: new Date().toISOString(),
      notes,
      hrNotes: ""
    };

    appState.state.leaveRequests.unshift(newRequest);
    appState.saveState();

    logSystemAction(
      "İZİN_TALEBİ",
      `${uName}, "${newRequest.employeeName}" personeli adına ${newRequest.daysCount} günlük ${newRequest.leaveType} talebi gönderdi.`,
      { employee: newRequest.employeeName, leaveType, daysCount, startDate, endDate }
    );

    playAlertSound("call");

    document.getElementById("form-request-leave").reset();
    document.getElementById("modal-request-leave").classList.remove("show");

    this.render();
  }

  // Boş ve örnek dolu Excel (.xlsx) veya CSV şablonunu indirir
  downloadExcelTemplate() {
    const templateData = [
      {
        "Ad Soyad": "Ali Kaya",
        "Departman": "Kesim & Sünger Dilme",
        "Rol": "Saha Personeli",
        "Yıllık İzin Hakkı": 14,
        "Kullanılan İzin": 0,
        "İşe Başlama Tarihi": "2024-01-15",
        "Telefon": "05551112233",
        "Şifre/PIN": "1234"
      },
      {
        "Ad Soyad": "Mustafa Yıldız",
        "Departman": "Montaj & İskelet",
        "Rol": "Usta",
        "Yıllık İzin Hakkı": 14,
        "Kullanılan İzin": 0,
        "İşe Başlama Tarihi": "2023-05-10",
        "Telefon": "05552223344",
        "Şifre/PIN": "1234"
      },
      {
        "Ad Soyad": "Hakan Demir",
        "Departman": "Sevkiyat & Lojistik",
        "Rol": "Forklift Operatörü",
        "Yıllık İzin Hakkı": 14,
        "Kullanılan İzin": 0,
        "İşe Başlama Tarihi": "2022-03-01",
        "Telefon": "05553334455",
        "Şifre/PIN": "1234"
      },
      {
        "Ad Soyad": "Kemal Çetin",
        "Departman": "Bakım & Onarım",
        "Rol": "Bakım Teknisyeni",
        "Yıllık İzin Hakkı": 14,
        "Kullanılan İzin": 0,
        "İşe Başlama Tarihi": "2021-11-20",
        "Telefon": "05554445566",
        "Şifre/PIN": "1234"
      }
    ];

    if (typeof XLSX !== "undefined") {
      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [
        { wch: 22 }, // Ad Soyad
        { wch: 25 }, // Departman
        { wch: 20 }, // Rol
        { wch: 18 }, // Yıllık İzin
        { wch: 16 }, // Kullanılan İzin
        { wch: 18 }, // İşe Başlama
        { wch: 16 }, // Telefon
        { wch: 12 }  // PIN
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Personel_Listesi");
      XLSX.writeFile(wb, "SODSAN_Personel_Sablonu.xlsx");
    } else {
      // CSV Fallback (UTF-8 BOM ile Türkçe Karakter Desteği)
      let csv = "\uFEFFAd Soyad,Departman,Rol,Yıllık İzin Hakkı,Kullanılan İzin,İşe Başlama Tarihi,Telefon,Şifre/PIN\n";
      templateData.forEach(r => {
        csv += `"${r['Ad Soyad']}","${r['Departman']}","${r['Rol']}",${r['Yıllık İzin Hakkı']},${r['Kullanılan İzin']},"${r['İşe Başlama Tarihi']}","${r['Telefon']}","${r['Şifre/PIN']}"\n`;
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "SODSAN_Personel_Sablonu.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Seçilen Excel (.xlsx, .xls) veya CSV dosyasını okur
  handleExcelFile(file) {
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (e) => {
      let rows = [];
      const data = e.target.result;

      if (typeof XLSX !== "undefined" && !file.name.toLowerCase().endsWith('.csv')) {
        try {
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        } catch (err) {
          console.error("XLSX okunamadı, metin olarak deneniyor:", err);
          rows = this.parseCsvText(data);
        }
      } else {
        rows = this.parseCsvText(data);
      }

      this.processImportRows(rows);
    };

    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file, 'utf-8');
    } else {
      reader.readAsBinaryString(file);
    }
  }

  // Basit CSV metnini JSON satırlarına dönüştürür
  parseCsvText(csvText) {
    const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      // Virgülle ayrılmış alanları tırnak işaretlerini gözeterek ayır
      const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^["']|["']$/g, '').trim());
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });
      result.push(row);
    }
    return result;
  }

  // İçe aktarılan satırları ayrıştırır ve önizleme tablosuna basar
  processImportRows(rawRows) {
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      alert("Dosyada okunabilir personel satırı bulunamadı. Lütfen boş şablonu indirip doldurunuz.");
      return;
    }

    const departments = appState.state.departments || [];
    const parsedList = [];

    rawRows.forEach((row, idx) => {
      // Esnek sütun eşleme
      const rawName = row["Ad Soyad"] || row["Ad"] || row["İsim"] || row["Name"] || row["Personel"] || row["Adı Soyadı"] || "";
      const name = String(rawName).trim();
      if (!name) return; // İsimsiz satırları atla

      const rawDept = String(row["Departman"] || row["Bölüm"] || row["Department"] || "").trim().toLowerCase();
      let matchedDept = departments.find(d => 
        d.id.toLowerCase() === rawDept || 
        d.name.toLowerCase().includes(rawDept) || 
        rawDept.includes(d.name.toLowerCase())
      );
      if (!matchedDept && departments.length > 0) {
        matchedDept = departments[0]; // Varsayılan departman
      }

      const rawRole = String(row["Rol"] || row["Görevi"] || row["Unvan"] || row["Role"] || "").trim().toLowerCase();
      let role = "PERSONEL";
      if (rawRole.includes("usta") || rawRole.includes("formen")) {
        role = "USTA";
      } else if (rawRole.includes("bakım") || rawRole.includes("teknik") || rawRole.includes("teknisyen")) {
        role = "BAKIM";
      } else if (rawRole.includes("forklift") || rawRole.includes("operatör")) {
        role = "FORKLIFT";
      } else if (rawRole.includes("ik") || rawRole.includes("insan") || rawRole.includes("personel müdür")) {
        role = "IK";
      } else if (rawRole.includes("admin") || rawRole.includes("yönetici") || rawRole.includes("müdür")) {
        role = "ADMIN";
      }

      const totalLeave = parseInt(row["Yıllık İzin Hakkı"] || row["İzin Hakkı"] || row["İzin"] || 14) || 14;
      const usedLeave = parseInt(row["Kullanılan İzin"] || row["Kullanılan"] || 0) || 0;
      const remainingLeave = Math.max(0, totalLeave - usedLeave);
      const hireDate = row["İşe Başlama Tarihi"] || row["İşe Başlama"] || new Date().toISOString().split("T")[0];
      const phone = String(row["Telefon"] || row["Tel"] || row["GSM"] || "").trim();
      const pin = String(row["Şifre/PIN"] || row["Şifre"] || row["PIN"] || "1234").trim();

      parsedList.push({
        name,
        departmentId: matchedDept ? matchedDept.id : "dep_kesim",
        departmentName: matchedDept ? matchedDept.name : "Genel",
        role,
        totalLeave,
        usedLeave,
        remainingLeave,
        hireDate,
        phone,
        pin
      });
    });

    if (parsedList.length === 0) {
      alert("Seçilen dosyada geçerli personel kaydı tespit edilemedi.");
      return;
    }

    this.pendingImportEmployees = parsedList;

    // Önizleme alanını güncelle ve göster
    const previewWrap = document.getElementById("import-preview-container");
    const countEl = document.getElementById("import-count");
    const tbody = document.getElementById("import-preview-tbody");
    const confirmBtn = document.getElementById("btn-confirm-import-excel");

    if (countEl) countEl.textContent = parsedList.length;

    if (tbody) {
      tbody.innerHTML = parsedList.map((emp, idx) => {
        const roleInfo = getRoleInfo(emp.role);
        return `
          <tr class="hover:bg-slate-50 transition">
            <td class="p-2 font-bold text-slate-400">${idx + 1}</td>
            <td class="p-2 font-bold text-slate-900">${emp.name}</td>
            <td class="p-2 text-slate-600 font-medium">${emp.departmentName}</td>
            <td class="p-2">
              <span class="${roleInfo.badge || 'bg-slate-100 text-slate-800'} text-[10px] font-bold px-1.5 py-0.5 rounded">
                ${roleInfo.title}
              </span>
            </td>
            <td class="p-2 text-center font-bold text-emerald-700">${emp.remainingLeave} / ${emp.totalLeave} Gün</td>
            <td class="p-2 text-slate-500 font-mono text-[11px]">${emp.phone || '-'}</td>
          </tr>
        `;
      }).join("");
    }

    if (previewWrap) previewWrap.classList.remove("hidden");
    if (confirmBtn) confirmBtn.disabled = false;
  }

  // Önizlenen personelleri veritabanına ve sisteme kalıcı olarak aktarır
  confirmImportExcel() {
    if (!this.pendingImportEmployees || this.pendingImportEmployees.length === 0) return;

    if (!Array.isArray(appState.state.employees)) appState.state.employees = [];
    if (!Array.isArray(appState.state.users)) appState.state.users = [];

    let addedCount = 0;
    let updatedCount = 0;

    this.pendingImportEmployees.forEach(item => {
      // İsimle mevcut çalışan kontrolü
      const existingEmp = appState.state.employees.find(e => e.name.toLowerCase() === item.name.toLowerCase());
      const empId = existingEmp ? existingEmp.id : ("emp_" + Date.now() + "_" + Math.floor(Math.random() * 1000));
      const userId = existingEmp ? (existingEmp.userId || ("u_" + Date.now())) : ("u_" + Date.now() + "_" + Math.floor(Math.random() * 1000));

      if (existingEmp) {
        existingEmp.role = item.role;
        existingEmp.departmentId = item.departmentId;
        existingEmp.totalLeave = item.totalLeave;
        existingEmp.usedLeave = item.usedLeave;
        existingEmp.remainingLeave = item.remainingLeave;
        if (item.hireDate) existingEmp.hireDate = item.hireDate;
        updatedCount++;
      } else {
        appState.state.employees.push({
          id: empId,
          userId: userId,
          name: item.name,
          departmentId: item.departmentId,
          role: item.role,
          totalLeave: item.totalLeave,
          usedLeave: item.usedLeave,
          remainingLeave: item.remainingLeave,
          hireDate: item.hireDate
        });

        // Kullanıcı hesabını da oluştur ki sisteme giriş yapabilsin
        const existingUser = appState.state.users.find(u => u.name.toLowerCase() === item.name.toLowerCase());
        if (!existingUser) {
          appState.state.users.push({
            id: userId,
            name: item.name,
            username: this.generateUsername(item.name),
            role: item.role,
            departmentId: item.departmentId,
            phone: item.phone || "",
            pin: item.pin || "1234"
          });
        }
        addedCount++;
      }
    });

    appState.saveState();
    appState.syncUsersToEmployees();

    const uName = appState.state.currentUser ? appState.state.currentUser.name : "Yetkili";
    logSystemAction(
      "TOPLU_PERSONEL_YÜKLEME",
      `${uName}, Excel dosyasından ${addedCount} yeni personel ekledi, ${updatedCount} personeli güncelledi.`,
      { addedCount, updatedCount }
    );

    playAlertSound("call");

    document.getElementById("modal-import-emp-excel").classList.remove("show");
    this.populateEmployeeSelect();
    this.render();

    alert(`İşlem Başarılı!\n\n• Eklenen Yeni Personel: ${addedCount}\n• Güncellenen Personel: ${updatedCount}\n\nTüm çalışanlar izin çizelgesine işlendi.`);
  }

  // Türkçe karakterleri temizleyerek kullanıcı adı üretir
  generateUsername(fullName) {
    const trMap = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u' };
    let clean = fullName.toLowerCase().replace(/[çğıöşü]/g, m => trMap[m] || m);
    clean = clean.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const randSuffix = Math.floor(10 + Math.random() * 90);
    return `${clean}_${randSuffix}`;
  }
}
