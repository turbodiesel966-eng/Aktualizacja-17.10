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

  // 5. Ochrona przed zapętleniem aktualizacji (Single Source of Truth i ochrona localStorage)
  const currentBuildMatch = html.match(/const CURRENT_APP_BUILD\s*=\s*(\d+);/);
  assert.ok(currentBuildMatch, 'index.html musi definiować CURRENT_APP_BUILD');
  assert.equal(Number(currentBuildMatch[1]), version.build, 'CURRENT_APP_BUILD w index.html musi być identyczny z build w version.json');

  const currentVersionMatch = html.match(/const CURRENT_APP_VERSION\s*=\s*['"]([^'"]+)['"];/);
  assert.ok(currentVersionMatch, 'index.html musi definiować CURRENT_APP_VERSION');
  assert.equal(currentVersionMatch[1], version.version, 'CURRENT_APP_VERSION w index.html musi być identyczny z version w version.json');

  assert.ok(html.includes('naprawnik_last_updated_build'), 'Mechanizm aktualizacji musi zapisywać i respektować naprawnik_last_updated_build w localStorage');
  assert.ok(html.includes('controllerchange'), 'Obsługa aktualizacji musi nasłuchiwać zdarzenia controllerchange dla płynnego przeładowania');

  // 6. Weryfikacja odizolowania w wersji APK (www/)
  const wwwHtml = read('www/index.html');
  assert.ok(wwwHtml.includes('id="topUpdateBar" class="top-update-bar" style="display:none !important"'), 'Pasek aktualizacji w APK musi być ukryty');
  assert.ok(wwwHtml.includes('function triggerUpdateState(){}'), 'triggerUpdateState w APK musi być pustą zaślepką');
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

test('NAPRAWNIK MASTER — Rozbudowa Druciarstwa Ultimate i Bazy Danych v5.29', () => {
  const html = read('index.html');
  const kt = read('katalog-techniczny.js');
  const druc = read('druciarstwo.js');

  // 1. Rozbudowa modułu Druciarstwo Ultimate
  const vm = require('node:vm');
  const drucContext = { window: {}, console };
  vm.runInNewContext(druc, drucContext);
  assert.ok(drucContext.window.DRUCIARSTWO_DATABASE.length >= 45, `Oczekiwano co najmniej 45 patentów w Druciarstwie, znaleziono ${drucContext.window.DRUCIARSTWO_DATABASE.length}`);
  assert.ok(drucContext.window.DRUCIARSTWO_RECYCLE.length >= 12, `Oczekiwano co najmniej 12 źródeł recyklingu, znaleziono ${drucContext.window.DRUCIARSTWO_RECYCLE.length}`);
  assert.ok(drucContext.window.DRUCIARSTWO_ARTIFACTS.length === 12, 'Oczekiwano 12 Świętych Artefaktów Druciarza');
  assert.ok(drucContext.window.DRUCIARSTWO_SAVINGS.length >= 20, 'Oczekiwano co najmniej 20 pozycji w kalkulatorze oszczędności');
  assert.ok(druc.includes('handleSafetyQuizSubmit'), 'Brak obsługi quizu bezpieczeństwa handleSafetyQuizSubmit');
  assert.ok(druc.includes('toggleSavingItem'), 'Brak funkcji toggleSavingItem');

  // 2. Rozbudowa Katalogu Technicznego OEM
  const ktContext = { window: {} };
  vm.runInNewContext(kt, ktContext, { filename: 'katalog-techniczny.js' });
  const catalog = ktContext.window.NAPRAWNIK_KATALOG;
  assert.ok(catalog.records.length >= 190, `Oczekiwano co najmniej 190 rekordów w katalogu, znaleziono ${catalog.records.length}`);
  assert.ok(catalog.search('Junak').length >= 4, 'Brak specyfikacji Junak 121/M12');
  assert.ok(catalog.search('Zontes').length >= 4, 'Brak specyfikacji Zontes 125');
  assert.ok(catalog.search('Simson').length >= 3, 'Brak specyfikacji Simson S51 M541');
  assert.ok(catalog.search('WSK').length >= 2, 'Brak specyfikacji WSK 125');

  // 3. Rozbudowa Bazy Diagnostycznej w index.html
  assert.ok(html.includes('ground_strap_voltage_drop'), 'Brak karty diagnostycznej spadku napięcia na masie');
  assert.ok(html.includes('cv_carb_membrane_pinhole'), 'Brak karty uszkodzonej membrany gaźnika CV');
  assert.ok(html.includes('variator_sliders_wear'), 'Brak karty zużycia ślizgów wariatora');
  assert.ok(html.includes('reed_valve_petal_frayed_2t'), 'Brak karty zaworu membranowego 2T');
  assert.ok(html.includes('water_pump_mechanical_seal_leak'), 'Brak karty uszczelniacza pompy wody');
  assert.ok(html.includes('pickup_coil_gap_fault'), 'Brak karty szczeliny impulsatora');
  assert.ok(html.includes('bearings-minarelli-6204'), 'Brak łożysk Minarelli w PARTS_DATABASE');
  assert.ok(html.includes('cvt-belts-master-table'), 'Brak tabeli pasków CVT w PARTS_DATABASE');
});

