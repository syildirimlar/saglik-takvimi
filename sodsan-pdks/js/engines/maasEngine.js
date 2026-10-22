/**
 * SODSAN PDKS - Merkezi Maaş ve Muhasebe Bordro Hesaplama Motoru
 * Muhasebe ODS Formülleri:
 * - Standart Aylık Saat Normu: 225 saat
 * - Normal Fazla Mesai: (Maaş / 225) * 1.5 * MesaiSaati
 * - Resmi Bayram Mesaisi: (Maaş / 225) * 2.0 * BayramMesaiSaati
 * - Bankaya Yatan Tutar: Maaş - Avans + MesaiÜcreti + BayramMesaiÜcreti - BES_İcra - Kesinti
 * - Ulaşım Ücreti: UlaşımAdedi * BirimFiyat
 * - Toplam Kalan / Elden: Maaş - Avans + Mesai - BankaYatan + EkMesai - Kesinti + Ulaşım + Prim + Servis - BES + Bayram
 */

class MaasEngine {
  constructor() {
    this.varsayilanAyarlar = {
      aylikSaatNormu: 225,
      mesaiCarpani: 1.5,
      bayramCarpani: 2.0,
      ulasimFiyatlari: {
        'MİNİBÜS': 40,
        'METRO': 40,
        'OTOBÜS': 52,
        'MUDANYA OTOBÜS': 53,
        'MUDANYA MİNİBÜS': 65
      }
    };
  }

  /**
   * Bir personelin tekil bordro satırını hesaplar
   */
  hesaplaPersonelBordro(params) {
    const ayarlar = params.ayarlar || this.varsayilanAyarlar;
    const norm = ayarlar.aylikSaatNormu || 225;
    const mesaiCarpani = ayarlar.mesaiCarpani || 1.5;
    const bayramCarpani = ayarlar.bayramCarpani || 2.0;

    const maas = parseFloat(params.maas) || 0;
    const avans = parseFloat(params.avans) || 0;
    const mesaiSaat = parseFloat(params.mesaiSaat) || 0;
    const bayramMesaiSaat = parseFloat(params.resmiBayramMesaiSaat) || 0;
    const besIcra = parseFloat(params.besIcra) || 0;
    const ekMesaiSaat = parseFloat(params.ekMesaiSaat) || 0;
    const ekMesaiUcreti = parseFloat(params.ekMesaiUcreti) || 0;
    const kesinti = parseFloat(params.kesinti) || 0;
    const ulasimAdet = parseFloat(params.ulasimAdet) || 0;
    const prim = parseFloat(params.prim) || 0;
    const servisKullanim = parseFloat(params.servisKullanim) || 0;
    const multimet = parseFloat(params.multimet) || 0;

    // Ulaşım türü ve birim fiyat
    let ulasimTuru = params.ulasimTuru || '';
    let ulasimFiyati = parseFloat(params.ulasimFiyati) || 0;
    if (!ulasimFiyati && ulasimTuru && ayarlar.ulasimFiyatlari[ulasimTuru]) {
      ulasimFiyati = ayarlar.ulasimFiyatlari[ulasimTuru];
    }

    // 1. Normal Fazla Mesai Ücreti = Maaş / 225 * 1.5 * MesaiSaat
    const saatUcreti = norm > 0 ? maas / norm : 0;
    const bMesaiUcreti = parseFloat((saatUcreti * mesaiCarpani * mesaiSaat).toFixed(2));

    // 2. Resmi Bayram Mesai Ücreti = Maaş / 225 * 2.0 * BayramSaat
    const resmiBayramMesaiUcreti = parseFloat((saatUcreti * bayramCarpani * bayramMesaiSaat).toFixed(2));

    // 3. Ulaşım Ücreti = Adet * Birim Fiyat
    const ulasimUcreti = parseFloat((ulasimAdet * ulasimFiyati).toFixed(2));

    // 4. Bankaya Yatan Tutar = Maaş - Avans + Mesai + Bayram - BES_İcra - Kesinti
    let bankaYatan = maas - avans + bMesaiUcreti + resmiBayramMesaiUcreti - besIcra - kesinti;
    bankaYatan = parseFloat(Math.max(0, bankaYatan).toFixed(2));

    // 5. Toplam Net Hakediş (Elden / Kalan / Nakit Bakiye)
    // ODS formülü: C - D + F - I + L - M + O + P + Q - J + H
    let toplam = (maas - avans + bMesaiUcreti - bankaYatan + ekMesaiUcreti - kesinti + ulasimUcreti + prim + servisKullanim - besIcra + resmiBayramMesaiUcreti);
    toplam = parseFloat(toplam.toFixed(2));

    return {
      sira: params.sira,
      personelId: params.personelId,
      kartno: params.kartno,
      adSoyad: params.adSoyad,
      maas,
      avans,
      mesaiSaat,
      bMesaiUcreti,
      resmiBayramMesaiSaat: bayramMesaiSaat,
      resmiBayramMesaiUcreti,
      bankaYatan,
      besIcra,
      ekMesaiSaat,
      ekMesaiUcreti,
      kesinti,
      ulasimAdet,
      ulasimTuru,
      ulasimFiyati,
      ulasimUcreti,
      prim,
      servisKullanim,
      toplam,
      multimet,
      aciklama: params.aciklama || '',
      manuelMi: !!params.manuelMi
    };
  }

