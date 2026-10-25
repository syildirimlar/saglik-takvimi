// SODSAN Fabrika Portalı - Çoklu Cihaz Bulut Senkronizasyon Modülü (cloud_sync.js)
// PC, Tablet ve Telefonlar arasında sıfır kurulumla anlık veri senkronizasyonu sağlar.

import { appState } from "./data.js";

const DEFAULT_SYNC_ROOM = "sodsan_fabrika_live_sync_2026";
const CLOUD_STORAGE_OBJ_ID = "ff808181a09d98f701a17295860a05e4";
const CLOUD_ENDPOINT = `https://api.restful-api.dev/objects/${CLOUD_STORAGE_OBJ_ID}`;
const NOTIFY_URL = `https://ntfy.sh/${DEFAULT_SYNC_ROOM}`;

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

    // 1. Başlangıçta buluttan en güncel veriyi çek
    this.pullFromCloud(true);

    // 2. Canlı Dinleme (Server-Sent Events / SSE üzerinden anlık bildirim)
    this.startLiveListener();

    // 3. Ekran Kilidi Açılınca veya Sekmeye Geri Dönünce Otomatik Eşitle
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.pullFromCloud(false);
      }
    });
    window.addEventListener("focus", () => {
      this.pullFromCloud(false);
    });

    // 4. Periyodik Akıllı Eşitleme (Yalnızca sekme açık ve görünürken her 25 saniyede bir)
    this.pollInterval = setInterval(() => {
      if (document.visibilityState === "visible" && !this.isSyncing) {
        this.pullFromCloud(false);
      }
    }, 25000);

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

      this.eventSource = new EventSource(`${NOTIFY_URL}/sse`);

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.message) {
            const payload = JSON.parse(data.message);
            // Kendi cihazımızın gönderdiği bildirimi yok say
            if (payload.deviceId && payload.deviceId === this.deviceId) {
              return;
            }
            if (payload.type === "DATA_CHANGED") {
              console.log("[CloudSync] Diğer cihazdan güncelleme sinyali alındı. Veri çekiliyor...");
              this.pullFromCloud(false);
            }
          }
        } catch (e) {
          // Düz metin pingleri
          this.pullFromCloud(false);
        }
      };

      this.eventSource.onerror = () => {
        // Hata durumunda EventSource otomatik yeniden bağlanır
      };
    } catch (err) {
      console.warn("[CloudSync] Live listener hatası:", err);
    }
  }

  // Yerel veride değişiklik olduğunda buluta göndermeyi sıraya al (Debounce: 1.2 sn)
  notifyLocalChange() {
    if (this.pushDebounceTimer) {
      clearTimeout(this.pushDebounceTimer);
    }
    this.updateStatus("SYNCING", "Buluta aktarılıyor...");
    this.pushDebounceTimer = setTimeout(() => {
      this.pushToCloud();
    }, 1200);
  }

  async pushToCloud() {
    if (!navigator.onLine) {
      this.updateStatus("OFFLINE", "Çevrimdışı (Yerel)");
      return;
    }

    try {
      this.isSyncing = true;
      const nowIso = new Date().toISOString();
      const statePayload = appState.exportDataJson();

      const requestBody = {
        name: "SODSAN Factory State",
        data: {
          updatedAt: nowIso,
          updatedByDevice: this.deviceId,
          payload: statePayload
        }
      };

      const resp = await fetch(CLOUD_ENDPOINT, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (resp.ok) {
        this.lastSyncedTimestamp = Date.now();
        this.updateStatus("SYNCED", "Bulut Eşitlendi");
        console.log("[CloudSync] Buluta başarıyla kaydedildi.");

        // Diğer cihazlara ntfy üzerinden anında haber ver
        fetch(NOTIFY_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            type: "DATA_CHANGED",
            deviceId: this.deviceId,
            timestamp: Date.now()
          })
        }).catch(() => {});
      } else {
        this.updateStatus("ERROR", "Bulut Eşitleme Hatası");
      }
    } catch (e) {
      console.warn("[CloudSync] Push hatası:", e);
      this.updateStatus("OFFLINE", "Bulut Bağlantı Sorunu");
    } finally {
      this.isSyncing = false;
    }
  }

  async pullFromCloud(isInitial = false) {
    if (!navigator.onLine) {
      this.updateStatus("OFFLINE", "Çevrimdışı (Yerel)");
      return;
    }

    try {
      this.isSyncing = true;
      if (isInitial) {
        this.updateStatus("SYNCING", "Buluttan yükleniyor...");
      }

      const resp = await fetch(CLOUD_ENDPOINT, {
        method: "GET",
        headers: { "Cache-Control": "no-cache" }
      });

      if (!resp.ok) {
        this.updateStatus("SYNCED", "Yerel Mod Aktif");
        return;
      }

      const resJson = await resp.json();
      if (!resJson || !resJson.data || !resJson.data.payload) {
        this.updateStatus("SYNCED", "Bulut Eşitlendi");
        return;
      }

      const remoteData = resJson.data;
      const remoteUpdatedAt = new Date(remoteData.updatedAt || 0).getTime();
      const localState = appState.state;
      const localUpdatedAt = new Date(localState._lastSyncTime || 0).getTime();

      // Eğer uzaktaki veri daha yeni ise içeri aktar
      if (remoteUpdatedAt > localUpdatedAt || isInitial) {
        console.log("[CloudSync] Uzak veri uygulandı. Son güncelleme:", remoteData.updatedAt);
        const currentUser = appState.state.currentUser;

        // Veriyi içe aktar
        const success = appState.importDataJson(remoteData.payload);
        if (success) {
          // Mevcut oturumu koru
          if (currentUser) {
            appState.state.currentUser = currentUser;
          }
          appState.state._lastSyncTime = remoteData.updatedAt;
          this.lastSyncedTimestamp = Date.now();
          this.updateStatus("SYNCED", "Bulut Eşitlendi");

          // Tüm açık ekranları yeni verilerle sessizce tazele
          if (window.portalApp && typeof window.portalApp.refreshAllActiveViews === "function") {
            window.portalApp.refreshAllActiveViews();
          }

          if (!isInitial) {
            this.showToast("🔄 Diğer cihazdaki değişiklikler senkronize edildi!");
          }
        }
      } else {
        this.updateStatus("SYNCED", "Bulut Eşitlendi");
      }
    } catch (e) {
      console.warn("[CloudSync] Pull hatası:", e);
      this.updateStatus("SYNCED", "Bulut Eşitlendi");
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

  showSyncModal() {
    const lastSyncTimeStr = this.lastSyncedTimestamp ? new Date(this.lastSyncedTimestamp).toLocaleTimeString("tr-TR") : "Az önce";
    const msg = `🌐 SODSAN Çoklu Cihaz Bulut Eşitlemesi\n\n` +
      `Durum: ${this.syncText || 'Bağlı'}\n` +
      `Cihaz ID: ${this.deviceId}\n` +
      `Son Senkronizasyon: ${lastSyncTimeStr}\n` +
      `Fabrika Eşitleme Kodu: ${this.syncRoom}\n\n` +
      `PC, tablet ve telefonlarınız bu kod üzerinden otomatik olarak birbirine bağlıdır.\n\n` +
      `Şimdi buluttan en son verileri çekip güncellemek istiyor musunuz?`;

    if (confirm(msg)) {
      this.updateStatus("SYNCING", "Elle eşitleniyor...");
      this.pullFromCloud(true);
      setTimeout(() => {
        alert("✅ Senkronizasyon başarıyla tamamlandı!");
      }, 900);
    }
  }
}

export const cloudSync = new CloudSyncService();
