/**
 * SODSAN PDKS - Muhasebe ODS / Excel Ayrıştırıcı ve Dışa Aktarıcı
 * SheetJS (xlsx.full.min.js) kullanarak ODS ve XLSX dosyalarını birebir okur ve üretir.
 */

class OdsBordroHandler {
  constructor() {
    this.sheetNames = [];
    this.selectedSheet = null;
    this.rows = [];
  }

  /**
   * ODS / XLSX dosyasını yükler ve çalışma sayfalarını listeler
   */
  async loadFile(fileOrArrayBuffer) {
    if (!window.XLSX) {
      throw new Error('SheetJS (XLSX) kütüphanesi bulunamadı.');
    }

    let data;
    if (fileOrArrayBuffer instanceof ArrayBuffer) {
      data = new Uint8Array(fileOrArrayBuffer);
    } else if (fileOrArrayBuffer instanceof File || fileOrArrayBuffer instanceof Blob) {
      const buffer = await fileOrArrayBuffer.arrayBuffer();
      data = new Uint8Array(buffer);
    } else {
      throw new Error('Geçersiz dosya verisi');
    }

    const workbook = window.XLSX.read(data, { type: 'array', cellFormula: true, cellStyles: true });
    this.workbook = workbook;
    this.sheetNames = workbook.SheetNames;

    // En son veya en uygun ayı seç
    this.selectedSheet = this.sheetNames.find(s => s.includes('2026') || s.includes('EYLÜL')) || this.sheetNames[0];

    return {
      sheetNames: this.sheetNames,
      defaultSheet: this.selectedSheet
    };
  }

  /**
   * Belirtilen sayfadaki bordro verilerini 21 sütunlu standart SODSAN şemasına dönüştürür
   */
  parseSheet(sheetName) {
    if (!this.workbook || !this.workbook.Sheets[sheetName]) {
      throw new Error(`Sayfa bulunamadı: ${sheetName}`);
    }

    const ws = this.workbook.Sheets[sheetName];
    // raw: false veya cellFormula: true ile diziye dönüştür
    const jsonData = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

    if (jsonData.length === 0) return [];

    // Başlık satırını bul (genellikle satır 0 veya 1)
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(10, jsonData.length); r++) {
      const rowStr = jsonData[r].join(' ').toUpperCase();
      if (rowStr.includes('AD SOYAD') && rowStr.includes('MAAŞ')) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx === -1) headerRowIdx = 0;

    const cleanText = (str) => {
      if (!str || typeof str !== 'string') return '';
      let res = str.trim();
      res = res
        .replace(/Ã¼/g, 'ü').replace(/Ãœ/g, 'Ü')
        .replace(/Ã§/g, 'ç').replace(/Ã‡/g, 'Ç')
        .replace(/ÅŸ/g, 'ş').replace(/Åž/g, 'Ş')
        .replace(/Ã¶/g, 'ö').replace(/Ã–/g, 'Ö')
        .replace(/ÄŸ/g, 'ğ').replace(/Äž/g, 'Ğ')
        .replace(/Ä±/g, 'ı').replace(/Ä°/g, 'İ')
        .replace(/Ý/g, 'İ').replace(/ý/g, 'ı')
        .replace(/Þ/g, 'Ş').replace(/þ/g, 'ş')
        .replace(/Ð/g, 'Ğ').replace(/ð/g, 'ğ');
      return res.normalize('NFC');
    };

    const dataRows = [];
    for (let r = headerRowIdx + 1; r < jsonData.length; r++) {
      const row = jsonData[r];
      const adSoyad = cleanText(row[1] || '');

      // Boş satırları veya genel toplam satırını atla
      if (!adSoyad || adSoyad.toUpperCase().startsWith('TOPLAM') || adSoyad === '0') {
        continue;
      }

      const parseNum = (v) => {
        if (!v) return 0;
        if (typeof v === 'number') return v;
        const str = String(v).replace(/[₺\s\.]/g, '').replace(',', '.');
        return parseFloat(str) || 0;
      };

      dataRows.push({
        sira: row[0] || (dataRows.length + 1),
        adSoyad: adSoyad,
        maas: parseNum(row[2]),
        avans: parseNum(row[3]),
        mesaiSaat: parseNum(row[4]),
        bMesaiUcreti: parseNum(row[5]),
        resmiBayramMesaiSaat: parseNum(row[6]),
        resmiBayramMesaiUcreti: parseNum(row[7]),
        bankaYatan: parseNum(row[8]),
        besIcra: parseNum(row[9]),
        ekMesaiSaat: parseNum(row[10]),
        ekMesaiUcreti: parseNum(row[11]),
        kesinti: parseNum(row[12]),
        ulasimAdet: parseNum(row[13]),
        ulasimUcreti: parseNum(row[14]),
        prim: parseNum(row[15]),
        servisKullanim: parseNum(row[16]),
        toplam: parseNum(row[17]),
        multimet: parseNum(row[18]),
        aciklama: String(row[19] || '').trim(),
        ulasimTuru: String(row[20] || '').trim(),
        ulasimFiyati: parseNum(row[21])
      });
    }

