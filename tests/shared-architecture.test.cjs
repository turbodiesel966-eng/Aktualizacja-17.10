const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (relPath) => fs.readFileSync(path.join(root, relPath), 'utf8');
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

test('Wspólny manifest zasobów jest poprawny, spójny i kompletny', () => {
  const manifest = JSON.parse(read('scripts/shared-manifest.json'));
  assert.ok(manifest.appVersion, 'Manifest musi definiować appVersion');
  assert.ok(manifest.cacheVersion.startsWith('naprawnik-v5-'), 'cacheVersion musi być zgodna z wersją v5');
  assert.equal(manifest.nativeCacheVersion, manifest.cacheVersion + '-native');

  // Weryfikacja obecności wszystkich zadeklarowanych skryptów na dysku
  for (const script of manifest.sharedScripts) {
    const scriptPath = path.join(root, script);
    assert.ok(fs.existsSync(scriptPath), `Wspólny skrypt z manifestu musi istnieć: ${script}`);
  }

  // Weryfikacja obecności wszystkich zadeklarowanych grafik na dysku
  for (const asset of manifest.sharedAssets) {
    const assetPath = path.join(root, 'assets', asset);
    assert.ok(fs.existsSync(assetPath), `Wspólny asset z manifestu musi istnieć: ${asset}`);
  }

  // Weryfikacja zablokowanych fraz OTA
  assert.ok(manifest.blockedOtaTerms.includes('WEB_LIVE_BASE'));
  assert.ok(manifest.blockedOtaTerms.includes('turbodiesel966-eng.github.io'));
  assert.ok(manifest.blockedOtaTerms.includes('__naprawnikWebSync'));
  assert.ok(manifest.blockedOtaTerms.includes('syncApkWithWebNow'));
});

test('Moduły wspólne są w 100% identyczne bajt po bajcie między root a www/', () => {
  const filesToCompare = [
    'motocykle-multi-data.js',
    'motocykle-multi.js',
    'katalog-techniczny.js',
    'druciarstwo.js',
    'platform-adapter.js',
    'vin-decoder.js'
  ];

  for (const file of filesToCompare) {
    const rootPath = path.join(root, file);
    const wwwPath = path.join(root, 'www', file);

    assert.ok(fs.existsSync(rootPath), `Plik źródłowy musi istnieć: ${file}`);
    assert.ok(fs.existsSync(wwwPath), `Plik wygenerowany w www/ musi istnieć: ${file}`);

    const rootHash = sha256(fs.readFileSync(rootPath));
    const wwwHash = sha256(fs.readFileSync(wwwPath));

    assert.equal(wwwHash, rootHash, `Plik ${file} w www/ nie jest identyczny ze źródłem w root! Rozbieżność sumy SHA-256.`);
  }
});

test('Unified Platform Adapter zachowuje się poprawnie w środowisku Web / PWA', async () => {
  const adapterSource = read('platform-adapter.js');
  const appendedElements = [];
  const assignedUrls = [];

  const fakeDocument = {
    createElement(tag) {
      return { tag, href: '', download: '', click() {} };
    },
    body: {
      appendChild(el) { appendedElements.push(el); },
      removeChild() {}
    },
    getElementById() { return null; },
    querySelector() { return null; }
  };

  const context = {
    window: {},
    document: fakeDocument,
    location: {
      assign(url) { assignedUrls.push(url); }
    },
    URL: {
      createObjectURL() { return 'blob:https://naprawnik.test/uuid'; },
      revokeObjectURL() {}
    },
    history: { length: 2, back() {} },
    setTimeout(fn) { fn(); },
    console
  };
  context.window = context;
  context.globalThis = context;

  vm.runInNewContext(adapterSource, context);
  const { NaprawnikPlatform } = context;

  assert.ok(NaprawnikPlatform, 'NaprawnikPlatform musi być zarejestrowany w obiekcie globalnym');
  assert.equal(NaprawnikPlatform.isNative(), false, 'W środowisku webowym isNative() musi zwracać false');

  const cardHtml = NaprawnikPlatform.renderApkCard();
  assert.ok(cardHtml.includes('📲 Aplikacja Android (APK)'), 'W PWA karta musi zachęcać do pobrania instalatora');
  assert.ok(cardHtml.includes('https://naprawnik-download.pages.dev/'), 'Karta PWA musi linkować do strony pobierania');
  assert.ok(!cardHtml.includes('syncApkWithWebNow'), 'Karta nie może zawierać odwołań do starego OTA sync');

  // Test pobierania pliku w przeglądarce
  const fakeBlob = { arrayBuffer: async () => new ArrayBuffer(8) };
  await NaprawnikPlatform.exportFile(fakeBlob, 'test-kopia.json', 'Tytuł');
  assert.equal(appendedElements.length, 1);
  assert.equal(appendedElements[0].download, 'test-kopia.json');

  // Test otwierania płatności w PWA
  await NaprawnikPlatform.openCheckout('https://checkout.stripe.com/c/pay/cs_test_123', 'subscription');
  assert.equal(assignedUrls[0], 'https://checkout.stripe.com/c/pay/cs_test_123');
});

