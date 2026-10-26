(() => {
  'use strict';

  const STORAGE_KEY = 'saee-skill-passport-demo-v1';
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
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
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
      verified: item.verified === true
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
        isPublic: typeof privacy.isPublic === 'boolean' ? privacy.isPublic : false,
        showProjects: typeof privacy.showProjects === 'boolean' ? privacy.showProjects : true,
        showEvidence: typeof privacy.showEvidence === 'boolean' ? privacy.showEvidence : true
      }
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : freshState();
    } catch (error) {
      console.warn('Saee Skill Passport: stored data was invalid; using an empty passport.', error);
      return freshState();
    }
  }

  let state = loadState();

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  // Save a normalized copy first. If localStorage fails, keep the prior state unchanged.
  function commit(mutator, options = {}) {
    try {
      const next = normalizeState(state);
      mutator(next);
      const normalized = normalizeState(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      state = normalized;
      renderSummary();
      if (options.render) render();
      return true;
    } catch (error) {
      console.error('Saee Skill Passport: save failed.', error);
      alert('تعذر حفظ التعديل في المتصفح. لم يتم اعتماد التغيير؛ تحقق من مساحة التخزين ثم حاول مرة أخرى.');
      return false;
    }
  }

  function renderSummary() {
    $('heroName').textContent = state.profile.name || 'صاحب المهارات';
    $('heroHeadline').textContent = state.profile.headline || 'أضف نبذة تعريفية قصيرة عنك';
    $('statSkills').textContent = state.skills.length;
    $('statEvidence').textContent = state.skills.filter((skill) => skill.evidenceUrl || skill.evidenceDesc).length;
    $('statChallenges').textContent = state.challenges.filter((challenge) => challenge.score >= 2).length;
    const completedSections = (state.profile.name ? 1 : 0) + (state.profile.headline ? 1 : 0) + (state.profile.bio ? 1 : 0) + (state.skills.length ? 1 : 0) + (state.projects.length ? 1 : 0);
    const percentage = Math.round((completedSections / 5) * 100);
    $('completionBar').style.width = `${percentage}%`;
    $('completionText').textContent = `اكتمال الملف التجريبي: ${percentage}%`;
  }

  function renderSkills() {
    $('skillsList').innerHTML = state.skills.length ? state.skills.map((skill) => {
      const url = safeUrl(skill.evidenceUrl);
      return `<article class="sp-item"><div>
        <h3>${escapeHtml(skill.name)} <span class="sp-chip">${escapeHtml(skill.level)}</span></h3>
        <p>${escapeHtml(skill.category)} · ${url || skill.evidenceDesc ? 'مدعومة بدليل' : 'مدخلة ذاتيًا'}${skill.verified ? ' · اجتازت تحديًا عمليًا' : ''}</p>
        ${skill.evidenceDesc ? `<p>${escapeHtml(skill.evidenceDesc)}</p>` : ''}
        ${state.privacy.showEvidence && url ? `<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(EVIDENCE_LABELS[skill.evidenceType] || 'فتح الدليل')} ↗</a></p>` : ''}
        </div><div class="sp-item-actions">
          <button class="sp-mini" type="button" data-edit-skill="${escapeHtml(skill.id)}">تعديل</button>
          <button class="sp-mini" type="button" data-delete-skill="${escapeHtml(skill.id)}">حذف</button>
        </div></article>`;
    }).join('') : '<div class="sp-empty">لم تضف مهارات بعد. ابدأ بمهارة تستطيع دعمها بمثال عملي.</div>';
  }

  function renderProjects() {
    $('projectsList').innerHTML = state.projects.length ? state.projects.map((project) => {
      const url = safeUrl(project.url);
      return `<article class="sp-item"><div>
        <h3>${escapeHtml(project.title)} <span class="sp-chip">${escapeHtml(project.type)}</span></h3>
        <p>${escapeHtml(project.desc)}</p>
        ${url ? `<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">فتح الرابط ↗</a></p>` : ''}
        </div><div class="sp-item-actions">
          <button class="sp-mini" type="button" data-edit-project="${escapeHtml(project.id)}">تعديل</button>
          <button class="sp-mini" type="button" data-delete-project="${escapeHtml(project.id)}">حذف</button>
        </div></article>`;
    }).join('') : '<div class="sp-empty">أضف مشروعًا أو شهادة أو تجربة تطوعية لتظهر هنا.</div>';
  }

  function renderChallenges() {
    $('challengeHistory').innerHTML = state.challenges.length ? state.challenges.map((challenge) => `<article class="sp-item"><div><h3>تحدي أساسيات أمن الويب · ${challenge.score}/3</h3><p>${escapeHtml(challenge.feedback.join(' · '))}</p></div></article>`).join('') : '';
  }

  function renderPrivacy() {
    $('publicToggle').checked = state.privacy.isPublic;
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
    if (!url) alert(`رابط ${label} غير صالح. استخدم رابطًا يبدأ بـ https:// أو http://`);
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
    if (!profile.name) return alert('الاسم المعروض مطلوب.');
    if (commit((next) => { next.profile = profile; })) alert('تم حفظ الملف في هذا المتصفح.');
  });

  $('skillForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = truncate($('skillName').value, 80);
    if (!name) return alert('اسم المهارة مطلوب.');
    const rawUrl = cleanText($('evidenceUrl').value);
    const evidenceUrl = readOptionalUrl(rawUrl, 'الدليل');
    if (rawUrl && !evidenceUrl) return;
    const skill = {
      id: makeId(), name,
      category: truncate($('skillCategory').value, 80) || 'أخرى',
      level: LEVELS.includes($('skillLevel').value) ? $('skillLevel').value : 'مبتدئ',
      evidenceType: EVIDENCE_TYPES.includes($('evidenceType').value) ? $('evidenceType').value : 'other',
      evidenceUrl,
      evidenceDesc: truncate($('evidenceDesc').value, 220),
      verified: false
    };
    if (commit((next) => { next.skills.unshift(skill); })) {
      event.currentTarget.reset();
      renderSkills();
    }
  });

  $('projectForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const title = truncate($('projectTitle').value, 100);
    const desc = truncate($('projectDesc').value, 500);
    if (!title || !desc) return alert('عنوان الإنجاز ووصفه مطلوبان.');
    const rawUrl = cleanText($('projectUrl').value);
    const url = readOptionalUrl(rawUrl, 'المشروع');
    if (rawUrl && !url) return;
    const project = {
      id: makeId(), title, type: truncate($('projectType').value, 60) || 'إنجاز آخر', desc, url
    };
    if (commit((next) => { next.projects.unshift(project); })) {
      event.currentTarget.reset();
      renderProjects();
    }
  });

  function editSkill(skill) {
    const name = prompt('اسم المهارة:', skill.name);
    if (name === null) return;
    const category = prompt('المجال:', skill.category);
    if (category === null) return;
    const level = prompt(`المستوى (${LEVELS.join('، ')}):`, skill.level);
    if (level === null) return;
    const evidenceType = prompt(`نوع الدليل (${EVIDENCE_TYPES.join(' / ')}):`, skill.evidenceType);
    if (evidenceType === null) return;
    const evidenceDesc = prompt('وصف الدليل (اتركه فارغًا للمسح):', skill.evidenceDesc);
    if (evidenceDesc === null) return;
    const rawUrl = prompt('رابط الدليل (اتركه فارغًا للمسح):', skill.evidenceUrl);
    if (rawUrl === null) return;
    const evidenceUrl = readOptionalUrl(rawUrl, 'الدليل');
    if (cleanText(rawUrl) && !evidenceUrl) return;
    if (!truncate(name, 80)) return alert('اسم المهارة مطلوب.');
    if (!LEVELS.includes(cleanText(level))) return alert('المستوى غير صالح. اختر مستوى من القائمة الموضحة.');
    if (!EVIDENCE_TYPES.includes(cleanText(evidenceType))) return alert('نوع الدليل غير صالح. اختر قيمة من القائمة الموضحة.');
    const updated = {
      name: truncate(name, 80), category: truncate(category, 80) || 'أخرى', level: cleanText(level),
      evidenceType: cleanText(evidenceType), evidenceDesc: truncate(evidenceDesc, 220), evidenceUrl
    };
    if (commit((next) => {
      const target = next.skills.find((item) => item.id === skill.id);
      if (!target) throw new Error('لم تعد المهارة موجودة. حدّث الصفحة وحاول مجددًا.');
      Object.assign(target, updated);
    })) renderSkills();
  }

  function editProject(project) {
    const title = prompt('عنوان المشروع أو الإنجاز:', project.title);
    if (title === null) return;
    const type = prompt('نوع الإنجاز:', project.type);
    if (type === null) return;
    const desc = prompt('الوصف:', project.desc);
    if (desc === null) return;
    const rawUrl = prompt('رابط المشروع (اتركه فارغًا للمسح):', project.url);
    if (rawUrl === null) return;
    const url = readOptionalUrl(rawUrl, 'المشروع');
    if (cleanText(rawUrl) && !url) return;
    if (!truncate(title, 100) || !truncate(desc, 500)) return alert('العنوان والوصف مطلوبان.');
    if (commit((next) => {
      const target = next.projects.find((item) => item.id === project.id);
      if (!target) throw new Error('لم يعد الإنجاز موجودًا. حدّث الصفحة وحاول مجددًا.');
      Object.assign(target, { title: truncate(title, 100), type: truncate(type, 60) || 'إنجاز آخر', desc: truncate(desc, 500), url });
    })) renderProjects();
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
      const skill = state.skills.find((item) => item.id === editSkillButton.dataset.editSkill);
      if (skill) editSkill(skill);
      return;
    }
    if (deleteSkillButton) {
      if (!confirm('حذف هذه المهارة؟')) return;
      const skillId = deleteSkillButton.dataset.deleteSkill;
      if (commit((next) => { next.skills = next.skills.filter((item) => item.id !== skillId); })) renderSkills();
      return;
    }
    if (editProjectButton) {
      const project = state.projects.find((item) => item.id === editProjectButton.dataset.editProject);
      if (project) editProject(project);
      return;
    }
    if (deleteProjectButton) {
      if (!confirm('حذف هذا الإنجاز؟')) return;
      const projectId = deleteProjectButton.dataset.deleteProject;
      if (commit((next) => { next.projects = next.projects.filter((item) => item.id !== projectId); })) renderProjects();
      return;
    }
    if (suggestionButton) {
      const name = suggestionButton.dataset.addSuggest;
      if (state.skills.some((skill) => skill.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        alert('هذه المهارة موجودة بالفعل.');
        return;
      }
      const skill = { id: makeId(), name: truncate(name, 80), category: 'أخرى', level: 'مبتدئ', evidenceType: 'other', evidenceUrl: '', evidenceDesc: 'اقتراح من محلل المهارات — راجعه وأضف دليلًا.', verified: false };
      if (commit((next) => { next.skills.unshift(skill); })) {
        renderSkills();
        alert('أضيفت كمهارة مدخلة ذاتيًا.');
      }
    }
  });

  $('challengeForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const answer = cleanText($('challengeAnswer').value).toLowerCase();
    const criteria = [
      { re: /prepared statement|parameterized|parameterised|استعلامات?\s*معلّمة|استعلامات?\s*مجهزة|استعلامات?\s*معلَمة/, label: 'استخدام الاستعلامات المعلّمة' },
      { re: /validate|validation|تحقق من المدخلات|التحقق من المدخلات|تنقية المدخلات/, label: 'التحقق من المدخلات' },
      { re: /least privilege|minimum privilege|أقل صلاحية|تقليل صلاحيات|صلاحيات محدودة/, label: 'تقليل صلاحيات قاعدة البيانات' }
    ];
    const matched = criteria.filter((criterion) => criterion.re.test(answer));
    const feedback = criteria.map((criterion) => `${matched.includes(criterion) ? '✓' : '○'} ${criterion.label}`);
    const score = matched.length;
    const challenge = { score, feedback, at: new Date().toISOString() };
    if (!commit((next) => {
      next.challenges.unshift(challenge);
      if (score >= 2) next.skills.filter((skill) => /sql|أمن الويب|web security|cybersecurity/i.test(skill.name)).forEach((skill) => { skill.verified = true; });
    })) return;
    renderChallenges();
    renderSkills();
    $('challengeResult').hidden = false;
    $('challengeResult').innerHTML = `<b>${score}/3</b><p>${score === 3 ? 'ممتاز! ذكرت معايير التقييم الثلاثة.' : score === 2 ? 'نتيجة جيدة. راجع المعيار المتبقي وحاول تحسين إجابتك.' : 'راجع المعايير الثلاثة وأعد المحاولة.'}</p><ul>${feedback.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><small>هذا تقييم آلي تجريبي قائم على كلمات مفتاحية، وليس شهادة احترافية أو تحققًا رسميًا.</small>`;
  });

  const ANALYSIS_RULES = [
    { name: 'أمن تطبيقات الويب', re: /owasp|xss|sql injection|حقن sql|ثغرات|web security|security scanner|أمن الويب/i, learn: 'تدرّب على OWASP Top 10 واختبر تطبيقًا محليًا ضمن بيئة مصرح بها.' },
    { name: 'تطوير الويب', re: /html|css|javascript|react|next\.?js|api|واجهة|موقع ويب|web app/i, learn: 'أنشئ مشروعًا صغيرًا موثقًا، وأضف اختبارات وتوثيقًا لطريقة التشغيل.' },
    { name: 'قواعد البيانات', re: /sql|database|قاعدة بيانات|mysql|sqlite|postgres/i, learn: 'تدرّب على تصميم الجداول والاستعلامات الآمنة والتحقق من المدخلات.' },
    { name: 'إدارة المشاريع', re: /team|teamwork|planning|خطة|فريق|إدارة|milestone|مهام/i, learn: 'وثّق دورك وخطة التنفيذ والنتائج، واطلب مراجعة من شخص عمل معك.' },
    { name: 'تحليل البيانات', re: /data|تحليل|excel|dashboard|بيانات|statistics|إحصاء/i, learn: 'اعرض خطوات التنظيف والتحليل والاستنتاجات في تقرير قابل لإعادة الإنتاج.' },
    { name: 'التصميم وتجربة المستخدم', re: /design|figma|ui|ux|تصميم|واجهة المستخدم|prototype/i, learn: 'أرفق نماذج قبل/بعد ووضح قرارات التصميم ونتائج اختبار الاستخدام.' },
    { name: 'التواصل والعمل الجماعي', re: /presentation|communication|تواصل|عرض تقديمي|فريق|collaborat/i, learn: 'أضف مثالًا على مساهمتك وملاحظات موثقة من زميل أو مشرف.' }
  ];

  $('analyzerForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const description = cleanText($('analyzerText').value);
    if (!description) return alert('اكتب وصف المشروع أولًا.');
    const found = ANALYSIS_RULES.filter((rule) => rule.re.test(description));
    const suggestions = found.length ? found : [{ name: 'حل المشكلات والتوثيق', learn: 'اكتب المشكلة التي حللتها، والخطوات التي اتبعتها، والنتيجة، ثم أضف رابطًا أو لقطة موثقة.' }];
    $('analysisResult').hidden = false;
    $('analysisResult').innerHTML = `<b>اقتراحات أولية — راجعها قبل إضافتها</b><ul>${suggestions.map((rule) => `<li><b>${escapeHtml(rule.name)}</b><br>${escapeHtml(rule.learn)} <button class="sp-mini" type="button" data-add-suggest="${escapeHtml(rule.name)}">أضف كمهارة</button></li>`).join('')}</ul><small>هذه اقتراحات قائمة على قواعد وكلمات مفتاحية؛ لا تثبت امتلاكك للمهارة.</small>`;
  });

  // Local preview must work regardless of the sharing toggle. It never publishes a public URL
  // and must never silently change a user's privacy preference.
  function preview() {
    const profile = state.profile;
    const profileLink = safeUrl(profile.profileLink);
    const privacyNotice = state.privacy.isPublic
      ? 'هذه معاينة محلية على هذا المتصفح فقط، وليست رابطًا عامًا.'
      : 'المشاركة غير مفعّلة. هذه معاينة خاصة على هذا المتصفح فقط ولا تنشر بياناتك.';

    const skillsHtml = state.skills.length ? state.skills.map((skill) => {
      const url = safeUrl(skill.evidenceUrl);
      return `<span class="sp-public-skill"><b>${escapeHtml(skill.name)}</b><small>${escapeHtml(skill.level)} · ${skill.verified ? 'اجتازت تحديًا تجريبيًا' : url || skill.evidenceDesc ? 'مدعومة بدليل' : 'مدخلة ذاتيًا'}</small>${state.privacy.showEvidence && url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">عرض الدليل ↗</a>` : ''}</span>`;
    }).join('') : '<div class="sp-empty">لا توجد مهارات معروضة.</div>';

    const projectsHtml = state.privacy.showProjects
      ? `<div class="sp-public-block"><h3>المشاريع والإنجازات</h3>${state.projects.length ? state.projects.map((project) => {
          const url = safeUrl(project.url);
          return `<article class="sp-item"><div><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.type)} · ${escapeHtml(project.desc)}</p>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">فتح الرابط ↗</a>` : ''}</div></article>`;
        }).join('') : '<div class="sp-empty">لا توجد إنجازات معروضة.</div>'}</div>`
      : '';

    const challengesHtml = state.challenges.length
      ? state.challenges.map((challenge) => `<p>تحدي أساسيات أمن الويب: ${challenge.score}/3 <small>(تقييم آلي تجريبي)</small></p>`).join('')
      : '<div class="sp-empty">لم تكتمل تحديات بعد.</div>';

    $('publicPreview').innerHTML = `<div class="sp-public-head"><span class="sp-kicker">SAEE SKILL PASSPORT · معاينة إنجازات</span><div class="sp-warning" role="status">${escapeHtml(privacyNotice)}</div><h2>${escapeHtml(profile.name || 'صاحب المهارات')}</h2><b>${escapeHtml(profile.headline || '')}</b><p>${escapeHtml(profile.bio || 'لم تتم إضافة نبذة بعد.')}</p>${profile.location ? `<small>${escapeHtml(profile.location)}</small>` : ''}${profileLink ? `<p><a href="${escapeHtml(profileLink)}" target="_blank" rel="noopener noreferrer">الرابط المهني ↗</a></p>` : ''}<small>المهارات ذاتية الإدخال ما لم يذكر خلاف ذلك.</small></div><div class="sp-public-block"><h3>المهارات</h3>${skillsHtml}</div>${projectsHtml}<div class="sp-public-block"><h3>التحديات العملية</h3>${challengesHtml}</div>`;
    const dialog = $('publicDialog');
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else if (!dialog.open) dialog.setAttribute('open', '');
  }

  $('shareBtn').addEventListener('click', preview);
  $('shareBtn2').addEventListener('click', preview);
  $('closeDialog').addEventListener('click', () => {
    const dialog = $('publicDialog');
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  });
  $('publicDialog').addEventListener('click', (event) => {
    if (event.target === $('publicDialog')) {
      const dialog = $('publicDialog');
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  });

  $('publicToggle').addEventListener('change', (event) => {
    if (!commit((next) => { next.privacy.isPublic = event.target.checked; })) renderPrivacy();
  });
  $('showProjects').addEventListener('change', (event) => {
    if (!commit((next) => { next.privacy.showProjects = event.target.checked; })) renderPrivacy();
  });
  $('showEvidence').addEventListener('change', (event) => {
    if (commit((next) => { next.privacy.showEvidence = event.target.checked; })) renderSkills();
    else renderPrivacy();
  });

  $('exportBtn').addEventListener('click', () => {
    let objectUrl = '';
    try {
      const blob = new Blob([JSON.stringify(normalizeState(state), null, 2)], { type: 'application/json' });
      objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = 'saee-skill-passport.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      console.error('Saee Skill Passport: export failed.', error);
      alert('تعذر تصدير البيانات. حاول مرة أخرى.');
    } finally {
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  });

  $('deletePassportBtn').addEventListener('click', () => {
    if (!confirm('هل تريد حذف جواز المهارات بالكامل من هذا المتصفح؟ سيتم حذف الملف الشخصي والمهارات والمشاريع ونتائج التحديات وإعدادات الجواز.')) return;
    if (!confirm('تأكيد أخير: لا يمكن التراجع عن حذف البيانات المحفوظة في هذا المتصفح. هل تريد المتابعة؟')) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      state = freshState();
      render();
      $('profileForm').reset();
      $('skillForm').reset();
      $('projectForm').reset();
      $('challengeForm').reset();
      $('analyzerForm').reset();
      $('challengeResult').hidden = true;
      $('analysisResult').hidden = true;
      alert('تم حذف بيانات جواز المهارات من هذا المتصفح. بقيت صفحة الجواز نفسها ضمن الموقع.');
    } catch (error) {
      console.error('Saee Skill Passport: delete failed.', error);
      alert('تعذر حذف بيانات الجواز. تحقق من إعدادات التخزين في المتصفح ثم حاول مرة أخرى.');
    }
  });

  render();
})();
