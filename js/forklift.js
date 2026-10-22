// SODSAN Fabrika Portalı - Forklift Çağrı & Telegram Entegrasyon Modülü (forklift.js)
import { appState, playAlertSound, logSystemAction } from './data.js';

export class ForkliftModule {
  constructor() {
    this.filterStatus = "ALL";
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
    const btnOpenCall = document.getElementById("btn-open-call-forklift");
    const formCall = document.getElementById("form-call-forklift");
    const filterStatus = document.getElementById("filter-forklift-status");
    const btnTelegramSettings = document.getElementById("btn-telegram-settings");
    const formTelegram = document.getElementById("form-telegram-settings");

    if (btnOpenCall) {
      btnOpenCall.addEventListener("click", () => {
        const modal = document.getElementById("modal-call-forklift");
        if (modal) {
          const depSelect = document.getElementById("forklift-call-department");
          if (depSelect && appState.state.currentUser.departmentId) {
            depSelect.value = appState.state.currentUser.departmentId;
          }
          modal.classList.add("show");
        }
      });
    }

    if (btnTelegramSettings) {
      btnTelegramSettings.addEventListener("click", () => {
        const modal = document.getElementById("modal-telegram-settings");
        if (modal) {
          document.getElementById("telegram-token").value = appState.state.telegramConfig?.botToken || "";
          document.getElementById("telegram-chat-id").value = appState.state.telegramConfig?.chatId || "";
          document.getElementById("telegram-enabled").checked = !!appState.state.telegramConfig?.enabled;
          modal.classList.add("show");
        }
      });
    }

    if (filterStatus) {
      filterStatus.addEventListener("change", (e) => {
        this.filterStatus = e.target.value;
        this.render();
      });
    }

    if (formCall) {
      formCall.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveForkliftCall();
      });
    }

    if (formTelegram) {
      formTelegram.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveTelegramSettings();
      });
    }
  }

  render() {
    const container = document.getElementById("forklift-requests-list");
    const activeCounterEl = document.getElementById("forklift-active-count");
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

    if (this.filterStatus !== "ALL") {
      items = items.filter(i => i.status === this.filterStatus);
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
          <p class="text-3xl mb-1">🚜</p>
          <p class="font-medium">Aktif forklift çağrısı bulunmuyor.</p>
          <p class="text-xs mt-1">Forklift çağırmak için yukarıdaki kırmızı/sarı butona basınız.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(req => {
      const dep = appState.state.departments.find(d => d.id === req.departmentId) || { name: "", icon: "🏢" };
      const dateObj = new Date(req.requestTime);
      const timeStr = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

      let urgencyBadge = "";
      let borderClass = "border-slate-200";

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

      const isForkliftOperatorOrAdmin = 
        appState.state.currentUser.role === "FORKLIFT" || 
        appState.state.currentUser.role === "ADMIN";

      return `
        <div class="bg-white p-4 rounded-xl border ${borderClass} shadow-sm flex flex-col justify-between space-y-3 relative">
          <div>
            <div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
              <div class="flex items-center gap-1.5">
                <span class="text-base">${dep.icon}</span>
                <span class="font-extrabold text-slate-800 text-sm">${dep.name}</span>
              </div>
              <div>${urgencyBadge}</div>
            </div>

            <div class="text-xs text-slate-500 flex items-center gap-1 mb-1">
              <span>📍 Konum / Hat:</span>
              <b class="text-slate-800">${req.location}</b>
            </div>

            <div class="bg-slate-50 p-2.5 rounded-lg text-xs text-slate-700 border border-slate-100">
              <b>Açıklama:</b> ${req.description}
            </div>

            <div class="flex flex-wrap items-center justify-between text-xs text-slate-500 mt-2 pt-1 border-t border-slate-100 gap-1">
              <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">👤 Çağıran Usta: ${req.requestedBy}</span>
              ${req.operatorName ? `<span class="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">🚜 Operatör: ${req.operatorName}</span>` : ''}
              <span class="text-slate-400 text-[11px] ml-auto">🕒 Saat: <b>${timeStr}</b></span>
            </div>
          </div>

          <div class="border-t border-slate-100 pt-3">
            <div class="flex items-center justify-between mb-2">
              ${statusBadge}
              <button data-delete-forklift="${req.id}" class="text-[11px] text-slate-400 hover:text-red-500">Sil</button>
            </div>

            ${isForkliftOperatorOrAdmin ? `
              <div class="flex gap-2">
                ${req.status === "Bekliyor" ? `
                  <button data-forklift-action="Yolda" data-call-id="${req.id}" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded-lg transition flex items-center justify-center gap-1">
                    🚜 Görevi Aldım (Yoldayım)
                  </button>
                ` : ''}
                ${req.status === "Yolda" ? `
                  <button data-forklift-action="Tamamlandı" data-call-id="${req.id}" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-lg transition flex items-center justify-center gap-1">
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
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-call-id");
        const action = e.currentTarget.getAttribute("data-forklift-action");
        const call = appState.state.forkliftRequests.find(c => c.id === id);
        if (call) {
          call.status = action;
          call.operatorName = appState.state.currentUser.name;
          appState.saveState();

          logSystemAction(
            action === "Yolda" ? "FORKLİFT_KABUL" : "FORKLİFT_TAMAM",
            `${appState.state.currentUser.name}, ${call.requestedBy} tarafından açılan (${call.location}) forklift çağrısını ${action === "Yolda" ? 'üstlendi (Yolda)' : 'tamamladı'}.`,
            { callId: id, location: call.location, action }
          );

          playAlertSound("call");
          this.render();
        }
      });
    });

    container.querySelectorAll("[data-delete-forklift]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-delete-forklift");
        const call = appState.state.forkliftRequests.find(c => c.id === id);
        if (confirm("Bu forklift çağrısını silmek istiyor musunuz?")) {
          if (call) {
            logSystemAction("FORKLİFT_SİLME", `${appState.state.currentUser.name}, "${call.location}" konumundaki forklift çağrısını sildi.`);
          }
          appState.state.forkliftRequests = appState.state.forkliftRequests.filter(c => c.id !== id);
          appState.saveState();
          this.render();
        }
      });
    });
  }

  async sendTelegramNotification(call) {
    const config = appState.state.telegramConfig;
    if (!config || !config.enabled || !config.botToken || !config.chatId) {
      console.log("Telegram entegrasyonu devre dışı veya yapılandırılmamış.");
      return;
    }

    const dep = appState.state.departments.find(d => d.id === call.departmentId) || { name: "" };
    const text = `🚜 *YENİ FORKLİFT ÇAĞRISI!*
📍 *Bölüm:* ${dep.name}
📌 *Konum:* ${call.location}
⚡ *Aciliyet:* ${call.urgency}
👤 *Talep Eden:* ${call.requestedBy}
📝 *Not:* ${call.description}
⏰ *Saat:* ${new Date().toLocaleTimeString('tr-TR')}`;

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
      console.log("Telegram bildirimi başarıyla gönderildi.");
    } catch (e) {
      console.warn("Telegram mesajı gönderilemedi:", e);
    }
  }

  saveForkliftCall() {
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
      requestedBy: appState.state.currentUser.name,
      operatorName: null
    };

    appState.state.forkliftRequests.unshift(newCall);
    appState.saveState();

    const depObj = appState.state.departments.find(d => d.id === departmentId) || { name: "" };
    logSystemAction(
      "FORKLİFT_ÇAGRI",
      `${appState.state.currentUser.name}, ${depObj.name} (${location}) için [${urgency}] aciliyetinde forklift çağrısı açtı.`,
      { location, urgency, description }
    );

    // Sesli Alarm
    if (urgency === "Kritik") {
      playAlertSound("critical");
    } else {
      playAlertSound("call");
    }

    // Telegram Bildirimi (Yapılandırılmışsa)
    this.sendTelegramNotification(newCall);

    document.getElementById("form-call-forklift").reset();
    document.getElementById("modal-call-forklift").classList.remove("show");

    this.render();
  }

  saveTelegramSettings() {
    const token = document.getElementById("telegram-token").value.trim();
    const chatId = document.getElementById("telegram-chat-id").value.trim();
    const enabled = document.getElementById("telegram-enabled").checked;

    appState.state.telegramConfig = {
      botToken: token,
      chatId: chatId,
      enabled: enabled
    };

    appState.saveState();
    alert("Telegram ayarları başarıyla kaydedildi.");
    document.getElementById("modal-telegram-settings").classList.remove("show");
  }
}
