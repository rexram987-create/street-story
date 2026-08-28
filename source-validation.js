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

  fetchAutomaticHistory = async function(street, city) {
    const combined = await previousFetchAutomaticHistory(street, city);

    // Outside Tel Aviv, keep the existing generic pipeline unchanged.
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
    // so its namesake/origin text is safer than a broad Wikidata P138 result that may
    // contain additional entities, historical names or unrelated geographic items.
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
