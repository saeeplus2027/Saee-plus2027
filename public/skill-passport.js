(() => {
  'use strict';

  const API_ENDPOINT = '/api/skill-passport';
  const $ = (id) => document.getElementById(id);
  const cleanText = (value) => String(value ?? '').trim();
  const truncate = (value, max) => cleanText(value).slice(0, max);
  const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const LEVELS = ['مبتدئ', 'متوسط', 'متقدم', 'خبير'];
  const EVIDENCE_TYPES = ['github', 'portfolio', 'certificate', 'file', 'challenge', 'other'];
  const EVIDENCE_LABELS = {
    github: 'مشروع GitHub',
    portfolio: 'نموذج أعمال',
    certificate: 'شهادة أو دورة',
    file: 'ملف أو تقرير',
    challenge: 'نتيجة تحدٍ',
    other: 'رابط آخر'
  };

  const freshState = () => ({
    profile: { name: '', headline: '', bio: '', location: '', profileLink: '' },
    skills: [],
    projects: [],
    challenges: [],
    privacy: { isPublic: false, showProjects: true, showEvidence: true }
  });

  function safeUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return '';
      if (url.username || url.password) return '';
      return url.href;
    } catch {
      return '';
    }
  }

  function normalizeState(value) {
    const base = freshState();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
    const profile = value.profile && typeof value.profile === 'object' && !Array.isArray(value.profile) ? value.profile : {};
    const privacy = value.privacy && typeof value.privacy === 'object' && !Array.isArray(value.privacy) ? value.privacy : {};

    const skills = Array.isArray(value.skills) ? value.skills.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).slice(0, 1000).map((item) => ({
      id: truncate(item.id, 100) || makeId(),
      name: truncate(item.name, 80),
      category: truncate(item.category, 80) || 'أخرى',
      level: LEVELS.includes(item.level) ? item.level : 'مبتدئ',
      evidenceType: EVIDENCE_TYPES.includes(item.evidenceType) ? item.evidenceType : 'other',
      evidenceUrl: safeUrl(truncate(item.evidenceUrl, 500)),
      evidenceDesc: truncate(item.evidenceDesc, 220),
      verified: false
    })).filter((item) => item.name) : [];

    const projects = Array.isArray(value.projects) ? value.projects.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).slice(0, 1000).map((item) => ({
      id: truncate(item.id, 100) || makeId(),
      title: truncate(item.title, 100),
      type: truncate(item.type, 60) || 'إنجاز آخر',
      desc: truncate(item.desc, 500),
      url: safeUrl(truncate(item.url, 500))
    })).filter((item) => item.title) : [];

    const challenges = Array.isArray(value.challenges) ? value.challenges.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).slice(0, 1000).map((item) => ({
      score: Math.max(0, Math.min(3, Number.isFinite(Number(item.score)) ? Math.round(Number(item.score)) : 0)),
      feedback: Array.isArray(item.feedback) ? item.feedback.slice(0, 3).map((entry) => truncate(entry, 180)) : [],
      at: truncate(item.at, 60)
    })) : [];

    return {
      profile: {
        name: truncate(profile.name, 80),
        headline: truncate(profile.headline, 100),
        bio: truncate(profile.bio, 500),
        location: truncate(profile.location, 100),
        profileLink: safeUrl(truncate(profile.profileLink, 300))
      },
      skills,
      projects,
      challenges,
      privacy: {
        isPublic: false,
        showProjects: typeof privacy.showProjects === 'boolean' ? privacy.showProjects : true,
        showEvidence: typeof privacy.showEvidence === 'boolean' ? privacy.showEvidence : true
      }
    };
  }

  let state = freshState();
  let currentUser = null;
  let authEpoch = 0;
  let serverVersion = 0;
  let localRevision = 0;
  let savedRevision = 0;
  let savePromise = null;
  let saveBlocked = false;
  let lastSaveErrorStatus = 0;
  let authMessage = 'جار التحقق من تسجيل الدخول...';

  function hasUnsavedChanges() {
    return localRevision !== savedRevision || saveBlocked;
  }

  function clearLegacyLocalPassport() {
    try {
      localStorage.removeItem('saee-skill-passport-demo-v1');
      localStorage.removeItem('saee-skill-passport-demo-v1-share-preview-enabled-v2');
    } catch (error) {
      console.warn('Saee Skill Passport: could not clear legacy browser data.', error);
    }
  }

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  function setSaveStatus(message, isError = false) {
    const status = $('passportSaveStatus');
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function updateAuthPanel() {
    const status = $('passportAuthStatus');
    const actions = $('passportAuthActions');
    if (currentUser) {
      status.textContent = `تم تسجيل الدخول باسم ${currentUser.displayName || currentUser.email}. بيانات الجواز محفوظة في حسابك على الخادم، وليست في تخزين المتصفح.`;
      actions.innerHTML = '<a class="sp-btn sp-btn-light" href="/signout-with-chatgpt?return_to=%2Fskill-passport.html">تسجيل الخروج</a>';
    } else {
      status.textContent = authMessage;
      actions.innerHTML = '<a class="sp-btn" href="/signin-with-chatgpt?return_to=%2Fskill-passport.html">تسجيل الدخول عبر ChatGPT</a>';
    }
  }

  function updateRecoveryControls() {
    const pending = hasUnsavedChanges();
    const backup = $('downloadUnsavedBtn');
    const retry = $('retrySaveBtn');
    backup.hidden = !pending;
    backup.disabled = !currentUser || localRevision === savedRevision;
    const retryAllowed = saveBlocked && Boolean(currentUser) && ![400, 401, 403, 409, 413, 415, 428].includes(lastSaveErrorStatus);
    retry.hidden = !retryAllowed;
    retry.disabled = !retryAllowed;
  }

  function setEditorEnabled(enabled) {
    ['profileForm', 'skillForm', 'projectForm', 'challengeForm', 'analyzerForm'].forEach((id) => {
      const form = $(id);
      form.querySelectorAll('input, textarea, select, button').forEach((control) => { control.disabled = !enabled; });
    });
    ['skillsList', 'projectsList', 'analysisResult'].forEach((id) => {
      $(id).querySelectorAll('button').forEach((control) => { control.disabled = !enabled; });
    });
    ['showProjects', 'showEvidence', 'deletePassportBtn'].forEach((id) => { $(id).disabled = !enabled; });
    $('exportBtn').disabled = !enabled && !hasUnsavedChanges();
    $('publicToggle').checked = false;
    $('publicToggle').disabled = true;
    updateRecoveryControls();
  }

  function resetPrivateState() {
    authEpoch += 1;
    currentUser = null;
    serverVersion = 0;
    localRevision = 0;
    savedRevision = 0;
    saveBlocked = false;
    lastSaveErrorStatus = 0;
    state = freshState();
    $('publicPreview').innerHTML = '';
    const dialog = $('publicDialog');
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    render();
    updateAuthPanel();
    setEditorEnabled(false);
  }

  async function loadServerPassport() {
    const loadEpoch = ++authEpoch;
    setEditorEnabled(false);
    authMessage = 'جار التحقق من حسابك وتحميل جواز المهارات...';
    updateAuthPanel();
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'GET', credentials: 'same-origin', cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      if (loadEpoch !== authEpoch) return;
      const result = await response.json().catch(() => ({}));
      if (loadEpoch !== authEpoch) return;
      const isApiJson = (response.headers.get('content-type') || '').toLowerCase().includes('application/json');

      if (isApiJson && (response.status === 401 || (response.ok && result.user && Number.isInteger(Number(result.version))))) {
        clearLegacyLocalPassport();
      }
      if (response.status === 401) {
        resetPrivateState();
        authMessage = 'سجّل الدخول بحسابك حتى يتم تحميل جوازك وحفظه بشكل منفصل عن المستخدمين الآخرين.';
        updateAuthPanel();
        setSaveStatus('لم تُحمّل بيانات شخصية ولم تُحفظ في هذا المتصفح.', false);
        return;
      }
      if (!response.ok) {
        const message = response.status === 404
          ? 'خدمة الحفظ السحابي غير متاحة على هذا العنوان. افتح الجواز من نسخة Cloudflare بعد تفعيل واجهة API وقاعدة البيانات.'
          : (result.error || `تعذر تحميل الجواز (HTTP ${response.status}).`);
        const failure = new Error(message);
        failure.status = response.status;
        throw failure;
      }
      if (!result.user || !Number.isInteger(Number(result.version)) || Number(result.version) < 0) throw new Error('استجابة الخادم غير مكتملة.');
      currentUser = { displayName: String(result.user.displayName || ''), email: String(result.user.email || '') };
      serverVersion = Number(result.version);
      state = normalizeState(result.state);
      localRevision = 0;
      savedRevision = 0;
      saveBlocked = false;
      lastSaveErrorStatus = 0;
      render();
      updateAuthPanel();
      setEditorEnabled(true);
      setSaveStatus(result.updatedAt ? `تم تحميل آخر نسخة محفوظة في ${new Date(result.updatedAt).toLocaleString()}.` : 'تم فتح جوازك؛ ستُحفظ أول إضافة على الخادم.', false);
    } catch (error) {
      if (loadEpoch !== authEpoch) return;
      resetPrivateState();
      authMessage = error && error.status === 404
        ? 'الحفظ الآمن غير مفعّل لهذا العنوان. سجّل الدخول من النسخة المستضافة على Cloudflare بعد تفعيل API وقاعدة البيانات.'
        : 'تعذر الاتصال بخادم جواز المهارات. لم يتم استخدام تخزين محلي بديل.';
      updateAuthPanel();
      setEditorEnabled(false);
      setSaveStatus(error instanceof Error ? error.message : 'خدمة الجواز غير متاحة.', true);
    }
  }

  function handleSaveFailure(error) {
    const status = Number(error?.status) || 0;
    lastSaveErrorStatus = status;
    saveBlocked = true;
    if (status === 401) {
      authMessage = 'انتهت جلسة الدخول. أعد تسجيل الدخول لتحميل النسخة المحفوظة على الخادم.';
      resetPrivateState();
      setSaveStatus('انتهت الجلسة. مُسحت البيانات من الشاشة لحماية الخصوصية؛ لم يتم حفظ آخر تعديل.', true);
      return;
    }
    const message = error instanceof Error ? error.message : 'تعذر تأكيد الحفظ على الخادم.';
    setSaveStatus(`${message} بقيت التعديلات غير المؤكدة في ذاكرة الصفحة مؤقتًا. نزّل نسخة إنقاذ قبل إعادة التحميل.`, true);
    setEditorEnabled(false);
    updateRecoveryControls();
    alert('لم يتم تأكيد حفظ التعديلات. لم يتم حفظها محليًا. استخدم «تنزيل نسخة إنقاذ» قبل إعادة تحميل الصفحة.');
  }

  function flushServerSave() {
    if (savePromise) return savePromise;
    if (!currentUser || saveBlocked || localRevision === savedRevision) return Promise.resolve();

    const requestEpoch = authEpoch;
    savePromise = (async () => {
      while (currentUser && !saveBlocked && localRevision !== savedRevision && requestEpoch === authEpoch) {
        const revisionToSave = localRevision;
        const snapshot = JSON.parse(JSON.stringify(normalizeState(state)));
        setSaveStatus('جار حفظ التعديلات في حسابك على الخادم...', false);
        const response = await fetch(API_ENDPOINT, {
          method: 'PUT', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'If-Match': `"${serverVersion}"` },
          body: JSON.stringify({ state: snapshot })
        });
        if (requestEpoch !== authEpoch) return;
        const result = await response.json().catch(() => ({}));
        if (requestEpoch !== authEpoch) return;
        if (!response.ok) {
          const error = new Error(result.error || `فشل الحفظ (HTTP ${response.status}).`);
          error.status = response.status;
          throw error;
        }
        const returnedVersion = Number(result.version);
        if (!Number.isInteger(returnedVersion) || returnedVersion <= serverVersion) {
          throw new Error('استجابة الحفظ غير مكتملة؛ لم نعتبر التعديل محفوظًا. صدّر نسخة إنقاذ وتحقق من الخادم.');
        }
        serverVersion = returnedVersion;
        savedRevision = revisionToSave;
        if (localRevision === savedRevision) {
          saveBlocked = false;
          lastSaveErrorStatus = 0;
          setSaveStatus(`تم الحفظ على الخادم في ${new Date(result.updatedAt || Date.now()).toLocaleTimeString()}.`, false);
        }
      }
    })().catch((error) => {
      handleSaveFailure(error);
    }).finally(() => {
      savePromise = null;
      updateRecoveryControls();
      if (currentUser && !saveBlocked && localRevision !== savedRevision) void flushServerSave();
    });
    return savePromise;
  }

  function commit(mutator, options = {}) {
    if (!currentUser) {
      alert('سجّل الدخول أولًا. لن نحفظ بيانات الجواز في تخزين المتصفح.');
      return false;
    }
    if (saveBlocked) {
      alert('الحفظ متوقف بعد خطأ سابق. نزّل نسخة إنقاذ أو أعد محاولة الحفظ قبل أي تعديل آخر.');
      return false;
    }
    try {
      const next = normalizeState(state);
      mutator(next);
      const normalized = normalizeState(next);
      state = normalized;
      localRevision += 1;
      renderSummary();
      if (options.render) render();
      updateRecoveryControls();
      void flushServerSave();
      return true;
    } catch (error) {
      console.error('Saee Skill Passport: validation failed.', error);
      alert('تعذر تجهيز التعديل للحفظ. لم يتم تأكيد الحفظ على الخادم.');
      return false;
    }
  }
