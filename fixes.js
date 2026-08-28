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
    .replace(/^(רחוב|שדרות|שדרה|סמטת|סמטה|דרך)\s+/u, '')
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
  const stripped = base.replace(/^(רחוב|שדרות|שדרה|סמטת|סמטה|דרך)\s+/u, '').trim();
  const candidates = [...new Set([
    base,
    stripped,
    `רחוב ${stripped}`,
    `שדרות ${stripped}`,
    `דרך ${stripped}`
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

// Tel Aviv's official street guide says its information may be reused freely with
// attribution to the municipality. Wikisource hosts a searchable transcription of
// that guide, which lets the browser retrieve one street section without an API key.
const WIKISOURCE_API = 'https://he.wikisource.org/w/api.php';
const MUNICIPAL_GUIDE_WIKISOURCE = 'מדריך רחובות תל אביב יפו';

function isTelAvivCity(city) {
  const normalized = String(city || '').replace(/[־-]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized === 'תל אביב יפו' || normalized === 'תל אביב';
}

function firstHebrewLetterForGuide(street) {
  const stripped = canonicalStreetText(street);
  const match = stripped.match(/[א-ת]/u);
  return match ? match[0] : null;
}

function sectionMatchesStreet(sectionLine, street) {
  const section = canonicalStreetText(sectionLine);
  const target = canonicalStreetText(street);
  if (!section || !target) return false;
  return section === target || section.includes(target) || target.includes(section);
}

function htmlToPlainText(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
}

async function fetchMunicipalGuideHistory(street, city) {
  if (!isTelAvivCity(city)) return null;

  const letter = firstHebrewLetterForGuide(street);
  if (!letter) return null;

  const pageTitle = `${MUNICIPAL_GUIDE_WIKISOURCE}/${letter}`;
  const sectionsParams = new URLSearchParams({
    action: 'parse',
    page: pageTitle,
    prop: 'sections',
    format: 'json',
    origin: '*'
  });

  try {
    const sectionsData = await fetchJson(
      `${WIKISOURCE_API}?${sectionsParams}`,
      `ws-guide-sections:${letter}`
    );
    const sections = sectionsData?.parse?.sections || [];
    const matched = sections.find(item => sectionMatchesStreet(item.line, street));
    if (!matched) return null;

    const sectionParams = new URLSearchParams({
      action: 'parse',
      page: pageTitle,
      section: matched.index,
      prop: 'text',
      format: 'json',
      origin: '*'
    });
    const sectionData = await fetchJson(
      `${WIKISOURCE_API}?${sectionParams}`,
      `ws-guide-section:${pageTitle}:${matched.index}`
    );
    const html = sectionData?.parse?.text?.['*'] || '';
    let text = htmlToPlainText(html);
    if (!text) return null;

    // Remove edit labels and repeated heading noise while retaining the municipal explanation.
    text = text.replace(/\[עריכה\]/g, '').replace(/\s+/g, ' ').trim();
    const explanation = text.slice(0, 1100);
    const sourceUrl = `https://he.wikisource.org/wiki/${encodeURIComponent(pageTitle).replace(/%2F/g, '/')}`;

    return {
      origin: `לפי מדריך הרחובות של עיריית תל אביב-יפו: ${explanation.slice(0, 520)}`,
      foundedYear: null,
      namedYear: null,
      formerNames: [],
      description: explanation,
      sources: [
        { label: 'מדריך הרחובות של עיריית תל אביב-יפו', url: CITY_GUIDE },
        { label: `ויקיטקסט — תעתיק מדריך הרחובות (${matched.line})`, url: sourceUrl }
      ],
      automatic: true,
      municipalGuide: true
    };
  } catch (error) {
    console.warn('Municipal guide enrichment failed:', error);
    return null;
  }
}

const fetchAutomaticHistoryBase = fetchAutomaticHistory;
fetchAutomaticHistory = async function(street, city) {
  const wikipediaResult = await fetchAutomaticHistoryBase(street, city);

  // Prefer the municipal naming guide when Wikipedia/Wikidata could not establish
  // the origin of the street name. Keep useful Wikipedia details when available.
  const needsMunicipalOrigin = !wikipediaResult ||
    !wikipediaResult.origin ||
    wikipediaResult.origin.includes('לא נמצא ב-Wikidata');

  if (!needsMunicipalOrigin) return wikipediaResult;

  const municipalResult = await fetchMunicipalGuideHistory(street, city);
  if (!municipalResult) return wikipediaResult;
  if (!wikipediaResult) return municipalResult;

  return {
    ...wikipediaResult,
    origin: municipalResult.origin,
    description: wikipediaResult.description || municipalResult.description,
    sources: [...municipalResult.sources, ...(wikipediaResult.sources || [])],
    municipalGuide: true
  };
};
