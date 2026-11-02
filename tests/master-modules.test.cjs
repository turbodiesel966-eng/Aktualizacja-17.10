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

test('NAPRAWNIK MASTER — Kalkulator Squish & CR oraz presety tuningowe 2T/4T', () => {
  const html = read('index.html');
  assert.ok(html.includes('Kalkulator Squish Clearance & Stopnia Sprężania (CR)'), 'Brak nagłówka kalkulatora Squish & CR');
  assert.ok(html.includes('applySquishPreset'), 'Brak funkcji applySquishPreset');
  assert.ok(html.includes('calcSquishAndCr'), 'Brak funkcji calcSquishAndCr');
  assert.ok(html.includes('SQUISH_PRESETS'), 'Brak mapy presetów SQUISH_PRESETS');
  assert.ok(html.includes('am6'), 'Brak presetu AM6');
  assert.ok(html.includes('aerox'), 'Brak presetu Aerox');
  assert.ok(html.includes('bb70_racing'), 'Brak presetu BB70 Racing');

  // Ekstrakcja funkcji do testów jednostkowych
  const vm = require('vm');
  const sandbox = { Math, parseFloat, console };
  const fnCode = html.slice(html.indexOf('function calcSquishAndCr('), html.indexOf('function calcSquishAndCrUI('));
  vm.runInNewContext(fnCode, sandbox);

  // Testy matematyczne
  const resOptimal = sandbox.calcSquishAndCr(40.0, 39.2, 0.85, 4.5);
  assert.strictEqual(resOptimal.dispCc, 49.3);
  assert.strictEqual(resOptimal.cr, 11.9);
  assert.strictEqual(resOptimal.status, 'optimal');

  const resDanger = sandbox.calcSquishAndCr(47.6, 39.2, 0.45, 5.0);
  assert.strictEqual(resDanger.status, 'danger');
  assert.ok(resDanger.message.includes('KRYTYCZNE NIEBEZPIECZEŃSTWO'));

  const resRacing = sandbox.calcSquishAndCr(47.6, 39.2, 0.65, 5.0);
  assert.strictEqual(resRacing.status, 'warning_tight');
});

test('NAPRAWNIK MASTER — Skaner VIN aparatem i kodów kreskowych (HTML5 zero-cost)', () => {
  const html = read('index.html');
  assert.ok(html.includes('startVinCameraScan'), 'Brak funkcji startVinCameraScan');
  assert.ok(html.includes('closeVinScanModal'), 'Brak funkcji closeVinScanModal');
  assert.ok(html.includes('scanVinFromFileInput'), 'Brak funkcji scanVinFromFileInput');
  assert.ok(html.includes('BarcodeDetector'), 'Brak detektora kodów kreskowych BarcodeDetector');
  assert.ok(html.includes('getUserMedia'), 'Brak wywołania kamery getUserMedia');
  assert.ok(html.includes('📷 Skanuj'), 'Brak przycisku skanowania w formularzach');
});

test('NAPRAWNIK MASTER — Rentowność i marża warsztatu (poufny widok mechanika)', () => {
  const html = read('index.html');
  assert.ok(html.includes('Analiza rentowności i zysk warsztatu (POUFNE)'), 'Brak karty rentowności w zleceniu');
  assert.ok(html.includes('no-print'), 'Karta rentowności musi być ukryta przed wydrukiem');
  assert.ok(html.includes('updateOrderLaborCost'), 'Brak funkcji updateOrderLaborCost');
  assert.ok(html.includes('grossProfit'), 'Brak wyliczenia zysku czystego grossProfit');
  assert.ok(html.includes('marginPercent'), 'Brak wyliczenia marży marginPercent');
  assert.ok(html.includes('markupPartsPercent'), 'Brak wyliczenia narzutu na częściach markupPartsPercent');
});

