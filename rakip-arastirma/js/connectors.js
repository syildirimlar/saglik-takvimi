/**
 * Bağımsız Kaynak Adapter Mimarisi (Bölüm 2, 5, 6, 22, 23, 24, 26, 27, 31, 32, 35, 36)
 *
 * Ortak SourceAdapter Arayüzü:
 *  - analyzeSource(source)
 *  - authenticate(source, credentials)
 *  - searchProduct(source, query)
 *  - getProduct(source, urlOrCode)
 *  - getProductList(source, limit)
 *  - parseProduct(raw, source)
 *  - getPrice(raw)
 *  - getStock(raw)
 *  - getCrossReferences(raw)
 *
 * TEMEL PRENSİP: "VERİ YOKSA VERİ YOKTUR."
 * Hiçbir adapter demo, mock, temsili veya uydurma ürün döndürmez.
 */

window.ConnectorEngine = (function () {
  const adapters = new Map();
  const responseCache = new Map();
  const lastRequestTimeBySource = new Map();
  let backendAvailable = false;

  const BACKEND_BASE = 'http://localhost:8890';

  function extractItemsArray(json) {
    if (!json || !json.items) return [];
    if (Array.isArray(json.items)) return json.items;
    if (typeof json.items === 'object' && json.items.product_name) return [json.items];
    return [];
  }

  let lastHealthCheckTime = 0;

  async function checkBackendHealth(force = false) {
    // Sayfa zaten http://localhost:8890 üzerinden açıldıysa sunucu kesinlikle aktiftir
    if (typeof window !== 'undefined' && window.location && window.location.port === '8890') {
      backendAvailable = true;
      lastHealthCheckTime = Date.now();
      return true;
    }

    if (!force && backendAvailable && (Date.now() - lastHealthCheckTime < 60000)) {
      return true;
    }

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${BACKEND_BASE}/api/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.service === 'vw-parca-arastirma' || data.mode === 'PRODUCTION_REAL_DATA_ONLY')) {
          backendAvailable = true;
          lastHealthCheckTime = Date.now();
          return true;
        }
      }
    } catch (e) {
      // Sunucu o an başka bir isteği işliyor olabilir
    }
    return backendAvailable;
  }

  /**
   * Bölüm 22: Rate Limit + Request Delay + Akıllı Retry
   * - 404 -> tekrar deneme yapılmaz
   * - 429 -> bekle ve tekrar dene
   * - 500+ -> kontrollü retry
   * - 401/403 -> kullanıcı müdahalesi / login süresi doldu
   */
  async function throttledFetch(source, url, options = {}) {
    const cacheKey = `${source.id}:${url}`;
    if (!options.bypassCache && responseCache.has(cacheKey)) {
      const cached = responseCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.data;
      }
    }

    const delayMs = source.request_delay_ms || source.rate_limit_ms || 300;
    const lastTime = lastRequestTimeBySource.get(source.id) || 0;
    const elapsed = Date.now() - lastTime;
    if (elapsed < delayMs) {
      await new Promise(r => setTimeout(r, delayMs - elapsed));
    }
    lastRequestTimeBySource.set(source.id, Date.now());

    const retries = source.retry_count ?? 1;
    const timeoutMs = Math.max(source.timeout_ms || 25000, 25000);

    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        const res = await fetch(url, { ...options, signal: ctrl.signal });
        clearTimeout(timer);

        if (res.status === 404) {
          const err404 = new Error('HTTP 404 Not Found');
          err404.statusCode = 404;
          err404.noRetry = true;
          throw err404;
        }
        if (res.status === 401 || res.status === 403) {
          const errAuth = new Error(`HTTP ${res.status} Manuel giriş / doğrulama gerekiyor`);
          errAuth.statusCode = res.status;
          errAuth.requiresAuth = true;
          errAuth.noRetry = true;
          throw errAuth;
        }
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          throw new Error('HTTP 429 Rate Limit');
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const text = await res.text();
        responseCache.set(cacheKey, { timestamp: Date.now(), data: text });
        return text;
      } catch (err) {
        lastErr = err;
        if (err.noRetry) break;
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }
    throw lastErr;
  }

  function decodeHtml(html) {
    if (!html) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  }

  function stripHtml(html) {
    if (!html) return '';
    return decodeHtml(
      html
        .replace(/<br\s*\/?>/gi, ' | ')
        .replace(/<\/p>/gi, ' | ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
    )
      .replace(/(\s*\|\s*)+/g, ' | ')
      .replace(/\s*Ekle Ekle$/i, '')
      .trim()
      .replace(/^\||\|$/g, '')
      .trim();
  }

  /**
   * Temel SourceAdapter Şablonu (Bölüm 36)
   */
  function createBaseAdapter(adapterName, customMethods = {}) {
    return {
      adapterName,

      async analyzeSource(source) {
        await checkBackendHealth();
        if (backendAvailable) {
          try {
            const url = `${BACKEND_BASE}/api/analyze-source?source_id=${encodeURIComponent(source.id)}&url=${encodeURIComponent(source.base_url)}&is_b2b=${source.is_b2b ? 'true' : 'false'}&login_status=${encodeURIComponent(source.login_status || '')}`;
            const raw = await throttledFetch(source, url, { bypassCache: true });
            const data = JSON.parse(raw);
            if (data && data.connection) return data;
          } catch (e) {}
        }

        // B2B kaynağı ise ve giriş yapılmamışsa
        if (source.is_b2b && source.login_status !== 'Authenticated') {
          return {
            ok: true,
            connection: 'OK',
            authentication: 'Login Required',
            product_page: 'Requires Authentication',
            requires_login: true,
            status: 'LOGIN REQUIRED',
            fields: {
              product_name: 'Requires Login',
              product_code: 'Requires Login',
              oem_number: 'Requires Login',
              brand: 'Requires Login',
              price: 'Requires Login',
              currency: 'Requires Login',
              stock_status: 'Requires Login',
              stock_quantity: 'Requires Login',
              description: 'Requires Login',
              image_url: 'Requires Login',
              product_url: 'Requires Login'
            }
          };
        }

        // BB Classic Parts doğrudan tarayıcıdan da Store API ile analiz edilebilir
        if (source.id === 'src_bbclassic') {
          try {
            const testRes = await throttledFetch(source, 'https://www.bbclassicparts.com/wp-json/wc/store/v1/products?per_page=1', { bypassCache: true });
            const arr = JSON.parse(testRes);
            if (Array.isArray(arr) && arr.length > 0) {
              return {
                ok: true,
                connection: 'OK',
                authentication: 'Not Required',
                product_page: 'OK',
                requires_login: false,
                status: 'ANALYZED',
                fields: {
                  product_name: 'Found',
                  product_code: 'Found',
                  oem_number: 'Found',
                  brand: 'Found',
                  price: 'Found',
                  currency: 'Found',
                  stock_status: 'Found',
                  stock_quantity: 'Not Found',
                  description: 'Found',
                  image_url: 'Found',
                  product_url: 'Found'
                }
              };
            }
          } catch (e) {}
        }

        return {
          ok: false,
          connection: backendAvailable ? 'ERROR' : 'Requires Local Companion Server (baslat.bat)',
          authentication: source.is_b2b ? 'Login Required' : 'Not Required',
          product_page: 'Not Verified (CORS)',
          requires_login: source.is_b2b,
          status: 'NOT READY',
          fields: {
            product_name: 'Not Found',
            product_code: 'Not Found',
            oem_number: 'Not Found',
            brand: 'Not Found',
            price: 'Not Found',
            currency: 'Not Found',
            stock_status: 'Not Found',
            stock_quantity: 'Not Found',
            description: 'Not Found',
            image_url: 'Not Found',
            product_url: 'Not Found'
          }
        };
      },

      async authenticate(source, credentials) {
        if (!credentials || !credentials.username) {
          return { ok: false, message: 'Kullanıcı adı veya yetkili oturum bilgisi eksik.' };
        }
        return { ok: true, status: 'Authenticated' };
      },

      getPrice(raw) {
        return {
          public_price: raw?.public_price ?? raw?.price ?? null,
          old_price: raw?.old_price ?? null,
          b2b_price: raw?.b2b_price ?? null,
          currency: raw?.currency || 'EUR'
        };
      },

      getStock(raw) {
        return {
          stock_status: raw?.stock_status || null,
          stock_quantity: raw?.stock_quantity ?? null
        };
      },

      getCrossReferences(raw) {
        const extracted = window.OEMEngine.extractCodesFromText(raw?.description || '');
        return extracted.extraCodes || [];
      },

      parseProduct(raw, source) {
        return raw;
      },

      async getProductList(source, limit = 20) {
        const startMs = Date.now();
        await checkBackendHealth();

        if (source.is_b2b && source.login_status !== 'Authenticated') {
          return {
            ok: false,
            requested_count: limit,
            found_count: 0,
            failed_count: limit,
            elapsed_ms: Date.now() - startMs,
            error: 'Manuel giriş / doğrulama gerekiyor.',
            items: []
          };
        }

        if (backendAvailable) {
          try {
            const url = `${BACKEND_BASE}/api/test-scan?source_id=${encodeURIComponent(source.id)}&limit=${limit}`;
            const raw = await throttledFetch(source, url, { bypassCache: true });
            const json = JSON.parse(raw);
            if (json) {
              json.items = extractItemsArray(json);
              return json;
            }
          } catch (e) {}
        }

        return {
          ok: false,
          requested_count: limit,
          found_count: 0,
          failed_count: limit,
          elapsed_ms: Date.now() - startMs,
          error: backendAvailable
            ? 'Bu kaynaktan gerçek ürün verisi alınamadı.'
            : 'CORS kısıtlaması nedeniyle doğrudan tarayıcıdan erişilemedi. Gerçek veri çekmek için baslat.bat (yerel sunucu) çalıştırın.',
          items: []
        };
      },

      async getCatalogPage(source, page = 1, perPage = 25) {
        if (source.is_b2b && source.login_status !== 'Authenticated') {
          return { ok: false, page, total_items: 0, total_pages: 0, has_more: false, items: [], error: 'Manuel giriş gerekiyor.' };
        }
        await checkBackendHealth();
        if (backendAvailable) {
          try {
            const url = `${BACKEND_BASE}/api/catalog-page?source_id=${encodeURIComponent(source.id)}&page=${page}&per_page=${perPage}`;
            const raw = await throttledFetch(source, url, { bypassCache: true });
            const json = JSON.parse(raw);
            if (json) {
              json.items = extractItemsArray(json);
              return json;
            }
          } catch (e) {
            return { ok: false, page, total_items: 0, total_pages: 0, has_more: false, items: [], error: e.message };
          }
        }
        return { ok: false, page, total_items: 0, total_pages: 0, has_more: false, items: [], error: 'Tam katalog taraması için baslat.bat (yerel sunucu) gereklidir.' };
      },

      async searchProduct(source, query) {
        if (source.is_b2b && source.login_status !== 'Authenticated') {
          return [];
        }
        await checkBackendHealth();
        if (backendAvailable) {
          try {
            const url = `${BACKEND_BASE}/api/live-search?source_id=${encodeURIComponent(source.id)}&q=${encodeURIComponent(query)}&limit=6`;
            const raw = await throttledFetch(source, url);
            const json = JSON.parse(raw);
            return extractItemsArray(json);
          } catch (e) {}
        }
        return [];
      },

      async getProduct(source, productRecord) {
        await checkBackendHealth();
        if (backendAvailable && productRecord) {
          try {
            const url = `${BACKEND_BASE}/api/check-product?source_id=${encodeURIComponent(source.id)}&url=${encodeURIComponent(productRecord.product_url || '')}&code=${encodeURIComponent(productRecord.product_code || '')}`;
            const raw = await throttledFetch(source, url, { bypassCache: true });
            return JSON.parse(raw);
          } catch (e) {}
        }
        if (source.id === 'src_bbclassic' && productRecord?.product_code) {
          try {
            const items = await this.searchProduct(source, productRecord.product_code);
            const hit = items.find(i => i.product_code === productRecord.product_code || i.product_url === productRecord.product_url);
            if (hit) {
              return { ok: true, item: hit, checked_at: window.DBSeed.nowTimestamp() };
            }
          } catch (e) {}
        }
        return { ok: false, error: 'Anlık canlı kontrol sırasında kaynağa erişilemedi.' };
      },

      ...customMethods
    };
  }

  /**
   * 1. BBClassicAdapter — Doğrudan WooCommerce Store API v1 + Yerel Sunucu Desteği
   */
  const BBClassicAdapter = createBaseAdapter('BBClassicAdapter', {
    parseProduct(p, source) {
      const attrs = Array.isArray(p.attributes) ? p.attributes : [];
      const oemAttr = attrs.find(a => a.taxonomy === 'pa_oem' || (a.name && a.name.toLowerCase().includes('oem')));
      const brandAttr = attrs.find(a => a.taxonomy === 'pa_brand' || (a.name && a.name.toLowerCase().includes('marka')));
      const markaNoAttr = attrs.find(a => a.taxonomy === 'pa_marka-no' || (a.name && a.name.toLowerCase().includes('marka no')));

      const oemVal = oemAttr && Array.isArray(oemAttr.terms) && oemAttr.terms.length
        ? oemAttr.terms.map(t => decodeHtml(t.name)).join(', ')
        : null;
      const brandVal = brandAttr && Array.isArray(brandAttr.terms) && brandAttr.terms.length
        ? brandAttr.terms.map(t => decodeHtml(t.name)).join(', ')
        : null;
      const markaNoVal = markaNoAttr && Array.isArray(markaNoAttr.terms) && markaNoAttr.terms.length
        ? markaNoAttr.terms.map(t => decodeHtml(t.name)).join(', ')
        : null;

      const cats = Array.isArray(p.categories)
        ? [...new Set(p.categories.map(c => decodeHtml(c.name)))]
        : [];

      const minorUnit = p.prices && typeof p.prices.currency_minor_unit === 'number' ? p.prices.currency_minor_unit : 2;
      const divisor = Math.pow(10, minorUnit);
      const priceVal = p.prices && p.prices.price ? Math.round((Number(p.prices.price) / divisor) * 100) / 100 : null;
      const regPriceVal = p.prices && p.prices.regular_price ? Math.round((Number(p.prices.regular_price) / divisor) * 100) / 100 : null;
      const oldPriceVal = regPriceVal && regPriceVal !== priceVal ? regPriceVal : null;
      const curr = (p.prices && p.prices.currency_code) ? p.prices.currency_code : 'EUR';

      const descClean = stripHtml(p.description || '');
      const compatClean = stripHtml(p.short_description || '');

      let finalOem = oemVal;
      if (!finalOem && descClean) {
        const m = descClean.match(/([0-9A-Z]{9,12})\s+OEM\s+(?:kodu|referans)/i);
        if (m) finalOem = m[1].toUpperCase();
      }

      return {
        source_id: source.id,
        source_name: source.name,
        source_type: source.source_type,
        source_product_id: String(p.id),
        source_product_url: p.permalink,
        product_url: p.permalink,
        product_name: decodeHtml(p.name || ''),
        brand: brandVal || null,
        product_code: p.sku ? String(p.sku) : null,
        competitor_part_number: markaNoVal || null,
        oem_number: finalOem || null,
        normalized_oem: window.OEMEngine.normalizeSingleOEM(finalOem || ''),
        description: descClean || null,
        compatibility: compatClean || null,
        category: cats[0] || null,
        subcategory: cats.length > 1 ? cats.slice(1).join(' > ') : null,
        stock_status: p.is_in_stock ? 'In Stock' : 'Out of Stock',
        stock_quantity: typeof p.low_stock_remaining === 'number' ? p.low_stock_remaining : null,
        price: priceVal,
        public_price: priceVal,
        old_price: oldPriceVal,
        b2b_price: null,
        currency: curr,
        price_type: 'Public Price',
        image_url: Array.isArray(p.images) && p.images.length > 0 ? p.images[0].src : null,
        adapter_name: 'BBClassicAdapter',
        fetched_at: window.DBSeed.nowTimestamp()
      };
    },

    async getCatalogPage(source, page = 1, perPage = 100) {
      try {
        const apiUrl = `https://www.bbclassicparts.com/wp-json/wc/store/v1/products?per_page=${perPage}&page=${page}`;
        const res = await fetch(apiUrl);
        if (res.ok) {
          const totalItems = Number(res.headers.get('X-WP-Total') || 2970);
          const totalPages = Number(res.headers.get('X-WP-TotalPages') || Math.ceil(totalItems / perPage));
          const arr = await res.json();
          const items = Array.isArray(arr) ? arr.map(p => this.parseProduct(p, source)) : [];
          return {
            ok: true,
            page,
            total_items: totalItems,
            total_pages: totalPages,
            has_more: page < totalPages && items.length > 0,
            items
          };
        }
      } catch (e) {}

      await checkBackendHealth();
      if (backendAvailable) {
        try {
          const url = `${BACKEND_BASE}/api/catalog-page?source_id=src_bbclassic&page=${page}&per_page=${perPage}`;
          const raw = await throttledFetch(source, url, { bypassCache: true });
          const json = JSON.parse(raw);
          if (json) {
            json.items = extractItemsArray(json);
            return json;
          }
        } catch (e) {}
      }
      return { ok: false, page, total_items: 0, total_pages: 0, has_more: false, items: [] };
    },

    async getProductList(source, limit = 20) {
      const startMs = Date.now();
      try {
        // Doğrudan WooCommerce Store API v1 çağrısı (CORS açık, anında yanıt verir)
        const apiUrl = `https://www.bbclassicparts.com/wp-json/wc/store/v1/products?per_page=${limit}&page=1`;
        const rawText = await throttledFetch(source, apiUrl, { bypassCache: true });
        const arr = JSON.parse(rawText);
        if (Array.isArray(arr) && arr.length > 0) {
          const items = arr.map(p => this.parseProduct(p, source));
          return {
            ok: true,
            requested_count: limit,
            found_count: items.length,
            failed_count: Math.max(0, limit - items.length),
            elapsed_ms: Date.now() - startMs,
            error: null,
            items
          };
        }
      } catch (e) {}

      await checkBackendHealth();
      try {
        if (backendAvailable) {
          const raw = await throttledFetch(source, `${BACKEND_BASE}/api/test-scan?source_id=src_bbclassic&limit=${limit}`, { bypassCache: true });
          const json = JSON.parse(raw);
          if (json) {
            json.items = extractItemsArray(json);
            return json;
          }
        }
      } catch (err) {
        return {
          ok: false,
          requested_count: limit,
          found_count: 0,
          failed_count: limit,
          elapsed_ms: Date.now() - startMs,
          error: err.message || 'Bağlantı hatası',
          items: []
        };
      }
      return { ok: false, requested_count: limit, found_count: 0, failed_count: limit, elapsed_ms: Date.now() - startMs, error: 'Veri alınamadı', items: [] };
    },

    async searchProduct(source, query) {
      const cleanQ = (query || '').trim();
      if (!cleanQ) return [];
      const normQ = window.OEMEngine.normalizeSingleOEM(cleanQ);

      // 1. Doğrudan tarayıcıdan WooCommerce Store API v1 (CORS açık, ~300ms)
      try {
        const queriesToTry = [normQ || cleanQ];
        if (cleanQ !== (normQ || cleanQ)) queriesToTry.push(cleanQ);
        if (normQ && normQ.length > 9) queriesToTry.push(normQ.slice(0, 9));

        for (const qTry of queriesToTry) {
          const apiUrl = `https://www.bbclassicparts.com/wp-json/wc/store/v1/products?search=${encodeURIComponent(qTry)}&per_page=15`;
          const rawText = await throttledFetch(source, apiUrl);
          const arr = JSON.parse(rawText);
          if (Array.isArray(arr) && arr.length > 0) {
            return arr.map(p => this.parseProduct(p, source));
          }
        }
      } catch (e) {}

      // 2. Yedek olarak yerel sunucu üzerinden dene
      await checkBackendHealth();
      try {
        if (backendAvailable) {
          const raw = await throttledFetch(source, `${BACKEND_BASE}/api/live-search?source_id=src_bbclassic&q=${encodeURIComponent(normQ || cleanQ)}&limit=10`);
          const json = JSON.parse(raw);
          const list = extractItemsArray(json);
          if (list.length > 0) return list;
        }
      } catch (e) {}
      return [];
    }
  });

  // 25 Kaynak Adapter Kaydı (Bölüm 2 & 36)
  adapters.set('BBClassicAdapter', BBClassicAdapter);
  adapters.set('VWClassicClubAdapter', createBaseAdapter('VWClassicClubAdapter'));
  adapters.set('ParuzziAdapter', createBaseAdapter('ParuzziAdapter'));
  adapters.set('HeritageAdapter', createBaseAdapter('HeritageAdapter'));
  adapters.set('VWClassicPartsAdapter', createBaseAdapter('VWClassicPartsAdapter'));
  adapters.set('HoffmannSpeedsterAdapter', createBaseAdapter('HoffmannSpeedsterAdapter'));
  adapters.set('CSPAdapter', createBaseAdapter('CSPAdapter'));
  adapters.set('WolfsburgWestAdapter', createBaseAdapter('WolfsburgWestAdapter'));
  adapters.set('JBugsAdapter', createBaseAdapter('JBugsAdapter'));
  adapters.set('JustKampersAdapter', createBaseAdapter('JustKampersAdapter'));
  adapters.set('OzceteAdapter', createBaseAdapter('OzceteAdapter'));
  adapters.set('RemarAdapter', createBaseAdapter('RemarAdapter'));
  adapters.set('YeygunAdapter', createBaseAdapter('YeygunAdapter'));
  adapters.set('RepxpertAdapter', createBaseAdapter('RepxpertAdapter'));
  adapters.set('ParcaPaketiAdapter', createBaseAdapter('ParcaPaketiAdapter'));
  adapters.set('BasarioB4BAdapter', createBaseAdapter('BasarioB4BAdapter'));
  adapters.set('DegaAdapter', createBaseAdapter('DegaAdapter'));
  adapters.set('IsamAdapter', createBaseAdapter('IsamAdapter'));
  adapters.set('PhiraAdapter', createBaseAdapter('PhiraAdapter'));
  adapters.set('FlorimexAdapter', createBaseAdapter('FlorimexAdapter'));
  adapters.set('PrascoAdapter', createBaseAdapter('PrascoAdapter'));
  adapters.set('OnlineCarPartsAdapter', createBaseAdapter('OnlineCarPartsAdapter'));
  adapters.set('AutodocUkAdapter', createBaseAdapter('AutodocUkAdapter'));
  adapters.set('AutodocAdapter', createBaseAdapter('AutodocAdapter'));
  adapters.set('DparAdapter', createBaseAdapter('DparAdapter'));

  function getAdapterForSource(source) {
    if (!source) return null;
    if (source.adapter_name && adapters.has(source.adapter_name)) {
      return adapters.get(source.adapter_name);
    }
    const dynAdapter = createBaseAdapter(source.adapter_name || 'CustomSourceAdapter');
    if (source.adapter_name) adapters.set(source.adapter_name, dynAdapter);
    return dynAdapter;
  }

  return {
    checkBackendHealth,
    isBackendAvailable: () => backendAvailable,
    getAdapterForSource,
    decodeHtml,
    stripHtml
  };
})();
