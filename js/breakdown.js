// SODSAN Fabrika Portalı - Makina Arıza ve Bakım Takip Modülü (breakdown.js)
import { appState, playAlertSound, logSystemAction, registerMachine, updateMachine, deleteMachine, addExternalService, deleteExternalService } from './data.js';

export class BreakdownModule {
  constructor() {
    this.filterStatus = "ALL";
    this.filterDept = "ALL";
    this.filterUrgency = "ALL";
    this.activeSubtab = "LIVE"; // "LIVE", "PARK", "EXTERNAL"
    this.searchMachinePark = "";
    this.filterMachineParkDept = "ALL";
  }

  init() {
    this.populateDepartmentSelect();
    this.populateMachineSelect();
    this.bindEvents();
    this.render();
  }

  populateDepartmentSelect() {
    const modalDeptSelect = document.getElementById("breakdown-department");
    const filterDeptSelect = document.getElementById("filter-breakdown-dept");
    const regDeptSelect = document.getElementById("reg-machine-department");
    const editDeptSelect = document.getElementById("edit-machine-department");
    const filterParkDeptSelect = document.getElementById("filter-machine-park-dept");

    const deptOptionsHtml = appState.state.departments.map(dep => `
      <option value="${dep.id}">${dep.icon} ${dep.name}</option>
    `).join("");

    if (modalDeptSelect) {
      modalDeptSelect.innerHTML = deptOptionsHtml;
      const user = appState.state.currentUser;
      if (user && user.departmentId) {
        modalDeptSelect.value = user.departmentId;
      }
    }

    if (regDeptSelect) {
      regDeptSelect.innerHTML = deptOptionsHtml;
    }

    if (editDeptSelect) {
      editDeptSelect.innerHTML = deptOptionsHtml;
    }

    if (filterDeptSelect) {
      const currentVal = this.filterDept;
      filterDeptSelect.innerHTML = `<option value="ALL">Tüm Departmanlar</option>` + deptOptionsHtml;
      filterDeptSelect.value = currentVal;
    }

    if (filterParkDeptSelect) {
      const currentVal = this.filterMachineParkDept;
      filterParkDeptSelect.innerHTML = `<option value="ALL">Tüm Departmanlar</option>` + deptOptionsHtml;
      filterParkDeptSelect.value = currentVal;
    }
  }

  populateMachineSelect() {
    const machineSelect = document.getElementById("breakdown-machine");
    if (!machineSelect) return;
    const currentVal = machineSelect.value;
    const rawMachines = appState.state.machines || [];
    const machines = rawMachines.map(m => typeof m === "string" ? { id: m, name: m, code: "" } : m);

    machineSelect.innerHTML = `
      <option value="">-- Arızalanan Makina / Hat Seçiniz --</option>
      ${machines.map(m => `<option value="${m.name}">⚙️ ${m.name} ${m.code ? `(${m.code})` : ''}</option>`).join("")}
      <option value="DIGER">➕ [Yeni Makina Yaz ve Parka Kaydet...]</option>
    `;

    const machineNames = machines.map(m => m.name);
    if (currentVal && (machineNames.includes(currentVal) || currentVal === "DIGER")) {
      machineSelect.value = currentVal;
    } else if (machines.length > 0) {
      machineSelect.value = machines[0].name;
    }
  }

