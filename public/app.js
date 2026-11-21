const paths={pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',book:'M12 5v16 M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-6-2-10 1',percent:'M5 20 19 4 M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M21 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M18 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87',store:'M3 10v11h18V10 M2 10l3-7h14l3 7 M2 10c1 4 5 4 5 0 1 4 5 4 5 0 1 4 5 4 5 0 1 4 5 4 5 0 M9 21v-7h6v7',bulb:'M9 18h6 M9 22h6 M8 14a7 7 0 1 1 8 0l-1 4H9l-1-4 M12 1v-1 M2 6 0 5 M24 5l-2 1',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',menu:'M3 6h18 M3 12h18 M3 18h18',leaf:'M20 3C8 1 2 7 5 15s17 4 15-12Z M4 22 16 8',coffee:'M5 3h12v12a6 6 0 0 1-12 0V3 M17 5h2a3 3 0 0 1 0 6h-2 M3 22h16',check:'M5 12l4 4L20 5',grad:'M1 8l11-5 11 5-11 5L1 8 M5 10v7c4 3 10 3 14 0v-7 M23 8v9'};
function icon(name){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.leaf}"/></svg>`}function hydrate(){document.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon))}
let services=SiteStore.state.services;
let titles=Object.fromEntries(services.map(s=>[s[0],s[2]]));
let base=SiteStore.state.items;
let additions=SiteStore.remote?[]:JSON.parse(localStorage.getItem('sai-additions')||'[]');
let communityProjects=[];
let communityDisplayItems=[];
let items=[...base,...additions],favorites=JSON.parse(localStorage.getItem('sai-favorites')||'[]'),route='',category='الكل',query='';
const main=document.getElementById('main');
const COMMUNITY_API=String(window.SAI_API_BASE||'https://saee-plus-api.ligagym.workers.dev').replace(/\/$/,'');
function isSignedIn(){return !!window.SAI_CURRENT_USER;}
function accountToken(){try{return localStorage.getItem('saee-auth-token-v1')||'';}catch(_){return '';}}
async function communityRequest(path,options={}){
  const headers=new Headers(options.headers||{});
  if(options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  const token=accountToken();if(token)headers.set('Authorization','Bearer '+token);
  let response;try{response=await fetch(COMMUNITY_API+path,{...options,headers,credentials:'include',cache:'no-store'});}catch(_){throw Error('تعذر الاتصال بخادم المشاريع. تحقق من نشر Cloudflare Worker.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||`تعذر تنفيذ الطلب (HTTP ${response.status}).`);
  return data;
}
function placementSections(placement){
  if(placement==='projects_opportunities')return ['projects','opportunities'];
  if(placement==='opportunities')return ['opportunities'];
  if(placement==='opportunities_discounts')return ['opportunities','discounts'];
  return ['projects'];
}
function mapCommunityProject(project,type){
  return {id:`community_${project.id}_${type}`,communityId:project.id,isCommunityProject:true,isOwner:!!project.is_owner,type,title:project.title,cat:project.field||'مشاريع شبابية',desc:project.description,badge:project.entity_name||'مشروع شبابي',meta:project.project_type||'مشاركة شبابية',extra:project.description,image:project.image_url||'',phone:project.phone||'',contact:project.contact||'',instagramUrl:project.instagram_url||'',facebookUrl:project.facebook_url||'',entityName:project.entity_name||'',ownerName:project.owner_name||'',placement:project.placement||'projects',status:'approved',emoji:'✦'};
}
function rebuildVisibleItems(){items=[...base,...additions,...communityDisplayItems];}
async function refreshCommunityProjects(){
  try{
    const data=await communityRequest('/api/community-projects');
    communityProjects=Array.isArray(data.projects)?data.projects:[];
    communityDisplayItems=communityProjects.flatMap(project=>placementSections(project.placement).map(type=>mapCommunityProject(project,type)));
    rebuildVisibleItems();
    if(route==='projects'||route==='discounts')listing();
    else if(route==='opportunities')opportunitiesPage();
    else if(route==='home')home();
  }catch(error){console.warn('تعذر تحميل مشاريع المجتمع:',error);}
}
window.addEventListener('sai-account-changed',()=>{refreshCommunityProjects();});
window.addEventListener('focus',()=>{refreshCommunityProjects();});
setInterval(()=>{if(document.visibilityState==='visible')refreshCommunityProjects();},60000);
function serviceCards(){return services.filter(s=>!SiteStore.state.hidden.includes(s[0])).map(s=>`<a class="service-card" href="#${s[0]}"><div class="service-icon">${icon(s[1])}</div><h3>${escapeHtml(s[2])}</h3><p>${escapeHtml(s[3])}</p><span class="card-arrow">↖</span></a>`).join('')}
function card(x){return `<article class="offer-card"><div class="photo-wrap">${x.image?`<img src="${escapeHtml(SiteStore.imageSrc(x.image))}" alt="${escapeHtml(x.title)}" loading="lazy">`:`<div class="expert-avatar">${escapeHtml(x.emoji||'✦')}</div>`}<span class="offer-tag">${escapeHtml(x.badge||'إضافة مجتمعية')}</span><button class="heart ${favorites.includes(x.id)?'saved':''}" onclick="saveFavorite('${x.id}',this)" aria-label="حفظ ${escapeHtml(x.title)} في المفضلة" aria-pressed="${favorites.includes(x.id)}">${icon('heart')}</button>${x.isCommunityProject&&x.isOwner?`<button type="button" class="community-edit-card" onclick="editCommunityProject('${escapeHtml(x.communityId)}')" style="position:absolute;left:10px;bottom:10px;border:0;border-radius:9px;padding:7px 10px;background:#075550;color:white;font-weight:700;cursor:pointer">تعديل مشروعي</button>`:''}</div><div class="card-body"><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.desc)}</p><div class="card-foot"><span class="${x.price?'price':'tag'}">${escapeHtml(x.price||x.meta||x.cat)}</span><button class="details-btn" onclick="details('${x.id}')">التفاصيل ↖</button></div></div></article>`}
function home(){main.innerHTML=`<div class="container"><section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="dot"></span> من جامعتك.. لمجتمعك</div><h1>كل احتياجاتك،<br>وفرصك <em>في مكان واحد.</em></h1><p>سعي بلس يجمع عالمك الجامعي ومجتمعك المحلي في مساحة واحدة. اكتشف، تواصل، وشارك.. لأن كل سعي صغير يصنع فرقًا.</p><div class="hero-buttons"><a class="button" href="#services">اكتشف خدماتنا <span>↖</span></a><a class="button light" href="#about">تعرّف على سعي بلس</a></div><div class="hero-trust"><div class="avatar-stack"><i>🌱</i><i>🎓</i><i>☕</i></div><span>للطلاب، والمبدعين، وكل من يسعى للأفضل.</span></div></div><div class="hero-visual"><img class="campus-photo" src="assets/campus.jpg" alt="مساحة جامعية خضراء ومباني تعليمية"><div class="visual-tint"></div><div class="floating float-one"><span class="bubble">${icon('book')}</span><div><b>كتابك فرصة لغيرك</b><small>شارك المعرفة، واصنع أثرًا.</small></div></div><div class="floating float-two"><span class="bubble">${icon('percent')}</span><div><b>عروض تناسب يومك</b><small>خصومات من محيط جامعتك</small></div></div><div class="visual-caption"><small>خطوتك الجاية تبدأ من هنا</small><p>أقرب لجامعتك.<br>أقرب لفرصك.</p></div></div></section><div class="community-strip"><div>${icon('grad')}<span><strong>حياة جامعية أسهل</strong><small>خدمات ترافقك كل يوم</small></span></div><div>${icon('users')}<span><strong>مجتمع أقرب لك</strong><small>تواصل، تعلّم، وشارك</small></span></div><div>${icon('leaf')}<span><strong>أثر يبدأ بخطوة</strong><small>فرص صغيرة، أثر كبير</small></span></div></div><section class="services"><div class="section-head"><div><span class="kicker">مساحات صُممت لك</span><h2>وش حاب تسعى له اليوم؟</h2><p>ست خدمات، وكل خدمة تفتح لك بابًا جديدًا.</p></div><span class="arrow-link">كل احتياجاتك، هنا ${icon('leaf')}</span></div><div class="services-grid">${serviceCards()}</div></section></div><section class="offers-section"><div class="container"><div class="section-head"><div><span class="kicker">فرص قريبة، وفائدة أكبر</span><h2>وفّر أكثر، واستمتع بيومك</h2></div><a class="arrow-link" href="#discounts">كل الخصومات <span>←</span></a></div><div class="offers-grid">${items.filter(x=>x.type==='discounts').slice(0,3).map(card).join('')}</div><p style="color:#8b947f;font-size:10px;margin:14px 0 0">العروض المعروضة أمثلة توضيحية لتجربة الموقع.</p></div></section><div class="container"><section id="about" class="intro"><span class="kicker">لماذا سعي بلس؟</span><h2>لأن الفرص تكبر، عندما نتشاركها.</h2><p>سعي بلس منصة تجمع الطالب ومجتمعه المحلي: من الوصول إلى مرافق الجامعة، إلى تبادل الكتب، ودعم المشاريع الصغيرة والاستفادة من خبرات الآخرين. نؤمن أن المعرفة أقرب عندما تُشارك، وأن لكل فكرة فرصة تستحقها.</p></section><section class="join-banner"><div><h2>عندك شيء يستحق المشاركة؟</h2><p>كتاب، منتج، خبرة أو فكرة مشروع.. خلّ سعيك يوصل لغيرك.</p></div>${isSignedIn()?'<button class="button" onclick="addForm(\'projects\')">أضف مشروعك <span>↖</span></button>':'<a class="button light" href="#projects">استكشف المشاريع <span>↖</span></a>'}</section></div>`}
function headerPage(name,desc,action=''){return `<div class="page-head"><div class="breadcrumbs"><a href="#home">الرئيسية</a> / ${escapeHtml(name)}</div><div class="page-title-row"><div><span class="kicker">من جامعتك، إلى مجتمعك</span><h1>${escapeHtml(name)}</h1><p>${escapeHtml(desc)}</p></div>${action}</div></div>`}
let descriptions=SiteStore.state.descriptions;
function listing(){const cats=['الكل',...new Set(items.filter(x=>x.type===route).map(x=>x.cat))];let add='';if(route==='projects'){add=`<button class="button small" onclick="addForm('projects')">+ أضف مشروعك</button>`;}else if(route!=='discounts'){add=`<button class="button small" onclick="addForm('${route}')">+ ${route==='library'?'أضف كتابك':route==='market'?'أضف منتجك':'شارك خبرتك'}</button>`;}main.innerHTML=`<div class="container">${headerPage(titles[route],descriptions[route],add)}${SiteStore.state.notice?`<div class="demo-note">${escapeHtml(SiteStore.state.notice)}</div>`:""}<div class="toolbar"><div class="chips">${cats.map((c,ci)=>`<button class="chip ${c===category?'selected':''}" onclick="filterCategoryByIndex(${ci})">${escapeHtml(c)}</button>`).join('')}</div><label class="search-box">${icon('search')}<input aria-label="البحث" placeholder="ابحث في ${escapeHtml(titles[route])}..." id="search" value="${escapeHtml(query)}" oninput="query=this.value;renderItems()"></label></div><div class="list-grid" id="results"></div></div>`;renderItems()}
function renderItems(){let filtered=items.filter(x=>x.type===route&&(route!=='projects'||!x.status||x.status==='approved')&&(category==='الكل'||x.cat===category)&&`${x.title} ${x.desc}`.includes(query));document.getElementById('results').innerHTML=filtered.length?filtered.map(card).join(''):'<div class="empty">لا توجد نتائج مطابقة. جرّب كلمة أخرى أو اختر «الكل».</div>'}
function filterCategoryByIndex(i){let cats=['الكل',...new Set(items.filter(x=>x.type===route).map(x=>x.cat))];filterCategory(cats[i])}
function filterCategory(c){category=c;listing()}
let places=SiteStore.state.places;let place=0,mapCat='الكل';
function mapPage(){if(place>=places.length)place=0;let shown=places.map((p,i)=>({...p,i})).filter(p=>mapCat==='الكل'||p.cat===mapCat);main.innerHTML=`<div class="container">${headerPage(titles.map,descriptions.map)}${SiteStore.state.mapNotice?`<div class="demo-note">${escapeHtml(SiteStore.state.mapNotice)}</div>`:""}<div class="toolbar"><div class="chips">${['الكل',...new Set(places.map(p=>p.cat))].map((c,ci)=>`<button class="chip ${c===mapCat?'selected':''}" onclick="mapCategory(${ci})">${escapeHtml(c)}</button>`).join('')}</div></div><div class="map-layout"><div class="map"><svg class="layout" viewBox="0 0 750 500" preserveAspectRatio="none"><rect width="750" height="500" fill="#e7ecdc"/><g fill="#d0d8bf" stroke="#c4cfb6" stroke-width="2"><rect x="40" y="30" width="150" height="110" rx="7"/><rect x="280" y="25" width="190" height="100" rx="7"/><rect x="560" y="50" width="145" height="90" rx="7"/><rect x="60" y="250" width="130" height="130" rx="7"/><rect x="285" y="205" width="175" height="110" rx="7"/><rect x="560" y="240" width="145" height="115" rx="7"/><rect x="290" y="390" width="170" height="90" rx="7"/></g><g stroke="#fffdf4" stroke-width="30" fill="none"><path d="M225 0v500M515 0v500M0 170h750M0 360h750"/></g><g fill="#b8ccb0"><circle cx="75" cy="443" r="21"/><circle cx="128" cy="450" r="16"/><circle cx="640" cy="440" r="30"/><circle cx="700" cy="420" r="18"/></g></svg>${shown.map(p=>`<button class="map-pin" style="left:${p.x}%;top:${p.y}%" onclick="place=${p.i};mapPage()" aria-label="${escapeHtml(p.name)}">${icon(p.icon)}</button>`).join('')}<span class="map-label">مخطط الحرم الجامعي · نموذج توضيحي</span></div><aside class="map-places">${shown.map(p=>`<button class="place-card ${p.i===place?'selected':''}" onclick="place=${p.i};mapPage()"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.cat)} · اعرض التفاصيل ←</p></button>`).join('')}<div class="map-detail"><span class="kicker">وجهتك المختارة</span><h3>${escapeHtml(places[place]?.name||'لا توجد أماكن بعد')}</h3><p>${escapeHtml(places[place]?.desc||'أضف أماكن من لوحة الإدارة.')}</p></div></aside></div></div>`}
function mapCategory(i){mapCat=['الكل',...new Set(places.map(p=>p.cat))][i];mapPage()}
function aboutSocialInfo(rawUrl){let host='';try{host=new URL(rawUrl).hostname.toLowerCase().replace(/^www\./,'')}catch{}const map=[[/instagram\.com$/,'Instagram','instagram'],[/facebook\.com$/,'Facebook','facebook'],[/fb\.com$/,'Facebook','facebook'],[/google\.com$|goo\.gl$|maps\.app\.goo\.gl$/,'Google','google'],[/youtube\.com$|youtu\.be$/,'YouTube','youtube'],[/tiktok\.com$/,'TikTok','tiktok'],[/linkedin\.com$/,'LinkedIn','linkedin'],[/(^|\.)x\.com$|twitter\.com$/,'X','x'],[/whatsapp\.com$|wa\.me$/,'WhatsApp','whatsapp']];for(const [re,name,kind] of map)if(re.test(host))return{name,kind};return{name:'زيارة الرابط',kind:'link'}}
function aboutSocialIcon(kind){const common='viewBox="0 0 48 48" role="img" focusable="false"';const paths={instagram:`<rect x="8" y="8" width="32" height="32" rx="10" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="24" cy="24" r="8" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="34" cy="14" r="2.7" fill="currentColor"/>`,facebook:`<path fill="currentColor" d="M27.5 43V26h5.8l.9-7h-6.7v-4.5c0-2 .6-3.4 3.4-3.4h3.6V4.8c-.6-.1-2.8-.3-5.4-.3-5.4 0-9.1 3.3-9.1 9.4V19h-6.1v7h6.1v17z"/>`,google:`<path fill="#4285F4" d="M43 24.5c0-1.3-.1-2.5-.4-3.7H24v7h10.7a9.2 9.2 0 0 1-4 6.1v5h6.4C40.8 35.5 43 30.4 43 24.5z"/><path fill="#34A853" d="M24 44c5.4 0 9.9-1.8 13.2-5.1l-6.4-5c-1.8 1.2-4 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H6.2v5.2A20 20 0 0 0 24 44z"/><path fill="#FBBC05" d="M12.8 27.7a12 12 0 0 1 0-7.4v-5.2H6.2a20 20 0 0 0 0 17.8z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.2 29.4 4 24 4A20 20 0 0 0 6.2 15.1l6.6 5.2C14.4 15.6 18.8 12.1 24 12.1z"/>`,youtube:`<rect x="4" y="11" width="40" height="26" rx="8" fill="currentColor"/><path d="m20 17 12 7-12 7z" fill="#fff"/>`,tiktok:`<path fill="currentColor" d="M29 5h7c.4 4 2.7 6.8 7 7.5v7c-3.1-.1-6-1.1-8.5-2.8v13.1c0 7.3-5.8 12.2-12.5 12.2-6.2 0-11-4.7-11-10.8 0-7.3 6.4-12.1 13.2-10.8v7.2c-3.8-1.2-6.3.7-6.3 3.7 0 2.2 1.7 3.9 4.1 3.9 2.6 0 4.1-1.8 4.1-4.8z"/>`,linkedin:`<path fill="currentColor" d="M8 17h7v23H8zM11.5 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8M19 17h6.7v3.1h.1c.9-1.7 3.2-3.6 6.6-3.6 7.1 0 8.4 4.7 8.4 10.8V40h-7V29.1c0-2.6 0-5.9-3.6-5.9s-4.2 2.8-4.2 5.7V40h-7z"/>`,x:`<path fill="currentColor" d="M7 6h9.5l8.1 11 9.4-11H41L28 21.2 42 42h-9.5l-9-12.3L13 42H6l13.4-15.8z"/>`,whatsapp:`<path fill="currentColor" d="M24 5a18 18 0 0 0-15.4 27.3L6 42l10-2.6A18 18 0 1 0 24 5zm0 32a14 14 0 0 1-7.1-1.9l-.5-.3-5.9 1.5 1.6-5.7-.4-.6A14 14 0 1 1 24 37zm7.7-10.5c-.4-.2-2.4-1.2-2.8-1.3-.4-.1-.7-.2-1 .2-.3.4-1.1 1.3-1.4 1.6-.3.3-.5.3-.9.1-.4-.2-1.7-.6-3.3-2-1.2-1-2-2.3-2.2-2.7-.2-.4 0-.6.2-.8l.6-.7.4-.7c.1-.3 0-.5 0-.7l-1.3-3.1c-.3-.8-.7-.7-1-.7h-.8c-.3 0-.7.1-1.1.5-.4.4-1.5 1.5-1.5 3.6s1.5 4.1 1.7 4.4c.2.3 3 4.6 7.2 6.4 1 .4 1.8.7 2.4.8 1 .3 1.9.2 2.6.1.8-.1 2.4-1 2.7-2 .3-1 .3-1.8.2-2-.1-.2-.4-.3-.8-.5z"/>`,link:`<path fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" d="M19 29l-3 3a8 8 0 0 1-11-11l8-8a8 8 0 0 1 11 0m5 6 3-3a8 8 0 0 1 11 11l-8 8a8 8 0 0 1-11 0m-8-7 16-16"/>`};return `<svg ${common} aria-hidden="true">${paths[kind]||paths.link}</svg>`}
function aboutPage(){const a=SiteStore.state.aboutPage||{};const links=Array.isArray(a.links)?a.links:[];main.innerHTML=`<div class="container about-page"><section class="about-page-card"><span class="kicker">سعي بلس · مبادرة مجتمعية</span><h1>${escapeHtml(a.heading||'من هي مبادرة سعي')}</h1><div class="about-page-body">${escapeHtml(a.body||'').replace(/\n/g,'<br>')}</div>${links.length?`<div class="about-page-links"><h2>روابط تهمك</h2><div class="about-links-grid">${links.map(link=>{const url=String(link.url||'').trim();const safe=/^https?:\/\//i.test(url)?url:'';if(!safe)return '';const platform=aboutSocialInfo(safe);const label=String(link.title||platform.name);return `<div class="about-link-card about-link-${platform.kind}"><strong class="about-link-title">${escapeHtml(label)}</strong><a class="about-link-icon-link" href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer" aria-label="فتح صفحة ${escapeHtml(platform.name)} في تبويب جديد">${aboutSocialIcon(platform.kind)}</a></div>`}).join('')}</div></div>`:''}</section></div>`}
async function opportunitiesPage(){const d=SiteStore.state;const safeUrl=/^https?:\/\//i.test(d.nahnoUrl||'')?d.nahnoUrl:'';const community=communityDisplayItems.filter(x=>x.type==='opportunities');const adminOpportunities=(d.opportunities||[]).map(o=>`<article class="offer-card"><div class="card-body"><h3>${escapeHtml(o.title)}</h3><p>📍 ${escapeHtml(o.city||'')} ${escapeHtml(o.place||'')}</p><p>📅 ${escapeHtml(o.date||'')}</p><p>🕒 ${escapeHtml(o.start||'')} – ${escapeHtml(o.end||'')}</p></div></article>`).join('');main.innerHTML=`<div class="container"><div class="page-head"><span class="kicker">فرص سعي</span><h1>فرص سعي</h1><p>اكتشف الفرص المتاحة ومواعيدها وأماكن إقامتها، وتعرّف إلى المشاريع والجهات المشاركة.</p></div><section class="about-page-card" style="text-align:center;margin-bottom:24px"><h1 style="font-size:clamp(26px,4vw,42px)">للتسجيل على هذه الفرص على منصة نحن</h1>${safeUrl?`<a class="button" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">رابط منصة نحن ↗</a>`:'<p>سيتم إضافة رابط منصة نحن قريبًا.</p>'}</section><div class="list-grid">${adminOpportunities}${community.map(card).join('')||(!adminOpportunities?'<div class="empty">لا توجد فرص منشورة حاليًا.</div>':'')}</div></div>`}
async function siteRatingPage(){main.innerHTML=`<div class="container"><div class="page-head"><span class="kicker">رأيك يهمنا</span><h1>تقييم الموقع</h1><p>ساعدنا على تطوير سعي بلس من خلال تقييمك وملاحظاتك.</p></div><section class="about-page-card" style="max-width:680px;margin:auto"><form id="site-rating-form" class="admin-form"><label>تقييمك بالنجوم</label><div id="rating-stars" style="display:flex;gap:10px;justify-content:center;font-size:40px;direction:ltr"><button type="button" data-star="1" aria-label="نجمة واحدة">☆</button><button type="button" data-star="2" aria-label="نجمتان">☆</button><button type="button" data-star="3" aria-label="ثلاث نجوم">☆</button><button type="button" data-star="4" aria-label="أربع نجوم">☆</button><button type="button" data-star="5" aria-label="خمس نجوم">☆</button></div><input type="hidden" name="stars" value="0"><label>ملاحظاتك<textarea name="comment" rows="5" maxlength="1500" placeholder="اكتب ملاحظاتك أو اقتراحاتك..."></textarea></label><button class="button" type="submit">إرسال التقييم</button><p id="rating-feedback" role="status"></p></form></section></div>`;let selected=0;const form=document.getElementById('site-rating-form');const buttons=[...document.querySelectorAll('[data-star]')];function paint(n){buttons.forEach(b=>b.textContent=Number(b.dataset.star)<=n?'★':'☆');form.elements.stars.value=n;}buttons.forEach(b=>b.addEventListener('click',()=>{selected=Number(b.dataset.star);paint(selected)}));form.addEventListener('submit',async e=>{e.preventDefault();const feedback=document.getElementById('rating-feedback');if(!selected){feedback.textContent='يرجى اختيار تقييم من نجمة إلى خمس نجوم.';return;}try{const r=await fetch(`${String(window.SAI_API_BASE||'https://saee-plus-api.ligagym.workers.dev').replace(/\/$/,'')}/api/ratings`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stars:selected,comment:form.elements.comment.value.trim()})});const data=await r.json();if(!r.ok)throw Error(data.error||'تعذر إرسال التقييم');form.reset();selected=0;paint(0);feedback.textContent='شكرًا لك! تم استلام تقييمك.';}catch(err){feedback.textContent=err.message+' — تأكد من نشر تحديث الخادم.';}})}
function render(){route=location.hash.slice(1)||'home';if(route==='about'){aboutPage()}else if(route==='opportunities'){opportunitiesPage()}else if(route==='site-rating'){siteRatingPage()}else if(route==='home')home();else if(route==='services'){main.innerHTML=`<div class="container">${headerPage('خدمات سعي بلس','كل احتياجاتك وفرصك في مكان واحد. اختر المساحة التي تناسبك.')}<div class="services-grid" style="margin:20px 0 65px">${serviceCards()}</div></div>`}else if(route==='map')mapPage();else if(titles[route])listing();else home();document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.hash===location.hash||(!location.hash&&a.hash==='#home')));document.querySelector('nav').classList.remove('open');hydrate()}
window.addEventListener('hashchange',()=>{category='الكل';query='';render();if(route!=='about')window.scrollTo(0,0)});document.getElementById('year').textContent=new Date().getFullYear();
// Initial page render: the app previously defined render() but did not call it on first load.
// Keep the visible UI in sync when SiteStore finishes loading remote or fallback content.
function syncSiteStoreAndRender(){
  try {
    services = SiteStore.state.services || [];
    titles = Object.fromEntries(services.map(s => [s[0], s[2]]));
    base = SiteStore.state.items || [];
    additions = SiteStore.remote ? [] : JSON.parse(localStorage.getItem('sai-additions') || '[]');
    rebuildVisibleItems();
  } catch (error) {
    console.error('Saee Plus: failed to sync visible content from SiteStore.', error);
  }
  render();
}
window.addEventListener('sai-content-changed', syncSiteStoreAndRender);
syncSiteStoreAndRender();
refreshCommunityProjects();
function toast(t){const e=document.getElementById('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2700)}
function saveFavorite(id,b){favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];localStorage.setItem('sai-favorites',JSON.stringify(favorites));if(b){b.classList.toggle('saved',favorites.includes(id));b.setAttribute('aria-pressed',favorites.includes(id))}toast(favorites.includes(id)?'أُضيفت إلى مفضلتك':'أُزيلت من المفضلة')}
function modal(html){document.getElementById('dialog-content').innerHTML=html;const d=document.getElementById('dialog');if(!d.open)d.showModal()}
const DISCOUNT_COOLDOWN_MS=24*60*60*1000;
const DISCOUNT_API=String(window.SAI_API_BASE||COMMUNITY_API).replace(/\/$/,'');
const discountExpiries=Object.create(null);
let discountLastSync=0,discountSyncing=false;
function discountExpiry(id){const e=Number(discountExpiries[String(id)]||0);return e>Date.now()?e:0}
function formatDiscountRemaining(ms){const total=Math.ceil(ms/1000),h=Math.floor(total/3600),m=Math.floor((total%3600)/60);return `يتفعّل بعد ${h} ساعة و${m} دقيقة`}
function paintDiscountButton(id,button){
  const remaining=Math.max(0,discountExpiry(id)-Date.now());
  if(button.dataset.saving==='1')return;
  button.disabled=remaining>0;
  button.textContent=remaining>0?`✓ تم الخصم · ${formatDiscountRemaining(remaining)}`:'✓ تم الخصم';
  button.title=remaining>0?'تم تسجيل استخدام هذا الخصم على الموقع؛ يرجع يتفعّل بعد 24 ساعة على جميع الأجهزة':'اضغط بعد الاستفادة من الخصم لتسجيله مرة كل 24 ساعة على جميع الأجهزة';
  button.classList.toggle('discount-used',remaining>0);
}
function paintAllDiscountButtons(){document.querySelectorAll('[data-discount-use]').forEach(b=>paintDiscountButton(b.dataset.discountUse,b))}
async function syncDiscountUsage(force){
  if(discountSyncing||(!force&&Date.now()-discountLastSync<4000))return;
  discountSyncing=true;
  try{
    const response=await fetch(`${DISCOUNT_API}/api/discount-usage`,{method:'GET',cache:'no-store',headers:{Accept:'application/json'}});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(body.error||`تعذر تحميل حالة الخصومات (HTTP ${response.status})`);
    for(const k of Object.keys(discountExpiries))delete discountExpiries[k];
    for(const [id,u] of Object.entries(body.usages||{}))if(Number(u.expiresAt)>Date.now())discountExpiries[id]=Number(u.expiresAt);
    discountLastSync=Date.now();
  }catch(error){
    console.warn('تعذر مزامنة استخدام الخصومات:',error);
  }finally{
    discountSyncing=false;
    paintAllDiscountButtons();
  }
}
async function updateDiscountButton(id){
  const button=document.querySelector(`[data-discount-use="${CSS.escape(String(id))}"]`);
  if(button){button.disabled=true;button.textContent='جارٍ التحقق…'}
  await syncDiscountUsage(true);
  if(button)paintDiscountButton(id,button);
}
async function markDiscountUsed(id){
  id=String(id);
  const button=document.querySelector(`[data-discount-use="${CSS.escape(id)}"]`);
  if(!button||button.dataset.saving==='1')return;
  button.dataset.saving='1';button.disabled=true;button.textContent='جارٍ التسجيل…';
  try{
    const response=await fetch(`${DISCOUNT_API}/api/discount-usage`,{
      method:'POST',
      headers:{'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({discountId:id})
    });
    const body=await response.json().catch(()=>({}));
    if(response.status===409){
      if(Number(body.expiresAt)>Date.now())discountExpiries[id]=Number(body.expiresAt);
      toast('تم استخدام هذا الخصم خلال آخر 24 ساعة. جرّب بعد انتهاء المدة.');
    }else if(!response.ok||body.success!==true){
      throw Error(body.error||`تعذر تسجيل الخصم (HTTP ${response.status})`);
    }else{
      discountExpiries[id]=Number(body.expiresAt);
      toast('تم تسجيل الخصم بنجاح. سيعود متاحًا بعد 24 ساعة على جميع الأجهزة.');
    }
  }catch(error){
    toast(error&&error.message&&!/Failed to fetch|NetworkError/i.test(error.message)?error.message:'تعذر الاتصال بالخادم. حاول مرة أخرى.');
  }finally{
    delete button.dataset.saving;
    await syncDiscountUsage(true);
    paintDiscountButton(id,button);
  }
}
setInterval(()=>syncDiscountUsage(false),15000);
window.addEventListener('focus',()=>syncDiscountUsage(true));
function details(id){let x=items.find(x=>x.id===id);if(!x)return;const isDiscount=x.type==='discounts';const displayTitle=titles[x.type]||(x.type==='opportunities'?'فرص سعي':'المحتوى');const locationUrl=String(x.shopLocation||'').trim();const safeLocation=/^https?:\/\//i.test(locationUrl)?locationUrl:'';const socialUrl=String(x.socialLink||'').trim();const safeSocial=/^https?:\/\//i.test(socialUrl)&&!/[<>\"']/.test(socialUrl)?socialUrl:'';const shopPhotos=(Array.isArray(x.shopImages)&&x.shopImages.length?x.shopImages:[x.shopImage1,x.shopImage2]).filter(Boolean);modal(`<span class="kicker">${displayTitle} · التفاصيل</span><h2>${escapeHtml(x.title)}</h2>${x.image?`<img src="${escapeHtml(SiteStore.imageSrc(x.image))}" alt="${escapeHtml(x.title)}" style="width:100%;height:180px;object-fit:cover;border-radius:12px;margin-bottom:12px">`:''}<p>${escapeHtml(x.extra||x.desc)}</p>${isDiscount&&shopPhotos.length?`<div class="discount-shop-photos" style="display:grid;grid-template-columns:repeat(${shopPhotos.length===1?1:2},minmax(0,1fr));gap:10px;margin:14px 0">${shopPhotos.map((src,i)=>`<img src="${escapeHtml(SiteStore.imageSrc(src))}" alt="صورة ${i+1} من ${escapeHtml(x.title)}" style="width:100%;height:160px;object-fit:cover;border-radius:12px;border:1px solid #e1e8df">`).join('')}</div>`:''}${isDiscount?`<p><button type="button" class="button light shop-location-btn" onclick="openShopLocation('${escapeHtml(String(id))}')" ${safeLocation?'':'title="لم يضف المضيف رابط الموقع بعد"'}>📍 ${safeLocation?'عرض موقع المحل':'موقع المحل غير مضاف'}</button></p>`:''}${safeSocial?`<p><a class="button light" href="${escapeHtml(safeSocial)}" target="_blank" rel="noopener noreferrer">↗ زيارة صفحة المتجر / التواصل</a></p>`:''}${x.instagramUrl?`<p><a href="${escapeHtml(x.instagramUrl)}" target="_blank" rel="noopener noreferrer">صفحة إنستغرام</a></p>`:''}${x.facebookUrl?`<p><a href="${escapeHtml(x.facebookUrl)}" target="_blank" rel="noopener noreferrer">صفحة فيسبوك</a></p>`:''}${x.phone?`<p>رقم التواصل: <a href="tel:${escapeHtml(x.phone.replace(/[^+0-9٠-٩۰-۹]/g,''))}" dir="ltr">${escapeHtml(x.phone)}</a></p>`:''}${x.entityName?`<p><strong>الجهة:</strong> ${escapeHtml(x.entityName)}</p>`:''}${x.ownerName?`<p><strong>صاحب المشروع:</strong> ${escapeHtml(x.ownerName)}</p>`:''}${x.price?`<p class="price">السعر التوضيحي: ${escapeHtml(x.price)}</p>`:''}<p>${escapeHtml(x.contact||"لم تُضف بيانات تواصل لهذا الإعلان بعد.")}</p>${x.isCommunityProject&&x.isOwner?`<button type="button" class="button light" onclick="editCommunityProject('${escapeHtml(x.communityId)}')">تعديل مشروعي</button>`:''}<button class="button" onclick="saveFavorite('${id}');this.textContent=favorites.includes('${id}')?'محفوظ في المفضلة ✓':'حفظ في المفضلة'">${favorites.includes(id)?'محفوظ في المفضلة ✓':'حفظ في المفضلة ♡'}</button>`);if(isDiscount)updateDiscountButton(String(id))}
function openShopLocation(id){const x=items.find(item=>String(item.id)===String(id));const url=String(x?.shopLocation||'').trim();if(!/^https?:\/\//i.test(url)){toast('لم يضف المضيف موقع هذا المحل بعد.');return;}window.open(url,'_blank','noopener,noreferrer')}
function showFavorites(){favorites=favorites.filter(id=>items.some(x=>x.id===id));modal(`<span class="kicker">اختياراتك، في مكان واحد</span><h2>المفضلة</h2>${favorites.length?favorites.map(id=>items.find(x=>x.id===id)).filter(Boolean).map(x=>`<button class="place-card" onclick="details('${x.id}')"><h3>${escapeHtml(x.title)}</h3><p>${titles[x.type]} ←</p></button>`).join(''):'<p>مفضلتك فارغة حتى الآن. اضغط على القلب بجانب أي عرض أو كتاب أو منتج لحفظه هنا.</p>'}`)}
function addForm(type){
  if(type==='projects'){
    if(!window.SAI_CURRENT_USER){const authButton=document.getElementById('sai-open-auth');if(authButton)authButton.click();toast('سجّل الدخول أولاً حتى تتمكن من إضافة مشروعك.');return;}
    communityProjectForm();return;
  }
  if(type==='market'||type==='library'){
    let loggedIn=false;try{const session=localStorage.getItem('sai-local-session-v1');loggedIn=!!session&&session!=='null'&&session!=='{}';}catch(e){}
    if(!loggedIn){const authButton=document.getElementById('sai-open-auth');if(authButton)authButton.click();toast('سجّل دخولك أولًا حتى تتمكن من إضافة '+(type==='market'?'منتجك':'كتابك'));return;}
  }
  const label={library:'كتابك',market:'منتجك',experts:'خبرتك'}[type]||'مشاركتك';
  modal(`<span class="kicker">كل مشاركة تصنع فرقًا</span><h2>شارك ${label}</h2><p>تُحفظ المشاركات عبر إدارة الموقع.</p><form class="form-grid" onsubmit="submitEntry(event,'${type}')"><label>العنوان<input name="title" required maxlength="70" placeholder="اكتب عنوانًا واضحًا"></label><label>التصنيف<select name="cat">${[...new Set([...base.filter(x=>x.type===type).map(x=>x.cat),'عام'])].map(c=>`<option>${escapeHtml(c)}</option>`).join('')}</select></label><label>وصف مختصر<textarea name="desc" required rows="3" maxlength="350" placeholder="احكِ لنا عن مشاركتك..."></textarea></label>${type==='market'?'<label>السعر بالدينار الأردني<input name="price" type="number" min="0" step="0.01" required></label>':''}<button class="button" type="submit">حفظ المشاركة <span>↖</span></button></form>`);
}
function communityProjectForm(project=null){
  const p=project||{};
  const id=p.id||'';
  const title=p.title||'',field=p.field||'',projectType=p.project_type||'منتج',description=p.description||'';
  const placement=p.placement||'projects';
  modal(`<span class="kicker">مشاركة مجتمعية</span><h2>${id?'تعديل مشروعي':'إضافة مشروع جديد'}</h2><p>${id?'عدّل بيانات مشروعك. إذا كان منشورًا فستظهر التغييرات مباشرة.':'أرسل مشروعك للمراجعة؛ سيظهر بعد موافقة الإدارة في الأقسام التي تحددها.'}</p><form class="form-grid" onsubmit="submitCommunityProject(event,'${escapeHtml(id)}')">
    <label>اسم المشروع *<input name="title" required maxlength="120" value="${escapeHtml(title)}" placeholder="اسم واضح للمشروع"></label>
    <label>المجال / التصنيف *<input name="field" required maxlength="100" value="${escapeHtml(field)}" placeholder="مثال: تصميم، منتجات يدوية، تقنية"></label>
    <label>نوع المشروع *<select name="projectType" required>${['منتج','خدمة','فكرة إبداعية','مبادرة'].map(v=>`<option value="${v}" ${projectType===v?'selected':''}>${v}</option>`).join('')}</select></label>
    <label>مكان النشر *<select name="placement" required>
      <option value="projects" ${placement==='projects'?'selected':''}>المشاريع الشبابية فقط</option>
      <option value="projects_opportunities" ${placement==='projects_opportunities'?'selected':''}>المشاريع الشبابية + فرص سعي</option>
      <option value="opportunities" ${placement==='opportunities'?'selected':''}>فرص سعي فقط</option>
      <option value="opportunities_discounts" ${placement==='opportunities_discounts'?'selected':''}>فرص سعي + الخصومات</option>
    </select></label>
    <label class="full">تفاصيل المشروع *<textarea name="description" required minlength="10" maxlength="2000" rows="5" placeholder="اكتب تفاصيل المشروع وما يقدمه...">${escapeHtml(description)}</textarea></label>
    <label class="full">صورة المشروع — رابط الصورة (اختياري)<input name="imageUrl" type="url" maxlength="1000" value="${escapeHtml(p.image_url||'')}" placeholder="https://..." oninput="previewCommunityProjectImage(this)"></label>
    <label class="full">أو ارفع صورة من جهازك<input name="projectImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange="uploadCommunityProjectImage(this)"><small>الصورة تُضغط تلقائيًا قبل رفعها إلى تخزين الموقع. الحد الأقصى للملف قبل المعالجة 15 ميغابايت.</small><img id="community-project-image-preview" ${p.image_url?'src="'+escapeHtml(p.image_url)+'"':'hidden'} alt="معاينة صورة المشروع" style="display:${p.image_url?'block':'none'};max-width:100%;max-height:220px;object-fit:contain;border-radius:12px;margin-top:8px"></label>
    <label>اسم الجهة / المؤسسة (اختياري)<input name="entityName" maxlength="120" value="${escapeHtml(p.entity_name||'')}" placeholder="اسم الجهة المرتبطة بالمشروع"></label>
    <label>رقم التواصل<input name="phone" type="tel" maxlength="40" dir="ltr" value="${escapeHtml(p.phone||'')}" placeholder="07XXXXXXXX"></label>
    <label>وسيلة تواصل إضافية<input name="contact" maxlength="160" value="${escapeHtml(p.contact||'')}" placeholder="البريد الإلكتروني أو وسيلة أخرى"></label>
    <label>رابط إنستغرام<input name="instagramUrl" type="url" maxlength="1000" value="${escapeHtml(p.instagram_url||'')}" placeholder="https://instagram.com/..."></label>
    <label>رابط فيسبوك<input name="facebookUrl" type="url" maxlength="1000" value="${escapeHtml(p.facebook_url||'')}" placeholder="https://facebook.com/..."></label>
    <button class="button" type="submit">${id?'حفظ التعديلات':'إرسال المشروع للمراجعة'} <span>↖</span></button>
  </form>`);
}
function previewCommunityProjectImage(input){
  const preview=document.getElementById('community-project-image-preview');
  if(!preview)return;
  const url=String(input.value||'').trim();
  if(/^https:\/\//i.test(url)){preview.src=url;preview.style.display='block';preview.hidden=false;}
  else{preview.removeAttribute('src');preview.style.display='none';preview.hidden=true;}
}
async function uploadCommunityProjectImage(input){
  const file=input.files?.[0];
  if(!file)return;
  const form=input.closest('form');
  const urlField=form?.elements?.imageUrl;
  const preview=document.getElementById('community-project-image-preview');
  const submitButton=form?.querySelector('[type="submit"]');
  try{
    input.disabled=true;
    if(submitButton)submitButton.disabled=true;
    if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>15*1024*1024)throw Error('اختر صورة PNG أو JPG أو WebP أو GIF بحجم أقل من 15 ميغابايت.');
    const image=new Image();
    const objectUrl=URL.createObjectURL(file);
    let imageData='';
    try{
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('تعذرت قراءة الصورة.'));image.src=objectUrl;});
      const canvas=document.createElement('canvas');
      const scale=Math.min(1,1600/image.width,1600/image.height);
      canvas.width=Math.max(1,Math.round(image.width*scale));
      canvas.height=Math.max(1,Math.round(image.height*scale));
      const context=canvas.getContext('2d');
      if(!context)throw Error('تعذر تجهيز الصورة على هذا الجهاز.');
      context.drawImage(image,0,0,canvas.width,canvas.height);
      imageData=canvas.toDataURL('image/webp',.82);
    }finally{URL.revokeObjectURL(objectUrl);}
    toast('جاري رفع صورة المشروع…');
    const result=await communityRequest('/api/media',{method:'POST',body:JSON.stringify({imageData})});
    if(!result.url)throw Error('لم يُرجع الخادم رابط الصورة.');
    if(urlField)urlField.value=result.url;
    if(preview){preview.src=result.url;preview.style.display='block';preview.hidden=false;}
    toast('تم رفع الصورة بنجاح.');
  }catch(error){toast(error.message||'تعذر رفع الصورة.');}
  finally{input.disabled=false;input.value='';if(submitButton)submitButton.disabled=false;}
}
async function submitCommunityProject(event,id=''){
  event.preventDefault();
  if(!window.SAI_CURRENT_USER){toast('انتهت جلسة الدخول. سجّل الدخول ثم حاول مجددًا.');return;}
  const form=event.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;
  const f=new FormData(form);
  const payload={title:String(f.get('title')||'').trim(),field:String(f.get('field')||'').trim(),projectType:String(f.get('projectType')||''),description:String(f.get('description')||'').trim(),imageUrl:String(f.get('imageUrl')||'').trim(),entityName:String(f.get('entityName')||'').trim(),placement:String(f.get('placement')||'projects'),phone:String(f.get('phone')||'').trim(),contact:String(f.get('contact')||'').trim(),instagramUrl:String(f.get('instagramUrl')||'').trim(),facebookUrl:String(f.get('facebookUrl')||'').trim()};
  if(id){payload.action='update';payload.id=id;}
  try{
    const data=await communityRequest('/api/community-projects',{method:'POST',body:JSON.stringify(payload)});
    document.getElementById('dialog').close();
    toast(data.message|| (id?'تم تحديث مشروعك.':'تم إرسال مشروعك للمراجعة.'));
    await refreshCommunityProjects();
    if(id&&route==='projects')listing();
  }catch(error){toast(error.message||'تعذر حفظ المشروع.');button.disabled=false;}
}
async function showMyProjects(){
  if(!window.SAI_CURRENT_USER){toast('سجّل الدخول أولاً لعرض مشاريعك.');return;}
  try{
    const data=await communityRequest('/api/community-projects?mine=1');
    const projects=data.projects||[];
    const statusLabel=s=>s==='approved'?'منشور على الموقع':s==='rejected'?'مرفوض':'بانتظار موافقة الإدارة';
    modal(`<span class="kicker">مشاريعي</span><h2>مشاريعي (${projects.length})</h2><div class="my-community-projects">${projects.map(p=>`<article class="place-card" style="margin:10px 0"><div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><div><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.field)} · ${escapeHtml(p.project_type)}</p><p><strong>${statusLabel(p.status)}</strong></p>${p.admin_note?`<p>ملاحظة الإدارة: ${escapeHtml(p.admin_note)}</p>`:''}</div>${p.image_url?`<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.title)}" style="width:76px;height:76px;object-fit:cover;border-radius:10px">`:''}</div><button type="button" class="button small" style="margin-top:10px" onclick="editCommunityProject('${escapeHtml(p.id)}')">تعديل المشروع</button></article>`).join('')||'<p class="empty">لم تضف أي مشروع بعد.</p>'}</div><button type="button" class="button" onclick="communityProjectForm()">+ إضافة مشروع جديد</button>`);
  }catch(error){toast(error.message||'تعذر تحميل مشاريعك.');}
}
async function editCommunityProject(id){
  try{
    if(!window.SAI_CURRENT_USER)throw Error('سجّل الدخول أولاً لتعديل مشاريعك.');
    const data=await communityRequest('/api/community-projects?mine=1');
    const project=(data.projects||[]).find(p=>p.id===id);
    if(!project)throw Error('لم يتم العثور على هذا المشروع في حسابك.');
    communityProjectForm(project);
  }catch(error){toast(error.message||'تعذر فتح المشروع للتعديل.');}
}
async function submitEntry(e,type){e.preventDefault();let f=new FormData(e.target);let item={id:'local'+Date.now(),type,title:String(f.get('title')||'').trim(),cat:f.get('cat'),desc:String(f.get('desc')||'').trim(),badge:'مشاركتك',meta:f.get('cat'),emoji:'✦'};if(!item.title||!item.desc)return;if(f.get('price'))item.price=f.get('price')+' د.أ';try{const next=SiteStore.clone(SiteStore.state);next.items.push(item);await SiteStore.save(next);base=SiteStore.state.items;rebuildVisibleItems();}catch(error){toast(error.message);return;}document.getElementById('dialog').close();category='الكل';query='';if(route===type)listing();else location.hash=type;toast('تم حفظ المشاركة على الموقع بنجاح');}
window.showMyProjects=showMyProjects;
window.editCommunityProject=editCommunityProject;
window.communityProjectForm=communityProjectForm;
window.submitCommunityProject=submitCommunityProject;
window.previewCommunityProjectImage=previewCommunityProjectImage;
window.uploadCommunityProjectImage=uploadCommunityProjectImage;
function aboutPrivacy(){modal('<h2>خصوصيتك</h2><p>تُحفظ المفضلة محليًا في متصفحك، بينما تُحفظ بيانات الحسابات والمشاريع المرسلة للمراجعة على خادم سعي بلس لإتاحة استخدامها ومراجعتها عبر الأجهزة. يمكنك حذف حسابك من إعدادات الحساب، ولا يؤثر ذلك على بيانات المفضلة المحفوظة محليًا.</p><button class="button light" onclick="localStorage.removeItem(\'sai-additions\');localStorage.removeItem(\'sai-favorites\');additions=[];rebuildVisibleItems();favorites=[];document.getElementById(\'dialog\').close();render();toast(\'تم مسح بيانات هذا المتصفح\')">مسح بياناتي المحلية</button>')}
function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}document.getElementById('dialog').addEventListener('click',e=>{if(e.target===e.currentTarget){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});


// إحصائيات سعي بلس: العدد مأخوذ من حسابات المستخدمين المسجلة فعلياً.
async function showStatistics() {
  // Expose the handler explicitly for inline HTML buttons and cached/embedded deployments.
  const existingDialog = document.getElementById('dialog');
  const existingContent = document.getElementById('dialog-content');
  if (!existingDialog || !existingContent) {
    toast('تعذر فتح نافذة الإحصائيات. حدّث الصفحة وحاول مرة أخرى.');
    return;
  }
  modal(`
    <div class="site-statistics" dir="rtl">
      <span class="kicker">سعي بلس</span>
      <h2>الإحصائيات</h2>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px">
        <div style="padding:18px;border:1px solid #dce6dd;border-radius:14px;background:#f5f8f3"><p>إجمالي الحسابات</p><strong id="site-users-total-count" aria-live="polite">جارٍ التحميل...</strong><small>جميع حسابات المستخدمين</small></div>
        <div style="padding:18px;border:1px solid #dce6dd;border-radius:14px;background:#f5f8f3"><p>حسابات أضافت مشروعًا</p><strong id="site-project-accounts-count" aria-live="polite">جارٍ التحميل...</strong><small id="site-project-accounts-note">من إجمالي الحسابات</small></div>
      </div>
      <small id="site-users-note" style="display:block;margin-top:12px">الأعداد من الحسابات المسجلة فعليًا في قاعدة البيانات.</small>
    </div>
  `);

  const usersTotalCount = document.getElementById('site-users-total-count');
  const projectAccountsCount = document.getElementById('site-project-accounts-count');
  const projectAccountsNote = document.getElementById('site-project-accounts-note');
  const note = document.getElementById('site-users-note');
  try {
    const response = await fetch(`${DISCOUNT_API}/api/statistics`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const data = await response.json();
    if (!response.ok || !Number.isFinite(Number(data.usersTotal)) || !Number.isFinite(Number(data.accountsWithProjects))) {
      throw new Error('تعذر تحميل الإحصائيات');
    }
    const usersTotal = Math.max(0, Number(data.usersTotal));
    const accountsWithProjects = Math.min(usersTotal, Math.max(0, Number(data.accountsWithProjects)));
    usersTotalCount.textContent = usersTotal.toLocaleString('ar-JO');
    projectAccountsCount.textContent = accountsWithProjects.toLocaleString('ar-JO');
    projectAccountsNote.textContent = `من أصل ${usersTotal.toLocaleString('ar-JO')} حساب`;
    note.textContent = 'يُحتسب الحساب مرة واحدة إذا أضاف مشروعًا واحدًا على الأقل، سواء كان قيد المراجعة أو منشورًا أو مرفوضًا. الرقم الثاني جزء من إجمالي الحسابات وليس عددًا إضافيًا.';
  } catch (error) {
    usersTotalCount.textContent = '—';
    projectAccountsCount.textContent = '—';
    projectAccountsNote.textContent = '—';
    note.textContent = 'تعذر تحميل الأعداد حالياً. حاول مرة أخرى.';
  }
}

// Ensure the statistics button works even if inline handlers are not exposed globally.
window.showStatistics = showStatistics;
document.addEventListener('click', function (event) {
  const button = event.target.closest('.statistics-nav-button, [data-open-statistics]');
  if (!button) return;
  event.preventDefault();
  showStatistics();
});



// Keep exactly one Statistics button in the main navigation and place it at the far left.
(function fixStatisticsNavigation() {
  function normalizeStatisticsNavigation() {
    const nav = document.querySelector('header nav[aria-label="القائمة الرئيسية"]');
    if (!nav) return;
    const matches = Array.from(document.querySelectorAll('header nav button, header nav a'))
      .filter(el => (el.textContent || '').trim() === 'الإحصائيات');
    if (!matches.length) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'statistics-nav-button';
      button.textContent = 'الإحصائيات';
      button.addEventListener('click', () => window.showStatistics && window.showStatistics());
      nav.appendChild(button);
      return;
    }
    const keep = matches.find(el => el.classList.contains('statistics-nav-button')) || matches[matches.length - 1];
    matches.forEach(el => { if (el !== keep) el.remove(); });
    keep.classList.add('statistics-nav-button');
    // In the RTL navigation, the last DOM item is displayed at the far left.
    nav.appendChild(keep);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', normalizeStatisticsNavigation, { once: true });
  } else {
    normalizeStatisticsNavigation();
  }
})();
