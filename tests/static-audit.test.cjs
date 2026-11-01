const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('baza wiedzy zawiera co najmniej 70 unikalnych kart, w tym wszystkie 20 nowych przypadków', () => {
  const html = read('index.html');
  const caseBlock = html.split('const knowledgeCases = [')[1].split('const KNOW_LINKS={')[0];
  const ids = Array.from(caseBlock.matchAll(/\{\s*["']?id["']?\s*:\s*["']([^"']+)["']/g), match => match[1]);
  assert.ok(ids.length >= 95, 'Oczekiwano co najmniej 95 kart, znaleziono ' + ids.length);
  assert.equal(new Set(ids).size, ids.length, 'ID kart diagnostycznych muszą być unikalne');
  for (const id of [
    'charging-no-rise', 'charging-overvoltage', 'starter-clicks', 'starter-spins-no-crank',
    'carb-fuel-overflow', 'fuel-starvation-high-rpm', 'idle-hangs-two-stroke', 'two-stroke-overheat',
    'four-stroke-hard-start-valves', 'lights-intermittent', 'spark-intermittent-bumps',
    'rear-wheel-binding', 'brake-overheating', 'coolant-overheating', 'oil-leak-crankcase',
    'fuel-smell-leak', 'efi-idle-surge', 'engine-noise-sudden', 'compression-low', 'engine-dies-after-wash', 'auto-choke-ptc-fault', 'vacuum-petcock-diaphragm', 'cvk-diaphragm-tear', 'torque-driver-grooves', 'cvt-clutch-bearing-noise', 'final-drive-seal-leak', 'crankcase-breather-oil', 'timing-chain-tensioner-4t', 'burnt-exhaust-valve-4t', 'exhaust-clogged-carbon-2t', 'reed-valve-petals-2t', 'crankshaft-bearings-play', 'flywheel-woodruff-key', 'ignition-switch-short-rain', 'sidestand-switch-cutout', 'ballast-resistor-ac-lights', 'seized-variator-rear-spline', 'speedometer-drive-vss', 'warped-brake-disc-pulsing', 'gearbox-oil-emulsion', 'decompressor-4t-hot-crank', 'kickstarter-ratchet-jam', 'oil-pump-2t-air-bubble', 'lean-angle-sensor-no-start', 'flasher-relay-led-hyperflash'
  ]) {
    assert.ok(ids.includes(id), 'Brak nowej karty diagnostycznej: ' + id);
  }
});


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
  assert.ok(html.includes('<title>NAPRAWNIK v5.18 — diagnostyka i naprawy</title>'));
  assert.ok(html.includes('⚙️ NAPRAWNIK v5.18'));
  assert.ok(html.includes("const APP_VERSION = 'NAPRAWNIK v5.18';"));
  assert.ok(html.includes('<script src="./billing.js?v=17"></script>'));
  assert.ok(!html.includes("allegro.pl/listing"));
  assert.doesNotMatch(html, /helion\.pl\/viewc|ebookpoint\.pl\/viewc|Materiały i literatura techniczna/);
  assert.ok(html.includes('https://webep1.com/go/37a852f559'), 'Brak aktywnego linku afiliacyjnego Motolak');
  assert.ok(html.includes('Lakiery i zaprawki samochodowe'));
  assert.ok(html.includes('Link afiliacyjny WebePartners'));
  assert.ok(html.includes('rel="noopener noreferrer sponsored"'));
  assert.ok(!html.includes("allegro.pl/listing"));
  assert.match(html, /function licGet\(\)\{return getVerifiedLicense\(\);\}/);
  assert.match(html, /function hasPlan\(min\)\{return Object\.prototype\.hasOwnProperty\.call\(PLAN_ORDER,min\)&&PLAN_ORDER\[curPlan\(\)\]>=PLAN_ORDER\[min\];\}/);
});

test('billing korzysta z planu zweryfikowanego w pamięci i pojedynczego Checkout', () => {
  const billing = read('billing.js');
  assert.match(billing, /function applyVerifiedPlan\(state\)/);
  assert.match(billing, /14,99 zł \/ miesiąc/);
  assert.match(billing, /149,99 zł \/ rok \(oszczędzasz 29,89 zł\)/);
  assert.match(billing, /29 zł \/ miesiąc/);
  assert.match(billing, /300 zł \/ rok \(oszczędzasz 48 zł\)/);
  assert.match(billing, /Object\.defineProperty\(window, 'naprawnikGetVerifiedLicense'/);
  assert.doesNotMatch(billing, /window\.naprawnikApplyVerifiedLicense|window\.naprawnikClearVerifiedLicense/);
  assert.match(billing, /Idempotency-Key/);
  assert.match(billing, /checkout\.stripe\.com/);
  assert.equal((billing.match(/async function checkout\(tier, interval\)/g) || []).length, 1);
  assert.match(billing, /Serwer zgłasza istniejącą albo nieopłaconą subskrypcję/);
  assert.match(billing, /Masz otwartą sesję Stripe dla innego planu/);
  assert.match(billing, /Konflikt płatności \(HTTP 409\)/);
  assert.doesNotMatch(billing, /14,99 zł\/mies\.|29 zł\/mies\.|149,99 zł\/rok|300 zł\/rok/);
  assert.match(billing, /Czy utworzyć NOWE konto\?/);
  assert.match(billing, /Nie utworzono nowego konta/);
  assert.match(billing, /const oneTimePackages =/);
  assert.ok(billing.includes("activation + card('amator') + card('pro') + card('warsztat') + oneTimePackages +"));
  assert.match(billing, /tier: 'pro', days: 3, price: '3,00 zł'/);
  assert.match(billing, /tier: 'pro', days: 7, price: '7,00 zł'/);
  assert.match(billing, /tier: 'warsztat', days: 3, price: '5,00 zł'/);
  assert.match(billing, /tier: 'warsztat', days: 7, price: '10,00 zł'/);
  assert.match(billing, /data-one-time-tier/);
  assert.match(billing, /analiza zdjęć AI jest chwilowo wyłączona/i);
  assert.doesNotMatch(billing, /PRO dodaje analizę AI/);
  assert.ok(billing.includes('.filter(offer => ORDER[current] < ORDER[offer.tier])'));

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
  assert.doesNotMatch(rootElement.innerHTML, /data-one-time-tier="pro"/);
  assert.match(rootElement.innerHTML, /data-one-time-tier="warsztat"/);
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


test('strona pobierania linkuje właściwy raport VirusTotal i uczciwie opisuje statusy skanu', () => {
  const script = read('scripts/prepare-download-release.py');
  assert.ok(script.includes('1e41d72e135366db7f92d282e9f9be90194a1b30b7a267bb2a65fe1ffa1894dd'));
  assert.ok(script.includes('https://www.virustotal.com/gui/file/'));
  assert.ok(script.includes('Timeout'));
  assert.ok(script.includes('Unable to process file type'));
  assert.ok(script.includes('--require-existing-checksum'));
  assert.ok(script.includes('NAPRAWNIK_VT_NOTE_START'));
});

test('siatka kafelków neonowych i filtrowanie kart diagnostycznych obsługują wielkość liter, polskie znaki oraz czyszczenie pola', () => {
  const html = read('index.html');
  assert.ok(html.includes('class="neon-grid"'));
  assert.ok(html.includes('class="tile-visual"'));
  assert.ok(html.includes('class="tile-tier-pill"'));
  assert.ok(html.includes('function normalizeSearchText(str)'));
  assert.ok(html.includes('function filterDiagnosticCards(query, containerSelector)'));

  const inlineScript = html.split('<script>')[1].split('</script>')[0];
  const mockCards = [
    {
      title: 'Gaśnie po rozgrzaniu / traci moc na ciepło',
      desc: 'Cewka WN, fajka lub świeca przerywa po nagrzaniu; sprawdź luz zaworowy i układ paliwowy.',
      dataset: { category: 'Rozruch i zapłon', evidence: 'unlinked', search: '' },
      style: { display: '' }
    },
    {
      title: 'Akumulator się rozładowuje / brak ładowania',
      desc: 'Sprawdź regulator napięcia, uzwojenia statora oraz przewód masowy.',
      dataset: { category: 'Elektryka i ładowanie', evidence: 'confirmed', search: '' },
      style: { display: '' }
    },
    {
      title: 'Drgania, hałas lub szarpanie przy ruszaniu',
      desc: 'Zeszkliwione okładziny sprzęgła, zużyty pasek CVT lub łożyska wału.',
      dataset: { category: 'CVT i napęd', evidence: 'partial', search: '' },
      style: { display: '' }
    }
  ].map(c => ({
    ...c,
    textContent: c.title + ' ' + c.desc,
    innerText: c.title + ' ' + c.desc,
    querySelector(sel) {
      if (sel.includes('h2') || sel.includes('.tile-label')) return { textContent: c.title };
      return { textContent: c.desc };
    }
  }));

  const filterInput = { value: '' };
  const categorySelect = { value: '' };
  const evidenceSelect = { value: '' };
  const countEl = { textContent: '' };
  const domContext = {
    window: {},
    navigator: {},
    location: { protocol: 'https:', hostname: 'localhost', search: '', pathname: '/' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: {
      querySelector(sel) {
        if (sel === '#screen' || sel === '.frame' || sel === '#lockScreen' || sel === '#clock') return { style: {}, innerHTML: '', textContent: '', querySelectorAll() { return []; } };
        if (sel === '#symptomQuery') return filterInput;
        return null;
      },
      querySelectorAll(sel) {
        if (sel.includes('#knowledgeCards')) return mockCards;
        if (sel.includes('.knowledge-case-card')) return mockCards;
        return [];
      },
      getElementById(id) {
        if (id === 'knowledgeFilter') return filterInput;
        if (id === 'knowledgeCategory') return categorySelect;
        if (id === 'knowledgeEvidence') return evidenceSelect;
        if (id === 'knowledgeCount') return countEl;
        return null;
      },
      addEventListener() {}
    },
    console, Date, Math, JSON, Set, Map, Array, Object, String, Number, RegExp, Promise,
    encodeURIComponent, setTimeout() {}, clearTimeout() {}
  };
  domContext.window = domContext;
  vm.runInNewContext(inlineScript, domContext, { filename: 'index-inline.js' });

  filterInput.value = 'GASNIE';
  domContext.filterKnowledge();
  assert.equal(mockCards[0].style.display, '');
  assert.equal(mockCards[1].style.display, 'none');
  assert.equal(mockCards[2].style.display, 'none');

  filterInput.value = 'Ladowania';
  domContext.filterKnowledge();
  assert.equal(mockCards[0].style.display, 'none');
  assert.equal(mockCards[1].style.display, '');
  assert.equal(mockCards[2].style.display, 'none');

  filterInput.value = 'sprzegla';
  domContext.filterKnowledge();
  assert.equal(mockCards[0].style.display, 'none');
  assert.equal(mockCards[1].style.display, 'none');
  assert.equal(mockCards[2].style.display, '');

  filterInput.value = 'WAŁU';
  domContext.filterKnowledge();
  assert.equal(mockCards[2].style.display, '');

  filterInput.value = '';
  domContext.filterKnowledge();
  assert.equal(mockCards[0].style.display, '');
  assert.equal(mockCards[1].style.display, '');
  assert.equal(mockCards[2].style.display, '');
});

test('APK korzysta z tych samych plików źródłowych co wersja Web i posiada synchronizację OTA na żywo', () => {
  const prep = read('scripts/prepare-mobile.mjs');
  const bridge = read('scripts/native-bridge.js');
  const verify = read('scripts/verify-apk.py');

  assert.ok(prep.includes('"neon-tiles-art.jpg"'));
  assert.ok(prep.includes("const WEB_LIVE_BASE='https://turbodiesel966-eng.github.io/Aktualizacja-17.10'"));
  assert.ok(prep.includes('function instrumentNativeHtml(html)'));
  assert.ok(bridge.includes('https://turbodiesel966-eng.github.io/Aktualizacja-17.10'));
  assert.ok(bridge.includes('window.__naprawnikWebSync = syncWithLiveWeb'));
  assert.ok(verify.includes('assets/public/assets/neon-tiles-art.jpg'));
});


test('konto właściciela / ADMINA otrzymuje automatycznie pełny dostęp WARSZTAT + PRO oraz przełącznik widoku abonamentu', async () => {
  const store = new Map();
  const rootElement = { innerHTML: '' };
  const input = { value: 'owner-admin-token' };
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
      ok: true,
      status: 200,
      json: async () => ({
        user: { id: 'owner-1', tier: 'amator', role: 'admin' },
        subscriptions: []
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
  const verified = context.naprawnikGetVerifiedLicense();
  assert.ok(verified, 'Właściciel musi mieć aktywną zweryfikowaną licencję nawet bez subskrypcji Stripe');
  assert.equal(verified.tier, 'warsztat');
  assert.equal(verified.isAdmin, true);

  context.npSetAdminPreviewTier('pro');
  assert.equal(context.naprawnikGetVerifiedLicense()?.tier, 'pro');

  context.npSetAdminPreviewTier('amator');
  assert.equal(context.naprawnikGetVerifiedLicense(), null);

  context.npSetAdminPreviewTier('warsztat');
  assert.equal(context.naprawnikGetVerifiedLicense()?.tier, 'warsztat');
});

test('odzyskiwanie klucza z pliku .txt, ekran regulaminu/RODO oraz katalog techniczny są zintegrowane', () => {
  const html = read('index.html');
  const billing = read('billing.js');
  const pkg = JSON.parse(read('package.json'));

  assert.ok(html.includes('<script src="./katalog-techniczny.js"></script>'));
  assert.ok(html.includes('function renderLegal()'));
  assert.ok(html.includes("else if(view==='legal') renderLegal();"));
  assert.ok(billing.includes('window.licDownloadKey = function()'));
  assert.ok(billing.includes('window.licLoadKeyFile = async function(event)'));
  assert.ok(billing.includes('data-np-download-key="1"'));
  assert.ok(billing.includes('id="licKeyFileIn"'));
  assert.ok(pkg.scripts['mobile:prepare'].startsWith('npm test &&'));
  assert.ok(html.includes('const meterSafetyGuides = {'));
  assert.ok(html.includes('Przygotowanie stanowiska i miernika'));
  assert.ok(html.includes('Czego NIE robić (Bezpieczeństwo)'));
  assert.ok(html.includes('Wyszukiwarka warsztatowa 5-w-1 + Garaż/VIN'));
  assert.ok(html.includes('function mergeBackupArray(localArr, cloudArr)'));
  assert.ok(html.includes('Podgląd ADMINA'));
  assert.ok(billing.includes("Object.defineProperty(window, 'naprawnikGetAdminPreviewState'"));
});
