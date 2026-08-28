// Compatibility, source enrichment and conservative historical extraction loaded after app.js.
// The rule is simple: only display dates/names when the source text states them explicitly.

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

// Verified special case retained as a safety net while the generic extractor improves.
const BEN_GURION_HISTORY = {
  origin: 'השדרות נקראות על שמו של דוד בן־גוריון (1886–1973), ממנהיגי התנועה הציונית, מכריז הקמת מדינת ישראל וראש הממשלה הראשון שלה.',
  foundedYear: null,
  namedYear: '1974',
  formerNames: ['שדרות קרן קיימת (קק״ל)'],
  description: 'שדרות בן־גוריון הן ציר מרכזי בצפון הישן של תל אביב, מכיכר אתרים במערב לכיוון כיכר רבין וגן העיר. השדרה הייתה אחת משדרות הרוחב בתוכנית גדס ונועדה לשמש ציר ירוק. עד 1974 נקראה שדרות קרן קיימת. לאחר פטירת דוד בן־גוריון בדצמבר 1973 שונה שמה לזכרו. בית בן־גוריון, שבו התגוררו דוד ופולה בן־גוריון, נמצא בשדרה מספר 17.',
  sources: [
    { label: 'מדריך הרחובות הרשמי של עיריית תל אביב-יפו', url: CITY_GUIDE },
    { label: 'ויקיטקסט — מדריך רחובות תל אביב-יפו', url: 'https://he.wikisource.org/wiki/מדריך_רחובות_תל_אביב_יפו/ב' },
    { label: 'תל אביב אונליין — שדרות בן גוריון, לשעבר שדרות קק״ל', url: 'https://tlvonline.co.il/שדרות-בן-גוריון-מדור-צילומי/' }
  ],
  automatic: false,
  verifiedOverride: true
};
pilotData['שדרות בן גוריון'] = BEN_GURION_HISTORY;

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

