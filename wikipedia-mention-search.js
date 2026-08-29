// Wikipedia mention fallback for streets that do not have a standalone article under the entered name.
// v25: searches broadly, validates city/street strictly, uses context around the street mention,
// extracts explicit naming/opening facts, and rejects sentence fragments as former street names.
(function () {
  if (typeof fetchAutomaticHistory !== 'function') return;
  const previousFetchAutomaticHistory = fetchAutomaticHistory;
  const WP_API = 'https://he.wikipedia.org/w/api.php';

  function clean(v){return String(v||'').replace(/\[[0-9]+\]/g,'').replace(/\s+/g,' ').trim();}
  function norm(v){return clean(v).replace(/["׳״'־–—-]/g,' ').replace(/^(רחוב|שדרות|שדרה|דרך|כביש|סמטה|סמטת)\s+/u,'').replace(/\s+/g,' ').trim().toLowerCase();}
  function cityAliases(city){const n=norm(city);if(n==='ירושלים')return['ירושלים'];if(n==='תל אביב'||n==='תל אביב יפו')return['תל אביב','תל אביב יפו'];return n?[n]:[];}
  function cityMatches(text,city){const n=norm(text);return cityAliases(city).some(a=>n.includes(norm(a)));}
  function streetTokens(street){return [...new Set(norm(street).match(/[א-ת]+/gu)?.filter(t=>t.length>=2)||[])];}
  function streetMatches(text,street){const n=norm(text),t=streetTokens(street);return t.length>0&&t.every(x=>n.includes(x));}
  function sentences(text){return clean(text).split(/(?<=[.!?])\s+(?=[א-ת"׳״])/u).map(s=>s.trim()).filter(s=>s.length>=12&&s.length<=1100);}

  function contextSentences(text,street,city){
    const all=sentences(text);
    const cityInLead=cityMatches(text.slice(0,2600),city);
    const indexes=[];
    all.forEach((s,i)=>{if(streetMatches(s,street))indexes.push(i);});
    const picked=[];
    for(const i of indexes){
      for(let j=Math.max(0,i-2);j<=Math.min(all.length-1,i+3);j++){
        const s=all[j];
        if((cityMatches(s,city)||cityInLead)&&!picked.includes(s))picked.push(s);
      }
    }
    return picked.slice(0,16);
  }

  function originFrom(list,street){
    const direct=list.find(s=>streetMatches(s,street)&&/(?:נקרא|נקראת|קרוי|קרויה|נקראות|נקראים|מכונה|מכונה גם)[^.!?]{0,220}(?:על שם|על־שם|על שמו|על שמה|לזכר|מנציח)/u.test(s));
    if(direct)return direct;
    return list.find(s=>/(?:הכביש|הרחוב|הדרך|השדרה|הציר)[^.!?]{0,180}(?:נקרא|נקראת|קרוי|קרויה|מכונה)[^.!?]{0,220}(?:על שם|על־שם|על שמו|על שמה|לזכר|מנציח)/u.test(s))||null;
  }

  function yearByPatterns(text,patterns){const s=clean(text);for(const p of patterns){const m=s.match(p);if(m?.[1])return m[1];}return null;}
  function foundedFrom(text){return yearByPatterns(text,[
    /(?:נחנך|נחנכה|נפתח|נפתחה|נסלל|נסללה|הוקם|הוקמה|הושלם|הושלמה)[^.!?]{0,180}?(?:בשנת|ב־|ב-)?\s*(18\d{2}|19\d{2}|20\d{2})/u,
    /(?:בשנת|ב־|ב-)\s*(18\d{2}|19\d{2}|20\d{2})[^.!?]{0,180}?(?:נחנך|נחנכה|נפתח|נפתחה|נסלל|נסללה|הוקם|הוקמה|הושלם|הושלמה)/u,
    /(?:חנוכת|פתיחת|סלילת|הקמת|השלמת)[^.!?]{0,180}?(18\d{2}|19\d{2}|20\d{2})/u,
    /(?:ביוני|בינואר|בפברואר|במרץ|באפריל|במאי|ביולי|באוגוסט|בספטמבר|באוקטובר|בנובמבר|בדצמבר)\s+(18\d{2}|19\d{2}|20\d{2})[^.!?]{0,120}?(?:נחנך|נפתח|הושלם)/u
  ]);}

  function namedFrom(text){return yearByPatterns(text,[
    /(?:נקרא|נקראה|נקבע|נקבעה|הוענק|ניתן|שונה שמו|שונה שמה)[^.!?]{0,220}?(?:השם|על שם|על־שם|על שמו|על שמה)?[^.!?]{0,120}?(?:בשנת|ב־|ב-)\s*(18\d{2}|19\d{2}|20\d{2})/u,
    /(?:בשנת|ב־|ב-)\s*(18\d{2}|19\d{2}|20\d{2})[^.!?]{0,220}?(?:נקרא|נקראה|נקבע|נקבעה|הוענק|ניתן|שונה שמו|שונה שמה)[^.!?]{0,100}?(?:השם|על שם|על־שם|על שמו|על שמה)/u
  ]);}

  function plausibleFormerName(v,street){
    let c=clean(v).replace(/^["״']+|["״']+$/g,'').trim();
    c=c.replace(/^(?:בשם|כ|בכינוי)\s+/u,'').trim();
    if(!c||c.length<2||c.length>48)return null;
    if(/[.!?:;,()\[\]{}]/u.test(c))return null;
    if(/\d{4}/u.test(c))return null;
    if(/\b(?:בשנת|לאחר|כאשר|שבו|שבה|אשר|עקב|בגלל|במהלך|נחנך|נחנכה|נסלל|נסללה|נקרא|נקראה|שונה|הוחלף|הוחלפה|הוקם|הוקמה|הוביל|הובילה|היה|הייתה|הינו|הינה|הוא|היא)\b/u.test(c))return null;
    const words=c.split(/\s+/);
    if(words.length>6)return null;
    if(norm(c)===norm(street))return null;
    // A former street name should look like a proper short name, preferably with a road-type word.
    const roadish=/^(?:רחוב|שדרות|שדרה|דרך|כביש|סמטה|סמטת)\s+/u.test(c);
    const shortProper=words.length<=4&&!/^(?:של|את|אל|על|מן|עם|בו|בה|בין|ליד|לאורך)\b/u.test(c);
    return (roadish||shortProper)?c:null;
  }

  function formerFrom(text,street){
    const out=[]; const add=v=>{const c=plausibleFormerName(v,street);if(c&&!out.includes(c))out.push(c);};
    const s=clean(text);
    const patterns=[
      /(?:נקרא|נקראה)\s+(?:בעבר|קודם לכן|לפני כן|תחילה|בראשיתו|בראשיתה)\s+["״']?([^"״'.;,]{2,48})["״']?/gu,
      /(?:שמו|שמה)\s+(?:הקודם|הקודמת)\s+(?:היה|הייתה)\s+["״']?([^"״'.;,]{2,48})["״']?/gu,
      /(?:שונה|הוחלף|הוסב)\s+(?:שמו|שמה)\s+מ[־-]?["״']?([^"״'.;,]{2,48})["״']?\s+(?:ל|אל)/gu,
      /(?:היה מוכר|הייתה מוכרת|נודע|נודעה)\s+(?:בעבר\s+)?(?:כ|בשם)\s*["״']?([^"״'.;,]{2,48})["״']?/gu
    ];
    for(const p of patterns)for(const m of s.matchAll(p))add(m[1]);
    return out.slice(0,4);
  }

  function useful(v){const t=clean(v);return Boolean(t)&&!t.includes('לא נמצא');}
  function uniqSources(items){const seen=new Set();return(items||[]).filter(i=>{if(!i)return false;const k=typeof i==='string'?i:`${i.url||''}|${i.label||''}`;if(seen.has(k))return false;seen.add(k);return true;});}

  async function searchMentions(street,city){
    const base=norm(street);
    const searches=[...new Set([`${base} ${city}`,`"${base}" ${city}`,base,`"רחוב ${base}" ${city}`,`"דרך ${base}" ${city}`,`"שדרות ${base}" ${city}`,`"כביש ${base}" ${city}`])];
    const results=[];
    for(const query of searches){
      const params=new URLSearchParams({action:'query',list:'search',srsearch:query,srlimit:'10',srnamespace:'0',format:'json',origin:'*'});
      try{const data=await fetchJson(`${WP_API}?${params}`,`wp-mention-v25:${query}`);for(const item of data?.query?.search||[])if(!results.some(r=>r.title===item.title))results.push(item);}catch(e){console.warn('Wikipedia mention search failed:',e);}
    }
    return results.slice(0,24);
  }

  async function fetchArticle(title){
    const params=new URLSearchParams({action:'query',prop:'extracts|info',explaintext:'1',inprop:'url',titles:title,format:'json',origin:'*'});
    const data=await fetchJson(`${WP_API}?${params}`,`wp-mention-article-v25:${title}`);
    const page=Object.values(data?.query?.pages||{})[0];
    if(!page||page.missing!==undefined||!page.extract)return null;
    return{title:page.title,text:clean(page.extract),url:page.fullurl};
  }

  async function findMentionEvidence(street,city){
    const candidates=await searchMentions(street,city); let best=null;
    for(const candidate of candidates){
      let article; try{article=await fetchArticle(candidate.title);}catch(_){continue;}
      if(!article||!cityMatches(article.text.slice(0,3200),city)||!streetMatches(article.text,street))continue;
      const ctx=contextSentences(article.text,street,city); if(!ctx.length)continue;
      const joined=ctx.join(' ');
      const evidence={article,ctx,originSentence:originFrom(ctx,street),foundedYear:foundedFrom(joined),namedYear:namedFrom(joined),formerNames:formerFrom(joined,street)};
      const score=(evidence.originSentence?5:0)+(evidence.foundedYear?4:0)+(evidence.namedYear?4:0)+(evidence.formerNames.length?2:0)+Math.min(ctx.length,4);
      if(!best||score>best.score)best={...evidence,score};
    }
    return best;
  }

  fetchAutomaticHistory=async function(street,city){
    let base=null; try{base=await previousFetchAutomaticHistory(street,city);}catch(e){console.warn('Base lookup failed:',e);}
    const needs=!base||!useful(base.origin)||!useful(base.description)||!base.foundedYear||!base.namedYear||!(base.formerNames?.length);
    if(!needs)return base;
    let ev=null; try{ev=await findMentionEvidence(street,city);}catch(e){console.warn('Wikipedia mention fallback failed:',e);}
    if(!ev)return base;

    // Never preserve a suspicious fragment from an earlier extractor just because it is non-empty.
    const safeBaseFormer=(base?.formerNames||[]).map(v=>plausibleFormerName(v,street)).filter(Boolean);
    const description=ev.ctx.slice(0,6).join(' ').slice(0,1250);
    return{
      ...(base||{}),
      origin:useful(base?.origin)?base.origin:(ev.originSentence?`לפי ויקיפדיה: ${ev.originSentence}`:'לא נמצא במקורות שנבדקו'),
      foundedYear:base?.foundedYear||ev.foundedYear||null,
      namedYear:base?.namedYear||ev.namedYear||null,
      formerNames:ev.formerNames.length?ev.formerNames:safeBaseFormer,
      description:useful(base?.description)?base.description:description,
      sources:uniqSources([...(base?.sources||[]),{label:`ויקיפדיה — אזכור מאומת ב${ev.article.title}`,url:ev.article.url}]),
      automatic:true,
      wikipediaMentionFallback:true
    };
  };
})();
