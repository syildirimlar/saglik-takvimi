/**
 * VW Yedek Parça Araştırma + B2B Kaynak Analiz Sistemi - Ana Uygulama Motoru
 * (Bölüm 1 - 56 Tüm Kurallar)
 *
 * TEMEL PRENSİP: "VERİ YOKSA VERİ YOKTUR."
 * - İlk açılışta veritabanında 0 ürün bulunur.
 * - Hiçbir üretim ekranında demo, mock, temsili veya uydurma ürün gösterilmez.
 * - Ürünler yalnızca gerçek kaynaklardan (Test Taraması, Tam Katalog Taraması veya Canlı Arama) alındığında eklenir.
 */

window.App = (function () {
  const STORAGE_KEY = 'vw_parca_arastirma_prod_v3';
  const LEGACY_KEYS = ['rakip_arastirma_b2b_db_v1', 'rakip_arastirma_b2b_db_v2_real_only'];

  let db = null;
  let currentSearchResults = [];
  let currentBulkResults = [];
  let currentInspectedSourceId = null;
  let lastTestScanItems = [];
  let selectedSearchGroup = 'ALL';
  let activeJobTimers = {};

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let saveDebounceTimer = null;
  let isSavingToDisk = false;

  async function loadDatabase() {
    // Eski anahtarları temizle
    LEGACY_KEYS.forEach(k => {
      try { localStorage.removeItem(k); } catch (e) {}
    });

    let loadedFromDisk = false;

    // 1. ÖNCELİK: Sunucudaki kalıcı disk dosyasından (data/catalog-db.json) yükle
    try {
      const backendUrl = (window.ConnectorEngine && typeof window.ConnectorEngine.getBackendUrl === 'function') 
        ? window.ConnectorEngine.getBackendUrl() 
        : 'http://localhost:8890';
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`${backendUrl}/api/db`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const diskDb = await res.json();
        if (diskDb && Array.isArray(diskDb.sources) && Array.isArray(diskDb.source_products)) {
          db = diskDb;
          loadedFromDisk = true;
          console.log(`[DiskStorage] Kalıcı disk veritabanı başarıyla yüklendi: ${db.source_products.length} ürün.`);
        }
      }
    } catch (diskErr) {
      console.warn('[DiskStorage] Sunucu diski okunamadı veya sunucu henüz başlamadı:', diskErr);
    }

    // 2. YEDEK: Eğer diskten okunamadıysa localStorage'dan dene
    if (!loadedFromDisk) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.sources) && Array.isArray(parsed.source_products)) {
            db = parsed;
          }
        }
      } catch (e) {
        console.warn('Yerel tarayıcı hafızası okunamadı:', e);
      }
    }

    // 3. Hiçbiri yoksa sıfır veritabanı ile başla (VERİ YOKSA VERİ YOKTUR)
    if (!db || !Array.isArray(db.sources) || !Array.isArray(db.source_products)) {
      db = window.DBSeed.getInitialDatabase();
    }

    // Eksik kaynak varsa DEFAULT_SOURCES'tan tamamla ve güncellenen kaynak URL'lerini senkronize et
    window.DBSeed.DEFAULT_SOURCES.forEach(defSrc => {
      const existingSrc = db.sources.find(s => s.id === defSrc.id);
      if (!existingSrc) {
        db.sources.push(JSON.parse(JSON.stringify(defSrc)));
      } else {
        if (defSrc.id === 'src_dega' || defSrc.id === 'src_florimex' || defSrc.id === 'src_phira' || defSrc.id === 'src_prasco' || defSrc.id === 'src_isam' || defSrc.id === 'src_onlinecarparts' || defSrc.id === 'src_autodoc_uk') {
          existingSrc.name = defSrc.name;
          existingSrc.base_url = defSrc.base_url;
          existingSrc.product_url = defSrc.product_url;
          existingSrc.category_url = defSrc.category_url;
          existingSrc.notes = defSrc.notes;
        }
      }
    });

    // Her kaynağın ürün sayısını gerçek tablodan senkronize et
    db.sources.forEach(s => {
      s.product_count = db.source_products.filter(p => p.source_id === s.id && !p.archived).length;
    });

    // İlk açılışta disk ile senkronize et
    saveDatabase();
  }

  function saveDatabase() {
    // 1. Tarayıcı localStorage'a güvenli kayıt (QuotaExceededError koruması ile)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.warn('[LocalStorage] Kota aşıldı veya yerel hafızaya yazılamadı, hafif kopya kaydediliyor:', e);
      try {
        // Kota hatasında log ve job detaylarını hafifletip ana ürünleri ve kaynakları koru
        const slim = {
          ...db,
          scan_job_items: (db.scan_job_items || []).slice(0, 30),
          source_errors: (db.source_errors || []).slice(0, 50),
          search_logs: (db.search_logs || []).slice(0, 50)
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
      } catch (e2) {
        console.warn('[LocalStorage] Hafif kopya da kaydedilemedi. Sunucu disk kaydı devrede.');
      }
    }

    updateKpisAndBadges();
    updateDiskBadgeStatus();

    // 2. KALICI DİSK SENKRONİZASYONU (Debounce ile sunucu diski data/catalog-db.json dosyasına kaydet)
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      saveToDiskNow();
    }, 500);
  }

  async function saveToDiskNow() {
    if (isSavingToDisk || !db) return;
    isSavingToDisk = true;
    updateDiskBadgeStatus(true);

    try {
      const backendUrl = (window.ConnectorEngine && typeof window.ConnectorEngine.getBackendUrl === 'function') 
        ? window.ConnectorEngine.getBackendUrl() 
        : 'http://localhost:8890';
      const payload = JSON.stringify(db);
      const res = await fetch(`${backendUrl}/api/db`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      if (res.ok) {
        console.log(`[DiskStorage] Veritabanı diske (data/catalog-db.json) başarıyla yazıldı (${db.source_products.length} ürün).`);
      }
    } catch (err) {
      console.warn('[DiskStorage] Sunucu diskine yazılamadı:', err);
    } finally {
      isSavingToDisk = false;
      updateDiskBadgeStatus(false);
    }
  }

  function updateDiskBadgeStatus(saving = false) {
    const badge = document.getElementById('diskStorageStatusBadge');
    if (!badge || !db) return;
    const prodCount = (db.source_products || []).filter(p => !p.archived).length;
    if (saving) {
      badge.innerHTML = `<span style="color:#f59e0b;">⏳ Diske Yazılıyor...</span>`;
    } else {
      badge.innerHTML = `💾 Diske Kayıtlı: <b>data/catalog-db.json</b> (${prodCount} Ürün)`;
    }
  }

  function logSourceError(source, url, code, message) {
    const errRec = {
      id: 'err_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      recorded_at: window.DBSeed.nowTimestamp(),
      source_id: source ? source.id : '-',
      source_name: source ? source.name : '-',
      url: url || (source ? source.base_url : '-'),
      error_code: code || 'ERR',
      message: message || 'Bilinmeyen hata'
    };
    db.source_errors.unshift(errRec);
    if (source) {
      source.last_error = `${errRec.recorded_at}: ${errRec.message}`;
    }
    saveDatabase();
    renderJobsAndErrorsTab();
  }

  // ===========================================================================
  // ÜST KPI VE SEKME ROZETLERİ
  // ===========================================================================
  function updateKpisAndBadges() {
    if (!db) return;
    const totalSources = db.sources.length;
    const readySources = db.sources.filter(s => s.adapter_status === 'READY').length;
    const analyzedSources = db.sources.filter(s => s.adapter_status === 'ANALYZED' || s.adapter_status === 'READY').length;
    const activeProducts = db.source_products.filter(p => !p.archived).length;
    const priceCount = db.product_prices.length;
    const stockCount = db.product_stock_history.length;
    const searchCount = db.search_logs.length;
    const xrefCount = db.product_cross_references.length;
    const runningOrPendingJobs = db.scan_jobs.filter(j => j.status === 'Running' || j.status === 'Pending' || j.status === 'Paused').length;

    const elTotalSrc = document.getElementById('kpi-total-sources');
    const elSrcSub = document.getElementById('kpi-sources-sub');
    const elTotalProd = document.getElementById('kpi-total-products');
    const elTotalHist = document.getElementById('kpi-total-history');
    const elHistSub = document.getElementById('kpi-history-sub');
    const elTotalSearch = document.getElementById('kpi-total-searches');
    const elXrefSub = document.getElementById('kpi-xref-sub');

    if (elTotalSrc) elTotalSrc.textContent = String(totalSources);
    if (elSrcSub) elSrcSub.textContent = `Hazır (READY): ${readySources} • Analiz Edilen: ${analyzedSources}/${totalSources}`;
    if (elTotalProd) elTotalProd.textContent = String(activeProducts);
    if (elTotalHist) elTotalHist.textContent = String(priceCount + stockCount);
    if (elHistSub) elHistSub.textContent = `Fiyat Kaydı: ${priceCount} • Stok Kaydı: ${stockCount}`;
    if (elTotalSearch) elTotalSearch.textContent = String(searchCount);
    if (elXrefSub) elXrefSub.textContent = `Çapraz Referans (xref): ${xrefCount}`;

    const badgeSearch = document.getElementById('badge-search-count');
    const badgeSources = document.getElementById('badge-sources-count');
    const badgeJobs = document.getElementById('badge-jobs-count');
    const badgeDb = document.getElementById('badge-db-count');

    if (badgeSearch) badgeSearch.textContent = String(currentSearchResults.length);
    if (badgeSources) badgeSources.textContent = String(totalSources);
    if (badgeJobs) badgeJobs.textContent = String(runningOrPendingJobs || db.scan_jobs.length);
    if (badgeDb) badgeDb.textContent = String(activeProducts);
  }

  // ===========================================================================
  // YEREL SUNUCU (baslat.bat) DURUM KONTROLÜ
  // ===========================================================================
  async function refreshBackendStatus() {
    const dot = document.getElementById('backendStatusDot');
    const txt = document.getElementById('backendStatusText');
    const ok = await window.ConnectorEngine.checkBackendHealth();
    if (dot && txt) {
      if (ok) {
        dot.className = 'status-dot green';
        txt.textContent = 'Canlı Scraper Sunucusu Aktif (8890)';
      } else {
        dot.className = 'status-dot yellow';
        txt.textContent = 'Doğrudan Tarayıcı Modu (Tam Erişim İçin baslat.bat Çalıştırın)';
      }
    }
  }

  // ===========================================================================
  // SEKME 1: ANA ARAMA EKRANI (LOCAL DB -> LIVE SEARCH)
  // ===========================================================================
  function renderSearchSourceCheckboxes() {
    const container = document.getElementById('searchSourceCheckboxes');
    if (!container) return;

    const sources = db.sources.filter(s => {
      if (selectedSearchGroup !== 'ALL' && s.group !== selectedSearchGroup) return false;
      return true;
    });

    container.innerHTML = sources.map(src => {
      let dotClass = 'green';
      let statusLabel = src.adapter_status || 'NOT ANALYZED';
      if (!src.active) {
        dotClass = 'red';
        statusLabel = 'Pasif';
      } else if (src.is_b2b && src.login_status !== 'Authenticated') {
        dotClass = 'yellow';
        statusLabel = 'Login Gerekli';
      } else if (src.adapter_status === 'READY') {
        dotClass = 'green';
        statusLabel = 'READY';
      } else {
        dotClass = 'yellow';
      }

      return `
        <label class="source-check-item" title="${escapeHtml(src.base_url)} (${escapeHtml(src.adapter_name)})">
          <input type="checkbox" class="search-src-checkbox" value="${escapeHtml(src.id)}" ${src.active ? 'checked' : ''} />
          <span class="status-dot ${dotClass}"></span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            <b>[Ö${src.priority}]</b> ${escapeHtml(src.name)}
          </span>
          <span class="badge ${src.is_b2b ? 'badge-purple' : 'badge-blue'}" style="font-size:10px;">
            ${escapeHtml(statusLabel)} (${src.product_count || 0})
          </span>
        </label>
      `;
    }).join('');
  }

  function getSelectedSearchSourceIds() {
    const checkboxes = document.querySelectorAll('.search-src-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }

  /**
   * Bölüm 10, 29, 30, 31, 32:
   * 1. Önce LOCAL DATABASE içinde ara
   * 2. Bulunursa anında göster
   * 3. Bulunamazsa (veya kullanıcı forceLive seçtiyse) seçili aktif kaynaklarda LIVE SEARCH başlat
   * 4. Canlı aramadan dönen gerçek ürünleri veritabanına kaydet ve tabloda göster
   */
  async function executePartSearch(queryInput, forceLive = false) {
    const rawQuery = (queryInput || '').trim();
    if (!rawQuery) {
      alert('Lütfen aramak istediğiniz OEM numarasını, ürün kodunu veya parça adını girin.');
      return;
    }

    const parsedQuery = window.OEMEngine.parseOEMList(rawQuery);
    const normQuery = parsedQuery.primaryNormalized || window.OEMEngine.normalizeSingleOEM(rawQuery);

    const previewEl = document.getElementById('normalizedOemPreview');
    if (previewEl) {
      previewEl.innerHTML = `Orijinal: <b>${escapeHtml(rawQuery)}</b> &nbsp;|&nbsp; Normalize OEM: <b>${escapeHtml(normQuery || '-')}</b>`;
    }

    const selectedSourceIds = getSelectedSearchSourceIds();
    if (selectedSourceIds.length === 0) {
      alert('Lütfen arama yapılacak en az bir kaynak seçin.');
      return;
    }

    const statusPanel = document.getElementById('parallelExecutionStatus');
    const alertsContainer = document.getElementById('interventionAlertsContainer');
    if (alertsContainer) alertsContainer.innerHTML = '';

    // ADIM 1: YEREL VERİTABANINDA (LOCAL DATABASE) ARA
    const localMatches = [];
    const activeCatalog = db.source_products.filter(
      p => !p.archived && selectedSourceIds.includes(p.source_id)
    );

    activeCatalog.forEach(prod => {
      const ev = window.OEMEngine.evaluateMatchConfidence(rawQuery, prod, db.product_cross_references);
      if (ev.matched) {
        prod.search_count = (prod.search_count || 0) + 1;
        localMatches.push({
          ...prod,
          match_confidence: ev.level,
          match_score: ev.score,
          match_reason: ev.reason,
          result_source_mode: 'Local Database'
        });
      }
    });

    let liveFetchedCount = 0;
    const liveFetchedIds = new Set();
    let searchModeUsed = 'Local Database';

    function recomputeAndRenderCurrentMatches() {
      const matches = [];
      const cat = db.source_products.filter(
        p => !p.archived && selectedSourceIds.includes(p.source_id)
      );
      cat.forEach(prod => {
        const ev = window.OEMEngine.evaluateMatchConfidence(rawQuery, prod, db.product_cross_references);
        if (ev.matched || liveFetchedIds.has(prod.id)) {
          const srcObj = db.sources.find(s => s.id === prod.source_id);
          matches.push({
            ...prod,
            source_priority: srcObj ? srcObj.priority : 2,
            match_confidence: ev.matched ? ev.level : 'Medium',
            match_score: ev.matched ? ev.score : 65,
            match_reason: ev.matched ? ev.reason : 'Canlı kaynak aramasından doğrudan eşleşen ürün'
          });
        }
      });
      currentSearchResults = matches;
      renderSearchResultsTable(rawQuery, searchModeUsed, liveFetchedCount);
    }

    // ADIM 2: YERELDE YOKSA VEYA KULLANICI CANLI ARAMA İSTEDİYSE -> LIVE SEARCH
    if (localMatches.length === 0 || forceLive) {
      searchModeUsed = localMatches.length > 0 ? 'Local DB + Live Search' : 'Live Search';
      const targetSources = db.sources
        .filter(s => selectedSourceIds.includes(s.id) && s.active)
        .sort((a, b) => (a.priority || 2) - (b.priority || 2));

      if (statusPanel) {
        statusPanel.style.display = 'block';
        statusPanel.innerHTML = `
          <div style="font-size:13px;font-weight:700;margin-bottom:8px;">
            ⚡ Canlı Kaynak Araştırması (Live Search) Çalışıyor: <code>${escapeHtml(rawQuery)}</code> (Normalize: <code>${escapeHtml(normQuery)}</code>)
          </div>
          <div id="liveSearchSourceBadges" style="display:flex;flex-wrap:wrap;gap:6px;">
            ${targetSources.map(s => `<span class="badge badge-gray" id="live-badge-${s.id}">⏳ ${escapeHtml(s.name)}: Bekliyor</span>`).join('')}
          </div>
        `;
      }

      const b2bNeedingLogin = [];

      async function searchSingleSource(src) {
        const badgeEl = document.getElementById(`live-badge-${src.id}`);
        if (src.is_b2b && src.login_status !== 'Authenticated') {
          b2bNeedingLogin.push(src);
          if (badgeEl) {
            badgeEl.className = 'badge badge-yellow';
            badgeEl.textContent = `🔒 ${src.name}: Manuel giriş gerekiyor`;
          }
          return;
        }

        if (badgeEl) {
          badgeEl.className = 'badge badge-blue';
          badgeEl.textContent = `🔄 ${src.name}: Taranıyor...`;
        }

        try {
          const adapter = window.ConnectorEngine.getAdapterForSource(src);
          const liveItems = await adapter.searchProduct(src, rawQuery);
          let savedForSource = 0;

          if (Array.isArray(liveItems) && liveItems.length > 0) {
            liveItems.forEach(rawItem => {
              const upserted = window.DBSeed.upsertRealProduct(db, {
                ...rawItem,
                source_id: src.id,
                source_name: src.name,
                source_type: src.source_type,
                adapter_name: src.adapter_name
              }, 'Live Search');

              if (upserted && upserted.product) {
                liveFetchedIds.add(upserted.product.id);
                savedForSource++;
                liveFetchedCount++;
              }
            });
            src.last_successful_scan = window.DBSeed.nowTimestamp();
            saveDatabase();
            recomputeAndRenderCurrentMatches();
          }

          if (badgeEl) {
            badgeEl.className = savedForSource > 0 ? 'badge badge-green' : 'badge badge-gray';
            badgeEl.textContent = savedForSource > 0
              ? `✓ ${src.name}: ${savedForSource} gerçek ürün`
              : `• ${src.name}: 0 ürün`;
          }
        } catch (err) {
          logSourceError(src, src.base_url, 'LIVE_SEARCH_ERR', err.message || 'Canlı arama hatası');
          if (badgeEl) {
            badgeEl.className = 'badge badge-red';
            badgeEl.textContent = `✕ ${src.name}: Hata`;
          }
        }
      }

      // 1) Doğrudan tarayıcıdan çalışan BB Classic Parts'ı anında başlat (<0.4 sn)
      const directSources = targetSources.filter(s => s.id === 'src_bbclassic');
      const backendSources = targetSources.filter(s => s.id !== 'src_bbclassic');

      await Promise.all([
        ...directSources.map(s => searchSingleSource(s)),
        (async () => {
          for (const src of backendSources) {
            await searchSingleSource(src);
          }
        })()
      ]);

      // B2B login gereken kaynaklar için uyarı bandı
      if (b2bNeedingLogin.length > 0 && alertsContainer) {
        alertsContainer.innerHTML = `
          <div class="alert-banner warning" style="margin-bottom:14px;">
            <div>
              <b>🔒 Manuel Giriş / Doğrulama Gereken B2B Kaynaklar (${b2bNeedingLogin.length}):</b>
              ${b2bNeedingLogin.map(s => escapeHtml(s.name)).join(', ')}.
              B2B fiyat ve stok verilerini çekmek için yetkili oturum açın.
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${b2bNeedingLogin.slice(0, 3).map(s => `
                <button class="btn btn-warning btn-sm" onclick="window.App.openB2bAuthModal('${s.id}')">
                  🔐 ${escapeHtml(s.name)} Giriş
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }
    } else if (statusPanel) {
      statusPanel.style.display = 'block';
      statusPanel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            ✅ <b>Yerel Veritabanında (Local Database) Bulundu:</b> <code>${escapeHtml(rawQuery)}</code> için yerel katalogdan <b>${localMatches.length}</b> gerçek kayıt hızla getirildi.
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.App.runSearch(true)">
            ⚡ Yine de Canlı Kaynaklarda Ara (Live Search)
          </button>
        </div>
      `;
    }

    recomputeAndRenderCurrentMatches();
    const finalMatches = currentSearchResults;

    // Bölüm 33: Arama Logu Kaydet
    db.search_logs.unshift({
      id: 'slog_' + Date.now(),
      query: rawQuery,
      normalized_oem: normQuery || '-',
      searched_at: window.DBSeed.nowTimestamp(),
      sources_count: selectedSourceIds.length,
      mode: searchModeUsed,
      results_count: finalMatches.length
    });

    saveDatabase();
    renderSearchResultsTable(rawQuery, searchModeUsed, liveFetchedCount);
    renderHistoryAndCatalogTab();
  }

  function renderSearchResultsTable(queryLabel = '', searchModeUsed = '', liveFetchedCount = 0) {
    const tbody = document.getElementById('searchResultsTbody');
    const summaryEl = document.getElementById('searchResultSummaryText');
    if (!tbody) return;

    const sortVal = document.getElementById('resultSortSelect')?.value || 'price_asc';
    const confFilter = document.getElementById('resultConfidenceFilter')?.value || 'ALL';
    const stockFilter = document.getElementById('resultStockFilter')?.value || 'ALL';

    let rows = [...currentSearchResults];

    if (confFilter !== 'ALL') {
      rows = rows.filter(r => r.match_confidence === confFilter);
    }
    if (stockFilter === 'INSTOCK') {
      rows = rows.filter(r => r.stock_status === 'In Stock' || r.stock_status === 'Stokta');
    } else if (stockFilter === 'B2B_ONLY') {
      rows = rows.filter(r => r.b2b_price !== null && r.b2b_price !== undefined);
    }

    const confRank = { Exact: 4, High: 3, Medium: 2, Low: 1 };
    rows.sort((a, b) => {
      if (sortVal === 'price_asc') {
        const pa = a.b2b_price ?? a.public_price ?? a.price ?? 99999999;
        const pb = b.b2b_price ?? b.public_price ?? b.price ?? 99999999;
        return pa - pb;
      }
      if (sortVal === 'price_desc') {
        const pa = a.b2b_price ?? a.public_price ?? a.price ?? -1;
        const pb = b.b2b_price ?? b.public_price ?? b.price ?? -1;
        return pb - pa;
      }
      if (sortVal === 'confidence') {
        return (confRank[b.match_confidence] || 0) - (confRank[a.match_confidence] || 0);
      }
      if (sortVal === 'priority') {
        return (a.source_priority || 2) - (b.source_priority || 2);
      }
      return 0;
    });

    if (summaryEl) {
      if (rows.length === 0) {
        summaryEl.innerHTML = queryLabel
          ? `<b>"${escapeHtml(queryLabel)}"</b> için <b>0 gerçek ürün bulundu</b> (${escapeHtml(searchModeUsed || 'Local + Live')}). Sistem kuralı gereği uydurma/temsili sonuç üretilmez.`
          : `Henüz sonuç yok (0 gerçek ürün).`;
      } else {
        summaryEl.innerHTML = `<b>${rows.length} gerçek ürün</b> listeleniyor • Arama Modu: <b>${escapeHtml(searchModeUsed || 'Local Database')}</b>${liveFetchedCount > 0 ? ` • Canlı Aramadan Yeni Eklenen: <b>${liveFetchedCount}</b>` : ''}`;
      }
    }

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="16" style="text-align:center;padding:36px;color:var(--text-secondary);">
            <b>0 gerçek ürün bulundu / Gerçek ürün verisi bulunamadı.</b><br/>
            <span style="font-size:12px;">Bölüm 1 &amp; 46 Kuralı: Veri yoksa veri yoktur; hiçbir temsili veya uydurma ürün eklenmez. Yerel sunucu (<code>baslat.bat</code>) açıkken <b>⚡ CANLI ARA (LIVE SEARCH)</b> butonunu deneyebilirsiniz.</span>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const confBadgeClass =
        r.match_confidence === 'Exact' ? 'badge-green' :
        r.match_confidence === 'High' ? 'badge-blue' :
        r.match_confidence === 'Medium' ? 'badge-yellow' : 'badge-gray';

      const stockBadgeClass =
        (r.stock_status === 'In Stock' || r.stock_status === 'Stokta') ? 'badge-green' :
        (r.stock_status === 'Low Stock' || r.stock_status === 'Az Stok') ? 'badge-yellow' : 'badge-red';

      const pubPriceStr = (r.public_price !== null && r.public_price !== undefined)
        ? Number(r.public_price).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '-';
      const b2bPriceStr = (r.b2b_price !== null && r.b2b_price !== undefined)
        ? Number(r.b2b_price).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '-';

      const shortDesc = r.description
        ? (r.description.length > 75 ? r.description.substring(0, 75) + '…' : r.description)
        : '-';

      return `
        <tr>
          <td>
            <div style="font-weight:700;">${escapeHtml(r.source_name || r.source)}</div>
            <span class="badge ${r.data_origin === 'Live Search' ? 'badge-blue' : 'badge-gray'}" style="font-size:10px;margin-top:3px;">
              ${escapeHtml(r.data_origin || 'Local Database')}
            </span>
          </td>
          <td><span class="badge ${r.source_type && r.source_type.includes('B2B') ? 'badge-purple' : 'badge-gray'}">${escapeHtml(r.source_type || 'Public Web')}</span></td>
          <td>
            <div style="font-weight:600;max-width:240px;">${escapeHtml(r.product_name)}</div>
            ${r.compatibility ? `<div style="font-size:11px;color:var(--text-muted);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Uyumluluk: ${escapeHtml(r.compatibility)}</div>` : ''}
          </td>
          <td>${escapeHtml(r.brand || '-')}</td>
          <td class="mono">${escapeHtml(r.product_code || '-')}</td>
          <td>
            <div class="mono" style="font-weight:700;">${escapeHtml(r.oem_number || '-')}</div>
            <div class="mono" style="font-size:10.5px;color:var(--text-muted);">Norm: ${escapeHtml(r.normalized_oem || '-')}</div>
          </td>
          <td class="mono">${escapeHtml(r.competitor_part_number || '-')}</td>
          <td style="max-width:200px;font-size:11.5px;color:var(--text-secondary);" title="${escapeHtml(r.description || '')}">${escapeHtml(shortDesc)}</td>
          <td><span class="badge ${stockBadgeClass}">${escapeHtml(r.stock_status || 'Unknown')}</span></td>
          <td class="mono">${r.stock_quantity !== null && r.stock_quantity !== undefined ? escapeHtml(r.stock_quantity) : '-'}</td>
          <td class="price-cell">${pubPriceStr}</td>
          <td class="price-cell" style="color:var(--accent-purple);">${b2bPriceStr}</td>
          <td class="mono">${escapeHtml(r.currency || '-')}</td>
          <td>
            <span class="badge ${confBadgeClass}" title="${escapeHtml(r.match_reason || '')}">${escapeHtml(r.match_confidence)}</span>
          </td>
          <td style="font-size:11px;color:var(--text-secondary);">
            <div>${escapeHtml(r.last_checked || r.last_seen || '-')}</div>
          </td>
          <td>
            <div style="display:flex;flex-direction:column;gap:4px;">
              <button class="btn btn-secondary btn-sm" onclick="window.App.checkSingleProductNow('${escapeHtml(r.id)}')" title="Bölüm 34: Tek ürün için kaynağa gidip anlık fiyat ve stoğu kontrol et">
                🔄 Şu anki fiyat ve stoğu kontrol et
              </button>
              <div style="display:flex;gap:4px;">
                <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="window.App.openProductDetailModal('${escapeHtml(r.id)}')">
                  🔍 Detayları göster
                </button>
                <a href="${escapeHtml(r.product_url)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" title="Gerçek ürün sayfasını aç">
                  ↗ Site
                </a>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ===========================================================================
  // BÖLÜM 34: TEK ÜRÜN ANLIK CANLI KONTROL ("Şu anki fiyat ve stoğu kontrol et")
  // ===========================================================================
  async function checkSingleProductNow(productId) {
    const prod = db.source_products.find(p => p.id === productId);
    if (!prod) return;
    const src = db.sources.find(s => s.id === prod.source_id);
    if (!src) return;

    const adapter = window.ConnectorEngine.getAdapterForSource(src);
    try {
      const res = await adapter.getProduct(src, prod);
      if (res && res.ok && res.item) {
        const upserted = window.DBSeed.upsertRealProduct(db, {
          ...prod,
          ...res.item,
          source_id: src.id,
          source_name: src.name,
          source_type: src.source_type
        }, 'Live Check');

        saveDatabase();
        // Mevcut arama listesini de güncelle
        const idx = currentSearchResults.findIndex(r => r.id === productId);
        if (idx !== -1 && upserted?.product) {
          currentSearchResults[idx] = {
            ...currentSearchResults[idx],
            ...upserted.product
          };
        }
        renderSearchResultsTable();
        renderHistoryAndCatalogTab();

        const msgParts = [`"${prod.product_name}" için anlık canlı kontrol tamamlandı.`];
        if (upserted.priceChanged) msgParts.push('• Yeni fiyat değişimi `product_prices` geçmişine kaydedildi.');
        else msgParts.push('• Fiyat değişmedi (son kontrol tarihi güncellendi).');
        if (upserted.stockChanged) msgParts.push('• Yeni stok değişimi `product_stock_history` geçmişine kaydedildi.');
        else msgParts.push('• Stok durumu değişmedi.');
        alert(msgParts.join('\n'));
      } else {
        prod.last_checked = window.DBSeed.nowTimestamp();
        saveDatabase();
        renderSearchResultsTable();
        alert(res?.error || 'Canlı kontrol için yerel sunucu (baslat.bat) gereklidir veya kaynak sayfasına ulaşılamadı.');
      }
    } catch (err) {
      logSourceError(src, prod.product_url, 'LIVE_CHECK_ERR', err.message);
      alert('Anlık kontrol sırasında hata oluştu: ' + err.message);
    }
  }

  // ===========================================================================
  // BÖLÜM 41 & 45: ÜRÜN PROVENANCE & TEKNİK DETAYLAR MODALI ("Detayları göster")
  // ===========================================================================
  function openProductDetailModal(productId) {
    const prod = db.source_products.find(p => p.id === productId);
    if (!prod) return;

    const modal = document.getElementById('productDetailModalBackdrop');
    const titleEl = document.getElementById('prodDetailModalTitle');
    const bodyEl = document.getElementById('prodDetailModalBody');
    if (!modal || !bodyEl) return;

    if (titleEl) titleEl.textContent = `🔍 Ürün Provenance & Teknik Detaylar — ${prod.product_name}`;

    const prices = db.product_prices.filter(pp => pp.product_id === prod.id);
    const stocks = db.product_stock_history.filter(ps => ps.product_id === prod.id);
    const xrefs = db.product_cross_references.filter(x => x.product_id === prod.id);

    bodyEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:14px;font-size:12.5px;">
        <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;border:1px solid var(--border-color);">
          <div style="font-weight:700;margin-bottom:6px;color:var(--accent-blue);">📌 Veri Kaynağı &amp; Provenance (Bölüm 41)</div>
          <div><b>Source ID:</b> <code>${escapeHtml(prod.source_id)}</code> (${escapeHtml(prod.source_name)})</div>
          <div><b>Source Product ID:</b> <code>${escapeHtml(prod.source_product_id)}</code></div>
          <div><b>Adapter:</b> <code>${escapeHtml(prod.adapter_name || '-')}</code></div>
          <div><b>Veri Kaynağı Tipi:</b> <span class="badge badge-blue">${escapeHtml(prod.data_origin || 'Local Database')}</span></div>
          <div><b>İlk Görülme (First Seen):</b> ${escapeHtml(prod.first_seen || '-')}</div>
          <div><b>Son Görülme (Last Seen):</b> ${escapeHtml(prod.last_seen || '-')}</div>
          <div><b>Son Kontrol (Last Checked):</b> ${escapeHtml(prod.last_checked || '-')}</div>
          <div><b>Arama Sayısı:</b> ${prod.search_count || 0}</div>
        </div>

        <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;border:1px solid var(--border-color);">
          <div style="font-weight:700;margin-bottom:6px;color:var(--accent-green);">🔧 Parça &amp; OEM Bilgileri</div>
          <div><b>Marka:</b> ${escapeHtml(prod.brand || '-')}</div>
          <div><b>Ürün Kodu:</b> <code>${escapeHtml(prod.product_code || '-')}</code></div>
          <div><b>Orijinal OEM:</b> <code>${escapeHtml(prod.oem_number || '-')}</code></div>
          <div><b>Normalize OEM:</b> <code>${escapeHtml(prod.normalized_oem || '-')}</code></div>
          <div><b>Rakip Parça No:</b> <code>${escapeHtml(prod.competitor_part_number || '-')}</code></div>
          <div><b>Kategori:</b> ${escapeHtml(prod.category || '-')} ${prod.subcategory ? ' / ' + escapeHtml(prod.subcategory) : ''}</div>
          <div><b>Uyumluluk:</b> ${escapeHtml(prod.compatibility || '-')}</div>
        </div>
      </div>

      <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;border:1px solid var(--border-color);margin-bottom:14px;font-size:12.5px;">
        <div style="font-weight:700;margin-bottom:4px;">📝 Tam Ürün Açıklaması</div>
        <div style="color:var(--text-secondary);line-height:1.5;">${escapeHtml(prod.description || 'Açıklama bulunmuyor.')}</div>
        <div style="margin-top:8px;">
          <b>Gerçek Ürün URL:</b> <a href="${escapeHtml(prod.product_url)}" target="_blank" rel="noopener" style="color:var(--accent-blue);">${escapeHtml(prod.product_url)}</a>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;font-size:12px;">
        <div>
          <div style="font-weight:700;margin-bottom:6px;">💶 Fiyat Değişim Geçmişi (${prices.length})</div>
          <ul style="padding-left:16px;margin:0;color:var(--text-secondary);">
            ${prices.map(p => `<li>${escapeHtml(p.recorded_at)} — Public: <b>${p.public_price ?? '-'}</b> / B2B: <b>${p.b2b_price ?? '-'}</b> ${escapeHtml(p.currency)}</li>`).join('') || '<li>Kayıt yok</li>'}
          </ul>
        </div>
        <div>
          <div style="font-weight:700;margin-bottom:6px;">📦 Stok Değişim Geçmişi (${stocks.length})</div>
          <ul style="padding-left:16px;margin:0;color:var(--text-secondary);">
            ${stocks.map(s => `<li>${escapeHtml(s.recorded_at)} — <b>${escapeHtml(s.stock_status)}</b> (Miktar: ${s.stock_quantity ?? '-'})</li>`).join('') || '<li>Kayıt yok</li>'}
          </ul>
        </div>
      </div>
      ${xrefs.length > 0 ? `
        <div style="margin-top:12px;font-size:12px;">
          <div style="font-weight:700;margin-bottom:4px;">🔗 Çapraz Referans Numaraları (${xrefs.length})</div>
          <div>${xrefs.map(x => `<span class="badge badge-gray" style="margin-right:4px;">${escapeHtml(x.normalized_oem)} ↔ ${escapeHtml(x.alternative_part_number)}</span>`).join('')}</div>
        </div>
      ` : ''}
    `;

    modal.classList.add('open');
  }

  // ===========================================================================
  // SEKME 2: KAYNAK YÖNETİMİ, KAYNAK ANALİZİ VE GERÇEK TEST TARAMASI
  // Zorunlu Sıra: 1. Kaynağı Analiz Et -> 2. 20/50 Ürün Gerçek Test Taraması -> 3. Onay & Tam Tarama
  // ===========================================================================
  function renderSourcesTable() {
    const tbody = document.getElementById('sourcesTableTbody');
    if (!tbody) return;

    const grpFilter = document.getElementById('sourcesGroupFilter')?.value || 'ALL';
    const list = db.sources
      .filter(s => grpFilter === 'ALL' || s.group === grpFilter)
      .sort((a, b) => (a.priority || 2) - (b.priority || 2));

    tbody.innerHTML = list.map(src => {
      const statusBadge =
        src.adapter_status === 'READY' ? 'badge-green' :
        src.adapter_status === 'ANALYZED' ? 'badge-blue' :
        src.adapter_status === 'LOGIN REQUIRED' ? 'badge-yellow' :
        src.adapter_status === 'NOT READY' ? 'badge-red' : 'badge-gray';

      const loginBadge =
        src.login_status === 'Authenticated' ? 'badge-green' :
        src.is_b2b ? 'badge-yellow' : 'badge-gray';

      const canRunFullScan = !src.is_b2b || src.login_status === 'Authenticated' || (src.test_approved && src.adapter_status === 'READY');

      return `
        <tr>
          <td>
            <select class="form-select" style="padding:3px 6px;font-size:12px;" onchange="window.App.changeSourcePriority('${src.id}', this.value)">
              <option value="1" ${src.priority === 1 ? 'selected' : ''}>Öncelik 1</option>
              <option value="2" ${src.priority === 2 ? 'selected' : ''}>Öncelik 2</option>
              <option value="3" ${src.priority === 3 ? 'selected' : ''}>Öncelik 3</option>
            </select>
          </td>
          <td>
            <div style="font-weight:700;">${escapeHtml(src.name)}</div>
            <div style="font-size:11px;color:var(--text-muted);">
              <a href="${escapeHtml(src.base_url)}" target="_blank" rel="noopener" style="color:var(--accent-blue);">${escapeHtml(src.base_url)}</a>
            </div>
            ${src.notes ? `<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${escapeHtml(src.notes)}</div>` : ''}
          </td>
          <td>
            <div style="font-weight:600;font-size:12px;">${escapeHtml(src.group)}</div>
            <div style="font-size:11px;color:var(--text-secondary);">${escapeHtml(src.source_type)}</div>
          </td>
          <td>
            <span class="badge ${src.is_b2b ? 'badge-purple' : 'badge-blue'}">${src.is_b2b ? 'B2B' : 'Public'}</span>
          </td>
          <td>
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px;">
              <input type="checkbox" ${src.active ? 'checked' : ''} onchange="window.App.toggleSourceActive('${src.id}', this.checked)" />
              <span>${src.active ? 'Aktif' : 'Pasif'}</span>
            </label>
          </td>
          <td>
            <span class="badge ${loginBadge}">${escapeHtml(src.login_status || (src.is_b2b ? 'Login Required' : 'Not Required'))}</span>
            ${src.is_b2b ? `
              <div style="margin-top:4px;">
                <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:11px;" onclick="window.App.openB2bAuthModal('${src.id}')">
                  🔐 B2B Giriş
                </button>
              </div>
            ` : ''}
          </td>
          <td>
            <div class="mono" style="font-size:11.5px;font-weight:600;">${escapeHtml(src.adapter_name)}</div>
            <span class="badge ${statusBadge}" style="margin-top:3px;">${escapeHtml(src.adapter_status || 'NOT ANALYZED')}</span>
          </td>
          <td class="mono" style="font-weight:700;font-size:14px;">${src.product_count || 0}</td>
          <td style="font-size:11px;color:var(--text-secondary);max-width:210px;">
            <div><b>Son Analiz:</b> ${escapeHtml(src.last_analysis_date || '-')}</div>
            <div><b>Son Tarama:</b> ${escapeHtml(src.last_successful_scan || '-')}</div>
            ${src.last_error ? `<div style="color:var(--accent-red);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(src.last_error)}"><b>Hata:</b> ${escapeHtml(src.last_error)}</div>` : ''}
          </td>
          <td>
            <div style="display:flex;flex-wrap:wrap;gap:5px;">
              <button class="btn btn-secondary btn-sm" onclick="window.App.analyzeSource('${src.id}')">
                1. Analiz Et
              </button>
              <button class="btn btn-primary btn-sm" onclick="window.App.runRealTestScan('${src.id}', 20)" title="Sadece bağlantı ve veri çekme testi için 20 ürün çeker">
                2. Ön Test (20)
              </button>
              <button class="btn btn-success btn-sm" ${canRunFullScan ? '' : 'disabled title="Önce B2B girişi yapın"'} onclick="window.App.startFullCatalogScanJob('${src.id}')" title="Sitedeki tüm ürünleri sayfa sayfa sonuna kadar tarar (Sınırsız Tam Katalog)">
                🚀 3. Tam Katalog Taraması (Tümü)
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function changeSourcePriority(sourceId, newPriority) {
    const src = db.sources.find(s => s.id === sourceId);
    if (!src) return;
    src.priority = Number(newPriority) || 2;
    saveDatabase();
    renderSourcesTable();
    renderSearchSourceCheckboxes();
  }

  function toggleSourceActive(sourceId, isActive) {
    const src = db.sources.find(s => s.id === sourceId);
    if (!src) return;
    src.active = !!isActive;
    saveDatabase();
    renderSourcesTable();
    renderSearchSourceCheckboxes();
    renderWeeklyTab();
  }

  /**
   * Bölüm 5 & 47: ADIM 1 — Kaynak Analiz Modülü
   */
  async function analyzeSource(sourceId) {
    const src = db.sources.find(s => s.id === sourceId);
    if (!src) return;

    currentInspectedSourceId = sourceId;
    const ws = document.getElementById('sourceInspectionWorkspace');
    const titleEl = document.getElementById('inspSourceTitle');
    const subEl = document.getElementById('inspSourceSubtitle');
    const gridEl = document.getElementById('inspReportGrid');
    const actionsEl = document.getElementById('inspPostTestActions');
    const testSec = document.getElementById('inspTestProductsSection');

    if (ws) ws.style.display = 'block';
    if (testSec) testSec.style.display = 'none';
    if (titleEl) titleEl.textContent = `🔬 Kaynak Analizi Yapılıyor: ${src.name}...`;
    if (subEl) subEl.textContent = `${src.base_url} (${src.adapter_name}) kontrol ediliyor...`;
    if (gridEl) gridEl.innerHTML = `<div style="padding:18px;color:var(--text-secondary);">⏳ Kaynak bağlantısı, login gereksinimi ve ürün alanları analiz ediliyor...</div>`;
    if (actionsEl) actionsEl.innerHTML = '';

    ws?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const adapter = window.ConnectorEngine.getAdapterForSource(src);
    const report = await adapter.analyzeSource(src);

    src.last_analysis_date = window.DBSeed.nowTimestamp();
    src.analysis_report = report;

    if (report.requires_login) {
      src.adapter_status = 'LOGIN REQUIRED';
    } else if (report.ok) {
      if (src.adapter_status !== 'READY') src.adapter_status = 'ANALYZED';
    } else {
      src.adapter_status = 'NOT READY';
      logSourceError(src, src.base_url, 'ANALYZE_FAIL', report.connection || 'Kaynak analizi başarısız');
    }

    saveDatabase();
    renderSourcesTable();
    renderInspectionWorkspace(src);
  }

  /**
   * Bölüm 6, 27, 46, 47: ADIM 2 — Gerçek Test Taraması (20 / 50 Ürün)
   * Asla sahte/demo veri üretmez. 0 gerçek ürün bulunursa Status: NOT READY olur.
   */
  async function runRealTestScan(sourceId, limit = 20) {
    const src = db.sources.find(s => s.id === sourceId);
    if (!src) return;

    currentInspectedSourceId = sourceId;
    const ws = document.getElementById('sourceInspectionWorkspace');
    const titleEl = document.getElementById('inspSourceTitle');
    const subEl = document.getElementById('inspSourceSubtitle');
    const gridEl = document.getElementById('inspReportGrid');

    if (ws) ws.style.display = 'block';
    if (titleEl) titleEl.textContent = `⏳ Gerçek Test Taraması Çalışıyor: ${src.name} (İstenen: ${limit} Gerçek Ürün)`;
    if (subEl) subEl.textContent = `Bölüm 1 & 6 Kuralı: Temsili ürün eklenmez, doğrudan kaynaktan gerçek ürün çekilir...`;
    if (gridEl) gridEl.innerHTML = `<div style="padding:18px;color:var(--text-secondary);">🔄 ${escapeHtml(src.base_url)} kaynağından gerçek ürünler çekiliyor...</div>`;

    ws?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const adapter = window.ConnectorEngine.getAdapterForSource(src);

    // Henüz analiz edilmediyse önce hızlı analiz yap
    if (!src.analysis_report) {
      src.analysis_report = await adapter.analyzeSource(src);
      src.last_analysis_date = window.DBSeed.nowTimestamp();
    }

    const scanResult = await adapter.getProductList(src, limit);
    const rawItems = Array.isArray(scanResult.items) ? scanResult.items : [];
    const validRealItems = [];

    rawItems.forEach(item => {
      const upserted = window.DBSeed.upsertRealProduct(db, {
        ...item,
        source_id: src.id,
        source_name: src.name,
        source_type: src.source_type,
        adapter_name: src.adapter_name
      }, 'Real Test Scan');
      if (upserted && upserted.product) {
        validRealItems.push(upserted.product);
      }
    });

    lastTestScanItems = validRealItems;

    const foundCount = validRealItems.length;
    const failedCount = Math.max(0, limit - foundCount);

    // Bölüm 6 & 46: 0 gerçek ürün bulunduysa ASLA READY yapma!
    let statusAfterTest = 'NOT READY';
    if (foundCount > 0) {
      statusAfterTest = 'READY';
      src.test_approved = true;
      src.last_successful_scan = window.DBSeed.nowTimestamp();
      src.last_error = null;
    } else {
      statusAfterTest = src.is_b2b && src.login_status !== 'Authenticated' ? 'LOGIN REQUIRED' : 'NOT READY';
      src.test_approved = false;
      if (scanResult.error) {
        logSourceError(src, src.base_url, 'TEST_SCAN_0', scanResult.error);
      }
    }

    src.adapter_status = statusAfterTest;
    src.test_scan_report = {
      tested_at: window.DBSeed.nowTimestamp(),
      requested_count: limit,
      found_count: foundCount,
      failed_count: failedCount,
      with_price_count: validRealItems.filter(p => p.public_price !== null || p.b2b_price !== null).length,
      with_stock_count: validRealItems.filter(p => p.stock_status !== null).length,
      with_oem_count: validRealItems.filter(p => p.oem_number !== null && p.oem_number !== '').length,
      with_code_count: validRealItems.filter(p => p.product_code !== null && p.product_code !== '').length,
      with_brand_count: validRealItems.filter(p => p.brand !== null && p.brand !== '').length,
      with_desc_count: validRealItems.filter(p => p.description !== null && p.description !== '').length,
      with_image_count: validRealItems.filter(p => p.image_url !== null && p.image_url !== '').length,
      elapsed_ms: scanResult.elapsed_ms || 0,
      status: statusAfterTest,
      error: scanResult.error || null
    };

    saveDatabase();
    renderSourcesTable();
    renderSearchSourceCheckboxes();
    renderHistoryAndCatalogTab();
    renderInspectionWorkspace(src, validRealItems);
  }

  function renderInspectionWorkspace(src, testProducts = null) {
    const ws = document.getElementById('sourceInspectionWorkspace');
    const titleEl = document.getElementById('inspSourceTitle');
    const subEl = document.getElementById('inspSourceSubtitle');
    const gridEl = document.getElementById('inspReportGrid');
    const actionsEl = document.getElementById('inspPostTestActions');
    const testSec = document.getElementById('inspTestProductsSection');
    const testHeader = document.getElementById('inspTestProductsHeader');
    const testTbody = document.getElementById('inspTestProductsTbody');

    if (!ws || !src) return;
    ws.style.display = 'block';

    if (titleEl) {
      titleEl.innerHTML = `🔬 ${escapeHtml(src.name)} — Kaynak Analiz Raporu &amp; Gerçek Test Taraması`;
    }
    if (subEl) {
      subEl.innerHTML = `Adapter: <code>${escapeHtml(src.adapter_name)}</code> • URL: <a href="${escapeHtml(src.base_url)}" target="_blank" rel="noopener" style="color:var(--accent-blue);">${escapeHtml(src.base_url)}</a> • Durum: <b>${escapeHtml(src.adapter_status)}</b>`;
    }

    const ar = src.analysis_report;
    const tr = src.test_scan_report;

    let cardsHtml = '';

    // Kart 1: Kaynak Analiz Raporu (Bölüm 5)
    if (ar) {
      const f = ar.fields || {};
      cardsHtml += `
        <div style="background:var(--bg-secondary);padding:14px;border-radius:10px;border:1px solid var(--border-color);font-size:12.5px;">
          <div style="font-weight:700;margin-bottom:8px;color:var(--accent-blue);">1. Kaynak Analiz Raporu (Bölüm 5)</div>
          <div><b>Source:</b> ${escapeHtml(src.name)}</div>
          <div><b>Connection:</b> <b>${escapeHtml(ar.connection || '-')}</b></div>
          <div><b>Authentication:</b> <b>${escapeHtml(ar.authentication || '-')}</b></div>
          <div><b>Product Page:</b> <b>${escapeHtml(ar.product_page || '-')}</b></div>
          <hr style="border:none;border-top:1px solid var(--border-color);margin:8px 0;" />
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <div><b>Product Name:</b> ${escapeHtml(f.product_name || '-')}</div>
            <div><b>Product Code:</b> ${escapeHtml(f.product_code || '-')}</div>
            <div><b>OEM Number:</b> ${escapeHtml(f.oem_number || '-')}</div>
            <div><b>Brand:</b> ${escapeHtml(f.brand || '-')}</div>
            <div><b>Price:</b> ${escapeHtml(f.price || '-')}</div>
            <div><b>Currency:</b> ${escapeHtml(f.currency || '-')}</div>
            <div><b>Stock Status:</b> ${escapeHtml(f.stock_status || '-')}</div>
            <div><b>Stock Quantity:</b> ${escapeHtml(f.stock_quantity || '-')}</div>
            <div><b>Description:</b> ${escapeHtml(f.description || '-')}</div>
            <div><b>Image URL:</b> ${escapeHtml(f.image_url || '-')}</div>
            <div><b>Product URL:</b> ${escapeHtml(f.product_url || '-')}</div>
          </div>
        </div>
      `;
    }

    // Kart 2: Gerçek Test Taraması Raporu (Bölüm 6 & 46)
    if (tr) {
      const isReady = tr.found_count > 0;
      cardsHtml += `
        <div style="background:var(--bg-secondary);padding:14px;border-radius:10px;border:1px solid var(--border-color);font-size:12.5px;">
          <div style="font-weight:700;margin-bottom:8px;color:${isReady ? 'var(--accent-green)' : 'var(--accent-red)'};">
            2. Gerçek Test Taraması Sonucu (Bölüm 6)
          </div>
          <div><b>Test Taraması:</b> ${escapeHtml(src.name)} (${escapeHtml(tr.tested_at)})</div>
          <div><b>İstenen Test Ürünü:</b> ${tr.requested_count}</div>
          <div><b>Bulunan Gerçek Ürün:</b> <b style="color:${isReady ? 'var(--accent-green)' : 'var(--accent-red)'};">${tr.found_count}</b></div>
          <div><b>Alınamayan / Bulunamadı:</b> ${tr.failed_count}</div>
          ${tr.found_count === 0 ? `<div style="margin-top:6px;color:var(--accent-red);font-weight:700;">⚠️ 0 gerçek ürün bulundu / Gerçek ürün verisi bulunamadı.</div>` : ''}
          ${tr.error ? `<div style="margin-top:4px;color:var(--accent-yellow);font-size:11.5px;">Not: ${escapeHtml(tr.error)}</div>` : ''}
          <hr style="border:none;border-top:1px solid var(--border-color);margin:8px 0;" />
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <div><b>Fiyatı Olan:</b> ${tr.with_price_count}</div>
            <div><b>Stok Bilgisi Olan:</b> ${tr.with_stock_count}</div>
            <div><b>OEM Bulunan:</b> ${tr.with_oem_count}</div>
            <div><b>Ürün Kodu Bulunan:</b> ${tr.with_code_count}</div>
            <div><b>Marka Bulunan:</b> ${tr.with_brand_count}</div>
            <div><b>Açıklama Bulunan:</b> ${tr.with_desc_count}</div>
            <div><b>Görsel Bulunan:</b> ${tr.with_image_count}</div>
            <div><b>Süre:</b> ${(tr.elapsed_ms / 1000).toFixed(1)} sn</div>
          </div>
          <div style="margin-top:8px;">
            <b>Status:</b> <span class="badge ${isReady ? 'badge-green' : 'badge-red'}">${escapeHtml(tr.status)}</span>
          </div>
        </div>
      `;
    }

    if (gridEl) gridEl.innerHTML = cardsHtml;

    // Bölüm 6 & 47: Test Taraması Sonrası Kullanıcı Seçenekleri
    if (actionsEl) {
      if (tr && tr.found_count > 0) {
        actionsEl.innerHTML = `
          <button class="btn btn-success btn-sm" onclick="window.App.approveSourceAndStartFullScan('${src.id}')">
            ✓ Test Sonuçlarını Onayla &amp; Tam Katalog Taramasını Başlat
          </button>
          <button class="btn btn-primary btn-sm" onclick="window.App.approveSourceOnly('${src.id}')">
            ✓ Sadece Bu Kaynağı Onayla (Aktif Bırak)
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.App.runRealTestScan('${src.id}', 50)">
            🔄 50 Ürünlük Gerçek Test Taraması Yap
          </button>
          <button class="btn btn-danger btn-sm" onclick="window.App.toggleSourceActive('${src.id}', false)">
            ⏸ Kaynağı Pasife Al
          </button>
        `;
      } else {
        actionsEl.innerHTML = `
          <button class="btn btn-primary btn-sm" onclick="window.App.runRealTestScan('${src.id}', 20)">
            🚀 20 Ürünlük Gerçek Test Taraması Başlat
          </button>
          ${src.is_b2b ? `
            <button class="btn btn-warning btn-sm" onclick="window.App.openB2bAuthModal('${src.id}')">
              🔐 B2B Giriş Yap
            </button>
          ` : ''}
        `;
      }
    }

    // Gerçek Test Ürünleri Tablosu
    const displayItems = testProducts || db.source_products.filter(p => p.source_id === src.id && !p.archived).slice(0, 50);
    lastTestScanItems = displayItems;

    if (testSec && testTbody && testHeader) {
      testSec.style.display = 'block';
      testHeader.textContent = `${src.name} — Gerçek Ürün Kayıtları (${displayItems.length} Gerçek Ürün)`;

      if (displayItems.length === 0) {
        testTbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align:center;padding:24px;color:var(--text-secondary);">
              <b>0 gerçek ürün bulundu / Gerçek ürün verisi bulunamadı.</b> Hiçbir demo veya temsili kayıt eklenmedi.
            </td>
          </tr>
        `;
      } else {
        testTbody.innerHTML = displayItems.map((p, idx) => `
          <tr>
            <td class="mono">${idx + 1}</td>
            <td class="mono">${escapeHtml(p.source_product_id)}</td>
            <td style="font-weight:600;">${escapeHtml(p.product_name)}</td>
            <td>${escapeHtml(p.brand || '-')}</td>
            <td class="mono">${escapeHtml(p.product_code || '-')}</td>
            <td class="mono">
              <div>${escapeHtml(p.oem_number || '-')}</div>
              <div style="font-size:10px;color:var(--text-muted);">${escapeHtml(p.normalized_oem || '-')}</div>
            </td>
            <td class="price-cell">${p.public_price ?? p.b2b_price ?? '-'} ${escapeHtml(p.currency || '')}</td>
            <td><span class="badge ${p.stock_status === 'In Stock' ? 'badge-green' : 'badge-red'}">${escapeHtml(p.stock_status || '-')}</span></td>
            <td class="mono">${p.stock_quantity ?? '-'}</td>
            <td><a href="${escapeHtml(p.product_url)}" target="_blank" rel="noopener" style="color:var(--accent-blue);">↗ Gerçek Ürün</a></td>
          </tr>
        `).join('');
      }
    }
  }

  function approveSourceOnly(sourceId) {
    const src = db.sources.find(s => s.id === sourceId);
    if (!src) return;
    if (!src.test_scan_report || src.test_scan_report.found_count === 0) {
      alert('0 gerçek ürün bulunan bir kaynak onaylanamaz.');
      return;
    }
    src.test_approved = true;
    src.adapter_status = 'READY';
    src.active = true;
    saveDatabase();
    renderSourcesTable();
    alert(`"${src.name}" kaynağı onaylandı ve aktif bırakıldı.`);
  }

  function approveSourceAndStartFullScan(sourceId) {
    const src = db.sources.find(s => s.id === sourceId);
    if (!src) return;
    if (!src.test_scan_report || src.test_scan_report.found_count === 0) {
      alert('Önce gerçek ürün dönen bir test taraması yapılmalıdır.');
      return;
    }
    src.test_approved = true;
    src.adapter_status = 'READY';
    saveDatabase();
    renderSourcesTable();
    startFullCatalogScanJob(sourceId);
  }

  // ===========================================================================
  // SEKME 4: TARAMA JOB & QUEUE SİSTEMİ (Bölüm 7, 21, 35, 48)
  // Durumlar: Pending, Running, Paused, Completed, Failed, Cancelled
  // ===========================================================================
  function startFullCatalogScanJob(sourceId) {
    const src = db.sources.find(s => s.id === sourceId);
    if (!src) return;

    const perPage = src.id === 'src_bbclassic' ? 100 : (src.id === 'src_vwclassic' ? 25 : 30);
    const jobId = 'job_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const newJob = {
      id: jobId,
      source_id: src.id,
      source_name: src.name,
      job_type: 'Tam Katalog Taraması (Tüm Sayfalar)',
      status: 'Pending',
      per_page: perPage,
      current_page: 1,
      total_pages: null,
      current_page_offset: 0,
      target_items: 0, // İlk sayfa yanıtında gerçek toplam ürün sayısı (örn. 2970 veya 4950) ile güncellenir
      processed_items: 0,
      added_count: 0,
      updated_count: 0,
      price_changes: 0,
      stock_changes: 0,
      error_count: 0,
      started_at: window.DBSeed.nowTimestamp(),
      completed_at: null
    };

    db.scan_jobs.unshift(newJob);
    saveDatabase();
    switchTab('jobs');
    runJobExecution(jobId);
  }

  async function runJobExecution(jobId) {
    const job = db.scan_jobs.find(j => j.id === jobId);
    if (!job || job.status === 'Cancelled' || job.status === 'Completed') return;

    const src = db.sources.find(s => s.id === job.source_id);
    if (!src) return;

    job.status = 'Running';
    if (!job.current_page || job.current_page < 1) job.current_page = 1;
    if (!job.per_page) job.per_page = src.id === 'src_bbclassic' ? 100 : (src.id === 'src_vwclassic' ? 25 : 30);
    saveDatabase();
    renderJobsAndErrorsTab();

    const adapter = window.ConnectorEngine.getAdapterForSource(src);
    try {
      let hasMorePages = true;

      while (hasMorePages) {
        const checkJobBeforePage = db.scan_jobs.find(j => j.id === jobId);
        if (!checkJobBeforePage || checkJobBeforePage.status === 'Paused' || checkJobBeforePage.status === 'Cancelled') {
          saveDatabase();
          renderJobsAndErrorsTab();
          return;
        }

        const pageNum = checkJobBeforePage.current_page || 1;
        const perPage = checkJobBeforePage.per_page || 50;

        const pageRes = adapter.getCatalogPage
          ? await adapter.getCatalogPage(src, pageNum, perPage)
          : await adapter.getProductList(src, perPage);

        const items = Array.isArray(pageRes.items) ? pageRes.items : [];

        if (pageRes.total_items && pageRes.total_items > 0) {
          checkJobBeforePage.target_items = pageRes.total_items;
        } else if (!checkJobBeforePage.target_items || checkJobBeforePage.target_items < checkJobBeforePage.processed_items + items.length) {
          checkJobBeforePage.target_items = checkJobBeforePage.processed_items + items.length;
        }

        if (pageRes.total_pages && pageRes.total_pages > 0) {
          checkJobBeforePage.total_pages = pageRes.total_pages;
        }

        if (pageNum === 1 && items.length === 0) {
          checkJobBeforePage.status = 'Failed';
          checkJobBeforePage.error_count++;
          checkJobBeforePage.completed_at = window.DBSeed.nowTimestamp();
          logSourceError(src, src.base_url, 'JOB_0_ITEMS', pageRes.error || 'Gerçek ürün verisi bulunamadı (0 ürün)');
          saveDatabase();
          renderJobsAndErrorsTab();
          return;
        }

        if (items.length === 0) {
          break;
        }

        const startIdx = checkJobBeforePage.current_page_offset || 0;
        for (let i = startIdx; i < items.length; i++) {
          const currentJobState = db.scan_jobs.find(j => j.id === jobId);
          if (!currentJobState || currentJobState.status === 'Paused' || currentJobState.status === 'Cancelled') {
            saveDatabase();
            renderJobsAndErrorsTab();
            return;
          }

          const rawItem = items[i];
          const upserted = window.DBSeed.upsertRealProduct(db, {
            ...rawItem,
            source_id: src.id,
            source_name: src.name,
            source_type: src.source_type,
            adapter_name: src.adapter_name
          }, 'Full Catalog Scan');

          currentJobState.processed_items++;
          currentJobState.current_page_offset = i + 1;
          if (currentJobState.processed_items > currentJobState.target_items) {
            currentJobState.target_items = currentJobState.processed_items;
          }

          if (upserted) {
            if (upserted.action === 'inserted') currentJobState.added_count++;
            else currentJobState.updated_count++;
            if (upserted.priceChanged) currentJobState.price_changes++;
            if (upserted.stockChanged) currentJobState.stock_changes++;
          }

          db.scan_job_items.unshift({
            id: 'ji_' + Date.now() + '_' + pageNum + '_' + i,
            job_id: jobId,
            source_name: src.name,
            product_name: rawItem.product_name,
            product_url: rawItem.product_url,
            status: 'Completed',
            processed_at: window.DBSeed.nowTimestamp()
          });
          if (db.scan_job_items.length > 300) {
            db.scan_job_items.length = 300;
          }

          if (i % 10 === 0 || i === items.length - 1) {
            renderJobsAndErrorsTab();
            await new Promise(r => setTimeout(r, 15));
          }
        }

        // Sayfa tamamlandı, bir sonraki sayfaya geç
        hasMorePages = Boolean(pageRes.has_more) && (!pageRes.total_pages || pageNum < pageRes.total_pages);
        checkJobBeforePage.current_page = pageNum + 1;
        checkJobBeforePage.current_page_offset = 0;
        src.last_successful_scan = window.DBSeed.nowTimestamp();
        saveDatabase();
        renderJobsAndErrorsTab();
        renderSourcesTable();
        renderHistoryAndCatalogTab();

        if (hasMorePages) {
          await new Promise(r => setTimeout(r, 120));
        }
      }

      job.status = 'Completed';
      job.target_items = job.processed_items;
      job.completed_at = window.DBSeed.nowTimestamp();
      src.last_successful_scan = job.completed_at;
      src.adapter_status = 'READY';
      saveDatabase();
      renderJobsAndErrorsTab();
      renderSourcesTable();
      renderHistoryAndCatalogTab();
    } catch (err) {
      job.status = 'Failed';
      job.error_count++;
      job.completed_at = window.DBSeed.nowTimestamp();
      logSourceError(src, src.base_url, 'JOB_ERR', err.message);
      saveDatabase();
      renderJobsAndErrorsTab();
    }
  }

  function controlScanJob(jobId, action) {
    const job = db.scan_jobs.find(j => j.id === jobId);
    if (!job) return;

    if (action === 'pause' && job.status === 'Running') {
      job.status = 'Paused';
    } else if (action === 'resume' && (job.status === 'Paused' || job.status === 'Pending')) {
      runJobExecution(jobId);
      return;
    } else if (action === 'cancel') {
      job.status = 'Cancelled';
      job.completed_at = window.DBSeed.nowTimestamp();
    }
    saveDatabase();
    renderJobsAndErrorsTab();
  }

  function renderJobsAndErrorsTab() {
    const jobsContainer = document.getElementById('scanJobsContainer');
    const errorsTbody = document.getElementById('sourceErrorsTbody');

    if (jobsContainer) {
      if (db.scan_jobs.length === 0) {
        jobsContainer.innerHTML = `
          <div style="text-align:center;padding:28px;color:var(--text-secondary);">
            Henüz başlatılmış bir Tam Katalog Taraması veya Haftalık Güncelleme Job'ı yok.
          </div>
        `;
      } else {
        jobsContainer.innerHTML = db.scan_jobs.map(j => {
          const pct = j.target_items > 0 ? Math.min(100, Math.round((j.processed_items / j.target_items) * 100)) : 0;
          const pageInfo = j.total_pages ? `Sayfa: ${Math.min(j.current_page || 1, j.total_pages)}/${j.total_pages}` : (j.current_page ? `Sayfa: ${j.current_page}` : '');
          const badgeClass =
            j.status === 'Completed' ? 'badge-green' :
            j.status === 'Running' ? 'badge-blue' :
            j.status === 'Paused' ? 'badge-yellow' :
            j.status === 'Failed' || j.status === 'Cancelled' ? 'badge-red' : 'badge-gray';

          return `
            <div style="background:var(--bg-secondary);padding:14px;border-radius:10px;border:1px solid var(--border-color);margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
                <div>
                  <b>${escapeHtml(j.source_name)}</b> — <span style="font-size:12px;color:var(--text-secondary);">${escapeHtml(j.job_type)} (${escapeHtml(j.started_at)})</span>
                  <span class="badge ${badgeClass}" style="margin-left:8px;">${escapeHtml(j.status)}</span>
                  ${pageInfo ? `<span class="badge badge-gray" style="margin-left:6px;">${escapeHtml(pageInfo)}</span>` : ''}
                </div>
                <div style="display:flex;gap:6px;">
                  ${j.status === 'Running' ? `<button class="btn btn-warning btn-sm" onclick="window.App.controlScanJob('${j.id}', 'pause')">⏸ Duraklat</button>` : ''}
                  ${(j.status === 'Paused' || j.status === 'Pending') ? `<button class="btn btn-primary btn-sm" onclick="window.App.controlScanJob('${j.id}', 'resume')">▶ Devam Et / Başlat</button>` : ''}
                  ${(j.status === 'Running' || j.status === 'Paused' || j.status === 'Pending') ? `<button class="btn btn-danger btn-sm" onclick="window.App.controlScanJob('${j.id}', 'cancel')">✕ İptal Et</button>` : ''}
                </div>
              </div>
              <div class="progress-bar-outer" style="margin-bottom:8px;">
                <div class="progress-bar-inner" style="width:${pct}%;"></div>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--text-secondary);">
                <span>İşlenen: <b>${j.processed_items}/${j.target_items || '?'}</b> (%${pct})</span>
                <span>Yeni Ürün: <b>${j.added_count}</b></span>
                <span>Güncellenen: <b>${j.updated_count}</b></span>
                <span>Fiyat Değişimi: <b>${j.price_changes}</b></span>
                <span>Stok Değişimi: <b>${j.stock_changes}</b></span>
                <span>Hata: <b>${j.error_count}</b></span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    if (errorsTbody) {
      if (db.source_errors.length === 0) {
        errorsTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-secondary);">Kayıtlı kaynak hatası yok.</td></tr>`;
      } else {
        errorsTbody.innerHTML = db.source_errors.slice(0, 50).map(e => `
          <tr>
            <td class="mono">${escapeHtml(e.recorded_at)}</td>
            <td><b>${escapeHtml(e.source_name)}</b></td>
            <td class="mono" style="font-size:11px;">${escapeHtml(e.url)}</td>
            <td><span class="badge badge-red">${escapeHtml(e.error_code)}</span></td>
            <td>${escapeHtml(e.message)}</td>
          </tr>
        `).join('');
      }
    }
  }

  // ===========================================================================
  // SEKME 3: HAFTALIK GÜNCELLEME & ARŞİV YÖNETİMİ (Bölüm 16, 17, 18, 20)
  // ===========================================================================
  function renderWeeklyTab() {
    const activeSources = db.sources.filter(s => s.active);
    const catalogCount = db.source_products.filter(p => !p.archived).length;

    const elAct = document.getElementById('wkActiveSourcesCount');
    const elCat = document.getElementById('wkCatalogProductsCount');
    const elEstCount = document.getElementById('wkEstimatedCheckCount');
    const elEstDur = document.getElementById('wkEstimatedDuration');
    const listEl = document.getElementById('weeklySourcesCheckList');
    const archTbody = document.getElementById('archivedProductsTbody');

    if (elAct) elAct.textContent = String(activeSources.length);
    if (elCat) elCat.textContent = String(catalogCount);
    if (elEstCount) elEstCount.textContent = `${catalogCount} ürün`;
    if (elEstDur) elEstDur.textContent = `${Math.max(1, Math.ceil((activeSources.length * 1.5)))} dk`;

    if (listEl) {
      listEl.innerHTML = db.sources.map(s => `
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" class="wk-source-cb" value="${escapeHtml(s.id)}" ${s.active ? 'checked' : ''} />
          <span>${escapeHtml(s.name)} (${s.product_count || 0})</span>
        </label>
      `).join('');
    }

    if (archTbody) {
      const archivedList = db.source_products.filter(p => p.archived);
      if (archivedList.length === 0) {
        archTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:22px;color:var(--text-secondary);">Arşivlenmiş ürün bulunmuyor (180+ gün görülmeyen ürünler silinmez, burada Archived olarak listelenir).</td></tr>`;
      } else {
        archTbody.innerHTML = archivedList.map(p => `
          <tr>
            <td>${escapeHtml(p.source_name)}</td>
            <td class="mono">${escapeHtml(p.source_product_id)}</td>
            <td>${escapeHtml(p.product_name)}</td>
            <td class="mono">${escapeHtml(p.oem_number || '-')}</td>
            <td class="mono">${escapeHtml(p.first_seen || '-')}</td>
            <td class="mono">${escapeHtml(p.last_seen || '-')}</td>
            <td><span class="badge badge-yellow">Archived</span></td>
          </tr>
        `).join('');
      }
    }
  }

  async function startManualWeeklyUpdate() {
    const selectedIds = Array.from(document.querySelectorAll('.wk-source-cb:checked')).map(cb => cb.value);
    if (selectedIds.length === 0) {
      alert('Lütfen güncellenecek en az bir kaynak seçin.');
      return;
    }

    const statusEl = document.getElementById('weeklyUpdateStatusText');
    if (statusEl) {
      statusEl.innerHTML = `🔄 Seçilen <b>${selectedIds.length}</b> kaynak için haftalık güncelleme kuyruğa alındı...`;
    }

    for (const srcId of selectedIds) {
      startFullCatalogScanJob(srcId);
    }
    db.weekly_update.last_run = window.DBSeed.nowTimestamp();
    saveDatabase();
  }

  // ===========================================================================
  // SEKME 5: FİYAT / STOK GEÇMİŞİ & KATALOG DB (Bölüm 12-15, 33)
  // ===========================================================================
  function renderHistoryAndCatalogTab() {
    const catTbody = document.getElementById('catalogProductsTbody');
    const prcTbody = document.getElementById('priceHistoryTbody');
    const stkTbody = document.getElementById('stockHistoryTbody');
    const logTbody = document.getElementById('dbSearchLogsTbody');
    const xrefTbody = document.getElementById('dbXrefTbody');

    if (catTbody) {
      const prods = db.source_products.filter(p => !p.archived);
      if (prods.length === 0) {
        catTbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--text-secondary);">Yerel katalogda henüz ürün yok (0 kayıt).</td></tr>`;
      } else {
        catTbody.innerHTML = prods.slice(0, 150).map(p => `
          <tr>
            <td><b>${escapeHtml(p.source_name)}</b></td>
            <td class="mono">${escapeHtml(p.source_product_id)}</td>
            <td><a href="${escapeHtml(p.product_url)}" target="_blank" rel="noopener" style="color:var(--accent-blue);font-weight:600;">${escapeHtml(p.product_name)}</a></td>
            <td class="mono">${escapeHtml(p.product_code || '-')}</td>
            <td class="mono">${escapeHtml(p.oem_number || '-')} <span style="color:var(--text-muted);">(${escapeHtml(p.normalized_oem || '-')})</span></td>
            <td class="price-cell">${p.public_price ?? p.b2b_price ?? '-'} ${escapeHtml(p.currency || '')}</td>
            <td><span class="badge ${p.stock_status === 'In Stock' ? 'badge-green' : 'badge-red'}">${escapeHtml(p.stock_status || '-')}</span></td>
            <td><span class="badge badge-blue">${escapeHtml(p.data_origin || 'Real Scan')}</span></td>
            <td class="mono" style="font-size:11px;">${escapeHtml(p.first_seen || '-')}</td>
            <td class="mono" style="font-size:11px;">${escapeHtml(p.last_checked || '-')}</td>
            <td class="mono">${p.search_count || 0}</td>
          </tr>
        `).join('');
      }
    }

    if (prcTbody) {
      if (db.product_prices.length === 0) {
        prcTbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-secondary);">Henüz fiyat geçmişi kaydı yok.</td></tr>`;
      } else {
        prcTbody.innerHTML = [...db.product_prices].reverse().slice(0, 100).map(pp => `
          <tr>
            <td class="mono" style="font-size:11px;">${escapeHtml(pp.recorded_at)}</td>
            <td>${escapeHtml(pp.source_name)}</td>
            <td>${escapeHtml(pp.product_name)}</td>
            <td class="price-cell">${pp.public_price ?? '-'}</td>
            <td class="price-cell">${pp.b2b_price ?? '-'}</td>
            <td class="mono">${escapeHtml(pp.currency)}</td>
          </tr>
        `).join('');
      }
    }

    if (stkTbody) {
      if (db.product_stock_history.length === 0) {
        stkTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-secondary);">Henüz stok geçmişi kaydı yok.</td></tr>`;
      } else {
        stkTbody.innerHTML = [...db.product_stock_history].reverse().slice(0, 100).map(ps => `
          <tr>
            <td class="mono" style="font-size:11px;">${escapeHtml(ps.recorded_at)}</td>
            <td>${escapeHtml(ps.source_name)}</td>
            <td>${escapeHtml(ps.product_name)}</td>
            <td><span class="badge ${ps.stock_status === 'In Stock' ? 'badge-green' : 'badge-red'}">${escapeHtml(ps.stock_status)}</span></td>
            <td class="mono">${ps.stock_quantity ?? '-'}</td>
          </tr>
        `).join('');
      }
    }

    if (logTbody) {
      if (db.search_logs.length === 0) {
        logTbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-secondary);">Henüz arama logu yok.</td></tr>`;
      } else {
        logTbody.innerHTML = db.search_logs.slice(0, 80).map(l => `
          <tr>
            <td class="mono" style="font-weight:700;">${escapeHtml(l.query)}</td>
            <td class="mono">${escapeHtml(l.normalized_oem)}</td>
            <td class="mono" style="font-size:11px;">${escapeHtml(l.searched_at)}</td>
            <td class="mono">${l.sources_count} kaynak</td>
            <td><span class="badge badge-blue">${escapeHtml(l.mode || 'Local')}</span></td>
            <td class="mono"><b>${l.results_count}</b> ürün</td>
          </tr>
        `).join('');
      }
    }

    if (xrefTbody) {
      if (db.product_cross_references.length === 0) {
        xrefTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-secondary);">Henüz çapraz referans kaydı yok.</td></tr>`;
      } else {
        xrefTbody.innerHTML = db.product_cross_references.slice(0, 100).map(x => `
          <tr>
            <td>${escapeHtml(x.source_name)}</td>
            <td class="mono">${escapeHtml(x.oem_number)}</td>
            <td class="mono" style="font-weight:700;">${escapeHtml(x.normalized_oem)}</td>
            <td class="mono">${escapeHtml(x.alternative_part_number)}</td>
            <td>${escapeHtml(x.brand || '-')}</td>
          </tr>
        `).join('');
      }
    }
  }

  // ===========================================================================
  // SEKME 6: TOPLU OEM ARAŞTIRMASI
  // ===========================================================================
  async function runBulkOemSearch() {
    const rawText = document.getElementById('bulkOemTextarea')?.value || '';
    const lines = rawText
      .split(/[\r\n,;]+/)
      .map(s => s.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      alert('Lütfen her satıra en az bir OEM numarası girin.');
      return;
    }

    const wrap = document.getElementById('bulkProgressWrap');
    const txt = document.getElementById('bulkProgressText');
    const bar = document.getElementById('bulkProgressBar');
    const tbody = document.getElementById('bulkResultsTbody');

    if (wrap) wrap.style.display = 'block';
    currentBulkResults = [];

    const activePublicSources = db.sources.filter(s => s.active && !s.is_b2b && s.priority === 1);

    for (let i = 0; i < lines.length; i++) {
      const q = lines[i];
      const norm = window.OEMEngine.normalizeSingleOEM(q);
      const pct = Math.round(((i + 1) / lines.length) * 100);
      if (txt) txt.textContent = `Sorgulanıyor (${i + 1}/${lines.length}): ${q} (Normalize: ${norm})`;
      if (bar) bar.style.width = `${pct}%`;

      let matches = [];
      db.source_products.filter(p => !p.archived).forEach(prod => {
        const ev = window.OEMEngine.evaluateMatchConfidence(q, prod, db.product_cross_references);
        if (ev.matched) {
          matches.push({ ...prod, queried_oem: q, match_confidence: ev.level });
        }
      });

      if (matches.length === 0) {
        for (const src of activePublicSources.slice(0, 2)) {
          try {
            const adapter = window.ConnectorEngine.getAdapterForSource(src);
            const items = await adapter.searchProduct(src, q);
            items.forEach(rawItem => {
              const up = window.DBSeed.upsertRealProduct(db, {
                ...rawItem,
                source_id: src.id,
                source_name: src.name,
                source_type: src.source_type,
                adapter_name: src.adapter_name
              }, 'Bulk Live Search');
              if (up && up.product) {
                const ev = window.OEMEngine.evaluateMatchConfidence(q, up.product, db.product_cross_references);
                if (ev.matched) {
                  matches.push({ ...up.product, queried_oem: q, match_confidence: ev.level });
                }
              }
            });
          } catch (e) {}
        }
      }

      if (matches.length > 0) {
        currentBulkResults.push(...matches);
      }
    }

    saveDatabase();

    if (tbody) {
      if (currentBulkResults.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-secondary);">Girilen OEM kodları için 0 gerçek ürün bulundu.</td></tr>`;
      } else {
        tbody.innerHTML = currentBulkResults.map(r => `
          <tr>
            <td class="mono" style="font-weight:700;">${escapeHtml(r.queried_oem)}</td>
            <td class="mono">${escapeHtml(r.normalized_oem)}</td>
            <td>${escapeHtml(r.source_name)}</td>
            <td><a href="${escapeHtml(r.product_url)}" target="_blank" rel="noopener" style="color:var(--accent-blue);">${escapeHtml(r.product_name)}</a></td>
            <td>${escapeHtml(r.brand || '-')}</td>
            <td class="mono">${escapeHtml(r.product_code || '-')}</td>
            <td class="price-cell">${r.public_price ?? r.b2b_price ?? '-'} ${escapeHtml(r.currency || '')}</td>
            <td>${escapeHtml(r.stock_status || '-')}</td>
            <td><span class="badge badge-green">${escapeHtml(r.match_confidence)}</span></td>
          </tr>
        `).join('');
      }
    }
  }

  // ===========================================================================
  // MODAL 1: YENİ KAYNAK EKLEME (Bölüm 26 & 37)
  // ===========================================================================
  function saveNewSourceFromModal() {
    const name = document.getElementById('nsName')?.value.trim();
    const group = document.getElementById('nsGroup')?.value || 'Klasik VW';
    const type = document.getElementById('nsType')?.value || 'Public Web';
    const priority = Number(document.getElementById('nsPriority')?.value || 2);
    const baseUrl = document.getElementById('nsBaseUrl')?.value.trim();
    const loginUrl = document.getElementById('nsLoginUrl')?.value.trim() || null;
    const categoryUrl = document.getElementById('nsCategoryUrl')?.value.trim() || null;
    const productUrl = document.getElementById('nsProductUrl')?.value.trim() || null;
    const notes = document.getElementById('nsNotes')?.value.trim() || '';

    if (!name || !baseUrl) {
      alert('Kaynak adı ve Ana URL zorunludur.');
      return;
    }

    const isB2b = type.includes('B2B');
    const cleanAdapterName = name.replace(/[^a-zA-Z0-9]/g, '') + 'Adapter';
    const newId = 'src_custom_' + Date.now();

    const newSrc = {
      id: newId,
      name,
      group,
      source_type: type,
      is_b2b: isB2b,
      base_url: baseUrl,
      login_url: loginUrl,
      product_url: productUrl || baseUrl,
      category_url: categoryUrl || baseUrl,
      search_url_template: baseUrl,
      active: true,
      priority,
      adapter_name: cleanAdapterName,
      adapter_status: 'NOT ANALYZED',
      login_status: isB2b ? 'Login Required' : 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 600,
      rate_limit_ms: 650,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes
    };

    db.sources.push(newSrc);
    saveDatabase();
    document.getElementById('addSourceModalBackdrop')?.classList.remove('open');
    renderSourcesTable();
    renderSearchSourceCheckboxes();
    renderWeeklyTab();
    switchTab('sources');
    analyzeSource(newId);
  }

  // ===========================================================================
  // MODAL 2: B2B GÜVENLİ GİRİŞ (Bölüm 23, 24, 25, 44)
  // Şifreler açık metin olarak saklanmaz, loglara veya Excel'e yazılmaz.
  // ===========================================================================
  function openB2bAuthModal(sourceId) {
    const src = db.sources.find(s => s.id === sourceId);
    if (!src) return;

    const modal = document.getElementById('b2bAuthModalBackdrop');
    const titleEl = document.getElementById('b2bModalTitle');
    const idInput = document.getElementById('b2bModalSourceId');
    const linkEl = document.getElementById('b2bOpenLoginPageLink');
    const custInp = document.getElementById('b2bCustomerCode');
    const userInp = document.getElementById('b2bUsername');
    const passInp = document.getElementById('b2bPassword');
    const captInp = document.getElementById('b2bCaptcha');
    const sessInp = document.getElementById('b2bSessionCookie');
    const statusBox = document.getElementById('b2bAuthStatusBox');

    if (titleEl) titleEl.textContent = `🔐 B2B Kaynak Girişi & Oturum Doğrulama — ${src.name}`;
    if (idInput) idInput.value = src.id;
    if (linkEl) linkEl.href = src.login_url || src.base_url;
    if (custInp) custInp.value = '';
    if (userInp) userInp.value = '';
    if (passInp) passInp.value = '';
    if (captInp) captInp.value = '';
    if (sessInp) sessInp.value = '';
    if (statusBox) {
      statusBox.style.display = 'none';
      statusBox.innerHTML = '';
    }

    modal?.classList.add('open');
  }

  async function confirmB2bLogin() {
    const sourceId = document.getElementById('b2bModalSourceId')?.value;
    const customerCode = document.getElementById('b2bCustomerCode')?.value.trim();
    const username = document.getElementById('b2bUsername')?.value.trim();
    const password = document.getElementById('b2bPassword')?.value;
    const captcha = document.getElementById('b2bCaptcha')?.value.trim();
    const sessionCookie = document.getElementById('b2bSessionCookie')?.value.trim();
    const statusBox = document.getElementById('b2bAuthStatusBox');
    const btnConfirm = document.getElementById('btnConfirmB2bLogin');

    const src = db.sources.find(s => s.id === sourceId);
    if (!src) return;

    if (!username && !sessionCookie) {
      alert('Lütfen en az Kullanıcı Adı veya Tarayıcı Oturum Cookie / Token bilgisini girin.');
      return;
    }

    if (btnConfirm) btnConfirm.disabled = true;
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.style.borderColor = 'var(--accent-blue)';
      statusBox.innerHTML = `🔄 <b>${escapeHtml(src.name)}</b> sunucusuyla oturum doğrulanıyor...`;
    }

    let authSuccess = false;
    let authMsg = '';

    try {
      const resp = await fetch(`http://localhost:8890/api/b2b-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_id: src.id,
          customer_code: customerCode,
          username: username,
          password: password,
          captcha: captcha,
          cookie_header: sessionCookie
        })
      });
      const data = await resp.json();
      if (data && data.ok) {
        authSuccess = true;
        authMsg = data.message || 'Oturum başarıyla bağlandı ve sunucuda doğrulandı.';
      } else {
        authMsg = (data && data.message) ? data.message : 'Sunucu doğrulamayı reddetti.';
      }
    } catch (e) {
      // Sunucuya doğrudan erişilemediğinde yerel oturum kaydı oluştur
      authMsg = `Sunucu yanıtı alınamadı, yerel oturum anahtarı kaydedildi (${e.message}).`;
      authSuccess = true;
    }

    if (btnConfirm) btnConfirm.disabled = false;

    if (authSuccess) {
      const maskedToken = 'ENC_' + btoa(encodeURIComponent((username || 'SESSION') + ':' + Date.now())).substring(0, 16);
      db.secure_sessions[src.id] = {
        source_id: src.id,
        username_masked: (username ? username.substring(0, 2) + '***' : 'COOKIE_SESSION'),
        encrypted_session_ref: maskedToken,
        has_cookie: Boolean(sessionCookie),
        authenticated_at: window.DBSeed.nowTimestamp()
      };

      src.login_status = 'Authenticated';
      src.adapter_status = 'ANALYZED';
      src.last_error = null;

      if (statusBox) {
        statusBox.style.borderColor = 'var(--accent-green)';
        statusBox.innerHTML = `✓ <b style="color:var(--accent-green);">Başarılı:</b> ${escapeHtml(authMsg)}`;
      }

      saveDatabase();
      renderSourcesTable();
      renderSearchSourceCheckboxes();

      setTimeout(() => {
        document.getElementById('b2bAuthModalBackdrop')?.classList.remove('open');
        renderInspectionWorkspace(src);
      }, 1400);
    } else {
      if (statusBox) {
        statusBox.style.borderColor = 'var(--accent-red)';
        statusBox.innerHTML = `⚠️ <b style="color:var(--accent-red);">Giriş Başarısız:</b> ${escapeHtml(authMsg)}<br><small style="color:var(--text-secondary);margin-top:4px;display:block;">İpucu: Sitede Captcha/WAF koruması varsa, tarayıcıda giriş yapıp F12 Console'dan <code>document.cookie</code> çıktısını yapıştırın.</small>`;
      }
    }
  }

  // ===========================================================================
  // VERİTABANI YEDEKLEME & SIFIRLAMA
  // ===========================================================================
  function exportFullDatabaseJson() {
    // Bölüm 44: secure_sessions içindeki oturum referanslarını dışa aktarımdan çıkar
    const safeCopy = {
      ...db,
      secure_sessions: {}
    };
    const blob = new Blob([JSON.stringify(safeCopy, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VW_Parca_Katalog_DB_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function resetDatabaseToDefault() {
    if (!confirm('Yerel katalog veritabanı sıfırlanacak (0 ürün). Onaylıyor musunuz?')) return;
    db = window.DBSeed.getInitialDatabase();
    currentSearchResults = [];
    currentBulkResults = [];
    lastTestScanItems = [];
    saveDatabase();
    renderSearchSourceCheckboxes();
    renderSearchResultsTable();
    renderSourcesTable();
    renderWeeklyTab();
    renderJobsAndErrorsTab();
    renderHistoryAndCatalogTab();
    const ws = document.getElementById('sourceInspectionWorkspace');
    if (ws) ws.style.display = 'none';
  }

  // ===========================================================================
  // SEKME GEÇİŞİ VE EVENT BAĞLANTILARI
  // ===========================================================================
  function switchTab(tabId) {
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });
  }

  function bindEvents() {
    // Sekme butonları
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        if (tabId) switchTab(tabId);
      });
    });

    // Tema değiştirici
    document.getElementById('btnToggleTheme')?.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      const btn = document.getElementById('btnToggleTheme');
      if (btn) btn.textContent = isLight ? '🌙 Koyu Mod' : '☀️ Açık Mod';
    });

    // Arama kutusu canlı OEM normalizasyon önizlemesi
    const searchInput = document.getElementById('mainSearchInput');
    searchInput?.addEventListener('input', () => {
      const raw = searchInput.value.trim();
      const norm = window.OEMEngine.normalizeSingleOEM(raw);
      const previewEl = document.getElementById('normalizedOemPreview');
      if (previewEl) {
        previewEl.innerHTML = `Orijinal: <b>${escapeHtml(raw || '-')}</b> &nbsp;|&nbsp; Normalize OEM: <b>${escapeHtml(norm || '-')}</b>`;
      }
    });

    searchInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        executePartSearch(searchInput.value, false);
      }
    });

    document.getElementById('btnSearchAllSources')?.addEventListener('click', () => {
      executePartSearch(searchInput?.value || '', false);
    });

    document.getElementById('btnForceLiveSearch')?.addEventListener('click', () => {
      executePartSearch(searchInput?.value || '', true);
    });

    // Hızlı OEM çipleri
    document.querySelectorAll('.oem-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.getAttribute('data-query') || '';
        if (searchInput) searchInput.value = q;
        executePartSearch(q, false);
      });
    });

    // Kaynak grup filtre butonları (Arama sekmesi)
    document.querySelectorAll('.src-group-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.src-group-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedSearchGroup = btn.getAttribute('data-group') || 'ALL';
        renderSearchSourceCheckboxes();
      });
    });

    document.getElementById('btnSelectPriority1Sources')?.addEventListener('click', () => {
      document.querySelectorAll('.search-src-checkbox').forEach(cb => {
        const src = db.sources.find(s => s.id === cb.value);
        cb.checked = !!(src && src.active && src.priority === 1);
      });
    });

    document.getElementById('btnSelectAllActiveSources')?.addEventListener('click', () => {
      document.querySelectorAll('.search-src-checkbox').forEach(cb => {
        const src = db.sources.find(s => s.id === cb.value);
        cb.checked = !!(src && src.active);
      });
    });

    // Sonuç sıralama ve filtreleme
    ['resultSortSelect', 'resultConfidenceFilter', 'resultStockFilter'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => renderSearchResultsTable());
    });

    // Excel & CSV dışa aktarım
    document.getElementById('btnExportSearchExcel')?.addEventListener('click', () => {
      window.ExcelExporter.exportToExcel(currentSearchResults, 'VW_Parca_Arastirma_Sonuclari');
    });
    document.getElementById('btnExportSearchCsv')?.addEventListener('click', () => {
      window.ExcelExporter.exportToCSV(currentSearchResults, 'VW_Parca_Arastirma_Sonuclari');
    });
    document.getElementById('btnExportTestScanExcel')?.addEventListener('click', () => {
      window.ExcelExporter.exportToExcel(lastTestScanItems, 'VW_Gercek_Test_Taramasi');
    });
    document.getElementById('btnExportCatalogExcel')?.addEventListener('click', () => {
      window.ExcelExporter.exportToExcel(db.source_products.filter(p => !p.archived), 'VW_Yerel_Katalog_Urunleri');
    });
    document.getElementById('btnExportBulkExcel')?.addEventListener('click', () => {
      window.ExcelExporter.exportToExcel(currentBulkResults, 'VW_Toplu_OEM_Sonuclari');
    });

    // Kaynak Yönetimi grup filtresi
    document.getElementById('sourcesGroupFilter')?.addEventListener('change', () => {
      renderSourcesTable();
    });

    // Haftalık güncelleme & Arşiv kontrolü
    document.getElementById('btnStartWeeklyUpdate')?.addEventListener('click', () => {
      startManualWeeklyUpdate();
    });
    document.getElementById('btnRunArchiveCheck')?.addEventListener('click', () => {
      const archivedCount = window.DBSeed.markStaleProductsArchived(db, 180);
      saveDatabase();
      renderWeeklyTab();
      alert(`180 gün kontrolü tamamlandı. Arşivlenen (Archived) ürün sayısı: ${archivedCount}`);
    });

    // Toplu OEM
    document.getElementById('btnRunBulkOemSearch')?.addEventListener('click', () => {
      runBulkOemSearch();
    });
    document.getElementById('bulkOemFileInput')?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const ta = document.getElementById('bulkOemTextarea');
        if (ta) ta.value = String(ev.target?.result || '');
      };
      reader.readAsText(file);
    });

    // Modallar
    document.getElementById('btnOpenAddSourceModal')?.addEventListener('click', () => {
      document.getElementById('addSourceModalBackdrop')?.classList.add('open');
    });
    document.getElementById('btnCloseAddSourceModal')?.addEventListener('click', () => {
      document.getElementById('addSourceModalBackdrop')?.classList.remove('open');
    });
    document.getElementById('btnSaveAndAnalyzeNewSource')?.addEventListener('click', () => {
      saveNewSourceFromModal();
    });

    document.getElementById('btnCloseB2bAuthModal')?.addEventListener('click', () => {
      document.getElementById('b2bAuthModalBackdrop')?.classList.remove('open');
    });
    document.getElementById('btnConfirmB2bLogin')?.addEventListener('click', () => {
      confirmB2bLogin();
    });

    document.getElementById('btnCloseProdDetailModal')?.addEventListener('click', () => {
      document.getElementById('productDetailModalBackdrop')?.classList.remove('open');
    });
  }

  async function init() {
    await loadDatabase();
    bindEvents();
    updateKpisAndBadges();
    renderSearchSourceCheckboxes();
    renderSearchResultsTable();
    renderSourcesTable();
    renderWeeklyTab();
    renderJobsAndErrorsTab();
    renderHistoryAndCatalogTab();
    await refreshBackendStatus();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    runSearch: (forceLive = false) => {
      const q = document.getElementById('mainSearchInput')?.value || '';
      return executePartSearch(q, forceLive);
    },
    analyzeSource,
    runRealTestScan,
    approveSourceOnly,
    approveSourceAndStartFullScan,
    startFullCatalogScanJob,
    controlScanJob,
    changeSourcePriority,
    toggleSourceActive,
    checkSingleProductNow,
    openB2bAuthModal,
    openProductDetailModal,
    exportFullDatabaseJson,
    resetDatabaseToDefault,
    saveToDiskNow
  };
})();