  bindEvents() {
    // Alt Sekme Geçişleri (Canlı Arıza vs Makine Parkuru vs Dış Servis Rehberi)
    const subtabBtnLive = document.getElementById("subtab-btn-breakdown-live");
    const subtabBtnPark = document.getElementById("subtab-btn-machine-park");
    const subtabBtnExt = document.getElementById("subtab-btn-external-services");
    const subpaneLive = document.getElementById("subpane-breakdown-live");
    const subpanePark = document.getElementById("subpane-machine-park");
    const subpaneExt = document.getElementById("subpane-external-services");

    const switchSubtab = (tab) => {
      this.activeSubtab = tab;
      [subtabBtnLive, subtabBtnPark, subtabBtnExt].forEach(btn => {
        if (!btn) return;
        btn.className = "px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 text-slate-600 hover:text-slate-900";
      });
      [subpaneLive, subpanePark, subpaneExt].forEach(pane => {
        if (pane) pane.classList.add("hidden");
      });

      if (tab === "LIVE") {
        if (subtabBtnLive) subtabBtnLive.className = "px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 bg-white text-blue-700 shadow-sm";
        if (subpaneLive) subpaneLive.classList.remove("hidden");
      } else if (tab === "PARK") {
        if (subtabBtnPark) subtabBtnPark.className = "px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 bg-white text-blue-700 shadow-sm";
        if (subpanePark) subpanePark.classList.remove("hidden");
        this.renderMachinePark();
      } else if (tab === "EXTERNAL") {
        if (subtabBtnExt) subtabBtnExt.className = "px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 bg-white text-blue-700 shadow-sm";
        if (subpaneExt) subpaneExt.classList.remove("hidden");
        this.renderExternalServices();
      }
    };

    if (subtabBtnLive) subtabBtnLive.addEventListener("click", () => switchSubtab("LIVE"));
    if (subtabBtnPark) subtabBtnPark.addEventListener("click", () => switchSubtab("PARK"));
    if (subtabBtnExt) subtabBtnExt.addEventListener("click", () => switchSubtab("EXTERNAL"));

    // Makine Parkuru Arama ve Filtre Dinleyicileri
    const searchPark = document.getElementById("search-machine-park");
    const filterParkDept = document.getElementById("filter-machine-park-dept");
    if (searchPark) {
      searchPark.addEventListener("input", (e) => {
        this.searchMachinePark = e.target.value.toLowerCase().trim();
        this.renderMachinePark();
      });
    }
    if (filterParkDept) {
      filterParkDept.addEventListener("change", (e) => {
        this.filterMachineParkDept = e.target.value;
        this.renderMachinePark();
      });
    }

    // Header'daki ve diğer yerlerdeki Arıza Bildir butonları
    const btnOpenReport = document.getElementById("btn-open-report-breakdown");
    const formReport = document.getElementById("form-report-breakdown");
    const machineSelect = document.getElementById("breakdown-machine");
    const customMachineContainer = document.getElementById("breakdown-custom-machine-container");
    const filterStatus = document.getElementById("filter-breakdown-status");
    const filterDept = document.getElementById("filter-breakdown-dept");
    const filterUrgency = document.getElementById("filter-breakdown-urgency");

    // Dış Servis Ekleme Buton & Formu
    const btnOpenAddExt = document.getElementById("btn-open-add-external-service");
    const formAddExt = document.getElementById("form-add-external-service");

    // Makine Parkına Yeni Makine Kaydetme Butonları & Formu
    const btnOpenRegTop = document.getElementById("btn-open-register-machine-top");
    const btnOpenRegFromPark = document.getElementById("btn-open-register-machine-park");
    const btnOpenRegFromBreakdown = document.getElementById("btn-open-register-machine-from-breakdown");
    const formRegisterMachine = document.getElementById("form-register-machine");
    const formEditMachine = document.getElementById("form-edit-machine");

    const openRegisterModal = () => {
      this.populateDepartmentSelect();
      const modal = document.getElementById("modal-register-machine");
      if (modal) modal.classList.add("show");
    };

    if (btnOpenRegTop) btnOpenRegTop.addEventListener("click", openRegisterModal);
    if (btnOpenRegFromPark) btnOpenRegFromPark.addEventListener("click", openRegisterModal);
    if (btnOpenRegFromBreakdown) btnOpenRegFromBreakdown.addEventListener("click", openRegisterModal);

    const btnProdAddMachine = document.getElementById("btn-prod-add-machine");
    if (btnProdAddMachine) btnProdAddMachine.addEventListener("click", openRegisterModal);

    const btnModalMachineFromPlan = document.getElementById("btn-open-modal-machine-from-plan");
    if (btnModalMachineFromPlan) btnModalMachineFromPlan.addEventListener("click", openRegisterModal);

    if (formRegisterMachine) {
      formRegisterMachine.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveRegisteredMachine();
      });
    }

    if (formEditMachine) {
      formEditMachine.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveEditedMachine();
      });
    }

    if (btnOpenAddExt) {
      btnOpenAddExt.addEventListener("click", () => {
        const modal = document.getElementById("modal-add-external-service");
        if (modal) modal.classList.add("show");
      });
    }

    if (formAddExt) {
      formAddExt.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveExternalService();
      });
    }

    if (btnOpenReport) {
      btnOpenReport.addEventListener("click", () => this.openReportModal());
    }

    document.querySelectorAll("[data-open-report-breakdown]").forEach(btn => {
      btn.addEventListener("click", () => this.openReportModal());
    });

    if (machineSelect && customMachineContainer) {
      machineSelect.addEventListener("change", (e) => {
        if (e.target.value === "DIGER") {
          customMachineContainer.classList.remove("hidden");
          const input = document.getElementById("breakdown-custom-machine");
          if (input) input.focus();
        } else {
          customMachineContainer.classList.add("hidden");
        }
      });
    }

    // Hızlı Belirti Butonları (Chips)
    document.querySelectorAll("[data-chip-fault]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const text = e.currentTarget.getAttribute("data-chip-fault");
        const descInput = document.getElementById("breakdown-description");
        if (descInput) {
          if (descInput.value.trim()) {
            descInput.value += ` - ${text}`;
          } else {
            descInput.value = text;
          }
          descInput.focus();
        }
      });
    });

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

    if (filterUrgency) {
      filterUrgency.addEventListener("change", (e) => {
        this.filterUrgency = e.target.value;
        this.render();
      });
    }

    if (formReport) {
      formReport.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveBreakdownReport();
      });
    }
  }

  saveExternalService() {
    const compName = document.getElementById("ext-service-company").value.trim();
    const contact = document.getElementById("ext-service-contact").value.trim();
    const specialty = document.getElementById("ext-service-specialty").value.trim();
    const phone = document.getElementById("ext-service-phone").value.trim();
    const notes = document.getElementById("ext-service-notes").value.trim();

    if (!compName || !phone) {
      alert("Lütfen firma adı ve telefon numarasını giriniz.");
      return;
    }

    addExternalService({
      companyName: compName,
      contactPerson: contact,
      specialty,
      phone,
      notes
    });

    const uName = appState.state.currentUser ? appState.state.currentUser.name : "Yetkili";
    logSystemAction(
      "DIŞ_SERVİS_EKLE",
      `${uName}, "${compName}" (${specialty}) dış servis ekibini rehbere kaydetti.`,
      { company: compName, phone, specialty }
    );

    playAlertSound("call");

    document.getElementById("form-add-external-service").reset();
    document.getElementById("modal-add-external-service").classList.remove("show");

    this.renderExternalServices();
  }

  renderExternalServices() {
    const container = document.getElementById("external-services-list");
    if (!container) return;

    const list = appState.state.externalServices || [];
    if (list.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-6 text-slate-400 text-xs">
          Rehberde kayıtlı dış servis bulunmuyor. Yeni servis eklemek için yukarıdaki "+ Yeni Dış Servis Ekle" butonunu kullanabilirsiniz.
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(item => `
      <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-2.5 hover:border-blue-300 transition">
        <div>
          <div class="flex items-start justify-between gap-2">
            <div>
              <h4 class="font-extrabold text-slate-900 text-sm">${item.companyName}</h4>
              ${item.contactPerson ? `<p class="text-xs text-slate-600 font-medium mt-0.5">👤 Yetkili: <b>${item.contactPerson}</b></p>` : ''}
            </div>
            <span class="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded border border-blue-200 whitespace-nowrap">
              ${item.specialty || 'Servis'}
            </span>
          </div>
          ${item.notes ? `<p class="text-[11px] text-slate-500 mt-2 bg-slate-50 p-2 rounded border border-slate-100">${item.notes}</p>` : ''}
        </div>

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <a href="tel:${item.phone.replace(/[^0-9+]/g, '')}" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition flex items-center gap-1.5">
            <span>📞</span> <span>${item.phone}</span>
          </a>
          <button data-delete-ext-service="${item.id}" class="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition text-xs font-bold" title="Rehberden Sil">
            🗑️
          </button>
        </div>
      </div>
    `).join("");

    container.querySelectorAll("[data-delete-ext-service]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-delete-ext-service");
        const target = (appState.state.externalServices || []).find(s => s.id === id);
        if (confirm(`"${target ? target.companyName : 'Bu servis'}" ekibini rehberden silmek istediğinize emin misiniz?`)) {
          deleteExternalService(id);
          this.renderExternalServices();
        }
      });
    });
  }

  renderMachinePark() {
    const tbody = document.getElementById("machine-park-table-tbody");
    const emptyMsg = document.getElementById("machine-park-empty-msg");
    const badge = document.getElementById("machine-park-badge-count");
    if (!tbody) return;

    let rawMachines = appState.state.machines || [];
    let machines = rawMachines.map(m => typeof m === "string" ? {
      id: "mac_" + m.toLowerCase().replace(/[^a-z0-9]/g, "_"),
      name: m,
      code: "",
      departmentId: "",
      location: "",
      notes: "",
      status: "Aktif",
      addedAt: "2026-10-22"
    } : m);

    if (badge) {
      badge.textContent = machines.length;
    }

    if (this.searchMachinePark) {
      machines = machines.filter(m =>
        m.name.toLowerCase().includes(this.searchMachinePark) ||
        (m.code && m.code.toLowerCase().includes(this.searchMachinePark)) ||
        (m.location && m.location.toLowerCase().includes(this.searchMachinePark))
      );
    }

    if (this.filterMachineParkDept !== "ALL") {
      machines = machines.filter(m => m.departmentId === this.filterMachineParkDept);
    }

    if (machines.length === 0) {
      tbody.innerHTML = "";
      if (emptyMsg) emptyMsg.classList.remove("hidden");
      return;
    }

    if (emptyMsg) emptyMsg.classList.add("hidden");

    tbody.innerHTML = machines.map(m => {
      const dep = appState.state.departments.find(d => d.id === m.departmentId) || { name: "Genel Fabrika", icon: "🏢" };
      const activeBrk = (appState.state.breakdowns || []).find(b => b.machineName === m.name && b.status !== "Giderildi");
      const totalBreakdownCount = (appState.state.breakdowns || []).filter(b => b.machineName === m.name).length;

      let statusBadge = "";
      if (activeBrk) {
        statusBadge = `<span class="bg-red-100 text-red-800 text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-sm border border-red-200 animate-pulse">🚨 Arızada (${activeBrk.urgency})</span>`;
      } else if (m.status === "Bakımda") {
        statusBadge = `<span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">🟡 Bakımda</span>`;
      } else if (m.status === "Devre Dışı") {
        statusBadge = `<span class="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200">⚪ Devre Dışı</span>`;
      } else {
        statusBadge = `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">🟢 Faal / Çalışıyor</span>`;
      }

      return `
        <tr class="hover:bg-blue-50/40 transition">
          <td class="py-2.5 px-3.5">
            <div class="font-extrabold text-slate-900 flex items-center gap-1.5">
              <span class="text-slate-400">⚙️</span>
              <span class="text-sm">${m.name}</span>
            </div>
            ${m.notes ? `<div class="text-[10px] text-slate-400 truncate max-w-xs mt-0.5 italic">"${m.notes}"</div>` : ''}
          </td>
          <td class="py-2.5 px-3 whitespace-nowrap">
            ${m.code ? `<span class="bg-slate-100 text-slate-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-slate-200">${m.code}</span>` : '<span class="text-slate-300">-</span>'}
          </td>
          <td class="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
            ${dep.icon} ${dep.name}
          </td>
          <td class="py-2.5 px-3 text-slate-600 font-medium whitespace-nowrap">
            ${m.location ? `📍 ${m.location}` : '<span class="text-slate-300">-</span>'}
          </td>
          <td class="py-2.5 px-3 whitespace-nowrap">
            ${statusBadge}
          </td>
          <td class="py-2.5 px-3 whitespace-nowrap">
            ${totalBreakdownCount > 0 ? `<span class="bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded text-[11px] border border-amber-200">${totalBreakdownCount} Arıza</span>` : '<span class="text-slate-400 text-[11px]">Sorunsuz</span>'}
          </td>
          <td class="py-2.5 px-3.5 text-right whitespace-nowrap">
            <div class="flex items-center justify-end gap-1.5">
              <button data-report-for-machine="${m.name}" title="Bu makineye arıza bildir" class="bg-red-50 hover:bg-red-600 hover:text-white text-red-600 font-bold text-xs py-1 px-2.5 rounded-lg border border-red-200 transition flex items-center gap-1 cursor-pointer">
                <span>🚨</span> <span class="hidden sm:inline">Arıza Bildir</span>
              </button>
              <button data-edit-machine="${m.id}" title="Makine Bilgilerini Düzenle" class="bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-bold text-xs p-1.5 rounded-lg border border-slate-200 transition cursor-pointer">
                <span>✏️</span>
              </button>
              <button data-delete-machine="${m.id}" data-name="${m.name}" title="Parkurdan Kaldır" class="bg-slate-100 hover:bg-red-600 hover:text-white text-slate-400 font-bold text-xs p-1.5 rounded-lg border border-slate-200 transition cursor-pointer">
                <span>🗑️</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Dinleyiciler
    tbody.querySelectorAll("[data-edit-machine]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-edit-machine");
        this.openEditMachineModal(id);
      });
    });

    tbody.querySelectorAll("[data-delete-machine]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-delete-machine");
        const name = e.currentTarget.getAttribute("data-name");
        this.confirmDeleteMachine(id, name);
      });
    });

    tbody.querySelectorAll("[data-report-for-machine]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const machineName = e.currentTarget.getAttribute("data-report-for-machine");
        this.openReportModal(machineName);
      });
    });
  }

  openEditMachineModal(id) {
    const rawMachines = appState.state.machines || [];
    const m = rawMachines.find(mac => (typeof mac === "string" ? mac === id : mac.id === id));
    if (!m) return;

    const modal = document.getElementById("modal-edit-machine");
    if (!modal) return;

    this.populateDepartmentSelect();

    const mObj = typeof m === "string" ? { id: m, name: m, code: "", departmentId: "", location: "", notes: "", status: "Aktif" } : m;

    document.getElementById("edit-machine-id").value = mObj.id;
    document.getElementById("edit-machine-name").value = mObj.name;
    document.getElementById("edit-machine-code").value = mObj.code || "";
    document.getElementById("edit-machine-status").value = mObj.status || "Aktif";
    document.getElementById("edit-machine-location").value = mObj.location || "";
    document.getElementById("edit-machine-notes").value = mObj.notes || "";

    const deptSelect = document.getElementById("edit-machine-department");
    if (deptSelect && mObj.departmentId) {
      deptSelect.value = mObj.departmentId;
    }

    modal.classList.add("show");
  }

  confirmDeleteMachine(id, name) {
    const active = (appState.state.breakdowns || []).some(b => b.machineName === name && b.status !== "Giderildi");
    if (active) {
      alert(`"${name}" makinesine ait henüz giderilmemiş aktif bir arıza kaydı bulunmaktadır. Önce arıza kaydını kapatınız veya siliniz.`);
      return;
    }

    if (confirm(`"${name}" makinesini fabrika makine parkurundan silmek istediğinize emin misiniz?`)) {
      deleteMachine(id);
      const uName = appState.state.currentUser ? appState.state.currentUser.name : "Yetkili";
      logSystemAction(
        "MAKİNE_SİLME",
        `${uName}, "${name}" makinesini makine parkurundan sildi.`,
        { machineId: id, machineName: name }
      );
      this.populateMachineSelect();
      this.render();
      if (window.portalApp && window.portalApp.production) {
        window.portalApp.production.populateMachineDropdowns();
        window.portalApp.production.render();
      }
    }
  }

  openReportModal(preSelectedMachine = null) {
    this.populateDepartmentSelect();
    this.populateMachineSelect();

    // Oturumdaki kullanıcının adını göster
    const reporterEl = document.getElementById("breakdown-reporter-name");
    if (reporterEl) {
      reporterEl.textContent = appState.state.currentUser ? appState.state.currentUser.name : "Fabrika Çalışanı";
    }

    if (preSelectedMachine) {
      const machineSelect = document.getElementById("breakdown-machine");
      if (machineSelect) {
        machineSelect.value = preSelectedMachine;
      }
      const customWrap = document.getElementById("breakdown-custom-machine-container");
      if (customWrap) customWrap.classList.add("hidden");

      // Makinenin departman ve konumunu otomatik doldur
      const rawMachines = appState.state.machines || [];
      const mObj = rawMachines.find(m => (typeof m === "string" ? m === preSelectedMachine : m.name === preSelectedMachine));
      if (mObj && typeof mObj === "object") {
        const deptSelect = document.getElementById("breakdown-department");
        const locInput = document.getElementById("breakdown-location");
        if (deptSelect && mObj.departmentId) deptSelect.value = mObj.departmentId;
        if (locInput && mObj.location && !locInput.value) locInput.value = mObj.location;
      }
    }

    const modal = document.getElementById("modal-report-breakdown");
    if (modal) modal.classList.add("show");
  }

  saveBreakdownReport() {
    const machineSelect = document.getElementById("breakdown-machine");
    const customMachineInput = document.getElementById("breakdown-custom-machine");
    const deptSelect = document.getElementById("breakdown-department");
    const locationInput = document.getElementById("breakdown-location");
    const faultTypeSelect = document.getElementById("breakdown-fault-type");
    const urgencySelect = document.getElementById("breakdown-urgency");
    const descInput = document.getElementById("breakdown-description");

    let machineName = machineSelect.value;
    if (machineName === "DIGER" || !machineName) {
      machineName = customMachineInput ? customMachineInput.value.trim() : "";
      if (!machineName) {
        alert("Lütfen arızalanan makina / ekipman adını yazınız.");
        return;
      }
      // Yeni makinayı otomatik olarak makina parkına kaydet
      registerMachine(machineName);
      this.populateMachineSelect();
    }

    const location = locationInput.value.trim();
    const description = descInput.value.trim();
    const urgency = urgencySelect.value;
    const faultType = faultTypeSelect.value;
    const deptId = deptSelect.value;
    const currentUser = appState.state.currentUser;
    const uName = currentUser ? currentUser.name : "Fabrika Personeli";

    if (!location || !description) {
      alert("Lütfen makina konumu ve arıza açıklamasını eksiksiz giriniz.");
      return;
    }

    const newBreakdown = {
      id: "brk_" + Date.now(),
      machineName: machineName,
      departmentId: deptId,
      location: location,
      faultType: faultType,
      urgency: urgency, // Kritik, Yüksek, Normal
      description: description,
      reportedBy: uName,
      reportedTime: new Date().toISOString(),
      status: "Bekliyor", // Bekliyor, Müdahale Ediliyor, Parça Bekleniyor, Giderildi
      assignedTechnician: null,
      technicianNotes: null,
      resolvedTime: null
    };

    if (!Array.isArray(appState.state.breakdowns)) {
      appState.state.breakdowns = [];
    }

    appState.state.breakdowns.unshift(newBreakdown);
    appState.saveState();

    // Sesli Alarm (Kritikse siren çalar)
    if (urgency === "Kritik") {
      playAlertSound("critical");
    } else {
      playAlertSound("call");
    }

    // Telegram Bot Bildirimi
    this.sendTelegramAlert(newBreakdown);

    // Sistem Günlüğü
    logSystemAction(
      "ARIZA_BİLDİRİMİ",
      `${uName}, [${urgency.toUpperCase()}] aciliyetinde arıza bildirdi: "${machineName}" (${location}) - ${faultType}. Açıklama: ${description}`,
      { breakdownId: newBreakdown.id, machine: machineName, urgency: urgency }
    );

    // Formu temizle ve modalı kapat
    document.getElementById("form-report-breakdown").reset();
    const customMachineContainer = document.getElementById("breakdown-custom-machine-container");
    if (customMachineContainer) customMachineContainer.classList.add("hidden");
    document.getElementById("modal-report-breakdown").classList.remove("show");

    this.render();
  }

  saveRegisteredMachine() {
    const nameInput = document.getElementById("reg-machine-name");
    const codeInput = document.getElementById("reg-machine-code");
    const deptSelect = document.getElementById("reg-machine-department");
    const locInput = document.getElementById("reg-machine-location");
    const notesInput = document.getElementById("reg-machine-notes");

    const name = nameInput ? nameInput.value.trim() : "";
    if (!name) {
      alert("Lütfen makine / ekipman adını yazınız.");
      return;
    }

    const code = codeInput ? codeInput.value.trim() : "";
    const departmentId = deptSelect ? deptSelect.value : "";
    const location = locInput ? locInput.value.trim() : "";
    const notes = notesInput ? notesInput.value.trim() : "";

    // Makineyi makine parkına kaydet
    registerMachine({
      name,
      code,
      departmentId,
      location,
      notes
    });

    this.populateMachineSelect();

    // Arıza bildirim penceresindeki seçimi otomatik bu makine yap
    const breakdownMachine = document.getElementById("breakdown-machine");
    if (breakdownMachine) {
      breakdownMachine.value = name;
      const customWrap = document.getElementById("breakdown-custom-machine-container");
      if (customWrap) customWrap.classList.add("hidden");
    }

    // Konum ve departman belirtildiyse arıza formuna da aktar
    if (location) {
      const bLoc = document.getElementById("breakdown-location");
      if (bLoc && !bLoc.value.trim()) {
        bLoc.value = location;
      }
    }

    if (departmentId) {
      const bDept = document.getElementById("breakdown-department");
      if (bDept) bDept.value = departmentId;
    }

    const uName = appState.state.currentUser ? appState.state.currentUser.name : "Yetkili";
    logSystemAction(
      "MAKİNE_EKLEME",
      `${uName}, "${name}" (${code || 'KODSUZ'}) makinesini fabrika makine parkına kaydetti.`,
      { machineName: name, code, departmentId }
    );

    playAlertSound("call");

    document.getElementById("form-register-machine").reset();
    document.getElementById("modal-register-machine").classList.remove("show");

    this.render();
    if (window.portalApp && window.portalApp.production) {
      window.portalApp.production.populateMachineDropdowns();
      window.portalApp.production.render();
    }
    alert(`"${name}" makinesi başarıyla fabrika parkına kaydedildi.`);
  }

  saveEditedMachine() {
    const id = document.getElementById("edit-machine-id").value;
    const nameInput = document.getElementById("edit-machine-name");
    const codeInput = document.getElementById("edit-machine-code");
    const statusSelect = document.getElementById("edit-machine-status");
    const deptSelect = document.getElementById("edit-machine-department");
    const locInput = document.getElementById("edit-machine-location");
    const notesInput = document.getElementById("edit-machine-notes");

    const name = nameInput ? nameInput.value.trim() : "";
    if (!name) {
      alert("Lütfen makine adını giriniz.");
      return;
    }

    const updated = updateMachine(id, {
      name,
      code: codeInput ? codeInput.value.trim() : "",
      status: statusSelect ? statusSelect.value : "Aktif",
      departmentId: deptSelect ? deptSelect.value : "",
      location: locInput ? locInput.value.trim() : "",
      notes: notesInput ? notesInput.value.trim() : ""
    });

    if (updated) {
      const uName = appState.state.currentUser ? appState.state.currentUser.name : "Yetkili";
      logSystemAction(
        "MAKİNE_DÜZENLEME",
        `${uName}, "${name}" makinesinin bilgilerini güncelledi.`,
        { machineId: id, name, status: updated.status }
      );

      playAlertSound("call");
      document.getElementById("modal-edit-machine").classList.remove("show");
      this.populateMachineSelect();
      this.render();
      if (window.portalApp && window.portalApp.production) {
        window.portalApp.production.populateMachineDropdowns();
        window.portalApp.production.render();
      }
      alert(`"${name}" makinesinin bilgileri başarıyla güncellendi.`);
    }
  }

  async sendTelegramAlert(breakdown) {
    const config = appState.state.telegramConfig;
    if (!config || !config.enabled || !config.botToken || !config.chatId) return;
    if (config.notifyBreakdown === false) {
      console.log("Makine arıza Telegram bildirimi kullanıcı tercihiyle kapalı.");
      return;
    }

    const urgencyEmoji = breakdown.urgency === "Kritik" ? "🚨🚨 KRİTİK HAT DURUŞU 🚨🚨" : breakdown.urgency === "Yüksek" ? "⚠️ YÜKSEK ÖNCELİK" : "🔧 ARIZA BİLDİRİMİ";
    const dep = appState.state.departments.find(d => d.id === breakdown.departmentId) || { name: "Genel Fabrika" };
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const escapeHtml = (str) => String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const htmlMessage = `
<b>${urgencyEmoji}</b>
🏭 <b>SODSAN MAKİNA ARIZA BİLDİRİMİ</b>
⚙️ <b>Makina:</b> ${escapeHtml(breakdown.machineName)}
📍 <b>Konum:</b> ${escapeHtml(breakdown.location)} (${escapeHtml(dep.name)})
⚡ <b>Arıza Türü:</b> ${escapeHtml(breakdown.faultType)}
👤 <b>Bildiren:</b> ${escapeHtml(breakdown.reportedBy)}
📝 <b>Açıklama:</b> ${escapeHtml(breakdown.description)}
⏰ <b>Zaman:</b> ${timeStr}
`.trim();

    const plainMessage = `
${urgencyEmoji}
SODSAN MAKİNA ARIZA BİLDİRİMİ
Makina: ${breakdown.machineName}
Konum: ${breakdown.location} (${dep.name})
Arıza Türü: ${breakdown.faultType}
Bildiren: ${breakdown.reportedBy}
Açıklama: ${breakdown.description}
Zaman: ${timeStr}
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
      console.warn("Telegram arıza bildirimi gönderilemedi:", err);
    }
  }

  assignSelfTechnician(breakdownId) {
    const brk = appState.state.breakdowns.find(b => b.id === breakdownId);
    if (!brk) return;

    const currentUser = appState.state.currentUser;
    const uName = currentUser ? currentUser.name : "Teknisyen";
    const note = prompt(`Müdahale başlatılıyor. Lütfen ilk tespitinizi veya tahmini sürenizi yazınız:`, "Hatta gidildi, inceleniyor.");
    if (note === null) return;

    brk.status = "Müdahale Ediliyor";
    brk.assignedTechnician = uName;
    brk.technicianNotes = `${uName}: ${note}`;
    appState.saveState();

    logSystemAction(
      "ARIZA_MÜDAHALE",
      `${uName}, "${brk.machineName}" arızasına müdahaleyi başlattı. İlk not: ${note}`,
      { breakdownId: brk.id, machine: brk.machineName, technician: uName }
    );

    this.render();
  }

  setWaitingParts(breakdownId) {
    const brk = appState.state.breakdowns.find(b => b.id === breakdownId);
    if (!brk) return;

    const currentUser = appState.state.currentUser;
    const uName = currentUser ? currentUser.name : "Teknisyen";
    const partNote = prompt(`Hangi parça bekleniyor? Lütfen satın alma / tedarik detayını yazınız:`, "Yedek rulman / kayış sipariş edildi, kargo bekleniyor.");
    if (partNote === null) return;

    brk.status = "Parça Bekleniyor";
    brk.technicianNotes = (brk.technicianNotes ? brk.technicianNotes + "\n" : "") + `[PARÇA BEKLİYOR] ${uName}: ${partNote}`;
    appState.saveState();

    logSystemAction(
      "ARIZA_PARÇA_BEKLEME",
      `${uName}, "${brk.machineName}" arızasını [Parça Bekleniyor] durumuna aldı. Not: ${partNote}`,
      { breakdownId: brk.id, machine: brk.machineName }
    );

    this.render();
  }

  resolveBreakdown(breakdownId) {
    const brk = appState.state.breakdowns.find(b => b.id === breakdownId);
    if (!brk) return;

    const currentUser = appState.state.currentUser;
    const uName = currentUser ? currentUser.name : "Teknisyen";
    const solution = prompt(`"${brk.machineName}" arızası giderildi mi?\nLütfen yapılan onarımı özetleyiniz:`, "Arıza giderildi, test kesimi yapıldı ve hat çalışır vaziyette teslim edildi.");
    if (solution === null) return;

    brk.status = "Giderildi";
    brk.resolvedTime = new Date().toISOString();
    brk.technicianNotes = (brk.technicianNotes ? brk.technicianNotes + "\n" : "") + `[GİDERİLDİ] ${uName}: ${solution}`;
    appState.saveState();

    logSystemAction(
      "ARIZA_GİDERİLDİ",
      `"${brk.machineName}" arızası ${uName} tarafından giderildi. Makina aktif ve devrede. Çözüm: ${solution}`,
      { breakdownId: brk.id, machine: brk.machineName, resolver: uName }
    );

    this.render();
    alert(`Harika! "${brk.machineName}" arızası giderildi olarak kapatıldı.`);
  }

  deleteBreakdown(breakdownId) {
    const brk = appState.state.breakdowns.find(b => b.id === breakdownId);
    if (!brk) return;

    if (confirm(`"${brk.machineName}" arıza kaydını sistemden silmek istediğinize emin misiniz?`)) {
      appState.state.breakdowns = appState.state.breakdowns.filter(b => b.id !== breakdownId);
      appState.saveState();

      const uName = appState.state.currentUser ? appState.state.currentUser.name : "Yetkili";
      logSystemAction(
        "ARIZA_SİLME",
        `${uName}, "${brk.machineName}" arıza kaydını sildi.`,
        { breakdownId }
      );

      this.render();
    }
  }

  renderEmergencyBanner() {
    const banner = document.getElementById("active-breakdowns-banner");
    if (!banner) return;

    const activeIssues = (appState.state.breakdowns || []).filter(b => b.status !== "Giderildi");

    if (activeIssues.length === 0) {
      banner.innerHTML = "";
      banner.classList.add("hidden");
      return;
    }

    const criticalList = activeIssues.filter(b => b.urgency === "Kritik");
    const topIssue = criticalList.length > 0 ? criticalList[0] : activeIssues[0];

    banner.classList.remove("hidden");

    if (topIssue.urgency === "Kritik") {
      banner.className = "bg-gradient-to-r from-red-600 to-rose-700 text-white px-4 py-2.5 rounded-xl shadow-lg border border-red-500 animate-pulse flex flex-wrap items-center justify-between gap-3 mb-4";
      banner.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="text-2xl animate-bounce">🚨</span>
          <div>
            <div class="font-black text-xs sm:text-sm tracking-wide flex items-center gap-2">
              <span>KRİTİK HAT DURUŞU: ${topIssue.machineName}</span>
              <span class="bg-white text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">HAT DURDU</span>
            </div>
            <div class="text-xs text-red-100 mt-0.5">
              Konum: <b>${topIssue.location}</b> &bull; Arıza: <b>${topIssue.faultType}</b> &bull; Durum: <b>${topIssue.status}</b>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button data-switch-to-breakdown class="bg-white text-red-700 hover:bg-red-50 text-xs font-black px-3 py-1.5 rounded-lg shadow transition">
            Müdahale Et / İncele
          </button>
        </div>
      `;
    } else {
      banner.className = "bg-amber-500 text-white px-4 py-2 rounded-xl shadow flex flex-wrap items-center justify-between gap-3 mb-4";
      banner.innerHTML = `
        <div class="flex items-center gap-2.5">
          <span class="text-lg">⚠️</span>
          <div class="text-xs font-bold">
            Aktif Arıza Bildirimi: <b>${topIssue.machineName}</b> (${topIssue.faultType}) &bull; Durum: <b>${topIssue.status}</b>
          </div>
        </div>
        <button data-switch-to-breakdown class="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1 rounded transition">
          Detayları Gör
        </button>
      `;
    }

    banner.querySelectorAll("[data-switch-to-breakdown]").forEach(btn => {
      btn.addEventListener("click", () => {
        const tabBtn = document.querySelector('[data-tab="tab-breakdown"]');
        if (tabBtn) tabBtn.click();
      });
    });
  }

  render() {
    this.renderEmergencyBanner();
    this.renderMachinePark();
    this.renderExternalServices();

    const statsContainer = document.getElementById("breakdown-stats-summary");
    const cardsContainer = document.getElementById("breakdown-cards-list");
    if (!cardsContainer) return;

    const allList = appState.state.breakdowns || [];

    // İstatistik Kartları
    if (statsContainer) {
      const waitingList = allList.filter(b => b.status === "Bekliyor");
      const inProgressList = allList.filter(b => b.status === "Müdahale Ediliyor");
      const waitingPartsList = allList.filter(b => b.status === "Parça Bekleniyor");
      const resolvedList = allList.filter(b => b.status === "Giderildi");
      const criticalCount = allList.filter(b => b.urgency === "Kritik" && b.status !== "Giderildi").length;

      statsContainer.innerHTML = `
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="bg-gradient-to-br from-red-500 to-red-700 text-white p-3.5 rounded-xl shadow-sm">
            <div class="text-[11px] font-bold uppercase tracking-wider text-red-100">Müdahale Bekleyen</div>
            <div class="text-2xl font-black mt-1">${waitingList.length} <span class="text-sm font-semibold">Makina</span></div>
            <div class="text-[10px] text-red-100 mt-0.5">${criticalCount} tanesi kritik hat duruşu</div>
          </div>

          <div class="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-3.5 rounded-xl shadow-sm">
            <div class="text-[11px] font-bold uppercase tracking-wider text-blue-100">Şu An Müdahalede</div>
            <div class="text-2xl font-black mt-1">${inProgressList.length} <span class="text-sm font-semibold">İşlem</span></div>
            <div class="text-[10px] text-blue-100 mt-0.5">Bakım ustaları sahada onarıyor</div>
          </div>

          <div class="bg-gradient-to-br from-purple-500 to-purple-700 text-white p-3.5 rounded-xl shadow-sm">
            <div class="text-[11px] font-bold uppercase tracking-wider text-purple-100">Parça Bekleyen</div>
            <div class="text-2xl font-black mt-1">${waitingPartsList.length} <span class="text-sm font-semibold">Makina</span></div>
            <div class="text-[10px] text-purple-100 mt-0.5">Satın alma / tedarik sürecinde</div>
          </div>

          <div class="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-3.5 rounded-xl shadow-sm">
            <div class="text-[11px] font-bold uppercase tracking-wider text-emerald-100">Onarılan & Giderilen</div>
            <div class="text-2xl font-black mt-1">${resolvedList.length} <span class="text-sm font-semibold">Makina</span></div>
            <div class="text-[10px] text-emerald-100 mt-0.5">Başarıyla tekrar devrede</div>
          </div>
        </div>
      `;
    }

    // Filtreleme
    let filtered = [...allList].sort((a, b) => new Date(b.reportedTime) - new Date(a.reportedTime));

    if (this.filterStatus !== "ALL") {
      filtered = filtered.filter(b => b.status === this.filterStatus);
    }

    if (this.filterDept !== "ALL") {
      filtered = filtered.filter(b => b.departmentId === this.filterDept);
    }

    if (this.filterUrgency !== "ALL") {
      filtered = filtered.filter(b => b.urgency === this.filterUrgency);
    }

    if (filtered.length === 0) {
      cardsContainer.innerHTML = `
        <div class="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
          <p class="text-3xl mb-2">🎉</p>
          <p class="font-bold text-slate-700">Seçili kriterlerde açık arıza bildirimi bulunmuyor.</p>
          <p class="text-xs text-slate-400 mt-1">Herhangi bir makina arızalandığında üstteki "🚨 Arıza Bildir" butonuyla anında bildirim yapabilirsiniz.</p>
        </div>
      `;
      return;
    }

    const currentUser = appState.state.currentUser;
    const isMaintenanceOrAdmin = currentUser ? (currentUser.role === "BAKIM" || currentUser.role === "ADMIN" || currentUser.role === "USTA") : true;

    cardsContainer.innerHTML = filtered.map(brk => {
      const dep = appState.state.departments.find(d => d.id === brk.departmentId) || { name: "", icon: "🏢" };
      const timeAgo = this.formatTimeAgo(brk.reportedTime);

      let urgencyBadge = "";
      let cardBorder = "border-l-blue-500";

      if (brk.urgency === "Kritik") {
        urgencyBadge = `<span class="bg-red-600 text-white text-xs px-2.5 py-0.5 rounded-full font-black animate-pulse flex items-center gap-1">🚨 KRİTİK HAT DURUŞU</span>`;
        cardBorder = "border-l-red-600";
      } else if (brk.urgency === "Yüksek") {
        urgencyBadge = `<span class="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">⚠️ YÜKSEK ÖNCELİK</span>`;
        cardBorder = "border-l-amber-500";
      } else {
        urgencyBadge = `<span class="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-medium">Normal Öncelik</span>`;
        cardBorder = "border-l-slate-300";
      }

      let statusBadge = "";
      if (brk.status === "Bekliyor") {
        statusBadge = `<span class="bg-red-50 text-red-700 border border-red-200 text-xs px-2.5 py-1 rounded-lg font-black">⏳ Müdahale Bekliyor</span>`;
      } else if (brk.status === "Müdahale Ediliyor") {
        statusBadge = `<span class="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2.5 py-1 rounded-lg font-black">🛠️ Müdahale Ediliyor</span>`;
      } else if (brk.status === "Parça Bekleniyor") {
        statusBadge = `<span class="bg-purple-50 text-purple-700 border border-purple-200 text-xs px-2.5 py-1 rounded-lg font-black">⏸️ Parça Bekleniyor</span>`;
      } else {
        statusBadge = `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-1 rounded-lg font-black">✅ Arıza Giderildi</span>`;
      }

      return `
        <div class="bg-white rounded-xl border border-slate-200 border-l-4 ${cardBorder} p-4 shadow-sm space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-base font-extrabold text-slate-900">${brk.machineName}</span>
                ${urgencyBadge}
              </div>
              <div class="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                <span>Konum: <b>${brk.location}</b></span>
                <span>&bull;</span>
                <span>Departman: <b>${dep.icon} ${dep.name}</b></span>
                <span>&bull;</span>
                <span>Arıza Türü: <b class="text-slate-700">${brk.faultType}</b></span>
              </div>
            </div>
            <div>${statusBadge}</div>
          </div>

          <div class="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-800 space-y-1">
            <div class="font-bold text-slate-600 uppercase text-[10px] tracking-wider">Bildirilen Belirti / Arıza Açıklaması:</div>
            <p class="font-medium text-slate-800">${brk.description}</p>
          </div>

          ${brk.technicianNotes ? `
            <div class="bg-blue-50/60 p-3 rounded-lg border border-blue-100 text-xs text-blue-900 space-y-1">
              <div class="font-bold text-blue-800 uppercase text-[10px] tracking-wider flex items-center gap-1">
                <span>🛠️ Bakım Notları:</span>
                ${brk.assignedTechnician ? `<span class="bg-blue-200 text-blue-900 px-1.5 py-0.2 rounded font-black">${brk.assignedTechnician}</span>` : ''}
              </div>
              <p class="whitespace-pre-line text-blue-950">${brk.technicianNotes}</p>
            </div>
          ` : ''}

          <div class="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-100">
            <div class="flex items-center gap-3 text-slate-500">
              <span>👤 Bildiren: <b class="text-slate-800">${brk.reportedBy}</b></span>
              <span>🕒 ${timeAgo}</span>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              ${isMaintenanceOrAdmin && brk.status !== "Giderildi" ? `
                ${brk.status === "Bekliyor" ? `
                  <button data-action-assign="${brk.id}" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition shadow-sm flex items-center gap-1">
                    <span>🛠️</span> <span>Müdaheleye Başla</span>
                  </button>
                ` : ''}

                <button data-action-waiting-parts="${brk.id}" class="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition shadow-sm flex items-center gap-1">
                  <span>⏸️</span> <span>Parça Bekliyor</span>
                </button>

                <button data-action-resolve="${brk.id}" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition shadow-sm flex items-center gap-1">
                  <span>✅</span> <span>Arıza Giderildi</span>
                </button>
              ` : ''}

              <button data-action-delete="${brk.id}" class="text-red-500 hover:text-red-700 text-xs font-semibold p-1.5">
                Sil
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Aksiyon Dinleyicileri
    cardsContainer.querySelectorAll("[data-action-assign]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-action-assign");
        this.assignSelfTechnician(id);
      });
    });

    cardsContainer.querySelectorAll("[data-action-waiting-parts]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-action-waiting-parts");
        this.setWaitingParts(id);
      });
    });

    cardsContainer.querySelectorAll("[data-action-resolve]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-action-resolve");
        this.resolveBreakdown(id);
      });
    });

    cardsContainer.querySelectorAll("[data-action-delete]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-action-delete");
        this.deleteBreakdown(id);
      });
    });
  }

  formatTimeAgo(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "Az önce";
    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  }
}
