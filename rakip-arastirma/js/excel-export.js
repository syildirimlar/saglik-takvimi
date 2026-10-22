/**
 * Excel (.xlsx / SpreadsheetML) ve CSV Aktarım Modülü (Bölüm 34 & 44)
 * GÜVENLİK KURALI:
 *  Excel çıktısına kesinlikle kullanıcı şifresi, cookie, session token,
 *  OTP, MFA bilgisi, authentication secret veya API secret aktarılmaz.
 */

window.ExcelExporter = (function () {
  // Bölüm 34'te istenen 23 zorunlu kolon
  const EXPORT_COLUMNS = [
    { header: 'Source', key: 'source_name', width: 150 },
    { header: 'Source Type', key: 'source_type', width: 130 },
    { header: 'Product Name', key: 'product_name', width: 250 },
    { header: 'Brand', key: 'brand', width: 110 },
    { header: 'Product Code', key: 'product_code', width: 110 },
    { header: 'OEM', key: 'oem_number', width: 130 },
    { header: 'Normalized OEM', key: 'normalized_oem', width: 130 },
    { header: 'Competitor Part Number', key: 'competitor_part_number', width: 145 },
    { header: 'Description', key: 'description', width: 300 },
    { header: 'Compatibility', key: 'compatibility', width: 220 },
    { header: 'Category', key: 'category_full', width: 150 },
    { header: 'Stock Status', key: 'stock_status', width: 100 },
    { header: 'Stock Quantity', key: 'stock_quantity', width: 100 },
    { header: 'Public Price', key: 'public_price', width: 100 },
    { header: 'B2B Price', key: 'b2b_price', width: 100 },
    { header: 'Currency', key: 'currency', width: 75 },
    { header: 'Price Type', key: 'price_type', width: 130 },
    { header: 'Image URL', key: 'image_url', width: 210 },
    { header: 'Product URL', key: 'product_url', width: 230 },
    { header: 'Match Confidence', key: 'match_confidence', width: 120 },
    { header: 'First Seen', key: 'first_seen', width: 135 },
    { header: 'Last Seen', key: 'last_seen', width: 135 },
    { header: 'Last Checked', key: 'last_checked', width: 135 }
  ];

  // Yasaklı güvenlik alanları (Bölüm 34 & 44 - kesinlikle dışa aktarılmaz)
  const FORBIDDEN_KEYS = new Set([
    'username', 'user', 'password', 'pass', 'pwd', 'encrypted_password',
    'sms', 'sms_code', 'otp', 'otp_code', 'mfa', 'mfa_code', 'captcha', 'captcha_token',
    'cookie', 'cookies', 'session', 'session_token', 'token', 'auth_token',
    'auth_secret', 'authentication_secret', 'api_key', 'api_secret', 'credentials'
  ]);

  function sanitizeRow(rawRow) {
    const clean = {};
    for (const [k, v] of Object.entries(rawRow || {})) {
      if (FORBIDDEN_KEYS.has(k.toLowerCase())) continue;
      clean[k] = v;
    }

    const catFull = [clean.category, clean.subcategory].filter(Boolean).join(' > ');
    const pubPrice = clean.public_price !== undefined && clean.public_price !== null
      ? clean.public_price
      : clean.price;
    const priceType = clean.b2b_price !== null && clean.b2b_price !== undefined
      ? (clean.price_type || 'B2B Price')
      : (clean.price_type || 'Public Price');

    return {
      source_name: clean.source_name || clean.source || '',
      source_type: clean.source_type ?? '',
      product_name: clean.product_name ?? '',
      brand: clean.brand ?? '',
      product_code: clean.product_code ?? '',
      oem_number: clean.oem_number ?? '',
      normalized_oem: clean.normalized_oem ?? '',
      competitor_part_number: clean.competitor_part_number ?? '',
      description: clean.description ?? '',
      compatibility: clean.compatibility ?? '',
      category_full: catFull || '',
      stock_status: clean.stock_status ?? '',
      stock_quantity: clean.stock_quantity !== null && clean.stock_quantity !== undefined ? clean.stock_quantity : '',
      public_price: pubPrice !== null && pubPrice !== undefined ? pubPrice : '',
      b2b_price: clean.b2b_price !== null && clean.b2b_price !== undefined ? clean.b2b_price : '',
      currency: clean.currency ?? '',
      price_type: priceType,
      image_url: clean.image_url ?? '',
      product_url: clean.product_url || clean.source_product_url || '',
      match_confidence: clean.match_confidence ?? 'Exact',
      first_seen: clean.first_seen || clean.fetched_at || clean.last_checked || '',
      last_seen: clean.last_seen || clean.last_checked || '',
      last_checked: clean.last_checked || clean.fetched_at || ''
    };
  }

  function escapeXml(val) {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function exportToExcel(rows, filenamePrefix = 'VW_Arastirma_Sonuclari') {
    if (!Array.isArray(rows) || rows.length === 0) {
      alert('Dışa aktarılacak gerçek ürün sonucu bulunamadı.');
      return;
    }

    const sanitizedRows = rows.map(sanitizeRow);
    const dateStamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    if (typeof window.XLSX !== 'undefined') {
      const sheetData = [
        EXPORT_COLUMNS.map(c => c.header),
        ...sanitizedRows.map(r => EXPORT_COLUMNS.map(c => r[c.key]))
      ];
      const ws = window.XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = EXPORT_COLUMNS.map(c => ({ wpx: c.width }));
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Arastirma_Sonuclari');
      window.XLSX.writeFile(wb, `${filenamePrefix}_${dateStamp}.xlsx`);
      return;
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n`;
    xml += `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n`;
    xml += `<Styles>
      <Style ss:ID="Header">
        <Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/>
        <Interior ss:Color="#1E3A8A" ss:Pattern="Solid"/>
      </Style>
      <Style ss:ID="Default">
        <Alignment ss:Vertical="Center"/>
      </Style>
      <Style ss:ID="Price">
        <NumberFormat ss:Format="#,##0.00"/>
      </Style>
    </Styles>\n`;
    xml += `<Worksheet ss:Name="Arastirma_Sonuclari">\n<Table>\n`;

    EXPORT_COLUMNS.forEach(c => {
      xml += `<Column ss:Width="${c.width}"/>\n`;
    });

    xml += `<Row ss:Height="24">\n`;
    EXPORT_COLUMNS.forEach(c => {
      xml += `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(c.header)}</Data></Cell>\n`;
    });
    xml += `</Row>\n`;

    sanitizedRows.forEach(r => {
      xml += `<Row>\n`;
      EXPORT_COLUMNS.forEach(c => {
        const val = r[c.key];
        const isNum = (c.key === 'public_price' || c.key === 'b2b_price' || c.key === 'stock_quantity') && val !== '' && !isNaN(Number(val));
        if (isNum) {
          xml += `<Cell ss:StyleID="${c.key === 'stock_quantity' ? 'Default' : 'Price'}"><Data ss:Type="Number">${Number(val)}</Data></Cell>\n`;
        } else {
          xml += `<Cell ss:StyleID="Default"><Data ss:Type="String">${escapeXml(val)}</Data></Cell>\n`;
        }
      });
      xml += `</Row>\n`;
    });

    xml += `</Table>\n</Worksheet>\n</Workbook>`;

    const blob = new Blob(['\uFEFF' + xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}_${dateStamp}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportToCSV(rows, filenamePrefix = 'VW_Arastirma_Sonuclari') {
    if (!Array.isArray(rows) || rows.length === 0) {
      alert('Dışa aktarılacak gerçek veri bulunamadı.');
      return;
    }

    const sanitizedRows = rows.map(sanitizeRow);
    const dateStamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    const escapeCsvCell = (val) => {
      if (val === null || val === undefined) return '""';
      const s = String(val).replace(/"/g, '""').replace(/\r?\n/g, ' ');
      return `"${s}"`;
    };

    const headerLine = EXPORT_COLUMNS.map(c => escapeCsvCell(c.header)).join(';');
    const dataLines = sanitizedRows.map(r =>
      EXPORT_COLUMNS.map(c => escapeCsvCell(r[c.key])).join(';')
    );

    const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}_${dateStamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    EXPORT_COLUMNS,
    exportToExcel,
    exportToCSV,
    sanitizeRow
  };
})();
