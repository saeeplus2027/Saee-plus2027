/* Saee Plus: per-account 24-hour discount usage */
(() => {
  'use strict';
  const API = 'https://saee-plus-api.ligagym.workers.dev';
  const active = new Map();
  const TOKEN_KEY = 'saee-auth-token-v1';
  let loaded = false;
  let loading = null;

  const esc = value => String(value).replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; }
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const token = getToken();
    if (token) headers.set('Authorization', 'Bearer ' + token);
    const response = await fetch(API + path, {
      ...options,
      credentials: 'include',
      cache: 'no-store',
      headers
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(data.error || 'تعذر الاتصال بالخادم');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function getId(card) {
    const button = card.querySelector('.details-btn[onclick]');
    if (!button) return '';
    const match = button.getAttribute('onclick').match(/details\(['"]([^'"]+)['"]\)/);
    return match ? match[1] : '';
  }

  function shouldShow(card) {
    const hash = (location.hash || '').replace(/^#/, '').split('?')[0];
    return hash === 'discounts' || !!card.closest('.offers-section');
  }

  function remaining(until) {
    const seconds = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} ساعة و ${minutes} دقيقة`;
  }

  function toast(message) {
    if (typeof window.toast === 'function') window.toast(message);
    else {
      let node = document.getElementById('saee-discount-toast');
      if (!node) {
        node = document.createElement('div');
        node.id = 'saee-discount-toast';
        node.style.cssText = 'position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:99999;background:#124b43;color:white;padding:12px 18px;border-radius:12px;box-shadow:0 5px 25px #0002;max-width:90vw;text-align:center';
        document.body.appendChild(node);
      }
      node.textContent = message;
      node.hidden = false;
      clearTimeout(node._hideTimer);
      node._hideTimer = setTimeout(() => { node.hidden = true; }, 2800);
    }
  }

  async function loadUsages() {
    if (loading) return loading;
    active.clear();
    if (!getToken()) {
      loaded = true;
      addButtons();
      return;
    }
    loaded = false;
    loading = api('/api/discount-usage').then(data => {
      active.clear();
      Object.entries(data.usages || {}).forEach(([id, value]) => {
        if (Number(value.expiresAt) > Date.now()) active.set(id, Number(value.expiresAt));
      });
      loaded = true;
    }).catch(error => {
      loaded = true;
      active.clear();
      if (error.status !== 401) console.warn('Saee discount usage:', error);
    }).finally(() => { loading = null; addButtons(); });
    return loading;
  }

  function addButtons() {
    document.querySelectorAll('.offer-card').forEach(card => {
      if (!shouldShow(card)) return;
      const id = getId(card);
      const body = card.querySelector('.card-body');
      const foot = body && body.querySelector('.card-foot');
      if (!id || !body || !foot) return;

      let wrap = body.querySelector('.saee-discount-use-wrap');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'saee-discount-use-wrap';
        wrap.style.cssText = 'margin-top:12px';
        wrap.innerHTML = `<button type="button" class="button small saee-discount-use" data-discount-id="${esc(id)}" style="width:100%;justify-content:center">تم الخصم</button><small class="saee-discount-timer" style="display:none;text-align:center;margin-top:6px;color:#6b756b"></small>`;
        foot.insertAdjacentElement('afterend', wrap);
      }
      const button = wrap.querySelector('button');
      const timer = wrap.querySelector('small');
      const until = active.get(id) || 0;
      if (until > Date.now()) {
        button.disabled = true;
        button.textContent = 'تم استخدام الخصم';
        button.style.opacity = '.65';
        button.style.cursor = 'not-allowed';
        timer.style.display = 'block';
        timer.dataset.until = String(until);
        timer.textContent = `يتفعّل بعد ${remaining(until)}`;
      } else {
        active.delete(id);
        button.disabled = false;
        button.textContent = 'تم الخصم';
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        timer.style.display = 'none';
        timer.removeAttribute('data-until');
      }
    });
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('.saee-discount-use');
    if (!button) return;
    event.preventDefault();
    if (button.disabled) return;
    const id = button.dataset.discountId;
    if (!id) return;
    if (!getToken()) {
      toast('سجّل الدخول أولًا لاستخدام الخصم.');
      const login = document.getElementById('sai-open-auth');
      if (login) login.click();
      return;
    }

    button.disabled = true;
    button.textContent = 'جارٍ تسجيل الخصم...';
    try {
      const data = await api('/api/discount-usage', {
        method: 'POST',
        body: JSON.stringify({ discountId: id })
      });
      active.set(id, Number(data.expiresAt));
      addButtons();
      toast('تم تسجيل استخدام الخصم لهذا الحساب لمدة 24 ساعة.');
    } catch (error) {
      if (error.status === 401) {
        button.disabled = false;
        button.textContent = 'تم الخصم';
        toast('سجّل الدخول أولًا لاستخدام الخصم.');
        const login = document.getElementById('sai-open-auth');
        if (login) login.click();
      } else if (error.status === 409 && error.data && error.data.expiresAt) {
        active.set(id, Number(error.data.expiresAt));
        addButtons();
        toast('سبق استخدام هذا الخصم، وسيعود متاحًا بعد انتهاء المدة.');
      } else {
        button.disabled = false;
        button.textContent = 'تم الخصم';
        toast(error.message || 'تعذر تسجيل استخدام الخصم.');
      }
    }
  });

  const observer = new MutationObserver(() => addButtons());
  function start() {
    observer.observe(document.body, { childList: true, subtree: true });
    loadUsages().then(addButtons);
    addButtons();
  }

  window.addEventListener('hashchange', () => {
    loadUsages().then(addButtons);
    setTimeout(addButtons, 100);
  });

  window.addEventListener('sai-account-changed', () => {
    active.clear();
    loadUsages().then(addButtons);
  });

  setInterval(() => {
    document.querySelectorAll('.saee-discount-timer[data-until]').forEach(timer => {
      const until = Number(timer.dataset.until || 0);
      if (until <= Date.now()) {
        active.delete(timer.closest('.saee-discount-use-wrap')?.querySelector('button')?.dataset.discountId);
        addButtons();
      } else {
        timer.textContent = `يتفعّل بعد ${remaining(until)}`;
      }
    });
  }, 30000);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