    this.rows = dataRows;
    return dataRows;
  }

  /**
   * Hesaplanan bordroyu orijinal SODSAN muhasebe ODS/XLSX dosyası olarak dışa aktarır
   */
  exportToOds(bordroList, donemAdi = 'EYLÜL 2026', format = 'ods') {
    if (!window.XLSX) {
      throw new Error('SheetJS (XLSX) kütüphanesi bulunamadı.');
    }

    // 21 Kolon Başlıkları
    const headers = [
      'sıra',
      'AD SOYAD',
      'MAAŞ',
      'AVANS',
      'MESAİ (SAAT)',
      'B.MESAİ ÜCRETİ',
      'RESMİ BAYRAM MESAİ SAATİ',
      'RESMİ BAYRAM MESAİ ÜCRETİ',
      'BANKA YATAN',
      'BES - İCRA',
      'MESAİ (SAAT)',
      'MESAİ ÜCRETİ',
      'KESİNTİ',
      'ULAŞIM (AD)',
      'ULAŞIM ÜCRETİ',
      'PRİM',
      'SERVİS KULLANIM',
      'TOPLAM',
      'MULTİMET',
      'KESİLMEYEN SAATLER VE GENELBİLGİ',
      'ULAŞIM TÜRÜ',
      'BİRİM FİYAT'
    ];

    const aoa = [headers];

    bordroList.forEach((b, idx) => {
      const rowNum = idx + 2; // 1-indexed Excel satırı (Başlık satır 1)
      const r = [
        b.sira || (idx + 1),
        b.adSoyad,
        b.maas || 0,
        b.avans || 0,
        b.mesaiSaat || 0,
        // F: B.MESAİ ÜCRETİ = C/225*1.5*E
        { f: `C${rowNum}/225*1.5*E${rowNum}`, v: b.bMesaiUcreti || 0 },
        b.resmiBayramMesaiSaat || 0,
        // H: BAYRAM MESAİ = C/225*2*G
        { f: `C${rowNum}/225*2*G${rowNum}`, v: b.resmiBayramMesaiUcreti || 0 },
        // I: BANKA YATAN = C - D + F + H - J - M
        { f: `C${rowNum}-D${rowNum}+F${rowNum}+H${rowNum}-J${rowNum}-M${rowNum}`, v: b.bankaYatan || 0 },
        b.besIcra || 0,
        b.ekMesaiSaat || 0,
        b.ekMesaiUcreti || 0,
        b.kesinti || 0,
        b.ulasimAdet || 0,
        // O: ULAŞIM = N * V
        { f: `N${rowNum}*V${rowNum}`, v: b.ulasimUcreti || 0 },
        b.prim || 0,
        b.servisKullanim || 0,
        // R: TOPLAM = C - D + F - I + L - M + O + P + Q - J + H
        { f: `C${rowNum}-D${rowNum}+F${rowNum}-I${rowNum}+L${rowNum}-M${rowNum}+O${rowNum}+P${rowNum}+Q${rowNum}-J${rowNum}+H${rowNum}`, v: b.toplam || 0 },
        b.multimet || 0,
        b.aciklama || '',
        b.ulasimTuru || '',
        b.ulasimFiyati || 0
      ];
      aoa.push(r);
    });

    const ws = window.XLSX.utils.aoa_to_sheet(aoa);

    // Sütun genişlikleri ayarla
    ws['!cols'] = [
      { wch: 6 },  // sıra
      { wch: 25 }, // ad soyad
      { wch: 12 }, // maaş
      { wch: 12 }, // avans
      { wch: 14 }, // mesai saat
      { wch: 16 }, // b.mesai ücreti
      { wch: 18 }, // bayram mesai saat
      { wch: 18 }, // bayram mesai ücreti
      { wch: 16 }, // banka yatan
      { wch: 12 }, // bes - icra
      { wch: 12 }, // ek mesai saat
      { wch: 14 }, // ek mesai ücreti
      { wch: 12 }, // kesinti
      { wch: 12 }, // ulaşım adet
      { wch: 14 }, // ulaşım ücreti
      { wch: 12 }, // prim
      { wch: 14 }, // servis kullanım
      { wch: 16 }, // toplam
      { wch: 12 }, // multimet
      { wch: 35 }, // kesilmeyen saatler / bilgi
      { wch: 18 }, // ulaşım türü
      { wch: 12 }  // birim fiyat
    ];

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, donemAdi);

    const ext = format === 'xlsx' ? 'xlsx' : 'ods';
    const fileName = `SODSAN_Maas_Hesaplama_${donemAdi.replace(/\s+/g, '_')}.${ext}`;
    window.XLSX.writeFile(wb, fileName, { bookType: ext });
    return fileName;
  }
}

// Global ODS Bordro Yöneticisi
window.odsBordroHandler = new OdsBordroHandler();
