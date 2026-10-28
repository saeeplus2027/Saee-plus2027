import { env } from 'cloudflare:workers';
export const dynamic = 'force-dynamic';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const noCache = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: noCache });
function validId(value: unknown): value is string { return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value); }
export async function GET(request: Request) {
  try {
    if (!env.DB) return reply({ error: 'خدمة الاستخدام المشترك غير مهيأة على الخادم.' }, 503);
    const id = new URL(request.url).searchParams.get('id');
    if (!validId(id)) return reply({ error: 'معرّف الخصم غير صالح.' }, 400);
    const row = await env.DB.prepare('SELECT used_at FROM discount_usage WHERE discount_id = ?').bind(id).first<{ used_at: number }>();
    const usedAt = Number(row?.used_at || 0);
    return reply({ usedAt, remainingMs: usedAt ? Math.max(0, COOLDOWN_MS - (Date.now() - usedAt)) : 0 });
  } catch (error) { console.error('Discount usage GET failed', error); return reply({ error: 'تعذر تحميل حالة الخصم من الخادم.' }, 503); }
}
export async function POST(request: Request) {
  try {
    if (!env.DB) return reply({ error: 'خدمة الاستخدام المشترك غير مهيأة على الخادم.' }, 503);
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) return reply({ error: 'طلب غير موثوق.' }, 403);
    if (!request.headers.get('content-type')?.includes('application/json')) return reply({ error: 'نوع الطلب غير صالح.' }, 415);
    let body: unknown;
    try { body = await request.json(); } catch { return reply({ error: 'بيانات الطلب غير صالحة.' }, 400); }
    const id = (body as { id?: unknown } | null)?.id;
    if (!validId(id)) return reply({ error: 'معرّف الخصم غير صالح.' }, 400);
    const now = Date.now(), cutoff = now - COOLDOWN_MS;
    const result = await env.DB.prepare('INSERT INTO discount_usage (discount_id, used_at) VALUES (?, ?) ON CONFLICT(discount_id) DO UPDATE SET used_at = excluded.used_at WHERE discount_usage.used_at <= ? RETURNING used_at').bind(id, now, cutoff).first<{ used_at: number }>();
    if (!result) {
      const existing = await env.DB.prepare('SELECT used_at FROM discount_usage WHERE discount_id = ?').bind(id).first<{ used_at: number }>();
      const usedAt = Number(existing?.used_at || now);
      return reply({ error: 'تم استخدام هذا الخصم خلال آخر 24 ساعة.', usedAt, remainingMs: Math.max(0, COOLDOWN_MS - (now - usedAt)) }, 409);
    }
    return reply({ ok: true, usedAt: Number(result.used_at), remainingMs: COOLDOWN_MS });
  } catch (error) { console.error('Discount usage POST failed', error); return reply({ error: 'تعذر تسجيل استخدام الخصم مركزيًا. حاول مرة أخرى.' }, 503); }
}
