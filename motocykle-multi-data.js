/* NAPRAWNIK — MOTOCYKLE 3–4 CYLINDRY (400–650 cm³) — WARSTWA DANYCH
 * Oddzielone warstwy: PRODUCENCI → SILNIKI → MODELE (generacje/warianty) → PARAMETRY → USTERKI.
 * Procedury, drzewa i schematy znajdują się w motocykle-multi.js.
 *
 * ZASADA WIARYGODNOŚCI (bez zgadywania):
 *   A  – wartość potwierdzona przez mechanika w warsztacie (wpis użytkownika z podanym źródłem),
 *   B  – wartość powszechnie publikowana w literaturze serwisowej; potwierdź w instrukcji dla danego VIN/rocznika,
 *   C  – wartość orientacyjna (fora, wtórne źródła) – NIE używać jako jedynej podstawy decyzji,
 *   null – brak danych w bazie → pole oznaczone „WYMAGA WERYFIKACJI”.
 * Kody ramy/silnika z flagą codeVerified:false wymagają sprawdzenia na tabliczce / numerze silnika.
 */
(function (global) {
  'use strict';

  const SCHEMA_VERSION = 1;
  const CC_RANGE = { min: 400, max: 650 };

  // ---------- 1. PRODUCENCI (rozszerzalna lista) ----------
  const MANUFACTURERS = [
    { id: 'honda', name: 'Honda', country: 'Japonia', note: 'Pełne pokrycie rodzin CBR/CB/CBF 400–650 cm³ (R4 oraz V4 NC30/NC35).' },
    { id: 'yamaha', name: 'Yamaha', country: 'Japonia', note: 'Pełne pokrycie rodzin YZF-R6, FZ6, XJ6, XJ600, FZR/FZ/XJR 400–600 cm³ (R4).' },
    { id: 'suzuki', name: 'Suzuki', country: 'Japonia', note: 'Pełne pokrycie rodzin GSX-R, GSF Bandit, GSR, GSX-F, RF (R4) oraz klasycznych GT550 (R3 2T).' },
    { id: 'kawasaki', name: 'Kawasaki', country: 'Japonia', note: 'Pełne pokrycie rodzin ZX-6R/636/6RR, ZX-4R, ZXR400, ZZR400/600, GPZ/Zephyr (R4) oraz H1 500 (R3 2T).' },
    { id: 'triumph', name: 'Triumph', country: 'Wielka Brytania', note: 'W zakresie 400–650 cm³ obsługiwane są 4-cylindrowe TT600, Speed Four, Daytona 600 i Daytona 650 (646 cm³). Trzycylindrowe 675/660 przekraczają 650 cm³ (kandydaci do rozszerzenia zakresu).' },
    { id: 'bmw', name: 'BMW', country: 'Niemcy', note: 'Brak seryjnych modeli 3–4 cyl. w przedziale 400–650 cm³ (K75 = 740 cm³ R3). Marka aktywna w architekturze pod własne rekordy warsztatowe.' },
    { id: 'ducati', name: 'Ducati', country: 'Włochy', note: 'Brak seryjnych modeli 3–4 cyl. w przedziale 400–650 cm³ (Desmosedici/Panigale V4 > 990 cm³). Marka aktywna w architekturze.' },
    { id: 'aprilia', name: 'Aprilia', country: 'Włochy', note: 'Brak seryjnych modeli 3–4 cyl. w przedziale 400–650 cm³ (RS/Tuono 660 i RS 457 to R2). Marka aktywna w architekturze.' },
    { id: 'benelli', name: 'Benelli', country: 'Włochy / Chiny (QJ)', note: 'Czterocylindrowe modele rodziny TNT 600 / BN600 / BJ600 oraz klasyczne 500 Quattro.' },
    { id: 'mvagusta', name: 'MV Agusta', country: 'Włochy', note: 'Historyczne 600 Quattro Cilindri (592 cm³ R4). Trzycylindrowe F3/Brutale 675 przekraczają 650 cm³.' }
  ];

  // ---------- 2. SILNIKI ----------
  function P(v, conf, src) { return { v: v, conf: conf, src: src || '' }; }
  const SRC_LIT = 'Literatura serwisowa / dane publikowane publicznie – potwierdź w instrukcji serwisowej dla VIN';
  const SRC_COMM = 'Źródła warsztatowe wtórne – wartość orientacyjna (wymaga weryfikacji w DTR OEM)';
  const FIRING_I4 = P('1-2-4-3', 'B', 'Standardowa kolejność zapłonu rzędowych 4-cyl. (wał 180°) – potwierdź dla modelu');

  // Wszystkie 30 kluczy parametrów serwisowych
  const PARAM_KEYS = [
    ['compression', 'Kompresja (ciśnienie sprężania)', 'kPa / bar'],
    ['compressionDiff', 'Dopuszczalna różnica kompresji między cylindrami', 'kPa / bar / %'],
    ['valveIn', 'Luz zaworowy – ssący (zimny silnik)', 'mm'],
    ['valveEx', 'Luz zaworowy – wydechowy (zimny silnik)', 'mm'],
    ['oilPressure', 'Ciśnienie oleju', 'kPa @ obr/min, temp.'],
    ['fuelPressure', 'Ciśnienie paliwa (EFI)', 'kPa / bar'],
    ['floatLevel', 'Poziom pływaka / paliwa w komorze (gaźnik)', 'mm'],
    ['charging', 'Napięcie ładowania', 'V @ obr/min'],
    ['statorRes', 'Rezystancja uzwojeń stojana (faza–faza)', 'Ω'],
    ['coilPrimary', 'Rezystancja cewki – uzwojenie pierwotne', 'Ω'],
    ['coilSecondary', 'Rezystancja cewki – uzwojenie wtórne', 'kΩ'],
    ['ckpRes', 'Rezystancja czujnika położenia wału / pickup', 'Ω'],
    ['ectRes', 'Rezystancja czujnika temperatury (ECT)', 'Ω @ °C'],
    ['injectorRes', 'Rezystancja wtryskiwacza', 'Ω'],
    ['sparkPlug', 'Świeca zapłonowa', 'typ'],
    ['plugGap', 'Przerwa elektrod świecy', 'mm'],
    ['idleRpm', 'Obroty biegu jałowego', 'obr/min'],
    ['firing', 'Kolejność zapłonu', ''],
    ['torqueHead', 'Moment – śruby/nakrętki głowicy', 'Nm'],
    ['torqueCamCap', 'Moment – mostki wałków rozrządu', 'Nm'],
    ['torquePlug', 'Moment – świece zapłonowe', 'Nm'],
    ['torqueDrain', 'Moment – korek spustowy oleju', 'Nm'],
    ['oilCapacity', 'Pojemność oleju (z filtrem)', 'L'],
    ['coolantCapacity', 'Pojemność układu chłodzenia', 'L'],
    ['radCapPressure', 'Ciśnienie otwarcia korka chłodnicy', 'kPa / bar'],
    ['thermostatOpen', 'Temperatura otwarcia termostatu', '°C'],
    ['fanOn', 'Temperatura załączenia wentylatora', '°C'],
    ['valveInterval', 'Interwał kontroli luzów zaworowych', 'km'],
    ['oilInterval', 'Interwał wymiany oleju', 'km / miesiące'],
    ['plugInterval', 'Interwał wymiany świec', 'km']
  ];

  function E(id, o) {
    const base = {
      id: id, brand: '', code: null, codeVerified: false, cc: null, cyl: 4, layout: 'R4', stroke: 4,
      bore: null, strokeMm: null, cooling: 'liquid', fuel: 'carb', carbType: null, ignition: null,
      cam: 'DOHC (łańcuch)', valves: 16, params: {}, faults: [], dataNote: ''
    };
    const e = Object.assign(base, o);
    if (e.layout === 'R4' && e.stroke === 4 && !e.params.firing) e.params.firing = FIRING_I4;
    return e;
  }

  const ENGINES = [
    // ===== HONDA =====
    E('honda_pc19e', { brand: 'honda', code: 'PC19E', codeVerified: true, cc: 598, bore: 63, strokeMm: 48, carbType: '4× Keihin VD/VG (CV)', ignition: 'Elektroniczny (moduł zapłonowy)', params: {
      valveIn: P('0,13 – 0,19', 'C', SRC_COMM), valveEx: P('0,19 – 0,25', 'C', SRC_COMM),
      sparkPlug: P('NGK DPR8EA-9 / DPR9EA-9', 'B', SRC_LIT), plugGap: P('0,8 – 0,9', 'B', SRC_LIT),
      idleRpm: P('1200 ± 100', 'B', SRC_LIT), charging: P('13,5 – 15,0 V @ 5000 obr/min', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat', 'f_cct'] }),
    E('honda_pc25e', { brand: 'honda', code: 'PC25E', codeVerified: true, cc: 599, bore: 65, strokeMm: 45.2, carbType: '4× Keihin VP (34 mm CV)', ignition: 'Elektroniczny ICM', params: {
      valveIn: P('0,16 ± 0,03', 'B', SRC_LIT), valveEx: P('0,22 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EH-9', 'B', SRC_LIT), plugGap: P('0,8 – 0,9', 'B', SRC_LIT),
      idleRpm: P('1200 ± 100', 'B', SRC_LIT), oilCapacity: P('3,5 L (z filtrem)', 'B', SRC_LIT),
      charging: P('13,5 – 15,5 V @ 5000 obr/min', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat', 'f_cct'] }),
    E('honda_pc31e', { brand: 'honda', code: 'PC31E', codeVerified: true, cc: 599, bore: 65, strokeMm: 45.2, carbType: '4× Keihin VP (36 mm CV, DAIS)', ignition: 'Elektroniczny ICM (z czujnikiem TPS)', params: {
      valveIn: P('0,16 ± 0,03', 'B', SRC_LIT), valveEx: P('0,22 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EH-9', 'B', SRC_LIT), plugGap: P('0,8 – 0,9', 'B', SRC_LIT),
      idleRpm: P('1200 ± 100', 'B', SRC_LIT), oilCapacity: P('3,5 L (z filtrem)', 'B', SRC_LIT),
      charging: P('13,5 – 15,5 V @ 5000 obr/min', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat', 'f_stator_connector', 'f_cct'] }),
    E('honda_pc35e_carb', { brand: 'honda', code: 'PC35E', codeVerified: true, cc: 599, bore: 67, strokeMm: 42.5, carbType: '4× Keihin CVRD36', ignition: 'Cyfrowy 3D (cewki fajkowe COP)', dataNote: 'CBR600F4 (1999–2000, gaźnikowy).', params: {
      valveIn: P('0,16 ± 0,03', 'B', SRC_LIT), valveEx: P('0,22 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EH-9', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,5 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_rr_overheat', 'f_stator_connector', 'f_cct'] }),
    E('honda_pc35e_efi', { brand: 'honda', code: 'PC35E', codeVerified: true, cc: 599, bore: 67, strokeMm: 42.5, fuel: 'efi', ignition: 'Cyfrowy, sterowany przez ECU (PGM-FI, COP)', dataNote: 'CBR600F4i – wtrysk PGM-FI.', params: {
      valveIn: P('0,20 ± 0,03', 'B', SRC_LIT), valveEx: P('0,28 ± 0,03', 'B', SRC_LIT),
      fuelPressure: P('ok. 343 kPa (3,5 bar)', 'B', SRC_LIT), sparkPlug: P('NGK IMR9A-9H', 'B', SRC_LIT),
      idleRpm: P('1300 ± 100', 'B', SRC_LIT), oilCapacity: P('3,5 L (z filtrem)', 'B', SRC_LIT),
      charging: P('14,0 – 15,5 V @ 5000 obr/min', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT)
    }, faults: ['f_rr_overheat', 'f_stator_connector', 'f_tb_sync', 'f_coil_cap', 'f_cct'] }),
    E('honda_pc37e', { brand: 'honda', code: 'PC37E', codeVerified: true, cc: 599, bore: 67, strokeMm: 42.5, fuel: 'efi', ignition: 'Cyfrowy, ECU (PGM-DSFI – 8 wtryskiwaczy)', params: {
      compression: P('ok. 1220 kPa (12,2 bar) @ 350 obr/min', 'C', SRC_COMM),
      valveIn: P('0,20 ± 0,03', 'B', SRC_LIT), valveEx: P('0,28 ± 0,03', 'B', SRC_LIT),
      fuelPressure: P('ok. 343 kPa (3,5 bar)', 'B', SRC_LIT), sparkPlug: P('NGK IMR9C-9HES', 'B', SRC_LIT),
      idleRpm: P('1300 ± 100', 'B', SRC_LIT), oilCapacity: P('3,1 L (z filtrem)', 'B', SRC_LIT),
      charging: P('14,0 – 15,5 V @ 5000 obr/min', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT)
    }, faults: ['f_rr_overheat', 'f_stator_burn', 'f_stator_connector', 'f_cct', 'f_tb_sync'] }),
    E('honda_pc40e', { brand: 'honda', code: 'PC40E', codeVerified: true, cc: 599, bore: 67, strokeMm: 42.5, fuel: 'efi', ignition: 'Cyfrowy, ECU (PGM-DSFI)', params: {
      valveIn: P('0,20 ± 0,03', 'B', SRC_LIT), valveEx: P('0,28 ± 0,03', 'B', SRC_LIT),
      fuelPressure: P('ok. 343 kPa (3,5 bar)', 'B', SRC_LIT), sparkPlug: P('NGK IMR9C-9HES / IMR9E-9HES', 'B', SRC_LIT),
      idleRpm: P('1300 ± 100', 'B', SRC_LIT), oilCapacity: P('2,9 L (z filtrem)', 'B', SRC_LIT),
      valveInterval: P('24 000 km', 'B', SRC_LIT)
    }, faults: ['f_rr_overheat', 'f_stator_burn', 'f_stator_connector', 'f_cct'] }),
    E('honda_pc34e', { brand: 'honda', code: 'PC34E', codeVerified: true, cc: 599, bore: 65, strokeMm: 45.2, carbType: '4× Keihin VP04 (34 mm CV)', ignition: 'Elektroniczny ICM (2 cewki wasted spark)', dataNote: 'Silnik wywodzący się z CBR600F3, zestrojony na średni zakres.', params: {
      valveIn: P('0,16 ± 0,03', 'B', SRC_LIT), valveEx: P('0,22 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EH-9', 'B', SRC_LIT), plugGap: P('0,8 – 0,9', 'B', SRC_LIT),
      idleRpm: P('1300 ± 100', 'B', SRC_LIT), oilCapacity: P('3,6 L (z filtrem)', 'B', SRC_LIT),
      charging: P('13,5 – 15,5 V @ 5000 obr/min', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat', 'f_cct'] }),
    E('honda_pc36e', { brand: 'honda', code: 'PC36E', codeVerified: true, cc: 599, bore: 65, strokeMm: 45.2, carbType: '4× Keihin VP (34 mm CV)', ignition: 'Elektroniczny ICM', params: {
      valveIn: P('0,16 ± 0,03', 'B', SRC_LIT), valveEx: P('0,22 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EH-9', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,6 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat'] }),
    E('honda_pc41e', { brand: 'honda', code: 'PC41E', codeVerified: true, cc: 599, bore: 67, strokeMm: 42.5, fuel: 'efi', ignition: 'Cyfrowy, ECU (PGM-FI)', dataNote: 'Hornet 600 PC41 / CBR600F PC41 (silnik spokrewniony z CBR600RR PC40).', params: {
      valveIn: P('0,20 ± 0,03', 'B', SRC_LIT), valveEx: P('0,28 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EH-9', 'B', SRC_LIT), idleRpm: P('1350 ± 100', 'B', SRC_LIT),
      oilCapacity: P('2,8 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT)
    }, faults: ['f_rr_overheat', 'f_stator_connector', 'f_tb_sync'] }),
    E('honda_cbf600_carb', { brand: 'honda', code: 'PC38E', codeVerified: true, cc: 599, bore: 65, strokeMm: 45.2, carbType: '4× Keihin VP (34 mm CV)', ignition: 'Elektroniczny ICM', params: {
      valveIn: P('0,16 ± 0,03', 'B', SRC_LIT), valveEx: P('0,22 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EH-9', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat'] }),
    E('honda_cbf600_efi', { brand: 'honda', code: 'PC43E', codeVerified: true, cc: 599, bore: 67, strokeMm: 42.5, fuel: 'efi', ignition: 'Cyfrowy, ECU (PGM-FI)', params: {
      valveIn: P('0,20 ± 0,03', 'B', SRC_LIT), valveEx: P('0,28 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EH-9', 'B', SRC_LIT), idleRpm: P('1350 ± 100', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_rr_overheat'] }),
    E('honda_649_2014', { brand: 'honda', code: 'RC74E', codeVerified: true, cc: 649, bore: 67, strokeMm: 46, fuel: 'efi', ignition: 'Cyfrowy, ECU (PGM-FI)', dataNote: 'CB650F / CBR650F 2014–2018.', params: {
      valveIn: P('0,16 ± 0,03', 'B', SRC_LIT), valveEx: P('0,27 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EH-9', 'B', SRC_LIT), idleRpm: P('1280 ± 100', 'B', SRC_LIT),
      oilCapacity: P('2,9 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_cct'] }),
    E('honda_649_2019', { brand: 'honda', code: 'RH02E', codeVerified: true, cc: 649, bore: 67, strokeMm: 46, fuel: 'efi', ignition: 'Cyfrowy, ECU (PGM-FI)', dataNote: 'CB650R / CBR650R od 2019.', params: {
      valveIn: P('0,16 ± 0,03', 'B', SRC_LIT), valveEx: P('0,27 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK MAR9A-J', 'B', SRC_LIT), idleRpm: P('1280 ± 100', 'B', SRC_LIT),
      oilCapacity: P('2,6 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT)
    }, faults: ['f_tb_sync'] }),
    E('honda_pc20e', { brand: 'honda', code: 'PC20E', codeVerified: true, cc: 498, bore: 58.5, strokeMm: 46.3, carbType: '4× Keihin CV', ignition: 'Elektroniczny', dataNote: 'CBR500F (498 cm³ R4 na wybrane rynki, np. Austria/Meksyk).', faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat'] }),
    E('honda_rc03e', { brand: 'honda', code: 'RC03E', codeVerified: true, cc: 626, bore: 59.8, strokeMm: 55.8, cooling: 'air', cam: 'SOHC (łańcuch, śruby regulacyjne)', valves: 8, carbType: '4× Keihin', ignition: 'Elektroniczny (2 impulsatory + moduły OKI)', params: {
      valveIn: P('0,05', 'B', SRC_LIT), valveEx: P('0,08', 'B', SRC_LIT),
      sparkPlug: P('NGK DR8ES-L', 'B', SRC_LIT), idleRpm: P('1100 ± 100', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_stator_burn', 'f_cct'] }),
    E('honda_nc23e', { brand: 'honda', code: 'NC23E', codeVerified: true, cc: 399, bore: 55, strokeMm: 42, cam: 'DOHC – napęd kołami zębatymi (gear-driven)', ignition: 'Elektroniczny', faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat'] }),
    E('honda_nc29e', { brand: 'honda', code: 'NC29E', codeVerified: true, cc: 399, bore: 55, strokeMm: 42, cam: 'DOHC – napęd kołami zębatymi (gear-driven)', ignition: 'Elektroniczny', params: {
      valveIn: P('0,16 ± 0,03', 'C', SRC_COMM), valveEx: P('0,22 ± 0,03', 'C', SRC_COMM),
      sparkPlug: P('NGK CR8EH-9 / CR9EH-9', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat'] }),
    E('honda_nc31e', { brand: 'honda', code: 'NC31E', codeVerified: true, cc: 399, bore: 55, strokeMm: 42, ignition: 'Elektroniczny', faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat'] }),
    E('honda_nc39e', { brand: 'honda', code: 'NC39E', codeVerified: true, cc: 399, bore: 55, strokeMm: 42, cam: 'DOHC (łańcuch), HYPER VTEC', ignition: 'Elektroniczny', faults: ['f_carb_sync', 'f_pilot_jets', 'f_vtec_solenoid', 'f_rr_overheat'] }),
    E('honda_nc42e', { brand: 'honda', code: 'NC42E', codeVerified: true, cc: 399, bore: 55, strokeMm: 42, fuel: 'efi', cam: 'DOHC (łańcuch), HYPER VTEC Revo', ignition: 'Cyfrowy, ECU (PGM-FI)', faults: ['f_tb_sync', 'f_vtec_solenoid'] }),
    E('honda_nc27e', { brand: 'honda', code: 'NC27E', codeVerified: true, cc: 399, bore: 55, strokeMm: 42, cam: 'DOHC – napęd kołami zębatymi (gear-driven)', ignition: 'Elektroniczny', faults: ['f_carb_sync', 'f_pilot_jets'] }),
    E('honda_nc30e', { brand: 'honda', code: 'NC30E', codeVerified: true, cc: 399, layout: 'V4', bore: 55, strokeMm: 42, cam: 'DOHC – napęd kołami zębatymi (gear-driven)', ignition: 'Elektroniczny', params: {
      valveIn: P('0,16 ± 0,03', 'C', SRC_COMM), valveEx: P('0,25 ± 0,03', 'C', SRC_COMM), firing: P(null, null)
    }, dataNote: 'V4 90° (wał 360°). Synchronizacja 4 gaźników w układzie V – dostęp po zdjęciu zbiornika i airboksu.', faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat', 'f_v4_rear_heat'] }),
    E('honda_nc35e', { brand: 'honda', code: 'NC35E', codeVerified: true, cc: 399, layout: 'V4', bore: 55, strokeMm: 42, cam: 'DOHC – napęd kołami zębatymi (gear-driven)', ignition: 'Elektroniczny', dataNote: 'V4 90°.', faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat', 'f_v4_rear_heat'] }),
    E('honda_cb400four', { brand: 'honda', code: 'CB400FE', codeVerified: true, cc: 408, bore: 51, strokeMm: 50, cooling: 'air', cam: 'SOHC (łańcuch, śruby regulacyjne)', valves: 8, ignition: 'Stykowy (2 przerywacze 1-4 i 2-3 + kondensatory)', params: {
      valveIn: P('0,05', 'B', SRC_LIT), valveEx: P('0,05', 'B', SRC_LIT), idleRpm: P('1200 ± 100', 'B', SRC_LIT)
    }, faults: ['f_points', 'f_carb_sync', 'f_pilot_jets', 'f_cct'] }),
    E('honda_cb500four', { brand: 'honda', code: 'CB500E', codeVerified: true, cc: 498, bore: 56, strokeMm: 50.6, cooling: 'air', cam: 'SOHC (łańcuch, śruby regulacyjne)', valves: 8, ignition: 'Stykowy (przerywacze + kondensatory)', params: {
      valveIn: P('0,05', 'B', SRC_LIT), valveEx: P('0,08', 'B', SRC_LIT), idleRpm: P('1100 ± 100', 'B', SRC_LIT)
    }, faults: ['f_points', 'f_carb_sync', 'f_pilot_jets', 'f_cct'] }),
    E('honda_cb550four', { brand: 'honda', code: 'CB550E', codeVerified: true, cc: 544, bore: 58.5, strokeMm: 50.6, cooling: 'air', cam: 'SOHC (łańcuch, śruby regulacyjne)', valves: 8, ignition: 'Stykowy (przerywacze + kondensatory)', params: {
      valveIn: P('0,05', 'B', SRC_LIT), valveEx: P('0,08', 'B', SRC_LIT), idleRpm: P('1100 ± 100', 'B', SRC_LIT)
    }, faults: ['f_points', 'f_carb_sync', 'f_pilot_jets', 'f_cct'] }),
    E('honda_cbx550', { brand: 'honda', code: 'PC04E', codeVerified: true, cc: 572, cooling: 'air', valves: 16, ignition: 'Elektroniczny', faults: ['f_carb_sync', 'f_pilot_jets', 'f_cct'] }),

    // ===== YAMAHA =====
    E('yamaha_r6_5eb', { brand: 'yamaha', code: '5EB', codeVerified: true, cc: 600, bore: 65.5, strokeMm: 44.5, carbType: '4× Keihin CVRD37', ignition: 'TCI (cyfrowy, cewki COP)', dataNote: 'YZF-R6 1. gen. (1999–2002). Kontrola tulei cylindrów (znane ryzyko pęknięć gładzi w mocno eksploatowanych egzemplarzach).', params: {
      valveIn: P('0,11 – 0,20', 'B', SRC_LIT), valveEx: P('0,21 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EK / CR10EK', 'B', SRC_LIT), idleRpm: P('1250 – 1350', 'B', SRC_LIT),
      oilCapacity: P('2,7 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('40 000 km', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_cct', 'f_rr_overheat', 'f_second_gear_dogs'] }),
    E('yamaha_r6_5sl', { brand: 'yamaha', code: '5SL', codeVerified: true, cc: 600, bore: 65.5, strokeMm: 44.5, fuel: 'efi', ignition: 'Cyfrowy, ECU (COP)', params: {
      valveIn: P('0,11 – 0,20', 'B', SRC_LIT), valveEx: P('0,21 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EK / CR10EK', 'B', SRC_LIT), idleRpm: P('1250 – 1350', 'B', SRC_LIT),
      oilCapacity: P('2,6 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('40 000 km', 'B', SRC_LIT)
    }, faults: ['f_cct', 'f_tb_sync', 'f_rr_overheat', 'f_coil_cap'] }),
    E('yamaha_r6_2c0', { brand: 'yamaha', code: '2C0', codeVerified: true, cc: 599, bore: 67, strokeMm: 42.5, fuel: 'efi', ignition: 'Cyfrowy, ECU (YCC-T ride-by-wire)', params: {
      valveIn: P('0,11 – 0,20', 'B', SRC_LIT), valveEx: P('0,21 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK CR10EK', 'B', SRC_LIT), idleRpm: P('1250 – 1350', 'B', SRC_LIT),
      oilCapacity: P('2,6 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('40 000 km', 'B', SRC_LIT)
    }, faults: ['f_tight_ex_valves', 'f_tb_sync', 'f_rr_overheat', 'f_cct'] }),
    E('yamaha_r6_13s', { brand: 'yamaha', code: '13S', codeVerified: true, cc: 599, bore: 67, strokeMm: 42.5, fuel: 'efi', ignition: 'Cyfrowy, ECU (YCC-T, YCC-I)', params: {
      valveIn: P('0,11 – 0,20', 'B', SRC_LIT), valveEx: P('0,21 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK CR10EK', 'B', SRC_LIT), idleRpm: P('1250 – 1350', 'B', SRC_LIT),
      oilCapacity: P('2,6 L (z filtrem)', 'B', SRC_LIT)
    }, faults: ['f_tight_ex_valves', 'f_tb_sync', 'f_rr_overheat'] }),
    E('yamaha_r6_bn6', { brand: 'yamaha', code: 'BN6', codeVerified: true, cc: 599, bore: 67, strokeMm: 42.5, fuel: 'efi', ignition: 'Cyfrowy, ECU (YCC-T, YCC-I)', params: {
      valveIn: P('0,11 – 0,20', 'B', SRC_LIT), valveEx: P('0,21 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK CR10EK', 'B', SRC_LIT)
    }, faults: ['f_tight_ex_valves', 'f_tb_sync'] }),
    E('yamaha_fz6', { brand: 'yamaha', code: '5VX / 4P5', codeVerified: true, cc: 600, bore: 65.5, strokeMm: 44.5, fuel: 'efi', ignition: 'Cyfrowy, ECU (2 cewki wasted spark)', dataNote: 'Silnik wywodzący się z R6 (5SL), zmienione wałki i głowica.', params: {
      valveIn: P('0,11 – 0,20', 'B', SRC_LIT), valveEx: P('0,21 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EK', 'B', SRC_LIT), idleRpm: P('1250 – 1350', 'B', SRC_LIT),
      oilCapacity: P('2,8 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('40 000 km', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_cct', 'f_rr_overheat'] }),
    E('yamaha_xj6', { brand: 'yamaha', code: '20S', codeVerified: true, cc: 600, bore: 65.5, strokeMm: 44.5, fuel: 'efi', ignition: 'Cyfrowy, ECU', params: {
      valveIn: P('0,11 – 0,20', 'B', SRC_LIT), valveEx: P('0,21 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT), idleRpm: P('1250 – 1350', 'B', SRC_LIT),
      oilCapacity: P('2,8 L (z filtrem)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_rr_overheat'] }),
    E('yamaha_xj600s', { brand: 'yamaha', code: '4BR / 4LX', codeVerified: true, cc: 598, bore: 58.5, strokeMm: 55.7, cooling: 'air', valves: 8, carbType: '4× Mikuni BDST28', ignition: 'TCI', params: {
      valveIn: P('0,11 – 0,15', 'B', SRC_LIT), valveEx: P('0,16 – 0,20', 'B', SRC_LIT),
      sparkPlug: P('NGK CR8E / CR9E', 'B', SRC_LIT), idleRpm: P('1200 ± 50', 'B', SRC_LIT),
      oilCapacity: P('2,6 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_cct', 'f_rr_overheat', 'f_intake_boot_crack'] }),
    E('yamaha_yzf600r', { brand: 'yamaha', code: '4TV', codeVerified: true, cc: 599, bore: 62, strokeMm: 49.6, carbType: '4× Keihin CVKD36', ignition: 'TCI', params: {
      valveIn: P('0,11 – 0,20', 'B', SRC_LIT), valveEx: P('0,21 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT), idleRpm: P('1150 – 1250', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_cct', 'f_second_gear_dogs'] }),
    E('yamaha_fzr600', { brand: 'yamaha', code: '3HE / 4JH', codeVerified: true, cc: 599, ignition: 'TCI', faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat', 'f_second_gear_dogs'] }),
    E('yamaha_fzr400', { brand: 'yamaha', code: '1WG / 3TJ', codeVerified: true, cc: 399, ignition: 'TCI', faults: ['f_carb_sync', 'f_pilot_jets'] }),
    E('yamaha_xjr400', { brand: 'yamaha', code: '4HM', codeVerified: true, cc: 399, bore: 55, strokeMm: 42, cooling: 'air-oil', valves: 16, carbType: '4× Mikuni BS', ignition: 'TCI', faults: ['f_carb_sync', 'f_pilot_jets', 'f_intake_boot_crack'] }),
    E('yamaha_fz400_4yr', { brand: 'yamaha', code: '4YR', codeVerified: true, cc: 399, bore: 55, strokeMm: 42, carbType: '4× Keihin CV', ignition: 'TCI', faults: ['f_carb_sync', 'f_pilot_jets'] }),
    E('yamaha_xj550', { brand: 'yamaha', code: '4V8 / 5G5', codeVerified: true, cc: 528, bore: 57, strokeMm: 51.8, cooling: 'air', valves: 8, carbType: '4× Mikuni BS28', ignition: 'TCI', faults: ['f_carb_sync', 'f_pilot_jets', 'f_intake_boot_crack'] }),
    E('yamaha_fz600', { brand: 'yamaha', code: '2HW', codeVerified: true, cc: 598, cooling: 'air', valves: 8, ignition: 'TCI', faults: ['f_carb_sync', 'f_pilot_jets'] }),

    // ===== SUZUKI =====
    E('suzuki_gsxr600_srad', { brand: 'suzuki', code: 'N713', codeVerified: true, cc: 599, bore: 65.5, strokeMm: 44.5, carbType: '4× Mikuni BDSR36', ignition: 'Cyfrowy', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_stator_burn', 'f_rr_overheat', 'f_cct'] }),
    E('suzuki_gsxr600_k1', { brand: 'suzuki', code: 'N723', codeVerified: true, cc: 599, bore: 67, strokeMm: 42.5, fuel: 'efi', ignition: 'Cyfrowy, ECU (SDTV)', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      fuelPressure: P('ok. 300 kPa (3,0 bar)', 'B', SRC_LIT)
    }, faults: ['f_stator_burn', 'f_rr_overheat', 'f_tb_sync'] }),
    E('suzuki_gsxr600_k6', { brand: 'suzuki', code: 'N732', codeVerified: true, cc: 599, bore: 67, strokeMm: 42.5, fuel: 'efi', ignition: 'Cyfrowy, ECU (SDTV)', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EIA-9', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      fuelPressure: P('ok. 300 kPa (3,0 bar)', 'B', SRC_LIT), oilCapacity: P('2,7 L (z filtrem)', 'B', SRC_LIT),
      valveInterval: P('24 000 km', 'B', SRC_LIT)
    }, faults: ['f_stator_burn', 'f_rr_overheat', 'f_stator_connector', 'f_tb_sync'] }),
    E('suzuki_gsxr600_l1', { brand: 'suzuki', code: 'N746', codeVerified: true, cc: 599, bore: 67, strokeMm: 42.5, fuel: 'efi', ignition: 'Cyfrowy, ECU (SDTV)', params: {
      valveIn: P('0,08 – 0,18', 'B', SRC_LIT), valveEx: P('0,18 – 0,28', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EIA-9', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT)
    }, faults: ['f_stator_burn', 'f_rr_overheat', 'f_tb_sync'] }),
    E('suzuki_gsx600f', { brand: 'suzuki', code: 'N705 / N715', codeVerified: true, cc: 599, bore: 62.6, strokeMm: 48.7, cooling: 'air-oil', carbType: '4× Mikuni BSR32 / BST31', ignition: 'Elektroniczny (śruby regulacyjne zaworów w większości roczników)', dataNote: 'Chłodzenie powietrzno-olejowe SACS. Regulacja zaworów śrubami i nakrętkami kontrującymi.', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,18 – 0,23', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EK', 'B', SRC_LIT), idleRpm: P('1200 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,5 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('12 000 km', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat', 'f_leaky_needle_valve'] }),
    E('suzuki_gsf600', { brand: 'suzuki', code: 'N712 / N722', codeVerified: true, cc: 599, bore: 62.6, strokeMm: 48.7, cooling: 'air-oil', carbType: '4× Keihin CVR32 / Mikuni BSR32', ignition: 'Elektroniczny (2 cewki wasted spark)', dataNote: 'Chłodzenie powietrzno-olejowe SACS. Zawory regulowane śrubami.', params: {
      compression: P('1000 – 1500 kPa (10 – 15 bar), limit 800 kPa', 'B', SRC_LIT),
      compressionDiff: P('maks. 200 kPa (2,0 bar) między cylindrami', 'B', SRC_LIT),
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,18 – 0,23', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EK', 'B', SRC_LIT), idleRpm: P('1200 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,5 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('12 000 km', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat', 'f_stator_connector', 'f_leaky_needle_valve'] }),
    E('suzuki_gsf650_ao', { brand: 'suzuki', code: 'N731', codeVerified: true, cc: 656, bore: 65.5, strokeMm: 48.7, cooling: 'air-oil', carbType: '4× Keihin CVR32', ignition: 'Elektroniczny', dataNote: '656 cm³ – minimalnie powyżej 650; ujęty jako bezpośrednia kontynuacja serii Bandit 600.', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,18 – 0,23', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EK', 'B', SRC_LIT), idleRpm: P('1200 ± 100', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat'] }),
    E('suzuki_gsf650_lc', { brand: 'suzuki', code: 'N736', codeVerified: true, cc: 656, bore: 65.5, strokeMm: 48.7, fuel: 'efi', ignition: 'Cyfrowy, ECU (SDTV)', dataNote: '656 cm³ DOHC ciecz, regulacja zaworów płytkami.', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR8E / CR9E', 'B', SRC_LIT), idleRpm: P('1200 ± 100', 'B', SRC_LIT),
      valveInterval: P('24 000 km', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_rr_overheat', 'f_fuel_pump_strainer'] }),
    E('suzuki_gsr600', { brand: 'suzuki', code: 'N734', codeVerified: true, cc: 599, bore: 67, strokeMm: 42.5, fuel: 'efi', ignition: 'Cyfrowy, ECU (SDTV)', dataNote: 'Silnik wywodzący się z GSX-R600 K6.', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,6 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT)
    }, faults: ['f_stator_burn', 'f_rr_overheat', 'f_tb_sync'] }),
    E('suzuki_gsr400', { brand: 'suzuki', code: 'K719', codeVerified: true, cc: 398, bore: 54.5, strokeMm: 42.7, fuel: 'efi', ignition: 'Cyfrowy, ECU (SDTV)', faults: ['f_tb_sync', 'f_rr_overheat'] }),
    E('suzuki_rf600r', { brand: 'suzuki', code: 'N708', codeVerified: true, cc: 599, bore: 65, strokeMm: 45.2, carbType: '4× Mikuni BDST36', ignition: 'Elektroniczny', faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat', 'f_second_gear_dogs'] }),
    E('suzuki_gsx400_imp', { brand: 'suzuki', code: 'K715', codeVerified: true, cc: 399, carbType: '4× Mikuni', ignition: 'Elektroniczny', faults: ['f_carb_sync', 'f_pilot_jets'] }),
    E('suzuki_gsf400', { brand: 'suzuki', code: 'K707', codeVerified: true, cc: 398, bore: 56, strokeMm: 40.4, carbType: '4× Mikuni BST32/33', ignition: 'Elektroniczny (2 impulsatory / moduł CDI – znane wysychanie kondensatorów w module)', faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat'] }),
    E('suzuki_gsxr400', { brand: 'suzuki', code: 'K701 / K709', codeVerified: true, cc: 398, ignition: 'Elektroniczny', faults: ['f_carb_sync', 'f_pilot_jets'] }),
    E('suzuki_gs550', { brand: 'suzuki', code: 'GS550', codeVerified: true, cc: 549, bore: 56, strokeMm: 55.8, cooling: 'air', valves: 8, ignition: 'Stykowy / elektroniczny zależnie od rocznika', params: {
      valveIn: P('0,03 – 0,08', 'B', SRC_LIT), valveEx: P('0,03 – 0,08', 'B', SRC_LIT)
    }, faults: ['f_points', 'f_carb_sync', 'f_pilot_jets', 'f_cct', 'f_rr_overheat'] }),
    E('suzuki_gt550', { brand: 'suzuki', code: 'GT550', codeVerified: true, cc: 543, cyl: 3, layout: 'R3', stroke: 2, bore: 61, strokeMm: 62, cooling: 'air', cam: 'brak (2T – sterowanie tłokiem)', valves: 0, carbType: '3× Mikuni VM28SC', ignition: 'Stykowy (3 przerywacze 120°)', params: {
      firing: P('1-3-2 (co 120° obrotu wału)', 'B', SRC_LIT), sparkPlug: P('NGK B7ES / B8ES', 'B', SRC_LIT)
    }, dataNote: 'Dwusuw R3 z głowicą „Ram Air” i smarowaniem CCI. Procedury zaworowe nie dotyczą.', faults: ['f_points', 'f_carb_sync', 'f_2t_crank_seal', 'f_2t_oil_pump', 'f_starter_clutch'] }),

    // ===== KAWASAKI =====
    E('kawasaki_zx600f', { brand: 'kawasaki', code: 'ZX600FE', codeVerified: true, cc: 599, bore: 66, strokeMm: 43.8, carbType: '4× Keihin CVKD36', ignition: 'Cyfrowy IC', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,22 – 0,31', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT), idleRpm: P('1200 ± 50', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat', 'f_cct'] }),
    E('kawasaki_zx600g', { brand: 'kawasaki', code: 'ZX600GE', codeVerified: true, cc: 599, bore: 66, strokeMm: 43.8, carbType: '4× Mikuni BDSR36', ignition: 'Cyfrowy (COP)', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,22 – 0,31', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT), idleRpm: P('1300 ± 50', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_rr_overheat', 'f_second_gear_dogs'] }),
    E('kawasaki_zx600j', { brand: 'kawasaki', code: 'ZX600JE', codeVerified: true, cc: 599, bore: 66, strokeMm: 43.8, carbType: '4× Mikuni BDSR36', ignition: 'Cyfrowy (COP)', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,22 – 0,31', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT), idleRpm: P('1300 ± 50', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_rr_overheat', 'f_cct'] }),
    E('kawasaki_zx636a', { brand: 'kawasaki', code: 'ZX636AE', codeVerified: true, cc: 636, bore: 68, strokeMm: 43.8, carbType: '4× Mikuni BDSR36', ignition: 'Cyfrowy (COP)', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,22 – 0,31', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_rr_overheat', 'f_cct'] }),
    E('kawasaki_zx636b', { brand: 'kawasaki', code: 'ZX636BE', codeVerified: true, cc: 636, bore: 68, strokeMm: 43.8, fuel: 'efi', ignition: 'Cyfrowy, ECU (COP)', params: {
      valveIn: P('0,11 – 0,19', 'B', SRC_LIT), valveEx: P('0,22 – 0,31', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EK', 'B', SRC_LIT), idleRpm: P('1300 ± 50', 'B', SRC_LIT)
    }, faults: ['f_rr_overheat', 'f_tb_sync', 'f_cct', 'f_second_gear_dogs'] }),
    E('kawasaki_zx636c', { brand: 'kawasaki', code: 'ZX636CE', codeVerified: true, cc: 636, bore: 68, strokeMm: 43.8, fuel: 'efi', ignition: 'Cyfrowy, ECU (COP)', params: {
      valveIn: P('0,13 – 0,19', 'B', SRC_LIT), valveEx: P('0,24 – 0,31', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EK', 'B', SRC_LIT), idleRpm: P('1300 ± 50', 'B', SRC_LIT)
    }, faults: ['f_rr_overheat', 'f_tb_sync', 'f_cct'] }),
    E('kawasaki_zx600k', { brand: 'kawasaki', code: 'ZX600KE', codeVerified: true, cc: 599, bore: 66, strokeMm: 43.8, fuel: 'efi', ignition: 'Cyfrowy, ECU', dataNote: 'ZX-6RR (homologacja Supersport).', faults: ['f_rr_overheat', 'f_tb_sync'] }),
    E('kawasaki_zx600n', { brand: 'kawasaki', code: 'ZX600NE', codeVerified: true, cc: 599, bore: 66, strokeMm: 43.8, fuel: 'efi', ignition: 'Cyfrowy, ECU', dataNote: 'ZX-6RR.', faults: ['f_rr_overheat', 'f_tb_sync'] }),
    E('kawasaki_zx600p', { brand: 'kawasaki', code: 'ZX600PE', codeVerified: true, cc: 599, bore: 67, strokeMm: 42.5, fuel: 'efi', ignition: 'Cyfrowy, ECU', params: {
      valveIn: P('0,13 – 0,19', 'B', SRC_LIT), valveEx: P('0,24 – 0,31', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EIA-9', 'B', SRC_LIT), idleRpm: P('1300 ± 50', 'B', SRC_LIT)
    }, faults: ['f_rr_overheat', 'f_tb_sync', 'f_stator_connector'] }),
    E('kawasaki_zx600r', { brand: 'kawasaki', code: 'ZX600RE', codeVerified: true, cc: 599, bore: 67, strokeMm: 42.5, fuel: 'efi', ignition: 'Cyfrowy, ECU', params: {
      valveIn: P('0,13 – 0,19', 'B', SRC_LIT), valveEx: P('0,24 – 0,31', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EIA-9', 'B', SRC_LIT), idleRpm: P('1300 ± 50', 'B', SRC_LIT)
    }, faults: ['f_rr_overheat', 'f_tb_sync'] }),
    E('kawasaki_zx636e', { brand: 'kawasaki', code: 'ZX636EE', codeVerified: true, cc: 636, bore: 67, strokeMm: 45.1, fuel: 'efi', ignition: 'Cyfrowy, ECU', params: {
      valveIn: P('0,13 – 0,19', 'B', SRC_LIT), valveEx: P('0,24 – 0,31', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EIA-9', 'B', SRC_LIT), idleRpm: P('1300 ± 50', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_rr_overheat'] }),
    E('kawasaki_zx636g', { brand: 'kawasaki', code: 'ZX636EE', codeVerified: true, cc: 636, bore: 67, strokeMm: 45.1, fuel: 'efi', ignition: 'Cyfrowy, ECU', params: {
      valveIn: P('0,13 – 0,19', 'B', SRC_LIT), valveEx: P('0,24 – 0,31', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EIA-9', 'B', SRC_LIT)
    }, faults: ['f_tb_sync'] }),
    E('kawasaki_zx636_2024', { brand: 'kawasaki', code: 'ZX636JE', cc: 636, bore: 67, strokeMm: 45.1, fuel: 'efi', ignition: 'Cyfrowy, ECU', faults: ['f_tb_sync'] }),
    E('kawasaki_zx4r', { brand: 'kawasaki', code: 'ZX400PE', codeVerified: true, cc: 399, bore: 57, strokeMm: 39.1, fuel: 'efi', ignition: 'Cyfrowy, ECU', params: {
      sparkPlug: P('NGK LMAR9G', 'B', SRC_LIT), idleRpm: P('1300 ± 50', 'B', SRC_LIT)
    }, faults: ['f_tb_sync'] }),
    E('kawasaki_zzr600', { brand: 'kawasaki', code: 'ZX600DE / ZX600EE', codeVerified: true, cc: 599, bore: 64, strokeMm: 46.6, carbType: '4× Keihin CVKD36', ignition: 'Cyfrowy', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,22 – 0,31', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT), idleRpm: P('1150 ± 50', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat', 'f_cct', 'f_second_gear_dogs'] }),
    E('kawasaki_zzr400', { brand: 'kawasaki', code: 'ZX400KE', codeVerified: true, cc: 399, bore: 57.5, strokeMm: 38.5, carbType: '4× Keihin CVKD32', ignition: 'Cyfrowy', faults: ['f_carb_sync', 'f_pilot_jets', 'f_rr_overheat'] }),
    E('kawasaki_zxr400', { brand: 'kawasaki', code: 'ZX400GE', codeVerified: true, cc: 398, bore: 57, strokeMm: 39, carbType: '4× Keihin CVKD32', ignition: 'Cyfrowy', params: {
      valveIn: P('0,12 – 0,17', 'B', SRC_LIT), valveEx: P('0,16 – 0,21', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EK', 'B', SRC_LIT), idleRpm: P('1250 ± 50', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_head_gasket_multicyl'] }),
    E('kawasaki_gpz600r', { brand: 'kawasaki', code: 'ZX600AE', codeVerified: true, cc: 592, bore: 60, strokeMm: 52.4, carbType: '4× Keihin CVK32', ignition: 'Elektroniczny', params: {
      valveIn: P('0,13 – 0,18', 'B', SRC_LIT), valveEx: P('0,18 – 0,23', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_cct'] }),
    E('kawasaki_gpz550', { brand: 'kawasaki', code: 'KZ550DE', codeVerified: true, cc: 553, bore: 58, strokeMm: 52.4, cooling: 'air', valves: 8, ignition: 'Elektroniczny', faults: ['f_carb_sync', 'f_pilot_jets', 'f_cct'] }),
    E('kawasaki_zephyr550', { brand: 'kawasaki', code: 'KZ550DE', codeVerified: true, cc: 553, bore: 58, strokeMm: 52.4, cooling: 'air', valves: 8, carbType: '4× Keihin CVK30', ignition: 'Elektroniczny', params: {
      valveIn: P('0,08 – 0,18', 'B', SRC_LIT), valveEx: P('0,15 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK DR8ES / DR9EA', 'B', SRC_LIT)
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_cct', 'f_intake_boot_crack'] }),
    E('kawasaki_z400fx', { brand: 'kawasaki', code: 'KZ400EE', codeVerified: true, cc: 399, bore: 52, strokeMm: 47, cooling: 'air', valves: 8, ignition: 'Stykowy / elektroniczny zależnie od rocznika', faults: ['f_carb_sync', 'f_pilot_jets', 'f_points'] }),
    E('kawasaki_h1', { brand: 'kawasaki', code: 'KAE', codeVerified: true, cc: 498, cyl: 3, layout: 'R3', stroke: 2, bore: 60, strokeMm: 58.8, cooling: 'air', cam: 'brak (2T – sterowanie tłokiem)', valves: 0, carbType: '3× Mikuni VM28SC', ignition: 'CDI (rozdzielacz / 3 impulsatory) lub stykowy (H1D/E/F/KH500 – zależnie od wersji)', params: {
      firing: P('1-3-2 (co 120° obrotu wału)', 'B', SRC_LIT)
    }, dataNote: 'Dwusuw R3 (Mach III / KH500) z wtryskiem oleju Superlube. Procedury zaworowe nie dotyczą.', faults: ['f_2t_crank_seal', 'f_2t_oil_pump', 'f_carb_sync'] }),

    // ===== TRIUMPH =====
    E('triumph_tt600', { brand: 'triumph', code: null, cc: 599, bore: 68, strokeMm: 41.3, fuel: 'efi', ignition: 'Cyfrowy, ECU (Sagem MC1000)', params: {
      valveIn: P('0,15 – 0,20', 'B', SRC_LIT), valveEx: P('0,25 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EK', 'B', SRC_LIT), idleRpm: P('1200 ± 100', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_rr_overheat', 'f_stator_burn'] }),
    E('triumph_daytona650', { brand: 'triumph', code: null, cc: 646, bore: 68, strokeMm: 44.5, fuel: 'efi', ignition: 'Cyfrowy, ECU', params: {
      valveIn: P('0,15 – 0,20', 'B', SRC_LIT), valveEx: P('0,25 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EK', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_rr_overheat'] }),

    // ===== BENELLI =====
    E('benelli_600', { brand: 'benelli', code: 'BJ465MS-A', codeVerified: true, cc: 600, bore: 65, strokeMm: 45.2, fuel: 'efi', ignition: 'Cyfrowy, ECU (Delphi)', dataNote: 'Silnik R4 rodziny BN600 / TNT 600 / BJ600 (grupa QJ).', params: {
      valveIn: P('0,16 – 0,20', 'C', SRC_COMM), valveEx: P('0,25 – 0,30', 'C', SRC_COMM),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_rr_overheat', 'f_connectors_moisture'] }),
    E('benelli_500q', { brand: 'benelli', code: null, cc: 498, bore: 56, strokeMm: 50.6, cooling: 'air', cam: 'SOHC (łańcuch, śruby regulacyjne)', valves: 8, carbType: '4× Dell’Orto VHB', ignition: 'Stykowy (przerywacze + kondensatory)', faults: ['f_points', 'f_carb_sync', 'f_pilot_jets'] }),

    // ===== MV AGUSTA =====
    E('mv_600_4c', { brand: 'mvagusta', code: null, cc: 592, cooling: 'air', cam: 'DOHC – napęd kołami zębatymi', valves: 8, carbType: '4× Dell’Orto', ignition: 'Stykowy', dataNote: 'Motocykl kolekcjonerski – części i dane wyłącznie po weryfikacji źródłowej.', faults: ['f_carb_sync', 'f_points'] })
  ];

  // ---------- 3. MODELE (MARKA → MODEL → GENERACJA/ROCZNIK → KOD → WARIANT) ----------
  function M(id, brand, model, gen, from, to, frame, engine, variant, note) {
    return { id: id, brand: brand, model: model, gen: gen, years: [from, to], frame: frame, engine: engine, variant: variant || 'Standard', note: note || '' };
  }
  const MODELS = [
    // HONDA
    M('h_cbr600f1', 'honda', 'CBR600F Hurricane', 'F (1. gen.)', 1987, 1990, 'PC19 / PC23', 'honda_pc19e', 'Sport-turystyk, gaźniki'),
    M('h_cbr600f2', 'honda', 'CBR600F2', 'F2', 1991, 1994, 'PC25', 'honda_pc25e', 'Gaźniki'),
    M('h_cbr600f3', 'honda', 'CBR600F3', 'F3', 1995, 1998, 'PC31', 'honda_pc31e', 'Gaźniki, DAIS Ram-Air'),
    M('h_cbr600f4', 'honda', 'CBR600F4', 'F4 (gaźnik)', 1999, 2000, 'PC35', 'honda_pc35e_carb', 'Gaźniki, rama aluminiowa'),
    M('h_cbr600f4i', 'honda', 'CBR600F4i / F Sport', 'F4i (PGM-FI)', 2001, 2006, 'PC35', 'honda_pc35e_efi', 'Wtrysk PGM-FI (wersja F oraz F Sport)'),
    M('h_cbr600f_pc41', 'honda', 'CBR600F', 'PC41 (od 2011)', 2011, 2013, 'PC41', 'honda_pc41e', 'Sport-turystyk na bazie Horneta PC41, opcja C-ABS'),
    M('h_cbr600rr_37', 'honda', 'CBR600RR', 'PC37', 2003, 2006, 'PC37', 'honda_pc37e', 'Supersport, PGM-DSFI'),
    M('h_cbr600rr_40', 'honda', 'CBR600RR', 'PC40', 2007, 2024, 'PC40', 'honda_pc40e', 'Supersport (opcja C-ABS od 2009)'),
    M('h_hornet_34', 'honda', 'CB600F Hornet / Hornet S', 'PC34', 1998, 2002, 'PC34', 'honda_pc34e', 'Naked / S (półowiewka)'),
    M('h_hornet_36', 'honda', 'CB600F Hornet', 'PC36', 2003, 2006, 'PC36', 'honda_pc36e', 'Naked (od 2005 zawieszenie USD)'),
    M('h_hornet_41', 'honda', 'CB600F Hornet', 'PC41', 2007, 2013, 'PC41', 'honda_pc41e', 'Naked, PGM-FI, opcja C-ABS'),
    M('h_cbf600_c', 'honda', 'CBF600N / CBF600S', 'PC38 (gaźnikowa)', 2004, 2007, 'PC38', 'honda_cbf600_carb', 'N / S, opcja ABS'),
    M('h_cbf600_i', 'honda', 'CBF600N / CBF600S', 'PC43 (PGM-FI)', 2008, 2013, 'PC43', 'honda_cbf600_efi', 'N / S, aluminiowa rama, opcja C-ABS'),
    M('h_cb650f', 'honda', 'CB650F', 'RC74 / RC97', 2014, 2018, 'RC74 / RC97', 'honda_649_2014', 'Naked, ABS'),
    M('h_cbr650f', 'honda', 'CBR650F', 'RC74 / RC96', 2014, 2018, 'RC74 / RC96', 'honda_649_2014', 'Sport-turystyk, ABS'),
    M('h_cb650r', 'honda', 'CB650R', 'RH02 / RH15', 2019, 2025, 'RH02 / RH15', 'honda_649_2019', 'Neo Sports Café, ABS (od 2024 opcja E-Clutch)'),
    M('h_cbr650r', 'honda', 'CBR650R', 'RH01 / RH15', 2019, 2025, 'RH01 / RH15', 'honda_649_2019', 'Sport, ABS (od 2024 opcja E-Clutch)'),
    M('h_cbr500f_pc20', 'honda', 'CBR500F', 'PC20', 1987, 1991, 'PC20', 'honda_pc20e', 'Wersja 500 cm³ R4 (m.in. rynek AT)'),
    M('h_cb650_rc03', 'honda', 'CB650 / CB650Z / CB650C', 'RC03 / RC05', 1979, 1982, 'RC03 / RC05', 'honda_rc03e', 'Klasyk SOHC 626 cm³'),
    M('h_cb400sf_31', 'honda', 'CB400 Super Four', 'NC31', 1992, 1998, 'NC31', 'honda_nc31e', 'Naked (import JP)'),
    M('h_cb400sf_39', 'honda', 'CB400 Super Four', 'NC39 (HYPER VTEC I–III)', 1999, 2007, 'NC39', 'honda_nc39e', 'HYPER VTEC Spec I / II / III'),
    M('h_cb400sf_42', 'honda', 'CB400 Super Four / Super Bol d\u2019Or', 'NC42 (HYPER VTEC Revo)', 2008, 2022, 'NC42', 'honda_nc42e', 'PGM-FI'),
    M('h_cbr400rr_23', 'honda', 'CBR400RR Gull-Arm', 'NC23', 1988, 1989, 'NC23', 'honda_nc23e', 'Supersport 400 (rozrząd kołami zębatymi)'),
    M('h_cbr400rr_29', 'honda', 'CBR400RR FireBlade Baby', 'NC29', 1990, 1999, 'NC29', 'honda_nc29e', 'Supersport 400 (rozrząd kołami zębatymi)'),
    M('h_cb1', 'honda', 'CB-1 (CB400F)', 'NC27', 1989, 1991, 'NC27', 'honda_nc27e', 'Naked (rozrząd kołami zębatymi)'),
    M('h_vfr400r', 'honda', 'VFR400R', 'NC30', 1989, 1992, 'NC30', 'honda_nc30e', 'V4 Supersport (jednoramienny wahacz Pro-Arm)'),
    M('h_rvf400', 'honda', 'RVF400R', 'NC35', 1994, 1996, 'NC35', 'honda_nc35e', 'V4 Supersport (zawieszenie USD)'),
    M('h_cb400four', 'honda', 'CB400 Four Super Sport', 'CB400F', 1975, 1977, 'CB400F', 'honda_cb400four', 'Klasyk 408 cm³ SOHC'),
    M('h_cb500four', 'honda', 'CB500 Four', 'K0 / K1 / K2', 1971, 1978, 'CB500', 'honda_cb500four', 'Klasyk 498 cm³ SOHC'),
    M('h_cb550four', 'honda', 'CB550 Four / Super Sport', 'K / F', 1974, 1978, 'CB550', 'honda_cb550four', 'Klasyk 544 cm³ SOHC'),
    M('h_cbx550', 'honda', 'CBX550F / F2 Integra', 'PC04', 1982, 1986, 'PC04', 'honda_cbx550', 'Klasyk DOHC 16V, hamulce tarczowe zabudowane'),
    // YAMAHA
    M('y_r6_5eb', 'yamaha', 'YZF-R6', 'RJ03 (5EB / 5MT)', 1999, 2002, 'RJ03', 'yamaha_r6_5eb', 'Supersport, gaźniki'),
    M('y_r6_5sl', 'yamaha', 'YZF-R6 / YZF-R6S', 'RJ05 / RJ09 (5SL)', 2003, 2005, 'RJ05 / RJ09', 'yamaha_r6_5sl', 'Supersport, wtrysk paliwa'),
    M('y_r6_2c0', 'yamaha', 'YZF-R6', 'RJ11 (2C0)', 2006, 2007, 'RJ11', 'yamaha_r6_2c0', 'Supersport, YCC-T'),
    M('y_r6_13s', 'yamaha', 'YZF-R6', 'RJ15 (13S / 1JS)', 2008, 2016, 'RJ15', 'yamaha_r6_13s', 'Supersport, YCC-T + YCC-I'),
    M('y_r6_bn6', 'yamaha', 'YZF-R6', 'RJ27 (BN6)', 2017, 2020, 'RJ27', 'yamaha_r6_bn6', 'Supersport, TCS, ABS'),
    M('y_fz6', 'yamaha', 'FZ6 / FZ6 Fazer (S1 / S2)', 'RJ07 / RJ14', 2004, 2010, 'RJ07 / RJ14', 'yamaha_fz6', 'N / S / S2 (98 KM oraz 78 KM), opcja ABS'),
    M('y_xj6', 'yamaha', 'XJ6 / XJ6 Diversion / Diversion F', 'RJ19 / RJ22', 2009, 2016, 'RJ19 / RJ22', 'yamaha_xj6', 'N / S / F, opcja ABS'),
    M('y_xj600s', 'yamaha', 'XJ600S Diversion / XJ600N', '4BR / 4LX / RJ01', 1992, 2003, '4BR / RJ01', 'yamaha_xj600s', 'S (półowiewka) / N (od 1998 2 tarcze z przodu)'),
    M('y_thundercat', 'yamaha', 'YZF600R Thundercat', '4TV / 4WD', 1996, 2003, '4TV', 'yamaha_yzf600r', 'Sport-turystyk'),
    M('y_fzr600', 'yamaha', 'FZR600 / FZR600R Genesis', '3HE / 4JH', 1989, 1995, '3HE / 4JH', 'yamaha_fzr600', 'Sport'),
    M('y_fzr400', 'yamaha', 'FZR400 / FZR400RR', '1WG / 3TJ', 1986, 1994, '1WG / 3TJ', 'yamaha_fzr400', 'Supersport 400 (EXUP)'),
    M('y_xjr400', 'yamaha', 'XJR400 / XJR400R', '4HM', 1993, 2008, '4HM', 'yamaha_xjr400', 'Naked 400 DOHC 16V'),
    M('y_fz400', 'yamaha', 'FZ400', '4YR', 1997, 1999, '4YR', 'yamaha_fz400_4yr', 'Półowiewka 400'),
    M('y_xj550', 'yamaha', 'XJ550 / XJ550 Maxim / Seca', '4V8 / 5G5', 1981, 1984, '4V8', 'yamaha_xj550', 'Klasyk 528 cm³ YICS'),
    M('y_fz600', 'yamaha', 'FZ600', '2HW', 1986, 1988, '2HW', 'yamaha_fz600', 'Sport 598 cm³'),
    // SUZUKI
    M('s_gsxr600_srad', 'suzuki', 'GSX-R600 SRAD', 'AD (V–Y)', 1997, 2000, 'AD', 'suzuki_gsxr600_srad', 'Supersport, gaźniki'),
    M('s_gsxr600_k1', 'suzuki', 'GSX-R600', 'K1–K5 (BG / B2)', 2001, 2005, 'WVBG / WVB2', 'suzuki_gsxr600_k1', 'Supersport, SDTV EFI'),
    M('s_gsxr600_k6', 'suzuki', 'GSX-R600', 'K6–K7 (CE)', 2006, 2007, 'WVCE', 'suzuki_gsxr600_k6', 'Supersport'),
    M('s_gsxr600_k8', 'suzuki', 'GSX-R600', 'K8–L0 (CV)', 2008, 2010, 'WVCV', 'suzuki_gsxr600_k6', 'Supersport, S-DMS'),
    M('s_gsxr600_l1', 'suzuki', 'GSX-R600', 'L1+ (C3)', 2011, 2024, 'WVC3', 'suzuki_gsxr600_l1', 'Supersport, BPF Showa / Brembo'),
    M('s_katana600', 'suzuki', 'GSX600F Katana / Czajnik / Jajko', 'GN72A / AJ', 1988, 2006, 'GN72A / WVAJ', 'suzuki_gsx600f', 'Sport-turystyk SACS'),
    M('s_bandit600', 'suzuki', 'GSF600N / GSF600S Bandit', 'GN77A / WVA8', 1995, 2004, 'GN77A / WVA8', 'suzuki_gsf600', 'N / S (1. gen. 1995–1999, 2. gen. 2000–2004)'),
    M('s_bandit650_ao', 'suzuki', 'GSF650N / GSF650S Bandit', 'K5–K6 (WVB5)', 2005, 2006, 'WVB5', 'suzuki_gsf650_ao', 'N / S (ostatni olejak, gaźniki), opcja ABS'),
    M('s_bandit650_lc', 'suzuki', 'GSF650N / GSF650S Bandit', 'K7–L5 (WVCJ / WVCZ)', 2007, 2015, 'WVCJ / WVCZ', 'suzuki_gsf650_lc', 'N / S (chłodzony cieczą, wtrysk), opcja ABS'),
    M('s_gsx650f', 'suzuki', 'GSX650F', 'WVCJ', 2008, 2016, 'WVCJ', 'suzuki_gsf650_lc', 'Sport-turystyk z pełną owiewką, opcja ABS'),
    M('s_gsr600', 'suzuki', 'GSR600', 'WVB9', 2006, 2011, 'WVB9', 'suzuki_gsr600', 'Naked, opcja ABS'),
    M('s_gsr400', 'suzuki', 'GSR400', 'GK7DA / GK7EA', 2006, 2017, 'GK7DA / GK7EA', 'suzuki_gsr400', 'Naked 400 EFI (rynek JP)'),
    M('s_rf600r', 'suzuki', 'RF600R', 'GN76A / GN76B', 1993, 1997, 'GN76', 'suzuki_rf600r', 'Sport-turystyk'),
    M('s_gsx400_imp', 'suzuki', 'GSX400 Impulse', 'GK79A / GK7CA', 1994, 2008, 'GK79A', 'suzuki_gsx400_imp', 'Naked 400'),
    M('s_bandit400', 'suzuki', 'GSF400 Bandit', 'GK75A / GK7AA', 1989, 1997, 'GK75A', 'suzuki_gsf400', 'Naked 400 (w tym wersja VC ze zmiennymi fazami)'),
    M('s_gsxr400', 'suzuki', 'GSX-R400 / GSX-R400R', 'GK71 / GK73 / GK76A', 1984, 1997, 'GK71–GK76A', 'suzuki_gsxr400', 'Supersport 400'),
    M('s_gs550', 'suzuki', 'GS550 / GS550E / GS550Katana', 'GS550', 1977, 1986, 'GS550', 'suzuki_gs550', 'Klasyk DOHC 8V / 16V'),
    M('s_gt550', 'suzuki', 'GT550 Indy', 'GT550', 1972, 1977, 'GT550', 'suzuki_gt550', 'Klasyk 2T R3 Ram-Air'),
    // KAWASAKI
    M('k_zx6r_f', 'kawasaki', 'ZX-6R Ninja', 'ZX600F (F1–F3)', 1995, 1997, 'ZX600F', 'kawasaki_zx600f', 'Supersport'),
    M('k_zx6r_g', 'kawasaki', 'ZX-6R Ninja', 'ZX600G (G1–G2)', 1998, 1999, 'ZX600G', 'kawasaki_zx600g', 'Supersport'),
    M('k_zx6r_j', 'kawasaki', 'ZX-6R Ninja', 'ZX600J (J1–J3)', 2000, 2002, 'ZX600J', 'kawasaki_zx600j', 'Supersport (w wybranych krajach do 2008 jako ZZR600)'),
    M('k_zx6r_a636', 'kawasaki', 'ZX-6R Ninja 636', 'ZX636A (A1P)', 2002, 2002, 'ZX636A', 'kawasaki_zx636a', 'Supersport 636 cm³, gaźniki'),
    M('k_zx6r_b', 'kawasaki', 'ZX-6R Ninja 636', 'ZX636B (B1H–B2H)', 2003, 2004, 'ZX636B', 'kawasaki_zx636b', 'Supersport 636 cm³, wtrysk'),
    M('k_zx6rr_k', 'kawasaki', 'ZX-6RR', 'ZX600K / M', 2003, 2004, 'ZX600K', 'kawasaki_zx600k', 'Homologacja 599 cm³, sprzęgło antyhoppingowe'),
    M('k_zx6r_c', 'kawasaki', 'ZX-6R Ninja 636', 'ZX636C (C1H / C6F)', 2005, 2006, 'ZX636C', 'kawasaki_zx636c', 'Supersport 636 cm³, wydech pod siedzeniem'),
    M('k_zx6rr_n', 'kawasaki', 'ZX-6RR', 'ZX600N', 2005, 2006, 'ZX600N', 'kawasaki_zx600n', 'Homologacja 599 cm³'),
    M('k_zx6r_p', 'kawasaki', 'ZX-6R Ninja', 'ZX600P (P7F–P8F)', 2007, 2008, 'ZX600P', 'kawasaki_zx600p', 'Supersport 599 cm³'),
    M('k_zx6r_r', 'kawasaki', 'ZX-6R Ninja', 'ZX600R (R9F–RCF)', 2009, 2012, 'ZX600R', 'kawasaki_zx600r', 'Supersport 599 cm³, widelec BPF'),
    M('k_zx6r_e', 'kawasaki', 'ZX-6R Ninja 636', 'ZX636E / F', 2013, 2018, 'ZX636E / F', 'kawasaki_zx636e', 'Supersport 636 cm³, KTRC, opcja KIBS ABS'),
    M('k_zx6r_g636', 'kawasaki', 'ZX-6R Ninja 636', 'ZX636G', 2019, 2023, 'ZX636G', 'kawasaki_zx636g', 'Supersport, KQS quickshifter'),
    M('k_zx6r_2024', 'kawasaki', 'ZX-6R Ninja 636', 'ZX636J', 2024, 2025, 'ZX636J', 'kawasaki_zx636_2024', 'Supersport (Euro 5+)'),
    M('k_zx4r', 'kawasaki', 'Ninja ZX-4R / ZX-4RR', 'ZX400P / S', 2023, 2025, 'ZX400P', 'kawasaki_zx4r', 'Supersport 400 R4 (R / SE / RR)'),
    M('k_zzr600', 'kawasaki', 'ZZR600', 'ZX600D / ZX600E', 1990, 2006, 'ZX600D / E', 'kawasaki_zzr600', 'Sport-turystyk'),
    M('k_zzr400', 'kawasaki', 'ZZR400', 'ZX400K / ZX400N', 1990, 2006, 'ZX400K / N', 'kawasaki_zzr400', 'Sport-turystyk 400'),
    M('k_zxr400', 'kawasaki', 'ZXR400 / ZXR400R', 'ZX400H / L / M', 1989, 1999, 'ZX400H / L', 'kawasaki_zxr400', 'Supersport 400'),
    M('k_gpz600r', 'kawasaki', 'GPZ600R Ninja', 'ZX600A', 1985, 1990, 'ZX600A', 'kawasaki_gpz600r', 'Sport (pierwszy Ninja 600)'),
    M('k_gpz550', 'kawasaki', 'GPZ550 / Z550', 'KZ550D / H / ZX550A', 1980, 1985, 'KZ550 / ZX550A', 'kawasaki_gpz550', 'Klasyk 553 cm³'),
    M('k_zephyr550', 'kawasaki', 'ZR550 Zephyr', 'ZR550B', 1990, 1999, 'ZR550B', 'kawasaki_zephyr550', 'Retro naked'),
    M('k_z400fx', 'kawasaki', 'Z400FX / Z400J', 'KZ400E / J', 1979, 1983, 'KZ400E / J', 'kawasaki_z400fx', 'Klasyk 400 R4'),
    M('k_h1', 'kawasaki', '500 H1 Mach III / KH500', 'H1 / H1A–F / KH500A8', 1969, 1976, 'KAE / H1', 'kawasaki_h1', 'Klasyk 2T R3'),
    // TRIUMPH
    M('t_tt600', 'triumph', 'TT600', '806AD', 2000, 2003, '806AD', 'triumph_tt600', 'Supersport R4'),
    M('t_speedfour', 'triumph', 'Speed Four', '806LB', 2002, 2006, '806LB', 'triumph_tt600', 'Naked R4 na bazie TT600'),
    M('t_daytona600', 'triumph', 'Daytona 600', '806LW', 2003, 2004, '806LW', 'triumph_tt600', 'Supersport R4'),
    M('t_daytona650', 'triumph', 'Daytona 650', '865LX', 2005, 2005, '865LX', 'triumph_daytona650', 'Supersport R4 646 cm³'),
    // BENELLI
    M('b_tnt600', 'benelli', 'TNT 600 / BN600i / BN600R', 'P16', 2013, 2020, null, 'benelli_600', 'Naked R4'),
    M('b_tnt600gt', 'benelli', 'TNT 600 GT / BN600GT', '–', 2014, 2018, null, 'benelli_600', 'Turystyczny R4'),
    M('b_bj600gs', 'benelli', 'BJ600GS / QJ600GS', '–', 2012, 2020, null, 'benelli_600', 'Wersja azjatycka R4'),
    M('b_500q', 'benelli', '500 Quattro / 504 Sport', '–', 1974, 1980, null, 'benelli_500q', 'Klasyk SOHC R4'),
    // MV AGUSTA
    M('mv_600', 'mvagusta', '600 Quattro Cilindri (600 4C)', '–', 1966, 1972, null, 'mv_600_4c', 'Turystyczny – kolekcjonerski R4')
  ];

  // ---------- 4. TYPOWE USTERKI (biblioteka) ----------
  const FAULTS = {
    f_carb_sync: { title: 'Rozsynchronizowane gaźniki (bateria 3–4 gaźników)', sec: 'B', conf: 'B', desc: 'Nierówne podciśnienie w króćcach → nierówny bieg jałowy, powolne schodzenie z obrotów, wibracje i szarpanie przy małym otwarciu przepustnicy.', fix: 'Synchronizacja 3–4 wakuometrami (zegarowymi, słupkowymi lub elektronicznymi) względem cylindra bazowego po wcześniejszej regulacji luzów zaworowych.' },
    f_tb_sync: { title: 'Rozsynchronizowane przepustnice (EFI)', sec: 'B', conf: 'B', desc: 'Różnica podciśnienia między gardzielami – falujące obroty biegu jałowego, szarpanie przy dodawaniu gazu (on/off throttle).', fix: 'Synchronizacja śrubami obejściowymi powietrza (air bypass screws) wg procedury producenta na rozgrzanym silniku.' },
    f_pilot_jets: { title: 'Zapchane dysze wolnych obrotów (pilot jets)', sec: 'B', conf: 'B', desc: 'Po postoju osady z paliwa zatykają kalibrowane otwory dysz wolnych obrotów – jeden lub dwa kolektory wydechowe są zimne na biegu jałowym, silnik pracuje tylko na ssaniu.', fix: 'Demontaż baterii gaźników, myjka ultradźwiękowa, przedmuchanie kanałów powietrznych i paliwowych, wymiana o-ringów śrub składu mieszanki.' },
    f_leaky_needle_valve: { title: 'Nieszczelne zaworki iglicowe pływaków i kranik podciśnieniowy', sec: 'B', conf: 'B', desc: 'Przelewanie komory pływakowej – zalewanie cylindra, paliwo spływające do airboksu lub do skrzyni korbowej (rozcieńczenie oleju benzyną, ryzyko blokady hydraulicznej!).', fix: 'Wymiana zaworków iglicowych i o-ringów gniazd, kontrola wysokości pływaków, test szczelności membrany kranika podciśnieniowego oraz wymiana oleju, jeśli pachnie paliwem.' },
    f_intake_boot_crack: { title: 'Spękane króćce ssące / nieszczelność dolotu', sec: 'B', conf: 'B', desc: 'Zasysanie „lewego powietrza” za gaźnikiem/przepustnicą – zubożenie mieszanki na danym cylindrze, zawieszanie się obrotów przy ~3000–4000 obr/min, strzały w wydech.', fix: 'Kontrola stanu gum króćców, o-ringów pod króćcami i zaślepek króćców wakuometru; wymiana spękanych króćców.' },
    f_fuel_pump_strainer: { title: 'Zabrudzony filtr/sitko pompy paliwa lub spadek ciśnienia EFI', sec: 'B', conf: 'B', desc: 'Spadek ciśnienia na listwie wtryskowej pod obciążeniem – silnik krztusi się i nie wkręca powyżej 8000–10000 obr/min.', fix: 'Pomiar ciśnienia paliwa manometrem z trójnikiem (zwykle ok. 3,0–3,5 bar), czyszczenie/wymiana sitka pompy i kontrola regulatora ciśnienia.' },
    f_rr_overheat: { title: 'Przegrzewanie / awaria regulatora napięcia (R/R)', sec: 'E', conf: 'B', desc: 'Regulatory bocznikowe (SCR) pracują pod dużym obciążeniem cieplnym; awaria powoduje brak ładowania (<13 V) lub przeładowanie (>15,5 V, gotowanie akumulatora i ryzyko uszkodzenia ECU).', fix: 'Pomiar napięcia ładowania przy 5000 obr/min, test diod regulatora i napięcia AC stojana; oczyszczenie styków lub montaż regulatora MOSFET FH020AA.' },
    f_stator_burn: { title: 'Przepalony stojan alternatora 3-fazowego', sec: 'E', conf: 'B', desc: 'Zwarcie międzyzwojowe lub przebicie uzwojenia do masy – spadek napięcia AC na jednej parze faz i spadek ładowania na rozgrzanym silniku.', fix: 'Pomiar napięcia AC faza–faza (3 kombinacje: >55–70 V AC @ 5000 obr/min), rezystancji (0,2–1,0 Ω) oraz braku przejścia do masy; wymiana stojana.' },
    f_stator_connector: { title: 'Nadtopione 3-pinowe złącze stojan–regulator', sec: 'E', conf: 'B', desc: 'Śniedź i luz na konektorach 3 żółtych przewodów fazowych powodują grzanie kostki, stopienie izolacji i zwarcie międzyfazowe.', fix: 'Wycięcie uszkodzonej kostki, zastosowanie hermetycznego złącza wysokoprądowego (np. Metri-Pack / Furukawa) lub połączenie lutowane w koszulce z klejem.' },
    f_cct: { title: 'Zużyty napinacz łańcucha rozrządu (CCT)', sec: 'A', conf: 'B', desc: 'Metaliczne grzechotanie z okolic tunelu łańcucha rozrządu przy schodzeniu z obrotów (ok. 3000–5000 obr/min) lub na zimnym silniku.', fix: 'Weryfikacja wysunięcia trzpienia napinacza i stanu ślizgów; wymiana napinacza i kontrola wyciągnięcia łańcucha oraz znaków rozrządu.' },
    f_tight_ex_valves: { title: 'Zaciskanie się luzów zaworów wydechowych', sec: 'A', conf: 'B', desc: 'Osiadanie zaworów w gniazdach zmniejsza luz zaworowy do zera → niedomykanie zaworu na gorąco, trudny rozruch ciepłego silnika, spadek kompresji i wypalenie przylgni.', fix: 'Pomiar szczelinomierzem na zimnym silniku i korekta grubości płytek regulacyjnych (shims).' },
    f_coil_cap: { title: 'Przebicie cewki fajkowej (COP) lub fajki WN w głębokiej studni świecy', sec: 'C', conf: 'B', desc: 'Wilgoć lub mikropęknięcie izolacji cewki ołówkowej powoduje przeskok iskry do głowicy – wypadanie zapłonu pod obciążeniem.', fix: 'Oględziny gumowych uszczelnień, test zamiany cewki na sąsiedni cylinder, pomiar rezystancji uzwojeń i wymiana uszkodzonej cewki/fajki.' },
    f_vtec_solenoid: { title: 'Usterka załączania układu HYPER VTEC', sec: 'A', conf: 'C', desc: 'Brak przejścia z trybu 2-zaworowego na 4-zaworowy powyżej progu obr/min (zwykle ~6300–6750 obr/min) – wyczuwalny spadek mocy.', fix: 'Kontrola ciśnienia oleju, sitka i rezystancji elektrozaworu VTEC, temperatury cieczy (VTEC blokowany na zimnym silniku) oraz sygnału prędkości.' },
    f_v4_rear_heat: { title: 'Obciążenie cieplne tylnego rzędu cylindrów V4', sec: 'D', conf: 'B', desc: 'Tylne cylindry (w pobliżu kolektorów i pod zbiornikiem) pracują w wyższej temperaturze – przyspieszone starzenie fajek, przewodów i króćców.', fix: 'Szczegółowa kontrola świec, fajek i króćców tylnej głowicy oraz drożności układu chłodzenia.' },
    f_points: { title: 'Wypalone styki przerywacza / uszkodzony kondensator', sec: 'C', conf: 'B', desc: 'Iskrzenie na przerywaczu (1–4 lub 2–3 w R4, albo 1/2/3 w R3), niestabilny kąt wyprzedzenia zapłonu, zanik iskry na parze cylindrów.', fix: 'Wymiana lub wyrównanie styków, wymiana kondensatora (ok. 0,22 µF), regulacja przerwy (0,3–0,4 mm) i ustawienie zapłonu lampą stroboskopową.' },
    f_2t_crank_seal: { title: 'Nieszczelny uszczelniacz wału korbowego (2T R3)', sec: 'A', conf: 'B', desc: 'Zasysanie powietrza (od strony alternatora) lub oleju przekładniowego (od strony sprzęgła) przez jeden cylinder – ryzyko zatarcia tłoka.', fix: 'Próba ciśnieniowo-podciśnieniowa poszczególnych sekcji skrzyni korbowej, wymiana uszczelniaczy wału.' },
    f_2t_oil_pump: { title: 'Niedrożność przewodów lub zła regulacja pompy oleju (2T R3)', sec: 'A', conf: 'B', desc: 'Pęcherze powietrza w przewodach olejowych do cylindrów/łożysk wału – niedosmarowanie pojedynczego cylindra.', fix: 'Odpowietrzenie układu smarowania, kontrola zaworków zwrotnych Banjo i synchronizacja dźwigni pompy ze znakiem na przepustnicach.' },
    f_connectors_moisture: { title: 'Korozja złączy wiązki i słabe punkty masowe', sec: 'E', conf: 'B', desc: 'Spadki napięcia na złączach czujników i masie ramy/silnika – błędne wskazania temperatury, szarpanie i błędy ECU.', fix: 'Pomiar spadku napięcia pod obciążeniem (<0,1 V), oczyszczenie punktów masowych i zabezpieczenie złączy.' },
    f_second_gear_dogs: { title: 'Wypadanie 2. biegu pod obciążeniem (zużycie kłów sprzęgłowych)', sec: 'F', conf: 'B', desc: 'Szarpnięcie lub wyskoczenie na luz przy ostrym przyspieszaniu na 2. biegu – zaokrąglone kły (dog teeth) kół zębatych 2./6. biegu i wygięty wodzik.', fix: 'Demontaż skrzyni biegów, wymiana pary współpracujących kół zębatych (lub podcięcie kłów – undercutting), wymiana wodzików i kontrola bębna programatora.' },
    f_head_gasket_multicyl: { title: 'Przedmuch uszczelki pod głowicą między cylindrami lub do płaszcza wodnego', sec: 'A', conf: 'B', desc: 'Symetrycznie niska kompresja na dwóch sąsiednich cylindrach (np. 1–2 lub 2–3) albo wyrzucanie płynu chłodzącego do zbiorniczka pod obciążeniem.', fix: 'Próba Leak Down, test obecności CO₂ w chłodnicy, pomiar płaskości głowicy (limit zwykle 0,05 mm) i montaż nowej uszczelki z dokręceniem na krzyż kluczem dynamometrycznym.' },
    f_starter_clutch: { title: 'Ślizgające się sprzęgło jednokierunkowe rozrusznika', sec: 'F', conf: 'B', desc: 'Rozrusznik kręci z metalicznym zgrzytem, ale nie obraca wałem korbowym (szczególnie na zimnym oleju lub przy słabym akumulatorze).', fix: 'Kontrola rolkowego/sprzęgiełkowego mechanizmu wolnego koła, sprężynek dociskowych i bieżni koła pośredniego.' }
  };

  // ---------- 5. WALIDACJA DANYCH ----------
  function validate() {
    const errors = [];
    const engineIds = new Set();
    ENGINES.forEach(e => {
      if (engineIds.has(e.id)) errors.push('Duplikat silnika: ' + e.id);
      engineIds.add(e.id);
      if (!MANUFACTURERS.some(m => m.id === e.brand)) errors.push('Nieznany producent silnika: ' + e.id);
      if (![3, 4].includes(e.cyl)) errors.push('Nieobsługiwana liczba cylindrów: ' + e.id);
      if (e.cc !== null && (e.cc < CC_RANGE.min - 5 || e.cc > CC_RANGE.max + 10)) errors.push('Pojemność poza zakresem: ' + e.id);
      e.faults.forEach(f => { if (!FAULTS[f]) errors.push('Nieznana usterka ' + f + ' w ' + e.id); });
      Object.keys(e.params).forEach(k => { if (!PARAM_KEYS.some(p => p[0] === k)) errors.push('Nieznany parametr ' + k + ' w ' + e.id); });
    });
    const modelIds = new Set();
    const dedupe = new Set();
    MODELS.forEach(m => {
      if (modelIds.has(m.id)) errors.push('Duplikat modelu: ' + m.id);
      modelIds.add(m.id);
      const key = m.brand + '|' + m.model + '|' + m.gen + '|' + m.years.join('-');
      if (dedupe.has(key)) errors.push('Zduplikowany wpis: ' + key);
      dedupe.add(key);
      if (!engineIds.has(m.engine)) errors.push('Model bez silnika: ' + m.id);
      if (m.years[0] > m.years[1]) errors.push('Błędny zakres lat: ' + m.id);
    });
    return errors;
  }

  global.NAPRAWNIK_MULTICYL_DATA = {
    SCHEMA_VERSION, CC_RANGE, MANUFACTURERS, ENGINES, MODELS, FAULTS, PARAM_KEYS, validate
  };
})(typeof window !== 'undefined' ? window : globalThis);
