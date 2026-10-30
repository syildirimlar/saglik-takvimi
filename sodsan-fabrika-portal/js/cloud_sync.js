// SODSAN Fabrika Portalı - Çoklu Cihaz Bulut Senkronizasyon Modülü (cloud_sync.js)
// PC, Tablet ve Telefonlar arasında sıfır kurulum ve sınırsız kota ile anlık canlı senkronizasyon sağlar.

import { appState } from "./data.js";

const DEFAULT_SYNC_ROOM = "sodsan_fabrika_live_sync_2026";
const NTFY_BASE = "https://ntfy.sh";

export class CloudSyncService {
  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.syncRoom = DEFAULT_SYNC_ROOM;
    this.syncStatus = "IDLE"; // "SYNCED", "SYNCING", "OFFLINE", "ERROR"
    this.eventSource = null;
    this.pushDebounceTimer = null;
    this.pollInterval = null;
    this.lastSyncedTimestamp = 0;
    this.isSyncing = false;
    this.lastUploadedFileUrl = "";
  }

  getOrCreateDeviceId() {
    let devId = localStorage.getItem("sodsan_device_id");
    if (!devId) {
      devId = "dev_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
      localStorage.setItem("sodsan_device_id", devId);
    }
    return devId;
  }

  init() {
    console.log("[CloudSync] Başlatılıyor. Cihaz ID:", this.deviceId);

    // 1. Başlangıçta buluttan en güncel veriyi sessizce çek
    this.pullFromCloud(false);

    // 2. Canlı Dinleme (Server-Sent Events / SSE üzerinden 100ms anlık bildirim)
    this.startLiveListener();

    // 3. Ekran Kilidi Açılınca veya Sekmeye Geri Dönünce Otomatik Eşitle
    document.addEventListener("visibilitychange", () => {
      const loginScreen = document.getElementById("screen-auth-login");
      if (loginScreen && !loginScreen.classList.contains("hidden") && loginScreen.style.display !== "none") {
        return; // Kullanıcı giriş yaparken araya girme
      }
      if (document.visibilityState === "visible") {
        this.pullFromCloud(false);
      }
    });
    window.addEventListener("focus", () => {
      const loginScreen = document.getElementById("screen-auth-login");
      if (loginScreen && !loginScreen.classList.contains("hidden") && loginScreen.style.display !== "none") {
        return; // Kullanıcı giriş yaparken araya girme
      }
      this.pullFromCloud(false);
    });

    // 4. Periyodik Akıllı Eşitleme (Yalnızca sekme açık ve görünürken her 60 saniyede bir)
    this.pollInterval = setInterval(() => {
      const loginScreen = document.getElementById("screen-auth-login");
      if (loginScreen && !loginScreen.classList.contains("hidden") && loginScreen.style.display !== "none") {
        return;
      }
      if (document.visibilityState === "visible" && !this.isSyncing) {
        this.pullFromCloud(false);
      }
    }, 60000);

    // 5. İnternet Bağlantı Değişikliklerini Dinle
    window.addEventListener("online", () => {
      this.updateStatus("SYNCING", "İnternet bağlandı, eşitleniyor...");
      this.pullFromCloud(false);
      this.startLiveListener();
    });
    window.addEventListener("offline", () => {
      this.updateStatus("OFFLINE", "Çevrimdışı (Yerel Mod)");
    });

    this.renderStatusIndicator();
  }

  startLiveListener() {
    if (typeof EventSource === "undefined") return;

    try {
      if (this.eventSource) {
        this.eventSource.close();
      }

      this.eventSource = new EventSource(`${NTFY_BASE}/${this.syncRoom}/sse`);

      this.eventSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.event === "message" && data.attachment && data.attachment.url) {
            const titleParts = (data.title || "").split("|");
            const senderDeviceId = titleParts[1] || "";

            // Kendi yüklediğimiz bildirimi yok say
            if (senderDeviceId === this.deviceId) {
              return;
            }

            // Eğer şu an bir senkronizasyon yürütülüyorsa çakışmayı önle
            if (this.isSyncing) {
              return;
            }

            console.log("[CloudSync] Diğer cihazdan anlık canlı güncelleme alındı. İndiriliyor...");
            await this.pullFromCloud(true);
          }
        } catch (e) {
          console.warn("[CloudSync] SSE parse hatası:", e);
        }
      };

      this.eventSource.onerror = () => {
        // SSE bağlantı koptuğunda otomatik yeniden dener
      };
    } catch (err) {
      console.warn("[CloudSync] Live listener hatası:", err);
    }
  }

  // Yerel veride değişiklik olduğunda buluta göndermeyi sıraya al (Debounce: 2.5 sn)
  notifyLocalChange() {
    if (this.isSyncing) return; // Buluttan çekilirken geri buluta döngü başlatma
    if (this.pushDebounceTimer) {
      clearTimeout(this.pushDebounceTimer);
    }
    this.updateStatus("SYNCING", "Buluta aktarılıyor...");
    this.pushDebounceTimer = setTimeout(() => {
      this.pushToCloud();
    }, 2500);
  }

  async pushToCloud() {
    if (!navigator.onLine) {
      this.updateStatus("OFFLINE", "Çevrimdışı (Yerel)");
      return { success: false, error: "İnternet bağlantınız bulunmuyor." };
    }

    try {
      this.isSyncing = true;
      this.updateStatus("SYNCING", "Buluta aktarılıyor...");
      const nowIso = new Date().toISOString();
      const statePayload = appState.exportDataJson();

      const resp = await fetch(`${NTFY_BASE}/${this.syncRoom}`, {
        method: "PUT",
        headers: {
          "Filename": "sodsan_state.json",
          "Title": `SODSAN_UPDATE|${this.deviceId}|${nowIso}`,
          "Tags": "factory,sync",
          "Content-Type": "application/json; charset=utf-8"
        },
        body: statePayload
      });

      if (resp.ok) {
        const resJson = await resp.json();
        this.lastSyncedTimestamp = Date.now();
        this.lastUploadedFileUrl = resJson.attachment?.url || "";
        appState.state._lastSyncTime = nowIso;
        localStorage.setItem("sodsan_last_sync_time", nowIso);
        this.updateStatus("SYNCED", "Bulut Eşitlendi");
        console.log("[CloudSync] Buluta başarıyla yüklendi:", resJson.attachment?.url);
        return { success: true, url: resJson.attachment?.url, updatedAt: nowIso };
      } else {
        const errText = await resp.text();
        console.warn("[CloudSync] Push hatası:", resp.status, errText);
        this.updateStatus("ERROR", "Bulut Hatası");
        return { success: false, error: `Sunucu yanıtı: ${resp.status}` };
      }
    } catch (e) {
      console.warn("[CloudSync] Push bağlantı hatası:", e);
      this.updateStatus("OFFLINE", "Bağlantı Hatası");
      return { success: false, error: e.message || "Ağ hatası" };
    } finally {
      this.isSyncing = false;
    }
  }

  async pullFromCloud(force = false) {
    if (!navigator.onLine) {
      this.updateStatus("OFFLINE", "Çevrimdışı (Yerel)");
      return { success: false, error: "İnternet bağlantınız bulunmuyor." };
    }

    try {
      this.isSyncing = true;
      if (force) {
        this.updateStatus("SYNCING", "Buluttan yükleniyor...");
      }

      // ntfy son mesajları JSON lines formatında döner
      const resp = await fetch(`${NTFY_BASE}/${this.syncRoom}/json?poll=1&since=all`, {
        method: "GET",
        headers: { "Cache-Control": "no-cache" }
      });

      if (!resp.ok) {
        this.updateStatus("SYNCED", "Bulut Aktif");
        return { success: false, error: `Sunucu sorgu hatası: ${resp.status}` };
      }

      const text = await resp.text();
      const lines = text.split("\n").filter(l => l.trim().length > 0);
      let latestMessage = null;

      // Tersten arayarak geçerli dosya eki olan en son mesajı bul
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const parsed = JSON.parse(lines[i]);
          if (parsed.event === "message" && parsed.attachment && parsed.attachment.url) {
            latestMessage = parsed;
            break;
          }
        } catch (e) {}
      }

      if (!latestMessage) {
        this.updateStatus("SYNCED", "Bulut Eşitlendi");
        return { success: true, message: "Bulutta henüz yeni bir kayıt bulunmuyor." };
      }

      // Başlıktan gönderici cihaz ve zaman bilgisini ayıkla
      const titleParts = (latestMessage.title || "").split("|");
      const senderDeviceId = titleParts[1] || "";
      const remoteUpdatedAtStr = titleParts[2] || (latestMessage.time ? new Date(latestMessage.time * 1000).toISOString() : "");
      const remoteUpdatedAt = new Date(remoteUpdatedAtStr).getTime() || (latestMessage.time * 1000);

      const localUpdatedAtStr = appState.state._lastSyncTime || localStorage.getItem("sodsan_last_sync_time") || 0;
      const localUpdatedAt = new Date(localUpdatedAtStr).getTime() || 0;

      // Kendi gönderdiğimiz ve zorlanmayan güncellemeleri atla
      if (senderDeviceId === this.deviceId && !force) {
        this.updateStatus("SYNCED", "Bulut Eşitlendi");
        return { success: true, message: "Cihazınız zaten en güncel sürümde." };
      }

      // Eğer uzaktaki veri daha yeni ise veya kullanıcı zorla çek dediyse
      if (remoteUpdatedAt > localUpdatedAt || force) {
        console.log("[CloudSync] Uzak veri indiriliyor:", latestMessage.attachment.url);
        const fileResp = await fetch(latestMessage.attachment.url, {
          headers: { "Cache-Control": "no-cache" }
        });

        if (!fileResp.ok) {
          throw new Error("Dosya indirilemedi: " + fileResp.status);
        }

        const remoteJsonText = await fileResp.text();
        const currentUser = appState.state.currentUser;

        const imported = appState.importDataJson(remoteJsonText, true); // true: Buluttan çekilen veriyi tekrar buluta gönderme loopunu kır
        if (imported) {
          if (currentUser) {
            appState.state.currentUser = currentUser;
          }
          appState.state._lastSyncTime = remoteUpdatedAtStr;
          localStorage.setItem("sodsan_last_sync_time", remoteUpdatedAtStr);
          this.lastSyncedTimestamp = Date.now();
          this.updateStatus("SYNCED", "Bulut Eşitlendi");

          if (window.portalApp && typeof window.portalApp.refreshAllActiveViews === "function") {
            window.portalApp.refreshAllActiveViews();
          }

          if (!force) {
            this.showToast("🔄 Diğer cihazdaki değişiklikler senkronize edildi!");
          }
          const timeFormatted = new Date(remoteUpdatedAt).toLocaleTimeString("tr-TR");
          return { success: true, updatedAt: timeFormatted };
        }
      }

      this.updateStatus("SYNCED", "Bulut Eşitlendi");
      return { success: true, message: "Cihazınızdaki veriler güncel." };
    } catch (e) {
      console.warn("[CloudSync] Pull hatası:", e);
      this.updateStatus("SYNCED", "Bulut Aktif");
      return { success: false, error: e.message || "Buluttan çekilemedi" };
    } finally {
      this.isSyncing = false;
    }
  }

  updateStatus(status, text) {
    this.syncStatus = status;
    this.syncText = text;
    this.renderStatusIndicator();
  }

  renderStatusIndicator() {
    const el = document.getElementById("cloud-sync-status-indicator");
    if (!el) return;

    let icon = "🟢";
    let badgeClass = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
    let title = "Tüm cihazlar senkronize";

    if (this.syncStatus === "SYNCING") {
      icon = "🔄";
      badgeClass = "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 animate-pulse";
      title = "Senkronize ediliyor...";
    } else if (this.syncStatus === "OFFLINE") {
      icon = "📱";
      badgeClass = "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300";
      title = "Çevrimdışı (Yerel Mod)";
    } else if (this.syncStatus === "ERROR") {
      icon = "⚠️";
      badgeClass = "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300";
      title = "Senkronizasyon Uyarısı";
    }

    el.className = `flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold border transition cursor-pointer shadow-2xs ${badgeClass}`;
    el.title = `${title} • Tıklayarak anında eşitleyin`;
    el.innerHTML = `<span>${icon}</span> <span class="hidden md:inline">${this.syncText || 'Bulut Aktif'}</span>`;

    el.onclick = () => {
      this.showSyncModal();
    };
  }

  showToast(message) {
    let toast = document.getElementById("cloud-sync-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "cloud-sync-toast";
      toast.className = "fixed bottom-5 right-5 z-50 bg-slate-900/90 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 backdrop-blur-md border border-slate-700 transition transform duration-300 translate-y-12 opacity-0 pointer-events-none";
      document.body.appendChild(toast);
    }

    toast.innerHTML = `<span>⚡</span> <span>${message}</span>`;
    toast.classList.remove("translate-y-12", "opacity-0");
    setTimeout(() => {
      toast.classList.add("translate-y-12", "opacity-0");
    }, 2800);
  }

  async forceUpdateApp() {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let r of regs) await r.unregister();
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (let k of keys) await caches.delete(k);
      }
    } catch (e) {
      console.warn("Önbellek sıfırlama hatası:", e);
    }
    window.location.reload(true);
  }

  async showSyncModal() {
    const lastSyncTimeStr = this.lastSyncedTimestamp ? new Date(this.lastSyncedTimestamp).toLocaleTimeString("tr-TR") : "Az önce";
    const msg = `🌐 SODSAN Çoklu Cihaz Canlı Bulut Eşitlemesi\n\n` +
      `Durum: ${this.syncText || 'Bağlı'}\n` +
      `Cihaz ID: ${this.deviceId}\n` +
      `Son Senkronizasyon: ${lastSyncTimeStr}\n` +
      `Kanal: ${this.syncRoom}\n\n` +
      `• [Tamam]: Buluttaki en güncel fabrika verilerini anında çeker.\n` +
      `• [İptal]: Kapatır.`;

    if (confirm(msg)) {
      this.updateStatus("SYNCING", "Buluttan çekiliyor...");
      const res = await this.pullFromCloud(true);
      if (res && res.success) {
        alert("✅ Senkronizasyon başarıyla tamamlandı! " + (res.updatedAt ? `(Saat: ${res.updatedAt})` : ""));
      } else {
        alert("ℹ️ " + (res?.message || res?.error || "Veriler güncellendi."));
      }
    }
  }
}

export const cloudSync = new CloudSyncService();
if (typeof window !== "undefined") {
  window.cloudSync = cloudSync;
  window.forceUpdateApp = () => cloudSync.forceUpdateApp();
}
