import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeSkillPassport, freshSkillPassport } from '../lib/skill-passport-validation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

const valid = () => ({
  profile: { name: 'Student', headline: 'Cybersecurity', bio: 'Project portfolio', location: 'Jordan', profileLink: 'https://example.com/profile' },
  skills: [{ id: 's1', name: 'Web Security', category: 'Technology', level: 'متقدم', evidenceType: 'github', evidenceUrl: 'https://github.com/example/project', evidenceDesc: 'Test project', verified: true }],
  projects: [{ id: 'p1', title: 'Scanner', type: 'مشروع', desc: 'Scanner description', url: 'https://example.com/scanner' }],
  challenges: [{ score: 3, feedback: ['criterion 1'], at: '2026-10-26T10:00:00.000Z' }],
  privacy: { isPublic: true, showProjects: false, showEvidence: true },
});

test('fresh passport has no public sharing by default', () => {
  assert.equal(freshSkillPassport().privacy.isPublic, false);
});

test('server strips public flag and untrusted verification claims', () => {
  const state = normalizeSkillPassport(valid());
  assert.equal(state.privacy.isPublic, false);
  assert.equal(state.skills[0].verified, false);
});

test('allowed HTTP and HTTPS evidence links survive normalization', () => {
  const state = normalizeSkillPassport(valid());
  assert.match(state.skills[0].evidenceUrl, /^https:\/\//);
  assert.equal(state.profile.profileLink, 'https://example.com/profile');
});

test('javascript and data URL schemes are rejected', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd']) {
    const input = valid(); input.skills[0].evidenceUrl = url;
    assert.throws(() => normalizeSkillPassport(input), /HTTP\(S\)|invalid URL/i);
  }
});

test('links containing embedded credentials are rejected', () => {
  const input = valid(); input.projects[0].url = 'https://user:password@example.com/private';
  assert.throws(() => normalizeSkillPassport(input), /credentials/i);
});

test('overlong fields are rejected instead of silently truncated on server', () => {
  const input = valid(); input.profile.bio = 'x'.repeat(501);
  assert.throws(() => normalizeSkillPassport(input), /maximum length/i);
});

test('oversized skill and project lists are rejected', () => {
  const skills = valid(); skills.skills = Array.from({ length: 101 }, (_, i) => ({ id: `s${i}`, name: `Skill ${i}` }));
  assert.throws(() => normalizeSkillPassport(skills), /maximum 100 items/i);
  const projects = valid(); projects.projects = Array.from({ length: 101 }, (_, i) => ({ id: `p${i}`, title: `Project ${i}`, desc: 'x' }));
  assert.throws(() => normalizeSkillPassport(projects), /maximum 100 items/i);
});

test('duplicate skill and project IDs are rejected', () => {
  const input = valid(); input.skills.push({ ...input.skills[0], name: 'Duplicate ID' });
  assert.throws(() => normalizeSkillPassport(input), /IDs must be unique/i);
});

test('only allow-listed values are returned', () => {
  const input = valid(); input.admin = true; input.skills[0].password = 'do not retain'; input.profile.privateNote = 'secret';
  const state = normalizeSkillPassport(input);
  assert.equal(Object.hasOwn(state, 'admin'), false);
  assert.equal(Object.hasOwn(state.skills[0], 'password'), false);
  assert.equal(Object.hasOwn(state.profile, 'privateNote'), false);
});

test('client does not read/write passport data in browser storage; legacy key removal is allowed', () => {
  const script = fs.readFileSync(path.join(root, 'public/skill-passport.js'), 'utf8');
  assert.equal(/localStorage\.(?:getItem|setItem)\s*\(|sessionStorage/.test(script), false);
  assert.match(script, /localStorage\.removeItem\('saee-skill-passport-demo-v1'\)/);
  assert.match(script, /fetch\(API_ENDPOINT/);
});

test('HTML contains auth status controls and disables public sharing', () => {
  const html = fs.readFileSync(path.join(root, 'public/skill-passport.html'), 'utf8');
  assert.match(html, /id="passportAuthStatus"/);
  assert.match(html, /id="passportSaveStatus"/);
  assert.match(html, /id="publicToggle" disabled/);
});

test('server API is disabled unless the host explicitly trusts its injected identity headers', () => {
  const route = fs.readFileSync(path.join(root, 'app/api/skill-passport/route.ts'), 'utf8');
  assert.match(route, /SAEE_AUTH_HEADERS_TRUSTED === 'true'/);
  assert.match(route, /trustedIdentityHeadersEnabled\(\)/);
  assert.equal((route.match(/if \(!trustedIdentityHeadersEnabled\(\)\)/g) || []).length, 3);
  assert.match(route, /identityConfigurationError/);
  assert.match(route, /getChatGPTUser\(\)/);
  assert.match(route, /const userId = typeof user\.userId/);
  assert.doesNotMatch(route, /body\.userId|body\.ownerId|input\.userId|input\.ownerId/);
  assert.match(route, /WHERE user_id = \?/);
  assert.match(route, /If-Match|if-match/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.match(route, /sameOrigin\(request\)/);
  assert.match(route, /MAX_BODY_BYTES/);
});

test('client preserves an in-memory draft after non-auth save errors and warns before leaving', () => {
  const script = fs.readFileSync(path.join(root, 'public/skill-passport.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public/skill-passport.html'), 'utf8');
  assert.match(script, /beforeunload/);
  assert.match(script, /downloadUnsavedBtn/);
  assert.match(script, /retrySaveBtn/);
  assert.match(script, /localRevision !== savedRevision/);
  assert.match(html, /id="downloadUnsavedBtn"/);
  assert.match(html, /id="retrySaveBtn"/);
});

test('legacy local data is not deleted on an API deployment error (404/503)', () => {
  const script = fs.readFileSync(path.join(root, 'public/skill-passport.js'), 'utf8');
  assert.match(script, /response.status === 401 \|\| \(response.ok && result.user && Number.isInteger\(Number\(result.version\)\)\)/);
  assert.doesNotMatch(script, /isApiJson && response.status !== 404/);
});


test('all JavaScript element references exist in the HTML, with no duplicate IDs', () => {
  const script = fs.readFileSync(path.join(root, 'public/skill-passport.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public/skill-passport.html'), 'utf8');
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
  const unique = new Set(ids);
  const refs = [...new Set([...script.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map((match) => match[1]))];
  assert.equal(unique.size, ids.length, 'HTML contains duplicate IDs');
  assert.deepEqual(refs.filter((id) => !unique.has(id)), []);
});

process.stdout.write(`\n${passed} security-focused checks passed.\n`);
