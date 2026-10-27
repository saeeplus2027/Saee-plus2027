/* Saee Plus: discount-use button inside every discount's details modal. */
(() => {
  'use strict';
  const API = 'https://saee-plus-api.ligagym.workers.dev';
  const active = new Map();
  let loading = null;

  async function api(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
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
      node._hideTimer = setTimeout(() => { node.hidden = true; }, 3000);
    }
  }

  async function loadUsages() {
    if (loading) return loading;
    loading = api('/api/discount-usage').then(data => {
      active.clear();
      Object.entries(data.usages || {}).forEach(([id, value]) => {
        if (Number(value.expiresAt) > Date.now()) active.set(id, Number(value.expiresAt));
      });
    }).catch(error => {
      if (error.status !== 401) console.warn('Saee discount usage:', error);
    }).finally(() => { loading = null; });
    return loading;
  }

  function refreshModalButton() {
    document.querySelectorAll('#dialog-content .saee-discount-use[data-discount-id]').forEach(button => {
      const id = button.dataset.discountId;
      const timer = button.parentElement.querySelector('.saee-discount-timer');
      const until = active.get(id) || 0;
      if (until > Date.now()) {
        button.disabled = true;
        button.textContent = 'تم استخدام الخصم ✓';
        button.style.opacity = '.65';
        button.style.cursor = 'not-allowed';
        if (timer) {
          timer.style.display = 'block';
          timer.dataset.until = String(until);
          timer.textContent = `يتفعّل بعد ${remaining(until)}`;
        }
      } else {
        active.delete(id);
        button.disabled = false;
        button.textContent = 'تم الخصم';
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        if (timer) { timer.style.display = 'none'; timer.removeAttribute('data-until'); }
      }
    });
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('#dialog-content .saee-discount-use[data-discount-id]');
    if (!button || button.disabled) return;
    event.preventDefault();
    const id = button.dataset.discountId;
    if (!id) return;
    button.disabled = true;
    button.textContent = 'جارٍ تسجيل الخصم...';
    try {
      const data = await api('/api/discount-usage', { method: 'POST', body: JSON.stringify({ discountId: id }) });
      active.set(id, Number(data.expiresAt) || Date.now() + 24 * 60 * 60 * 1000);
      refreshModalButton();
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
        refreshModalButton();
        toast('سبق استخدام هذا الخصم، وسيعود متاحًا بعد انتهاء المدة.');
      } else {
        button.disabled = false;
        button.textContent = 'تم الخصم';
        toast(error.message || 'تعذر تسجيل استخدام الخصم.');
      }
    }
  });

  const observer = new MutationObserver(() => refreshModalButton());
  function start() {
    const content = document.getElementById('dialog-content');
    if (content) observer.observe(content, { childList: true, subtree: true });
    loadUsages().then(refreshModalButton);
    refreshModalButton();
  }
  setInterval(() => {
    document.querySelectorAll('#dialog-content .saee-discount-timer[data-until]').forEach(timer => {
      const until = Number(timer.dataset.until || 0);
      if (until <= Date.now()) { active.delete(timer.parentElement.querySelector('button')?.dataset.discountId); refreshModalButton(); }
      else timer.textContent = `يتفعّل بعد ${remaining(until)}`;
    });
  }, 30000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
