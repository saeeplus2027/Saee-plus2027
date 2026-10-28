const enc = new TextEncoder();

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });

const hex = bytes =>
  [...new Uint8Array(bytes)]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');

const random = () =>
  hex(crypto.getRandomValues(new Uint8Array(32)));

const hash = async s =>
  hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

// Cloudflare runtime: use no more than 100000 iterations.
async function derive(password, salt) {
  const k = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  return hex(
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: enc.encode(salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      k,
      256
    )
  );
}

const cookie = (token, age) =>
  `saee_session=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${age}`;

const emailOk = e =>
  typeof e === 'string' &&
  e.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const error = (message, status = 400) =>
  json({ error: message }, status);

async function readBody(req) {
  const size = Number(req.headers.get('content-length') || 0);

  if (size > 1200000) {
    throw Error('حجم الطلب كبير');
  }

  const text = await req.text();

  if (text.length > 1200000) {
    throw Error('حجم الطلب كبير');
  }

  return JSON.parse(text);
}

async function identity(req, env) {
  const token = (req.headers.get('cookie') || '')
    .match(/(?:^|;\s*)saee_session=([a-f0-9]{64})/)?.[1];

  if (!token) return null;

  return await env.DB.prepare(
    `SELECT u.id, u.email, u.is_admin
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`
  )
    .bind(await hash(token), Date.now())
    .first();
}

