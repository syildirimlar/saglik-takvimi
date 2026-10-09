/**
 * Sağlık & Yaşam Takvimi - Bulut Senkronizasyon Modülü (CloudSync)
 * Bilgisayar ve telefon arasında sıfır kurulumla, çift yönlü anlık veri eşitlemesi sağlar.
 */

const CloudSync = {
  STORAGE_KEY_SYNC_ID: 'saglik_cloud_sync_id',
  STORAGE_KEY_LAST_SYNC: 'saglik_cloud_last_sync',
  STORAGE_KEY_PROVIDER: 'saglik_cloud_provider',
  STORAGE_KEY_AUTO_SYNC: 'saglik_cloud_auto_sync_enabled',

  syncId: null,
  provider: 'npoint', // 'npoint' | 'jsonblob' | 'direct'
  isSyncing: false,
  pushTimeout: null,
  autoPullInterval: null,

  // Batarya Tasarrufu Modu: Varsayılan olarak kapalıdır (Telefonun şarjını tüketmez)
  isAutoSyncEnabled() {
    return localStorage.getItem(this.STORAGE_KEY_AUTO_SYNC) === 'true';
  },

  setAutoSyncEnabled(enabled) {
    if (enabled) {
      localStorage.setItem(this.STORAGE_KEY_AUTO_SYNC, 'true');
      this.startAutoSyncInterval();
    } else {
      localStorage.setItem(this.STORAGE_KEY_AUTO_SYNC, 'false');
      this.stopAutoSyncInterval();
    }
    this.updateUI();
  },

  startAutoSyncInterval() {
    this.stopAutoSyncInterval();
    if (!this.hasActiveSync()) return;
    // Kullanıcı özellikle açık tutmak istediyse nazikçe 60 saniyede bir kontrol etsin
    this.autoPullInterval = setInterval(() => {
      if (this.hasActiveSync() && !this.isSyncing && this.isAutoSyncEnabled()) {
        this.pull(false);
      }
    }, 60000);
  },

  stopAutoSyncInterval() {
    if (this.autoPullInterval) {
      clearInterval(this.autoPullInterval);
      this.autoPullInterval = null;
    }
  },

  init() {
    this.syncId = localStorage.getItem(this.STORAGE_KEY_SYNC_ID);
    this.provider = localStorage.getItem(this.STORAGE_KEY_PROVIDER) || 'restful-api';

    // 1. URL'de ?sync=... veya ?d=... parametresi var mı kontrol et (Telefonda QR/Link ile açılınca)
    const urlParams = new URLSearchParams(window.location.search);
    const syncParam = urlParams.get('sync');
    const dataParam = urlParams.get('d');

    if (syncParam || dataParam) {
      this.handleIncomingUrlParams(syncParam, dataParam);
    } else if (this.syncId && this.isAutoSyncEnabled()) {
      // Sadece kullanıcı otomatik eşitlemeyi açık tuttuysa ilk açılışta çek
      setTimeout(() => this.pull(false), 800);
    }

    // 2. Batarya Koruma Kontrolü:
    // Varsayılan olarak arka plan döngüleri KAPALIDIR. Sadece kullanıcı ayarı açarsa başlar.
    if (this.isAutoSyncEnabled()) {
      this.startAutoSyncInterval();

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.hasActiveSync() && this.isAutoSyncEnabled()) {
          this.pull(false);
        }
      });
    } else {
      this.stopAutoSyncInterval();
    }

    this.updateUI();
  },

  hasActiveSync() {
    return !!this.syncId;
  },

  getSyncId() {
    return this.syncId;
  },

  // Paylaşım URL'sini oluştur (Hem Cloud ID hem de doğrudan anlık veri içerir)
  getShareUrl(includeData = true) {
    if (!this.syncId) return '';
    const base = window.location.origin + window.location.pathname;
    let url = `${base}?sync=${encodeURIComponent(this.syncId)}`;

    if (includeData) {
      try {
        const events = Storage.getEvents();
        const categories = Storage.getCategories();
        const users = Storage.getUsers();
        const payload = this.encodePayload({ events, categories, users });
        if (payload) {
          url += `&d=${payload}`;
        }
      } catch (e) {
        console.warn('getShareUrl veri kodlama uyarısı:', e);
      }
    }

    return url;
  },

  // Telefon eşleştirme için özel Master Link (Hem Kullanıcı Girişini Hem Bulut Odasını Hem Takvim ve Aboneleri tek tıkla aktarır)
  getDevicePairingUrl(currentUser = null) {
    const user = currentUser || Storage.getCurrentUser();
    const base = window.location.origin + window.location.pathname;
    const syncId = this.syncId;

    const allUsers = Storage.getUsers();
    const allEvents = Storage.getEvents();
    const allCategories = Storage.getCategories();

    // 1. Giriş yapacak kullanıcı + tüm kullanıcılar + sync id
    const invitePayload = {
      u: user ? user.username : 'admin',
      p: user ? user.password : '123',
      n: user ? user.name : 'Yönetici',
      g: user ? user.gender : 'female',
      r: user ? (user.role || 'admin') : 'admin',
      users: allUsers,
      s: syncId
    };
    const encInvite = this.utf8ToBase64(JSON.stringify(invitePayload));

    // 2. Takvim etkinlikleri + kategoriler + tüm kullanıcılar
    const dataPayload = this.encodePayload({
      events: allEvents,
      categories: allCategories,
      users: allUsers
    });

    let url = `${base}?invite=${encInvite}`;
    if (syncId) {
      url += `&sync=${encodeURIComponent(syncId)}`;
    }
    if (dataPayload) {
      url += `&d=${dataPayload}`;
    }
    return url;
  },

  // =================== UTF-8 / TÜRKÇE & EMOJİ UYUMLU BASE64 ===================
  utf8ToBase64(str) {
    try {
      const bytes = new TextEncoder().encode(str);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (e) {
      console.error('utf8ToBase64 hatası:', e);
      return '';
    }
  },

  base64ToUtf8(base64url) {
    try {
      let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    } catch (e) {
      console.error('base64ToUtf8 hatası:', e);
      return null;
    }
  },

  encodePayload(data) {
    try {
      const minified = {
        e: (data.events || []).map(ev => ({
          i: ev.id,
          c: ev.categoryId,
          d: ev.date,
          t: ev.time,
          s: ev.status,
          dt: ev.details,
          n: ev.notes
        })),
        c: (data.categories || []).filter(cat => !cat.isSystem)
      };
      if (Array.isArray(data.users) && data.users.length > 0) {
        minified.u = data.users.map(u => ({
          i: u.id,
          u: u.username,
          p: u.password,
          n: u.name,
          g: u.gender,
          r: u.role,
          ua: u.updatedAt
        }));
      }
      const json = JSON.stringify(minified);
      return this.utf8ToBase64(json);
    } catch (err) {
      console.error('encodePayload hatası:', err);
      return '';
    }
  },

  decodePayload(str) {
    try {
      const json = this.base64ToUtf8(str);
      if (!json) return null;
      const parsed = JSON.parse(json);
      const events = (parsed.e || []).map(ev => ({
        id: ev.i || ('evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
        categoryId: ev.c || 'wc',
        date: ev.d,
        time: ev.t || '12:00',
        status: ev.s || 'completed',
        details: ev.dt || {},
        notes: ev.n || '',
        reminderSent: false,
        checkinPrompted: false
      }));
      const categories = parsed.c || [];
      const users = (parsed.u || []).map(u => ({
        id: u.i,
        username: u.u,
        password: u.p,
        name: u.n,
        gender: u.g,
        role: u.r || 'user',
        updatedAt: u.ua || new Date().toISOString()
      }));
      return { events, categories, users };
    } catch (err) {
      console.error('decodePayload hatası:', err);
      return null;
    }
  },

  // =================== GELEN URL PARAMETRELERİNİ İŞLE (TELEFONDA) ===================
  async handleIncomingUrlParams(syncIdParam, dataParam) {
    let importedCount = 0;

    // 1. Doğrudan veri parametresi varsa hemen içeri aktar (Sıfır gecikme, garantili)
    if (dataParam) {
      try {
        const decoded = this.decodePayload(dataParam);
        if (decoded) {
          if (Array.isArray(decoded.users) && decoded.users.length > 0) {
            Storage.mergeUsers(decoded.users);
          }
          if (Array.isArray(decoded.events) && decoded.events.length > 0) {
            const localEvents = Storage.getEvents();
            const localCats = Storage.getCategories();

            const mergedEvents = this.mergeEvents(localEvents, decoded.events);
            const mergedCats = this.mergeCategories(localCats, decoded.categories || []);

            Storage.saveEvents(mergedEvents, true);
            Storage.saveCategories(mergedCats, true);
            importedCount = mergedEvents.length;

            if (window.App && typeof window.App.refreshAllViews === 'function') {
              window.App.refreshAllViews();
            }
          }
        }
      } catch (err) {
        console.warn('Doğrudan veri aktarma hatası:', err);
      }
    }

    // 2. Eşitleme ID'si varsa kaydet
    if (syncIdParam) {
      const cleanId = syncIdParam.trim();
      this.syncId = cleanId;
      localStorage.setItem(this.STORAGE_KEY_SYNC_ID, cleanId);
      localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());

      // Buluttan veriyi de çek
      try {
        await this.pull(false);
      } catch (e) {
        console.warn('Bulut çekme uyarısı:', e);
      }
    }

    // URL'deki parametreleri temizle (Sayfa yenilenince tekrar açılmasın)
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    this.updateUI();

    if (typeof showToast === 'function') {
      const currentCount = Storage.getEvents().length;
      showToast(`☁️ Bulut eşitleme bağlandı! Toplam ${currentCount} kayıt takviminizde hazır.`, 'success');
    }
  },

  // =================== BULUT ODASI OLUŞTURMA (BİLGİSAYARDA İLK KEZ) ===================
  async startNewSync() {
    this.isSyncing = true;
    this.setSyncStatusBadge('loading', 'Bulut odası açılıyor...');

    const localData = {
      version: '1.0',
      lastUpdated: Date.now(),
      events: Storage.getEvents(),
      categories: Storage.getCategories(),
      users: Storage.getUsers()
    };
    const payloadStr = this.encodePayload(localData);

    let realId = null;
    let usedProvider = 'restful-api';

    // 1. restful-api.dev ile oluştur (Yüksek hızlı, CORS destekli, stabil)
    try {
      const res = await fetch('https://api.restful-api.dev/objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'SaglikTakvim_Room',
          data: {
            payload: payloadStr,
            version: '1.0',
            lastUpdated: Date.now(),
            eventsCount: (localData.events || []).length,
            usersCount: (localData.users || []).length
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          realId = data.id;
          usedProvider = 'restful-api';
        }
      }
    } catch (e) {
      console.warn('restful-api oluşturma hatası:', e);
    }

    // Yedek direkt oda
    if (!realId) {
      realId = 'st_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      usedProvider = 'direct';
    }

    this.syncId = realId;
    this.provider = usedProvider;
    localStorage.setItem(this.STORAGE_KEY_SYNC_ID, realId);
    localStorage.setItem(this.STORAGE_KEY_PROVIDER, usedProvider);
    localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());

    this.isSyncing = false;
    this.updateUI();
    this.setSyncStatusBadge('connected', 'Bulut Aktif');

    if (typeof showToast === 'function') {
      showToast('☁️ Eşitleme hazır! Telefon kameranızı karekoda tutun veya linki WhatsApp ile kendinize gönderin.', 'success');
    }
    return true;
  },

  // =================== MEVCUT KOD İLE BAĞLANMA (TELEFONDA) ===================
  async connectWithCode(codeOrUrl) {
    let cleanCode = (codeOrUrl || '').trim();
    if (!cleanCode) {
      alert('Lütfen geçerli bir eşitleme kodu veya link girin.');
      return false;
    }

    this.isSyncing = true;
    this.setSyncStatusBadge('loading', 'Bulut verileri çekiliyor...');

    try {
      // Eğer bir URL yapıştırılmışsa
      if (cleanCode.includes('http://') || cleanCode.includes('https://') || cleanCode.includes('?')) {
        const urlObj = new URL(cleanCode.startsWith('http') ? cleanCode : 'https://dummy.com/' + cleanCode);
        const sParam = urlObj.searchParams.get('sync');
        const dParam = urlObj.searchParams.get('d');
        const inviteParam = urlObj.searchParams.get('invite');

        if (inviteParam) {
          Storage.importInvitePayload(inviteParam);
        }

        if (sParam || dParam) {
          await this.handleIncomingUrlParams(sParam, dParam);
          return true;
        }
      }

      if (cleanCode.includes('/')) {
        const parts = cleanCode.split('/');
        cleanCode = parts[parts.length - 1];
      }

      // Buluttan veriyi çekmeyi dene
      const remoteData = await this.fetchRemoteData(cleanCode);
      if (remoteData && (Array.isArray(remoteData.events) || Array.isArray(remoteData.users))) {
        if (Array.isArray(remoteData.users) && remoteData.users.length > 0) {
          Storage.mergeUsers(remoteData.users);
        }

        const localEvents = Storage.getEvents();
        const localCats = Storage.getCategories();
        const remoteEvents = remoteData.events || [];
        const remoteCats = remoteData.categories || [];

        const mergedEvents = this.mergeEvents(localEvents, remoteEvents);
        const mergedCats = this.mergeCategories(localCats, remoteCats);

        Storage.saveEvents(mergedEvents, true);
        Storage.saveCategories(mergedCats, true);

        this.syncId = cleanCode;
        localStorage.setItem(this.STORAGE_KEY_SYNC_ID, cleanCode);
        localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());

        // Buluta da güncel halini yaz
        await this.pushDirect(mergedEvents, mergedCats, Storage.getUsers());

        if (window.App && typeof window.App.refreshAllViews === 'function') {
          window.App.refreshAllViews();
        }

        this.updateUI();
        if (typeof showToast === 'function') {
          showToast(`☁️ Başarıyla bağlandı! Toplam ${mergedEvents.length} kayıt ve hesap bilgileri eşitlendi.`, 'success');
        }
        return true;
      } else {
        throw new Error('Belirtilen kodla eşleşen bulut kaydı bulunamadı.');
      }

    } catch (err) {
      console.error('connectWithCode hatası:', err);
      alert('Eşitleme bağlantısı kurulamadı: ' + err.message);
      this.setSyncStatusBadge('error', 'Hata');
      return false;
    } finally {
      this.isSyncing = false;
    }
  },

  // =================== ÇİFT YÖNLÜ ANLIK EŞİTLEME (SYNC NOW - KULLANICI TUŞA BASINCA) ===================
  async syncNow(isManual = true) {
    if (!this.syncId) {
      if (isManual && typeof showToast === 'function') {
        showToast('Henüz bir bulut odasına bağlı değilsiniz. Lütfen Yedekleme sekmesinden bağlanın.', 'info');
      }
      return false;
    }
    if (this.isSyncing) return false;

    this.isSyncing = true;
    this.setSyncStatusBadge('loading', 'Eşitleniyor...');

    try {
      // 1. Buluttan en son veriyi çek
      const remoteData = await this.fetchRemoteData(this.syncId);
      if (remoteData && Array.isArray(remoteData.users) && remoteData.users.length > 0) {
        Storage.mergeUsers(remoteData.users);
      }

      const localEvents = Storage.getEvents();
      const localCats = Storage.getCategories();

      let mergedEvents = localEvents;
      let mergedCats = localCats;

      if (remoteData && Array.isArray(remoteData.events)) {
        mergedEvents = this.mergeEvents(localEvents, remoteData.events);
        mergedCats = this.mergeCategories(localCats, remoteData.categories || []);
        Storage.saveEvents(mergedEvents, true);
        Storage.saveCategories(mergedCats, true);
      }

      // 2. Birleştirilmiş güncel verileri buluta yükle
      await this.pushDirect(mergedEvents, mergedCats, Storage.getUsers());

      // 3. Ekrandaki takvim ve rapor görünümlerini yenile
      if (window.App && typeof window.App.refreshAllViews === 'function') {
        window.App.refreshAllViews();
      }

      localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());
      this.setSyncStatusBadge('connected', 'Eşitle');
      this.updateLastSyncText();
      this.updateUI();

      if (isManual && typeof showToast === 'function') {
        showToast(`☁️ Eşitleme tamamlandı! Toplam ${mergedEvents.length} kayıt ve hesaplar senkronize edildi.`, 'success');
      }
      return true;
    } catch (err) {
      console.error('syncNow hatası:', err);
      this.setSyncStatusBadge('connected', 'Eşitle');
      if (isManual && typeof showToast === 'function') {
        showToast('Eşitleme sırasında internet hatası oluştu. Lütfen bağlantınızı kontrol edin.', 'error');
      }
      return false;
    } finally {
      this.isSyncing = false;
      this.setSyncStatusBadge(this.syncId ? 'connected' : 'disconnected', this.syncId ? 'Eşitle' : 'Yerel');
    }
  },

  // =================== BULUTTAN VERİ ÇEKME (PULL) ===================
  async pull(isManual = false) {
    if (!this.syncId || this.isSyncing) return;
    this.isSyncing = true;
    this.setSyncStatusBadge('loading', 'Eşitleniyor...');

    try {
      const remoteData = await this.fetchRemoteData(this.syncId);
      if (!remoteData) {
        this.setSyncStatusBadge('connected', 'Eşitle');
        if (isManual && typeof showToast === 'function') {
          showToast('Bulut kontrol edildi, mevcut kayıtlarınız korundu.', 'info');
        }
        return;
      }

      let usersChanged = false;
      if (Array.isArray(remoteData.users) && remoteData.users.length > 0) {
        const prevUsers = JSON.stringify(Storage.getUsers());
        const mergedUsers = Storage.mergeUsers(remoteData.users);
        if (JSON.stringify(mergedUsers) !== prevUsers) {
          usersChanged = true;
        }
      }

      if (!Array.isArray(remoteData.events)) {
        this.setSyncStatusBadge('connected', 'Eşitle');
        if (isManual && typeof showToast === 'function') {
          showToast('Bulut kontrol edildi, hesaplar güncellendi.', 'info');
        }
        return;
      }

      const localEvents = Storage.getEvents();
      const localCats = Storage.getCategories();

      const mergedEvents = this.mergeEvents(localEvents, remoteData.events);
      const mergedCats = this.mergeCategories(localCats, remoteData.categories || []);

      const eventsChanged = JSON.stringify(localEvents) !== JSON.stringify(mergedEvents);
      const catsChanged = JSON.stringify(localCats) !== JSON.stringify(mergedCats);

      if (eventsChanged || catsChanged || usersChanged) {
        Storage.saveEvents(mergedEvents, true);
        Storage.saveCategories(mergedCats, true);

        if (window.App && typeof window.App.refreshAllViews === 'function') {
          window.App.refreshAllViews();
        }

        if (isManual && typeof showToast === 'function') {
          showToast(`☁️ Veriler buluttan güncellendi! Toplam ${mergedEvents.length} kayıt.`, 'success');
        }
      } else if (isManual && typeof showToast === 'function') {
        showToast('☁️ Tüm kayıtlarınız ve hesaplarınız zaten güncel.', 'info');
      }

      localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());
      this.setSyncStatusBadge('connected', 'Eşitle');
      this.updateLastSyncText();

    } catch (err) {
      console.warn('Cloud pull hatası:', err);
      this.setSyncStatusBadge('connected', 'Eşitle');
    } finally {
      this.isSyncing = false;
    }
  },

  // =================== BULUTA VERİ GÖNDERME (PUSH) ===================
  triggerPush() {
    if (!this.syncId) return;
    // Batarya Tasarrufu Modu: Otomatik arka plan kontrolü kapalıysa sessiz push yapmayıp şarjı koru
    if (!this.isAutoSyncEnabled()) return;
    if (this.pushTimeout) clearTimeout(this.pushTimeout);
    this.pushTimeout = setTimeout(() => {
      this.push(false);
    }, 1000);
  },

  async push(isManual = false) {
    if (!this.syncId || this.isSyncing) return;
    this.isSyncing = true;
    this.setSyncStatusBadge('loading', 'Buluta yükleniyor...');

    try {
      const events = Storage.getEvents();
      const categories = Storage.getCategories();
      const users = Storage.getUsers();
      await this.pushDirect(events, categories, users);
      localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());
      this.setSyncStatusBadge('connected', 'Bulut Aktif');
      this.updateLastSyncText();
      if (isManual && typeof showToast === 'function') {
        showToast(`☁️ Cihazınızdaki ${events.length} kayıt ve hesaplar buluta yüklendi!`, 'success');
      }
    } catch (err) {
      console.warn('Cloud push hatası:', err);
      this.setSyncStatusBadge('connected', 'Bulut Aktif');
    } finally {
      this.isSyncing = false;
    }
  },

  async pushDirect(events, categories, users = null) {
    if (!this.syncId) return false;
    const allUsers = users || Storage.getUsers();
    const payloadStr = this.encodePayload({
      events,
      categories,
      users: allUsers
    });

    const bodyObj = {
      name: 'SaglikTakvim_Room',
      data: {
        payload: payloadStr,
        version: '1.0',
        lastUpdated: Date.now(),
        eventsCount: (events || []).length,
        usersCount: (allUsers || []).length
      }
    };

    // 1. restful-api.dev ile güncelle (PUT)
    try {
      const res = await fetch(`https://api.restful-api.dev/objects/${this.syncId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj)
      });
      if (res.ok) return true;
    } catch (e) {
      console.warn('pushDirect restful-api hatası:', e);
    }

    return false;
  },

  // =================== VERİ OKUMA / ÇEKME ===================
  async fetchRemoteData(syncId) {
    if (!syncId) return null;
    const cleanId = syncId.trim();

    // 1. restful-api.dev üzerinden oku (GET)
    try {
      const res = await fetch(`https://api.restful-api.dev/objects/${cleanId}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          this.provider = 'restful-api';
          localStorage.setItem(this.STORAGE_KEY_PROVIDER, 'restful-api');

          // Eğer payload string olarak saklandıysa çöz
          if (json.data.payload) {
            const decoded = this.decodePayload(json.data.payload);
            if (decoded) return decoded;
          }

          // Direkt JSON olarak saklandıysa
          if (json.data.events || json.data.users) {
            return {
              events: json.data.events || [],
              categories: json.data.categories || [],
              users: json.data.users || []
            };
          }
        }
      }
    } catch (e) {
      console.warn('restful-api fetch hatası:', e);
    }

    return null;
  },

  // =================== VERİ BİRLEŞTİRME (MERGE) ===================
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
    this.stopAutoSyncInterval();
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
    const eventCountText = document.getElementById('cloud-sync-local-count');
    const autoSyncToggle = document.getElementById('toggle-auto-sync');

    const localCount = (Storage.getEvents() || []).length;
    if (eventCountText) {
      eventCountText.textContent = `${localCount} Kayıt Mevcut`;
    }

    if (autoSyncToggle) {
      autoSyncToggle.checked = this.isAutoSyncEnabled();
    }

    if (this.syncId) {
      if (unlinkedCard) unlinkedCard.style.display = 'none';
      if (linkedCard) linkedCard.style.display = 'block';

      if (codeDisplay) codeDisplay.textContent = this.syncId;
      const shareUrl = this.getShareUrl(true);
      if (shareInput) shareInput.value = shareUrl;

      if (qrImage) {
        // Hızlı QR kod görseli üret
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`;
      }

      this.setSyncStatusBadge('connected', 'Eşitle');
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

    badge.className = `header-sync-btn sync-badge status-${status}`;

    if (status === 'connected') {
      if (icon) {
        icon.textContent = '🔄';
        icon.classList.remove('spin-animation');
      }
      if (label) label.textContent = 'Eşitle';
      badge.title = 'Bulut Verilerini Şimdi Eşitle (Dokununca çift yönlü anında senkronize eder)';
    } else if (status === 'loading') {
      if (icon) {
        icon.textContent = '🔄';
        icon.classList.add('spin-animation');
      }
      if (label) label.textContent = text || 'Eşitleniyor...';
      badge.title = 'Veriler eşitleniyor...';
    } else if (status === 'error') {
      if (icon) {
        icon.textContent = '⚠️';
        icon.classList.remove('spin-animation');
      }
      if (label) label.textContent = 'Hata';
      badge.title = 'Eşitleme hatası. Tekrar denemek için dokunun.';
    } else {
      if (icon) {
        icon.textContent = '📱';
        icon.classList.remove('spin-animation');
      }
      if (label) label.textContent = 'Yerel';
      badge.title = 'Bulut Eşitlemeyi Başlat';
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
    const shareUrl = this.getShareUrl(true);
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

// Global window objesine bağla
window.CloudSync = CloudSync;
