// Source validation layer loaded after fixes.js.
// Municipal naming-guide data outranks generic Wikidata P138 output for Tel Aviv streets.

(function () {
  if (typeof fetchAutomaticHistory !== 'function') return;

  const previousFetchAutomaticHistory = fetchAutomaticHistory;

  function isUsefulText(value) {
    const text = String(value || '').trim();
    return Boolean(text) && !text.includes('לא נמצא') && !text.includes('עדיין לא');
  }

  function uniqueSourceItems(items) {
    const seen = new Set();
    return (items || []).filter(item => {
      if (!item) return false;
      const key = typeof item === 'string' ? item : `${item.url || ''}|${item.label || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normalizeTokenText(value) {
    return String(value || '')
      .replace(/["׳״'־-]/g, ' ')
      .replace(/^(רחוב|שדרות|שדרה|דרך|סמטת|סמטה)\s+/u, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function streetKeywords(street) {
    const base = normalizeTokenText(street);
    return base.split(' ').filter(token => token.length >= 2);
  }

  // Generic safeguard for Wikidata P138: when several "named after" entities are returned,
  // keep only the entity whose label actually matches the street name. This prevents cases
  // such as "מנחם בגין, פתח תקווה" for a search for בגין.
  function sanitizeWikidataOrigin(origin, street) {
    const text = String(origin || '').trim();
    const prefix = 'לפי Wikidata, הרחוב נקרא על שם ';
    if (!text.startsWith(prefix)) return text;

    const body = text.slice(prefix.length).replace(/[.]\s*$/u, '');
    const candidates = body.split(',').map(part => part.trim()).filter(Boolean);
    if (candidates.length <= 1) return text;

    const keywords = streetKeywords(street);
    if (!keywords.length) return text;

    const matching = candidates.filter(candidate => {
      const normalized = normalizeTokenText(candidate);
      return keywords.some(keyword => normalized.includes(keyword));
    });

    if (matching.length === 1) {
      return `${prefix}${matching[0]}.`;
    }

    // If Wikidata is ambiguous and we cannot identify one matching namesake safely,
    // do not present a potentially wrong namesake as fact.
    if (matching.length === 0) {
      return 'לא נמצא ב-Wikidata שדה חד-משמעי המציין על שם מי נקרא הרחוב.';
    }

    return `${prefix}${matching.join(', ')}.`;
  }

  fetchAutomaticHistory = async function(street, city) {
    const combined = await previousFetchAutomaticHistory(street, city);

    if (combined?.origin) {
      combined.origin = sanitizeWikidataOrigin(combined.origin, street);
    }

    // Outside Tel Aviv, keep the existing generic pipeline unchanged apart from the
    // Wikidata ambiguity safeguard above.
    if (typeof isTelAvivCity !== 'function' || !isTelAvivCity(city)) return combined;
    if (typeof fetchMunicipalGuideHistory !== 'function') return combined;

    let municipal = null;
    try {
      municipal = await fetchMunicipalGuideHistory(street, city);
    } catch (error) {
      console.warn('Municipal validation failed:', error);
    }

    if (!municipal) return combined;

    // The municipal street guide is specifically about the naming of Tel Aviv streets,
    // so its namesake/origin text is safer than a broad Wikidata P138 result.
    return {
      ...(combined || {}),
      origin: isUsefulText(municipal.origin) ? municipal.origin : combined?.origin,
      foundedYear: municipal.foundedYear || combined?.foundedYear || null,
      namedYear: municipal.namedYear || combined?.namedYear || null,
      formerNames: municipal.formerNames?.length
        ? municipal.formerNames
        : (combined?.formerNames || []),
      description: isUsefulText(municipal.description)
        ? municipal.description
        : combined?.description,
      sources: uniqueSourceItems([
        ...(municipal.sources || []),
        ...(combined?.sources || [])
      ]),
      automatic: true,
      municipalGuide: true,
      sourceValidated: true
    };
  };
})();
