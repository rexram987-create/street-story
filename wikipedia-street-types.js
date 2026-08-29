// Wikipedia street-title compatibility layer.
// Adds common Israeli road title forms such as "כביש בגין" without weakening city validation.

(function () {
  const previousBuildQueries = typeof buildWikipediaSearchQueries === 'function'
    ? buildWikipediaSearchQueries
    : null;

  function normalize(value) {
    return String(value || '')
      .replace(/["׳״'־–—-]/g, ' ')
      .replace(/^(רחוב|שדרות|שדרה|דרך|כביש|סמטת|סמטה)\s+/u, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function streetTokens(value) {
    return normalize(value).match(/[א-ת]+/gu)?.filter(token => token.length >= 2) || [];
  }

  buildWikipediaSearchQueries = function (street, city) {
    const base = String(street || '')
      .replace(/^(רחוב|שדרות|שדרה|דרך|כביש|סמטת|סמטה)\s+/u, '')
      .trim();
    const shortCity = String(city || '').replace('-יפו', '').trim();
    const inherited = previousBuildQueries ? previousBuildQueries(street, city) : [];

    return [...new Set([
      ...inherited,
      `כביש ${base} ${shortCity}`,
      `דרך ${base} ${shortCity}`,
      `רחוב ${base} ${shortCity}`,
      `${base} ירושלים`,
      `${base} ${shortCity}`
    ].filter(Boolean))];
  };

  isLikelyStreetArticle = function (title, street, city) {
    const titleText = String(title || '');
    const normalizedTitle = normalize(titleText);
    const targetTokens = streetTokens(street);
    if (!targetTokens.length) return false;

    // Require all meaningful street-name tokens in the title, regardless of whether
    // Wikipedia calls the object רחוב, דרך or כביש.
    const titleTokens = streetTokens(titleText);
    const hasStreetName = targetTokens.every(token => titleTokens.includes(token));
    if (!hasStreetName) return false;

    const hasStreetType = /(?:רחוב|שדרות|שדרה|דרך|כביש|סמטת|סמטה)/u.test(titleText);
    const cityText = String(city || '').replace('-יפו', '').trim().toLowerCase();
    const hasCityInTitle = cityText && normalizedTitle.includes(normalize(cityText));

    return hasStreetType || hasCityInTitle;
  };
})();