test('NAPRAWNIK MASTER — IndexedDB oraz rozszerzenie bazy danych D1 (katalog techniczny)', () => {
  const html = read('index.html');
  const workerSrc = read('workers/subscriptions/src/index.mjs');
  const migration = read('workers/subscriptions/migrations/0008_technical_catalog.sql');

  // IndexedDB
  assert.ok(html.includes('naprawnik_db'), 'Brak bazy IndexedDB naprawnik_db');
  assert.ok(html.includes('idbSavePhoto'), 'Brak funkcji idbSavePhoto');
  assert.ok(html.includes('idbGetPhoto'), 'Brak funkcji idbGetPhoto');

  // D1 Migration
  assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS catalog_models'), 'Brak tabeli catalog_models w migracji');
  assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS catalog_parts'), 'Brak tabeli catalog_parts w migracji');
  assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS catalog_tuning_specs'), 'Brak tabeli catalog_tuning_specs w migracji');
  assert.ok(migration.includes('Minarelli AM6'), 'Brak danych AM6 w migracji');

  // Worker API
  assert.ok(workerSrc.includes('/api/catalog/sync'), 'Brak endpointu /api/catalog/sync w Workerze');
  assert.ok(workerSrc.includes('/api/tuning-specs'), 'Brak endpointu /api/tuning-specs w Workerze');
});

test('NAPRAWNIK MASTER — Nowe Moduły Warsztatowe: WhatsApp/SMS, Etykiety PDF, Eksport CSV i Voice Dictation', () => {
  const html = read('index.html');

  // WhatsApp & SMS
  assert.ok(html.includes('sendCustomerNotification'), 'Brak funkcji sendCustomerNotification');
  assert.ok(html.includes('https://wa.me/'), 'Brak obsługi linku WhatsApp wa.me');
  assert.ok(html.includes('sms:'), 'Brak obsługi protokołu SMS');

  // Service Tag PDF
  assert.ok(html.includes('printServiceTagPdf'), 'Brak funkcji printServiceTagPdf');
  assert.ok(html.includes('NASTĘPNY PRZEGLĄD'), 'Brak pola następnego przeglądu w zawieszce');

  // CSV Export
  assert.ok(html.includes('exportOrdersCsv'), 'Brak funkcji exportOrdersCsv');
  assert.ok(html.includes('\\uFEFF'), 'Eksport CSV musi posiadać UTF-8 BOM dla Excela');

  // Voice Dictation
  assert.ok(html.includes('initVoiceDictation'), 'Brak funkcji initVoiceDictation');
  assert.ok(html.includes('pl-PL'), 'Dyktowanie musi być w języku pl-PL');
});

test('NAPRAWNIK MASTER — Narzędzia Tuningowe: Pinouty CDI, Stroiciel Gaźnika, Tuning CVT i HUD Warsztatowy', () => {
  const html = read('index.html');

  // Pinouts
  assert.ok(html.includes('renderPinouts'), 'Brak widoku renderPinouts');
  assert.ok(html.includes('PINOUT_DEVICES'), 'Brak bazy modułów PINOUT_DEVICES');
  assert.ok(html.includes('ac_cdi_5pin'), 'Brak modułu AC-CDI');
  assert.ok(html.includes('ducati_am6'), 'Brak modułu Ducati AM6');

  // Jetting Wizard
  assert.ok(html.includes('renderJettingWizard'), 'Brak widoku renderJettingWizard');
  assert.ok(html.includes('calcJettingUI'), 'Brak funkcji calcJettingUI');
  assert.ok(html.includes('Plug Chop'), 'Brak instrukcji testu świecy Plug Chop');

  // CVT Tuning
  assert.ok(html.includes('renderCvtTuning'), 'Brak widoku renderCvtTuning');
  assert.ok(html.includes('calcCvtUI'), 'Brak funkcji calcCvtUI');

  // Workshop HUD
  assert.ok(html.includes('renderWorkshopHud'), 'Brak widoku renderWorkshopHud');
  assert.ok(html.includes('TRYB WARSZTATOWY (HUD)'), 'Brak nagłówka trybu HUD');

  // Navigation & Tier lock
  assert.ok(html.includes("pinouts:'pro'"), 'Pinouty muszą wymagać planu PRO w NAV_MIN');
});

