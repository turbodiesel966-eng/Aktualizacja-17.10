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
  const CC_RANGE = { min: 50, max: 2500 };

  // ---------- 1. PRODUCENCI (rozszerzalna lista) ----------
  const MANUFACTURERS = [
    { id: 'honda', name: 'Honda', country: 'Japonia', note: 'Pełne pokrycie rodzin CBR/CB/CBF 400–650 cm³ (R4 oraz V4 NC30/NC35).' },
    { id: 'yamaha', name: 'Yamaha', country: 'Japonia', note: 'Pełne pokrycie rodzin YZF-R6, FZ6, XJ6, XJ600, FZR/FZ/XJR 400–600 cm³ (R4).' },
    { id: 'suzuki', name: 'Suzuki', country: 'Japonia', note: 'Pełne pokrycie rodzin GSX-R, GSF Bandit, GSR, GSX-F, RF (R4) oraz klasycznych GT550 (R3 2T).' },
    { id: 'kawasaki', name: 'Kawasaki', country: 'Japonia', note: 'Pełne pokrycie rodzin ZX-6R/636/6RR, ZX-4R, ZXR400, ZZR400/600, GPZ/Zephyr (R4) oraz H1 500 (R3 2T).' },
    { id: 'triumph', name: 'Triumph', country: 'Wielka Brytania', note: 'W zakresie 400–650 cm³ obsługiwane są 4-cylindrowe TT600, Speed Four, Daytona 600 i Daytona 650 (646 cm³). Trzycylindrowe 675/660 przekraczają 650 cm³ (kandydaci do rozszerzenia zakresu).' },
    { id: 'bmw', name: 'BMW', country: 'Niemcy', note: 'Pełne pokrycie modeli: Boxer R1150/R1200/R1250/R1300GS, rzędowe S1000RR/XR, F800/F850/F900, K75 R3 oraz K1200/K1300/K1600.' },
    { id: 'ktm', name: 'KTM', country: 'Austria', note: 'Pełne pokrycie modeli: 1-cylindrowe LC4 (690 Duke/SMC/Enduro), rzędowe dwucylindrowe LC8c (790/890) oraz widlaste 75° V2 LC8 (990, 1190, 1290, 1390).' },
    { id: 'ducati', name: 'Ducati', country: 'Włochy', note: 'Pełne pokrycie modeli: Desmodue (Monster 696/796/1100), Testastretta (821/939/1198), Superquadro (1199/1299), DVT oraz Desmosedici Stradale / Granturismo V4.' },
    { id: 'aprilia', name: 'Aprilia', country: 'Włochy', note: 'Pełne pokrycie modeli: 60° V2 Rotax V990 (RSV Mille/Tuono), 90° V2 (Shiver/Dorsoduro 750/900), R2 270° (RS 660) oraz 65° V4 (RSV4 / Tuono V4 1000/1100).' },
    { id: 'benelli', name: 'Benelli', country: 'Włochy / Chiny (QJ)', note: 'Czterocylindrowe modele rodziny TNT 600 / BN600 / BJ600 oraz klasyczne 500 Quattro.' },
    { id: 'mvagusta', name: 'MV Agusta', country: 'Włochy', note: 'Historyczne 600 Quattro Cilindri (592 cm³ R4). Trzycylindrowe F3/Brutale 675 przekraczają 650 cm³.' },
    { id: 'polaris', name: 'Polaris', country: 'USA', note: 'Quady ATV i pojazdy UTV: Sportsman 570/850/1000, Scrambler, RZR 900/1000 EFI.' },
    { id: 'canam', name: 'Can-Am (BRP)', country: 'Kanada', note: 'Pojazdy ATV/UTV: Outlander 450/570/650/850/1000, Renegade, Commander, Maverick z silnikami Rotax V-Twin.' },
    { id: 'cfmoto', name: 'CF Moto', country: 'Chiny', note: 'Quady i UTV: CForce 450/520/625/850/1000, UForce, ZForce z wtryskiem Bosch EFI i przekładnią CVTech.' },
    { id: 'piaggio', name: 'Piaggio / Vespa', country: 'Włochy', note: 'Skutery i maksiskutery: silniki Leader (125–200), Quasar (250–300), HPE oraz Master 500.' },
    { id: 'kymco', name: 'Kymco', country: 'Tajwan', note: 'Skutery, maksiskutery i quady: Agility 50/125, Downtown 300/350, Xciting 400/500, AK550 (R2) oraz MXU 450/700.' },
    { id: 'sym', name: 'SYM', country: 'Tajwan', note: 'Skutery miejskie i turystyczne: GTS 125/250/300, Joyride, Cruisym 300, Maxsym 400/600.' },
    { id: 'minarelli', name: 'Minarelli / Derbi', country: 'Włochy / Hiszpania', note: 'Dwusuwowe silniki motorowerowe AM6 i D50B0 (50 cm³ 2T ciecz) oraz skutery poziome 2T.' },
    { id: 'gy6', name: 'GY6 (139QMB / 152QMI)', country: 'Uniwersalne / Azja', note: 'Czterosuwowe silniki skuterowe 50 cm³ i 125 cm³ 4T powietrze z przekładnią bezstopniową CVT.' }
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
    E('mv_600_4c', { brand: 'mvagusta', code: null, cc: 592, cooling: 'air', cam: 'DOHC – napęd kołami zębatymi', valves: 8, carbType: '4× Dell’Orto', ignition: 'Stykowy', dataNote: 'Motocykl kolekcjonerski – części i dane wyłącznie po weryfikacji źródłowej.', faults: ['f_carb_sync', 'f_points'] }),

    // ===== ROZSZERZENIE POJEMNOŚCI I MAREK (650 – >1300 cm³, 1–4 CYL) =====
    // HONDA
    E('honda_re01e', { brand: 'honda', code: 'RE01E', codeVerified: true, cc: 649, cyl: 1, layout: 'Single', bore: 100, strokeMm: 82.6, valves: 4, cam: 'SOHC 4V', carbType: 'Keihin 40 mm (Pusher)', ignition: 'Cyfrowy CDI', params: {
      valveIn: P('0,15 ± 0,02', 'B', SRC_LIT), valveEx: P('0,20 ± 0,02', 'B', SRC_LIT),
      compression: P('1050 kPa (10,5 bar)', 'B', SRC_LIT), sparkPlug: P('NGK BKPR6E-11', 'B', SRC_LIT),
      idleRpm: P('1400 ± 100', 'B', SRC_LIT), oilCapacity: P('2,0 L', 'B', SRC_LIT),
      charging: P('13,5 – 15,0 V @ 5000 obr/min', 'B', SRC_LIT), firing: P('1', 'B', SRC_LIT)
    }, faults: ['f_tight_ex_valves', 'f_pilot_jets'] }),

    E('honda_rd16e', { brand: 'honda', code: 'RD16E', codeVerified: true, cc: 755, cyl: 2, layout: 'R2', bore: 87, strokeMm: 63.5, valves: 8, cam: 'Unicam 8V (270°)', fuel: 'efi', ignition: 'ECU PGM-FI (Ride-by-wire)', params: {
      valveIn: P('0,16 ± 0,03', 'B', SRC_LIT), valveEx: P('0,25 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK SILMAR8A9S', 'B', SRC_LIT), idleRpm: P('1250 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,8 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT),
      fuelPressure: P('ok. 343 kPa (3,5 bar)', 'B', SRC_LIT), firing: P('1-2 (270°)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_stator_burn'] }),

    E('honda_rc46e', { brand: 'honda', code: 'RC46E', codeVerified: true, cc: 782, cyl: 4, layout: 'V4', bore: 72, strokeMm: 48, valves: 16, cam: 'DOHC 16V HYPER VTEC', fuel: 'efi', ignition: 'ECU PGM-FI (COP)', params: {
      valveIn: P('0,20 ± 0,03', 'B', SRC_LIT), valveEx: P('0,35 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK IMR9B-9H', 'B', SRC_LIT), idleRpm: P('1200 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,8 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT),
      fuelPressure: P('ok. 343 kPa (3,5 bar)', 'B', SRC_LIT), firing: P('1-3-2-4', 'B', SRC_LIT)
    }, faults: ['f_vtec_solenoid', 'f_v4_rear_heat', 'f_rr_overheat', 'f_stator_connector', 'f_cct'] }),

    E('honda_sc50e', { brand: 'honda', code: 'SC50E', codeVerified: true, cc: 954, cyl: 4, layout: 'R4', bore: 75, strokeMm: 54, valves: 16, cam: 'DOHC 16V', fuel: 'efi', ignition: 'ECU PGM-FI (COP)', params: {
      valveIn: P('0,16 ± 0,03', 'B', SRC_LIT), valveEx: P('0,27 ± 0,03', 'B', SRC_LIT),
      compression: P('1250 kPa (12,5 bar)', 'B', SRC_LIT), sparkPlug: P('NGK IMR9C-9H', 'B', SRC_LIT),
      idleRpm: P('1200 ± 100', 'B', SRC_LIT), oilCapacity: P('3,7 L (z filtrem)', 'B', SRC_LIT),
      fuelPressure: P('ok. 343 kPa (3,5 bar)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_rr_overheat', 'f_stator_connector', 'f_cct', 'f_tb_sync'] }),

    E('honda_sc57e', { brand: 'honda', code: 'SC57E', codeVerified: true, cc: 998, cyl: 4, layout: 'R4', bore: 75, strokeMm: 56.5, valves: 16, cam: 'DOHC 16V', fuel: 'efi', ignition: 'ECU PGM-DSFI (8 wtryskiwaczy)', params: {
      valveIn: P('0,16 ± 0,03', 'B', SRC_LIT), valveEx: P('0,27 ± 0,03', 'B', SRC_LIT),
      compression: P('1220 kPa (12,2 bar)', 'B', SRC_LIT), sparkPlug: P('NGK IMR9C-9HES', 'B', SRC_LIT),
      idleRpm: P('1200 ± 100', 'B', SRC_LIT), oilCapacity: P('3,8 L (z filtrem)', 'B', SRC_LIT),
      fuelPressure: P('ok. 343 kPa (3,5 bar)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_stator_burn', 'f_rr_overheat', 'f_stator_connector', 'f_cct'] }),

    E('honda_sc42e', { brand: 'honda', code: 'SC42E', codeVerified: true, cc: 1137, cyl: 4, layout: 'R4', bore: 79, strokeMm: 58, valves: 16, cam: 'DOHC 16V (podwójny wałek balansu)', fuel: 'efi', ignition: 'ECU PGM-FI', params: {
      valveIn: P('0,16 ± 0,03', 'B', SRC_LIT), valveEx: P('0,22 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EHVX-9', 'B', SRC_LIT), idleRpm: P('1100 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,9 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT),
      fuelPressure: P('ok. 343 kPa (3,5 bar)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_cct', 'f_rr_overheat', 'f_stator_connector'] }),

    E('honda_sd08e', { brand: 'honda', code: 'SD08E', codeVerified: true, cc: 1084, cyl: 2, layout: 'R2', bore: 92, strokeMm: 81.5, valves: 8, cam: 'Unicam 8V (270°)', fuel: 'efi', ignition: 'ECU PGM-FI (Ride-by-wire)', params: {
      valveIn: P('0,16 ± 0,03', 'B', SRC_LIT), valveEx: P('0,26 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK SILMAR8A9S', 'B', SRC_LIT), idleRpm: P('1200 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,0 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT),
      fuelPressure: P('ok. 343 kPa (3,5 bar)', 'B', SRC_LIT), firing: P('1-2 (270°)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_connectors_moisture'] }),

    E('honda_sc54e', { brand: 'honda', code: 'SC54E', codeVerified: true, cc: 1284, cyl: 4, layout: 'R4', bore: 78, strokeMm: 67.2, valves: 16, cam: 'DOHC 16V', fuel: 'efi', ignition: 'ECU PGM-FI', params: {
      valveIn: P('0,16 ± 0,03', 'B', SRC_LIT), valveEx: P('0,27 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK DPR8EA-9', 'B', SRC_LIT), idleRpm: P('1000 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,0 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT),
      firing: FIRING_I4
    }, faults: ['f_tb_sync', 'f_stator_connector'] }),

    E('honda_sc63e', { brand: 'honda', code: 'SC63E', codeVerified: true, cc: 1237, cyl: 4, layout: 'V4', bore: 81, strokeMm: 60, valves: 16, cam: 'Unicam 16V (76° V4)', fuel: 'efi', ignition: 'ECU PGM-FI (Ride-by-wire)', params: {
      valveIn: P('0,20 ± 0,03', 'B', SRC_LIT), valveEx: P('0,28 ± 0,03', 'B', SRC_LIT),
      sparkPlug: P('NGK IMR9E-9HES', 'B', SRC_LIT), idleRpm: P('1150 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,0 L (z filtrem)', 'B', SRC_LIT), firing: P('1-4-3-2', 'B', SRC_LIT)
    }, faults: ['f_v4_rear_heat', 'f_tb_sync'] }),

    E('honda_sc79e', { brand: 'honda', code: 'SC79E', codeVerified: true, cc: 1833, cyl: 6, layout: 'R6', bore: 73, strokeMm: 73, valves: 24, cam: 'Unicam 24V (Boxer B6)', fuel: 'efi', ignition: 'ECU PGM-FI (Ride-by-wire)', params: {
      valveIn: P('0,17 ± 0,02', 'B', SRC_LIT), valveEx: P('0,22 ± 0,02', 'B', SRC_LIT),
      sparkPlug: P('NGK CR6HIX-9', 'B', SRC_LIT), idleRpm: P('750 ± 50', 'B', SRC_LIT),
      oilCapacity: P('4,6 L (z filtrem)', 'B', SRC_LIT), firing: P('1-4-3-6-2-5', 'B', SRC_LIT)
    }, faults: ['f_connectors_moisture'] }),

    // YAMAHA
    E('yamaha_5vk', { brand: 'yamaha', code: '5VK', codeVerified: true, cc: 660, cyl: 1, layout: 'Single', bore: 100, strokeMm: 84, valves: 4, cam: 'SOHC 4V', fuel: 'efi', ignition: 'TCI Cyfrowy', params: {
      valveIn: P('0,09 – 0,13', 'B', SRC_LIT), valveEx: P('0,16 – 0,20', 'B', SRC_LIT),
      compression: P('1000 kPa (10,0 bar)', 'B', SRC_LIT), sparkPlug: P('NGK CR7E', 'B', SRC_LIT),
      idleRpm: P('1350 ± 100', 'B', SRC_LIT), oilCapacity: P('2,6 L', 'B', SRC_LIT),
      firing: P('1', 'B', SRC_LIT)
    }, faults: ['f_tight_ex_valves', 'f_tb_sync'] }),

    E('yamaha_m401e', { brand: 'yamaha', code: 'M401E', codeVerified: true, cc: 689, cyl: 2, layout: 'R2', bore: 80, strokeMm: 68.6, valves: 8, cam: 'DOHC 8V (CP2 270°)', fuel: 'efi', ignition: 'TCI Cyfrowy', params: {
      valveIn: P('0,11 – 0,20', 'B', SRC_LIT), valveEx: P('0,24 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK LMAR8A-9', 'B', SRC_LIT), idleRpm: P('1250 ± 100', 'B', SRC_LIT),
      oilCapacity: P('2,6 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('40 000 km', 'B', SRC_LIT),
      firing: P('1-2 (270°)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_connectors_moisture'] }),

    E('yamaha_n701e', { brand: 'yamaha', code: 'N701E', codeVerified: true, cc: 847, cyl: 3, layout: 'R3', bore: 78, strokeMm: 59.1, valves: 12, cam: 'DOHC 12V (CP3 120°)', fuel: 'efi', ignition: 'TCI YCC-T (Ride-by-wire)', params: {
      valveIn: P('0,11 – 0,20', 'B', SRC_LIT), valveEx: P('0,26 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CPR9EA-9', 'B', SRC_LIT), idleRpm: P('1150 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,4 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('40 000 km', 'B', SRC_LIT),
      firing: P('1-2-3 (120°)', 'B', SRC_LIT)
    }, faults: ['f_cp3_cam_chain_tensioner', 'f_tb_sync', 'f_coil_cap'] }),

    E('yamaha_5ps', { brand: 'yamaha', code: '5PS', codeVerified: true, cc: 897, cyl: 2, layout: 'R2', bore: 92, strokeMm: 67.5, valves: 10, cam: 'DOHC 10V (5V/cyl, 270°)', fuel: 'efi', ignition: 'TCI', params: {
      valveIn: P('0,11 – 0,20', 'B', SRC_LIT), valveEx: P('0,21 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK DPR8EA-9', 'B', SRC_LIT), idleRpm: P('1150 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,9 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (270°)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_rr_overheat'] }),

    E('yamaha_5pw', { brand: 'yamaha', code: '5PW', codeVerified: true, cc: 998, cyl: 4, layout: 'R4', bore: 74, strokeMm: 58, valves: 20, cam: 'DOHC 20V (5V/cyl Genesis)', fuel: 'efi', ignition: 'TCI (COP)', params: {
      valveIn: P('0,11 – 0,20', 'B', SRC_LIT), valveEx: P('0,21 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT), idleRpm: P('1150 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,8 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_stator_burn', 'f_rr_overheat', 'f_cct', 'f_second_gear_dogs'] }),

    E('yamaha_14b', { brand: 'yamaha', code: '14B', codeVerified: true, cc: 998, cyl: 4, layout: 'R4', bore: 78, strokeMm: 52.2, valves: 16, cam: 'DOHC 16V (Crossplane CP4)', fuel: 'efi', ignition: 'TCI YCC-T/YCC-I', params: {
      valveIn: P('0,09 – 0,17', 'B', SRC_LIT), valveEx: P('0,18 – 0,23', 'B', SRC_LIT),
      sparkPlug: P('NGK LMAR9E-J', 'B', SRC_LIT), idleRpm: P('1200 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,9 L (z filtrem)', 'B', SRC_LIT), firing: P('1-3-2-4 (Crossplane)', 'B', SRC_LIT)
    }, faults: ['f_cct', 'f_stator_burn', 'f_coil_cap', 'f_tb_sync'] }),

    E('yamaha_rn16', { brand: 'yamaha', code: 'RN16', codeVerified: true, cc: 998, cyl: 4, layout: 'R4', bore: 77, strokeMm: 53.6, valves: 20, cam: 'DOHC 20V (5V/cyl)', fuel: 'efi', ignition: 'TCI', params: {
      valveIn: P('0,11 – 0,20', 'B', SRC_LIT), valveEx: P('0,21 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EK', 'B', SRC_LIT), idleRpm: P('1150 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,8 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_stator_burn', 'f_tb_sync', 'f_rr_overheat'] }),

    E('yamaha_dp01', { brand: 'yamaha', code: 'DP01', codeVerified: true, cc: 1199, cyl: 2, layout: 'R2', bore: 98, strokeMm: 79.5, valves: 8, cam: 'DOHC 8V (270°)', fuel: 'efi', ignition: 'TCI (2 świece/cyl)', params: {
      valveIn: P('0,11 – 0,20', 'B', SRC_LIT), valveEx: P('0,21 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK CPR8EB-9', 'B', SRC_LIT), idleRpm: P('1100 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,2 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (270°)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_cct'] }),

    E('yamaha_rp06', { brand: 'yamaha', code: 'RP06', codeVerified: true, cc: 1251, cyl: 4, layout: 'R4', bore: 79, strokeMm: 63.8, valves: 16, cam: 'DOHC 16V', cooling: 'air-oil', carbType: '4× Mikuni BSR37 / EFI', ignition: 'TCI', params: {
      valveIn: P('0,11 – 0,15', 'B', SRC_LIT), valveEx: P('0,16 – 0,20', 'B', SRC_LIT),
      sparkPlug: P('NGK DPR8EA-9', 'B', SRC_LIT), idleRpm: P('1050 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,2 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_intake_boot_crack', 'f_carb_sync', 'f_pilot_jets'] }),

    E('yamaha_rp23', { brand: 'yamaha', code: 'RP23', codeVerified: true, cc: 1298, cyl: 4, layout: 'R4', bore: 79, strokeMm: 66.2, valves: 16, cam: 'DOHC 16V', fuel: 'efi', ignition: 'TCI (YCC-T)', params: {
      valveIn: P('0,15 – 0,22', 'B', SRC_LIT), valveEx: P('0,18 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK CPR8EA-9', 'B', SRC_LIT), idleRpm: P('1050 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,9 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_tb_sync', 'f_cct'] }),

    E('yamaha_rp21', { brand: 'yamaha', code: 'RP21', codeVerified: true, cc: 1679, cyl: 4, layout: 'V4', bore: 90, strokeMm: 66, valves: 16, cam: 'DOHC 16V (65° V4)', fuel: 'efi', ignition: 'TCI YCC-T/YCC-I', params: {
      valveIn: P('0,15 – 0,22', 'B', SRC_LIT), valveEx: P('0,20 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK CPR9EA-9', 'B', SRC_LIT), idleRpm: P('1000 ± 100', 'B', SRC_LIT),
      oilCapacity: P('5,3 L (z filtrem)', 'B', SRC_LIT), firing: P('1-4-3-2', 'B', SRC_LIT)
    }, faults: ['f_v4_rear_heat', 'f_tb_sync'] }),

    // SUZUKI
    E('suzuki_p405', { brand: 'suzuki', code: 'P405', codeVerified: true, cc: 644, cyl: 1, layout: 'Single', bore: 100, strokeMm: 82, valves: 4, cam: 'SOHC 4V', cooling: 'air-oil', carbType: 'Mikuni BST40', ignition: 'CDI', params: {
      valveIn: P('0,08 – 0,13', 'B', SRC_LIT), valveEx: P('0,17 – 0,22', 'B', SRC_LIT),
      compression: P('980 kPa (9,8 bar)', 'B', SRC_LIT), sparkPlug: P('NGK CR10E', 'B', SRC_LIT),
      idleRpm: P('1500 ± 100', 'B', SRC_LIT), oilCapacity: P('2,4 L', 'B', SRC_LIT),
      firing: P('1', 'B', SRC_LIT)
    }, faults: ['f_tight_ex_valves', 'f_pilot_jets'] }),

    E('suzuki_p507', { brand: 'suzuki', code: 'P507', codeVerified: true, cc: 645, cyl: 2, layout: 'V2', bore: 81, strokeMm: 62.6, valves: 8, cam: 'DOHC 8V (90° V2)', fuel: 'efi', ignition: 'ECU Cyfrowy (2 świece/cyl)', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR8E', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      oilCapacity: P('2,7 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('24 000 km', 'B', SRC_LIT),
      firing: P('1-2 (90° V2)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_rr_overheat', 'f_stator_burn'] }),

    E('suzuki_r745', { brand: 'suzuki', code: 'R745', codeVerified: true, cc: 749, cyl: 4, layout: 'R4', bore: 72, strokeMm: 46, valves: 16, cam: 'DOHC 16V tytan', fuel: 'efi', ignition: 'ECU SDTV (8 wtryskiwaczy)', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      compression: P('1300 kPa (13,0 bar)', 'B', SRC_LIT), sparkPlug: P('NGK CR9EIA-9', 'B', SRC_LIT),
      idleRpm: P('1250 ± 100', 'B', SRC_LIT), oilCapacity: P('3,0 L (z filtrem)', 'B', SRC_LIT),
      fuelPressure: P('ok. 300 kPa (3,0 bar)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_stator_burn', 'f_rr_overheat', 'f_tps_sub_throttle'] }),

    E('suzuki_q501', { brand: 'suzuki', code: 'Q501', codeVerified: true, cc: 776, cyl: 2, layout: 'R2', bore: 84, strokeMm: 70, valves: 8, cam: 'DOHC 8V (270° Cross Balancer)', fuel: 'efi', ignition: 'ECU Ride-by-wire', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK MR8BI-9', 'B', SRC_LIT), idleRpm: P('1200 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,5 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (270°)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync'] }),

    E('suzuki_t711', { brand: 'suzuki', code: 'T711', codeVerified: true, cc: 999, cyl: 4, layout: 'R4', bore: 73.4, strokeMm: 59, valves: 16, cam: 'DOHC 16V tytan', fuel: 'efi', ignition: 'ECU SDTV', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      compression: P('1280 kPa (12,8 bar)', 'B', SRC_LIT), sparkPlug: P('NGK CR9EIA-9', 'B', SRC_LIT),
      idleRpm: P('1150 ± 100', 'B', SRC_LIT), oilCapacity: P('3,3 L (z filtrem)', 'B', SRC_LIT),
      firing: FIRING_I4
    }, faults: ['f_stator_burn', 'f_rr_overheat', 'f_cct', 'f_tps_sub_throttle'] }),

    E('suzuki_t501', { brand: 'suzuki', code: 'T501', codeVerified: true, cc: 996, cyl: 2, layout: 'V2', bore: 98, strokeMm: 66, valves: 8, cam: 'DOHC 8V (90° V2)', fuel: 'efi', ignition: 'ECU EFI', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR8EK', 'B', SRC_LIT), idleRpm: P('1200 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,1 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (90° V2)', 'B', SRC_LIT)
    }, faults: ['f_sprag_clutch_heavy', 'f_stator_burn', 'f_tb_sync'] }),

    E('suzuki_w501', { brand: 'suzuki', code: 'W501', codeVerified: true, cc: 1255, cyl: 4, layout: 'R4', bore: 79, strokeMm: 64, valves: 16, cam: 'DOHC 16V', fuel: 'efi', ignition: 'ECU SDTV', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR7E', 'B', SRC_LIT), idleRpm: P('1100 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,5 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_tb_sync', 'f_cct'] }),

    E('suzuki_wva1', { brand: 'suzuki', code: 'WVA1', codeVerified: true, cc: 1299, cyl: 4, layout: 'R4', bore: 81, strokeMm: 63, valves: 16, cam: 'DOHC 16V', fuel: 'efi', ignition: 'ECU EFI', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT), idleRpm: P('1150 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,3 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_stator_burn', 'f_rr_overheat', 'f_cct'] }),

    E('suzuki_wvck', { brand: 'suzuki', code: 'WVCK', codeVerified: true, cc: 1340, cyl: 4, layout: 'R4', bore: 81, strokeMm: 65, valves: 16, cam: 'DOHC 16V tytan', fuel: 'efi', ignition: 'ECU SDTV', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EIA-9', 'B', SRC_LIT), idleRpm: P('1150 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,4 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_stator_burn', 'f_cct', 'f_tps_sub_throttle'] }),

    E('suzuki_bn111', { brand: 'suzuki', code: 'BN111', codeVerified: true, cc: 1402, cyl: 4, layout: 'R4', bore: 81, strokeMm: 68, valves: 16, cam: 'DOHC 16V', cooling: 'air-oil', fuel: 'efi', ignition: 'ECU EFI 34mm', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR8EK', 'B', SRC_LIT), idleRpm: P('1050 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,8 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_tb_sync', 'f_stator_burn'] }),

    // KAWASAKI
    E('kawasaki_kl650', { brand: 'kawasaki', code: 'KL650', codeVerified: true, cc: 651, cyl: 1, layout: 'Single', bore: 100, strokeMm: 83, valves: 4, cam: 'DOHC 4V', carbType: 'Keihin CVK40 / EFI', ignition: 'CDI / ECU', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,15 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK DPR8EA-9', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      oilCapacity: P('2,5 L', 'B', SRC_LIT), firing: P('1', 'B', SRC_LIT)
    }, faults: ['f_tight_ex_valves', 'f_pilot_jets'] }),

    E('kawasaki_ex650', { brand: 'kawasaki', code: 'EX650', codeVerified: true, cc: 649, cyl: 2, layout: 'R2', bore: 83, strokeMm: 60, valves: 8, cam: 'DOHC 8V (180°)', fuel: 'efi', ignition: 'ECU EFI 38mm', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,22 – 0,31', 'B', SRC_LIT),
      sparkPlug: P('NGK SILMAR9B9', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      oilCapacity: P('2,3 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (180°)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_stator_burn'] }),

    E('kawasaki_zx750p', { brand: 'kawasaki', code: 'ZX750P', codeVerified: true, cc: 749, cyl: 4, layout: 'R4', bore: 73, strokeMm: 44.7, valves: 16, cam: 'DOHC 16V', carbType: '4× Keihin CVKD38', ignition: 'Cyfrowy CDI', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,20 – 0,29', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT), idleRpm: P('1100 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,7 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_cct'] }),

    E('kawasaki_zr750l', { brand: 'kawasaki', code: 'ZR750L', codeVerified: true, cc: 748, cyl: 4, layout: 'R4', bore: 68.4, strokeMm: 50.9, valves: 16, cam: 'DOHC 16V', fuel: 'efi', ignition: 'ECU EFI', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,22 – 0,31', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EK', 'B', SRC_LIT), idleRpm: P('1100 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,8 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_stator_burn', 'f_rr_overheat', 'f_tb_sync'] }),

    E('kawasaki_zr900b', { brand: 'kawasaki', code: 'ZR900B', codeVerified: true, cc: 948, cyl: 4, layout: 'R4', bore: 73.4, strokeMm: 56, valves: 16, cam: 'DOHC 16V', fuel: 'efi', ignition: 'ECU Ride-by-wire', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,25 – 0,34', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EIA-9', 'B', SRC_LIT), idleRpm: P('1100 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,8 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_tb_sync', 'f_cct'] }),

    E('kawasaki_zx900e', { brand: 'kawasaki', code: 'ZX900E', codeVerified: true, cc: 899, cyl: 4, layout: 'R4', bore: 75, strokeMm: 50.9, valves: 16, cam: 'DOHC 16V', carbType: '4× Keihin CVRD40', ignition: 'Cyfrowy', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,25 – 0,34', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT), idleRpm: P('1100 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,8 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_carb_sync', 'f_pilot_jets', 'f_cct'] }),

    E('kawasaki_zxt00d', { brand: 'kawasaki', code: 'ZXT00D', codeVerified: true, cc: 998, cyl: 4, layout: 'R4', bore: 76, strokeMm: 55, valves: 16, cam: 'DOHC 16V tytan', fuel: 'efi', ignition: 'ECU (kasetowa skrzynia)', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,17 – 0,22', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EIA-9', 'B', SRC_LIT), idleRpm: P('1150 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,7 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_stator_burn', 'f_rr_overheat', 'f_tb_sync'] }),

    E('kawasaki_zxt00g', { brand: 'kawasaki', code: 'ZXT00G', codeVerified: true, cc: 1043, cyl: 4, layout: 'R4', bore: 77, strokeMm: 56, valves: 16, cam: 'DOHC 16V', fuel: 'efi', ignition: 'ECU EFI 38mm', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,22 – 0,31', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EIA-9', 'B', SRC_LIT), idleRpm: P('1100 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,0 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_tb_sync', 'f_cct'] }),

    E('kawasaki_zxt10d', { brand: 'kawasaki', code: 'ZXT10D', codeVerified: true, cc: 1052, cyl: 4, layout: 'R4', bore: 76, strokeMm: 58, valves: 16, cam: 'DOHC 16V', carbType: '4× Keihin CVKD40', ignition: 'Cyfrowy', params: {
      valveIn: P('0,13 – 0,19', 'B', SRC_LIT), valveEx: P('0,18 – 0,24', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT), idleRpm: P('1050 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,5 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_second_gear_dogs', 'f_carb_sync', 'f_pilot_jets'] }),

    E('kawasaki_zxt40a', { brand: 'kawasaki', code: 'ZXT40A', codeVerified: true, cc: 1352, cyl: 4, layout: 'R4', bore: 84, strokeMm: 61, valves: 16, cam: 'DOHC 16V', fuel: 'efi', ignition: 'ECU DFI 44mm', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,20 – 0,29', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EIA-9', 'B', SRC_LIT), idleRpm: P('1050 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,6 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_stator_burn', 'f_cct', 'f_tb_sync'] }),

    // TRIUMPH
    E('triumph_d67ld', { brand: 'triumph', code: 'D67LD', codeVerified: true, cc: 675, cyl: 3, layout: 'R3', bore: 74, strokeMm: 52.3, valves: 12, cam: 'DOHC 12V', fuel: 'efi', ignition: 'Keihin ECU (COP)', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EK', 'B', SRC_LIT), idleRpm: P('1250 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,0 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('20 000 km', 'B', SRC_LIT),
      firing: P('1-2-3 (120°)', 'B', SRC_LIT)
    }, faults: ['f_rr_overheat', 'f_stator_burn', 'f_cct', 'f_tb_sync'] }),

    E('triumph_765', { brand: 'triumph', code: '765', codeVerified: true, cc: 765, cyl: 3, layout: 'R3', bore: 77.99, strokeMm: 53.4, valves: 12, cam: 'DOHC 12V (Moto2)', fuel: 'efi', ignition: 'Keihin Ride-by-wire', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK LMAR9AI-8', 'B', SRC_LIT), idleRpm: P('1250 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,1 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2-3 (120°)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_cct'] }),

    E('triumph_800', { brand: 'triumph', code: '800', codeVerified: true, cc: 799, cyl: 3, layout: 'R3', bore: 74, strokeMm: 61.9, valves: 12, cam: 'DOHC 12V', fuel: 'efi', ignition: 'Keihin ECU', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,32 – 0,37', 'B', SRC_LIT),
      sparkPlug: P('NGK CR8EK', 'B', SRC_LIT), idleRpm: P('1200 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,6 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2-3 (120°)', 'B', SRC_LIT)
    }, faults: ['f_sprag_clutch_heavy', 'f_cct', 'f_tb_sync'] }),

    E('triumph_bonnie_900', { brand: 'triumph', code: 'BONNIE900', codeVerified: true, cc: 900, cyl: 2, layout: 'R2', bore: 84.6, strokeMm: 80, valves: 8, cam: 'SOHC 8V (270°)', fuel: 'efi', ignition: 'ECU Ride-by-wire', params: {
      valveIn: P('0,05 – 0,10', 'B', SRC_LIT), valveEx: P('0,13 – 0,18', 'B', SRC_LIT),
      sparkPlug: P('NGK LMAR8A-9', 'B', SRC_LIT), idleRpm: P('1000 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,8 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (270°)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync'] }),

    E('triumph_speed_1050', { brand: 'triumph', code: '1050', codeVerified: true, cc: 1050, cyl: 3, layout: 'R3', bore: 79, strokeMm: 71.4, valves: 12, cam: 'DOHC 12V', fuel: 'efi', ignition: 'Keihin ECU', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR8EK', 'B', SRC_LIT), idleRpm: P('1150 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,8 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2-3 (120°)', 'B', SRC_LIT)
    }, faults: ['f_sprag_clutch_heavy', 'f_rr_overheat', 'f_stator_burn'] }),

    E('triumph_tiger_1200', { brand: 'triumph', code: '1200', codeVerified: true, cc: 1215, cyl: 3, layout: 'R3', bore: 85, strokeMm: 71.4, valves: 12, cam: 'DOHC 12V (wał kardana)', fuel: 'efi', ignition: 'Keihin Ride-by-wire', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,27 – 0,33', 'B', SRC_LIT),
      sparkPlug: P('NGK CR8EK', 'B', SRC_LIT), idleRpm: P('1100 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,0 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2-3 (120°)', 'B', SRC_LIT)
    }, faults: ['f_cct', 'f_tb_sync'] }),

    E('triumph_rocket3', { brand: 'triumph', code: 'ROCKET3', codeVerified: true, cc: 2458, cyl: 3, layout: 'R3', bore: 110.2, strokeMm: 85.9, valves: 12, cam: 'DOHC 12V (longitudinal R3)', fuel: 'efi', ignition: 'Keihin Ride-by-wire', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,25 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK LMAR8A-9', 'B', SRC_LIT), idleRpm: P('850 ± 50', 'B', SRC_LIT),
      oilCapacity: P('5,4 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2-3', 'B', SRC_LIT)
    }, faults: ['f_sprag_clutch_heavy', 'f_tb_sync'] }),

    // BMW
    E('bmw_k75', { brand: 'bmw', code: 'K75', codeVerified: true, cc: 740, cyl: 3, layout: 'R3', bore: 67, strokeMm: 70, valves: 6, cam: 'DOHC 6V (leżący R3)', fuel: 'efi', carbType: 'Bosch LE-Jetronic', ignition: 'Bosch ECU', params: {
      valveIn: P('0,15 – 0,20', 'B', SRC_LIT), valveEx: P('0,25 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('Bosch D200', 'B', SRC_LIT), idleRpm: P('950 ± 50', 'B', SRC_LIT),
      oilCapacity: P('3,75 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2-3 (120°)', 'B', SRC_LIT)
    }, faults: ['f_sprag_clutch_heavy', 'f_tb_sync', 'f_intake_boot_crack'] }),

    E('bmw_f800', { brand: 'bmw', code: 'F800', codeVerified: true, cc: 798, cyl: 2, layout: 'R2', bore: 82, strokeMm: 75.6, valves: 8, cam: 'DOHC 8V (Rotax 360°)', fuel: 'efi', ignition: 'BMS-KP', params: {
      valveIn: P('0,18 – 0,26', 'B', SRC_LIT), valveEx: P('0,27 – 0,35', 'B', SRC_LIT),
      sparkPlug: P('NGK DCPR8E', 'B', SRC_LIT), idleRpm: P('1250 ± 100', 'B', SRC_LIT),
      oilCapacity: P('2,9 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (360°)', 'B', SRC_LIT)
    }, faults: ['f_stator_burn', 'f_tb_sync', 'f_cct'] }),

    E('bmw_f900', { brand: 'bmw', code: 'F900', codeVerified: true, cc: 895, cyl: 2, layout: 'R2', bore: 86, strokeMm: 77, valves: 8, cam: 'DOHC 8V (Loncin 270°)', fuel: 'efi', ignition: 'BMS-M Ride-by-wire', params: {
      valveIn: P('0,18 – 0,26', 'B', SRC_LIT), valveEx: P('0,30 – 0,38', 'B', SRC_LIT),
      sparkPlug: P('NGK LMAR8J-9E', 'B', SRC_LIT), idleRpm: P('1200 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,0 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (270°)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync'] }),

    E('bmw_s1000rr', { brand: 'bmw', code: 'S1000RR', codeVerified: true, cc: 999, cyl: 4, layout: 'R4', bore: 80, strokeMm: 49.7, valves: 16, cam: 'DOHC 16V ShiftCam tytan', fuel: 'efi', ignition: 'BMS-O Ride-by-wire', params: {
      valveIn: P('0,23 – 0,28', 'B', SRC_LIT), valveEx: P('0,28 – 0,33', 'B', SRC_LIT),
      sparkPlug: P('NGK LMAR9D-J', 'B', SRC_LIT), idleRpm: P('1250 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,9 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_shiftcam_actuator', 'f_cct', 'f_tb_sync'] }),

    E('bmw_r1150', { brand: 'bmw', code: 'R1150', codeVerified: true, cc: 1130, cyl: 2, layout: 'Boxer', bore: 101, strokeMm: 70.5, valves: 8, cam: 'CIH 8V (Boxer B2)', cooling: 'air-oil', fuel: 'efi', ignition: 'Motronic 2.4', params: {
      valveIn: P('0,15', 'B', SRC_LIT), valveEx: P('0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK BKR7EKC', 'B', SRC_LIT), idleRpm: P('1100 ± 50', 'B', SRC_LIT),
      oilCapacity: P('3,75 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (Boxer)', 'B', SRC_LIT)
    }, faults: ['f_boxer_throttle_sync', 'f_intake_boot_crack'] }),

    E('bmw_r1200', { brand: 'bmw', code: 'R1200', codeVerified: true, cc: 1170, cyl: 2, layout: 'Boxer', bore: 101, strokeMm: 73, valves: 8, cam: 'DOHC 8V Radial (Boxer B2)', cooling: 'air-oil', fuel: 'efi', ignition: 'BMS-K', params: {
      valveIn: P('0,13 – 0,23', 'B', SRC_LIT), valveEx: P('0,30 – 0,40', 'B', SRC_LIT),
      sparkPlug: P('NGK MAR8B-JDS', 'B', SRC_LIT), idleRpm: P('1150 ± 50', 'B', SRC_LIT),
      oilCapacity: P('4,0 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (Boxer)', 'B', SRC_LIT)
    }, faults: ['f_boxer_throttle_sync', 'f_stator_burn'] }),

    E('bmw_r1250', { brand: 'bmw', code: 'R1250', codeVerified: true, cc: 1254, cyl: 2, layout: 'Boxer', bore: 102.5, strokeMm: 76, valves: 8, cam: 'DOHC 8V ShiftCam (Boxer B2)', fuel: 'efi', ignition: 'BMS-MP Ride-by-wire', params: {
      valveIn: P('0,10 – 0,17', 'B', SRC_LIT), valveEx: P('0,34 – 0,41', 'B', SRC_LIT),
      sparkPlug: P('NGK LMAR8AI-10', 'B', SRC_LIT), idleRpm: P('1150 ± 50', 'B', SRC_LIT),
      oilCapacity: P('4,0 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (Boxer)', 'B', SRC_LIT)
    }, faults: ['f_shiftcam_actuator', 'f_boxer_throttle_sync'] }),

    E('bmw_k1300', { brand: 'bmw', code: 'K1300', codeVerified: true, cc: 1293, cyl: 4, layout: 'R4', bore: 80, strokeMm: 64.3, valves: 16, cam: 'DOHC 16V (55° pochylony R4)', fuel: 'efi', ignition: 'BMS-K', params: {
      valveIn: P('0,18 – 0,25', 'B', SRC_LIT), valveEx: P('0,25 – 0,32', 'B', SRC_LIT),
      sparkPlug: P('NGK KR9CI', 'B', SRC_LIT), idleRpm: P('1050 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,5 L (sucha miska)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_cct', 'f_tb_sync', 'f_sprag_clutch_heavy'] }),

    E('bmw_k1600', { brand: 'bmw', code: 'K1600', codeVerified: true, cc: 1649, cyl: 6, layout: 'R6', bore: 72, strokeMm: 67.5, valves: 24, cam: 'DOHC 24V (poprzeczny R6)', fuel: 'efi', ignition: 'BMS-X Ride-by-wire', params: {
      valveIn: P('0,18 – 0,25', 'B', SRC_LIT), valveEx: P('0,27 – 0,34', 'B', SRC_LIT),
      sparkPlug: P('NGK LMAR8AI-8', 'B', SRC_LIT), idleRpm: P('900 ± 50', 'B', SRC_LIT),
      oilCapacity: P('4,5 L (sucha miska)', 'B', SRC_LIT), firing: P('1-5-3-6-2-4', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_coil_cap'] }),

    // DUCATI
    E('ducati_696', { brand: 'ducati', code: 'DESMO696', codeVerified: true, cc: 696, cyl: 2, layout: 'L2', bore: 88, strokeMm: 57.2, valves: 4, cam: 'Desmodue 4V (90° L2)', cooling: 'air', fuel: 'efi', ignition: 'Siemens VDO', params: {
      valveIn: P('0,10 – 0,15 (zamkn: 0,03 – 0,08)', 'B', SRC_LIT), valveEx: P('0,15 – 0,20 (zamkn: 0,03 – 0,08)', 'B', SRC_LIT),
      sparkPlug: P('NGK DCPR8E', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,1 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (90° L2)', 'B', SRC_LIT)
    }, faults: ['f_desmo_closing_shims', 'f_tb_sync', 'f_rr_overheat'] }),

    E('ducati_821', { brand: 'ducati', code: 'TESTA821', codeVerified: true, cc: 821, cyl: 2, layout: 'L2', bore: 88, strokeMm: 67.5, valves: 8, cam: 'Testastretta 11° 8V Desmo', fuel: 'efi', ignition: 'Continental Ride-by-wire', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,15 – 0,20', 'B', SRC_LIT),
      sparkPlug: P('NGK MAR9A-J', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,4 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (90° L2)', 'B', SRC_LIT)
    }, faults: ['f_desmo_closing_shims', 'f_tb_sync'] }),

    E('ducati_1198', { brand: 'ducati', code: 'TESTA1198', codeVerified: true, cc: 1198, cyl: 2, layout: 'L2', bore: 106, strokeMm: 67.9, valves: 8, cam: 'Testastretta Evoluzione 8V', fuel: 'efi', ignition: 'Marelli EFI 64mm', params: {
      valveIn: P('0,15 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK MAR10A-J', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,7 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (90° L2)', 'B', SRC_LIT)
    }, faults: ['f_desmo_closing_shims', 'f_sprag_clutch_heavy', 'f_stator_burn'] }),

    E('ducati_1199', { brand: 'ducati', code: 'SUPERQUADRO', codeVerified: true, cc: 1198, cyl: 2, layout: 'L2', bore: 112, strokeMm: 60.8, valves: 8, cam: 'Superquadro 8V tytan Desmo', fuel: 'efi', ignition: 'Mitsubishi Ride-by-wire', params: {
      valveIn: P('0,15 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK MAR9A-J', 'B', SRC_LIT), idleRpm: P('1350 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,8 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (90° L2)', 'B', SRC_LIT)
    }, faults: ['f_desmo_closing_shims', 'f_tb_sync'] }),

    E('ducati_1260_dvt', { brand: 'ducati', code: 'DVT1260', codeVerified: true, cc: 1262, cyl: 2, layout: 'L2', bore: 106, strokeMm: 71.5, valves: 8, cam: 'Testastretta DVT 8V (zmienne fazy)', fuel: 'efi', ignition: 'Bosch Ride-by-wire', params: {
      valveIn: P('0,15 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK MAR9A-J', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,1 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (90° L2)', 'B', SRC_LIT)
    }, faults: ['f_desmo_closing_shims', 'f_shiftcam_actuator'] }),

    E('ducati_v4_stradale', { brand: 'ducati', code: 'STRADALE_V4', codeVerified: true, cc: 1103, cyl: 4, layout: 'V4', bore: 81, strokeMm: 53.5, valves: 16, cam: 'Desmosedici Stradale 16V (90° V4)', fuel: 'efi', ignition: 'Bosch Twin Pulse Ride-by-wire', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,18 – 0,23', 'B', SRC_LIT),
      sparkPlug: P('NGK R0451B-10', 'B', SRC_LIT), idleRpm: P('1350 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,2 L (sucha miska)', 'B', SRC_LIT), firing: P('1-3-2-4 Twin Pulse', 'B', SRC_LIT)
    }, faults: ['f_desmo_closing_shims', 'f_v4_rear_heat', 'f_v4_cam_wear'] }),

    E('ducati_v4_granturismo', { brand: 'ducati', code: 'GRANTURISMO_V4', codeVerified: true, cc: 1158, cyl: 4, layout: 'V4', bore: 83, strokeMm: 53.5, valves: 16, cam: 'V4 Granturismo 16V (sprężyny zaworowe)', fuel: 'efi', ignition: 'Bosch Ride-by-wire', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,20 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK SILMAR9E9', 'B', SRC_LIT), idleRpm: P('1250 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,3 L (z filtrem)', 'B', SRC_LIT), valveInterval: P('60 000 km', 'B', SRC_LIT),
      firing: P('1-3-2-4 Twin Pulse', 'B', SRC_LIT)
    }, faults: ['f_v4_rear_heat', 'f_tb_sync'] }),

    // KTM
    E('ktm_690_lc4', { brand: 'ktm', code: 'LC4_690', codeVerified: true, cc: 693, cyl: 1, layout: 'Single', bore: 105, strokeMm: 80, valves: 4, cam: 'LC4 SOHC 4V (2 wałki balansu)', fuel: 'efi', ignition: 'Keihin EFI 50mm Ride-by-wire', params: {
      valveIn: P('0,07 – 0,13', 'B', SRC_LIT), valveEx: P('0,13 – 0,19', 'B', SRC_LIT),
      sparkPlug: P('NGK LKAR8AI-9', 'B', SRC_LIT), idleRpm: P('1550 ± 100', 'B', SRC_LIT),
      oilCapacity: P('1,7 L (2 filtry)', 'B', SRC_LIT), firing: P('1', 'B', SRC_LIT)
    }, faults: ['f_sprag_clutch_heavy', 'f_tight_ex_valves'] }),

    E('ktm_790_lc8c', { brand: 'ktm', code: 'LC8C_790', codeVerified: true, cc: 799, cyl: 2, layout: 'R2', bore: 88, strokeMm: 65.7, valves: 8, cam: 'LC8c DOHC 8V (285°/435°)', fuel: 'efi', ignition: 'DKK Ride-by-wire', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,15 – 0,20', 'B', SRC_LIT),
      sparkPlug: P('NGK LKAR9BI-10', 'B', SRC_LIT), idleRpm: P('1400 ± 100', 'B', SRC_LIT),
      oilCapacity: P('2,8 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (285°)', 'B', SRC_LIT)
    }, faults: ['f_v4_cam_wear', 'f_tb_sync'] }),

    E('ktm_990_lc8', { brand: 'ktm', code: 'LC8_990', codeVerified: true, cc: 999, cyl: 2, layout: 'V2', bore: 101, strokeMm: 62.4, valves: 8, cam: 'LC8 DOHC 8V (75° V2)', fuel: 'efi', ignition: 'Keihin EFI', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,25 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK LKAR8AI-9', 'B', SRC_LIT), idleRpm: P('1400 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,0 L (sucha miska)', 'B', SRC_LIT), firing: P('1-2 (75° V2)', 'B', SRC_LIT)
    }, faults: ['f_lc8_water_pump_seal', 'f_sprag_clutch_heavy', 'f_tb_sync'] }),

    E('ktm_1290_lc8', { brand: 'ktm', code: 'LC8_1290', codeVerified: true, cc: 1301, cyl: 2, layout: 'V2', bore: 108, strokeMm: 71, valves: 8, cam: 'LC8 DOHC 8V (75° V2 podwójna świeca)', fuel: 'efi', ignition: 'Keihin Ride-by-wire 56mm', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,25 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK LKAR9BI-10', 'B', SRC_LIT), idleRpm: P('1350 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,6 L (sucha miska)', 'B', SRC_LIT), firing: P('1-2 (75° V2)', 'B', SRC_LIT)
    }, faults: ['f_lc8_water_pump_seal', 'f_sprag_clutch_heavy', 'f_tb_sync'] }),

    // APRILIA
    E('aprilia_660_r2', { brand: 'aprilia', code: 'APR660', codeVerified: true, cc: 659, cyl: 2, layout: 'R2', bore: 81, strokeMm: 63.9, valves: 8, cam: 'DOHC 8V (270°)', fuel: 'efi', ignition: 'Marelli 11MP Ride-by-wire', params: {
      valveIn: P('0,15 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK MR9DE', 'B', SRC_LIT), idleRpm: P('1400 ± 100', 'B', SRC_LIT),
      oilCapacity: P('2,7 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (270°)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_connectors_moisture'] }),

    E('aprilia_750_v2', { brand: 'aprilia', code: 'APR750', codeVerified: true, cc: 750, cyl: 2, layout: 'V2', bore: 92, strokeMm: 56.4, valves: 8, cam: 'DOHC 8V (90° V2 hybryda koła/łańcuch)', fuel: 'efi', ignition: 'Marelli Ride-by-wire', params: {
      valveIn: P('0,11 – 0,18', 'B', SRC_LIT), valveEx: P('0,16 – 0,23', 'B', SRC_LIT),
      sparkPlug: P('NGK CR7EKB', 'B', SRC_LIT), idleRpm: P('1350 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,2 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (90° V2)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_sprag_clutch_heavy'] }),

    E('aprilia_v990', { brand: 'aprilia', code: 'V990', codeVerified: true, cc: 998, cyl: 2, layout: 'V2', bore: 97, strokeMm: 67.5, valves: 8, cam: 'Rotax V990 8V (60° V2, 2 świece/cyl)', fuel: 'efi', ignition: 'Denso EFI (sucha miska)', params: {
      valveIn: P('0,12 – 0,17', 'B', SRC_LIT), valveEx: P('0,23 – 0,28', 'B', SRC_LIT),
      sparkPlug: P('NGK DCPR9E', 'B', SRC_LIT), idleRpm: P('1250 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,9 L (sucha miska)', 'B', SRC_LIT), firing: P('1-2 (60° V2)', 'B', SRC_LIT)
    }, faults: ['f_sprag_clutch_heavy', 'f_rr_overheat', 'f_stator_burn'] }),

    E('aprilia_v4_1000', { brand: 'aprilia', code: 'V4_1000', codeVerified: true, cc: 999, cyl: 4, layout: 'V4', bore: 78, strokeMm: 52.3, valves: 16, cam: 'DOHC 16V tytan (65° V4 kasetowa skrzynia)', fuel: 'efi', ignition: 'Marelli 8-wtryskiwaczy Ride-by-wire', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,15 – 0,20', 'B', SRC_LIT),
      sparkPlug: P('NGK R0451B-10', 'B', SRC_LIT), idleRpm: P('1400 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,0 L (z filtrem)', 'B', SRC_LIT), firing: P('1-3-2-4 (65° V4)', 'B', SRC_LIT)
    }, faults: ['f_v4_cam_wear', 'f_stator_burn', 'f_v4_rear_heat'] }),

    E('aprilia_v4_1100', { brand: 'aprilia', code: 'V4_1100', codeVerified: true, cc: 1077, cyl: 4, layout: 'V4', bore: 81, strokeMm: 52.3, valves: 16, cam: 'DOHC 16V (65° V4)', fuel: 'efi', ignition: 'Marelli 11MP Ride-by-wire', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,15 – 0,20', 'B', SRC_LIT),
      sparkPlug: P('NGK SILMAR9B9', 'B', SRC_LIT), idleRpm: P('1400 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,0 L (z filtrem)', 'B', SRC_LIT), firing: P('1-3-2-4 (65° V4)', 'B', SRC_LIT)
    }, faults: ['f_v4_rear_heat', 'f_tb_sync', 'f_stator_burn'] }),

    // BENELLI
    E('benelli_trk502', { brand: 'benelli', code: 'BJ269MR', codeVerified: true, cc: 500, cyl: 2, layout: 'R2', bore: 69, strokeMm: 66.8, valves: 8, cam: 'DOHC 8V (360°)', fuel: 'efi', ignition: 'Bosch EFI 37mm', params: {
      valveIn: P('0,13 – 0,19', 'B', SRC_LIT), valveEx: P('0,19 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK CR8E', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,2 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (360°)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_connectors_moisture'] }),

    E('benelli_752s', { brand: 'benelli', code: 'BJ288MW', codeVerified: true, cc: 754, cyl: 2, layout: 'R2', bore: 88, strokeMm: 62, valves: 8, cam: 'DOHC 8V (270°)', fuel: 'efi', ignition: 'Delphi EFI', params: {
      valveIn: P('0,13 – 0,19', 'B', SRC_LIT), valveEx: P('0,19 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9E', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,2 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2 (270°)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync'] }),

    E('benelli_tnt899', { brand: 'benelli', code: 'TNT899', codeVerified: true, cc: 898, cyl: 3, layout: 'R3', bore: 88, strokeMm: 49.2, valves: 12, cam: 'DOHC 12V (120°)', fuel: 'efi', ignition: 'Walbro EFI', params: {
      valveIn: P('0,15 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,25', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EK', 'B', SRC_LIT), idleRpm: P('1250 ± 100', 'B', SRC_LIT),
      oilCapacity: P('4,0 L (z filtrem)', 'B', SRC_LIT), firing: P('1-2-3 (120°)', 'B', SRC_LIT)
    }, faults: ['f_sprag_clutch_heavy', 'f_rr_overheat', 'f_tb_sync'] }),

    // MV AGUSTA
    E('mv_tre_675', { brand: 'mvagusta', code: 'MV675', codeVerified: true, cc: 675, cyl: 3, layout: 'R3', bore: 79, strokeMm: 45.9, valves: 12, cam: 'DOHC 12V tytan (wał przeciwbieżny)', fuel: 'efi', ignition: 'Eldor MVICS Ride-by-wire', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,20 – 0,29', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EKB', 'B', SRC_LIT), idleRpm: P('1350 ± 100', 'B', SRC_LIT),
      oilCapacity: P('2,5 L', 'B', SRC_LIT), firing: P('1-2-3 (120°)', 'B', SRC_LIT)
    }, faults: ['f_sprag_clutch_heavy', 'f_tb_sync'] }),

    E('mv_tre_800', { brand: 'mvagusta', code: 'MV800', codeVerified: true, cc: 798, cyl: 3, layout: 'R3', bore: 79, strokeMm: 54.3, valves: 12, cam: 'DOHC 12V tytan (wał przeciwbieżny)', fuel: 'efi', ignition: 'Eldor MVICS Ride-by-wire', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,20 – 0,29', 'B', SRC_LIT),
      sparkPlug: P('NGK CR9EKB', 'B', SRC_LIT), idleRpm: P('1350 ± 100', 'B', SRC_LIT),
      oilCapacity: P('2,5 L', 'B', SRC_LIT), firing: P('1-2-3 (120°)', 'B', SRC_LIT)
    }, faults: ['f_sprag_clutch_heavy', 'f_tb_sync'] }),

    E('mv_f4_750', { brand: 'mvagusta', code: 'F4_750', codeVerified: true, cc: 749, cyl: 4, layout: 'R4', bore: 73.8, strokeMm: 43.8, valves: 16, cam: 'DOHC 16V (promieniowe Radial)', fuel: 'efi', ignition: 'Weber-Marelli 16M', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,20 – 0,29', 'B', SRC_LIT),
      sparkPlug: P('NGK R6252K-105', 'B', SRC_LIT), idleRpm: P('1200 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,8 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_rr_overheat', 'f_tb_sync', 'f_sprag_clutch_heavy'] }),

    E('mv_f4_1000', { brand: 'mvagusta', code: 'F4_1000', codeVerified: true, cc: 998, cyl: 4, layout: 'R4', bore: 76, strokeMm: 55, valves: 16, cam: 'DOHC 16V Radial tytan (TSS zmienny dolot)', fuel: 'efi', ignition: 'Marelli 5SM Ride-by-wire', params: {
      valveIn: P('0,15 – 0,24', 'B', SRC_LIT), valveEx: P('0,20 – 0,29', 'B', SRC_LIT),
      sparkPlug: P('NGK R6252K-105', 'B', SRC_LIT), idleRpm: P('1250 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,8 L (z filtrem)', 'B', SRC_LIT), firing: FIRING_I4
    }, faults: ['f_rr_overheat', 'f_tb_sync'] }),

    // ===== QUAD / ATV & UTV =====
    E('polaris_prostar570', { brand: 'polaris', code: 'PROSTAR570', codeVerified: true, cc: 567, cyl: 1, layout: 'Single', bore: 99, strokeMm: 73.6, valves: 4, cam: 'DOHC 4V', fuel: 'efi', ignition: 'Bosch EFI', params: {
      valveIn: P('0,15 – 0,19', 'B', SRC_LIT), valveEx: P('0,25 – 0,29', 'B', SRC_LIT),
      sparkPlug: P('Champion RG6YC / NGK CPR8E', 'B', SRC_LIT), idleRpm: P('1200 ± 50', 'B', SRC_LIT),
      oilCapacity: P('1,9 L (PS-4 5W-50)', 'B', SRC_LIT), fuelPressure: P('4,0 bar (58 psi)', 'B', SRC_LIT)
    }, faults: ['f_atv_cvu_belt_burn', 'f_atv_front_diff_actuator', 'f_atv_winch_relay'] }),

    E('polaris_prostar1000', { brand: 'polaris', code: 'PROSTAR1000', codeVerified: true, cc: 952, cyl: 2, layout: 'R2', bore: 93, strokeMm: 73.5, valves: 8, cam: 'DOHC 8V', fuel: 'efi', ignition: 'Bosch Motronic', params: {
      valveIn: P('0,15 – 0,19', 'B', SRC_LIT), valveEx: P('0,25 – 0,29', 'B', SRC_LIT),
      sparkPlug: P('NGK MR7F', 'B', SRC_LIT), idleRpm: P('1250 ± 50', 'B', SRC_LIT),
      oilCapacity: P('2,4 L', 'B', SRC_LIT), fuelPressure: P('4,0 bar (58 psi)', 'B', SRC_LIT)
    }, faults: ['f_atv_cvu_belt_burn', 'f_atv_front_diff_actuator', 'f_tb_sync'] }),

    E('canam_rotax650', { brand: 'canam', code: 'ROTAX650', codeVerified: true, cc: 649, cyl: 2, layout: 'V2', bore: 82, strokeMm: 61.5, valves: 8, cam: 'SOHC 8V 80° V-Twin', fuel: 'efi', ignition: 'Siemens VDO EFI', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,15 – 0,20', 'B', SRC_LIT),
      sparkPlug: P('NGK DCPR8E', 'B', SRC_LIT), idleRpm: P('1250 ± 50', 'B', SRC_LIT),
      oilCapacity: P('2,1 L (XPS 5W-40)', 'B', SRC_LIT), fuelPressure: P('3,5 bar (51 psi)', 'B', SRC_LIT)
    }, faults: ['f_atv_cvu_belt_burn', 'f_atv_front_diff_actuator', 'f_stator_burn'] }),

    E('canam_rotax1000', { brand: 'canam', code: 'ROTAX1000', codeVerified: true, cc: 976, cyl: 2, layout: 'V2', bore: 91, strokeMm: 75, valves: 8, cam: 'SOHC 8V 80° V-Twin', fuel: 'efi', ignition: 'Bosch / Siemens EFI', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,15 – 0,20', 'B', SRC_LIT),
      sparkPlug: P('NGK DCPR8E', 'B', SRC_LIT), idleRpm: P('1250 ± 50', 'B', SRC_LIT),
      oilCapacity: P('2,2 L', 'B', SRC_LIT), fuelPressure: P('3,5 bar (51 psi)', 'B', SRC_LIT)
    }, faults: ['f_atv_cvu_belt_burn', 'f_atv_front_diff_actuator', 'f_sprag_clutch_heavy'] }),

    E('cfmoto_191r', { brand: 'cfmoto', code: '191R', codeVerified: true, cc: 400, cyl: 1, layout: 'Single', bore: 91, strokeMm: 61.5, valves: 4, cam: 'SOHC 4V', fuel: 'efi', ignition: 'Bosch MSE6.0 EFI', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,15 – 0,20', 'B', SRC_LIT),
      sparkPlug: P('NGK DPR7EA-9', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      oilCapacity: P('2,8 L (15W-40)', 'B', SRC_LIT), fuelPressure: P('3,0 bar (43 psi)', 'B', SRC_LIT)
    }, faults: ['f_atv_cvu_belt_burn', 'f_atv_front_diff_actuator', 'f_rr_overheat'] }),

    E('cfmoto_2v91y', { brand: 'cfmoto', code: '2V91Y', codeVerified: true, cc: 800, cyl: 2, layout: 'V2', bore: 91, strokeMm: 61.5, valves: 8, cam: 'SOHC 8V V-Twin', fuel: 'efi', ignition: 'Delphi EFI', params: {
      valveIn: P('0,10 – 0,15', 'B', SRC_LIT), valveEx: P('0,15 – 0,20', 'B', SRC_LIT),
      sparkPlug: P('NGK DCPR7E', 'B', SRC_LIT), idleRpm: P('1250 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,2 L', 'B', SRC_LIT), fuelPressure: P('3,0 bar (43 psi)', 'B', SRC_LIT)
    }, faults: ['f_atv_cvu_belt_burn', 'f_atv_front_diff_actuator', 'f_stator_burn'] }),

    E('yamaha_3b4', { brand: 'yamaha', code: '3B4', codeVerified: true, cc: 686, cyl: 1, layout: 'Single', bore: 102, strokeMm: 84, valves: 4, cam: 'SOHC 4V (Grizzly / Raptor)', fuel: 'efi', ignition: 'TCI EFI', params: {
      valveIn: P('0,09 – 0,13', 'B', SRC_LIT), valveEx: P('0,16 – 0,20', 'B', SRC_LIT),
      sparkPlug: P('NGK CPR7EA-9', 'B', SRC_LIT), idleRpm: P('1450 ± 50', 'B', SRC_LIT),
      oilCapacity: P('2,4 L (z filtrem)', 'B', SRC_LIT), fuelPressure: P('3,24 bar (47 psi)', 'B', SRC_LIT)
    }, faults: ['f_atv_cvu_belt_burn', 'f_atv_front_diff_actuator', 'f_sprag_clutch_heavy'] }),

    E('honda_trx420e', { brand: 'honda', code: 'TE38E', codeVerified: true, cc: 420, cyl: 1, layout: 'Single', bore: 86.5, strokeMm: 71.5, valves: 2, cam: 'OHV 2V wzdłużny', fuel: 'efi', ignition: 'PGM-FI', params: {
      valveIn: P('0,15 ± 0,02', 'B', SRC_LIT), valveEx: P('0,15 ± 0,02', 'B', SRC_LIT),
      sparkPlug: P('NGK BKR5E-11', 'B', SRC_LIT), idleRpm: P('1400 ± 100', 'B', SRC_LIT),
      oilCapacity: P('3,0 L', 'B', SRC_LIT), fuelPressure: P('3,4 bar (50 psi)', 'B', SRC_LIT)
    }, faults: ['f_fuel_pump_strainer', 'f_connectors_moisture'] }),

    // ===== SKUTERY & MOTOROWERY (2T & 4T) =====
    E('piaggio_quasar300', { brand: 'piaggio', code: 'M683M', codeVerified: true, cc: 278, cyl: 1, layout: 'Single', bore: 75, strokeMm: 63, valves: 4, cam: 'SOHC 4V Quasar / HPE', fuel: 'efi', ignition: 'Marelli MIU G3', params: {
      valveIn: P('0,10', 'B', SRC_LIT), valveEx: P('0,15', 'B', SRC_LIT),
      sparkPlug: P('NGK CR8EKB', 'B', SRC_LIT), idleRpm: P('1650 ± 100', 'B', SRC_LIT),
      oilCapacity: P('1,3 L (5W-40)', 'B', SRC_LIT), fuelPressure: P('2,5 bar (36 psi)', 'B', SRC_LIT)
    }, faults: ['f_fuel_pump_strainer', 'f_rr_overheat', 'f_tb_sync'] }),

    E('kymco_sk60', { brand: 'kymco', code: 'SK60', codeVerified: true, cc: 299, cyl: 1, layout: 'Single', bore: 72.7, strokeMm: 72, valves: 4, cam: 'SOHC 4V Downtown 300i', fuel: 'efi', ignition: 'Keihin EFI', params: {
      valveIn: P('0,10', 'B', SRC_LIT), valveEx: P('0,10', 'B', SRC_LIT),
      sparkPlug: P('NGK CR7E', 'B', SRC_LIT), idleRpm: P('1600 ± 100', 'B', SRC_LIT),
      oilCapacity: P('1,5 L (10W-40)', 'B', SRC_LIT), fuelPressure: P('3,0 bar (43 psi)', 'B', SRC_LIT)
    }, faults: ['f_rr_overheat', 'f_stator_burn'] }),

    E('sym_joyride300', { brand: 'sym', code: 'LM30', codeVerified: true, cc: 278, cyl: 1, layout: 'Single', bore: 75, strokeMm: 63, valves: 4, cam: 'SOHC 4V Cruisym / Joyride', fuel: 'efi', ignition: 'Keihin EFI', params: {
      valveIn: P('0,12 ± 0,02', 'B', SRC_LIT), valveEx: P('0,15 ± 0,02', 'B', SRC_LIT),
      sparkPlug: P('NGK CR8E', 'B', SRC_LIT), idleRpm: P('1650 ± 100', 'B', SRC_LIT),
      oilCapacity: P('1,4 L', 'B', SRC_LIT), fuelPressure: P('3,0 bar (43 psi)', 'B', SRC_LIT)
    }, faults: ['f_rr_overheat', 'f_stator_burn'] }),

    E('minarelli_am6', { brand: 'minarelli', code: 'AM6', codeVerified: true, cc: 50, cyl: 1, layout: 'Single', stroke: 2, bore: 40.3, strokeMm: 39, valves: 0, cam: '2T Zawór membranowy', fuel: 'carb', carbType: 'Dellorto PHBN 16 / SHA 14', ignition: 'Ducati Energia CDI', params: {
      sparkPlug: P('NGK BR9ES', 'B', SRC_LIT), plugGap: P('0,6 – 0,7', 'B', SRC_LIT),
      oilCapacity: P('0,75 L (olej skrzyni 75W-90)', 'B', SRC_LIT), idleRpm: P('1400 ± 100', 'B', SRC_LIT)
    }, faults: ['f_pilot_jets', 'f_intake_boot_crack'] }),

    E('derbi_d50b0', { brand: 'minarelli', code: 'D50B0', codeVerified: true, cc: 50, cyl: 1, layout: 'Single', stroke: 2, bore: 39.9, strokeMm: 40, valves: 0, cam: '2T Zawór membranowy Senda', fuel: 'carb', carbType: 'Dellorto PHVA 17.5', ignition: 'Leonelli / Kokusan CDI', params: {
      sparkPlug: P('NGK BR9ES', 'B', SRC_LIT), plugGap: P('0,6 – 0,7', 'B', SRC_LIT),
      oilCapacity: P('0,65 L (olej skrzyni 10W-40)', 'B', SRC_LIT), idleRpm: P('1450 ± 100', 'B', SRC_LIT)
    }, faults: ['f_pilot_jets', 'f_intake_boot_crack'] }),

    E('gy6_139qmb', { brand: 'gy6', code: '139QMB', codeVerified: true, cc: 50, cyl: 1, layout: 'Single', stroke: 4, bore: 39, strokeMm: 41.5, valves: 2, cam: 'SOHC 2V Chłodzony powietrzem', cooling: 'air', fuel: 'carb', carbType: 'PD18J CV 18 mm', ignition: 'AC-CDI 5-pin / 6-pin', params: {
      valveIn: P('0,05', 'B', SRC_LIT), valveEx: P('0,07', 'B', SRC_LIT),
      sparkPlug: P('NGK C7HSA / CR7HSA', 'B', SRC_LIT), plugGap: P('0,6 – 0,7', 'B', SRC_LIT),
      oilCapacity: P('0,8 L (10W-40)', 'B', SRC_LIT), idleRpm: P('1600 ± 100', 'B', SRC_LIT)
    }, faults: ['f_tight_ex_valves', 'f_pilot_jets', 'f_intake_boot_crack'] }),

    E('gy6_152qmi', { brand: 'gy6', code: '152QMI', codeVerified: true, cc: 125, cyl: 1, layout: 'Single', stroke: 4, bore: 52.4, strokeMm: 57.8, valves: 2, cam: 'SOHC 2V Chłodzony powietrzem', cooling: 'air', fuel: 'carb', carbType: 'PD24J CV 24 mm', ignition: 'DC-CDI 6-pin', params: {
      valveIn: P('0,08', 'B', SRC_LIT), valveEx: P('0,10', 'B', SRC_LIT),
      sparkPlug: P('NGK CR7HSA', 'B', SRC_LIT), plugGap: P('0,6 – 0,7', 'B', SRC_LIT),
      oilCapacity: P('0,9 L (10W-40)', 'B', SRC_LIT), idleRpm: P('1500 ± 100', 'B', SRC_LIT)
    }, faults: ['f_tight_ex_valves', 'f_pilot_jets', 'f_stator_burn'] }),

    // ===== MOTOCYKLE V-TWIN & BOXER =====
    E('suzuki_sv650_v2', { brand: 'suzuki', code: 'P507', codeVerified: true, cc: 645, cyl: 2, layout: 'V2', bore: 81, strokeMm: 62.6, valves: 8, cam: 'DOHC 8V 90° V-Twin', fuel: 'efi', ignition: 'Denso 32-bit EFI', params: {
      valveIn: P('0,10 – 0,20', 'B', SRC_LIT), valveEx: P('0,20 – 0,30', 'B', SRC_LIT),
      sparkPlug: P('NGK CR8E / CPR8EA-9', 'B', SRC_LIT), idleRpm: P('1300 ± 100', 'B', SRC_LIT),
      oilCapacity: P('2,7 L (z filtrem)', 'B', SRC_LIT), fuelPressure: P('3,0 bar (43 psi)', 'B', SRC_LIT)
    }, faults: ['f_tb_sync', 'f_rr_overheat', 'f_cct'] }),

    E('honda_vt750_v2', { brand: 'honda', code: 'RC50E', codeVerified: true, cc: 745, cyl: 2, layout: 'V2', bore: 79, strokeMm: 76, valves: 6, cam: 'SOHC 6V (3V/cyl) 52° V-Twin', fuel: 'efi', ignition: 'PGM-FI cyfrowy', params: {
      valveIn: P('0,15 ± 0,02', 'B', SRC_LIT), valveEx: P('0,20 ± 0,02', 'B', SRC_LIT),
      sparkPlug: P('NGK DPR7EA-9', 'B', SRC_LIT), idleRpm: P('1100 ± 100', 'B', SRC_LIT),
      oilCapacity: P('2,5 L', 'B', SRC_LIT), fuelPressure: P('3,4 bar (50 psi)', 'B', SRC_LIT)
    }, faults: ['f_stator_burn', 'f_fuel_pump_strainer'] })

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
    M('mv_600', 'mvagusta', '600 Quattro Cilindri (600 4C)', '–', 1966, 1972, null, 'mv_600_4c', 'Turystyczny – kolekcjonerski R4'),

    // ===== ROZSZERZENIE KATALOGU MODELI (>650 cm³, 1–4 CYL) =====
    // HONDA
    M('h_xr650r', 'honda', 'XR650R', 'RE01', 2000, 2007, 'RE01', 'honda_re01e', 'Enduro/Supermoto 649 cm³ 1-cyl chłodzone cieczą'),
    M('h_cb750_hornet', 'honda', 'CB750 Hornet', 'RH12', 2023, 2025, 'RH12', 'honda_rd16e', 'Naked R2 755 cm³ 270° Unicam'),
    M('h_xl750_transalp', 'honda', 'XL750 Transalp', 'RD16', 2023, 2025, 'RD16', 'honda_rd16e', 'Adventure R2 755 cm³ Unicam'),
    M('h_vfr800_vtec', 'honda', 'VFR800 VTEC / Crossrunner', 'RC46 / RC60', 2002, 2013, 'RC46', 'honda_rc46e', 'Sport-tourer 782 cm³ V4 HYPER VTEC'),
    M('h_cbr954rr', 'honda', 'CBR954RR Fireblade', 'SC50', 2002, 2003, 'SC50', 'honda_sc50e', 'Supersport R4 954 cm³'),
    M('h_cbr1000rr_sc57', 'honda', 'CBR1000RR Fireblade', 'SC57', 2004, 2007, 'SC57', 'honda_sc57e', 'Superbike R4 998 cm³ DSFI'),
    M('h_cbr1100xx', 'honda', 'CBR1100XX Super Blackbird', 'SC42', 1999, 2007, 'SC42', 'honda_sc42e', 'Sport-tourer R4 1137 cm³ PGM-FI'),
    M('h_crf1100l', 'honda', 'CRF1100L Africa Twin', 'SD08 / SD09', 2020, 2025, 'SD08', 'honda_sd08e', 'Adventure R2 1084 cm³ Unicam'),
    M('h_cb1300', 'honda', 'CB1300 Super Four / Bol d\'Or', 'SC54', 2003, 2013, 'SC54', 'honda_sc54e', 'Muscle bike R4 1284 cm³'),
    M('h_vfr1200f', 'honda', 'VFR1200F / Crosstourer', 'SC63 / SC70', 2010, 2017, 'SC63', 'honda_sc63e', 'Sport-tourer 1237 cm³ 76° V4 Unicam'),
    M('h_gl1800', 'honda', 'GL1800 GoldWing', 'SC79', 2018, 2025, 'SC79', 'honda_sc79e', 'Luksusowy tourer 1833 cm³ Boxer B6'),

    // YAMAHA
    M('y_xt660r', 'yamaha', 'XT660R / XT660X / Tenere XT660Z', 'DM01 / DM02', 2004, 2016, 'DM01', 'yamaha_5vk', 'Dual-sport / Supermoto 660 cm³ 1-cyl'),
    M('y_mt07', 'yamaha', 'MT-07 / Tenere 700 / Tracer 7', 'RM04 / RM17 / DM07', 2014, 2025, 'RM04', 'yamaha_m401e', 'Naked / Adventure R2 689 cm³ CP2 270°'),
    M('y_mt09', 'yamaha', 'MT-09 / Tracer 9 / XSR900', 'RN29 / RN43 / RN57', 2013, 2020, 'RN29', 'yamaha_n701e', 'Hyper-naked R3 847 cm³ CP3 120°'),
    M('y_tdm900', 'yamaha', 'TDM900', 'RN08 / RN11 / RN18', 2002, 2012, 'RN08', 'yamaha_5ps', 'All-rounder R2 897 cm³ 10V 270°'),
    M('y_yzfr1_5pw', 'yamaha', 'YZF-R1 (Wtrysk 5-zaworowy)', 'RN09', 2002, 2003, 'RN09', 'yamaha_5pw', 'Superbike R4 998 cm³ DOHC 20V'),
    M('y_yzfr1_cp4', 'yamaha', 'YZF-R1 Crossplane CP4', 'RN22', 2009, 2014, 'RN22', 'yamaha_14b', 'Superbike R4 Crossplane 998 cm³'),
    M('y_fz1', 'yamaha', 'FZ1 / FZ1 Fazer', 'RN16', 2006, 2015, 'RN16', 'yamaha_rn16', 'Streetfighter R4 998 cm³ DOHC 20V'),
    M('y_xtz1200', 'yamaha', 'XTZ1200 Super Tenere', 'DP01 / DP04 / DP07', 2010, 2020, 'DP01', 'yamaha_dp01', 'Adventure R2 1199 cm³ 270° wał kardana'),
    M('y_xjr1300', 'yamaha', 'XJR1300', 'RP02 / RP06 / RP19', 1999, 2016, 'RP06', 'yamaha_rp06', 'Muscle bike R4 1251 cm³ chłodzony powietrzem i olejem'),
    M('y_fjr1300', 'yamaha', 'FJR1300A / AS', 'RP04 / RP13 / RP23', 2001, 2020, 'RP13', 'yamaha_rp23', 'Sport-tourer R4 1298 cm³ wał kardana'),
    M('y_vmax1700', 'yamaha', 'VMAX 1700', 'RP21', 2009, 2020, 'RP21', 'yamaha_rp21', 'Power-cruiser 1679 cm³ 65° V4 200 KM'),

    // SUZUKI
    M('s_dr650se', 'suzuki', 'DR650SE', 'SP46B', 1996, 2020, 'SP46B', 'suzuki_p405', 'Dual-sport 644 cm³ 1-cyl SACS'),
    M('s_sv650', 'suzuki', 'SV650 / V-Strom 650', 'AV / BY / C7 / VP53', 2003, 2025, 'WVBY', 'suzuki_p507', 'Naked / Adventure 645 cm³ 90° V2'),
    M('s_gsxr750_k4', 'suzuki', 'GSX-R750', 'WVB3 / WVCF / C4', 2004, 2019, 'WVB3', 'suzuki_r745', 'Superbike R4 749 cm³ SDTV'),
    M('s_gsx8s', 'suzuki', 'GSX-8S / V-Strom 800DE', 'EM11', 2023, 2025, 'EM11', 'suzuki_q501', 'Naked / Adventure R2 776 cm³ 270°'),
    M('s_gsxr1000_k5', 'suzuki', 'GSX-R1000', 'WVB6 / WVCL', 2005, 2008, 'WVB6', 'suzuki_t711', 'Superbike R4 999 cm³ (legendarna baza K5/K6)'),
    M('s_sv1000', 'suzuki', 'SV1000S / SV1000N', 'WVBX', 2003, 2007, 'WVBX', 'suzuki_t501', 'Sport-naked 996 cm³ 90° V2'),
    M('s_bandit1250', 'suzuki', 'GSF1250 Bandit / FA', 'WVCH', 2007, 2016, 'WVCH', 'suzuki_w501', 'Sport-tourer R4 1255 cm³ chłodzony cieczą'),
    M('s_hayabusa_gen1', 'suzuki', 'GSX1300R Hayabusa Gen 1', 'WVA1', 1999, 2007, 'WVA1', 'suzuki_wva1', 'Hypersport R4 1299 cm³ SRAD'),
    M('s_hayabusa_gen2', 'suzuki', 'GSX1300R Hayabusa Gen 2/3', 'WVCK / EJ11', 2008, 2025, 'WVCK', 'suzuki_wvck', 'Hypersport R4 1340 cm³ SDTV'),
    M('s_gsx1400', 'suzuki', 'GSX1400', 'BN111 / WVBN', 2001, 2008, 'BN111', 'suzuki_bn111', 'Muscle bike R4 1402 cm³ SACS'),

    // KAWASAKI
    M('k_klr650', 'kawasaki', 'KLR650', 'KL650A / E', 1987, 2018, 'KL650', 'kawasaki_kl650', 'Dual-sport 651 cm³ 1-cyl DOHC'),
    M('k_er6_ninja650', 'kawasaki', 'Ninja 650 / Z650 / Versys 650', 'ER650 / EX650 / LE650', 2006, 2025, 'EX650', 'kawasaki_ex650', 'All-rounder R2 649 cm³ 180°'),
    M('k_zx7r', 'kawasaki', 'Ninja ZX-7R', 'ZX750P', 1996, 2003, 'ZX750P', 'kawasaki_zx750p', 'Superbike R4 749 cm³ Ram-Air'),
    M('k_z750_z800', 'kawasaki', 'Z750 / Z800', 'ZR750L / ZR800A', 2007, 2016, 'ZR750L', 'kawasaki_zr750l', 'Streetfighter R4 748/806 cm³'),
    M('k_z900', 'kawasaki', 'Z900', 'ZR900B / D', 2017, 2025, 'ZR900B', 'kawasaki_zr900b', 'Supernaked R4 948 cm³'),
    M('k_zx9r', 'kawasaki', 'Ninja ZX-9R', 'ZX900C / E / F', 1998, 2003, 'ZX900E', 'kawasaki_zx900e', 'Supersport R4 899 cm³'),
    M('k_zx10r', 'kawasaki', 'Ninja ZX-10R', 'ZXT00D / E / J / S', 2006, 2020, 'ZXT00D', 'kawasaki_zxt00d', 'Superbike R4 998 cm³ kasetowa skrzynia'),
    M('k_z1000', 'kawasaki', 'Z1000 / Ninja 1000SX', 'ZXT00G / L / W', 2010, 2025, 'ZXT00G', 'kawasaki_zxt00g', 'Sport-tourer / Naked R4 1043 cm³'),
    M('k_zzr1100', 'kawasaki', 'ZZR1100 / Ninja ZX-11', 'ZXT10D', 1993, 2001, 'ZXT10D', 'kawasaki_zxt10d', 'Hypersport R4 1052 cm³ Ram-Air'),
    M('k_zzr1400', 'kawasaki', 'ZZR1400 / Ninja ZX-14R', 'ZXT40A / E', 2006, 2020, 'ZXT40A', 'kawasaki_zxt40a', 'Hypersport R4 1352/1441 cm³'),

    // TRIUMPH
    M('t_streettriple675', 'triumph', 'Street Triple 675 / Daytona 675', 'D67LD', 2006, 2016, 'D67LD', 'triumph_d67ld', 'Supersport / Naked R3 675 cm³ 120°'),
    M('t_streettriple765', 'triumph', 'Street Triple 765 RS / R', 'HD01 / HD04', 2017, 2025, 'HD01', 'triumph_765', 'Naked R3 765 cm³ (silnik bazowy Moto2)'),
    M('t_tiger800', 'triumph', 'Tiger 800 / XC / XR', 'A08', 2011, 2019, 'A08', 'triumph_800', 'Adventure R3 799 cm³'),
    M('t_bonnie900', 'triumph', 'Bonneville T100 / Street Twin', 'DP01', 2016, 2025, 'DP01', 'triumph_bonnie_900', 'Modern Classic R2 900 cm³ 270°'),
    M('t_speedtriple1050', 'triumph', 'Speed Triple 1050', '515NJ / 515NV', 2005, 2015, '515NJ', 'triumph_speed_1050', 'Streetfighter R3 1050 cm³'),
    M('t_tiger1200', 'triumph', 'Tiger 1200 Explorer', 'V13VG', 2012, 2021, 'V13VG', 'triumph_tiger_1200', 'Duży adventure R3 1215 cm³ wał kardana'),
    M('t_rocket3', 'triumph', 'Rocket 3 R / GT', 'Y101', 2020, 2025, 'Y101', 'triumph_rocket3', 'Power-cruiser R3 2458 cm³ longitudinal'),

    // BMW
    M('bmw_k75_c', 'bmw', 'K75 / K75S / K75RT', 'K569', 1985, 1996, 'K569', 'bmw_k75', 'Klasyk wzdłużny leżący R3 740 cm³'),
    M('bmw_f800gs', 'bmw', 'F800GS / F800R / F800GT', 'E8ST / K72', 2008, 2018, 'K72', 'bmw_f800', 'Adventure / Naked R2 798 cm³ 360° Rotax'),
    M('bmw_f900r', 'bmw', 'F900R / F900XR / F850GS', '4R90 / K81', 2019, 2025, 'K81', 'bmw_f900', 'All-rounder R2 895 cm³ 270°'),
    M('bmw_s1000rr_k46', 'bmw', 'S1000RR / S1000R / S1000XR', 'K46 / K47 / K67', 2009, 2025, 'K46', 'bmw_s1000rr', 'Superbike R4 999 cm³ ShiftCam'),
    M('bmw_r1150gs', 'bmw', 'R1150GS / R1150R / R1150RT', 'R21', 1999, 2004, 'R21', 'bmw_r1150', 'Klasyczny Boxer B2 1130 cm³ powietrze-olej'),
    M('bmw_r1200gs_dohc', 'bmw', 'R1200GS / Adventure (DOHC)', 'K25', 2010, 2013, 'K25', 'bmw_r1200', 'Boxer B2 1170 cm³ DOHC radial powietrze-olej'),
    M('bmw_r1250gs', 'bmw', 'R1250GS / Adventure', 'K50 / K51', 2018, 2024, 'K50', 'bmw_r1250', 'Boxer B2 1254 cm³ ShiftCam chłodzony cieczą'),
    M('bmw_k1300s', 'bmw', 'K1300S / K1300R / K1300GT', 'K40 / K43', 2009, 2016, 'K40', 'bmw_k1300', 'Sport-tourer R4 1293 cm³ 55° sucha miska'),
    M('bmw_k1600gt', 'bmw', 'K1600GT / GTL / Bagger', 'K48', 2011, 2025, 'K48', 'bmw_k1600', 'Luksusowy tourer R6 1649 cm³ 24V'),

    // DUCATI
    M('d_monster696', 'ducati', 'Monster 696 / 796', 'M5', 2008, 2014, 'M5', 'ducati_696', 'Naked 90° L2 Desmodue 696/803 cm³'),
    M('d_monster821', 'ducati', 'Monster 821 / Hypermotard 939', 'M6 / BA', 2014, 2020, 'M6', 'ducati_821', 'Sport-naked 90° L2 Testastretta 11°'),
    M('d_1198', 'ducati', '1098 / 1198 / Streetfighter 1098', 'H7', 2007, 2013, 'H7', 'ducati_1198', 'Superbike 90° L2 Testastretta Evoluzione 1198 cm³'),
    M('d_panigale1199', 'ducati', 'Panigale 1199 / 1299', 'H8', 2012, 2018, 'H8', 'ducati_1199', 'Superbike 90° L2 Superquadro 1198/1285 cm³'),
    M('d_multi1260', 'ducati', 'Multistrada 1260 DVT', 'AC', 2018, 2021, 'AC', 'ducati_1260_dvt', 'Adventure 90° L2 Testastretta DVT 1262 cm³'),
    M('d_panigalev4', 'ducati', 'Panigale V4 / Streetfighter V4', 'DA', 2018, 2025, 'DA', 'ducati_v4_stradale', 'Superbike 90° V4 Desmosedici Stradale 1103 cm³'),
    M('d_multiv4', 'ducati', 'Multistrada V4 / Pikes Peak', '1A', 2021, 2025, '1A', 'ducati_v4_granturismo', 'Adventure 90° V4 Granturismo 1158 cm³'),

    // KTM
    M('ktm_690duke', 'ktm', '690 Duke / SMC R / Enduro R', 'KTM 690', 2008, 2025, 'LC4', 'ktm_690_lc4', 'Supermoto / Naked 1-cyl LC4 690/693 cm³'),
    M('ktm_790duke', 'ktm', '790 Duke / 890 Duke R / 890 Adv', 'KTM 790/890', 2018, 2025, 'LC8c', 'ktm_790_lc8c', 'Naked / Adventure R2 LC8c 799/889 cm³ 285°'),
    M('ktm_990superduke', 'ktm', '990 Super Duke / 990 Adventure', 'LC8 990', 2005, 2013, 'LC8', 'ktm_990_lc8', 'Streetfighter / Adventure 75° V2 LC8 999 cm³'),
    M('ktm_1290superduke', 'ktm', '1290 Super Duke R / Super Adv', 'LC8 1290', 2014, 2025, 'LC8', 'ktm_1290_lc8', 'Hyper-naked / Adventure 75° V2 LC8 1301 cm³'),

    // APRILIA
    M('a_rs660', 'aprilia', 'RS 660 / Tuono 660 / Tuareg 660', 'KS / KY', 2020, 2025, 'KS', 'aprilia_660_r2', 'Sport / Naked R2 659 cm³ 270°'),
    M('a_shiver750', 'aprilia', 'Shiver 750 / Dorsoduro 750', 'RA / SM', 2007, 2016, 'RA', 'aprilia_750_v2', 'Naked / Supermoto 90° V2 750 cm³ Ride-by-wire'),
    M('a_rsv1000mille', 'aprilia', 'RSV 1000 Mille / Tuono 1000R', 'ME / RP / RR', 1998, 2010, 'RP', 'aprilia_v990', 'Superbike / Naked 60° V2 Rotax V990 998 cm³'),
    M('a_rsv4_1000', 'aprilia', 'RSV4 1000 / Tuono V4 1000', 'RK / TY', 2009, 2014, 'RK', 'aprilia_v4_1000', 'Superbike / Naked 65° V4 999 cm³ kasetowa skrzynia'),
    M('a_rsv4_1100', 'aprilia', 'RSV4 1100 Factory / Tuono V4 1100', 'KE / KZ', 2015, 2025, 'KE', 'aprilia_v4_1100', 'Superbike / Naked 65° V4 1077/1099 cm³'),

    // BENELLI
    M('b_trk502', 'benelli', 'TRK 502 / TRK 502X / Leoncino 500', 'BJ500', 2017, 2025, 'P17', 'benelli_trk502', 'Turystyczny adventure R2 500 cm³ 360°'),
    M('b_752s', 'benelli', '752S / TRK 702', 'BJ750', 2019, 2025, 'P28', 'benelli_752s', 'Naked / Tourer R2 754 cm³ 270°'),
    M('b_tnt899', 'benelli', 'TNT 899 / Tornado Tre 900', 'TN01', 2004, 2015, 'TN01', 'benelli_tnt899', 'Streetfighter R3 898 cm³ 120°'),

    // MV AGUSTA
    M('mv_f3_675', 'mvagusta', 'F3 675 / Brutale 675', 'F3', 2012, 2020, 'F3', 'mv_tre_675', 'Supersport / Naked R3 675 cm³ wał przeciwbieżny'),
    M('mv_f3_800', 'mvagusta', 'F3 800 / Brutale 800 / Dragster', 'B3', 2013, 2025, 'B3', 'mv_tre_800', 'Supersport / Naked R3 798 cm³'),
    M('mv_f4_750', 'mvagusta', 'F4 750 Serie Oro / S / SPR', 'F4', 1999, 2004, 'F4', 'mv_f4_750', 'Superbike R4 749 cm³ zawory promieniowe Radial'),
    M('mv_f4_1000', 'mvagusta', 'F4 1000 / Brutale 1090', 'F4 1000', 2004, 2018, 'F4 1000', 'mv_f4_1000', 'Superbike R4 998/1078 cm³ Radial TSS'),

    // POLARIS (ATV / UTV)
    M('pol_sportsman570', 'polaris', 'Sportsman 570 EFI EPS / Touring', 'ProStar 570', 2014, 2025, 'SP570', 'polaris_prostar570', 'Quad 4x4, przekładnia PVT, napęd On-Demand AWD'),
    M('pol_rzr1000', 'polaris', 'Scrambler XP 1000 / RZR 1000', 'ProStar 1000', 2014, 2025, 'XP1000', 'polaris_prostar1000', 'Sport ATV / SSV 4x4 89 KM'),

    // CAN-AM / BRP (ATV / UTV)
    M('can_outlander650', 'canam', 'Outlander 650 XT / MAX', 'G2', 2013, 2024, 'G2-650', 'canam_rotax650', 'Quad przeprawowy V-Twin 4x4 Visco-Lok'),
    M('can_renegade1000', 'canam', 'Renegade 1000R / Outlander 1000', 'G2-1000', 2012, 2025, 'G2-1000', 'canam_rotax1000', 'Sport-quad V2 976 cm³ 91 KM'),

    // CF MOTO (ATV / UTV)
    M('cfm_cforce450', 'cfmoto', 'CForce 450 / 520 Classic & Touring', 'CF400', 2016, 2025, 'CF400AU', 'cfmoto_191r', 'Quad 4x4 z blokadą dyfra, wtrysk Bosch'),
    M('cfm_cforce850', 'cfmoto', 'CForce 850 / 1000 EPS', 'CF800', 2018, 2025, 'CF800AU', 'cfmoto_2v91y', 'Przeprawowy V2 4x4 ze wspomaganiem EPS'),

    // YAMAHA ATV
    M('y_grizzly700', 'yamaha', 'Grizzly 700 EPS / Kodiak 700', 'YFM700', 2007, 2025, 'AM09 / AM11', 'yamaha_3b4', 'Quad 4x4 On-Command, pas Ultramatic ze sprzęgłem odśrodkowym'),

    // HONDA ATV
    M('h_trx420', 'honda', 'TRX 420 FourTrax Rancher', 'TE38', 2007, 2025, 'TE38', 'honda_trx420e', 'Quad 4x4 wzdłużny silnik, opcja ESP / DCT'),

    // SKUTERY & MAXISKUTERY
    M('piaggio_gts300', 'piaggio', 'Vespa GTS 300 / Beverly 300', 'HPE / Quasar', 2008, 2025, 'MA3 / MD3', 'piaggio_quasar300', 'Maxiskuter miejski 278 cm³ 4V ciecz'),
    M('kymco_downtown300', 'kymco', 'Downtown 300i / K-XCT 300', 'SK60', 2009, 2020, 'SK60', 'kymco_sk60', 'Maxiskuter turystyczny 299 cm³ 30 KM'),
    M('sym_cruisym300', 'sym', 'Cruisym 300 / Joyride 300', 'LM30', 2017, 2025, 'LM30', 'sym_joyride300', 'Maxiskuter turystyczny 278 cm³ ABS'),

    // MOTOROWERY 2T (AM6 & D50B0)
    M('am6_dt50', 'minarelli', 'Yamaha DT50 / Rieju MRT 50', 'AM6 6-bieg', 1997, 2024, 'AM6', 'minarelli_am6', 'Supermoto / Enduro 50 2T chłodzony cieczą'),
    M('derbi_senda50', 'minarelli', 'Derbi Senda 50 / Aprilia SX50', 'D50B0', 2006, 2024, 'SR1', 'derbi_d50b0', 'Supermoto 50 2T gaźnikowy'),

    // SKUTERY GY6 4T
    M('gy6_romet727', 'gy6', 'Romet 727 / Junak Vintage 50', '139QMB 4T', 2005, 2025, '139QMB', 'gy6_139qmb', 'Skuter miejski 50 cm³ 4T CVT'),
    M('gy6_maxi125', 'gy6', 'Junak 125 / Barton B-Max 125', '152QMI 4T', 2014, 2025, '152QMI', 'gy6_152qmi', 'Skuter 125 cm³ 4T CVT'),

    // SUZUKI V-TWIN
    M('s_sv650_k3', 'suzuki', 'SV650 / SV650S / Gladius / V-Strom', 'K3–M4 (AV/BY/WCX0)', 2003, 2025, 'AV / BY / WCX0', 'suzuki_sv650_v2', 'Naked / Sport / Adventure 90° V2 645 cm³ DOHC'),

    // HONDA V-TWIN
    M('h_vt750_shadow', 'honda', 'VT750 Shadow / Spirit / Phantom', 'RC50 / RC53', 2004, 2024, 'RC50', 'honda_vt750_v2', 'Cruiser 52° V-Twin 745 cm³ wał Kardana / łańcuch')

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
    f_starter_clutch: { title: 'Ślizgające się sprzęgło jednokierunkowe rozrusznika', sec: 'F', conf: 'B', desc: 'Rozrusznik kręci z metalicznym zgrzytem, ale nie obraca wałem korbowym (szczególnie na zimnym oleju lub przy słabym akumulatorze).', fix: 'Kontrola rolkowego/sprzęgiełkowego mechanizmu wolnego koła, sprężynek dociskowych i bieżni koła pośredniego.' },
    f_v4_cam_wear: { title: 'Wycieranie krzywek wałków rozrządu (V4)', sec: 'A', conf: 'B', desc: 'Zużycie szczytów krzywek wałków rozrządu przy rzadkich wymianach oleju lub pracy na zimnym oleju – spadek skoku zaworów i hałas z głowicy.', fix: 'Pomiar wysokości krzywek mikrometrem wg DTR OEM, kontrola ciśnienia oleju i kanałów magistrali głowicy, wymiana wałków i dźwigienek.' },
    f_shiftcam_actuator: { title: 'Usterka nastawnika zmiennych faz / profilu krzywek (ShiftCam / VVT)', sec: 'A', conf: 'B', desc: 'Elektromagnes przestawiacza nie przesuwa wałka na krzywki pełnego otwarcia powyżej zadanego progu obrotów – błąd ECU i spadek mocy.', fix: 'Kontrola oporności cewki elektrozaworu, zasilania 12V, test wykonawczy w oprogramowaniu serwisowym oraz kontrola rowków przesuwnych na wałku.' },
    f_desmo_closing_shims: { title: 'Zanikanie luzu płytek zamykających w rozrządzie Desmodromic', sec: 'A', conf: 'B', desc: 'Osiadanie stożków i półpierścieni zamykających (closers) kasuje luz płytki zamykającej – naprężenie trzonka zaworu na gorąco.', fix: 'Precyzyjny pomiar luzu zamykającego i otwierającego specjalnym szczelinomierzem kątowym, dobór płytek z dokładnością do 0.05 mm, wymiana półpierścieni.' },
    f_boxer_throttle_sync: { title: 'Rozsynchronizowanie linek i przepustnic w silnikach Boxer (B2)', sec: 'B', conf: 'B', desc: 'Nierówne napięcie lewej i prawej linki gazu lub zabrudzenie śrub obejściowych powietrza – silne wibracje poziome przy przyspieszaniu od 2000 obr/min.', fix: 'Synchronizacja podciśnieniowa wakuometrem na rozgrzanym silniku: najpierw śruby bypass na wolnych obrotach, następnie naciąg linek przy 2500–3000 obr/min.' },
    f_lc8_water_pump_seal: { title: 'Przeciek uszczelniacza wałka pompy cieczy (LC8)', sec: 'D', conf: 'B', desc: 'Wycieranie twardego wałka przez uszczelniacz teflonowy – płyn chłodzący przedostaje się do oleju, fałdowanie papierowego filtra oleju i spadek ciśnienia smarowania.', fix: 'Natychmiastowa wymiana wałka pompy cieczy, uszczelniacza z teflonową wargą, nowego filtra oleju i płukanie układu smarowania.' },
    f_cp3_cam_chain_tensioner: { title: 'Grzechotanie hydrauliczno-mechanicznego napinacza łańcucha CP3', sec: 'A', conf: 'B', desc: 'Wadliwe blokowanie zapadki napinacza przy spadku ciśnienia oleju na gorąco – głośne dzwonienie łańcucha rozrządu przy 3500–4500 obr/min.', fix: 'Montaż zmodernizowanego napinacza OEM z podwójną zapadką lub precyzyjnego manualnego napinacza śrubowego.' },
    f_tps_sub_throttle: { title: 'Zacięcie silnika krokowego przepustnic pomocniczych (STV / SDTV)', sec: 'B', conf: 'B', desc: 'Zimne luty w czujniku STP lub wyrobienie plastikowej przekładni silnika pomocniczego – kod błędu C28 / C29, silnik w trybie awaryjnym (brak mocy na wyższych biegach).', fix: 'Pomiar rezystancji czujnika położenia przepustnic pomocniczych, przelutowanie styków silnika STVA lub wymiana zespołu przepustnic.' },
    f_sprag_clutch_heavy: { title: 'Zużycie sprzęgiełka jednokierunkowego rozrusznika (duże pojemności V2 / 1-cyl)', sec: 'F', conf: 'B', desc: 'Przy gaszeniu lub cofnięciu wału w silnikach o dużej kompresji klocki sprzęgiełka ulegają obiciu – poślizg rozrusznika z metalicznym trzaskiem.', fix: 'Wymiana wieńca zębatego, sprzęgła jednokierunkowego (sprag clutch) i kontrola sprawności dekompresatora automatycznego.' },
    f_atv_cvu_belt_burn: { title: 'Spalenie i postrzępienie paska CVT w quadzie (ATV / UTV)', sec: 'F', conf: 'B', desc: 'Jazda na biegu High (H) w głębokim błocie lub holowanie ciężaru – ślizganie i zwęglenie kordu paska na talerzach, wibracje i brak napędu.', fix: 'Wymiana paska na wzmocniony (kevlar Heavy Duty), odtłuszczenie talerzy wariatora i kontrola uszczelnienia obudowy CVT.' },
    f_atv_front_diff_actuator: { title: 'Awaria serwomotoru załączania przedniego napędu 4WD / Diff-Lock', sec: 'E', conf: 'B', desc: 'Zalanie wodą siłownika elektrycznego na przednim dyfrze – brak załączania 4x4 lub stałe zablokowanie przedniej osi.', fix: 'Kontrola zasilania 12V na kostce serwomotoru, rezystancji silniczka, styków krańcowych położenia i wymiana uszczelnienia oringowego siłownika.' },
    f_atv_winch_relay: { title: 'Sklejenie styków solenoidu wyciągarki (przekaźnika wysokoprądowego)', sec: 'E', conf: 'B', desc: 'Przeciążenie prądowe (>200 A) lub zalanie błotem skleja styki – wyciągarka kręci w sposób ciągły bez wciskania przycisku na kierownicy.', fix: 'Natychmiastowe rozłączenie hebla głównego akumulatora, wymiana hermetycznego przekaźnika contactor 12V 250A i przegląd instalacji.' },
    f_abs_modulator_stuck: { title: 'Zacięcie elektrozaworu lub silnika pompy w modulatorze ABS', sec: 'D', conf: 'B', desc: 'Stary, zawodniony płyn hamulcowy powoduje korozję tłoczków elektrozaworów – twarda klamka hamulca, pulsowanie bez poślizgu lub błąd stały ABS.', fix: 'Płukanie i odpowietrzenie ciśnieniowe układu z procedurą wysterowania zaworów ABS w testerze diagnostycznym lub regeneracja modulatora.' },
    f_fork_seal_leak: { title: 'Wyciek oleju z uszczelniacza widelca teleskopowego USD na zacisk hamulcowy', sec: 'E', conf: 'B', desc: 'Mikrorysa od kamienia na rurze nośnej lub brud pod wargą uszczelniacza – olej zalewa klocki i tarczę hamulcową, drastyczny spadek siły hamowania.', fix: 'Czyszczenie zgarniacza narzędziem Seal Doctor, wymiana kompletu uszczelniaczy olejowych i pyłowych, polerowanie rury nośnej i wymiana klocków.' },
    f_canbus_termination: { title: 'Zaburzenia komunikacji magistrali CAN-BUS (brak rezystora terminującego)', sec: 'E', conf: 'B', desc: 'Uszkodzenie wiązki lub licznika/ECU rozrywa obwód terminujący – odbicia sygnału, kody braku łączności (U0100, U0121) i wariowanie zegarów.', fix: 'Pomiar rezystancji między CAN-High i CAN-Low na wyłączonym zapłonie (wymagane dokładnie 60 Ω przy dwóch rezystorach 120 Ω połączonych równolegle).' },
    f_exup_servo_strip: { title: 'Wyłamanie trybów serwomotoru zaworu wydechowego EXUP / SET', sec: 'B', conf: 'B', desc: 'Zapieczona przepustnica w kolektorze wydechowym przeciąża plastikowe zębatki serwa – błąd FI, brak dołu obrotów lub głośne rzężenie pod siedzeniem.', fix: 'Czyszczenie i smarowanie łożyskowania zaworu pastą ceramiczną, regulacja napięcia linek sterujących lub wymiana kółek zębatych serwa.' },
    f_lambda_heater: { title: 'Przepalenie obwodu grzałki sondy lambda (O2 Sensor)', sec: 'B', conf: 'B', desc: 'Przerwa w obwodzie podgrzewacza sondy – błąd układu wtryskowego FI po uruchomieniu silnika, praca w pętli otwartej i podwyższone spalanie.', fix: 'Pomiar rezystancji grzałki na pinach sondy (nominalnie 6–15 Ω w temperaturze pokojowej); w przypadku przerwy (nieskończoność) wymiana sondy.' },
    f_kardan_spline_dry: { title: 'Korozja i zużycie wielowypustu wału Kardana / przekładni kątowej', sec: 'F', conf: 'B', desc: 'Brak smaru molibdenowego na wielowypuście połączenia przesuwnego – stuki przy dodawaniu i ujmowaniu gazu, korozja cierna i ścięcie zębów.', fix: 'Demontaż przekładni kątowej, oczyszczenie wielowypustu, inspekcja luzu kątowego, naniesienie smaru litowo-molibdenowego MoS2 i wymiana oringów uszczelniających.' },
  };

  // ---------- 5. WALIDACJA DANYCH ----------
  function validate() {
    const errors = [];
    const engineIds = new Set();
    ENGINES.forEach(e => {
      if (engineIds.has(e.id)) errors.push('Duplikat silnika: ' + e.id);
      engineIds.add(e.id);
      if (!MANUFACTURERS.some(m => m.id === e.brand)) errors.push('Nieznany producent silnika: ' + e.id);
      if (![1, 2, 3, 4, 6].includes(e.cyl)) errors.push('Nieobsługiwana liczba cylindrów: ' + e.id);
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
