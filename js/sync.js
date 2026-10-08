/**
 * Sağlık & Yaşam Takvimi - Bulut Senkronizasyon Modülü (CloudSync)
 * Bilgisayar ve telefon arasında sıfır kurulumla, çift yönlü anlık veri eşitlemesi sağlar.
 */

const CloudSync = {
  STORAGE_KEY_SYNC_ID: 'saglik_cloud_sync_id',
  STORAGE_KEY_LAST_SYNC: 'saglik_cloud_last_sync',
  STORAGE_KEY_PROVIDER: 'saglik_cloud_provider',

  syncId: null,
  provider: 'jsonblob', // 'jsonblob' | 'npoint'
  isSyncing: false,
  pushTimeout: null,
  autoPullInterval: null,

  init() {
    this.syncId = localStorage.getItem(this.STORAGE_KEY_SYNC_ID);
    this.provider = localStorage.getItem(this.STORAGE_KEY_PROVIDER) || 'jsonblob';

    // 1. URL'de ?sync=... parametresi var mı kontrol et (Telefonda QR veya Link ile açılınca)
    const urlParams = new URLSearchParams(window.location.search);
    const syncParam = urlParams.get('sync');

    if (syncParam) {
      this.handleUrlSyncParam(syncParam);
    } else if (this.syncId) {
      // Zaten bir eşitleme odasına bağlıysa arka planda ilk çekmeyi yap
      setTimeout(() => this.pull(false), 1200);
    }

    // 2. Sayfa odağa geldiğinde veya sekme değiştirildiğinde otomatik eşitle
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.hasActiveSync()) {
        this.pull(false);
      }
    });

    window.addEventListener('focus', () => {
      if (this.hasActiveSync()) {
        this.pull(false);
      }
    });

    // 3. Her 45 saniyede bir sessiz arka plan kontrolü
    if (this.autoPullInterval) clearInterval(this.autoPullInterval);
    this.autoPullInterval = setInterval(() => {
      if (this.hasActiveSync() && !this.isSyncing) {
        this.pull(false);
      }
    }, 45000);

    this.updateUI();
  },

  hasActiveSync() {
    return !!this.syncId;
  },

  getSyncId() {
    return this.syncId;
  },

  // Paylaşım URL'sini oluştur
  getShareUrl() {
    if (!this.syncId) return '';
    const base = window.location.origin + window.location.pathname;
    return `${base}?sync=${encodeURIComponent(this.syncId)}`;
  },

  // URL'deki parametre ile bağlanma
  async handleUrlSyncParam(paramValue) {
    const cleanId = paramValue.trim();
    if (!cleanId) return;

    try {
      this.setSyncStatusBadge('loading', 'Bulut bağlanıyor...');
      const success = await this.connectWithCode(cleanId);
      if (success) {
        // URL'deki ?sync parametresini temizle
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        if (typeof showToast === 'function') {
          showToast('☁️ Bulut senkronizasyonu bağlandı! Bilgisayarınızdaki veriler yüklendi.', 'success');
        }
      }
    } catch (err) {
      console.error('URL ile eşitleme hatası:', err);
    }
  },

  // =================== BULUT ODASI OLUŞTURMA (BİLGİSAYARDA İLK KEZ) ===================
  async startNewSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.setSyncStatusBadge('loading', 'Bulut odası oluşturuluyor...');

    const localData = {
      version: '1.0',
      lastUpdated: Date.now(),
      events: Storage.getEvents(),
      categories: Storage.getCategories()
    };

    try {
      // 1. jsonblob.com ile oda oluşturmayı dene
      let newId = null;
      let usedProvider = 'jsonblob';

      try {
        const res = await fetch('https://jsonblob.com/api/jsonBlob', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(localData)
        });

        if (res.ok) {
          const loc = res.headers.get('Location') || res.headers.get('x-jsonblob');
          if (loc) {
            const parts = loc.split('/');
            newId = parts[parts.length - 1];
            usedProvider = 'jsonblob';
          }
        }
      } catch (e) {
        console.warn('jsonblob oluşturma denemesi başarısız, npoint deneniyor:', e);
      }

      // 2. Yedek servis: npoint.io
      if (!newId) {
        try {
          const res = await fetch('https://api.npoint.io/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localData)
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.binId) {
              newId = data.binId;
              usedProvider = 'npoint';
            }
          }
        } catch (e2) {
          console.warn('npoint oluşturma denemesi de başarısız:', e2);
        }
      }

      if (!newId) {
        throw new Error('Bulut servisine ulaşılamadı. Lütfen internet bağlantınızı kontrol edin.');
      }

      this.syncId = newId;
      this.provider = usedProvider;
      localStorage.setItem(this.STORAGE_KEY_SYNC_ID, newId);
      localStorage.setItem(this.STORAGE_KEY_PROVIDER, usedProvider);
      localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());

      this.updateUI();
      if (typeof showToast === 'function') {
        showToast('☁️ Bulut eşitleme başarıyla başlatıldı! QR kodu okutarak telefonunuza bağlayabilirsiniz.', 'success');
      }
      return true;

    } catch (err) {
      console.error('startNewSync hatası:', err);
      alert('Bulut eşitleme başlatılamadı: ' + err.message);
      this.setSyncStatusBadge('error', 'Hata');
      return false;
    } finally {
      this.isSyncing = false;
    }
  },

  // =================== MEVCUT KOD İLE BAĞLANMA (TELEFONDA) ===================
  async connectWithCode(codeOrUrl) {
    let cleanCode = codeOrUrl.trim();
    if (cleanCode.includes('sync=')) {
      const match = cleanCode.match(/sync=([^&]+)/);
      if (match) cleanCode = decodeURIComponent(match[1]);
    }
    if (cleanCode.includes('/')) {
      const parts = cleanCode.split('/');
      cleanCode = parts[parts.length - 1];
    }

    if (!cleanCode) {
      alert('Lütfen geçerli bir eşitleme kodu girin.');
      return false;
    }

    this.isSyncing = true;
    this.setSyncStatusBadge('loading', 'Bulut verileri çekiliyor...');

    try {
      // Önce bu kodu çekmeyi dene
      const remoteData = await this.fetchRemoteData(cleanCode);
      if (!remoteData || !Array.isArray(remoteData.events)) {
        throw new Error('Bu kodla ilişkili veri bulunamadı veya biçim geçersiz.');
      }

      // Yerel ve uzak verileri birleştir
      const localEvents = Storage.getEvents();
      const localCategories = Storage.getCategories();

      const mergedEvents = this.mergeEvents(localEvents, remoteData.events);
      const mergedCategories = this.mergeCategories(localCategories, remoteData.categories || []);

      Storage.saveEvents(mergedEvents, true);
      Storage.saveCategories(mergedCategories, true);

      this.syncId = cleanCode;
      localStorage.setItem(this.STORAGE_KEY_SYNC_ID, cleanCode);
      localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());

      // Birleşmiş tam listeyi buluta da geri yükle (her iki taraf da tam olsun)
      await this.pushDirect(mergedEvents, mergedCategories);

      if (window.App && typeof window.App.refreshAllViews === 'function') {
        window.App.refreshAllViews();
      }

      this.updateUI();
      if (typeof showToast === 'function') {
        showToast(`☁️ Başarıyla bağlandı! Toplam ${mergedEvents.length} kayıt eşitlendi.`, 'success');
      }
      return true;

    } catch (err) {
      console.error('connectWithCode hatası:', err);
      alert('Eşitleme koduna bağlanılamadı: ' + err.message);
      this.setSyncStatusBadge('error', 'Bağlantı Hatası');
      return false;
    } finally {
      this.isSyncing = false;
    }
  },

  // =================== BULUTTAN VERİ ÇEKME (PULL) ===================
  async pull(isManual = false) {
    if (!this.syncId || this.isSyncing) return;
    this.isSyncing = true;
    this.setSyncStatusBadge('loading', 'Eşitleniyor...');

    try {
      const remoteData = await this.fetchRemoteData(this.syncId);
      if (!remoteData || !Array.isArray(remoteData.events)) {
        this.setSyncStatusBadge('connected', 'Bağlı');
        return;
      }

      const localEvents = Storage.getEvents();
      const localCategories = Storage.getCategories();

      // Birleştir
      const mergedEvents = this.mergeEvents(localEvents, remoteData.events);
      const mergedCategories = this.mergeCategories(localCategories, remoteData.categories || []);

      // Değişiklik var mı kontrol et
      const eventsChanged = JSON.stringify(localEvents) !== JSON.stringify(mergedEvents);
      const catsChanged = JSON.stringify(localCategories) !== JSON.stringify(mergedCategories);

      if (eventsChanged || catsChanged) {
        Storage.saveEvents(mergedEvents, true);
        Storage.saveCategories(mergedCategories, true);

        if (window.App && typeof window.App.refreshAllViews === 'function') {
          window.App.refreshAllViews();
        }

        if (isManual && typeof showToast === 'function') {
          showToast('☁️ Veriler buluttan güncellendi!', 'success');
        }
      } else if (isManual && typeof showToast === 'function') {
        showToast('☁️ Tüm kayıtlarınız zaten güncel.', 'info');
      }

      localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());
      this.setSyncStatusBadge('connected', 'Eşitlendi');
      this.updateLastSyncText();

    } catch (err) {
      console.warn('Cloud pull hatası:', err);
      this.setSyncStatusBadge('error', 'Senkronizasyon Hatası');
    } finally {
      this.isSyncing = false;
    }
  },

  // =================== BULUTA VERİ GÖNDERME (PUSH) ===================
  triggerPush() {
    if (!this.syncId) return;
    if (this.pushTimeout) clearTimeout(this.pushTimeout);
    this.pushTimeout = setTimeout(() => {
      this.push();
    }, 800);
  },

  async push() {
    if (!this.syncId || this.isSyncing) return;
    this.isSyncing = true;
    this.setSyncStatusBadge('loading', 'Buluta kaydediliyor...');

    try {
      const events = Storage.getEvents();
      const categories = Storage.getCategories();
      await this.pushDirect(events, categories);
      localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());
      this.setSyncStatusBadge('connected', 'Eşitlendi');
      this.updateLastSyncText();
    } catch (err) {
      console.error('Cloud push hatası:', err);
      this.setSyncStatusBadge('error', 'Gönderilemedi');
    } finally {
      this.isSyncing = false;
    }
  },

  async pushDirect(events, categories) {
    const payload = {
      version: '1.0',
      lastUpdated: Date.now(),
      events,
      categories
    };

    let success = false;

    // jsonblob denemesi
    if (this.provider === 'jsonblob' || !this.provider) {
      try {
        const res = await fetch(`https://jsonblob.com/api/jsonBlob/${this.syncId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) success = true;
      } catch (e) {
        console.warn('jsonblob push hatası:', e);
      }
    }

    // npoint denemesi
    if (!success) {
      try {
        const res = await fetch(`https://api.npoint.io/${this.syncId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) success = true;
      } catch (e) {
        console.warn('npoint push hatası:', e);
      }
    }

    if (!success) {
      throw new Error('Veriler buluta yüklenemedi.');
    }
  },

  // =================== YARDIMCI METOTLAR ===================
  async fetchRemoteData(syncId) {
    // 1. jsonblob üzerinden dene
    try {
      const res = await fetch(`https://jsonblob.com/api/jsonBlob/${syncId}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const json = await res.json();
        this.provider = 'jsonblob';
        localStorage.setItem(this.STORAGE_KEY_PROVIDER, 'jsonblob');
        return json;
      }
    } catch (e) {
      // jsonblob başarısız olduysa devam et
    }

    // 2. npoint üzerinden dene
    try {
      const res = await fetch(`https://api.npoint.io/${syncId}`);
      if (res.ok) {
        const json = await res.json();
        this.provider = 'npoint';
        localStorage.setItem(this.STORAGE_KEY_PROVIDER, 'npoint');
        return json;
      }
    } catch (e) {
      // npoint de başarısız
    }

    throw new Error('Buluttan veri okunamadı.');
  },

  mergeEvents(localEvents = [], remoteEvents = []) {
    const map = new Map();
    localEvents.forEach(e => {
      if (e && e.id) map.set(e.id, e);
    });

    remoteEvents.forEach(remote => {
      if (!remote || !remote.id) return;
      if (!map.has(remote.id)) {
        map.set(remote.id, remote);
      } else {
        const local = map.get(remote.id);
        const remoteTime = remote.updatedAt || remote.createdAt || '';
        const localTime = local.updatedAt || local.createdAt || '';
        if (remoteTime > localTime) {
          map.set(remote.id, remote);
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const dtA = `${a.date}T${a.time || '00:00'}`;
      const dtB = `${b.date}T${b.time || '00:00'}`;
      return dtB.localeCompare(dtA);
    });
  },

  mergeCategories(localCats = [], remoteCats = []) {
    const map = new Map();
    localCats.forEach(c => {
      if (c && c.id) map.set(c.id, c);
    });
    remoteCats.forEach(c => {
      if (c && c.id && !map.has(c.id)) {
        map.set(c.id, c);
      }
    });
    return Array.from(map.values());
  },

  // Eşitlemeyi durdur / Bağlantıyı kes
  disconnect() {
    if (!confirm('Bulut eşitlemesini durdurmak istediğinize emin misiniz? Cihazınızdaki kayıtlar silinmez, ancak artık diğer cihazla canlı eşitlenmez.')) {
      return;
    }
    this.syncId = null;
    localStorage.removeItem(this.STORAGE_KEY_SYNC_ID);
    localStorage.removeItem(this.STORAGE_KEY_LAST_SYNC);
    this.updateUI();
    if (typeof showToast === 'function') {
      showToast('Bulut eşitleme bağlantısı kesildi.', 'info');
    }
  },

  // =================== ARAYÜZ (UI) GÜNCELLEMELERİ ===================
  updateUI() {
    const unlinkedCard = document.getElementById('cloud-sync-unlinked-view');
    const linkedCard = document.getElementById('cloud-sync-linked-view');
    const codeDisplay = document.getElementById('cloud-sync-code-display');
    const qrImage = document.getElementById('cloud-sync-qr-img');
    const shareInput = document.getElementById('cloud-sync-share-url');

    if (this.syncId) {
      if (unlinkedCard) unlinkedCard.style.display = 'none';
      if (linkedCard) linkedCard.style.display = 'block';

      if (codeDisplay) codeDisplay.textContent = this.syncId;
      const shareUrl = this.getShareUrl();
      if (shareInput) shareInput.value = shareUrl;

      if (qrImage) {
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`;
      }

      this.setSyncStatusBadge('connected', 'Bulut Aktif');
      this.updateLastSyncText();
    } else {
      if (unlinkedCard) unlinkedCard.style.display = 'block';
      if (linkedCard) linkedCard.style.display = 'none';
      this.setSyncStatusBadge('disconnected', 'Yerel');
    }
  },

  setSyncStatusBadge(status, text) {
    const badge = document.getElementById('header-sync-badge');
    const icon = document.getElementById('header-sync-icon');
    const label = document.getElementById('header-sync-label');

    if (!badge) return;

    badge.className = `sync-badge status-${status}`;
    if (label) label.textContent = text;

    if (icon) {
      if (status === 'connected') icon.textContent = '☁️';
      else if (status === 'loading') icon.textContent = '🔄';
      else if (status === 'error') icon.textContent = '⚠️';
      else icon.textContent = '📱';
    }
  },

  updateLastSyncText() {
    const txt = document.getElementById('cloud-sync-last-time');
    if (!txt) return;
    const last = localStorage.getItem(this.STORAGE_KEY_LAST_SYNC);
    if (!last) {
      txt.textContent = 'Henüz eşitlenmedi';
      return;
    }
    const d = new Date(last);
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    txt.textContent = `Son eşitleme: Bugün ${timeStr}`;
  },

  // Paylaşım linkini panoya kopyala
  copyShareLink() {
    const shareUrl = this.getShareUrl();
    if (!shareUrl) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        if (typeof showToast === 'function') {
          showToast('📋 Eşitleme bağlantısı kopyalandı! WhatsApp ile kendinize gönderip telefonda açabilirsiniz.', 'success');
        }
      }).catch(() => this.fallbackCopy(shareUrl));
    } else {
      this.fallbackCopy(shareUrl);
    }
  },

  fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    if (typeof showToast === 'function') {
      showToast('📋 Bağlantı kopyalandı!', 'success');
    }
  }
};
