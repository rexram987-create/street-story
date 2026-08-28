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

const CITY_GUIDE = 'https://www.tel-aviv.gov.il/Visitors/KnowTelAviv/Pages/streets.aspx';

const pilotData = {
  'ביאליק': {
    origin: 'הרחוב נקרא על שמו של חיים נחמן ביאליק, המשורר הלאומי. ועד תל אביב החליט בשנת 1922 לקרוא ל״גבעת בצלאל״ רחוב ביאליק, עוד לפני עלייתו של ביאליק לארץ.',
    foundedYear: null,
    namedYear: '1922 (החלטת ועד תל אביב; טקס רשמי נערך ב-1924)',
    formerNames: ['גבעת בצלאל'],
    description: 'רחוב היסטורי במרכז תל אביב. בית ביאליק נמצא ברחוב ביאליק 22, ובשנותיה הראשונות של העיר פעלה ברחוב גם עיריית תל אביב.',
    sources: [
      { label: 'עיריית תל אביב-יפו — בית ביאליק', url: 'https://www.tel-aviv.gov.il/history/Pages/MainItemPage.aspx?ItemID=27&ListID=5c048616-f83a-4569-acb7-e001b3818d6c&WebID=1c946f9b-334d-42dd-8e27-48af21a66855' },
      { label: 'מדריך הרחובות הרשמי של עיריית תל אביב-יפו', url: CITY_GUIDE }
    ]
  },
  'דיזנגוף': {
    origin: 'הרחוב נקרא על שמו של מאיר דיזנגוף, ממייסדי אחוזת בית וראש העירייה הראשון של תל אביב.',
    foundedYear: null,
    namedYear: '1934',
    formerNames: [],
    description: 'אחד הצירים המזוהים ביותר עם מרכז תל אביב. הרחוב נקרא על שמו של דיזנגוף עוד בחייו, בעת חגיגות חצי היובל לעיר ובסמוך ליום הולדתו ה-73.',
    sources: [
      { label: 'עיריית תל אביב-יפו — מאיר דיזנגוף', url: 'https://www.tel-aviv.gov.il/history/Pages/MainItemPage.aspx?ItemId=2&ListID=d0082811-6d81-42b6-9cae-63fe732b0e3a&WebID=1c946f9b-334d-42dd-8e27-48af21a66855' },
      { label: 'מדריך הרחובות הרשמי של עיריית תל אביב-יפו', url: CITY_GUIDE }
    ]
  },
  'אלנבי': {
    origin: 'הרחוב נקרא על שמו של הגנרל הבריטי אדמונד הנרי היינמן אלנבי, מפקד הכוחות הבריטיים שכבשו את ארץ ישראל מידי האימפריה העות׳מאנית במלחמת העולם הראשונה.',
    foundedYear: '1911',
    namedYear: '1918',
    formerNames: ['דרך הים'],
    description: 'הרחוב תוכנן ונפתח בשנת 1911 במסגרת התרחבות תל אביב. בשנת 1918 שונה שמו לאלנבי. בשנות ה-20 הוסט חלקו המערבי לכיוון הים, והוא נעשה לאחד הרחובות המסחריים המרכזיים בעיר.',
    sources: [
      { label: 'הספרייה הלאומית — רחוב אלנבי בתל אביב', url: 'https://www.nli.org.il/he/archives/NNL_ARCHIVE_AL997009639029905171/NLI' },
      { label: 'מדריך הרחובות הרשמי של עיריית תל אביב-יפו', url: CITY_GUIDE },
      { label: 'עיריית תל אביב-יפו — כיכר האופרה והסטת רחוב אלנבי', url: 'https://www.tel-aviv.gov.il/Pages/MainItemPage.aspx?ItemID=2060&ListID=81e17809-311d-4bba-9bf1-2363bb9debcd&WebID=3af57d92-807c-43c5-8d5f-6fd455eb2776' }
    ]
  },
  'אבן גבירול': {
    origin: 'הרחוב נקרא על שמו של שלמה אבן גבירול (רשב״ג), מן המשוררים והפילוסופים היהודים הבולטים בתור הזהב של יהדות ספרד במאה ה-11.',
    foundedYear: null,
    namedYear: null,
    formerNames: [],
    description: 'ציר מרכזי החוצה את מרכז וצפון תל אביב. תוואי הרחוב מהווה את הגבול המזרחי של אזור התכנון של פטריק גדס, שבמסגרתו התפתחה העיר הלבנה.',
    sources: [
      { label: 'מדריך הרחובות הרשמי של עיריית תל אביב-יפו', url: CITY_GUIDE },
      { label: 'עיריית תל אביב-יפו — העיר הלבנה ותכנית גדס', url: 'https://www.tel-aviv.gov.il/Pages/MainItemPage.aspx?ItemId=59&ListID=81e17809-311d-4bba-9bf1-2363bb9debcd&WebID=3af57d92-807c-43c5-8d5f-6fd455eb2776' }
    ]
  },
  'רוטשילד': {
    origin: 'השדרות נקראות על שמו של הברון אדמונד ג׳יימס דה רוטשילד, ״הנדיב הידוע״, שתמך במושבות הראשונות ובהתיישבות היהודית בארץ ישראל.',
    foundedYear: '1909 — מן הרחובות הראשונים של אחוזת בית',
    namedYear: '1909',
    formerNames: [],
    description: 'שדרות רוטשילד הן מן הצירים הראשונים והמוכרים של תל אביב. הן היו אחד מששת הרחובות הראשונים של אחוזת בית, ולימים הפכו לציר מרכזי בעיר ולחלק מאזור העיר הלבנה.',
    sources: [
      { label: 'מדריך הרחובות הרשמי של עיריית תל אביב-יפו', url: CITY_GUIDE },
      { label: 'ויקיטקסט — מדריך רחובות תל אביב-יפו, רוטשילד', url: 'https://he.wikisource.org/wiki/%D7%9E%D7%93%D7%A8%D7%99%D7%9A_%D7%A8%D7%97%D7%95%D7%91%D7%95%D7%AA_%D7%AA%D7%9C_%D7%90%D7%91%D7%99%D7%91_%D7%99%D7%A4%D7%95/%D7%A8' }
    ]
  }
};

