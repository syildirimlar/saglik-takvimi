/**
 * Sağlık & Yaşam Takvim Programı - Raporlama & Analiz (Reports)
 * Dönem filtreleme, istatistik hesaplama, akıllı sağlık içgörüleri,
 * %100 çevrimdışı interaktif SVG grafikleri, CSV ve yazdırma desteği.
 */

const Reports = {
  currentRange: '30', // '7', '30', 'this-month', 'prev-month', '90', 'all', 'custom'
  startDateStr: null,
  endDateStr: null,
  selectedCategory: 'all',

  init() {
    this.setupEventListeners();
    this.updateDateRangeBounds();
    this.render();
  },

  setupEventListeners() {
    // Tarih Aralığı Değişimi
    const rangeSelect = document.getElementById('report-range');
    const customDiv = document.getElementById('custom-date-inputs');
    const startInput = document.getElementById('report-start-date');
    const endInput = document.getElementById('report-end-date');

    if (rangeSelect) {
      rangeSelect.addEventListener('change', () => {
        this.currentRange = rangeSelect.value;
        if (this.currentRange === 'custom') {
          if (customDiv) customDiv.style.display = 'flex';
        } else {
          if (customDiv) customDiv.style.display = 'none';
          this.updateDateRangeBounds();
          this.render();
        }
      });
    }

    if (startInput && endInput) {
      const handleCustomDateChange = () => {
        if (startInput.value && endInput.value) {
          this.startDateStr = startInput.value;
          this.endDateStr = endInput.value;
          this.render();
        }
      };
      startInput.addEventListener('change', handleCustomDateChange);
      endInput.addEventListener('change', handleCustomDateChange);
    }

    // Kategori Filtresi
    const catSelect = document.getElementById('report-category');
    if (catSelect) {
      catSelect.addEventListener('change', () => {
        this.selectedCategory = catSelect.value;
        this.render();
      });
    }

    // Yazdır / PDF Butonu
    const printBtn = document.getElementById('btn-print-report');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        this.prepareAndPrint();
      });
    }

    // Excel / CSV İndir Butonu
    const csvBtn = document.getElementById('btn-export-csv');
    if (csvBtn) {
      csvBtn.addEventListener('click', () => {
        this.exportCSV();
      });
    }
  },

  updateDateRangeBounds() {
    const today = new Date();
    const end = new Date(today);
    let start = new Date(today);

    if (this.currentRange === '7') {
      start.setDate(today.getDate() - 6);
    } else if (this.currentRange === '30') {
      start.setDate(today.getDate() - 29);
    } else if (this.currentRange === 'this-month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (this.currentRange === 'prev-month') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end.setDate(0); // Önceki ayın son günü
    } else if (this.currentRange === '90') {
      start.setDate(today.getDate() - 89);
    } else if (this.currentRange === 'all') {
      start = new Date('2020-01-01');
    }

    this.startDateStr = this.formatDate(start);
    this.endDateStr = this.formatDate(end);

    const startInput = document.getElementById('report-start-date');
    const endInput = document.getElementById('report-end-date');
    if (startInput) startInput.value = this.startDateStr;
    if (endInput) endInput.value = this.endDateStr;
  },

  formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getFilteredEvents() {
    return Storage.getEventsByRange(this.startDateStr, this.endDateStr, this.selectedCategory);
  },

  calculateDaysDifference() {
    if (!this.startDateStr || !this.endDateStr) return 1;
    const d1 = new Date(this.startDateStr);
    const d2 = new Date(this.endDateStr);
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  },

  render() {
    const events = this.getFilteredEvents();
    const totalDays = this.calculateDaysDifference();

    this.renderKPIs(events, totalDays);
    this.renderInsights(events, totalDays);
    this.renderTrendChart(events);
    this.renderHourlyChart(events);
    this.renderCategoryChart(events);
    this.renderIntensityChart(events);
    this.renderSummaryTable(events, totalDays);
  },

  // 1. Üst Özet Kartları (KPIs)
  renderKPIs(events, totalDays) {
    // Toplam Olay
    const totalElem = document.getElementById('stat-total-events');
    if (totalElem) totalElem.textContent = events.length;

    // WC İstatistikleri
    const wcEvents = events.filter(e => e.categoryId === 'wc');
    const wcElem = document.getElementById('stat-wc-count');
    const wcAvgElem = document.getElementById('stat-wc-avg');
    if (wcElem) wcElem.textContent = `${wcEvents.length} kez`;
    if (wcAvgElem) {
      const avgPerDay = (wcEvents.length / totalDays).toFixed(1);
      wcAvgElem.textContent = `Günde ortalama ${avgPerDay} kez`;
    }

    // Baş Ağrısı İstatistikleri
    const headacheEvents = events.filter(e => e.categoryId === 'headache');
    const headacheElem = document.getElementById('stat-headache-count');
    const headacheIntElem = document.getElementById('stat-headache-intensity');
    if (headacheElem) headacheElem.textContent = `${headacheEvents.length} kez`;
    if (headacheIntElem) {
      if (headacheEvents.length > 0) {
        const sumInt = headacheEvents.reduce((acc, cur) => acc + (cur.details?.intensity || 5), 0);
        const avgInt = (sumInt / headacheEvents.length).toFixed(1);
        headacheIntElem.textContent = `Ortalama Şiddet: ${avgInt} / 10`;
      } else {
        headacheIntElem.textContent = 'Kayıt bulunamadı';
      }
    }

    // En Yoğun Saat Dilimi
    const hourCounts = new Array(24).fill(0);
    events.forEach(e => {
      const hour = parseInt((e.time || '12:00').split(':')[0], 10);
      if (!isNaN(hour) && hour >= 0 && hour < 24) {
        hourCounts[hour]++;
      }
    });

    let maxHour = -1;
    let maxCount = 0;
    hourCounts.forEach((count, h) => {
      if (count > maxCount) {
        maxCount = count;
        maxHour = h;
      }
    });

    const peakHourElem = document.getElementById('stat-peak-hour');
    const peakCatElem = document.getElementById('stat-peak-category');
    if (peakHourElem) {
      if (maxHour !== -1 && maxCount > 0) {
        const formattedHour = String(maxHour).padStart(2, '0') + ':00';
        const nextHour = String((maxHour + 1) % 24).padStart(2, '0') + ':00';
        peakHourElem.textContent = `${formattedHour} - ${nextHour}`;
        if (peakCatElem) peakCatElem.textContent = `${maxCount} olay kaydedildi`;
      } else {
        peakHourElem.textContent = '-';
        if (peakCatElem) peakCatElem.textContent = 'Veri yok';
      }
    }
  },

  // 2. Akıllı Sağlık İçgörüleri & Tespit Metinleri
  renderInsights(events, totalDays) {
    const container = document.getElementById('insights-content');
    if (!container) return;

    if (events.length === 0) {
      container.innerHTML = `
        <div class="insight-item">
          <span>ℹ️</span>
          <div>Seçilen tarih aralığında henüz kayıt bulunmuyor. Takvimden veya "Hızlı Ekle" butonlarından kayıt girdikçe burada otomatik sağlık değerlendirmeleri ve örüntü analizleri görünecektir.</div>
        </div>
      `;
      return;
    }

    const insights = [];

    // WC Analizi
    const wcEvents = events.filter(e => e.categoryId === 'wc');
    const bowelCount = wcEvents.filter(e => e.details?.wcType?.includes('Büyük') || e.details?.wcType?.includes('İkisi')).length;
    const hardCount = wcEvents.filter(e => e.details?.wcCondition?.includes('Kabız') || e.details?.wcCondition?.includes('Sert')).length;
    const liquidCount = wcEvents.filter(e => e.details?.wcCondition?.includes('İshal') || e.details?.wcCondition?.includes('Sıvı')).length;

    if (wcEvents.length > 0) {
      const wcDailyAvg = (wcEvents.length / totalDays).toFixed(1);
      let bowelText = '';
      if (hardCount > 2) {
        bowelText = ` &bull; ⚠️ Dönem içinde ${hardCount} kez kabızlık/sertlik kaydedilmiş (Lifli gıda ve su tüketiminizi artırmanız önerilebilir).`;
      } else if (liquidCount > 2) {
        bowelText = ` &bull; ⚠️ ${liquidCount} kez ishal/sıvı dışkılama kaydedilmiş (Sıvı kaybına ve tükettiğiniz gıdalara dikkat ediniz).`;
      }
      insights.push({
        icon: '🚽',
        title: 'Tuvalet Rutini',
        text: `Bu dönemde günde ortalama <strong>${wcDailyAvg}</strong> kez tuvalet kullanımı gerçekleşti (${bowelCount} kez büyük abdest).${bowelText}`
      });
    }

    // Baş Ağrısı Analizi
    const headacheEvents = events.filter(e => e.categoryId === 'headache');
    if (headacheEvents.length > 0) {
      // Tetikleyici analizi
      const triggers = {};
      headacheEvents.forEach(h => {
        const trig = h.details?.trigger;
        if (trig && trig !== 'Bilinmiyor') {
          triggers[trig] = (triggers[trig] || 0) + 1;
        }
      });
      let topTrigger = 'Belirlenmemiş';
      let topTriggerCount = 0;
      Object.keys(triggers).forEach(t => {
        if (triggers[t] > topTriggerCount) {
          topTriggerCount = triggers[t];
          topTrigger = t;
        }
      });

      const medCount = headacheEvents.filter(h => h.details?.medTaken).length;
      const medRatio = Math.round((medCount / headacheEvents.length) * 100);

      insights.push({
        icon: '🤕',
        title: 'Baş Ağrısı Örüntüsü',
        text: `Toplam <strong>${headacheEvents.length}</strong> baş ağrısı atağı kaydedildi. Atakların <strong>%${medRatio}</strong>'sinde ilaç/ağrı kesici kullanıldı. ${topTriggerCount > 0 ? `En sık bildirilen olası tetikleyici: <strong>"${topTrigger}"</strong> (${topTriggerCount} kez).` : ''}`
      });
    }

    // Su Tüketimi Varsa
    const waterEvents = events.filter(e => e.categoryId === 'water');
    if (waterEvents.length > 0) {
      const totalWater = waterEvents.reduce((acc, cur) => acc + (Number(cur.details?.quantity) || 0), 0);
      const avgWater = (totalWater / totalDays).toFixed(1);
      insights.push({
        icon: '💧',
        title: 'Sıvı Dengesi',
        text: `Günlük ortalama <strong>${avgWater} bardak</strong> su tüketildi. ${avgWater < 6 ? 'Su tüketiminiz hedeflenen minimum 8 bardağın altında kalmış görünüyor.' : 'Su tüketiminiz dengeli ve düzenli seyrediyor.'}`
      });
    }

    // Spor & Egzersiz Analizi
    const sportEvents = events.filter(e => e.categoryId === 'sport');
    if (sportEvents.length > 0) {
      const totalSportMin = sportEvents.reduce((acc, cur) => acc + (Number(cur.details?.duration) || Number(cur.details?.quantity) || 0), 0);
      const avgSportMin = Math.round(totalSportMin / totalDays);
      insights.push({
        icon: '🏃',
        title: 'Fiziksel Aktivite',
        text: `Bu dönemde <strong>${sportEvents.length}</strong> kez spor yapıldı (Toplam <strong>${totalSportMin} dakika</strong>, günde ortalama ${avgSportMin} dk). Düzenli egzersiz baş ağrısı ve gerginliği azaltmada etkilidir.`
      });
    }

    // Masaj Analizi
    const massageEvents = events.filter(e => e.categoryId === 'massage');
    if (massageEvents.length > 0) {
      const sumRelief = massageEvents.reduce((acc, cur) => acc + (Number(cur.details?.reliefScore) || Number(cur.details?.intensity) || 8), 0);
      const avgRelief = (sumRelief / massageEvents.length).toFixed(1);
      insights.push({
        icon: '💆',
        title: 'Masaj & Kas Rahatlaması',
        text: `Toplam <strong>${massageEvents.length}</strong> masaj seansı uygulandı. Seanslar sonrası ortalama rahatlama düzeyi <strong>${avgRelief} / 10</strong> olarak kaydedildi.`
      });
    }

    // Adet / Döngü Analizi (Kadınlar için)
    const periodEvents = events.filter(e => e.categoryId === 'period');
    if (periodEvents.length > 0) {
      const sumCramps = periodEvents.reduce((acc, cur) => acc + (Number(cur.details?.cramps) || Number(cur.details?.intensity) || 3), 0);
      const avgCramps = (sumCramps / periodEvents.length).toFixed(1);
      insights.push({
        icon: '🩸',
        title: 'Adet / Regl Döngüsü Takibi',
        text: `Bu dönemde <strong>${periodEvents.length}</strong> gün döngü kaydı yapıldı. Ortalama kramp/sancı şiddeti <strong>${avgCramps} / 10</strong> olarak izlendi.`
      });
    }

    // Zaman Dilimi İçgörüsü
    const afternoonEvents = events.filter(e => {
      const h = parseInt((e.time || '00:00').split(':')[0], 10);
      return h >= 13 && h <= 18;
    }).length;
    if (afternoonEvents > events.length * 0.4) {
      insights.push({
        icon: '⏰',
        title: 'Öğleden Sonra Yoğunluğu',
        text: `Kayıtlarınızın %${Math.round((afternoonEvents / events.length) * 100)}'ü 13:00 - 18:00 saatleri arasına denk geliyor.`
      });
    }

    // Çıktı Oluştur
    container.innerHTML = insights.map(item => `
      <div class="insight-item">
        <span>${item.icon}</span>
        <div><strong>${item.title}:</strong> ${item.text}</div>
      </div>
    `).join('');
  },

  // 3. Günlük Trend Çizimi (Responsive SVG Bar Chart)
  renderTrendChart(events) {
    const container = document.getElementById('trend-chart-container');
    if (!container) return;

    if (events.length === 0) {
      container.innerHTML = '<p class="empty-state">Grafik için veri bulunmuyor.</p>';
      return;
    }

    // Günlere göre say
    const dateCounts = {};
    const d1 = new Date(this.startDateStr);
    const d2 = new Date(this.endDateStr);
    const cur = new Date(d1);

    // Tüm günleri sıfırla doldur
    while (cur <= d2) {
      dateCounts[this.formatDate(cur)] = 0;
      cur.setDate(cur.getDate() + 1);
    }

    events.forEach(e => {
      if (dateCounts[e.date] !== undefined) {
        dateCounts[e.date]++;
      }
    });

    const dates = Object.keys(dateCounts).sort();
    const counts = dates.map(d => dateCounts[d]);
    const maxVal = Math.max(...counts, 4);

    // SVG Boyutları
    const width = 540;
    const height = 220;
    const paddingLeft = 35;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 35;
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const barWidth = Math.max(4, Math.min(22, (chartWidth / dates.length) - 3));
    const step = chartWidth / dates.length;

    let barsSvg = '';
    let labelsSvg = '';

    dates.forEach((dateStr, idx) => {
      const count = counts[idx];
      const barH = (count / maxVal) * chartHeight;
      const x = paddingLeft + (idx * step) + (step - barWidth) / 2;
      const y = paddingTop + chartHeight - barH;

      // Renk tonu
      const barColor = count > 0 ? 'var(--primary)' : 'var(--border-color)';

      barsSvg += `
        <rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="3" fill="${barColor}">
          <title>${dateStr}: ${count} kayıt</title>
        </rect>
      `;

      // Alt tarih etiketleri (her gün veya aralıklı)
      const showLabel = dates.length <= 10 || idx === 0 || idx === dates.length - 1 || idx % Math.ceil(dates.length / 6) === 0;
      if (showLabel) {
        const dayMonth = dateStr.slice(5).replace('-', '/');
        labelsSvg += `
          <text class="chart-text" x="${x + barWidth / 2}" y="${height - 10}" text-anchor="middle">${dayMonth}</text>
        `;
      }
    });

    // Y Ekseni kılavuz çizgileri
    let gridLinesSvg = '';
    const gridSteps = 3;
    for (let g = 0; g <= gridSteps; g++) {
      const val = Math.round((maxVal / gridSteps) * g);
      const yPos = paddingTop + chartHeight - (val / maxVal) * chartHeight;
      gridLinesSvg += `
        <line class="chart-grid-line" x1="${paddingLeft}" y1="${yPos}" x2="${width - paddingRight}" y2="${yPos}" />
        <text class="chart-text" x="${paddingLeft - 8}" y="${yPos + 4}" text-anchor="end">${val}</text>
      `;
    }

    container.innerHTML = `
      <svg class="svg-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        ${gridLinesSvg}
        ${barsSvg}
        ${labelsSvg}
      </svg>
    `;
  },

  // 4. Saat Dağılımı (00:00 - 23:00 Çubuk Grafik)
  renderHourlyChart(events) {
    const container = document.getElementById('hourly-chart-container');
    if (!container) return;

    if (events.length === 0) {
      container.innerHTML = '<p class="empty-state">Grafik için veri bulunmuyor.</p>';
      return;
    }

    const hours = new Array(24).fill(0);
    events.forEach(e => {
      const h = parseInt((e.time || '12:00').split(':')[0], 10);
      if (!isNaN(h) && h >= 0 && h < 24) {
        hours[h]++;
      }
    });

    const maxVal = Math.max(...hours, 3);
    const width = 540;
    const height = 220;
    const paddingLeft = 30;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 35;
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const step = chartWidth / 24;
    const barWidth = Math.max(3, step - 3);

    let barsSvg = '';
    let labelsSvg = '';

    hours.forEach((count, h) => {
      const barH = (count / maxVal) * chartHeight;
      const x = paddingLeft + (h * step) + (step - barWidth) / 2;
      const y = paddingTop + chartHeight - barH;

      // Özel renk: eğer saatte çok olay varsa turuncu/kırmızı vurgu
      let fill = 'var(--info)';
      if (count >= maxVal && maxVal > 1) fill = '#ef4444';
      else if (count > maxVal / 2) fill = '#f59e0b';
      else if (count === 0) fill = 'rgba(148, 163, 184, 0.15)';

      barsSvg += `
        <rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="2" fill="${fill}">
          <title>Saat ${String(h).padStart(2, '0')}:00 - ${count} kayıt</title>
        </rect>
      `;

      // Saat etiketleri (her 3 saatte bir)
      if (h % 3 === 0) {
        labelsSvg += `
          <text class="chart-text" x="${x + barWidth / 2}" y="${height - 10}" text-anchor="middle">${String(h).padStart(2, '0')}h</text>
        `;
      }
    });

    container.innerHTML = `
      <svg class="svg-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        <line class="chart-grid-line" x1="${paddingLeft}" y1="${paddingTop + chartHeight}" x2="${width - paddingRight}" y2="${paddingTop + chartHeight}" />
        ${barsSvg}
        ${labelsSvg}
      </svg>
    `;
  },

  // 5. Kategori Dağılım Halka/Pasta Grafiği (Donut Chart)
  renderCategoryChart(events) {
    const container = document.getElementById('category-chart-container');
    if (!container) return;

    if (events.length === 0) {
      container.innerHTML = '<p class="empty-state">Grafik için veri bulunmuyor.</p>';
      return;
    }

    const catCounts = {};
    events.forEach(e => {
      catCounts[e.categoryId] = (catCounts[e.categoryId] || 0) + 1;
    });

    const total = events.length;
    const catKeys = Object.keys(catCounts);

    // SVG Donut Parametreleri
    const size = 220;
    const cx = 95;
    const cy = 110;
    const radius = 65;
    const strokeWidth = 26;
    const circumference = 2 * Math.PI * radius;

    let accumulatedAngle = 0;
    let pathsSvg = '';
    let legendHtml = '<div style="display:flex; flex-direction:column; gap:6px; font-size:0.8rem; margin-left:14px; max-height:190px; overflow-y:auto;">';

    catKeys.forEach(catId => {
      const cat = Storage.getCategoryById(catId);
      const count = catCounts[catId];
      const ratio = count / total;
      const strokeDash = ratio * circumference;
      const strokeGap = circumference - strokeDash;
      const strokeOffset = -accumulatedAngle * circumference;

      pathsSvg += `
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none"
          stroke="${cat.color}" stroke-width="${strokeWidth}"
          stroke-dasharray="${strokeDash} ${strokeGap}"
          stroke-dashoffset="${strokeOffset}"
          class="chart-bar">
          <title>${cat.name}: ${count} (%${Math.round(ratio * 100)})</title>
        </circle>
      `;

      accumulatedAngle += ratio;

      legendHtml += `
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${cat.color};"></span>
          <span>${cat.icon} <strong>${cat.name}</strong>: ${count} (%${Math.round(ratio * 100)})</span>
        </div>
      `;
    });

    legendHtml += '</div>';

    container.innerHTML = `
      <div style="display:flex; align-items:center; width:100%; justify-content:center;">
        <svg width="190" height="220" viewBox="0 0 190 220">
          <g transform="rotate(-90 ${cx} ${cy})">
            ${pathsSvg}
          </g>
          <text class="chart-text-value" x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="16">${total}</text>
          <text class="chart-text" x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="10">Toplam</text>
        </svg>
        ${legendHtml}
      </div>
    `;
  },

  // 6. Baş Ağrısı Şiddet Dağılımı Çizimi
  renderIntensityChart(events) {
    const container = document.getElementById('intensity-chart-container');
    if (!container) return;

    const headacheEvents = events.filter(e => e.categoryId === 'headache');
    if (headacheEvents.length === 0) {
      container.innerHTML = '<p class="empty-state" style="padding:40px 10px;">Seçilen dönemde kayıtlı baş ağrısı bulunmuyor.</p>';
      return;
    }

    // Şiddet grupları
    const levels = {
      'Hafif (1-3)': 0,
      'Orta (4-6)': 0,
      'Şiddetli (7-8)': 0,
      'Çok Şiddetli (9-10)': 0
    };

    headacheEvents.forEach(h => {
      const val = h.details?.intensity || 5;
      if (val <= 3) levels['Hafif (1-3)']++;
      else if (val <= 6) levels['Orta (4-6)']++;
      else if (val <= 8) levels['Şiddetli (7-8)']++;
      else levels['Çok Şiddetli (9-10)']++;
    });

    const colors = {
      'Hafif (1-3)': '#10b981',
      'Orta (4-6)': '#f59e0b',
      'Şiddetli (7-8)': '#f97316',
      'Çok Şiddetli (9-10)': '#ef4444'
    };

    const totalH = headacheEvents.length;

    let barsHtml = '<div style="display:flex; flex-direction:column; gap:12px; width:100%; padding:10px 14px;">';

    Object.keys(levels).forEach(lvl => {
      const count = levels[lvl];
      const pct = Math.round((count / totalH) * 100);
      const col = colors[lvl];

      barsHtml += `
        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:700; margin-bottom:4px;">
            <span>${lvl}</span>
            <span>${count} kez (%${pct})</span>
          </div>
          <div style="width:100%; height:12px; background:var(--bg-subtle); border-radius:99px; overflow:hidden;">
            <div style="width:${pct}%; height:100%; background:${col}; border-radius:99px; transition:width 0.3s ease;"></div>
          </div>
        </div>
      `;
    });

    barsHtml += '</div>';
    container.innerHTML = barsHtml;
  },

  // 7. Dönem Özeti Detay Tablosu
  renderSummaryTable(events, totalDays) {
    const tbody = document.getElementById('report-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (events.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Kayıt bulunamadı.</td></tr>';
      return;
    }

    const catMap = {};
    events.forEach(e => {
      if (!catMap[e.categoryId]) {
        catMap[e.categoryId] = {
          count: 0,
          hours: new Array(24).fill(0),
          notes: []
        };
      }
      catMap[e.categoryId].count++;
      const h = parseInt((e.time || '12:00').split(':')[0], 10);
      if (!isNaN(h)) catMap[e.categoryId].hours[h]++;
      if (e.notes && catMap[e.categoryId].notes.length < 3) {
        catMap[e.categoryId].notes.push(e.notes);
      }
    });

    Object.keys(catMap).forEach(catId => {
      const cat = Storage.getCategoryById(catId);
      const info = catMap[catId];
      const dailyAvg = (info.count / totalDays).toFixed(1);

      // En sık saat
      let peakH = 0;
      let maxHCount = 0;
      info.hours.forEach((cnt, idx) => {
        if (cnt > maxHCount) {
          maxHCount = cnt;
          peakH = idx;
        }
      });
      const peakHourStr = maxHCount > 0 ? `${String(peakH).padStart(2, '0')}:00 civarı (${maxHCount} kez)` : '-';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <span style="display:inline-flex; align-items:center; gap:6px; font-weight:700;">
            <span style="background:${cat.color}; color:#fff; width:24px; height:24px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; font-size:0.85rem;">${cat.icon}</span>
            ${cat.name}
          </span>
        </td>
        <td><strong>${info.count}</strong></td>
        <td>Günde ${dailyAvg} kez</td>
        <td>${peakHourStr}</td>
        <td><small style="color:var(--text-secondary);">${info.notes.join('; ') || '-'}</small></td>
      `;
      tbody.appendChild(tr);
    });
  },

  // 8. Rapor Yazdırma (Print / PDF)
  prepareAndPrint() {
    const rangeText = document.getElementById('print-date-range-text');
    const genDate = document.getElementById('print-generation-date');

    if (rangeText) {
      rangeText.textContent = `Dönem: ${this.startDateStr} ile ${this.endDateStr} arası`;
    }
    if (genDate) {
      genDate.textContent = new Date().toLocaleString('tr-TR');
    }

    window.print();
  },

  // 9. Excel Uyumlu Türkçe CSV İndirme
  exportCSV() {
    const events = this.getFilteredEvents();
    if (events.length === 0) {
      alert('Dışa aktarılacak kayıt bulunmuyor.');
      return;
    }

    const headers = [
      'Tarih',
      'Saat',
      'Kategori',
      'Alt Tür / Detay',
      'Şiddet (1-10)',
      'Miktar / Birim',
      'Tetikleyici / Bölge',
      'İlaç Alındı mı',
      'Notlar'
    ];

    const rows = events.map(e => {
      const cat = Storage.getCategoryById(e.categoryId);
      let subType = '';
      let intensity = '';
      let quantity = '';
      let triggerOrLoc = '';
      let med = '';

      if (e.categoryId === 'wc') {
        subType = `${e.details?.wcType || ''} (${e.details?.wcCondition || ''})`;
      } else if (e.categoryId === 'headache') {
        intensity = e.details?.intensity || '';
        triggerOrLoc = `${e.details?.location || ''} - Tetikleyici: ${e.details?.trigger || ''}`;
        med = e.details?.medTaken ? `Evet (${e.details?.medName || ''})` : 'Hayır';
      } else if (e.categoryId === 'sport') {
        subType = e.details?.sportType || 'Spor';
        intensity = e.details?.intensityLevel || '';
        quantity = `${e.details?.duration || e.details?.quantity || ''} dk`;
      } else if (e.categoryId === 'massage') {
        subType = e.details?.massageArea || 'Masaj';
        intensity = e.details?.reliefScore || e.details?.intensity || '';
        quantity = `${e.details?.duration || e.details?.quantity || ''} dk`;
        triggerOrLoc = e.details?.provider ? `Uygulayan: ${e.details.provider}` : '';
      } else if (e.categoryId === 'period') {
        subType = `${e.details?.flow || 'Orta'} (${e.details?.phase || 'Döngü'})`;
        intensity = e.details?.cramps || e.details?.intensity || '';
        triggerOrLoc = e.details?.symptoms ? e.details.symptoms.join(', ') : '';
        med = e.details?.medTaken ? `Evet (${e.details?.medName || ''})` : 'Hayır';
      } else {
        if (e.details?.intensity) intensity = e.details.intensity;
        if (e.details?.quantity !== undefined && e.details?.quantity !== null) {
          quantity = `${e.details.quantity} ${cat.unit || ''}`;
        }
      }

      const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

      return [
        escape(e.date),
        escape(e.time),
        escape(cat.name),
        escape(subType),
        escape(intensity),
        escape(quantity),
        escape(triggerOrLoc),
        escape(med),
        escape(e.notes)
      ].join(';');
    });

    // UTF-8 BOM ile Excel'in Türkçe karakterleri düzgün açması sağlanır
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `saglik_takvim_rapor_${this.startDateStr}_${this.endDateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
};