test('NAPRAWNIK v5.18 — Przebudowa Strony Głównej na 6 Głównych Modułów, Podkategorie i Szybkie Akcje', () => {
  const html = read('index.html');

  // 1. Weryfikacja 6 głównych modułów
  assert.ok(html.includes('const MAIN_MODULES = ['), 'Brak definicji MAIN_MODULES');
  assert.ok(html.includes("id: 'mod_clients'") && html.includes("title: 'KLIENCI I POJAZDY'"), 'Brak Modułu 1: KLIENCI I POJAZDY');
  assert.ok(html.includes("id: 'mod_orders'") && html.includes("title: 'ZLECENIA WARSZTATOWE'"), 'Brak Modułu 2: ZLECENIA WARSZTATOWE');
  assert.ok(html.includes("id: 'mod_diag'") && html.includes("title: 'DIAGNOSTYKA'"), 'Brak Modułu 3: DIAGNOSTYKA');
  assert.ok(html.includes("id: 'mod_electric'") && html.includes("title: 'ELEKTRYKA I POMIARY'"), 'Brak Modułu 4: ELEKTRYKA I POMIARY');
  assert.ok(html.includes("id: 'mod_tech'") && html.includes("title: 'BAZA TECHNICZNA'"), 'Brak Modułu 5: BAZA TECHNICZNA');
  assert.ok(html.includes("id: 'mod_tools'") && html.includes("title: 'KALKULATORY I NARZĘDZIA'"), 'Brak Modułu 6: KALKULATORY I NARZĘDZIA');

  // 2. Weryfikacja widoku podkategorii modułu i filtrowania wewnątrz modułu
  assert.ok(html.includes('function renderModuleView(modId)'), 'Brak funkcji renderModuleView');
  assert.ok(html.includes('function filterModuleView(rawQuery)'), 'Brak funkcji filterModuleView');
  assert.ok(html.includes("else if(view==='module') renderModuleView(arg);"), 'Brak obsługi widoku module w nav()');

  // 3. Weryfikacja szybkich akcji, ostatniej aktywności, przypomnień i ulubionych na stronie głównej
  assert.ok(html.includes('id="homeQuickActions"'), 'Brak sekcji Szybkie akcje na stronie głównej');
  assert.ok(html.includes('Nowe zlecenie') && html.includes('Dodaj pojazd') && html.includes('Szybka diagnostyka'), 'Brak wymaganych przycisków Szybkich akcji');
  assert.ok(html.includes('function renderHomeRecentWidget()') && html.includes('function recordRecentActivity(view, arg)'), 'Brak obsługi Ostatniej aktywności');
  assert.ok(html.includes('function renderHomeRemindersWidget()'), 'Brak widżetu Przypomnień na stronie głównej');
  assert.ok(html.includes('function renderHomeFavoritesWidget()') && html.includes('function toggleFavoriteTool(itemId, ev)'), 'Brak widżetu Ulubionych funkcji');

  // 4. Weryfikacja projektu graficznego 3D Cyber-Workshop (oryginalny gradient fiolet->pomarańcz, dedykowane ilustracje 3D, tło warsztatowe, 45 podkategorii)
  assert.ok(html.includes('--nap-grad-purple-orange'), 'Brak zmiennej oryginalnego gradientu fiolet -> pomarańcz');
  assert.ok(html.includes('./assets/workshop-bg.jpg'), 'Brak pełnowartościowego tła warsztatowego ./assets/workshop-bg.jpg');
  for (const img of ['mod-clients.jpg', 'mod-orders.jpg', 'mod-diag.jpg', 'mod-electric.jpg', 'mod-tech.jpg', 'mod-tools.jpg']) {
    assert.ok(html.includes(`./assets/${img}`), `Brak dedykowanej grafiki 3D ./assets/${img} w MAIN_MODULES`);
    assert.ok(fs.existsSync(path.join(root, 'assets', img)), `Brak pliku grafiki assets/${img} na dysku`);
  }
  assert.ok(html.includes('class="tile-visual mod6-visual"'), 'Karty 6 modułów muszą posiadać grafikę 3D .mod6-visual');
  assert.ok(html.includes('class="mod-sub-thumb"'), 'Podkategorie muszą posiadać ilustracje 3D .mod-sub-thumb');
  assert.ok(html.includes('class="special-section-header"'), 'Brak nagłówka sekcji specjalnej na stronie głównej');
  assert.ok(html.includes('class="symptom-chips-row"'), 'Brak paska szybkich filtrów objawów');
});