test('Unified Platform Adapter działa poprawnie w środowisku Android Capacitor (APK)', async () => {
  const adapterSource = read('platform-adapter.js');
  const nativeFilesWritten = [];
  const nativeShares = [];
  let exitAppCalled = false;

  const context = {
    window: {
      __naprawnikNative: true
    },
    document: {
      getElementById() { return null; },
      querySelector() { return null; }
    },
    Capacitor: {
      isNativePlatform() { return true; },
      Plugins: {
        Filesystem: {
          writeFile: async (payload) => {
            nativeFilesWritten.push(payload);
            return { uri: 'file:///data/user/0/pl.naprawnik/cache/' + payload.path };
          }
        },
        Share: {
          share: async (payload) => {
            nativeShares.push(payload);
            return { activityType: 'completed' };
          }
        },
        App: {
          exitApp() { exitAppCalled = true; }
        }
      }
    },
    btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
    console
  };
  context.window.window = context.window;
  context.window.Capacitor = context.Capacitor;
  context.globalThis = context.window;

  vm.runInNewContext(adapterSource, context);
  const NaprawnikPlatform = context.window.NaprawnikPlatform || context.NaprawnikPlatform;

  assert.ok(NaprawnikPlatform, 'NaprawnikPlatform musi być obecny');
  assert.equal(NaprawnikPlatform.isNative(), true, 'W środowisku APK isNative() musi zwracać true');

  const cardHtml = NaprawnikPlatform.renderApkCard();
  assert.ok(cardHtml.includes('📱 Aplikacja Android (Wersja Warsztatowa Offline)'), 'W APK karta musi potwierdzać status offline');
  assert.ok(!cardHtml.includes('naprawnik-download.pages.dev'), 'W APK karta nie może linkować do pobierania samej siebie');

  // Test zapisu i udostępnienia pliku przez pluginy Capacitor
  const fakeBlob = {
    arrayBuffer: async () => Buffer.from('{"test":123}').buffer
  };
  await NaprawnikPlatform.exportFile(fakeBlob, 'warsztat-kopia.json', 'Kopia warsztatu');
  assert.equal(nativeFilesWritten.length, 1);
  assert.equal(nativeFilesWritten[0].path, 'warsztat-kopia.json');
  assert.equal(nativeShares.length, 1);
  assert.equal(nativeShares[0].files[0], 'file:///data/user/0/pl.naprawnik/cache/warsztat-kopia.json');

  // Test obsługi przycisku wstecz na widoku głównym
  context.window.__naprawnikView = 'home';
  NaprawnikPlatform.handleBack();
  assert.equal(exitAppCalled, true, 'Wciśnięcie wstecz na ekranie głównym w APK musi wywołać App.exitApp()');
});

