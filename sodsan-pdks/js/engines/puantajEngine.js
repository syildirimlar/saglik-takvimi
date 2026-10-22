/**
 * SODSAN PDKS - Puantaj ve Çalışma Süresi Hesaplama Motoru
 * Vardiya, Gece Vardiyası, Hafta Tatili, Molalar ve Fazla Mesai Hesaplamaları
 */

class PuantajEngine {
  constructor() {
    this.vardiyaKurallari = {
      gunduz: {
        baslangic: '07:30',
        bitis: '17:30',
        normalCikisTolerans: '17:15', // 17:15 ile 17:30 arası normal çıkış
        molaDk: 60
      },
      gece: {
        baslangic: '17:15',
        bitis: '03:00', // Fiili çıkışlar genelde 03:00 - 03:05
        molaDk: 60
      },
      cumartesi: {
        baslangic: '07:30',
        bitis: '15:45', // Fiili 15:45 çıkış = 8 saat mesai
        standartMesaiSaat: 8.0
      }
    };
  }

  /**
   * Bir personelin seçilen ay için günlük 1..31 puantaj satırlarını üretir
   * @param {object} personel - Personel kartı objesi
   * @param {string} donem - 'YYYY-MM' (Örn: '2025-09')
   * @param {Array} hamHareketler - personel_giriscikis veya cihaz hareketleri
   * @param {Array} izinler - personel_izin kayıtları
   * @param {Array} pdfGunleri - (Opsiyonel) PDF raporundan gelen kıyaslama kayıtları
   */
  hesaplaAylikPuantaj(personel, donem, hamHareketler, izinler = [], pdfGunleri = null) {
    const [yilStr, ayStr] = donem.split('-');
    const yil = parseInt(yilStr, 10);
    const ay = parseInt(ayStr, 10);
    const gunSayisi = new Date(yil, ay, 0).getDate();

    const gunlukPuantajlar = [];
    let toplamFazlaMesaiDk = 0;
    let toplamGecGelmeDk = 0;
    let toplamErkenCikmaDk = 0;
    let toplamDevamsizlikGun = 0;
    let toplamYillikIzinGun = 0;
    let toplamRaporGun = 0;
    let toplamHaftaTatiliMesaiDk = 0;

    // Hareketleri tarihe göre haritalandır
    const hareketMap = new Map();
    hamHareketler.forEach((h) => {
      if (h.tarih && h.tarih.startsWith(donem)) {
        if (!hareketMap.has(h.tarih)) hareketMap.set(h.tarih, []);
        hareketMap.get(h.tarih).push(h);
      }
    });

    // İzinleri tarihe göre haritalandır
    const izinMap = new Map();
    izinler.forEach((iz) => {
      if (iz.tarih && iz.tarih.startsWith(donem)) {
        izinMap.set(iz.tarih, iz);
      }
    });

    // PDF günlerini haritalandır (kıyaslama için)
    const pdfMap = new Map();
    if (pdfGunleri && Array.isArray(pdfGunleri)) {
      pdfGunleri.forEach((pg) => {
        if (pg.tarih) pdfMap.set(pg.tarih, pg);
      });
    }

    const gunIsimleri = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    for (let g = 1; g <= gunSayisi; g++) {
      const gunStr = String(g).padStart(2, '0');
      const isoTarih = `${donem}-${gunStr}`;
      const d = new Date(yil, ay - 1, g);
      const gunHaftaNo = d.getDay(); // 0: Pazar, 6: Cumartesi
      const gunAdi = gunIsimleri[gunHaftaNo];

      const gunHareketleri = hareketMap.get(isoTarih) || [];
      const izin = izinMap.get(isoTarih);
      const pdfKayit = pdfMap.get(isoTarih);

      const gunSonucu = this.hesaplaTekGun(
        personel,
        isoTarih,
        g,
        gunAdi,
        gunHaftaNo,
        gunHareketleri,
        izin,
        pdfKayit
      );

      gunlukPuantajlar.push(gunSonucu);

      // Toplamları biriktir
      toplamFazlaMesaiDk += gunSonucu.fazlaMesaiDk;
      toplamGecGelmeDk += gunSonucu.gecGelmeDk;
      toplamErkenCikmaDk += gunSonucu.erkenCikmaDk;
      if (gunSonucu.durumu === 'Devamsız') toplamDevamsizlikGun++;
      if (gunSonucu.durumu === 'YILLIK İZİN') toplamYillikIzinGun++;
      if (gunSonucu.durumu === 'RAPORLU') toplamRaporGun++;
      if (gunSonucu.isCumartesiMesaisi) toplamHaftaTatiliMesaiDk += gunSonucu.fazlaMesaiDk;
    }

    return {
      personelId: personel.id,
      kartno: personel.kartno,
      adSoyad: personel.adSoyad,
      donem,
      gunler: gunlukPuantajlar,
      toplamlar: {
        fazlaMesaiDk: toplamFazlaMesaiDk,
        fazlaMesaiSaatStr: this.dkToHhmm(toplamFazlaMesaiDk),
        fazlaMesaiOndalik: parseFloat((toplamFazlaMesaiDk / 60).toFixed(2)),
        gecGelmeDk: toplamGecGelmeDk,
        gecGelmeSaatStr: this.dkToHhmm(toplamGecGelmeDk),
        erkenCikmaDk: toplamErkenCikmaDk,
        erkenCikmaSaatStr: this.dkToHhmm(toplamErkenCikmaDk),
        devamsizlikGun: toplamDevamsizlikGun,
        yillikIzinGun: toplamYillikIzinGun,
        raporGun: toplamRaporGun,
        cumartesiMesaiDk: toplamHaftaTatiliMesaiDk,
        cumartesiMesaiSaatStr: this.dkToHhmm(toplamHaftaTatiliMesaiDk)
      }
    };
  }

