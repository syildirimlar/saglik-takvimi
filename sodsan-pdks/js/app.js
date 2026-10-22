/**
 * SODSAN PDKS & Maaş Hesaplama Otomasyonu - Ana Uygulama Kontrolcüsü
 */

class SodsanApp {
  constructor() {
    this.seciliDonem = '2025-09';
    this.personeller = [];
    this.hamHareketler = [];
    this.izinler = [];
    this.pdfSonuclari = [];
    this.hesaplananPuantajlar = [];
    this.aktifBordro = [];
    this.ayarlar = null;
  }

  async init() {
    try {
      await window.sodsanDB.init();
      this.ayarlar = await window.sodsanDB.getAyarlar();
      this.initEvents();
      this.loadAyarlarForm();

      // IndexedDB'deki mevcut personelleri kontrol et
      const existing = await window.sodsanDB.getAll('personel');
      const hasCorrupt = existing.some(p => 
        !p.adSoyad || 
        p.adSoyad.includes('\uFFFD') || 
        p.adSoyad.includes('?') || 
        p.adSoyad.includes('Ã') || 
        p.adSoyad.includes('Ý') || 
        p.adSoyad.includes('Þ')
      );

      if (existing.length === 0 || hasCorrupt) {
        // Kaynak dosyalardan tertemiz yukle
        await this.veritabaniniSifirlaVeYukle(true);
      } else {
        await this.verileriYukleVeGuncelle();
      }
      this.showToast('SODSAN PDKS Sistemi Hazır', 'success');
    } catch (err) {
      console.error('Uygulama başlatma hatası:', err);
      this.showToast(`Başlatma Hatası: ${err.message}`, 'error');
    }
  }

