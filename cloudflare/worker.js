const enc = new TextEncoder();

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });

const hex = bytes =>
  [...new Uint8Array(bytes)]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");

const random = () =>
  hex(crypto.getRandomValues(new Uint8Array(32)));

const hash = async value =>
  hex(await crypto.subtle.digest("SHA-256", enc.encode(value)));

async function derive(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: enc.encode(salt),
        iterations: 310000,
        hash: "SHA-256"
      },
      key,
      256
    )
  );
}

const cookie = (token, age) =>
  `saee_session=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${age}`;

const adminCookie = (token, age) =>
  `saee_admin=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${age}`;

const emailOk = email =>
  typeof email === "string" &&
  email.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

async function readBody(req) {
  const size = Number(req.headers.get("content-length") || 0);

  if (size > 1200000) {
    throw new Error("حجم الطلب كبير");
  }

  const text = await req.text();

  if (text.length > 1200000) {
    throw new Error("حجم الطلب كبير");
  }

  return JSON.parse(text);
}

// إنشاء توقيع لجلسة الأدمن
async function signAdmin(payload, env) {
  if (!env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD غير مضبوط");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(env.ADMIN_PASSWORD),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(payload)
  );

  return hex(signature);
}

// إنشاء جلسة أدمن صالحة لمدة 8 ساعات
async function createAdminToken(env) {
  const issuedAt = Date.now().toString();
  const nonce = random();
  const payload = `${issuedAt}.${nonce}`;
  const signature = await signAdmin(payload, env);

  return `${payload}.${signature}`;
}

// التحقق من صلاحية جلسة الأدمن
async function isAdminSession(req, env) {
  if (!env.ADMIN_PASSWORD) {
    return false;
  }

  const token = (req.headers.get("cookie") || "")
    .match(/(?:^|;\s*)saee_admin=([0-9]{13}\.[a-f0-9]{64}\.[a-f0-9]{64})/)
    ?.[1];

  if (!token) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    return false;
  }

  const [issuedAt, nonce, signature] = parts;
  const timestamp = Number(issuedAt);
  const now = Date.now();
  const maxAge = 8 * 60 * 60 * 1000;

  if (
    !Number.isFinite(timestamp) ||
    timestamp > now ||
    now - timestamp >= maxAge
  ) {
    return false;
  }

  const expected = await signAdmin(
    `${issuedAt}.${nonce}`,
    env
  );

  return signature === expected;
}

// التحقق من جلسة المستخدم العادي
async function identity(req, env) {
  const token = (req.headers.get("cookie") || "")
    .match(/(?:^|;\s*)saee_session=([a-f0-9]{64})/)
    ?.[1];

  if (!token) {
    return null;
  }

  return await env.DB.prepare(
    `SELECT u.id, u.email, u.is_admin
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?
       AND s.expires_at > ?`
  )
    .bind(await hash(token), Date.now())
    .first();
}

