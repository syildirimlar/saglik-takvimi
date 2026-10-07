/**
 * Sağlık & Yaşam Takvim Programı - Ana Kontrolcü (App Controller)
 * Sekme geçişleri, modal kontrolleri, form yönetimi, tema ve toast bildirimleri.
 */

// Global Bildirim Gösterici (Toast)
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'info') icon = 'ℹ️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

const App = {
  currentTab: 'calendar',
  activeEditingEventId: null,

  init() {
    try { this.setupTheme(); } catch (e) { console.error('Theme hatası:', e); }
    try { this.setupNavigationTabs(); } catch (e) { console.error('Tabs hatası:', e); }
    try { this.setupQuickButtons(); } catch (e) { console.error('QuickButtons hatası:', e); }
    try { this.setupModal(); } catch (e) { console.error('Modal hatası:', e); }
    try { this.setupAllEventsListView(); } catch (e) { console.error('ListView hatası:', e); }
    try { this.setupBackupTab(); } catch (e) { console.error('BackupTab hatası:', e); }

    // Alt modülleri başlat
    try { CategoryManager.init(); } catch (e) { console.error('CategoryManager hatası:', e); }
    try { Calendar.init(); } catch (e) { console.error('Calendar hatası:', e); }
    try { Reports.init(); } catch (e) { console.error('Reports hatası:', e); }
    try { this.setupNotificationEngine(); } catch (e) { console.error('Notification hatası:', e); }

    // İlk açılışta eğer hiç veri yoksa kullanıcıya ipucu ver veya demo teklifi yap
    try {
      const events = Storage.getEvents();
      if (events.length === 0) {
        setTimeout(() => {
          showToast('Hoş geldiniz! Takvimi test etmek için "✨ Örnek Veri" butonuna tıklayabilirsiniz.', 'info');
        }, 800);
      }
    } catch (e) {
      console.error(e);
    }
  },

  // Tüm görünümleri senkronize yenile
  refreshAllViews() {
    CategoryManager.populateAllCategoryDropdowns();
    CategoryManager.renderCategoryCards();
    Calendar.render();
    Reports.render();
    this.renderAllEventsList();
    this.checkScheduledAppointments();
    this.updateDemoButtonState();
  },

  // ================= 1. TEMA YÖNETİMİ =================
  setupTheme() {
    const themeBtn = document.getElementById('btn-toggle-theme');
    const themeIcon = document.getElementById('theme-icon');
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';

    if (savedTheme === 'dark') {
      document.body.classList.remove('light-mode');
      document.body.classList.add('dark-mode');
      if (themeIcon) themeIcon.textContent = '☀️';
    } else {
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
      if (themeIcon) themeIcon.textContent = '🌙';
    }

    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-mode');
        if (isDark) {
          document.body.classList.remove('dark-mode');
          document.body.classList.add('light-mode');
          if (themeIcon) themeIcon.textContent = '🌙';
          localStorage.setItem(STORAGE_KEYS.THEME, 'light');
        } else {
          document.body.classList.remove('light-mode');
          document.body.classList.add('dark-mode');
          if (themeIcon) themeIcon.textContent = '☀️';
          localStorage.setItem(STORAGE_KEYS.THEME, 'dark');
        }
      });
    }
  },

  // ================= 2. SEKME GEÇİŞLERİ =================
  setupNavigationTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        this.currentTab = targetTab;

        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const targetContent = document.getElementById(`tab-${targetTab}`);
        if (targetContent) targetContent.classList.add('active');

        // Sekmeye özel yenilemeler
        if (targetTab === 'calendar') {
          Calendar.render();
        } else if (targetTab === 'reports') {
          Reports.render();
        } else if (targetTab === 'list') {
          this.renderAllEventsList();
        } else if (targetTab === 'categories') {
          CategoryManager.renderCategoryCards();
        }
      });
    });
  },

  // ================= 3. HIZLI İŞLEM BUTONLARI =================
  setupQuickButtons() {
    // Üst Çubuk: WC Butonu
    const wcBtn = document.getElementById('btn-quick-wc');
    if (wcBtn) {
      wcBtn.addEventListener('click', () => {
        this.openEventModal(null, null, 'wc');
      });
    }

    // Üst Çubuk: Baş Ağrısı Butonu
    const headacheBtn = document.getElementById('btn-quick-headache');
    if (headacheBtn) {
      headacheBtn.addEventListener('click', () => {
        this.openEventModal(null, null, 'headache');
      });
    }

    // Üst Çubuk: Spor Butonu
    const sportBtn = document.getElementById('btn-quick-sport');
    if (sportBtn) {
      sportBtn.addEventListener('click', () => {
        this.openEventModal(null, null, 'sport');
      });
    }

    // Üst Çubuk: Masaj Butonu
    const massageBtn = document.getElementById('btn-quick-massage');
    if (massageBtn) {
      massageBtn.addEventListener('click', () => {
        this.openEventModal(null, null, 'massage');
      });
    }

    // Üst Çubuk: Yeni Olay Ekle Butonu
    const addBtn = document.getElementById('btn-open-add-modal');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.openEventModal();
      });
    }

    // Üst Çubuk: Örnek Veri Yükle Butonu
    const demoBtn = document.getElementById('btn-load-demo');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        this.loadDemo();
      });
    }

    // Üst Çubuk: Örnek Verileri Temizle / Kaldır Butonu
    const clearDemoBtn = document.getElementById('btn-clear-demo');
    if (clearDemoBtn) {
      clearDemoBtn.addEventListener('click', () => {
        this.clearDemoData();
      });
    }

    this.updateDemoButtonState();
  },

  updateDemoButtonState() {
    const hasDemo = Storage.hasDemoData();
    const clearBtn1 = document.getElementById('btn-clear-demo');
    const clearBtn2 = document.getElementById('btn-clear-demo-2');

    if (clearBtn1) {
      clearBtn1.style.display = 'inline-flex';
      clearBtn1.innerHTML = hasDemo ? '<span>🗑️ Örnekleri Temizle</span>' : '<span>🗑️ Takvimi Temizle</span>';
    }
    if (clearBtn2) {
      clearBtn2.style.display = 'inline-flex';
    }
  },

  loadDemo() {
    if (confirm('30 günlük gerçekçi örnek kayıtlar yüklenecek. Devam etmek istiyor musunuz?')) {
      const count = Storage.loadDemoData();
      this.refreshAllViews();
      showToast(`${count} adet örnek kayıt başarıyla yüklendi!`, 'success');
    }
  },

  clearDemoData() {
    const events = Storage.getEvents();
    if (events.length === 0) {
      showToast('Takvim zaten tertemiz ve boş durumda! ✨', 'info');
      return;
    }

    if (confirm('Takvimdeki kayıtları temizlemek istediğinize emin misiniz? (Örnek veriler ve olaylar silinerek takvim sıfırlanacaktır)')) {
      Storage.clearAllData();
      this.refreshAllViews();
      showToast('Takvim başarıyla temizlendi ve sıfırlandı! 👍', 'success');
    }
  },

  // ================= 4. MODAL & FORM YÖNETİMİ =================
  setupModal() {
    const modal = document.getElementById('modal-event');
    const closeBtn = document.getElementById('modal-btn-close');
    const cancelBtn = document.getElementById('modal-btn-cancel');
    const form = document.getElementById('form-event');
    const delBtn = document.getElementById('modal-btn-delete');

    // Kapatma butonları
    const closeModal = () => {
      if (modal) {
        try {
          if (modal.open) modal.close();
        } catch (err) {
          modal.removeAttribute('open');
          modal.style.display = 'none';
        }
      }
      this.activeEditingEventId = null;
    };
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Baş Ağrısı Şiddet Slider'ı
    const hSlider = document.getElementById('headache-intensity');
    const hBadge = document.getElementById('headache-intensity-badge');
    if (hSlider && hBadge) {
      hSlider.addEventListener('input', () => {
        const val = parseInt(hSlider.value, 10);
        let text = `${val} / 10 - Orta`;
        let cls = 'level-5';

        if (val <= 2) { text = `${val} / 10 - Çok Hafif`; cls = 'level-1'; }
        else if (val <= 4) { text = `${val} / 10 - Hafif`; cls = 'level-3'; }
        else if (val <= 6) { text = `${val} / 10 - Orta`; cls = 'level-5'; }
        else if (val <= 8) { text = `${val} / 10 - Şiddetli`; cls = 'level-7'; }
        else { text = `${val} / 10 - Çok Şiddetli / Dayanılmaz`; cls = 'level-10'; }

        hBadge.textContent = text;
        hBadge.className = `intensity-badge ${cls}`;
      });
    }

    // Baş Ağrısı İlaç Checkbox'ı
    const medCheckbox = document.getElementById('headache-med-taken');
    const medNameInput = document.getElementById('headache-med-name');
    if (medCheckbox && medNameInput) {
      medCheckbox.addEventListener('change', () => {
        medNameInput.style.display = medCheckbox.checked ? 'block' : 'none';
        if (medCheckbox.checked) medNameInput.focus();
      });
    }

    // Genel Şiddet Slider'ı
    const gSlider = document.getElementById('generic-intensity');
    const gBadge = document.getElementById('generic-intensity-badge');
    if (gSlider && gBadge) {
      gSlider.addEventListener('input', () => {
        const val = parseInt(gSlider.value, 10);
        gBadge.textContent = `${val} / 10`;
      });
    }

    // Masaj Rahatlama Slider'ı
    const mSlider = document.getElementById('massage-relief');
    const mBadge = document.getElementById('massage-relief-badge');
    if (mSlider && mBadge) {
      mSlider.addEventListener('input', () => {
        const val = parseInt(mSlider.value, 10);
        let text = `${val} / 10 - İyi`;
        let cls = 'level-7';
        if (val <= 3) { text = `${val} / 10 - Az Etki`; cls = 'level-1'; }
        else if (val <= 6) { text = `${val} / 10 - Orta Rahatlama`; cls = 'level-5'; }
        else if (val <= 8) { text = `${val} / 10 - Çok İyi`; cls = 'level-7'; }
        else { text = `${val} / 10 - Mükemmel Rahatlama`; cls = 'level-10'; }
        mBadge.textContent = text;
        mBadge.className = `intensity-badge ${cls}`;
      });
    }

    // Etkinlik Durumu (Tamamlandı vs Randevu) Değişimi
    const statusRadios = form.querySelectorAll('input[name="event-status"]');
    const hintBox = document.getElementById('status-hint-box');
    statusRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (hintBox) {
          hintBox.style.display = radio.value === 'planned' ? 'block' : 'none';
        }
      });
    });

    // Tarih veya saat değiştiğinde gelecekteyse otomatik "Randevu" modunu seç
    const dateInput = document.getElementById('event-date');
    const timeInput = document.getElementById('event-time');
    const checkFutureDate = () => {
      if (dateInput.value && timeInput.value && !this.activeEditingEventId) {
        const selectedDt = new Date(`${dateInput.value}T${timeInput.value}`);
        if (selectedDt > new Date()) {
          const plannedRadio = form.querySelector('input[name="event-status"][value="planned"]');
          if (plannedRadio) {
            plannedRadio.checked = true;
            if (hintBox) hintBox.style.display = 'block';
          }
        }
      }
    };
    if (dateInput) dateInput.addEventListener('change', checkFutureDate);
    if (timeInput) timeInput.addEventListener('change', checkFutureDate);

    // Modal Silme Butonu
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (this.activeEditingEventId) {
          if (confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
            Storage.deleteEvent(this.activeEditingEventId);
            closeModal();
            this.refreshAllViews();
            showToast('Kayıt silindi.', 'info');
          }
        }
      });
    }

    // Form Gönderimi (Ekle / Güncelle)
    let isSaving = false;
    const handleSave = (e) => {
      if (e) e.preventDefault();
      if (isSaving) return;
      isSaving = true;
      try {
        const saved = this.saveEventFromModal();
        if (saved !== false) {
          closeModal();
        }
      } catch (err) {
        console.error('Kaydetme hatası:', err);
        alert('Kaydetme sırasında bir hata oluştu: ' + err.message);
      } finally {
        setTimeout(() => { isSaving = false; }, 300);
      }
    };

    if (form) {
      form.addEventListener('submit', handleSave);
    }

    const saveBtn = document.getElementById('modal-btn-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        if (form && typeof form.checkValidity === 'function' && !form.checkValidity()) {
          form.reportValidity();
          return;
        }
        handleSave(e);
      });
    }
  },

  // Modalı Aç (Yeni veya Düzenleme)
  openEventModal(eventToEdit = null, defaultDateStr = null, defaultCategoryId = null) {
    const modal = document.getElementById('modal-event');
    const modalTitle = document.getElementById('modal-event-title');
    const delBtn = document.getElementById('modal-btn-delete');
    const form = document.getElementById('form-event');

    if (!modal) return;
    form.reset();

    const dateInput = document.getElementById('event-date');
    const timeInput = document.getElementById('event-time');
    const notesInput = document.getElementById('event-notes');
    const medNameInput = document.getElementById('headache-med-name');
    if (medNameInput) medNameInput.style.display = 'none';

    const now = new Date();
    const todayStr = Calendar.formatDate(now);
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (eventToEdit) {
      // Düzenleme Modu
      this.activeEditingEventId = eventToEdit.id;
      modalTitle.textContent = 'Kaydı Düzenle';
      if (delBtn) delBtn.style.display = 'inline-flex';

      document.getElementById('event-edit-id').value = eventToEdit.id;
      if (dateInput) dateInput.value = eventToEdit.date;
      if (timeInput) timeInput.value = eventToEdit.time || '12:00';
      if (notesInput) notesInput.value = eventToEdit.notes || '';

      CategoryManager.renderModalCategoryPills(eventToEdit.categoryId);

      // Kategori Detaylarını Doldur
      if (eventToEdit.categoryId === 'wc') {
        const r = form.querySelector(`input[name="wc-type"][value="${eventToEdit.details?.wcType || 'Küçük (İdrar)'}"]`);
        if (r) r.checked = true;
        const cond = document.getElementById('wc-condition');
        if (cond) cond.value = eventToEdit.details?.wcCondition || 'Normal';
      } else if (eventToEdit.categoryId === 'headache') {
        const hSlider = document.getElementById('headache-intensity');
        if (hSlider) {
          hSlider.value = eventToEdit.details?.intensity || 5;
          hSlider.dispatchEvent(new Event('input'));
        }
        const loc = document.getElementById('headache-location');
        if (loc) loc.value = eventToEdit.details?.location || 'Şakaklar';
        const trig = document.getElementById('headache-trigger');
        if (trig) trig.value = eventToEdit.details?.trigger || 'Bilinmiyor';
        const medTaken = document.getElementById('headache-med-taken');
        if (medTaken) {
          medTaken.checked = !!eventToEdit.details?.medTaken;
          medTaken.dispatchEvent(new Event('change'));
        }
        if (medNameInput) medNameInput.value = eventToEdit.details?.medName || '';
      } else if (eventToEdit.categoryId === 'sport') {
        const spType = document.getElementById('sport-type');
        if (spType) spType.value = eventToEdit.details?.sportType || 'Yürüyüş';
        const spDur = document.getElementById('sport-duration');
        if (spDur) spDur.value = eventToEdit.details?.duration || eventToEdit.details?.quantity || 30;
        const spInt = form.querySelector(`input[name="sport-intensity"][value="${eventToEdit.details?.intensityLevel || 'Orta Seviye'}"]`);
        if (spInt) spInt.checked = true;
      } else if (eventToEdit.categoryId === 'massage') {
        const mArea = document.getElementById('massage-area');
        if (mArea) mArea.value = eventToEdit.details?.massageArea || 'Boyun & Omuz';
        const mDur = document.getElementById('massage-duration');
        if (mDur) mDur.value = eventToEdit.details?.duration || eventToEdit.details?.quantity || 20;
        const mSlider = document.getElementById('massage-relief');
        if (mSlider) {
          mSlider.value = eventToEdit.details?.reliefScore || eventToEdit.details?.intensity || 8;
          mSlider.dispatchEvent(new Event('input'));
        }
        const mProv = document.getElementById('massage-provider');
        if (mProv) mProv.value = eventToEdit.details?.provider || 'Kendim';
      } else {
        if (eventToEdit.details?.intensity) {
          const gSlider = document.getElementById('generic-intensity');
          if (gSlider) {
            gSlider.value = eventToEdit.details.intensity;
            gSlider.dispatchEvent(new Event('input'));
          }
        }
        if (eventToEdit.details?.quantity !== undefined) {
          const qty = document.getElementById('generic-quantity');
          if (qty) qty.value = eventToEdit.details.quantity;
        }
      }

      // Durumu doldur (Yapıldı vs Randevu)
      const statusVal = eventToEdit.status || 'completed';
      const statusRadio = form.querySelector(`input[name="event-status"][value="${statusVal}"]`);
      if (statusRadio) statusRadio.checked = true;
      const hintBox = document.getElementById('status-hint-box');
      if (hintBox) hintBox.style.display = statusVal === 'planned' ? 'block' : 'none';

    } else {
      // Yeni Ekleme Modu
      this.activeEditingEventId = null;
      modalTitle.textContent = 'Yeni Olay Kaydet';
      if (delBtn) delBtn.style.display = 'none';

      document.getElementById('event-edit-id').value = '';
      if (dateInput) dateInput.value = defaultDateStr || Calendar.selectedDateStr || todayStr;
      if (timeInput) timeInput.value = currentTimeStr;
      if (notesInput) notesInput.value = '';

      const targetCatId = defaultCategoryId || 'wc';
      CategoryManager.renderModalCategoryPills(targetCatId);

      // Baş ağrısı slider varsayılanı tetikle
      const hSlider = document.getElementById('headache-intensity');
      if (hSlider) {
        hSlider.value = 5;
        hSlider.dispatchEvent(new Event('input'));
      }
      // Masaj slider varsayılanı tetikle
      const mSlider = document.getElementById('massage-relief');
      if (mSlider) {
        mSlider.value = 8;
        mSlider.dispatchEvent(new Event('input'));
      }

      // Başlangıç durumunu ayarla (Gelecek gün seçildiyse varsayılan Randevu)
      const isFutureDate = (dateInput.value > todayStr) || (dateInput.value === todayStr && timeInput.value > currentTimeStr);
      const initialStatus = isFutureDate ? 'planned' : 'completed';
      const statusRadio = form.querySelector(`input[name="event-status"][value="${initialStatus}"]`);
      if (statusRadio) statusRadio.checked = true;
      const hintBox = document.getElementById('status-hint-box');
      if (hintBox) hintBox.style.display = initialStatus === 'planned' ? 'block' : 'none';
    }

    modal.showModal();
  },

  // Modal Verisini Kaydet
  saveEventFromModal() {
    const editId = document.getElementById('event-edit-id')?.value || '';
    const catId = document.getElementById('event-category')?.value || 'wc';
    const dateInput = document.getElementById('event-date');
    const timeInput = document.getElementById('event-time');
    const notesInput = document.getElementById('event-notes');

    const date = dateInput ? dateInput.value : Calendar.formatDate(new Date());
    const time = timeInput ? timeInput.value : '12:00';
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!catId || !date) {
      alert('Lütfen zorunlu alanları (Kategori ve Tarih) doldurun.');
      return false;
    }

    const details = {};

    if (catId === 'wc') {
      const selectedType = document.querySelector('input[name="wc-type"]:checked')?.value || 'Küçük (İdrar)';
      const cond = document.getElementById('wc-condition')?.value || 'Normal';
      details.wcType = selectedType;
      details.wcCondition = cond;
    } else if (catId === 'headache') {
      const intensity = parseInt(document.getElementById('headache-intensity')?.value, 10) || 5;
      const location = document.getElementById('headache-location')?.value || '';
      const trigger = document.getElementById('headache-trigger')?.value || '';
      const medTaken = document.getElementById('headache-med-taken')?.checked || false;
      const medName = document.getElementById('headache-med-name')?.value.trim() || '';

      details.intensity = intensity;
      details.location = location;
      details.trigger = trigger;
      details.medTaken = medTaken;
      if (medTaken) details.medName = medName;
    } else if (catId === 'sport') {
      const spType = document.getElementById('sport-type')?.value || 'Yürüyüş';
      const spDur = parseInt(document.getElementById('sport-duration')?.value, 10) || 30;
      const spInt = document.querySelector('input[name="sport-intensity"]:checked')?.value || 'Orta Seviye';
      details.sportType = spType;
      details.duration = spDur;
      details.intensityLevel = spInt;
      details.quantity = spDur;
      details.unit = 'dk';
    } else if (catId === 'massage') {
      const mArea = document.getElementById('massage-area')?.value || 'Boyun & Omuz';
      const mDur = parseInt(document.getElementById('massage-duration')?.value, 10) || 20;
      const mRelief = parseInt(document.getElementById('massage-relief')?.value, 10) || 8;
      const mProv = document.getElementById('massage-provider')?.value || 'Kendim';
      details.massageArea = mArea;
      details.duration = mDur;
      details.reliefScore = mRelief;
      details.provider = mProv;
      details.intensity = mRelief;
      details.quantity = mDur;
      details.unit = 'dk';
    } else {
      const cat = Storage.getCategoryById(catId);
      if (cat?.hasIntensity) {
        details.intensity = parseInt(document.getElementById('generic-intensity')?.value, 10) || 5;
      }
      if (cat?.hasQuantity) {
        const qtyVal = document.getElementById('generic-quantity')?.value;
        if (qtyVal !== '' && qtyVal !== undefined) details.quantity = parseFloat(qtyVal);
        details.unit = cat?.unit || '';
      }
    }

    const status = document.querySelector('input[name="event-status"]:checked')?.value || 'completed';

    const eventData = {
      id: editId || undefined,
      categoryId: catId,
      date,
      time,
      status,
      reminderSent: editId ? (Storage.getEvents().find(e => e.id === editId)?.reminderSent || false) : false,
      checkinPrompted: editId ? (Storage.getEvents().find(e => e.id === editId)?.checkinPrompted || false) : false,
      details,
      notes
    };

    if (editId) {
      Storage.updateEvent(eventData);
      showToast('Kayıt başarıyla güncellendi.', 'success');
    } else {
      Storage.addEvent(eventData);
      const isPlanned = status === 'planned';
      const msg = isPlanned 
        ? 'Randevu takvime eklendi! (1 saat önce sessiz bildirim alacaksınız ⏰)' 
        : 'Yeni olay takvime kaydedildi!';
      showToast(msg, 'success');
    }

    this.refreshAllViews();
    return true;
  },

  // ================= 5. TÜM KAYITLAR LİSTESİ =================
  setupAllEventsListView() {
    const searchInput = document.getElementById('list-search-query');
    const filterCat = document.getElementById('list-filter-category');
    const sortSelect = document.getElementById('list-sort');

    if (searchInput) searchInput.addEventListener('input', () => this.renderAllEventsList());
    if (filterCat) filterCat.addEventListener('change', () => this.renderAllEventsList());
    if (sortSelect) sortSelect.addEventListener('change', () => this.renderAllEventsList());
  },

  renderAllEventsList() {
    const tbody = document.getElementById('all-events-tbody');
    const emptyState = document.getElementById('list-empty-state');
    if (!tbody) return;

    tbody.innerHTML = '';

    const query = (document.getElementById('list-search-query')?.value || '').toLowerCase();
    const catFilter = document.getElementById('list-filter-category')?.value || 'all';
    const sortMode = document.getElementById('list-sort')?.value || 'date-desc';

    let events = Storage.getEvents();

    // Filtreleme
    events = events.filter(e => {
      const matchCat = (catFilter === 'all') || (e.categoryId === catFilter);
      if (!matchCat) return false;

      if (!query) return true;

      const cat = Storage.getCategoryById(e.categoryId);
      const textToSearch = [
        e.date,
        e.time,
        cat.name,
        e.notes,
        e.details?.wcType,
        e.details?.wcCondition,
        e.details?.location,
        e.details?.trigger,
        e.details?.medName
      ].filter(Boolean).join(' ').toLowerCase();

      return textToSearch.includes(query);
    });

    // Sıralama
    events.sort((a, b) => {
      if (sortMode === 'date-desc') {
        return `${b.date}T${b.time || '00:00'}`.localeCompare(`${a.date}T${a.time || '00:00'}`);
      } else if (sortMode === 'date-asc') {
        return `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`);
      } else if (sortMode === 'intensity-desc') {
        const intA = a.details?.intensity || 0;
        const intB = b.details?.intensity || 0;
        return intB - intA;
      }
      return 0;
    });

    if (events.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    } else {
      if (emptyState) emptyState.style.display = 'none';
    }

    events.forEach(e => {
      const cat = Storage.getCategoryById(e.categoryId);
      const tr = document.createElement('tr');

      let subDetail = '-';
      let valueStr = '-';
      let noteAndTrigger = e.notes || '-';

      if (e.categoryId === 'wc') {
        subDetail = `${e.details?.wcType || 'WC'} (${e.details?.wcCondition || 'Normal'})`;
      } else if (e.categoryId === 'headache') {
        subDetail = `${e.details?.location || 'Belirtilmedi'}`;
        const intVal = e.details?.intensity || 5;
        let bClass = intVal >= 7 ? 'level-10' : (intVal >= 4 ? 'level-5' : 'level-1');
        valueStr = `<span class="intensity-badge ${bClass}">${intVal}/10 Şiddet</span>`;
        if (e.details?.medTaken) {
          valueStr += `<br><small style="color:var(--success);">İlaç: ${e.details?.medName || 'Alındı'}</small>`;
        }
        if (e.details?.trigger) {
          noteAndTrigger = `<strong>Tetikleyici:</strong> ${e.details.trigger} ${e.notes ? ` &bull; ${e.notes}` : ''}`;
        }
      } else if (e.categoryId === 'sport') {
        subDetail = `${e.details?.sportType || 'Spor'} (${e.details?.duration || 30} dk)`;
        valueStr = `<span style="color:var(--success); font-weight:700;">${e.details?.intensityLevel || 'Orta Seviye'}</span>`;
      } else if (e.categoryId === 'massage') {
        subDetail = `${e.details?.massageArea || 'Masaj'} (${e.details?.duration || 20} dk)`;
        const rScore = e.details?.reliefScore || e.details?.intensity || 8;
        valueStr = `<span class="intensity-badge level-7">Rahatlama: ${rScore}/10</span>`;
        if (e.details?.provider) {
          noteAndTrigger = `<strong>Uygulayan:</strong> ${e.details.provider} ${e.notes ? ` &bull; ${e.notes}` : ''}`;
        }
      } else {
        if (e.details?.intensity) {
          valueStr = `<span class="intensity-badge level-5">${e.details.intensity}/10</span>`;
        }
        if (e.details?.quantity !== undefined) {
          subDetail = `${e.details.quantity} ${cat.unit || ''}`;
        }
      }

      // Durum rozeti oluştur
      let statusHtml = '';
      if (e.status === 'planned') {
        statusHtml = `<div style="margin-top:4px;"><span class="status-badge badge-planned">⏳ Randevu / Plan</span></div>`;
      } else if (e.status === 'skipped') {
        statusHtml = `<div style="margin-top:4px;"><span class="status-badge badge-skipped">❌ Yapılmadı</span></div>`;
      } else {
        const isSpOrMas = (e.categoryId === 'sport' || e.categoryId === 'massage');
        statusHtml = `<div style="margin-top:4px;"><span class="status-badge badge-completed">${isSpOrMas ? '✅ Yapıldı & Bitti' : '✅ Tamamlandı'}</span></div>`;
      }

      // Hızlı onay butonları (randevu ise)
      let quickCheckinBtns = '';
      if (e.status === 'planned') {
        quickCheckinBtns = `
          <button class="btn btn-sm btn-success btn-row-mark-complete" title="Hemen Yapıldı Olarak İşaretle">✅</button>
          <button class="btn btn-sm btn-outline btn-row-mark-skip" title="Yapılmadı / İptal">❌</button>
        `;
      }

      tr.innerHTML = `
        <td>
          <strong>${e.date}</strong> <span style="color:var(--text-muted); font-size:0.8rem;">${e.time || ''}</span>
          ${statusHtml}
        </td>
        <td>
          <span style="display:inline-flex; align-items:center; gap:6px; font-weight:600;">
            <span style="background:${cat.color}; color:#fff; width:22px; height:22px; border-radius:4px; display:inline-flex; align-items:center; justify-content:center; font-size:0.8rem;">${cat.icon}</span>
            ${cat.name}
          </span>
        </td>
        <td>${subDetail}</td>
        <td>${valueStr}</td>
        <td><small>${noteAndTrigger}</small></td>
        <td>
          <div style="display:flex; gap:6px; align-items:center;">
            ${quickCheckinBtns}
            <button class="btn btn-sm btn-outline btn-edit-row" title="Düzenle">✏️</button>
            <button class="btn btn-sm btn-outline btn-del-row" style="color:var(--danger);" title="Sil">🗑️</button>
          </div>
        </td>
      `;

      const rowDoneBtn = tr.querySelector('.btn-row-mark-complete');
      if (rowDoneBtn) {
        rowDoneBtn.addEventListener('click', () => {
          Storage.setEventStatus(e.id, 'completed');
          this.refreshAllViews();
          showToast(`"${cat.name}" başarıyla YAPILDI olarak kaydedildi! 🎉`, 'success');
        });
      }

      const rowSkipBtn = tr.querySelector('.btn-row-mark-skip');
      if (rowSkipBtn) {
        rowSkipBtn.addEventListener('click', () => {
          Storage.setEventStatus(e.id, 'skipped');
          this.refreshAllViews();
          showToast(`"${cat.name}" yapılmadı olarak işaretlendi.`, 'info');
        });
      }

      tr.querySelector('.btn-edit-row').addEventListener('click', () => {
        this.openEventModal(e);
      });

      tr.querySelector('.btn-del-row').addEventListener('click', () => {
        if (confirm(`Bu kaydı silmek istediğinize emin misiniz?`)) {
          Storage.deleteEvent(e.id);
          this.refreshAllViews();
          showToast('Kayıt silindi.', 'info');
        }
      });

      tbody.appendChild(tr);
    });
  },

  // ================= 6. YEDEKLEME & VERİ AKTARIMI =================
  setupBackupTab() {
    // JSON İndir
    const exportBtn = document.getElementById('btn-export-json');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        Storage.exportJSON();
        showToast('Yedek dosyası bilgisayarınıza indirildi.', 'success');
      });
    }

    // JSON İçe Aktar
    const triggerImportBtn = document.getElementById('btn-trigger-import');
    const importInput = document.getElementById('input-import-json');

    if (triggerImportBtn && importInput) {
      triggerImportBtn.addEventListener('click', () => {
        importInput.click();
      });

      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const res = Storage.importJSON(event.target.result);
          if (res.success) {
            this.refreshAllViews();
            showToast(`${res.count} adet kayıt başarıyla geri yüklendi!`, 'success');
          } else {
            alert('Hata: ' + res.error);
          }
          importInput.value = '';
        };
        reader.readAsText(file);
      });
    }

    // Demo Verisi Butonu 2
    const demoBtn2 = document.getElementById('btn-load-demo-2');
    if (demoBtn2) {
      demoBtn2.addEventListener('click', () => {
        this.loadDemo();
      });
    }

    // Demo Verilerini Temizle Butonu 2
    const clearDemoBtn2 = document.getElementById('btn-clear-demo-2');
    if (clearDemoBtn2) {
      clearDemoBtn2.addEventListener('click', () => {
        this.clearDemoData();
      });
    }

    // Tüm Verileri Temizle
    const clearBtn = document.getElementById('btn-clear-all-data');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('DİKKAT: Tüm kayıtlarınız ve özel kategorileriniz silinecektir! Devam etmek istiyor musunuz?')) {
          Storage.clearAllData();
          this.refreshAllViews();
          showToast('Tüm veriler temizlendi ve varsayılan ayarlara dönüldü.', 'info');
        }
      });
    }
  },

  // ================= 7. SESSİZ BİLDİRİM & RANDEVU TAKİP SİSTEMİ =================
  setupNotificationEngine() {
    const notifBtn = document.getElementById('btn-toggle-notif');
    const notifIcon = document.getElementById('notif-icon');

    const updateNotifState = () => {
      if (!('Notification' in window)) {
        if (notifBtn) notifBtn.style.display = 'none';
        return;
      }
      if (Notification.permission === 'granted') {
        if (notifIcon) notifIcon.textContent = '🔔';
        if (notifBtn) {
          notifBtn.title = 'Randevu bildirimleri açık (Etkinlikten 1 saat önce sessiz bildirim)';
          notifBtn.classList.add('active');
        }
      } else {
        if (notifIcon) notifIcon.textContent = '🔕';
        if (notifBtn) {
          notifBtn.title = 'Randevu bildirimlerini açmak için tıklayın';
          notifBtn.classList.remove('active');
        }
      }
    };

    updateNotifState();

    if (notifBtn) {
      notifBtn.addEventListener('click', async () => {
        if (!('Notification' in window)) {
          alert('Tarayıcınız masaüstü veya mobil bildirimleri desteklemiyor.');
          return;
        }

        if (Notification.permission === 'granted') {
          showToast('Randevu bildirimleri aktif durumda (1 saat önce sessiz bildirim gönderilir ⏰).', 'info');
        } else {
          try {
            const perm = await Notification.requestPermission();
            updateNotifState();
            if (perm === 'granted') {
              showToast('Randevu bildirimleri açıldı! Spor ve masaj saatlerinden 1 saat önce sessiz bildirim alacaksınız.', 'success');
              // Örnek ilk sessiz bildirim gönder
              try {
                new Notification('Sağlık Takvimi Aktif! ⏰', {
                  body: 'Randevularınızdan 1 saat önce bu şekilde sessiz bildirim alacaksınız (Alarm sesi çalmaz).',
                  icon: './icons/icon-192.png',
                  silent: true
                });
              } catch (e) {
                console.log('Bildirim önizleme hatası:', e);
              }
            } else {
              showToast('Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz.', 'info');
            }
          } catch (err) {
            console.error('Bildirim izin talebi hatası:', err);
          }
        }
      });
    }

    // Periyodik kontrol: Her 25 saniyede bir randevu saatlerini denetle
    this.checkScheduledAppointments();
    if (!this._notifInterval) {
      this._notifInterval = setInterval(() => {
        this.checkScheduledAppointments();
      }, 25000);
    }

    // Sekme tekrar odaklandığında anında denetle
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkScheduledAppointments();
      }
    });
  },

  // Randevu ve Onay Kontrol Motoru
  checkScheduledAppointments() {
    const events = Storage.getEvents();
    const now = new Date();
    const nowTs = now.getTime();
    let hasChanges = false;
    const pendingCheckins = [];

    events.forEach(event => {
      if (event.status !== 'planned') return;

      const eventDateStr = event.date;
      const eventTimeStr = event.time || '12:00';
      const eventDateTime = new Date(`${eventDateStr}T${eventTimeStr}:00`);
      const eventTs = eventDateTime.getTime();

      if (isNaN(eventTs)) return;

      const diffMs = eventTs - nowTs;
      const diffMinutes = Math.floor(diffMs / (60 * 1000));
      const cat = Storage.getCategoryById(event.categoryId);

      // KURAL 1: 1 SAAT ÖNCE SESSİZ BİLDİRİM (Alarm sesi çalmaz!)
      // Randevuya 60 dakika veya daha az kalmışsa ve henüz bildirim gitmediyse
      if (diffMinutes <= 60 && diffMinutes >= -120 && !event.reminderSent) {
        event.reminderSent = true;
        hasChanges = true;

        const catName = cat.name;
        const subInfo = event.details?.sportType || event.details?.massageArea || '';
        const title = `⏰ Hatırlatıcı: ${catName} (${eventTimeStr})`;
        const bodyText = `1 saat sonra randevunuz var! (${subInfo ? subInfo + ' - ' : ''}${eventDateStr} ${eventTimeStr})`;

        // Web Notification API ile SESSİZ bildirim (silent: true)
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(title, {
              body: bodyText,
              icon: './icons/icon-192.png',
              badge: './icons/icon-192.png',
              silent: true, // Kullanıcı isteği: Alarm çalmasın, sessiz bildirim olsun!
              tag: `reminder-${event.id}`
            });
          } catch (e) {
            console.log('Sessiz bildirim hatası:', e);
          }
        }

        // Uygulama içi görsel uyarı
        showToast(`⏰ Sessiz Hatırlatma: ${catName} randevunuza 1 saat kaldı! (${eventTimeStr})`, 'info');
      }

      // KURAL 2: 1 SAAT SONRA VE ETKİNLİK ZAMANINDA YAPILDI / YAPILMADI ONAYI
      // "spor ve masaj saatinden 1 saat sonra da yapılıp yapılmadıgına dair ısaretlememe ızın versın"
      const passedMinutes = Math.floor((nowTs - eventTs) / (60 * 1000));

      if (passedMinutes >= 0) {
        pendingCheckins.push({
          event,
          cat,
          passedMinutes
        });

        // Randevu saatinden 60 dakika (1 saat) geçtikten sonra onay bildirimi gönder
        if (passedMinutes >= 60 && !event.checkinPrompted) {
          event.checkinPrompted = true;
          hasChanges = true;

          const catName = cat.name;
          const title = `📋 Onay: ${catName} Yapıldı mı?`;
          const bodyText = `Saat ${eventTimeStr} randevunuzun üzerinden 1 saat geçti. Yapıldı veya yapılmadı olarak işaretleyebilirsiniz.`;

          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(title, {
                body: bodyText,
                icon: './icons/icon-192.png',
                silent: true,
                tag: `checkin-${event.id}`
              });
            } catch (e) {
              console.log('Onay bildirim hatası:', e);
            }
          }

          showToast(`📋 ${catName} saatinin üzerinden 1 saat geçti. Yapıldı mı? İşaretleyebilirsiniz.`, 'info');
        }
      }
    });

    if (hasChanges) {
      Storage.saveEvents(events);
    }

    // Ekranın üst kısmındaki onay bannerını güncelle
    this.renderCheckinBanner(pendingCheckins);
  },

  // Üst Onay Bannerını Çiz
  renderCheckinBanner(pendingList) {
    const banner = document.getElementById('checkin-alert-banner');
    if (!banner) return;

    if (!pendingList || pendingList.length === 0) {
      banner.style.display = 'none';
      banner.innerHTML = '';
      return;
    }

    // Onay bekleyen ilk randevuyu al
    const currentItem = pendingList[0];
    const e = currentItem.event;
    const cat = currentItem.cat;
    const remainingOtherCount = pendingList.length - 1;

    let subText = e.details?.sportType || e.details?.massageArea || '';
    if (subText) subText = ` (${subText})`;

    const otherBadge = remainingOtherCount > 0 
      ? ` <span style="font-size:0.75rem; background:rgba(245,158,11,0.2); padding:2px 6px; border-radius:10px; font-weight:700;">+${remainingOtherCount} diğer bekleyen</span>` 
      : '';

    banner.innerHTML = `
      <div class="banner-content">
        <span class="banner-icon">🔔</span>
        <div class="banner-text">
          <strong>Aktivite Onayı:</strong> 
          <span>${cat.icon} <strong>${cat.name}${subText}</strong> (${e.date} ${e.time || '12:00'}) yapıldı mı?</span>
          ${otherBadge}
        </div>
      </div>
      <div class="banner-actions">
        <button id="banner-btn-complete" class="btn btn-sm btn-success" title="Yapıldı olarak işaretle">
          ✅ Yapıldı
        </button>
        <button id="banner-btn-skip" class="btn btn-sm btn-outline" title="Yapılmadı olarak işaretle">
          ❌ Yapılmadı
        </button>
      </div>
    `;
    banner.style.display = 'flex';

    const btnComp = document.getElementById('banner-btn-complete');
    if (btnComp) {
      btnComp.addEventListener('click', () => {
        Storage.setEventStatus(e.id, 'completed');
        showToast(`"${cat.name}" başarıyla YAPILDI olarak onaylandı! 🎉`, 'success');
        this.refreshAllViews();
      });
    }

    const btnSkip = document.getElementById('banner-btn-skip');
    if (btnSkip) {
      btnSkip.addEventListener('click', () => {
        Storage.setEventStatus(e.id, 'skipped');
        showToast(`"${cat.name}" yapılmadı olarak işaretlendi.`, 'info');
        this.refreshAllViews();
      });
    }
  }
};

// Sayfa yüklendiğinde başlat
window.addEventListener('DOMContentLoaded', () => {
  window.App = App;
  try {
    App.init();
  } catch (err) {
    console.error('App.init kritik hata:', err);
    try {
      CategoryManager.init();
      Calendar.init();
    } catch (e2) {
      console.error('Kurtarma hatası:', e2);
    }
  }

  // PWA Service Worker Kaydı (Mobil Çevrimdışı Çalışma & Anında Güncelleme)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.update();
    }).catch((err) => {
      console.log('SW kayıt durumu:', err);
    });
  }
});
