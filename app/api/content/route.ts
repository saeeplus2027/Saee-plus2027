import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { contentRequest } from '../../../lib/cms';
export const dynamic = 'force-dynamic';
export async function GET(request:Request){return contentRequest(request,env,await getChatGPTUser());}
export async function PUT(request:Request){return contentRequest(request,env,await getChatGPTUser());}
