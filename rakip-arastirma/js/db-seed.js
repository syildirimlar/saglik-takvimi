/**
 * Veritabanı Mimarisi, 18 Kaynak Tanımı ve İlişkisel Katalog Motoru
 * (Bölüm 1, 2, 3, 4, 11, 12, 13, 14, 15, 19, 20, 38, 39, 41, 50, 51)
 *
 * KURAL: Production veritabanı BOŞ başlar (0 ürün).
 * Hiçbir demo, mock, temsili veya uydurma ürün içermez.
 *
 * Ana Tablolar:
 *  - sources
 *  - source_products
 *  - product_cross_references
 *  - product_prices (Fiyat değiştiğinde yeni history kaydı eklenir - Bölüm 13 & 14)
 *  - product_stock_history (Stok durumu/miktarı değiştiğinde yeni history kaydı eklenir - Bölüm 13 & 15)
 *  - scan_jobs
 *  - scan_job_items
 *  - search_logs
 *  - source_errors
 *  - secure_sessions
 */

window.DBSeed = (function () {
  const DEFAULT_SOURCES = [
    // =========================================================================
    // GRUP 1: MEVCUT & KLASİK VW KAYNAKLARI (ÖNCELİK 1 & 2)
    // =========================================================================
    {
      id: 'src_bbclassic',
      name: 'BB Classic Parts',
      group: 'Klasik VW',
      source_type: 'Public Web',
      is_b2b: false,
      base_url: 'https://www.bbclassicparts.com/',
      login_url: null,
      product_url: 'https://www.bbclassicparts.com/urun/',
      category_url: 'https://www.bbclassicparts.com/urun-kategorisi/',
      search_url_template: 'https://www.bbclassicparts.com/wp-json/wc/store/v1/products?search={query}&per_page=25',
      active: true,
      priority: 1,
      adapter_name: 'BBClassicAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 400,
      rate_limit_ms: 450,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'WooCommerce Store API v1 + Sitemap destekli açık web kaynağı.'
    },
    {
      id: 'src_vwclassic',
      name: 'VW Classic Club',
      group: 'Klasik VW',
      source_type: 'Public Web',
      is_b2b: false,
      base_url: 'https://www.vwclassicclub.com/',
      login_url: 'https://www.vwclassicclub.com/UyeGiris',
      product_url: 'https://www.vwclassicclub.com/',
      category_url: 'https://www.vwclassicclub.com/vw-kaplumbaga',
      search_url_template: 'https://www.vwclassicclub.com/Arama?1&kelime={query}',
      active: true,
      priority: 1,
      adapter_name: 'VWClassicClubAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 500,
      rate_limit_ms: 550,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'Ticimax ürün detay JSON + Sitemap destekli açık web kaynağı.'
    },
    {
      id: 'src_paruzzi',
      name: 'Paruzzi',
      group: 'Klasik VW',
      source_type: 'Public Web',
      is_b2b: false,
      base_url: 'https://www.paruzzi.com/en/products',
      login_url: 'https://www.paruzzi.com/en/account/login',
      product_url: 'https://www.paruzzi.com/en/',
      category_url: 'https://www.paruzzi.com/en/products/vw-beetle/',
      search_url_template: 'https://www.paruzzi.com/en/search?search={query}',
      active: true,
      priority: 1,
      adapter_name: 'ParuzziAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 550,
      rate_limit_ms: 600,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'Avrupa klasik VW yedek parça ana katalog kaynağı (Shopware 6 / Schema.org).'
    },
    {
      id: 'src_heritage',
      name: 'Heritage Parts Centre',
      group: 'Klasik VW',
      source_type: 'Public Web',
      is_b2b: false,
      base_url: 'https://www.heritagepartscentre.com/',
      login_url: 'https://www.heritagepartscentre.com/eu/customer/account/login/',
      product_url: 'https://www.heritagepartscentre.com/eu/',
      category_url: 'https://www.heritagepartscentre.com/eu/volkswagen.html',
      search_url_template: 'https://www.heritagepartscentre.com/eu/catalogsearch/result/?q={query}',
      active: true,
      priority: 1,
      adapter_name: 'HeritageAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
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
      notes: 'İngiltere/Avrupa klasik VW ve Porsche parça merkezi (Magento 2 / JSON-LD).'
    },
    {
      id: 'src_vwclassicparts',
      name: 'Volkswagen Classic Parts',
      group: 'Klasik VW',
      source_type: 'Public / Catalog / OEM Reference',
      is_b2b: false,
      base_url: 'https://www.volkswagen-classic-parts.com/',
      login_url: null,
      product_url: 'https://www.volkswagen-classic-parts.com/en_global/',
      category_url: 'https://www.volkswagen-classic-parts.com/en_global/',
      search_url_template: 'https://www.volkswagen-classic-parts.com/en_global/search.html?q={query}',
      active: true,
      priority: 1,
      adapter_name: 'VWClassicPartsAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 650,
      rate_limit_ms: 700,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'Orijinal VW Classic Parts OEM referans ve katalog kaynağı.'
    },
    {
      id: 'src_hoffmann',
      name: 'Hoffmann Speedster',
      group: 'Klasik VW',
      source_type: 'Public Web',
      is_b2b: false,
      base_url: 'https://www.hoffmann-speedster.com/',
      login_url: 'https://www.hoffmann-speedster.com/en/account/login',
      product_url: 'https://www.hoffmann-speedster.com/en/',
      category_url: 'https://www.hoffmann-speedster.com/en/beetle-co.',
      search_url_template: 'https://www.hoffmann-speedster.com/en/search?sSearch={query}',
      active: true,
      priority: 2,
      adapter_name: 'HoffmannSpeedsterAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 650,
      rate_limit_ms: 700,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'Almanya klasik VW yedek parça kaynağı.'
    },
    {
      id: 'src_csp',
      name: 'CSP / Custom & Speed Parts',
      group: 'Klasik VW',
      source_type: 'Public Web',
      is_b2b: false,
      base_url: 'https://www.csp-shop.de/',
      login_url: 'https://www.csp-shop.de/en/Account/',
      product_url: 'https://www.csp-shop.de/en/',
      category_url: 'https://www.csp-shop.de/en/Products/',
      search_url_template: 'https://www.csp-shop.de/en/shop-search/?q={query}',
      active: true,
      priority: 2,
      adapter_name: 'CSPAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 650,
      rate_limit_ms: 700,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'CSP Shop Almanya performans ve klasik VW parçaları.'
    },
    {
      id: 'src_wolfsburgwest',
      name: 'Wolfsburg West',
      group: 'Klasik VW',
      source_type: 'Public Web',
      is_b2b: false,
      base_url: 'https://www.wolfsburgwest.com/',
      login_url: 'https://www.wolfsburgwest.com/cart/account.cfm',
      product_url: 'https://www.wolfsburgwest.com/cart/DetailsList.cfm?ID=',
      category_url: 'https://www.wolfsburgwest.com/wired/',
      search_url_template: 'https://www.wolfsburgwest.com/cart/DetailsList.cfm?ID={query}',
      active: true,
      priority: 2,
      adapter_name: 'WolfsburgWestAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 650,
      rate_limit_ms: 700,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'ABD Wolfsburg West klasik Beetle ve Bus parça üreticisi.'
    },
    {
      id: 'src_jbugs',
      name: 'JBugs',
      group: 'Klasik VW',
      source_type: 'Public Web',
      is_b2b: false,
      base_url: 'https://www.jbugs.com/',
      login_url: 'https://www.jbugs.com/account.html',
      product_url: 'https://www.jbugs.com/product/',
      category_url: 'https://www.jbugs.com/category/vw-bug-parts.html',
      search_url_template: 'https://www.jbugs.com/search.html?Search={query}',
      active: true,
      priority: 2,
      adapter_name: 'JBugsAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 650,
      rate_limit_ms: 700,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'ABD JBugs klasik VW yedek parça kataloğu.'
    },
    {
      id: 'src_justkampers',
      name: 'Just Kampers',
      group: 'Klasik VW',
      source_type: 'Public Web',
      is_b2b: false,
      base_url: 'https://www.justkampers.com/',
      login_url: 'https://www.justkampers.com/customer/account/login/',
      product_url: 'https://www.justkampers.com/',
      category_url: 'https://www.justkampers.com/vw-t2-bay-window-parts',
      search_url_template: 'https://www.justkampers.com/catalogsearch/result/?q={query}',
      active: true,
      priority: 2,
      adapter_name: 'JustKampersAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 650,
      rate_limit_ms: 700,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'İngiltere Just Kampers klasik T1, T2, T3, Beetle parça merkezi.'
    },

    // =========================================================================
    // GRUP 2: TÜRKİYE B2B KAYNAKLARI (ÖNCELİK 2 - LOGIN GEREKTİRİR)
    // =========================================================================
    {
      id: 'src_ozcete',
      name: 'Özçete Otomotiv B2B',
      group: 'Türkiye / B2B',
      source_type: 'B2B / Login Required',
      is_b2b: true,
      base_url: 'https://online.ozcete.com.tr/web/b2b/search',
      login_url: 'https://online.ozcete.com.tr/web/login',
      product_url: 'https://online.ozcete.com.tr/web/b2b/product/',
      category_url: 'https://online.ozcete.com.tr/web/b2b/search',
      search_url_template: 'https://online.ozcete.com.tr/web/b2b/search?q={query}',
      active: true,
      priority: 2,
      adapter_name: 'OzceteAdapter',
      adapter_status: 'LOGIN REQUIRED',
      login_status: 'Login Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 700,
      rate_limit_ms: 800,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'Türkiye B2B bayi portalı. Yetkili kullanıcı girişi veya açık tarayıcı oturumu gerektirir.'
    },
    {
      id: 'src_remar',
      name: 'Remar Otomotiv B2B',
      group: 'Türkiye / B2B',
      source_type: 'B2B / Login Required',
      is_b2b: true,
      base_url: 'https://b2b.remarotomotiv.com/login',
      login_url: 'https://b2b.remarotomotiv.com/login',
      product_url: 'https://b2b.remarotomotiv.com/',
      category_url: 'https://b2b.remarotomotiv.com/',
      search_url_template: 'https://b2b.remarotomotiv.com/search?q={query}',
      active: true,
      priority: 2,
      adapter_name: 'RemarAdapter',
      adapter_status: 'LOGIN REQUIRED',
      login_status: 'Login Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 700,
      rate_limit_ms: 800,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'Remar Otomotiv B2B bayi sistemi. Yetkili giriş gerektirir.'
    },
    {
      id: 'src_yeygun',
      name: 'Yeygün Otomotiv B2B',
      group: 'Türkiye / B2B',
      source_type: 'B2B / Login Required',
      is_b2b: true,
      base_url: 'https://b2b.yeygunotomotiv.com/web/b2b/search',
      login_url: 'https://b2b.yeygunotomotiv.com/web/login',
      product_url: 'https://b2b.yeygunotomotiv.com/web/b2b/',
      category_url: 'https://b2b.yeygunotomotiv.com/web/b2b/search',
      search_url_template: 'https://b2b.yeygunotomotiv.com/web/b2b/search?q={query}',
      active: true,
      priority: 2,
      adapter_name: 'YeygunAdapter',
      adapter_status: 'LOGIN REQUIRED',
      login_status: 'Login Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 700,
      rate_limit_ms: 800,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'Yeygün Otomotiv B2B bayi portalı. Yetkili giriş gerektirir.'
    },
    {
      id: 'src_repxpert',
      name: 'REPXPERT',
      group: 'Türkiye / B2B',
      source_type: 'B2B / Login Required / Catalog',
      is_b2b: true,
      base_url: 'https://www.repxpert.com.tr/tr',
      login_url: 'https://www.repxpert.com.tr/tr/login',
      product_url: 'https://www.repxpert.com.tr/tr/parts-catalog',
      category_url: 'https://www.repxpert.com.tr/tr/parts-catalog',
      search_url_template: 'https://www.repxpert.com.tr/tr/search/results?q={query}',
      active: true,
      priority: 2,
      adapter_name: 'RepxpertAdapter',
      adapter_status: 'LOGIN REQUIRED',
      login_status: 'Login Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 700,
      rate_limit_ms: 800,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'Schaeffler REPXPERT teknik parça kataloğu ve B2B portalı.'
    },
    {
      id: 'src_parcapaketi',
      name: 'Parça Paketi',
      group: 'Türkiye / B2B',
      source_type: 'B2B / Login Required',
      is_b2b: true,
      base_url: 'https://admin.parcapaketi.com/',
      login_url: 'https://admin.parcapaketi.com/',
      product_url: 'https://admin.parcapaketi.com/',
      category_url: 'https://admin.parcapaketi.com/',
      search_url_template: 'https://admin.parcapaketi.com/search?q={query}',
      active: true,
      priority: 2,
      adapter_name: 'ParcaPaketiAdapter',
      adapter_status: 'LOGIN REQUIRED',
      login_status: 'Login Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 700,
      rate_limit_ms: 800,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'Parça Paketi B2B yönetim ve tedarik sistemi. Yetkili giriş gerektirir.'
    },
    {
      id: 'src_basario',
      name: 'Basario Automotive B4B',
      group: 'Türkiye / B2B',
      source_type: 'B2B / Login Required',
      is_b2b: true,
      base_url: 'https://b4b.basariotomotive.com/',
      login_url: 'https://b4b.basariotomotive.com/login',
      product_url: 'https://b4b.basariotomotive.com/',
      category_url: 'https://b4b.basariotomotive.com/',
      search_url_template: 'https://b4b.basariotomotive.com/search?q={query}',
      active: true,
      priority: 2,
      adapter_name: 'BasarioB4BAdapter',
      adapter_status: 'LOGIN REQUIRED',
      login_status: 'Login Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 700,
      rate_limit_ms: 800,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'Basario Automotive B4B bayi sistemi. Yetkili giriş gerektirir.'
    },
    {
      id: 'src_dega',
      name: 'DE-GA Otomotiv (Online Katalog)',
      group: 'Türkiye / B2B',
      source_type: 'Public Web / Catalog',
      is_b2b: false,
      base_url: 'https://www.de-ga.com.tr/urunlerimiz',
      login_url: 'https://b4b.de-ga.com.tr/login',
      product_url: 'https://www.de-ga.com.tr/urunlerimiz',
      category_url: 'https://www.de-ga.com.tr/urunlerimiz',
      search_url_template: 'https://www.de-ga.com.tr/arama?q={query}',
      active: true,
      priority: 2,
      adapter_name: 'DegaAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 500,
      rate_limit_ms: 600,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'DE-GA Otomotiv Türkiye açık online parça kataloğu (/urunlerimiz - 66 araç markası, 1.854 model kategorisi, tüm kaporta/aydınlatma ürünleri ve OEM numaraları).'
    },

    // =========================================================================
    // GRUP 3: GENEL OTOMOTİV & AVRUPA ÜRETİCİ KATALOGLARI (ÖNCELİK 2 & 3)
    // =========================================================================
    {
      id: 'src_isam',
      name: 'I.S.A.M. S.p.A. (İtalya)',
      group: 'Genel Otomotiv',
      source_type: 'Public Web',
      is_b2b: false,
      base_url: 'https://isam.it/en/',
      login_url: null,
      product_url: 'https://isam.it/en/product/',
      category_url: 'https://isam.it/en/catalogue/',
      search_url_template: 'https://isam.it/en/wp-json/wc/store/v1/products?search={query}&per_page=25',
      active: true,
      priority: 2,
      adapter_name: 'IsamAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 450,
      rate_limit_ms: 500,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'İtalya ISAM S.p.A. kaporta/tampon üreticisi. WooCommerce Store API v1 (Tüm araç markaları - 8.231 gerçek ürün + OEM kodu) açık.'
    },
    {
      id: 'src_phira',
      name: 'Phira Componentes (İspanya)',
      group: 'Genel Otomotiv',
      source_type: 'Public Web / Catalog',
      is_b2b: false,
      base_url: 'https://www.phira.es/en/catalog/',
      login_url: 'https://www.phira.es/en/catalog/#login_privada',
      product_url: 'https://www.phira.es/en/ficha?ref=',
      category_url: 'https://www.phira.es/en/catalog/',
      search_url_template: 'https://www.phira.es/en/catalogo?ref={query}',
      active: true,
      priority: 2,
      adapter_name: 'PhiraAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 550,
      rate_limit_ms: 600,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'İspanya Phira tampon & kaporta üreticisi (/en/catalog/ - Tüm 28 araç markası, 179 sayfa / 5.350 gerçek ürün ve OEM referans destekli açık katalog).'
    },
    {
      id: 'src_florimex',
      name: 'Florimex (Polonya)',
      group: 'Genel Otomotiv',
      source_type: 'Public Web / Catalog',
      is_b2b: false,
      base_url: 'http://www.florimex.pl/en/products.html',
      login_url: null,
      product_url: 'http://www.florimex.pl/en/products.html',
      category_url: 'http://www.florimex.pl/en/products.html',
      search_url_template: 'http://www.florimex.pl/index.php?option=com_sobipro&task=search.search&sid=1&sp_search_for={query}',
      active: true,
      priority: 2,
      adapter_name: 'FlorimexAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 550,
      rate_limit_ms: 600,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'Polonya Florimex davlumbaz, çamurluk ve motor alt muhafaza üreticisi (/en/products.html - Tüm 33 araç markası, 67 sayfa / ~1.005 gerçek ürün ve OEM arama destekli açık katalog).'
    },
    {
      id: 'src_prasco',
      name: 'Prasco S.p.A. (İtalya)',
      group: 'Genel Otomotiv',
      source_type: 'Public Web / Catalog',
      is_b2b: false,
      base_url: 'https://www.prasco.net/it-it/catalogo',
      login_url: 'https://www.prasco.net/it-it/profile/login',
      product_url: 'https://www.prasco.net/it-it/catalogo',
      category_url: 'https://www.prasco.net/it-it/catalogo',
      search_url_template: 'https://www.prasco.net/it-it/search?q={query}',
      active: true,
      priority: 2,
      adapter_name: 'PrascoAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 550,
      rate_limit_ms: 600,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'İtalya Prasco S.p.A. kaporta ve dış aksam kataloğu (/it-it/catalogo - Tüm 49 araç markası, 2.655 model kategorisi ve OEM referans destekli açık katalog).'
    },
    {
      id: 'src_onlinecarparts',
      name: 'OnlineCarParts UK',
      group: 'Genel Otomotiv',
      source_type: 'Public Web',
      is_b2b: false,
      base_url: 'https://www.onlinecarparts.co.uk/',
      login_url: null,
      product_url: 'https://www.onlinecarparts.co.uk/car-brands.html',
      category_url: 'https://www.onlinecarparts.co.uk/car-brands.html',
      search_url_template: 'https://www.onlinecarparts.co.uk/spares-search.html?keyword={query}',
      active: true,
      priority: 3,
      adapter_name: 'OnlineCarPartsAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 800,
      rate_limit_ms: 900,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'İngiltere OnlineCarParts.co.uk tüm araç markaları OEM ve çapraz referans parça kataloğu (Cloudflare korumalı).'
    },
    {
      id: 'src_autodoc_uk',
      name: 'AUTODOC UK (autodoc.co.uk)',
      group: 'Genel Otomotiv',
      source_type: 'Public Web',
      is_b2b: false,
      base_url: 'https://www.autodoc.co.uk/',
      login_url: null,
      product_url: 'https://www.autodoc.co.uk/car-parts',
      category_url: 'https://www.autodoc.co.uk/car-parts',
      search_url_template: 'https://www.autodoc.co.uk/spares-search?keyword={query}',
      active: true,
      priority: 3,
      adapter_name: 'AutodocUkAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 800,
      rate_limit_ms: 900,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'AUTODOC İngiltere (autodoc.co.uk) OEM ve çapraz referans kataloğu.'
    },
    {
      id: 'src_autodoc',
      name: 'AUTODOC (autodoc.parts)',
      group: 'Genel Otomotiv',
      source_type: 'Public Web',
      is_b2b: false,
      base_url: 'https://www.autodoc.parts/',
      login_url: null,
      product_url: 'https://www.autodoc.parts/car-parts/',
      category_url: 'https://www.autodoc.parts/',
      search_url_template: 'https://www.autodoc.parts/spares-search?keyword={query}',
      active: true,
      priority: 3,
      adapter_name: 'AutodocAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 800,
      rate_limit_ms: 900,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'AUTODOC genel otomotiv OEM ve çapraz referans kataloğu.'
    },
    {
      id: 'src_dpar',
      name: 'DPAR',
      group: 'Genel Otomotiv',
      source_type: 'Public Web',
      is_b2b: false,
      base_url: 'https://www.dpar.com.tr/searchproduct',
      login_url: 'https://www.dpar.com.tr/login',
      product_url: 'https://www.dpar.com.tr/',
      category_url: 'https://www.dpar.com.tr/',
      search_url_template: 'https://www.dpar.com.tr/searchproduct?q={query}',
      active: true,
      priority: 3,
      adapter_name: 'DparAdapter',
      adapter_status: 'NOT ANALYZED',
      login_status: 'Not Required',
      last_analysis_date: null,
      last_successful_scan: null,
      last_error: null,
      product_count: 0,
      request_delay_ms: 700,
      rate_limit_ms: 800,
      timeout_ms: 15000,
      retry_count: 2,
      analysis_report: null,
      test_scan_report: null,
      test_approved: false,
      notes: 'DPAR Türkiye yedek parça arama kaynağı.'
    }
  ];

  function nowTimestamp() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  function canonicalizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    return url.trim().replace(/\/+$/, '').toLowerCase();
  }

  /**
   * Bölüm 51: Veri Doğrulama
   * Bir ürün database'e yazılmadan önce en azından:
   * - gerçek source URL
   * - gerçek source identifier (source_id)
   * - ürün adı veya ürün kodu
   * - demo/mock/placeholder kelimesi içermemesi
   * kontrol edilir.
   */
  function validateRealProduct(rawProd) {
    if (!rawProd || typeof rawProd !== 'object') return false;
    const sourceId = rawProd.source_id || rawProd.source;
    const prodUrl = rawProd.source_product_url || rawProd.product_url;
    const prodName = (rawProd.product_name || '').trim();
    const prodCode = (rawProd.product_code || '').trim();

    if (!sourceId) return false;
    if (!prodUrl || !/^https?:\/\//i.test(prodUrl)) return false;
    if (!prodName && !prodCode) return false;

    // Yasaklı mock/demo/temsili ürün isimlerini kesinlikle reddet (Bölüm 1, 6, 49, 50)
    const forbiddenPattern = /\b(demo product|test product|örnek ürün|temsili ürün|vw part example|placeholder|mock product|sample product)\b/i;
    if (forbiddenPattern.test(prodName)) return false;

    return true;
  }

  /**
   * Bölüm 13, 14, 15, 19, 38, 39, 41:
   * Gerçek ürünü `source_products` tablosuna ekler veya günceller (Duplicate oluşturmaz).
   * Fiyat ve stok verisini ayrı tablolarda (`product_prices` ve `product_stock_history`)
   * yalnızca değişiklik olduğunda history kaydı olarak saklar.
   */
  function upsertRealProduct(db, rawProd, dataOrigin = 'Catalog') {
    if (!validateRealProduct(rawProd)) {
      return { action: 'rejected', product: null };
    }

    const ts = nowTimestamp();
    const sourceId = rawProd.source_id;
    const extId = rawProd.source_product_id || rawProd.external_id || null;
    const rawUrl = rawProd.source_product_url || rawProd.product_url;
    const canonUrl = canonicalizeUrl(rawUrl);

    // Bölüm 39: Duplicate önleme
    // 1. Öncelik: source_id + source_product_id
    // 2. Öncelik: source_id + canonical_product_url
    let existing = null;
    if (extId) {
      existing = db.source_products.find(p => p.source_id === sourceId && String(p.source_product_id) === String(extId));
    }
    if (!existing && canonUrl) {
      existing = db.source_products.find(p => p.source_id === sourceId && canonicalizeUrl(p.source_product_url || p.product_url) === canonUrl);
    }

    const normOem = rawProd.normalized_oem || window.OEMEngine.normalizeSingleOEM(rawProd.oem_number || '');
    const pubPrice = rawProd.public_price !== undefined && rawProd.public_price !== null
      ? Number(rawProd.public_price)
      : (rawProd.price !== undefined && rawProd.price !== null ? Number(rawProd.price) : null);
    const b2bPrice = rawProd.b2b_price !== undefined && rawProd.b2b_price !== null ? Number(rawProd.b2b_price) : null;
    const oldPrice = rawProd.old_price !== undefined && rawProd.old_price !== null ? Number(rawProd.old_price) : null;
    const currency = rawProd.currency || 'EUR';
    const stockStatus = rawProd.stock_status || null;
    // Bölüm 11 & 15: Miktar açıkça verilmiyorsa kesinlikle NULL kalmalı
    const stockQty = (rawProd.stock_quantity !== undefined && rawProd.stock_quantity !== null && rawProd.stock_quantity !== '')
      ? Number(rawProd.stock_quantity)
      : null;

    let action = 'inserted';
    let priceChanged = false;
    let stockChanged = false;
    let targetProd = null;

    if (existing) {
      action = 'unchanged';
      if (
        existing.product_name !== rawProd.product_name ||
        existing.oem_number !== rawProd.oem_number ||
        existing.brand !== rawProd.brand ||
        existing.description !== rawProd.description
      ) {
        action = 'updated';
      }

      existing.product_name = rawProd.product_name || existing.product_name;
      existing.brand = rawProd.brand ?? existing.brand;
      existing.product_code = rawProd.product_code ?? existing.product_code;
      existing.competitor_part_number = rawProd.competitor_part_number ?? existing.competitor_part_number;
      existing.oem_number = rawProd.oem_number ?? existing.oem_number;
      existing.normalized_oem = normOem || existing.normalized_oem;
      existing.description = rawProd.description ?? existing.description;
      existing.compatibility = rawProd.compatibility ?? existing.compatibility;
      existing.model = rawProd.model ?? existing.model;
      existing.year = rawProd.year ?? existing.year;
      existing.category = rawProd.category ?? existing.category;
      existing.subcategory = rawProd.subcategory ?? existing.subcategory;
      existing.image_url = rawProd.image_url ?? existing.image_url;
      existing.product_url = rawUrl || existing.product_url;
      existing.source_product_url = rawUrl || existing.source_product_url;
      existing.last_seen = ts;
      existing.last_checked = ts;
      existing.fetched_at = ts;
      existing.data_origin = dataOrigin;
      existing.archived = false;

      targetProd = existing;
    } else {
      const newId = `sp_${sourceId}_${extId || Date.now() + '_' + Math.floor(Math.random() * 10000)}`;
      targetProd = {
        id: newId,
        source_id: sourceId,
        source: rawProd.source_name || sourceId,
        source_name: rawProd.source_name || sourceId,
        source_type: rawProd.source_type || 'Public Web',
        source_product_id: extId ? String(extId) : newId,
        source_product_url: rawUrl,
        product_url: rawUrl,
        product_name: rawProd.product_name,
        brand: rawProd.brand || null,
        product_code: rawProd.product_code || null,
        competitor_part_number: rawProd.competitor_part_number || null,
        oem_number: rawProd.oem_number || null,
        normalized_oem: normOem || '',
        cross_reference_numbers: Array.isArray(rawProd.cross_reference_numbers) ? rawProd.cross_reference_numbers : [],
        description: rawProd.description || null,
        compatibility: rawProd.compatibility || null,
        model: rawProd.model || null,
        year: rawProd.year || null,
        category: rawProd.category || null,
        subcategory: rawProd.subcategory || null,
        image_url: rawProd.image_url || null,
        price: pubPrice,
        public_price: pubPrice,
        old_price: oldPrice,
        b2b_price: b2bPrice,
        currency: currency,
        price_type: b2bPrice !== null ? 'B2B Price' : 'Public Price',
        stock_status: stockStatus,
        stock_quantity: stockQty,
        first_seen: ts,
        last_seen: ts,
        last_checked: ts,
        last_price_check: ts,
        last_stock_check: ts,
        fetched_at: ts,
        search_count: 0,
        data_origin: dataOrigin,
        adapter_name: rawProd.adapter_name || null,
        archived: false
      };
      db.source_products.push(targetProd);
    }

    // Bölüm 13 & 14: Fiyat Geçmişi (Yalnızca fiyat değiştiğinde veya ilk kayıtta yeni satır ekle)
    const prodPrices = db.product_prices.filter(pp => pp.product_id === targetProd.id);
    const latestPriceRec = prodPrices.length > 0 ? prodPrices[prodPrices.length - 1] : null;
    targetProd.last_price_check = ts;

    if (pubPrice !== null || b2bPrice !== null) {
      if (
        !latestPriceRec ||
        latestPriceRec.public_price !== pubPrice ||
        latestPriceRec.b2b_price !== b2bPrice ||
        latestPriceRec.currency !== currency
      ) {
        if (latestPriceRec) priceChanged = true;
        db.product_prices.push({
          id: 'prc_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
          product_id: targetProd.id,
          source_id: sourceId,
          source_name: targetProd.source_name,
          product_name: targetProd.product_name,
          public_price: pubPrice,
          old_price: oldPrice,
          b2b_price: b2bPrice,
          currency: currency,
          price_type: b2bPrice !== null ? 'B2B Price' : 'Public Price',
          recorded_at: ts
        });
      }
      targetProd.price = pubPrice;
      targetProd.public_price = pubPrice;
      targetProd.old_price = oldPrice;
      targetProd.b2b_price = b2bPrice;
      targetProd.currency = currency;
    }

    // Bölüm 13 & 15: Stok Geçmişi (Yalnızca stok durumu veya miktarı değiştiğinde yeni satır ekle)
    const prodStocks = db.product_stock_history.filter(ps => ps.product_id === targetProd.id);
    const latestStockRec = prodStocks.length > 0 ? prodStocks[prodStocks.length - 1] : null;
    targetProd.last_stock_check = ts;

    if (stockStatus !== null) {
      if (
        !latestStockRec ||
        latestStockRec.stock_status !== stockStatus ||
        latestStockRec.stock_quantity !== stockQty
      ) {
        if (latestStockRec) stockChanged = true;
        db.product_stock_history.push({
          id: 'stk_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
          product_id: targetProd.id,
          source_id: sourceId,
          source_name: targetProd.source_name,
          product_name: targetProd.product_name,
          stock_status: stockStatus,
          stock_quantity: stockQty,
          recorded_at: ts
        });
      }
      targetProd.stock_status = stockStatus;
      targetProd.stock_quantity = stockQty;
    }

    // Çapraz Referansları Güncelle
    syncProductCrossReferences(db, targetProd);

    // Kaynak ürün sayısını güncelle
    const src = db.sources.find(s => s.id === sourceId);
    if (src) {
      src.product_count = db.source_products.filter(p => p.source_id === sourceId && !p.archived).length;
    }

    return {
      action,
      priceChanged,
      stockChanged,
      product: targetProd
    };
  }

  function syncProductCrossReferences(db, p) {
    const parsed = window.OEMEngine.parseOEMList(p.oem_number || '');
    const extracted = window.OEMEngine.extractCodesFromText(p.description || '');
    const allOems = new Set(parsed.allNormalized);
    if (p.normalized_oem) allOems.add(p.normalized_oem);
    if (extracted.oem) {
      window.OEMEngine.parseOEMList(extracted.oem).allNormalized.forEach(c => allOems.add(c));
    }

    const altCodes = new Set();
    if (p.product_code) altCodes.add(p.product_code);
    if (p.competitor_part_number) altCodes.add(p.competitor_part_number);
    if (extracted.vwccCode) altCodes.add(extracted.vwccCode);
    extracted.extraCodes.forEach(c => altCodes.add(c));

    allOems.forEach(normOem => {
      if (!normOem) return;
      altCodes.forEach(alt => {
        const altNorm = window.OEMEngine.normalizeSingleOEM(alt);
        if (altNorm && altNorm !== normOem) {
          const exists = db.product_cross_references.some(
            x => x.product_id === p.id && x.normalized_oem === normOem && x.alt_part_normalized === altNorm
          );
          if (!exists) {
            db.product_cross_references.push({
              id: 'xref_' + (db.product_cross_references.length + 1),
              product_id: p.id,
              source_id: p.source_id,
              source_name: p.source_name,
              oem_number: p.oem_number || normOem,
              normalized_oem: normOem,
              alternative_part_number: alt,
              alt_part_normalized: altNorm,
              brand: p.brand || '-',
              relation_type: 'OEM ↔ Üretici / Rakip Kodu'
            });
          }
        }
      });
    });
  }

  /**
   * Bölüm 20: 180 gün görülmeyen ürünleri silmeden Archived olarak işaretle
   */
  function markStaleProductsArchived(db, daysThreshold = 180) {
    const cutoffMs = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;
    let count = 0;
    db.source_products.forEach(p => {
      if (!p.archived && p.last_seen) {
        const seenTime = Date.parse(p.last_seen.replace(' ', 'T'));
        if (!isNaN(seenTime) && seenTime < cutoffMs) {
          p.archived = true;
          count++;
        }
      }
    });
    return count;
  }

  /**
   * Bölüm 1, 30, 46, 50:
   * Production veritabanı tamamen BOŞ başlar (0 ürün).
   */
  function getInitialDatabase() {
    return {
      sources: JSON.parse(JSON.stringify(DEFAULT_SOURCES)),
      source_products: [],
      product_cross_references: [],
      product_prices: [],
      product_stock_history: [],
      scan_jobs: [],
      scan_job_items: [],
      search_logs: [],
      source_errors: [],
      secure_sessions: {},
      weekly_update: {
        ready: true,
        auto_start: false,
        last_run: null,
        scopes: {
          prices: true,
          stocks: true,
          new_products: true,
          product_info: false,
          descriptions: false,
          images: false
        }
      }
    };
  }

  return {
    DEFAULT_SOURCES,
    getInitialDatabase,
    validateRealProduct,
    upsertRealProduct,
    syncProductCrossReferences,
    markStaleProductsArchived,
    nowTimestamp,
    canonicalizeUrl
  };
})();
