// Compatibility and search improvements loaded after app.js.
// Keeps the working core intact while adding Hebrew street-name variants.

Object.assign(streetAliases, {
  'דוד בן גוריון': 'שדרות בן גוריון',
  'דוד בן-גוריון': 'שדרות בן גוריון',
  'דוד בן־גוריון': 'שדרות בן גוריון',
  'בן גוריון': 'שדרות בן גוריון',
  'בן-גוריון': 'שדרות בן גוריון',
  'בן־גוריון': 'שדרות בן גוריון',
  'שדרות דוד בן גוריון': 'שדרות בן גוריון',
  'שדרות דוד בן-גוריון': 'שדרות בן גוריון',
  'שדרות דוד בן־גוריון': 'שדרות בן גוריון',
  'שדרות בן-גוריון': 'שדרות בן גוריון',
  'שדרות בן־גוריון': 'שדרות בן גוריון'
});

// Accuracy corrections: do not present inferred dates/names as verified facts.
if (pilotData['ביאליק']) pilotData['ביאליק'].formerNames = [];
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

function isTelAvivCity(city) {
  const normalized = String(city || '').replace(/[־-]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized === 'תל אביב יפו' || normalized === 'תל אביב';
}

function streetBaseName(street) {
  return String(street || '')
    .replace(/^(רחוב|שדרות|שדרה|סמטת|סמטה|דרך)\s+/u, '')
    .replace(/[־-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

isLikelyStreetArticle = function(title, street, city) {
  const normalizedTitle = canonicalStreetText(title);
  const normalizedStreet = canonicalStreetText(street);
  const shortCity = city.replace('-יפו', '').trim().toLowerCase();
  return normalizedTitle.includes(normalizedStreet) &&
    (title.includes('רחוב') || title.includes('שדרות') || title.toLowerCase().includes(shortCity));
};

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

const WIKISOURCE_API = 'https://he.wikisource.org/w/api.php';
const MUNICIPAL_GUIDE_WIKISOURCE = 'מדריך רחובות תל אביב יפו';

function firstHebrewLetterForGuide(street) {
  const match = streetBaseName(street).match(/[א-ת]/u);
  return match ? match[0] : null;
}

function guideSectionScore(line, street) {
  const section = canonicalStreetText(line);
  const target = canonicalStreetText(street);
  if (!section || !target) return -1;
  if (section === target) return 100;
  if (section.startsWith(`${target} `)) return 90;
  if (section.startsWith(target)) return 80;
  if (section.includes(target)) return 50;
  return -1;
}

function htmlToPlainText(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  doc.querySelectorAll('sup, .mw-editsection, style, script').forEach(node => node.remove());
  return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
}

async function fetchMunicipalGuideHistory(street, city) {
  if (!isTelAvivCity(city)) return null;

  const base = streetBaseName(street);
  const letter = firstHebrewLetterForGuide(base);
  if (!letter) return null;

  const pageTitle = `${MUNICIPAL_GUIDE_WIKISOURCE}/${letter}`;
  const sectionsParams = new URLSearchParams({
    action: 'parse',
    page: pageTitle,
    prop: 'sections',
    format: 'json',
    origin: '*'
  });

  const sectionsData = await fetchJson(
    `${WIKISOURCE_API}?${sectionsParams}`,
    `ws-guide-sections-v3:${pageTitle}`
  );
  const sections = sectionsData?.parse?.sections || [];

  let best = null;
  for (const section of sections) {
    const score = guideSectionScore(section.line, base);
    if (score > (best?.score ?? -1)) best = { section, score };
  }
  if (!best || best.score < 50) return null;

  const sectionParams = new URLSearchParams({
    action: 'parse',
    page: pageTitle,
    section: best.section.index,
    prop: 'text',
    format: 'json',
    origin: '*'
  });
  const sectionData = await fetchJson(
    `${WIKISOURCE_API}?${sectionParams}`,
    `ws-guide-section-v3:${pageTitle}:${best.section.index}`
  );

  let text = htmlToPlainText(sectionData?.parse?.text?.['*'] || '');
  text = text.replace(/\[עריכה\]/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  // The section heading itself is useful for identifying the person/event.
  const heading = String(best.section.line || base).replace(/\s+/g, ' ').trim();
  const guideUrl = `https://he.wikisource.org/wiki/${encodeURIComponent(pageTitle).replace(/%2F/g, '/')}`;

  // Extract a verified former-name clue only when the guide explicitly says it.
  const formerNames = [];
  const formerMatch = text.match(/(?:נקרא|נקראה|נקראו)\s+אז\s+([^.;]{2,70})/u);
  if (formerMatch?.[1]) formerNames.push(formerMatch[1].trim());

  return {
    origin: `הרחוב נקרא על שם ${heading.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+\d{4}[-–]\d{4}\s*/g, ' ').trim()}. לפי מדריך הרחובות של עיריית תל אביב-יפו: ${text.slice(0, 520)}`,
    foundedYear: null,
    namedYear: null,
    formerNames,
    description: text.slice(0, 1100),
    sources: [
      { label: 'מדריך הרחובות הרשמי של עיריית תל אביב-יפו', url: CITY_GUIDE },
      { label: `ויקיטקסט — מדריך הרחובות (${heading})`, url: guideUrl }
    ],
    automatic: true,
    municipalGuide: true
  };
}

const fetchAutomaticHistoryBase = fetchAutomaticHistory;
fetchAutomaticHistory = async function(street, city) {
  let wikipediaResult = null;
  try {
    wikipediaResult = await fetchAutomaticHistoryBase(street, city);
  } catch (error) {
    console.warn('Wikipedia/Wikidata enrichment failed:', error);
  }

  let municipalResult = null;
  try {
    municipalResult = await fetchMunicipalGuideHistory(street, city);
  } catch (error) {
    console.warn('Municipal guide enrichment failed:', error);
  }

  if (!municipalResult) return wikipediaResult;
  if (!wikipediaResult) return municipalResult;

  const wikiOriginUseful = wikipediaResult.origin && !wikipediaResult.origin.includes('לא נמצא');

  return {
    ...wikipediaResult,
    origin: wikiOriginUseful ? wikipediaResult.origin : municipalResult.origin,
    foundedYear: wikipediaResult.foundedYear || municipalResult.foundedYear,
    namedYear: wikipediaResult.namedYear || municipalResult.namedYear,
    formerNames: municipalResult.formerNames.length ? municipalResult.formerNames : (wikipediaResult.formerNames || []),
    // Prefer the municipal guide's street/person explanation because it is the naming authority.
    description: municipalResult.description || wikipediaResult.description,
    sources: [...municipalResult.sources, ...(wikipediaResult.sources || [])],
    automatic: true,
    municipalGuide: true
  };
};
