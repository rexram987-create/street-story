// Jerusalem support layer.
// Lookup order for Jerusalem: official government street registry first, then Wikipedia/Wikidata.
// The registry verifies that the street name exists in Jerusalem; it does not invent historical facts.

(function () {
  if (typeof fetchAutomaticHistory !== 'function') return;

  const previousFetchAutomaticHistory = fetchAutomaticHistory;
  const STREET_REGISTRY_API = 'https://data.gov.il/api/3/action/datastore_search';
  const STREET_REGISTRY_RESOURCE = '9ad3862c-8391-4b2f-84a4-2d4c68625f4b';
  const STREET_REGISTRY_PAGE = 'https://data.gov.il/he/datasets/population_authority/321/9ad3862c-8391-4b2f-84a4-2d4c68625f4b';

  function isJerusalemCity(city) {
    const normalized = String(city || '')
      .replace(/[־–—-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return normalized === 'ירושלים';
  }

  function normalizeJerusalemStreet(value) {
    return String(value || '')
      .replace(/["׳״'־–—-]/g, ' ')
      .replace(/^(רחוב|שדרות|שדרה|דרך|סמטת|סמטה)\s+/u, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
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

  async function verifyJerusalemStreet(street) {
    const requested = normalizeJerusalemStreet(street);
    if (!requested) return null;

    const params = new URLSearchParams({
      resource_id: STREET_REGISTRY_RESOURCE,
      limit: '100',
      q: street
    });

    const data = await fetchJson(
      `${STREET_REGISTRY_API}?${params.toString()}`,
      `official-street-registry-v17:ירושלים:${requested}`
    );

    const records = data?.result?.records || [];
    const exact = records.find(record => {
      const cityName = String(record['שם_ישוב'] || '').trim();
      const streetName = normalizeJerusalemStreet(record['שם_רחוב']);
      return cityName === 'ירושלים' && streetName === requested;
    });

    if (!exact) return null;

    return {
      officialName: String(exact['שם_רחוב'] || street).trim(),
      cityCode: exact['סמל_ישוב'] ?? null,
      streetCode: exact['סמל_רחוב'] ?? null,
      source: {
        label: 'רשות האוכלוסין וההגירה — רשימת רחובות ישראל',
        url: STREET_REGISTRY_PAGE
      }
    };
  }

  fetchAutomaticHistory = async function(street, city) {
    if (!isJerusalemCity(city)) return previousFetchAutomaticHistory(street, city);

    // STEP 1: verify the street against the official national street registry.
    let official = null;
    try {
      official = await verifyJerusalemStreet(street);
    } catch (error) {
      console.warn('Jerusalem official street verification failed:', error);
    }

    // STEP 2 + 3: Wikipedia and then Wikidata provide historical/name information.
    // Existing conservative rules remain in force: missing facts stay missing rather than guessed.
    let history = null;
    try {
      history = await previousFetchAutomaticHistory(street, city);
    } catch (error) {
      console.warn('Jerusalem Wikipedia/Wikidata lookup failed:', error);
    }

    if (!history && !official) return null;

    if (!history) {
      return {
        origin: 'לא נמצא במקורות שנבדקו',
        foundedYear: null,
        namedYear: null,
        formerNames: [],
        description: `הרחוב ${official.officialName} מופיע ברשימת הרחובות הרשמית של ירושלים, אך לא נמצא עבורו מידע היסטורי מאומת במקורות האוטומטיים שנבדקו.`,
        sources: [official.source],
        automatic: true,
        officialStreetVerified: true,
        officialStreetName: official.officialName,
        lookupOrder: ['official-street-registry', 'wikipedia', 'wikidata']
      };
    }

    return {
      ...history,
      sources: uniqueSources([
        ...(official ? [official.source] : []),
        ...(history.sources || [])
      ]),
      officialStreetVerified: Boolean(official),
      officialStreetName: official?.officialName || null,
      officialStreetCode: official?.streetCode || null,
      lookupOrder: ['official-street-registry', 'wikipedia', 'wikidata']
    };
  };
})();
