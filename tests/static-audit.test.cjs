const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('normalize zachowuje cyfry, wielkie litery i normalizuje polskie znaki', () => {
  const context = { window: {} };
  vm.runInNewContext(read('katalog-techniczny.js'), context, { filename: 'katalog-techniczny.js' });
  const catalog = context.window.NAPRAWNIK_KATALOG;
  assert.equal(catalog.normalize('139QMA'), '139qma');
  assert.equal(catalog.normalize('Yamaha'), 'yamaha');
  assert.equal(catalog.normalize('future'), 'future');
  assert.equal(catalog.normalize('50'), '50');
  assert.equal(catalog.normalize('Śruba'), 'sruba');
  assert.ok(catalog.search('Aerox YQ50').length > 0);
});

test('wartości zaworów Beverly nie są prezentowane jako dane Derbi Senda 125', () => {
  const context = { window: {} };
  vm.runInNewContext(read('katalog-techniczny.js'), context, { filename: 'katalog-techniczny.js' });
  const records = context.window.NAPRAWNIK_KATALOG.records.filter(record =>
    record['Rodzina'] === 'Derbi' &&
    record['Model / kod silnika'] === 'Senda 125 4T' &&
    ['Luz zaworu ssącego', 'Luz zaworu wydechowego'].includes(record['Parametr'])
  );
  assert.equal(records.length, 2);
  for (const record of records) {
    assert.match(record['Status weryfikacji'], /Niepotwierdzone/);
    assert.match(record['Wartość'], /Niepotwierdzone — nie stosować/);
    assert.equal(record['Źródło (URL)'], '');
    assert.doesNotMatch(record['Wartość'], /0,10|0,15/);
  }
});

test('index nie zawiera starego checkoutu ani starego endpointu licencji', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /\bLICENSE_ENDPOINT\b|\bSTRIPE_PRO\b|\bSTRIPE_WARSZTAT\b/);
  assert.doesNotMatch(html, /\blicBoot\s*\(\s*\)\s*;/);
  assert.match(html, /<script src="\.\/billing\.js\?v=2"><\/script>/);
  assert.match(html, /function licGet\(\)\{return getVerifiedLicense\(\);\}/);
  assert.match(html, /function hasPlan\(min\)\{return Object\.prototype\.hasOwnProperty\.call\(PLAN_ORDER,min\)&&PLAN_ORDER\[curPlan\(\)\]>=PLAN_ORDER\[min\];\}/);
});

test('billing korzysta z planu zweryfikowanego w pamięci i pojedynczego Checkout', () => {
  const billing = read('billing.js');
  assert.match(billing, /function applyVerifiedPlan\(state\)/);
  assert.match(billing, /Object\.defineProperty\(window, 'naprawnikGetVerifiedLicense'/);
  assert.doesNotMatch(billing, /window\.naprawnikApplyVerifiedLicense|window\.naprawnikClearVerifiedLicense/);
  assert.match(billing, /Idempotency-Key/);
  assert.match(billing, /checkout\.stripe\.com/);
  assert.equal((billing.match(/async function checkout\(tier, interval\)/g) || []).length, 1);
  assert.doesNotMatch(billing, /9 zł\/mies\.|29 zł\/mies\.|100 zł\/rok|300 zł\/rok/);
  assert.match(billing, /Czy utworzyć NOWE konto\?/);
  assert.match(billing, /Nie utworzono nowego konta/);
});

test('sam spreparowany localStorage nie oznacza aktywnej licencji w widoku planów', () => {
  const store = new Map();
  const rootElement = { innerHTML: '' };
  const context = {
    window: {},
    document: { addEventListener() {}, querySelector(selector) { return selector === '#screen' ? rootElement : null; } },
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { store.set(key, String(value)); },
      removeItem(key) { store.delete(key); }
    },
    fetch: async () => ({ ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) }),
    URL, URLSearchParams,
    location: { search: '', pathname: '/' },
    history: { replaceState() {} },
    alert() {}, confirm() { return false; }, console, Date, Math, JSON, setTimeout
  };
  context.window = context;
  context.naprawnikClearVerifiedLicense = () => {};
  vm.runInNewContext(read('billing.js'), context, { filename: 'billing.js' });
  store.set('naprawnik_api_token', 'fake-token');
  store.set('naprawnik_license', JSON.stringify({ tier: 'warsztat', exp: Date.now() + 100000000, token: 'fake-token' }));
  context.renderPlans();
  assert.doesNotMatch(rootElement.innerHTML, /WARSZTAT — Twój plan/);
  assert.match(rootElement.innerHTML, /Wybieram PRO/);
});

test('odrzucony token nie powoduje cichej rejestracji nowego konta', async () => {
  const store = new Map();
  const calls = [];
  const alerts = [];
  const confirms = [];
  const rootElement = { innerHTML: '' };
  const context = {
    window: {},
    document: { addEventListener() {}, querySelector(selector) { return selector === '#screen' ? rootElement : null; } },
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { store.set(key, String(value)); },
      removeItem(key) { store.delete(key); }
    },
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      return { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) };
    },
    URL, URLSearchParams,
    location: { search: '', pathname: '/' },
    history: { replaceState() {} },
    alert(message) { alerts.push(String(message)); },
    confirm(message) { confirms.push(String(message)); return false; },
    console, Date, Math, JSON, setTimeout
  };
  context.window = context;
  context.naprawnikClearVerifiedLicense = () => {};
  vm.runInNewContext(read('billing.js'), context, { filename: 'billing.js' });
  store.set('naprawnik_api_token', 'expired-token');
  await context.npStartCheckout('pro', 'month');
  assert.ok(calls.some(call => call.url.endsWith('/api/me')));
  assert.equal(calls.filter(call => call.url.endsWith('/api/register')).length, 0);
  assert.equal(confirms.length, 1);
  assert.ok(alerts.some(message => message.includes('Nie utworzono nowego konta')));
});
