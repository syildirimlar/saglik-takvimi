/**
 * Sağlık & Yaşam Takvim Programı - Depolama Katmanı (Storage)
 * LocalStorage yönetimi, veri yapısı, yedekleme ve demo veriler.
 */

const STORAGE_KEYS = {
  EVENTS: 'saglik_takvim_events_v1',
  PREV_EVENTS: 'saglik_takvim_prev_events_backup',
  CATEGORIES: 'saglik_takvim_categories_v1',
  THEME: 'saglik_takvim_theme_v1',
  PROFILE: 'saglik_takvim_profile_v2',
  PROFILES_LIST: 'saglik_takvim_profiles_list_v2',
  ACTIVE_PROFILE_ID: 'saglik_takvim_active_profile_id_v2',
  USERS_LIST: 'saglik_users_list_v3',
  CURRENT_USER: 'saglik_current_user_v3'
};

const DEFAULT_ADMIN = {
  id: 'usr_admin',
  username: 'admin',
  password: '123',
  name: 'Yönetici (Admin)',
  gender: 'female',
  role: 'admin',
  avatar: '👑',
  createdAt: '2026-01-01T00:00:00.000Z'
};

// Varsayılan Temel Kategoriler
const DEFAULT_CATEGORIES = [
  {
    id: 'wc',
    name: 'Tuvalet (WC)',
    icon: '🚽',
    color: '#0284c7',
    isSystem: true,
    hasIntensity: false,
    hasQuantity: false,
    description: 'Küçük ve büyük tuvalet sıklığı ve durum takibi'
  },
  {
    id: 'headache',
    name: 'Baş Ağrısı',
    icon: '🤕',
    color: '#ef4444',
    isSystem: true,
    hasIntensity: true,
    hasQuantity: false,
    description: 'Ağrı şiddeti (1-10), bölge, tetikleyici ve ilaç takibi'
  },
  {
    id: 'sport',
    name: 'Spor & Egzersiz',
    icon: '🏃',
    color: '#10b981',
    isSystem: true,
    hasIntensity: true,
    hasQuantity: true,
    unit: 'dk',
    description: 'Yürüyüş, koşu, fitness, yoga ve fiziksel aktiviteler'
  },
  {
    id: 'massage',
    name: 'Masaj',
    icon: '💆',
    color: '#ec4899',
    isSystem: true,
    hasIntensity: true,
    hasQuantity: true,
    unit: 'dk',
    description: 'Boyun, sırt, baş veya tüm vücut masaj seansları'
  },
  {
    id: 'period',
    name: 'Adet / Döngü',
    icon: '🩸',
    color: '#e11d48',
    isSystem: true,
    genderSpecific: 'female',
    hasIntensity: true,
    hasQuantity: false,
    description: 'Adet döngüsü, kanama yoğunluğu, kramp ve semptom takibi'
  },
  {
    id: 'water',
    name: 'Su Tüketimi',
    icon: '💧',
    color: '#06b6d4',
    isSystem: false,
    hasIntensity: false,
    hasQuantity: true,
    unit: 'bardak',
    description: 'Günlük içilen su miktarı'
  },
  {
    id: 'medication',
    name: 'İlaç & Takviye',
    icon: '💊',
    color: '#8b5cf6',
    isSystem: false,
    hasIntensity: false,
    hasQuantity: false,
    description: 'Alınan ilaçlar ve vitaminler'
  },
  {
    id: 'sleep',
    name: 'Uyku & Dinlenme',
    icon: '😴',
    color: '#6366f1',
    isSystem: false,
    hasIntensity: true,
    hasQuantity: true,
    unit: 'saat',
    description: 'Uyku süresi ve yorgunluk/kalite seviyesi'
  },
  {
    id: 'coffee',
    name: 'Kahve / Kafein',
    icon: '☕',
    color: '#b45309',
    isSystem: false,
    hasIntensity: false,
    hasQuantity: true,
    unit: 'fincan',
    description: 'Tüketilen kahve miktarı'
  },
  {
    id: 'mood',
    name: 'Ruh Hali & Enerji',
    icon: '⚡',
    color: '#f59e0b',
    isSystem: false,
    hasIntensity: true,
    hasQuantity: false,
    description: 'Günlük stres veya enerji düzeyi'
  }
];

