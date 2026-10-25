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
  assert.match(html, /<script src="\.\/billing\.js\?v=8"><\/script>/);
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

test('host stagingowy korzysta wyłącznie z testowego Workera', async () => {
  const calls = [];
  let redirected = '';
  const store = new Map();
  const location = { hostname: 'naprawnik-pwa-staging.turbodiesel966.workers.dev', search: '', pathname: '/', assign(url) { redirected = String(url); } };
  const context = {
    window: {},
    document: { addEventListener() {}, querySelector(selector) { return selector === '#screen' ? { innerHTML: '' } : null; } },
    localStorage: { getItem(key) { return store.has(key) ? store.get(key) : null; }, setItem(key, value) { store.set(key, String(value)); }, removeItem(key) { store.delete(key); } },
    fetch: async (url, options) => {
      const value = String(url); calls.push({ url: value, options });
      if (value.endsWith('/api/register')) return { ok: true, status: 201, json: async () => ({ token: 't'.repeat(64) }) };
      if (value.endsWith('/api/checkout')) return { ok: true, status: 200, json: async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_test_123' }) };
      return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) };
    },
    URL, URLSearchParams, location, history: { replaceState() {} },
    alert() {}, confirm() { return true; }, console, Date, Math, JSON, setTimeout
  };
  context.window = context;
  vm.runInNewContext(read('billing.js'), context, { filename: 'billing.js' });
  await context.npStartCheckout('pro', 'month');
  assert.ok(calls.length >= 2);
  assert.ok(calls.every(call => call.url.startsWith('https://naprawnik-subscriptions-v2-staging.turbodiesel966.workers.dev/')));
  assert.ok(calls.some(call => call.url.endsWith('/api/checkout')));
  assert.equal(redirected, 'https://checkout.stripe.com/c/pay/cs_test_123');
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
    location: { hostname: 'turbodiesel966-eng.github.io', search: '', pathname: '/' },
    history: { replaceState() {} },
    alert(message) { alerts.push(String(message)); },
    confirm(message) { confirms.push(String(message)); return false; },
    console, Date, Math, JSON, setTimeout
  };
  context.window = context;
  vm.runInNewContext(read('billing.js'), context, { filename: 'billing.js' });
  store.set('naprawnik_api_token', 'expired-token');
  await context.npStartCheckout('pro', 'month');
  assert.ok(calls.some(call => call.url.endsWith('/api/me')));
  assert.equal(calls.filter(call => call.url.endsWith('/api/register')).length, 0);
  assert.equal(confirms.length, 1);
  assert.ok(alerts.some(message => message.includes('Nie utworzono nowego konta')));
});

test('wylogowanie usuwa też aktywny plan PRO z pamięci bieżącej strony', async () => {
  const store = new Map();
  const rootElement = { innerHTML: '' };
  const input = { value: 'valid-test-token' };
  const nowSeconds = Math.floor(Date.now() / 1000);
  const context = {
    window: {},
    document: {
      addEventListener() {},
      querySelector(selector) {
        if (selector === '#screen') return rootElement;
        if (selector === '#licKeyIn') return input;
        return null;
      }
    },
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { store.set(key, String(value)); },
      removeItem(key) { store.delete(key); }
    },
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        user: { id: 'user-1', tier: 'pro' },
        subscriptions: [{ tier: 'pro', status: 'active', current_period_end: nowSeconds + 3600, grace_until: null }]
      })
    }),
    URL, URLSearchParams,
    location: { hostname: 'turbodiesel966-eng.github.io', search: '', pathname: '/' },
    history: { replaceState() {} },
    alert() {}, confirm() { return true; }, console, Date, Math, JSON, setTimeout
  };
  context.window = context;
  vm.runInNewContext(read('billing.js'), context, { filename: 'billing.js' });
  await context.licActivateInput();
  assert.equal(context.naprawnikGetVerifiedLicense()?.tier, 'pro');
  assert.ok(store.has('naprawnik_api_token'));
  context.licDeactivate();
  assert.equal(context.naprawnikGetVerifiedLicense(), null);
  assert.equal(store.has('naprawnik_api_token'), false);
  assert.equal(store.has('naprawnik_license'), false);
});


