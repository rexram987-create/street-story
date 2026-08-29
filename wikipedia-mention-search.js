// Wikipedia mention fallback: broad discovery, strict validation, conservative fact extraction.
// v31: an article that merely mentions the requested name cannot supply street history.
// Facts must come from a sentence explicitly identifying the requested street/road/avenue.
(function () {
  if (typeof fetchAutomaticHistory !== 'function') return;
  const previousFetchAutomaticHistory = fetchAutomaticHistory;
  const WP_API='https://he.wikipedia.org/w/api.php';
  const clean=v=>String(v||'').replace(/\[[0-9]+\]/g,'').replace(/\s+/g,' ').trim();
  const canon=v=>clean(v).replace(/["׳״'־–—-]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
  const norm=v=>canon(v).replace(/^(רחוב|שדרות|שדרה|דרך|כביש|סמטה|סמטת|ציר)\s+/u,'').trim();
  function cityAliases(city){const n=norm(city);if(n==='ירושלים')return['ירושלים'];if(n==='תל אביב'||n==='תל אביב יפו')return['תל אביב','תל אביב יפו'];return n?[n]:[];}
  const cityMatches=(text,city)=>{const n=canon(text);return cityAliases(city).some(a=>n.includes(canon(a)));};
  const streetTokens=street=>[...new Set(norm(street).match(/[א-ת]+/gu)?.filter(t=>t.length>=2)||[])];
  const streetMatches=(text,street)=>{const n=canon(text),t=streetTokens(street);return t.length>0&&t.every(x=>n.includes(x));};
  const sentences=text=>clean(text).split(/(?<=[.!?])\s+(?=[א-ת"׳״])/u).map(s=>s.trim()).filter(s=>s.length>=12&&s.length<=1100);
  const ROAD_WORD='(?:רחוב|הרחוב|שדרות|השדרות|שדרה|השדרה|דרך|הדרך|כביש|הכביש|סמטה|הסמטה|סמטת|ציר|הציר)';
  function escapeRx(v){return String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function streetRoadAnchor(sentence,street){
    const s=canon(sentence),base=norm(street);
    if(!base||!streetMatches(s,street))return false;
    const b=escapeRx(base).replace(/\s+/g,'\\s+');
    // The road-type word must identify this name, not some unrelated road elsewhere in the sentence.
    const before=new RegExp(`${ROAD_WORD}\\s+(?:על\\s+שם\\s+)?${b}(?=\\s|$|[,()])`,'u');
    const after=new RegExp(`${b}\\s+${ROAD_WORD}(?=\\s|$|[,()])`,'u');
    return before.test(s)||after.test(s);
  }
  function titleIsStreetArticle(title,street){return streetRoadAnchor(title,street);}
  function anchoredSentences(text,street,city,title){
    const standalone=titleIsStreetArticle(title,street);
    return sentences(text).filter(s=>streetRoadAnchor(s,street)&&(standalone||cityMatches(s,city)));
  }
  const DIRECT_ROAD_EVENT=/(?:נחנך|נחנכה|נפתח|נפתחה|נסלל|נסללה|הוקם|הוקמה|נבנה|נבנתה|נפרץ|נפרצה|החלה סלילתו|החלה סלילתה|החלו עבודות הסלילה|החלה הקמתו|החלה הקמתה)/u;
  const COMPLETION_EVENT=/(?:הושלמה|הסתיימה)\s+(?:סלילת|הקמת)\s+(?:הכביש|הרחוב|הדרך|השדרה|הציר)|(?:סלילת|הקמת)\s+(?:הכביש|הרחוב|הדרך|השדרה|הציר)[^.!?]{0,80}(?:הושלמה|הסתיימה)/u;
  const PLANNING_ONLY=/(?:תכנון|התכנון|תוכנן|תוכננה|תכנית|תוכנית|תכניות|תוכניות|אושר התכנון|הושלם התכנון|תכנון ראשוני)/u;
  const NAMING_EVENT=/(?:נקרא|נקראה|נקבע|נקבעה|הוענק|ניתן|שונה שמו|שונה שמה|הוסב שמו|הוסב שמה)/u;
  function originEvidence(list){const sentence=list.find(s=>/(?:נקרא|נקראת|קרוי|קרויה|נקראות|נקראים|מכונה)[^.!?]{0,220}(?:על שם|על־שם|על שמו|על שמה|לזכר|מנציח)/u.test(s));return sentence?{sentence}:null;}
  function yearEvidence(list,type){for(const sentence of list){if(type==='founded'){const actual=DIRECT_ROAD_EVENT.test(sentence)||COMPLETION_EVENT.test(sentence);if(!actual)continue;if(PLANNING_ONLY.test(sentence)&&!/סלילת|הקמת/u.test(sentence))continue;}if(type==='named'&&(!NAMING_EVENT.test(sentence)||!/(?:השם|על שם|על־שם|על שמו|על שמה|שמו|שמה)/u.test(sentence)))continue;const m=clean(sentence).match(/(?:18\d{2}|19\d{2}|20\d{2})/u);if(m)return{value:m[0],sentence};}return null;}
  function plausibleFormerName(v,street){let c=clean(v).replace(/^["״']+|["״']+$/g,'').trim().replace(/^(?:בשם|כ|בכינוי)\s+/u,'').trim();if(!c||c.length<2||c.length>48||/[.!?:;,()\[\]{}]/u.test(c)||/\d{4}/u.test(c))return null;if(/\b(?:בשנת|לאחר|כאשר|שבו|שבה|אשר|עקב|בגלל|במהלך|נחנך|נסלל|נקרא|שונה|הוחלף|הוקם|הוביל|היה|הייתה|הוא|היא)\b/u.test(c))return null;const w=c.split(/\s+/);if(w.length>6||norm(c)===norm(street))return null;return /^(?:רחוב|שדרות|שדרה|דרך|כביש|סמטה|סמטת)\s+/u.test(c)||(w.length<=4&&!/^(?:של|את|אל|על|מן|עם|בו|בה|בין|ליד|לאורך)\b/u.test(c))?c:null;}
  function formerEvidence(list,street){const out=[];const patterns=[/(?:נקרא|נקראה)\s+(?:בעבר|קודם לכן|לפני כן|תחילה|בראשיתו|בראשיתה)\s+["״']?([^"״'.;,]{2,48})["״']?/u,/(?:שמו|שמה)\s+(?:הקודם|הקודמת)\s+(?:היה|הייתה)\s+["״']?([^"״'.;,]{2,48})["״']?/u,/(?:שונה|הוחלף|הוסב)\s+(?:שמו|שמה)\s+מ[־-]?["״']?([^"״'.;,]{2,48})["״']?\s+(?:ל|אל)/u];for(const sentence of list)for(const p of patterns){const m=sentence.match(p),name=m&&plausibleFormerName(m[1],street);if(name&&!out.some(x=>x.value===name))out.push({value:name,sentence});}return out.slice(0,4);}
  const useful=v=>Boolean(clean(v))&&!clean(v).includes('לא נמצא');
  function uniqSources(items){const seen=new Set();return(items||[]).filter(i=>{if(!i)return false;const k=typeof i==='string'?i:`${i.url||''}|${i.label||''}`;if(seen.has(k))return false;seen.add(k);return true;});}
  function trustedBase(base){return Boolean(base?.verifiedOverride||base?.municipalGuide);}
  function safeBaseSources(base){return (base?.sources||[]).filter(s=>{const label=typeof s==='string'?s:String(s?.label||'');return !/ויקיפדיה|wikipedia|wikidata/i.test(label);});}
  async function searchMentions(street,city){const base=norm(street),queries=[...new Set([`"רחוב ${base}" ${city}`,`"דרך ${base}" ${city}`,`"שדרות ${base}" ${city}`,`"כביש ${base}" ${city}`,`${base} ${city}`,`"${base}" ${city}`,base])],results=[];for(const q of queries){const p=new URLSearchParams({action:'query',list:'search',srsearch:q,srlimit:'10',srnamespace:'0',format:'json',origin:'*'});try{const d=await fetchJson(`${WP_API}?${p}`,`wp-mention-v31:${q}`);for(const x of d?.query?.search||[])if(!results.some(r=>r.title===x.title))results.push(x);}catch(e){console.warn('Wikipedia mention search failed:',e);}}return results.slice(0,24);}
  async function fetchArticle(title){const p=new URLSearchParams({action:'query',prop:'extracts|info',explaintext:'1',inprop:'url',titles:title,format:'json',origin:'*'}),d=await fetchJson(`${WP_API}?${p}`,`wp-mention-article-v31:${title}`),page=Object.values(d?.query?.pages||{})[0];return(!page||page.missing!==undefined||!page.extract)?null:{title:page.title,text:clean(page.extract),url:page.fullurl};}
  async function findEvidence(street,city){let best=null;for(const candidate of await searchMentions(street,city)){let article;try{article=await fetchArticle(candidate.title);}catch(_){continue;}if(!article||!streetMatches(article.text,street))continue;const anchors=anchoredSentences(article.text,street,city,article.title);if(!anchors.length)continue;const origin=originEvidence(anchors),founded=yearEvidence(anchors,'founded'),named=yearEvidence(anchors,'named'),former=formerEvidence(anchors,street);const score=(titleIsStreetArticle(article.title,street)?6:0)+(origin?5:0)+(founded?4:0)+(named?4:0)+(former.length?2:0)+Math.min(anchors.length,3);if(!best||score>best.score)best={article,anchors,origin,founded,named,former,score};}return best;}
  fetchAutomaticHistory=async function(street,city){
    let base=null;try{base=await previousFetchAutomaticHistory(street,city);}catch(e){console.warn('Base lookup failed:',e);}
    let ev=null;try{ev=await findEvidence(street,city);}catch(e){console.warn('Wikipedia street-scope validation failed:',e);}
    const trusted=trustedBase(base);
    if(!ev){
      if(trusted)return base;
      // A generic Wikipedia/Wikidata hit without a street-identifying sentence is not historical evidence.
      return base?{...base,origin:'לא נמצא במקורות שנבדקו',foundedYear:null,namedYear:null,formerNames:[],description:base?.officialStreetVerified?'הרחוב מופיע במאגר הרחובות הרשמי, אך לא נמצא עבורו מידע היסטורי מאומת במקורות שנבדקו.':'לא נמצא מידע היסטורי מאומת המתייחס במפורש לרחוב המבוקש.',sources:safeBaseSources(base),evidence:{},wikipediaMentionFallback:true,streetScopeValidated:false}:base;
    }
    const evidence={...(trusted?(base?.evidence||{}):{})};
    if(ev.origin)evidence.origin={sentence:ev.origin.sentence,label:`ויקיפדיה — ${ev.article.title}`,url:ev.article.url};
    if(ev.founded)evidence.foundedYear={sentence:ev.founded.sentence,label:`ויקיפדיה — ${ev.article.title}`,url:ev.article.url};
    if(ev.named)evidence.namedYear={sentence:ev.named.sentence,label:`ויקיפדיה — ${ev.article.title}`,url:ev.article.url};
    if(ev.former.length)evidence.formerNames=ev.former.map(x=>({value:x.value,sentence:x.sentence,label:`ויקיפדיה — ${ev.article.title}`,url:ev.article.url}));
    const safeFormer=ev.former.map(x=>x.value);
    return{...(base||{}),origin:trusted&&useful(base?.origin)?base.origin:(ev.origin?`לפי ויקיפדיה: ${ev.origin.sentence}`:'לא נמצא במקורות שנבדקו'),foundedYear:trusted&&base?.foundedYear?base.foundedYear:(ev.founded?.value||null),namedYear:trusted&&base?.namedYear?base.namedYear:(ev.named?.value||null),formerNames:trusted&&base?.formerNames?.length?base.formerNames:safeFormer,description:trusted&&useful(base?.description)?base.description:ev.anchors.slice(0,4).join(' ').slice(0,1100),sources:uniqSources([...(trusted?(base?.sources||[]):safeBaseSources(base)),{label:`ויקיפדיה — קטע מאומת על הרחוב מתוך ${ev.article.title}`,url:ev.article.url}]),evidence,automatic:true,wikipediaMentionFallback:true,streetScopeValidated:true,strictRoadYearEvidence:true,planningYearsRejected:true};
  };
})();
