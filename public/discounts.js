/* =========================================================
   Saee Plus — Discount Button
   زر تم الخصم مع حفظ الاستخدام لمدة 24 ساعة
   File: discounts.js
   ========================================================= */

(function () {
  'use strict';

  const DAY = 24 * 60 * 60 * 1000;

  const STORAGE_PREFIX = 'saee_discount_used_v5:';
  const GUEST_KEY = 'saee_discount_guest_id_v5';

  const BUTTON_SELECTOR = '.saee-discount-use';

  /* ---------------------------------------------------------
     1. إنشاء معرّف ثابت للزائر أو الحساب
     --------------------------------------------------------- */

  function getAccountScope() {
    try {
      const session = localStorage.getItem('sai-local-session-v1');

      if (session) {
        try {
          const parsed = JSON.parse(session);

          const email =
            parsed.email ||
            parsed.user?.email ||
            parsed.account?.email;

          if (email) {
            return 'account:' + String(email).trim().toLowerCase();
          }
        } catch (error) {
          // الجلسة مخزنة كنص عادي (البريد الإلكتروني مباشرة).
          const plain = String(session).trim().toLowerCase();

          if (plain.includes('@')) {
            return 'account:' + plain;
          }
        }
      }

      let guestId = localStorage.getItem(GUEST_KEY);

      if (!guestId) {
        guestId =
          'guest-' +
          Date.now().toString(36) +
          '-' +
          Math.random().toString(36).slice(2);

        localStorage.setItem(GUEST_KEY, guestId);
      }

      return guestId;

    } catch (error) {
      return 'browser';
    }
  }

  /* ---------------------------------------------------------
     2. إنشاء مفتاح تخزين مستقل لكل خصم
     --------------------------------------------------------- */

  function getStorageKey(discountId) {
    return (
      STORAGE_PREFIX +
      encodeURIComponent(getAccountScope()) +
      ':' +
      encodeURIComponent(String(discountId))
    );
  }

  /* ---------------------------------------------------------
     3. قراءة وقت انتهاء الحظر
     --------------------------------------------------------- */

  function getExpiry(discountId) {
    try {
      const key = getStorageKey(discountId);
      const expiry = Number(localStorage.getItem(key) || 0);

      if (!Number.isFinite(expiry) || expiry <= 0) {
        return 0;
      }

      if (Date.now() >= expiry) {
        localStorage.removeItem(key);
        return 0;
      }

      return expiry;

    } catch (error) {
      return 0;
    }
  }

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

  function setText(element, text) {
    if (element.textContent !== text) {
      element.textContent = text;
    }
  }

  function updateButton(button) {
    if (!button || !button.dataset.discountId) {
      return;
    }

    const discountId = button.dataset.discountId;
    const expiry = getExpiry(discountId);

    let timer = button.parentElement.querySelector(
      '.saee-discount-use-timer'
    );

    if (!timer) {
      timer = document.createElement('small');

      timer.className = 'saee-discount-use-timer';

      timer.style.cssText = [
        'display:block',
        'text-align:center',
        'margin-top:8px',
        'font-size:13px',
        'color:#788675'
      ].join(';');

      button.insertAdjacentElement('afterend', timer);
    }

    if (expiry > Date.now()) {
      button.disabled = true;
      setText(button, 'تم الخصم ✓');

      button.setAttribute(
        'aria-label',
        'تم استخدام هذا الخصم'
      );

      button.style.opacity = '0.7';
      button.style.cursor = 'not-allowed';

      timer.hidden = false;

      setText(
        timer,
        'إعادة التفعيل بعد ' +
        formatRemaining(expiry - Date.now())
      );

    } else {
      button.disabled = false;
      setText(button, 'تم الخصم');

      button.setAttribute(
        'aria-label',
        'تسجيل استخدام الخصم'
      );

      button.style.opacity = '1';
      button.style.cursor = 'pointer';

      timer.hidden = true;
      setText(timer, '');
    }
  }

  /* ---------------------------------------------------------
     7. تسجيل الاستخدام لمدة 24 ساعة
     --------------------------------------------------------- */

  function useDiscount(button) {
    const discountId = button.dataset.discountId;

    if (!discountId) {
      showMessage('تعذّر تحديد الخصم.');
      return;
    }

    const currentExpiry = getExpiry(discountId);

    if (currentExpiry > Date.now()) {
      updateButton(button);

      showMessage(
        'سبق استخدام هذا الخصم. يرجع يتفعّل بعد ' +
        formatRemaining(currentExpiry - Date.now())
      );

      return;
    }

    try {
      const expiry = Date.now() + DAY;

      localStorage.setItem(
        getStorageKey(discountId),
        String(expiry)
      );

      updateButton(button);

      showMessage(
        'تم تسجيل الخصم ✓ سيُعاد تفعيله بعد 24 ساعة.'
      );

    } catch (error) {
      showMessage(
        'تعذّر حفظ الاستخدام. تأكد من إعدادات المتصفح.'
      );
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

      useDiscount(button);
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

    /*
     * نافذة التفاصيل قد تُنشأ من جديد عند فتح خصم آخر.
     * نحدّث الأزرار الجديدة تلقائيًا.
     */

    const modalContent =
      document.getElementById('dialog-content');

    if (modalContent) {
      let scheduled = false;

      const observer = new MutationObserver(function () {
        if (scheduled) {
          return;
        }

        scheduled = true;

        window.requestAnimationFrame(function () {
          scheduled = false;
          refreshButtons();
        });
      });

      observer.observe(modalContent, {
        childList: true,
        subtree: true
      });
    }

    /*
     * تحديث الوقت المتبقي كل ثانية.
     */

    window.setInterval(function () {
      refreshButtons();
    }, 1000);

    /*
     * إعادة التحقق عند العودة إلى الصفحة.
     */

    window.addEventListener('pageshow', refreshButtons);

    document.addEventListener(
      'visibilitychange',
      function () {
        if (!document.hidden) {
          refreshButtons();
        }
      }
    );
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
