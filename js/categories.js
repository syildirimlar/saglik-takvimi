/**
 * Sağlık & Yaşam Takvim Programı - Kategori Yönetimi (Categories)
 * Kategori listeleme, yeni özel kategori ekleme, form alanlarını dinamik uyarlama.
 */

const CategoryManager = {
  // Başlatma ve event dinleyicileri
  init() {
    this.renderCategoryCards();
    this.populateAllCategoryDropdowns();
    this.setupCategoryForm();
    this.setupEmojiPresets();
  },

  // Tüm sayfalardaki kategori seçim kutularını (select) güncelle
  populateAllCategoryDropdowns() {
    const categories = Storage.getCategories();
    
    // Takvim Filtresi
    const calFilter = document.getElementById('cal-category-filter');
    if (calFilter) {
      const currentVal = calFilter.value || 'all';
      calFilter.innerHTML = '<option value="all">Tüm Kategoriler</option>';
      categories.forEach(c => {
        calFilter.innerHTML += `<option value="${c.id}">${c.icon} ${c.name}</option>`;
      });
      calFilter.value = currentVal;
    }

    // Rapor Filtresi
    const reportCat = document.getElementById('report-category');
    if (reportCat) {
      const currentVal = reportCat.value || 'all';
      reportCat.innerHTML = '<option value="all">Tüm Kategoriler (Genel)</option>';
      categories.forEach(c => {
        reportCat.innerHTML += `<option value="${c.id}">${c.icon} ${c.name}</option>`;
      });
      reportCat.value = currentVal;
    }

    // Kayıt Listesi Filtresi
    const listCat = document.getElementById('list-filter-category');
    if (listCat) {
      const currentVal = listCat.value || 'all';
      listCat.innerHTML = '<option value="all">Tüm Kategoriler</option>';
      categories.forEach(c => {
        listCat.innerHTML += `<option value="${c.id}">${c.icon} ${c.name}</option>`;
      });
      listCat.value = currentVal;
    }

    // Modal Gizli Select
    const eventCatSelect = document.getElementById('event-category');
    if (eventCatSelect) {
      eventCatSelect.innerHTML = '';
      categories.forEach(c => {
        eventCatSelect.innerHTML += `<option value="${c.id}">${c.icon} ${c.name}</option>`;
      });
    }

    // Modal Kategori Hap Butonları
    this.renderModalCategoryPills();
  },

  // Modal içindeki hap butonlarını çiz
  renderModalCategoryPills(selectedId = null) {
    const pillsContainer = document.getElementById('modal-category-pills');
    if (!pillsContainer) return;

    const categories = Storage.getCategories();
    const activeId = selectedId || (categories[0] ? categories[0].id : 'wc');

    pillsContainer.innerHTML = '';
    categories.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cat-pill-btn ${c.id === activeId ? 'active' : ''}`;
      if (c.id === activeId) {
        btn.style.backgroundColor = c.color;
      }
      btn.innerHTML = `<span>${c.icon}</span> <span>${c.name}</span>`;
      btn.dataset.id = c.id;

      btn.addEventListener('click', () => {
        this.selectModalCategory(c.id);
      });

      pillsContainer.appendChild(btn);
    });

    this.selectModalCategory(activeId);
  },

  // Modalda kategori seçildiğinde dinamik alanları göster/gizle
  selectModalCategory(catId) {
    const category = Storage.getCategoryById(catId);
    const select = document.getElementById('event-category');
    if (select) select.value = catId;

    // Hapların aktifliğini güncelle
    const pills = document.querySelectorAll('.cat-pill-btn');
    pills.forEach(pill => {
      if (pill.dataset.id === catId) {
        pill.classList.add('active');
        pill.style.backgroundColor = category.color;
        pill.style.color = '#ffffff';
      } else {
        pill.classList.remove('active');
        pill.style.backgroundColor = '';
        pill.style.color = '';
      }
    });

    // Başlık ikonu
    const badgeIcon = document.getElementById('modal-category-badge-icon');
    if (badgeIcon) badgeIcon.textContent = category.icon;

    // Dinamik Alan Görünürlükleri
    const fieldsWc = document.getElementById('fields-wc');
    const fieldsHeadache = document.getElementById('fields-headache');
    const fieldsSport = document.getElementById('fields-sport');
    const fieldsMassage = document.getElementById('fields-massage');
    const fieldsGenIntensity = document.getElementById('fields-generic-intensity');
    const fieldsGenQuantity = document.getElementById('fields-generic-quantity');

    if (fieldsWc) fieldsWc.style.display = 'none';
    if (fieldsHeadache) fieldsHeadache.style.display = 'none';
    if (fieldsSport) fieldsSport.style.display = 'none';
    if (fieldsMassage) fieldsMassage.style.display = 'none';
    if (fieldsGenIntensity) fieldsGenIntensity.style.display = 'none';
    if (fieldsGenQuantity) fieldsGenQuantity.style.display = 'none';

    if (catId === 'wc') {
      if (fieldsWc) fieldsWc.style.display = 'block';
    } else if (catId === 'headache') {
      if (fieldsHeadache) fieldsHeadache.style.display = 'block';
    } else if (catId === 'sport') {
      if (fieldsSport) fieldsSport.style.display = 'block';
    } else if (catId === 'massage') {
      if (fieldsMassage) fieldsMassage.style.display = 'block';
    } else {
      // Özel veya diğer kategoriler
      if (category.hasIntensity && fieldsGenIntensity) {
        fieldsGenIntensity.style.display = 'block';
      }
      if (category.hasQuantity && fieldsGenQuantity) {
        fieldsGenQuantity.style.display = 'block';
        const label = document.getElementById('generic-quantity-label');
        if (label) {
          label.textContent = `Miktar (${category.unit || 'Birim'})`;
        }
      }
    }
  },

  // "Kategoriler" sekmesindeki kartları listele
  renderCategoryCards() {
    const container = document.getElementById('categories-grid');
    if (!container) return;

    const categories = Storage.getCategories();
    container.innerHTML = '';

    categories.forEach(c => {
      const card = document.createElement('div');
      card.className = 'cat-item-card';

      let badgesHtml = '';
      if (c.hasIntensity) badgesHtml += '<span style="color:#ef4444;">• 1-10 Şiddet</span> ';
      if (c.hasQuantity) badgesHtml += `<span style="color:#0284c7;">• ${c.unit || 'Miktar'}</span> `;

      card.innerHTML = `
        <div class="cat-item-info">
          <div class="cat-item-icon" style="background-color: ${c.color}">
            ${c.icon}
          </div>
          <div class="cat-item-text">
            <h4>${c.name} ${c.isSystem ? '<small style="color:var(--text-muted); font-size:0.7rem;">(Varsayılan)</small>' : ''}</h4>
            <span>${badgesHtml || (c.description || 'Standart kayıt')}</span>
          </div>
        </div>
        ${!c.isSystem ? `
          <button class="icon-btn btn-sm btn-delete-cat" data-id="${c.id}" title="Kategoriyi Sil" style="color:var(--danger); border-color:transparent;">
            🗑️
          </button>
        ` : ''}
      `;

      // Silme butonu olayı
      const delBtn = card.querySelector('.btn-delete-cat');
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          if (confirm(`"${c.name}" kategorisini silmek istediğinize emin misiniz?`)) {
            Storage.deleteCategory(c.id);
            this.init();
            if (window.App) window.App.refreshAllViews();
            showToast(`"${c.name}" kategorisi silindi.`, 'info');
          }
        });
      }

      container.appendChild(card);
    });
  },

  // Yeni kategori oluşturma formunu dinle
  setupCategoryForm() {
    const form = document.getElementById('form-create-category');
    if (!form) return;

    const hasQtyCheckbox = document.getElementById('cat-has-quantity');
    const unitGroup = document.getElementById('cat-unit-group');

    if (hasQtyCheckbox && unitGroup) {
      hasQtyCheckbox.addEventListener('change', () => {
        unitGroup.style.display = hasQtyCheckbox.checked ? 'block' : 'none';
      });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('cat-name').value.trim();
      const icon = document.getElementById('cat-icon').value.trim() || '📌';
      const color = document.getElementById('cat-color').value;
      const hasIntensity = document.getElementById('cat-has-intensity').checked;
      const hasQuantity = document.getElementById('cat-has-quantity').checked;
      const unit = document.getElementById('cat-unit-label').value.trim() || 'adet';
      const desc = document.getElementById('cat-desc').value.trim();

      if (!name) {
        alert('Lütfen kategori adını girin.');
        return;
      }

      const newCategory = {
        name,
        icon,
        color,
        hasIntensity,
        hasQuantity,
        unit: hasQuantity ? unit : null,
        description: desc,
        isSystem: false
      };

      Storage.addCategory(newCategory);
      form.reset();
      if (unitGroup) unitGroup.style.display = 'none';

      this.init();
      if (window.App) window.App.refreshAllViews();
      showToast(`"${name}" kategorisi başarıyla oluşturuldu!`, 'success');
    });
  },

  // Hızlı emoji butonları
  setupEmojiPresets() {
    const presets = document.querySelectorAll('.preset-emoji');
    const iconInput = document.getElementById('cat-icon');
    if (!iconInput) return;

    presets.forEach(btn => {
      btn.addEventListener('click', () => {
        iconInput.value = btn.textContent.trim();
      });
    });
  }
};
