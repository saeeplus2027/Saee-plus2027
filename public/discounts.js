/* =========================================================
   Saee Plus — Discount Button
   زر تم الخصم مع حفظ الاستخدام لمدة 24 ساعة
   File: discounts.js
   ========================================================= */

(function () {
  'use strict';

  const DAY = 24 * 60 * 60 * 1000;


  const BUTTON_SELECTOR = '.saee-discount-use';
  /* ---------------------------------------------------------
     Server-only shared usage state. No localStorage fallback is allowed.
     --------------------------------------------------------- */
  const serverExpiries = Object.create(null);
  let usageLoadInProgress = false;
  let usageReady = false;
  let usageLoadFailed = false;

  /* ---------------------------------------------------------
     4. حساب الوقت المتبقي
     --------------------------------------------------------- */

  function formatRemaining(milliseconds) {
    const totalSeconds = Math.max(
      0,
      Math.ceil(milliseconds / 1000)
    );

    const hours = Math.floor(totalSeconds / 3600);

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const seconds = totalSeconds % 60;

    return (
      hours +
      ' ساعة و ' +
      minutes +
      ' دقيقة و ' +
      seconds +
      ' ثانية'
    );
  }

  /* ---------------------------------------------------------
     5. إظهار رسالة للمستخدم
     --------------------------------------------------------- */

  function showMessage(message) {
    let toast = document.getElementById(
      'saee-discount-use-toast'
    );

    if (!toast) {
      toast = document.createElement('div');

      toast.id = 'saee-discount-use-toast';

      toast.style.cssText = [
        'position:fixed',
        'z-index:2147483647',
        'bottom:24px',
        'left:50%',
        'transform:translateX(-50%)',
        'width:max-content',
        'max-width:90%',
        'padding:14px 20px',
        'border-radius:12px',
        'background:#075a52',
        'color:white',
        'font-size:14px',
        'font-weight:700',
        'text-align:center',
        'box-shadow:0 8px 28px rgba(0,0,0,.2)'
      ].join(';');

      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.hidden = false;

    clearTimeout(toast._hideTimer);

    toast._hideTimer = setTimeout(function () {
      toast.hidden = true;
    }, 3500);
  }

  /* ---------------------------------------------------------
     6. تحديث شكل الزر بحسب حالة الخصم
     --------------------------------------------------------- */

  function updateButton(button) {
    if (!button || !button.dataset.discountId) return;

    const discountId = button.dataset.discountId;
    const expiry = Number(serverExpiries[discountId] || 0);
    let timer = button.parentElement.querySelector('.saee-discount-use-timer');

    if (!timer) {
      timer = document.createElement('small');
      timer.className = 'saee-discount-use-timer';
      timer.style.cssText = [
        'display:block', 'text-align:center', 'margin-top:8px',
        'font-size:13px', 'color:#788675'
      ].join(';');
      button.insertAdjacentElement('afterend', timer);
    }

    // Once this client has received a confirmed expiry from the server,
    // keep the button locked even if a later status refresh fails.
    if (expiry > Date.now()) {
      button.disabled = true;
      setText(button, 'تم الخصم ✓');
      button.setAttribute('aria-label', 'تم استخدام هذا الخصم');
      button.title = 'تم تسجيل الخصم على الخادم؛ لن يتاح قبل انتهاء 24 ساعة.';
      button.style.opacity = '0.7';
      button.style.cursor = 'not-allowed';
      timer.hidden = false;
      setText(timer, 'إعادة التفعيل بعد ' + formatRemaining(expiry - Date.now()));
      return;
    }

    if (!usageReady) {
      if (usageLoadFailed) {
        // Keep the button clickable after a failed GET. Clicking still POSTs to
        // the server, and only a confirmed server response counts as a use.
        // This avoids trapping the visitor behind a failed status read while
        // keeping the shared 24-hour rule enforced by Cloudflare/D1.
        button.disabled = false;
        setText(button, 'تم الخصم');
        button.setAttribute('aria-label', 'تسجيل استخدام الخصم والتحقق من الخادم');
        button.title = 'تعذر تحميل الحالة الحالية؛ عند الضغط سيتحقق الخادم من إمكانية تسجيل الخصم.';
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        timer.hidden = false;
        setText(timer, 'سيتم تأكيد الاستخدام من الخادم قبل تسجيله.');
      } else {
        button.disabled = true;
        setText(button, 'جارٍ التحقق من الخصم…');
        button.title = 'يتم تحميل حالة الخصم المشتركة من الخادم.';
        timer.hidden = false;
        setText(timer, 'انتظر حتى يكتمل التحقق من الخادم.');
      }
      return;
    }

    button.disabled = false;
    setText(button, 'تم الخصم');
    button.setAttribute('aria-label', 'تسجيل استخدام الخصم');
    button.title = 'اضغط بعد الاستفادة من الخصم لتسجيله؛ يتاح الاستخدام مرة واحدة كل 24 ساعة.';
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
    timer.hidden = true;
    setText(timer, '');
  }

  // Avoid replacing text nodes when nothing changed. This also prevents the
  // modal MutationObserver from repeatedly reacting to its own UI updates.
  function setText(element, value) {
    if (element && element.textContent !== value) element.textContent = value;
  }

  /* ---------------------------------------------------------
     7. تسجيل الاستخدام لمدة 24 ساعة
     --------------------------------------------------------- */

  async function useDiscount(button) {
    const discountId = button.dataset.discountId;
    if (!discountId) {
      showMessage('تعذّر تحديد الخصم.');
      return;
    }

    if (!usageReady && !usageLoadFailed) {
      showMessage('انتظر حتى يكتمل التحقق من حالة الخصم.');
      return;
    }

    const currentExpiry = Number(serverExpiries[discountId] || 0);
    if (currentExpiry > Date.now()) {
      updateButton(button);
      showMessage('سبق تسجيل هذا الخصم. يرجع يتفعّل بعد ' + formatRemaining(currentExpiry - Date.now()));
      return;
    }

    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = 'جاري تسجيل الخصم…';

    try {
      if (!window.SiteStore || typeof window.SiteStore.useDiscount !== 'function') {
        throw Error('خدمة تسجيل الخصم المشتركة غير متاحة.');
      }

      const result = await window.SiteStore.useDiscount(discountId);
      if (!result || result.success !== true) {
        throw Error('لم يؤكد الخادم تسجيل الخصم. حاول مرة أخرى.');
      }

      serverExpiries[discountId] = Number(result.expiresAt || (Date.now() + DAY));
      updateButton(button);
      showMessage('تم تسجيل الخصم ✓ سيُعاد تفعيله بعد 24 ساعة على جميع الأجهزة.');
    } catch (error) {
      if (error && (error.alreadyUsed || (error.status === 409 && error.body && error.body.alreadyUsed))) {
        const expiry = Number(error.body && error.body.expiresAt || Date.now() + DAY);
        serverExpiries[discountId] = expiry;
        updateButton(button);
        showMessage('تم تسجيل هذا الخصم بالفعل. يرجع يتفعّل بعد ' + formatRemaining(Math.max(0, expiry - Date.now())));
      } else {
        button.disabled = true;
        button.textContent = 'تعذر الاتصال';
        button.title = (error && error.message) || 'تعذر الاتصال بخادم الخصومات.';
        showMessage((error && error.message) || 'تعذّر تسجيل الخصم المشترك. حاول مرة أخرى.');
      }
    }
  }

  async function loadServerUsage() {
    if (usageLoadInProgress || !window.SiteStore || typeof window.SiteStore.getDiscountUsage !== 'function') return;
    usageLoadInProgress = true;
    try {
      const usages = await window.SiteStore.getDiscountUsage();
      for (const id of Object.keys(serverExpiries)) delete serverExpiries[id];
      const now = Date.now();
      for (const [id, usage] of Object.entries(usages || {})) {
        const expiry = Number(usage && usage.expiresAt || 0);
        if (expiry > now) serverExpiries[id] = expiry;
      }
      usageReady = true;
      usageLoadFailed = false;
      refreshButtons();
    } catch (error) {
      usageReady = false;
      usageLoadFailed = true;
      refreshButtons();
      console.warn('Saee Plus: تعذر تحميل سجل الخصومات المشترك من الخادم.', error);
    } finally {
      usageLoadInProgress = false;
    }
  }

  /* ---------------------------------------------------------
     8. استقبال الضغط حتى لو أعيد إنشاء نافذة التفاصيل
     --------------------------------------------------------- */

  document.addEventListener(
    'click',
    function (event) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest(BUTTON_SELECTOR);

      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (button.disabled) {
        updateButton(button);
        return;
      }

      void useDiscount(button);
    },
    true
  );

  /* ---------------------------------------------------------
     9. تحديث الأزرار عند فتح التفاصيل أو إعادة تحميل الصفحة
     --------------------------------------------------------- */

  function refreshButtons() {
    document.querySelectorAll(BUTTON_SELECTOR).forEach(
      function (button) {
        updateButton(button);
      }
    );
  }

  function start() {
    refreshButtons();
    void loadServerUsage();

    /*
     * نافذة التفاصيل قد تُنشأ من جديد عند فتح خصم آخر.
     * نحدّث الأزرار الجديدة تلقائيًا.
     */

    const modalContent =
      document.getElementById('dialog-content');

    if (modalContent) {
      let syncTimer = 0;
      const observer = new MutationObserver(function (records) {
        refreshButtons();

        // Fetch the shared status immediately when a new discount detail
        // button is inserted, rather than waiting for the next poll.
        const discountButtonAdded = records.some(function (record) {
          return Array.from(record.addedNodes || []).some(function (node) {
            return node instanceof Element && (
              node.matches(BUTTON_SELECTOR) || node.querySelector(BUTTON_SELECTOR)
            );
          });
        });
        if (discountButtonAdded) {
          clearTimeout(syncTimer);
          syncTimer = window.setTimeout(function () {
            void loadServerUsage();
          }, 60);
        }
      });

      observer.observe(modalContent, {
        childList: true,
        subtree: true
      });
    }

    // The displayed countdown updates every second without hitting the API.
    window.setInterval(refreshButtons, 1000);

    // Re-query shared state every 5 seconds so an already-open second device
    // reflects a click made elsewhere quickly. The state itself lives in D1.
    window.setInterval(function () {
      if (!document.hidden) void loadServerUsage();
    }, 5000);

    // Always re-check shared status when the visitor returns to this tab/page.
    window.addEventListener('pageshow', function () {
      void loadServerUsage();
      refreshButtons();
    });
    window.addEventListener('focus', function () {
      void loadServerUsage();
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        void loadServerUsage();
        refreshButtons();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      start,
      { once: true }
    );
  } else {
    start();
  }

})();
