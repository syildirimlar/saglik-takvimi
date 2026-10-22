/**
 * SODSAN PDKS - Perkotek MySQL .DAT Yedek Dosyası Ayrıştırıcısı
 * Güvenlik İlkeleri:
 * - Orijinal dosyaya asla yazmaz (salt okunur).
 * - Biyometrik, resim ve gereksiz şifre/özel alanları eler.
 * - Mükerrer kayıtları tespit eder ve engeller.
 */

class PerkotekDatParser {
  constructor() {
    this.personelMap = new Map(); // id -> personel objesi
    this.kartNoMap = new Map();   // kartno -> personel objesi
    this.girisCikislar = [];
    this.vardiyalar = [];
    this.vardiyaDetaylar = [];
    this.tatiller = [];
    this.izinler = [];
    this.perkotekPuantajSonuclari = [];
    this.hatalar = [];
    this.stats = {
      toplamSatir: 0,
      personelSayisi: 0,
      hareketSayisi: 0,
      izinSayisi: 0,
      enEskiTarih: null,
      enYeniTarih: null
    };
  }

  /**
   * SQL INSERT satırındaki VALUES (...) bloğunu güvenli tokenize eder
   */
  parseSqlValues(valuesStr) {
    const values = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';
    let escape = false;

    // Baştaki ve sondaki parantezleri temizle
    let str = valuesStr.trim();
    if (str.startsWith('(') && str.endsWith(')')) {
      str = str.substring(1, str.length - 1);
    }

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (escape) {
        current += char;
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if ((char === "'" || char === '"') && !inQuote) {
        inQuote = true;
        quoteChar = char;
        continue;
      }

      if (char === quoteChar && inQuote) {
        inQuote = false;
        quoteChar = '';
        continue;
      }

      if (char === ',' && !inQuote) {
        values.push(this.cleanValue(current));
        current = '';
        continue;
      }

      current += char;
    }

    values.push(this.cleanValue(current));
    return values;
  }

  cleanValue(val) {
    const trimmed = val.trim();
    if (trimmed.toUpperCase() === 'NULL') return null;
    return this.cleanText(trimmed);
  }

  cleanText(str) {
    if (!str || typeof str !== 'string') return '';
    let res = str.trim();
    // 1. UTF-8 -> Windows-1252 / Latin-1 ikili donusum (mojibake) duzeltmeleri
    res = res
      .replace(/Ã¼/g, 'ü').replace(/Ãœ/g, 'Ü')
      .replace(/Ã§/g, 'ç').replace(/Ã‡/g, 'Ç')
      .replace(/ÅŸ/g, 'ş').replace(/Åž/g, 'Ş')
      .replace(/Ã¶/g, 'ö').replace(/Ã–/g, 'Ö')
      .replace(/ÄŸ/g, 'ğ').replace(/Äž/g, 'Ğ')
      .replace(/Ä±/g, 'ı').replace(/Ä°/g, 'İ');
    // 2. Windows-1254 karakterlerinin ISO-8859-1 (Latin-1) olarak yorumlanmasi duzeltmeleri
    res = res
      .replace(/Ý/g, 'İ').replace(/ý/g, 'ı')
      .replace(/Þ/g, 'Ş').replace(/þ/g, 'ş')
      .replace(/Ð/g, 'Ğ').replace(/ð/g, 'ğ');
    return res.normalize('NFC');
  }

  /**
   * DAT içeriğini Windows-1254 Türkçe kodlamasıyla ayrıştırır
   * @param {string|ArrayBuffer|Blob} input - .DAT dosya içeriği
   * @param {function} onProgress - Yüzdelik ilerleme geri bildirimi
   */
  async parseContent(input, onProgress = null) {
    this.reset();
    let text = '';

    if (typeof input === 'string') {
      text = input;
    } else if (input instanceof ArrayBuffer) {
      try {
        text = new TextDecoder('windows-1254').decode(input);
      } catch (e) {
        text = new TextDecoder('utf-8').decode(input);
      }
    } else if (input && typeof input.arrayBuffer === 'function') {
      const buf = await input.arrayBuffer();
      try {
        text = new TextDecoder('windows-1254').decode(buf);
      } catch (e) {
        text = new TextDecoder('utf-8').decode(buf);
      }
    }

    const lines = text.split(/\r?\n/);
    this.stats.toplamSatir = lines.length;

    const chunkSize = 2000;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('INSERT INTO ')) {
        this.processInsertLine(line);
      }

