// Source validation and priority layer loaded after fixes.js.
// For Tel Aviv streets: municipal naming guide first, Wikipedia/Wikidata only as fallback.

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

    if (matching.length === 1) return `${prefix}${matching[0]}.`;
    if (matching.length === 0) return 'לא נמצא ב-Wikidata שדה חד-משמעי המציין על שם מי נקרא הרחוב.';
    return `${prefix}${matching.join(', ')}.`;
  }

  function municipalIsComplete(municipal) {
    if (!municipal) return false;
    return isUsefulText(municipal.origin) &&
      isUsefulText(municipal.description) &&
      Boolean(municipal.foundedYear || municipal.namedYear || municipal.formerNames?.length);
  }

  fetchAutomaticHistory = async function(street, city) {
    const telAviv = typeof isTelAvivCity === 'function' && isTelAvivCity(city);

    // 1) Tel Aviv: always query the municipal street guide FIRST.
    let municipal = null;
    if (telAviv && typeof fetchMunicipalGuideHistory === 'function') {
      try {
        municipal = await fetchMunicipalGuideHistory(street, city);
      } catch (error) {
        console.warn('Municipal guide lookup failed:', error);
      }
    }

    // If the guide gives a sufficiently complete answer, return it immediately.
    if (municipalIsComplete(municipal)) {
      return {
        ...municipal,
        automatic: true,
        municipalGuide: true,
        sourceValidated: true,
        lookupOrder: ['municipal-guide']
      };
    }

    // 2) Only now use Wikipedia/Wikidata to fill missing fields.
    let fallback = null;
    try {
      fallback = await previousFetchAutomaticHistory(street, city);
    } catch (error) {
      console.warn('Wikipedia/Wikidata fallback failed:', error);
    }

    if (fallback?.origin) fallback.origin = sanitizeWikidataOrigin(fallback.origin, street);

    if (!municipal) {
      if (fallback) fallback.lookupOrder = ['municipal-guide', 'wikipedia-wikidata'];
      return fallback;
    }

    return {
      ...(fallback || {}),
      // Municipal guide always wins when it has a value.
      origin: isUsefulText(municipal.origin) ? municipal.origin : fallback?.origin,
      foundedYear: municipal.foundedYear || fallback?.foundedYear || null,
      namedYear: municipal.namedYear || fallback?.namedYear || null,
      formerNames: municipal.formerNames?.length ? municipal.formerNames : (fallback?.formerNames || []),
      description: isUsefulText(municipal.description) ? municipal.description : fallback?.description,
      sources: uniqueSourceItems([
        ...(municipal.sources || []),
        ...(fallback?.sources || [])
      ]),
      automatic: true,
      municipalGuide: true,
      sourceValidated: true,
      lookupOrder: ['municipal-guide', 'wikipedia-wikidata']
    };
  };
})();
