(() => {
  'use strict';

  const KEY = 'saee-skill-passport-demo-v1';
  const $ = (id) => document.getElementById(id);
  const text = (value) => String(value ?? '').trim();
  const id = () => (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  const fresh = () => ({
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

  const asString = (value, max = 3000) =>
    typeof value === 'string' ? value.slice(0, max) : '';

  function safeUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return ['http:', 'https:'].includes(url.protocol)
        ? url.href
        : '';
    } catch {
      return '';
    }
  }

  const normalizeState = (value) => {
    const base = fresh();

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return base;
    }

    const p =
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

    const normalizeItems = (list, kind) =>
      Array.isArray(list)
        ? list
            .filter(
              (item) =>
                item &&
                typeof item === 'object' &&
                !Array.isArray(item)
            )
            .slice(0, 1000)
            .map((item) => {
              if (kind === 'skill') {
                return {
                  id: asString(item.id, 100) || id(),
                  name: asString(item.name, 80),
                  category: asString(item.category, 80),
                  level: asString(item.level, 40),
                  evidenceType: asString(item.evidenceType, 40),
                  evidenceUrl: safeUrl(asString(item.evidenceUrl, 500)),
                  evidenceDesc: asString(item.evidenceDesc, 220),
                  verified: item.verified === true
                };
              }

              if (kind === 'project') {
                return {
                  id: asString(item.id, 100) || id(),
                  title: asString(item.title, 100),
                  type: asString(item.type, 60),
                  desc: asString(item.desc, 500),
                  url: safeUrl(asString(item.url, 500))
                };
              }

              return {
                score: Math.max(
                  0,
                  Math.min(
                    3,
                    Number.isFinite(Number(item.score))
                      ? Number(item.score)
                      : 0
                  )
                ),
                feedback: Array.isArray(item.feedback)
                  ? item.feedback
                      .slice(0, 3)
                      .map((entry) => asString(entry, 180))
                  : [],
                at: asString(item.at, 60)
              };
            })
        : [];

    return {
      profile: {
        name: asString(p.name, 80),
        headline: asString(p.headline, 100),
        bio: asString(p.bio, 500),
        location: asString(p.location, 100),
        profileLink: safeUrl(asString(p.profileLink, 300))
      },

      skills: normalizeItems(value.skills, 'skill')
        .filter((item) => item.name),

      projects: normalizeItems(value.projects, 'project')
        .filter((item) => item.title),

      challenges: normalizeItems(value.challenges, 'challenge'),

      privacy: {
        isPublic:
          typeof privacy.isPublic === 'boolean'
            ? privacy.isPublic
            : base.privacy.isPublic,

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
  };

  function readState() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? normalizeState(JSON.parse(raw)) : fresh();
    } catch {
      return fresh();
    }
  }

  let state = readState();

  // تفعيل معاينة المشاركة مرة واحدة للبيانات الموجودة مسبقًا.
  // لا ينشئ هذا الخيار رابطًا عامًا على الإنترنت.
  const SHARE_MIGRATION_KEY =
    `${KEY}-share-preview-enabled-v2`;

  try {
    if (localStorage.getItem(SHARE_MIGRATION_KEY) !== '1') {
      state.privacy.isPublic = true;

      localStorage.setItem(KEY, JSON.stringify(state));
      localStorage.setItem(SHARE_MIGRATION_KEY, '1');
    }
  } catch {
    // تستمر الصفحة بالعمل إذا كان التخزين المحلي محظورًا.
  }

  const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);

  // حفظ نسخة جديدة قبل اعتماد التغييرات في الحالة الحالية.
  function commit(mutator) {
    try {
      const next = normalizeState(state);

      mutator(next);

      const normalized = normalizeState(next);

      localStorage.setItem(
        KEY,
        JSON.stringify(normalized)
      );

      state = normalized;

      renderSummary();

      return true;
    } catch (error) {
      console.error(
        'Saee Skill Passport: save failed.',
        error
      );

      alert(
        'تعذر حفظ التعديل في المتصفح. ' +
        'لم يتم اعتماد التغيير؛ تحقق من مساحة التخزين ثم حاول مرة أخرى.'
      );

      return false;
    }
  }

  const evidenceLabel = {
    github: 'مشروع GitHub',
    portfolio: 'نموذج أعمال',
    certificate: 'شهادة أو دورة',
    file: 'ملف أو تقرير',
    challenge: 'نتيجة تحدٍ',
    other: 'رابط آخر'
  };

  function renderSummary() {
    $('heroName').textContent =
      state.profile.name || 'صاحب المهارات';

    $('heroHeadline').textContent =
      state.profile.headline || 'أضف نبذة تعريفية قصيرة عنك';

    $('statSkills').textContent = state.skills.length;

    $('statEvidence').textContent =
      state.skills.filter(
        (skill) => skill.evidenceUrl || skill.evidenceDesc
      ).length;

    $('statChallenges').textContent =
      state.challenges.filter(
        (challenge) => challenge.score >= 2
      ).length;

    const count =
      (state.profile.name ? 1 : 0) +
      (state.profile.headline ? 1 : 0) +
      (state.profile.bio ? 1 : 0) +
      (state.skills.length ? 1 : 0) +
      (state.projects.length ? 1 : 0);

    const pct = Math.round((count / 5) * 100);

    $('completionBar').style.width = `${pct}%`;

    $('completionText').textContent =
      `اكتمال الملف التجريبي: ${pct}%`;
  }

  function renderSkills() {
    $('skillsList').innerHTML = state.skills.length
      ? state.skills.map((skill) => {
          const url = safeUrl(skill.evidenceUrl);

          return `
            <article class="sp-item">
              <div>
                <h3>
                  ${esc(skill.name)}
                  <span class="sp-chip">
                    ${esc(skill.level)}
                  </span>
                </h3>

                <p>
                  ${esc(skill.category)} ·
                  ${
                    url || skill.evidenceDesc
                      ? 'مدعومة بدليل'
                      : 'مدخلة ذاتيًا'
                  }
                  ${
                    skill.verified
                      ? ' · اجتازت تحديًا عمليًا'
                      : ''
                  }
                </p>

                ${
                  skill.evidenceDesc
                    ? `<p>${esc(skill.evidenceDesc)}</p>`
                    : ''
                }

                ${
                  state.privacy.showEvidence && url
                    ? `
                      <p>
                        <a
                          href="${esc(url)}"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          ${esc(
                            evidenceLabel[skill.evidenceType] ||
                            'فتح الدليل'
                          )}
                          ↗
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
                  data-edit-skill="${esc(skill.id)}"
                >
                  تعديل
                </button>

                <button
                  class="sp-mini"
                  type="button"
                  data-delete-skill="${esc(skill.id)}"
                >
                  حذف
                </button>
              </div>
            </article>
          `;
        }).join('')
      : `
        <div class="sp-empty">
          لم تضف مهارات بعد.
          ابدأ بمهارة تستطيع دعمها بمثال عملي.
        </div>
      `;
  }

  function renderProjects() {
    $('projectsList').innerHTML = state.projects.length
      ? state.projects.map((project) => {
          const url = safeUrl(project.url);

          return `
            <article class="sp-item">
              <div>
                <h3>
                  ${esc(project.title)}
                  <span class="sp-chip">
                    ${esc(project.type)}
                  </span>
                </h3>

                <p>${esc(project.desc)}</p>

                ${
                  url
                    ? `
                      <p>
                        <a
                          href="${esc(url)}"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          فتح الرابط ↗
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
                  data-edit-project="${esc(project.id)}"
                >
                  تعديل
                </button>

                <button
                  class="sp-mini"
                  type="button"
                  data-delete-project="${esc(project.id)}"
                >
                  حذف
                </button>
              </div>
            </article>
          `;
        }).join('')
      : `
        <div class="sp-empty">
          أضف مشروعًا أو شهادة أو تجربة تطوعية لتظهر هنا.
        </div>
      `;
  }

  function renderChallenges() {
    $('challengeHistory').innerHTML =
      state.challenges.length
        ? state.challenges.map((challenge) => `
            <article class="sp-item">
              <div>
                <h3>
                  تحدي أساسيات أمن الويب ·
                  ${challenge.score}/3
                </h3>

                <p>
                  ${esc(challenge.feedback.join(' · '))}
                </p>
              </div>
            </article>
          `).join('')
        : '';
  }

  function renderPrivacy() {
    $('publicToggle').checked =
      state.privacy.isPublic;

    $('showProjects').checked =
      state.privacy.showProjects;

    $('showEvidence').checked =
      state.privacy.showEvidence;
  }

  function render() {
    [
      'name',
      'headline',
      'bio',
      'location',
      'profileLink'
    ].forEach((field) => {
      $(field).value = state.profile[field] || '';
    });

    renderSummary();
    renderSkills();
    renderProjects();
    renderChallenges();
    renderPrivacy();
  }

  function validOptionalUrl(raw, label) {
    const value = text(raw);

    if (!value) {
      return '';
    }

    const url = safeUrl(value);

    if (!url) {
      alert(
        `رابط ${label} غير صالح. ` +
        'استخدم رابطًا يبدأ بـ https:// أو http://'
      );
    }

    return url;
  }

  $('profileForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const rawLink = text($('profileLink').value);

    const profileLink = validOptionalUrl(
      rawLink,
      'الملف الشخصي'
    );

    if (rawLink && !profileLink) {
      return;
    }

    const profile = {
      name: text($('name').value),
      headline: text($('headline').value),
      bio: text($('bio').value),
      location: text($('location').value),
      profileLink
    };

    if (!profile.name) {
      alert('الاسم المعروض مطلوب.');
      return;
    }

    if (
      commit((next) => {
        next.profile = profile;
      })
    ) {
      alert('تم حفظ الملف في هذا المتصفح.');
    }
  });

  $('skillForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const name = text($('skillName').value);

    if (!name) {
      alert('اسم المهارة مطلوب.');
      return;
    }

    const rawUrl = text($('evidenceUrl').value);

    const evidenceUrl = validOptionalUrl(
      rawUrl,
      'الدليل'
    );

    if (rawUrl && !evidenceUrl) {
      return;
    }

    const skill = {
      id: id(),
      name,
      category: $('skillCategory').value,
      level: $('skillLevel').value,
      evidenceType: $('evidenceType').value,
      evidenceUrl,
      evidenceDesc: text($('evidenceDesc').value),
      verified: false
    };

    if (
      commit((next) => {
        next.skills.unshift(skill);
      })
    ) {
      event.currentTarget.reset();
      renderSkills();
    }
  });

  $('projectForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const title = text($('projectTitle').value);
    const desc = text($('projectDesc').value);

    if (!title || !desc) {
      alert('عنوان الإنجاز ووصفه مطلوبان.');
      return;
    }

    const rawUrl = text($('projectUrl').value);

    const url = validOptionalUrl(
      rawUrl,
      'المشروع'
    );

    if (rawUrl && !url) {
      return;
    }

    const project = {
      id: id(),
      title,
      type: $('projectType').value,
      desc,
      url
    };

    if (
      commit((next) => {
        next.projects.unshift(project);
      })
    ) {
      event.currentTarget.reset();
      renderProjects();
    }
  });

  function editSkill(skill) {
    const name = prompt(
      'اسم المهارة:',
      skill.name
    );

    if (name === null) return;

    const category = prompt(
      'المجال:',
      skill.category
    );

    if (category === null) return;

    const level = prompt(
      'المستوى:',
      skill.level
    );

    if (level === null) return;

    const evidenceType = prompt(
      'نوع الدليل (github / portfolio / certificate / file / challenge / other):',
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

    const evidenceUrl = validOptionalUrl(
      rawUrl,
      'الدليل'
    );

    if (text(rawUrl) && !evidenceUrl) {
      return;
    }

    const allowedEvidenceTypes = [
      'github',
      'portfolio',
      'certificate',
      'file',
      'challenge',
      'other'
    ];

    if (!text(name)) {
      alert('اسم المهارة مطلوب.');
      return;
    }

    if (!allowedEvidenceTypes.includes(text(evidenceType))) {
      alert('نوع الدليل غير صالح. استخدم إحدى القيم الموضحة.');
      return;
    }

    const updated = {
      name: text(name).slice(0, 80),
      category: text(category).slice(0, 80),
      level: text(level).slice(0, 40),
      evidenceType: text(evidenceType),
      evidenceDesc: text(evidenceDesc).slice(0, 220),
      evidenceUrl
    };

    if (
      commit((next) => {
        const item = next.skills.find(
          (entry) => entry.id === skill.id
        );

        if (!item) {
          throw new Error(
            'لم تعد المهارة موجودة. حدّث الصفحة وحاول مجددًا.'
          );
        }

        Object.assign(item, updated);
      })
    ) {
      renderSkills();
    }
  }

  function editProject(project) {
    const title = prompt(
      'عنوان المشروع أو الإنجاز:',
      project.title
    );

    if (title === null) return;

    const type = prompt(
      'نوع الإنجاز:',
      project.type
    );

    if (type === null) return;

    const desc = prompt(
      'الوصف:',
      project.desc
    );

    if (desc === null) return;

    const rawUrl = prompt(
      'رابط المشروع (اتركه فارغًا للمسح):',
      project.url
    );

    if (rawUrl === null) return;

    const url = validOptionalUrl(
      rawUrl,
      'المشروع'
    );

    if (text(rawUrl) && !url) {
      return;
    }

    if (!text(title) || !text(desc)) {
      alert('العنوان والوصف مطلوبان.');
      return;
    }

    const updated = {
      title: text(title).slice(0, 100),
      type: text(type).slice(0, 60),
      desc: text(desc).slice(0, 500),
      url
    };

    if (
      commit((next) => {
        const item = next.projects.find(
          (entry) => entry.id === project.id
        );

        if (!item) {
          throw new Error(
            'لم يعد الإنجاز موجودًا. حدّث الصفحة وحاول مجددًا.'
          );
        }

        Object.assign(item, updated);
      })
    ) {
      renderProjects();
    }
  }

  document.addEventListener('click', (event) => {
    const editSkillButton =
      event.target.closest('[data-edit-skill]');

    const deleteSkillButton =
      event.target.closest('[data-delete-skill]');

    const editProjectButton =
      event.target.closest('[data-edit-project]');

    const deleteProjectButton =
      event.target.closest('[data-delete-project]');

    if (editSkillButton) {
      const skill = state.skills.find(
        (item) =>
          item.id === editSkillButton.dataset.editSkill
      );

      if (skill) {
        editSkill(skill);
      }

      return;
    }

    if (
      deleteSkillButton &&
      confirm('حذف هذه المهارة؟')
    ) {
      const skillId =
        deleteSkillButton.dataset.deleteSkill;

      if (
        commit((next) => {
          next.skills = next.skills.filter(
            (item) => item.id !== skillId
          );
        })
      ) {
        renderSkills();
      }

      return;
    }

    if (editProjectButton) {
      const project = state.projects.find(
        (item) =>
          item.id === editProjectButton.dataset.editProject
      );

      if (project) {
        editProject(project);
      }

      return;
    }

    if (
      deleteProjectButton &&
      confirm('حذف هذا الإنجاز؟')
    ) {
      const projectId =
        deleteProjectButton.dataset.deleteProject;

      if (
        commit((next) => {
          next.projects = next.projects.filter(
            (item) => item.id !== projectId
          );
        })
      ) {
        renderProjects();
      }

      return;
    }
  });

  $('challengeForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const answer =
      text($('challengeAnswer').value).toLowerCase();

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
      (item) => item.re.test(answer)
    );

    const feedback = criteria.map(
      (item) =>
        `${matched.includes(item) ? '✓' : '○'} ${item.label}`
    );

    const score = matched.length;

    if (
      !commit((next) => {
        next.challenges.unshift({
          score,
          feedback,
          at: new Date().toISOString()
        });

        if (score >= 2) {
          next.skills
            .filter((skill) =>
              /sql|أمن الويب|web security|cybersecurity/i.test(
                skill.name
              )
            )
            .forEach((skill) => {
              skill.verified = true;
            });
        }
      })
    ) {
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
        ${feedback.map((item) => `<li>${esc(item)}</li>`).join('')}
      </ul>

      <small>
        هذا تقييم آلي تجريبي قائم على كلمات مفتاحية،
        وليس شهادة احترافية أو تحققًا رسميًا.
      </small>
    `;
  });

  const rules = [
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

    const description =
      text($('analyzerText').value);

    if (!description) {
      return;
    }

    const found = rules.filter(
      (rule) => rule.re.test(description)
    );

    const suggestions = found.length
      ? found
      : [
          {
            name: 'حل المشكلات والتوثيق',
            learn:
              'اكتب المشكلة التي حللتها، والخطوات التي اتبعتها، ' +
              'والنتيجة، ثم أضف رابطًا أو لقطة موثقة.'
          }
        ];

    $('analysisResult').hidden = false;

    $('analysisResult').innerHTML = `
      <b>اقتراحات أولية — راجعها قبل إضافتها</b>

      <ul>
        ${
          suggestions.map((rule) => `
            <li>
              <b>${esc(rule.name)}</b><br>
              ${esc(rule.learn)}

              <button
                class="sp-mini"
                type="button"
                data-add-suggest="${esc(rule.name)}"
              >
                أضف كمهارة
              </button>
            </li>
          `).join('')
        }
      </ul>

      <small>
        هذه اقتراحات قائمة على قواعد وكلمات مفتاحية؛
        لا تثبت امتلاكك للمهارة.
      </small>
    `;
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-add-suggest]');

    if (!button) {
      return;
    }

    const name = button.dataset.addSuggest;

    if (
      state.skills.some(
        (skill) =>
          skill.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      alert('هذه المهارة موجودة بالفعل.');
      return;
    }

    const suggestedSkill = {
      id: id(),
      name,
      category: 'أخرى',
      level: 'مبتدئ',
      evidenceType: 'other',
      evidenceUrl: '',
      evidenceDesc:
        'اقتراح من محلل المهارات — راجعه وأضف دليلًا.',
      verified: false
    };

    if (
      commit((next) => {
        next.skills.unshift(suggestedSkill);
      })
    ) {
      renderSkills();
      alert('أضيفت كمهارة مدخلة ذاتيًا.');
    }
  });

  // إصلاح معاينة المشاركة:
  // إذا كان الخيار معطلًا، نفعّله ونحفظه تلقائيًا
  // قبل فتح المعاينة بدل إظهار رسالة تمنع المستخدم.
  function preview() {
    if (!state.privacy.isPublic) {
      const enabled = commit((next) => {
        next.privacy.isPublic = true;
      });

      if (!enabled) {
        return;
      }

      renderPrivacy();
    }

    const profile = state.profile;
    const profileLink = safeUrl(profile.profileLink);

    $('publicPreview').innerHTML = `
      <div class="sp-public-head">
        <span class="sp-kicker">
          SAEE SKILL PASSPORT · معاينة مشاركة
        </span>

        <h2>${esc(profile.name || 'صاحب المهارات')}</h2>

        <b>${esc(profile.headline || '')}</b>

        <p>
          ${esc(profile.bio || 'لم تتم إضافة نبذة بعد.')}
        </p>

        ${
          profile.location
            ? `<small>${esc(profile.location)}</small>`
            : ''
        }

        ${
          profileLink
            ? `
              <p>
                <a
                  href="${esc(profileLink)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  الرابط المهني ↗
                </a>
              </p>
            `
            : ''
        }

        <small>
          المعاينة محلية على هذا المتصفح فقط؛ ليست رابطًا عامًا.
          المهارات ذاتية الإدخال ما لم يذكر خلاف ذلك.
        </small>
      </div>

      <div class="sp-public-block">
        <h3>المهارات</h3>

        ${
          state.skills.length
            ? state.skills.map((skill) => {
                const url = safeUrl(skill.evidenceUrl);

                return `
                  <span class="sp-public-skill">
                    <b>${esc(skill.name)}</b>

                    <small>
                      ${esc(skill.level)} ·
                      ${
                        skill.verified
                          ? 'اجتازت تحديًا تجريبيًا'
                          : url || skill.evidenceDesc
                            ? 'مدعومة بدليل'
                            : 'مدخلة ذاتيًا'
                      }
                    </small>

                    ${
                      state.privacy.showEvidence && url
                        ? `
                          <a
                            href="${esc(url)}"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            عرض الدليل ↗
                          </a>
                        `
                        : ''
                    }
                  </span>
                `;
              }).join('')
            : '<div class="sp-empty">لا توجد مهارات معروضة.</div>'
        }
      </div>

      ${
        state.privacy.showProjects
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
                            <h3>${esc(project.title)}</h3>

                            <p>
                              ${esc(project.type)} ·
                              ${esc(project.desc)}
                            </p>

                            ${
                              url
                                ? `
                                  <a
                                    href="${esc(url)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    فتح الرابط ↗
                                  </a>
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
          : ''
      }

      <div class="sp-public-block">
        <h3>التحديات العملية</h3>

        ${
          state.challenges.length
            ? state.challenges.map((challenge) => `
                <p>
                  تحدي أساسيات أمن الويب:
                  ${challenge.score}/3
                  <small>(تقييم آلي تجريبي)</small>
                </p>
              `).join('')
            : '<div class="sp-empty">لم تكتمل تحديات بعد.</div>'
        }
      </div>
    `;

    const dialog = $('publicDialog');

    if (!dialog.open) {
      dialog.showModal();
    }
  }

  $('shareBtn').addEventListener('click', preview);
  $('shareBtn2').addEventListener('click', preview);

  $('closeDialog').addEventListener(
    'click',
    () => $('publicDialog').close()
  );

  $('publicDialog').addEventListener('click', (event) => {
    if (event.target === $('publicDialog')) {
      $('publicDialog').close();
    }
  });

  $('publicToggle').addEventListener('change', (event) => {
    if (
      commit((next) => {
        next.privacy.isPublic = event.target.checked;
      })
    ) {
      renderPrivacy();
    } else {
      renderPrivacy();
    }
  });

  $('showProjects').addEventListener('change', (event) => {
    if (
      !commit((next) => {
        next.privacy.showProjects = event.target.checked;
      })
    ) {
      renderPrivacy();
    }
  });

  $('showEvidence').addEventListener('change', (event) => {
    if (
      commit((next) => {
        next.privacy.showEvidence = event.target.checked;
      })
    ) {
      renderSkills();
    } else {
      renderPrivacy();
    }
  });

  $('exportBtn').addEventListener('click', () => {
    try {
      const blob = new Blob(
        [JSON.stringify(normalizeState(state), null, 2)],
        { type: 'application/json' }
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');

      anchor.href = url;
      anchor.download = 'saee-skill-passport.json';

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      alert('تعذر تصدير البيانات. حاول مرة أخرى.');
    }
  });

  $('deletePassportBtn').addEventListener('click', () => {
    const first = confirm(
      'هل تريد حذف جواز المهارات بالكامل من هذا المتصفح؟ ' +
      'سيتم حذف الملف الشخصي والمهارات والمشاريع ونتائج التحديات وإعدادات الجواز.'
    );

    if (!first) {
      return;
    }

    const second = confirm(
      'تأكيد أخير: الحذف نهائي للبيانات المحفوظة في هذا المتصفح، ' +
      'ولا يمكن التراجع عنه. هل تريد المتابعة؟'
    );

    if (!second) {
      return;
    }

    try {
      localStorage.removeItem(KEY);

      // يمنع إعادة تفعيل المشاركة تلقائيًا بعد حذف الجواز.
      try {
        localStorage.setItem(SHARE_MIGRATION_KEY, '1');
      } catch {
        // قد يمنع المتصفح التخزين.
      }

      state = fresh();
      state.privacy.isPublic = false;

      render();

      $('skillForm').reset();
      $('projectForm').reset();
      $('challengeForm').reset();
      $('analyzerForm').reset();

      $('challengeResult').hidden = true;
      $('analysisResult').hidden = true;

      alert(
        'تم حذف بيانات جواز المهارات من هذا المتصفح. ' +
        'بقيت صفحة جواز المهارات نفسها ضمن الموقع.'
      );
    } catch (error) {
      console.error(
        'Saee Skill Passport: delete failed.',
        error
      );

      alert(
        'تعذر حذف بيانات الجواز من المتصفح. ' +
        'تحقق من إعدادات التخزين ثم حاول مرة أخرى.'
      );
    }
  });

  render();
})();
