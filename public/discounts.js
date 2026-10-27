/* Saee Plus: working 24-hour discount button inside discount details */
(() => {
  'use strict';
  const PREFIX = 'saee-discount-used-v2:';
  const DAY = 24 * 60 * 60 * 1000;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  function accountScope() {
    try {
      const email = (localStorage.getItem('sai-local-session-v1') || '').trim().toLowerCase();
      if (email) return 'user:' + email;
      let guest = localStorage.getItem('saee-discount-guest-id');
      if (!guest) {
        guest = 'guest-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('saee-discount-guest-id', guest);
      }
      return guest;
    } catch (_) { return 'browser'; }
  }
  function key(id) { return PREFIX + encodeURIComponent(accountScope()) + ':' + encodeURIComponent(id); }
  function getExpiry(id) {
    try { const n = Number(localStorage.getItem(key(id)) || 0); return n > Date.now() ? n : 0; }
    catch (_) { return 0; }
  }
  function format(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60);
    return `${h} ساعة و ${m} دقيقة`;
  }
  function toast(message) {
    let el = $('#saee-discount-toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'saee-discount-toast';
      el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:999999;background:#075a52;color:#fff;padding:13px 20px;border-radius:12px;box-shadow:0 8px 30px #0003;max-width:90vw;text-align:center;font-weight:700';
      document.body.appendChild(el);
    }
    el.textContent = message; el.hidden = false; clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.hidden = true; }, 3500);
  }
  function paintButton(button) {
    const id = button.dataset.discountId;
    if (!id) return;
    const expiry = getExpiry(id);
    const wrap = button.closest('.saee-discount-details-use, .saee-discount-use-wrap') || button.parentElement;
    let timer = $('.saee-discount-timer', wrap);
    if (!timer) { timer = document.createElement('small'); timer.className = 'saee-discount-timer'; wrap.appendChild(timer); }
    timer.style.cssText = 'display:block;text-align:center;margin-top:8px;color:#788675';
    if (expiry) {
      button.disabled = true; button.textContent = 'تم استخدام الخصم ✓';
      button.style.opacity = '.7'; button.style.cursor = 'not-allowed';
      timer.hidden = false; timer.textContent = `يتفعّل بعد ${format(expiry - Date.now())}`;
    } else {
      button.disabled = false; button.textContent = 'تم الخصم';
      button.style.opacity = '1'; button.style.cursor = 'pointer';
      timer.hidden = true; timer.textContent = '';
    }
  }
  function refresh() { $$('.saee-discount-use').forEach(paintButton); }

  document.addEventListener('click', event => {
    const button = event.target.closest('.saee-discount-use');
    if (!button) return;
    event.preventDefault(); event.stopPropagation();
    const id = (button.dataset.discountId || '').trim();
    if (!id) { toast('تعذر تحديد الخصم. أغلق التفاصيل وافتحها مرة أخرى.'); return; }
    const expiry = getExpiry(id);
    if (expiry) { paintButton(button); toast(`هذا الخصم مستخدم بالفعل، ويتفعّل بعد ${format(expiry - Date.now())}.`); return; }
    try {
      const newExpiry = Date.now() + DAY;
      localStorage.setItem(key(id), String(newExpiry));
      paintButton(button);
      toast('تم تسجيل الخصم بنجاح. يمكنك استخدامه مرة أخرى بعد 24 ساعة.');
    } catch (_) {
      toast('تعذر حفظ الاستخدام. تأكد من السماح للموقع باستخدام التخزين المحلي.');
    }
  }, true);

  const observer = new MutationObserver(refresh);
  function start() { refresh(); if (document.body) observer.observe(document.body, { childList: true, subtree: true }); }
  setInterval(refresh, 30000);
  window.addEventListener('storage', refresh);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
