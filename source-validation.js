// Source validation and priority layer loaded after fixes.js.
// Tel Aviv rule: ALWAYS query the municipal naming guide first, then Wikipedia/Wikidata.
// Municipal data keeps priority; Wikipedia/Wikidata enrich missing fields and sources.

(function () {
  if (typeof fetchAutomaticHistory !== 'function') return;

  const previousFetchAutomaticHistory = fetchAutomaticHistory;
  // fixes.js keeps a reference to app.js's original Wikipedia/Wikidata pipeline.
  // Prefer it here so we do not re-run the municipal guide a second time.
  const wikipediaWikidataFetch = (typeof fetchAutomaticHistoryBase === 'function')
    ? fetchAutomaticHistoryBase
    : previousFetchAutomaticHistory;

  const GUIDE_API = 'https://he.wikisource.org/w/api.php';
  const GUIDE_ROOT = 'מדריך רחובות תל אביב יפו';

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
      .replace(/["׳״'־–—-]/g, ' ')
      .replace(/^(רחוב|שדרות|שדרה|דרך|סמטת|סמטה)\s+/u, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function words(value) {
    return normalizeTokenText(value)
      .match(/[א-ת]+/gu)?.filter(token => token.length >= 2) || [];
  }

  function streetKeywords(street) {
    return words(street);
  }

  function cleanHeading(value) {
    return String(value || '')
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\b\d{4}\s*[-–]\s*\d{4}\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sectionMatchScore(line, street) {
    const target = [...new Set(words(street))];
    const section = [...new Set(words(cleanHeading(line)))];
    if (!target.length || !section.length) return -1;

    const matched = target.filter(token => section.includes(token)).length;
    if (matched !== target.length) return -1;

    let score = 100 + matched * 20;
    if (section.length === target.length) score += 30;
    const orderedTarget = normalizeTokenText(street);
    const orderedSection = normalizeTokenText(cleanHeading(line));
    if (orderedSection === orderedTarget) score += 40;
    return score;
  }

  function guideLettersForStreet(street) {
    return [...new Set(words(street).map(token => token[0]).filter(letter => /[א-ת]/u.test(letter)))];
  }

  async function fetchGuidePageSections(letter) {
    const pageTitle = `${GUIDE_ROOT}/${letter}`;
    const params = new URLSearchParams({
      action: 'parse', page: pageTitle, prop: 'sections', format: 'json', origin: '*'
    });
    const data = await fetchJson(`${GUIDE_API}?${params}`, `ws-guide-flex-sections-v16:${pageTitle}`);
    return { pageTitle, sections: data?.parse?.sections || [] };
  }

  async function fetchFlexibleMunicipalGuideHistory(street, city) {
    if (typeof isTelAvivCity !== 'function' || !isTelAvivCity(city)) return null;

    const letters = guideLettersForStreet(street);
    if (!letters.length) return null;

    let best = null;
    for (const letter of letters) {
      let page;
      try {
        page = await fetchGuidePageSections(letter);
      } catch (error) {
        console.warn(`Municipal guide page ${letter} failed:`, error);
        continue;
      }
      for (const section of page.sections) {
        const score = sectionMatchScore(section.line, street);
        if (score > (best?.score ?? -1)) best = { ...page, section, score };
      }
    }

    if (!best || best.score < 100) return null;

    const sectionParams = new URLSearchParams({
      action: 'parse',
      page: best.pageTitle,
      section: best.section.index,
      prop: 'text',
      format: 'json',
      origin: '*'
    });
    const sectionData = await fetchJson(
      `${GUIDE_API}?${sectionParams}`,
      `ws-guide-flex-section-v16:${best.pageTitle}:${best.section.index}`
    );

    let text = typeof htmlToPlainText === 'function'
      ? htmlToPlainText(sectionData?.parse?.text?.['*'] || '')
      : '';
    text = text.replace(/\[עריכה\]/g, '').replace(/\s+/g, ' ').trim();
    if (!text) return null;

    const heading = String(best.section.line || street).replace(/\s+/g, ' ').trim();
    const displayHeading = typeof cleanGuideHeading === 'function'
      ? cleanGuideHeading(heading)
      : cleanHeading(heading);
    const guideUrl = `https://he.wikisource.org/wiki/${encodeURIComponent(best.pageTitle).replace(/%2F/g, '/')}`;

    const foundedYear = typeof extractExplicitFoundedYear === 'function'
      ? extractExplicitFoundedYear(text)
      : null;
    const namedYear = typeof extractExplicitNamedYear === 'function'
      ? extractExplicitNamedYear(text)
      : null;
    const formerNames = typeof extractExplicitFormerNames === 'function'
      ? extractExplicitFormerNames(text)
      : [];

    return {
      origin: `הרחוב נקרא על שם ${displayHeading}. לפי מדריך הרחובות של עיריית תל אביב-יפו: ${text.slice(0, 520)}`,
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
      verifiedExtraction: true,
      flexibleNameMatch: true
    };
  }

  fetchMunicipalGuideHistory = fetchFlexibleMunicipalGuideHistory;

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

  fetchAutomaticHistory = async function(street, city) {
    const telAviv = typeof isTelAvivCity === 'function' && isTelAvivCity(city);

    // STEP 1: municipal guide. Never return early; Wikipedia/Wikidata is still checked afterwards.
    let municipal = null;
    if (telAviv) {
      try {
        municipal = await fetchMunicipalGuideHistory(street, city);
      } catch (error) {
        console.warn('Municipal guide lookup failed:', error);
      }
    }

    // STEP 2 + 3: Wikipedia article first, then its Wikidata entity (the original app pipeline).
    let fallback = null;
    try {
      fallback = await wikipediaWikidataFetch(street, city);
    } catch (error) {
      console.warn('Wikipedia/Wikidata enrichment failed:', error);
    }
    if (fallback?.origin) fallback.origin = sanitizeWikidataOrigin(fallback.origin, street);

    // Outside Tel Aviv there is no municipal guide layer, so use the public fallback directly.
    if (!telAviv) {
      if (fallback) fallback.lookupOrder = ['wikipedia', 'wikidata'];
      return fallback;
    }

    if (!municipal) {
      if (fallback) fallback.lookupOrder = ['municipal-guide', 'wikipedia', 'wikidata'];
      return fallback;
    }

    // Municipal guide has priority for any field it actually provides.
    // Wikipedia/Wikidata still contributes missing fields and remains visible in Sources.
    return {
      ...(fallback || {}),
      origin: isUsefulText(municipal.origin) ? municipal.origin : fallback?.origin,
      foundedYear: municipal.foundedYear || fallback?.foundedYear || null,
      namedYear: municipal.namedYear || fallback?.namedYear || null,
      formerNames: municipal.formerNames?.length ? municipal.formerNames : (fallback?.formerNames || []),
      description: isUsefulText(municipal.description) ? municipal.description : fallback?.description,
      sources: uniqueSourceItems([...(municipal.sources || []), ...(fallback?.sources || [])]),
      automatic: true,
      municipalGuide: true,
      sourceValidated: true,
      flexibleNameMatch: true,
      lookupOrder: ['municipal-guide', 'wikipedia', 'wikidata']
    };
  };
})();
