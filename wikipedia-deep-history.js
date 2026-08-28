// Deep Wikipedia history enrichment.
// Reads the full Hebrew Wikipedia article (not only the lead) and extracts only explicit facts.
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

  function sentences(text) {
    return cleanText(text)
      .split(/(?<=[.!?])\s+(?=[א-ת"׳״])/u)
      .map(item => item.trim())
      .filter(item => item.length >= 15 && item.length <= 700);
  }

  function explicitOriginSentence(text) {
    const candidates = sentences(text);
    const strong = candidates.find(sentence =>
      /(?:הרחוב|השדרה|הדרך|הכיכר|הסמטה).{0,45}(?:נקרא|נקראת|נקראו|קרוי|קרויה).{0,45}(?:על שם|על־שם)/u.test(sentence) ||
      /(?:מקור|מקורו|מקורה)\s+(?:של\s+)?(?:שם|השם|שמו|שמה)/u.test(sentence)
    );
    if (strong) return strong;

    return candidates.find(sentence =>
      /(?:נקרא|נקראת|קרוי|קרויה).{0,80}(?:משום|מפני|כיוון ש|על שום|על שם|על־שם)/u.test(sentence)
    ) || null;
  }

  function explicitNamedYear(text) {
    if (typeof extractExplicitNamedYear === 'function') {
      const year = extractExplicitNamedYear(text);
      if (year) return year;
    }

    const source = cleanText(text);
    const patterns = [
      /(?:הוענק|ניתן|נקבע)\s+(?:לרחוב|לשדרה|לדרך)?\s*(?:השם|שמו|שמה)[^.!?]{0,100}?(?:בשנת|ב־|ב-)\s*(18\d{2}|19\d{2}|20\d{2})/u,
      /(?:בשנת|ב־|ב-)\s*(18\d{2}|19\d{2}|20\d{2})[^.!?]{0,100}?(?:הוענק|ניתן|נקבע)\s+(?:לרחוב|לשדרה|לדרך)?\s*(?:השם|שמו|שמה)/u,
      /(?:נקרא|נקראה|נקראת)\s+(?:הרחוב|השדרה|הדרך)?[^.!?]{0,100}?(?:בשנת|ב־|ב-)\s*(18\d{2}|19\d{2}|20\d{2})/u
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  }

  function explicitFoundedYear(text) {
    return typeof extractExplicitFoundedYear === 'function'
      ? extractExplicitFoundedYear(text)
      : null;
  }

  function explicitFormerNames(text) {
    const results = typeof extractExplicitFormerNames === 'function'
      ? extractExplicitFormerNames(text)
      : [];

    const source = cleanText(text);
    const extraPatterns = [
      /(?:שונה|הוחלף|הוסב)\s+(?:שמו|שמה)\s+(?:ל|אל)\s*["״']?([^"״'.;]{2,70})["״']?/gu,
      /(?:לשנות|להחליף|להסב)\s+את\s+(?:שמו|שמה)\s+(?:ל|אל)\s*["״']?([^"״'.;]{2,70})["״']?/gu
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
    const data = await fetchJson(`${WP_API}?${params}`, `wp-full-v18:${title}`);
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
