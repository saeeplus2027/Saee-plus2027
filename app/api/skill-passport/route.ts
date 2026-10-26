import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { freshSkillPassport, normalizeSkillPassport } from '../../../lib/skill-passport-validation.mjs';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 256 * 1024;
const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Vary': 'Cookie, oai-authenticated-user-id, oai-authenticated-user-email',
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: privateHeaders });
}

function trustedIdentityHeadersEnabled() {
  // Explicit opt-in prevents accidentally exposing a header-authenticated API on a generic Worker.
  // Set this only where the hosting platform strips/replaces client-supplied oai-authenticated-* headers.
  const bindings = env as unknown as Record<string, unknown>;
  return bindings.SAEE_AUTH_HEADERS_TRUSTED === 'true';
}

function identityConfigurationError() {
  return json({ error: 'خدمة الهوية غير مهيأة بأمان. لم يتم تحميل البيانات أو حفظها؛ انشر عبر منصة موثوقة تضبط ترويسات الهوية ثم فعّل إعداد SAEE_AUTH_HEADERS_TRUSTED.' }, 503);
}

async function currentUser() {
  // The owner key is derived only from the hosting platform's authenticated identity helper.
  // Never use a userId/ownerId supplied in the request body or query string.
  const user = await getChatGPTUser();
  if (!user) return null;
  const userId = typeof user.userId === 'string' ? user.userId.trim() : '';
  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (!userId || userId.length > 200 || /[\u0000-\u001f\u007f]/.test(userId)) return null;
  if (!email || email.length > 320 || /[\u0000-\u001f\u007f]/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { ...user, userId, email };
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return Boolean(origin) && origin === new URL(request.url).origin;
}

async function readLimitedBody(request: Request): Promise<string | null> {
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(combined);
}

async function requiredDb() {
  return env.DB ?? null;
}

export async function GET() {
  if (!trustedIdentityHeadersEnabled()) return identityConfigurationError();
  const user = await currentUser();
  if (!user) return json({ error: 'سجّل الدخول بحسابك للوصول إلى جواز المهارات.' }, 401);
  const db = await requiredDb();
  if (!db) return json({ error: 'خدمة التخزين غير مهيأة. لم تُحمّل البيانات.' }, 503);
  try {
    const row = await db.prepare(
      'SELECT payload, version, updated_at FROM skill_passports WHERE user_id = ? LIMIT 1'
    ).bind(user.userId).first<{ payload: string; version: number; updated_at: string }>();
    let state = freshSkillPassport();
    if (row) {
      try { state = normalizeSkillPassport(JSON.parse(row.payload)); }
      catch { return json({ error: 'تعذر التحقق من بيانات الجواز المحفوظة. لم تُعدّل البيانات.' }, 500); }
    }
    return json({
      state,
      version: row?.version ?? 0,
      updatedAt: row?.updated_at ?? null,
      user: { displayName: user.displayName, email: user.email },
    });
  } catch (error) {
    console.error('Skill passport read failed', error);
    return json({ error: 'تعذر تحميل الجواز من قاعدة البيانات.' }, 503);
  }
}

export async function PUT(request: Request) {
  if (!trustedIdentityHeadersEnabled()) return identityConfigurationError();
  const user = await currentUser();
  if (!user) return json({ error: 'انتهت جلسة الدخول. سجّل الدخول ثم حاول مجددًا.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'تم رفض الطلب لأنه لا يأتي من نفس الموقع.' }, 403);
  if ((request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return json({ error: 'نوع الطلب غير صالح.' }, 415);
  }
  const ifMatch = request.headers.get('if-match') ?? '';
  const match = /^"(0|[1-9]\d*)"$/.exec(ifMatch);
  if (!match) return json({ error: 'إصدار الحفظ غير موجود. أعد تحميل الجواز قبل الحفظ.' }, 428);
  const expectedVersion = Number(match[1]);
  const rawBody = await readLimitedBody(request).catch(() => null);
  if (rawBody === null) return json({ error: 'حجم الطلب كبير جدًا أو ترميزه غير صالح (الحد 256 كيلوبايت).' }, 413);
  let input: unknown;
  try { input = JSON.parse(rawBody); }
  catch { return json({ error: 'بيانات JSON غير صالحة.' }, 400); }
  let state: ReturnType<typeof normalizeSkillPassport>;
  try {
    const body = input as { state?: unknown };
    state = normalizeSkillPassport(body?.state);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'بيانات الجواز غير صالحة.' }, 400);
  }
  const db = await requiredDb();
  if (!db) return json({ error: 'خدمة التخزين غير مهيأة. لم تُحفظ التعديلات.' }, 503);
  const payload = JSON.stringify(state);
  const updatedAt = new Date().toISOString();
  try {
    if (expectedVersion === 0) {
      const result = await db.prepare(
        'INSERT INTO skill_passports (user_id, payload, version, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING'
      ).bind(user.userId, payload, updatedAt).run();
      if (result.meta.changes !== 1) return json({ error: 'تم إنشاء جواز في نافذة أخرى. أعد تحميل الجواز قبل الحفظ.' }, 409);
      return json({ ok: true, version: 1, updatedAt });
    }
    const result = await db.prepare(
      'UPDATE skill_passports SET payload = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND version = ?'
    ).bind(payload, updatedAt, user.userId, expectedVersion).run();
    if (result.meta.changes !== 1) return json({ error: 'تغيّرت البيانات في نافذة أخرى. صدّر أي تعديلات غير محفوظة ثم أعد تحميل الصفحة.' }, 409);
    return json({ ok: true, version: expectedVersion + 1, updatedAt });
  } catch (error) {
    console.error('Skill passport save failed', error);
    return json({ error: 'فشل الحفظ في قاعدة البيانات. لم يتم تأكيد التعديل.' }, 503);
  }
}

export async function DELETE(request: Request) {
  if (!trustedIdentityHeadersEnabled()) return identityConfigurationError();
  const user = await currentUser();
  if (!user) return json({ error: 'سجّل الدخول قبل حذف الجواز.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'تم رفض الطلب لأنه لا يأتي من نفس الموقع.' }, 403);
  const db = await requiredDb();
  if (!db) return json({ error: 'خدمة التخزين غير مهيأة. لم تُحذف البيانات.' }, 503);
  try {
    // The owner key always comes from the trusted identity provider, never the body.
    await db.prepare('DELETE FROM skill_passports WHERE user_id = ?').bind(user.userId).run();
    return json({ ok: true });
  } catch (error) {
    console.error('Skill passport delete failed', error);
    return json({ error: 'تعذر حذف الجواز من قاعدة البيانات.' }, 503);
  }
}
