// Deterministic verified overrides for cases where external source enrichment is incomplete.
// This file works directly with the rendered DOM so it is independent of the enrichment pipeline.

(function () {
  const form = document.getElementById('streetForm');
  const cityInput = document.getElementById('cityInput');
  const streetInput = document.getElementById('streetInput');
  const resultCard = document.getElementById('resultCard');

  if (!form || !cityInput || !streetInput || !resultCard) return;

  function canonical(value) {
    return String(value || '')
      .replace(/["׳״'־-]/g, '')
      .replace(/^(רחוב|שדרות|שדרה|דרך)\s+/u, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function isTelAviv(value) {
    const city = String(value || '').replace(/[־-]/g, ' ').replace(/\s+/g, ' ').trim();
    return city === 'תל אביב יפו' || city === 'תל אביב';
  }

  function isBenGurion(value) {
    const name = canonical(value);
    return name === 'דוד בן גוריון' || name === 'בן גוריון';
  }

  function isBegin(value) {
    const name = canonical(value);
    return name === 'בגין' || name === 'מנחם בגין';
  }

  function addSourceOnce(label, url) {
    const list = document.getElementById('sourcesList');
    if (!list) return;
    const exists = Array.from(list.querySelectorAll('a')).some(a => a.href === url || a.textContent === label);
    if (exists) return;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = url;
    a.textContent = label;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'text-link';
    li.appendChild(a);
    list.appendChild(li);
  }

  function applyBenGurionOverride() {
    if (!isTelAviv(cityInput.value) || !isBenGurion(streetInput.value)) return false;
    if (resultCard.classList.contains('hidden')) return false;

    const origin = document.getElementById('nameOrigin');
    const namedYear = document.getElementById('namedYear');
    const formerNames = document.getElementById('formerNames');
    const description = document.getElementById('streetDescription');

    if (origin && (!origin.textContent.trim() || origin.textContent.includes('לא נמצא') || origin.textContent.includes('עדיין לא'))) {
      origin.textContent = 'השדרות נקראות על שמו של דוד בן־גוריון (1886–1973), ממנהיגי התנועה הציונית, מכריז הקמת מדינת ישראל וראש הממשלה הראשון שלה.';
    }
    if (namedYear) namedYear.textContent = '1974';
    if (formerNames) formerNames.textContent = 'שדרות קרן קיימת (קק״ל)';
    if (description && (!description.textContent.trim() || description.textContent.includes('עדיין לא נמצא'))) {
      description.textContent = 'שדרות בן־גוריון הן ציר מרכזי בצפון הישן של תל אביב. עד 1974 נקראו שדרות קרן קיימת (קק״ל), ולאחר פטירת דוד בן־גוריון בדצמבר 1973 שונה שמן לזכרו. בית בן־גוריון נמצא בשדרה מספר 17.';
    }

    addSourceOnce('מדריך הרחובות הרשמי של עיריית תל אביב-יפו', 'https://www.tel-aviv.gov.il/Visitors/KnowTelAviv/Pages/streets.aspx');
    return true;
  }

  function applyBeginOverride() {
    if (!isTelAviv(cityInput.value) || !isBegin(streetInput.value)) return false;
    if (resultCard.classList.contains('hidden')) return false;

    const origin = document.getElementById('nameOrigin');
    const namedYear = document.getElementById('namedYear');
    const formerNames = document.getElementById('formerNames');
    const description = document.getElementById('streetDescription');

    if (origin) {
      origin.textContent = 'דרך מנחם בגין נקראת על שמו של מנחם בגין (1913–1992), ראש ממשלת ישראל השישי וחתן פרס נובל לשלום.';
    }
    if (namedYear) namedYear.textContent = '2001';
    if (formerNames) formerNames.textContent = 'דרך פתח תקווה; בתקופת המנדט: דרך הביטחון';
    if (description) {
      description.textContent = 'דרך מנחם בגין נקראה עד לשנת 2001 דרך פתח תקווה. היא התפתחה כחלק מן הציר ההיסטורי שחיבר את יפו ופתח תקווה. בתקופת המנדט נודעה גם בשם „דרך הביטחון”, ולאחר מכן בשם דרך פתח תקווה. בשנת 2001 נקראה הדרך על שמו של מנחם בגין.';
    }

    addSourceOnce('עיריית תל אביב-יפו — מסמך מדיניות מרחב המשולש בגין–המסגר–יצחק שדה', 'https://gisn.tel-aviv.gov.il/taba_raster/9107_MD.pdf');
    return true;
  }

  function applyVerifiedOverride() {
    return applyBenGurionOverride() || applyBeginOverride();
  }

  form.addEventListener('submit', () => {
    if (!isTelAviv(cityInput.value)) return;
    if (!isBenGurion(streetInput.value) && !isBegin(streetInput.value)) return;

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      applyVerifiedOverride();
      if (attempts >= 40) clearInterval(timer);
    }, 250);
  });

  // Also handle a result that is already visible when this script loads.
  applyVerifiedOverride();
})();
