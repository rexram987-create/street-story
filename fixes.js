// Compatibility and search improvements loaded after app.js.
// Keeps the working core intact while adding Hebrew street-name variants.

Object.assign(streetAliases, {
  'דוד בן גוריון': 'שדרות בן גוריון',
  'דוד בן-גוריון': 'שדרות בן גוריון',
  'בן גוריון': 'שדרות בן גוריון',
  'בן-גוריון': 'שדרות בן גוריון',
  'שדרות דוד בן גוריון': 'שדרות בן גוריון',
  'שדרות דוד בן-גוריון': 'שדרות בן גוריון',
  'שדרות בן-גוריון': 'שדרות בן גוריון'
});

// Accuracy corrections: do not present inferred dates/names as verified facts.
if (pilotData['ביאליק']) {
  pilotData['ביאליק'].formerNames = [];
}
if (pilotData['רוטשילד']) {
  pilotData['רוטשילד'].foundedYear = null;
  pilotData['רוטשילד'].namedYear = null;
}

function canonicalStreetText(value) {
  return String(value || '')
    .replace(/["׳״'־-]/g, '')
    .replace(/^(רחוב|שדרות|שדרה)\s+/u, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Wikipedia article titles often use a maqaf/hyphen or omit/add the word "שדרות".
isLikelyStreetArticle = function(title, street, city) {
  const normalizedTitle = canonicalStreetText(title);
  const normalizedStreet = canonicalStreetText(street);
  const shortCity = city.replace('-יפו', '').trim().toLowerCase();
  return normalizedTitle.includes(normalizedStreet) &&
    (title.includes('רחוב') || title.includes('שדרות') || title.toLowerCase().includes(shortCity));
};

// Try common Hebrew road-type variants when the exact OSM spelling is different
// from what the user typed. Requests remain throttled to respect Nominatim usage.
geocodeStreet = async function(street, city) {
  const base = String(street || '').trim();
  const stripped = base.replace(/^(רחוב|שדרות|שדרה)\s+/u, '').trim();
  const candidates = [...new Set([
    base,
    stripped,
    `רחוב ${stripped}`,
    `שדרות ${stripped}`
  ].filter(Boolean))];

  for (const candidate of candidates) {
    const cacheKey = `geo:${city}:${candidate}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const wait = Math.max(0, 1100 - (Date.now() - lastNominatimRequest));
    if (wait) await sleep(wait);
    lastNominatimRequest = Date.now();

    const params = new URLSearchParams({
      street: candidate,
      city,
      country: 'Israel',
      format: 'jsonv2',
      limit: '1',
      addressdetails: '1'
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { 'Accept-Language': 'he,en' }
    });
    if (!response.ok) throw new Error('שירות המפות אינו זמין כרגע.');
    const data = await response.json();
    const result = data[0] || null;
    if (result) {
      cacheSet(cacheKey, result);
      cacheSet(`geo:${city}:${base}`, result);
      return result;
    }
  }

  return null;
};
