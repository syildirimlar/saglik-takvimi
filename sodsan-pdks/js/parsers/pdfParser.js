/**
 * SODSAN PDKS - Aylık PDF Personel Raporu Ayrıştırıcısı
 * PDF.js kütüphanesi kullanarak 56 sayfalık raporu kişi bazında okur.
 */

class PdksPdfParser {
  constructor() {
    this.personeller = [];
    this.donem = null;
    this.stats = {
      sayfaSayisi: 0,
      personelSayisi: 0,
      toplamFazlaMesaiDk: 0
    };
  }

  async parsePdf(fileOrArrayBuffer, onProgress = null) {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js kütüphanesi yüklenemedi. Lütfen js/vendor/pdf.min.js dosyasını kontrol edin.');
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';

    let data;
    if (fileOrArrayBuffer instanceof ArrayBuffer) {
      data = fileOrArrayBuffer;
    } else if (fileOrArrayBuffer instanceof File || fileOrArrayBuffer instanceof Blob) {
      data = await fileOrArrayBuffer.arrayBuffer();
    } else {
      throw new Error('Geçersiz dosya verisi');
    }

    const loadingTask = window.pdfjsLib.getDocument({ data });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    this.personeller = [];
    this.stats.sayfaSayisi = numPages;

    for (let p = 1; p <= numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const textContent = await page.getTextContent();
      const personData = this.parsePageText(textContent.items, p);

      if (personData && personData.kartno) {
        this.personeller.push(personData);
      }

      if (onProgress) {
        onProgress(Math.round((p / numPages) * 100));
      }
    }

    this.stats.personelSayisi = this.personeller.length;
    return {
      donem: this.donem,
      personeller: this.personeller,
      stats: this.stats
    };
  }

  parsePageText(items, pageNum) {
    if (!items || items.length === 0) return null;

    // Y koordinatlarına göre satırları grupla
    // PDF.js koordinatlarında transform[5] = Y pozisyonu
    const lineMap = new Map();
    items.forEach((item) => {
      const str = item.str.trim();
      if (!str) return;
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) {
        lineMap.set(y, []);
      }
      lineMap.get(y).push({
        text: str,
        x: item.transform[4]
      });
    });

    // Satırları Y ekseninde yukarıdan aşağıya (büyükten küçüğe) sırala
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
    const rawLines = sortedY.map((y) => {
      const lineItems = lineMap.get(y).sort((a, b) => a.x - b.x);
      return lineItems.map(i => i.text).join(' ');
    });

    const fullPageText = rawLines.join('\n');

    // Son sayfada sadece özet olabilir ("55 adet personel listelendi.")
    if (fullPageText.includes('adet personel listelendi') && !fullPageText.includes('Kart No:')) {
      return null;
    }

    // Başlık bilgilerini çek
    let kartno = '';
    let adi = '';
    let soyadi = '';
    let girisTarih = null;
    let cikisTarih = null;
    let maas = 0;

    const kartMatch = fullPageText.match(/Kart\s*No:\s*([0-9]+)/i);
    if (kartMatch) kartno = kartMatch[1].padStart(5, '0');

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

    const adiMatch = fullPageText.match(/Adı:\s*([^\n\r]+?)(?=\s+Bölüm:|\s+Çıkış|$)/i);
    if (adiMatch) adi = cleanText(adiMatch[1]);

    const soyadiMatch = fullPageText.match(/Soyadı:\s*([^\n\r]+?)(?=\s+Ünvan:|\s+Maaş|$)/i);
    if (soyadiMatch) soyadi = cleanText(soyadiMatch[1]);

