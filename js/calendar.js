/**
 * Sağlık & Yaşam Takvim Programı - Takvim Mantığı (Calendar)
 * Aylık görünüm, gün ızgarası oluşturma, olay rozetleri, seçilen gün detayları ve zaman çizelgesi.
 */

const Calendar = {
  currentDate: new Date(),
  selectedDateStr: null, // 'YYYY-MM-DD'
  monthNamesTr: [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ],
  dayNamesTr: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],

  init() {
    // Başlangıçta bugünün tarihini seç
    const today = new Date();
    this.selectedDateStr = this.formatDate(today);

    this.setupEventListeners();
    this.render();
  },

  setupEventListeners() {
    // Önceki Ay
    const prevBtn = document.getElementById('cal-prev-month');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
      });
    }

    // Sonraki Ay
    const nextBtn = document.getElementById('cal-next-month');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
      });
    }

    // Bugün Butonu
    const todayBtn = document.getElementById('cal-today-btn');
    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        this.currentDate = new Date();
        this.selectedDateStr = this.formatDate(new Date());
        this.render();
      });
    }

    // Kategori Filtresi
    const filterSelect = document.getElementById('cal-category-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', () => {
        this.renderGrid();
      });
    }

    // Seçili Güne Ekle Butonu
    const addSelectedBtn = document.getElementById('btn-add-to-selected-day');
    if (addSelectedBtn) {
      addSelectedBtn.addEventListener('click', () => {
        if (window.App) {
          window.App.openEventModal(null, this.selectedDateStr);
        }
      });
    }
  },

  formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  render() {
    this.updateHeader();
    this.renderGrid();
    this.renderLegend();
    this.renderSelectedDayDetails();
  },

  updateHeader() {
    const heading = document.getElementById('calendar-month-year');
    if (heading) {
      const monthStr = this.monthNamesTr[this.currentDate.getMonth()];
      const year = this.currentDate.getFullYear();
      heading.textContent = `${monthStr} ${year}`;
    }
  },

  renderGrid() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    // Ayın ilk günü ve toplam gün sayısı
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    // Pazartesi ilk gün (1=Pzt, ..., 0=Paz -> Pazartesi bazlı offset: (day + 6) % 7)
    const firstDayIndex = (firstDay.getDay() + 6) % 7;

    // Önceki ayın son günleri
    const prevLastDay = new Date(year, month, 0).getDate();

    // Filtreleme
    const filterCategory = document.getElementById('cal-category-filter')?.value || 'all';
    const allEvents = Storage.getEvents();

    const todayStr = this.formatDate(new Date());

    // 1. Önceki aydan taşan günler
    for (let x = firstDayIndex; x > 0; x--) {
      const dayNum = prevLastDay - x + 1;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateStr = this.formatDate(prevDate);

      const cell = this.createDayCell(dayNum, dateStr, true, allEvents, filterCategory, todayStr);
      grid.appendChild(cell);
    }

    // 2. Bu ayın günleri
    for (let i = 1; i <= totalDays; i++) {
      const thisDate = new Date(year, month, i);
      const dateStr = this.formatDate(thisDate);

      const cell = this.createDayCell(i, dateStr, false, allEvents, filterCategory, todayStr);
      grid.appendChild(cell);
    }

    // 3. Sonraki aydan tamamlayıcı günler (42 hücreye tamamla)
    const cellsSoFar = firstDayIndex + totalDays;
    const remainingCells = 42 - cellsSoFar;
    const extraCells = remainingCells >= 7 ? remainingCells - 7 : remainingCells; // 35 veya 42 satır
    const fillCount = (cellsSoFar <= 35) ? (35 - cellsSoFar) : (42 - cellsSoFar);

    for (let j = 1; j <= fillCount; j++) {
      const nextDate = new Date(year, month + 1, j);
      const dateStr = this.formatDate(nextDate);

      const cell = this.createDayCell(j, dateStr, true, allEvents, filterCategory, todayStr);
      grid.appendChild(cell);
    }
  },

  createDayCell(dayNum, dateStr, isOtherMonth, allEvents, filterCategory, todayStr) {
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (isOtherMonth) cell.classList.add('other-month');
    if (dateStr === todayStr) cell.classList.add('today');
    if (dateStr === this.selectedDateStr) cell.classList.add('selected');

    // O günün olayları
    let dayEvents = allEvents.filter(e => e.date === dateStr);
    if (filterCategory !== 'all') {
      dayEvents = dayEvents.filter(e => e.categoryId === filterCategory);
    }

    // Başlık kısmı
    const header = document.createElement('div');
    header.className = 'day-header';

    const numSpan = document.createElement('span');
    numSpan.className = 'day-number';
    numSpan.textContent = dayNum;

    const quickAddBtn = document.createElement('button');
    quickAddBtn.className = 'day-add-quick-btn';
    quickAddBtn.innerHTML = '➕';
    quickAddBtn.title = `${dateStr} tarihine yeni kayıt ekle`;
    quickAddBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectDate(dateStr);
      if (window.App) window.App.openEventModal(null, dateStr);
    });

    header.appendChild(numSpan);
    header.appendChild(quickAddBtn);
    cell.appendChild(header);

    // Rozetler / Olay Göstergeleri
    if (dayEvents.length > 0) {
      const badgesContainer = document.createElement('div');
      badgesContainer.className = 'day-badges';

      // Kategorilere göre grupla
      const categoryCounts = {};
      dayEvents.forEach(e => {
        categoryCounts[e.categoryId] = (categoryCounts[e.categoryId] || 0) + 1;
      });

      // Her kategori için rozet oluştur
      Object.keys(categoryCounts).forEach(catId => {
        const cat = Storage.getCategoryById(catId);
        const count = categoryCounts[catId];
        const pill = document.createElement('span');
        pill.className = 'day-pill';
        pill.style.backgroundColor = cat.color;
        pill.innerHTML = `<span>${cat.icon}</span> <span>${count}</span>`;
        pill.title = `${cat.name}: ${count} kayıt`;
        badgesContainer.appendChild(pill);
      });

      cell.appendChild(badgesContainer);
    }

    // Tıklanma olayı
    cell.addEventListener('click', () => {
      this.selectDate(dateStr);
    });

    return cell;
  },

  selectDate(dateStr) {
    this.selectedDateStr = dateStr;

    // Seçim sınıfını güncelle
    const allCells = document.querySelectorAll('.cal-day');
    allCells.forEach(c => c.classList.remove('selected'));

    // İlgili hücreyi bul
    const activeDate = new Date(dateStr + 'T00:00:00');
    // Eğer başka aydan bir güne tıklandıysa ve ay farklıysa, ayı güncelle
    if (activeDate.getMonth() !== this.currentDate.getMonth() || activeDate.getFullYear() !== this.currentDate.getFullYear()) {
      this.currentDate = new Date(activeDate);
      this.render();
      return;
    }

    this.renderGrid();
    this.renderSelectedDayDetails();
  },

  renderSelectedDayDetails() {
    if (!this.selectedDateStr) return;

    const parts = this.selectedDateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const dateObj = new Date(year, month, day);

    // Başlıklar
    const titleElem = document.getElementById('selected-day-title');
    const badgeElem = document.getElementById('selected-day-weekday');
    if (titleElem) {
      titleElem.textContent = `${day} ${this.monthNamesTr[month]} ${year}`;
    }
    if (badgeElem) {
      const todayStr = this.formatDate(new Date());
      if (this.selectedDateStr === todayStr) {
        badgeElem.textContent = 'Bugün';
        badgeElem.style.color = 'var(--primary)';
      } else {
        badgeElem.textContent = this.dayNamesTr[dateObj.getDay()];
        badgeElem.style.color = 'var(--text-secondary)';
      }
    }

    // O günün olayları
    const events = Storage.getEventsByDate(this.selectedDateStr);

    // Özet istatistik çiğleri
    const summaryContainer = document.getElementById('selected-day-summary');
    if (summaryContainer) {
      summaryContainer.innerHTML = '';
      if (events.length > 0) {
        const counts = {};
        events.forEach(e => {
          counts[e.categoryId] = (counts[e.categoryId] || 0) + 1;
        });

        Object.keys(counts).forEach(catId => {
          const cat = Storage.getCategoryById(catId);
          const chip = document.createElement('div');
          chip.className = 'day-stat-chip';
          chip.innerHTML = `<span>${cat.icon}</span> <span>${cat.name}: <strong>${counts[catId]}</strong></span>`;
          summaryContainer.appendChild(chip);
        });
      }
    }

    // Zaman çizelgesi listesi
    const listContainer = document.getElementById('selected-day-events');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (events.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-timeline">
          <div style="font-size: 2rem; margin-bottom: 6px;">🍃</div>
          <p>Bu güne ait kayıt bulunmuyor.</p>
          <small>Hızlıca kayıt eklemek için yukarıdaki "Bu Güne Ekle" butonunu kullanabilirsiniz.</small>
        </div>
      `;
      return;
    }

    events.forEach(event => {
      const cat = Storage.getCategoryById(event.categoryId);
      const card = document.createElement('div');
      card.className = 'timeline-card';
      card.style.borderLeftColor = cat.color;

      // Özel detay etiketleri oluştur
      let detailsHtml = '';
      if (event.categoryId === 'wc') {
        const wcType = event.details?.wcType || 'Tuvalet';
        const wcCond = event.details?.wcCondition;
        detailsHtml += `<strong>${wcType}</strong>`;
        if (wcCond && wcCond !== 'Normal') {
          detailsHtml += ` &bull; <span style="color:#d97706;">${wcCond}</span>`;
        }
      } else if (event.categoryId === 'headache') {
        const intensity = event.details?.intensity || 5;
        const loc = event.details?.location || '';
        const trig = event.details?.trigger;
        const medTaken = event.details?.medTaken;
        const medName = event.details?.medName;

        let badgeClass = 'level-5';
        if (intensity <= 3) badgeClass = 'level-1';
        else if (intensity >= 8) badgeClass = 'level-10';
        else if (intensity >= 6) badgeClass = 'level-7';

        detailsHtml += `
          <span class="intensity-badge ${badgeClass}">${intensity}/10 Şiddet</span>
          ${loc ? `<span>&bull; ${loc}</span>` : ''}
          ${trig && trig !== 'Bilinmiyor' ? `<span>&bull; Tetikleyici: <strong>${trig}</strong></span>` : ''}
          ${medTaken ? `<span style="color:var(--success);">&bull; İlaç: ${medName || 'Alındı'}</span>` : ''}
        `;
      } else if (event.categoryId === 'sport') {
        const spType = event.details?.sportType || 'Spor Aktivitesi';
        const spDur = event.details?.duration || event.details?.quantity || 30;
        const spInt = event.details?.intensityLevel || 'Orta Seviye';
        detailsHtml += `
          <strong>${spType}</strong> &bull; <span>${spDur} dk</span> &bull; <span style="color:var(--success); font-weight:700;">${spInt}</span>
        `;
      } else if (event.categoryId === 'massage') {
        const mArea = event.details?.massageArea || 'Masaj';
        const mDur = event.details?.duration || event.details?.quantity || 20;
        const relief = event.details?.reliefScore || event.details?.intensity || 8;
        detailsHtml += `
          <strong>${mArea}</strong> &bull; <span>${mDur} dk</span> &bull; <span class="intensity-badge level-7">Rahatlama: ${relief}/10</span>
        `;
      } else {
        // Genel kategoriler
        if (event.details?.intensity) {
          detailsHtml += `<span class="intensity-badge level-5">${event.details.intensity}/10</span>`;
        }
        if (event.details?.quantity !== undefined && event.details?.quantity !== null) {
          detailsHtml += `<strong>${event.details.quantity} ${cat.unit || ''}</strong>`;
        }
      }

      card.innerHTML = `
        <div class="timeline-card-header">
          <div class="timeline-cat-name">
            <span>${cat.icon}</span>
            <span>${cat.name}</span>
          </div>
          <span class="timeline-time">⏰ ${event.time || '12:00'}</span>
        </div>
        ${detailsHtml ? `<div class="timeline-subdetails">${detailsHtml}</div>` : ''}
        ${event.notes ? `<div class="timeline-notes">"${event.notes}"</div>` : ''}
        <div class="timeline-actions">
          <button class="timeline-action-btn edit-btn" title="Düzenle">✏️ Düzenle</button>
          <button class="timeline-action-btn del del-btn" title="Sil">🗑️ Sil</button>
        </div>
      `;

      // Düzenleme butonu
      const editBtn = card.querySelector('.edit-btn');
      editBtn.addEventListener('click', () => {
        if (window.App) window.App.openEventModal(event);
      });

      // Silme butonu
      const delBtn = card.querySelector('.del-btn');
      delBtn.addEventListener('click', () => {
        if (confirm(`Bu ${cat.name} kaydını silmek istediğinize emin misiniz?`)) {
          Storage.deleteEvent(event.id);
          this.render();
          if (window.App) window.App.refreshAllViews();
          showToast('Kayıt silindi.', 'info');
        }
      });

      listContainer.appendChild(card);
    });
  },

  renderLegend() {
    const legend = document.getElementById('calendar-legend');
    if (!legend) return;

    const categories = Storage.getCategories();
    legend.innerHTML = '<span style="font-weight:700; color:var(--text-main);">Kayıt Türleri:</span>';

    categories.forEach(cat => {
      const item = document.createElement('span');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-color-dot" style="background-color: ${cat.color};"></span>
        <span>${cat.icon} ${cat.name}</span>
      `;
      legend.appendChild(item);
    });
  }
};
