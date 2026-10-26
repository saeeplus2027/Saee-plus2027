import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/skill-passport.html'), 'utf8');
const code = fs.readFileSync(path.join(root, 'public/skill-passport.js'), 'utf8');
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);

class FakeElement {
  constructor(id = '') {
    this.id = id; this.value = ''; this.checked = false; this.hidden = false;
    this.textContent = ''; this.innerHTML = ''; this.style = {}; this.listeners = {};
    this.dataset = {}; this.open = false; this.attributes = {}; this.disabled = false;
    this.download = ''; this.href = ''; this.clicked = false; this.files = [];
    this.classList = { toggle() {} };
  }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  async dispatch(type, event = {}) {
    event.preventDefault ||= () => {};
    event.currentTarget ||= this; event.target ||= this;
    for (const callback of this.listeners[type] || []) await callback(event);
  }
  querySelectorAll() { return []; }
  reset() { this.value = ''; this.checked = false; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  setAttribute(key, value) { this.attributes[key] = value; if (key === 'open') this.open = true; }
  removeAttribute(key) { delete this.attributes[key]; if (key === 'open') this.open = false; }
  appendChild(child) { return child; }
  remove() { this.removed = true; }
  click() { this.clicked = true; }
  closest(selector) { return this.closestMap?.[selector] || null; }
  scrollIntoView() {}
}

const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
const documentListeners = {};
const windowListeners = {};
const removedKeys = [];
const localStorage = { removeItem(key) { removedKeys.push(key); }, getItem() { throw new Error('read prohibited'); }, setItem() { throw new Error('write prohibited'); } };
const document = {
  getElementById: (id) => elements[id] || null,
  addEventListener: (type, cb) => { (documentListeners[type] ||= []).push(cb); },
  createElement: (tag) => new FakeElement(tag),
  body: new FakeElement('body'),
};
const window = { addEventListener: (type, cb) => { (windowListeners[type] ||= []).push(cb); } };
let currentServerState = { profile: { name: '', headline: '', bio: '', location: '', profileLink: '' }, skills: [], projects: [], challenges: [], privacy: { isPublic: false, showProjects: true, showEvidence: true } };
let serverVersion = 0;
let failNextPutStatus = 0;
const alerts = [];
const confirms = [];
function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body };
}
async function fetchMock(url, options = {}) {
  assert.equal(url, '/api/skill-passport');
  if (options.method === 'GET') return response({ user: { displayName: 'Student A', email: 'a@example.com' }, version: serverVersion, updatedAt: null, state: currentServerState });
  if (options.method === 'PUT') {
    if (failNextPutStatus) { const status = failNextPutStatus; failNextPutStatus = 0; return response({ error: 'simulated save failure' }, status); }
    const expected = Number(String(options.headers['If-Match']).replaceAll('"', ''));
    if (expected !== serverVersion) return response({ error: 'stale version' }, 409);
    currentServerState = JSON.parse(options.body).state;
    serverVersion += 1;
    return response({ ok: true, version: serverVersion, updatedAt: new Date().toISOString() });
  }
  if (options.method === 'DELETE') { currentServerState = { profile: { name: '', headline: '', bio: '', location: '', profileLink: '' }, skills: [], projects: [], challenges: [], privacy: { isPublic: false, showProjects: true, showEvidence: true } }; serverVersion = 0; return response({ ok: true }); }
  throw new Error(`unexpected request ${options.method}`);
}

const urlMock = Object.assign(URL, { createObjectURL: () => 'blob:recovery-test', revokeObjectURL() {} });
const context = {
  document, window, localStorage, URL: urlMock, Blob, Headers, fetch: fetchMock,
  console: { log() {}, warn() {}, error() {} }, Element: FakeElement,
  alert: (message) => alerts.push(message), confirm: (message) => { confirms.push(message); return true; },
  prompt: () => null, setTimeout: (fn) => 0, Date, Math, JSON, Array, Object, String, Number, RegExp,
  globalThis: null,
};
context.globalThis = context;
vm.runInNewContext(code, context, { filename: 'skill-passport.js' });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const tests = [];
async function test(name, fn) { await fn(); tests.push(name); process.stdout.write(`PASS ${name}\n`); }

await tick();
assert.equal(elements.heroName.textContent, 'صاحب المهارات');
assert.match(elements.passportAuthStatus.textContent, /Student A/);
assert.ok(removedKeys.includes('saee-skill-passport-demo-v1'));

await test('profile is saved through the server endpoint with the server revision', async () => {
  elements.name.value = 'Student A';
  elements.headline.value = 'Cybersecurity';
  await elements.profileForm.dispatch('submit');
  await tick(); await tick();
  assert.equal(currentServerState.profile.name, 'Student A');
  assert.equal(serverVersion, 1);
  assert.match(elements.passportSaveStatus.textContent, /تم الحفظ على الخادم/);
});

await test('save failure offers a recovery export and warns before leaving', async () => {
  failNextPutStatus = 503;
  elements.bio.value = 'Pending draft must not be silently discarded';
  await elements.profileForm.dispatch('submit');
  await tick(); await tick();
  assert.equal(elements.downloadUnsavedBtn.hidden, false);
  assert.equal(elements.retrySaveBtn.hidden, false);
  let warned = false;
  for (const listener of windowListeners.beforeunload || []) listener({ preventDefault() { warned = true; }, returnValue: undefined });
  assert.equal(warned, true);
  await elements.downloadUnsavedBtn.dispatch('click');
  assert.match(confirms.at(-1), /نسخة إنقاذ/);
});

await test('transient server save failure can be retried without browser storage', async () => {
  await elements.retrySaveBtn.dispatch('click');
  await tick(); await tick();
  assert.equal(currentServerState.profile.bio, 'Pending draft must not be silently discarded');
  assert.equal(serverVersion, 2);
  assert.equal(elements.downloadUnsavedBtn.hidden, true);
  assert.match(elements.passportSaveStatus.textContent, /تم الحفظ على الخادم/);
});

await test('pagehide clears private visible state and the prior identity label', async () => {
  for (const listener of windowListeners.pagehide || []) listener();
  assert.equal(elements.heroName.textContent, 'صاحب المهارات');
  assert.doesNotMatch(elements.passportAuthStatus.textContent, /Student A|a@example.com/);
  assert.equal(elements.profileForm.querySelectorAll('input').length, 0);
});

assert.equal(/localStorage\.(?:getItem|setItem)\s*\(|sessionStorage/.test(code), false);
assert.equal(tests.length, 4);
process.stdout.write(`\n${tests.length + 1} client checks passed (including no browser-side passport persistence).\n`);