    const girisMatch = fullPageText.match(/Giriş\s*Tarih:\s*([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i);
    if (girisMatch) girisTarih = girisMatch[1];

    const cikisMatch = fullPageText.match(/Çıkış\s*Tarihi:\s*([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i);
    if (cikisMatch) cikisTarih = cikisMatch[1];

    const maasMatch = fullPageText.match(/Maaş\s*([0-9\.\,]+)/i);
    if (maasMatch) {
      maas = parseFloat(maasMatch[1].replace(/\./g, '').replace(',', '.')) || 0;
    }

    // Dönem bilgisi (01.09.2025 - 30.09.2025)
    const donemMatch = fullPageText.match(/([0-9]{2}\.[0-9]{2}\.[0-9]{4})\s*-\s*([0-9]{2}\.[0-9]{2}\.[0-9]{4})/);
    if (donemMatch && !this.donem) {
      const parts = donemMatch[1].split('.');
      this.donem = `${parts[2]}-${parts[1]}`; // '2025-09'
    }

    // Günlük kayıtları ayrıştır
    const gunler = [];
    let toplamFazlaMesai = '00:00';
    let toplamGecGelme = '00:00';
    let toplamErkenCikma = '00:00';

    rawLines.forEach((line) => {
      // Örn: "01.09.2025 Pazartesi 07:21 18:45 * 07:30-17:30 H.İÇİ 01:30"
      // Örn: "06.09.2025 Cumartesi 07:27 17:15 * HAFTA TATİLİ 07:30-17:30 CMRTS. 09:15"
      // Örn: "07.09.2025 Pazar HAFTA TATİLİ"
      // Örn: "05.09.2025 Cuma Devamsız"
      // Örn: "08.09.2025 Pazartesi YILLIK İZİN"
      const dateMatch = line.match(/^([0-9]{2})\.([0-9]{2})\.([0-9]{4})\s+([A-Za-zÇŞĞÜÖİçşğüöı]+)\s*(.*)$/);
      if (dateMatch) {
        const gun = parseInt(dateMatch[1], 10);
        const ay = dateMatch[2];
        const yil = dateMatch[3];
        const gunAdi = dateMatch[4];
        const rest = dateMatch[5];
        const isoTarih = `${yil}-${ay}-${dateMatch[1]}`;

        const gunData = this.parseGunSatiri(gun, isoTarih, gunAdi, rest);
        gunler.push(gunData);
      }

      // TOPLAM satırı: "TOPLAM: 41:15" veya "TOPLAM: 06:33 00:49 08:00"
      if (line.startsWith('TOPLAM:')) {
        const times = line.match(/([0-9]{2}:[0-9]{2})/g) || [];
        if (times.length === 1) {
          toplamFazlaMesai = times[0];
        } else if (times.length === 2) {
          toplamGecGelme = times[0];
          toplamFazlaMesai = times[1];
        } else if (times.length >= 3) {
          toplamGecGelme = times[0];
          toplamErkenCikma = times[1];
          toplamFazlaMesai = times[2];
        }
      }
    });

    const fmSaat = this.timeToDecimalHours(toplamFazlaMesai);

    return {
      sayfaNo: pageNum,
      kartno,
      adi,
      soyadi,
      adSoyad: `${adi} ${soyadi}`.trim(),
      girisTarihi: girisTarih,
      cikisTarihi: cikisTarih,
      maas,
      gunler,
      toplamlar: {
        gecGelme: toplamGecGelme,
        erkenCikma: toplamErkenCikma,
        fazlaMesai: toplamFazlaMesai,
        fazlaMesaiSaat: fmSaat
      }
    };
  }

  parseGunSatiri(gun, isoTarih, gunAdi, rest) {
    const item = {
      gun,
      tarih: isoTarih,
      gunAdi,
      giris: null,
      girisEM: false,
      cikis: null,
      cikisEM: false,
      durumu: '',
      vardiya: '',
      gecGelme: null,
      erkenCikma: null,
      fazlaMesai: null
    };

    // İzin / Durum kontrolü
    if (rest.includes('HAFTA TATİLİ')) item.durumu = 'HAFTA TATİLİ';
    if (rest.includes('YILLIK İZİN')) item.durumu = 'YILLIK İZİN';
    if (rest.includes('ÜCRETSİZ İZİN')) item.durumu = 'ÜCRETSİZ İZİN';
    if (rest.includes('RAPORLU')) item.durumu = 'RAPORLU';
    if (rest.includes('Devamsız')) item.durumu = 'Devamsız';

    // Vardiya tespiti
    const vardiyaMatch = rest.match(/([0-9]{2}:[0-9]{2}\s*-\s*[0-9]{2}:[0-9]{2}\s+[A-Za-zÇŞĞÜÖİçşğüöı\.]+)/);
    if (vardiyaMatch) {
      item.vardiya = vardiyaMatch[1];
    }

    // Saat desenleri (HH:MM)
    const timeMatches = rest.match(/([0-9]{2}:[0-9]{2})/g) || [];

    // Vardiyadaki 2 saati düşersek geriye giriş, çıkış ve mesai saatleri kalır
    // Eğer vardiya varsa ilk iki saat giriş ve çıkış olabilir
    if (timeMatches.length >= 2) {
      item.giris = timeMatches[0];
      item.cikis = timeMatches[1];

      // Eğer 3 veya daha fazla saat varsa sonuncusu genelde Fazla Mesai veya Gecikmedir
      if (timeMatches.length >= 3) {
        // Vardiya haricindeki son saat
        const sonSaat = timeMatches[timeMatches.length - 1];
        if (sonSaat !== item.giris && sonSaat !== item.cikis) {
          // Hafta içi veya hafta tatili mesaisi
          item.fazlaMesai = sonSaat;
        }
      }
    }

    // Elle müdahale işareti (*)
    if (rest.includes('*')) {
      item.cikisEM = true;
    }

    return item;
  }

  timeToDecimalHours(hhmm) {
    if (!hhmm || !hhmm.includes(':')) return 0;
    const parts = hhmm.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return parseFloat((h + m / 60).toFixed(2));
  }
}

// Global PDF Parser
window.pdksPdfParser = new PdksPdfParser();
