/* Saee Plus: "تم الخصم" button for youth projects only; 24-hour local tracking. */
(() => {
  'use strict';

  const SESSION_KEY = 'sai-local-session-v1';
  const ACCOUNT_PREFIX = 'sai-local-account-v1:';
  const USAGE_PREFIX = 'sai-project-discount-v1:';
  const DAY = 24 * 60 * 60 * 1000;
  const BUTTON_CLASS = 'saee-project-discount-btn';
  const STYLE_ID = 'saee-project-discount-style';

  const safeRead = key => {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  };

  function accountEmail() {
    const email = safeRead(SESSION_KEY);
    if (!email) return '';
    try {
      const raw = safeRead(ACCOUNT_PREFIX + encodeURIComponent(email));
      if (!raw) return '';
      const account = JSON.parse(raw);
      return account && account.email === email ? email : '';
    } catch (_) { return ''; }
  }

  function usageKey(email, projectId) {
    return USAGE_PREFIX + encodeURIComponent(email) + ':' + encodeURIComponent(projectId);
  }

  function getProjectId(card) {
    const details = card.querySelector('.details-btn[onclick]');
    const match = details && details.getAttribute('onclick').match(/details\(['"]([^'"]+)['"]\)/);
    return match ? match[1] : '';
  }

  function isProjectsPage() {
    return (location.hash || '').replace(/^#/, '').split('?')[0] === 'projects';
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .saee-project-card-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
      .${BUTTON_CLASS}{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:7px 12px;border:1px solid #075550;border-radius:10px;background:#075550;color:#fff;font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
      .${BUTTON_CLASS}:hover{background:#06433f}
      .${BUTTON_CLASS}[disabled]{opacity:.72;cursor:not-allowed}
      .${BUTTON_CLASS}.is-used{background:#edf3ee;color:#075550;border-color:#cddbd3}
      @media(max-width:480px){.saee-project-card-actions{gap:6px}.${BUTTON_CLASS}{padding:7px 9px}}
    `;
    document.head.appendChild(style);
  }

  function getState(email, id) {
    try {
      const raw = safeRead(usageKey(email, id));
      const state = raw ? JSON.parse(raw) : null;
      if (!state || !Number.isFinite(state.until) || state.until <= Date.now()) return null;
      return state;
    } catch (_) { return null; }
  }

  function setButton(button, state) {
    if (state) {
      button.disabled = true;
      button.classList.add('is-used');
      button.textContent = 'تم الخصم ✓';
      button.title = 'تم تسجيل استخدام الخصم لهذا المشروع';
    } else {
      button.disabled = false;
      button.classList.remove('is-used');
      button.textContent = 'تم الخصم';
      button.title = 'تسجيل استخدام الخصم لمدة 24 ساعة';
    }
  }

  function showLoginPrompt() {
    const dialog = document.getElementById('sai-auth');
    const openButton = document.getElementById('sai-open-auth');
    if (dialog && typeof dialog.showModal === 'function') {
      if (openButton) openButton.click();
      else dialog.showModal();
    } else {
      alert('سجّل الدخول أولًا لاستخدام زر تم الخصم.');
    }
  }

  function addButtons() {
    if (!isProjectsPage()) return;
    const cards = document.querySelectorAll('#main .offer-card');
    if (!cards.length) return;
    ensureStyles();

    cards.forEach(card => {
      const details = card.querySelector('.details-btn');
      const id = getProjectId(card);
      if (!details || !id || card.querySelector('.' + BUTTON_CLASS)) return;

      const actions = document.createElement('div');
      actions.className = 'saee-project-card-actions';
      details.parentNode.insertBefore(actions, details);
      actions.appendChild(details);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = BUTTON_CLASS;
      button.dataset.projectId = id;
      button.setAttribute('aria-label', 'تسجيل استخدام الخصم للمشروع');
      actions.appendChild(button);
      const email = accountEmail();
      setButton(button, email ? getState(email, id) : null);
    });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.' + BUTTON_CLASS);
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const email = accountEmail();
    if (!email) {
      showLoginPrompt();
      return;
    }

    const id = button.dataset.projectId;
    if (!id) return;

    const current = getState(email, id);
    if (current) {
      setButton(button, current);
      const minutes = Math.max(1, Math.ceil((current.until - Date.now()) / 60000));
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      const msg = `تم تسجيل الخصم مسبقًا. الوقت المتبقي: ${hours} ساعة و${rest} دقيقة.`;
      if (typeof window.toast === 'function') window.toast(msg);
      else alert(msg);
      return;
    }

    const state = { usedAt: Date.now(), until: Date.now() + DAY };
    try {
      localStorage.setItem(usageKey(email, id), JSON.stringify(state));
      setButton(button, state);
      const msg = 'تم تسجيل استخدام الخصم لهذا المشروع. يمكنك استخدامه مرة أخرى بعد 24 ساعة.';
      if (typeof window.toast === 'function') window.toast(msg);
      else alert(msg);
    } catch (_) {
      alert('تعذّر حفظ حالة الخصم في المتصفح. تأكد من السماح بحفظ بيانات الموقع.');
    }
  }, true);

  window.addEventListener('hashchange', () => setTimeout(addButtons, 0));
  window.addEventListener('load', () => setTimeout(addButtons, 0));
  window.addEventListener('sai-account-changed', () => setTimeout(addButtons, 0));

  const observer = new MutationObserver(() => {
    if (isProjectsPage()) addButtons();
  });
  observer.observe(document.getElementById('main') || document.body, { childList: true, subtree: true });
  setTimeout(addButtons, 0);
})();
