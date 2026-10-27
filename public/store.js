
/* Saee Plus - shared content store backed by /api/content */

window.SiteStore = (() => {
  const key = "sai-plus-cms-v1";
  const remote = true;

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
    if (!response.ok) throw Error(body.error || `تعذر تحميل المحتوى (HTTP ${response.status}).`);
    return body;
  }

  async function refresh() {
    loaded = false;
    apiAvailable = false;
    try {
      const response = await fetch('/api/content', {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'
      });
      const body = await readResponse(response);
      state = validate(body.state);
      state.revision = Number(body.revision ?? state.revision ?? 0);
      etag = response.headers.get('ETag') || `"${state.revision}"`;
      canEdit = Boolean(body.canEdit);
      apiAvailable = true;
      loaded = true;
      cache();
      notify();
      return state;
    } catch (error) {
      // Keep the public site usable if the API route is missing or temporarily down.
      // The shared server remains the source of truth whenever the API is available.
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

  async function save(next) {
    if (busy) throw Error('جاري حفظ تعديل سابق.');
    if (!loaded) throw Error('المحتوى لم يجهز بعد. أعد تحميل الصفحة ثم حاول مجددًا.');
    if (!apiAvailable) throw Error('تعذر الاتصال بخادم المحتوى (/api/content). تم عرض نسخة محفوظة للقراءة فقط؛ لا يمكن حفظ التعديلات أو مزامنتها حتى يتم إصلاح الخادم.');
    if (!canEdit) throw Error('سجّل الدخول بحساب مالك الموقع لتتمكن من حفظ التعديلات.');
    busy = true;
    try {
      const checked = validate(next);
      const response = await fetch('/api/content', {
        method: 'PUT',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'If-Match': etag
        },
        body: JSON.stringify(checked)
      });
      const body = await readResponse(response);
      state = validate(body.state);
      state.revision = Number(body.revision ?? state.revision ?? Date.now());
      etag = response.headers.get('ETag') || `"${state.revision}"`;
      canEdit = Boolean(body.canEdit);
      cache();
      notify();
      return state;
    } finally {
      busy = false;
    }
  }

  const ready = refresh();

  // Remote mode always fetches the central source. Local storage is only a cache,
  // never the authority for shared site content.
  window.addEventListener('focus', () => {
    if (location.hash !== '#admin') refresh().catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && location.hash !== '#admin') refresh().catch(() => {});
  });

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
    reload: refresh
  };
})();