  /**
   * Puantaj motoru sonuçlarından aylık bordroyu otomatik oluşturur
   * @param {Array} puantajList - PuantajEngine çıktıları
   * @param {Array} mevcutPersoneller - Personel kartları (maaş ve servis bilgileri)
   * @param {Array} oncekiBordro - Varsa önceki aydan gelen avans/kesinti/ulaşım parametreleri
   */
  otomatikBordroOlustur(puantajList, mevcutPersoneller, oncekiBordro = []) {
    const personelMap = new Map();
    mevcutPersoneller.forEach(p => personelMap.set(p.kartno, p));

    const oncekiBordroMap = new Map();
    oncekiBordro.forEach(b => oncekiBordroMap.set(b.adSoyad.toUpperCase().trim(), b));

    const bordroSonuclari = [];

    puantajList.forEach((pnt, idx) => {
      const p = personelMap.get(pnt.kartno);
      const onceki = p ? oncekiBordroMap.get(p.adSoyad.toUpperCase().trim()) : null;

      // Maaş: Önce personel kartından, yoksa önceki aydan al
      const maas = (p && p.netMaas > 0) ? p.netMaas : (onceki ? onceki.maas : 0);
      const mesaiSaat = pnt.toplamlar ? pnt.toplamlar.fazlaMesaiOndalik : 0;

      // Ulaşım ve servis bilgilerini önceki aydan devral
      const ulasimTuru = onceki ? onceki.ulasimTuru : '';
      const ulasimFiyati = onceki ? onceki.ulasimFiyati : 0;
      const ulasimAdet = onceki ? onceki.ulasimAdet : 0;
      const besIcra = onceki ? onceki.besIcra : 0;

      const bordroSatiri = this.hesaplaPersonelBordro({
        sira: idx + 1,
        personelId: p ? p.id : null,
        kartno: pnt.kartno,
        adSoyad: pnt.adSoyad,
        maas,
        avans: 0, // Avans muhasebe tarafından onaylanır
        mesaiSaat,
        resmiBayramMesaiSaat: 0,
        besIcra,
        ekMesaiSaat: 0,
        ekMesaiUcreti: 0,
        kesinti: 0,
        ulasimAdet,
        ulasimTuru,
        ulasimFiyati,
        prim: 0,
        servisKullanim: onceki ? onceki.servisKullanim : 0,
        multimet: 0,
        aciklama: ''
      });

      bordroSonuclari.push(bordroSatiri);
    });

    return bordroSonuclari;
  }
}

// Global Maaş Motoru
window.maasEngine = new MaasEngine();
