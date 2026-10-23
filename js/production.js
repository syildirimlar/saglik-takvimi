// SODSAN Fabrika Portalı - Haftalık Üretim Programı & Kalıp Baskı Planlama Modülü (production.js)
import { appState, playAlertSound } from './data.js?v=4.6';
import { logSystemAction } from './app.js';

export class ProductionModule {
  constructor() {
    this.currentWeekOffset = 0; // 0 = bu hafta, -1 = geçen hafta, +1 = gelecek hafta
    this.selectedMachineFilter = "ALL";
    this.selectedStatusFilter = "ALL";
    this.activeView = "matrix"; // "matrix" veya "cards"
  }

  init() {
    this.bindEvents();
    this.populateMachineDropdowns();
    this.populateOperatorDropdowns();
    this.render();
  }

  getWeekInfo(offset = 0) {
    const now = new Date();
    // Haftanın başlangıcını Pazartesi yap
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Pazartesi, 6 = Pazar
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + (offset * 7));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // Hafta numarasını hesapla (ISO-8601)
    const target = new Date(monday.valueOf());
    const dayNr = (monday.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);

    const monthsTr = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const startStr = `${monday.getDate()} ${monthsTr[monday.getMonth()]}`;
    const endStr = `${sunday.getDate()} ${monthsTr[sunday.getMonth()]} ${sunday.getFullYear()}`;