function uniqueSources(items) {
  const seen = new Set();
  return (items || []).filter(item => {
    if (!item) return false;
    const key = typeof item === 'string' ? item : `${item.url || ''}|${item.label || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeHistoricalName(value) {
  return String(value || '')
    .replace(/^[\s:–—-]+|[\s,;:.–—-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function plausibleFormerName(value) {
  const name = normalizeHistoricalName(value);
  if (!name || name.length < 2 || name.length > 80) return null;
  if (/^(הרחוב|השדרה|הדרך|שמו|שמה|השם|כיום|היום)$/u.test(name)) return null;
  return name;
}

function extractExplicitFoundedYear(text) {
  const patterns = [
    /(?:הרחוב|השדרה|הדרך)?\s*(?:נסלל[ה]?|נפתח[ה]?|נוסד[ה]?|הוקם|הוקמה)\s+(?:לראשונה\s+)?(?:בשנת|ב־?|ב-)\s*(18\d{2}|19\d{2}|20\d{2})/u,
    /(?:בשנת|ב־?|ב-)\s*(18\d{2}|19\d{2}|20\d{2})\s+(?:נסלל[ה]?|נפתח[ה]?|נוסד[ה]?|הוקם|הוקמה)\s+(?:הרחוב|השדרה|הדרך)/u
  ];
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractExplicitNamedYear(text) {
  const source = String(text || '');
  const patterns = [
    /(?:בשנת|ב־?|ב-)\s*(18\d{2}|19\d{2}|20\d{2})[^.!?]{0,90}?(?:נקרא|נקראה|נקראו|שונה שמו|שונה שמה|הוסב שמו|הוסב שמה|נקבע שמו|נקבע שמה)/u,
    /(?:נקרא|נקראה|נקראו|שונה שמו|שונה שמה|הוסב שמו|הוסב שמה|נקבע שמו|נקבע שמה)[^.!?]{0,90}?(?:בשנת|ב־?|ב-)\s*(18\d{2}|19\d{2}|20\d{2})/u,
    /(?:עד|עד שנת)\s*(18\d{2}|19\d{2}|20\d{2})\s+(?:נקרא|נקראה|נקראו)[^.!?]{1,90}?(?:ומאז|ולאחר מכן|ואחר כך|וכיום|והיום)/u
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractExplicitFormerNames(text) {
  const source = String(text || '');
  const results = [];
  const patterns = [
    /(?:נקרא|נקראה|נקראו)\s+(?:אז|בעבר|תחילה|בראשיתו|בראשיתה|לימים)\s+([^.;]{2,80}?)(?=\s+(?:והיום|וכיום|ולימים|ולאחר|ואחר)|[.;]|$)/gu,
    /(?:עד|עד שנת)\s*(?:18\d{2}|19\d{2}|20\d{2})?\s*(?:נקרא|נקראה|נקראו)\s+([^.;]{2,80}?)(?=\s+(?:והיום|וכיום|ומאז|ולאחר)|[.;]|$)/gu,
    /(?:לשעבר|שמו הקודם היה|שמה הקודם היה|השם הקודם היה)\s+([^.;]{2,80}?)(?=[.;]|$)/gu
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const candidate = plausibleFormerName(match[1]);
      if (candidate && !results.includes(candidate)) results.push(candidate);
    }
  }
  return results.slice(0, 4);
}

function cleanGuideHeading(heading) {
  return String(heading || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+\d{4}\s*[-–]\s*\d{4}\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Search more flexibly for streets whose Wikipedia title uses רחוב/שדרות/דרך.
buildWikipediaSearchQueries = function(street, city) {
  const shortCity = city.replace('-יפו', '').trim();
  const base = streetBaseName(street);
  return [...new Set([
    `רחוב ${base} ${shortCity}`,
    `שדרות ${base} ${shortCity}`,
    `דרך ${base} ${shortCity}`,
    `${base} (${shortCity})`,
    `${base} ${shortCity}`
  ])];
};

isLikelyStreetArticle = function(title, street, city) {
  const normalizedTitle = canonicalStreetText(title);
  const normalizedStreet = canonicalStreetText(street);
  const shortCity = city.replace('-יפו', '').trim().toLowerCase();
  return normalizedTitle.includes(normalizedStreet) &&
    (title.includes('רחוב') || title.includes('שדרות') || title.includes('דרך') || title.toLowerCase().includes(shortCity));
};

// Try several common street forms in Nominatim while respecting its public rate limit.
geocodeStreet = async function(street, city) {
  const base = String(street || '').trim();
  const stripped = base.replace(/^(רחוב|שדרות|שדרה|סמטת|סמטה|דרך)\s+/u, '').trim();
  const candidates = [...new Set([base, stripped, `רחוב ${stripped}`, `שדרות ${stripped}`, `דרך ${stripped}`].filter(Boolean))];

  for (const candidate of candidates) {
    const cacheKey = `geo:${city}:${candidate}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const wait = Math.max(0, 1100 - (Date.now() - lastNominatimRequest));
    if (wait) await sleep(wait);
    lastNominatimRequest = Date.now();

    const params = new URLSearchParams({ street: candidate, city, country: 'Israel', format: 'jsonv2', limit: '1', addressdetails: '1' });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: { 'Accept-Language': 'he,en' } });
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
  const sectionsParams = new URLSearchParams({ action: 'parse', page: pageTitle, prop: 'sections', format: 'json', origin: '*' });
  const sectionsData = await fetchJson(`${WIKISOURCE_API}?${sectionsParams}`, `ws-guide-sections-v10:${pageTitle}`);
  const sections = sectionsData?.parse?.sections || [];

  let best = null;
  for (const section of sections) {
    const score = guideSectionScore(section.line, base);
    if (score > (best?.score ?? -1)) best = { section, score };
  }
  if (!best || best.score < 50) return null;

  const sectionParams = new URLSearchParams({ action: 'parse', page: pageTitle, section: best.section.index, prop: 'text', format: 'json', origin: '*' });
  const sectionData = await fetchJson(`${WIKISOURCE_API}?${sectionParams}`, `ws-guide-section-v10:${pageTitle}:${best.section.index}`);
  let text = htmlToPlainText(sectionData?.parse?.text?.['*'] || '');
  text = text.replace(/\[עריכה\]/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const heading = String(best.section.line || base).replace(/\s+/g, ' ').trim();
  const cleanHeading = cleanGuideHeading(heading);
  const guideUrl = `https://he.wikisource.org/wiki/${encodeURIComponent(pageTitle).replace(/%2F/g, '/')}`;
  const namedYear = extractExplicitNamedYear(text);
  const foundedYear = extractExplicitFoundedYear(text);
  const formerNames = extractExplicitFormerNames(text);

  return {
    origin: `הרחוב נקרא על שם ${cleanHeading}. לפי מדריך הרחובות של עיריית תל אביב-יפו: ${text.slice(0, 520)}`,
    foundedYear,
    namedYear,
    formerNames,
    description: text.slice(0, 1100),
    sources: [
      { label: 'מדריך הרחובות הרשמי של עיריית תל אביב-יפו', url: CITY_GUIDE },
      { label: `ויקיטקסט — מדריך הרחובות (${heading})`, url: guideUrl }
    ],
    automatic: true,
    municipalGuide: true,
    verifiedExtraction: true
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
    foundedYear: municipalResult.foundedYear || wikipediaResult.foundedYear || null,
    namedYear: municipalResult.namedYear || wikipediaResult.namedYear || null,
    formerNames: municipalResult.formerNames.length ? municipalResult.formerNames : (wikipediaResult.formerNames || []),
    description: municipalResult.description || wikipediaResult.description,
    sources: uniqueSources([...(municipalResult.sources || []), ...(wikipediaResult.sources || [])]),
    automatic: true,
    municipalGuide: true,
    verifiedExtraction: true
  };
};
