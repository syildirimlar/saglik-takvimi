/**
 * OEM Normalizasyon, Eşleşme Güven Seviyesi (Match Confidence) ve
 * Çapraz Referans (Cross-Reference) Motoru (Bölüm 9 & 10)
 *
 * Eşleşme Önceliği:
 *  1. Exact OEM -> Exact
 *  2. Exact competitor part number -> High
 *  3. Exact product code -> High
 *  4. Cross-reference -> High
 *  5. Brand + product code / OEM root -> Medium
 *  6. Ürün adı + araç uyumluluğu -> Low (Yalnızca benzer isim taşıyor diye yüksek güven verilmez)
 */

window.OEMEngine = (function () {
  const EXCHANGE_RATES_TO_EUR = {
    EUR: 1.0,
    USD: 0.862,
    TRY: 1 / 58.0,
    TL: 1 / 58.0,
    GBP: 1.17
  };

  /**
   * Tek bir OEM kodunu normalize eder:
   * "111201635", "111 201 635", "111-201-635", "111.201.635" -> "111201635"
   */
  function normalizeSingleOEM(raw) {
    if (!raw || typeof raw !== 'string') return '';
    return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  /**
   * Çoklu OEM içeren metinlerden birincil normalize OEM'i ve tüm alternatif parça kodlarını ayıklar.
   */
  function parseOEMList(rawOemString) {
    if (!rawOemString || typeof rawOemString !== 'string') {
      return { primaryOriginal: null, primaryNormalized: '', allOriginal: [], allNormalized: [] };
    }
    const parts = rawOemString
      .split(/[,\/;]+|\s+\/\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    const validParts = [];
    const normParts = [];

    for (const p of parts) {
      const cleaned = p.replace(/^(OEM|VWC|VWCC|JP|EMPI|Febi|Bosch|No|Parça No|Part No)[:\.\s\-]*/i, '').trim();
      const norm = normalizeSingleOEM(cleaned);
      // 13 haneli saf sayısal EAN-13 barkodlarını OEM olarak alma
      if (/^(402781|316514|869)\d{10}$/.test(norm)) {
        continue;
      }
      if (norm.length >= 4) {
        validParts.push(cleaned);
        if (!normParts.includes(norm)) {
          normParts.push(norm);
        }
      }
    }

    return {
      primaryOriginal: validParts.length > 0 ? validParts[0] : rawOemString.trim(),
      primaryNormalized: normParts.length > 0 ? normParts[0] : normalizeSingleOEM(rawOemString),
      allOriginal: validParts,
      allNormalized: normParts
    };
  }

  /**
   * VW Klasik OEM kök numarası (İlk 9 rakam: Örn "311415811C" -> "311415811")
   */
  function getVWOemRoot(normalizedOem) {
    if (!normalizedOem) return '';
    const m = normalizedOem.match(/^([0-9A-Z]{3}[0-9]{6})[A-Z]{0,3}$/);
    return m ? m[1] : '';
  }

  /**
   * Açıklama metninden yalnızca açıkça yazılmış OEM ve çapraz referans kodlarını çıkarır.
   * Kesinlikle tahmin yürütmez.
   */
  function extractCodesFromText(text) {
    if (!text || typeof text !== 'string') {
      return { oem: null, vwccCode: null, extraCodes: [] };
    }
    let oem = null;
    let vwccCode = null;
    const extraCodes = [];

    const oemMatch = text.match(/(?:OEM|Ref\.?|Reference|Original)\s*(?:Par[^\s:]*\s*No|Part\s*No|Number|No|Kodu)?\s*[:\-]\s*([A-Z0-9\-\.\/\s,]+?)(?=\s+(?:JP|AYD|EMPI|Febi|Bosch|Hellux|FC|VWC|VWCC|Bu\s|Tüm\s|Klasik|Üstün|Fonksiyon|Karbüratör|Sert|Adet|ISO|$))/i);
    if (oemMatch && oemMatch[1]) {
      oem = oemMatch[1].trim().replace(/[,\/\-\s]+$/, '');
    }

    const vwccMatch = text.match(/VWC{1,2}\s*(?:Par[^\s:]*\s*No|Part\s*No|No)?\s*[:\-]\s*([A-Z0-9\-\.\/\(\)\s]+?)(?=\s+(?:OEM|JP|EMPI|Febi|$))/i);
    if (vwccMatch && vwccMatch[1]) {
      vwccCode = vwccMatch[1].trim().replace(/[,\/\-\s]+$/, '');
    }

    const brandCodeRegex = /(?:JP(?:\s*Group)?|EMPI|Febi|Bosch|AYD|Hellux|FC|Meyle|VDO)\s*(?:Par[^\s:]*\s*No|Part\s*No|No)?\s*[:\.\-]\s*([A-Z0-9\-\.]+)/gi;
    let bm;
    while ((bm = brandCodeRegex.exec(text)) !== null) {
      if (bm[1] && bm[1].length >= 4) {
        extraCodes.push(bm[1].trim());
      }
    }

    return { oem, vwccCode, extraCodes };
  }

  /**
   * Eşleşme Güven Seviyesi (Bölüm 9 & 10):
   * - "Exact": Normalize OEM birebir eşleşti
   * - "High": Exact competitor part number, Exact product code, Cross-reference veya 9 haneli VW OEM kökü eşleşmesi
   * - "Medium": Brand + product code veya kısmi OEM / kod eşleşmesi
   * - "Low": Ürün adı + araç uyumluluğu eşleşmesi
   */
  function calculateMatchConfidence(query, product, crossRefsForProduct) {
    if (!query || !query.trim()) {
      return { level: 'Exact', score: 100, reason: 'Katalog Kaydı' };
    }

    const rawQ = query.trim();
    const normQ = normalizeSingleOEM(rawQ);
    const prodNormOem = product.normalized_oem || normalizeSingleOEM(product.oem_number || '');
    const prodCodeNorm = normalizeSingleOEM(product.product_code || '');
    const compCodeNorm = normalizeSingleOEM(product.competitor_part_number || '');

    const parsedOems = parseOEMList(product.oem_number || '');
    const allNormOems = new Set(parsedOems.allNormalized);
    if (prodNormOem) allNormOems.add(prodNormOem);

    const crossRefSet = new Set();
    if (Array.isArray(product.cross_reference_numbers)) {
      product.cross_reference_numbers.forEach(c => {
        const cn = normalizeSingleOEM(String(c));
        if (cn) crossRefSet.add(cn);
      });
    }
    if (Array.isArray(crossRefsForProduct)) {
      crossRefsForProduct.forEach(cr => {
        if (cr.normalized_oem) allNormOems.add(cr.normalized_oem);
        if (cr.alt_part_normalized) crossRefSet.add(cr.alt_part_normalized);
      });
    }

    // 1. ÖNCELİK: Exact OEM -> "Exact"
    if (normQ.length >= 5 && allNormOems.has(normQ)) {
      return {
        level: 'Exact',
        score: 100,
        reason: `1. Öncelik: Exact OEM eşleşmesi (${normQ})`
      };
    }

    if (normQ.length >= 4) {
      // 2. ÖNCELİK: Exact Competitor Part Number -> "High"
      if (compCodeNorm && compCodeNorm === normQ) {
        return {
          level: 'High',
          score: 90,
          reason: `2. Öncelik: Exact Competitor Part Number (${product.competitor_part_number})`
        };
      }

      // 3. ÖNCELİK: Exact Product Code -> "High"
      if (prodCodeNorm && prodCodeNorm === normQ) {
        return {
          level: 'High',
          score: 88,
          reason: `3. Öncelik: Exact Product Code (${product.product_code})`
        };
      }

      // 4. ÖNCELİK: Cross-Reference -> "High"
      if (crossRefSet.has(normQ)) {
        return {
          level: 'High',
          score: 85,
          reason: `4. Öncelik: Cross-Reference eşleşmesi (${normQ})`
        };
      }

      // VW 9-Haneli OEM Kök Eşleşmesi -> "High"
      const qRoot = getVWOemRoot(normQ);
      for (const candidate of allNormOems) {
        const cRoot = getVWOemRoot(candidate);
        if (qRoot && cRoot && qRoot === cRoot) {
          return {
            level: 'High',
            score: 84,
            reason: `OEM Kök Kodu eşleşmesi (${qRoot} ↔ ${candidate})`
          };
        }
      }

      // 5. ÖNCELİK: Brand + Product Code veya Kısmi Kod -> "Medium"
      for (const candidate of allNormOems) {
        if (candidate.includes(normQ) || normQ.includes(candidate)) {
          return {
            level: 'Medium',
            score: 68,
            reason: `5. Öncelik: Kısmi OEM eşleşmesi (${candidate})`
          };
        }
      }
      if ((prodCodeNorm && prodCodeNorm.includes(normQ)) || (compCodeNorm && compCodeNorm.includes(normQ))) {
        return {
          level: 'Medium',
          score: 62,
          reason: `5. Öncelik: Marka / Ürün Kodu kısmi eşleşmesi`
        };
      }
    }

    // 6. ÖNCELİK: Ürün adı + araç uyumluluğu
    const qWords = rawQ.toLocaleLowerCase('tr-TR').split(/\s+/).filter(w => w.length >= 2);
    const nameLower = (product.product_name || '').toLocaleLowerCase('tr-TR');
    const compatLower = (product.compatibility || '').toLocaleLowerCase('tr-TR');
    const brandLower = (product.brand || '').toLocaleLowerCase('tr-TR');

    let matchedName = 0;
    let matchedCompatOrBrand = 0;
    for (const w of qWords) {
      if (nameLower.includes(w)) matchedName++;
      if (compatLower.includes(w) || brandLower.includes(w)) matchedCompatOrBrand++;
    }

    if (qWords.length >= 2 && matchedName >= 1 && matchedCompatOrBrand >= 1) {
      return {
        level: 'Medium',
        score: 58,
        reason: '6. Öncelik: Ürün adı + araç uyumluluğu / marka eşleşmesi'
      };
    }

    return {
      level: 'Low',
      score: 30,
      reason: 'Yalnızca metin / isim benzerliği (OEM doğrulaması önerilir)'
    };
  }

  /**
   * Bir ürünün aranan sorgu (OEM / ürün kodu / parça adı) ile eşleşip eşleşmediğini
   * ve eşleşme güven seviyesini (Exact, High, Medium, Low) döndürür.
   */
  function evaluateMatchConfidence(query, product, allCrossRefs) {
    if (!query || !query.trim() || !product) {
      return { matched: false, level: 'Low', score: 0, reason: '' };
    }

    const prodCrossRefs = Array.isArray(allCrossRefs)
      ? allCrossRefs.filter(x => !x.product_id || x.product_id === product.id)
      : [];

    const res = calculateMatchConfidence(query, product, prodCrossRefs);
    if (res.score >= 58) {
      return {
        matched: true,
        level: res.level,
        score: res.score,
        reason: res.reason
      };
    }

    // Düşük güvenli metin / açıklama eşleşmesi kontrolü
    const rawQ = query.trim().toLocaleLowerCase('tr-TR');
    const normQ = normalizeSingleOEM(query);
    const haystack = [
      product.product_name || '',
      product.description || '',
      product.compatibility || '',
      product.brand || '',
      product.product_code || '',
      product.oem_number || '',
      product.competitor_part_number || ''
    ].join(' ').toLocaleLowerCase('tr-TR');

    const normHaystack = normalizeSingleOEM(
      [product.oem_number || '', product.product_code || '', product.competitor_part_number || '', product.description || ''].join(' ')
    );

    if ((rawQ.length >= 3 && haystack.includes(rawQ)) || (normQ.length >= 5 && normHaystack.includes(normQ))) {
      return {
        matched: true,
        level: 'Low',
        score: 35,
        reason: res.reason
      };
    }

    return {
      matched: false,
      level: res.level,
      score: 0,
      reason: ''
    };
  }

  function toEurEquivalent(amount, currency) {
    if (amount === null || amount === undefined || isNaN(Number(amount)) || Number(amount) <= 0) {
      return null;
    }
    const curr = (currency || 'EUR').toUpperCase().trim();
    const rate = EXCHANGE_RATES_TO_EUR[curr] || 1.0;
    return Math.round(Number(amount) * rate * 100) / 100;
  }

  return {
    normalizeSingleOEM,
    parseOEMList,
    getVWOemRoot,
    extractCodesFromText,
    calculateMatchConfidence,
    evaluateMatchConfidence,
    toEurEquivalent
  };
})();