    return {
      weekNumber,
      year: monday.getFullYear(),
      startDate: monday.toISOString().split("T")[0],
      endDate: sunday.toISOString().split("T")[0],
      displayRange: `${startStr} - ${endStr}`,
      isCurrentWeek: offset === 0
    };
  }

  bindEvents() {
    // Hafta Değiştirme Butonları
    const btnPrevWeek = document.getElementById("prod-prev-week");
    const btnNextWeek = document.getElementById("prod-next-week");
    const btnCurrentWeek = document.getElementById("prod-current-week");

    if (btnPrevWeek) {
      btnPrevWeek.addEventListener("click", () => {
        this.currentWeekOffset--;
        this.render();
      });
    }

    if (btnNextWeek) {
      btnNextWeek.addEventListener("click", () => {
        this.currentWeekOffset++;
        this.render();
      });
    }

    if (btnCurrentWeek) {
      btnCurrentWeek.addEventListener("click", () => {
        this.currentWeekOffset = 0;
        this.render();
      });
    }

    // Filtreler
    const machineFilter = document.getElementById("filter-prod-machine");
    if (machineFilter) {
      machineFilter.addEventListener("change", (e) => {
        this.selectedMachineFilter = e.target.value;
        this.render();
      });
    }

    const statusFilter = document.getElementById("filter-prod-status");
    if (statusFilter) {
      statusFilter.addEventListener("change", (e) => {
        this.selectedStatusFilter = e.target.value;
        this.render();
      });
    }

    // Görünüm Değiştirici (Matris vs Kartlar)
    const btnViewMatrix = document.getElementById("btn-prod-view-matrix");
    const btnViewCards = document.getElementById("btn-prod-view-cards");

    if (btnViewMatrix) {
      btnViewMatrix.addEventListener("click", () => {
        this.activeView = "matrix";
        btnViewMatrix.classList.add("bg-blue-600", "text-white");
        btnViewMatrix.classList.remove("bg-slate-100", "text-slate-700");
        if (btnViewCards) {
          btnViewCards.classList.remove("bg-blue-600", "text-white");
          btnViewCards.classList.add("bg-slate-100", "text-slate-700");
        }
        this.render();
      });
    }

    if (btnViewCards) {
      btnViewCards.addEventListener("click", () => {
        this.activeView = "cards";
        btnViewCards.classList.add("bg-blue-600", "text-white");
        btnViewCards.classList.remove("bg-slate-100", "text-slate-700");
        if (btnViewMatrix) {
          btnViewMatrix.classList.remove("bg-blue-600", "text-white");
          btnViewMatrix.classList.add("bg-slate-100", "text-slate-700");
        }
        this.render();
      });
    }

    // Yeni Plan Ekle Butonu ve Modalı
    const btnOpenAddPlan = document.getElementById("btn-open-add-production-plan");
    const modalAddPlan = document.getElementById("modal-add-production-plan");
    const formAddPlan = document.getElementById("form-add-production-plan");

    if (btnOpenAddPlan && modalAddPlan) {
      btnOpenAddPlan.addEventListener("click", () => {
        this.populateMachineDropdowns();
        this.populateOperatorDropdowns();
        if (formAddPlan) formAddPlan.reset();
        modalAddPlan.classList.add("show");
      });
    }

    if (formAddPlan) {
      formAddPlan.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveProductionPlan();
      });
    }

    // Hızlı Makine Üret Butonu ve Modalı
    const btnOpenQuickMachine = document.getElementById("btn-open-quick-machine");
    const modalQuickMachine = document.getElementById("modal-quick-machine");
    const formQuickMachine = document.getElementById("form-quick-machine");

    if (btnOpenQuickMachine && modalQuickMachine) {
      btnOpenQuickMachine.addEventListener("click", () => {
        this.populateDepartmentSelectInMachineModal();
        if (formQuickMachine) formQuickMachine.reset();
        modalQuickMachine.classList.add("show");
      });
    }

    if (formQuickMachine) {
      formQuickMachine.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleQuickMachineCreate();
      });
    }

    // Şablon Makine Üretme Butonları (Örn: + ENJEKSİYON 2000 vb.)
    document.querySelectorAll("[data-preset-machine]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const presetName = e.currentTarget.getAttribute("data-preset-machine");
        const presetCode = e.currentTarget.getAttribute("data-preset-code") || "";
        const nameInput = document.getElementById("quick-machine-name");
        const codeInput = document.getElementById("quick-machine-code");
        if (nameInput) nameInput.value = presetName;
        if (codeInput) codeInput.value = presetCode;
      });
    });

    // Baskı Sayaç Girişi Modalı Formu
    const formLogCount = document.getElementById("form-log-production-count");
    if (formLogCount) {
      formLogCount.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleLogProductionCountSubmit();
      });
    }

    // Yazdırma Butonu
    const btnPrintPlan = document.getElementById("btn-print-production-plan");
    if (btnPrintPlan) {
      btnPrintPlan.addEventListener("click", () => {
        window.print();
      });
    }
  }

  populateMachineDropdowns() {
    const rawMachines = appState.state.machines || [];
    const machines = rawMachines.map(m => typeof m === "string" ? { id: m, name: m } : m);

    // Filtre açılır kutusu
    const filterSelect = document.getElementById("filter-prod-machine");
    if (filterSelect) {
      const cur = filterSelect.value || "ALL";
      filterSelect.innerHTML = `
        <option value="ALL">Tüm Kayıtlı Makineler (${machines.length})</option>
        ${machines.map(m => `<option value="${m.id || m.name}">${m.name}</option>`).join("")}
      `;
      filterSelect.value = cur;
    }

    // Plan Ekleme modalındaki makine açılır kutusu
    const planMachineSelect = document.getElementById("plan-machine-select");
    if (planMachineSelect) {
      planMachineSelect.innerHTML = `
        <option value="">-- Kalıp Bağlanacak Makineyi Seçiniz --</option>
        ${machines.map(m => `<option value="${m.id || m.name}" data-name="${m.name}">${m.name} ${m.code ? `(${m.code})` : ''}</option>`).join("")}
      `;
    }
  }

  populateOperatorDropdowns() {
    const users = appState.state.users || [];
    const planOperatorSelect = document.getElementById("plan-operator-select");
    if (planOperatorSelect) {
      planOperatorSelect.innerHTML = `
        <option value="">-- Sorumlu Usta / Operatör Seçiniz --</option>
        ${users.map(u => `<option value="${u.name}">${u.name} (${u.role})</option>`).join("")}
      `;
    }
  }

  populateDepartmentSelectInMachineModal() {
    const depts = appState.state.departments || [];
    const select = document.getElementById("quick-machine-dept");
    if (select) {
      select.innerHTML = depts.map(d => `<option value="${d.id}">${d.icon} ${d.name}</option>`).join("");
      // Varsayılan olarak 1400 Üretim veya ilki
      const uretim = depts.find(d => d.name.includes("ÜRETİM") || d.name.includes("1400"));
      if (uretim) select.value = uretim.id;
    }
  }

  handleQuickMachineCreate() {
    const nameInput = document.getElementById("quick-machine-name");
    const codeInput = document.getElementById("quick-machine-code");
    const deptSelect = document.getElementById("quick-machine-dept");
    const locInput = document.getElementById("quick-machine-location");
    const notesInput = document.getElementById("quick-machine-notes");

    const name = (nameInput?.value || "").trim();
    if (!name) {
      alert("Lütfen makine adını giriniz.");
      return;
    }

    const machine = appState.registerMachine({
      name: name,
      code: codeInput?.value || "",
      departmentId: deptSelect?.value || "",
      location: locInput?.value || "Üretim Sahası",
      notes: notesInput?.value || ""
    });

    playAlertSound("call");
    logSystemAction("MAKİNE_ÜRETİLDİ", `Yeni makine parkura eklendi: ${name}`);

    document.getElementById("modal-quick-machine")?.classList.remove("show");
    document.getElementById("form-quick-machine")?.reset();

    this.populateMachineDropdowns();
    if (window.portalApp && window.portalApp.breakdown) {
      window.portalApp.breakdown.populateMachineSelect();
      window.portalApp.breakdown.render();
    }

    this.render();
    alert(`✅ "${name}" makinesi başarıyla üretildi ve fabrika parkuruna kaydedildi!`);
  }

  handleSaveProductionPlan() {
    const machineSelect = document.getElementById("plan-machine-select");
    const moldCodeInput = document.getElementById("plan-mold-code");
    const moldNameInput = document.getElementById("plan-mold-name");
    const prodNameInput = document.getElementById("plan-product-name");
    const targetQtyInput = document.getElementById("plan-target-qty");
    const daySelect = document.getElementById("plan-day-select");
    const cavityInput = document.getElementById("plan-cavity-count");
    const rawMaterialInput = document.getElementById("plan-raw-material");
    const cycleTimeInput = document.getElementById("plan-cycle-time");
    const operatorSelect = document.getElementById("plan-operator-select");
    const statusSelect = document.getElementById("plan-status-select");
    const notesInput = document.getElementById("plan-notes");

    const machineId = machineSelect?.value;
    const selectedOption = machineSelect?.options[machineSelect.selectedIndex];
    const machineName = selectedOption?.getAttribute("data-name") || machineSelect?.value;

    const moldName = (moldNameInput?.value || "").trim();
    const targetQty = Number(targetQtyInput?.value) || 0;

    if (!machineId || !machineName) {
      alert("Lütfen kalıp bağlanacak makineyi seçiniz.");
      return;
    }

    if (!moldName) {
      alert("Lütfen kalıp adını veya kodunu giriniz.");
      return;
    }

    if (targetQty <= 0) {
      alert("Lütfen geçerli bir hedef baskı adedi giriniz.");
      return;
    }

    const weekInfo = this.getWeekInfo(this.currentWeekOffset);

    const newPlan = appState.addProductionPlan({
      weekNumber: weekInfo.weekNumber,
      weekStart: weekInfo.startDate,
      weekEnd: weekInfo.endDate,
      machineId: machineId,
      machineName: machineName,
      moldCode: (moldCodeInput?.value || "").trim() || "KLP-" + Math.floor(100 + Math.random() * 900),
      moldName: moldName,
      productName: (prodNameInput?.value || "").trim() || "Plastik Parça",
      targetQuantity: targetQty,
      producedQuantity: 0,
      unit: "Adet",
      day: daySelect?.value || "Hafta Boyu",
      cavityCount: cavityInput?.value || "1 Gözlü",
      rawMaterial: (rawMaterialInput?.value || "").trim() || "Polipropilen",
      cycleTimeSec: Number(cycleTimeInput?.value) || 40,
      operatorName: operatorSelect?.value || "Sorumlu Atanmadı",
      status: statusSelect?.value || "Planlandı",
      notes: (notesInput?.value || "").trim()
    });

    playAlertSound("call");
    logSystemAction("ÜRETİM_PLANI_EKLENDİ", `${machineName} için ${moldName} (${targetQty} adet) planlandı.`);

    // Telegram Grubu Bildirimi
    this.sendProductionTelegramNotification(newPlan, "NEW_PLAN");

    document.getElementById("modal-add-production-plan")?.classList.remove("show");
    document.getElementById("form-add-production-plan")?.reset();

    this.render();
  }

  openLogCountModal(planId) {
    const plans = appState.state.productionPlans || [];
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    const modal = document.getElementById("modal-log-production-count");
    if (!modal) return;

    document.getElementById("log-plan-id").value = plan.id;
    document.getElementById("log-plan-machine").textContent = plan.machineName;
    document.getElementById("log-plan-mold").textContent = `${plan.moldName} (${plan.moldCode || ''})`;
    document.getElementById("log-plan-target").textContent = Number(plan.targetQuantity).toLocaleString("tr-TR") + " Adet";
    document.getElementById("log-plan-current").textContent = Number(plan.producedQuantity).toLocaleString("tr-TR") + " Adet";
    
    const countInput = document.getElementById("log-count-input");
    if (countInput) {
      countInput.value = "";
      setTimeout(() => countInput.focus(), 150);
    }

    modal.classList.add("show");
  }

  handleLogProductionCountSubmit() {
    const planId = document.getElementById("log-plan-id")?.value;
    const countInput = document.getElementById("log-count-input");
    const count = Number(countInput?.value) || 0;

    if (!planId || count <= 0) {
      alert("Lütfen basılan geçerli bir adet giriniz.");
      return;
    }

    const updated = appState.logProductionCount(planId, count);
    if (updated) {
      playAlertSound("call");
      logSystemAction("BASKI_SAYACI_EKLENDİ", `${updated.machineName} - ${updated.moldName}: +${count} adet basıldı (Toplam: ${updated.producedQuantity}/${updated.targetQuantity}).`);

      if (updated.status === "Tamamlandı") {
        this.sendProductionTelegramNotification(updated, "COMPLETED");
      }

      document.getElementById("modal-log-production-count")?.classList.remove("show");
      this.render();
    }
  }

  async sendProductionTelegramNotification(plan, type = "NEW_PLAN") {
    const config = appState.state.telegramConfig;
    if (!config || !config.enabled || !config.botToken || !config.chatId) return;
    if (config.notifyProduction === false) return;

    let text = "";
    if (type === "NEW_PLAN") {
      text = `📋 *YENİ HAFTALIK KALIP BASKI PLANI*\n\n` +
             `⚙️ *Makine:* ${plan.machineName}\n` +
             `🔩 *Kalıp:* ${plan.moldName} (${plan.moldCode || '-'})\n` +
             `📦 *Basılacak Parça:* ${plan.productName}\n` +
             `🎯 *Hedef Baskı:* ${Number(plan.targetQuantity).toLocaleString('tr-TR')} ${plan.unit}\n` +
             `📅 *Planlanan Gün:* ${plan.day}\n` +
             `🧪 *Hammadde:* ${plan.rawMaterial || '-'}\n` +
             `👤 *Sorumlu Usta:* ${plan.operatorName || '-'}\n` +
             `⏱️ *Durum:* ${plan.status}\n` +
             (plan.notes ? `📝 *Not:* ${plan.notes}\n` : '') +
             `\n🏭 _SODSAN Fabrika Portalı_`;
    } else if (type === "COMPLETED") {
      text = `🎉 *KALIP BASKISI TAMAMLANDI!*\n\n` +
             `⚙️ *Makine:* ${plan.machineName}\n` +
             `🔩 *Kalıp:* ${plan.moldName}\n` +
             `✅ *Üretilen:* ${Number(plan.producedQuantity).toLocaleString('tr-TR')} / ${Number(plan.targetQuantity).toLocaleString('tr-TR')} Adet\n` +
             `👤 *Sorumlu:* ${plan.operatorName}\n` +
             `\n_Kalıp sökümü ve yeni kalıp bağlama hazırlığı yapılabilir._\n` +
             `🏭 _SODSAN Fabrika Portalı_`;
    }

    try {
      const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: text,
          parse_mode: "Markdown"
        })
      });
    } catch (e) {
      console.warn("Telegram üretim bildirimi iletilemedi:", e);
    }
  }

  render() {
    const weekInfo = this.getWeekInfo(this.currentWeekOffset);

    // Hafta Başlığını Güncelle
    const titleEl = document.getElementById("prod-week-title");
    if (titleEl) {
      titleEl.textContent = `${weekInfo.year} Yılı - ${weekInfo.weekNumber}. Hafta`;
    }

    const rangeEl = document.getElementById("prod-week-range");
    if (rangeEl) {
      rangeEl.textContent = weekInfo.displayRange + (weekInfo.isCurrentWeek ? " (Bu Hafta)" : "");
    }

    // Filtreleme
    const allPlans = appState.state.productionPlans || [];
    let filtered = allPlans.filter(p => {
      // Hafta eşleşmesi: Eğer planda weekNumber varsa denetle, yoksa göster
      if (p.weekNumber && p.weekNumber !== weekInfo.weekNumber) return false;

      // Makine filtresi
      if (this.selectedMachineFilter !== "ALL") {
        const matchesMachine = (p.machineId === this.selectedMachineFilter) || (p.machineName === this.selectedMachineFilter);
        if (!matchesMachine) return false;
      }

      // Durum filtresi
      if (this.selectedStatusFilter !== "ALL") {
        if (p.status !== this.selectedStatusFilter) return false;
      }

      return true;
    });

    // İstatistikleri Hesapla & Güncelle
    this.renderKPIs(filtered);

    // Görünümü Çiz
    if (this.activeView === "matrix") {
      this.renderMatrixView(filtered);
    } else {
      this.renderCardsView(filtered);
    }
  }

  renderKPIs(plans) {
    let totalTarget = 0;
    let totalProduced = 0;
    let activeMoldCount = 0;
    let setupCount = 0;
    let completedCount = 0;

    plans.forEach(p => {
      totalTarget += Number(p.targetQuantity) || 0;
      totalProduced += Number(p.producedQuantity) || 0;
      if (p.status === "Üretimde") activeMoldCount++;
      if (p.status === "Kalıp Bağlanıyor") setupCount++;
      if (p.status === "Tamamlandı") completedCount++;
    });

    const percent = totalTarget > 0 ? Math.min(100, Math.round((totalProduced / totalTarget) * 100)) : 0;

    const elTarget = document.getElementById("prod-kpi-target");
    const elProduced = document.getElementById("prod-kpi-produced");
    const elPercent = document.getElementById("prod-kpi-percent");
    const elProgressBar = document.getElementById("prod-kpi-progress-bar");
    const elActive = document.getElementById("prod-kpi-active");
    const elSetup = document.getElementById("prod-kpi-setup");

    if (elTarget) elTarget.textContent = totalTarget.toLocaleString("tr-TR") + " Adet";
    if (elProduced) elProduced.textContent = totalProduced.toLocaleString("tr-TR") + " Adet";
    if (elPercent) elPercent.textContent = `%${percent}`;
    if (elProgressBar) elProgressBar.style.width = `${percent}%`;
    if (elActive) elActive.textContent = `${activeMoldCount} Makine`;
    if (elSetup) elSetup.textContent = `${setupCount} Kalıp`;
  }

  getStatusBadge(status) {
    switch (status) {
      case "Üretimde":
        return `<span class="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> ⚙️ Baskıda
                </span>`;
      case "Kalıp Bağlanıyor":
        return `<span class="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  🔧 Kalıp Bağlanıyor
                </span>`;
      case "Tamamlandı":
        return `<span class="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                  ✅ Tamamlandı
                </span>`;
      case "Durduruldu":
      case "Arıza":
        return `<span class="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                  🚨 Durduruldu
                </span>`;
      default:
        return `<span class="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                  ⏳ Planlandı
                </span>`;
    }
  }

  renderMatrixView(plans) {
    const container = document.getElementById("prod-view-container");
    if (!container) return;

    const rawMachines = appState.state.machines || [];
    const machines = rawMachines.map(m => typeof m === "string" ? { id: m, name: m, code: "" } : m);

    // Eğer filtre varsa sadece o makineyi listele
    const displayMachines = this.selectedMachineFilter === "ALL" 
      ? machines 
      : machines.filter(m => m.id === this.selectedMachineFilter || m.name === this.selectedMachineFilter);

    if (displayMachines.length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          <span class="text-3xl block mb-2">⚙️</span>
          <p class="font-bold">Kayıtlı makine bulunamadı.</p>
          <p class="text-xs text-slate-400 mt-1">Yukarıdaki "⚡ Makine Üret / Ekle" butonu ile yeni enjeksiyon makineleri ekleyebilirsiniz.</p>
        </div>
      `;
      return;
    }

    const days = [
      { key: "Pazartesi", label: "Pzt", full: "Pazartesi" },
      { key: "Salı", label: "Sal", full: "Salı" },
      { key: "Çarşamba", label: "Çar", full: "Çarşamba" },
      { key: "Perşembe", label: "Per", full: "Perşembe" },
      { key: "Cuma", label: "Cum", full: "Cuma" },
      { key: "Cumartesi", label: "Cmt", full: "Cumartesi" },
      { key: "Pazar", label: "Paz", full: "Pazar" }
    ];

    container.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-3 sm:p-4 bg-slate-900 text-white flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl">📊</span>
            <div>
              <h3 class="text-xs sm:text-sm font-black uppercase tracking-wider text-blue-400">Haftalık Kalıp Baskı Matrisi</h3>
              <p class="text-[11px] text-slate-300">Makinelere bağlanan kalıplar, baskı hedefleri ve gerçekleşen adetler</p>
            </div>
          </div>
          <span class="text-xs font-bold bg-slate-800 text-slate-200 px-3 py-1 rounded-lg border border-slate-700">
            ${displayMachines.length} Kayıtlı Makine
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr class="bg-slate-100 text-[11px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-200">
                <th class="py-3 px-3 sm:px-4 w-48 sticky left-0 bg-slate-100 z-10 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">Kayıtlı Makine</th>
                <th class="py-3 px-3 sm:px-4 w-64">Bağlı / Planlanan Kalıp & Parça</th>
                <th class="py-3 px-3 sm:px-4 text-center w-36">Hedef Adet</th>
                <th class="py-3 px-3 sm:px-4 text-center w-36">Basılan Adet</th>
                <th class="py-3 px-3 sm:px-4 w-44">İlerleme Oranı</th>
                <th class="py-3 px-3 sm:px-4 text-center w-32">Gün / Vardiya</th>
                <th class="py-3 px-3 sm:px-4 text-center w-32">Durum</th>
                <th class="py-3 px-3 sm:px-4 text-right w-28">Hızlı Aksiyon</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-xs">
              ${displayMachines.map(mac => {
                const macPlans = plans.filter(p => p.machineId === mac.id || p.machineName === mac.name);

                if (macPlans.length === 0) {
                  return `
                    <tr class="hover:bg-slate-50/70 transition">
                      <td class="py-3.5 px-3 sm:px-4 font-black text-slate-900 sticky left-0 bg-white z-10 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                        <div class="flex items-center gap-1.5">
                          <span class="text-base">⚙️</span>
                          <span>${mac.name}</span>
                        </div>
                        <span class="text-[10px] text-slate-400 font-normal">${mac.code || 'Enjeksiyon Hattı'}</span>
                      </td>
                      <td colspan="6" class="py-3.5 px-4 text-slate-400 italic">
                        Bu hafta için kalıp baskı planı henüz girilmedi.
                      </td>
                      <td class="py-3.5 px-3 sm:px-4 text-right">
                        <button data-quick-add-plan="${mac.id}" data-mac-name="${mac.name}" class="text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition border border-blue-200">
                          + Kalıp Ata
                        </button>
                      </td>
                    </tr>
                  `;
                }

                return macPlans.map((plan, idx) => {
                  const target = Number(plan.targetQuantity) || 0;
                  const produced = Number(plan.producedQuantity) || 0;
                  const pct = target > 0 ? Math.min(100, Math.round((produced / target) * 100)) : 0;
                  const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-600' : 'bg-amber-500';

                  return `
                    <tr class="hover:bg-slate-50/80 transition ${idx > 0 ? 'bg-slate-50/30' : ''}">
                      <td class="py-3 px-3 sm:px-4 font-black text-slate-900 sticky left-0 bg-white z-10 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                        <div class="flex items-center gap-1.5">
                          <span class="text-base">⚙️</span>
                          <span>${mac.name}</span>
                        </div>
                        <div class="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                          <span>${mac.code || 'Enjeksiyon'}</span>
                          ${plan.operatorName ? `• <span class="text-slate-600 font-bold">👤 ${plan.operatorName}</span>` : ''}
                        </div>
                      </td>

                      <td class="py-3 px-3 sm:px-4">
                        <div class="font-extrabold text-slate-900 flex items-center gap-1">
                          <span class="text-blue-600 font-black">🔩</span>
                          <span>${plan.moldName}</span>
                        </div>
                        <div class="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span class="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold">${plan.moldCode || 'KLP'}</span>
                          <span>${plan.productName}</span>
                          ${plan.cavityCount ? `<span class="text-slate-400">(${plan.cavityCount})</span>` : ''}
                        </div>
                      </td>

                      <td class="py-3 px-3 sm:px-4 text-center font-black text-slate-900 text-sm">
                        ${target.toLocaleString("tr-TR")} <span class="text-[10px] text-slate-400 font-normal">${plan.unit}</span>
                      </td>

                      <td class="py-3 px-3 sm:px-4 text-center font-black text-blue-700 text-sm">
                        ${produced.toLocaleString("tr-TR")} <span class="text-[10px] text-slate-400 font-normal">${plan.unit}</span>
                      </td>

                      <td class="py-3 px-3 sm:px-4">
                        <div class="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span class="text-slate-600">%${pct} tamamlandı</span>
                          <span class="text-slate-400">${(target - produced > 0 ? (target - produced).toLocaleString("tr-TR") + ' kaldı' : 'Hedef Aşıldı')}</span>
                        </div>
                        <div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div class="${barColor} h-2 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                        </div>
                      </td>

                      <td class="py-3 px-3 sm:px-4 text-center">
                        <span class="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md text-[11px] inline-block">
                          📅 ${plan.day}
                        </span>
                      </td>

                      <td class="py-3 px-3 sm:px-4 text-center">
                        ${this.getStatusBadge(plan.status)}
                      </td>

                      <td class="py-3 px-3 sm:px-4 text-right">
                        <div class="flex items-center justify-end gap-1">
                          <button data-log-count="${plan.id}" class="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-[11px] px-2.5 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1" title="Baskı Sayacı Ekle">
                            <span>+</span> <span>Adet</span>
                          </button>
                          <button data-delete-plan="${plan.id}" class="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition" title="Planı Sil">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join("");
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindMatrixActionButtons(container);
  }

  renderCardsView(plans) {
    const container = document.getElementById("prod-view-container");
    if (!container) return;

    if (plans.length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          <span class="text-3xl block mb-2">📋</span>
          <p class="font-bold">Bu hafta için seçili kriterlere uygun üretim planı bulunamadı.</p>
          <p class="text-xs text-slate-400 mt-1">"+ Yeni Kalıp Baskı Planı Ekle" butonuna basarak iş emri oluşturabilirsiniz.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${plans.map(plan => {
          const target = Number(plan.targetQuantity) || 0;
          const produced = Number(plan.producedQuantity) || 0;
          const pct = target > 0 ? Math.min(100, Math.round((produced / target) * 100)) : 0;
          const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-600' : 'bg-amber-500';

          return `
            <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-3">
              <div>
                <!-- Üst Başlık: Makine ve Durum -->
                <div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <span class="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      ⚙️ ${plan.machineName}
                    </span>
                    <h4 class="font-extrabold text-slate-900 text-sm mt-1 flex items-center gap-1.5">
                      <span>🔩</span> <span>${plan.moldName}</span>
                    </h4>
                  </div>
                  <div>
                    ${this.getStatusBadge(plan.status)}
                  </div>
                </div>

                <!-- Detay Bilgileri -->
                <div class="space-y-1.5 mt-2.5 text-xs text-slate-600">
                  <div class="flex items-center justify-between">
                    <span class="text-slate-400">Kalıp Kodu:</span>
                    <span class="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded">${plan.moldCode || '-'}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-400">Basılacak Parça:</span>
                    <span class="font-bold text-slate-800 text-right max-w-[180px] truncate">${plan.productName}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-400">Kalıp Göz Sayısı:</span>
                    <span class="font-medium text-slate-700">${plan.cavityCount || '1 Göz'}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-400">Hammadde:</span>
                    <span class="font-medium text-slate-700 text-right max-w-[180px] truncate">${plan.rawMaterial || '-'}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-400">Sorumlu Usta:</span>
                    <span class="font-bold text-slate-900">👤 ${plan.operatorName || 'Atanmadı'}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-slate-400">Planlanan Gün:</span>
                    <span class="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">📅 ${plan.day}</span>
                  </div>
                </div>

                <!-- Baskı İlerleme Çubuğu -->
                <div class="mt-3.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div class="flex items-center justify-between text-xs font-black mb-1">
                    <span class="text-slate-800">🎯 ${produced.toLocaleString("tr-TR")} / ${target.toLocaleString("tr-TR")} ${plan.unit}</span>
                    <span class="text-blue-700 font-extrabold">%${pct}</span>
                  </div>
                  <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div class="${barColor} h-2.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                  </div>
                  <div class="text-[10px] text-slate-400 mt-1 flex justify-between">
                    <span>${pct >= 100 ? '✅ Hedef Tamamlandı' : 'Baskı devam ediyor'}</span>
                    <span>${target - produced > 0 ? (target - produced).toLocaleString("tr-TR") + ' adet kaldı' : ''}</span>
                  </div>
                </div>

                ${plan.notes ? `
                  <div class="mt-2.5 text-[11px] text-slate-500 bg-amber-50/60 border border-amber-200/60 p-2 rounded-lg">
                    <span class="font-bold text-amber-900">Not:</span> ${plan.notes}
                  </div>
                ` : ''}
              </div>

              <!-- Kart Alt Butonları -->
              <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <button data-log-count="${plan.id}" class="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs py-2 px-3 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer">
                  <span>+</span> <span>Baskı Sayacı Ekle</span>
                </button>
                <button data-change-status="${plan.id}" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-2.5 rounded-xl transition" title="Durum Güncelle">
                  ⚙️
                </button>
                <button data-delete-plan="${plan.id}" class="bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs py-2 px-2.5 rounded-xl transition" title="Planı Sil">
                  🗑️
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    this.bindMatrixActionButtons(container);
  }

  bindMatrixActionButtons(container) {
    // Baskı sayacı ekle butonları
    container.querySelectorAll("[data-log-count]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const planId = e.currentTarget.getAttribute("data-log-count");
        this.openLogCountModal(planId);
      });
    });

    // Boş makineye hızlı kalıp atama butonu
    container.querySelectorAll("[data-quick-add-plan]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const macId = e.currentTarget.getAttribute("data-quick-add-plan");
        const macName = e.currentTarget.getAttribute("data-mac-name");
        this.populateMachineDropdowns();
        this.populateOperatorDropdowns();
        const sel = document.getElementById("plan-machine-select");
        if (sel) sel.value = macId || macName;
        document.getElementById("modal-add-production-plan")?.classList.add("show");
      });
    });

    // Plan Silme
    container.querySelectorAll("[data-delete-plan]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const planId = e.currentTarget.getAttribute("data-delete-plan");
        if (confirm("Bu kalıp baskı planını silmek istediğinize emin misiniz?")) {
          appState.deleteProductionPlan(planId);
          this.render();
        }
      });
    });

    // Durum Değiştirme
    container.querySelectorAll("[data-change-status]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const planId = e.currentTarget.getAttribute("data-change-status");
        const plans = appState.state.productionPlans || [];
        const plan = plans.find(p => p.id === planId);
        if (!plan) return;

        const statuses = ["Planlandı", "Kalıp Bağlanıyor", "Üretimde", "Tamamlandı", "Durduruldu"];
        const curIdx = statuses.indexOf(plan.status);
        const nextStatus = statuses[(curIdx + 1) % statuses.length];

        appState.updateProductionPlan(planId, { status: nextStatus });
        this.render();
      });
    });
  }
}
