// Deep Wikipedia history enrichment.
// Reads the full Hebrew Wikipedia article (not only the lead) and extracts only explicit facts.
// v20 also verifies that a Wikipedia street article belongs to the requested city before using it.
// It never invents a date or a former name when the article does not state one clearly.

(function () {
  if (typeof fetchAutomaticHistory !== 'function') return;

  const previousFetchAutomaticHistory = fetchAutomaticHistory;
  const WP_API = 'https://he.wikipedia.org/w/api.php';

  function useful(value) {
    const text = String(value || '').trim();
    return Boolean(text) && !text.includes('לא נמצא') && !text.includes('לא נמצא ב-Wikidata');
  }

  function uniqSources(items) {
    const seen = new Set();
    return (items || []).filter(item => {
      if (!item) return false;
      const key = typeof item === 'string' ? item : `${item.url || ''}|${item.label || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function cleanText(text) {
    return String(text || '')
      .replace(/\[[0-9]+\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizePlace(value) {
    return String(value || '')
      .replace(/["׳״'־–—-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function cityAliases(city) {
    const normalized = normalizePlace(city);
    if (normalized === 'ירושלים') return ['ירושלים'];
    if (normalized === 'תל אביב' || normalized === 'תל אביב יפו') {
      return ['תל אביב', 'תל אביב יפו', 'תל־אביב', 'תל אביב-יפו'];
    }
    return normalized ? [normalized] : [];
  }

  function textMentionsCity(text, city) {
    const normalizedText = normalizePlace(text);
    return cityAliases(city).some(alias => normalizedText.includes(normalizePlace(alias)));
  }

  function textMentionsOtherPilotCity(text, city) {
    const normalizedCity = normalizePlace(city);
    const normalizedText = normalizePlace(text);
    if (normalizedCity === 'ירושלים') return normalizedText.includes('תל אביב');
    if (normalizedCity === 'תל אביב' || normalizedCity === 'תל אביב יפו') return normalizedText.includes('ירושלים');
    return false;
  }

  async function fetchWikipediaLeadForValidation(title) {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'extracts',
      exintro: '1',
      explaintext: '1',
      titles: title,
      format: 'json',
      origin: '*'
    });
    const data = await fetchJson(`${WP_API}?${params}`, `wp-city-check-v20:${title}`);
    const page = Object.values(data?.query?.pages || {})[0];
    if (!page || page.missing !== undefined) return '';
    return cleanText(page.extract || '');
  }

  async function candidateMatchesRequestedCity(title, street, city) {
    if (typeof isLikelyStreetArticle === 'function' && !isLikelyStreetArticle(title, street, city)) return false;

    // A city in the title is the strongest inexpensive signal.
    if (textMentionsCity(title, city)) return true;

    const lead = await fetchWikipediaLeadForValidation(title);
    if (!lead) return false;

    // Reject a clearly conflicting city before accepting generic street-name matches.
    if (textMentionsOtherPilotCity(`${title} ${lead}`, city) && !textMentionsCity(`${title} ${lead}`, city)) {
      return false;
    }

    return textMentionsCity(`${title} ${lead}`, city);
  }

  // Replace the loose Wikipedia selector with a city-aware selector.
  // This is deliberately global so the earlier Wikipedia/Wikidata pipeline also uses it.
  searchWikipediaStreet = async function(street, city) {
    const queries = typeof buildWikipediaSearchQueries === 'function'
      ? buildWikipediaSearchQueries(street, city)
      : [`רחוב ${street} ${city}`, `${street} ${city}`];

    for (const query of queries) {
      const params = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: '8',
        srnamespace: '0',
        format: 'json',
        origin: '*'
      });
      const data = await fetchJson(`${WP_API}?${params}`, `wp-search-city-v20:${query}`);
      const matches = data?.query?.search || [];

      for (const item of matches) {
        try {
          if (await candidateMatchesRequestedCity(item.title, street, city)) return item.title;
        } catch (error) {
          console.warn(`Wikipedia city validation failed for ${item.title}:`, error);
        }
      }
    }
    return null;
  };

  function sentences(text) {
    return cleanText(text)
      .split(/(?<=[.!?])\s+(?=[א-ת"׳״])/u)
      .map(item => item.trim())
      .filter(item => item.length >= 15 && item.length <= 800);
  }

  function explicitOriginSentence(text) {
    const candidates = sentences(text);
    const patterns = [
      /(?:הרחוב|השדרה|הדרך|הכיכר|הסמטה).{0,100}?(?:נקרא|נקראת|נקראו|קרוי|קרויה).{0,100}?(?:על שם|על־שם|על שום)/u,
      /(?:שמו|שמה|השם)\s+(?:של\s+)?(?:הרחוב|השדרה|הדרך).{0,100}?(?:על שם|על־שם|על שום|משום|מפני|כיוון ש)/u,
      /(?:נקרא|נקראת|קרוי|קרויה).{0,120}?(?:משום|מפני|כיוון ש|על שום|על שם|על־שם)/u,
      /(?:מקור|מקורו|מקורה)\s+(?:של\s+)?(?:שם|השם|שמו|שמה)/u
    ];

    for (const pattern of patterns) {
      const found = candidates.find(sentence => pattern.test(sentence));
      if (found) return found;
    }
    return null;
  }

  function explicitNamedYear(text) {
    if (typeof extractExplicitNamedYear === 'function') {
      const year = extractExplicitNamedYear(text);
      if (year) return year;
    }

    const source = cleanText(text);
    const patterns = [
      /(?:הוענק|ניתן|נקבע)\s+(?:לרחוב|לשדרה|לדרך)?\s*(?:השם|שמו|שמה)[^.!?]{0,120}?(?:בשנת|ב־|ב-)\s*(18\d{2}|19\d{2}|20\d{2})/u,
      /(?:בשנת|ב־|ב-)\s*(18\d{2}|19\d{2}|20\d{2})[^.!?]{0,120}?(?:הוענק|ניתן|נקבע)\s+(?:לרחוב|לשדרה|לדרך)?\s*(?:השם|שמו|שמה)/u,
      /(?:נקרא|נקראה|נקראת)\s+(?:הרחוב|השדרה|הדרך)?[^.!?]{0,120}?(?:בשנת|ב־|ב-)\s*(18\d{2}|19\d{2}|20\d{2})/u,
      /(?:השם|שמו|שמה)\s+[^.!?]{0,80}?(?:נקבע|התקבע|ניתן)[^.!?]{0,80}?(?:בשנת|ב־|ב-)\s*(18\d{2}|19\d{2}|20\d{2})/u
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  }

  function explicitFoundedYear(text) {
    if (typeof extractExplicitFoundedYear === 'function') {
      const year = extractExplicitFoundedYear(text);
      if (year) return year;
    }

    const source = cleanText(text);
    const patterns = [
      /(?:בשנת|ב־|ב-)\s*(18\d{2}|19\d{2}|20\d{2})[^.!?]{0,120}?(?:נסלל[ה]?|נפתח[ה]?|החלה?\s+סלילת|החלו\s+בסלילת|הושלמה\s+סלילת|הסתיימה\s+סלילת|הוכשרה?)[^.!?]{0,80}?(?:הרחוב|השדרה|הדרך)/u,
      /(?:הרחוב|השדרה|הדרך)[^.!?]{0,100}?(?:נסלל[ה]?|נפתח[ה]?|הוכשרה?|הושלמה\s+סלילתה|הסתיימה\s+סלילתה)[^.!?]{0,100}?(?:בשנת|ב־|ב-)\s*(18\d{2}|19\d{2}|20\d{2})/u,
      /(?:סלילת|סלילתו|סלילתה)\s+(?:של\s+)?(?:הרחוב|השדרה|הדרך)[^.!?]{0,100}?(?:החלה|החלה בשנת|הושלמה|הסתיימה)[^.!?]{0,60}?(18\d{2}|19\d{2}|20\d{2})/u,
      /(?:הושלמה|הסתיימה)\s+סלילת\s+(?:הרחוב|השדרה|הדרך)[^.!?]{0,80}?(?:בשנת|ב־|ב-)?\s*(18\d{2}|19\d{2}|20\d{2})/u
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  }

  function explicitFormerNames(text) {
    const results = typeof extractExplicitFormerNames === 'function'
      ? extractExplicitFormerNames(text)
      : [];

    const source = cleanText(text);
    const extraPatterns = [
      /(?:שונה|הוחלף|הוסב)\s+(?:שמו|שמה)\s+(?:ל|אל)\s*["״']?([^"״'.;]{2,70})["״']?/gu,
      /(?:לשנות|להחליף|להסב)\s+את\s+(?:שמו|שמה)\s+(?:ל|אל)\s*["״']?([^"״'.;]{2,70})["״']?/gu,
      /(?:נקרא|נקראה)\s+(?:אז|באותה תקופה|לזמן קצר|במשך תקופה)\s+["״']?([^"״'.;]{2,70})["״']?/gu
    ];

    for (const pattern of extraPatterns) {
      for (const match of source.matchAll(pattern)) {
        const candidate = String(match[1] || '').replace(/\s+/g, ' ').trim();
        if (candidate && candidate.length <= 70 && !results.includes(candidate)) results.push(candidate);
      }
    }
    return results.slice(0, 4);
  }

  async function fetchFullArticle(title) {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'extracts|info',
      explaintext: '1',
      exsectionformat: 'plain',
      inprop: 'url',
      titles: title,
      format: 'json',
      origin: '*'
    });
    const data = await fetchJson(`${WP_API}?${params}`, `wp-full-v20:${title}`);
    const page = Object.values(data?.query?.pages || {})[0];
    if (!page || page.missing !== undefined || !page.extract) return null;
    return { title: page.title, text: cleanText(page.extract), url: page.fullurl };
  }

  fetchAutomaticHistory = async function(street, city) {
    let base = null;
    try {
      base = await previousFetchAutomaticHistory(street, city);
    } catch (error) {
      console.warn('Base history lookup failed before deep Wikipedia enrichment:', error);
    }

    let title = null;
    try {
      title = await searchWikipediaStreet(street, city);
    } catch (error) {
      console.warn('Deep Wikipedia title lookup failed:', error);
    }
    if (!title) return base;

    let article = null;
    try {
      article = await fetchFullArticle(title);
    } catch (error) {
      console.warn('Deep Wikipedia article lookup failed:', error);
    }
    if (!article) return base;

    const originSentence = explicitOriginSentence(article.text);
    const foundedYear = explicitFoundedYear(article.text);
    const namedYear = explicitNamedYear(article.text);
    const formerNames = explicitFormerNames(article.text);

    // Tel Aviv's municipal guide remains the highest-priority naming source.
    const municipalHasPriority = Boolean(base?.municipalGuide && useful(base?.origin));
    const deepOrigin = originSentence ? `לפי ויקיפדיה: ${originSentence}` : null;

    return {
      ...(base || {}),
      origin: municipalHasPriority
        ? base.origin
        : (deepOrigin || base?.origin || 'לא נמצא במקורות שנבדקו'),
      foundedYear: base?.foundedYear || foundedYear || null,
      namedYear: base?.namedYear || namedYear || null,
      formerNames: base?.formerNames?.length ? base.formerNames : formerNames,
      description: useful(base?.description)
        ? base.description
        : article.text.slice(0, 1100),
      sources: uniqSources([
        ...(base?.sources || []),
        { label: `ויקיפדיה — ${article.title} (הערך המלא)`, url: article.url }
      ]),
      automatic: true,
      wikipediaCityValidated: true,
      deepWikipediaRead: true,
      deepWikipediaFacts: {
        origin: Boolean(originSentence),
        foundedYear: Boolean(foundedYear),
        namedYear: Boolean(namedYear),
        formerNames: formerNames.length > 0
      }
    };
  };
})();