test('NAPRAWNIK MASTER — DRUCIARSTWO ULTIMATE: Baza Patentów, Janusz 3000, Recykling i Czerwona Linia Bezpieczeństwa', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  const druc = read('druciarstwo.js');

  // Integracja z aplikacją i Service Workerem
  assert.ok(html.includes('<script src="./druciarstwo.js"></script>'), 'Brak załączenia druciarstwo.js w index.html');
  assert.ok(html.includes("else if(view==='druciarstwo') renderDruciarstwo(arg);"), 'Brak obsługi widoku druciarstwo w nav()');
  assert.ok(html.includes("druciarstwo:'DRUCIARSTWO — Kreatywne Naprawy Garażowe'"), 'Brak etykiety druciarstwo w NAV_LABEL');
  assert.ok(sw.includes("'./druciarstwo.js'"), 'Brak druciarstwo.js w precache sw.js');
  assert.ok(sw.includes("'./assets/tile-druciarstwo.jpg'"), 'Brak tile-druciarstwo.jpg w precache sw.js');

  // Specjalny kafelek 3D na pulpicie głównym
  assert.ok(html.includes("tile('🪛','DRUCIARSTWO','druciarstwo'"), 'Brak kafelka DRUCIARSTWO na pulpicie głównym');
  assert.ok(html.includes("image:'./assets/tile-druciarstwo.jpg'"), 'Kafelek DRUCIARSTWO musi posiadać grafikę 3D');
  assert.ok(fs.existsSync(path.join(root, 'assets', 'tile-druciarstwo.jpg')), 'Brak pliku grafiki assets/tile-druciarstwo.jpg');

  // Baza danych i stałe
  assert.ok(druc.includes('const LEVELS = {'), 'Brak skali poziomów LEVELS');
  assert.ok(druc.includes('CO TU SIĘ ODPIERDALA?'), 'Brak poziomu 3 w skali druciarstwa');
  assert.ok(druc.includes('const SAFETY = {'), 'Brak klasyfikacji bezpieczeństwa SAFETY');
  assert.ok(druc.includes('CZERWONA LINIA / ZABRONIONE'), 'Brak poziomu danger w SAFETY');
  assert.ok(druc.includes('const BUILTIN_PATENTS = ['), 'Brak bazy BUILTIN_PATENTS');
  assert.ok(druc.includes('const RECYCLE_DATABASE = ['), 'Brak bazy materiałów z odzysku RECYCLE_DATABASE');

  // Generator Janusz Engineering 3000
  assert.ok(druc.includes('JANUSZ ENGINEERING 3000'), 'Brak generatora Janusz 3000');
  assert.ok(druc.includes('handleJanuszSubmit'), 'Brak funkcji handleJanuszSubmit');
  assert.ok(druc.includes('activateZeroCostMode'), 'Brak trybu zerowego kosztu activateZeroCostMode');

  // 12 ustrukturyzowanych punktów w kartach patentów
  assert.ok(druc.includes('1. Pomysł:'), 'Brak punktu 1 w karcie');
  assert.ok(druc.includes('4. Instrukcja wykonania krok po kroku:'), 'Brak instrukcji krok po kroku w karcie');
  assert.ok(druc.includes('9. Ograniczenia i czego unikać:'), 'Brak punktu o ograniczeniach');
  assert.ok(druc.includes('12. Ocena mechaników:'), 'Brak oceniania w karcie patentu');

  // Bezpieczeństwo i Czerwona Linia
  assert.ok(druc.includes('CZERWONA LINIA BEZPIECZEŃSTWA'), 'Brak baneru Czerwonej Linii Bezpieczeństwa');
  assert.ok(druc.includes('Hamulcach'), 'Ostrzeżenie o hamulcach');
  assert.ok(druc.includes('Układzie kierowniczym'), 'Ostrzeżenie o kierownicy');
  assert.ok(druc.includes('Ramie nośnej'), 'Ostrzeżenie o ramie');
  assert.ok(druc.includes('Ciśnieniowych przewodach paliwowych'), 'Ostrzeżenie o przewodach paliwowych EFI');

  // Storage i wymiana danych JSON
  assert.ok(druc.includes("'naprawnik_druciarstwo_custom'"), 'Brak klucza storage dla własnych patentów');
  assert.ok(druc.includes("'naprawnik_druciarstwo_favorites'"), 'Brak klucza storage dla ulubionych');
  assert.ok(druc.includes("'naprawnik_druciarstwo_ratings'"), 'Brak klucza storage dla ocen');
  assert.ok(druc.includes('exportDruciarstwoJson'), 'Brak eksportu JSON');
  assert.ok(druc.includes('importDruciarstwoJson'), 'Brak importu JSON');
});

