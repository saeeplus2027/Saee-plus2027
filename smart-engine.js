/* Saee Smart v1: deterministic content rules, no external API. */
(function(root) {
'use strict';
const normalize=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[^\p{L}\p{N}\s.]/gu,' ').replace(/\s+/g,' ').trim();
const groups={study:['دراسة','أدرس','ادرس','دراسي','مذاكرة','مراجعة','تعلم','تعليم','قراءة','قاعات'],books:['كتاب','كتب','مكتبة','مكتبات','قرطاسية','تبرع','تبادل'],tech:['تقنية','تقني','تكنولوجيا','برمجة','برمجي','برمجية','حاسوب','كود','تطبيق','تطبيقات'],projects:['مشروع','مشاريع','ريادة','شبابية','فكرة'],development:['تطوير','مهارات','تدريب','دورة','دورات','ورشة','فرص','مهني','مهنية','وظائف','سيرة','مقابلات','إرشاد'],food:['طعام','اكل','وجبة','وجبات','مطعم','مطاعم'],coffee:['قهوة','كافيه','مقهى','مقاهي','مشروبات'],places:['مكان','أماكن','وين','موقع','مرفق','مرافق','قاعة','قاعات'],discounts:['خصم','خصومات','عروض','عرض','توفير'],services:['خدمة','خدمات','طلابية','طلاب','استشارة','استشارات','خبراء']};
const stop=new Set(normalize('انا لي الي اللي بدي اريد ابحث بحث عن على في من الى هل ما هو هي كم سعر السعر اسعار ثمن عندكم عندك ممكن اعطيني اشي شيء مناسب مناسبه بسعر رخيص ارخص اقتصادي مجاني مجانا تحت اقل حتى دينار دنانير د ا يكون تكون يتوفر يوجد فيه فيها بس لو سمحت ساعدني قارن مقارنة بين و شو وكيف كيف').split(' '));
const terms=s=>normalize(s).split(' ').filter(t=>t.length>1&&!stop.has(t)&&!/^\d/.test(t));
const matches=(text,w)=>text.split(' ').some(t=>t===w||t==='ال'+w||t==='ب'+w||t==='لل'+w||t==='و'+w);
const concepts=s=>Object.keys(groups).filter(k=>groups[k].some(w=>matches(normalize(s),normalize(w))));
function price(x){const raw=normalize(x.price);if(/^(?:\d+(?:\.\d+)?)(?:\s*(?:د\s*ا|دينار|دنانير|jod))?$/.test(raw))return Number(raw.match(/^\d+(?:\.\d+)?/)[0]);if(/(?:مجاني|مجانا)/.test(normalize((x.badge||'')+' '+(x.desc||'')))&&!/(ليس|غير|ليست|مو|مش|بدون|لا).*مجاني/.test(normalize((x.badge||'')+' '+(x.desc||''))))return 0;return null;}
function catalog(state){const visible=new Set(state.services.filter(s=>!state.hidden.includes(s[0])).map(s=>s[0]));return [...state.items.filter(x=>visible.has(x.type)).map(x=>({...x,kind:'item',key:'item:'+x.id})),...(visible.has('map')?state.places.map((p,i)=>({...p,id:String(i),title:p.name,type:'map',kind:'place',key:'place:'+i})):[])].map(x=>({...x,amount:price(x),text:[x.title,x.desc,x.cat,x.extra,x.meta,x.badge].filter(Boolean).join(' ')}));}
function search(state,query,options={}){
const q=normalize(query).slice(0,500),tokens=terms(q),intents=concepts(q),cheap=/(رخيص|اقتصادي|بسعر مناسب|سعر مناسب|ارخص|ميزاني)/.test(q),free=/(مجاني|مجانا|ببلاش)/.test(q),budget=q.match(/(?:تحت|اقل من|بحد اقصي|لا يتجاوز|حتى)\s*(\d+(?:\.\d+)?)/);
const max=options.max!==undefined&&options.max!==''?Number(options.max):budget?Number(budget[1]):null;
return catalog(state).filter(x=>!options.type||x.type===options.type).flatMap(x=>{
if(free&&x.amount!==0)return [];if(max!==null&&(x.amount===null||x.amount>max))return [];
const text=normalize(x.text),own=concepts(x.text),hits=tokens.filter(t=>matches(text,t)),matched=intents.filter(c=>own.includes(c)||(c==='places'&&x.kind==='place')||(c==='discounts'&&x.type==='discounts'));
if(intents.includes('places')&&x.kind!=='place')return [];
const required=intents.filter(c=>['tech','study','food','coffee'].includes(c));if(required.length&&!required.every(c=>matched.includes(c)))return [];
let score=hits.length*3+matched.length*4;
if((tokens.length||intents.length)&&!score)return [];if(!tokens.length&&!intents.length&&q&&!cheap&&!free&&max===null)return [];
if(cheap)score+=x.amount!==null?4/(1+x.amount):x.type==='discounts'?1:0;
return [{...x,score,reason:hits.length?'يطابق: '+hits.slice(0,3).join('، '):matched.length?'مرتبط بقصد البحث: '+matched.map(c=>groups[c][0]).join('، '):'وفق مرشح السعر المنشور'}];
}).sort((a,b)=>b.score-a.score||(a.amount??Infinity)-(b.amount??Infinity)||a.key.localeCompare(b.key));}
const interests={discounts:'الخصومات',library:'الكتب',projects:'المشاريع',services:'الخدمات الطلابية',development:'فرص التطوير',tech:'المشاريع التقنية'};
function recommend(state,profile={}){const chosen=Array.isArray(profile.interests)?profile.interests:[];return catalog(state).map(x=>{const tags=new Set([x.type,...concepts(x.text)]);if(x.type==='map'||x.type==='experts')tags.add('services');if(x.type==='experts')tags.add('development');const selected=chosen.filter(k=>tags.has(k)),events=profile.consent&&Array.isArray(profile.events)?profile.events:[],related=events.filter(e=>e.type===x.type).length,engaged=events.filter(e=>e.key===x.key).length;return {...x,score:selected.length*6+Math.min(related,5)+Math.min(engaged,3),reason:selected.length?'مقترح لك لأنه يتوافق مع اهتمامك بـ'+selected.map(k=>interests[k]).join(' و'):related?'مقترح من قسم تفاعلت معه بعد موافقتك':'للاستكشاف من المحتوى المنشور؛ اختر اهتماماتك لتخصيص النتائج'};}).sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));}
function answer(state,q){if(!normalize(q))return {message:'اكتب الخدمة أو العرض الذي تبحث عنه.',results:[]};const results=search(state,q).slice(0,4),compare=/(قارن|مقارن)/.test(normalize(q));if(!results.length)return {message:'لا تتوفر في المحتوى المنشور معلومات تطابق طلبك. جرّب اسم خدمة أو تصنيف آخر، أو خفّف شروط البحث. لا أستطيع تأكيد سعر أو عرض غير منشور.',results:[]};return {message:compare?'هذه مقارنة للمعلومات المنشورة فقط. السعر غير المنشور يظهر بوضوح؛ لا يمكنني الحكم على الجودة أو التوفر الفعلي.':'وجدت هذه الخيارات في بيانات المنصة. راجع التفاصيل قبل إكمال الإجراء؛ قد يكون المحتوى توضيحيًا والتوفر الفعلي غير مؤكد.',results};}
root.SaeeSmart={normalize,concepts,price,catalog,search,recommend,answer,interests};
})(typeof window==='undefined'?globalThis:window);
