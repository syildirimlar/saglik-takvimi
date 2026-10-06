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
    this.setupTheme();
    this.setupNavigationTabs();
    this.setupQuickButtons();
    this.setupModal();
    this.setupAllEventsListView();
    this.setupBackupTab();

    // Alt modülleri başlat
    CategoryManager.init();
    Calendar.init();
    Reports.init();

    // İlk açılışta eğer hiç veri yoksa kullanıcıya ipucu ver veya demo teklifi yap
    const events = Storage.getEvents();
    if (events.length === 0) {
      setTimeout(() => {
        showToast('Hoş geldiniz! Takvimi test etmek için "✨ Örnek Veri" butonuna tıklayabilirsiniz.', 'info');
      }, 800);
    }
  },

  // Tüm görünümleri senkronize yenile
  refreshAllViews() {
    CategoryManager.populateAllCategoryDropdowns();
    CategoryManager.renderCategoryCards();
    Calendar.render();
    Reports.render();
    this.renderAllEventsList();
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
  },

  loadDemo() {
    if (confirm('30 günlük gerçekçi örnek kayıtlar yüklenecek. Devam etmek istiyor musunuz?')) {
      const count = Storage.loadDemoData();
      this.refreshAllViews();
      showToast(`${count} adet örnek kayıt başarıyla yüklendi!`, 'success');
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
      if (modal && modal.open) modal.close();
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
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveEventFromModal();
        closeModal();
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
    }

    modal.showModal();
  },

  // Modal Verisini Kaydet
  saveEventFromModal() {
    const editId = document.getElementById('event-edit-id').value;
    const catId = document.getElementById('event-category').value;
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const notes = document.getElementById('event-notes').value.trim();

    if (!catId || !date) {
      alert('Lütfen zorunlu alanları doldurun.');
      return;
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
    } else {
      const cat = Storage.getCategoryById(catId);
      if (cat.hasIntensity) {
        details.intensity = parseInt(document.getElementById('generic-intensity')?.value, 10) || 5;
      }
      if (cat.hasQuantity) {
        const qtyVal = document.getElementById('generic-quantity')?.value;
        if (qtyVal !== '') details.quantity = parseFloat(qtyVal);
        details.unit = cat.unit;
      }
    }

    const eventData = {
      id: editId || undefined,
      categoryId: catId,
      date,
      time,
      details,
      notes
    };

    if (editId) {
      Storage.updateEvent(eventData);
      showToast('Kayıt başarıyla güncellendi.', 'success');
    } else {
      Storage.addEvent(eventData);
      showToast('Yeni olay takvime kaydedildi!', 'success');
    }

    this.refreshAllViews();
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
      } else {
        if (e.details?.intensity) {
          valueStr = `<span class="intensity-badge level-5">${e.details.intensity}/10</span>`;
        }
        if (e.details?.quantity !== undefined) {
          subDetail = `${e.details.quantity} ${cat.unit || ''}`;
        }
      }

      tr.innerHTML = `
        <td><strong>${e.date}</strong> <span style="color:var(--text-muted); font-size:0.8rem;">${e.time || ''}</span></td>
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
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm btn-outline btn-edit-row" title="Düzenle">✏️</button>
            <button class="btn btn-sm btn-outline btn-del-row" style="color:var(--danger);" title="Sil">🗑️</button>
          </div>
        </td>
      `;

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
  }
};

// Sayfa yüklendiğinde başlat
window.addEventListener('DOMContentLoaded', () => {
  window.App = App;
  App.init();

  // PWA Service Worker Kaydı (Mobil Çevrimdışı Çalışma)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('SW kayıt durumu:', err);
    });
  }
});
