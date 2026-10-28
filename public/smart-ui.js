/* Integrates with the existing public site and SiteStore. */
(() => {
'use strict';
const E=SaeeSmart, esc=escapeHtml;
let view='recommend', searchText='', searchType='', chat='', rows=[],memory={};
const profileKey=()=>{try{return 'saee-smart-v1:'+encodeURIComponent(localStorage.getItem('sai-local-session-v1')||'guest');}catch{return 'saee-smart-v1:guest';}};
function profile(){try{const p=JSON.parse(localStorage.getItem(profileKey())||'null')||memory[profileKey()]||{};return {interests:Array.isArray(p.interests)?p.interests.filter(k=>E.interests[k]):[],consent:p.consent===true,events:p.consent===true&&Array.isArray(p.events)?p.events.slice(-100):[]};}catch{return memory[profileKey()]||{interests:[],consent:false,events:[]};}}
function persist(p){memory[profileKey()]=p;try{localStorage.setItem(profileKey(),JSON.stringify(p));}catch{toast('تعذر حفظ التفضيلات؛ ستبقى لهذه الجلسة فقط.');}}
function track(x,action){const p=profile();if(!p.consent)return;p.events.push({key:x.key,type:x.type,action,at:Date.now()});p.events=p.events.slice(-100);persist(p);}
function resultCards(list){rows=list;return list.length?list.map((x,i)=>`<article class="smart-card"><span class="kicker">${esc(titles[x.type]||x.cat)}</span><h3>${esc(x.title)}</h3><p>${esc(x.desc)}</p><p class="smart-reason">${esc(x.reason||'مصدر الإجابة: هذا المحتوى المنشور')}</p><p><b>${esc(x.price||(x.amount===0?'مجاني بحسب النص المنشور':'السعر غير منشور'))}</b>${x.badge?' · '+esc(x.badge):''}</p><button class="button small" data-smart-open="${i}">عرض المصدر والتفاصيل ↖</button></article>`).join(''):'<p class="empty">لا توجد نتائج مطابقة في المحتوى المتاح. جرّب تغيير كلمات البحث أو القسم.</p>';}
function preferences(){const p=profile();return `<form id="smart-preferences" class="smart-preferences"><h3>ما الذي يهمّك؟</h3><div class="smart-interests">${Object.entries(E.interests).map(([k,v])=>`<label><input type="checkbox" name="interest" value="${k}" ${p.interests.includes(k)?'checked':''}> ${v}</label>`).join('')}</div><label class="smart-consent"><input name="consent" type="checkbox" ${p.consent?'checked':''}> أوافق على استخدام فتح التفاصيل والحفظ في المفضلة لتحسين توصياتي على هذا المتصفح.</label><p class="smart-muted">لا نسجل الاستعلامات أو المحادثات. التفضيلات منفصلة للحساب المحلي وللزائر، ولا تُرسل إلى طرف خارجي. إلغاء الموافقة يمسح سجل التفاعلات.</p><div class="smart-actions"><button class="button small">حفظ تفضيلاتي</button><button type="button" class="button light small" id="smart-clear">مسح تفضيلاتي وسجل التفاعلات</button></div></form>`;}
function content(){if(view==='recommend')return `${preferences()}<h2>اختيارات تناسب سعيك</h2><div class="smart-grid">${resultCards(E.recommend(SiteStore.state,profile()).slice(0,6))}</div>`;
if(view==='search')return `<form id="smart-search" class="smart-search"><label>ماذا تحتاج؟<input name="query" maxlength="500" value="${esc(searchText)}" placeholder="مثال: مكان أدرس فيه بسعر مناسب"></label><label>القسم<select name="type"><option value="">كل الأقسام</option>${services.filter(s=>!SiteStore.state.hidden.includes(s[0])).map(s=>`<option value="${s[0]}" ${searchType===s[0]?'selected':''}>${esc(s[2])}</option>`).join('')}</select></label><button class="button small">ابحث</button></form><p class="smart-muted">يفهم البحث مرادفات عربية ضمن قواعد محددة، ويمكنك تضييق النتائج حسب القسم.</p><p role="status">${E.search(SiteStore.state,searchText,{type:searchType}).length} نتيجة من المحتوى المنشور</p><div class="smart-grid">${resultCards(E.search(SiteStore.state,searchText,{type:searchType}))}</div>`;
const reply=chat?E.answer(SiteStore.state,chat):null;
return `<div class="smart-chat"><h2>المساعد الذكي — Saee AI Assistant</h2><p>مساعد استرجاع قائم على قواعد ومحتوى المنصة. اسأل عن خدمة أو عرض أو اطلب مقارنة. لا يستخدم نموذجًا لغويًا خارجيًا في هذه النسخة.</p><div class="smart-actions"><button class="chip" data-prompt="كتب برمجة مجانية">كتب برمجة مجانية</button><button class="chip" data-prompt="مكان أدرس فيه بسعر مناسب">مكان للدراسة</button><button class="chip" data-prompt="قارن المنتجات تحت 10 دنانير">مقارنة ضمن الميزانية</button></div><form id="smart-chat"><label for="smart-question">سؤالك</label><div class="smart-actions"><input id="smart-question" name="question" required maxlength="500" value="${esc(chat)}" placeholder="اكتب ما تحتاجه..."><button class="button small">اسأل المساعد</button></div></form>${reply?`<section aria-live="polite"><p class="smart-reply">${esc(reply.message)}</p>${reply.results.length?`<div class="smart-grid">${resultCards(reply.results)}</div>`:''}</section>`:''}<p class="smart-muted">الأسعار والخصومات تُنقل كما نشرها صاحب المحتوى. البيانات الحالية قد تتضمن أمثلة توضيحية. لا أؤكد التوفر أو جودة الخدمة أو ساعات العمل الفعلية.</p><button class="text-btn" id="smart-chat-clear">مسح المحادثة</button></div>`;
}
function page(){main.innerHTML=`<div class="container smart-page">${headerPage('سعي الذكي','اكتشف ما يناسبك، وافهم سبب كل اقتراح.')}<div class="smart-tabs" role="group" aria-label="خدمات سعي الذكية">${[['recommend','توصيات لك'],['search','البحث الذكي'],['assistant','المساعد الذكي']].map(([k,v])=>`<button class="chip ${view===k?'selected':''}" aria-pressed="${view===k}" data-view="${k}">${v}</button>`).join('')}</div>${content()}<section id="smart-share" class="join-banner" aria-labelledby="smart-share-title"><div><h2 id="smart-share-title">عندك شيء يستحق المشاركة؟</h2><p>كتاب، منتج، خبرة أو فكرة مشروع.. خلّ سعيك يوصل لغيرك.</p></div><button type="button" class="button" onclick="addForm('projects')">شاركنا سعيك <span aria-hidden="true">↖</span></button></section></div>`;document.querySelector('nav')?.classList.remove('open');applyContent();}
// Existing per-section searches use the same Arabic engine.
renderItems=function(){
 const found=E.search(SiteStore.state,query,{type:route}).filter(x=>x.kind==='item'&&(category==='الكل'||x.cat===category));
 const target=document.getElementById('results');
 if(target)target.innerHTML=found.length?found.map(x=>card(x)).join(''):'<div class="empty">لا توجد نتائج مطابقة. جرّب كلمة أخرى أو اختر «الكل».</div>';
};
const previousRender=render;
render=function(){if(location.hash==='#smart'){syncContent();route='smart';document.body.classList.remove('admin');page();return;}previousRender();if(['','home','about'].includes(location.hash.slice(1))&&!document.getElementById('smart-home')){const host=document.querySelector('main .services');if(host){const section=document.createElement('section');section.id='smart-home';section.className='smart-home';section.innerHTML='<span class="kicker">SAEE SMART</span><h2>فرص أقرب لاهتماماتك</h2><p>اختر اهتماماتك، ابحث بالعربية، واستعن بمساعد يعتمد على بيانات سعي بلس.</p><a class="button" href="#smart">اكتشف سعي الذكي ↖</a>';host.before(section);}}};
const originalDetails=details;details=function(id){const x=E.catalog(SiteStore.state).find(x=>x.kind==='item'&&x.id===id);if(x)track(x,'view');originalDetails(id);};
const originalSave=saveFavorite;saveFavorite=function(id,b){if(!favorites.includes(id)){const x=E.catalog(SiteStore.state).find(x=>x.kind==='item'&&x.id===id);if(x)track(x,'favorite');}originalSave(id,b);};
const originalPrivacy=aboutPrivacy;aboutPrivacy=function(){originalPrivacy();const box=document.createElement('p');box.textContent='سعي الذكي يحفظ اهتماماتك محليًا، ويسجل فتح التفاصيل والمفضلة فقط بعد موافقتك. يمكنك إلغاء الموافقة أو مسح بيانات سعي الذكي من صفحة التوصيات.';document.getElementById('dialog-content').append(box);};
document.addEventListener('click',e=>{const t=e.target.closest('[data-view],[data-smart-open],[data-prompt],#smart-clear,#smart-chat-clear');if(!t)return;
if(t.dataset.view){view=t.dataset.view;page();}
if(t.dataset.smartOpen!==undefined){const x=rows[Number(t.dataset.smartOpen)];if(!x)return;if(x.kind==='item')details(x.id);else {track(x,'view');place=Number(x.id);location.hash='map';}}
if(t.dataset.prompt){chat=t.dataset.prompt;page();}
if(t.id==='smart-clear'){persist({interests:[],consent:false,events:[]});page();toast('تم مسح تفضيلات سعي الذكي وسجل التفاعلات.');}
if(t.id==='smart-chat-clear'){chat='';page();}
});
document.addEventListener('submit',e=>{if(!['smart-preferences','smart-search','smart-chat'].includes(e.target.id))return;e.preventDefault();const f=new FormData(e.target);
if(e.target.id==='smart-preferences'){const consent=f.has('consent'),old=profile();persist({interests:f.getAll('interest'),consent,events:consent?old.events:[]});toast('تم تحديث التفضيلات.');}
if(e.target.id==='smart-search'){searchText=String(f.get('query')).trim();searchType=String(f.get('type'));}
if(e.target.id==='smart-chat')chat=String(f.get('question')).trim();page();
});
function changedAccount(){chat='';if(location.hash==='#smart')page();}
window.addEventListener('sai-account-changed',changedAccount);
window.addEventListener('storage',e=>{if(e.key==='sai-local-session-v1')changedAccount();else if(e.key===profileKey()&&location.hash==='#smart')page();});
const launch=document.createElement('a');launch.className='smart-launch';launch.href='#smart';launch.textContent='✦ سعي الذكي';document.body.append(launch);
render();
})();
