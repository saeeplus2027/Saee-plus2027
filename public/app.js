const paths={pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',book:'M12 5v16 M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-6-2-10 1',percent:'M5 20 19 4 M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M21 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M18 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87',store:'M3 10v11h18V10 M2 10l3-7h14l3 7 M2 10c1 4 5 4 5 0 1 4 5 4 5 0 1 4 5 4 5 0 1 4 5 4 5 0 M9 21v-7h6v7',bulb:'M9 18h6 M9 22h6 M8 14a7 7 0 1 1 8 0l-1 4H9l-1-4 M12 1v-1 M2 6 0 5 M24 5l-2 1',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',menu:'M3 6h18 M3 12h18 M3 18h18',leaf:'M20 3C8 1 2 7 5 15s17 4 15-12Z M4 22 16 8',coffee:'M5 3h12v12a6 6 0 0 1-12 0V3 M17 5h2a3 3 0 0 1 0 6h-2 M3 22h16',check:'M5 12l4 4L20 5',grad:'M1 8l11-5 11 5-11 5L1 8 M5 10v7c4 3 10 3 14 0v-7 M23 8v9'};
function icon(name){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.leaf}"/></svg>`}function hydrate(){document.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon))}
let services=SiteStore.state.services;
let titles=Object.fromEntries(services.map(s=>[s[0],s[2]]));
let base=SiteStore.state.items;
let additions=SiteStore.remote?[]:JSON.parse(localStorage.getItem('sai-additions')||'[]'),items=[...base,...additions],favorites=JSON.parse(localStorage.getItem('sai-favorites')||'[]'),route='',category='الكل',query='';
const main=document.getElementById('main');
function serviceCards(){return services.filter(s=>!SiteStore.state.hidden.includes(s[0])).map(s=>`<a class="service-card" href="#${s[0]}"><div class="service-icon">${icon(s[1])}</div><h3>${escapeHtml(s[2])}</h3><p>${escapeHtml(s[3])}</p><span class="card-arrow">↖</span></a>`).join('')}
function card(x){return `<article class="offer-card"><div class="photo-wrap">${x.image?`<img src="${escapeHtml(SiteStore.imageSrc(x.image))}" alt="${escapeHtml(x.title)}" loading="lazy">`:`<div class="expert-avatar">${escapeHtml(x.emoji||'✦')}</div>`}<span class="offer-tag">${escapeHtml(x.badge||'إضافة مجتمعية')}</span><button class="heart ${favorites.includes(x.id)?'saved':''}" onclick="saveFavorite('${x.id}',this)" aria-label="حفظ ${escapeHtml(x.title)} في المفضلة" aria-pressed="${favorites.includes(x.id)}">${icon('heart')}</button></div><div class="card-body"><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.desc)}</p><div class="card-foot"><span class="${x.price?'price':'tag'}">${escapeHtml(x.price||x.meta||x.cat)}</span><button class="details-btn" onclick="details('${x.id}')">التفاصيل ↖</button></div></div></article>`}
function home(){main.innerHTML=`<div class="container"><section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="dot"></span> من جامعتك.. لمجتمعك</div><h1>كل احتياجاتك،<br>وفرصك <em>في مكان واحد.</em></h1><p>سعي بلس يجمع عالمك الجامعي ومجتمعك المحلي في مساحة واحدة. اكتشف، تواصل، وشارك.. لأن كل سعي صغير يصنع فرقًا.</p><div class="hero-buttons"><a class="button" href="#services">اكتشف خدماتنا <span>↖</span></a><a class="button light" href="#about">تعرّف على سعي بلس</a></div><div class="hero-trust"><div class="avatar-stack"><i>🌱</i><i>🎓</i><i>☕</i></div><span>للطلاب، والمبدعين، وكل من يسعى للأفضل.</span></div></div><div class="hero-visual"><img class="campus-photo" src="assets/campus.jpg" alt="مساحة جامعية خضراء ومباني تعليمية"><div class="visual-tint"></div><span class="visual-star">✳</span><div class="floating float-one"><span class="bubble">${icon('book')}</span><div><b>كتابك فرصة لغيرك</b><small>شارك المعرفة، واصنع أثرًا.</small></div></div><div class="floating float-two"><span class="bubble">${icon('percent')}</span><div><b>عروض تناسب يومك</b><small>خصومات من محيط جامعتك</small></div></div><div class="visual-caption"><small>خطوتك الجاية تبدأ من هنا</small><p>أقرب لجامعتك.<br>أقرب لفرصك.</p></div></div></section><div class="community-strip"><div>${icon('grad')}<span><strong>حياة جامعية أسهل</strong><small>خدمات ترافقك كل يوم</small></span></div><div>${icon('users')}<span><strong>مجتمع أقرب لك</strong><small>تواصل، تعلّم، وشارك</small></span></div><div>${icon('leaf')}<span><strong>أثر يبدأ بخطوة</strong><small>فرص صغيرة، أثر كبير</small></span></div></div><section class="services"><div class="section-head"><div><span class="kicker">مساحات صُممت لك</span><h2>وش حاب تسعى له اليوم؟</h2><p>ست خدمات، وكل خدمة تفتح لك بابًا جديدًا.</p></div><span class="arrow-link">كل احتياجاتك، هنا ${icon('leaf')}</span></div><div class="services-grid">${serviceCards()}</div></section></div><section class="offers-section"><div class="container"><div class="section-head"><div><span class="kicker">فرص قريبة، وفائدة أكبر</span><h2>وفّر أكثر، واستمتع بيومك</h2></div><a class="arrow-link" href="#discounts">كل الخصومات <span>←</span></a></div><div class="offers-grid">${items.filter(x=>x.type==='discounts').slice(0,3).map(card).join('')}</div><p style="color:#8b947f;font-size:10px;margin:14px 0 0">العروض المعروضة أمثلة توضيحية لتجربة الموقع.</p></div></section><div class="container"><section id="about" class="intro"><span class="kicker">لماذا سعي بلس؟</span><h2>لأن الفرص تكبر، عندما نتشاركها.</h2><p>سعي بلس منصة تجمع الطالب ومجتمعه المحلي: من الوصول إلى مرافق الجامعة، إلى تبادل الكتب، ودعم المشاريع الصغيرة والاستفادة من خبرات الآخرين. نؤمن أن المعرفة أقرب عندما تُشارك، وأن لكل فكرة فرصة تستحقها.</p></section><section class="join-banner"><div><h2>عندك شيء يستحق المشاركة؟</h2><p>كتاب، منتج، خبرة أو فكرة مشروع.. خلّ سعيك يوصل لغيرك.</p></div><button class="button" onclick="addForm('projects')">شاركنا سعيك <span>↖</span></button></section></div>`}
function headerPage(name,desc,action=''){return `<div class="page-head"><div class="breadcrumbs"><a href="#home">الرئيسية</a> / ${escapeHtml(name)}</div><div class="page-title-row"><div><span class="kicker">من جامعتك، إلى مجتمعك</span><h1>${escapeHtml(name)}</h1><p>${escapeHtml(desc)}</p></div>${action}</div></div>`}
let descriptions=SiteStore.state.descriptions;
function listing(){const cats=['الكل',...new Set(items.filter(x=>x.type===route).map(x=>x.cat))];let add=route==='discounts'?'':`<button class="button small" onclick="addForm('${route}')">+ ${route==='library'?'أضف كتابك':route==='market'?'أضف منتجك':route==='experts'?'شارك خبرتك':'أضف مشروعك'}</button>`;main.innerHTML=`<div class="container">${headerPage(titles[route],descriptions[route],add)}${SiteStore.state.notice?`<div class="demo-note">${escapeHtml(SiteStore.state.notice)}</div>`:""}<div class="toolbar"><div class="chips">${cats.map((c,ci)=>`<button class="chip ${c===category?'selected':''}" onclick="filterCategoryByIndex(${ci})">${escapeHtml(c)}</button>`).join('')}</div><label class="search-box">${icon('search')}<input aria-label="البحث" placeholder="ابحث في ${escapeHtml(titles[route])}..." id="search" value="${escapeHtml(query)}" oninput="query=this.value;renderItems()"></label></div><div class="list-grid" id="results"></div></div>`;renderItems()}
function renderItems(){let filtered=items.filter(x=>x.type===route&&(category==='الكل'||x.cat===category)&&`${x.title} ${x.desc}`.includes(query));document.getElementById('results').innerHTML=filtered.length?filtered.map(card).join(''):'<div class="empty">لا توجد نتائج مطابقة. جرّب كلمة أخرى أو اختر «الكل».</div>'}
function filterCategoryByIndex(i){let cats=['الكل',...new Set(items.filter(x=>x.type===route).map(x=>x.cat))];filterCategory(cats[i])}
function filterCategory(c){category=c;listing()}
let places=SiteStore.state.places;let place=0,mapCat='الكل';
function mapPage(){if(place>=places.length)place=0;let shown=places.map((p,i)=>({...p,i})).filter(p=>mapCat==='الكل'||p.cat===mapCat);main.innerHTML=`<div class="container">${headerPage(titles.map,descriptions.map)}${SiteStore.state.mapNotice?`<div class="demo-note">${escapeHtml(SiteStore.state.mapNotice)}</div>`:""}<div class="toolbar"><div class="chips">${['الكل',...new Set(places.map(p=>p.cat))].map((c,ci)=>`<button class="chip ${c===mapCat?'selected':''}" onclick="mapCategory(${ci})">${escapeHtml(c)}</button>`).join('')}</div></div><div class="map-layout"><div class="map"><svg class="layout" viewBox="0 0 750 500" preserveAspectRatio="none"><rect width="750" height="500" fill="#e7ecdc"/><g fill="#d0d8bf" stroke="#c4cfb6" stroke-width="2"><rect x="40" y="30" width="150" height="110" rx="7"/><rect x="280" y="25" width="190" height="100" rx="7"/><rect x="560" y="50" width="145" height="90" rx="7"/><rect x="60" y="250" width="130" height="130" rx="7"/><rect x="285" y="205" width="175" height="110" rx="7"/><rect x="560" y="240" width="145" height="115" rx="7"/><rect x="290" y="390" width="170" height="90" rx="7"/></g><g stroke="#fffdf4" stroke-width="30" fill="none"><path d="M225 0v500M515 0v500M0 170h750M0 360h750"/></g><g fill="#b8ccb0"><circle cx="75" cy="443" r="21"/><circle cx="128" cy="450" r="16"/><circle cx="640" cy="440" r="30"/><circle cx="700" cy="420" r="18"/></g></svg>${shown.map(p=>`<button class="map-pin" style="left:${p.x}%;top:${p.y}%" onclick="place=${p.i};mapPage()" aria-label="${escapeHtml(p.name)}">${icon(p.icon)}</button>`).join('')}<span class="map-label">مخطط الحرم الجامعي · نموذج توضيحي</span></div><aside class="map-places">${shown.map(p=>`<button class="place-card ${p.i===place?'selected':''}" onclick="place=${p.i};mapPage()"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.cat)} · اعرض التفاصيل ←</p></button>`).join('')}<div class="map-detail"><span class="kicker">وجهتك المختارة</span><h3>${escapeHtml(places[place]?.name||'لا توجد أماكن بعد')}</h3><p>${escapeHtml(places[place]?.desc||'أضف أماكن من لوحة الإدارة.')}</p></div></aside></div></div>`}
function mapCategory(i){mapCat=['الكل',...new Set(places.map(p=>p.cat))][i];mapPage()}
function render(){route=location.hash.slice(1)||'home';if(route==='about'){home();setTimeout(()=>document.getElementById('about').scrollIntoView(),0)}else if(route==='home')home();else if(route==='services'){main.innerHTML=`<div class="container">${headerPage('خدمات سعي بلس','كل احتياجاتك وفرصك في مكان واحد. اختر المساحة التي تناسبك.')}<div class="services-grid" style="margin:20px 0 65px">${serviceCards()}</div></div>`}else if(route==='map')mapPage();else if(titles[route])listing();else home();document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.hash===location.hash||(!location.hash&&a.hash==='#home')));document.querySelector('nav').classList.remove('open');hydrate()}
window.addEventListener('hashchange',()=>{category='الكل';query='';render();if(route!=='about')window.scrollTo(0,0)});document.getElementById('year').textContent=new Date().getFullYear();
// Initial page render: the app previously defined render() but did not call it on first load.
// Keep the visible UI in sync when SiteStore finishes loading remote or fallback content.
function syncSiteStoreAndRender(){
  try {
    services = SiteStore.state.services || [];
    titles = Object.fromEntries(services.map(s => [s[0], s[2]]));
    base = SiteStore.state.items || [];
    additions = SiteStore.remote ? [] : JSON.parse(localStorage.getItem('sai-additions') || '[]');
    items = [...base, ...additions];
  } catch (error) {
    console.error('Saee Plus: failed to sync visible content from SiteStore.', error);
  }
  render();
}
window.addEventListener('sai-content-changed', syncSiteStoreAndRender);
syncSiteStoreAndRender();
function toast(t){const e=document.getElementById('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2700)}
function saveFavorite(id,b){favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];localStorage.setItem('sai-favorites',JSON.stringify(favorites));if(b){b.classList.toggle('saved',favorites.includes(id));b.setAttribute('aria-pressed',favorites.includes(id))}toast(favorites.includes(id)?'أُضيفت إلى مفضلتك':'أُزيلت من المفضلة')}
function modal(html){document.getElementById('dialog-content').innerHTML=html;const d=document.getElementById('dialog');if(!d.open)d.showModal()}
const DISCOUNT_COOLDOWN_MS=24*60*60*1000;
const DISCOUNT_API=String(window.SAI_API_BASE||'https://saee-plus-api.ligagym.workers.dev').replace(/\/$/,'');
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
function details(id){let x=items.find(x=>x.id===id);if(!x)return;const isDiscount=x.type==='discounts';const locationUrl=String(x.shopLocation||'').trim();const safeLocation=/^https?:\/\//i.test(locationUrl)?locationUrl:'';const socialUrl=String(x.socialLink||'').trim();const safeSocial=/^https?:\/\//i.test(socialUrl)&&!/[<>\"']/.test(socialUrl)?socialUrl:'';const shopPhotos=(Array.isArray(x.shopImages)&&x.shopImages.length?x.shopImages:[x.shopImage1,x.shopImage2]).filter(Boolean);modal(`<span class="kicker">${titles[x.type]} · التفاصيل</span><h2>${escapeHtml(x.title)}</h2>${x.image?`<img src="${escapeHtml(SiteStore.imageSrc(x.image))}" alt="${escapeHtml(x.title)}" style="width:100%;height:180px;object-fit:cover;border-radius:12px;margin-bottom:12px">`:''}<p>${escapeHtml(x.extra||x.desc)}</p>${isDiscount&&shopPhotos.length?`<div class="discount-shop-photos" style="display:grid;grid-template-columns:repeat(${shopPhotos.length===1?1:2},minmax(0,1fr));gap:10px;margin:14px 0">${shopPhotos.map((src,i)=>`<img src="${escapeHtml(SiteStore.imageSrc(src))}" alt="صورة ${i+1} من ${escapeHtml(x.title)}" style="width:100%;height:160px;object-fit:cover;border-radius:12px;border:1px solid #e1e8df">`).join('')}</div>`:''}${isDiscount?`<p><button type="button" class="button light shop-location-btn" onclick="openShopLocation('${escapeHtml(String(id))}')" ${safeLocation?'':'title="لم يضف المضيف رابط الموقع بعد"'}>📍 ${safeLocation?'عرض موقع المحل':'موقع المحل غير مضاف'}</button></p>`:''}${safeSocial?`<p><a class="button light" href="${escapeHtml(safeSocial)}" target="_blank" rel="noopener noreferrer">↗ زيارة صفحة المتجر / التواصل</a></p>`:''}${x.price?`<p class="price">السعر التوضيحي: ${escapeHtml(x.price)}</p>`:''}<p>${escapeHtml(x.contact||"لم تُضف بيانات تواصل لهذا الإعلان بعد.")}</p><button class="button" onclick="saveFavorite('${id}');this.textContent=favorites.includes('${id}')?'محفوظ في المفضلة ✓':'حفظ في المفضلة'">${favorites.includes(id)?'محفوظ في المفضلة ✓':'حفظ في المفضلة ♡'}</button>`);if(isDiscount)updateDiscountButton(String(id))}
function openShopLocation(id){const x=items.find(item=>String(item.id)===String(id));const url=String(x?.shopLocation||'').trim();if(!/^https?:\/\//i.test(url)){toast('لم يضف المضيف موقع هذا المحل بعد.');return;}window.open(url,'_blank','noopener,noreferrer')}
function showFavorites(){favorites=favorites.filter(id=>items.some(x=>x.id===id));modal(`<span class="kicker">اختياراتك، في مكان واحد</span><h2>المفضلة</h2>${favorites.length?favorites.map(id=>items.find(x=>x.id===id)).filter(Boolean).map(x=>`<button class="place-card" onclick="details('${x.id}')"><h3>${escapeHtml(x.title)}</h3><p>${titles[x.type]} ←</p></button>`).join(''):'<p>مفضلتك فارغة حتى الآن. اضغط على القلب بجانب أي عرض أو كتاب أو منتج لحفظه هنا.</p>'}`)}
function addForm(type){if(type==='market'||type==='library'){let loggedIn=false;try{const session=localStorage.getItem('sai-local-session-v1');loggedIn=!!session&&session!=='null'&&session!=='{}';}catch(e){}if(!loggedIn){const authButton=document.getElementById('sai-open-auth');if(authButton)authButton.click();toast('سجّل دخولك أولًا حتى تتمكن من إضافة '+(type==='market'?'منتجك':'كتابك'));return;}}const label={library:'كتابك',market:'منتجك',experts:'خبرتك',projects:'مشروعك'}[type]||'مشروعك';modal(`<span class="kicker">كل مشاركة تصنع فرقًا</span><h2>شارك ${label}</h2><p>تُحفظ المشاركات عبر حساب مالك الموقع.</p><form class="form-grid" onsubmit="submitEntry(event,'${type}')"><label>العنوان<input name="title" required maxlength="70" placeholder="اكتب عنوانًا واضحًا"></label><label>التصنيف<select name="cat">${[...new Set([...base.filter(x=>x.type===type).map(x=>x.cat),'عام'])].map(c=>`<option>${escapeHtml(c)}</option>`).join('')}</select></label><label>وصف مختصر<textarea name="desc" required rows="3" maxlength="350" placeholder="احكِ لنا عن مشاركتك..."></textarea></label>${type==='market'?'<label>السعر بالدينار الأردني<input name="price" type="number" min="0" step="0.01" required></label>':''}<button class="button" type="submit">حفظ المشاركة <span>↖</span></button></form>`)}
async function submitEntry(e,type){e.preventDefault();let f=new FormData(e.target);let item={id:'local'+Date.now(),type,title:f.get('title').trim(),cat:f.get('cat'),desc:f.get('desc').trim(),badge:'مشاركتك',meta:f.get('cat'),emoji:'✦'};if(!item.title||!item.desc)return;if(f.get('price'))item.price=f.get('price')+' د.أ';try{const next=SiteStore.clone(SiteStore.state);next.items.push(item);await SiteStore.save(next);}catch(error){toast(error.message);return;}document.getElementById('dialog').close();category='الكل';query='';if(route===type)listing();else location.hash=type;toast('تم حفظ المشاركة على الموقع بنجاح')}
function aboutPrivacy(){modal('<h2>خصوصيتك</h2><p>تُحفظ المفضلة والمشاركات التجريبية في متصفحك باستخدام التخزين المحلي. لا تتطلب هذه النسخة إنشاء حساب أو إرسال معلومات شخصية. يمكنك إزالة البيانات عبر إعدادات المتصفح.</p><button class="button light" onclick="localStorage.removeItem(\'sai-additions\');localStorage.removeItem(\'sai-favorites\');additions=[];items=[...base];favorites=[];document.getElementById(\'dialog\').close();render();toast(\'تم مسح بيانات هذا المتصفح\')">مسح بياناتي المحلية</button>')}
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
      <p>عدد مستخدمي الموقع</p>
      <strong id="site-users-count" aria-live="polite">جارٍ التحميل...</strong>
      <small id="site-users-note">عدد الحسابات المسجلة في الموقع</small>
    </div>
  `);

  const count = document.getElementById('site-users-count');
  const note = document.getElementById('site-users-note');
  try {
    const response = await fetch(`${DISCOUNT_API}/api/statistics`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const data = await response.json();
    if (!response.ok || !Number.isFinite(Number(data.users))) {
      throw new Error('تعذر تحميل الإحصائيات');
    }
    count.textContent = Number(data.users).toLocaleString('ar-JO');
    note.textContent = 'إجمالي الحسابات المسجلة، ويُحدّث العدد تلقائياً عند فتح الإحصائيات.';
  } catch (error) {
    count.textContent = '—';
    note.textContent = 'تعذر تحميل العدد حالياً. حاول مرة أخرى.';
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

