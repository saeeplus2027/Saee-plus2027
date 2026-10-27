/* Saee Plus — 24-hour use button for all current and future Saee discounts.
   Isolated from app.js so the existing details() modal keeps working. */
(function () {
  'use strict';
  const DAY = 24 * 60 * 60 * 1000;
  const PREFIX = 'saee-discount-used-v4:';
  const $ = (s, root = document) => root.querySelector(s);

  function accountScope() {
    try {
      const raw = localStorage.getItem('sai-local-session-v1') || '';
      let email = raw;
      try {
        const v = JSON.parse(raw);
        email = v.email || v.user?.email || v.account?.email || raw;
      } catch (_) {}
      email = String(email || '').trim().toLowerCase();
      if (email && email !== 'null' && email !== '{}' && email !== 'undefined') return 'account:' + email;
      let guest = localStorage.getItem('saee-discount-guest-id-v4');
      if (!guest) {
        guest = 'guest-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('saee-discount-guest-id-v4', guest);
      }
      return guest;
    } catch (_) { return 'this-browser'; }
  }
  function storageKey(id) { return PREFIX + encodeURIComponent(accountScope()) + ':' + encodeURIComponent(String(id)); }
  function getExpiry(id) {
    try {
      const expiry = Number(localStorage.getItem(storageKey(id)) || 0);
      if (expiry <= Date.now()) { localStorage.removeItem(storageKey(id)); return 0; }
      return expiry;
    } catch (_) { return 0; }
  }
  function left(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h + ' ساعة و ' + m + ' دقيقة';
  }
  function toast(message) {
    let el = $('#saee-discount-use-toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'saee-discount-use-toast';
      el.style.cssText = 'position:fixed;z-index:2147483647;bottom:22px;left:50%;transform:translateX(-50%);max-width:90vw;padding:13px 18px;border-radius:12px;background:#075a52;color:#fff;box-shadow:0 8px 28px #0003;text-align:center;font-weight:700';
      document.body.appendChild(el);
    }
    el.textContent = message; el.hidden = false; clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }
  function paint(btn) {
    const expiry = getExpiry(btn.dataset.discountId);
    const timer = btn.parentElement.querySelector('.saee-discount-use-timer');
    if (expiry) {
      btn.disabled = true; btn.textContent = 'تم الخصم ✓';
      btn.setAttribute('aria-label', 'تم استخدام الخصم');
      btn.style.opacity = '.75'; btn.style.cursor = 'not-allowed';
      if (timer) { timer.hidden = false; timer.textContent = 'يرجع يتفعّل بعد ' + left(expiry - Date.now()); }
    } else {
      btn.disabled = false; btn.textContent = 'تم الخصم';
      btn.setAttribute('aria-label', 'تسجيل استخدام الخصم');
      btn.style.opacity = '1'; btn.style.cursor = 'pointer';
      if (timer) { timer.hidden = true; timer.textContent = ''; }
    }
  }
  // Delegated click handler continues to work even when the modal is recreated.
  document.addEventListener('click', function (event) {
    const btn = event.target.closest?.('.saee-discount-use');
    if (!btn) return;
    event.preventDefault(); event.stopPropagation();
    if (btn.disabled) {
      const expiry = getExpiry(btn.dataset.discountId);
      if (expiry) toast('تم استخدام هذا الخصم. يرجع يتفعّل بعد ' + left(expiry - Date.now()));
      paint(btn); return;
    }
    try {
      localStorage.setItem(storageKey(btn.dataset.discountId), String(Date.now() + DAY));
      paint(btn);
      toast('تم تسجيل الخصم ✓ يرجع يتفعّل بعد 24 ساعة.');
    } catch (_) { toast('تعذر حفظ الاستخدام في المتصفح.'); }
  }, true);

  // Refresh countdown/availability while the dialog remains open.
  window.setInterval(() => { const btn = $('.saee-discount-use'); if (btn) paint(btn); }, 15000);
})();
