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
    profile: {
      name: '',
      headline: '',
      bio: '',
      location: '',
      profileLink: ''
    },
    skills: [],
    projects: [],
    challenges: [],
    privacy: {
      isPublic: false,
      showProjects: true,
      showEvidence: true
    }
  });

  function safeUrl(value) {
    try {
      const url = new URL(String(value || '').trim());

      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
        return '';
      }

      if (url.username || url.password) return '';

      return url.href;
    } catch {
      return '';
    }
  }

  function normalizeState(value) {
    const base = freshState();

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return base;
    }

    const profile =
      value.profile &&
      typeof value.profile === 'object' &&
      !Array.isArray(value.profile)
        ? value.profile
        : {};

    const privacy =
      value.privacy &&
      typeof value.privacy === 'object' &&
      !Array.isArray(value.privacy)
        ? value.privacy
        : {};

    const skills = Array.isArray(value.skills)
      ? value.skills
          .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
          .slice(0, 1000)
          .map((item) => ({
            id: truncate(item.id, 100) || makeId(),
            name: truncate(item.name, 80),
            category: truncate(item.category, 80) || 'أخرى',
            level: LEVELS.includes(item.level) ? item.level : 'مبتدئ',
            evidenceType: EVIDENCE_TYPES.includes(item.evidenceType)
              ? item.evidenceType
              : 'other',
            evidenceUrl: safeUrl(truncate(item.evidenceUrl, 500)),
            evidenceDesc: truncate(item.evidenceDesc, 220),
            verified: false
          }))
          .filter((item) => item.name)
      : [];

    const projects = Array.isArray(value.projects)
      ? value.projects
          .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
          .slice(0, 1000)
          .map((item) => ({
            id: truncate(item.id, 100) || makeId(),
            title: truncate(item.title, 100),
            type: truncate(item.type, 60) || 'إنجاز آخر',
            desc: truncate(item.desc, 500),
            url: safeUrl(truncate(item.url, 500))
          }))
          .filter((item) => item.title)
      : [];

    const challenges = Array.isArray(value.challenges)
      ? value.challenges
          .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
          .slice(0, 1000)
          .map((item) => ({
            score: Math.max(
              0,
              Math.min(
                3,
                Number.isFinite(Number(item.score))
                  ? Math.round(Number(item.score))
                  : 0
              )
            ),
            feedback: Array.isArray(item.feedback)
              ? item.feedback.slice(0, 3).map((entry) => truncate(entry, 180))
              : [],
            at: truncate(item.at, 60)
          }))
      : [];

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
        showProjects:
          typeof privacy.showProjects === 'boolean'
            ? privacy.showProjects
            : true,
        showEvidence:
          typeof privacy.showEvidence === 'boolean'
            ? privacy.showEvidence
            : true
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
  let authMessage = '';

  function hasUnsavedChanges() {
    return localRevision !== savedRevision || saveBlocked;
  }

  function clearLegacyLocalPassport() {
    try {
      localStorage.removeItem('saee-skill-passport-demo-v1');
      localStorage.removeItem(
        'saee-skill-passport-demo-v1-share-preview-enabled-v2'
      );
    } catch (error) {
      console.warn(
        'Saee Skill Passport: could not clear legacy browser data.',
        error
      );
    }
  }

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);

  // إخفاء منطقة حالة الحفظ بالكامل.
  function setSaveStatus(message, isError = false) {
    const status = $('passportSaveStatus');

    if (!status) return;

    status.textContent = '';
    status.classList.remove('is-error');
    status.hidden = true;
    status.style.display = 'none';
    status.setAttribute('aria-hidden', 'true');
  }

  // إخفاء زر تسجيل الدخول ورسائل حالة المصادقة.
  function updateAuthPanel() {
    const status = $('passportAuthStatus');
    const actions = $('passportAuthActions');

    if (status) {
      status.textContent = '';
      status.hidden = true;
      status.style.display = 'none';
      status.setAttribute('aria-hidden', 'true');
    }

    if (actions) {
      actions.innerHTML = '';
      actions.hidden = true;
      actions.style.display = 'none';
      actions.setAttribute('aria-hidden', 'true');
    }
  }

  function updateRecoveryControls() {
    const pending = hasUnsavedChanges();
    const backup = $('downloadUnsavedBtn');
    const retry = $('retrySaveBtn');

    if (backup) {
      backup.hidden = !pending;
      backup.disabled = !currentUser || localRevision === savedRevision;
    }

    const retryAllowed =
      saveBlocked &&
      Boolean(currentUser) &&
      ![400, 401, 403, 409, 413, 415, 428].includes(lastSaveErrorStatus);

    if (retry) {
      retry.hidden = !retryAllowed;
      retry.disabled = !retryAllowed;
    }
  }

  function setEditorEnabled(enabled) {
    [
      'profileForm',
      'skillForm',
      'projectForm',
      'challengeForm',
      'analyzerForm'
    ].forEach((id) => {
      const form = $(id);

      if (!form) return;

      form.querySelectorAll('input, textarea, select, button').forEach((control) => {
        control.disabled = !enabled;
      });
    });

    ['skillsList', 'projectsList', 'analysisResult'].forEach((id) => {
      const element = $(id);

      if (!element) return;

      element.querySelectorAll('button').forEach((control) => {
        control.disabled = !enabled;
      });
    });

    ['showProjects', 'showEvidence', 'deletePassportBtn'].forEach((id) => {
      const element = $(id);

      if (element) element.disabled = !enabled;
    });

    const exportButton = $('exportBtn');

    if (exportButton) {
      exportButton.disabled = !enabled && !hasUnsavedChanges();
    }

    const publicToggle = $('publicToggle');

    if (publicToggle) {
      publicToggle.checked = false;
      publicToggle.disabled = true;
    }

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

    const publicPreview = $('publicPreview');

    if (publicPreview) {
      publicPreview.innerHTML = '';
    }

    const dialog = $('publicDialog');

    if (dialog) {
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }

    render();
    updateAuthPanel();
    setEditorEnabled(false);
  }

  async function loadServerPassport() {
    const loadEpoch = ++authEpoch;

    setEditorEnabled(false);
    authMessage = '';
    updateAuthPanel();

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      });

      if (loadEpoch !== authEpoch) return;

      const result = await response.json().catch(() => ({}));

      if (loadEpoch !== authEpoch) return;

      const isApiJson = (
        response.headers.get('content-type') || ''
      ).toLowerCase().includes('application/json');

      if (
        isApiJson &&
        (
          response.status === 401 ||
          (
            response.ok &&
            result.user &&
            Number.isInteger(Number(result.version))
          )
        )
      ) {
        clearLegacyLocalPassport();
      }

      if (response.status === 401) {
        resetPrivateState();
        authMessage = '';
        updateAuthPanel();
        setSaveStatus('', false);
        return;
      }

      if (!response.ok) {
        const message = response.status === 404
          ? 'خدمة الحفظ السحابي غير متاحة على هذا العنوان.'
          : (result.error || `تعذر تحميل الجواز (HTTP ${response.status}).`);

        const failure = new Error(message);
        failure.status = response.status;
        throw failure;
      }

      if (
        !result.user ||
        !Number.isInteger(Number(result.version)) ||
        Number(result.version) < 0
      ) {
        throw new Error('استجابة الخادم غير مكتملة.');
      }

      currentUser = {
        displayName: String(result.user.displayName || ''),
        email: String(result.user.email || '')
      };

      serverVersion = Number(result.version);
      state = normalizeState(result.state);
      localRevision = 0;
      savedRevision = 0;
      saveBlocked = false;
      lastSaveErrorStatus = 0;

      render();
      updateAuthPanel();
      setEditorEnabled(true);
      setSaveStatus('', false);
    } catch (error) {
      if (loadEpoch !== authEpoch) return;

      resetPrivateState();
      authMessage = '';
      updateAuthPanel();
      setEditorEnabled(false);
      setSaveStatus('', true);

      console.error(
        'Saee Skill Passport: could not load server passport.',
        error
      );
    }
  }

  function handleSaveFailure(error) {
    const status = Number(error?.status) || 0;

    lastSaveErrorStatus = status;
    saveBlocked = true;

    if (status === 401) {
      authMessage = '';
      resetPrivateState();
      setSaveStatus('', true);
      return;
    }

    setSaveStatus('', true);
    setEditorEnabled(false);
    updateRecoveryControls();

    alert(
      'لم يتم تأكيد حفظ التعديلات. لم يتم حفظها محليًا. استخدم «تنزيل نسخة إنقاذ» قبل إعادة تحميل الصفحة.'
    );
  }

  function flushServerSave() {
    if (savePromise) return savePromise;

    if (
      !currentUser ||
      saveBlocked ||
      localRevision === savedRevision
    ) {
      return Promise.resolve();
    }

    const requestEpoch = authEpoch;

    savePromise = (async () => {
      while (
        currentUser &&
        !saveBlocked &&
        localRevision !== savedRevision &&
        requestEpoch === authEpoch
      ) {
        const revisionToSave = localRevision;
        const snapshot = JSON.parse(JSON.stringify(normalizeState(state)));

        setSaveStatus('', false);

        const response = await fetch(API_ENDPOINT, {
          method: 'PUT',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            'If-Match': `"${serverVersion}"`
          },
          body: JSON.stringify({
            state: snapshot
          })
        });

        if (requestEpoch !== authEpoch) return;

        const result = await response.json().catch(() => ({}));

        if (requestEpoch !== authEpoch) return;

        if (!response.ok) {
          const error = new Error(
            result.error || `فشل الحفظ (HTTP ${response.status}).`
          );

          error.status = response.status;
          throw error;
        }

        const returnedVersion = Number(result.version);

        if (
          !Number.isInteger(returnedVersion) ||
          returnedVersion <= serverVersion
        ) {
          throw new Error(
            'استجابة الحفظ غير مكتملة؛ لم نعتبر التعديل محفوظًا.'
          );
        }

        serverVersion = returnedVersion;
        savedRevision = revisionToSave;

        if (localRevision === savedRevision) {
          saveBlocked = false;
          lastSaveErrorStatus = 0;
          setSaveStatus('', false);
        }
      }
    })()
      .catch((error) => {
        handleSaveFailure(error);
      })
      .finally(() => {
        savePromise = null;
        updateRecoveryControls();

        if (
          currentUser &&
          !saveBlocked &&
          localRevision !== savedRevision
        ) {
          void flushServerSave();
        }
      });

    return savePromise;
  }

  function commit(mutator, options = {}) {
    if (!currentUser) {
      alert('يجب أن تكون جلسة الحساب صالحة قبل تعديل اسعى للعمل.');
      return false;
    }

    if (saveBlocked) {
      alert(
        'الحفظ متوقف بعد خطأ سابق. نزّل نسخة إنقاذ أو أعد محاولة الحفظ قبل أي تعديل آخر.'
      );
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
      console.error(
        'Saee Skill Passport: validation failed.',
        error
      );

      alert('تعذر تجهيز التعديل للحفظ.');

      return false;
    }
  }

  function renderSummary() {
    $('heroName').textContent =
      state.profile.name || 'صاحب المهارات';

    $('heroHeadline').textContent =
      state.profile.headline || 'أضف نبذة تعريفية قصيرة عنك';

    $('statSkills').textContent = state.skills.length;

    $('statEvidence').textContent = state.skills.filter(
      (skill) => skill.evidenceUrl || skill.evidenceDesc
    ).length;

    $('statChallenges').textContent = state.challenges.length;

    const completedSections =
      (state.profile.name ? 1 : 0) +
      (state.profile.headline ? 1 : 0) +
      (state.profile.bio ? 1 : 0) +
      (state.skills.length ? 1 : 0) +
      (state.projects.length ? 1 : 0);

    const percentage = Math.round((completedSections / 5) * 100);

    $('completionBar').style.width = `${percentage}%`;

    $('completionText').textContent =
      `اكتمال الملف التجريبي: ${percentage}%`;
  }

  function renderSkills() {
    $('skillsList').innerHTML = state.skills.length
      ? state.skills.map((skill) => {
          const url = safeUrl(skill.evidenceUrl);

          return `
            <article class="sp-item">
              <div>
                <h3>
                  ${escapeHtml(skill.name)}
                  <span class="sp-chip">${escapeHtml(skill.level)}</span>
                </h3>

                <p>
                  ${escapeHtml(skill.category)} ·
                  ${
                    state.privacy.showEvidence &&
                    (url || skill.evidenceDesc)
                      ? 'مدعومة بدليل'
                      : 'مدخلة ذاتيًا'
                  }
                  ${skill.verified ? ' · اجتازت تحديًا عمليًا' : ''}
                </p>

                ${
                  state.privacy.showEvidence && skill.evidenceDesc
                    ? `<p>${escapeHtml(skill.evidenceDesc)}</p>`
                    : ''
                }

                ${
                  state.privacy.showEvidence && url
                    ? `
                      <p>
                        <a
                          href="${escapeHtml(url)}"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          ${escapeHtml(
                            EVIDENCE_LABELS[skill.evidenceType] || 'فتح الدليل'
                          )} ↗
                        </a>
                      </p>
                    `
                    : ''
                }
              </div>

              <div class="sp-item-actions">
                <button
                  class="sp-mini"
                  type="button"
                  data-edit-skill="${escapeHtml(skill.id)}"
                >تعديل</button>

                <button
                  class="sp-mini"
                  type="button"
                  data-delete-skill="${escapeHtml(skill.id)}"
                >حذف</button>
              </div>
            </article>
          `;
        }).join('')
      : '<div class="sp-empty">لم تضف مهارات بعد. ابدأ بمهارة تستطيع دعمها بمثال عملي.</div>';
  }

  function renderProjects() {
    $('projectsList').innerHTML = state.projects.length
      ? state.projects.map((project) => {
          const url = safeUrl(project.url);

          return `
            <article class="sp-item">
              <div>
                <h3>
                  ${escapeHtml(project.title)}
                  <span class="sp-chip">${escapeHtml(project.type)}</span>
                </h3>

                <p>${escapeHtml(project.desc)}</p>

                ${
                  url
                    ? `
                      <p>
                        <a
                          href="${escapeHtml(url)}"
                          target="_blank"
                          rel="noopener noreferrer"
                        >فتح الرابط ↗</a>
                      </p>
                    `
                    : ''
                }
              </div>

              <div class="sp-item-actions">
                <button
                  class="sp-mini"
                  type="button"
                  data-edit-project="${escapeHtml(project.id)}"
                >تعديل</button>

                <button
                  class="sp-mini"
                  type="button"
                  data-delete-project="${escapeHtml(project.id)}"
                >حذف</button>
              </div>
            </article>
          `;
        }).join('')
      : '<div class="sp-empty">أضف مشروعًا أو شهادة أو تجربة تطوعية لتظهر هنا.</div>';
  }

  function renderChallenges() {
    $('challengeHistory').innerHTML = state.challenges.length
      ? state.challenges.map((challenge) => `
          <article class="sp-item">
            <div>
              <h3>تحدي أساسيات أمن الويب · ${challenge.score}/3</h3>
              <p>${escapeHtml(challenge.feedback.join(' · '))}</p>
            </div>
          </article>
        `).join('')
      : '';
  }

  function renderPrivacy() {
    $('publicToggle').checked = false;
    $('publicToggle').disabled = true;
    $('showProjects').checked = state.privacy.showProjects;
    $('showEvidence').checked = state.privacy.showEvidence;
  }

  function render() {
    ['name', 'headline', 'bio', 'location', 'profileLink'].forEach((field) => {
      $(field).value = state.profile[field] || '';
    });

    renderSummary();
    renderSkills();
    renderProjects();
    renderChallenges();
    renderPrivacy();
  }

  function readOptionalUrl(raw, label) {
    const value = cleanText(raw);

    if (!value) return '';

    const url = safeUrl(value);

    if (!url) {
      alert(
        `رابط ${label} غير صالح. استخدم رابطًا يبدأ بـ https:// أو http://`
      );
    }

    return url;
  }

  $('profileForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const rawUrl = cleanText($('profileLink').value);
    const profileLink = readOptionalUrl(rawUrl, 'الملف الشخصي');

    if (rawUrl && !profileLink) return;

    const profile = {
      name: truncate($('name').value, 80),
      headline: truncate($('headline').value, 100),
      bio: truncate($('bio').value, 500),
      location: truncate($('location').value, 100),
      profileLink
    };

    if (!profile.name) {
      return alert('الاسم المعروض مطلوب.');
    }

    commit((next) => {
      next.profile = profile;
    });
  });

  $('skillForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const name = truncate($('skillName').value, 80);

    if (!name) return alert('اسم المهارة مطلوب.');

    if (state.skills.length >= 100) {
      return alert(
        'وصلت إلى الحد التجريبي وهو 100 مهارة. احذف مهارة غير لازمة قبل إضافة أخرى.'
      );
    }

    const rawUrl = cleanText($('evidenceUrl').value);
    const evidenceUrl = readOptionalUrl(rawUrl, 'الدليل');

    if (rawUrl && !evidenceUrl) return;

    const skill = {
      id: makeId(),
      name,
      category: truncate($('skillCategory').value, 80) || 'أخرى',
      level: LEVELS.includes($('skillLevel').value)
        ? $('skillLevel').value
        : 'مبتدئ',
      evidenceType: EVIDENCE_TYPES.includes($('evidenceType').value)
        ? $('evidenceType').value
        : 'other',
      evidenceUrl,
      evidenceDesc: truncate($('evidenceDesc').value, 220),
      verified: false
    };

    if (commit((next) => {
      next.skills.unshift(skill);
    })) {
      event.currentTarget.reset();
      renderSkills();
    }
  });

  $('projectForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const title = truncate($('projectTitle').value, 100);
    const desc = truncate($('projectDesc').value, 500);

    if (!title || !desc) {
      return alert('عنوان الإنجاز ووصفه مطلوبان.');
    }

    if (state.projects.length >= 100) {
      return alert(
        'وصلت إلى الحد التجريبي وهو 100 إنجاز. احذف إنجازًا غير لازم قبل إضافة آخر.'
      );
    }

    const rawUrl = cleanText($('projectUrl').value);
    const url = readOptionalUrl(rawUrl, 'المشروع');

    if (rawUrl && !url) return;

    const project = {
      id: makeId(),
      title,
      type: truncate($('projectType').value, 60) || 'إنجاز آخر',
      desc,
      url
    };

    if (commit((next) => {
      next.projects.unshift(project);
    })) {
      event.currentTarget.reset();
      renderProjects();
    }
  });

  function editSkill(skill) {
    const name = prompt('اسم المهارة:', skill.name);
    if (name === null) return;

    const category = prompt('المجال:', skill.category);
    if (category === null) return;

    const level = prompt(
      `المستوى (${LEVELS.join('، ')}):`,
      skill.level
    );
    if (level === null) return;

    const evidenceType = prompt(
      `نوع الدليل (${EVIDENCE_TYPES.join(' / ')}):`,
      skill.evidenceType
    );
    if (evidenceType === null) return;

    const evidenceDesc = prompt(
      'وصف الدليل (اتركه فارغًا للمسح):',
      skill.evidenceDesc
    );
    if (evidenceDesc === null) return;

    const rawUrl = prompt(
      'رابط الدليل (اتركه فارغًا للمسح):',
      skill.evidenceUrl
    );
    if (rawUrl === null) return;

    const evidenceUrl = readOptionalUrl(rawUrl, 'الدليل');

    if (cleanText(rawUrl) && !evidenceUrl) return;
    if (!truncate(name, 80)) return alert('اسم المهارة مطلوب.');

    if (!LEVELS.includes(cleanText(level))) {
      return alert('المستوى غير صالح. اختر مستوى من القائمة الموضحة.');
    }

    if (!EVIDENCE_TYPES.includes(cleanText(evidenceType))) {
      return alert('نوع الدليل غير صالح. اختر قيمة من القائمة الموضحة.');
    }

    const updated = {
      name: truncate(name, 80),
      category: truncate(category, 80) || 'أخرى',
      level: cleanText(level),
      evidenceType: cleanText(evidenceType),
      evidenceDesc: truncate(evidenceDesc, 220),
      evidenceUrl
    };

    if (commit((next) => {
      const target = next.skills.find((item) => item.id === skill.id);

      if (!target) {
        throw new Error('لم تعد المهارة موجودة. حدّث الصفحة وحاول مجددًا.');
      }

      Object.assign(target, updated);
    })) {
      renderSkills();
    }
  }

  function editProject(project) {
    const title = prompt('عنوان المشروع أو الإنجاز:', project.title);
    if (title === null) return;

    const type = prompt('نوع الإنجاز:', project.type);
    if (type === null) return;

    const desc = prompt('الوصف:', project.desc);
    if (desc === null) return;

    const rawUrl = prompt(
      'رابط المشروع (اتركه فارغًا للمسح):',
      project.url
    );
    if (rawUrl === null) return;

    const url = readOptionalUrl(rawUrl, 'المشروع');

    if (cleanText(rawUrl) && !url) return;

    if (!truncate(title, 100) || !truncate(desc, 500)) {
      return alert('العنوان والوصف مطلوبان.');
    }

    if (commit((next) => {
      const target = next.projects.find((item) => item.id === project.id);

      if (!target) {
        throw new Error('لم يعد الإنجاز موجودًا. حدّث الصفحة وحاول مجددًا.');
      }

      Object.assign(target, {
        title: truncate(title, 100),
        type: truncate(type, 60) || 'إنجاز آخر',
        desc: truncate(desc, 500),
        url
      });
    })) {
      renderProjects();
    }
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;

    if (!target) return;

    const editSkillButton = target.closest('[data-edit-skill]');
    const deleteSkillButton = target.closest('[data-delete-skill]');
    const editProjectButton = target.closest('[data-edit-project]');
    const deleteProjectButton = target.closest('[data-delete-project]');
    const suggestionButton = target.closest('[data-add-suggest]');

    if (editSkillButton) {
      const skill = state.skills.find(
        (item) => item.id === editSkillButton.dataset.editSkill
      );

      if (skill) editSkill(skill);
      return;
    }

    if (deleteSkillButton) {
      if (!confirm('حذف هذه المهارة؟')) return;

      const skillId = deleteSkillButton.dataset.deleteSkill;

      if (commit((next) => {
        next.skills = next.skills.filter((item) => item.id !== skillId);
      })) {
        renderSkills();
      }

      return;
    }

    if (editProjectButton) {
      const project = state.projects.find(
        (item) => item.id === editProjectButton.dataset.editProject
      );

      if (project) editProject(project);
      return;
    }

    if (deleteProjectButton) {
      if (!confirm('حذف هذا الإنجاز؟')) return;

      const projectId = deleteProjectButton.dataset.deleteProject;

      if (commit((next) => {
        next.projects = next.projects.filter((item) => item.id !== projectId);
      })) {
        renderProjects();
      }

      return;
    }

    if (suggestionButton) {
      const name = suggestionButton.dataset.addSuggest;

      if (state.skills.some(
        (skill) => skill.name.toLocaleLowerCase() === name.toLocaleLowerCase()
      )) {
        alert('هذه المهارة موجودة بالفعل.');
        return;
      }

      const skill = {
        id: makeId(),
        name: truncate(name, 80),
        category: 'أخرى',
        level: 'مبتدئ',
        evidenceType: 'other',
        evidenceUrl: '',
        evidenceDesc: 'اقتراح من محلل المهارات — راجعه وأضف دليلًا.',
        verified: false
      };

      if (commit((next) => {
        next.skills.unshift(skill);
      })) {
        renderSkills();
        alert('أضيفت كمهارة مدخلة ذاتيًا.');
      }
    }
  });

  $('challengeForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const answer = cleanText($('challengeAnswer').value).toLowerCase();

    const criteria = [
      {
        re: /prepared statement|parameterized|parameterised|استعلامات?\s*معلّمة|استعلامات?\s*مجهزة|استعلامات?\s*معلَمة/,
        label: 'استخدام الاستعلامات المعلّمة'
      },
      {
        re: /validate|validation|تحقق من المدخلات|التحقق من المدخلات|تنقية المدخلات/,
        label: 'التحقق من المدخلات'
      },
      {
        re: /least privilege|minimum privilege|أقل صلاحية|تقليل صلاحيات|صلاحيات محدودة/,
        label: 'تقليل صلاحيات قاعدة البيانات'
      }
    ];

    const matched = criteria.filter(
      (criterion) => criterion.re.test(answer)
    );

    const feedback = criteria.map(
      (criterion) =>
        `${matched.includes(criterion) ? '✓' : '○'} ${criterion.label}`
    );

    const score = matched.length;

    if (state.challenges.length >= 100) {
      return alert(
        'وصلت إلى الحد التجريبي وهو 100 محاولة. احذف الجواز وابدأ من جديد إذا أردت تصفير السجل.'
      );
    }

    const challenge = {
      score,
      feedback,
      at: new Date().toISOString()
    };

    if (!commit((next) => {
      next.challenges.unshift(challenge);
    })) {
      return;
    }

    renderChallenges();
    renderSkills();

    $('challengeResult').hidden = false;

    $('challengeResult').innerHTML = `
      <b>${score}/3</b>
      <p>
        ${
          score === 3
            ? 'ممتاز! ذكرت معايير التقييم الثلاثة.'
            : score === 2
              ? 'نتيجة جيدة. راجع المعيار المتبقي وحاول تحسين إجابتك.'
              : 'راجع المعايير الثلاثة وأعد المحاولة.'
        }
      </p>
      <ul>
        ${feedback.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
      <small>
        هذا تقييم آلي تجريبي قائم على كلمات مفتاحية، ولا يعتمد المهارات
        أو يمنح شهادة أو يتحقق من تنفيذ العمل فعليًا.
      </small>
    `;
  });

  const ANALYSIS_RULES = [
    {
      name: 'أمن تطبيقات الويب',
      re: /owasp|xss|sql injection|حقن sql|ثغرات|web security|security scanner|أمن الويب/i,
      learn: 'تدرّب على OWASP Top 10 واختبر تطبيقًا محليًا ضمن بيئة مصرح بها.'
    },
    {
      name: 'تطوير الويب',
      re: /html|css|javascript|react|next\.?js|api|واجهة|موقع ويب|web app/i,
      learn: 'أنشئ مشروعًا صغيرًا موثقًا، وأضف اختبارات وتوثيقًا لطريقة التشغيل.'
    },
    {
      name: 'قواعد البيانات',
      re: /sql|database|قاعدة بيانات|mysql|sqlite|postgres/i,
      learn: 'تدرّب على تصميم الجداول والاستعلامات الآمنة والتحقق من المدخلات.'
    },
    {
      name: 'إدارة المشاريع',
      re: /team|teamwork|planning|خطة|فريق|إدارة|milestone|مهام/i,
      learn: 'وثّق دورك وخطة التنفيذ والنتائج، واطلب مراجعة من شخص عمل معك.'
    },
    {
      name: 'تحليل البيانات',
      re: /data|تحليل|excel|dashboard|بيانات|statistics|إحصاء/i,
      learn: 'اعرض خطوات التنظيف والتحليل والاستنتاجات في تقرير قابل لإعادة الإنتاج.'
    },
    {
      name: 'التصميم وتجربة المستخدم',
      re: /design|figma|ui|ux|تصميم|واجهة المستخدم|prototype/i,
      learn: 'أرفق نماذج قبل/بعد ووضح قرارات التصميم ونتائج اختبار الاستخدام.'
    },
    {
      name: 'التواصل والعمل الجماعي',
      re: /presentation|communication|تواصل|عرض تقديمي|فريق|collaborat/i,
      learn: 'أضف مثالًا على مساهمتك وملاحظات موثقة من زميل أو مشرف.'
    }
  ];

  $('analyzerForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const description = cleanText($('analyzerText').value);

    if (!description) {
      return alert('اكتب وصف المشروع أولًا.');
    }

    const found = ANALYSIS_RULES.filter(
      (rule) => rule.re.test(description)
    );

    const suggestions = found.length
      ? found
      : [{
          name: 'حل المشكلات والتوثيق',
          learn: 'اكتب المشكلة التي حللتها، والخطوات التي اتبعتها، والنتيجة، ثم أضف رابطًا أو لقطة موثقة.'
        }];

    $('analysisResult').hidden = false;

    $('analysisResult').innerHTML = `
      <b>اقتراحات أولية — راجعها قبل إضافتها</b>
      <ul>
        ${suggestions.map((rule) => `
          <li>
            <b>${escapeHtml(rule.name)}</b><br>
            ${escapeHtml(rule.learn)}
            <button
              class="sp-mini"
              type="button"
              data-add-suggest="${escapeHtml(rule.name)}"
            >أضف كمهارة</button>
          </li>
        `).join('')}
      </ul>
      <small>
        هذه اقتراحات قائمة على قواعد وكلمات مفتاحية؛ لا تثبت امتلاكك للمهارة.
      </small>
    `;
  });

  // معاينة محلية فقط؛ لا تنشئ رابطًا عامًا ولا تنشر بيانات المستخدم.
  function preview() {
    const profile = state.profile;
    const profileLink = safeUrl(profile.profileLink);

    const privacyNotice =
      'معاينة محلية على هذا المتصفح فقط. لا يوجد رابط عام ولا يتم نشر الجواز على الإنترنت.';

    const skillsHtml = state.skills.length
      ? state.skills.map((skill) => {
          const url = safeUrl(skill.evidenceUrl);

          const hasVisibleEvidence =
            state.privacy.showEvidence &&
            Boolean(url || skill.evidenceDesc);

          return `
            <span class="sp-public-skill">
              <b>${escapeHtml(skill.name)}</b>
              <small>
                ${escapeHtml(skill.level)} ·
                ${hasVisibleEvidence ? 'مدعومة بدليل' : 'مدخلة ذاتيًا'}
              </small>
              ${
                state.privacy.showEvidence && url
                  ? `
                    <a
                      href="${escapeHtml(url)}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >عرض الدليل ↗</a>
                  `
                  : ''
              }
            </span>
          `;
        }).join('')
      : '<div class="sp-empty">لا توجد مهارات معروضة.</div>';

    const projectsHtml = state.privacy.showProjects
      ? `
        <div class="sp-public-block">
          <h3>المشاريع والإنجازات</h3>
          ${
            state.projects.length
              ? state.projects.map((project) => {
                  const url = safeUrl(project.url);

                  return `
                    <article class="sp-item">
                      <div>
                        <h3>${escapeHtml(project.title)}</h3>
                        <p>
                          ${escapeHtml(project.type)} ·
                          ${escapeHtml(project.desc)}
                        </p>
                        ${
                          url
                            ? `
                              <a
                                href="${escapeHtml(url)}"
                                target="_blank"
                                rel="noopener noreferrer"
                              >فتح الرابط ↗</a>
                            `
                            : ''
                        }
                      </div>
                    </article>
                  `;
                }).join('')
              : '<div class="sp-empty">لا توجد إنجازات معروضة.</div>'
          }
        </div>
      `
      : '';

    const challengesHtml = state.challenges.length
      ? state.challenges.map((challenge) => `
          <p>
            تحدي أساسيات أمن الويب: ${challenge.score}/3
            <small>(تقييم آلي تجريبي)</small>
          </p>
        `).join('')
      : '<div class="sp-empty">لم تكتمل تحديات بعد.</div>';

    $('publicPreview').innerHTML = `
      <div class="sp-public-head">
        <span class="sp-kicker">SAEE SKILL PASSPORT · معاينة إنجازات</span>
        <div class="sp-warning" role="status">
          ${escapeHtml(privacyNotice)}
        </div>
        <h2>${escapeHtml(profile.name || 'صاحب المهارات')}</h2>
        <b>${escapeHtml(profile.headline || '')}</b>
        <p>${escapeHtml(profile.bio || 'لم تتم إضافة نبذة بعد.')}</p>
        ${
          profile.location
            ? `<small>${escapeHtml(profile.location)}</small>`
            : ''
        }
        ${
          profileLink
            ? `
              <p>
                <a
                  href="${escapeHtml(profileLink)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >الرابط المهني ↗</a>
              </p>
            `
            : ''
        }
        <small>المهارات ذاتية الإدخال ما لم يذكر خلاف ذلك.</small>
      </div>

      <div class="sp-public-block">
        <h3>المهارات</h3>
        ${skillsHtml}
      </div>

      ${projectsHtml}

      <div class="sp-public-block">
        <h3>التحديات العملية</h3>
        ${challengesHtml}
      </div>
    `;

    const dialog = $('publicDialog');

    if (typeof dialog.showModal === 'function' && !dialog.open) {
      dialog.showModal();
    } else if (!dialog.open) {
      dialog.setAttribute('open', '');
    }
  }

  $('shareBtn').addEventListener('click', preview);
  $('shareBtn2').addEventListener('click', preview);

  $('closeDialog').addEventListener('click', () => {
    const dialog = $('publicDialog');

    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  });

  $('publicDialog').addEventListener('click', (event) => {
    if (event.target === $('publicDialog')) {
      const dialog = $('publicDialog');

      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  });

  $('publicToggle').addEventListener('change', () => {
    renderPrivacy();

    alert(
      'المشاركة العامة غير متاحة في النسخة الحالية. المعاينة محلية فقط.'
    );
  });

  $('showProjects').addEventListener('change', (event) => {
    if (!commit((next) => {
      next.privacy.showProjects = event.target.checked;
    })) {
      renderPrivacy();
    }
  });

  $('showEvidence').addEventListener('change', (event) => {
    if (commit((next) => {
      next.privacy.showEvidence = event.target.checked;
    })) {
      renderSkills();
    } else {
      renderPrivacy();
    }
  });

  function downloadJsonSnapshot(filename, warning) {
    if (!confirm(warning)) return;

    let objectUrl = '';

    try {
      const blob = new Blob(
        [JSON.stringify(normalizeState(state), null, 2)],
        { type: 'application/json' }
      );

      objectUrl = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      console.error(
        'Saee Skill Passport: export failed.',
        error
      );

      alert('تعذر تصدير البيانات. حاول مرة أخرى.');
    } finally {
      if (objectUrl) {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    }
  }

  $('exportBtn').addEventListener('click', () => {
    downloadJsonSnapshot(
      'saee-skill-passport.json',
      'سيحتوي ملف JSON على بيانات الجواز كاملة، بما فيها الحقول التي أخفيتها من المعاينة. احفظه في مكان خاص ولا تشاركه قبل مراجعته. هل تريد التصدير؟'
    );
  });

  $('downloadUnsavedBtn').addEventListener('click', () => {
    if (!currentUser || localRevision === savedRevision) {
      return alert('لا توجد تعديلات غير محفوظة تحتاج إلى نسخة إنقاذ.');
    }

    downloadJsonSnapshot(
      'saee-skill-passport-recovery.json',
      'هذه نسخة إنقاذ من بيانات الجواز التي لم يؤكد الخادم حفظها. قد تتضمن معلومات خاصة. احفظها في مكان موثوق واحذفها من التنزيلات عند الانتهاء. هل تريد تنزيلها؟'
    );
  });

  $('retrySaveBtn').addEventListener('click', async () => {
    if (!currentUser || !saveBlocked) return;

    if ([400, 401, 403, 409, 413, 415, 428].includes(lastSaveErrorStatus)) {
      alert(
        'لا يمكن إعادة المحاولة بأمان بعد هذا النوع من الأخطاء. نزّل نسخة إنقاذ، ثم حمّل نسخة الخادم من جديد.'
      );
      return;
    }

    saveBlocked = false;
    lastSaveErrorStatus = 0;

    setEditorEnabled(true);
    updateRecoveryControls();

    await flushServerSave();
  });

  $('deletePassportBtn').addEventListener('click', async () => {
    if (!currentUser) {
      return alert('لا توجد جلسة حساب صالحة لحذف الجواز.');
    }

    if (!confirm(
      'سيتم حذف اسعى للعمل المحفوظ في حسابك على الخادم، وليس من هذا المتصفح فقط. هل تريد المتابعة؟'
    )) {
      return;
    }

    if (!confirm(
      'تأكيد أخير: لا يمكن التراجع عن الحذف. هل تريد حذف بيانات هذا الحساب فقط؟'
    )) {
      return;
    }

    try {
      await (savePromise || Promise.resolve());

      if (hasUnsavedChanges() || saveBlocked) {
        alert(
          'لديك تعديلات لم يؤكد الخادم حفظها. نزّل نسخة إنقاذ أو أعد محاولة الحفظ قبل حذف الجواز.'
        );
        return;
      }

      const response = await fetch(API_ENDPOINT, {
        method: 'DELETE',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json'
        },
        body: '{}'
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error || 'تعذر حذف الجواز من الخادم.'
        );
      }

      state = freshState();
      serverVersion = 0;
      localRevision = 0;
      savedRevision = 0;
      saveBlocked = false;

      render();

      [
        'profileForm',
        'skillForm',
        'projectForm',
        'challengeForm',
        'analyzerForm'
      ].forEach((id) => {
        $(id).reset();
      });

      $('challengeResult').hidden = true;
      $('analysisResult').hidden = true;

      setSaveStatus('', false);

      alert(
        'تم حذف بيانات جواز هذا الحساب من الخادم. لم يتم حذف صفحة الموقع نفسها.'
      );
    } catch (error) {
      console.error(
        'Saee Skill Passport: server delete failed.',
        error
      );

      setSaveStatus('', true);

      alert(
        'لم يتم تأكيد الحذف من الخادم. لم نعرض نجاحًا غير مؤكد.'
      );
    }
  });

  window.addEventListener('beforeunload', (event) => {
    if (currentUser && hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  window.addEventListener('pagehide', () => {
    authEpoch += 1;
    state = freshState();
    currentUser = null;
    serverVersion = 0;
    localRevision = 0;
    savedRevision = 0;
    saveBlocked = false;
    lastSaveErrorStatus = 0;
    authMessage = '';

    render();
    updateAuthPanel();
    setEditorEnabled(false);
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      loadServerPassport();
    }
  });

  // إخفاء عناصر المصادقة والحفظ من واجهة المستخدم.
  function hideStatusAndLoginElements() {
    [
      'passportAuthActions',
      'passportAuthStatus',
      'passportSaveStatus'
    ].forEach((id) => {
      const element = $(id);

      if (!element) return;

      element.textContent = '';
      element.hidden = true;
      element.style.display = 'none';
      element.setAttribute('aria-hidden', 'true');
    });
  }

  setEditorEnabled(false);
  render();
  updateAuthPanel();
  setSaveStatus('', false);
  hideStatusAndLoginElements();
  loadServerPassport();
})();
