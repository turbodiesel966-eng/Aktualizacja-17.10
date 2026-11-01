const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('NAPRAWNIK MASTER — limity planów i klucze storage są poprawnie zdefiniowane', () => {
  const html = read('index.html');
  assert.ok(html.includes("'naprawnik_orders'"), 'Brak klucza naprawnik_orders w storage');
  assert.ok(html.includes("'naprawnik_measurements'"), 'Brak klucza naprawnik_measurements w storage');

  // Weryfikacja wartości limitów w kodzie
  assert.match(html, /amator:\s*1,\s*pro:\s*3,\s*warsztat:\s*500/);
  assert.match(html, /amator:\s*5,\s*pro:\s*15,\s*warsztat:\s*200/);
  assert.match(html, /amator:\s*20,\s*pro:\s*150,\s*warsztat:\s*5000/);
});

test('NAPRAWNIK MASTER — Moduł 1: Karta Zlecenia Serwisowego jest zintegrowany', () => {
  const html = read('index.html');
  assert.ok(html.includes('function renderOrders('), 'Brak renderOrders');
  assert.ok(html.includes('function renderOrderDetail('), 'Brak renderOrderDetail');
  assert.ok(html.includes('function renderNewOrderForm('), 'Brak renderNewOrderForm');
  assert.ok(html.includes('function saveNewOrder('), 'Brak saveNewOrder');
  assert.ok(html.includes('function printOrderPdf('), 'Brak printOrderPdf');
  assert.ok(html.includes('function initSignaturePad('), 'Brak initSignaturePad');
  assert.ok(html.includes('function transferOrderToRepairs('), 'Brak transferOrderToRepairs');
  assert.ok(html.includes("orders:'warsztat'") || html.includes("orders: 'warsztat'"), 'Zlecenia muszą być ograniczone do WARSZTAT');
});

test('NAPRAWNIK MASTER — Moduł 2: Elektroniczne Laboratorium jest zintegrowany', () => {
  const html = read('index.html');
  assert.ok(html.includes('function renderElectronicLab('), 'Brak renderElectronicLab');
  assert.ok(html.includes('function evaluateLabStatus('), 'Brak evaluateLabStatus');
  assert.ok(html.includes('function saveLabMeasurement('), 'Brak saveLabMeasurement');
  assert.ok(html.includes('const LAB_SYSTEM_PRESETS = ['), 'Brak LAB_SYSTEM_PRESETS');
  assert.ok(html.includes('BHP i przygotowanie stanowiska pomiarowego'), 'Brak sekcji BHP');
});

test('NAPRAWNIK MASTER — Moduł 3: Inteligentny Dobór Części posiada kategorie i stopnie pewności', () => {
  const html = read('index.html');
  assert.ok(html.includes('function setPartsCat('), 'Brak setPartsCat');
  assert.ok(html.includes('function getPartCategory('), 'Brak getPartCategory');
  assert.ok(html.includes('function getConfidenceBadge('), 'Brak getConfidenceBadge');
  assert.ok(html.includes('Potwierdzona (OEM / DTR)'), 'Brak plakietki potwierdzonej zgodności');
});

test('NAPRAWNIK MASTER — Moduł 4: Historia Napraw ze Zdjęciami posiada obsługę załączników', () => {
  const html = read('index.html');
  assert.ok(html.includes('function attachRepairPhoto('), 'Brak attachRepairPhoto');
  assert.ok(html.includes('function compressImageToDataUrl('), 'Brak compressImageToDataUrl');
  assert.ok(html.includes('function zoomPhoto('), 'Brak zoomPhoto');
  assert.ok(html.includes('rPhotoPreview'), 'Brak podglądu zdjęć w formularzu naprawy');
});

test('NAPRAWNIK MASTER — Moduł 5: Automatyczny Plan Serwisowy jest zintegrowany', () => {
  const html = read('index.html');
  assert.ok(html.includes('function renderAutomatedServicePlan('), 'Brak renderAutomatedServicePlan');
  assert.ok(html.includes('function completeServiceInterval('), 'Brak completeServiceInterval');
  assert.ok(html.includes('const STANDARD_SERVICE_INTERVALS = ['), 'Brak STANDARD_SERVICE_INTERVALS');
});

test('NAPRAWNIK MASTER — billing.js prezentuje nowe limity i kartę zużycia planu', () => {
  const billing = read('billing.js');
  assert.ok(billing.includes('Wykorzystanie i limity Twojego planu'), 'Brak karty zużycia planu w billing.js');
  assert.ok(billing.includes('Własne pojazdy w kartotece'), 'Brak limitu pojazdów w billing.js');
  assert.ok(billing.includes('planUsage'), 'Brak obsługi planUsage w billing.js');
});

test('NAPRAWNIK — przycisk powrót zachowuje historię ekranów oraz pozycję przewijania', () => {
  const html = read('index.html');
  assert.ok(html.includes('function back(){ return `<div class="btn back" onclick="navBack()">← Powrót</div>`; }'), 'Przycisk back() musi wywoływać navBack(), a nie twarde nav("home")');
  assert.ok(html.includes('function navBack()'), 'Brak funkcji navBack()');
  assert.ok(html.includes('navHistory.pop()'), 'navBack musi zdejmofać poprzedni stan z navHistory');
  assert.ok(html.includes('restoreScrollPos'), 'Brak restoreScrollPos przywracającego przewinięcie');
  assert.ok(html.includes('getScrollPos'), 'Brak getScrollPos pobierającego przewinięcie');
  assert.ok(html.includes('screenScroll: currentNavState.screenScroll'), 'Stan historii musi zapisywać screenScroll');
});

test('NAPRAWNIK — przycisk Aktualizuj na górze zmieniający kolor i treść po wykryciu aktualizacji', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  const version = JSON.parse(read('version.json'));

  // 1. Przycisk na górze z domyślną nazwą Aktualizuj
  assert.ok(html.includes('id="topUpdateBar"'), 'Brak górnego paska aktualizacji #topUpdateBar');
  assert.ok(html.includes('id="btnAppUpdate"'), 'Brak przycisku aktualizacji #btnAppUpdate');
  assert.ok(html.includes('Aktualizuj'), 'Brak domyślnego napisu Aktualizuj');

  // 2. Napis po wykryciu aktualizacji i zmiana stylu
  assert.ok(
    html.includes('Rób Aktualizacje ten pojeb znów coś wymyślił i dodał!!!!'),
    'Brak wymaganego napisu alertu po wykryciu aktualizacji'
  );
  assert.ok(html.includes('update-ready'), 'Brak klasy zmiany koloru update-ready');
  assert.ok(html.includes('updateBtnPulse'), 'Brak animacji pulsowania przycisku po wykryciu aktualizacji');

  // 3. Połączenie z wersją i automatyczne wykrywanie zmian w tle bez powiadomień
  assert.ok(html.includes('function checkForAppUpdates('), 'Brak funkcji checkForAppUpdates');
  assert.ok(html.includes('function triggerUpdateState('), 'Brak funkcji triggerUpdateState');
  assert.ok(html.includes('version.json'), 'Wykrywanie musi odpytywać version.json');
  assert.ok(typeof version.version === 'string', 'Plik version.json musi zawierać pole version');
  assert.ok(typeof version.build === 'number', 'Plik version.json musi zawierać timestamp buildu');

  // 4. Obsługa Service Worker skipWaiting
  assert.ok(sw.includes('skipWaiting'), 'Service worker musi obsługiwać skipWaiting');
});