const streetAliases = {
  'שדרות רוטשילד': 'רוטשילד',
  'שד רוטשילד': 'רוטשילד',
  'שד׳ רוטשילד': 'רוטשילד',
  'מאיר דיזנגוף': 'דיזנגוף'
};

function normalizeStreet(value) {
  const cleaned = value.trim().replace(/^רחוב\s+/u, '').replace(/\s+/g, ' ');
  return streetAliases[cleaned] || cleaned;
}

function unavailable(value) {
  return value ?? 'לא נמצא במקורות שנבדקו';
}

async function geocodeStreet(street, city) {
  const params = new URLSearchParams({ street, city, country: 'Israel', format: 'jsonv2', limit: '1', addressdetails: '1' });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: { 'Accept-Language': 'he,en' } });
  if (!response.ok) throw new Error('שירות המפות אינו זמין כרגע.');
  const data = await response.json();
  return data[0] || null;
}

function renderSources(items) {
  fields.sourcesList.innerHTML = '';
  items.forEach(source => {
    const li = document.createElement('li');
    if (typeof source === 'string') {
      li.textContent = source;
    } else {
      const link = document.createElement('a');
      link.href = source.url;
      link.textContent = source.label;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'text-link';
      li.appendChild(link);
    }
    fields.sourcesList.appendChild(li);
  });
}

function renderResult(street, city, geo, historical) {
  fields.title.textContent = `${street} — ${city}`;
  fields.nameOrigin.textContent = historical?.origin || 'עדיין לא נמצא מידע מאומת על מקור השם';
  fields.foundedYear.textContent = unavailable(historical?.foundedYear);
  fields.namedYear.textContent = unavailable(historical?.namedYear);
  fields.formerNames.textContent = historical?.formerNames?.length ? historical.formerNames.join(', ') : 'לא נמצאו שמות קודמים במקורות שנבדקו';
  fields.streetDescription.textContent = historical?.description || 'הרחוב אותר במפה. מידע היסטורי מפורט עדיין לא קיים במאגר הפיילוט.';
  fields.locationText.textContent = geo.display_name;
  fields.mapLink.href = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(geo.lat)}&mlon=${encodeURIComponent(geo.lon)}#map=17/${encodeURIComponent(geo.lat)}/${encodeURIComponent(geo.lon)}`;

  const sources = [...(historical?.sources || [])];
  sources.push({ label: 'OpenStreetMap — מיקום הרחוב', url: 'https://www.openstreetmap.org/' });
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
    statusBox.textContent = pilotData[street] ? 'הרחוב נמצא והמידע ההיסטורי המאומת נטען.' : 'הרחוב נמצא. עדיין אין עליו מידע היסטורי מלא בפיילוט.';
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
  const text = [fields.title.textContent, `מקור השם: ${fields.nameOrigin.textContent}`, `שנת סלילה או ייסוד: ${fields.foundedYear.textContent}`, `שנת מתן השם: ${fields.namedYear.textContent}`, `שמות קודמים: ${fields.formerNames.textContent}`, fields.streetDescription.textContent].join('. ');
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'he-IL';
  window.speechSynthesis.speak(utterance);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