test('NAPRAWNIK MASTER — Audyt i rozbudowa baz danych: katalog techniczny OEM, diagnostyka EFI i recykling', () => {
  const html = read('index.html');
  const kt = read('katalog-techniczny.js');
  const druc = read('druciarstwo.js');

  // 1. Katalog Techniczny — weryfikacja naprawy struktury i liczby rekordów
  const vm = require('node:vm');
  const context = { window: {} };
  vm.runInNewContext(kt, context, { filename: 'katalog-techniczny.js' });
  const catalog = context.window.NAPRAWNIK_KATALOG;
  assert.ok(catalog.records.length >= 160, `Oczekiwano co najmniej 160 rekordów w katalogu, znaleziono ${catalog.records.length}`);

  // Weryfikacja nowych modeli
  assert.ok(catalog.search('PCX 125').length >= 5, 'Katalog musi zawierać specyfikację Honda PCX 125');
  assert.ok(catalog.search('i-Get 125').length >= 3, 'Katalog musi zawierać specyfikację Piaggio/Vespa i-Get 125');
  assert.ok(catalog.search('139FMB').length >= 4, 'Katalog musi zawierać specyfikację silnika biegowego 139FMB');
  assert.ok(catalog.search('D50B0').length >= 4, 'Katalog musi zawierać specyfikację Derbi D50B0');

  // 2. Baza Diagnostyczna — nowe karty usterkowe
  assert.ok(html.includes('fuel-pump-strainer-efi'), 'Brak karty diagnostycznej zapchanego sitka pompy paliwa EFI');
  assert.ok(html.includes('valve-stem-seals-4t'), 'Brak karty uszczelniaczy zaworowych');
  assert.ok(html.includes('spark-plug-cap-puncture'), 'Brak karty przebicia fajki świecy');
  assert.ok(html.includes('cooling-airlock-bleed-lc'), 'Brak karty zapowietrzonego układu LC');
  assert.ok(html.includes('clutch-shoe-spring-broken'), 'Brak karty pękniętej sprężynki sprzęgła');
  assert.ok(html.includes('vacuum-petcock-fuel-in-oil'), 'Brak karty benzyny w oleju przez kranik');

  // 3. Druciarstwo — rozbudowa patentów i recyklingu
  assert.ok(druc.includes('dtt-06'), 'Brak patentu dtt-06');
  assert.ok(druc.includes('met-04'), 'Brak patentu met-04');
  assert.ok(druc.includes('Stara kuchenka mikrofalowa'), 'Brak kuchenki mikrofalowej w bazie recyklingu');
  assert.ok(druc.includes('Stary alternator samochodowy'), 'Brak alternatora w bazie recyklingu');
});


