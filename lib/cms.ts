import defaults from './default-content.json';
import { validate } from './content-validation.js';
type User={userId:string;email:string}|null;
const noCache={'Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const response=(body:unknown,status=200,extra:Record<string,string>={})=>Response.json(body,{status,headers:{...noCache,...extra}});
function admin(env:Cloudflare.Env,user:User){return Boolean(user&&env.SAI_ADMIN_EMAIL&&user.email.toLowerCase()===env.SAI_ADMIN_EMAIL.toLowerCase());}
export async function contentRequest(request:Request,env:Cloudflare.Env,user:User):Promise<Response>{
 try{
  if(!env.DB)return response({error:'قاعدة البيانات غير متاحة. لم تُحفظ أي تعديلات.'},503);
  const canEdit=admin(env,user);
  if(request.method==='GET'){
   const row=await env.DB.prepare('SELECT revision, payload FROM site_content WHERE id = ?').bind('main').first<{revision:number;payload:string}>();
   const state=row?JSON.parse(row.payload):defaults;
   const revision=row?.revision??0,etag='"'+revision+'"';
   if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers:{...noCache,ETag:etag}});
   return response({state,revision,canEdit},200,{ETag:etag});
  }
  if(request.method!=='PUT')return response({error:'Method not allowed'},405);
  if(!canEdit)return response({error:user?'هذا الحساب لا يملك صلاحية إدارة الموقع.':'سجّل الدخول بحساب مالك الموقع لتتمكن من الحفظ.'},403);
  // JSON plus a same-origin Origin header prevents cross-site browser writes.
  const origin=request.headers.get('origin');
  if(!origin||origin!==new URL(request.url).origin)return response({error:'طلب الحفظ من مصدر غير موثوق.'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return response({error:'نوع الطلب غير صالح.'},415);
  const expected=request.headers.get('if-match');if(!expected||!/^"\d+"$/.test(expected))return response({error:'يلزم تحميل نسخة المحتوى أولًا.'},428);
  if(Number(request.headers.get('content-length')||0)>16*1024*1024)return response({error:'الصور كبيرة جدًا. خفف عدد الصور في عملية الحفظ.'},413);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>16*1024*1024)return response({error:'حجم المحتوى أكبر من الحد المتاح.'},413);
  let state;try{state=validate(JSON.parse(raw));}catch(e){return response({error:e instanceof Error?e.message:'بيانات غير صالحة'},400);}
  const expectedRevision=Number(expected.slice(1,-1));
  const current=await env.DB.prepare('SELECT revision FROM site_content WHERE id = ?').bind('main').first<{revision:number}>();
  if((current?.revision??0)!==expectedRevision)return response({error:'تغير المحتوى في نافذة أخرى. احتفظ بنص تعديلك ثم أعد تحميل لوحة الإدارة قبل الحفظ.'},409);
  const uploads=new Map<string,Promise<string>>();
  async function image(value:string):Promise<string>{
   if(!value.startsWith('data:'))return value;
   if(uploads.has(value))return uploads.get(value)!;
   const promise=(async()=>{
    if(!env.BUCKET)throw Error('تخزين الصور غير متاح. لم يتم الحفظ.');
    const m=/^data:image\/(png|jpeg|webp|gif);base64,([a-zA-Z0-9+/=]+)$/.exec(value);if(!m)throw Error('صيغة الصورة غير صالحة.');
    const binary=atob(m[2]);if(binary.length>4*1024*1024)throw Error('حجم الصورة الواحدة أكبر من 4 ميغابايت.');
    const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
    const key=hash+'.'+m[1];await env.BUCKET.put('media/'+key,bytes,{httpMetadata:{contentType:'image/'+m[1]}});return '/api/media/'+key;
   })();uploads.set(value,promise);return promise;
  }
  for(const item of state.items){if(item.image)item.image=await image(item.image);}
  for(const key of Object.keys(state.images))state.images[key]=await image(state.images[key]);
  const revision=Math.max(Date.now(),expectedRevision+1);state.revision=revision;
  const payload=JSON.stringify(state);
  if(new TextEncoder().encode(payload).length>1_500_000)return response({error:'النصوص أكبر من مساحة الحفظ. اختصر بعض المحتوى قبل المحاولة.'},413);
  const result=current
   ?await env.DB.prepare('UPDATE site_content SET revision = ?, payload = ?, updated_by = ? WHERE id = ? AND revision = ?').bind(revision,payload,user!.userId,'main',expectedRevision).run()
   :await env.DB.prepare('INSERT INTO site_content (id,revision,payload,updated_by) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind('main',revision,payload,user!.userId).run();
  if(!result.meta.changes)return response({error:'وصل تعديل آخر أثناء الحفظ. أعد تحميل اللوحة قبل المتابعة.'},409);
  return response({state,revision,canEdit:true},200,{ETag:'"'+revision+'"'});
 }catch(e){console.error('CMS request failed',e);return response({error:'تعذر الاتصال بحفظ الموقع. لم نؤكد حفظ التعديل؛ حاول مرة أخرى.'},503);}
}
