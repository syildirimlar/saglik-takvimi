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
          if (depSelect && appState.state.currentUser && appState.state.currentUser.departmentId) {
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
          const cfg = appState.state.telegramConfig || {};
          document.getElementById("telegram-token").value = cfg.botToken || "";
          document.getElementById("telegram-chat-id").value = cfg.chatId || "";
          document.getElementById("telegram-enabled").checked = !!cfg.enabled;

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

      const currentUser = appState.state.currentUser;
      const isForkliftOperatorOrAdmin = currentUser ? (currentUser.role === "FORKLIFT" || currentUser.role === "ADMIN") : true;

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
    if (!config || !config.enabled || !config.botToken || !config.chatId) {
      console.log("Telegram entegrasyonu devre dışı veya yapılandırılmamış.");
      return;
    }

    // Seçim kutusu filtre kontrolleri
    if (eventType === "NEW" && config.notifyForkliftNew === false) {
      console.log("Yeni forklift çağrısı bildirimi tercihi kapalı.");
      return;
    }
    if (eventType === "Yolda" && config.notifyForkliftEnRoute === false) {
      console.log("Forklift operatör yolda bildirimi tercihi kapalı.");
      return;
    }
    if (eventType === "Tamamlandı" && config.notifyForkliftDone === false) {
      console.log("Forklift görevi tamamlandı bildirimi tercihi kapalı.");
      return;
    }

    const dep = appState.state.departments.find(d => d.id === call.departmentId) || { name: "Genel Fabrika" };
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const escapeHtml = (str) => {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    };

    const depName = escapeHtml(dep.name);
    const loc = escapeHtml(call.location);
    const reqBy = escapeHtml(call.requestedBy);
    const opName = escapeHtml(call.operatorName || appState.state.currentUser.name);
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
        `👷 Operatör: ${call.operatorName || appState.state.currentUser.name}\n` +
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
        `👷 Tamamlayan: ${call.operatorName || appState.state.currentUser.name}\n` +
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
        console.warn("Telegram HTML gönderimi başarısız oldu, düz metin deneniyor...", resData);
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: config.chatId,
            text: plainText
          })
        });
      }
      console.log(`Telegram bildirimi (${eventType}) başarıyla gönderildi.`);
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

    const notifyForkliftNew = document.getElementById("tg-notify-forklift-new") ? document.getElementById("tg-notify-forklift-new").checked : true;
    const notifyForkliftEnRoute = document.getElementById("tg-notify-forklift-enroute") ? document.getElementById("tg-notify-forklift-enroute").checked : true;
    const notifyForkliftDone = document.getElementById("tg-notify-forklift-done") ? document.getElementById("tg-notify-forklift-done").checked : true;
    const notifyBreakdown = document.getElementById("tg-notify-breakdown") ? document.getElementById("tg-notify-breakdown").checked : true;
    const notifyCalendar = document.getElementById("tg-notify-calendar") ? document.getElementById("tg-notify-calendar").checked : true;

    appState.state.telegramConfig = {
      botToken: token,
      chatId: chatId,
      enabled: enabled,
      notifyForkliftNew,
      notifyForkliftEnRoute,
      notifyForkliftDone,
      notifyBreakdown,
      notifyCalendar
    };

    appState.saveState();
    const uName = appState.state.currentUser ? appState.state.currentUser.name : "Yönetici";
    logSystemAction("TELEGRAM_AYAR", `${uName} Telegram bot bildirim tercihlerini güncelledi.`);
    alert("Telegram ayarları ve bildirim tercihleri başarıyla kaydedildi.");
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
