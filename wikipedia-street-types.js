// Wikipedia street-title compatibility layer.
// v23: search the cleaned street name first; street-type variants are only fallbacks.

(function () {
  function normalize(value) {
    return String(value || '')
      .replace(/["׳״'־–—-]/g, ' ')
      .replace(/^(רחוב|שדרות|שדרה|דרך|כביש|סמטת|סמטה)\s+/u, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function baseName(value) {
    return String(value || '')
      .replace(/^(רחוב|שדרות|שדרה|דרך|כביש|סמטת|סמטה)\s+/u, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function streetTokens(value) {
    return normalize(value).match(/[א-ת]+/gu)?.filter(token => token.length >= 2) || [];
  }

  buildWikipediaSearchQueries = function (street, city) {
    const base = baseName(street);
    const shortCity = String(city || '').replace('-יפו', '').trim();

    // Important: the untyped name is deliberately first. This lets Wikipedia find
    // articles/mentions whose source uses a different road type (e.g. כביש vs דרך).
    return [...new Set([
      `${base} ${shortCity}`,
      `"${base}" ${shortCity}`,
      base,
      `רחוב ${base} ${shortCity}`,
      `דרך ${base} ${shortCity}`,
      `שדרות ${base} ${shortCity}`,
      `כביש ${base} ${shortCity}`,
      `סמטת ${base} ${shortCity}`
    ].filter(Boolean))];
  };

  isLikelyStreetArticle = function (title, street, city) {
    const titleText = String(title || '');
    const normalizedTitle = normalize(titleText);
    const targetTokens = streetTokens(street);
    if (!targetTokens.length) return false;

    const titleTokens = streetTokens(titleText);
    const hasStreetName = targetTokens.every(token => titleTokens.includes(token));
    if (!hasStreetName) return false;

    const hasStreetType = /(?:רחוב|שדרות|שדרה|דרך|כביש|סמטת|סמטה)/u.test(titleText);
    const cityText = String(city || '').replace('-יפו', '').trim().toLowerCase();
    const hasCityInTitle = cityText && normalizedTitle.includes(normalize(cityText));

    return hasStreetType || hasCityInTitle;
  };
})();