test('APK w www/ zachowuje 100% izolację i brak mechanizmów OTA', () => {
  const manifest = JSON.parse(read('scripts/shared-manifest.json'));
  const blockedTerms = manifest.blockedOtaTerms;

  const filesToCheck = [
    'www/index.html',
    'www/sw.js',
    'www/native-bridge.js',
    'www/platform-adapter.js'
  ];

  for (const rel of filesToCheck) {
    const content = read(rel);
    for (const blocked of blockedTerms) {
      assert.ok(
        !content.includes(blocked),
        `Naruszenie izolacji: plik ${rel} zawiera niedozwolony termin OTA: ${blocked}`
      );
    }
  }
});

test('Service Workery PWA i APK są poprawnie rozdzielone i zsynchronizowane z manifestem', () => {
  const manifest = JSON.parse(read('scripts/shared-manifest.json'));
  const pwaSw = read('sw.js');
  const apkSw = read('www/sw.js');

  // PWA Service Worker
  assert.ok(pwaSw.includes(`const CACHE='${manifest.cacheVersion}';`));
  assert.ok(!pwaSw.includes('-native'));
  assert.ok(pwaSw.includes("'./platform-adapter.js'"));
  assert.ok(pwaSw.includes("'./motocykle-multi-data.js'"));
  assert.ok(pwaSw.includes("'./motocykle-multi.js'"));

  // APK Service Worker
  assert.ok(apkSw.includes(`const CACHE='${manifest.nativeCacheVersion}';`));
  assert.ok(apkSw.includes("'./native-bridge.js'"));
  assert.ok(apkSw.includes("'./platform-adapter.js'"));
  assert.ok(apkSw.includes("'./motocykle-multi-data.js'"));
  assert.ok(apkSw.includes("'./motocykle-multi.js'"));

  // PWA musi używać strategii Network-First dla navigate
  assert.ok(pwaSw.includes("fetch(e.request).then("));

  // APK musi używać strategii Cache-First dla navigate
  assert.ok(apkSw.includes("caches.match('./index.html').then(cached => cached || fetch(e.request))"));
});

test('Moduł Motocykli 3-4 Cylindry: baza danych, wiarygodność A/B/C i silnik są zintegrowane', () => {
  const dataModule = read('motocykle-multi-data.js');
  const logicModule = read('motocykle-multi.js');

  const context = { window: {} };
  context.window.window = context.window;
  context.globalThis = context.window;
  vm.runInNewContext(dataModule, context);
  vm.runInNewContext(logicModule, context);

  const { NAPRAWNIK_MULTICYL_DATA, NAPRAWNIK_MULTICYL, renderMulticyl } = context.window;

  assert.ok(NAPRAWNIK_MULTICYL_DATA, 'NAPRAWNIK_MULTICYL_DATA musi być zdefiniowane');
  assert.ok(Array.isArray(NAPRAWNIK_MULTICYL_DATA.MANUFACTURERS));
  assert.ok(Array.isArray(NAPRAWNIK_MULTICYL_DATA.MODELS));
  assert.ok(NAPRAWNIK_MULTICYL_DATA.MODELS.length >= 80, 'Baza musi zawierać co najmniej 80 modeli motocykli');

  // Sprawdzenie wiarygodności parametrów
  for (const model of NAPRAWNIK_MULTICYL_DATA.MODELS) {
    if (model.params) {
      for (const [key, param] of Object.entries(model.params)) {
        if (param && typeof param === 'object' && 'conf' in param) {
          assert.ok(
            ['A', 'B', 'C', null].includes(param.conf),
            `Nieprawidłowy stopień wiarygodności w modelu ${model.id}, parametr ${key}: ${param.conf}`
          );
        }
      }
    }
  }

  assert.ok(NAPRAWNIK_MULTICYL, 'NAPRAWNIK_MULTICYL musi być zdefiniowane');
  assert.equal(typeof NAPRAWNIK_MULTICYL.calculateShim, 'function');
  assert.equal(typeof renderMulticyl, 'function');
});
