import { env } from 'cloudflare:workers';
export const dynamic = 'force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{key:string}>}){
 const {key}=await params;
 if(!/^[a-f0-9]{64}\.(png|jpeg|webp|gif)$/.test(key)||!env.BUCKET)return new Response('Not found',{status:404});
 const file=await env.BUCKET.get('media/'+key);
 if(!file)return new Response('Not found',{status:404});
 const headers=new Headers({'Cache-Control':'private, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});file.writeHttpMetadata(headers);headers.set('ETag',file.httpEtag);
 if(request.headers.get('if-none-match')===file.httpEtag)return new Response(null,{status:304,headers});
 return new Response(file.body,{headers});
}
