// SODSAN Fabrika Portalı - Forklift Çağrı, Parkur & Bot Entegrasyon Modülü (forklift.js)
import { appState, playAlertSound, speakVoiceAlert, logSystemAction, isAdmin, isViewer } from './data.js';

export class ForkliftModule {
  constructor() {
    this.filterStatus = "ALL";
    this.fleetFilterStatus = "ALL";
    this.fleetFilterFuel = "ALL";
    this.activeSubtab = "calls"; // "calls" | "fleet"
  }

  init() {
    this.populateDepartmentSelect();
    this.bindEvents();
    this.render();
  }

  populateDepartmentSelect() {
    const depSelect = document.getElementById("forklift-call-department");
    if (!depSelect) return;

    depSelect.innerHTML = "";
    appState.state.departments.forEach(dep => {
      depSelect.innerHTML += `<option value="${dep.id}">${dep.icon} ${dep.name}</option>`;
    });
  }

  bindEvents() {
    // 1. Alt Sekmeler (Çağrılar vs Forklift Parkuru)
    const btnCalls = document.getElementById("subtab-btn-forklift-calls");
    const btnFleet = document.getElementById("subtab-btn-forklift-fleet");

    if (btnCalls) {
      btnCalls.addEventListener("click", () => this.switchSubtab("calls"));
    }
    if (btnFleet) {
      btnFleet.addEventListener("click", () => this.switchSubtab("fleet"));
    }

    // 2. Çağrı Modalı Açma
    const openCallModal = () => {
      if (window.portalApp?.closeMobileSidebar) window.portalApp.closeMobileSidebar();
      const modal = document.getElementById("modal-call-forklift");
      if (modal) {
        const depSelect = document.getElementById("forklift-call-department");
        if (depSelect && appState.state.currentUser && appState.state.currentUser.departmentId) {
          depSelect.value = appState.state.currentUser.departmentId;
        }
        modal.classList.add("show");
      }
    };

    document.querySelectorAll("#btn-open-call-forklift, [data-open-call-forklift]").forEach(btn => {
      btn.addEventListener("click", openCallModal);
    });

    // 3. Yeni Forklift Ekleme Butonu
    const btnOpenAddForklift = document.getElementById("btn-open-add-forklift");
    if (btnOpenAddForklift) {
      btnOpenAddForklift.addEventListener("click", () => this.openAddForkliftModal());
    }

    // 4. Forklift Yakıt Değişimi Dinleyicisi (Şarjda seçeneği sadece Elektrikli için gösterilsin)
    const fuelSelect = document.getElementById("forklift-form-fuel");
    if (fuelSelect) {
      fuelSelect.addEventListener("change", () => this.handleFuelTypeChange());
    }

    // 5. Forklift Formu Submit
    const formForklift = document.getElementById("form-add-edit-forklift");
    if (formForklift) {
      formForklift.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveForklift();
      });
    }

    // 6. Filo Filtreleri
    const filterFleetStatus = document.getElementById("filter-forklift-fleet-status");
    if (filterFleetStatus) {
      filterFleetStatus.addEventListener("change", (e) => {
        this.fleetFilterStatus = e.target.value;
        this.renderForkliftFleet();
      });
    }

    const filterFleetFuel = document.getElementById("filter-forklift-fleet-fuel");
    if (filterFleetFuel) {
      filterFleetFuel.addEventListener("change", (e) => {
        this.fleetFilterFuel = e.target.value;
        this.renderForkliftFleet();
      });
    }

    // 7. Telegram ve Bot Ayarları (Sadece Admin Görebilir)
    const btnTelegramSettings = document.getElementById("btn-telegram-settings");
    if (btnTelegramSettings) {
      btnTelegramSettings.addEventListener("click", () => {
        if (!isAdmin()) {
          alert("Yetki Hatası: Telegram ve bot ayarlarını yalnızca Sistem Yöneticisi (Admin) görüntüleyebilir!");
          return;
        }
        const modal = document.getElementById("modal-telegram-settings");
        if (modal) {
          const cfg = appState.state.telegramConfig || {};
          document.getElementById("telegram-token").value = cfg.botToken || "";
          document.getElementById("telegram-chat-id").value = cfg.chatId || "-1004438133842";
          document.getElementById("telegram-enabled").checked = cfg.enabled !== false;

          const elNew = document.getElementById("tg-notify-forklift-new");
          if (elNew) elNew.checked = cfg.notifyForkliftNew !== false;

          const elEnroute = document.getElementById("tg-notify-forklift-enroute");
          if (elEnroute) elEnroute.checked = cfg.notifyForkliftEnRoute !== false;

          const elDone = document.getElementById("tg-notify-forklift-done");
          if (elDone) elDone.checked = cfg.notifyForkliftDone !== false;

          const elBreakdown = document.getElementById("tg-notify-breakdown");
          if (elBreakdown) elBreakdown.checked = cfg.notifyBreakdown !== false;

          const elCalendar = document.getElementById("tg-notify-calendar");
          if (elCalendar) elCalendar.checked = cfg.notifyCalendar !== false;

          const elVoice = document.getElementById("tg-voice-announce");
          if (elVoice) elVoice.checked = cfg.voiceAnnounceEnabled !== false;

          const elWebhook = document.getElementById("tg-webhook-call-url");
          if (elWebhook) elWebhook.value = cfg.webhookCallUrl || "";

          modal.classList.add("show");
        }
      });
    }

    const btnTest = document.getElementById("btn-telegram-test");
    if (btnTest) {
      btnTest.addEventListener("click", () => {
        this.testTelegramConnection();
      });
    }

    const filterStatus = document.getElementById("filter-forklift-status");
    if (filterStatus) {
      filterStatus.addEventListener("change", (e) => {
        this.filterStatus = e.target.value;
        this.renderForkliftRequests();
      });
    }

    const formCall = document.getElementById("form-call-forklift");
    if (formCall) {
      formCall.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveForkliftCall();
      });
    }

    const formTelegram = document.getElementById("form-telegram-settings");
    if (formTelegram) {
      formTelegram.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveTelegramSettings();
      });
    }
  }

  switchSubtab(tab) {
    this.activeSubtab = tab;
    const btnCalls = document.getElementById("subtab-btn-forklift-calls");
    const btnFleet = document.getElementById("subtab-btn-forklift-fleet");
    const paneCalls = document.getElementById("subpane-forklift-calls");
    const paneFleet = document.getElementById("subpane-forklift-fleet");

    if (tab === "calls") {
      if (btnCalls) {
        btnCalls.className = "px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm cursor-pointer";
      }
      if (btnFleet) {
        btnFleet.className = "px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer";
      }
      if (paneCalls) paneCalls.classList.remove("hidden");
      if (paneFleet) paneFleet.classList.add("hidden");
      this.renderForkliftRequests();
    } else {
      if (btnFleet) {
        btnFleet.className = "px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm cursor-pointer";
      }
      if (btnCalls) {
        btnCalls.className = "px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer";
      }
      if (paneFleet) paneFleet.classList.remove("hidden");
      if (paneCalls) paneCalls.classList.add("hidden");
      this.renderForkliftFleet();
    }
  }

  handleFuelTypeChange() {
    const fuelSelect = document.getElementById("forklift-form-fuel");
    const chargeContainer = document.getElementById("container-status-charge");
    const chargeNotice = document.getElementById("fuel-charge-notice");
    if (!fuelSelect || !chargeContainer) return;

    const isElectric = fuelSelect.value === "Elektrikli";
    if (isElectric) {
      chargeContainer.style.display = "flex";
      if (chargeNotice) chargeNotice.style.display = "block";
    } else {
      chargeContainer.style.display = "none";
      if (chargeNotice) chargeNotice.style.display = "none";
      // Eğer şarjda seçiliyse Aktif'e al
      const chargeRadio = chargeContainer.querySelector("input[value='Şarjda']");
      if (chargeRadio && chargeRadio.checked) {
        const activeRadio = document.querySelector("input[name='forklift-form-status'][value='Aktif']");
        if (activeRadio) activeRadio.checked = true;
      }
    }
  }

  openAddForkliftModal() {
    if (!isAdmin()) {
      alert("Yetki Hatası: Forklift ekleme yetkisi yalnızca Sistem Yöneticisi (Admin) hesabına aittir!");
      return;
    }

    const modal = document.getElementById("modal-add-edit-forklift");
    const form = document.getElementById("form-add-edit-forklift");
    const titleEl = document.getElementById("modal-forklift-form-title");
    if (!modal || !form) return;

    form.reset();
    document.getElementById("forklift-form-id").value = "";
    if (titleEl) titleEl.innerHTML = "<span>🚜</span> Yeni Forklift Tanımla";

    const activeRadio = document.querySelector("input[name='forklift-form-status'][value='Aktif']");
    if (activeRadio) activeRadio.checked = true;

    this.handleFuelTypeChange();
    modal.classList.add("show");
  }

  openEditForkliftModal(forkliftId) {
    if (!isAdmin()) {
      alert("Yetki Hatası: Forklift düzenleme yetkisi yalnızca Sistem Yöneticisi (Admin) hesabına aittir!");
      return;
    }

    const forklift = (appState.state.forklifts || []).find(f => f.id === forkliftId);
    if (!forklift) return;

    const modal = document.getElementById("modal-add-edit-forklift");
    const form = document.getElementById("form-add-edit-forklift");
    const titleEl = document.getElementById("modal-forklift-form-title");
    if (!modal || !form) return;

    document.getElementById("forklift-form-id").value = forklift.id;
    document.getElementById("forklift-form-code").value = forklift.code || "";
    document.getElementById("forklift-form-brand").value = forklift.brand || "";
    document.getElementById("forklift-form-capacity").value = forklift.capacity || "2.5 Ton";
    document.getElementById("forklift-form-fuel").value = forklift.fuelType || "Elektrikli";
    document.getElementById("forklift-form-operator").value = forklift.operatorName || "";
    document.getElementById("forklift-form-notes").value = forklift.notes || "";

    if (titleEl) titleEl.innerHTML = `<span>✏️</span> Forklift Düzenle: ${forklift.code}`;

    this.handleFuelTypeChange();

    const statusRadio = document.querySelector(`input[name='forklift-form-status'][value='${forklift.status}']`);
    if (statusRadio && (forklift.status !== "Şarjda" || forklift.fuelType === "Elektrikli")) {
      statusRadio.checked = true;
    } else {
      const activeRadio = document.querySelector("input[name='forklift-form-status'][value='Aktif']");
      if (activeRadio) activeRadio.checked = true;
    }

    modal.classList.add("show");
  }

  saveForklift() {
    if (!isAdmin()) {
      alert("Yetki Hatası: Forklift kaydetme yetkisi yalnızca Sistem Yöneticisi (Admin) hesabına aittir!");
      return;
    }

    const id = document.getElementById("forklift-form-id").value;
    const code = (document.getElementById("forklift-form-code").value || "").trim().toUpperCase();
    const brand = (document.getElementById("forklift-form-brand").value || "").trim();
    const capacity = document.getElementById("forklift-form-capacity").value;
    const fuelType = document.getElementById("forklift-form-fuel").value;
    const operatorName = (document.getElementById("forklift-form-operator").value || "").trim();
    const notes = (document.getElementById("forklift-form-notes").value || "").trim();

    const statusRadio = document.querySelector("input[name='forklift-form-status']:checked");
    let status = statusRadio ? statusRadio.value : "Aktif";

    // Şarjda kuralı: SADECE Elektrikli için geçerli!
    if (fuelType !== "Elektrikli" && status === "Şarjda") {
      status = "Aktif";
    }

    if (!code || !brand) {
      alert("Lütfen en azından Forklift Kodu/No ve Markasını giriniz!");
      return;
    }

    if (!Array.isArray(appState.state.forklifts)) {
      appState.state.forklifts = [];
    }

    if (id) {
      const idx = appState.state.forklifts.findIndex(f => f.id === id);
      if (idx !== -1) {
        appState.state.forklifts[idx] = {
          ...appState.state.forklifts[idx],
          code,
          brand,
          capacity,
          fuelType,
          status,
          operatorName,
          notes,
          updatedAt: new Date().toISOString()
        };

        logSystemAction(
          "FORKLİFT_GÜNCELLEME",
          `${code} (${brand} - ${capacity}) forklift bilgileri güncellendi. Durum: ${status}`,
          { id, code, status }
        );
      }
    } else {
      const newForklift = {
        id: `fk_${Date.now()}`,
        code,
        brand,
        capacity,
        fuelType,
        status,
        operatorName,
        notes,
        createdAt: new Date().toISOString()
      };

      appState.state.forklifts.push(newForklift);

      logSystemAction(
        "FORKLİFT_EKLEME",
        `Yeni forklift parkura eklendi: ${code} (${brand} ${capacity} - ${fuelType})`,
        { id: newForklift.id, code, status }
      );
    }

    appState.saveState();

    const modal = document.getElementById("modal-add-edit-forklift");
    if (modal) modal.classList.remove("show");

    this.render();
    alert(`✅ Forklift (${code}) başarıyla kaydedildi!`);
  }

  setForkliftStatus(id, newStatus) {
    const forklift = (appState.state.forklifts || []).find(f => f.id === id);
    if (!forklift) return;

    if (newStatus === "Şarjda" && forklift.fuelType !== "Elektrikli") {
      alert("Hata: 'Şarjda' durumu yalnızca elektrikli forkliftler için geçerlidir!");
      return;
    }

    forklift.status = newStatus;
    forklift.updatedAt = new Date().toISOString();
    appState.saveState();

    const uName = appState.state.currentUser ? appState.state.currentUser.name : "Operatör";
    logSystemAction(
      "FORKLİFT_DURUM",
      `${uName}, ${forklift.code} forkliftinin durumunu [${newStatus}] olarak güncelledi.`,
      { id, code: forklift.code, status: newStatus }
    );

    playAlertSound("call");
    this.render();
  }

  deleteForklift(id) {
    if (!isAdmin()) {
      alert("Yetki Hatası: Forklift silme yetkisi yalnızca Sistem Yöneticisi (Admin) hesabına aittir!");
      return;
    }

    const forklift = (appState.state.forklifts || []).find(f => f.id === id);
    if (!forklift) return;

    if (confirm(`"${forklift.code} - ${forklift.brand}" forkliftini parkurdan silmek istediğinize emin misiniz?`)) {
      const uName = appState.state.currentUser ? appState.state.currentUser.name : "Yönetici";
      logSystemAction(
        "FORKLİFT_SİLME",
        `${uName}, ${forklift.code} (${forklift.brand}) forkliftini parkurdan sildi.`,
        { id, code: forklift.code }
      );

      appState.state.forklifts = appState.state.forklifts.filter(f => f.id !== id);
      appState.saveState();
      this.render();
    }
  }

  render() {
    // 1. Yetki Kontrolü: Telegram ayarları ve yeni forklift ekleme butonlarını yönet
    const adminMode = isAdmin();

    const btnTelegramSettings = document.getElementById("btn-telegram-settings");
    if (btnTelegramSettings) {
      btnTelegramSettings.style.display = adminMode ? "" : "none";
    }

    const btnOpenAddForklift = document.getElementById("btn-open-add-forklift");
    if (btnOpenAddForklift) {
      btnOpenAddForklift.style.display = adminMode ? "" : "none";
    }

    this.renderForkliftRequests();
    this.renderForkliftFleet();
  }

  renderForkliftFleet() {
    const container = document.getElementById("forklift-fleet-list");
    const badgeCount = document.getElementById("forklift-fleet-badge-count");
    if (!container) return;

    const adminMode = isAdmin();
    const list = appState.state.forklifts || [];
    if (badgeCount) badgeCount.textContent = list.length;

    let filtered = [...list];
    if (this.fleetFilterStatus !== "ALL") {
      filtered = filtered.filter(f => f.status === this.fleetFilterStatus);
    }
    if (this.fleetFilterFuel !== "ALL") {
      filtered = filtered.filter(f => f.fuelType === this.fleetFilterFuel);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 flex flex-col items-center justify-center">
          <div class="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-3xl mb-3 shadow-inner">
            🚜
          </div>
          <h4 class="text-base font-black text-slate-800 dark:text-white">Kayıtlı Forklift Bulunmuyor</h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-4">
            ${adminMode ? 'Fabrikanızda kullanılan forkliftleri marka, tonaj ve yakıt türüyle sisteme ekleyerek canlı durumlarını takip edebilirsiniz.' : 'Sisteme henüz forklift tanımlanmamıştır. Forklift ekleme yetkisi Sistem Yöneticisi (Admin) hesabına aittir.'}
          </p>
          ${adminMode ? `
            <button type="button" id="btn-quick-add-forklift-empty" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2.5 px-5 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer">
              <span>➕</span> <span>İlk Forklifti Ekle</span>
            </button>
          ` : ''}
        </div>
      `;

      const emptyBtn = container.querySelector("#btn-quick-add-forklift-empty");
      if (emptyBtn) {
        emptyBtn.onclick = () => this.openAddForkliftModal();
      }
      return;
    }

    container.innerHTML = filtered.map(f => {
      const isElectric = f.fuelType === "Elektrikli";

      let statusBadge = "";
      let borderClass = "border-slate-200 dark:border-slate-800";

      if (f.status === "Aktif") {
        statusBadge = `<span class="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs">🟢 Aktif</span>`;
        borderClass = "border-emerald-300 dark:border-emerald-900/60";
      } else if (f.status === "Şarjda") {
        statusBadge = `<span class="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs">⚡ Şarjda</span>`;
        borderClass = "border-amber-300 dark:border-amber-900/60";
      } else {
        statusBadge = `<span class="bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs">🔴 Arızalı</span>`;
        borderClass = "border-red-300 dark:border-red-900/60";
      }

      let fuelIcon = "⛽";
      let fuelClass = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
      if (isElectric) {
        fuelIcon = "⚡";
        fuelClass = "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
      } else if (f.fuelType === "Dizel") {
        fuelIcon = "🛢️";
        fuelClass = "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
      }

      return `
        <div class="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border ${borderClass} shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition">
          <div>
            <!-- Üst Kısım: Kod, Marka ve Durum Rozeti -->
            <div class="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xl">🚜</span>
                  <h3 class="text-base font-black text-slate-900 dark:text-white tracking-wide">${f.code}</h3>
                </div>
                <div class="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">${f.brand}</div>
              </div>
              <div>${statusBadge}</div>
            </div>

            <!-- Özellikler: Tonaj ve Yakıt -->
            <div class="grid grid-cols-2 gap-2 mt-3">
              <div class="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                <div class="text-[10px] text-slate-400 uppercase font-black">Kapasite / Tonaj</div>
                <div class="text-xs font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">⚖️ ${f.capacity}</div>
              </div>

              <div class="${fuelClass} p-2.5 rounded-xl text-center">
                <div class="text-[10px] uppercase font-black opacity-75">Yakıt Türü</div>
                <div class="text-xs font-extrabold mt-0.5">${fuelIcon} ${f.fuelType}</div>
              </div>
            </div>

            <!-- Operatör / Notlar -->
            ${f.operatorName ? `
              <div class="mt-2.5 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                <span class="font-bold text-slate-700 dark:text-slate-300">👤 Sorumlu:</span>
                <span>${f.operatorName}</span>
              </div>
            ` : ''}

            ${f.notes ? `
              <div class="mt-2 text-[11px] text-slate-500 dark:text-slate-400 italic">
                📝 ${f.notes}
              </div>
            ` : ''}
          </div>

          <!-- Alt Kısım: Canlı Durum Değiştirme Butonları & Düzenle/Sil (Yalnızca Admin) -->
          <div class="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
            <div class="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>CANLI DURUM İŞARETLE</span>
              ${adminMode ? `
                <div class="flex items-center gap-2">
                  <button data-edit-forklift="${f.id}" class="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer">✏️ Düzenle</button>
                  <span class="text-slate-300">|</span>
                  <button data-delete-forklift-fleet="${f.id}" class="text-[11px] text-red-500 hover:underline font-bold cursor-pointer">Sil</button>
                </div>
              ` : ''}
            </div>

            <!-- Durum Seçim Butonları -->
            <div class="grid ${isElectric ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5">
              <button data-status-forklift="${f.id}" data-new-status="Aktif" class="py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 ${f.status === 'Aktif' ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950'}">
                <span>🟢</span> <span>Aktif</span>
              </button>

              ${isElectric ? `
                <button data-status-forklift="${f.id}" data-new-status="Şarjda" class="py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 ${f.status === 'Şarjda' ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950'}">
                  <span>⚡</span> <span>Şarjda</span>
                </button>
              ` : ''}

              <button data-status-forklift="${f.id}" data-new-status="Arızalı" class="py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 ${f.status === 'Arızalı' ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950'}">
                <span>🔴</span> <span>Arızalı</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Aksiyon Dinleyicileri
    container.querySelectorAll("[data-status-forklift]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-status-forklift");
        const newStatus = e.currentTarget.getAttribute("data-new-status");
        this.setForkliftStatus(id, newStatus);
      });
    });

    container.querySelectorAll("[data-edit-forklift]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-edit-forklift");
        this.openEditForkliftModal(id);
      });
    });

    container.querySelectorAll("[data-delete-forklift-fleet]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-delete-forklift-fleet");
        this.deleteForklift(id);
      });
    });
  }

  renderForkliftRequests() {
    const container = document.getElementById("forklift-requests-list");
    const activeCounterEl = document.getElementById("forklift-active-count");
    const subtabBadgeEl = document.getElementById("forklift-calls-subtab-badge");
    if (!container) return;

    let items = [...appState.state.forkliftRequests].sort((a, b) => new Date(b.requestTime) - new Date(a.requestTime));

    const waitingCount = items.filter(i => i.status === "Bekliyor").length;
    if (activeCounterEl) {
      activeCounterEl.textContent = waitingCount;
      if (waitingCount > 0) {
        activeCounterEl.classList.add("animate-pulse");
      } else {
        activeCounterEl.classList.remove("animate-pulse");
      }
    }
    if (subtabBadgeEl) {
      subtabBadgeEl.textContent = waitingCount;
    }

    if (this.filterStatus !== "ALL") {
      items = items.filter(i => i.status === this.filterStatus);
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8">
          <p class="text-3xl mb-1">🚜</p>
          <p class="font-medium text-slate-700 dark:text-slate-300">Aktif forklift çağrısı bulunmuyor.</p>
          <p class="text-xs mt-1 text-slate-500">Forklift çağırmak için yukarıdaki sarı "Forklift Çağır" butonuna basınız.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(req => {
      const dep = appState.state.departments.find(d => d.id === req.departmentId) || { name: "", icon: "🏢" };
      const dateObj = new Date(req.requestTime);
      const timeStr = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

      let urgencyBadge = "";
      let borderClass = "border-slate-200 dark:border-slate-800";

      if (req.urgency === "Kritik") {
        urgencyBadge = `<span class="bg-red-600 text-white text-xs px-2.5 py-0.5 rounded-full font-black animate-pulse">🚨 HAT DURDU / KRİTİK</span>`;
        borderClass = "border-red-400 border-2";
      } else if (req.urgency === "Acil") {
        urgencyBadge = `<span class="bg-amber-500 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">⚠️ ACİL</span>`;
        borderClass = "border-amber-300";
      } else {
        urgencyBadge = `<span class="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-bold">NORMAL</span>`;
      }

      let statusBadge = "";
      if (req.status === "Bekliyor") {
        statusBadge = `<span class="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded">⏳ Bekliyor</span>`;
      } else if (req.status === "Yolda") {
        statusBadge = `<span class="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded">🚀 Yolda (${req.operatorName})</span>`;
      } else {
        statusBadge = `<span class="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded">✓ Tamamlandı</span>`;
      }

      const currentUser = appState.state.currentUser;
      const isForkliftOperatorOrAdmin = !isViewer() && currentUser ? (currentUser.role === "FORKLIFT" || currentUser.role === "ADMIN" || currentUser.role === "USTA") : false;

      return `
        <div class="bg-white dark:bg-slate-900 p-4 rounded-xl border ${borderClass} shadow-sm flex flex-col justify-between space-y-3 relative">
          <div>
            <div class="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
              <div class="flex items-center gap-1.5">
                <span class="text-base">${dep.icon}</span>
                <span class="font-extrabold text-slate-800 dark:text-white text-sm">${dep.name}</span>
              </div>
              <div>${urgencyBadge}</div>
            </div>

            <div class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
              <span>📍 Konum / Hat:</span>
              <b class="text-slate-800 dark:text-white">${req.location}</b>
            </div>

            <div class="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg text-xs text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
              <b>Açıklama:</b> ${req.description}
            </div>

            <div class="flex flex-wrap items-center justify-between text-xs text-slate-500 mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 gap-1">
              <span class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-bold">👤 Çağıran: ${req.requestedBy}</span>
              ${req.operatorName ? `<span class="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">🚜 Operatör: ${req.operatorName}</span>` : ''}
              <span class="text-slate-400 text-[11px] ml-auto">🕒 Saat: <b>${timeStr}</b></span>
            </div>
          </div>

          <div class="border-t border-slate-100 dark:border-slate-800 pt-3">
            <div class="flex items-center justify-between mb-2">
              ${statusBadge}
              <button data-delete-forklift="${req.id}" class="text-[11px] text-slate-400 hover:text-red-500 cursor-pointer">Sil</button>
            </div>

            ${isForkliftOperatorOrAdmin ? `
              <div class="flex gap-2">
                ${req.status === "Bekliyor" ? `
                  <button data-forklift-action="Yolda" data-call-id="${req.id}" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer">
                    🚜 Görevi Aldım (Yoldayım)
                  </button>
                ` : ''}
                ${req.status === "Yolda" ? `
                  <button data-forklift-action="Tamamlandı" data-call-id="${req.id}" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer">
                    ✓ Görevi Tamamladım
                  </button>
                ` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join("");

    // Aksiyon Dinleyicileri
    container.querySelectorAll("[data-forklift-action]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.getAttribute("data-call-id");
        const action = e.currentTarget.getAttribute("data-forklift-action");
        const call = appState.state.forkliftRequests.find(c => c.id === id);
        if (call) {
          const uName = appState.state.currentUser ? appState.state.currentUser.name : "Operatör";
          call.status = action;
          call.operatorName = uName;
          appState.saveState();

          logSystemAction(
            action === "Yolda" ? "FORKLİFT_KABUL" : "FORKLİFT_TAMAM",
            `${uName}, ${call.requestedBy} tarafından açılan (${call.location}) forklift çağrısını ${action === "Yolda" ? 'üstlendi (Yolda)' : 'tamamladı'}.`,
            { callId: id, location: call.location, action }
          );

          playAlertSound("call");

          // Sesli Anons
          if (action === "Yolda") {
            speakVoiceAlert(`Forklift operatörü yola çıktı. Görevi ${uName} üstlendi.`);
          } else {
            speakVoiceAlert(`Forklift görevi tamamlandı.`);
          }

          this.render();

          // Telegram Grubu Bildirimi (Görevi Aldı / Tamamladı)
          await this.sendTelegramNotification(call, action);
        }
      });
    });

    container.querySelectorAll("[data-delete-forklift]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-delete-forklift");
        const call = appState.state.forkliftRequests.find(c => c.id === id);
        if (confirm("Bu forklift çağrısını silmek istiyor musunuz?")) {
          if (call) {
            const uName = appState.state.currentUser ? appState.state.currentUser.name : "Operatör";
            logSystemAction("FORKLİFT_SİLME", `${uName}, "${call.location}" konumundaki forklift çağrısını sildi.`);
          }
          appState.state.forkliftRequests = appState.state.forkliftRequests.filter(c => c.id !== id);
          appState.saveState();
          this.render();
        }
      });
    });
  }

  async sendTelegramNotification(call, eventType = "NEW") {
    const config = appState.state.telegramConfig;

    // Harici Webhook (Telefon Sesli Araması / WhatsApp Botu) Tetikleme
    if (eventType === "NEW" && config?.webhookCallUrl) {
      try {
        fetch(config.webhookCallUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "FORKLIFT_CALL",
            urgency: call.urgency,
            location: call.location,
            description: call.description,
            requestedBy: call.requestedBy,
            time: call.requestTime,
            message: `Acil forklift çağrısı: ${call.location} konumunda ${call.description}`
          })
        }).catch(err => console.warn("Otomatik arama webhook hatası:", err));
      } catch (e) {
        console.warn("Webhook dispatch error:", e);
      }
    }

    if (!config || !config.enabled || !config.botToken || !config.chatId) {
      if (!config?.botToken && window.cloudSync && typeof window.cloudSync.showToast === "function") {
        window.cloudSync.showToast("⚠️ Telegram Bot Token girilmemiş. Bildirim iletilemedi.");
      }
      return;
    }

    // Tercih filtreleri
    if (eventType === "NEW" && config.notifyForkliftNew === false) return;
    if (eventType === "Yolda" && config.notifyForkliftEnRoute === false) return;
    if (eventType === "Tamamlandı" && config.notifyForkliftDone === false) return;

    const dep = appState.state.departments.find(d => d.id === call.departmentId) || { name: "Genel Fabrika" };
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const escapeHtml = (str) => {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };

    const depName = escapeHtml(dep.name);
    const loc = escapeHtml(call.location);
    const reqBy = escapeHtml(call.requestedBy);
    const opName = escapeHtml(call.operatorName || appState.state.currentUser?.name || "Operatör");
    const desc = escapeHtml(call.description);
    const urgency = escapeHtml(call.urgency || "Normal");

    let htmlText = "";
    let plainText = "";

    if (eventType === "Yolda") {
      htmlText = `🚜 <b>FORKLİFT HAREKETE GEÇTİ (YOLDA)</b>\n\n` +
        `📍 <b>Bölüm:</b> ${depName}\n` +
        `📌 <b>Konum:</b> ${loc}\n` +
        `👷 <b>Operatör:</b> ${opName}\n` +
        `👤 <b>Talep Eden:</b> ${reqBy}\n` +
        `📝 <b>İş:</b> ${desc}\n` +
        `⏰ <b>Başlama Saati:</b> ${timeStr}`;

      plainText = `🚜 FORKLİFT HAREKETE GEÇTİ (YOLDA)\n\n` +
        `📍 Bölüm: ${dep.name}\n` +
        `📌 Konum: ${call.location}\n` +
        `👷 Operatör: ${opName}\n` +
        `👤 Talep Eden: ${call.requestedBy}\n` +
        `📝 İş: ${call.description}\n` +
        `⏰ Başlama Saati: ${timeStr}`;
    } else if (eventType === "Tamamlandı") {
      htmlText = `✅ <b>FORKLİFT GÖREVİ TAMAMLANDI</b>\n\n` +
        `📍 <b>Bölüm:</b> ${depName}\n` +
        `📌 <b>Konum:</b> ${loc}\n` +
        `👷 <b>Tamamlayan:</b> ${opName}\n` +
        `👤 <b>Talep Eden:</b> ${reqBy}\n` +
        `📝 <b>İş:</b> ${desc}\n` +
        `⏰ <b>Bitiş Saati:</b> ${timeStr}`;

      plainText = `✅ FORKLİFT GÖREVİ TAMAMLANDI\n\n` +
        `📍 Bölüm: ${dep.name}\n` +
        `📌 Konum: ${call.location}\n` +
        `👷 Tamamlayan: ${opName}\n` +
        `👤 Talep Eden: ${call.requestedBy}\n` +
        `📝 İş: ${call.description}\n` +
        `⏰ Bitiş Saati: ${timeStr}`;
    } else {
      htmlText = `🚜 <b>YENİ FORKLİFT ÇAĞRISI!</b>\n\n` +
        `📍 <b>Bölüm:</b> ${depName}\n` +
        `📌 <b>Konum:</b> ${loc}\n` +
        `⚡ <b>Aciliyet:</b> ${urgency}\n` +
        `👤 <b>Talep Eden:</b> ${reqBy}\n` +
        `📝 <b>İş:</b> ${desc}\n` +
        `⏰ <b>Saat:</b> ${timeStr}`;

      plainText = `🚜 YENİ FORKLİFT ÇAĞRISI!\n\n` +
        `📍 Bölüm: ${dep.name}\n` +
        `📌 Konum: ${call.location}\n` +
        `⚡ Aciliyet: ${call.urgency || "Normal"}\n` +
        `👤 Talep Eden: ${call.requestedBy}\n` +
        `📝 İş: ${call.description}\n` +
        `⏰ Saat: ${timeStr}`;
    }

    try {
      const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: htmlText,
          parse_mode: "HTML"
        })
      });

      const resData = await res.json().catch(() => null);

      if (!res.ok || (resData && !resData.ok)) {
        const retryRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: config.chatId,
            text: plainText
          })
        });
        const retryData = await retryRes.json().catch(() => null);
        if (!retryRes.ok || (retryData && !retryData.ok)) {
          const errDesc = retryData?.description || resData?.description || (res.status === 401 ? "Token geçersiz/iptal edilmiş (401)" : `Hata ${res.status}`);
          console.warn("Telegram mesajı iletilemedi:", errDesc);
          if (window.cloudSync && typeof window.cloudSync.showToast === "function") {
            window.cloudSync.showToast(`⚠️ Telegram Botu: ${errDesc}`);
          }
        }
      }
    } catch (e) {
      console.warn("Telegram mesajı gönderilemedi:", e);
    }
  }

  saveForkliftCall() {
    if (isViewer()) {
      alert("İzleyici yetkisine sahipsiniz. Forklift çağıramazsınız.");
      return;
    }
    const departmentId = document.getElementById("forklift-call-department").value;
    const location = document.getElementById("forklift-location").value.trim();
    const urgency = document.getElementById("forklift-urgency").value;
    const description = document.getElementById("forklift-description").value.trim();

    if (!location || !description) {
      alert("Lütfen konum/hat bilgisini ve yapılacak işi giriniz.");
      return;
    }

    const newCall = {
      id: "fork_" + Date.now(),
      departmentId,
      location,
      urgency,
      description,
      status: "Bekliyor",
      requestTime: new Date().toISOString(),
      requestedBy: appState.state.currentUser ? appState.state.currentUser.name : "Personel",
      operatorName: null
    };

    appState.state.forkliftRequests.unshift(newCall);
    appState.saveState();

    const depObj = appState.state.departments.find(d => d.id === departmentId) || { name: "" };
    const uName = appState.state.currentUser ? appState.state.currentUser.name : "Personel";
    logSystemAction(
      "FORKLİFT_ÇAGRI",
      `${uName}, ${depObj.name} (${location}) için [${urgency}] aciliyetinde forklift çağrısı açtı.`,
      { location, urgency, description }
    );

    // 1. Sesli Alarm (Ding / Siren)
    if (urgency === "Kritik") {
      playAlertSound("critical");
    } else {
      playAlertSound("call");
    }

    // 2. Sesli Anons (Tarayıcı Türkçe Konuşması)
    speakVoiceAlert(`Dikkat! ${depObj.name} bölümünden ${urgency === 'Kritik' ? 'acil ' : ''}forklift çağrısı var. Konum: ${location}.`);

    // 3. Telegram ve Webhook Bildirimi
    this.sendTelegramNotification(newCall, "NEW");

    document.getElementById("form-call-forklift").reset();
    document.getElementById("modal-call-forklift").classList.remove("show");

    this.render();
  }

  saveTelegramSettings() {
    const token = document.getElementById("telegram-token").value.trim();
    const chatId = document.getElementById("telegram-chat-id").value.trim();
    const enabled = document.getElementById("telegram-enabled").checked;

    const notifyForkliftNew = document.getElementById("tg-notify-forklift-new") ? document.getElementById("tg-notify-forklift-new").checked : true;
    const notifyForkliftEnRoute = document.getElementById("tg-notify-forklift-enroute") ? document.getElementById("tg-notify-forklift-enroute").checked : true;
    const notifyForkliftDone = document.getElementById("tg-notify-forklift-done") ? document.getElementById("tg-notify-forklift-done").checked : true;
    const notifyBreakdown = document.getElementById("tg-notify-breakdown") ? document.getElementById("tg-notify-breakdown").checked : true;
    const notifyCalendar = document.getElementById("tg-notify-calendar") ? document.getElementById("tg-notify-calendar").checked : true;

    const voiceAnnounceEnabled = document.getElementById("tg-voice-announce") ? document.getElementById("tg-voice-announce").checked : true;
    const webhookCallUrl = document.getElementById("tg-webhook-call-url") ? document.getElementById("tg-webhook-call-url").value.trim() : "";

    appState.state.telegramConfig = {
      botToken: token,
      chatId: chatId,
      enabled: enabled,
      notifyForkliftNew,
      notifyForkliftEnRoute,
      notifyForkliftDone,
      notifyBreakdown,
      notifyCalendar,
      voiceAnnounceEnabled,
      webhookCallUrl
    };

    appState.saveState();
    const uName = appState.state.currentUser ? appState.state.currentUser.name : "Yönetici";
    logSystemAction("TELEGRAM_AYAR", `${uName} Telegram bot ve anons tercihlerini güncelledi.`);
    alert("✅ Telegram ayarları, sesli anons ve bildirim tercihleri başarıyla kaydedildi.");
    document.getElementById("modal-telegram-settings").classList.remove("show");
  }

  async testTelegramConnection() {
    const token = document.getElementById("telegram-token").value.trim();
    const chatId = document.getElementById("telegram-chat-id").value.trim();

    if (!token || !chatId) {
      alert("Lütfen önce Bot Token ve Hedef Chat / Grup ID alanlarını doldurunuz.");
      return;
    }

    const testBtn = document.getElementById("btn-telegram-test");
    const originalContent = testBtn.innerHTML;
    testBtn.innerHTML = "<span>⏳</span> <span>Gönderiliyor...</span>";
    testBtn.disabled = true;

    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const escapeHtml = (str) => String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const userName = escapeHtml(appState.state.currentUser?.name || "Yönetici");

    const text = `🔔 <b>SODSAN Fabrika Portalı Test Bildirimi</b>\n\n` +
      `✅ Telegram bot entegrasyonu başarıyla çalışıyor!\n` +
      `👤 <b>İşlem Yapan:</b> ${userName}\n` +
      `⏰ <b>Saat:</b> ${timeStr}`;

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "HTML"
        })
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.ok) {
        // Tarayıcıdan da test anonsu yap
        speakVoiceAlert("Telegram ve sesli anons bağlantı testi başarılı.");
        alert("✅ Test bildirimi Telegram grubunuza başarıyla iletildi!");
      } else {
        alert("❌ Telegram Hatası: " + (data?.description || `HTTP ${res.status}`));
      }
    } catch (e) {
      alert("❌ Bağlantı hatası: " + e.message);
    } finally {
      testBtn.innerHTML = originalContent;
      testBtn.disabled = false;
    }
  }
}
