
/* Saee Plus - shared content store backed by /api/content */

window.SiteStore = (() => {
  const key = "sai-plus-cms-v1";
  const remote = true;
  // The static GitHub Pages frontend talks to the separately deployed Cloudflare Worker.
  // Set the real deployed Cloudflare Worker URL in remote-config.js.
  // Keep this fallback only for backwards compatibility; a wrong Worker URL causes HTTP 404.
  const API_BASE = String(window.SAI_API_BASE || "https://saee-plus-api.ligagym.workers.dev").replace(/\/$/, "");
  const apiUrl = (path) => `${API_BASE}${path}`;

  let loaded = false;
  let canEdit = false;
  let busy = false;
  let etag = '"0"';
  let apiAvailable = false;

  const clone = (value) =>
    JSON.parse(JSON.stringify(value));

  const imageSrc = (value) => {
    value = String(value || "");

    if (
      /^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(value) ||
      /^https:\/\/[^\s<>"']+$/.test(value)
    ) return value;

    if (/^\/api\/media\/[a-f0-9]{64}\.(png|jpeg|webp|gif)$/.test(value)) return value;

    if (/^[a-zA-Z0-9_-]+$/.test(value))
      return "assets/" + value + ".jpg";

    if (/^assets\/[a-zA-Z0-9_.-]+$/.test(value))
      return value;

    return "";
  };

  function validate(data) {
    if (
      !data ||
      data.version !== 1 ||
      !Array.isArray(data.services) ||
      !Array.isArray(data.items) ||
      !Array.isArray(data.places) ||
      !data.texts ||
      typeof data.texts !== "object"
    ) {
      throw Error("بيانات سعي بلس غير صالحة.");
    }

    if (
      data.services.length > 50 ||
      data.items.length > 2000 ||
      data.places.length > 200
    ) {
      throw Error("حجم البيانات أكبر من المسموح.");
    }

    const ids = new Set();

    for (const service of data.services) {
      if (
        !Array.isArray(service) ||
        service.length < 4 ||
        !service.every((x) => typeof x === "string") ||
        !/^[a-z][a-z0-9_-]*$/.test(service[0]) ||
        ids.has(service[0]) ||
        ["admin", "home", "about", "services", "smart"].includes(service[0])
      ) {
        throw Error("يوجد قسم غير صالح أو مكرر.");
      }

      ids.add(service[0]);
    }

    const itemIds = new Set();

    for (const item of data.items) {
      if (
        !item ||
        typeof item.title !== "string" ||
        typeof item.cat !== "string" ||
        typeof item.desc !== "string" ||
        !ids.has(item.type) ||
        !/^[a-zA-Z0-9_-]+$/.test(item.id) ||
        itemIds.has(item.id)
      ) {
        throw Error("يوجد محتوى غير صالح أو مكرر.");
      }

      itemIds.add(item.id);

      for (const field of [
        "image", "badge", "meta", "extra",
        "price", "contact", "emoji"
      ]) {
        if (
          item[field] !== undefined &&
          typeof item[field] !== "string"
        ) {
          throw Error("يوجد حقل غير صالح.");
        }
      }

      if (item.image && !imageSrc(item.image)) {
        throw Error("رابط الصورة غير صالح.");
      }
    }

    for (const place of data.places) {
      if (
        !place ||
        typeof place.name !== "string" ||
        typeof place.desc !== "string" ||
        typeof place.cat !== "string" ||
        !Number.isFinite(place.x) ||
        !Number.isFinite(place.y) ||
        place.x < 0 || place.x > 95 ||
        place.y < 0 || place.y > 95
      ) {
        throw Error("بيانات أحد الأماكن غير صالحة.");
      }
    }

    for (const value of Object.values(data.texts)) {
      if (typeof value !== "string") {
        throw Error("تعديل النص غير صالح.");
      }
    }

    if (!data.images || typeof data.images !== "object") {
      data.images = {};
    }

    for (const value of Object.values(data.images)) {
      if (value && !imageSrc(value)) {
        throw Error("رابط صورة غير صالح.");
      }
    }

    if (
      !data.theme ||
      !/^#[0-9a-f]{6}$/i.test(data.theme.green) ||
      !/^#[0-9a-f]{6}$/i.test(data.theme.cream)
    ) {
      throw Error("ألوان الموقع غير صالحة.");
    }

    if (
      typeof data.siteName !== "string" ||
      !data.siteName.trim() ||
      !Array.isArray(data.hidden) ||
      !data.hidden.every((x) => typeof x === "string") ||
      !data.descriptions ||
      typeof data.descriptions !== "object"
    ) {
      throw Error("إعدادات الموقع غير صالحة.");
    }

    for (const value of Object.values(data.descriptions)) {
      if (typeof value !== "string") {
        throw Error("وصف القسم غير صالح.");
      }
    }

    data.notice = String(data.notice ?? "");
    data.mapNotice = String(data.mapNotice ?? "");

    return clone(data);
  }

  if (!window.SAI_DEFAULTS) {
    throw Error("ملف content-data.js غير محمّل أو لا يحتوي على SAI_DEFAULTS.");
  }

  let state = validate(clone(window.SAI_DEFAULTS));

  function notify() {
    window.dispatchEvent(new Event("sai-content-changed"));
  }

  function cache() {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (_) { /* Cache is optional. */ }
  }

  async function readResponse(response) {
    let body = {};
    try { body = await response.json(); } catch (_) {}
    if (!response.ok) {
      const message = response.status === 404
        ? `الخادم أعاد Not Found (404). عنوان Cloudflare Worker أو مسار API غير صحيح: ${API_BASE}`
        : (body.error || `تعذر تحميل المحتوى (HTTP ${response.status}).`);
      throw Error(message);
    }
    return body;
  }

  async function refresh(silent = false) {
    const previousRevision = Number(state.revision || 0);
    if (!silent) {
      loaded = false;
      apiAvailable = false;
    }
    try {
      const response = await fetch(apiUrl('/api/content'), {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      const body = await readResponse(response);
      state = validate(body.state ?? body.content);
      state.revision = Number(body.revision ?? state.revision ?? 0);
      etag = response.headers.get('ETag') || `"${state.revision}"`;
      canEdit = Boolean(body.canEdit ?? body.admin ?? body.user?.admin);
      apiAvailable = true;
      loaded = true;
      cache();
      if (!silent || Number(state.revision || 0) !== previousRevision) notify();
      return state;
    } catch (error) {
      // Keep the public site usable if the API route is missing or temporarily down.
      // The shared server remains the source of truth whenever the API is available.
      if (silent) {
        console.warn('Saee Plus: background refresh failed; keeping the current content.', error);
        return state;
      }
      console.error('Saee Plus: central content could not be loaded; using cached/default content.', error);
      try {
        const cached = localStorage.getItem(key);
        if (cached) state = validate(JSON.parse(cached));
      } catch (cacheError) {
        console.warn('Saee Plus: cached content is unavailable or invalid.', cacheError);
        // `state` already contains validated SAI_DEFAULTS.
      }
      canEdit = false;
      apiAvailable = false;
      loaded = true;
      notify();
      return state;
    }
  }

  // Compress embedded images only when the complete content payload approaches
  // the Worker storage ceiling. This also repairs older records that contain
  // large base64 images, without degrading images on ordinary text-only saves.
  function resizeDataImage(source, maxDimension, quality) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const scale = Math.min(1, maxDimension / image.naturalWidth, maxDimension / image.naturalHeight);
          const width = Math.max(1, Math.round(image.naturalWidth * scale));
          const height = Math.max(1, Math.round(image.naturalHeight * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d', { alpha: true });
          if (!context) throw Error('تعذرت معالجة الصورة في المتصفح.');
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL('image/webp', quality));
        } catch (error) { reject(error); }
      };
      image.onerror = () => reject(Error('تعذرت قراءة إحدى الصور لتقليل حجمها.'));
      image.src = source;
    });
  }

  async function compressEmbeddedImages(data, maxDimension, quality) {
    const copy = clone(data);
    const cache = new Map();
    async function walk(value) {
      if (typeof value === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/.test(value)) {
        if (!cache.has(value)) cache.set(value, resizeDataImage(value, maxDimension, quality));
        return cache.get(value);
      }
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) value[i] = await walk(value[i]);
      } else if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) value[key] = await walk(value[key]);
      }
      return value;
    }
    return await walk(copy);
  }

  async function fitContentPayload(data) {
    let result = data;
    let size = JSON.stringify({ content: result }).length;
    if (size <= 760000) return result;

    const levels = [
      { dimension: 1100, quality: 0.68 },
      { dimension: 850, quality: 0.56 },
      { dimension: 650, quality: 0.44 }
    ];
    for (const level of levels) {
      result = await compressEmbeddedImages(data, level.dimension, level.quality);
      size = JSON.stringify({ content: result }).length;
      if (size <= 900000) return result;
    }
    if (size > 900000) {
      throw Error('المحتوى والصور ما زال حجمها كبيرًا بعد الضغط التلقائي. قلّل عدد الصور الإضافية أو اختصر النصوص، ثم حاول الحفظ مرة أخرى.');
    }
    return result;
  }

  async function save(next) {
    if (busy) throw Error('جاري حفظ تعديل سابق.');
    if (!loaded) throw Error('المحتوى لم يجهز بعد. أعد تحميل الصفحة ثم حاول مجددًا.');
    if (!apiAvailable) throw Error('تعذر الاتصال بخادم المحتوى. تم عرض نسخة محفوظة للقراءة فقط؛ لا يمكن حفظ التعديلات أو مزامنتها حتى يتم إصلاح الخادم.');
    if (!canEdit) throw Error('سجّل الدخول بحساب مالك الموقع لتتمكن من حفظ التعديلات.');
    busy = true;
    try {
      const checked = await fitContentPayload(validate(next));
      const payload = JSON.stringify({ content: checked });
      if (payload.length > 900000) throw Error('حجم المحتوى والصور أكبر من الحد المسموح للحفظ.');
      const response = await fetch(apiUrl('/api/content'), {
        method: 'PUT',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'If-Match': etag
        },
        body: payload
      });
      const body = await readResponse(response);
      state = validate(body.state ?? body.content);
      state.revision = Number(body.revision ?? state.revision ?? Date.now());
      etag = response.headers.get('ETag') || `"${state.revision}"`;
      canEdit = Boolean(body.canEdit ?? body.admin ?? body.user?.admin);
      cache();
      notify();
      return state;
    } finally {
      busy = false;
    }
  }


  async function apiPost(path, payload = {}) {
    const response = await fetch(apiUrl(path), {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    let body = {};
    try { body = await response.json(); } catch (_) {}
    if (!response.ok) {
      const message = response.status === 404
        ? `الخادم أعاد Not Found (404). تحقق من عنوان Cloudflare Worker في remote-config.js: ${API_BASE}`
        : (body.error || `تعذر تنفيذ الطلب (HTTP ${response.status}).`);
      const error = Error(message);
      error.status = response.status; error.body = body; throw error;
    }
    return body;
  }

  async function loginAdmin(password) {
    if (!remote) throw Error('تسجيل الدخول المركزي غير مفعّل في هذه النسخة.');
    await apiPost('/api/admin-login', { password: String(password || '') });
    await refresh();
    if (!canEdit) throw Error('تم تسجيل الدخول، لكن الخادم لم يمنح صلاحية الإدارة. تحقق من إعدادات الخادم.');
    return true;
  }

  async function logoutAdmin() {
    if (!remote) return true;
    try { await apiPost('/api/logout'); } finally { canEdit = false; await refresh(); }
    return true;
  }

  async function getDiscountUsage() {
    if (!remote) return null;
    const response = await fetch(apiUrl('/api/discount-usage'), {
      method: 'GET', cache: 'no-store', credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });
    let body = {}; try { body = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = Error(body.error || `تعذر تحميل سجل الخصومات المشترك (HTTP ${response.status}).`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body.usages || {};
  }

  async function useDiscount(discountId) {
    if (!remote) return null;
    const result = await apiPost('/api/discount-usage', { discountId: String(discountId) });
    if (!result || result.success !== true) {
      const error = Error((result && result.error) || 'لم يؤكد الخادم تسجيل الخصم.');
      error.body = result || {};
      throw error;
    }
    return result;
  }

  const ready = refresh();

  // Remote mode always fetches the central source. Local storage is only a cache,
  // never the authority for shared site content.
  window.addEventListener('focus', () => {
    if (location.hash !== '#admin') refresh().catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && location.hash !== '#admin') refresh(true).catch(() => {});
  });

  // Keep public pages in sync with admin changes without requiring visitors to refresh.
  // Poll only while visible, and don't overwrite an in-progress admin edit.
  window.setInterval(() => {
    if (!document.hidden && location.hash !== '#admin' && !busy) {
      refresh(true).catch(() => {});
    }
  }, 2000);

  return {
    get state() { return state; },
    get loaded() { return loaded; },
    get canEdit() { return canEdit; },
    remote,
    ready,
    clone,
    save,
    validate,
    imageSrc,
    key,
    loginAdmin,
    logoutAdmin,
    getDiscountUsage,
    useDiscount,
    reload: refresh
  };
})();