async function throttle(env, key, limit = 10) {
  const t = Math.floor(Date.now() / 900000);
  const id = await hash(key + ':' + t);

  await env.DB.prepare(
    `INSERT INTO rate_limits(key, count)
     VALUES (?, 1)
     ON CONFLICT(key)
     DO UPDATE SET count = count + 1`
  ).bind(id).run();

  const row = await env.DB.prepare(
    'SELECT count FROM rate_limits WHERE key = ?'
  ).bind(id).first();

  return row.count <= limit;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('origin') || '';

    const allowed = (env.SITE_ORIGIN || '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);

    const cors = allowed.includes(origin)
      ? {
          'access-control-allow-origin': origin,
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'Content-Type, If-Match',
          'vary': 'Origin'
        }
      : {};

    const reply = (data, status = 200, extra = {}) =>
      json(data, status, { ...cors, ...extra });

    const fail = (msg, status = 400) =>
      reply({ error: msg }, status);

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
          'access-control-allow-headers': 'Content-Type, If-Match',
          'access-control-max-age': '600'
        }
      });
    }

    const path = new URL(req.url).pathname;

    if (!path.startsWith('/api/')) {
      return fail('Not found', 404);
    }

    if (origin && !allowed.includes(origin)) {
      return fail('Origin not allowed', 403);
    }

    if (
      req.method !== 'GET' &&
      (!origin || !allowed.includes(origin))
    ) {
      return fail('Origin required', 403);
    }

    try {
      // =========================================
      // GET SITE CONTENT
      // =========================================

      if (path === '/api/content' && req.method === 'GET') {
        const row = await env.DB.prepare(
          'SELECT content, revision FROM site_content WHERE id = 1'
        ).first();

        if (!row) {
          return fail('لم يتم استيراد محتوى الموقع بعد', 503);
        }

        const user = await identity(req, env);

        return reply(
          {
            state: JSON.parse(row.content),
            revision: row.revision,
            canEdit: !!user?.is_admin
          },
          200,
          { etag: `"${row.revision}"` }
        );
      }

      // =========================================
      // CURRENT USER
      // =========================================

      if (path === '/api/me' && req.method === 'GET') {
        const user = await identity(req, env);

        return reply({
          user: user
            ? {
                id: user.id,
                email: user.email,
                admin: !!user.is_admin
              }
            : null
        });
      }

      // =========================================
      // ADMIN LOGIN
      // =========================================

      if (path === '/api/admin-login' && req.method === 'POST') {
        if (
          !await throttle(
            env,
            (req.headers.get('cf-connecting-ip') || 'unknown') +
              ':admin-login',
            8
          )
        ) {
          return fail('محاولات كثيرة، حاول لاحقاً', 429);
        }

        const b = await readBody(req);

        const supplied =
          typeof b.password === 'string' ? b.password : '';

        if (!supplied || supplied.length > 128) {
          return fail('كلمة المرور غير صحيحة', 401);
        }

        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS admin_credentials (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            updated_at INTEGER NOT NULL
          )
        `).run();

        const credential = await env.DB.prepare(
          `SELECT salt, password_hash
           FROM admin_credentials
           WHERE id = 1`
        ).first();

        if (credential) {
          // Existing permanent admin password.
          const candidate = await derive(
            supplied,
            credential.salt
          );

          if (candidate !== credential.password_hash) {
            return fail('كلمة المرور غير صحيحة', 401);
          }
        } else {
          // First login uses the Cloudflare bootstrap secret.
          if (!env.ADMIN_PASSWORD) {
            return fail(
              'إعداد ADMIN_PASSWORD غير موجود في Cloudflare',
              503
            );
          }

          if (
            (await hash(supplied)) !==
            (await hash(env.ADMIN_PASSWORD))
          ) {
            return fail('كلمة المرور غير صحيحة', 401);
          }
        }

        const email = String(
          env.ADMIN_USER_EMAIL || 'admin@saee.local'
        ).trim().toLowerCase();

        const existing = await env.DB.prepare(
          'SELECT id FROM users WHERE email = ?'
        ).bind(email).first();

        let userId;

        if (existing) {
          userId = existing.id;

          await env.DB.prepare(
            'UPDATE users SET is_admin = 1 WHERE id = ?'
          ).bind(userId).run();
        } else {
          userId = crypto.randomUUID();

          const salt = random();
          const password_hash = await derive(random(), salt);

          await env.DB.prepare(`
            INSERT INTO users
              (id, email, salt, password_hash, is_admin)
            VALUES (?, ?, ?, ?, 1)
          `).bind(
            userId,
            email,
            salt,
            password_hash
          ).run();
        }

        const token = random();

        await env.DB.prepare(`
          INSERT INTO sessions
            (token_hash, user_id, expires_at)
          VALUES (?, ?, ?)
        `).bind(
          await hash(token),
          userId,
          Date.now() + 7 * 86400000
        ).run();

        return reply(
          {
            message: 'تم تسجيل دخول الإدارة',
            needsPasswordSetup: !credential
          },
          200,
          { 'set-cookie': cookie(token, 604800) }
        );
      }

      // =========================================
      // CHANGE ADMIN PASSWORD
      // =========================================

      if (
        path === '/api/admin-change-password' &&
        req.method === 'POST'
      ) {
        const user = await identity(req, env);

        if (!user?.is_admin) {
          return fail(
            'يجب تسجيل الدخول إلى الإدارة أولاً',
            401
          );
        }

        const ip =
          req.headers.get('cf-connecting-ip') || 'unknown';

        if (
          !await throttle(
            env,
            ip + ':admin-change-password',
            5
          )
        ) {
          return fail('محاولات كثيرة، حاول لاحقاً', 429);
        }

        const b = await readBody(req);

        const currentPassword =
          typeof b.currentPassword === 'string'
            ? b.currentPassword
            : '';

        const newPassword =
          typeof b.newPassword === 'string'
            ? b.newPassword
            : '';

        if (
          newPassword.length < 12 ||
          newPassword.length > 128
        ) {
          return fail(
            'كلمة المرور الجديدة يجب أن تكون بين 12 و128 حرفاً'
          );
        }

        if (currentPassword === newPassword) {
          return fail('اختر كلمة مرور مختلفة عن الحالية');
        }

        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS admin_credentials (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            updated_at INTEGER NOT NULL
          )
        `).run();

        const credential = await env.DB.prepare(
          `SELECT salt, password_hash
           FROM admin_credentials
           WHERE id = 1`
        ).first();

        if (credential) {
          const candidate = await derive(
            currentPassword,
            credential.salt
          );

          if (candidate !== credential.password_hash) {
            return fail(
              'كلمة المرور الحالية غير صحيحة',
              401
            );
          }
        } else {
          // The current session was created after verifying
          // the ADMIN_PASSWORD bootstrap secret.
          if (
            !env.ADMIN_PASSWORD ||
            (await hash(currentPassword)) !==
              (await hash(env.ADMIN_PASSWORD))
          ) {
            return fail(
              'كلمة المرور الحالية غير صحيحة',
              401
            );
          }
        }

        const salt = random();
        const password_hash = await derive(
          newPassword,
          salt
        );

        await env.DB.prepare(`
          INSERT INTO admin_credentials
            (id, salt, password_hash, updated_at)
          VALUES (1, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            salt = excluded.salt,
            password_hash = excluded.password_hash,
            updated_at = excluded.updated_at
        `).bind(
          salt,
          password_hash,
          Date.now()
        ).run();

        return reply({
          success: true,
          message:
            'تم تغيير كلمة المرور. سجّل الدخول مجدداً.'
        });
      }

      // =========================================
      // SAVE SITE CONTENT
      // =========================================

      const user = await identity(req, env);

      if (path === '/api/content' && req.method === 'PUT') {
        if (!user?.is_admin) {
          return fail(
            'يجب تسجيل الدخول إلى الإدارة أولاً',
            401
          );
        }

        const b = await readBody(req);
        const content = b.state || b.content || b;

        if (
          !content ||
          content.version !== 1 ||
          !Array.isArray(content.items) ||
          !Array.isArray(content.services) ||
          !Array.isArray(content.places)
        ) {
          return fail('محتوى غير صالح');
        }

        const str = JSON.stringify(content);

        if (str.length > 950000) {
          return fail('حجم المحتوى والصور تجاوز حد الحفظ الحالي. احذف صورًا إضافية أو اختصر النصوص ثم أعد المحاولة.', 413);
        }

        const headerRevision = Number(
          (req.headers.get('if-match') || '')
            .replaceAll('"', '')
        );

        const expected = Number(
          b.expected_revision ?? headerRevision
        );

        if (!Number.isFinite(expected)) {
          return fail('رقم مراجعة المحتوى مفقود', 400);
        }

        const result = await env.DB.prepare(`
          UPDATE site_content
          SET content = ?, revision = revision + 1
          WHERE id = 1 AND revision = ?
        `).bind(str, expected).run();

        if (!result.meta.changes) {
          return fail(
            'تم تعديل المحتوى من مكان آخر، حدّث الصفحة ثم أعد المحاولة',
            409
          );
        }

        const row = await env.DB.prepare(
          'SELECT revision FROM site_content WHERE id = 1'
        ).first();

        return reply(
          {
            state: content,
            revision: row.revision,
            canEdit: true
          },
          200,
          { etag: `"${row.revision}"` }
        );
      }


      // =========================================
      // GLOBAL DISCOUNT USAGE (24 HOURS)
      // One shared lock per discount ID, across all users and devices.
      // This endpoint is intentionally public because the button is available
      // without requiring each visitor to create an account.
      // =========================================
      if (
        path === '/api/discount-usage' &&
        (req.method === 'GET' || req.method === 'POST')
      ) {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS discount_usage_global (
            discount_id TEXT PRIMARY KEY,
            used_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
          )
        `).run();

        if (req.method === 'GET') {
          const now = Date.now();
          const rows = await env.DB.prepare(`
            SELECT discount_id, used_at, expires_at
            FROM discount_usage_global
            WHERE expires_at > ?
          `).bind(now).all();
          const usages = {};
          for (const row of (rows.results || [])) {
            usages[row.discount_id] = {
              usedAt: Number(row.used_at),
              expiresAt: Number(row.expires_at)
            };
          }
          return reply({ usages });
        }

        const ip = req.headers.get('cf-connecting-ip') || 'unknown';
        if (!await throttle(env, ip + ':discount-use', 40)) {
          return fail('تم تجاوز عدد المحاولات. حاول لاحقاً.', 429);
        }

        const body = await readBody(req);
        const discountId = String(body.discountId || '').trim();
        if (!/^[a-zA-Z0-9_-]{1,200}$/.test(discountId)) {
          return fail('معرّف الخصم غير صالح.');
        }

        const now = Date.now();
        const expiresAt = now + 24 * 60 * 60 * 1000;
        const result = await env.DB.prepare(`
          INSERT INTO discount_usage_global (discount_id, used_at, expires_at)
          VALUES (?, ?, ?)
          ON CONFLICT(discount_id) DO UPDATE SET
            used_at = excluded.used_at,
            expires_at = excluded.expires_at
          WHERE discount_usage_global.expires_at <= ?
        `).bind(discountId, now, expiresAt, now).run();

        const row = await env.DB.prepare(`
          SELECT used_at, expires_at
          FROM discount_usage_global
          WHERE discount_id = ?
        `).bind(discountId).first();

        if (!result.meta.changes && row && Number(row.expires_at) > now) {
          return reply({
            success: false,
            alreadyUsed: true,
            usedAt: Number(row.used_at),
            expiresAt: Number(row.expires_at),
            remainingMs: Number(row.expires_at) - now
          }, 409);
        }

        return reply({
          success: true,
          usedAt: Number(row.used_at),
          expiresAt: Number(row.expires_at),
          remainingMs: Math.max(0, Number(row.expires_at) - now)
        });
      }

      // =========================================
      // LOGOUT
      // =========================================

      if (path === '/api/logout' && req.method === 'POST') {
        const token = (req.headers.get('cookie') || '')
          .match(/saee_session=([a-f0-9]{64})/)?.[1];

        if (token) {
          await env.DB.prepare(
            'DELETE FROM sessions WHERE token_hash = ?'
          ).bind(await hash(token)).run();
        }

        return reply(
          { message: 'تم تسجيل الخروج' },
          200,
          { 'set-cookie': cookie('', 0) }
        );
      }

      // =========================================
      // OTHER ACCOUNT ROUTES
      // =========================================

      if (
        ![
          '/api/signup',
          '/api/login',
          '/api/reset-request',
          '/api/reset-confirm'
        ].includes(path) ||
        req.method !== 'POST'
      ) {
        return fail('Not found', 404);
      }

      const ip =
        req.headers.get('cf-connecting-ip') || 'unknown';

      if (
        !await throttle(
          env,
          ip + ':' + path,
          path === '/api/login' ? 12 : 5
        )
      ) {
        return fail('محاولات كثيرة، حاول لاحقاً', 429);
      }

      const b = await readBody(req);

      const email = String(b.email || '')
        .trim()
        .toLowerCase();

      if (path !== '/api/reset-confirm' && !emailOk(email)) {
        return fail('البريد الإلكتروني غير صالح');
      }

      // SIGNUP
      if (path === '/api/signup') {
        if (
          typeof b.password !== 'string' ||
          b.password.length < 12 ||
          b.password.length > 128
        ) {
          return fail(
            'كلمة المرور يجب أن تكون بين 12 و128 حرفاً'
          );
        }

        const exists = await env.DB.prepare(
          'SELECT id FROM users WHERE email = ?'
        ).bind(email).first();

        if (exists) {
          return reply({
            message:
              'إذا كان البريد غير مستخدم، يمكنك تسجيل الدخول بعد إنشاء الحساب.'
          });
        }

        const salt = random();
        const password_hash = await derive(
          b.password,
          salt
        );

        await env.DB.prepare(`
          INSERT INTO users
            (id, email, salt, password_hash, is_admin)
          VALUES (?, ?, ?, ?, 0)
        `).bind(
          crypto.randomUUID(),
          email,
          salt,
          password_hash
        ).run();

        return reply({
          message: 'تم إنشاء الحساب. يمكنك تسجيل الدخول الآن.'
        });
      }

      // NORMAL LOGIN
      if (path === '/api/login') {
        const row = await env.DB.prepare(
          'SELECT * FROM users WHERE email = ?'
        ).bind(email).first();

        const candidate = await derive(
          String(b.password || ''),
          row?.salt || random()
        );

        if (!row || candidate !== row.password_hash) {
          return fail('بيانات الدخول غير صحيحة', 401);
        }

        const token = random();

        await env.DB.prepare(`
          INSERT INTO sessions
            (token_hash, user_id, expires_at)
          VALUES (?, ?, ?)
        `).bind(
          await hash(token),
          row.id,
          Date.now() + 7 * 86400000
        ).run();

        return reply(
          { message: 'تم تسجيل الدخول' },
          200,
          { 'set-cookie': cookie(token, 604800) }
        );
      }

      // PASSWORD RESET REQUEST
      if (path === '/api/reset-request') {
        const row = await env.DB.prepare(
          'SELECT id FROM users WHERE email = ?'
        ).bind(email).first();

        if (
          row &&
          env.RESEND_API_KEY &&
          env.FROM_EMAIL &&
          env.SITE_ORIGIN
        ) {
          const token = random();

          await env.DB.prepare(`
            INSERT INTO resets
              (token_hash, user_id, expires_at)
            VALUES (?, ?, ?)
          `).bind(
            await hash(token),
            row.id,
            Date.now() + 1800000
          ).run();

          const base = env.SITE_URL || allowed[0] + '/';
          const link =
            base + '?reset_token=' + token + '#account';

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + env.RESEND_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: env.FROM_EMAIL,
              to: [email],
              subject: 'استعادة كلمة مرور سعي بلس',
              text:
                'لتغيير كلمة المرور افتح الرابط خلال 30 دقيقة:\n' +
                link
            })
          });
        }

        return reply({
          message:
            'إذا كان البريد مسجلاً وخدمة البريد مفعلة، ستصلك تعليمات الاستعادة.'
        });
      }

      // PASSWORD RESET CONFIRM
      if (path === '/api/reset-confirm') {
        if (
          !/^[a-f0-9]{64}$/.test(String(b.token || '')) ||
          typeof b.password !== 'string' ||
          b.password.length < 12 ||
          b.password.length > 128
        ) {
          return fail('رابط أو كلمة مرور غير صالحة');
        }

        const tokenHash = await hash(b.token);

        const row = await env.DB.prepare(`
          SELECT user_id FROM resets
          WHERE token_hash = ? AND expires_at > ?
        `).bind(tokenHash, Date.now()).first();

        if (!row) {
          return fail('الرابط منتهي أو مستخدم', 400);
        }

        const salt = random();
        const password_hash = await derive(
          b.password,
          salt
        );

        await env.DB.batch([
          env.DB.prepare(
            'UPDATE users SET salt = ?, password_hash = ? WHERE id = ?'
          ).bind(salt, password_hash, row.user_id),

          env.DB.prepare(
            'DELETE FROM sessions WHERE user_id = ?'
          ).bind(row.user_id),

          env.DB.prepare(
            'DELETE FROM resets WHERE user_id = ?'
          ).bind(row.user_id)
        ]);

        return reply({
          message: 'تم تغيير كلمة المرور'
        });
      }

    } catch (e) {
      console.error('Saee Plus Worker Error:', e);

      return fail(
        'تعذر إكمال العملية. راجع سجلات Worker في Cloudflare.',
        500
      );
    }
  }
};