test('nie nadaje WARSZTAT, gdy aktywna subskrypcja serwera to tylko PRO', async () => {
  const store = new Map();
  const rootElement = { innerHTML: '' };
  const input = { value: 'test-token' };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const alerts = [];
  const context = {
    window: {},
    document: {
      addEventListener() {},
      querySelector(selector) {
        if (selector === '#screen') return rootElement;
        if (selector === '#licKeyIn') return input;
        return null;
      }
    },
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { store.set(key, String(value)); },
      removeItem(key) { store.delete(key); }
    },
    fetch: async () => ({
      ok: true, status: 200,
      json: async () => ({
        user: { id: 'user-1', tier: 'warsztat' },
        subscriptions: [{ tier: 'pro', status: 'active', current_period_end: expires }]
      })
    }),
    URL, URLSearchParams,
    location: { hostname: 'turbodiesel966-eng.github.io', search: '', pathname: '/' },
    history: { replaceState() {} },
    alert(message) { alerts.push(String(message)); }, confirm() { return true; },
    console, Date, Math, JSON, setTimeout
  };
  context.window = context;
  vm.runInNewContext(read('billing.js'), context, { filename: 'billing.js' });
  await context.licActivateInput();
  assert.equal(context.naprawnikGetVerifiedLicense(), null);
  assert.equal(store.has('naprawnik_license'), false);
});

test('opłacony plan wyświetla portal zamiast drugiego Checkout', async () => {
  const store = new Map();
  const rootElement = { innerHTML: '' };
  const input = { value: 'test-token' };
  const now = Math.floor(Date.now() / 1000);
  const context = {
    window: {},
    document: {
      addEventListener() {},
      querySelector(selector) {
        if (selector === '#screen') return rootElement;
        if (selector === '#licKeyIn') return input;
        return null;
      },
      getElementById() { return null; }
    },
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { store.set(key, String(value)); },
      removeItem(key) { store.delete(key); }
    },
    fetch: async () => ({
      ok: true, status: 200,
      json: async () => ({
        user: { id: 'user-1', tier: 'pro' },
        subscriptions: [{ tier: 'pro', status: 'active', current_period_end: now + 3600 }]
      })
    }),
    URL, URLSearchParams,
    location: { hostname: 'turbodiesel966-eng.github.io', search: '', pathname: '/' },
    history: { replaceState() {} },
    alert() {}, confirm() { return true; }, console, Date, Math, JSON, setTimeout
  };
  context.window = context;
  vm.runInNewContext(read('billing.js'), context, { filename: 'billing.js' });
  await context.licActivateInput();
  context.renderPlans();
  assert.equal(context.naprawnikGetVerifiedLicense()?.tier, 'pro');
  assert.match(rootElement.innerHTML, /data-np-portal="1"/);
  assert.match(rootElement.innerHTML, /Otwórz panel Stripe/);
  assert.doesNotMatch(rootElement.innerHTML, /data-plan="warsztat"/);
});
test('ważność WARSZTAT jest liczona z WARSZTAT, a nie z dłuższego PRO', async () => {
  const store = new Map();
  const rootElement = { innerHTML: '' };
  const input = { value: 'test-token' };
  const now = Math.floor(Date.now() / 1000);
  const workshopEnd = now + 600;
  const proEnd = now + 30 * 24 * 60 * 60;
  const context = {
    window: {},
    document: {
      addEventListener() {},
      querySelector(selector) {
        if (selector === '#screen') return rootElement;
        if (selector === '#licKeyIn') return input;
        return null;
      }
    },
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { store.set(key, String(value)); },
      removeItem(key) { store.delete(key); }
    },
    fetch: async () => ({
      ok: true, status: 200,
      json: async () => ({
        user: { id: 'user-1', tier: 'warsztat' },
        subscriptions: [
          { tier: 'warsztat', status: 'active', current_period_end: workshopEnd },
          { tier: 'pro', status: 'active', current_period_end: proEnd }
        ]
      })
    }),
    URL, URLSearchParams,
    location: { hostname: 'turbodiesel966-eng.github.io', search: '', pathname: '/' },
    history: { replaceState() {} },
    alert() {}, confirm() { return true; }, console, Date, Math, JSON, setTimeout
  };
  context.window = context;
  vm.runInNewContext(read('billing.js'), context, { filename: 'billing.js' });
  await context.licActivateInput();
  assert.equal(context.naprawnikGetVerifiedLicense()?.tier, 'warsztat');
  assert.equal(context.naprawnikGetVerifiedLicense()?.exp, workshopEnd * 1000);
});

