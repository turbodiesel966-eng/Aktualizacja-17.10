const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('NAPRAWNIK APK (www/) — skrypty kompilują się i renderują wszystkie główne ekrany', () => {
  const html = read('www/index.html');

  // Weryfikacja składni każdego skryptu inline
  const scriptRegex = /<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptCount = 0;
  while ((match = scriptRegex.exec(html)) !== null) {
    scriptCount++;
    assert.doesNotThrow(() => {
      new Function(match[1]);
    }, `Skrypt inline ${scriptCount} w www/index.html zawiera błąd składni!`);
  }
  assert.ok(scriptCount >= 1, 'Musi istnieć co najmniej jeden skrypt inline');

  // Symulacja środowiska przeglądarkowego w WebView
  let currentScreenHtml = '';
  const fakeScreen = {
    get innerHTML() { return currentScreenHtml; },
    set innerHTML(val) { currentScreenHtml = val; },
    scrollTop: 0,
    querySelector: () => null,
    querySelectorAll: () => []
  };

  const domElements = {};
  const fakeDocument = {
    getElementById: (id) => {
      if (id === 'screen') return fakeScreen;
      if (!domElements[id]) domElements[id] = { innerHTML: '', textContent: '', classList: { add(){}, remove(){}, toggle(){} }, style: {} };
      return domElements[id];
    },
    querySelector: (sel) => {
      if (sel === '#screen') return fakeScreen;
      return { classList: { add(){}, remove(){}, toggle(){} }, dataset: { nav: 'home' } };
    },
    querySelectorAll: () => [
      { classList: { toggle(){} }, dataset: { nav: 'home' }, addEventListener: () => {} },
      { classList: { toggle(){} }, dataset: { nav: 'vehicles' }, addEventListener: () => {} },
      { classList: { toggle(){} }, dataset: { nav: 'search' }, addEventListener: () => {} },
      { classList: { toggle(){} }, dataset: { nav: 'settings' }, addEventListener: () => {} }
    ],
    createElement: () => ({ appendChild(){}, removeChild(){}, style: {}, setAttribute(){} }),
    body: { appendChild(){}, removeChild(){} },
    addEventListener: () => {}
  };

  const fakeWindow = {
    __naprawnikNative: true,
    navigator: { serviceWorker: { register: () => Promise.resolve({ addEventListener(){} }) } },
    document: fakeDocument,
    location: { protocol: 'https:', href: 'http://localhost/', search: '' },
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] || null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; }
    },
    URLSearchParams: class { get() { return null; } has() { return false; } },
    addEventListener: () => {},
    scrollTo: () => {},
    setTimeout: (fn) => fn(),
    setInterval: () => {},
    console: console
  };
  fakeWindow.window = fakeWindow;
  fakeWindow.globalThis = fakeWindow;

  const context = vm.createContext(fakeWindow);

  // Wykonaj skrypt główny
  const mainScript = html.match(/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/i)[1];
  vm.runInContext(mainScript, context);

  // Załaduj pozostałe skrypty z www/
  const scriptsToLoad = [
    'www/katalog-techniczny.js',
    'www/druciarstwo.js',
    'www/motocykle-multi-data.js',
    'www/motocykle-multi.js',
    'www/vin-decoder.js',
    'www/platform-adapter.js',
    'www/billing.js',
    'www/native-bridge.js'
  ];
  for (const s of scriptsToLoad) {
    vm.runInContext(read(s), context);
  }

  // Weryfikacja obecności kluczowych funkcji
  assert.equal(typeof fakeWindow.nav, 'function', 'Funkcja nav musi być dostępna globalnie w APK');
  assert.equal(typeof fakeWindow.renderHome, 'function', 'renderHome musi być zdefiniowane');
  assert.equal(typeof fakeWindow.renderVehicles, 'function', 'renderVehicles musi być zdefiniowane');
  assert.equal(typeof fakeWindow.renderSearch, 'function', 'renderSearch musi być zdefiniowane');
  assert.equal(typeof fakeWindow.renderSettings, 'function', 'renderSettings musi być zdefiniowane');

  // Test 1: Ekran Home
  fakeWindow.nav('home');
  assert.ok(currentScreenHtml.length > 500, 'Ekran Home nie może być pusty');
  assert.ok(currentScreenHtml.includes('NAPRAWNIK'), 'Ekran Home musi zawierać nagłówek NAPRAWNIK');
  assert.ok(currentScreenHtml.includes('SZEŚĆ GŁÓWNYCH MODUŁÓW WARSZTATU'), 'Ekran Home musi zawierać kafelki modułów');

  // Test 2: Ekran Garaż (vehicles)
  fakeWindow.nav('vehicles');
  assert.ok(currentScreenHtml.length > 100, 'Ekran Garaż nie może być pusty');
  assert.ok(currentScreenHtml.includes('Pojazdy') || currentScreenHtml.includes('Garaż') || currentScreenHtml.includes('pojazd'), 'Ekran Garaż musi zawierać zawartość pojazdów');

  // Test 3: Ekran Szukaj (search)
  fakeWindow.nav('search');
  assert.ok(currentScreenHtml.length > 100, 'Ekran Szukaj nie może być pusty');
  assert.ok(currentScreenHtml.includes('Szukaj') || currentScreenHtml.includes('Wyszukaj') || currentScreenHtml.includes('search'), 'Ekran Szukaj musi zawierać wyszukiwarkę');

  // Test 4: Ekran Ustawienia (settings)
  fakeWindow.nav('settings');
  assert.ok(currentScreenHtml.length > 200, 'Ekran Ustawienia nie może być pusty');
  assert.ok(currentScreenHtml.includes('Ustawienia') || currentScreenHtml.includes('Kopia') || currentScreenHtml.includes('Zarządzaj'), 'Ekran Ustawienia musi zawierać konfigurację');
});