// تحديد عدد محاولات الطلبات
async function throttle(env, key, limit = 10) {
  const timeWindow = Math.floor(Date.now() / 900000);
  const id = await hash(`${key}:${timeWindow}`);

  await env.DB.prepare(
    `INSERT INTO rate_limits(key, count)
     VALUES (?, 1)
     ON CONFLICT(key)
     DO UPDATE SET count = count + 1`
  )
    .bind(id)
    .run();

  const row = await env.DB.prepare(
    "SELECT count FROM rate_limits WHERE key = ?"
  )
    .bind(id)
    .first();

  return row.count <= limit;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get("origin") || "";

    const allowed = (env.SITE_ORIGIN || "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean);

    const cors = allowed.includes(origin)
      ? {
          "access-control-allow-origin": origin,
          "access-control-allow-credentials": "true",
          "vary": "Origin"
        }
      : {};

    const reply = (data, status = 200, extra = {}) =>
      json(data, status, {
        ...cors,
        ...extra
      });

    const fail = (message, status = 400) =>
      reply({ error: message }, status);

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          "access-control-allow-methods":
            "GET,POST,PUT,OPTIONS",
          "access-control-allow-headers": "Content-Type",
          "access-control-max-age": "600"
        }
      });
    }

    const path = new URL(req.url).pathname;

    if (!path.startsWith("/api/")) {
      return fail("Not found", 404);
    }

    if (origin && !allowed.includes(origin)) {
      return fail("Origin not allowed", 403);
    }

    if (
      req.method !== "GET" &&
      (!origin || !allowed.includes(origin))
    ) {
      return fail("Origin required", 403);
    }

    try {
      // =========================================
      // 1. تسجيل دخول الأدمن بكلمة السر فقط
      // =========================================
      if (
        path === "/api/admin-login" &&
        req.method === "POST"
      ) {
        if (!env.ADMIN_PASSWORD) {
          return fail(
            "ADMIN_PASSWORD غير مضبوط في Cloudflare",
            500
          );
        }

        const ip =
          req.headers.get("cf-connecting-ip") || "unknown";

        if (
          !await throttle(
            env,
            `${ip}:/api/admin-login`,
            5
          )
        ) {
          return fail(
            "محاولات كثيرة، حاول لاحقاً",
            429
          );
        }

        const body = await readBody(req);

        if (
          typeof body.password !== "string" ||
          body.password.length === 0 ||
          body.password !== env.ADMIN_PASSWORD
        ) {
          return fail("كلمة السر غير صحيحة", 401);
        }

        const token = await createAdminToken(env);

        return reply(
          {
            success: true,
            message: "تم تسجيل دخول الأدمن بنجاح"
          },
          200,
          {
            "set-cookie": adminCookie(token, 28800)
          }
        );
      }

      // =========================================
      // 2. قراءة محتوى الموقع من قاعدة البيانات
      // =========================================
      if (
        path === "/api/content" &&
        req.method === "GET"
      ) {
        const row = await env.DB.prepare(
          `SELECT content, revision
           FROM site_content
           WHERE id = 1`
        ).first();

        if (!row) {
          return fail(
            "لم يتم استيراد محتوى الموقع بعد",
            503
          );
        }

        const admin = await isAdminSession(req, env);
        const user = await identity(req, env);

        return reply({
          content: JSON.parse(row.content),
          revision: row.revision,
          canEdit: admin || !!user?.is_admin
        });
      }

      // =========================================
      // 3. التحقق من حالة تسجيل الدخول
      // =========================================
      if (
        path === "/api/me" &&
        req.method === "GET"
      ) {
        const admin = await isAdminSession(req, env);
        const user = await identity(req, env);

        if (admin) {
          return reply({
            user: {
              id: "admin",
              email: "",
              admin: true
            }
          });
        }

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
      // 4. حفظ تعديلات الموقع
      // =========================================
      if (
        path === "/api/content" &&
        req.method === "PUT"
      ) {
        const admin = await isAdminSession(req, env);
        const user = await identity(req, env);

        if (!admin && !user?.is_admin) {
          return fail("غير مصرح", 403);
        }

        const body = await readBody(req);

        if (
          !body.content ||
          body.content.version !== 1 ||
          !Array.isArray(body.content.items) ||
          !Array.isArray(body.content.services) ||
          !Array.isArray(body.content.places)
        ) {
          return fail("محتوى غير صالح");
        }

        const contentString = JSON.stringify(
          body.content
        );

        if (contentString.length > 950000) {
          return fail("المحتوى كبير جداً", 413);
        }

        if (
          !Number.isSafeInteger(body.expected_revision) ||
          body.expected_revision < 0
        ) {
          return fail(
            "رقم إصدار المحتوى غير صالح",
            400
          );
        }

        const result = await env.DB.prepare(
          `UPDATE site_content
           SET content = ?,
               revision = revision + 1
           WHERE id = 1
             AND revision = ?`
        )
          .bind(
            contentString,
            body.expected_revision
          )
          .run();

        if (!result.meta.changes) {
          return fail(
            "تم تعديل المحتوى من مكان آخر، حدّث الصفحة",
            409
          );
        }

        const row = await env.DB.prepare(
          `SELECT revision
           FROM site_content
           WHERE id = 1`
        ).first();

        return reply({
          content: body.content,
          revision: row.revision,
          message: "تم حفظ التعديلات بنجاح"
        });
      }

      // =========================================
      // 5. تسجيل الخروج
      // =========================================
      if (
        path === "/api/logout" &&
        req.method === "POST"
      ) {
        const token = (req.headers.get("cookie") || "")
          .match(/(?:^|;\s*)saee_session=([a-f0-9]{64})/)
          ?.[1];

        if (token) {
          await env.DB.prepare(
            "DELETE FROM sessions WHERE token_hash = ?"
          )
            .bind(await hash(token))
            .run();
        }

        return reply(
          {
            success: true,
            message: "تم تسجيل الخروج"
          },
          200,
          {
            "set-cookie": [
              cookie("", 0),
              adminCookie("", 0)
            ].join(", ")
          }
        );
      }

      // =========================================
      // 6. بقية مسارات الحسابات
      // =========================================
      if (
        ![
          "/api/signup",
          "/api/login",
          "/api/reset-request",
          "/api/reset-confirm"
        ].includes(path) ||
        req.method !== "POST"
      ) {
        return fail("Not found", 404);
      }

      const ip =
        req.headers.get("cf-connecting-ip") || "unknown";

      const limit =
        path === "/api/login" ? 12 : 5;

      if (
        !await throttle(
          env,
          `${ip}:${path}`,
          limit
        )
      ) {
        return fail(
          "محاولات كثيرة، حاول لاحقاً",
          429
        );
      }

      const body = await readBody(req);

      const email = String(body.email || "")
        .trim()
        .toLowerCase();

      if (
        path !== "/api/reset-confirm" &&
        !emailOk(email)
      ) {
        return fail("البريد الإلكتروني غير صالح");
      }

      // إنشاء حساب
      if (path === "/api/signup") {
        if (
          typeof body.password !== "string" ||
          body.password.length < 12 ||
          body.password.length > 128
        ) {
          return fail(
            "كلمة المرور يجب أن تكون بين 12 و128 حرفاً"
          );
        }

        const exists = await env.DB.prepare(
          "SELECT id FROM users WHERE email = ?"
        )
          .bind(email)
          .first();

        if (exists) {
          return reply({
            message:
              "إذا كان البريد غير مستخدم، يمكنك تسجيل الدخول بعد إنشاء الحساب."
          });
        }

        const salt = random();

        const passwordHash = await derive(
          body.password,
          salt
        );

        await env.DB.prepare(
          `INSERT INTO users
           (id, email, salt, password_hash, is_admin)
           VALUES (?, ?, ?, ?, 0)`
        )
          .bind(
            crypto.randomUUID(),
            email,
            salt,
            passwordHash
          )
          .run();

        return reply({
          message:
            "تم إنشاء الحساب. يمكنك تسجيل الدخول الآن."
        });
      }

      // تسجيل دخول المستخدم العادي
      if (path === "/api/login") {
        const row = await env.DB.prepare(
          "SELECT * FROM users WHERE email = ?"
        )
          .bind(email)
          .first();

        const candidate = await derive(
          String(body.password || ""),
          row?.salt || random()
        );

        if (
          !row ||
          candidate !== row.password_hash
        ) {
          return fail(
            "بيانات الدخول غير صحيحة",
            401
          );
        }

        const token = random();

        await env.DB.prepare(
          `INSERT INTO sessions
           (token_hash, user_id, expires_at)
           VALUES (?, ?, ?)`
        )
          .bind(
            await hash(token),
            row.id,
            Date.now() + 7 * 86400000
          )
          .run();

        return reply(
          {
            success: true,
            message: "تم تسجيل الدخول"
          },
          200,
          {
            "set-cookie": cookie(token, 604800)
          }
        );
      }

      // =========================================
      // 7. طلب استعادة كلمة المرور
      // =========================================
      if (path === "/api/reset-request") {
        const row = await env.DB.prepare(
          "SELECT id FROM users WHERE email = ?"
        )
          .bind(email)
          .first();

        if (
          row &&
          env.RESEND_API_KEY &&
          env.FROM_EMAIL &&
          env.SITE_ORIGIN
        ) {
          const token = random();

          await env.DB.prepare(
            `INSERT INTO resets
             (token_hash, user_id, expires_at)
             VALUES (?, ?, ?)`
          )
            .bind(
              await hash(token),
              row.id,
              Date.now() + 1800000
            )
            .run();

          const base =
            env.SITE_URL ||
            allowed[0] + "/";

          const link =
            base +
            "?reset_token=" +
            token +
            "#account";

          const emailResponse = await fetch(
            "https://api.resend.com/emails",
            {
              method: "POST",
              headers: {
                "Authorization":
                  `Bearer ${env.RESEND_API_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                from: env.FROM_EMAIL,
                to: [email],
                subject:
                  "استعادة كلمة مرور سعي بلس",
                text:
                  "لتغيير كلمة المرور افتح الرابط خلال 30 دقيقة:\n" +
                  link
              })
            }
          );

          if (!emailResponse.ok) {
            console.error(
              "تعذر إرسال رسالة استعادة كلمة المرور"
            );
          }
        }

        return reply({
          message:
            "إذا كان البريد مسجلاً وخدمة البريد مفعلة، ستصلك تعليمات الاستعادة."
        });
      }

      // =========================================
      // 8. تأكيد تغيير كلمة المرور
      // =========================================
      if (path === "/api/reset-confirm") {
        if (
          !/^[a-f0-9]{64}$/.test(
            String(body.token || "")
          ) ||
          typeof body.password !== "string" ||
          body.password.length < 12 ||
          body.password.length > 128
        ) {
          return fail(
            "رابط أو كلمة مرور غير صالحة"
          );
        }

        const tokenHash = await hash(body.token);

        const row = await env.DB.prepare(
          `SELECT user_id
           FROM resets
           WHERE token_hash = ?
             AND expires_at > ?`
        )
          .bind(tokenHash, Date.now())
          .first();

        if (!row) {
          return fail(
            "الرابط منتهي أو مستخدم",
            400
          );
        }

        const salt = random();

        const passwordHash = await derive(
          body.password,
          salt
        );

        await env.DB.batch([
          env.DB.prepare(
            `UPDATE users
             SET salt = ?, password_hash = ?
             WHERE id = ?`
          ).bind(
            salt,
            passwordHash,
            row.user_id
          ),

          env.DB.prepare(
            "DELETE FROM sessions WHERE user_id = ?"
          ).bind(row.user_id),

          env.DB.prepare(
            "DELETE FROM resets WHERE user_id = ?"
          ).bind(row.user_id)
        ]);

        return reply({
          success: true,
          message: "تم تغيير كلمة المرور"
        });
      }

      return fail("Not found", 404);

    } catch (e) {
      console.error("Worker error:", e);

      return fail(
        e instanceof SyntaxError
          ? "JSON غير صالح"
          : "تعذر إكمال العملية",
        400
      );
    }
  }
};
