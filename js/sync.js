/**
 * Sağlık & Yaşam Takvimi - Bulut Senkronizasyon Modülü (CloudSync)
 * Bilgisayar ve telefon arasında sıfır kurulumla, çift yönlü anlık veri eşitlemesi sağlar.
 * Mimari:
 *   1. ExtendsClass JSON Bin (Simple POST text/plain & Simple GET - CORS preflight gerektirmez, sınırsız boyut, 7 haneli kısa kod)
 *   2. Restful-API Object Pointer (Sabit Oda ID'si -> en son ExtendsClass Bin ID'sini işaret eder, ~60 byte)
 */

const CloudSync = {
  STORAGE_KEY_SYNC_ID: 'saglik_cloud_sync_id',
  STORAGE_KEY_BIN_ID: 'saglik_takvim_cloud_bin_id_v1',
  STORAGE_KEY_LAST_SYNC: 'saglik_cloud_last_sync',
  STORAGE_KEY_PROVIDER: 'saglik_cloud_provider',
  STORAGE_KEY_AUTO_SYNC: 'saglik_cloud_auto_sync_enabled',

  syncId: null,
  lastBinId: null,
  provider: 'hybrid-ext',
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
    this.lastBinId = localStorage.getItem(this.STORAGE_KEY_BIN_ID);
    this.provider = localStorage.getItem(this.STORAGE_KEY_PROVIDER) || 'hybrid-ext';

    // Eski sahte/geçersiz ID'leri temizle
    if (this.syncId && (this.syncId.startsWith('direct_') || this.syncId.startsWith('st_'))) {
      this.syncId = null;
      localStorage.removeItem(this.STORAGE_KEY_SYNC_ID);
    }

    // 1. URL'de ?sync=..., ?bin=... veya ?d=... parametresi var mı kontrol et
    const urlParams = new URLSearchParams(window.location.search);
    const syncParam = urlParams.get('sync');
    const binParam = urlParams.get('bin');
    const dataParam = urlParams.get('d');

    if (syncParam || binParam || dataParam) {
      this.handleIncomingUrlParams(syncParam, dataParam, binParam);
    } else if (this.syncId && this.isAutoSyncEnabled()) {
      setTimeout(() => this.pull(false), 800);
    }

    // 2. Batarya Koruma Kontrolü
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
    return !!(this.syncId || this.lastBinId);
  },

  getSyncId() {
    return this.syncId || this.lastBinId;
  },

  // Ekranda gösterilecek kısa ve kolay yazılabilir eşitleme kodu (7 haneli binId öncelikli)
  getShortDisplayCode() {
    return this.lastBinId || this.syncId || '';
  },

  // Paylaşım URL'sini oluştur (Kısa, QR ve WhatsApp dostu)
  getShareUrl() {
    const sId = this.syncId;
    const bId = this.lastBinId;
    if (!sId && !bId) return '';

    const base = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    if (bId) params.set('bin', bId);
    if (sId) params.set('sync', sId);
    return `${base}?${params.toString()}`;
  },

  // Telefon eşleştirme için özel Master Link (Kısa URL -> Karekod ve WhatsApp'ta asla kesilmez!)
  getDevicePairingUrl(currentUser = null) {
    const user = currentUser || Storage.getCurrentUser();
    const base = window.location.origin + window.location.pathname;
    const sId = this.syncId;
    const bId = this.lastBinId;

    const invitePayload = {
      i: user ? user.id : 'usr_admin',
      u: user ? user.username : 'admin',
      p: user ? user.password : '123',
      n: user ? user.name : 'Yönetici',
      g: user ? user.gender : 'female',
      r: user ? (user.role || 'admin') : 'admin'
    };
    if (sId) invitePayload.s = sId;
    if (bId) invitePayload.b = bId;

    const encInvite = this.utf8ToBase64(JSON.stringify(invitePayload));

    let url = `${base}?invite=${encInvite}`;
    if (bId) {
      url += `&bin=${encodeURIComponent(bId)}`;
    }
    if (sId) {
      url += `&sync=${encodeURIComponent(sId)}`;
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
      let base64 = String(base64url || '').replace(/-/g, '+').replace(/_/g, '/');
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
      const curUser = data.activeUser || Storage.getCurrentUser();
      const minified = {
        e: (data.events || []).map(ev => ({
          i: ev.id,
          c: ev.categoryId,
          d: ev.date,
          t: ev.time,
          s: ev.status,
          dt: ev.details,
          n: ev.notes,
          ca: ev.createdAt,
          ua: ev.updatedAt
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
          r: u.role || 'user',
          av: u.avatar,
          ca: u.createdAt,
          ua: u.updatedAt || u.createdAt || new Date().toISOString()
        }));
      }

      if (curUser && curUser.username) {
        minified.au = {
          i: curUser.id,
          u: curUser.username,
          p: curUser.password,
          n: curUser.name,
          g: curUser.gender,
          r: curUser.role || 'user'
        };
      }

      const userEventsMap = data.userEvents || (typeof Storage.getAllUserEventsMap === 'function' ? Storage.getAllUserEventsMap() : null);
      if (userEventsMap && Object.keys(userEventsMap).length > 0) {
        minified.ue = userEventsMap;
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
        createdAt: ev.ca || new Date().toISOString(),
        updatedAt: ev.ua || ev.ca || new Date().toISOString(),
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
        avatar: u.av,
        createdAt: u.ca || u.ua || new Date().toISOString(),
        updatedAt: u.ua || u.ca || new Date().toISOString()
      }));
      const activeUser = parsed.au ? {
        id: parsed.au.i,
        username: parsed.au.u,
        password: parsed.au.p,
        name: parsed.au.n,
        gender: parsed.au.g,
        role: parsed.au.r || 'user'
      } : null;
      const userEvents = parsed.ue || null;

      return { events, categories, users, activeUser, userEvents };
    } catch (err) {
      console.error('decodePayload hatası:', err);
      return null;
    }
  },

  // =================== BULUTTAN GELEN VERİYİ CİHAZA UYGULA ===================
  applyRemoteData(remoteData, isInitialConnect = false) {
    if (!remoteData) return { eventsCount: 0, usersCount: 0, changed: false };

    let changed = false;

    // 1. Tüm kullanıcıları ve aboneleri birleştir (Uzaktaki şifre ve yeni aboneler öncelikli)
    if (Array.isArray(remoteData.users) && remoteData.users.length > 0) {
      const prevUsersStr = JSON.stringify(Storage.getUsers());
      const mergedUsers = Storage.mergeUsers(remoteData.users, true);
      if (JSON.stringify(mergedUsers) !== prevUsersStr) {
        changed = true;
      }
    }

    // 2. İlk bağlantıda veya telefonda oturum açık değilse bilgisayardaki aktif hesabı oturuma bağla
    if ((isInitialConnect || !Storage.isLoggedIn()) && remoteData.activeUser) {
      const matched = Storage.getUserByUsername(remoteData.activeUser.username) || Storage.getUserById(remoteData.activeUser.id);
      if (matched) {
        Storage.setCurrentUser(matched);
        changed = true;
      }
    }

    // 3. Kullanıcı bazlı takvim haritası varsa kaydet
    if (remoteData.userEvents && typeof Storage.saveAllUserEventsMap === 'function') {
      Storage.saveAllUserEventsMap(remoteData.userEvents, isInitialConnect);
      changed = true;
    }

    // 4. Kategorileri birleştir
    const localCats = Storage.getCategories(false);
    const mergedCats = this.mergeCategories(localCats, remoteData.categories || []);
    if (JSON.stringify(localCats) !== JSON.stringify(mergedCats)) {
      Storage.saveCategories(mergedCats, true);
      changed = true;
    }

    // 5. Takvim olaylarını uygula
    let finalEvents = Storage.getEvents();
    if (Array.isArray(remoteData.events)) {
      const localEvents = Storage.getEvents();
      if (isInitialConnect && remoteData.events.length > 0) {
        // İlk eşleşmede bilgisayardaki gerçek verileri esas al (telefondaki eski demo/hatalı kayıtları temizle)
        const nonDemoLocal = localEvents.filter(e => !e.id || !String(e.id).startsWith('demo_'));
        finalEvents = this.mergeEvents(nonDemoLocal, remoteData.events);
        // Eğer bilgisayarda demo olmayan gerçek veriler varsa ve telefondaki eski test kayıtları karışıyorsa doğrudan uzak veriyi de koru
        Storage.saveEvents(finalEvents, true);
        changed = true;
      } else {
        finalEvents = this.mergeEvents(localEvents, remoteData.events);
        if (JSON.stringify(localEvents) !== JSON.stringify(finalEvents)) {
          Storage.saveEvents(finalEvents, true);
          changed = true;
        }
      }
    }

    // 6. Oda ve Bin ID'lerini güncelle
    if (remoteData.roomId && remoteData.roomId.length >= 15) {
      this.syncId = remoteData.roomId;
      localStorage.setItem(this.STORAGE_KEY_SYNC_ID, remoteData.roomId);
    }
    if (remoteData.binId) {
      this.lastBinId = remoteData.binId;
      localStorage.setItem(this.STORAGE_KEY_BIN_ID, remoteData.binId);
    }

    localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());

    // 7. Tüm ekranları ve Admin panelini yenile
    if (window.App) {
      if (typeof window.App.applyProfileGenderUI === 'function') {
        window.App.applyProfileGenderUI();
      }
      if (typeof window.App.refreshAllViews === 'function') {
        window.App.refreshAllViews();
      }
      if (typeof window.App.renderAdminUsersList === 'function') {
        window.App.renderAdminUsersList();
      }
      if (Storage.isLoggedIn() && typeof window.App.closeLoginModal === 'function') {
        window.App.closeLoginModal();
      }
    }

    this.updateUI();

    return {
      eventsCount: finalEvents.length,
      usersCount: Storage.getUsers().length,
      changed
    };
  },

  // =================== GELEN URL PARAMETRELERİNİ İŞLE (TELEFONDA) ===================
  async handleIncomingUrlParams(syncIdParam, dataParam, binParam = null) {
    this.isSyncing = true;
    this.setSyncStatusBadge('loading', 'Bilgisayar verileri aktarılıyor...');

    let applied = false;
    let stats = { eventsCount: 0, usersCount: 0 };

    try {
      // 1. Doğrudan veri parametresi varsa çöz
      if (dataParam) {
        const decoded = this.decodePayload(dataParam);
        if (decoded) {
          stats = this.applyRemoteData(decoded, true);
          applied = true;
        }
      }

      // 2. Bin veya Sync ID parametresi varsa buluttan eksiksiz paketi çek
      if (binParam || syncIdParam) {
        const cleanSync = syncIdParam ? syncIdParam.trim() : null;
        const cleanBin = binParam ? binParam.trim() : null;

        if (cleanSync) {
          this.syncId = cleanSync;
          localStorage.setItem(this.STORAGE_KEY_SYNC_ID, cleanSync);
        }
        if (cleanBin) {
          this.lastBinId = cleanBin;
          localStorage.setItem(this.STORAGE_KEY_BIN_ID, cleanBin);
        }

        const remoteData = await this.fetchRemoteData(cleanSync || cleanBin, cleanBin);
        if (remoteData) {
          stats = this.applyRemoteData(remoteData, true);
          applied = true;
        }
      }

      // URL'deki parametreleri temizle
      try {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (e) {}

      this.updateUI();

      if (applied && typeof showToast === 'function') {
        showToast(`☁️ Eşitleme başarılı! ${stats.eventsCount} kayıt ve ${stats.usersCount} abone hesabınız aktarıldı.`, 'success');
      } else if (!applied && typeof showToast === 'function') {
        showToast('⚠️ Bulut verisine ulaşılamadı. Lütfen bilgisayardan yeni karekod/kod üretip tekrar deneyin.', 'error');
      }
    } catch (err) {
      console.error('handleIncomingUrlParams hatası:', err);
    } finally {
      this.isSyncing = false;
      this.updateUI();
    }
  },

  // =================== EXTENDSCLASS ÜZERİNE PAKET YÜKLE (SINIRSIZ BOYUT, CORS PREFLIGHT YOK) ===================
  async uploadSnapshotToBin(events, categories, users, roomId = null) {
    const payloadStr = this.encodePayload({
      events: events || Storage.getEvents(),
      categories: categories || Storage.getCategories(false),
      users: users || Storage.getUsers(),
      activeUser: Storage.getCurrentUser(),
      userEvents: typeof Storage.getAllUserEventsMap === 'function' ? Storage.getAllUserEventsMap() : null
    });

    const bodyStr = JSON.stringify({
      roomId: roomId || this.syncId || null,
      ts: Date.now(),
      version: '2.0',
      payload: payloadStr
    });

    try {
      // text/plain kullanarak tarayıcıda OPTIONS preflight hatasını %100 önleriz
      const res = await fetch('https://extendsclass.com/api/json-storage/bin', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: bodyStr
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          this.lastBinId = data.id;
          localStorage.setItem(this.STORAGE_KEY_BIN_ID, data.id);
          return data.id;
        }
      }
    } catch (e) {
      console.warn('ExtendsClass bin yükleme hatası:', e);
    }
    return null;
  },

  // =================== BULUT ODASI OLUŞTURMA / GÜNCELLEME ===================
  async startNewSync() {
    this.isSyncing = true;
    this.setSyncStatusBadge('loading', 'Bulut odası hazırlanıyor...');

    try {
      const events = Storage.getEvents();
      const categories = Storage.getCategories(false);
      const users = Storage.getUsers();

      // 1. Tüm veriyi ExtendsClass bin'e yükle (7 haneli kısa kod alır)
      let binId = await this.uploadSnapshotToBin(events, categories, users, this.syncId);

      // 2. Restful-API üzerinde kalıcı oda işaretçisi (pointer) oluştur (~60 byte)
      let roomId = null;
      if (binId) {
        try {
          const res = await fetch('https://api.restful-api.dev/objects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'ST_SyncRoom',
              data: {
                bin: binId,
                ts: Date.now()
              }
            })
          });
          if (res.ok) {
            const roomData = await res.json();
            if (roomData && roomData.id) {
              roomId = roomData.id;
              // Bin içerisine roomId'yi de kaydet ki 7 haneli kodu giren telefon kalıcı odayı da bilsin
              const updatedBin = await this.uploadSnapshotToBin(events, categories, users, roomId);
              if (updatedBin) {
                binId = updatedBin;
                await fetch(`https://api.restful-api.dev/objects/${roomId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: 'ST_SyncRoom',
                    data: {
                      bin: binId,
                      ts: Date.now()
                    }
                  })
                });
              }
            }
          }
        } catch (e) {
          console.warn('Pointer oda oluşturma uyarısı:', e);
        }
      }

      const finalSyncId = roomId || binId;
      if (!finalSyncId) {
        throw new Error('Bulut sunucusuna bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.');
      }

      this.syncId = finalSyncId;
      this.lastBinId = binId || finalSyncId;
      this.provider = 'hybrid-ext';

      localStorage.setItem(this.STORAGE_KEY_SYNC_ID, this.syncId);
      localStorage.setItem(this.STORAGE_KEY_BIN_ID, this.lastBinId);
      localStorage.setItem(this.STORAGE_KEY_PROVIDER, 'hybrid-ext');
      localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());

      this.updateUI();
      this.setSyncStatusBadge('connected', 'Eşitle');

      if (typeof showToast === 'function') {
        showToast(`☁️ Bulut eşitleme hazır! Kısa Kod: ${this.getShortDisplayCode()}`, 'success');
      }
      return true;
    } catch (err) {
      console.error('startNewSync hatası:', err);
      this.setSyncStatusBadge('error', 'Hata');
      if (typeof showToast === 'function') {
        showToast('Bulut odası oluşturulamadı: ' + err.message, 'error');
      }
      return false;
    } finally {
      this.isSyncing = false;
    }
  },

  // =================== MEVCUT KOD VEYA LİNK İLE BAĞLANMA (TELEFONDA) ===================
  async connectWithCode(codeOrUrl) {
    let cleanCode = (codeOrUrl || '').trim();
    if (!cleanCode) {
      alert('Lütfen geçerli bir eşitleme kodu veya link girin.');
      return false;
    }

    this.isSyncing = true;
    this.setSyncStatusBadge('loading', 'Bulut verileri çekiliyor...');

    try {
      let sParam = null;
      let bParam = null;
      let dParam = null;
      let inviteParam = null;

      // 1. Eğer bir URL veya parametre dizisi yapıştırılmışsa
      if (cleanCode.includes('http://') || cleanCode.includes('https://') || cleanCode.includes('?') || cleanCode.includes('invite=') || cleanCode.includes('bin=') || cleanCode.includes('sync=')) {
        const urlObj = new URL(cleanCode.startsWith('http') ? cleanCode : 'https://dummy.com/?' + cleanCode.replace(/^\?/, ''));
        sParam = urlObj.searchParams.get('sync');
        bParam = urlObj.searchParams.get('bin');
        dParam = urlObj.searchParams.get('d');
        inviteParam = urlObj.searchParams.get('invite');

        if (inviteParam) {
          Storage.importInvitePayload(inviteParam);
        }

        if (sParam || bParam || dParam) {
          this.isSyncing = false;
          await this.handleIncomingUrlParams(sParam, dParam, bParam);
          return true;
        }
      }

      if (cleanCode.includes('/')) {
        const parts = cleanCode.split('/').filter(Boolean);
        cleanCode = parts[parts.length - 1];
      }

      // 2. Buluttan veriyi çek (Hem 7 haneli binId hem 32 haneli roomId desteklenir)
      const remoteData = await this.fetchRemoteData(cleanCode, cleanCode);
      if (remoteData && (Array.isArray(remoteData.events) || Array.isArray(remoteData.users))) {
        const stats = this.applyRemoteData(remoteData, true);

        const effectiveSyncId = remoteData.roomId || cleanCode;
        this.syncId = effectiveSyncId;
        localStorage.setItem(this.STORAGE_KEY_SYNC_ID, effectiveSyncId);
        if (remoteData.binId) {
          this.lastBinId = remoteData.binId;
          localStorage.setItem(this.STORAGE_KEY_BIN_ID, remoteData.binId);
        }

        this.updateUI();
        if (typeof showToast === 'function') {
          showToast(`☁️ Başarıyla bağlandı! ${stats.eventsCount} takvim kaydı ve ${stats.usersCount} abone eşitlendi.`, 'success');
        }
        return true;
      } else {
        throw new Error('Belirtilen kodla eşleşen bulut kaydı bulunamadı. Lütfen bilgisayardan "📱 Telefonu Bağla" ekranını açıp güncel kodu girin.');
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
    if (!this.hasActiveSync()) {
      if (isManual) {
        return await this.startNewSync();
      }
      return false;
    }
    if (this.isSyncing) return false;

    this.isSyncing = true;
    this.setSyncStatusBadge('loading', 'Eşitleniyor...');

    try {
      // 1. Buluttan en son veriyi çek ve yerel ile birleştir
      const remoteData = await this.fetchRemoteData(this.syncId, this.lastBinId);
      if (remoteData) {
        this.applyRemoteData(remoteData, false);
      }

      // 2. Birleştirilmiş güncel verileri buluta geri yükle
      await this.pushDirect(Storage.getEvents(), Storage.getCategories(false), Storage.getUsers());

      // 3. Görünümleri yenile
      if (window.App && typeof window.App.refreshAllViews === 'function') {
        window.App.refreshAllViews();
      }
      if (window.App && typeof window.App.renderAdminUsersList === 'function') {
        window.App.renderAdminUsersList();
      }

      localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());
      this.setSyncStatusBadge('connected', 'Eşitle');
      this.updateLastSyncText();
      this.updateUI();

      if (isManual && typeof showToast === 'function') {
        const evCount = Storage.getEvents().length;
        const usrCount = Storage.getUsers().length;
        showToast(`☁️ Eşitleme tamamlandı! (${evCount} kayıt, ${usrCount} hesap senkronize edildi)`, 'success');
      }
      return true;
    } catch (err) {
      console.error('syncNow hatası:', err);
      this.setSyncStatusBadge('connected', 'Eşitle');
      if (isManual && typeof showToast === 'function') {
        showToast('Eşitleme sırasında bağlantı hatası oluştu.', 'error');
      }
      return false;
    } finally {
      this.isSyncing = false;
      this.setSyncStatusBadge(this.hasActiveSync() ? 'connected' : 'disconnected', this.hasActiveSync() ? 'Eşitle' : 'Yerel');
    }
  },

  // =================== BULUTTAN VERİ ÇEKME (PULL) ===================
  async pull(isManual = false) {
    if (!this.hasActiveSync() || this.isSyncing) return;
    this.isSyncing = true;
    this.setSyncStatusBadge('loading', 'Eşitleniyor...');

    try {
      const remoteData = await this.fetchRemoteData(this.syncId, this.lastBinId);
      if (!remoteData) {
        this.setSyncStatusBadge('connected', 'Eşitle');
        if (isManual && typeof showToast === 'function') {
          showToast('Bulut kontrol edildi, mevcut kayıtlarınız korundu.', 'info');
        }
        return;
      }

      const stats = this.applyRemoteData(remoteData, false);

      if (stats.changed) {
        if (isManual && typeof showToast === 'function') {
          showToast(`☁️ Veriler buluttan güncellendi! (${stats.eventsCount} kayıt, ${stats.usersCount} hesap)`, 'success');
        }
      } else if (isManual && typeof showToast === 'function') {
        showToast('☁️ Tüm kayıtlarınız ve abone listesi zaten güncel.', 'info');
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
    if (!this.hasActiveSync()) return;
    if (this.pushTimeout) clearTimeout(this.pushTimeout);
    this.pushTimeout = setTimeout(() => {
      this.push(false);
    }, 1200);
  },

  async push(isManual = false) {
    if (!this.hasActiveSync() || this.isSyncing) return;
    this.isSyncing = true;
    this.setSyncStatusBadge('loading', 'Buluta yükleniyor...');

    try {
      const events = Storage.getEvents();
      const categories = Storage.getCategories(false);
      const users = Storage.getUsers();
      const ok = await this.pushDirect(events, categories, users);
      localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());
      this.setSyncStatusBadge('connected', 'Eşitle');
      this.updateLastSyncText();
      this.updateUI();
      if (isManual && ok && typeof showToast === 'function') {
        showToast(`☁️ Cihazınızdaki ${events.length} kayıt ve ${users.length} hesap buluta yüklendi!`, 'success');
      }
    } catch (err) {
      console.warn('Cloud push hatası:', err);
      this.setSyncStatusBadge('connected', 'Eşitle');
    } finally {
      this.isSyncing = false;
    }
  },

  async pushDirect(events, categories, users = null) {
    const allUsers = users || Storage.getUsers();
    const allEvents = events || Storage.getEvents();
    const allCats = categories || Storage.getCategories(false);

    // 1. Yeni anlık görüntüyü ExtendsClass'a yükle (Simple POST - boyut sınırı yok)
    const newBinId = await this.uploadSnapshotToBin(allEvents, allCats, allUsers, this.syncId);
    if (!newBinId) return false;

    // 2. Eğer syncId 20+ karakterli bir Restful-API pointer odası ise işaretçiyi güncelle
    if (this.syncId && this.syncId.length >= 20 && !this.syncId.startsWith('direct_') && !this.syncId.startsWith('st_')) {
      try {
        const res = await fetch(`https://api.restful-api.dev/objects/${this.syncId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'ST_SyncRoom',
            data: {
              bin: newBinId,
              ts: Date.now()
            }
          })
        });
        if (res.ok) return true;
      } catch (e) {
        console.warn('Pointer PUT uyarısı:', e);
      }
    }

    // 3. Eğer henüz geçerli bir pointer oda ID'si yoksa oluştur
    try {
      const res = await fetch('https://api.restful-api.dev/objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'ST_SyncRoom',
          data: {
            bin: newBinId,
            ts: Date.now()
          }
        })
      });
      if (res.ok) {
        const roomData = await res.json();
        if (roomData && roomData.id) {
          this.syncId = roomData.id;
          localStorage.setItem(this.STORAGE_KEY_SYNC_ID, roomData.id);
        }
      }
    } catch (e) {}

    if (!this.syncId) {
      this.syncId = newBinId;
      localStorage.setItem(this.STORAGE_KEY_SYNC_ID, newBinId);
    }

    return true;
  },

  // =================== VERİ OKUMA / ÇEKME ===================
  async fetchFromBinId(binId) {
    if (!binId) return null;
    const cleanBin = String(binId).trim();
    if (!cleanBin || cleanBin.startsWith('direct_') || cleanBin.startsWith('st_')) return null;

    try {
      const res = await fetch(`https://extendsclass.com/api/json-storage/bin/${cleanBin}?t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.payload) {
          const decoded = this.decodePayload(json.payload);
          if (decoded) {
            decoded.binId = cleanBin;
            if (json.roomId) decoded.roomId = json.roomId;
            return decoded;
          }
        }
      }
    } catch (e) {
      console.warn('ExtendsClass bin okuma hatası:', e);
    }
    return null;
  },

  async fetchRemoteData(syncId, binHint = null) {
    const cleanId = syncId ? String(syncId).trim() : '';
    const cleanBinHint = binHint ? String(binHint).trim() : '';

    // 1. Eğer syncId bir Restful-API Pointer Odası ise (20+ karakter) en güncel binId'yi oradan öğren
    if (cleanId && cleanId.length >= 20 && !cleanId.startsWith('direct_') && !cleanId.startsWith('st_')) {
      try {
        const res = await fetch(`https://api.restful-api.dev/objects/${cleanId}?t=${Date.now()}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.data) {
            // İşaretçideki güncel binId'yi çek
            if (json.data.bin) {
              const binData = await this.fetchFromBinId(json.data.bin);
              if (binData) {
                binData.roomId = cleanId;
                return binData;
              }
            }
            // Eski format (doğrudan payload) varsa çöz
            if (json.data.payload) {
              const decoded = this.decodePayload(json.data.payload);
              if (decoded) {
                decoded.roomId = cleanId;
                return decoded;
              }
            }
          }
        }
      } catch (e) {
        console.warn('Pointer oda okuma uyarısı:', e);
      }
    }

    // 2. Eğer kısa kod (ExtendsClass binId, örn 7 haneli) girildiyse veya binHint varsa doğrudan oku
    const targetBin = (cleanId && cleanId.length < 20) ? cleanId : cleanBinHint;
    if (targetBin) {
      const binData = await this.fetchFromBinId(targetBin);
      if (binData) {
        // Eğer bin içinde bir roomId kayıtlıysa, o odada daha yeni bir bin var mı diye de kontrol et!
        if (binData.roomId && binData.roomId.length >= 20 && binData.roomId !== cleanId) {
          try {
            const roomRes = await fetch(`https://api.restful-api.dev/objects/${binData.roomId}?t=${Date.now()}`);
            if (roomRes.ok) {
              const roomJson = await roomRes.json();
              const latestBin = roomJson?.data?.bin;
              if (latestBin && latestBin !== targetBin) {
                const newerData = await this.fetchFromBinId(latestBin);
                if (newerData) {
                  newerData.roomId = binData.roomId;
                  return newerData;
                }
              }
            }
          } catch (e) {}
        }
        return binData;
      }
    }

    return null;
  },

  // =================== VERİ BİRLEŞTİRME (MERGE) ===================
  mergeEvents(localEvents = [], remoteEvents = []) {
    const remoteHasReal = remoteEvents.some(e => e && e.id && !String(e.id).startsWith('demo_'));
    const filteredLocal = remoteHasReal
      ? localEvents.filter(e => e && e.id && !String(e.id).startsWith('demo_'))
      : localEvents;

    const map = new Map();
    filteredLocal.forEach(e => {
      if (e && e.id) map.set(e.id, e);
    });

    remoteEvents.forEach(remote => {
      if (!remote || !remote.id) return;
      if (remoteHasReal && String(remote.id).startsWith('demo_')) return;

      if (!map.has(remote.id)) {
        map.set(remote.id, remote);
      } else {
        const local = map.get(remote.id);
        const remoteTime = remote.updatedAt || remote.createdAt || '';
        const localTime = local.updatedAt || local.createdAt || '';
        if (remoteTime >= localTime) {
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
    this.lastBinId = null;
    this.stopAutoSyncInterval();
    localStorage.removeItem(this.STORAGE_KEY_SYNC_ID);
    localStorage.removeItem(this.STORAGE_KEY_BIN_ID);
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

    if (this.hasActiveSync()) {
      if (unlinkedCard) unlinkedCard.style.display = 'none';
      if (linkedCard) linkedCard.style.display = 'block';

      const shortCode = this.getShortDisplayCode();
      if (codeDisplay) codeDisplay.textContent = shortCode;

      const shareUrl = this.getDevicePairingUrl();
      if (shareInput) shareInput.value = shareUrl;

      if (qrImage && shareUrl) {
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
    const shareUrl = this.getDevicePairingUrl();
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
