
/* Saee Plus - GitHub Pages local content store */

window.SiteStore = (() => {
  const key = "sai-plus-cms-v1";
  const remote = true;
  const API_BASE = "https://saee-plus-api.ligagym.workers.dev";

  let loaded = false;
  let canEdit = false;
  let remoteAvailable = false;
  let busy = false;
  let etag = null;

  const clone = (value) =>
    JSON.parse(JSON.stringify(value));

  const imageSrc = (value) => {
    value = String(value || "");

    if (
      /^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(value) ||
      /^https:\/\/[^\s<>"']+$/.test(value)
    ) return value;

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
    throw Error(
      "ملف content-data.js غير محمّل أو لا يحتوي على SAI_DEFAULTS."
    );
  }

  let state = validate(clone(window.SAI_DEFAULTS));

  try {
    const saved = JSON.parse(
      localStorage.getItem(key) || "null"
    );

    if (
      saved &&
      Number(saved.revision) >= Number(state.revision)
    ) {
      state = validate(saved);
    }
  } catch (error) {
    console.warn(
      "Saee Plus: using default content.",
      error
    );
  }

  function notify() {
    window.dispatchEvent(
      new Event("sai-content-changed")
    );
  }

  function cache() {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(state)
      );
    } catch (error) {
      throw Error(
        "تعذر حفظ المحتوى في المتصفح. قد تكون مساحة التخزين ممتلئة."
      );
    }
  }

  async function save(next) {
    if (busy) throw Error("جاري حفظ تعديل سابق.");
    if (!remoteAvailable || !etag) {
      throw Error("المحتوى المشترك غير متاح حاليًا؛ لم يتم حفظ التعديل. يجب تشغيل واجهة /api/content على الخادم حتى تظهر التعديلات على جميع الأجهزة.");
    }
    if (!canEdit) throw Error("سجّل الدخول إلى الإدارة بكلمة المرور أولًا.");

    busy = true;
    try {
      const checked = validate(next);
      const response = await fetch(API_BASE + '/api/content', {
        method: 'PUT',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'If-Match': etag
        },
        body: JSON.stringify({ state: checked, expected_revision: Number(etag.replaceAll('\"', '')) })
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

  async function readResponse(response) {
    let body = {};
    try { body = await response.json(); } catch (_) {}
    if (!response.ok) throw Error(body.error || `تعذر تحميل المحتوى (HTTP ${response.status}).`);
    return body;
  }

  async function refresh() {
    loaded = false;
    try {
      const response = await fetch(API_BASE + '/api/content', {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      const body = await readResponse(response);
      state = validate(body.state);
      state.revision = Number(body.revision ?? state.revision ?? 0);
      etag = response.headers.get('ETag') || `"${state.revision}"`;
      canEdit = Boolean(body.canEdit);
      remoteAvailable = true;
      loaded = true;
      cache();
      notify();
      return state;
    } catch (error) {
      // GitHub Pages is static and does not serve /api/content. Fall back to
      // cached/default content so the public page still renders instead of
      // showing a permanent loading/404 screen. Editing stays disabled until
      // the shared API is available, to avoid pretending local saves sync.
      console.warn('Saee Plus: shared content API unavailable; using cached/default content.', error);
      remoteAvailable = false;
      canEdit = false;
      etag = null;
      try {
        const cached = JSON.parse(localStorage.getItem(key) || 'null');
        state = cached ? validate(cached) : validate(clone(window.SAI_DEFAULTS));
      } catch (_) {
        state = validate(clone(window.SAI_DEFAULTS));
      }
      loaded = true;
      notify();
      return state;
    }
  }

  async function loginAdmin(password) {
    const response = await fetch(API_BASE + '/api/admin-login', {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ password })
    });
    const body = await readResponse(response);
    await refresh();
    if (!canEdit) throw Error('تم الدخول لكن الخادم لم يمنح صلاحية الإدارة.');
    return body;
  }

  async function logoutAdmin() {
    await fetch(API_BASE + '/api/logout', { method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    canEdit = false;
    return refresh();
  }

  const ready = refresh();

  window.addEventListener('focus', () => {
    if (location.hash !== '#admin') refresh().catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && location.hash !== '#admin') refresh().catch(() => {});
  });

  window.addEventListener("storage", (event) => {
    if (
      event.key === key &&
      location.hash !== "#admin"
    ) {
      refresh();
    }
  });

  return {
    get state() { return state; },
    get loaded() { return loaded; },
    get canEdit() { return canEdit; },
    remote,
    ready: Promise.resolve(),
    clone,
    save,
    validate,
    imageSrc,
    key,
    reload: () => refresh(),
    loginAdmin,
    logoutAdmin
  };
})();