test('NAPRAWNIK — Moduł Motocykli 3–4 Cylindry (400–650 cm³): Katalog, 6 Działów A–F, 12 Drzew (8 pkt), Porównanie Cylindrów R3/R4 i 7 Schematów SVG', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  const dataSrc = read('motocykle-multi-data.js');
  const uiSrc = read('motocykle-multi.js');

  // 1. Integracja z index.html oraz Service Workerem
  assert.ok(html.includes('<script src="./motocykle-multi-data.js"></script>'), 'Brak motocykle-multi-data.js w index.html');
  assert.ok(html.includes('<script src="./motocykle-multi.js"></script>'), 'Brak motocykle-multi.js w index.html');
  assert.ok(html.includes("else if(view==='multicyl') renderMulticyl(arg);"), 'Brak routingu widoku multicyl w nav()');
  assert.ok(html.includes("multicyl:'MOTOCYKLE 3–4 CYLINDRY (400–650 cm³)'"), 'Brak etykiety multicyl w NAV_LABEL');
  assert.ok(sw.includes("'./motocykle-multi-data.js'") && sw.includes("'./motocykle-multi.js'"), 'Brak plików modułu 3-4 cyl w precache sw.js');

  // 2. Uruchomienie warstwy danych i silnika UI w sandboxie VM
  const vm = require('node:vm');
  const fakeContainer = { innerHTML: '' };
  const fakeStorage = {};
  const sandbox = {
    window: {},
    globalThis: {},
    localStorage: {
      getItem: k => (k in fakeStorage ? fakeStorage[k] : null),
      setItem: (k, v) => { fakeStorage[k] = String(v); }
    },
    document: {
      activeElement: null, getElementById: id => (id === 'screen' ? fakeContainer : ({ 'mc-param-in-compression': { value: '12.8 bar (A)' }, 'mc-new-brand': { value: 'Kove' }, 'mc-new-model': { value: '450RR' } }[id] || null))
    },
    console
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.runInNewContext(dataSrc, sandbox, { filename: 'motocykle-multi-data.js' });
  vm.runInNewContext(uiSrc, sandbox, { filename: 'motocykle-multi.js' });

  const data = sandbox.NAPRAWNIK_MULTICYL_DATA;
  const api = sandbox.NAPRAWNIK_MULTICYL;
  assert.ok(data, 'Brak obiektu NAPRAWNIK_MULTICYL_DATA');
  assert.ok(api, 'Brak obiektu NAPRAWNIK_MULTICYL');

  // 3. Walidacja bazy danych — 0 błędów, 10 marek, >=90 modeli, >=80 silników, 30 parametrów
  const validationErrors = data.validate();
  assert.strictEqual(validationErrors.length, 0, 'Walidacja danych wykryła błędy: ' + validationErrors.join('; '));

  const norm = api.getData();
  const requiredBrands = ['Honda', 'Yamaha', 'Suzuki', 'Kawasaki', 'Triumph', 'BMW', 'Ducati', 'Aprilia', 'Benelli', 'MV Agusta'];
  for (const b of requiredBrands) {
    assert.ok(norm.MANUFACTURERS.some(m => m.name === b), `Brak wymaganej marki: ${b}`);
  }
  const brandsWithSerial400to650Multi = ['Honda', 'Yamaha', 'Suzuki', 'Kawasaki', 'Triumph', 'Benelli', 'MV Agusta'];
  for (const b of brandsWithSerial400to650Multi) {
    assert.ok(norm.MODELS.some(m => m.brand === b), `Brak modeli 400–650 cm³ dla marki: ${b}`);
  }
  assert.ok(norm.MODELS.length >= 90, `Oczekiwano >= 90 modeli w katalogu, znaleziono ${norm.MODELS.length}`);
  assert.ok(Object.keys(norm.ENGINES).length >= 80, `Oczekiwano >= 80 profili silników, znaleziono ${Object.keys(norm.ENGINES).length}`);
  assert.strictEqual(Object.keys(norm.PARAM_KEYS).length, 30, 'Oczekiwano 30 kluczy parametrów serwisowych');

  // Sprawdzenie obecności silników 3-cylindrowych i 4-cylindrowych, R3/R4/V4, gaźnikowych i EFI, powietrzem/olejem/cieczą
  assert.ok(norm.MODELS.some(m => m.cylinders === 3 && m.layout === 'R3'), 'Brak modeli 3-cylindrowych R3');
  assert.ok(norm.MODELS.some(m => m.cylinders === 4 && m.layout === 'R4'), 'Brak modeli 4-cylindrowych R4');
  assert.ok(norm.MODELS.some(m => m.cylinders === 4 && m.layout === 'V4'), 'Brak modeli 4-cylindrowych V4');
  assert.ok(norm.MODELS.some(m => m.fuelSystem === 'carb'), 'Brak modeli gaźnikowych');
  assert.ok(norm.MODELS.some(m => m.fuelSystem === 'efi'), 'Brak modeli EFI');
  assert.ok(norm.MODELS.some(m => m.cooling === 'air'), 'Brak modeli chłodzonych powietrzem');
  assert.ok(norm.MODELS.some(m => m.cooling === 'air-oil'), 'Brak modeli chłodzonych powietrzem i olejem');
  assert.ok(norm.MODELS.some(m => m.cooling === 'liquid'), 'Brak modeli chłodzonych cieczą');

  // 4. Weryfikacja 8 działów diagnostycznych A–H
  assert.strictEqual(api.DIAGNOSTIC_SECTIONS.length, 8, 'Oczekiwano 8 działów diagnostycznych A–H');
  assert.deepStrictEqual([...api.DIAGNOSTIC_SECTIONS.map(s => s.id)], ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  const totalProcs = api.DIAGNOSTIC_SECTIONS.reduce((acc, s) => acc + s.procedures.length, 0);
  assert.ok(totalProcs >= 45, `Oczekiwano co najmniej 45 procedur w działach A–H, znaleziono ${totalProcs}`);

  // 5. Weryfikacja 12 inteligentnych drzew diagnostycznych × 8 obowiązkowych punktów na każdy krok
  const sampleModel = norm.MODELS[0];
  const sampleEngine = norm.ENGINES[sampleModel.engineId];
  const trees = api.buildDiagnosticTrees({ model: sampleModel, engine: sampleEngine, params: sampleEngine.params });
  assert.strictEqual(trees.length, 12, 'Oczekiwano dokładnie 12 drzew objawowych');
  for (const t of trees) {
    const stepValues = Object.values(t.steps);
    assert.ok(stepValues.length >= 3, `Drzewo ${t.id} musi posiadać co najmniej 3 kroki`);
    for (const st of stepValues) {
      for (const reqField of ['check', 'how', 'tool', 'expected', 'abnormal', 'nextText', 'causes', 'repair']) {
        assert.ok(typeof st[reqField] === 'string' && st[reqField].length > 10, `Brak pola ${reqField} w drzewie ${t.id}`);
      }
    }
  }

  // 6. Weryfikacja diagnostyki porównawczej cylindrów (R3 = 3 kolumny, R4 = 4 kolumny) oraz Kalkulatora Płytek
  const sheetR3 = api.getMeasurementSheetForModel('triumph-street-triple-675-d67ld', 3);
  assert.strictEqual(sheetR3.cylinders.length, 3, 'Dla silnika R3 karta musi mieć 3 kolumny cylindrów');
  const sheetR4 = api.getMeasurementSheetForModel('honda-cbr600rr-pc37', 4);
  assert.strictEqual(sheetR4.cylinders.length, 4, 'Dla silnika R4 karta musi mieć 4 kolumny cylindrów');

  const compCheck = api.analyzeNumericRow(['12.8', '12.6', '9.1', '12.7'], 'bar', 1.5, 8.5);
  assert.strictEqual(compCheck.ready, true);
  assert.strictEqual(compCheck.status, 'warn', 'Rozrzut > 1.5 bar musi generować ostrzeżenie');
  assert.strictEqual(compCheck.deviations[3].warn, true, 'Cylinder 3 z kompresją 9.1 bar musi być oznaczony ostrzeżeniem');

  const shimCheck = api.calculateShim('0.10', '0.16', '0.20', '1.90');
  assert.strictEqual(shimCheck.valid, true);
  assert.strictEqual(shimCheck.inSpec, false);
  assert.strictEqual(shimCheck.exactNewShim, '1.820');

  // 7. Weryfikacja 7 schematów technicznych SVG i renderowania wszystkich 5 zakładek
  assert.strictEqual(api.TECHNICAL_SCHEMATICS.length, 7, 'Oczekiwano 7 autorskich schematów SVG');
  for (const tab of ['katalog', 'drzewa', 'cylindry', 'dzialy', 'schematy']) {
    sandbox.renderMulticyl(tab);
    assert.ok(fakeContainer.innerHTML.includes('NAPRAWNIK — MOTOCYKLE 3–4 CYLINDRY'), `Renderowanie zakładki ${tab} nie powiodło się`);
  }
  api.selectModel('s_gt550');
  api.setTab('cylindry');
  assert.ok(fakeContainer.innerHTML.includes('CYLINDER 3') && !fakeContainer.innerHTML.includes('CYLINDER 4'), 'R3 musi renderowac 3 kolumny');
  api.selectModel('h_cbr600rr_37');
  api.setTab('cylindry');
  assert.ok(fakeContainer.innerHTML.includes('CYLINDER 4'), 'R4 musi renderowac 4 kolumny');
  api.loadDemoMeasurements();
  assert.ok(fakeContainer.innerHTML.includes('Podparty zawór wydechowy na Cyl 3!'));
  api.clearMeasurements();
  api.setTab('katalog');
  api.saveCustomParam('compression');
  assert.ok(fakeContainer.innerHTML.includes('12.8 bar (A)') && fakeContainer.innerHTML.includes('POZIOM A • ZWERYFIKOWANE'));
  const countBefore = api.getData().MODELS.length;
  api.addCustomModel();
  assert.strictEqual(api.getData().MODELS.length, countBefore + 1);
  api.selectTree('no_spark');
  api.goToTreeStep('step_2');
  assert.ok(fakeContainer.innerHTML.includes('KROK 2: Pomiar czujnika położenia wału korbowego'));
  api.setTab('schematy');
  api.selectSchematic('sch_sync');
  api.zoomSchematic(25);
  assert.ok(fakeContainer.innerHTML.includes('125%'));
});

test('NAPRAWNIK MASTER — Zintegrowany system warsztatowy: diagnostyka różnicowa, trendy Lab, kontrola jakości, magazyn i powiązania', () => {
  const vm = require('node:vm');
  const html = read('index.html');
  const ktSrc = read('katalog-techniczny.js');
  const multiDataSrc = read('motocykle-multi-data.js');

  const fakeScreen = { innerHTML: '', scrollTop: 0, querySelector: () => null, querySelectorAll: () => [] };
  const fakeWindow = {
    navigator: { serviceWorker: { register: () => Promise.resolve({ addEventListener(){} }) } },
    document: {
      getElementById: (id) => id === 'screen' ? fakeScreen : { innerHTML: '', textContent: '', value: '', classList: { add(){}, remove(){}, toggle(){} }, style: {} },
      querySelector: (sel) => sel === '#screen' ? fakeScreen : { classList: { add(){}, remove(){}, toggle(){} }, dataset: { nav: 'home' } },
      querySelectorAll: () => [],
      createElement: () => ({ appendChild(){}, removeChild(){}, style: {}, setAttribute(){} }),
      body: { appendChild(){}, removeChild(){} },
      addEventListener: () => {}
    },
    location: { protocol: 'https:', href: 'https://example.test/', search: '' },
    localStorage: { _d: {}, getItem(k){ return this._d[k] || null; }, setItem(k,v){ this._d[k] = String(v); }, removeItem(k){ delete this._d[k]; } },
    addEventListener: () => {},
    scrollTo: () => {},
    setTimeout: () => {},
    setInterval: () => {},
    alert: () => {},
    console
  };
  fakeWindow.window = fakeWindow;
  fakeWindow.globalThis = fakeWindow;
  const ctx = vm.createContext(fakeWindow);
  const mainScript = html.match(/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/i)[1];
  vm.runInContext(mainScript, ctx);
  vm.runInContext(ktSrc, ctx);
  vm.runInContext(multiDataSrc, ctx);

  // 1. Klasyfikacja jakości A/B/C/U i matchVehicle w katalog-techniczny.js
  assert.ok(ctx.NAPRAWNIK_KATALOG.records.every(r => ['A','B','C','U'].includes(r.reliability)), 'Każdy rekord katalogu musi mieć klasyfikację A/B/C/U');
  const aeroxMatches = ctx.NAPRAWNIK_KATALOG.matchVehicle({ brand: 'Yamaha', model: 'Aerox 50', engine: '50 cm3 2T' });
  assert.ok(aeroxMatches.length >= 3, 'matchVehicle musi dopasować rekordy OEM dla Yamaha Aerox 50');

  // 2. matchModels i verify w motocykle-multi-data.js
  assert.strictEqual(ctx.NAPRAWNIK_MULTICYL_DATA.validate().length, 0);
  const atvMatch = ctx.NAPRAWNIK_MULTICYL_DATA.matchModels({ brand: 'Polaris', model: 'Sportsman 570' });
  assert.ok(atvMatch.some(m => m.id === 'pol_sportsman570'), 'matchModels musi dopasować quad Polaris Sportsman 570');
  assert.ok(ctx.NAPRAWNIK_MULTICYL_DATA.FAULTS.f_atv_cvu_belt_burn.verify.includes('Po naprawie'), 'Usterki muszą mieć procedurę kontroli po naprawie');

  // 3. Diagnostyka różnicowa: podział na potwierdzone / hipotezy / wykluczone
  const diffProfiles = vm.runInContext('DIFFERENTIAL_DIAG_PROFILES', ctx);
  ctx.setDiffTestStatus('t_spark_gap', 'ok');
  ctx.setDiffTestStatus('t_pickup', 'bad');
  const diffRes = ctx.evaluateDifferentialState(diffProfiles.brak_iskry);
  assert.ok(diffRes.confirmed.some(h => h.id === 'hyp_pickup'), 'Zły pomiar impulsatora musi potwierdzać hyp_pickup');
  assert.ok(diffRes.excluded.some(h => h.id === 'hyp_plug_cap'), 'Poprawna próba iskry musi wykluczyć hyp_plug_cap');

  // 4. Elektroniczne Laboratorium: analiza wielu pomiarów, usterki termiczne oraz trendy Przed/Po
  const diagLabEval = ctx.analyzeLabHistory([
    { presetId: 'impulsator', label: 'Impulsator', measuredValue: 165, unit: 'Ω', refMin: 100, refMax: 250, phase: 'before', tempCondition: 'cold' },
    { presetId: 'impulsator', label: 'Impulsator', measuredValue: 990, unit: 'Ω', refMin: 100, refMax: 250, phase: 'before', tempCondition: 'warm' }
  ]);
  assert.strictEqual(diagLabEval.thermalAlerts.length, 1, 'Analiza Lab musi wykryć usterkę termiczną (Zimny OK -> Gorący poza normą)');
  assert.ok(diagLabEval.nextRecommendation && diagLabEval.nextRecommendation.preset.id === 'stator_zasilanie', 'Lab musi wskazać następny zalecany pomiar');

  const postRepairEval = ctx.analyzeLabHistory([
    { presetId: 'impulsator', label: 'Impulsator', measuredValue: 165, unit: 'Ω', refMin: 100, refMax: 250, phase: 'before', tempCondition: 'cold' },
    { presetId: 'impulsator', label: 'Impulsator', measuredValue: 990, unit: 'Ω', refMin: 100, refMax: 250, phase: 'before', tempCondition: 'warm' },
    { presetId: 'impulsator', label: 'Impulsator', measuredValue: 168, unit: 'Ω', refMin: 100, refMax: 250, phase: 'after', tempCondition: 'warm' }
  ]);
  assert.strictEqual(postRepairEval.comparisons.length, 1, 'Analiza Lab musi porównać pomiary Przed i Po naprawie');
  assert.strictEqual(postRepairEval.comparisons[0].improved, true, 'Po naprawie pomiar powinien wrócić do normy');
  assert.strictEqual(postRepairEval.thermalAlerts.length, 0, 'Po naprawionym pomiarze alert termiczny powinien wygasnąć');

  // 5. Kontrola Jakości Napraw dla 8 typów
  const qualTypes = vm.runInContext('QUALITY_CHECKLISTS_BY_TYPE', ctx);
  for (const qt of ['sprzeglo','hamulce','zawieszenie','silnik','elektryka','paliwo','chlodzenie','przeglad']) {
    assert.ok(qualTypes[qt] && qualTypes[qt].steps.length >= 4, `Brak pełnej procedury kontroli jakości dla ${qt}`);
  }

  // 6. Zlecenia + Magazyn + Dodatkowe usterki (zaakceptowane vs odrzucone)
  const sampleOrder = {
    id: 'ord_test_1', status: 'w_trakcie', laborCost: 100, laborInternalCost: 40,
    partsList: [{ name: 'Pasek CVT', inventoryId: 'inv_1', qty: 2, costPrice: 50, unitPrice: 90, total: 180, totalCost: 100 }],
    extraFindings: [
      { id: 'ef1', desc: 'Króciec', estPrice: 80, estInternal: 40, consent: 'accepted' },
      { id: 'ef2', desc: 'Opona', estPrice: 300, estInternal: 200, consent: 'rejected' }
    ]
  };
  const ctxOrders = vm.runInContext('orders', ctx);
  ctxOrders.push(sampleOrder);
  ctx.recalculateOrderTotal(sampleOrder);
  assert.strictEqual(sampleOrder.totalCost, 360, 'Akceptowana usterka dodatkowa (+80) + części (180) + robocizna (100) = 360 zł; odrzucona nie wlicza się do rachunku');
  assert.strictEqual(sampleOrder.grossProfit, 180, 'Zysk czysty powinien uwzględniać hurtowe koszty części, zaakceptowanych dodatków i robocizny');
  const resMap = ctx.getInventoryReservations();
  assert.strictEqual(resMap['inv_1'], 2, 'Otwarte zlecenie musi rezerwować 2 szt. w magazynie');
});
