/**
 * SODSAN PDKS, PUANTAJ VE MAAŞ HESAPLAMA SİSTEMİ
 * Veritabanı Katmanı (IndexedDB - %100 Çevrimdışı ve Güvenli)
 */

class SodsanDB {
  constructor() {
    this.dbName = 'SodsanPDKS_DB';
    this.version = 1;
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Personel Kartları
        if (!db.objectStoreNames.contains('personel')) {
          const store = db.createObjectStore('personel', { keyPath: 'kartno' });
          store.createIndex('id', 'id', { unique: false });
          store.createIndex('adSoyad', 'adSoyad', { unique: false });
          store.createIndex('durumkodu', 'durumkodu', { unique: false });
        }

        // 2. Ham Giriş-Çıkış Kayıtları
        if (!db.objectStoreNames.contains('giriscikis')) {
          const store = db.createObjectStore('giriscikis', { keyPath: 'id', autoIncrement: true });
          store.createIndex('personel_id', 'personel_id', { unique: false });
          store.createIndex('kartno', 'kartno', { unique: false });
          store.createIndex('tarih', 'tarih', { unique: false });
          store.createIndex('tarih_personel', ['tarih', 'kartno'], { unique: false });
          store.createIndex('unique_kayit', ['tarih', 'kartno', 'giris_saat', 'cikis_saat'], { unique: false });
        }

        // 3. Vardiyalar ve Detaylar
        if (!db.objectStoreNames.contains('vardiyalar')) {
          db.createObjectStore('vardiyalar', { keyPath: 'id' });
        }

        // 4. Tatil ve İzin Tanımları
        if (!db.objectStoreNames.contains('tatiller')) {
          db.createObjectStore('tatiller', { keyPath: 'id' });
        }

        // 5. Personel İzin Kayıtları
        if (!db.objectStoreNames.contains('izinler')) {
          const store = db.createObjectStore('izinler', { keyPath: 'id', autoIncrement: true });
          store.createIndex('personel_id', 'personel_id', { unique: false });
          store.createIndex('tarih', 'tarih', { unique: false });
        }

        // 6. Aylık Puantaj Sonuçları (Hesaplanan ve Doğrulanan)
        if (!db.objectStoreNames.contains('puantaj')) {
          const store = db.createObjectStore('puantaj', { keyPath: 'id', autoIncrement: true });
          store.createIndex('donem', 'donem', { unique: false }); // 'YYYY-MM'
          store.createIndex('donem_kartno', ['donem', 'kartno'], { unique: false });
          store.createIndex('donem_tarih_kartno', ['donem', 'tarih', 'kartno'], { unique: true });
        }

        // 7. Maaş ve Muhasebe Bordro Kayıtları
        if (!db.objectStoreNames.contains('maas_bordro')) {
          const store = db.createObjectStore('maas_bordro', { keyPath: 'id', autoIncrement: true });
          store.createIndex('donem', 'donem', { unique: false });
          store.createIndex('donem_kartno', ['donem', 'kartno'], { unique: true });
        }

        // 8. Sistem Ayarları ve Katsayılar
        if (!db.objectStoreNames.contains('ayarlar')) {
          db.createObjectStore('ayarlar', { keyPath: 'anahtar' });
        }

        // 9. İçe Aktarılan Dosya Arşivi
        if (!db.objectStoreNames.contains('dosya_arsivi')) {
          const store = db.createObjectStore('dosya_arsivi', { keyPath: 'id', autoIncrement: true });
          store.createIndex('yuklemeTarihi', 'yuklemeTarihi', { unique: false });
          store.createIndex('dosyaTipi', 'dosyaTipi', { unique: false });
        }

        // 10. Denetim İzi (Audit Log)
        if (!db.objectStoreNames.contains('audit_logs')) {
          const store = db.createObjectStore('audit_logs', { keyPath: 'id', autoIncrement: true });
          store.createIndex('tarih', 'tarih', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB hatası:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // --- Genel CRUD Yardımcıları ---

  async tx(storeNames, mode = 'readonly') {
    await this.init();
    return this.db.transaction(storeNames, mode);
  }

  async getAll(storeName) {
    const tx = await this.tx(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getByKey(storeName, key) {
    const tx = await this.tx(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, item) {
    const tx = await this.tx(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async bulkPut(storeName, items) {
    if (!items || items.length === 0) return 0;
    const tx = await this.tx(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      let count = 0;
      items.forEach((item) => {
        store.put(item);
        count++;
      });
      tx.oncomplete = () => resolve(count);
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearStore(storeName) {
    const tx = await this.tx(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Özelleşmiş Sorgular ---

  async getPersonelByKart(kartno) {
    return this.getByKey('personel', kartno);
  }

  async getGirisCikisByDonem(donem) {
    // donem: 'YYYY-MM'
    const tumu = await this.getAll('giriscikis');
    return tumu.filter(k => k.tarih && k.tarih.startsWith(donem));
  }

  async getPuantajByDonem(donem) {
    await this.init();
    const tx = this.db.transaction('puantaj', 'readonly');
    const index = tx.objectStore('puantaj').index('donem');
    return new Promise((resolve, reject) => {
      const req = index.getAll(donem);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getMaasBordroByDonem(donem) {
    await this.init();
    const tx = this.db.transaction('maas_bordro', 'readonly');
    const index = tx.objectStore('maas_bordro').index('donem');
    return new Promise((resolve, reject) => {
      const req = index.getAll(donem);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async logAudit(kullanici, islem, detay, eskiDeger = null, yeniDeger = null) {
    const logItem = {
      tarih: new Date().toISOString(),
      kullanici: kullanici || 'Sistem',
      islem,
      detay,
      eskiDeger,
      yeniDeger
    };
    return this.put('audit_logs', logItem);
  }

  async getAyarlar() {
    const ayarList = await this.getAll('ayarlar');
    const ayarObj = {
      aylikCalismaSaati: 225,
      fazlaMesaiCarpani: 1.5,
      resmiBayramCarpani: 2.0,
      haftaTatiliMesaiCarpani: 1.5,
      geceVardiyasiMolaDk: 60,
      gunduzVardiyasiMolaDk: 60,
      ulasimFiyatlari: {
        'MİNİBÜS': 40,
        'METRO': 40,
        'OTOBÜS': 52,
        'MUDANYA OTOBÜS': 53,
        'MUDANYA MİNİBÜS': 65
      }
    };
    ayarList.forEach(a => {
      ayarObj[a.anahtar] = a.deger;
    });
    return ayarObj;
  }

  async setAyar(anahtar, deger) {
    return this.put('ayarlar', { anahtar, deger });
  }
}

// Global tekil DB örneği
window.sodsanDB = new SodsanDB();
