const LEVELS = new Set(['مبتدئ', 'متوسط', 'متقدم', 'خبير']);
const EVIDENCE_TYPES = new Set(['github', 'portfolio', 'certificate', 'file', 'challenge', 'other']);
const MAX_SKILLS = 100;
const MAX_PROJECTS = 100;
const MAX_CHALLENGES = 50;

export function freshSkillPassport() {
  return {
    profile: { name: '', headline: '', bio: '', location: '', profileLink: '' },
    skills: [],
    projects: [],
    challenges: [],
    privacy: { isPublic: false, showProjects: true, showEvidence: true },
  };
}

function text(value, max, label, required = false) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw new Error(`${label}: expected text`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${label}: maximum length is ${max}`);
  if (required && !result) throw new Error(`${label}: required`);
  return result;
}

function safeUrl(value, label) {
  const raw = text(value, 500, label);
  if (!raw) return '';
  let url;
  try { url = new URL(raw); } catch { throw new Error(`${label}: invalid URL`); }
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error(`${label}: only HTTP(S) links without credentials are allowed`);
  }
  return url.href;
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: invalid object`);
  return value;
}

function list(value, label, max) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${label}: expected a list`);
  if (value.length > max) throw new Error(`${label}: maximum ${max} items`);
  return value;
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeSkillPassport(input) {
  const value = object(input, 'passport');
  const profile = object(value.profile ?? {}, 'profile');
  const privacy = object(value.privacy ?? {}, 'privacy');

  const skills = list(value.skills, 'skills', MAX_SKILLS).map((raw, index) => {
    const item = object(raw, `skills[${index}]`);
    const level = text(item.level || 'مبتدئ', 20, 'skill.level');
    const evidenceType = text(item.evidenceType || 'other', 20, 'skill.evidenceType');
    if (!LEVELS.has(level)) throw new Error(`skills[${index}].level: invalid value`);
    if (!EVIDENCE_TYPES.has(evidenceType)) throw new Error(`skills[${index}].evidenceType: invalid value`);
    return {
      id: text(item.id || makeId(), 100, 'skill.id', true),
      name: text(item.name, 80, 'skill.name', true),
      category: text(item.category || 'أخرى', 80, 'skill.category'),
      level,
      evidenceType,
      evidenceUrl: safeUrl(item.evidenceUrl, 'skill.evidenceUrl'),
      evidenceDesc: text(item.evidenceDesc, 220, 'skill.evidenceDesc'),
      // A browser-submitted value can never confer verification.
      verified: false,
    };
  });
  const skillIds = new Set();
  for (const skill of skills) {
    if (skillIds.has(skill.id)) throw new Error('Skill IDs must be unique');
    skillIds.add(skill.id);
  }

  const projects = list(value.projects, 'projects', MAX_PROJECTS).map((raw, index) => {
    const item = object(raw, `projects[${index}]`);
    return {
      id: text(item.id || makeId(), 100, 'project.id', true),
      title: text(item.title, 100, 'project.title', true),
      type: text(item.type || 'إنجاز آخر', 60, 'project.type'),
      desc: text(item.desc, 500, 'project.desc', true),
      url: safeUrl(item.url, 'project.url'),
    };
  });
  const projectIds = new Set();
  for (const project of projects) {
    if (projectIds.has(project.id)) throw new Error('Project IDs must be unique');
    projectIds.add(project.id);
  }

  const challenges = list(value.challenges, 'challenges', MAX_CHALLENGES).map((raw, index) => {
    const item = object(raw, `challenges[${index}]`);
    const rawScore = Number(item.score);
    const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(3, Math.round(rawScore))) : 0;
    const feedback = list(item.feedback, `challenges[${index}].feedback`, 3).map((entry) => text(entry, 180, 'challenge.feedback'));
    return { score, feedback, at: text(item.at, 60, 'challenge.at') };
  });

  return {
    profile: {
      name: text(profile.name, 80, 'profile.name'),
      headline: text(profile.headline, 100, 'profile.headline'),
      bio: text(profile.bio, 500, 'profile.bio'),
      location: text(profile.location, 100, 'profile.location'),
      profileLink: safeUrl(profile.profileLink, 'profile.profileLink'),
    },
    skills,
    projects,
    challenges,
    // There is no public-share endpoint yet, so never persist public status.
    privacy: {
      isPublic: false,
      showProjects: typeof privacy.showProjects === 'boolean' ? privacy.showProjects : true,
      showEvidence: typeof privacy.showEvidence === 'boolean' ? privacy.showEvidence : true,
    },
  };
}