test('podgląd/nieznana domena nie wysyła płatności do Workera Live', async () => {
  const calls = [];
  const alerts = [];
  const context = {
    window: {},
    document: { addEventListener() {}, querySelector(selector) { return selector === '#screen' ? { innerHTML: '' } : null; } },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    fetch: async url => { calls.push(String(url)); return { ok: false, status: 500, json: async () => ({}) }; },
    URL, URLSearchParams,
    location: { hostname: 'preview-branch.example.net', search: '', pathname: '/' },
    history: { replaceState() {} },
    alert(message) { alerts.push(String(message)); }, confirm() { return true; },
    console, Date, Math, JSON, setTimeout
  };
  context.window = context;
  vm.runInNewContext(read('billing.js'), context, { filename: 'billing.js' });
  await context.npStartCheckout('pro', 'month');
  assert.equal(calls.length, 0);
  assert.ok(alerts.some(message => message.includes('wyłączone dla tej domeny')));
});


test('błędy Workera są pokazywane po polsku, bez wyświetlania surowego komunikatu angielskiego', async () => {
  const store = new Map();
  const calls = [];
  const alerts = [];
  const context = {
    window: {},
    document: { addEventListener() {}, querySelector(selector) { return selector === '#screen' ? { innerHTML: '' } : null; } },
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { store.set(key, String(value)); },
      removeItem(key) { store.delete(key); }
    },
    fetch: async (url) => {
      const target = String(url);
      calls.push(target);
      if (target.endsWith('/api/register')) return { ok: true, status: 201, json: async () => ({ token: 't'.repeat(64) }) };
      if (target.endsWith('/api/checkout')) return { ok: false, status: 503, json: async () => ({ error: 'Production service is not enabled' }) };
      return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) };
    },
    URL, URLSearchParams,
    location: { hostname: 'turbodiesel966-eng.github.io', search: '', pathname: '/' },
    history: { replaceState() {} },
    alert(message) { alerts.push(String(message)); }, confirm() { return true; },
    console, Date, Math, JSON, setTimeout
  };
  context.window = context;
  vm.runInNewContext(read('billing.js'), context, { filename: 'billing.js' });
  await context.npStartCheckout('pro', 'month');
  assert.ok(calls.some(url => url.endsWith('/api/register')));
  assert.ok(calls.some(url => url.endsWith('/api/checkout')));
  assert.ok(alerts.some(message => message.includes('Płatności są chwilowo niedostępne')));
  assert.ok(alerts.every(message => !message.includes('Production service is not enabled')));
});


test('analiza zdjęć używa endpointu Workera z tokenem Bearer, a nie starej funkcji Netlify', () => {
  const html = read('index.html');
  const billing = read('billing.js');
  const worker = read('workers/subscriptions/src/index.mjs');
  assert.ok(!html.includes('PA_AI_ENDPOINT'));
  assert.ok(!html.includes('X-License-Token'));
  assert.ok(!html.includes('/.netlify/functions/photo-diagnosis'));
  assert.ok(html.includes('window.npPhotoDiagnosis(fd,{signal:ctl.signal})'));
  assert.ok(billing.includes('window.npPhotoDiagnosis = async function(formData, options)'));
  assert.ok(billing.includes("Authorization: 'Bearer ' + license.token"));
  assert.ok(worker.includes('url.pathname === "/api/photo-diagnosis"'));
  assert.ok(worker.includes('userHasTier(env, auth.userId, "pro")'));
  assert.ok(worker.includes('if (!env.OPENAI_API_KEY)'));
});
