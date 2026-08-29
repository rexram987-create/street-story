// Wikipedia mention fallback for streets that do not have a standalone article under the entered name.
// v22: searches Hebrew Wikipedia for city-scoped mentions, validates the requested city and street tokens,
// and only extracts explicit historical statements. No guessing.

(function () {
  if (typeof fetchAutomaticHistory !== 'function') return;

  const previousFetchAutomaticHistory = fetchAutomaticHistory;
  const WP_API = 'https://he.wikipedia.org/w/api.php';

  function clean(value) {
    return String(value || '').replace(/\[[0-9]+\]/g, '').replace(/\s+/g, ' ').trim();
  }

  function norm(value) {
    return clean(value)
      .replace(/["׳״'־–—-]/g, ' ')
      .replace(/^(רחוב|שדרות|שדרה|דרך|כביש|סמטה|סמטת)\s+/u, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function cityAliases(city) {
    const n = norm(city);
    if (n === 'ירושלים') return ['ירושלים'];
    if (n === 'תל אביב' || n === 'תל אביב יפו') return ['תל אביב', 'תל אביב יפו'];
    return n ? [n] : [];
  }

  function cityMatches(text, city) {
    const n = norm(text);
    return cityAliases(city).some(alias => n.includes(norm(alias)));
  }

  function streetTokens(street) {
    return [...new Set(norm(street).match(/[א-ת]+/gu)?.filter(t => t.length >= 2) || [])];
  }

  function streetMatches(text, street) {
    const n = norm(text);
    const tokens = streetTokens(street);
    return tokens.length > 0 && tokens.every(token => n.includes(token));
  }

  function sentences(text) {
    return clean(text).split(/(?<=[.!?])\s+(?=[א-ת"׳״])/u).map(s => s.trim()).filter(s => s.length >= 20 && s.length <= 900);
  }

  function relevantSentences(text, street, city) {
    const all = sentences(text);
    return all.filter(sentence => streetMatches(sentence, street) && (cityMatches(sentence, city) || cityMatches(text.slice(0, 1600), city)));
  }

  function originFrom(sentencesList) {
    return sentencesList.find(s => /(?:נקרא|נקראת|קרוי|קרויה|נקראות).{0,120}?(?:על שם|על־שם|לזכר)/u.test(s)) || null;
  }

  function foundedFrom(text) {
    if (typeof extractExplicitFoundedYear === 'function') {
      const y = extractExplicitFoundedYear(text);
      if (y) return y;
    }
    const m = clean(text).match(/(?:הקמת|סלילת|פתיחת|חנוכת|נחנך|נחנכה|נפתח|נפתחה)[^.!?]{0,120}?(?:בשנת|ב־|ב-)?\s*(18\d{2}|19\d{2}|20\d{2})/u);
    return m?.[1] || null;
  }

  function namedFrom(text) {
    if (typeof extractExplicitNamedYear === 'function') {
      const y = extractExplicitNamedYear(text);
      if (y) return y;
    }
    const m = clean(text).match(/(?:נקרא|נקראה|שונה שמו|שונה שמה|הוענק השם|ניתן השם)[^.!?]{0,120}?(?:בשנת|ב־|ב-)\s*(18\d{2}|19\d{2}|20\d{2})/u);
    return m?.[1] || null;
  }

  function formerFrom(text) {
    return typeof extractExplicitFormerNames === 'function' ? extractExplicitFormerNames(text) : [];
  }

  function useful(value) {
    const t = clean(value);
    return Boolean(t) && !t.includes('לא נמצא');
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

  async function searchMentions(street, city) {
    const base = norm(street);
    const variants = [...new Set([base, `כביש ${base}`, `דרך ${base}`, `רחוב ${base}`, `שדרות ${base}`])];
    const results = [];

    for (const variant of variants) {
      const params = new URLSearchParams({
        action: 'query', list: 'search', srsearch: `"${variant}" ${city}`, srlimit: '8', srnamespace: '0', format: 'json', origin: '*'
      });
      try {
        const data = await fetchJson(`${WP_API}?${params}`, `wp-mention-v22:${variant}:${city}`);
        for (const item of data?.query?.search || []) {
          if (!results.some(r => r.title === item.title)) results.push(item);
        }
      } catch (error) {
        console.warn('Wikipedia mention search failed:', error);
      }
    }
    return results.slice(0, 15);
  }

  async function fetchArticle(title) {
    const params = new URLSearchParams({ action: 'query', prop: 'extracts|info', explaintext: '1', inprop: 'url', titles: title, format: 'json', origin: '*' });
    const data = await fetchJson(`${WP_API}?${params}`, `wp-mention-article-v22:${title}`);
    const page = Object.values(data?.query?.pages || {})[0];
    if (!page || page.missing !== undefined || !page.extract) return null;
    return { title: page.title, text: clean(page.extract), url: page.fullurl };
  }

  async function findMentionEvidence(street, city) {
    const candidates = await searchMentions(street, city);
    for (const candidate of candidates) {
      let article;
      try { article = await fetchArticle(candidate.title); } catch (_) { continue; }
      if (!article || !cityMatches(article.text.slice(0, 2200), city) || !streetMatches(article.text, street)) continue;

      const rel = relevantSentences(article.text, street, city);
      if (!rel.length) continue;
      const joined = rel.join(' ');
      const originSentence = originFrom(rel);
      const foundedYear = foundedFrom(joined);
      const namedYear = namedFrom(joined);
      const formerNames = formerFrom(joined);

      if (!originSentence && !foundedYear && !namedYear && !formerNames.length) continue;
      return { article, rel, originSentence, foundedYear, namedYear, formerNames };
    }
    return null;
  }

  fetchAutomaticHistory = async function(street, city) {
    let base = null;
    try { base = await previousFetchAutomaticHistory(street, city); } catch (error) { console.warn('Base lookup failed:', error); }

    const needsFallback = !base || !useful(base.origin) || !useful(base.description) || !base.foundedYear || !base.namedYear || !(base.formerNames?.length);
    if (!needsFallback) return base;

    let evidence = null;
    try { evidence = await findMentionEvidence(street, city); } catch (error) { console.warn('Wikipedia mention fallback failed:', error); }
    if (!evidence) return base;

    const description = evidence.rel.slice(0, 4).join(' ').slice(0, 1100);
    return {
      ...(base || {}),
      origin: useful(base?.origin) ? base.origin : (evidence.originSentence ? `לפי ויקיפדיה: ${evidence.originSentence}` : 'לא נמצא במקורות שנבדקו'),
      foundedYear: base?.foundedYear || evidence.foundedYear || null,
      namedYear: base?.namedYear || evidence.namedYear || null,
      formerNames: base?.formerNames?.length ? base.formerNames : evidence.formerNames,
      description: useful(base?.description) ? base.description : description,
      sources: uniqSources([...(base?.sources || []), { label: `ויקיפדיה — אזכור מאומת ב${evidence.article.title}`, url: evidence.article.url }]),
      automatic: true,
      wikipediaMentionFallback: true
    };
  };
})();