const Storage = {
  // ================= KULLANICI & HESAP YÖNETİMİ (AUTH & USERS) =================
  getUsers() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS_LIST);
      if (data) {
        const list = JSON.parse(data);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch (e) {}

    // Mevcut bir profil varsa ismini admin hesabına aktar
    let adminName = 'Yönetici';
    let adminGender = 'female';
    try {
      const oldProf = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (oldProf) {
        const p = JSON.parse(oldProf);
        if (p.name) adminName = p.name;
        if (p.gender) adminGender = p.gender;
      }
    } catch (e) {}

    const initialAdmin = {
      ...DEFAULT_ADMIN,
      name: adminName,
      gender: adminGender
    };

    const initialList = [initialAdmin];
    localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(initialList));
    return initialList;
  },

  saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(users));
    if (window.CloudSync && typeof window.CloudSync.triggerPush === 'function') {
      window.CloudSync.triggerPush();
    }
  },

  getUserByUsername(username) {
    if (!username) return null;
    const clean = String(username).toLowerCase().trim();
    return this.getUsers().find(u => u.username.toLowerCase().trim() === clean) || null;
  },

  getUserById(id) {
    if (!id) return null;
    return this.getUsers().find(u => u.id === id) || null;
  },

  // Sadece Admin çağırabilir
  createUser({ username, password, name, gender, role = 'user' }) {
    const cleanUser = String(username || '').toLowerCase().trim();
    if (!cleanUser || cleanUser.length < 2) {
      throw new Error('Kullanıcı adı en az 2 karakter olmalıdır.');
    }
    const cleanPass = String(password || '').trim();
    if (!cleanPass || cleanPass.length < 3) {
      throw new Error('Şifre en az 3 karakter olmalıdır.');
    }
    const existing = this.getUserByUsername(cleanUser);
    if (existing) {
      throw new Error(`"${cleanUser}" kullanıcı adı zaten kullanımda. Lütfen başka bir kullanıcı adı seçin.`);
    }

    const newId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const avatar = gender === 'female' ? '👩' : (gender === 'male' ? '👨' : '👤');

    const newUser = {
      id: newId,
      username: cleanUser,
      password: cleanPass,
      name: (name && name.trim()) ? name.trim() : cleanUser,
      gender: gender || 'female',
      role: role,
      avatar: avatar,
      createdAt: new Date().toISOString()
    };

    const users = this.getUsers();
    users.push(newUser);
    this.saveUsers(users);
    return newUser;
  },

  updateUser(userId, updates) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return null;

    if (updates.name !== undefined) users[idx].name = String(updates.name).trim();
    if (updates.gender !== undefined) {
      users[idx].gender = updates.gender;
      if (users[idx].role !== 'admin') {
        users[idx].avatar = updates.gender === 'female' ? '👩' : (updates.gender === 'male' ? '👨' : '👤');
      }
    }
    if (updates.password !== undefined && String(updates.password).trim()) {
      users[idx].password = String(updates.password).trim();
    }
    if (updates.avatar !== undefined) users[idx].avatar = updates.avatar;
    if (updates.lastLogin !== undefined) users[idx].lastLogin = updates.lastLogin;
    users[idx].updatedAt = new Date().toISOString();

    this.saveUsers(users);

    const cur = this.getCurrentUser();
    if (cur && cur.id === userId) {
      this.setCurrentUser(users[idx]);
    }

    return users[idx];
  },

  deleteUser(userId) {
    const user = this.getUserById(userId);
    if (!user) return false;
    if (user.role === 'admin' || user.username === 'admin') {
      throw new Error('Yönetici (Admin) hesabı silinemez.');
    }

    let users = this.getUsers();
    users = users.filter(u => u.id !== userId);
    this.saveUsers(users);

    localStorage.removeItem(`${STORAGE_KEYS.EVENTS}_${userId}`);

    const cur = this.getCurrentUser();
    if (cur && cur.id === userId) {
      this.logout();
    }
    return true;
  },

  authenticate(username, password) {
    if (!username || !password) return null;
    const user = this.getUserByUsername(username);
    if (!user) return null;
    if (String(user.password).trim() !== String(password).trim()) return null;

    user.lastLogin = new Date().toISOString();
    this.updateUser(user.id, { lastLogin: user.lastLogin });
    this.setCurrentUser(user);
    return user;
  },

  getCurrentUser() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && parsed.id) {
          const fresh = this.getUserById(parsed.id);
          if (fresh) return fresh;
        }
      }
    } catch (e) {}
    return null;
  },

  setCurrentUser(user) {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(STORAGE_KEYS.PROFILE);
    } else {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(user));
    }
  },

  logout() {
    this.setCurrentUser(null);
  },

  isLoggedIn() {
    return !!this.getCurrentUser();
  },

  isAdmin() {
    const cur = this.getCurrentUser();
    return !!(cur && cur.role === 'admin');
  },

  // Tek tıkla davet linki oluştur
  generateInviteUrl(user) {
    try {
      const base = window.location.origin + window.location.pathname;
      const payload = {
        u: user.username,
        p: user.password,
        n: user.name,
        g: user.gender,
        r: user.role || 'user'
      };
      const json = JSON.stringify(payload);
      let encoded = '';
      if (window.CloudSync && typeof window.CloudSync.utf8ToBase64 === 'function') {
        encoded = window.CloudSync.utf8ToBase64(json);
      } else {
        encoded = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }
      return `${base}?invite=${encoded}`;
    } catch (e) {
      console.error('generateInviteUrl hatası:', e);
      return '';
    }
  },

  // Davet linkinden otomatik kayıt ve giriş
  importInvitePayload(payloadStr) {
    try {
      let json = '';
      if (window.CloudSync && typeof window.CloudSync.base64ToUtf8 === 'function') {
        json = window.CloudSync.base64ToUtf8(payloadStr);
      }
      if (!json) {
        let b64 = payloadStr.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        json = decodeURIComponent(escape(atob(b64)));
      }
      if (!json) return null;
      const data = JSON.parse(json);
      if (!data.u) return null;

      let user = this.getUserByUsername(data.u);
      if (!user) {
        user = this.createUser({
          username: data.u,
          password: data.p || '123',
          name: data.n || data.u,
          gender: data.g || 'female',
          role: data.r || 'user'
        });
      } else {
        user = this.updateUser(user.id, {
          password: data.p || user.password,
          name: data.n || user.name,
          gender: data.g || user.gender
        });
      }

      this.setCurrentUser(user);
      return user;
    } catch (e) {
      console.error('importInvitePayload hatası:', e);
      return null;
    }
  },

  // Geriye dönük uyumluluk köprüleri
  getActiveProfileId() {
    const cur = this.getCurrentUser();
    return cur ? cur.id : 'default';
  },

  setActiveProfileId(id) {
    const user = this.getUserById(id);
    if (user) this.setCurrentUser(user);
  },

  getUserProfile() {
    return this.getCurrentUser();
  },

  getAllProfiles() {
    return this.getUsers();
  },

  saveUserProfile(profileData) {
    const cur = this.getCurrentUser();
    if (!cur) return null;
    return this.updateUser(cur.id, profileData);
  },

  getUserGender() {
    const cur = this.getCurrentUser();
    return cur ? (cur.gender || 'unspecified') : 'unspecified';
  },

  getEventsStorageKey() {
    const cur = this.getCurrentUser();
    if (!cur) return STORAGE_KEYS.EVENTS;
    if (cur.role === 'admin' || cur.id === 'usr_admin') {
      return STORAGE_KEYS.EVENTS;
    }
    return `${STORAGE_KEYS.EVENTS}_${cur.id}`;
  },

  // Kategorileri getir
  getCategories(filterByGender = true) {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      let parsed;
      if (!data) {
        this.saveCategories(DEFAULT_CATEGORIES);
        parsed = [...DEFAULT_CATEGORIES];
      } else {
        parsed = JSON.parse(data);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          this.saveCategories(DEFAULT_CATEGORIES);
          parsed = [...DEFAULT_CATEGORIES];
        } else {
          // Otomatik senkronizasyon: Eksik varsayılan kategorileri ekle
          const existingIds = new Set(parsed.map(c => c.id));
          let updated = false;
          DEFAULT_CATEGORIES.forEach(dc => {
            if (!existingIds.has(dc.id)) {
              parsed.push(dc);
              updated = true;
            }
          });
          if (updated) {
            this.saveCategories(parsed);
          }
        }
      }

      // Cinsiyete göre filtrele (Erkek seçildiyse 'female' kategorileri gizle)
      if (filterByGender) {
        const gender = this.getUserGender();
        if (gender === 'male') {
          return parsed.filter(c => c.genderSpecific !== 'female');
        }
      }

      return parsed;
    } catch (e) {
      console.error('Kategoriler okunamadı:', e);
      return DEFAULT_CATEGORIES;
    }
  },

  // Kategorileri kaydet
  saveCategories(categories, skipSync = false) {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    if (!skipSync && window.CloudSync && typeof window.CloudSync.triggerPush === 'function') {
      window.CloudSync.triggerPush();
    }
  },

  // Tek kategori ekle
  addCategory(category) {
    const list = this.getCategories(false);
    // Benzersiz ID
    if (!category.id) {
      category.id = 'cat_' + Date.now();
    }
    list.push(category);
    this.saveCategories(list);
    return category;
  },

  // Kategori sil (Sistem kategorileri hariç)
  deleteCategory(catId) {
    let list = this.getCategories(false);
    list = list.filter(c => c.id !== catId || c.isSystem);
    this.saveCategories(list);
  },

  // ID'ye göre kategori bul (Cinsiyet filtresi olmaksızın arar)
  getCategoryById(id) {
    const list = this.getCategories(false);
    return list.find(c => c.id === id) || {
      id: id,
      name: 'Diğer',
      icon: '📌',
      color: '#64748b'
    };
  },

  // Tüm olayları getir (tarihe göre sıralı)
  getEvents() {
    try {
      const storageKey = this.getEventsStorageKey();
      const data = localStorage.getItem(storageKey);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      
      // Tarih ve saate göre en yeniden eskiye sırala
      return parsed.sort((a, b) => {
        const dtA = `${a.date}T${a.time || '00:00'}`;
        const dtB = `${b.date}T${b.time || '00:00'}`;
        return dtB.localeCompare(dtA);
      });
    } catch (e) {
      console.error('Olaylar okunamadı:', e);
      return [];
    }
  },

  // Olayları kaydet
  saveEvents(events, skipSync = false) {
    const storageKey = this.getEventsStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(events));
    if (!skipSync && window.CloudSync && typeof window.CloudSync.triggerPush === 'function') {
      window.CloudSync.triggerPush();
    }
  },

  // Yeni olay ekle
  addEvent(eventData) {
    const events = this.getEvents();
    const newEvent = {
      id: eventData.id || 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      categoryId: eventData.categoryId,
      date: eventData.date, // YYYY-MM-DD
      time: eventData.time || '12:00', // HH:mm
      status: eventData.status || 'completed', // 'completed' | 'planned' | 'skipped'
      reminderSent: eventData.reminderSent || false,
      checkinPrompted: eventData.checkinPrompted || false,
      details: eventData.details || {},
      notes: eventData.notes || '',
      createdAt: new Date().toISOString()
    };
    events.push(newEvent);
    this.saveEvents(events);
    return newEvent;
  },

  // Randevu durumunu güncelle (Yapıldı / Yapılmadı)
  setEventStatus(eventId, newStatus, extraDetails = {}) {
    const events = this.getEvents();
    const event = events.find(e => e.id === eventId);
    if (event) {
      event.status = newStatus;
      if (extraDetails && Object.keys(extraDetails).length > 0) {
        event.details = { ...event.details, ...extraDetails };
      }
      event.updatedAt = new Date().toISOString();
      this.saveEvents(events);
      return event;
    }
    return null;
  },

  // Olay güncelle
  updateEvent(updatedEvent) {
    const events = this.getEvents();
    const index = events.findIndex(e => e.id === updatedEvent.id);
    if (index !== -1) {
      events[index] = { ...events[index], ...updatedEvent, updatedAt: new Date().toISOString() };
      this.saveEvents(events);
      return events[index];
    }
    return null;
  },

  // Olay sil
  deleteEvent(id) {
    let events = this.getEvents();
    events = events.filter(e => e.id !== id);
    this.saveEvents(events);
  },

  // Belirli bir tarihteki olayları getir (YYYY-MM-DD)
  getEventsByDate(dateStr) {
    const events = this.getEvents();
    return events
      .filter(e => e.date === dateStr)
      .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
  },

  // Belirli bir aydaki olayları getir (YYYY-MM)
  getEventsByMonth(yearMonthStr) {
    const events = this.getEvents();
    return events.filter(e => e.date.startsWith(yearMonthStr));
  },

  // Tarih aralığındaki olayları getir
  getEventsByRange(startDateStr, endDateStr, categoryId = 'all') {
    const events = this.getEvents();
    return events.filter(e => {
      const matchDate = e.date >= startDateStr && e.date <= endDateStr;
      const matchCat = categoryId === 'all' || e.categoryId === categoryId;
      return matchDate && matchCat;
    });
  },

  // JSON Dışa Aktarma
  exportJSON() {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      categories: this.getCategories(),
      events: this.getEvents()
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saglik_takvim_yedek_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // JSON İçe Aktarma
  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.events || !Array.isArray(parsed.events)) {
        throw new Error('Geçersiz yedek dosyası: Olay verileri bulunamadı.');
      }
      if (parsed.categories && Array.isArray(parsed.categories)) {
        this.saveCategories(parsed.categories);
      }
      this.saveEvents(parsed.events);
      return { success: true, count: parsed.events.length };
    } catch (e) {
      console.error('Yedek yükleme hatası:', e);
      return { success: false, error: e.message };
    }
  },

  // Tüm verileri temizle
  clearAllData() {
    localStorage.removeItem(STORAGE_KEYS.EVENTS);
    localStorage.removeItem(STORAGE_KEYS.PREV_EVENTS);
    localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
    this.saveCategories(DEFAULT_CATEGORIES);
  },

  // Demo verisi var mı kontrol et
  hasDemoData() {
    const events = this.getEvents();
    return events.some(e => e.id && typeof e.id === 'string' && e.id.startsWith('demo_'));
  },

  // Sadece Örnek Verileri Kaldır (Önceki verileri geri yükler veya takvimi temizler)
  removeDemoData() {
    // Varsa yükleme öncesi gerçek verileri geri yükle
    const prevData = localStorage.getItem(STORAGE_KEYS.PREV_EVENTS);
    if (prevData) {
      try {
        const restored = JSON.parse(prevData);
        if (Array.isArray(restored)) {
          this.saveEvents(restored);
          localStorage.removeItem(STORAGE_KEYS.PREV_EVENTS);
          return { restored: true, count: restored.length };
        }
      } catch (e) {
        console.error('Yedek geri yüklenirken hata:', e);
      }
    }

    // Yedek yoksa, sadece demo olmayan gerçek kayıtları bırak
    const events = this.getEvents();
    const remaining = events.filter(e => !e.id || !e.id.startsWith('demo_'));
    this.saveEvents(remaining);
    localStorage.removeItem(STORAGE_KEYS.PREV_EVENTS);
    return { restored: false, count: remaining.length };
  },

  // Gerçekçi 30 Günlük Demo Verisi Yükle
  loadDemoData() {
    // Mevcut gerçek verileri otomatik yedekle (Geri alabilmek için)
    const existingEvents = this.getEvents();
    const realEvents = existingEvents.filter(e => !e.id || !e.id.startsWith('demo_'));
    if (realEvents.length > 0) {
      localStorage.setItem(STORAGE_KEYS.PREV_EVENTS, JSON.stringify(realEvents));
    }

    const today = new Date();
    const demoEvents = [];

    // Son 30 gün için döngü
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      // Her gün 2-4 kez WC kullanımı
      const wcCount = Math.floor(Math.random() * 3) + 2;
      const hours = ['08:15', '11:30', '15:20', '19:40', '22:10'];
      for (let w = 0; w < wcCount; w++) {
        const isBowel = w === 0 || (w === 2 && Math.random() > 0.5);
        demoEvents.push({
          id: 'demo_wc_' + dateStr + '_' + w,
          categoryId: 'wc',
          date: dateStr,
          time: hours[w] || '14:00',
          details: {
            wcType: isBowel ? 'Büyük (Dışkı)' : 'Küçük (İdrar)',
            wcCondition: isBowel ? (Math.random() > 0.8 ? 'Sert / Kabız' : 'Normal') : 'Normal'
          },
          notes: isBowel ? 'Sabah rutini' : '',
          createdAt: new Date().toISOString()
        });
      }

      // Her 3-4 günde bir Baş Ağrısı atağı
      if (i % 3 === 0 || i % 7 === 0) {
        const intensity = Math.floor(Math.random() * 6) + 4; // 4 - 9 arası
        const triggers = ['Uykusuzluk', 'Stres / Kaygı', 'Ekran Süresi / Göz', 'Susuzluk'];
        const locations = ['Şakaklar', 'Alın', 'Tek Taraflı (Migren)', 'Ense ve Boyun'];
        const trig = triggers[Math.floor(Math.random() * triggers.length)];
        const loc = locations[Math.floor(Math.random() * locations.length)];
        const medTaken = intensity > 6;

        demoEvents.push({
          id: 'demo_headache_' + dateStr,
          categoryId: 'headache',
          date: dateStr,
          time: ['14:30', '16:15', '18:45', '11:00'][Math.floor(Math.random() * 4)],
          details: {
            intensity: intensity,
            location: loc,
            trigger: trig,
            medTaken: medTaken,
            medName: medTaken ? 'Parol 500mg' : ''
          },
          notes: medTaken ? 'İlaç alındıktan 1 saat sonra hafifledi.' : 'Dinlenince geçti.',
          createdAt: new Date().toISOString()
        });
      }

      // Su tüketimi (günlük)
      const waterGlasses = Math.floor(Math.random() * 5) + 6; // 6 - 10 bardak
      demoEvents.push({
        id: 'demo_water_' + dateStr,
        categoryId: 'water',
        date: dateStr,
        time: '21:00',
        details: {
          quantity: waterGlasses,
          unit: 'bardak'
        },
        notes: 'Gün boyu düzenli içildi.',
        createdAt: new Date().toISOString()
      });

      // Kahve (1-3 fincan)
      const coffeeCups = Math.floor(Math.random() * 3) + 1;
      demoEvents.push({
        id: 'demo_coffee_' + dateStr,
        categoryId: 'coffee',
        date: dateStr,
        time: '10:15',
        details: {
          quantity: coffeeCups,
          unit: 'fincan'
        },
        notes: 'Filtre kahve',
        createdAt: new Date().toISOString()
      });

      // 2 günde bir Spor Aktivitesi
      if (i % 2 === 0) {
        const sportTypes = ['Yürüyüş', 'Koşu', 'Fitness / Ağırlık', 'Yoga & Esneme', 'Yüzme'];
        const spType = sportTypes[Math.floor(Math.random() * sportTypes.length)];
        const spDuration = [30, 45, 60, 40][Math.floor(Math.random() * 4)];
        const spIntensity = ['Hafif', 'Orta', 'Yüksek'][Math.floor(Math.random() * 3)];
        demoEvents.push({
          id: 'demo_sport_' + dateStr,
          categoryId: 'sport',
          date: dateStr,
          time: '18:00',
          details: {
            sportType: spType,
            duration: spDuration,
            intensityLevel: spIntensity,
            quantity: spDuration
          },
          notes: `${spDuration} dk ${spType} antrenmanı tamamlandı.`,
          createdAt: new Date().toISOString()
        });
      }

      // Haftada 1-2 gün Masaj Seansı
      if (i % 5 === 0) {
        const massageAreas = ['Boyun & Omuz', 'Sırt & Bel', 'Baş & Şakak (Migren)', 'Tüm Vücut'];
        const mArea = massageAreas[Math.floor(Math.random() * massageAreas.length)];
        const mDuration = [20, 30, 45][Math.floor(Math.random() * 3)];
        const relief = Math.floor(Math.random() * 3) + 7; // 7-9 / 10 rahatlama
        demoEvents.push({
          id: 'demo_massage_' + dateStr,
          categoryId: 'massage',
          date: dateStr,
          time: '20:30',
          status: 'completed',
          details: {
            massageArea: mArea,
            duration: mDuration,
            reliefScore: relief,
            intensity: relief,
            quantity: mDuration
          },
          notes: `${mArea} bölgesine rahatlatıcı masaj yapıldı, gerginlik hafifledi.`,
          createdAt: new Date().toISOString()
        });
      }
    }

    // Gelecek ve onay bekleyen örnek randevular (Kullanıcının sistemi test edebilmesi için)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = this.formatDate(tomorrow);

    demoEvents.push({
      id: 'demo_planned_sport_tomorrow',
      categoryId: 'sport',
      date: tomorrowStr,
      time: '18:30',
      status: 'planned', // ⏳ Randevu
      reminderSent: false,
      checkinPrompted: false,
      details: {
        sportType: 'Fitness / Ağırlık',
        duration: 45,
        intensityLevel: 'Orta Seviye',
        quantity: 45,
        unit: 'dk'
      },
      notes: 'Yarın akşam fitness antrenmanı randevusu (1 saat önce sessiz bildirim)',
      createdAt: new Date().toISOString()
    });

    const inTwoDays = new Date();
    inTwoDays.setDate(inTwoDays.getDate() + 2);
    const inTwoDaysStr = this.formatDate(inTwoDays);

    demoEvents.push({
      id: 'demo_planned_massage_future',
      categoryId: 'massage',
      date: inTwoDaysStr,
      time: '19:00',
      status: 'planned', // ⏳ Randevu
      reminderSent: false,
      checkinPrompted: false,
      details: {
        massageArea: 'Boyun & Omuz',
        duration: 40,
        provider: 'Uzman Masöz / Masör',
        reliefScore: 9,
        intensity: 9,
        quantity: 40,
        unit: 'dk'
      },
      notes: 'Klinik randevusu - Boyun ve sırt masajı',
      createdAt: new Date().toISOString()
    });

    this.saveEvents(demoEvents);
    return demoEvents.length;
  }
};