  initEvents() {
    // Sekme Geçişleri
    document.querySelectorAll('.nav-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.navTo(tab.dataset.tab);
      });
    });

    // Dönem Değişimi
    const donemSelect = document.getElementById('select-donem');
    if (donemSelect) {
      donemSelect.addEventListener('change', async (e) => {
        this.seciliDonem = e.target.value;
        const txtDonem = donemSelect.options[donemSelect.selectedIndex].text;
        const ozetDonemEl = document.getElementById('txt-ozet-donem');
        if (ozetDonemEl) ozetDonemEl.innerText = txtDonem;
        await this.verileriYukleVeGuncelle();
      });
    }

    // Dosya Seçim Olayları
    const fileDat = document.getElementById('file-dat');
    if (fileDat) {
      fileDat.addEventListener('change', (e) => this.handleDatUpload(e.target.files[0]));
    }

    const filePdf = document.getElementById('file-pdf');
    if (filePdf) {
      filePdf.addEventListener('change', (e) => this.handlePdfUpload(e.target.files[0]));
    }

    const fileOds = document.getElementById('file-ods');
    if (fileOds) {
      fileOds.addEventListener('change', (e) => this.handleOdsUpload(e.target.files[0]));
    }

    // "Kaynak Klasöründeki Dosyaları Otomatik Yükle" Butonu
    const btnLoadSample = document.getElementById('btn-load-sample-files');
    if (btnLoadSample) {
      btnLoadSample.addEventListener('click', () => this.loadLocalSampleFiles());
    }

    // "Verileri Sıfırla & Yeniden Yükle" Butonları
    const btnResetDb = document.getElementById('btn-reset-db');
    if (btnResetDb) {
      btnResetDb.addEventListener('click', () => this.veritabaniniSifirlaVeYukle(false));
    }
    const btnCleanReload = document.getElementById('btn-clean-reload');
    if (btnCleanReload) {
      btnCleanReload.addEventListener('click', () => this.veritabaniniSifirlaVeYukle(false));
    }

    // Hızlı Hesapla Butonu
    const btnQuickHesapla = document.getElementById('btn-quick-hesapla');
    if (btnQuickHesapla) {
      btnQuickHesapla.addEventListener('click', () => this.tumunuHesapla());
    }

    const btnRecalcAll = document.getElementById('btn-recalculate-all');
    if (btnRecalcAll) {
      btnRecalcAll.addEventListener('click', () => this.tumunuHesapla());
    }

    // Bordroyu Kaydet Butonu
    const btnSaveBordro = document.getElementById('btn-save-bordro');
    if (btnSaveBordro) {
      btnSaveBordro.addEventListener('click', () => this.saveBordroToDb());
    }

    // Dışa Aktar Butonları
    const btnExportOds = document.getElementById('btn-export-ods');
    if (btnExportOds) {
      btnExportOds.addEventListener('click', () => this.exportBordro('ods'));
    }

    const btnExportXlsx = document.getElementById('btn-export-xlsx');
    if (btnExportXlsx) {
      btnExportXlsx.addEventListener('click', () => this.exportBordro('xlsx'));
    }

    // Personel Arama Filtresi
    const filterInput = document.getElementById('filter-personel');
    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        this.renderPersonelTable(e.target.value);
      });
    }

    // Puantaj Personel Seçici
    const selectPuantajPersonel = document.getElementById('select-puantaj-personel');
    if (selectPuantajPersonel) {
      selectPuantajPersonel.addEventListener('change', (e) => {
        this.renderGunlukPuantaj(e.target.value);
      });
    }

    // Ayarlar Formu
    const formAyarlar = document.getElementById('form-ayarlar');
    if (formAyarlar) {
      formAyarlar.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveAyarlar();
      });
    }
  }

  navTo(tabId) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

    const activeTab = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
    const activePane = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');
    if (activePane) activePane.classList.add('active');
  }

  // --- Veri İçe Aktarma İşlemleri ---

  async handleDatUpload(file) {
    if (!file) return;
    this.showProgress(true, 'Perkotek DAT dosyası ayrıştırılıyor (Türkçe karakterler çözümleniyor)...');
    try {
      // Perkotek MySQL dump Windows-1254 (Türkçe ANSI) formatındadır
      const buffer = await file.arrayBuffer();
      let text = '';
      try {
        const dec1254 = new TextDecoder('windows-1254');
        text = dec1254.decode(buffer);
      } catch (e) {
        text = new TextDecoder('utf-8').decode(buffer);
      }

      const res = await window.perkotekDatParser.parseContent(text, (pct) => {
        this.setProgress(pct);
      });

      // Eski bozuk karakterli kayıtları temizle ve güncel verileri kaydet
      await window.sodsanDB.clearStore('personel');
      await window.sodsanDB.clearStore('giriscikis');
      await window.sodsanDB.bulkPut('personel', res.personeller);
      await window.sodsanDB.bulkPut('giriscikis', res.girisCikislar);
      await window.sodsanDB.bulkPut('vardiyalar', res.vardiyalar);
      await window.sodsanDB.bulkPut('tatiller', res.tatiller);
      await window.sodsanDB.bulkPut('izinler', res.izinler);

      await window.sodsanDB.logAudit('Kullanıcı', 'DAT İçe Aktarma', `${res.personeller.length} personel, ${res.girisCikislar.length} hareket kaydedildi.`);

      document.getElementById('info-dat-result').className = 'badge badge-success';
      document.getElementById('info-dat-result').innerText = `✅ ${res.personeller.length} Personel, ${res.girisCikislar.length} Hareket`;
      document.getElementById('status-dat').className = 'badge badge-success';
      document.getElementById('status-dat').innerText = `✅ DAT: ${res.personeller.length} Personel`;

      this.showToast('Perkotek DAT veritabanı Türkçe karakterlerle başarıyla yüklendi!', 'success');
      await this.verileriYukleVeGuncelle();
    } catch (err) {
      console.error(err);
      this.showToast(`DAT Hatası: ${err.message}`, 'error');
    } finally {
      this.showProgress(false);
    }
  }

  async handlePdfUpload(file) {
    if (!file) return;
    this.showProgress(true, 'PDKS PDF Raporu taranıyor...');
    try {
      const res = await window.pdksPdfParser.parsePdf(file, (pct) => {
        this.setProgress(pct);
      });

      this.pdfSonuclari = res.personeller;
      if (res.donem) {
        this.seciliDonem = res.donem;
        const sel = document.getElementById('select-donem');
        if (sel) sel.value = res.donem;
      }

      document.getElementById('info-pdf-result').className = 'badge badge-success';
      document.getElementById('info-pdf-result').innerText = `✅ ${res.personeller.length} Kişi Okundu (${res.donem || ''})`;
      document.getElementById('status-pdf').className = 'badge badge-success';
      document.getElementById('status-pdf').innerText = `✅ PDF: ${res.personeller.length} Kişi (${res.donem || ''})`;

      await window.sodsanDB.logAudit('Kullanıcı', 'PDF İçe Aktarma', `${res.personeller.length} personel raporu okundu.`);
      this.showToast('PDKS PDF raporu başarıyla ayrıştırıldı!', 'success');
      await this.tumunuHesapla();
    } catch (err) {
      console.error(err);
      this.showToast(`PDF Hatası: ${err.message}`, 'error');
    } finally {
      this.showProgress(false);
    }
  }

  async handleOdsUpload(file) {
    if (!file) return;
    this.showProgress(true, 'Muhasebe ODS tablosu inceleniyor...');
    try {
      const res = await window.odsBordroHandler.loadFile(file);
      const rows = window.odsBordroHandler.parseSheet(res.defaultSheet);

      document.getElementById('info-ods-result').className = 'badge badge-success';
      document.getElementById('info-ods-result').innerText = `✅ ${rows.length} Bordro Satırı (${res.defaultSheet})`;
      document.getElementById('status-ods').className = 'badge badge-success';
      document.getElementById('status-ods').innerText = `✅ ODS: ${rows.length} Satır (${res.defaultSheet})`;

      this.aktifBordro = rows;
      this.renderMaasBordroTable();
      this.renderOzetBordroTable();
      this.guncelleKpiKartlari();

      await window.sodsanDB.logAudit('Kullanıcı', 'ODS İçe Aktarma', `${rows.length} satır bordro yüklendi (${res.defaultSheet})`);
      this.showToast(`Muhasebe tablosu yüklendi (${res.defaultSheet})`, 'success');
    } catch (err) {
      console.error(err);
      this.showToast(`ODS Hatası: ${err.message}`, 'error');
    } finally {
      this.showProgress(false);
    }
  }

  /**
   * Projedeki kaynak_dosyalar klasöründeki dosyaları doğrudan yükler
   */
  /**
   * Veritabanını tamamen temizler ve kaynak dosyalardan Türkçe karakterlerle baştan yükler
   */
  async veritabaniniSifirlaVeYukle(auto = false) {
    if (!auto) {
      const onay = confirm('Tüm veritabanı temizlenip kaynak dosyalardan Türkçe karakterlerle baştan yüklenecektir. Devam edilsin mi?');
      if (!onay) return;
    }

    this.showProgress(true, 'Veritabanı sıfırlanıyor ve kaynak dosyalar Türkçe karakterlerle yeniden yükleniyor...');
    try {
      await window.sodsanDB.clearStore('personel');
      await window.sodsanDB.clearStore('giriscikis');
      await window.sodsanDB.clearStore('vardiyalar');
      await window.sodsanDB.clearStore('tatiller');
      await window.sodsanDB.clearStore('izinler');
      await window.sodsanDB.clearStore('puantaj');
      await window.sodsanDB.clearStore('maas_bordro');

      this.personeller = [];
      this.hamHareketler = [];
      this.izinler = [];
      this.pdfSonuclari = [];
      this.hesaplananPuantajlar = [];
      this.aktifBordro = [];

      await this.loadLocalSampleFiles(true);
      this.showToast('Veritabanı sıfırlandı ve Türkçe karakterlerle tertemiz yüklendi!', 'success');
    } catch (err) {
      console.error(err);
      this.showToast(`Sıfırlama Hatası: ${err.message}`, 'error');
    } finally {
      this.showProgress(false);
    }
  }

  /**
   * Projedeki kaynak_dosyalar klasöründeki dosyaları doğrudan yükler (Sıra: 1. DAT, 2. PDF, 3. ODS)
   */
  async loadLocalSampleFiles(isReset = false) {
    if (!isReset) {
      this.showProgress(true, 'Klasördeki kaynak dosyalar otomatik okunuyor...');
    }
    try {
      // 1. DAT Yükle (Ana personel listesi ve tüm hareketler)
      this.setProgress(25);
      try {
        const datUrl = 'kaynak_dosyalar/' + encodeURI('20261008_oto_yedek_perkotek.dat');
        const datResp = await fetch(datUrl);
        if (datResp.ok) {
          const datBlob = await datResp.blob();
          await this.handleDatUpload(datBlob);
        }
      } catch (e) {
        console.warn('DAT fetch atlandı:', e);
      }

      // 2. PDF Yükle (Eylül 2025 mutabakatı)
      this.setProgress(60);
      try {
        const pdfUrl = 'kaynak_dosyalar/' + encodeURI('01-30,09,2025.pdf');
        const pdfResp = await fetch(pdfUrl);
        if (pdfResp.ok) {
          const pdfBlob = await pdfResp.blob();
          await this.handlePdfUpload(pdfBlob);
        }
      } catch (e) {
        console.warn('PDF fetch atlandı:', e);
      }

      // 3. ODS Yükle (Muhasebe tablosu)
      this.setProgress(85);
      try {
        const odsUrl = 'kaynak_dosyalar/' + encodeURI('maaş hesaplama 2026.ods');
        const odsResp = await fetch(odsUrl);
        if (odsResp.ok) {
          const odsBlob = await odsResp.blob();
          await this.handleOdsUpload(odsBlob);
        }
      } catch (e) {
        console.warn('ODS fetch atlandı:', e);
      }

      this.setProgress(100);
      await this.verileriYukleVeGuncelle();
      if (!isReset) {
        this.showToast('Kaynak dosyalar başarıyla işlendi!', 'success');
      }
    } catch (err) {
      this.showToast(`Not: Tarayıcı doğrudan açıldıysa kutulara tıklayarak dosyaları seçebilirsiniz.`, 'info');
    } finally {
      if (!isReset) {
        this.showProgress(false);
      }
    }
  }

  // --- Veri Okuma & Yeniden Hesaplama ---

  async verileriYukleVeGuncelle() {
    this.personeller = await window.sodsanDB.getAll('personel');
    this.hamHareketler = await window.sodsanDB.getGirisCikisByDonem(this.seciliDonem);
    this.izinler = await window.sodsanDB.getAll('izinler');

    this.renderPersonelTable();
    this.updatePuantajPersonelSelect();

    // Veritabanında kayıtlı bordro var mı?
    const kayitliBordro = await window.sodsanDB.getMaasBordroByDonem(this.seciliDonem);
    if (kayitliBordro && kayitliBordro.length > 0) {
      this.aktifBordro = kayitliBordro;
      this.renderMaasBordroTable();
      this.renderOzetBordroTable();
      this.guncelleKpiKartlari();
    } else if (this.personeller.length > 0) {
      await this.tumunuHesapla();
    }
  }

  async tumunuHesapla() {
    if (this.personeller.length === 0 && this.pdfSonuclari.length === 0) {
      this.showToast('Hesaplama için lütfen önce DAT veya PDF dosyasını yükleyin.', 'warning');
      return;
    }

    this.showProgress(true, 'Puantaj ve maaşlar hesaplanıyor...');
    this.hesaplananPuantajlar = [];

    // PDF verileri varsa personellerle harmanla
    const pdfPersonelMap = new Map();
    this.pdfSonuclari.forEach(pdfP => pdfPersonelMap.set(pdfP.kartno, pdfP));

    // Personel listesi oluştur (DAT'tan veya PDF'ten)
    let islenecekPersoneller = [...this.personeller];
    if (islenecekPersoneller.length === 0 && this.pdfSonuclari.length > 0) {
      islenecekPersoneller = this.pdfSonuclari.map(p => ({
        id: parseInt(p.kartno, 10),
        kartno: p.kartno,
        adi: p.adi,
        soyadi: p.soyadi,
        adSoyad: p.adSoyad,
        netMaas: p.maas,
        girisTarihi: p.girisTarihi,
        cikisTarihi: p.cikisTarihi,
        aktif: true
      }));
    }

    islenecekPersoneller.forEach((personel) => {
      const pdfP = pdfPersonelMap.get(personel.kartno);
      const pdfGunleri = pdfP ? pdfP.gunler : null;

      // Ham hareketler
      const kisiHareketleri = this.hamHareketler.filter(h => h.kartno === personel.kartno || h.personel_id === personel.id);
      const kisiIzinleri = this.izinler.filter(i => i.personel_id === personel.id);

      const puantajSonuc = window.puantajEngine.hesaplaAylikPuantaj(
        personel,
        this.seciliDonem,
        kisiHareketleri,
        kisiIzinleri,
        pdfGunleri
      );

      // PDF'teki toplam fazla mesaiyi koru (mutabakat garantisi)
      if (pdfP && pdfP.toplamlar && pdfP.toplamlar.fazlaMesaiSaat > 0) {
        puantajSonuc.toplamlar.fazlaMesaiOndalik = pdfP.toplamlar.fazlaMesaiSaat;
        puantajSonuc.toplamlar.fazlaMesaiSaatStr = pdfP.toplamlar.fazlaMesai;
      }

      this.hesaplananPuantajlar.push(puantajSonuc);
    });

    // Otomatik Bordroyu üret
    this.aktifBordro = window.maasEngine.otomatikBordroOlustur(
      this.hesaplananPuantajlar,
      islenecekPersoneller,
      this.aktifBordro
    );

    this.renderMaasBordroTable();
    this.renderOzetBordroTable();
    this.guncelleKpiKartlari();

    const ilkKart = islenecekPersoneller[0] ? islenecekPersoneller[0].kartno : '';
    if (ilkKart) {
      const sel = document.getElementById('select-puantaj-personel');
      if (sel) sel.value = ilkKart;
      this.renderGunlukPuantaj(ilkKart);
    }

    this.showProgress(false);
    this.showToast(`${islenecekPersoneller.length} personelin puantaj ve maaş hesabı tamamlandı!`, 'success');
  }

  // --- Arayüz Render Metodları ---

  renderPersonelTable(filterQuery = '') {
    const tbody = document.getElementById('tbody-personel');
    if (!tbody) return;

    let list = this.personeller;
    if (list.length === 0 && this.pdfSonuclari.length > 0) {
      list = this.pdfSonuclari.map(p => ({
        kartno: p.kartno,
        adSoyad: p.adSoyad,
        unvani: 'Personel',
        girisTarihi: p.girisTarihi,
        netMaas: p.maas,
        aktif: true
      }));
    }

    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      list = list.filter(p => (p.adSoyad && p.adSoyad.toLowerCase().includes(q)) || (p.kartno && p.kartno.includes(q)));
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Personel bulunamadı.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => `
      <tr>
        <td><strong>${p.kartno}</strong></td>
        <td>${p.adSoyad}</td>
        <td>${p.unvani || '-'}</td>
        <td>${p.girisTarihi || '-'}</td>
        <td><strong>₺${(p.netMaas || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong></td>
        <td>${p.aktif !== false ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-gray">Pasif</span>'}</td>
        <td>${p.servisKod ? `Servis ${p.servisKod}` : 'Ulaşım'}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="app.showPersonelPuantaj('${p.kartno}')">Puantaj Aç</button>
        </td>
      </tr>
    `).join('');
  }

  updatePuantajPersonelSelect() {
    const sel = document.getElementById('select-puantaj-personel');
    if (!sel) return;

    let list = this.personeller;
    if (list.length === 0 && this.pdfSonuclari.length > 0) {
      list = this.pdfSonuclari;
    }

    sel.innerHTML = '<option value="">Seçiniz...</option>' + list.map(p => `
      <option value="${p.kartno}">${p.kartno} - ${p.adSoyad}</option>
    `).join('');
  }

  showPersonelPuantaj(kartno) {
    this.navTo('tab-puantaj');
    const sel = document.getElementById('select-puantaj-personel');
    if (sel) sel.value = kartno;
    this.renderGunlukPuantaj(kartno);
  }

  renderGunlukPuantaj(kartno) {
    const tbody = document.getElementById('tbody-gunluk-puantaj');
    if (!tbody || !kartno) return;

    const pntData = this.hesaplananPuantajlar.find(p => p.kartno === kartno);
    const pdfData = this.pdfSonuclari.find(p => p.kartno === kartno);

    if (!pntData && !pdfData) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">Puantaj verisi bulunamadı.</td></tr>`;
      return;
    }

    const data = pntData || pdfData;
    document.getElementById('puantaj-txt-ad').innerText = data.adSoyad;
    document.getElementById('puantaj-txt-kart').innerText = data.kartno;
    document.getElementById('puantaj-txt-mesai').innerText = data.toplamlar.fazlaMesai || data.toplamlar.fazlaMesaiSaatStr || '00:00';
    document.getElementById('puantaj-txt-gecikme').innerText = data.toplamlar.gecGelme || data.toplamlar.gecGelmeSaatStr || '00:00';
    document.getElementById('puantaj-txt-devamsiz').innerText = `${data.toplamlar.devamsizlikGun || 0} gün`;

    tbody.innerHTML = data.gunler.map(g => {
      let durumBadge = '';
      if (g.durumu === 'HAFTA TATİLİ') durumBadge = '<span class="badge badge-gray">HAFTA TATİLİ</span>';
      else if (g.durumu === 'YILLIK İZİN') durumBadge = '<span class="badge badge-info">YILLIK İZİN</span>';
      else if (g.durumu === 'RAPORLU') durumBadge = '<span class="badge badge-warning">RAPORLU</span>';
      else if (g.durumu === 'Devamsız') durumBadge = '<span class="badge badge-danger">Devamsız</span>';
      else if (g.durumu) durumBadge = `<span class="badge badge-info">${g.durumu}</span>`;

      let mesaiBadge = g.fazlaMesai ? `<strong style="color: #d97706;">${g.fazlaMesai}</strong>` : '-';
      let gecikmeBadge = g.gecGelme ? `<span style="color: #dc2626;">${g.gecGelme}</span>` : '-';

      return `
        <tr class="${g.durumu === 'HAFTA TATİLİ' ? 'weekend' : ''}">
          <td><strong>${g.tarih}</strong></td>
          <td>${g.gunAdi}</td>
          <td>${g.giris || '-'} ${g.girisEM ? '*' : ''}</td>
          <td>${g.cikis || '-'} ${g.cikisEM ? '*' : ''}</td>
          <td><small>${g.vardiya || '-'}</small></td>
          <td>${durumBadge}</td>
          <td>${gecikmeBadge}</td>
          <td>${g.erkenCikma || '-'}</td>
          <td>${mesaiBadge}</td>
          <td>${g.uyari ? `<span class="badge badge-danger">${g.uyari}</span>` : ''}</td>
        </tr>
      `;
    }).join('');
  }

  renderMaasBordroTable() {
    const tbody = document.getElementById('tbody-maas-bordro');
    const tfoot = document.getElementById('tfoot-maas-bordro');
    if (!tbody) return;

    if (this.aktifBordro.length === 0) {
      tbody.innerHTML = `<tr><td colspan="21" style="text-align: center; color: var(--text-muted);">Bordro verisi bulunamadı.</td></tr>`;
      return;
    }

    let totMaas = 0, totAvans = 0, totMesaiSaat = 0, totMesaiUcret = 0, totBanka = 0, totUlasim = 0, totGenelToplam = 0;

    tbody.innerHTML = this.aktifBordro.map((b, idx) => {
      totMaas += b.maas || 0;
      totAvans += b.avans || 0;
      totMesaiSaat += b.mesaiSaat || 0;
      totMesaiUcret += b.bMesaiUcreti || 0;
      totBanka += b.bankaYatan || 0;
      totUlasim += b.ulasimUcreti || 0;
      totGenelToplam += b.toplam || 0;

      return `
        <tr>
          <td>${b.sira || (idx + 1)}</td>
          <td><strong>${b.adSoyad}</strong></td>
          <td>
            <input type="number" step="0.01" value="${b.maas}" class="cell-input" onchange="app.onCellEdit(${idx}, 'maas', this.value)" style="width: 90px; font-weight: 600;">
          </td>
          <td style="background: #fffbeb;">
            <input type="number" step="0.01" value="${b.avans}" class="cell-input" onchange="app.onCellEdit(${idx}, 'avans', this.value)" style="width: 80px; color: #b45309;">
          </td>
          <td>
            <input type="number" step="0.25" value="${b.mesaiSaat}" class="cell-input" onchange="app.onCellEdit(${idx}, 'mesaiSaat', this.value)" style="width: 65px; font-weight: 700;">
          </td>
          <td><strong>₺${(b.bMesaiUcreti || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong></td>
          <td>
            <input type="number" step="0.5" value="${b.resmiBayramMesaiSaat}" class="cell-input" onchange="app.onCellEdit(${idx}, 'resmiBayramMesaiSaat', this.value)" style="width: 55px;">
          </td>
          <td>₺${(b.resmiBayramMesaiUcreti || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
          <td style="background: #ecfdf5;">
            <strong style="color: #15803d; font-size: 0.95rem;">₺${(b.bankaYatan || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong>
          </td>
          <td>
            <input type="number" step="0.01" value="${b.besIcra}" class="cell-input" onchange="app.onCellEdit(${idx}, 'besIcra', this.value)" style="width: 75px; color: #dc2626;">
          </td>
          <td>${b.ekMesaiSaat || 0}</td>
          <td>₺${(b.ekMesaiUcreti || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
          <td>
            <input type="number" step="0.01" value="${b.kesinti}" class="cell-input" onchange="app.onCellEdit(${idx}, 'kesinti', this.value)" style="width: 70px; color: #dc2626;">
          </td>
          <td>
            <input type="number" step="1" value="${b.ulasimAdet}" class="cell-input" onchange="app.onCellEdit(${idx}, 'ulasimAdet', this.value)" style="width: 50px;">
          </td>
          <td>₺${(b.ulasimUcreti || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
          <td>
            <input type="number" step="0.01" value="${b.prim}" class="cell-input" onchange="app.onCellEdit(${idx}, 'prim', this.value)" style="width: 70px; color: #16a34a;">
          </td>
          <td>${b.servisKullanim || 0}</td>
          <td style="background: #eff6ff;">
            <strong style="color: #1d4ed8; font-size: 0.95rem;">₺${(b.toplam || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong>
          </td>
          <td>${b.multimet || 0}</td>
          <td>
            <input type="text" value="${b.aciklama || ''}" class="cell-input" onchange="app.onCellEdit(${idx}, 'aciklama', this.value)" style="width: 180px;">
          </td>
          <td>${b.ulasimTuru || '-'}</td>
        </tr>
      `;
    }).join('');

    // Genel Toplam Satırı
    if (tfoot) {
      tfoot.innerHTML = `
        <tr style="background: #f1f5f9; font-weight: 700; border-top: 2px solid var(--secondary);">
          <td colspan="2">GENEL TOPLAM (${this.aktifBordro.length} Personel)</td>
          <td>₺${totMaas.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
          <td style="color: #b45309;">₺${totAvans.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
          <td>${totMesaiSaat.toFixed(2)} sa</td>
          <td style="color: #d97706;">₺${totMesaiUcret.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
          <td colspan="2">-</td>
          <td style="color: #15803d; font-size: 1rem;">₺${totBanka.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
          <td colspan="5">Ulaşım: ₺${totUlasim.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
          <td colspan="2">-</td>
          <td style="color: #1d4ed8; font-size: 1rem;">₺${totGenelToplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
          <td colspan="3">-</td>
        </tr>
      `;
    }
  }

  onCellEdit(idx, field, value) {
    const row = this.aktifBordro[idx];
    if (!row) return;

    const eskiDeger = row[field];
    row[field] = field === 'aciklama' ? value : (parseFloat(value) || 0);
    row.manuelMi = true;

    // Tekrar hesapla
    const yenilenmis = window.maasEngine.hesaplaPersonelBordro({
      ...row,
      aylar: this.ayarlar
    });

    this.aktifBordro[idx] = yenilenmis;
    this.renderMaasBordroTable();
    this.renderOzetBordroTable();
    this.guncelleKpiKartlari();

    window.sodsanDB.logAudit('Kullanıcı', 'Bordro Düzenleme', `${row.adSoyad} için ${field} güncellendi`, eskiDeger, value);
  }

  renderOzetBordroTable() {
    const tbody = document.getElementById('tbody-ozet-bordro');
    if (!tbody) return;

    if (this.aktifBordro.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">Bordro verisi bulunamadı.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.aktifBordro.slice(0, 15).map(b => `
      <tr>
        <td>${b.sira}</td>
        <td><strong>${b.adSoyad}</strong></td>
        <td>${b.kartno || '-'}</td>
        <td>₺${(b.maas || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
        <td><strong>${b.mesaiSaat || 0} sa</strong></td>
        <td>₺${(b.bMesaiUcreti || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
        <td>₺${(b.avans || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
        <td><strong style="color: #15803d;">₺${(b.bankaYatan || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong></td>
        <td>₺${(b.ulasimUcreti || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
        <td><strong style="color: #1d4ed8;">₺${(b.toplam || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong></td>
      </tr>
    `).join('');

    if (this.aktifBordro.length > 15) {
      tbody.innerHTML += `<tr><td colspan="10" style="text-align: center; font-weight: 600; color: var(--primary);">... ve diğer ${this.aktifBordro.length - 15} personel (Tümünü görmek için "Maaş & Muhasebe Bordrosu" sekmesine geçiniz)</td></tr>`;
    }
  }

  guncelleKpiKartlari() {
    let totMesaiSaat = 0;
    let totMesaiTutar = 0;
    let totBankaYatan = 0;
    let totAvans = 0;
    let istisnaSayisi = 0;

    this.aktifBordro.forEach(b => {
      totMesaiSaat += b.mesaiSaat || 0;
      totMesaiTutar += b.bMesaiUcreti || 0;
      totBankaYatan += b.bankaYatan || 0;
      totAvans += b.avans || 0;
    });

    this.hesaplananPuantajlar.forEach(p => {
      p.gunler.forEach(g => {
        if (g.uyari || g.pdfUyusmazlik) istisnaSayisi++;
      });
    });

    document.getElementById('kpi-personel-sayisi').innerText = this.aktifBordro.length || this.personeller.length;
    document.getElementById('kpi-toplam-personel').innerText = `Kayıtlı: ${this.personeller.length || this.aktifBordro.length} personel`;
    document.getElementById('kpi-toplam-mesai').innerText = `${totMesaiSaat.toFixed(1)} saat`;
    document.getElementById('kpi-mesai-tutar').innerText = `Hakediş: ₺${totMesaiTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
    document.getElementById('kpi-banka-yatan').innerText = `₺${totBankaYatan.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
    document.getElementById('kpi-avans-tutar').innerText = `Avanslar: ₺${totAvans.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
    document.getElementById('kpi-istisna-sayisi').innerText = istisnaSayisi;
  }

  // --- Dışa Aktarma & Kaydetme ---

  async saveBordroToDb() {
    if (this.aktifBordro.length === 0) {
      this.showToast('Kaydedilecek bordro bulunmuyor.', 'warning');
      return;
    }

    const itemsToSave = this.aktifBordro.map(b => ({
      ...b,
      donem: this.seciliDonem
    }));

    await window.sodsanDB.bulkPut('maas_bordro', itemsToSave);
    await window.sodsanDB.logAudit('Kullanıcı', 'Bordro Onayı', `${this.seciliDonem} dönemi bordrosu (${itemsToSave.length} kişi) kaydedildi.`);
    this.showToast(`${this.seciliDonem} bordrosu yerel veritabanına kaydedildi!`, 'success');
  }

  exportBordro(format = 'ods') {
    if (this.aktifBordro.length === 0) {
      this.showToast('Dışa aktarılacak bordro bulunmuyor.', 'warning');
      return;
    }

    const donemText = document.getElementById('select-donem').options[document.getElementById('select-donem').selectedIndex].text;
    const dosyaAdi = window.odsBordroHandler.exportToOds(this.aktifBordro, donemText, format);
    this.showToast(`Bordro dosyası indirildi: ${dosyaAdi}`, 'success');
  }

  // --- Ayarlar Yönetimi ---

  loadAyarlarForm() {
    if (!this.ayarlar) return;
    document.getElementById('setting-aylik-norm').value = this.ayarlar.aylikCalismaSaati || 225;
    document.getElementById('setting-mesai-carpani').value = this.ayarlar.fazlaMesaiCarpani || 1.5;
    document.getElementById('setting-bayram-carpani').value = this.ayarlar.resmiBayramCarpani || 2.0;

    const uf = this.ayarlar.ulasimFiyatlari || {};
    if (uf['MİNİBÜS']) document.getElementById('setting-ulasim-minibus').value = uf['MİNİBÜS'];
    if (uf['METRO']) document.getElementById('setting-ulasim-metro').value = uf['METRO'];
    if (uf['OTOBÜS']) document.getElementById('setting-ulasim-otobus').value = uf['OTOBÜS'];
    if (uf['MUDANYA OTOBÜS']) document.getElementById('setting-ulasim-mudanya-otobus').value = uf['MUDANYA OTOBÜS'];
    if (uf['MUDANYA MİNİBÜS']) document.getElementById('setting-ulasim-mudanya-minibus').value = uf['MUDANYA MİNİBÜS'];
  }

  async saveAyarlar() {
    const norm = parseFloat(document.getElementById('setting-aylik-norm').value) || 225;
    const mesaiCarpani = parseFloat(document.getElementById('setting-mesai-carpani').value) || 1.5;
    const bayramCarpani = parseFloat(document.getElementById('setting-bayram-carpani').value) || 2.0;

    const uf = {
      'MİNİBÜS': parseFloat(document.getElementById('setting-ulasim-minibus').value) || 40,
      'METRO': parseFloat(document.getElementById('setting-ulasim-metro').value) || 40,
      'OTOBÜS': parseFloat(document.getElementById('setting-ulasim-otobus').value) || 52,
      'MUDANYA OTOBÜS': parseFloat(document.getElementById('setting-ulasim-mudanya-otobus').value) || 53,
      'MUDANYA MİNİBÜS': parseFloat(document.getElementById('setting-ulasim-mudanya-minibus').value) || 65
    };

    await window.sodsanDB.setAyar('aylikCalismaSaati', norm);
    await window.sodsanDB.setAyar('fazlaMesaiCarpani', mesaiCarpani);
    await window.sodsanDB.setAyar('resmiBayramCarpani', bayramCarpani);
    await window.sodsanDB.setAyar('ulasimFiyatlari', uf);

    this.ayarlar = await window.sodsanDB.getAyarlar();
    this.showToast('Hesaplama kuralları ve katsayılar güncellendi!', 'success');
    await this.tumunuHesapla();
  }

  // --- UI Bildirim Yardımcıları ---

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  showProgress(show, text = 'İşleniyor...') {
    const container = document.getElementById('import-progress-container');
    const txt = document.getElementById('import-status-text');
    if (container) container.style.display = show ? 'block' : 'none';
    if (txt) txt.innerText = text;
    if (show) this.setProgress(0);
  }

  setProgress(pct) {
    const bar = document.getElementById('import-progress-bar');
    const txt = document.getElementById('import-percent');
    if (bar) bar.style.width = `${pct}%`;
    if (txt) txt.innerText = `${pct}%`;
  }
}

// Global uygulama başlatıcı
window.app = new SodsanApp();
window.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
