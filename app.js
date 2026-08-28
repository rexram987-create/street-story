const form = document.getElementById('streetForm');
const cityInput = document.getElementById('cityInput');
const streetInput = document.getElementById('streetInput');
const statusBox = document.getElementById('status');
const resultCard = document.getElementById('resultCard');
const contrastButton = document.getElementById('contrastButton');
const speakButton = document.getElementById('speakButton');

const fields = {
  title: document.getElementById('resultTitle'),
  nameOrigin: document.getElementById('nameOrigin'),
  foundedYear: document.getElementById('foundedYear'),
  namedYear: document.getElementById('namedYear'),
  formerNames: document.getElementById('formerNames'),
  streetDescription: document.getElementById('streetDescription'),
  locationText: document.getElementById('locationText'),
  mapLink: document.getElementById('mapLink'),
  sourcesList: document.getElementById('sourcesList')
};

const pilotData = {
  'ביאליק': {
    origin: 'המידע ההיסטורי המפורט יחובר למקור העירוני הרשמי בשלב הבא.',
    foundedYear: null,
    namedYear: null,
    formerNames: [],
    description: 'רחוב בתל אביב-יפו. פרטי ההיסטוריה, שנת הסלילה ונקודות העניין יתווספו רק לאחר אימות מול מקורות מוסמכים.',
    sources: ['OpenStreetMap — מיקום ותוואי הרחוב']
  },
  'דיזנגוף': {
    origin: 'המידע ההיסטורי המפורט יחובר למקור העירוני הרשמי בשלב הבא.',
    foundedYear: null,
    namedYear: null,
    formerNames: [],
    description: 'רחוב בתל אביב-יפו. גרסת הפיילוט נמנעת מהשלמת פרטים היסטוריים שאינם מאומתים.',
    sources: ['OpenStreetMap — מיקום ותוואי הרחוב']
  },
  'אלנבי': {
    origin: 'המידע ההיסטורי המפורט יחובר למקור העירוני הרשמי בשלב הבא.',
    foundedYear: null,
    namedYear: null,
    formerNames: [],
    description: 'רחוב בתל אביב-יפו. מידע היסטורי יוצג לאחר חיבור למאגרי המקור.',
    sources: ['OpenStreetMap — מיקום ותוואי הרחוב']
  },
  'אבן גבירול': {
    origin: 'המידע ההיסטורי המפורט יחובר למקור העירוני הרשמי בשלב הבא.',
    foundedYear: null,
    namedYear: null,
    formerNames: [],
    description: 'רחוב בתל אביב-יפו. מידע היסטורי יוצג לאחר חיבור למאגרי המקור.',
    sources: ['OpenStreetMap — מיקום ותוואי הרחוב']
  },
  'רוטשילד': {
    origin: 'המידע ההיסטורי המפורט יחובר למקור העירוני הרשמי בשלב הבא.',
    foundedYear: null,
    namedYear: null,
    formerNames: [],
    description: 'רחוב בתל אביב-יפו. מידע היסטורי יוצג לאחר חיבור למאגרי המקור.',
    sources: ['OpenStreetMap — מיקום ותוואי הרחוב']
  }
};

function normalizeStreet(value) {
  return value.trim().replace(/^רחוב\s+/u, '').replace(/\s+/g, ' ');
}

function unavailable(value) {
  return value ?? 'לא נמצא במקורות שנבדקו';
}

async function geocodeStreet(street, city) {
  const params = new URLSearchParams({
    street,
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
  return data[0] || null;
}

function renderSources(items) {
  fields.sourcesList.innerHTML = '';
  items.forEach(source => {
    const li = document.createElement('li');
    li.textContent = source;
    fields.sourcesList.appendChild(li);
  });
}

function renderResult(street, city, geo, historical) {
  fields.title.textContent = `${street} — ${city}`;
  fields.nameOrigin.textContent = historical?.origin || 'עדיין לא נמצא מידע מאומת על מקור השם';
  fields.foundedYear.textContent = unavailable(historical?.foundedYear);
  fields.namedYear.textContent = unavailable(historical?.namedYear);
  fields.formerNames.textContent = historical?.formerNames?.length
    ? historical.formerNames.join(', ')
    : 'לא נמצאו שמות קודמים במקורות שנבדקו';
  fields.streetDescription.textContent = historical?.description || 'הרחוב אותר במפה. מידע היסטורי מפורט יחובר בהמשך.';
  fields.locationText.textContent = geo.display_name;
  fields.mapLink.href = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(geo.lat)}&mlon=${encodeURIComponent(geo.lon)}#map=17/${encodeURIComponent(geo.lat)}/${encodeURIComponent(geo.lon)}`;

  const sources = [...(historical?.sources || [])];
  if (!sources.some(source => source.includes('OpenStreetMap'))) {
    sources.push('OpenStreetMap — מיקום ותוואי הרחוב');
  }
  renderSources(sources);

  resultCard.classList.remove('hidden');
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const city = cityInput.value.trim();
  const street = normalizeStreet(streetInput.value);

  resultCard.classList.add('hidden');
  statusBox.textContent = 'מחפש את הרחוב ומאמת את מיקומו…';

  try {
    const geo = await geocodeStreet(street, city);
    if (!geo) {
      statusBox.textContent = 'לא מצאתי רחוב כזה בעיר שנבחרה. כדאי לבדוק את האיות ולנסות שוב.';
      return;
    }

    statusBox.textContent = 'הרחוב נמצא.';
    renderResult(street, city, geo, pilotData[street]);
  } catch (error) {
    statusBox.textContent = error.message || 'אירעה שגיאה בחיפוש.';
  }
});

contrastButton.addEventListener('click', () => {
  const active = document.body.classList.toggle('high-contrast');
  contrastButton.setAttribute('aria-pressed', String(active));
  contrastButton.textContent = active ? 'ניגודיות רגילה' : 'ניגודיות גבוהה';
});

speakButton.addEventListener('click', () => {
  if (!('speechSynthesis' in window)) {
    statusBox.textContent = 'הדפדפן הזה אינו תומך כרגע בהקראה.';
    return;
  }
  window.speechSynthesis.cancel();
  const text = [
    fields.title.textContent,
    `מקור השם: ${fields.nameOrigin.textContent}`,
    `שנת סלילה או ייסוד: ${fields.foundedYear.textContent}`,
    `שנת מתן השם: ${fields.namedYear.textContent}`,
    fields.streetDescription.textContent
  ].join('. ');
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'he-IL';
  window.speechSynthesis.speak(utterance);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