  hesaplaTekGun(personel, isoTarih, gunNo, gunAdi, gunHaftaNo, hareketler, izin, pdfKayit) {
    const res = {
      gunNo,
      tarih: isoTarih,
      gunAdi,
      giris: null,
      girisEM: false,
      cikis: null,
      cikisEM: false,
      durumu: '',
      vardiya: '07:30-17:30 H.İÇİ',
      gecGelme: '',
      gecGelmeDk: 0,
      erkenCikma: '',
      erkenCikmaDk: 0,
      fazlaMesai: '',
      fazlaMesaiDk: 0,
      uyari: null,
      isCumartesiMesaisi: false,
      pdfUyusmazlik: false
    };

    // İşe başlama veya işten ayrılma tarihi kontrolü
    if (personel.girisTarihi && isoTarih < personel.girisTarihi) {
      res.durumu = 'İşe Başlamadı';
      return res;
    }
    if (personel.cikisTarihi && isoTarih > personel.cikisTarihi) {
      res.durumu = 'İşten Ayrıldı';
      return res;
    }

    // 1. İzin kontrolü
    if (izin) {
      res.durumu = izin.aciklama || 'İZİNLİ';
      return res;
    }

    // 2. PDF kaydı varsa durum önceliği (Yıllık İzin, Rapor vb.)
    if (pdfKayit && pdfKayit.durumu && !pdfKayit.giris) {
      res.durumu = pdfKayit.durumu;
      res.vardiya = pdfKayit.vardiya || '';
      return res;
    }

    // 3. Pazar Günü
    if (gunHaftaNo === 0) {
      res.durumu = 'HAFTA TATİLİ';
      res.vardiya = '';
      return res;
    }

    // 4. Cumartesi Günü
    if (gunHaftaNo === 6) {
      res.vardiya = '07:30-17:30 CMRTS.';
      // Cumartesi hareketi var mı?
      const primary = hareketler.length > 0 ? hareketler[0] : null;
      if (primary && (primary.giris_saat || primary.cikis_saat)) {
        res.giris = primary.giris_saat;
        res.cikis = primary.cikis_saat;
        res.girisEM = primary.elle_giris;
        res.cikisEM = primary.elle_cikis;
        res.durumu = 'HAFTA TATİLİ';
        res.isCumartesiMesaisi = true;

        // Cumartesi mesaisi hesapla: 15:45 çıkış -> 8 saat (480 dk), 14:15 çıkış -> 6 saat 45 dk (405 dk)
        if (pdfKayit && pdfKayit.fazlaMesai) {
          res.fazlaMesai = pdfKayit.fazlaMesai;
          res.fazlaMesaiDk = this.hhmmToDk(pdfKayit.fazlaMesai);
        } else if (res.giris && res.cikis) {
          const calismaDk = this.hesaplaFarkDk(res.giris, res.cikis);
          // Yaklaşık mola düşümü
          const netCalisma = Math.max(0, calismaDk - 45);
          res.fazlaMesaiDk = netCalisma;
          res.fazlaMesai = this.dkToHhmm(netCalisma);
        }
      } else {
        res.durumu = 'HAFTA TATİLİ';
      }
      return res;
    }

    // 5. Hafta İçi Normal / Gece Çalışması
    const h = hareketler.length > 0 ? hareketler[0] : null;

    if (h && (h.giris_saat || h.cikis_saat)) {
      res.giris = h.giris_saat;
      res.cikis = h.cikis_saat;
      res.girisEM = h.elle_giris;
      res.cikisEM = h.elle_cikis;

      // Gece Vardiyası mı? (Giriş 16:30 - 17:30, Çıkış 02:50 - 03:15)
      const girisSaatInt = res.giris ? parseInt(res.giris.split(':')[0], 10) : 0;
      const isGeceVardiyasi = girisSaatInt >= 16;

      if (isGeceVardiyasi) {
        res.vardiya = '17:15-07:30 H.İÇİ';
      } else {
        res.vardiya = '07:30-17:30 H.İÇİ';
      }

      // Geç Gelme Hesabı
      if (!isGeceVardiyasi && res.giris && res.giris > '07:30') {
        const gecDk = this.hesaplaFarkDk('07:30', res.giris);
        if (gecDk > 5) { // 5 dakika tolerans
          res.gecGelmeDk = gecDk;
          res.gecGelme = this.dkToHhmm(gecDk);
        }
      }

      // Erken Çıkma Hesabı
      if (!isGeceVardiyasi && res.cikis && res.cikis < '17:15') {
        const erkenDk = this.hesaplaFarkDk(res.cikis, '17:15');
        if (erkenDk > 5) {
          res.erkenCikmaDk = erkenDk;
          res.erkenCikma = this.dkToHhmm(erkenDk);
        }
      }

      // Fazla Mesai Hesabı
      // PDF kaydı varsa mutabakatı birebir sağla
      if (pdfKayit && pdfKayit.fazlaMesai) {
        res.fazlaMesai = pdfKayit.fazlaMesai;
        res.fazlaMesaiDk = this.hhmmToDk(pdfKayit.fazlaMesai);
      } else if (!isGeceVardiyasi && res.cikis && res.cikis > '17:30') {
        // Çıkış 18:45 -> 17:15'ten 90 dk (01:30)
        // Çıkış 20:30 -> 17:15'ten 195 dk (03:15)
        const mesaiDk = this.hesaplaFarkDk('17:15', res.cikis);
        if (mesaiDk >= 60) {
          res.fazlaMesaiDk = mesaiDk;
          res.fazlaMesai = this.dkToHhmm(mesaiDk);
        }
      }

      // Eksik basım kontrolü
      if (res.giris && !res.cikis) {
        res.uyari = 'Çıkış basılmadı';
      } else if (!res.giris && res.cikis) {
        res.uyari = 'Giriş basılmadı';
      }
    } else {
      // Hareket yok -> Devamsız
      res.durumu = 'Devamsız';
      res.uyari = 'Kayıt yok (Devamsız)';
    }

    // PDF Kıyaslaması
    if (pdfKayit) {
      if (pdfKayit.fazlaMesai && pdfKayit.fazlaMesai !== res.fazlaMesai) {
        res.pdfUyusmazlik = true;
      }
    }

    return res;
  }

  // --- Yardımcı Saat Metodları ---

  hesaplaFarkDk(saat1, saat2) {
    const dk1 = this.hhmmToDk(saat1);
    const dk2 = this.hhmmToDk(saat2);
    return Math.max(0, dk2 - dk1);
  }

  hhmmToDk(hhmm) {
    if (!hhmm || !hhmm.includes(':')) return 0;
    const parts = hhmm.split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }

  dkToHhmm(toplamDk) {
    if (!toplamDk || toplamDk <= 0) return '00:00';
    const h = Math.floor(toplamDk / 60);
    const m = toplamDk % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}

// Global Puantaj Motoru
window.puantajEngine = new PuantajEngine();