      if (onProgress && i % chunkSize === 0) {
        onProgress(Math.round((i / lines.length) * 100));
        await new Promise(r => setTimeout(r, 0));
      }
    }

    // Personel ID ile kartno eşleştirmelerini hareket kayıtlarına bağla
    this.enrichHareketler();

    this.stats.personelSayisi = this.personelMap.size;
    this.stats.hareketSayisi = this.girisCikislar.length;
    this.stats.izinSayisi = this.izinler.length;

    if (onProgress) onProgress(100);

    return {
      personeller: Array.from(this.personelMap.values()),
      girisCikislar: this.girisCikislar,
      vardiyalar: this.vardiyalar,
      vardiyaDetaylar: this.vardiyaDetaylar,
      tatiller: this.tatiller,
      izinler: this.izinler,
      perkotekPuantajSonuclari: this.perkotekPuantajSonuclari,
      stats: this.stats,
      hatalar: this.hatalar
    };
  }

  processInsertLine(line) {
    try {
      const match = line.match(/^INSERT INTO\s+(\w+)\s+VALUES\s*\((.*)\);?$/i);
      if (!match) return;

      const tablo = match[1].toLowerCase();
      const rawValues = match[2];
      const values = this.parseSqlValues(rawValues);

      switch (tablo) {
        case 'personel_kartlari':
          this.parsePersonelKarti(values);
          break;
        case 'personel_giriscikis':
          this.parseGirisCikis(values);
          break;
        case 'vardiya':
          this.parseVardiya(values);
          break;
        case 'vardiya_detay':
          this.parseVardiyaDetay(values);
          break;
        case 'tatil_tablo':
          this.parseTatilTablo(values);
          break;
        case 'personel_izin':
          this.parsePersonelIzin(values);
          break;
        case 'puantaj_sonuc':
          this.parsePuantajSonuc(values);
          break;
      }
    } catch (err) {
      this.hatalar.push({ satir: line.substring(0, 100), hata: err.message });
    }
  }

  parsePersonelKarti(v) {
    // Şema: id(0), sicilno(1), sskno(2), kartno(3), diger_kartno(4), adi(5), soyadi(6), unvani(7)...
    // netmaasi(14), durumkodu(19), giristarihi(21), cikistarihi(22)... servis_kod(48)
    const id = parseInt(v[0], 10);
    const kartno = (v[3] || '').padStart(5, '0');
    const adi = this.cleanText(v[5] || '');
    const soyadi = this.cleanText(v[6] || '');
    const adSoyad = `${adi} ${soyadi}`.trim();
    const netMaas = v[14] ? parseFloat(v[14]) : 0;
    const durumkodu = parseInt(v[19] || '0', 10); // 0: Aktif
    const girisTarihi = v[21] && v[21] !== '0000-00-00' ? v[21] : null;
    const cikisTarihi = v[22] && v[22] !== '0000-00-00' ? v[22] : null;
    const servisKod = v[48] ? parseInt(v[48], 10) : null;

    const personel = {
      id,
      kartno,
      adi,
      soyadi,
      adSoyad,
      unvani: v[7] || '',
      netMaas,
      durumkodu,
      aktif: durumkodu === 0 && !cikisTarihi,
      girisTarihi,
      cikisTarihi,
      servisKod
    };

    this.personelMap.set(id, personel);
    if (kartno) {
      this.kartNoMap.set(kartno, personel);
    }
  }

  parseGirisCikis(v) {
    // Şema: id(0), personel_id(1), tarih(2), giris_saat(3), cikis_saat(4), elle_giris(5), elle_cikis(6), giris_kapi(7), cikis_kapi(8), vardiya(9), nedenkodu(10)
    const id = parseInt(v[0], 10);
    const personel_id = parseInt(v[1], 10);
    const tarih = v[2];
    const giris_saat = v[3] && v[3] !== '00:00:00' ? v[3].substring(0, 5) : null;
    const cikis_saat = v[4] && v[4] !== '00:00:00' ? v[4].substring(0, 5) : null;

    if (!tarih || tarih === '0000-00-00') return;

    // Tarih istatistiği güncelle
    if (!this.stats.enEskiTarih || tarih < this.stats.enEskiTarih) this.stats.enEskiTarih = tarih;
    if (!this.stats.enYeniTarih || tarih > this.stats.enYeniTarih) this.stats.enYeniTarih = tarih;

    this.girisCikislar.push({
      id,
      personel_id,
      kartno: '', // enrichHareketler'de doldurulacak
      tarih,
      giris_saat,
      cikis_saat,
      elle_giris: v[5] === '1',
      elle_cikis: v[6] === '1',
      vardiya: parseInt(v[9] || '-1', 10),
      nedenkodu: parseInt(v[10] || '0', 10)
    });
  }

  parseVardiya(v) {
    // id(0), aciklama(1), TusBasma(2)
    this.vardiyalar.push({
      id: parseInt(v[0], 10),
      aciklama: (v[1] || '').trim()
    });
  }

  parseVardiyaDetay(v) {
    // id(0), vardiya_id(1), baslangic(2), bitis(3), mesai_id(4), tatil_id(5), GecCikma(6)
    this.vardiyaDetaylar.push({
      id: parseInt(v[0], 10),
      vardiya_id: parseInt(v[1], 10),
      baslangic: v[2] ? v[2].substring(0, 5) : '00:00',
      bitis: v[3] ? v[3].substring(0, 5) : '00:00',
      mesai_id: v[4] ? parseInt(v[4], 10) : null,
      tatil_id: v[5] ? parseInt(v[5], 10) : null,
      gecCikma: v[6] ? v[6].substring(0, 5) : '00:00'
    });
  }

  parseTatilTablo(v) {
    // id(0), aciklama(1), tatil_tipi(2), hakedilen_sure(3), hakedilen_bordro_id(4)
    this.tatiller.push({
      id: parseInt(v[0], 10),
      aciklama: (v[1] || '').trim(),
      tatil_tipi: parseInt(v[2] || '0', 10),
      hakedilen_sure: v[3] ? v[3].substring(0, 5) : '07:30'
    });
  }

  parsePersonelIzin(v) {
    // id(0), personel_id(1), tatil_id(2), tarih(3), gidis_saat(4), gelis_saat(5), saatlik(6), aciklama(7)
    this.izinler.push({
      id: parseInt(v[0], 10),
      personel_id: parseInt(v[1], 10),
      tatil_id: v[2] ? parseInt(v[2], 10) : null,
      tarih: v[3],
      gidis_saat: v[4] ? v[4].substring(0, 5) : '00:00',
      gelis_saat: v[5] ? v[5].substring(0, 5) : '00:00',
      saatlik: v[6] === '1',
      aciklama: (v[7] || '').trim()
    });
  }

  parsePuantajSonuc(v) {
    // id(0), personel_id(1), bordro_id(2), tarih(3), giris(4), cikis(5), miktar(6), dakika(7), aciklama(8)
    this.perkotekPuantajSonuclari.push({
      id: parseInt(v[0], 10),
      personel_id: parseInt(v[1], 10),
      tarih: v[3],
      giris: v[4] ? v[4].substring(0, 5) : null,
      cikis: v[5] ? v[5].substring(0, 5) : null,
      miktar: v[6] ? parseFloat(v[6]) : 0,
      dakika: v[7] ? parseInt(v[7], 10) : 0,
      aciklama: (v[8] || '').trim()
    });
  }

  enrichHareketler() {
    this.girisCikislar.forEach((h) => {
      const p = this.personelMap.get(h.personel_id);
      if (p) {
        h.kartno = p.kartno;
        h.adSoyad = p.adSoyad;
      }
    });
  }

  reset() {
    this.personelMap.clear();
    this.kartNoMap.clear();
    this.girisCikislar = [];
    this.vardiyalar = [];
    this.vardiyaDetaylar = [];
    this.tatiller = [];
    this.izinler = [];
    this.perkotekPuantajSonuclari = [];
    this.hatalar = [];
    this.stats = {
      toplamSatir: 0,
      personelSayisi: 0,
      hareketSayisi: 0,
      izinSayisi: 0,
      enEskiTarih: null,
      enYeniTarih: null
    };
  }
}

// Global Parser örneği
window.perkotekDatParser = new PerkotekDatParser();
