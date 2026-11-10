/**
 * NAPRAWNIK — MODUŁ MOTOCYKLI 3–4 CYLINDRY (400–650 cm³)
 * Silnik diagnostyczny, katalog hierarchiczny, 6 działów A–F,
 * 12 inteligentnych drzew diagnostycznych (8 punktów na krok),
 * diagnostyka porównawcza cylindrów R3 / R4 + kalkulator płytek zaworowych,
 * baza parametrów serwisowych (A/B/C/WERYFIKACJA) oraz 7 schematów technicznych SVG.
 */
(function () {
  'use strict';

  const STORAGE_KEYS = {
    ACTIVE_MODEL: 'naprawnik_multicyl_active_model_v1',
    CUSTOM_MODELS: 'naprawnik_multicyl_custom_models_v1',
    CUSTOM_PARAMS: 'naprawnik_multicyl_custom_params_v1',
    MEASUREMENTS: 'naprawnik_multicyl_measurements_v1'
  };

  const state = {
    activeTab: 'katalog', // 'katalog' | 'drzewa' | 'cylindry' | 'dzialy' | 'schematy'
    selectedModelId: 'h_cbr600rr_37',
    searchQuery: '',
    filterBrand: 'ALL',
    filterCylinders: 'ALL',
    filterLayout: 'ALL',
    filterFuel: 'ALL',
    filterCooling: 'ALL',
    filterDisplacement: 'ALL',
    // Drzewa diagnostyczne
    activeTreeId: 'missing_cylinder',
    activeStepId: 'step_1',
    treeHistory: [],
    // Działy A-F
    activeSectionId: 'ALL',
    sectionSearch: '',
    expandedProcedureId: 'A1',
    // Schematy
    activeSchematicId: 'sch_ignition',
    schematicZoom: 100,
    // Kalkulator płytek
    shimCalc: {
      measured: '0.12',
      targetMin: '0.16',
      targetMax: '0.20',
      currentShim: '1.85'
    }
  };

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const PARAM_ALIAS = {
    compressionPressure: 'compression',
    valveClearanceIntake: 'valveIn',
    valveClearanceExhaust: 'valveEx',
    sparkPlugType: 'sparkPlug',
    sparkPlugGap: 'plugGap',
    ignitionCoilPrimary: 'coilPrimary',
    ignitionCoilSecondary: 'coilSecondary',
    pickupCoilResistance: 'ckpRes',
    fuelPressure: 'fuelPressure',
    injectorResistance: 'injectorRes',
    chargingVoltage: 'charging',
    statorResistance: 'statorRes',
    thermostatOpenTemp: 'thermostatOpen',
    fanOnTemp: 'fanOn',
    idleSpeed: 'idleRpm',
    floatHeight: 'floatLevel'
  };

  function getData() {
    const base = window.NAPRAWNIK_MULTICYL_DATA || {
      MANUFACTURERS: [],
      PARAM_KEYS: [],
      ENGINES: [],
      MODELS: [],
      FAULTS: {}
    };

    const brandNameById = {};
    (base.MANUFACTURERS || []).forEach(b => {
      brandNameById[String(b.id).toLowerCase()] = b.name;
      brandNameById[String(b.name).toLowerCase()] = b.name;
    });

    const paramKeysMap = {};
    if (Array.isArray(base.PARAM_KEYS)) {
      base.PARAM_KEYS.forEach(tuple => {
        if (Array.isArray(tuple) && tuple[0]) {
          paramKeysMap[tuple[0]] = { label: tuple[1] || tuple[0], unit: tuple[2] || '' };
        }
      });
    } else if (base.PARAM_KEYS && typeof base.PARAM_KEYS === 'object') {
      Object.assign(paramKeysMap, base.PARAM_KEYS);
    }

    const enginesMap = {};
    const rawEngines = Array.isArray(base.ENGINES) ? base.ENGINES : Object.values(base.ENGINES || {});
    rawEngines.forEach(eng => {
      if (!eng || !eng.id) return;
      const normParams = {};
      Object.entries(eng.params || {}).forEach(([k, v]) => {
        if (!v) return;
        normParams[k] = {
          value: v.val !== undefined ? v.val : v.value,
          confidence: v.conf || v.confidence || 'B',
          source: v.src || v.source || ''
        };
      });
      enginesMap[eng.id] = {
        id: eng.id,
        code: eng.code || eng.id,
        displacementCc: eng.cc || eng.displacementCc || 600,
        cylinders: eng.cyl || eng.cylinders || 4,
        layout: eng.layout || 'R4',
        strokeType: (eng.stroke ? eng.stroke + 'T' : eng.strokeType) || '4T',
        boreStroke: eng.bore && eng.strokeMm ? `${eng.bore} × ${eng.strokeMm} mm` : (eng.boreStroke || 'Wg DTR OEM'),
        cooling: eng.cooling || 'liquid',
        fuelSystem: eng.fuel || eng.fuelSystem || 'efi',
        fuelDetail: eng.carbType || eng.fuelDetail || (eng.fuel === 'carb' ? 'Gaźniki wielogardzielowe' : 'Wtrysk wielopunktowy EFI'),
        ignition: eng.ignition || 'Elektroniczny TCI / ECU',
        valvetrain: eng.cam || eng.valvetrain || 'DOHC',
        valvesTotal: eng.valves || eng.valvesTotal || 16,
        compressionRatio: eng.compressionRatio || 'Wg DTR OEM',
        params: normParams,
        faults: eng.faults || [],
        notes: eng.dataNote || eng.notes || ''
      };
    });

    const faultsMap = {};
    Object.entries(base.FAULTS || {}).forEach(([fid, f]) => {
      faultsMap[fid] = {
        title: f.title || fid,
        section: f.sec || f.section || 'A',
        symptoms: f.desc || f.symptoms || '',
        causes: f.causes || 'Zużycie eksploatacyjne lub rozregulowanie układu wielocylindrowego.',
        fix: f.fix || ''
      };
    });

    const normBaseModels = (base.MODELS || []).map(m => {
      const eng = enginesMap[m.engine || m.engineId] || {};
      const bName = brandNameById[String(m.brand).toLowerCase()] || m.brand;
      const yrs = Array.isArray(m.years) ? `${m.years[0]}–${m.years[1]}` : String(m.years || '');
      const genText = m.generation || (m.gen ? (m.frame ? `${m.gen} (${m.frame})` : m.gen) : 'Standard');
      return {
        id: m.id,
        brand: bName,
        model: m.model,
        years: yrs,
        generation: genText,
        engineCode: m.engineCode || eng.code || m.engine || 'OEM',
        variant: m.variant || '',
        displacementCc: m.displacementCc || eng.displacementCc || 600,
        cylinders: m.cylinders || eng.cylinders || 4,
        layout: m.layout || eng.layout || 'R4',
        fuelSystem: m.fuelSystem || eng.fuelSystem || 'efi',
        cooling: m.cooling || eng.cooling || 'liquid',
        engineId: m.engine || m.engineId,
        faultIds: m.faultIds || eng.faults || [],
        note: m.note || ''
      };
    });

    const customModels = loadJson(STORAGE_KEYS.CUSTOM_MODELS, []);
    const allModels = normBaseModels.concat(Array.isArray(customModels) ? customModels : []);
    return {
      MANUFACTURERS: base.MANUFACTURERS || [],
      PARAM_KEYS: paramKeysMap,
      ENGINES: enginesMap,
      MODELS: allModels,
      FAULTS: faultsMap
    };
  }

  function getSelectedModel() {
    const d = getData();
    const savedId = localStorage.getItem(STORAGE_KEYS.ACTIVE_MODEL);
    if (savedId && d.MODELS.some(m => m.id === savedId)) {
      state.selectedModelId = savedId;
    }
    let found = d.MODELS.find(m => m.id === state.selectedModelId) || d.MODELS[0];
    if (!found) return null;
    const engine = d.ENGINES[found.engineId] || found.customEngine || {};
    const customParamsAll = loadJson(STORAGE_KEYS.CUSTOM_PARAMS, {});
    const overrides = customParamsAll[found.id] || {};
    const mergedParams = Object.assign({}, engine.params || {}, overrides);
    return {
      model: found,
      engine: engine,
      params: mergedParams
    };
  }

  function getParamText(ctx, key, fallbackText) {
    if (!ctx || !ctx.params) return fallbackText || 'Wymaga weryfikacji w DTR OEM';
    const realKey = PARAM_ALIAS[key] || key;
    const p = ctx.params[realKey] || ctx.params[key];
    const meta = (getData().PARAM_KEYS || {})[realKey] || {};
    const unit = meta && meta.unit ? ' ' + meta.unit : '';
    if (!p || p.value === null || p.value === undefined || p.value === '') {
      return fallbackText || 'WYMAGA WERYFIKACJI W DTR OEM (wprowadź wartość z manuala serwisowego dla tego kodu silnika)';
    }
    const badge = p.confidence === 'A'
      ? '[A • Zweryfikowane]'
      : p.confidence === 'B'
      ? '[B • Literatura serwisowa — potwierdź dla VIN]'
      : '[C • Orientacyjne — potwierdź w DTR]';
    return `${p.value}${unit} ${badge}`;
  }

  // ============================================================================
  // 4. ROZBUDOWANA DIAGNOSTYKA — 6 DZIAŁÓW (A–F)
  // ============================================================================
  const DIAGNOSTIC_SECTIONS = [
  {
    "id": "A",
    "code": "DZIAŁ A",
    "title": "SILNIKI I MECHANIKA",
    "color": "#f97316",
    "icon": "⚙️",
    "summary": "Kompresja, próba szczelności Leak Down, próba olejowa, owalizacja cylindrów, zawory i luzy 12V/16V/Desmo, wałki rozrządu, łańcuchy i napinacze CCT, panewki, uszczelka UPG, ciśnienie oleju oraz układ chłodzenia cieczą.",
    "procedures": [
      {
        "id": "A1",
        "name": "Pomiar kompresji w silniku wielocylindrowym (1–4 cyl, 2T i 4T)",
        "applicable": "Wszystkie silniki 1–4 cyl, 2T i 4T (rzędowe, widlaste V, bokser)",
        "symptom": "Nierówna praca silnika, spadek mocy, trudny rozruch na zimno, gaśnięcie po włączeniu biegu.",
        "causes": "Nieszczelność zaworów (podparcie, nagar), zużyte/zapieczone pierścienie tłokowe, przedmuch uszczelki głowicy, owalizacja cylindra.",
        "tools": "Manometr kompresji z gwintem M10×1.0 / M12×1.25 / M14×1.25, naładowany akumulator (min. 12.6 V), klucz do świec 14/16/18 mm, ładowarka buforowa.",
        "when": "Przy każdym podejrzeniu usterki mechanicznej, przed synchronizacją gaźników/przepustnic oraz przy zakupie pojazdu.",
        "steps": [
          "Rozgrzej silnik do temperatury roboczej (80–90°C oleju/płynu) i wyłącz zapłon.",
          "Odłącz zasilanie cewek zapłonowych (lub zdejmij fajkocewki COP) oraz odłącz wtryskiwacze / zamknij dopływ paliwa.",
          "Wykręć WSZYSTKIE świece zapłonowe i ułóż je w kolejności cylindrów.",
          "Wkręć końcówkę manometru z gumowym o-ringiem w gniazdo świecy badanego cylindra.",
          "Otwórz przepustnicę całkowicie (WOT — 100%) i kręć rozrusznikiem przez 4–6 sekund do ustabilizowania wskazówki manometru.",
          "Zapisz wynik dla każdego cylindra w tabeli i powtórz pomiar dla pozostałych gniazd."
        ],
        "measurementPoint": "Otwór świecy zapłonowej każdego cylindra (manometr dokręcony ręcznie z o-ringiem, przepustnica na 100% WOT).",
        "referenceValue": "Nominał: 11.0–14.5 bar (wg DTR danego modelu; wiarygodność B). Dopuszczalna różnica ciśnień między cylindrami: Δ ≤ 1.0–1.5 bar (maks. 10%).",
        "evaluation": "Za niska na jednym cylindrze: nieszczelność zaworu lub pierścieni. Za niska na dwóch sąsiednich: przedmuch uszczelki głowicy. Zbyt wysoka (>15.5 bar): potężny nagar w komorze spalania lub splanowana głowica po niefachowym tuningu.",
        "repairSteps": "Wykonaj próbę olejową (A3) lub Leak Down (A2). W razie nieszczelności zaworów sprawdź luzy zaworowe (A6), a w razie zatarcia zdemontuj cylinder do honowania.",
        "verification": "Ponowny pomiar kompresji na rozgrzanym silniku po regulacji luzów lub remoncie góry silnika; rozrzut między cylindrami nie może przekraczać 0.8 bar.",
        "linkedTool": "Karta Zlecenia Serwisowego & Diagnostyka Porównawcza Cylindrów"
      },
      {
        "id": "A2",
        "name": "Próba szczelności cylindrów (Leak Down Test)",
        "applicable": "Silniki 4T (1–4 cyl, Single, Twin, R3, R4, V2, Boxer)",
        "symptom": "Zaniżona kompresja na jednym lub kilku cylindrach — brak mocy, dymienie, ubytek płynu chłodniczego.",
        "causes": "Nieszczelność przylgni zaworu ssącego lub wydechowego, pęknięty/zużyty pierścień tłokowy, pęknięta uszczelka pod głowicą.",
        "tools": "Tester szczelności dwumanometryczny Leak Down, sprężarka powietrza (6–8 bar), klucz do obracania wałem korbowym i jego blokowania w GMP.",
        "when": "Gdy pomiar kompresji wykaże spadek ciśnienia — pozwala bez demontażu silnika ustalić dokładne miejsce usterki.",
        "steps": [
          "Ustaw tłok badanego cylindra dokładnie w Górnym Martwym Punkcie (GMP / TDC) suwu sprężania (wszystkie krzywki skierowane od zaworów).",
          "Zablokuj wał korbowy (np. zablokowane tylne koło na 6. biegu lub blokada wału na znaku T).",
          "Skalibruj tester Leak Down i podłącz przewód do gniazda świecy badanego cylindra.",
          "Podaj ciśnienie testowe (np. 5–6 bar) i odczytaj procentowy ubytek ciśnienia na drugim zegarze.",
          "Nasłuchuj miejsca ucieczki powietrza: gardziel ssąca (zawory ssące), końcówka wydechu (zawory wydechowe), wlew oleju/odma (pierścienie tłokowe), bąbelki w chłodnicy (uszczelka pod głowicą)."
        ],
        "measurementPoint": "Gniazdo świecy zapłonowej w GMP suwu sprężania przy zablokowanym wale korbowym.",
        "referenceValue": "Ubytek 0–8%: stan idealny (silnik po dotarciu); 8–15%: stan dopuszczalny eksploatacyjnie; powyżej 20%: silnik wymaga natychmiastowej rewizji głowicy/tłoka (wiarygodność A).",
        "evaluation": "Powietrze w wydechu = niedomknięty lub wypalony zawór wydechowy. Powietrze w dolocie = nieszczelny zawór ssący. Szum z odmy = zużycie pierścieni tłokowych. Bąble w chłodnicy = pęknięta uszczelka głowicy.",
        "repairSteps": "W razie nieszczelności zaworu: sprawdź luz zaworowy (A6). Jeśli luz jest poprawny, zdemontuj głowicę w celu dotarcia lub wymiany zaworów i frezowania gniazd.",
        "verification": "Powtórzenie testu Leak Down po naprawie — spadek ciśnienia musi wynosić poniżej 8%.",
        "linkedTool": "Elektroniczne Laboratorium (moduł pomiarów silnika)"
      },
      {
        "id": "A3",
        "name": "Kontrola szczelności cylindrów i próba olejowa",
        "applicable": "Wszystkie silniki 4-suwowe 1–4 cyl",
        "symptom": "Spadek ciśnienia sprężania na sucho w procedurze A1.",
        "causes": "Zużyte/zapieczone pierścienie tłokowe lub nieszczelność zaworów w głowicy.",
        "tools": "Manometr kompresji, strzykawka warsztatowa z elastycznym wężykiem, 3–5 ml czystego oleju silnikowego 10W-40.",
        "when": "Natychmiast po stwierdzeniu niskiej kompresji na sucho, gdy nie masz pod ręką testera Leak Down.",
        "steps": [
          "Przez otwór świecy badanego cylindra wstrzyknij 3–5 ml oleju silnikowego bezpośrednio na denko tłoka.",
          "Obróć wałem korbowym o 2 obroty bez manometru, aby film olejowy uszczelnił pierścienie w gładzi cylindra.",
          "Wkręć manometr i ponownie zmierz ciśnienie sprężania przy pełnym otwarciu przepustnicy (WOT)."
        ],
        "measurementPoint": "Otwór świecy badanego cylindra po podaniu dawki oleju uszczelniającego pierścienie.",
        "referenceValue": "Wzrost ciśnienia o ponad 2.0 bar po podaniu oleju potwierdza nieszczelność na linii pierścień–cylinder (wiarygodność B).",
        "evaluation": "Wyraźny wzrost kompresji = usterka w układzie tłokowo-cylindrowym (zużyte pierścienie, owalizacja). Brak wzrostu = nieszczelność zaworów w głowicy lub przedmuch uszczelki głowicy.",
        "repairSteps": "Przy nieszczelnych zaworach zdejmij pokrywę i wyreguluj luzy (A6). Przy zużytych pierścieniach demontaż cylindrów, pomiar owalizacji i wymiana pierścieni/tłoków.",
        "verification": "Weryfikacja kompresji po remoncie na sucho — wartość nominalna osiągana bez użycia oleju.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      },
      {
        "id": "A4",
        "name": "Diagnostyka tłoków, pierścieni i gładzi cylindrowych (Nikasil / żeliwo)",
        "applicable": "Cylindry powlekane Nikasilem oraz tuleje żeliwne (2T i 4T)",
        "symptom": "Niebieski dym z wydechu, nadmierne zużycie oleju (>0.5 l / 1000 km), spadek mocy, przedmuchy do skrzyni korbowej.",
        "causes": "Zużycie lub zapieczenie pierścienia zgarniającego nagarem, wytarcie siatki honowniczej, pionowe rysy po zatarciu, owalizacja cylindra.",
        "tools": "Endoskop warsztatowy HD z kamerą kątową 90°, średnicówka zegarowa, mikrometr zewnętrzny, szczelinomierz do zamków pierścieni.",
        "when": "Przed remontem góry silnika oraz przy endoskopowej inspekcji przedzakupowej.",
        "steps": [
          "Wprowadź sondę endoskopu przez otwór świecy przy tłoku w Dolnym Martwym Punkcie (DMP).",
          "Oceń stan siatki honowniczej (krzyżowej), obecność pionowych rys, progu w górnej strefie zwrotu pierścieni oraz nagaru na denku tłoka.",
          "Po demontażu cylindra zmierz średnicówką owalizację i stożkowatość na 3 wysokościach (góra, środek, dół) w 2 osiach (X i Y).",
          "Włóż pierścień do cylindra, wciśnij denkiem tłoka na 15 mm i zmierz szczelinomierzem luz na zamku (End Gap)."
        ],
        "measurementPoint": "Wnętrze cylindra (3 poziomy pomiaru) oraz szczelina zamka pierścienia.",
        "referenceValue": "Owalizacja dopuszczalna: maks. 0.03–0.05 mm. Luz na zamku pierścienia kompresyjnego: 0.15–0.30 mm (limit zużycia: 0.50 mm; wiarygodność B).",
        "evaluation": "Wytarty Nikasil do warstwy aluminium = cylinder wymaga nałożenia nowej powłoki Nikasil lub wymiany. Rysy wyczuwalne paznokciem = utrata kompresji i dymienie.",
        "repairSteps": "Lekkie zmatowienie: honowanie szczotką Flex-Hone do odtworzenia siatki smarnej. Głębokie rysy w tulei żeliwnej: szlif na nadwymiar (+0.25/+0.50 mm) i nowy komplet tłoka.",
        "verification": "Pomiary średnicówką po obróbce — zachowanie idealnego pasowania tłok-cylinder (np. 0.035–0.045 mm dla kutej/odlewanej selekcji).",
        "linkedTool": "Kalkulator Squish & CR"
      },
      {
        "id": "A5",
        "name": "Pomiar luzów zaworowych i dobór płytek regulacyjnych (12V / 16V / Desmo)",
        "applicable": "Silniki 4T ze szklankami/płytkami zaworowymi (R2, R3, R4, V2, V4, Boxer, Desmo)",
        "symptom": "Trudny rozruch ciepłego silnika, gaśnięcie po nagrzaniu, metaliczne cykanie z głowicy (zbyt duży luz) lub cicha praca z wypadaniem zapłonów (luz zerowy!).",
        "causes": "Osiadanie zaworów w gniazdach (luz zaworowy ZMNIEJSZA SIĘ wraz z przebiegiem), zużycie płytek lub krzywek.",
        "tools": "Zestaw szczelinomierzy listkowych precyzyjnych (skok co 0.02/0.03 mm), mikrometr do pomiaru płytek (dokładność 0.005 mm), magnes neodymowy do wyjmowania płytek, klucz dynamometryczny 1/4\" (9–12 Nm do mostków).",
        "when": "Zgodnie z interwałem serwisowym producenta (zwykle co 24 000–42 000 km w motocyklach japońskich, co 10 000 km w BMW Boxer / skuterach GY6).",
        "steps": [
          "Pomiar wykonuj WYŁĄCZNIE na całkowicie zimnym silniku (temperatura bloku poniżej 30°C / optymalnie 20°C).",
          "Zdejmij pokrywę zaworów i ustaw dany cylinder w GMP suwu sprężania (obie krzywki skierowane ku górze z dala od popychaczy).",
          "Wsuń listek szczelinomierza pomiędzy krzywkę wałka a szklankę popychacza — listek powinien przesuwać się z lekkim, wyczuwalnym oporem.",
          "Zapisz zmierzoną wartość dla każdego zaworu w Karcie Pomiarowej NAPRAWNIKA.",
          "Jeżeli luz wykracza poza tolerancję, zdemontuj wałki rozrządu, wyjmij płytkę magnesem i zmierz jej rzeczywistą grubość mikrometrem.",
          "Skorzystaj z wbudowanego w NAPRAWNIK Kalkulatora Płytek Zaworowych, aby obliczyć idealną nową grubość płytki: Nowa = Stara + (Zmierzony - Zadany_Środek)."
        ],
        "measurementPoint": "Szczelina pomiędzy szczytem/plecami krzywki wałka a szklanką popychacza przy wałku w pozycji spoczynkowej.",
        "referenceValue": "Zgodnie z tabelą parametrów wybranego modelu: Ssące zazwyczaj 0.13–0.20 mm; Wydechowe 0.20–0.30 mm (wiarygodność B/A).",
        "evaluation": "Luz za ciasny (<0.10 mm wydech): niebezpieczeństwo wypalenia zaworu i zniszczenia gniazda! Luz za duży (>0.35 mm): głośna praca, zużycie krzywki, skrócenie czasu otwarcia zaworu.",
        "repairSteps": "Montaż nowej płytki o obliczonej grubości, ponowne przykręcenie mostków wałków rozrządu zalecanym momentem (zwykle 10–12 Nm) i ponowny pomiar szczelinomierzem.",
        "verification": "Dwukrotny obrót wałem korbowym o 360° i ponowna kontrola luzów szczelinomierzem przed montażem pokrywy zaworów.",
        "linkedTool": "Kalkulator Płytek Zaworowych (wbudowany w NAPRAWNIK)"
      },
      {
        "id": "A6",
        "name": "Kontrola łańcucha rozrządu, ślizgów i napinacza (CCT)",
        "applicable": "Silniki z rozrządem łańcuchowym (DOHC/SOHC 1–4 cyl)",
        "symptom": "Metaliczne grzechotanie i rzężenie z prawej strony silnika (tunelu rozrządu) na zimnym silniku lub przy schodzeniu z 4000 do 2000 obr/min.",
        "causes": "Wyciągnięty łańcuch rozrządu, wytarty ślizg napinający/prowadzący, uszkodzony mechanizm zapadkowy lub hydrauliczny napinacza CCT.",
        "tools": "Suwmiarka precyzyjna, klucze nasadowe, wkrętak płaski do zwijania napinacza sprężynowego.",
        "when": "Zawsze przy hałasie rozrządu oraz co 40 000–50 000 km.",
        "steps": [
          "Zdemontuj napinacz rozrządu CCT i sprawdź, ile ząbków pozostało do końca wysunięcia trzpienia.",
          "Jeżeli napinacz jest wysunięty do ostatniego lub przedostatniego ząbka (powyżej 85% zakresu), łańcuch rozrządu jest trwale wyciągnięty i wymaga wymiany.",
          "Sprawdź stan gumowej wykładziny ślizgów rozrządu przez otwory inspekcyjne lub kamerą endoskopową.",
          "Oceń znaki rozrządu na kołach zębatych wałków i wale korbowym — wyciągnięty łańcuch opóźnia fazy rozrządu o pół zęba."
        ],
        "measurementPoint": "Wysunięcie trzpienia napinacza CCT oraz pokrywanie się znaków rozrządu na kołach wałków z krawędzią głowicy.",
        "referenceValue": "Maksymalne wysunięcie napinacza: nie więcej niż 75–80% zakresu roboczego (wiarygodność B).",
        "evaluation": "Łańcuch wyciągnięty grozi przeskoczeniem o ząb przy gwałtownej redukcji biegu, co prowadzi do kolizji tłoków z zaworami.",
        "repairSteps": "Wymiana łańcucha rozrządu (oryginalny zakuwany DID/Morse), wymiana ślizgów i montaż nowego lub zmodernizowanego napinacza OEM.",
        "verification": "Obrót wałem korbowym o 720°, kontrola idealnego pokrywania się znaków faz rozrządu i cicha praca silnika po uruchomieniu.",
        "linkedTool": "Automatyczny Plan Serwisowy"
      },
      {
        "id": "A7",
        "name": "Kontrola ciśnienia oleju i układu smarowania magistrali głównej",
        "applicable": "Wszystkie silniki 4-suwowe 1–4 cyl",
        "symptom": "Świecenie lub mruganie kontrolki ciśnienia oleju na wolnych obrotach na gorącym silniku, stuki z dołu silnika (panewki).",
        "causes": "Zużyte panewki korbowodowe lub główne, zatarty zawór upustowy pompy oleju (PRV w pozycji otwartej), zużyte rotory pompy oleju, rozcieńczenie oleju benzyną.",
        "tools": "Manometr ciśnienia oleju 0–10 bar z elastycznym wężem i adapterami gwintowymi M14/M16/M18/1/8 NPT.",
        "when": "Zawsze gdy kontrolka oleju nie gaśnie natychmiast po rozruchu lub po przegrzaniu jednostki.",
        "steps": [
          "Wykręć czujnik ciśnienia oleju (lub śrubę zaślepiającą główną magistralę olejową).",
          "Wkręć końcówkę manometru i uruchom silnik.",
          "Odczytaj ciśnienie na zimnym silniku na biegu jałowym, a następnie rozgrzej silnik do 80°C oleju.",
          "Sprawdź ciśnienie na gorącym oleju przy obrotach biegu jałowego oraz przy 5000–6000 obr/min."
        ],
        "measurementPoint": "Główna magistrala olejowa w bloku silnika (port czujnika ciśnienia oleju).",
        "referenceValue": "Bieg jałowy gorący: min. 0.8–1.5 bar; Przy 5000 obr/min gorący: 3.5–5.5 bar (wiarygodność B).",
        "evaluation": "Ciśnienie poniżej 0.5 bar na biegu jałowym na gorąco grozi natychmiastowym obróceniem panewki korbowodowej! Zbyt wysokie (>7 bar) wskazuje na zablokowany zawór upustowy.",
        "repairSteps": "Wymiana oleju na zalecaną lepkość OEM; kontrola czystości smoka pompy w misce; w razie niskiego ciśnienia rewizja pompy oleju i panewek wału korbowego.",
        "verification": "Ponowny pomiar ciśnienia manometrem po wymianie oleju/pompy — stabilne ciśnienie powyżej 1.0 bar na gorącym jałowym.",
        "linkedTool": "Elektroniczne Laboratorium"
      },
      {
        "id": "A8",
        "name": "Próba ciśnieniowa szczelności układu chłodzenia i termostatu",
        "applicable": "Wszystkie silniki chłodzone cieczą",
        "symptom": "Ubytek płynu chłodzącego bez widocznych kałuż pod motocyklem, zapowietrzanie się układu, gotowanie płynu.",
        "causes": "Nieszczelność na opaskach węży, mikropęknięcie chłodnicy od wibracji, zablokowany termostat, nieszczelny korek chłodnicy.",
        "tools": "Zestaw do ciśnieniowego testowania chłodnic z pompką ręczną, termometr cyfrowy.",
        "when": "Po każdej wymianie płynu chłodniczego lub naprawie elementów układu chłodzenia.",
        "steps": [
          "Zamontuj adapter z pompką na wlewie chłodnicy na zimnym silniku.",
          "Wytwórz ciśnienie równe ciśnieniu roboczemu korka (1.0–1.2 bar).",
          "Obserwuj manometr przez 15–20 minut: spadek ciśnienia wskazuje na nieszczelność.",
          "Test termostatu: podgrzej termostat w kąpieli wodnej; początek otwarcia powinien nastąpić przy 80–84°C, pełne otwarcie (skok min. 8 mm) przy 95°C."
        ],
        "measurementPoint": "Szyjka wlewu chłodnicy (manometr pompki testowej) oraz grzybek termostatu.",
        "referenceValue": "Ciśnienie 1.1 bar utrzymane przez 15 minut bez spadku wskazówki (wiarygodność A).",
        "evaluation": "Spadek ciśnienia bez widocznego wycieku na zewnątrz wskazuje na wyciek wewnętrzny do cylindra lub skrzyni korbowej.",
        "repairSteps": "Dokręcenie lub wymiana opasek zaciskowych, wymiana termostatu na nowy OEM, odpowietrzenie układu przez odpowietrzniki na pompie i termostacie.",
        "verification": "Równomierne nagrzewanie się chłodnicy i stabilny poziom płynu w zbiorniczku wyrównawczym po ostygnięciu silnika.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      }
    ]
  },
  {
    "id": "B",
    "code": "DZIAŁ B",
    "title": "UKŁADY PALIWOWE I WTRYSK EFI",
    "color": "#10b981",
    "icon": "⛽",
    "summary": "Gaźniki pojedyncze i wielogardzielowe, synchronizacja podciśnienia, czyszczenie ultradźwiękowe, dysze i iglice, poziomy pływaków i zaworki iglicowe, układ ssania, lewe powietrze, wtrysk EFI, wtryskiwacze, pompa paliwa, regulator ciśnienia FPR oraz czujniki dolotu TPS, MAP, IAT.",
    "procedures": [
      {
        "id": "B1",
        "name": "Kompleksowa rewizja i czyszczenie baterii 1–4 gaźników w myjce ultradźwiękowej",
        "applicable": "Wszystkie silniki gaźnikowe (1, 2, 3, 4 gaźniki Keihin, Mikuni, Dellorto)",
        "symptom": "Nierówna praca silnika po postoju zimowym, praca tylko na ssaniu, kichanie w gaźnik, jeden kolektor wydechowy zimny.",
        "causes": "Wytrącenie żywic i osadów ze starego paliwa (bioetanol E10), zapchane dysze wolnych obrotów (pilot jets), zablokowane kanały powietrzne.",
        "tools": "Myjka ultradźwiękowa podgrzewana (min. 40–50°C), specjalistyczny koncentrat do czyszczenia gaźników, sprężone powietrze, precyzyjne wkrętaki gaźnikowe.",
        "when": "Po dłuższym postoju, przed synchronizacją oraz przy problemach z wolnymi obrotami.",
        "steps": [
          "Zdemontuj gaźniki z pojazdu, rozłącz komory pływakowe i wyjmij pływaki z zaworkami iglicowymi.",
          "Wykręć dysze główne, dysze wolnych obrotów, rurki emulsyjne oraz wyjmij śruby składu mieszanki wraz ze sprężynkami, podkładkami i mikroskopijnymi o-ringami.",
          "Zdemontuj membrany podciśnieniowe wraz z przepustnicami tłoczkowymi (elementy gumowe NIE mogą być myte w agresywnej chemii ani w zbyt wysokiej temperaturze!).",
          "Myj korpusy i dysze w myjce ultradźwiękowej w temperaturze 45°C przez 20–30 minut.",
          "Natychmiast po wyjęciu przedmuchaj sprężonym powietrzem każdy otworek kalibrowany, kanał przejścia wolnych obrotów oraz gniazda zaworków iglicowych.",
          "Złóż gaźniki stosując nowe gumowe o-ringi i ustaw śruby składu mieszanki na wartość bazową (zwykle 1.5–2.5 obrotu od lekkiego oporu)."
        ],
        "measurementPoint": "Drożność kanałów kalibrowanych i stan końcówki iglicy śruby składu mieszanki.",
        "referenceValue": "Wszystkie dysze o rozmiarach zgodnych z DTR danego rocznika (wiarygodność B). Zero zanieczyszczeń w kanale wolnych obrotów.",
        "evaluation": "Niedokładne przedmuchanie kanału pilot circuit uniemożliwi późniejszą regulację i synchronizację gaźników.",
        "repairSteps": "Montaż zestawu naprawczego gaźników (nowe zaworki iglicowe, o-ringi, uszczelki komór pływakowych).",
        "verification": "Stabilna praca silnika na biegu jałowym bez ssania i natychmiastowa reakcja na gaz.",
        "linkedTool": "Stroiciel Gaźnika (Jetting Tool)"
      },
      {
        "id": "B2",
        "name": "Synchronizacja 2–4 gaźników i przepustnic wtryskowych (TB Sync wakuometrem)",
        "applicable": "Wszystkie silniki wielocylindrowe z osobnymi gardzielami (R2, R3, R4, V2, Boxer)",
        "symptom": "Silne wibracje silnika przy ruszaniu, nierówny bieg jałowy, szarpanie przy małym otwarciu gazu, powolne opadanie z obrotów.",
        "causes": "Różnice w stopniu otwarcia przepustnic na poszczególnych cylindrach na skutek wibracji i zużycia mechanizmów cięgien.",
        "tools": "Zestaw wakuometrów 4-zegarowych z tłumikami drgań lub wakuometr elektroniczny/słupkowy, długi śrubokręt do synchronizacji gaźników.",
        "when": "Po każdej regulacji zaworów, po czyszczeniu gaźników lub co 12 000 km.",
        "steps": [
          "Synchronizację wykonuj ZAWSZE po wcześniejszym ustawieniu prawidłowych luzów zaworowych!",
          "Rozgrzej silnik do pełnej temperatury roboczej i podłącz wężyki wakuometrów do króćców podciśnieniowych poszczególnych cylindrów.",
          "Ustal cylinder bazowy (w silnikach 4-cylindrowych jest to zazwyczaj cylinder nr 2 lub nr 3 z nieruchomą dźwignią połączoną z linką gazu).",
          "Na biegu jałowym (np. 1200 obr/min) wyreguluj śrubami synchronizacyjnymi podciśnienie cylindra 1 względem 2, następnie 4 względem 3, a na końcu zsynchronizuj parę 1-2 z parą 3-4 śrubą centralną.",
          "W silnikach z wtryskiem EFI (TB Sync) regulację wykonuje się mosiężnymi śrubami obejściowymi powietrza (air bypass screws)."
        ],
        "measurementPoint": "Króćce podciśnieniowe w króćcach ssących każdego cylindra.",
        "referenceValue": "Różnica podciśnienia pomiędzy cylindrami: Δ ≤ 20 mmHg / 2.7 kPa (wielkości wskazówek idealnie zrównane; wiarygodność A).",
        "evaluation": "Zrównanie podciśnień eliminuje 80% drgań na biegu jałowym i drastycznie wycisza hałas kosza sprzęgłowego na luzie.",
        "repairSteps": "Precyzyjna regulacja śrubami balansującymi; kontrola szczelności zaślepek króćców po odłączeniu manometrów.",
        "verification": "Krótkie przegazowanie (do 4000 obr/min) — wskazówki muszą opadać synchronicznie i wracać do identycznego poziomu na wolnych obrotach.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      },
      {
        "id": "B3",
        "name": "Pomiar wysokości pływaków i rzeczywistego poziomu paliwa",
        "applicable": "Wszystkie silniki gaźnikowe",
        "symptom": "Zalewanie świec, wysokie spalanie, dymienie na czarno (poziom za wysoki) lub dławienie przy pełnym gazie i strzały w wydech (poziom za niski).",
        "causes": "Odkształcona blaszka pływaka, nieszczelny pływak nasiąknięty paliwem, zamontowany nieoryginalny zaworek iglicowy o innej długości.",
        "tools": "Suwmiarka lub przymiar kątowy do pływaków, przezroczysta rurka igielitowa z adapterem do spustu komory pływakowej.",
        "when": "Przy każdym czyszczeniu gaźników lub podejrzeniu przelewania.",
        "steps": [
          "Metoda sucha: przechyl baterię gaźników pod kątem ok. 60° tak, aby języczek pływaka dotknął sprężynującej iglicy zaworka, ale jej NIE ścisnął; zmierz suwmiarką odległość od krawędzi korpusu do szczytu pływaka.",
          "Metoda mokra (dokładniejsza): podłącz przezroczysty wężyk do króćca spustowego komory, zegnij ku górze wzdłuż krawędzi gaźnika, odkręć śrubę spustową i podaj paliwo ze zbiornika technicznego.",
          "Odczytaj rzeczywisty menisk paliwa względem znaku lub linii łączenia komory pływakowej."
        ],
        "measurementPoint": "Wysokość pływaka od krawędzi korpusu bez uszczelki lub poziom menisku cieczy w rurce.",
        "referenceValue": "Wg specyfikacji danego gaźnika (np. 13.0 mm, 14.5 mm ± 1.0 mm; wiarygodność B).",
        "evaluation": "Zbyt wysoki poziom paliwa wzbogaca mieszankę w całym zakresie obrotów; zbyt niski grozi zubożeniem i przegrzaniem tłoka.",
        "repairSteps": "Delikatne podgięcie blaszki oporowej pływaka; wymiana pływaka jeśli jest nieszczelny.",
        "verification": "Pozostawienie gaźników pod ciśnieniem słupa paliwa przez 30 minut — zero wycieków z gardzieli dolotowych.",
        "linkedTool": "Stroiciel Gaźnika (Jetting Tool)"
      },
      {
        "id": "B4",
        "name": "Test szczelności zaworków iglicowych i króćców ssących (lewe powietrze)",
        "applicable": "Wszystkie silniki gaźnikowe i wtryskowe EFI",
        "symptom": "Zawieszanie się obrotów przy schodzeniu, strzały w wydech przy zamykaniu gazu, benzyna lejąca się do oleju.",
        "causes": "Zużyty gumowy stożek zaworka iglicowego, pęknięcia gumowych króćców ssących od starości, stwardniałe o-ringi pod króćcami.",
        "tools": "Pompka podciśnieniowa Mityvac z manometrem, spray Break Cleaner do testu lewego powietrza.",
        "when": "Zawsze przy zapachu paliwa z oleju lub niestabilnych obrotach jałowych.",
        "steps": [
          "Wyjmij zaworek iglicowy i obejrzyj stożek pod lupą: obecność rowka dyskwalifikuje zaworek.",
          "Podaj ciśnienie 0.5 bar na króciec paliwowy przy dociśniętym pływaku: ciśnienie musi się utrzymać min. 30 s bez spadku.",
          "Test lewego powietrza: uruchom silnik i delikatnie psiknij Break Cleanerem na króćce ssące; każda zmiana obrotów oznacza nieszczelność."
        ],
        "measurementPoint": "Gniazdo zaworka iglicowego oraz korpus gumowego króćca ssącego.",
        "referenceValue": "Zero wycieków z zaworka pod ciśnieniem 0.5 bar; absolutny brak reakcji silnika na natrysk preparatu na króćce (wiarygodność A).",
        "evaluation": "Lewe powietrze zubaża mieszankę i potrafi wypalić tłok w 50 km jazdy autostradowej!",
        "repairSteps": "Wymiana zaworków iglicowych z gniazdami oraz montaż nowych gumowych króćców ssących OEM.",
        "verification": "Płynne schodzenie silnika z obrotów prosto do stabilnego biegu jałowego.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      },
      {
        "id": "B5",
        "name": "Diagnostyka wtryskiwaczy EFI (rezystancja cewki, wydatek i kształt strugi)",
        "applicable": "Wszystkie silniki z wtryskiem paliwa EFI (motocykle, skutery, quady)",
        "symptom": "Wypadanie zapłonów na jednym cylindrze, dławienie przy gwałtownym otwarciu gazu, błąd wtryskiwacza na desce rozdzielczej (FI).",
        "causes": "Zanieczyszczenie sitka wtryskiwacza, zapieczenie iglicy wtryskiwacza, przerwa lub zwarcie w cewce elektromagnesu.",
        "tools": "Multimetr cyfrowy, generator impulsów wtryskiwaczy, menzurki pomiarowe, myjka ultradźwiękowa do wtryskiwaczy.",
        "when": "Nierówna praca silnika EFI, błąd obwodu wtryskiwacza lub spadek mocy.",
        "steps": [
          "Odłącz wtyczkę wtryskiwacza i zmierz rezystancję cewki multimetrem w temperaturze 20°C.",
          "Sprawdź zasilanie 12V na wtyczce po włączeniu zapłonu oraz impuls masy podawany z ECU diodą probierczą LED.",
          "Wyjmij listwę wtryskową z wtryskiwaczami, skieruj wtryskiwacze do menzurek i zakręć rozrusznikiem pod ciśnieniem paliwa.",
          "Oceń kształt strugi: paliwo musi być rozpylane w stożek drobnej mgiełki, bez grubych kropel i bez sikania ciągłym strumieniem.",
          "Sprawdź szczelność przy wyłączonym wysterowaniu: wtryskiwacz nie może uronić ani jednej kropli w ciągu minuty."
        ],
        "measurementPoint": "Piny cewki wtryskiwacza oraz końcówka rozpylająca.",
        "referenceValue": "Rezystancja wtryskiwacza: wysokooporowe 11.5–14.5 Ω (niskooporowe 1.5–3.0 Ω; wiarygodność B). Równomierność wydatku między cylindrami: różnica < 3%.",
        "evaluation": "Lejący wtryskiwacz zmywa film olejowy z gładzi cylindra i niszczy pierścienie. Zapchany wtryskiwacz zubaża mieszankę i przegrzewa zawory.",
        "repairSteps": "Mycie wtryskiwaczy w myjce ultradźwiękowej z jednoczesnym cyklicznym otwieraniem impulsowym; w razie uszkodzenia cewki wymiana wtryskiwacza.",
        "verification": "Równy wydatek we wszystkich menzurkach pomiarowych i natychmiastowe odcięcie strugi.",
        "linkedTool": "Elektroniczne Laboratorium"
      },
      {
        "id": "B6",
        "name": "Kontrola pompy paliwa i ciśnienia w listwie EFI (FPR)",
        "applicable": "Wszystkie układy EFI",
        "symptom": "Silnik dławi się i krztusi przy obrotach powyżej 7000–9000 obr/min, gaśnie przy małej ilości paliwa w zbiorniku, buczenie pompy.",
        "causes": "Zabrudzone sitko wstępne na dnie zbiornika, zapchany filtr wysokociśnieniowy w korpusie pompy, uszkodzony regulator ciśnienia FPR.",
        "tools": "Manometr paliwa z trójnikiem i szybkozłączkami, menzurka pomiarowa.",
        "when": "Spadek mocy pod pełnym obciążeniem i przy wysokich prędkościach.",
        "steps": [
          "Wepnij manometr z zaworem odcinającym w przewód zasilający listwę wtryskową.",
          "Włącz zapłon: odczytaj ciśnienie statyczne dobite przez pompę.",
          "Uruchom silnik i obserwuj manometr na wolnych obrotach oraz po gwałtownym przygazowaniu — ciśnienie nie może spaść nawet o 0.2 bar!",
          "Test wydatku pompy: skieruj wąż do menzurki, zewrzyj przekaźnik pompy na 10 sekund i zmierz ilość przepompowanego paliwa."
        ],
        "measurementPoint": "Przewód paliwowy wysokiego ciśnienia przed listwą wtryskową.",
        "referenceValue": "Ciśnienie robocze: typowo 3.0–3.5 bar (Polaris: 4.0 bar; wiarygodność B). Wydatek: min. 200–300 ml w ciągu 10 sekund.",
        "evaluation": "Jeśli ciśnienie na biegu jałowym jest prawidłowe (3.0 bar), ale przy dodaniu gazu spada do 2.0 bar — filtr pompy jest zapchany.",
        "repairSteps": "Demontaż zespołu pompy ze zbiornika, czyszczenie sitka, płukanie zbiornika, wymiana wkładu silniczka pompy lub regulatora FPR.",
        "verification": "Jazda próbna z manometrem pod pełnym obciążeniem — stabilne ciśnienie w całym zakresie obrotów.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      },
      {
        "id": "B7",
        "name": "Diagnostyka czujników dolotu: TPS, MAP, IAT, ECT i sonda lambda",
        "applicable": "Wszystkie pojazdy z układem wtrysku paliwa EFI",
        "symptom": "Szarpanie w wybranym punkcie otwarcia gazu (TPS), błąd EFI na liczniku, podwyższone spalanie, falowanie obrotów.",
        "causes": "Wytarcie ścieżki oporowej potencjometru TPS, zabrudzony nagarem czujnik ciśnienia MAP, przerwa w grzałce sondy lambda.",
        "tools": "Multimetr cyfrowy lub oscyloskop samochodowy, tester diagnostyczny z podglądem parametrów bieżących Live Data.",
        "when": "Każdy błąd FI lub szarpanie przy stałej prędkości obrotowej.",
        "steps": [
          "TPS: podłącz woltomierz między pin sygnałowy a masę czujnika; powoli obracaj manetką gazu od 0% do 100% WOT; napięcie musi rosnąć idealnie płynnie od ok. 0.6V do 4.5V.",
          "MAP: zmierz napięcie wyjściowe przy zgaszonym silniku (ciśnienie atmosferyczne, ok. 4.0 V) oraz na wolnych obrotach (podciśnienie obniża napięcie do ok. 1.5 V).",
          "Sonda lambda: zmierz rezystancję grzałki na pinach sondy (6–15 Ω); przy pracującym rozgrzanym silniku napięcie sygnału musi oscylować 0.1–0.9 V z częstotliwością min. 1 Hz."
        ],
        "measurementPoint": "Piny czujników TPS, MAP, IAT oraz kostka sondy lambda.",
        "referenceValue": "TPS: płynne napięcie 0.6V–4.5V bez dropów. Grzałka lambdy: 6–15 Ω w 20°C (wiarygodność B).",
        "evaluation": "Skoki napięcia TPS do 0V oznaczają wytartą ścieżkę rezystancyjną i wymagają natychmiastowej wymiany czujnika.",
        "repairSteps": "Regulacja kąta montażu TPS, czyszczenie czujnika MAP, wymiana sondy lambda.",
        "verification": "Płynna praca silnika w pełnym zakresie otwarcia przepustnicy bez kodów błędów w sterowniku.",
        "linkedTool": "Elektroniczne Laboratorium"
      }
    ]
  },
  {
    "id": "C",
    "code": "DZIAŁ C",
    "title": "UKŁADY ELEKTRYCZNE I ELEKTRONIKA",
    "color": "#38bdf8",
    "icon": "⚡",
    "summary": "Układ zapłonowy klasyczny CDI/TCI oraz cewki COP, alternatory i stojany 3-fazowe, regulatory napięcia SCR i MOSFET, akumulator i spadek napięcia przy rozruchu, rozruszniki i bendix, przekaźniki i bezpieczniki, wiązka i masy, magistrala CAN-BUS, czujniki położenia wału CKP i wałka CMP.",
    "procedures": [
      {
        "id": "C1",
        "name": "Ocena stanu świec zapłonowych, koloru nagaru i dobór ciepłoty",
        "applicable": "Wszystkie silniki spalinowe (2T i 4T)",
        "symptom": "Wypadanie zapłonów, trudny rozruch, dymienie, wysokie spalanie, przegrzewanie głowicy.",
        "causes": "Zła ciepłota świecy, zbyt duża przerwa elektrod, wypalenie elektrody irydowej, nagar sadzowy lub olejowy.",
        "tools": "Szczelinomierz płytkowy/druciany do świec, szczotka mosiężna, klucz do świec z wkładką magnetyczną.",
        "when": "Podczas każdego przeglądu okresowego lub diagnozy nierównej pracy.",
        "steps": [
          "Wykręć świece po ostygnięciu silnika i ułóż je w kolejności cylindrów.",
          "Oceń kolor izolatora: jasnobrązowy/kawa z mlekiem = mieszanka idealna; czarny suchy nagar = mieszanka za bogata lub świeca za zimna; biały/zeszkleny izolator = mieszanka skrajnie uboga lub świeca za ciepła.",
          "Zmierz przerwę między elektrodami szczelinomierzem; w świecach irydowych koryguj wyłącznie odginając elektrodę masową."
        ],
        "measurementPoint": "Izolator i elektroda środkowa świecy zapłonowej.",
        "referenceValue": "Przerwa elektrod: najczęściej 0.7–0.9 mm (wg DTR danego modelu; wiarygodność B).",
        "evaluation": "Mokra czarna świeca na jednym cylindrze wskazuje na brak iskry, zalanie wtryskiwaczem lub brak kompresji.",
        "repairSteps": "Czyszczenie świecy lub wymiana na nowy komplet o ściśle zalecanym symbolu i wartości cieplnej.",
        "verification": "Pewny rozruch silnika i równomierna praca na wszystkich cylindrach.",
        "linkedTool": "Automatyczny Plan Serwisowy"
      },
      {
        "id": "C2",
        "name": "Diagnostyka cewek podwójnych (Wasted Spark) oraz fajkocewek COP",
        "applicable": "Wszystkie silniki motocyklowe",
        "symptom": "Wypadanie zapłonów pod mocnym obciążeniem, praca na 2 lub 3 cylindrach, przebicia do masy w studniach świec.",
        "causes": "Pęknięcie izolacji korpusu cewki ołówkowej COP, przebicie gumowej fajki, przepalenie uzwojenia pierwotnego lub wtórnego cewki.",
        "tools": "Multimetr cyfrowy (zakres 200 Ω oraz 20 kΩ), próbnik iskry z regulowaną przerwą.",
        "when": "Wypadanie zapłonu na wybranym cylindrze lub parze cylindrów.",
        "steps": [
          "Zdemontuj cewkę, zdejmij gumową fajkę i obejrzyj korpus pod kątem białych śladów przebicia iskry.",
          "Zmierz rezystancję uzwojenia pierwotnego między pinami wtyczki niskiego napięcia (zwykle 0.8–1.5 Ω).",
          "Zmierz rezystancję uzwojenia wtórnego między stykiem świecy a pinem masowym (zwykle 8.0–15.0 kΩ).",
          "Test zamiany: zamień cewkę COP podejrzanego cylindra ze sprawnym — jeśli wypadanie zapłonu przeniesie się na drugi cylinder, cewka jest uszkodzona."
        ],
        "measurementPoint": "Piny złącza niskiego napięcia oraz styk sprężynowy wewnątrz fajki świecy.",
        "referenceValue": "Pierwotne: 0.8–2.5 Ω; Wtórne: 8.0–16.0 kΩ (wiarygodność B).",
        "evaluation": "Cewka może wykazywać poprawną rezystancję na zimno, a przebijać dopiero pod wysokim napięciem na gorącym silniku.",
        "repairSteps": "Wymiana uszkodzonej cewki zapłonowej COP na nową oraz wymiana świec zapłonowych.",
        "verification": "Test obciążeniowy pod pełnym otwarciem gazu bez jakichkolwiek szarpnięć.",
        "linkedTool": "Elektroniczne Laboratorium"
      },
      {
        "id": "C3",
        "name": "Pomiar czujnika położenia wału korbowego (CKP / Pickup) i wałka (CMP)",
        "applicable": "Wszystkie silniki motocyklowe, skutery i quady",
        "symptom": "Całkowity brak iskry na wszystkich cylindrach, obrotomierz nie drgnie przy kręceniu rozrusznikiem, błąd CKP w sterowniku.",
        "causes": "Przerwa w uzwojeniu impulsatora od wibracji/temperatury, opiłki metalowe na magnesie czujnika, zbyt duża szczelina powietrzna.",
        "tools": "Multimetr cyfrowy, szczelinomierz niemagnetyczny (mosiężny), oscyloskop samochodowy.",
        "when": "Brak iskry lub gaśnięcie silnika po nagrzaniu.",
        "steps": [
          "Zlokalizuj 2-pinową wtyczkę impulsatora wychodzącą z pokrywy alternatora.",
          "Zmierz rezystancję uzwojenia omomierzem w temperaturze 20°C.",
          "Podgrzej czujnik suszarką warsztatową obserwując omomierz — pęknięte uzwojenie traci ciągłość dopiero po nagrzaniu!",
          "Sprawdź szczelinomierzem szczelinę powietrzną między rdzeniem czujnika a występem koła magnesowego (0.5–1.0 mm).",
          "Podłącz woltomierz AC i zakręć rozrusznikiem: sprawny czujnik generuje min. 1.0–2.5 V AC."
        ],
        "measurementPoint": "Piny czujnika CKP (odłączona wtyczka z karteru).",
        "referenceValue": "Rezystancja: najczęściej 150–550 Ω (wg DTR modelu; wiarygodność B). Napięcie przy kręceniu: >1.0 V AC.",
        "evaluation": "Przerwa w obwodzie (nieskończoność na omomierzu) całkowicie odcina iskrę i wtrysk paliwa.",
        "repairSteps": "Oczyszczenie magnesu czujnika z opiłków lub wymiana czujnika impulsatora w stojanie alternatora.",
        "verification": "Wyraźny sygnał impulsowy AC na mierniku i pojawienie się iskry na świecach.",
        "linkedTool": "Elektroniczne Laboratorium"
      },
      {
        "id": "C4",
        "name": "Kompleksowa diagnostyka układu ładowania (stojan 3-fazowy i regulator napięcia)",
        "applicable": "Wszystkie motocykle, skutery i quady z alternatorem 3-fazowym",
        "symptom": "Rozładowany akumulator po jeździe, wygotowany akumulator (kwaśny zapach), migotanie świateł, błąd ładowania.",
        "causes": "Przepalenie jednego z uzwojeń stojana alternatora, przebicie diod w regulatorze stratnym SCR, stopiona kostka 3-pinowa.",
        "tools": "Multimetr cyfrowy z pomiarem napięcia AC i DC, cęgi prądowe DC.",
        "when": "Każdy przypadek problemów z akumulatorem lub co 10 000 km.",
        "steps": [
          "KROK 1: Pomiar napięcia na klemach akumulatora na wyłączonym silniku (min. 12.6 V), po uruchomieniu na biegu jałowym oraz przy 5000 obr/min (musi wynosić 14.0–14.8 V DC).",
          "KROK 2: Jeśli brak ładowania, odłącz 3-pinową żółtą kostkę stojana alternatora.",
          "KROK 3: Zmierz rezystancję między każdą parą faz (1-2, 2-3, 1-3): musi wynosić 0.2–1.0 Ω. Zmierz przejście do masy: musi być ABSOLUTNY BRAK przejścia (nieskończoność!).",
          "KROK 4: Uruchom silnik i zmierz napięcie zmienne AC między każdą parą faz przy 5000 obr/min: wszystkie 3 odczyty muszą być równe i wynosić ponad 55–70 V AC.",
          "KROK 5: Jeśli stojan jest sprawny, a na akumulatorze brak 14V — uszkodzony jest regulator napięcia."
        ],
        "measurementPoint": "Klemy akumulatora (DC) oraz 3 żółte piny złącza stojana alternatora (AC i rezystancja).",
        "referenceValue": "Ładowanie akumulatora: 14.0–14.8 V DC przy 5000 obr/min. Stojan AC: >60 V AC faza–faza. Rezystancja uzwojeń: 0.2–1.0 Ω; zwarcie do masy: brak (wiarygodność A).",
        "evaluation": "Napięcie powyżej 15.5 V oznacza uszkodzony regulator i natychmiast ugotuje akumulator oraz spali sterownik ECU!",
        "repairSteps": "Wymiana przepalonego stojana, montaż nowoczesnego regulatora MOSFET (np. Shindengen FH020AA) i polutowanie połączeń.",
        "verification": "Napięcie ładowania stabilne 14.4 V na pełnych światłach drogowych i wentylatorze chłodnicy.",
        "linkedTool": "Elektroniczne Laboratorium"
      },
      {
        "id": "C5",
        "name": "Kontrola rozrusznika, szczotek i sprzęgła jednokierunkowego (bendiksu)",
        "applicable": "Wszystkie pojazdy z rozrusznikiem elektrycznym",
        "symptom": "Rozrusznik kręci powoli mimo naładowanego akumulatora, metaliczny zgrzyt bez obracania wałem korbowym, stukanie przekaźnika.",
        "causes": "Zużycie szczotek węglowych rozrusznika, zabrudzenie rowków komutatora pyłem węglowym, zużycie rolek sprzęgła jednokierunkowego (sprag clutch).",
        "tools": "Multimetr cyfrowy, suwmiarka, zasilacz rozruchowy z amperomierzem (cęgi prądowe DC do 200A).",
        "when": "Trudności z obracaniem wału przez rozrusznik.",
        "steps": [
          "Zmierz spadek napięcia na klemach akumulatora w momencie rozruchu (nie może spaść poniżej 10.0 V).",
          "Zmierz spadek napięcia na przewodzie masowym silnika i przewodzie plusowym rozrusznika (maks. 0.2 V).",
          "Rozbierz rozrusznik: zmierz suwmiarką długość szczotek węglowych (limit zużycia zwykle 5–6 mm) i oczyść rowki komutatora nożykiem.",
          "W razie metalicznego ślizgania się rozrusznika: zdemontuj koło magnesowe i sprawdź rolki oraz bieżnię sprzęgła jednokierunkowego."
        ],
        "measurementPoint": "Zacisk prądowy rozrusznika oraz komutator i szczotkotrzymacz.",
        "referenceValue": "Pobór prądu rozrusznika motocykla: 40–80 A (ATV/V2: do 120 A). Długość szczotek min. 6 mm (wiarygodność B).",
        "evaluation": "Ślizgające się sprzęgiełko jednokierunkowe wydaje głośny, metaliczny trzask i wymaga natychmiastowej wymiany przed uszkodzeniem karteru.",
        "repairSteps": "Montaż nowego zestawu szczotek rozrusznika, toczenie/polerowanie komutatora, wymiana wieńca i sprzęgła sprag clutch.",
        "verification": "Błyskawiczny, lekki obrót wału korbowego po naciśnięciu przycisku Starter.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      },
      {
        "id": "C6",
        "name": "Diagnostyka magistrali cyfrowej CAN-BUS i kodów błędów sterownika",
        "applicable": "Nowoczesne motocykle i quady z instalacją CAN-BUS (BMW, KTM, Ducati, Yamaha, Honda, CF Moto)",
        "symptom": "Wariowanie zegarów, komunikaty braku łączności (CAN ERROR, błędy U0100, U0121, U0140), brak reakcji na przyciski.",
        "causes": "Przetarcie przewodów skrętki CAN-High / CAN-Low w okolicach główki ramy, brak rezystora terminującego 120 Ω, zawilgocenie złącza modułu ABS.",
        "tools": "Multimetr cyfrowy, oscyloskop 2-kanałowy, tester diagnostyczny OBD/CAN.",
        "when": "Błędy komunikacji sieciowej lub zanik wskazań licznika.",
        "steps": [
          "Wyłącz zapłon i odłącz akumulator.",
          "Wepnij omomierz między pin CAN-High i CAN-Low w gnieździe diagnostycznym OBD-2 (piny 6 i 14).",
          "Sprawdź rezystancję linii: sprawna sieć posiada dwa rezystory terminujące 120 Ω na końcach magistrali połączone równolegle, co daje dokładnie 60 Ω!",
          "Podłącz akumulator, włącz zapłon i zmierz napięcia stałe względem masy: CAN-High musi wynosić ok. 2.5–3.5 V, a CAN-Low ok. 1.5–2.5 V (suma obu napięć wynosi zawsze ok. 5.0 V).",
          "Na oscyloskopie: sprawdź symetrię ramek danych (lustrzane odbicie sygnałów różnicowych)."
        ],
        "measurementPoint": "Piny 6 (CAN-H) i 14 (CAN-L) gniazda OBD lub złącze modułu ABS.",
        "referenceValue": "Rezystancja terminująca wyłączona: 60.0 ± 3.0 Ω. Napięcie CAN-H: 2.7 V; CAN-L: 2.3 V (wiarygodność A).",
        "evaluation": "Odczyt 120 Ω oznacza przerwę na jednym końcu magistrali (odłączony licznik lub ECU). Odczyt 0 Ω to zwarcie między liniami.",
        "repairSteps": "Naprawa uszkodzonej skrętki CAN (z zachowaniem odpowiedniego skrętu przewodów 1 zwój na 2 cm!), osuszenie złączy i zabezpieczenie żelem dielektrycznym.",
        "verification": "Odczyt parametrów bez błędów transmisji i stabilne 60 Ω na złączu diagnostycznym.",
        "linkedTool": "Elektroniczne Laboratorium"
      }
    ]
  },
  {
    "id": "D",
    "code": "DZIAŁ D",
    "title": "UKŁADY HAMULCOWE I ABS",
    "color": "#ef4444",
    "icon": "🛑",
    "summary": "Pompy hamulcowe osiowe i promieniowe, zaciski pływające i radialne, klocki i minimalna grubość, tarcze i bicie osiowe czujnikiem zegarowym, przewody w oplocie stalowym, odpowietrzanie ciśnieniowe i podciśnieniowe, diagnostyka modułów ABS oraz czujników prędkości kół.",
    "procedures": [
      {
        "id": "D1",
        "name": "Kontrola i pomiar tarcz hamulcowych (minimalna grubość TH min i bicie osiowe)",
        "applicable": "Wszystkie układy hamulców tarczowych motocykli, skuterów i quadów",
        "symptom": "Pulsowanie klamki hamulca przy hamowaniu, drżenie kierownicy, spadek siły hamowania, piski.",
        "causes": "Zwichrowanie tarczy od przegrzania lub krzywego montażu, zużycie poniżej limitu bezpieczeństwa, zapieczone nity pływające.",
        "tools": "Mikrometr do pomiaru tarcz z końcówkami stożkowymi/kulkowymi, czujnik zegarowy ze statywem magnetycznym.",
        "when": "Przy każdej wymianie klocków oraz wibracjach podczas hamowania.",
        "steps": [
          "Odczytaj minimalną dopuszczalną grubość wytłoczoną na tarczy (np. MIN. TH. 4.0 mm lub 4.5 mm).",
          "Zmierz grubość tarczy mikrometrem w 8 punktach po obwodzie na wysokości śladu klocków hamulcowych.",
          "Zamontuj czujnik zegarowy na goleni widelca, przyłóż końcówkę pomiarową 5 mm od zewnętrznej krawędzi tarczy i powoli obracaj kołem.",
          "Zanotuj całkowite wychylenie wskazówki zegara (bicie osiowe tarczy)."
        ],
        "measurementPoint": "Powierzchnia robocza tarczy hamulcowej w 8 punktach obwodowych.",
        "referenceValue": "Bicie osiowe tarczy: maks. 0.10–0.15 mm (dla tarcz pływających maks. 0.10 mm; wiarygodność A). Grubość powyżej wartości MIN. TH.",
        "evaluation": "Tarcza poniżej grubości minimalnej grozi pęknięciem termicznym przy ostrym hamowaniu! Bicie powyżej 0.15 mm powoduje odpychanie klocków i pulsowanie klamki.",
        "repairSteps": "Wymiana tarczy na nową z nowymi śrubami mocującymi (zabezpieczonymi klejem do gwintów Loctite 243 i dokręconymi na krzyż kluczem dynamometrycznym).",
        "verification": "Pomiar bicia nowej tarczy po dokręceniu — wskazówka czujnika zegarowego nie może wychylać się o więcej niż 0.05 mm.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      },
      {
        "id": "D2",
        "name": "Diagnostyka klocków hamulcowych i zacisków (prowadnice, tłoczki, uszczelnienia)",
        "applicable": "Wszystkie motocyklowe zaciski hamulcowe (pływające i stałe)",
        "symptom": "Ściąganie motocykla, grzanie się tarczy po jeździe bez hamowania, miękka klamka, piski i nierówne zużycie klocków.",
        "causes": "Zatarte tłoczki w korpusie zacisku (brud i korozja za uszczelniaczem przeciwpyłowym), zapieczone prowadnice zacisku pływającego.",
        "tools": "Suwmiarka, szczypce do wyjmowania tłoczków hamulcowych, smar silikonowy do hamulców (Ate Bremszylinder-Paste).",
        "when": "Co sezon lub przy wymianie klocków hamulcowych.",
        "steps": [
          "Zmierz grubość okładziny ciernej klocków (bez metalowej blachy nośnej).",
          "Sprawdź równomierność zużycia klocka wewnętrznego i zewnętrznego: różnica > 1.5 mm wskazuje na zapieczone prowadnice zacisku.",
          "Wysuń tłoczki hamulcowe delikatnie klamką i oceń ich powierzchnię: gładź chromowana musi być idealna, bez wżerów i korozji.",
          "Oczyść tłoczki zmywaczem do hamulców i szczoteczką mosiężną/nylonową; nasmaruj gładź pastą do cylinderków i wciśnij tłoczki palcami."
        ],
        "measurementPoint": "Grubość okładziny klocka ciernego oraz powierzchnia boczna tłoczków.",
        "referenceValue": "Minimalna grubość okładziny klocka: 1.0 mm (zalecana wymiana przy 1.5 mm; wiarygodność B). Tłoczki muszą cofać się pod naciskiem kciuków.",
        "evaluation": "Zapieczony tłoczek powoduje stałe tarcie klocka o tarczę, gotowanie płynu hamulcowego i utratę hamulców po kilku kilometrach!",
        "repairSteps": "Wymiana klocków hamulcowych na nowe (spiekane sintermetalowe na przód), montaż nowego zestawu gumek uszczelniających zacisku.",
        "verification": "Koło musi obracać się swobodnie ręką po zwolnieniu klamki hamulca (lekkie ocieranie jest dopuszczalne, opór jest niedopuszczalny).",
        "linkedTool": "Automatyczny Plan Serwisowy"
      },
      {
        "id": "D3",
        "name": "Procedura odpowietrzania układu hamulcowego i wymiany płynu DOT 4 / DOT 5.1",
        "applicable": "Wszystkie hydrauliczne układy hamulcowe motocykli i quadów",
        "symptom": "Miękka, wpadająca klamka hamulca (\"gumowa klamka\"), brak wyczuwalnego twardego punktu oporu, spadek skuteczności po rozgrzaniu.",
        "causes": "Pęcherze powietrza w magistrali hamulcowej, zawodniony stary płyn hamulcowy (zawartość wody > 3% obniża temperaturę wrzenia z 260°C do 150°C!).",
        "tools": "Tester zawartości wody w płynie hamulcowym, pompka podciśnieniowa do odpowietrzania, przezroczysty wężyk z zaworkiem zwrotnym, świeży płyn DOT 4 / 5.1.",
        "when": "Obowiązkowo co 2 lata lub przy jakiejkolwiek ingerencji w układ hydrauliczny.",
        "steps": [
          "Zbadaj płyn w zbiorniczku testerem elektronicznym: obecność wody > 2% wymaga natychmiastowej wymiany.",
          "Zabezpiecz lakierowane elementy owiewek i zbiornika folią (płyn DOT rozpuszcza lakier w kilkadziesiąt sekund!).",
          "Odsącz stary płyn ze zbiorniczka, wlej świeży płyn z nowo otwartej butelki.",
          "Podłącz wężyk do odpowietrznika zacisku, pompuj klamką, przytrzymaj wciśniętą, odkręć odpowietrznik o 1/4 obrotu, zakręć i dopiero puść klamkę.",
          "Powtarzaj procedurę do momentu wypłynięcia idealnie czystego płynu bez mikropęcherzyków powietrza.",
          "W układach z pompą radialną odpowietrz najpierw odpowietrznik na samej pompie przy klamce!"
        ],
        "measurementPoint": "Zbiorniczek płynu oraz zaworki odpowietrzające na pompie i zaciskach.",
        "referenceValue": "Zawartość wody w płynie: < 1.0% (płyn bezpieczny; wiarygodność A). Punkt oporu na klamce twardy po przesunięciu o 15–20 mm.",
        "evaluation": "Obecność powietrza w układzie kompresuje się pod naciskiem klamki, drastycznie wydłużając drogę hamowania.",
        "repairSteps": "Pełne odpowietrzenie tradycyjne lub podciśnieniowe z opukaniem przewodów drewnianym trzonkiem w celu uwolnienia pęcherzyków.",
        "verification": "Test klamki: po zaciśnięciu klamki opaską zaciskową (trytytką) do manetki na całą noc, rano klamka musi być sztywna jak kamień.",
        "linkedTool": "Automatyczny Plan Serwisowy"
      },
      {
        "id": "D4",
        "name": "Odpowietrzanie i obsługa modulatora ABS oraz czujników prędkości kół (WSS)",
        "applicable": "Wszystkie pojazdy wyposażone w układ zapobiegający blokowaniu kół ABS",
        "symptom": "Świecąca kontrolka ABS na desce po przekroczeniu 10 km/h, miękka klamka po wymianie płynu, twarda klamka bez modulacji ciśnienia.",
        "causes": "Powietrze uwięzione w komorach elektrozaworów modulatora ABS, zanieczyszczona szczelina czujnika koła, zgięty wieniec impulsowy.",
        "tools": "Tester diagnostyczny z funkcją aktywacji pompy i zaworów ABS, szczelinomierz niemagnetyczny mosiężny, multimetr.",
        "when": "Wymiana płynu w układzie z ABS lub świecenie kontrolki usterki ABS.",
        "steps": [
          "Tradycyjne odpowietrzenie NIE usuwa płynu z zamkniętych komór elektrozaworów agregatu ABS.",
          "Podłącz tester diagnostyczny, wybierz procedurę odpowietrzania ABS (ABS Bleeding Routine) i wysteruj pompę ABS przy wciśniętej klamce.",
          "Sprawdź szczelinomierzem niemagnetycznym przerwę powietrzną między czołem czujnika Halla a wieńcem impulsowym na obu kołach.",
          "Obracaj kołem i zmierz bicie wieńca impulsowego (zgięty ząb wieńca natychmiast zgłasza błąd usterki czujnika koła!)."
        ],
        "measurementPoint": "Szczelina czujnik–wieniec ABS oraz złącze agregatu pompy ABS.",
        "referenceValue": "Szczelina powietrzna czujnika ABS: 0.4–1.2 mm (zwykle 0.6–0.8 mm; wiarygodność A). Brak bicia wieńca impulsowego.",
        "evaluation": "Przerwa w obwodzie czujnika lub szczelina > 1.5 mm wyłącza system ABS i przełącza hamulce w tryb czysto mechaniczny.",
        "repairSteps": "Aktywacja zaworów modulatora w testerze, wyczyszczenie czujników z opiłków magnetycznych, naprostowanie wieńca impulsowego.",
        "verification": "Zgaśnięcie kontrolki ABS po ruszeniu i przekroczeniu prędkości 5–10 km/h oraz prawidłowa pulsacja pedału/klamki przy ostrym hamowaniu na śliskiej nawierzchni.",
        "linkedTool": "Elektroniczne Laboratorium"
      },
      {
        "id": "D5",
        "name": "Weryfikacja przewodów hamulcowych i montaż przewodów w oplocie stalowym",
        "applicable": "Wszystkie motocykle, skutery i quady",
        "symptom": "Gumowa klamka, spadek siły hamowania po nagrzaniu, pęcznienie przewodów pod ciśnieniem.",
        "causes": "Starzenie się gumy przewodów elastycznych (okres eksploatacji gumy wg producentów to 4–5 lat!).",
        "tools": "Suwmiarka, klucz dynamometryczny do śrub Banjo M10 (zwykle 22–25 Nm), nowe podkładki miedziane/aluminiowe.",
        "when": "Co 4 lata lub przy modernizacji układu hamulcowego.",
        "steps": [
          "Zaciśnij mocno klamkę hamulca i zbadaj ręką pęcznienie gumowych węży.",
          "Zastąp stare gumowe przewody przewodami w oplocie ze stali nierdzewnej (teflon PTFE w oplocie stalowym).",
          "Używaj ZAWSZE nowych podkładek zgniatanych pod śruby Banjo i dokręcaj zalecanym momentem."
        ],
        "measurementPoint": "Średnica zewnętrzna przewodu pod ciśnieniem oraz śruby Banjo.",
        "referenceValue": "Zero rozszerzalności objętościowej przewodu w oplocie PTFE; moment śrub Banjo: 22–25 Nm (wiarygodność A).",
        "evaluation": "Oplot stalowy eliminuje zjawisko puchnięcia węża i zapewnia natychmiastową, twardą reakcję klamki.",
        "repairSteps": "Montaż przewodów w oplocie stalowym HEL / Fren Tubo / Goodridge.",
        "verification": "Twardy, precyzyjny punkt zadziałania hamulca na klamce.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      }
    ]
  },
  {
    "id": "E",
    "code": "DZIAŁ E",
    "title": "ZAWIESZENIE I UKŁAD KIEROWNICZY",
    "color": "#8b5cf6",
    "icon": "🏍️",
    "summary": "Widelce klasyczne i teleskopowe USD, wymiana uszczelniaczy olejowych i pyłowych, dobór lepkości oleju i poziomu poduszki powietrznej air gap, tylne amortyzatory centralne i stereo, regulacja SAG statyczny i dynamiczny, łożyska główki ramy i wahacza.",
    "procedures": [
      {
        "id": "E1",
        "name": "Diagnostyka i regulacja ugięcia wstępnego zawieszenia (SAG statyczny i dynamiczny)",
        "applicable": "Wszystkie motocykle sportowe, turystyczne, naked i quady",
        "symptom": "Niestabilność w zakrętach, dobijanie zawieszenia na nierównościach, brak przyczepności przedniego koła, uciekanie tyłu.",
        "causes": "Niewłaściwe napięcie wstępne sprężyn (Preload) niedopasowane do wagi kierowcy z ekwipunkiem.",
        "tools": "Taśma miernicza z dokładnością do 1 mm, klucz hakowy do nakrętek amortyzatora, pomocnik do asekuracji.",
        "when": "Po zakupie motocykla, zmianie wagi kierowcy, jeździe z pasażerem lub torowaniu.",
        "steps": [
          "POMIAR 1 (R1): Podnieś motocykl tak, aby koła wisiały w powietrzu (pełne rozprężenie zawieszenia); zmierz odległość od osi koła do stałego punktu ramy/zadupka.",
          "POMIAR 2 (R2 - Static Sag): Postaw motocykl pionowo na kołach pod własnym ciężarem; zmierz tę samą odległość (Static Sag = R1 - R2).",
          "POMIAR 3 (R3 - Rider Sag): Kierowca w pełnym rynsztunku siada w pozycji do jazdy, stopy na podnóżkach (pomocnik trzyma motocykl); zmierz odległość (Rider Sag = R1 - R3).",
          "Wyreguluj nakrętkami napięcia wstępnego sprężyny tak, aby uzyskać zadane wartości."
        ],
        "measurementPoint": "Odległość od osi koła przedniego/tylnego do wyznaczonego punktu na ramie/błotniku.",
        "referenceValue": "Przód Rider Sag: 30–40 mm (tor 25–30 mm). Tył Rider Sag: 30–40 mm (tor 25–30 mm). Static Sag tył: 5–15 mm (wiarygodność A).",
        "evaluation": "Jeśli przy prawidłowym Rider Sag brak jest Static Sag (0 mm) — sprężyna jest zbyt miękka i wymaga wymiany na sprężynę o twardszej stałej K (N/mm).",
        "repairSteps": "Regulacja napięcia wstępnego kluczem hakowym; wymiana sprężyn na progresywne lub liniowe dopasowane do wagi kierowcy.",
        "verification": "Pewne prowadzenie motocykla w pełnym złożeniu bez tendencji do wyjeżdżania na zewnętrzną zakrętu.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      },
      {
        "id": "E2",
        "name": "Wymiana uszczelniaczy olejowych i pyłowych w widelcu teleskopowym klasycznym i USD",
        "applicable": "Zawieszenia teleskopowe klasyczne oraz odwrócone Upside-Down (USD)",
        "symptom": "Pierścienie oleju na rurach nośnych widelca, wyciek oleju zalewający zaciski hamulcowe, utrata tłumienia (nurkowanie przodu).",
        "causes": "Zanieczyszczenie wargi uszczelniacza piaskiem/owadami, mikrorysy lub wżery korozyjne na chromie rury nośnej, stwardnienie gumy uszczelniacza.",
        "tools": "Przyrząd do wbijania uszczelniaczy (Driver do lag odpowiedniej średnicy np. 41, 43, 48 mm), ściągacz do rur, klucz do korków widelca, miska na olej.",
        "when": "Natychmiast po zauważeniu filmu olejowego na goleni widelca.",
        "steps": [
          "Zdemontuj lagi z półek motocykla, odkręć korek górny i zlej stary zużyty olej do naczynia z miarką.",
          "Zdejmij uszczelniacz pyłowy i wyjmij druciany pierścień zabezpieczający (seger) uszczelniacz olejowy.",
          "Wysuń gwałtownym ruchem rurę nośną z goleni (metoda slide-hammer), rozdzielając panewki ślizgowe teflonowe.",
          "Skontroluj stan panewek teflonowych (jeśli miedź przebija przez teflon — wymień panewki!).",
          "Przeszlifuj rurę nośną papierem wodnym gradacji 2000 z olejem, usuwając zadziory od uderzeń kamyków.",
          "Załóż woreczek foliowy na krawędź rury (aby krawędzie rowków nie ścięły nowej wargi uszczelniacza!) i nasuń nowy uszczelniacz.",
          "Wbij nowy uszczelniacz specjalnym dedykowanym pobijakiem do oporu i zabezpiecz pierścieniem seger."
        ],
        "measurementPoint": "Gładź rury nośnej widelca oraz gniazdo uszczelniacza w goleni zewnętrznej.",
        "referenceValue": "Absolutny brak wycieków po 50 ugięciach zawieszenia na postoju (wiarygodność A). Bicie rury nośnej ≤ 0.20 mm.",
        "evaluation": "Pozostawienie cieknącego widelca doprowadzi do zalania klocków hamulcowych olejem i utraty hamulców przednich!",
        "repairSteps": "Montaż uszczelniaczy olejowych i pyłowych renomowanych producentów (NOK, SKF, Ariete) z wargą z elastomeru NBR/FKM.",
        "verification": "Idealnie sucha goleń po jeździe próbnej i prawidłowe tłumienie nierówności.",
        "linkedTool": "Automatyczny Plan Serwisowy"
      },
      {
        "id": "E3",
        "name": "Pomiar i regulacja poziomu poduszki powietrznej (Air Gap) oraz dobór oleju SAE",
        "applicable": "Wszystkie widelce motocyklowe",
        "symptom": "Dobijanie widelca przy ostrym hamowaniu (poziom oleju za niski) lub twardy przód i brak pełnego skoku (oleju za dużo).",
        "causes": "Niewłaściwa ilość wlanego oleju, dobór błędnej lepkości oleju (np. 15W zamiast 5W).",
        "tools": "Strzykawka warsztatowa ze skalibrowaną rurką poziomą i ogranicznikiem głębokości, menzurka pomiarowa, olej do zawieszeń Fork Oil.",
        "when": "Przy każdym serwisie olejowym widelca teleskopowego.",
        "steps": [
          "Wlej świeży olej do rury widelca.",
          "Odpowietrz wkład tłumiący: powoli przesuwaj tłoczysko i rurę nośną góra-dół kilkanaście razy, aż znikną wszelkie odgłosy bulgotania powietrza.",
          "Ściśnij rurę nośną całkowicie na dół (bez zamontowanej sprężyny!).",
          "Ustaw suwak na rurce strzykawki na zadaną odległość poziomu poduszki powietrznej (np. 110 mm od górnej krawędzi rury).",
          "Wprowadź rurkę pionowo do wnętrza i odessij nadmiar oleju strzykawką, aż zassie powietrze."
        ],
        "measurementPoint": "Odległość od lustra oleju do górnej krawędzi całkowicie zsuniętej rury nośnej widelca bez sprężyny.",
        "referenceValue": "Wg DTR modelu: zazwyczaj 100–140 mm poziomu poduszki (Air Gap; wiarygodność B). Lepkość: najczęściej SAE 5W lub 10W.",
        "evaluation": "Zmiana poziomu poduszki powietrznej o ±10 mm pozwala dostroić twardość zawieszenia w końcowej fazie skoku bez zmiany twardości sprężyny.",
        "repairSteps": "Precyzyjna korekta poziomu oleju w obu lagach z dokładnością do 1 mm (obie lagi MUSZĄ mieć identyczny poziom poduszki!).",
        "verification": "Równe ugięcie obu goleni i wykorzystanie 90% skoku zawieszenia przy awaryjnym hamowaniu (kontrola opaską o-ring na ladze).",
        "linkedTool": "Elektroniczne Laboratorium"
      },
      {
        "id": "E4",
        "name": "Diagnostyka łożysk główki ramy (luzy, zacięcia w pozycji na wprost)",
        "applicable": "Wszystkie motocykle, motorowery i quady",
        "symptom": "Wężykowanie motocykla przy niskich prędkościach (tzw. polowanie na tor jazdy), stuki przy naciśnięciu przedniego hamulca.",
        "causes": "Wybicie dołków w bieżni łożyska główki ramy w pozycji centralnej (brinelling od uderzeń w dziury na wprost), luźna nakrętka wieńcowa.",
        "tools": "Podnośnik pod silnik/ramę, klucz hakowy z adapterem pod klucz dynamometryczny, waga sprężynowa do pomiaru oporu skrętu.",
        "when": "Co 10 000 km lub przy niestabilnym prowadzeniu motocykla.",
        "steps": [
          "Unieś przód motocykla tak, aby koło wisiało swobodnie w powietrzu.",
          "Chwyć za dolne końce goleni widelca i szarpnij przód-tył: wyczuwalny stuk oznacza luz na łożyskach główki ramy.",
          "Powoli obracaj kierownicą od lewego do prawego oporu koniuszkiem palca: wyczuwalne „wpadanie” lub przeskok w pozycji środkowej oznacza wybite bieżnie i kwalifikuje łożyska do natychmiastowej wymiany!",
          "Zmierz siłę potrzebną do obrócenia kierownicy wagą sprężynową zaczepioną o koniec manetki."
        ],
        "measurementPoint": "Bieżnie łożysk w główce ramy oraz opór skrętu kierownicy.",
        "referenceValue": "Zero luzu wzdłużnego; opór obrotu kierownicy: 200–500 g na wadze sprężynowej (wiarygodność A).",
        "evaluation": "Jazda z wybitym łożyskiem główki ramy uniemożliwia precyzyjne utrzymanie toru jazdy i jest skrajnie niebezpieczna przy wyższych prędkościach.",
        "repairSteps": "Wymiana kompletu łożysk (zalecana konwersja ze starych łożysk kulkowych na nowoczesne łożyska stożkowe) z dokręceniem momentem wstępnym 40 Nm i roboczym 15 Nm.",
        "verification": "Płynny ruch kierownicy z lekkim oporem hydraulicznym i całkowity brak stuków przy ostrym hamowaniu.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      },
      {
        "id": "E5",
        "name": "Regulacja tłumienia odbicia (Rebound) i dobicia (Compression)",
        "applicable": "Zawieszenia z pełną regulacją hydrauliczną (sport, adventure, quady)",
        "symptom": "Bujanie motocykla po przejechaniu nierówności, podskakiwanie koła na tarce, twarde uderzenia w nadgarstki.",
        "causes": "Niezrównoważone tłumienie hydrauliczne, zużyty/spieniony olej w amortyzatorze.",
        "tools": "Wkrętak płaski, klucz imbusowy, notatnik nastaw zawieszenia.",
        "when": "Dostrajanie zawieszenia pod styl jazdy i tor.",
        "steps": [
          "Wkręć śrubę regulacyjną delikatnie do lekkiego oporu (pozycja w pełni zamknięta = maksymalne tłumienie).",
          "Odkręcaj o zadaną liczbę kliknięć lub obrotów zgodnie z tabelą ustawień bazowych OEM.",
          "Test odbicia przodu: wciśnij mocno przód motocykla i puść; widelec powinien powrócić płynnie do góry, minąć punkt równowagi i natychmiast zatrzymać się bez drugiego wahnięcia.",
          "Ustaw identyczną liczbę kliknięć na obu goleniach widelca."
        ],
        "measurementPoint": "Śruby regulacyjne na szczycie korków widelca (Rebound) i na dole goleni (Compression).",
        "referenceValue": "Ustawienia fabryczne: np. 1.5 obrotu od oporu lub 12 kliknięć (wiarygodność B).",
        "evaluation": "Zbyt wolne odbicie (zamknięte) powoduje zjawisko „packingu” — zawieszenie nie zdąży się rozprężyć przed kolejną nierównością i twardnieje.",
        "repairSteps": "Dostrojenie klików tłumienia; w razie braku reakcji wymiana oleju na świeży.",
        "verification": "Pewne wybieranie nierówności bez utraty kontaktu koła z asfaltem.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      },
      {
        "id": "E6",
        "name": "Kontrola łożyskowania wahacza i kiwaczki tylnego amortyzatora",
        "applicable": "Wszystkie motocykle i quady z wahaczem wleczonym i kiwaczką Pro-Link / Unit Pro-Link",
        "symptom": "Pływanie tyłu w zakręcie, skrzypienie z okolic tylnego amortyzatora, luz poprzeczny koła.",
        "causes": "Wypłukanie smaru z łożysk igiełkowych kiwaczki i wahacza, korozja sworzni i tulei teflonowych.",
        "tools": "Podnośnik pod silnik, klucze nasadowe, smar litowo-wapniowy wodoodporny.",
        "when": "Co 15 000 km lub przy wymianie napędu.",
        "steps": [
          "Unieś tył motocykla tak, aby wahacz wisiał swobodnie.",
          "Chwyć koniec wahacza oburącz i szarpnij na boki: wyczuwalny luz poprzeczny oznacza zużyte łożyska osi wahacza.",
          "Podnieś lekko tylne koło od spodu: luz pionowy na pierwszych milimetrach skoku wskazuje na wybite tuleje i łożyska igiełkowe kiwaczki.",
          "Rozbierz kiwaczkę, wymyj elementy w nafcie, wymień zużyte tulejki i uszczelniacze wargowe."
        ],
        "measurementPoint": "Łożyska igiełkowe osi wahacza i sworznie układu dźwigniowego kiwaczki.",
        "referenceValue": "Zero luzu poprzecznego na końcu wahacza; płynny ruch dźwigni kiwaczki (wiarygodność A).",
        "evaluation": "Wybita kiwaczka niszczy mocowanie dolne amortyzatora i destabilizuje motocykl na hamowaniu.",
        "repairSteps": "Montaż zestawu naprawczego wahacza/kiwaczki (All Balls / Pivot Works) i obfite smarowanie smarem wodoodpornym.",
        "verification": "Brak jakichkolwiek luzów pionowych i poprzecznych wahacza.",
        "linkedTool": "Automatyczny Plan Serwisowy"
      }
    ]
  },
  {
    "id": "F",
    "code": "DZIAŁ F",
    "title": "UKŁADY NAPĘDOWE I PRZEKŁADNIE",
    "color": "#ec4899",
    "icon": "⛓️",
    "summary": "Sprzęgła mokre wielotarczowe i odśrodkowe, skrzynie biegów (wypadanie 2. biegu, kły i wodziki), napęd łańcuchowy (wyciągnięcie na 20 ogniw, zwis), napęd pasowy, przekładnie bezstopniowe CVT (wariatory, rolki, paski) oraz wały Kardana.",
    "procedures": [
      {
        "id": "F1",
        "name": "Pomiar sprzęgła wielotarczowego (grubość tarcz, przekładki, sprężyny, kosz)",
        "applicable": "Wszystkie sprzęgła mokre wielotarczowe motocykli 1–4 cyl",
        "symptom": "Ślizganie sprzęgła przy przyspieszaniu na wysokich biegach (obroty rosną, prędkość nie), ciągnięcie sprzęgła i trudne wrzucanie luzu na postoju.",
        "causes": "Zużycie okładzin tarcz ciernych, przegrzanie i zwichrowanie przekładek stalowych, zmęczenie sprężyn dociskowych, rowki na palcach kosza.",
        "tools": "Suwmiarka precyzyjna, płyta traserska/szyba ze szczelinomierzem, klucz dynamometryczny.",
        "when": "Ślizganie pod obciążeniem lub trudności ze zmianą biegów.",
        "steps": [
          "Przed demontażem sprawdź luz na lince sprzęgła (musi wynosić 10–15 mm na końcu klamki).",
          "Po wyjęciu pakietu zmierz suwmiarką grubość każdej tarczy ciernej.",
          "Połóż przekładki stalowe na idealnie płaskiej płycie i zmierz szczelinomierzem ich zwichrowanie.",
          "Zmierz wolną długość sprężyn dociskowych i porównaj z limitem minimalnym w DTR.",
          "Oceń palce zewnętrznego kosza sprzęgłowego pod kątem wybitych rowków (notching)."
        ],
        "measurementPoint": "Grubość okładzin tarcz ciernych, płaskość przekładek stalowych, długość sprężyn dociskowych.",
        "referenceValue": "Grubość tarcz: nominał 2.9–3.1 mm (limit zużycia 2.7 mm). Zwichrowanie przekładek: maks. 0.10 mm (wiarygodność B).",
        "evaluation": "Nowe tarcze cierne przed montażem MUSZĄ być moczone w czystym oleju silnikowym przez minimum 2–4 godziny!",
        "repairSteps": "Wymiana kompletu tarcz ciernych i sprężyn; w razie rowków na koszu delikatne wyrównanie pilnikiem iglakiem lub wymiana kosza.",
        "verification": "Płynne ruszanie i idealne wysprzęglanie bez ciągnięcia na wrzuconej jedynce.",
        "linkedTool": "Automatyczny Plan Serwisowy"
      },
      {
        "id": "F2",
        "name": "Diagnostyka skrzyni biegów (wypadanie 2. biegu, kły sprzęgłowe i wodziki)",
        "applicable": "Manualne skrzynie biegów motocykli (zwłaszcza sportowych 600/1000 cm³)",
        "symptom": "Gwałtowne szarpnięcie lub wyskakiwanie 2. biegu na luz przy mocnym przyspieszaniu powyżej 6000–8000 obr/min.",
        "causes": "Zaokrąglenie krawędzi kłów zabierakowych (dogs) kół zębatych 2. i 6. biegu, wygięcie wodzika wybieraka.",
        "tools": "Suwmiarka, czujnik zegarowy do bicia wałków, mikrometr.",
        "when": "Wyskakiwanie biegu pod obciążeniem.",
        "steps": [
          "Wykonaj jazdę próbną: ostre odkręcenie gazu na 2. biegu powoduje przeskok napędu (jakby łańcuch przeskoczył po zębach).",
          "Po rozpołowieniu karterów obejrzyj współpracujące kły kół zębatych 2. i 6. biegu: krawędzie muszą mieć ostry kąt ujemny (undercutting).",
          "Zmierz grubość widełek wodzika i sprawdź czy nie są skrzywione od siły odpychającej zaokrąglonych kłów.",
          "Sprawdź rowki wodzące bębna programatora zmiany biegów."
        ],
        "measurementPoint": "Kły zabierakowe kół zębatych oraz płaszczyzny ślizgowe wodzików skrzyni biegów.",
        "referenceValue": "Krawędzie kłów bez jakichkolwiek zaokrągleń; skrzywienie wodzika: maks. 0.05 mm (wiarygodność A).",
        "evaluation": "Nigdy nie wymieniaj samego wygiętego wodzika bez wymiany pary kół zębatych — zaokrąglone kły natychmiast ponownie zegną nowy wodzik!",
        "repairSteps": "Wymiana pary współpracujących kół zębatych skrzyni, nowego wodzika i wałka wodzików.",
        "verification": "Pewne trzymanie 2. biegu pod pełnym obciążeniem na hamowni lub w jeździe testowej.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      },
      {
        "id": "F3",
        "name": "Pomiar wyciągnięcia łańcucha napędowego na 20 ogniwach i regulacja zwisu",
        "applicable": "Wszystkie motocykle i quady z napędem łańcuchowym (rozmiary 428, 520, 525, 530)",
        "symptom": "Szarpanie przy jeździe ze stałą prędkością, klikanie z okolic napędu, nierównomierny naciąg przy obracaniu kołem.",
        "causes": "Zużycie sworzni i tulejek łańcucha, zatarte ogniwa O-ring/X-ring, zużyte zęby zębatek napędowych.",
        "tools": "Suwmiarka 300 mm, liniał warsztatowy, klucz dynamometryczny do osi koła (zwykle 80–110 Nm).",
        "when": "Co 1000 km smarowanie i kontrola zwisu; co 5000 km pomiar wyciągnięcia.",
        "steps": [
          "Obracaj tylnym kołem i znajdź punkt, w którym łańcuch jest NAJBARDZIEJ napięty (w tym punkcie ZAWSZE ustawia się naciąg!).",
          "Naciśnij łańcuch palcem i zmierz zwis pionowy w połowie odległości między zębatkami (zwykle 25–35 mm na stopce bocznej).",
          "Obciąż dolną gałąź łańcucha masą ok. 15 kg i zmierz suwmiarką odległość między osiami 21 sworzni (odcinek 20 ogniw).",
          "Sprawdź stan zębów zębatki zdawczej i tylnej pod kątem wygięcia profilu w tzw. zęby rekina."
        ],
        "measurementPoint": "Zwis w połowie wahacza oraz odcinek 20 ogniw łańcucha napędowego.",
        "referenceValue": "Limit długości 20 ogniw dla łańcucha 520/525/530: maks. 319.4–320.0 mm (nominał: 317.5 mm; wiarygodność B). Zwis: 25–35 mm.",
        "evaluation": "Zbyt mocno napięty łańcuch niszczy łożysko wałka zdawczego skrzyni biegów i blokuje pracę tylnego amortyzatora!",
        "repairSteps": "Regulacja naciągu śrubami na końcach wahacza z zachowaniem idealnej osiowości (wg nacięć na wahaczu); wymiana kompletu napędowego (łańcuch + obie zębatki).",
        "verification": "Płynna, cicha praca napędu bez szarpnięć przy zmianie obciążenia.",
        "linkedTool": "Automatyczny Plan Serwisowy"
      },
      {
        "id": "F4",
        "name": "Serwis i strojenie przekładni bezstopniowej CVT (wariator, rolki, pasek, sprzęgło)",
        "applicable": "Wszystkie skutery (50–650 cm³) oraz quady ATV/UTV z przekładnią pasową CVT",
        "symptom": "Spadek prędkości maksymalnej, wycie silnika bez przyspieszania, wibracje i szarpanie przy ruszaniu, zrywanie pasków.",
        "causes": "Wytarty pasek napędowy poniżej szerokości granicznej, spłaszczone rolki wariatora, wyślizgane talerze, zużyte sprężynki sprzęgła.",
        "tools": "Blokada wariatora / klucz pneumatyczny, suwmiarka precyzyjna, waga jubilerska z dokładnością do 0.1 g.",
        "when": "Zgodnie z interwałem serwisowym (co 5000–10 000 km) lub przy spadku osiągów.",
        "steps": [
          "Zdemontuj pokrywę napędu CVT i wyjmij pasek napędowy.",
          "Zmierz szerokość paska suwmiarką w najszerszym punkcie grzbietu i porównaj z limitem zużycia w DTR.",
          "Rozbierz wariator: sprawdź stan bieżni rolek pod kątem progów i zważeń.",
          "Zważ każdą rolkę na wadze jubilerskiej i sprawdź czy nie mają spłaszczeń (flats).",
          "Sprawdź grubość okładzin ciernych szczęk sprzęgła odśrodkowego (min. 1.5–2.0 mm) oraz stan sprężyny centralnej korektora momentu."
        ],
        "measurementPoint": "Szerokość paska CVT, masa i kształt rolek wariatora, grubość okładzin sprzęgła odśrodkowego.",
        "referenceValue": "Pasek: wg DTR (np. GY6 50cc limit 17.0 mm; Piaggio 300cc limit 20.0 mm; Quady limit 28.5–32.5 mm; wiarygodność A). Okładziny sprzęgła: min. 1.5 mm.",
        "evaluation": "Zużyty o 1.5 mm pasek nie wchodzi na szczyt talerzy wariatora, obniżając prędkość maksymalną nawet o 15–20 km/h!",
        "repairSteps": "Odtłuszczenie talerzy zmywaczem, montaż nowego paska wzmocnionego kevlarem, nowych rolek o dobranej masie i nowych ślizgów wariatora.",
        "verification": "Płynne ruszanie bez szarpnięć i stabilne obroty maksymalnej mocy podczas przyspieszania.",
        "linkedTool": "Tuning CVT (Kalkulator rolek i przełożeń)"
      },
      {
        "id": "F5",
        "name": "Diagnostyka wału Kardana, wielowypustów i przekładni kątowej (Final Drive)",
        "applicable": "Motocykle z napędem wałem Kardana (BMW R/K, Yamaha FJR/DragStar, Honda Shadow/VFR)",
        "symptom": "Stuki przy dodawaniu i ujmowaniu gazu, wycie przekładni kątowej zależne od prędkości, wyciek oleju na tylną felgę.",
        "causes": "Suchy, skorodowany wielowypust przesuwny wału, zużyte łożysko główne talerzowe przekładni, luz na przegubie krzyżakowym.",
        "tools": "Czujnik zegarowy ze statywem, klucze dynamometryczne, strzykawka do wymiany oleju przekładniowego, pasta litowo-molibdenowa MoS2.",
        "when": "Co 10 000–20 000 km serwis olejowy i smarowanie wielowypustu.",
        "steps": [
          "Postaw motocykl na stopce centralnej, chwyć tylne koło w pozycjach 12-6 oraz 9-3 i sprawdź luz łożyskowania przekładni kątowej.",
          "Odchyl przekładnię kątową na wahaczu i wysuń wielowypust wału Kardana.",
          "Oczyść wielowypust ze starego spieczonego smaru i zbadaj zużycie zębów.",
          "Sprawdź luzy kątowe i płynność pracy przegubów krzyżakowych Cardana.",
          "Zlej olej przekładniowy i oceń obecność opiłków na magnesie korka spustowego.",
          "Nanieś obficie wysokociśnieniowy smar molibdenowy MoS2 (np. Castrol Optimol TA) na wielowypust i złóż przekładnię.",
          "Nalej świeży syntetyczny olej przekładniowy SAE 75W-90 GL-5 w ściśle odmierzonej ilości (np. 180 ml dla BMW)."
        ],
        "measurementPoint": "Wielowypust wału napędowego, łożysko koła talerzowego, magnes korka spustowego.",
        "referenceValue": "Luz osiowy koła: niewyczuwalny na obwodzie felgi. Ilość oleju: ściśle wg specyfikacji (przelanie wypycha uszczelniacz; wiarygodność A).",
        "evaluation": "Brak smarowania wielowypustu prowadzi do korozji ciernej i ścięcia zębów wału w trasie!",
        "repairSteps": "Smarowanie pastą molibdenową, wymiana uszczelniacza promieniowego wałka, wymiana oleju przekładniowego GL-5.",
        "verification": "Cicha praca przekładni bez wycia i suchy uszczelniacz po dynamicznej jeździe.",
        "linkedTool": "Automatyczny Plan Serwisowy"
      },
      {
        "id": "F6",
        "name": "Diagnostyka napędu pasem zębatym (Harley-Davidson, BMW F800, Can-Am Spyder)",
        "applicable": "Motocykle z wtórnym napędem pasem zębatym",
        "symptom": "Piszczenie pasa przy ruszaniu, ząbkowanie, pęknięcia kordu, ściąganie pasa na krawędź koła pasowego.",
        "causes": "Niewłaściwy naciąg pasa (zbyt luźny przeskakuje, zbyt ciasny niszczy łożysko zdawcze), nieosiowość kół pasowych, kamień wbity w ząb.",
        "tools": "Miernik ugięcia i naciągu pasa (tensometr zegarowy lub akustyczny miernik częstotliwości drgań pasa Hz).",
        "when": "Co 8000 km lub przy wymianie opony tylnej.",
        "steps": [
          "Zbadaj pas na całej długości: brak ubytków zębów, pęknięć nasady zębów oraz wystających włókien węglowych/aramidowych.",
          "Sprawdź naciąg tensometrem: przyłóż obciążenie 4.5 kg (10 lbs) w połowie rozpiętości pasa i zmierz ugięcie liniałem.",
          "Sprawdź osiowość koła pasowego: pas powinien pracować centralnie lub delikatnie opierać się o zewnętrzny kołnierz koła pasowego bez zniekształceń."
        ],
        "measurementPoint": "Dolna gałąź pasa zębatego w połowie odległości między kołami pasowymi.",
        "referenceValue": "Ugięcie pod obciążeniem 4.5 kg: zazwyczaj 8–12 mm (lub częstotliwość akustyczna 60–90 Hz; wiarygodność B).",
        "evaluation": "Zbyt ciasny pas potrafi ukręcić wałek zdawczy skrzyni biegów lub zniszczyć karkas łożyska!",
        "repairSteps": "Regulacja naciągu śrubami wahacza; w razie pęknięć kordu natychmiastowa wymiana pasa napędowego.",
        "verification": "Cichy bieg pasa bez pisków i wibracji przy pełnym przyspieszeniu.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      }
    ]
  },
  {
    "id": "G",
    "code": "DZIAŁ G",
    "title": "UKŁAD WYDECHOWY I EMISJA SPALIN",
    "color": "#eab308",
    "icon": "💨",
    "summary": "Nieszczelności kolektorów i uszczelek głowicy, serwomotory zaworów wydechowych EXUP / Suzuki SET / Yamaha YPVS, sondy lambda wąsko- i szerokopasmowe, katalizatory, dopalanie spalin PAIR/AIS oraz pomiary analizatorem.",
    "procedures": [
      {
        "id": "G1",
        "name": "Diagnostyka nieszczelności kolektora wydechowego i uszczelek głowicy",
        "applicable": "Wszystkie silniki 1–4 cyl",
        "symptom": "Głośne strzały i prychanie w wydech przy zamykaniu gazu i hamowaniu silnikiem, cykliczne cykanie pod zbiornikiem na zimno.",
        "causes": "Przepalone uszczelki miedziane/aluminiowe pod kolektorem wydechowym, poluzowane szpilki wydechowe, pęknięcie spawu kolektora.",
        "tools": "Rękawica skórzana, lusterko inspekcyjne, klucz dynamometryczny.",
        "when": "Zawsze po wymianie układu wydechowego lub przy głośnych strzałach z wydechu.",
        "steps": [
          "Zimny silnik: przytknij rękawicę do końcówki tłumika na biegu jałowym — w sprawnym układzie powinno narastać wyraźne ciśnienie bez sykliwych dźwięków z okolic silnika.",
          "Obejrzyj okolice okien wydechowych głowicy: obecność czarnych śladów sadzy jednoznacznie wskazuje na przedmuch.",
          "Sprawdź dokręcenie nakrętek szpilek kolektora (uwaga: szpilki wydechowe M6/M8 łatwo ukręcić — dokręcaj momentem 10–14 Nm!)."
        ],
        "measurementPoint": "Łączenie rur kolektora wydechowego z głowicą silnika.",
        "referenceValue": "Zero przedmuchów i sadzy; szczelność ciśnieniowa potwierdzona dławieniem wydechu (wiarygodność A).",
        "evaluation": "Zasysanie chłodnego powietrza przez nieszczelny kolektor wydechowy grozi szokiem termicznym i pęknięciem grzybków zaworów wydechowych!",
        "repairSteps": "Wymiana jednorazowych uszczelek zgniatanych (miedzianych lub z oplotem azbestowo-stalowym), splanowanie flanszy kolektora.",
        "verification": "Cicha praca jednostki i całkowity zanik strzałów przy ostrym hamowaniu silnikiem.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      },
      {
        "id": "G2",
        "name": "Kontrola i kalibracja zaworu wydechowego EXUP / Suzuki SET (serwo i linki)",
        "applicable": "Motocykle z regulowanym zaworem wydechowym (Yamaha EXUP, Suzuki SET, Honda, Kawasaki)",
        "symptom": "Błąd FI na zegarach, brak ciągu w dolnym i średnim zakresie obrotów, głośne terkotanie zębatki serwa pod siedzeniem.",
        "causes": "Zapieczony zawór obrotowy w kolektorze od nagaru, wyciągnięte linki sterujące, wyłamane plastikowe trybiki serwomotoru.",
        "tools": "Klucze płaskie do regulacji linek, pasta ceramiczna wysokotemperaturowa (do 1400°C), multimetr cyfrowy.",
        "when": "Błąd zaworu wydechowego lub brak dynamiki przy niskich obrotach.",
        "steps": [
          "Włącz zapłon: serwomotor powinien wykonać pełen cykl autotestu (ruch skrajny w lewo, w prawo i powrót do pozycji wyjściowej).",
          "Zdejmij osłonę bębenka zaworu na kolektorze: sprawdź czy znak na bębenku pokrywa się z otworem inspekcyjnym w korpusie.",
          "Odłącz linki i obróć zawór ręką: musi obracać się idealnie lekko pod naciskiem palców bez żadnych zacięć.",
          "Wyreguluj naciąg obu linek: linki muszą mieć minimalny luz roboczy 0.5–1.0 mm, aby nie przeciążać silniczka serwa."
        ],
        "measurementPoint": "Bębenek sterujący zaworu EXUP/SET oraz potencjometr zwrotny w serwomotorze.",
        "referenceValue": "Luz linek: 0.5–1.0 mm; rezystancja potencjometru serwa płynna w zakresie 1.0–4.5 kΩ (wiarygodność B).",
        "evaluation": "Zapieczony zawór blokuje serwomotor, co prowadzi do spalenia silniczka lub wyłamania zębatek przekładni.",
        "repairSteps": "Demontaż zaworu, oczyszczenie z nagaru szczotką drucianą, przesmarowanie łożyskowania pastą ceramiczną, regulacja linek.",
        "verification": "Prawidłowy autotest po włączeniu zapłonu bez zgłoszenia błędu FI na desce rozdzielczej.",
        "linkedTool": "Elektroniczne Laboratorium"
      },
      {
        "id": "G3",
        "name": "Test sondy lambda cyrkonowej i szerokopasmowej (amplituda i czas reakcji)",
        "applicable": "Wszystkie pojazdy z katalizatorem i wtryskiem EFI spełniające normy Euro 3 / 4 / 5",
        "symptom": "Zwiększone zużycie paliwa o 20–30%, ospała reakcja na gaz, czarny nalot na końcówce wydechu, błąd obwodu O2 sensor.",
        "causes": "Zatrucie sondy ołowiem/silikonem, nagar z oleju silnikowego, przepalenie grzałki sondy lambda.",
        "tools": "Multimetr cyfrowy z szybkim bargrafem lub oscyloskop, tester diagnostyczny.",
        "when": "Wysokie spalanie lub błąd sondy lambda w sterowniku.",
        "steps": [
          "Zmierz rezystancję obwodu grzałki sondy na zimno (zwykle dwa przewody tego samego koloru, np. białe): powinna wynosić 6–15 Ω.",
          "Sprawdź zasilanie 12V podawane na grzałkę po włączeniu zapłonu.",
          "Podłącz woltomierz/oscyloskop pod przewód sygnałowy na pracującym rozgrzanym silniku na obrotach 2500 obr/min.",
          "Obserwuj oscylacje napięcia: sprawna sonda cyrkonowa musi szybko przełączać się między 0.1 V (mieszanka uboga) a 0.9 V (mieszanka bogata)."
        ],
        "measurementPoint": "Przewód sygnałowy sondy lambda względem masy silnika.",
        "referenceValue": "Amplituda sygnału: 0.1–0.9 V DC. Czas przełączania: poniżej 300 ms (częstotliwość min. 1–2 oscylacje na sekundę; wiarygodność A).",
        "evaluation": "Sonda „leniwa” (przełączająca się wolniej niż co sekundę) lub zawieszona na stałym napięciu 0.45V powoduje rozjechanie map wtrysku.",
        "repairSteps": "Wymiana sondy lambda na nową dedykowaną z gwintem pokrytym smarem przewodzącym wysokotemperaturowym.",
        "verification": "Prawidłowe oscylacje sygnału w pętli zamkniętej (Closed Loop) i optymalny współczynnik lambda λ = 1.00.",
        "linkedTool": "Elektroniczne Laboratorium"
      }
    ]
  },
  {
    "id": "H",
    "code": "DZIAŁ H",
    "title": "QUADY I POJAZDY UŻYTKOWE (ATV/UTV)",
    "color": "#14b8a6",
    "icon": "🚜",
    "summary": "Specyfika napędu 4x4, serwomotory załączania przedniej osi 2WD/4WD, blokady dyferencjałów Diff-Lock, paski CVT Heavy Duty do ciężkich warunków błotnych, wyciągarki i instalacje wysokoprądowe, smarowniczki kalamitki wahaczy oraz przeguby półosi.",
    "procedures": [
      {
        "id": "H1",
        "name": "Diagnostyka układu dołączania przedniego napędu 4x4 i serwomotoru",
        "applicable": "Wszystkie quady ATV i pojazdy UTV z dołączanym napędem 4WD (Polaris, Can-Am, CF Moto, Yamaha Grizzly)",
        "symptom": "Brak dołączania przedniego napędu mimo wciśniętego przycisku 4WD, stuki w przednim dyfrze, migająca kontrolka napędu.",
        "causes": "Zalanie wodą siłownika elektrycznego (serwomotoru) na dyferencjale, pęknięcie koszyka rolkowego przedniego napędu (Polaris Hilliard), brak zasilania 12V.",
        "tools": "Multimetr cyfrowy, zasilacz warsztatowy 12V, klucze nasadowe.",
        "when": "Przed sezonem przeprawowym lub przy braku trakcji przedniej osi.",
        "steps": [
          "Sprawdź zasilanie na kostce serwomotoru przedniego dyfra przy przełączaniu przycisku 2WD -> 4WD.",
          "Zdemontuj silniczek serwa i podaj 12V bezpośrednio na piny: sprawdź czy silniczek wysuwa trzpień załączający widełki.",
          "W quadach Polaris (sprzęgło wiskotyczne/elektromagnetyczne Hilliard): zmierz rezystancję cewki załączającej w przednim dyfrze (powinna wynosić 22–28 Ω).",
          "Sprawdź stan koszyka rolkowego wewnątrz dyfra (plastikowy koszyk potrafi pęknąć przy uderzeniu pod obciążeniem)."
        ],
        "measurementPoint": "Wtyczka zasilania serwomotoru przedniego dyfra oraz cewka załączająca.",
        "referenceValue": "Napięcie załączania: 12.0–14.0 V. Rezystancja cewki Polaris: 22–28 Ω (CF Moto serwo: 10–18 Ω; wiarygodność B).",
        "evaluation": "Jazda z pękniętym koszykiem rolkowym doprowadzi do zmielenia kół zębatych przekładni głównej przedniej osi.",
        "repairSteps": "Wymiana uszczelnień i regeneracja serwomotora; montaż wzmocnionego aluminiowego koszyka rolkowego w przednim dyfrze.",
        "verification": "Podniesienie quada na podnośniku — natychmiastowe obracanie wszystkich 4 kół po załączeniu trybu 4WD.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      },
      {
        "id": "H2",
        "name": "Kontrola blokady dyferencjału przedniego i tylnego (Diff-Lock)",
        "applicable": "Quady przeprawowe z pełną blokadą dyferencjału (Diff-Lock 100%)",
        "symptom": "Quad nie chce skręcać na twardym (blokada zacięta na stałe) lub jedno przednie koło buksuje w błocie mimo włączonego Diff-Lock.",
        "causes": "Zapieczony suwak blokady mechanicznej, pęknięte sprężyny powrotne, brak styku na czujniku potwierdzenia blokady.",
        "tools": "Multimetr, szczypce do pierścieni segera, świeży olej przekładniowy do dyfrów.",
        "when": "Brak pełnego spięcia osi w ciężkim terenie.",
        "steps": [
          "Załącz tryb Diff-Lock: kontrolka na liczniku musi przestać migać i świecić światłem ciągłym (potwierdzenie fizycznego zazębienia suwaka).",
          "Podnieś przód pojazdu: przy obracaniu jednym przednim kołem drugie koło MUSI obracać się w tym samym kierunku z identyczną prędkością bez żadnego poślizgu.",
          "Sprawdź stan oleju w dyfrze: obecność szarej emulsji wodnej świadczy o nieszczelności uszczelniaczy półosi lub sparciałym odpowietrzniku dyfra."
        ],
        "measurementPoint": "Czujnik potwierdzenia pozycji blokady oraz koła przedniej osi.",
        "referenceValue": "100% sztywne spięcie obu półosi bez możliwości obrócenia jednego koła względem drugiego (wiarygodność A).",
        "evaluation": "Nigdy nie załączaj Diff-Lock w czasie poślizgu kół pod gazem — gwałtowne uderzenie ścina kły blokady!",
        "repairSteps": "Wymiana uszczelniaczy półosi dyferencjału, czyszczenie mechanizmu blokady, wymiana oleju na SAE 80W-90 GL-5.",
        "verification": "Pewne załączanie i rozłączanie blokady po ruszeniu kierownicą lewo-prawo.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      },
      {
        "id": "H3",
        "name": "Diagnostyka paska napędowego CVT w quadzie i szczelności obudowy",
        "applicable": "Wszystkie quady i UTV z przekładnią pasową CVT",
        "symptom": "Zapach spalonej gumy z wylotu obudowy CVT, szarpanie przy ruszaniu, po wjeździe do głębszej wody quad traci napęd (obroty rosną, koła stoją).",
        "causes": "Spalenie paska na biegu High (H) w błocie zamiast na reduktorze Low (L), zalanie obudowy CVT przez nieszczelny snorkiel lub korek spustowy.",
        "tools": "Suwmiarka precyzyjna, klucze nasadowe, przyrząd do rozszerzania talerzy sprzęgła wtórnego.",
        "when": "Po każdym utopieniu quada w wodzie lub po ostrym upalaniu w błocie.",
        "steps": [
          "Odkręć korek drenażowy na spodzie pokrywy CVT: wypłynięcie wody oznacza zalanie przekładni i konieczność natychmiastowego serwisu.",
          "Zdejmij pokrywę CVT: zmierz szerokość paska suwmiarką na zewnętrznym grzbiecie.",
          "Zegnij pasek zębami na zewnątrz i sprawdź pod kątem pęknięć nasady zębów, wyrwanych kordów kevlarowych i zwęgleń bocznych ścianek ciernych.",
          "Odtłuszczenie talerzy: zmyj zwęgloną gumę z talerzy wariatora i sprzęgła włókniną ścierną ze zmywaczem."
        ],
        "measurementPoint": "Grzbiet paska napędowego oraz powierzchnia stożkowa talerzy aluminiowych.",
        "referenceValue": "Szerokość paska powyżej limitu zużycia (np. Can-Am: min. 30.5 mm; CF Moto: min. 32.5 mm; wiarygodność A).",
        "evaluation": "Jazda w ciężkim terenie na biegu H pali pasek w 10 minut — do ciężkich warunków ZAWSZE używaj biegu L (Low)!",
        "repairSteps": "Montaż wzmocnionego paska Heavy Duty (np. Gates G-Force RedLine / Ultimax), uszczelnienie uszczelki pokrywy CVT silikonem technicznym.",
        "verification": "Wyprowadzenie odpowietrzenia obudowy CVT snorklami i test szczelności zanurzeniowej.",
        "linkedTool": "Tuning CVT"
      },
      {
        "id": "H4",
        "name": "Przegląd zawieszenia niezależnego, smarowanie kalamitek i półosi",
        "applicable": "Wszystkie quady ATV i pojazdy UTV z niezależnym zawieszeniem IRS",
        "symptom": "Skrzypienie zawieszenia na wybojach, luzy na kołach, stuki przy dodawaniu gazu w skręcie.",
        "causes": "Wypłukanie smaru z tulei wahaczy przez wodę i myjkę ciśnieniową, pęknięte gumowe osłony przegubów półosi.",
        "tools": "Smarownica ciśnieniowa (tawotnica) ze smarem litowo-wapniowym wodoodpornym, podnośnik.",
        "when": "Obowiązkowo po każdej jeździe w błocie/wodzie lub co 500 km.",
        "steps": [
          "Unieś pojazd, zlokalizuj wszystkie punkty smarne (kalamitki / smarowniczki) na wahaczach przednich, tylnych i zwrotnicach (zwykle 8–16 punktów!).",
          "Oczyść kalamitkę z piasku, załóż końcówkę smarownicy i pompuj świeży smar do momentu, aż wypchnie stary, brudny smar z tulei wahacza.",
          "Dokładnie obejrzyj gumowe osłony (mańskie) przegubów homokinetycznych półosi: nawet najmniejsza dziurka po gałęzi doprowadzi do zatarcia przegubu piaskiem w 20 km!",
          "Sprawdź luzy na łożyskach kół i sworzniach wahaczy szarpiąc kołem w pionie i poziomie."
        ],
        "measurementPoint": "Tuleje wahaczy, sworznie zwrotnic, osłony gumowe przegubów półosi napędowych.",
        "referenceValue": "Zero luzu na sworzniach zwrotnic i łożyskach kół; świeży smar we wszystkich węzłach (wiarygodność A).",
        "evaluation": "Brak regularnego smarowania kalamitek niszczy tuleje wahaczy i ramy w jeden sezon przeprawowy.",
        "repairSteps": "Tłoczenie wodoodpornego smaru morskiego (Marine Grease); wymiana pękniętych osłon przegubów na elastyczne osłony neoprenowe.",
        "verification": "Cicha, aksamitna praca zawieszenia bez żadnych pisków i luzów.",
        "linkedTool": "Automatyczny Plan Serwisowy"
      },
      {
        "id": "H5",
        "name": "Kontrola instalacji wysokoprądowej wyciągarki (solenoid i hebel)",
        "applicable": "Wszystkie pojazdy wyposażone w wyciągarkę elektryczną 12V",
        "symptom": "Wyciągarka nie reaguje na przycisk, słychać tylko ciche cykanie przekaźnika, samoczynne zwijanie liny (sklejone styki!).",
        "causes": "Sklejenie styków przekaźnika wysokoprądowego (contactor/solenoid) po przeciążeniu prądem > 250A, zaśniedziałe kable masowe, rozładowany akumulator.",
        "tools": "Multimetr cyfrowy, cęgi prądowe DC dużej mocy (do 400A), klucze nasadowe.",
        "when": "Przed każdym wyjazdem w teren i po każdym użyciu wyciągarki.",
        "steps": [
          "Sprawdź obecność i sprawność głównego wyłącznika prądu (hebla bezpieczeństwa) na zasilaniu wyciągarki — MUSI odcinać zasilanie w razie zablokowania przekaźnika!",
          "Zmierz napięcie na akumulatorze podczas pracy wyciągarki pod obciążeniem (silnik quada musi pracować na podwyższonych obrotach!).",
          "Sprawdź stan styków prądowych solenoidu pod kątem przegrzania i stopienia obudowy.",
          "Oceń stan liny syntetycznej/stalowej pod kątem przetarć i zagnieceń."
        ],
        "measurementPoint": "Zaciski prądowe solenoidu wyciągarki oraz zaciski silnika wyciągarki.",
        "referenceValue": "Spadek napięcia na zaciskach silnika pod pełnym uciągiem: min. 10.5 V (wiarygodność B). Pobór prądu: 150–280 A.",
        "evaluation": "Sklejenie styków solenoidu bez hebla bezpieczeństwa grozi natychmiastowym spaleniem quada lub urwaniem ramy!",
        "repairSteps": "Wymiana solenoidu na hermetyczny w klasie IP67/IP68, montaż wyłącznika heblowego 300A, oczyszczenie klem akumulatora.",
        "verification": "Pewne rozwijanie i zwijanie liny z pilota bez grzania się przewodów zasilających.",
        "linkedTool": "Karta Zlecenia Serwisowego"
      },
      {
        "id": "H6",
        "name": "Weryfikacja elektrycznego wspomagania kierownicy (EPS) w quadach",
        "applicable": "Quady i UTV z układem EPS (Electronic Power Steering)",
        "symptom": "Ciężka praca kierownicy, wyrywanie kierownicy na kamieniach, migająca kontrolka EPS.",
        "causes": "Zalanie sterownika lub silnika EPS wodą, brak zasilania z bezpiecznika głównego EPS (40A), rozkalibrowanie czujnika momentu skrętu.",
        "tools": "Multimetr, tester diagnostyczny, klucze nasadowe.",
        "when": "Brak wspomagania lub błąd EPS.",
        "steps": [
          "Sprawdź bezpiecznik główny EPS (40A) oraz przekaźnik zasilania wspomagania.",
          "Zmierz napięcie ładowania na akumulatorze (sterownik EPS automatycznie odcina wspomaganie, jeśli napięcie spadnie poniżej 11.8 V lub wzrośnie powyżej 16 V!).",
          "Sprawdź czy kolumna kierownicza nie ma mechanicznych zacięć po uderzeniu w drzewo/kamień."
        ],
        "measurementPoint": "Złącze prądowe modułu EPS i bezpiecznik główny 40A.",
        "referenceValue": "Napięcie zasilania: 12.8–14.5 V (wiarygodność A). Zero oporu mechanicznego kolumny.",
        "evaluation": "Spadek ładowania jest najczęstszą przyczyną wyłączania się wspomagania EPS w terenie!",
        "repairSteps": "Naprawa instalacji ładowania, osuszenie i zabezpieczenie złączy EPS smarem dielektrycznym.",
        "verification": "Lekka praca kierownicy na postoju jednym palcem i brak kontrolki EPS.",
        "linkedTool": "Elektroniczne Laboratorium"
      }
    ]
  }
];

  // ============================================================================
  // 5. INTELIGENTNE DRZEWA DIAGNOSTYCZNE (12 OBJAWÓW × 8 OBOWIĄZKOWYCH PUNKTÓW)
  // ============================================================================
  function buildDiagnosticTrees(ctx) {
    const m = (ctx && ctx.model) || { brand: 'Motocykl', model: '3–4 Cyl.', cylinders: 4, layout: 'R4', fuelSystem: 'efi', cooling: 'liquid', engineCode: 'R4' };
    const e = (ctx && ctx.engine) || {};
    const cylCount = m.cylinders || e.cylinders || 4;
    const isCarb = (m.fuelSystem || e.fuelSystem) === 'carb';
    const isLiquid = (m.cooling || e.cooling) === 'liquid';
    const cylLabel = cylCount === 3 ? '3 cylindrów (Cyl 1, 2, 3)' : '4 cylindrów (Cyl 1, 2, 3, 4)';
    const pairHint = cylCount === 4
      ? 'W układach z 2 cewkami podwójnymi (Wasted Spark) Cewka 1 obsługuje Cyl 1+4, a Cewka 2 obsługuje Cyl 2+3.'
      : 'W silniku 3-cylindrowym każdy cylinder posiada indywidualny kanał zapłonowy / fajkocewkę COP.';

    const compSpec = getParamText(ctx, 'compressionPressure', '10.5–14.0 bar (różnica między cylindrami Δ ≤ 1.5 bar)');
    const valveInSpec = getParamText(ctx, 'valveClearanceIntake', '0.13–0.23 mm (potwierdź w DTR silnika)');
    const valveExSpec = getParamText(ctx, 'valveClearanceExhaust', '0.20–0.30 mm (potwierdź w DTR silnika)');
    const sparkPlugSpec = getParamText(ctx, 'sparkPlugType', 'Zgodnie z katalogiem NGK/Denso dla kodu silnika');
    const sparkGapSpec = getParamText(ctx, 'sparkPlugGap', '0.7–0.9 mm');
    const coilPrimSpec = getParamText(ctx, 'ignitionCoilPrimary', '0.8–4.5 Ω (zależnie od COP vs cewka podwójna)');
    const ckpSpec = getParamText(ctx, 'pickupCoilResistance', '100–550 Ω w 20°C');
    const syncSpec = getParamText(ctx, 'carbSyncVacuum', 'Różnica podciśnień między cylindrami Δ ≤ 15 mmHg (2 kPa)');
    const fuelPressSpec = getParamText(ctx, 'fuelPressure', isCarb ? 'Poziom pływaka zgodny z DTR' : '2.9–3.5 bar (290–350 kPa)');
    const injResSpec = getParamText(ctx, 'injectorResistance', '11.5–14.5 Ω w 20°C');
    const chargeSpec = getParamText(ctx, 'chargingVoltage', '14.0–14.8 V przy 5000 obr./min');
    const statorSpec = getParamText(ctx, 'statorResistance', '0.2–0.9 Ω między fazami, OL do masy');
    const thermoSpec = getParamText(ctx, 'thermostatOpenTemp', '80–84°C (pełne otwarcie >8 mm przy 95°C)');
    const fanSpec = getParamText(ctx, 'fanOnTemp', '100–105°C');
    const idleSpec = getParamText(ctx, 'idleSpeed', '1200–1350 obr./min');

    return [
      {
        id: 'missing_cylinder',
        number: 1,
        title: 'Nie pracuje jeden cylinder',
        subtitle: `Praca na ${cylCount - 1} z ${cylCount} cylindrów, brak reakcji jednego kolektora`,
        icon: '🔥',
        steps: {
          step_1: {
            title: 'KROK 1: Identyfikacja niedziałającego cylindra metodą termiczną',
            check: `Temperatura wszystkich ${cylLabel} na kolektorach wydechowych 30–60 sekund po zimnym rozruchu w modelu ${m.brand} ${m.model} (${m.engineCode}).`,
            how: 'Uruchom zimny silnik na 30–45 sekund i zmierz pirometrem temperaturę każdej rury kolektora wydechowego w odległości 5 cm od głowicy.',
            tool: 'Termometr pirometryczny IR (zakres −20 do +500°C) lub kamera termowizyjna.',
            expected: `Wszystkie ${cylCount} kolektory nagrzewają się równomiernie do 140–250°C (różnica między cylindrami poniżej 25–30°C).`,
            abnormal: 'Jeden z kolektorów jest wyraźnie chłodniejszy (<60–80°C) — w tym cylindrze nie zachodzi spalanie mieszanki.',
            nextText: 'Jeśli zlokalizowano zimny cylinder → przejdź do KROKU 2 (Test iskry i świecy na tym cylindrze). Jeśli temperatury są zbliżone, a silnik szarpie → przejdź do KROKU 3.',
            causes: 'Zalana świeca zapłonowa, przebicie fajkocewki COP / fajki WN, zatkana dysza wolnych obrotów / niedziałający wtryskiwacz, brak kompresji (podparty zawór).',
            repair: 'Oznacz numer niedziałającego cylindra (licząc od lewej strony: 1–2–3' + (cylCount === 4 ? '–4' : '') + ') i przejdź do weryfikacji zapłonu.',
            passNext: 'step_3',
            failNext: 'step_2'
          },
          step_2: {
            title: 'KROK 2: Weryfikacja świecy zapłonowej i iskry na martwym cylindrze',
            check: `Świeca zapłonowa (${sparkPlugSpec}, przerwa ${sparkGapSpec}) oraz cewka/fajka na wytypowanym cylindrze. ${pairHint}`,
            how: 'Wykręć świecę z zimnego cylindra, oceń czy jest mokra od benzyny czy sucha, sprawdź iskrę na testerze oraz zamień świecę/fajkocewkę miejscami ze sprawnym cylindrem.',
            tool: 'Klucz do świec 16/14 mm, tester długości iskry (przerwa 6 mm), multimetr cyfrowy.',
            expected: `Silna, niebiesko-biała iskra przeskakująca przerwę 6 mm; rezystancja uzwojenia pierwotnego cewki: ${coilPrimSpec}.`,
            abnormal: 'Brak iskry, iskra czerwona/rozproszona po izolatorze lub usterka przenosi się na sąsiedni cylinder po zamianie cewki/świecy.',
            nextText: 'Jeśli iskra i świeca są prawidłowe → przejdź do KROKU 3 (Zasilanie paliwem tego cylindra). Jeśli iskra jest wadliwa → wymień świecę/cewkę.',
            causes: 'Zalanie świecy przy rozruchu na zimno, pęknięty izolator, uszkodzona fajkocewka COP lub skorodowany przewód WN w fajce 5 kΩ.',
            repair: 'Wymień komplet świec zapłonowych (ustaw przerwę ' + sparkGapSpec + ') lub uszkodzoną fajkocewkę COP / fajkę WN.',
            passNext: 'step_3',
            failNext: 'step_4'
          },
          step_3: {
            title: isCarb
              ? 'KROK 3: Kontrola gaźnika niedziałającego cylindra (dysza jałowa i zaworek iglicowy)'
              : 'KROK 3: Kontrola wtryskiwacza EFI i impulsu sterującego z ECU',
            check: isCarb
              ? 'Drożność dyszy wolnych obrotów (Pilot Jet), położenie tłoczka ssania oraz poziom paliwa w komorze pływakowej tego cylindra.'
              : `Praca wtryskiwacza paliwa tego cylindra (rezystancja: ${injResSpec}) oraz obecność zasilania +12V i impulsów masowych z ECU.`,
            how: isCarb
              ? 'Otwórz śrubę spustową komory pływakowej badanego gaźnika: sprawdź czy jest w niej paliwo, czy nie wylewa się z przelewu (zacięty zaworek iglicowy) oraz sprawdź drożność dyszy wolnych obrotów.'
              : 'Przyłóż stetoskop do korpusu wtryskiwacza na pracującym silniku, a następnie zmierz rezystancję uzwojenia wtryskiwacza multimetrem.',
            tool: isCarb
              ? 'Wkrętak JIS, przezroczysty wężyk do pomiaru poziomu paliwa, myjka ultradźwiękowa.'
              : 'Multimetr cyfrowy, stetoskop mechanika, diodowy próbnik impulsów wtrysku (Noid Light).',
            expected: isCarb
              ? 'Prawidłowy poziom paliwa w komorze, czysta dysza wolnych obrotów, cofnięty tłoczek ssania, szczelny króciec ssący.'
              : `Wyraźne klikanie iglicy wtryskiwacza, rezystancja wtryskiwacza ${injResSpec}, ciśnienie na listwie ${fuelPressSpec}.`,
            abnormal: isCarb
              ? 'Brak paliwa w komorze, przelewanie przez zaworek iglicowy lub przytkana dysza biegu jałowego.'
              : 'Brak klikania wtryskiwacza, przerwa w uzwojeniu (OL) lub zatkany rozpylacz po postoju.',
            nextText: 'Jeśli układ paliwowy i zapłonowy są sprawne, a cylinder nadal nie pracuje → przejdź do KROKU 4 (Pomiar kompresji i luzów zaworowych).',
            causes: isCarb
              ? 'Zatkana dysza wolnych obrotów osadem z biokomponentów E10, zacięty zaworek iglicowy, pęknięty króciec ssący.'
              : 'Zatkany wtryskiwacz, skorodowana wtyczka wtryskiwacza, przerwany przewód w wiązce pod airboxem.',
            repair: isCarb
              ? 'Wyczyść gaźniki w myjce ultradźwiękowej, wymień zaworki iglicowe i wykonaj synchronizację podciśnień.'
              : 'Wyczyść wtryskiwacze ultradźwiękowo na stanowisku probierczym lub wymień uszkodzony wtryskiwacz.',
            passNext: 'step_4',
            failNext: 'step_4'
          },
          step_4: {
            title: 'KROK 4: Pomiar kompresji i próba szczelności (Leak Down / luzy zaworowe)',
            check: `Ciśnienie sprężania wszystkich ${cylCount} cylindrów oraz luzy zaworowe (IN: ${valveInSpec} | EX: ${valveExSpec}).`,
            how: 'Zmierz kompresję na wszystkich cylindrach przy otwartej przepustnicy (WOT) i wpisz wyniki do tabeli „Diagnostyka Cylindrów”. Na słabym cylindrze wykonaj próbę olejową i Leak Down.',
            tool: 'Manometr kompresji M10/M12, tester Leak Down, szczelinomierz listkowy co 0.02 mm.',
            expected: `Ciśnienie sprężania: ${compSpec}; ubytek Leak Down < 10%.`,
            abnormal: 'Kompresja na martwym cylindrze < 7–8 bar lub różnica względem pozostałych cylindrów > 2.0 bar.',
            nextText: 'Zapisz pomiary w karcie cylindrów i wykonaj regulację zaworów lub rewizję głowicy.',
            causes: 'Podparty (zbyt ciasny) lub wypalony zawór wydechowy, pęknięty pierścień tłokowy, przepalona uszczelka pod głowicą.',
            repair: 'Wyreguluj luzy zaworowe (dobierz płytki w Kalkulatorze Płytek) lub zdemontuj głowicę w celu obróbki gniazd i wymiany zaworów.',
            passNext: 'step_1',
            failNext: 'step_1'
          }
        }
      },
      {
        id: 'rough_idle',
        number: 2,
        title: 'Silnik pracuje nierówno',
        subtitle: `Wahania obrotów, drgania i brak kultury pracy ${cylCount} cylindrów`,
        icon: '〰️',
        steps: {
          step_1: {
            title: 'KROK 1: Pomiar podciśnień i synchronizacji 3–4 gardzieli',
            check: `Równomierność podciśnienia w kolektorach ssących wszystkich ${cylLabel}.`,
            how: 'Rozgrzej silnik do temperatury roboczej, podłącz 4-kanałowy wakuometr do króćców pomiarowych i odczytaj podciśnienia na biegu jałowym (' + idleSpec + ').',
            tool: 'Wakuometr 4-kanałowy (słupkowy, zegarowy lub elektroniczny), długi wkrętak do synchronizacji.',
            expected: `Wszystkie ${cylCount} słupki podciśnienia na równym poziomie: ${syncSpec}.`,
            abnormal: 'Rozjazd podciśnień pomiędzy cylindrami > 25–40 mmHg powodujący szarpanie i hałas kosza sprzęgłowego.',
            nextText: 'Jeśli synchronizacja jest rozjechana → wyrównaj przepustnice. Jeśli nie daje się wyrównać → przejdź do KROKU 2 (Test szczelności dolotu).',
            causes: 'Rozregulowane śruby synchronizacji po serwisie, zużyte osi przepustnic, różnice w luzach zaworowych.',
            repair: 'Przeprowadź pełną synchronizację gaźników/przepustnic względem cylindra bazowego i ustaw obroty biegu jałowego.',
            passNext: 'step_2',
            failNext: 'step_2'
          },
          step_2: {
            title: 'KROK 2: Test szczelności króćców dolotowych i wężyków podciśnienia (lewe powietrze)',
            check: 'Szczelność gumowych króćców ssących, zaślepek króćców synchronizacji oraz przewodów do czujnika MAP/IAP i zaworu PAIR/AIS.',
            how: 'Skontroluj stan gumy króćców oraz wężyków pod airboxem; wykonaj próbę dymową lub punktowy test szczelności na pracującym silniku.',
            tool: 'Wytwornica dymu diagnostycznego, latarka inspekcyjna, szczypce do przewodów podciśnieniowych.',
            expected: 'Całkowita szczelność dolotu za przepustnicami; stabilne obroty biegu jałowego: ' + idleSpec + '.',
            abnormal: 'Zmiana obrotów podczas testu, spękane króćce ssące lub brakujące kapturki na króćcach pomiarowych.',
            nextText: 'Jeśli dolot jest szczelny → przejdź do KROKU 3 (Kontrola luzów zaworowych i kompresji).',
            causes: 'Spękane ze starości króćce ssące, zsunięty wężyk czujnika MAP/IAP, podwinięta uszczelka pod korpusem przepustnic.',
            repair: 'Wymień komplet króćców dolotowych wraz z O-ringami, załóż nowe kapturki EPDM na króćce pomiarowe i powtórz synchronizację.',
            passNext: 'step_3',
            failNext: 'step_3'
          },
          step_3: {
            title: 'KROK 3: Kontrola luzów zaworowych i wyrównania kompresji',
            check: `Luzy zaworowe na zimnym silniku (IN: ${valveInSpec} | EX: ${valveExSpec}) oraz kompresja (${compSpec}).`,
            how: 'Zmierz szczelinomierzem wszystkie zawory ssące i wydechowe oraz wykonaj pomiar kompresji na wszystkich cylindrach.',
            tool: 'Szczelinomierz co 0.02 mm, manometr kompresji.',
            expected: `Wszystkie zawory w tolerancji fabrycznej; rozrzut kompresji między cylindrami Δ ≤ 1.5 bar.`,
            abnormal: 'Podparte zawory wydechowe na wybranych cylindrach powodujące nierówne napełnianie na biegu jałowym.',
            nextText: 'Po korekcie luzów zaworowych zawsze wykonaj ponowną synchronizację przepustnic/gaźników!',
            causes: 'Osiadanie zaworów w gniazdach głowicy 16V/12V po przebiegu 20 000–24 000 km.',
            repair: 'Skoryguj płytki zaworowe (użyj Kalkulatora Płytek w zakładce Cylindry) i zsynchronizuj układ dolotowy.',
            passNext: 'step_1',
            failNext: 'step_1'
          }
        }
      },
      {
        id: 'stalls_at_idle',
        number: 3,
        title: 'Silnik gaśnie na wolnych obrotach',
        subtitle: 'Gaśnięcie po rozgrzaniu, przy dojeżdżaniu do świateł lub wciśnięciu sprzęgła',
        icon: '🛑',
        steps: {
          step_1: {
            title: 'KROK 1: Kontrola obrotów biegu jałowego, układu IACV / Fast Idle oraz TPS',
            check: `Prędkość obrotowa biegu jałowego na gorącym silniku (${idleSpec}) oraz działanie zaworu powietrza dodatkowego IACV / śruby regulacji jałowej.`,
            how: 'Rozgrzej silnik do 85–90°C, sprawdź obroty jałowe oraz napięcie spoczynkowe czujnika TPS przy zamkniętej przepustnicy.',
            tool: 'Obrotomierz serwisowy / skaner diagnostyczny, multimetr cyfrowy.',
            expected: `Stabilne obroty jałowe ${idleSpec}, płynne zejście z obrotów bez przygasania poniżej 1000 obr./min.`,
            abnormal: 'Obroty spadają do 800 obr./min i silnik gaśnie przy zamknięciu manetki gazu.',
            nextText: 'Jeśli regulacja jałowa i IACV nie pomagają, a problem nasila się na gorącym silniku → przejdź do KROKU 2 (Luzy zaworowe).',
            causes: 'Zabrudzony nagarem kanał obejściowy powietrza biegu jałowego (IACV), przestawiony czujnik TPS, zatkane dysze wolnych obrotów.',
            repair: 'Wyczyść kanały biegu jałowego i zawór krokowy IACV, skalibruj TPS i ustaw obroty biegu jałowego na rozgrzanym silniku.',
            passNext: 'step_2',
            failNext: 'step_2'
          },
          step_2: {
            title: 'KROK 2: Weryfikacja podpartych zaworów (gaśnięcie po nagrzaniu silnika)',
            check: `Luzy zaworowe na zimnym silniku — szczególnie zawory wydechowe (${valveExSpec}) i ssące (${valveInSpec}).`,
            how: 'Na całkowicie zimnym silniku zdejmij pokrywę zaworów i zmierz luzy na wszystkich 12/16 zaworach.',
            tool: 'Szczelinomierz listkowy precyzyjny (0.04–0.35 mm), mikrometr.',
            expected: `Luzy w pełnym zakresie specyfikacji (${valveInSpec} / ${valveExSpec}).`,
            abnormal: 'Luz bliski 0.00–0.05 mm — po rozgrzaniu silnika trzonek zaworu wydłuża się termicznie, zawór przestaje się domykać i silnik traci kompresję na wolnych obrotach!',
            nextText: 'Jeśli luzy są prawidłowe → przejdź do KROKU 3 (Kontrola ładowania i czujnika stopki/sprzęgła).',
            causes: 'Brak regulacji płytkowej zaworów w wymaganym interwale serwisowym.',
            repair: 'Wymień płytki regulacyjne na cieńsze zgodnie z wyliczeniem Kalkulatora Płytek Zaworowych.',
            passNext: 'step_3',
            failNext: 'step_3'
          },
          step_3: {
            title: 'KROK 3: Kontrola napięcia ładowania na wolnych obrotach i czujników bezpieczeństwa',
            check: `Napięcie na akumulatorze przy włączonych światłach i wentylatorze chłodnicy (standard przy 5000 rpm: ${chargeSpec}).`,
            how: 'Zmierz napięcie na klemach akumulatora na biegu jałowym w momencie, gdy uruchamia się wentylator chłodnicy lub włączasz światła STOP.',
            tool: 'Multimetr cyfrowy.',
            expected: 'Napięcie na biegu jałowym utrzymuje się powyżej 12.6–13.2 V i nie spada poniżej 12.0 V po załączeniu wentylatora.',
            abnormal: 'Spadek napięcia poniżej 11.5 V po załączeniu wentylatora powoduje odcięcie zasilania ECU/wtryskiwaczy i zgaśnięcie silnika.',
            nextText: 'Sprawdź stojan, regulator napięcia oraz czystość konektorów głównych.',
            causes: 'Uszkodzona jedna faza stojana 3-fazowego, przegrzany regulator napięcia, zużyty akumulator.',
            repair: 'Napraw układ ładowania (stojan / regulator MOSFET) i naładuj lub wymień akumulator.',
            passNext: 'step_1',
            failNext: 'step_1'
          }
        }
      },
      {
        id: 'no_start',
        number: 4,
        title: 'Motocykl nie odpala',
        subtitle: 'Brak rozruchu — systemowa weryfikacja: Rozrusznik → Iskra → Paliwo → Kompresja',
        icon: '🔑',
        steps: {
          step_1: {
            title: 'KROK 1: Test akumulatora, prędkości kręcenia rozrusznika i blokad Safety Interlock',
            check: 'Napięcie spoczynkowe i rozruchowe akumulatora, wyłącznik Kill Switch, czujnik stopki bocznej, luzu oraz czujnik przechyłu (Tip-Over).',
            how: 'Podłącz multimetr do akumulatora i naciśnij przycisk START przy wciśniętym sprzęgle na biegu jałowym.',
            tool: 'Multimetr z funkcją MIN/MAX, tester akumulatorów.',
            expected: 'Napięcie spoczynkowe ≥ 12.6 V; podczas kręcenia rozrusznikiem napięcie NIE spada poniżej 10.0 V, a wał obraca się żwawo (>300 obr./min).',
            abnormal: 'Napięcie spada do 8–9 V (rozrusznik kręci, ale TCI/ECU nie generuje już iskry!) lub przekaźnik rozrusznika w ogóle nie klika.',
            nextText: 'Jeśli rozrusznik kręci z pełną prędkością i napięcie > 10 V → przejdź do KROKU 2 (Weryfikacja iskry i pompy paliwa).',
            causes: 'Rozładowany akumulator, zaśniedziałe klemy, stopiona kostka bezpiecznika głównego 30A na przekaźniku rozrusznika, zablokowany czujnik stopki/Tip-Over.',
            repair: 'Naładuj/wymień akumulator, oczyść złącze przekaźnika rozrusznika 30A i sprawdź obwód Safety Interlock.',
            passNext: 'step_2',
            failNext: 'step_2'
          },
          step_2: {
            title: 'KROK 2: Weryfikacja pracy pompy paliwa i obecności iskry',
            check: `Obecność iskry na świecach (${sparkPlugSpec}) oraz ciśnienie paliwa / napełnienie komór pływakowych (${fuelPressSpec}).`,
            how: 'Sprawdź czy po przekręceniu kluczyka pompa paliwa pracuje przez 2–3 sekundy oraz wykonaj test iskry podczas kręcenia rozrusznikiem.',
            tool: 'Tester iskry, manometr ciśnienia paliwa.',
            expected: `Silna iskra na świecach oraz prawidłowe ciśnienie paliwa (${fuelPressSpec}).`,
            abnormal: 'Brak pracy pompy paliwa, zalane na mokro świece zapłonowe (po nieudanych próbach rozruchu z dodawaniem gazu!) lub brak iskry.',
            nextText: 'Jeśli świece są mokre od benzyny → przejdź do KROKU 3 (Procedura odwietrzenia zalanego silnika R3/R4).',
            causes: 'Zalane świece zapłonowe (bardzo częste w 4-cylindrowych 600 cm³ po krótkim odpaleniu i zgaszeniu zimnego silnika!), uszkodzony przekaźnik pompy paliwa lub czujnik CKP.',
            repair: 'Przy zalaniu: wykręć i osusz/wymień komplet świec. Przy braku pracy pompy: sprawdź bezpiecznik FI, przekaźnik pompy i czujnik przechyłu Tip-Over.',
            passNext: 'step_3',
            failNext: 'step_3'
          },
          step_3: {
            title: 'KROK 3: Weryfikacja kompresji i zmycia filmu olejowego (Cylinder Wash)',
            check: `Kompresja na wszystkich ${cylCount} cylindrach (${compSpec}) oraz ustawienie znaków rozrządu.`,
            how: 'Zmierz kompresję manometrem. Jeśli po wielokrotnym zalaniu benzyną kompresja spadła na wszystkich cylindrach do 5–6 bar (benzyna zmyła film olejowy z gładzi!), podaj po 3 ml oleju do każdego cylindra.',
            tool: 'Manometr kompresji, strzykawka z olejem 10W-40.',
            expected: `Ciśnienie sprężania ${compSpec}, znaki rozrządu IN/EX pokrywające się z płaszczyzną głowicy przy GMP Cyl 1.`,
            abnormal: 'Brak kompresji z powodu zmycia filmu olejowego przez paliwo, podpartych zaworów lub przeskoczonego łańcucha rozrządu.',
            nextText: 'Po przywróceniu filmu olejowego i zamontowaniu nowych świec uruchom silnik bez dotykania manetki gazu.',
            causes: 'Zmycie filmu olejowego benzyną (Cylinder Wash), przeskoczenie łańcucha rozrządu przy zużytym napinaczu CCT.',
            repair: 'Przywróć film olejowy, zamontuj nowe świece, sprawdź poziom oleju (czy nie przybyło w nim benzyny!) i zweryfikuj napinacz rozrządu.',
            passNext: 'step_1',
            failNext: 'step_1'
          }
        }
      },
      {
        id: 'no_spark',
        number: 5,
        title: 'Brak iskry',
        subtitle: 'Diagnostyka obwodu WN, cewek Wasted Spark / COP, czujnika CKP i ECU/TCI',
        icon: '⚡',
        steps: {
          step_1: {
            title: 'KROK 1: Określenie zakresu braku iskry (1 cylinder vs para 1–4 / 2–3 vs wszystkie)',
            check: `Obecność iskry na wszystkich ${cylLabel}. ${pairHint}`,
            how: 'Sprawdź iskrę na każdym kanale zapłonowym za pomocą testera iskry podczas kręcenia rozrusznikiem.',
            tool: 'Rozgałęźny tester iskry 4-kanałowy lub pojedynczy iskrownik pomiarowy.',
            expected: `Równomierna, niebieska iskra na wszystkich ${cylCount} cylindrach.`,
            abnormal: 'Brak iskry na: (A) wszystkich cylindrach → idź do KROKU 2; (B) parze cylindrów 1+4 lub 2+3 → idź do KROKU 3; (C) pojedynczym cylindrze → sprawdź świecę, fajkę i pojedynczą cewkę COP.',
            nextText: 'Wybierz ścieżkę zależnie od tego, czy brakuje iskry na wszystkich cylindrach, czy tylko na wybranym kanale.',
            causes: 'Wspólny brak iskry = czujnik CKP lub zasilanie ECU/TCI; brak na parze = cewka podwójna lub kanał sterownika; brak na 1 cylindrze = świeca/fajka/COP.',
            repair: 'Zawęź obszar poszukiwań zgodnie z topologią układu zapłonowego modelu ' + m.brand + ' ' + m.model + '.',
            passNext: 'step_2',
            failNext: 'step_2'
          },
          step_2: {
            title: 'KROK 2: Pomiar czujnika położenia wału korbowego (CKP / Pickup Coil)',
            check: `Rezystancja i napięcie szczytowe czujnika CKP (${ckpSpec}) oraz brak zwarcia do masy.`,
            how: 'Rozepnij 2-pinową wtyczkę czujnika CKP (impulsatora) i zmierz jego rezystancję omomierzem, a następnie napięcie szczytowe podczas kręcenia rozrusznikiem.',
            tool: 'Multimetr cyfrowy + adapter napięcia szczytowego (Peak Voltage Adapter) lub oscyloskop.',
            expected: `Rezystancja czujnika CKP: ${ckpSpec}; izolacja do masy: OL; napięcie szczytowe przy rozruchu ≥ 0.7–1.5 V_peak.`,
            abnormal: 'Przerwa w uzwojeniu czujnika CKP (OL), zwarcie do masy lub napięcie szczytowe 0 V podczas kręcenia.',
            nextText: 'Jeśli czujnik CKP jest sprawny → przejdź do KROKU 3 (Pomiar cewek i zasilania +12V po Kill Switch).',
            causes: 'Uszkodzone uzwojenie impulsatora CKP (często przerywa po rozgrzaniu silnika!), ścięty klin tarczy impulsowej.',
            repair: 'Wymień czujnik położenia wału korbowego CKP i ustaw prawidłową szczelinę powietrzną nad rotorem.',
            passNext: 'step_3',
            failNext: 'step_3'
          },
          step_3: {
            title: 'KROK 3: Pomiar uzwojeń cewek zapłonowych oraz zasilania +12V i wysterowania z ECU/TCI',
            check: `Uzwojenie pierwotne cewek (${coilPrimSpec}), uzwojenie wtórne (${getParamText(ctx, 'ignitionCoilSecondary', '10–25 kΩ')}) oraz zasilanie +12V na cewkach.`,
            how: 'Zmierz napięcie między przewodem zasilającym cewki a masą po włączeniu zapłonu i RUN (musi być napięcie akumulatora), a następnie zmierz rezystancje cewek.',
            tool: 'Multimetr cyfrowy, lampka diodowa LED do testu impulsów kluczowania masy z TCI/ECU.',
            expected: `Pełne napięcie +12V na zasilaniu cewek; rezystancja pierwotna ${coilPrimSpec}.`,
            abnormal: 'Brak +12V na cewkach (uszkodzony Kill Switch / stacyjka / przekaźnik) lub brak impulsów masowych z modułu TCI/ECU.',
            nextText: 'Sprawdź wiązkę między cewkami a ECU/TCI, stacyjkę (diodę Zenera w starszych Hondach/Kawasaki!) oraz immobilizer.',
            causes: 'Wypalony styk wyłącznika Kill Switch, uszkodzona cewka zapłonowa, zimne luty w module TCI/CDI (np. starsze CBR/FZR).',
            repair: 'Oczyść/wymień wyłącznik zapłonu, wymień uszkodzoną cewkę lub oddaj moduł TCI do regeneracji elektroniki.',
            passNext: 'step_1',
            failNext: 'step_1'
          }
        }
      },
      {
        id: 'fuel_flooding',
        number: 6,
        title: 'Silnik zalewa paliwem',
        subtitle: 'Mokre świece, czarny dym z wydechu, zapach benzyny w oleju silnikowym',
        icon: '💧',
        steps: {
          step_1: {
            title: 'KROK 1: Kontrola poziomu i zapachu oleju silnikowego (BHP — ryzyko zatarcia i Hydrolock!)',
            check: 'Poziom oleju w okienku kontrolnym / na bagnecie oraz zapach oleju pod korkiem wlewu.',
            how: 'Ustaw motocykl pionowo, sprawdź czy poziom oleju nie przekracza górnego znaku MAX oraz czy z wlewu oleju nie czuć benzyny.',
            tool: 'Wzrokowa kontrola wziernika/bagnetu, próba kroplowa na bibule.',
            expected: 'Poziom oleju pomiędzy MIN a MAX, brak zapachu benzyny, właściwa lepkość filmu olejowego.',
            abnormal: 'Stan oleju znacznie powyżej MAX, rzadki olej śmierdzący benzyną — paliwo przelało się przez cylindry do karteru!',
            nextText: 'UWAGA: Jeśli w oleju jest benzyna, NIE uruchamiaj silnika przed wymianą oleju! Przejdź do KROKU 2.',
            causes: isCarb
              ? 'Nieszczelny zaworek iglicowy gaźnika + przepuszczający kranik podciśnieniowy (PRI / uszkodzona membrana kranika).'
              : 'Lejący wtryskiwacz paliwa lub pęknięta membrana podciśnieniowego regulatora ciśnienia paliwa (FPR).',
            repair: 'Natychmiast spuść rozcieńczony olej z benzyną, wymień olej i filtr po usunięciu przyczyny przelewania w KROKU 2.',
            passNext: 'step_2',
            failNext: 'step_2'
          },
          step_2: {
            title: isCarb
              ? 'KROK 2: Test zaworków iglicowych, O-ringów gniazd i poziomu pływaków w 3–4 gaźnikach'
              : 'KROK 2: Test regulatora ciśnienia paliwa (FPR) oraz szczelności wtryskiwaczy EFI',
            check: isCarb
              ? `Szczelność zaworków iglicowych oraz wysokość pływaków (${getParamText(ctx, 'floatHeight', 'Wg specyfikacji gaźnika w DTR')}).`
              : `Szczelność membrany regulatora ciśnienia paliwa (${fuelPressSpec}) oraz szczelność wtryskiwaczy w stanie spoczynku.`,
            how: isCarb
              ? 'Sprawdź wężykiem poziom paliwa w każdej z komór pływakowych, oceń stożki zaworków iglicowych i O-ringi mosiężnych gniazd zaworków.'
              : 'Zdejmij wężyk podciśnieniowy z regulatora ciśnienia paliwa (sprawdź czy jest suchy!) oraz sprawdź czy wtryskiwacze nie kapią pod ciśnieniem pompy.',
            tool: isCarb
              ? 'Pompka ciśnieniowa 0.25 bar, suwmiarka, przezroczysty wężyk pomiarowy.'
              : 'Manometr ciśnienia paliwa, pompka podciśnieniowa Mityvac.',
            expected: isCarb
              ? 'Zaworki iglicowe utrzymują ciśnienie 0.25 bar, równy poziom paliwa we wszystkich komorach, cofnięte tłoczki ssania.'
              : 'Suchy króciec podciśnienia regulatora FPR, ciśnienie paliwa ' + fuelPressSpec + ', szczelne końcówki wtryskiwaczy.',
            abnormal: isCarb
              ? 'Przelewanie paliwa rurką odpowietrzającą lub przez gardziel gaźnika do cylindra.'
              : 'Benzyna w wężyku podciśnienia regulatora FPR (zasysana wprost do kolektora ssącego!) lub kapiący wtryskiwacz.',
            nextText: 'Przejdź do KROKU 3 (Kontrola czujnika temperatury ECT / układu ssania).',
            causes: isCarb
              ? 'Stwardniały stożek zaworka iglicowego, sparciały O-ring gniazda zaworka, zatopiony pływak.'
              : 'Pęknięta membrana regulatora ciśnienia paliwa FPR, zablokowany otwarty wtryskiwacz.',
            repair: isCarb
              ? 'Wymień komplet zaworków iglicowych z gniazdami i O-ringami, ustaw wysokość pływaków i sprawdź kranik paliwa.'
              : 'Wymień regulator ciśnienia paliwa FPR lub nieszczelny wtryskiwacz.',
            passNext: 'step_3',
            failNext: 'step_3'
          },
          step_3: {
            title: 'KROK 3: Weryfikacja czujnika temperatury ECT / MAP (EFI) lub tłoczków ssania (Gaźniki)',
            check: isCarb
              ? 'Domykanie wszystkich tłoczków ssania (Enrichener Plungers) po wyłączeniu dźwigni ssania.'
              : 'Wskazania czujnika temperatury płynu chłodniczego (ECT) oraz szczelność wężyka czujnika MAP.',
            how: isCarb
              ? 'Sprawdź, czy listwa ssania wraca do końca i czy gumowe czopki tłoczków ssania nie są wykruszone.'
              : 'Zmierz rezystancję czujnika ECT na ciepłym silniku (ok. 80°C powinno być 250–350 Ω; jeśli czujnik ma przerwę >10 kΩ, ECU myśli że jest −30°C i zalewa silnik!).',
            tool: 'Multimetr cyfrowy, wkrętaki warsztatowe.',
            expected: 'Prawidłowe zubożenie dawki rozruchowej po nagrzaniu silnika.',
            abnormal: 'Stałe wzbogacanie mieszanki na ciepłym silniku (czarne, okopcone świece na wszystkich cylindrach).',
            nextText: 'Po naprawie wymień zalane świece zapłonowe na nowe.',
            causes: 'Uszkodzony termistor ECT, zsunięty wężyk czujnika ciśnienia atmosferycznego/kolektora MAP, zapieczona linka ssania.',
            repair: 'Wymień czujnik ECT / napraw wężyk MAP lub zregeneruj tłoczki ssania w gaźnikach.',
            passNext: 'step_1',
            failNext: 'step_1'
          }
        }
      },
      {
        id: 'cold_cylinder',
        number: 7,
        title: 'Jeden cylinder jest zimniejszy',
        subtitle: 'Asymetria termiczna kolektorów wydechowych na biegu jałowym i średnich obrotach',
        icon: '❄️',
        steps: {
          step_1: {
            title: 'KROK 1: Pomiar różnicy temperatur kolektorów wydechowych na jałowych vs 3500 obr./min',
            check: `Temperatura każdego z ${cylCount} kolektorów na biegu jałowym (${idleSpec}) oraz po utrzymaniu 3500 obr./min przez 30 sekund.`,
            how: 'Zmierz pirometrem temperaturę wszystkich rur wydechowych na wolnych obrotach, a następnie unieś obroty do 3500 obr./min i powtórz pomiar.',
            tool: 'Termometr pirometryczny IR.',
            expected: 'Równomierna temperatura wszystkich kolektorów zarówno na biegu jałowym, jak i przy 3500 obr./min.',
            abnormal: 'WARIANT A: Cylinder jest zimny na jałowych, ale dogrzewa się i zaczyna normalnie pracować przy 3500 obr./min (wskazuje na obwód biegu jałowego / synchronizację!). WARIANT B: Cylinder pozostaje zimny w całym zakresie obrotów (brak iskry / brak wtrysku / brak kompresji).',
            nextText: 'Jeśli cylinder dogrzewa się po dodaniu gazu → przejdź do KROKU 2. Jeśli jest martwy stale → przejdź do KROKU 3.',
            causes: 'Przytkana dysza wolnych obrotów (Pilot Jet), rozjechana synchronizacja jednej przepustnicy, nieszczelny króciec ssący tego cylindra.',
            repair: 'Przeprowadź diagnostykę ukierunkowaną na obwód biegu jałowego tego konkretnego cylindra.',
            passNext: 'step_2',
            failNext: 'step_3'
          },
          step_2: {
            title: 'KROK 2: Diagnostyka obwodu biegu jałowego i synchronizacji chłodniejszego cylindra',
            check: isCarb
              ? `Drożność dyszy wolnych obrotów, ustawienie śruby składu mieszanki (${getParamText(ctx, 'pilotScrewTurns', 'Wg DTR')}) oraz synchronizacja (${syncSpec}).`
              : `Synchronizacja przepustnicy chłodniejszego cylindra (${syncSpec}), szczelność króćca oraz wydatek wtryskiwacza przy małych czasach otwarcia.`,
            how: 'Podłącz wakuometr 4-kanałowy, sprawdź podciśnienie na chłodniejszym cylindrze oraz sprawdź reakcję tego cylindra na delikatną korektę śruby składu mieszanki / by-passu.',
            tool: 'Wakuometr 4-kanałowy, wkrętak kątowy do śrub Pilot Screw.',
            expected: `Wyrównane podciśnienia (${syncSpec}) i natychmiastowy wzrost temperatury kolektora po udrożnieniu obwodu jałowego.`,
            abnormal: 'Brak reakcji cylindra na kręcenie śrubą składu mieszanki lub skrajnie inne podciśnienie w tym kolektorze.',
            nextText: 'Jeśli synchronizacja i układ paliwowy są poprawne → przejdź do KROKU 3.',
            causes: 'Zatkany kanał biegu jałowego w jednym gaźniku, zgubiony O-ring pod śrubą składu mieszanki, nieszczelność pod króćcem ssącym.',
            repair: 'Udrożnij kanał wolnych obrotów, wymień O-ring śruby składu mieszanki i wyrównaj podciśnienia wakuometrem.',
            passNext: 'step_3',
            failNext: 'step_3'
          },
          step_3: {
            title: 'KROK 3: Test zamiany fajkocewki/świecy oraz pomiar luzu zaworowego tego cylindra',
            check: `Sprawność świecy i cewki oraz luzy zaworowe chłodniejszego cylindra (IN: ${valveInSpec} | EX: ${valveExSpec}).`,
            how: 'Zamień miejscami fajkocewkę COP (lub przewód WN) i świecę między cylindrem zimnym a gorącym; sprawdź również kompresję tego cylindra.',
            tool: 'Klucz do świec, multimetr, manometr kompresji.',
            expected: `Kompresja ${compSpec}, prawidłowa iskra pod ciśnieniem sprężania.`,
            abnormal: 'Przebicie na fajce/cewce lub zmniejszona kompresja na tym cylindrze z powodu podpartego zaworu.',
            nextText: 'Zapisz pomiary w zakładce „Diagnostyka Cylindrów” i porównaj odchylenie procentowe.',
            causes: 'Wewnętrzne przebicie fajkocewki COP, zużyta świeca zapłonowa, podparty zawór wydechowy.',
            repair: 'Wymień wadliwą fajkocewkę/świecę lub wyreguluj luzy zaworowe.',
            passNext: 'step_1',
            failNext: 'step_1'
          }
        }
      },
      {
        id: 'loss_of_power',
        number: 8,
        title: 'Silnik traci moc',
        subtitle: 'Spadek dynamiki, ospała reakcja na gaz, niższa prędkość maksymalna',
        icon: '📉',
        steps: {
          step_1: {
            title: 'KROK 1: Kontrola kompresji i szczelności wszystkich cylindrów oraz luzów zaworowych',
            check: `Ciśnienie sprężania na wszystkich ${cylCount} cylindrach (${compSpec}) oraz ustawienie faz rozrządu.`,
            how: 'Zmierz kompresję na rozgrzanym silniku przy pełnym otwarciu przepustnicy (WOT) i sprawdź pokrycie znaków rozrządu na wałkach i wale korbowym.',
            tool: 'Manometr kompresji, tester Leak Down, szczelinomierz.',
            expected: `Równa, wysoka kompresja (${compSpec}) i idealne zgranie znaków rozrządu IN/EX.`,
            abnormal: 'Spadek kompresji na jednym lub więcej cylindrach albo opóźnienie wałków rozrządu o 1 ząb na wyciągniętym łańcuchu rozrządu.',
            nextText: 'Jeśli mechanika i kompresja są w normie → przejdź do KROKU 2 (Układ paliwowy i dolotowy).',
            causes: 'Rozciągnięty łańcuch rozrządu (opóźnia fazy rozrządu i odbiera moc w górze obrotów!), wypalone gniazda zaworowe, zużyte pierścienie.',
            repair: 'Wymień łańcuch rozrządu wraz z napinaczem, wyreguluj luzy zaworowe lub przeprowadź rewizję głowicy.',
            passNext: 'step_2',
            failNext: 'step_2'
          },
          step_2: {
            title: 'KROK 2: Kontrola wydatku układu paliwowego, filtra powietrza i zaworu wydechowego EXUP/H-TEV/SET',
            check: `Ciśnienie paliwa pod obciążeniem (${fuelPressSpec}), stan filtra powietrza, pełne otwarcie przepustnic (100% WOT) oraz ruch zaworu w układzie wydechowym (jeśli występuje).`,
            how: 'Sprawdź czy manetka gazu otwiera przepustnice do 100%, skontroluj wkład filtra powietrza oraz pracę serwomechanizmu zaworu wydechowego (EXUP w Yamasze, H-TEV w Hondzie, SET w Suzuki/Triumph).',
            tool: 'Manometr ciśnienia paliwa, kontrola wizualna pod airboxem.',
            expected: `Ciśnienie paliwa ${fuelPressSpec} utrzymywane przy wysokich obrotach; czysty airbox; zawór wydechowy otwiera się całkowicie powyżej 7000 obr./min.`,
            abnormal: 'Zapieczony w pozycji przymkniętej zawór wydechowy EXUP/SET lub spadające ciśnienie paliwa powyżej 8000 obr./min.',
            nextText: 'Jeśli zasilanie i wydech są sprawne → przejdź do KROKU 3 (Kontrola poślizgu sprzęgła i oporów toczenia).',
            causes: 'Przytkany filtr pompy paliwa w zbiorniku, pęknięta membrana podciśnieniowa w gaźniku CV, zapieczony zawór wydechowy EXUP.',
            repair: 'Wyczyść filtr i pompę paliwa, wymień uszkodzoną membranę gaźnika lub wyreguluj linki zaworu wydechowego.',
            passNext: 'step_3',
            failNext: 'step_3'
          },
          step_3: {
            title: 'KROK 3: Weryfikacja sprzęgła wielotarczowego i układu przeniesienia napędu',
            check: `Brak poślizgu sprzęgła pod obciążeniem (grubość tarcz: ${getParamText(ctx, 'clutchPlateThickness', 'Wg DTR')}, sprężyny: ${getParamText(ctx, 'clutchSpringFreeLength', 'Wg DTR')}).`,
            how: 'Sprawdź luz na klamce sprzęgła (10–15 mm) oraz obserwuj podczas przyspieszania na 4.–5. biegu, czy wzrostowi obrotów towarzyszy proporcjonalny wzrost prędkości.',
            tool: 'Suwmiarka 0.02 mm, przymiar luzu klamki.',
            expected: 'Pewne przeniesienie momentu obrotowego w całym zakresie obrotów, brak oporów toczenia zacisków hamulcowych.',
            abnormal: 'Obroty rosną szybciej niż prędkość po przekroczeniu progu maksymalnego momentu obrotowego (ok. 8000–10000 obr./min).',
            nextText: 'Wymień pakiet tarcz ciernych i sprężyn sprzęgła.',
            causes: 'Zużyte tarcze cierne sprzęgła, osłabione sprężyny dociskowe, zastosowanie oleju samochodowego z modyfikatorami tarcia (brak normy JASO MA2!).',
            repair: 'Wymień tarcze i sprężyny sprzęgła oraz zalej olej motocyklowy spełniający normę JASO MA2.',
            passNext: 'step_1',
            failNext: 'step_1'
          }
        }
      },
      {
        id: 'wont_rev_up',
        number: 9,
        title: 'Silnik nie wkręca się na obroty',
        subtitle: 'Dławienie powyżej 6000–8000 obr./min, efekt „ściany” w średnich lub wysokich obrotach',
        icon: '🚫',
        steps: {
          step_1: {
            title: isCarb
              ? 'KROK 1: Kontrola membran podciśnieniowych (CV), dysz głównych i układu RAM-Air'
              : 'KROK 1: Kontrola ciśnienia paliwa, drugiego rzędu wtryskiwaczy (Secondary) i przepustnic STVA',
            check: isCarb
              ? 'Szczelność 3–4 membran podciśnieniowych przepustnic w gaźnikach CV oraz drożność przewodów wyrównawczych ciśnienia dynamicznego RAM-Air.'
              : `Ciśnienie paliwa (${fuelPressSpec}), praca górnych wtryskiwaczy (Secondary Injectors) oraz siłownika drugich przepustnic (STVA).`,
            how: isCarb
              ? 'Zdejmij airbox, uruchom silnik i obserwuj przy gwałtownym dodaniu gazu, czy wszystkie 3–4 tłoczki podciśnieniowe z iglicami unoszą się wysoko i synchronicznie.'
              : 'Sprawdź test wykonawczy górnych przepustnic (STVA) po włączeniu zapłonu oraz zmierz ciśnienie paliwa pod obciążeniem.',
            tool: 'Manometr paliwowy, endoskop / lusterko, multimetr.',
            expected: isCarb
              ? 'Wszystkie przepustnice podciśnieniowe unoszą się płynnie do pełnego otwarcia; przewody kompensacyjne RAM-Air podłączone do airboxu.'
              : 'Pełne otwarcie przepustnic STVA oraz stałe ciśnienie paliwa ' + fuelPressSpec + ' aż do odcinki.',
            abnormal: isCarb
              ? 'Tłoczek podciśnieniowy nie unosi się (pęknięta membrana) lub w modelach z doładowaniem dynamicznym (ZX-6R, CBR600F3/F4, YZF600R) odłączone są rurki RAM-Air (silnik dławi się powyżej 6000 rpm!).'
              : 'Spadek ciśnienia paliwa powyżej 7000 rpm lub błąd siłownika STVA (np. kod C28 w Suzuki GSX-R 600).',
            nextText: 'Jeśli układ paliwowy/dolotowy jest sprawny → przejdź do KROKU 2 (Układ zapłonowy i ładowanie na wysokich obrotach).',
            causes: isCarb
              ? 'Dziurawa membrana gaźnika CV, odłączone rurki wyrównawcze RAM-Air komór pływakowych, przytkany kranik/filtr paliwa.'
              : 'Zatkane sitko pompy paliwa, zimne luty w siłowniku STVA, brak zasilania drugiego rzędu wtryskiwaczy.',
            repair: isCarb
              ? 'Wymień pęknięte membrany podciśnieniowe, podłącz prawidłowo przewody RAM-Air do airboxu i udrożnij dopływ paliwa.'
              : 'Wymień filtr/pompę paliwa lub zregeneruj siłownik STVA i sprawdź wiązkę górnych wtryskiwaczy.',
            passNext: 'step_2',
            failNext: 'step_2'
          },
          step_2: {
            title: 'KROK 2: Weryfikacja zaniku iskry i napięcia ładowania w wysokich obrotach',
            check: `Napięcie w instalacji przy 5000–8000 obr./min (${chargeSpec}) oraz sygnał czujnika CKP (${ckpSpec}).`,
            how: 'Podłącz multimetr do akumulatora i obserwuj napięcie podczas wkręcania silnika w zakres, w którym pojawia się przerywanie.',
            tool: 'Multimetr cyfrowy TrueRMS, oscyloskop.',
            expected: `Stabilne napięcie ${chargeSpec} bez spadków poniżej 13.0 V i bez przepięć powyżej 15.0 V.`,
            abnormal: 'Gwałtowny spadek napięcia lub zakłócenia sygnału czujnika CKP przy wysokich częstotliwościach obrotowych.',
            nextText: 'Przejdź do KROKU 3 (Kontrola drożności układu wydechowego / zaworu EXUP).',
            causes: 'Przebicie w fajkocewce COP, obluzowana klema akumulatora (wibracje przy 8000 rpm rozłączają styk!), uszkodzony regulator napięcia.',
            repair: 'Dokręć klemy i punkty masowe, wymień wadliwe cewki/świece i napraw układ ładowania.',
            passNext: 'step_3',
            failNext: 'step_3'
          },
          step_3: {
            title: 'KROK 3: Kontrola zaworu wydechowego (EXUP / SET / H-TEV) i drożności katalizatora',
            check: 'Otwarcie przepustnicy w układzie wydechowym powyżej 6000–7000 obr./min.',
            how: 'Obserwuj ruch kółka linowego zaworu wydechowego przy przegazowaniu lub po włączeniu zapłonu (test samodiagnozy serwomechanizmu).',
            tool: 'Klucze regulacyjne do linek, multimetr.',
            expected: 'Płynny obrót zaworu o 90° przy wzroście obrotów, brak zacięć.',
            abnormal: 'Zawór stoi zablokowany w pozycji zamkniętej, dławiąc przepływ spalin na wysokich obrotach.',
            nextText: 'Oczyść oś zaworu wydechowego i ustaw luzy linek sterujących.',
            causes: 'Zapieczona tuleja zaworu wydechowego w kolektorze, zerwana linka lub uszkodzone koło zębate w serwomotorze EXUP.',
            repair: 'Oczyść i nasmaruj smarem miedziowym/ceramicznym tuleje zaworu wydechowego, wyreguluj linki lub napraw serwomotor.',
            passNext: 'step_1',
            failNext: 'step_1'
          }
        }
      },
      {
        id: 'high_fuel_consumption',
        number: 10,
        title: 'Występuje nadmierne zużycie paliwa',
        subtitle: 'Spalanie wyraźnie powyżej normy (>8–10 l/100 km w jeździe drogowej), czarne świece',
        icon: '⛽',
        steps: {
          step_1: {
            title: 'KROK 1: Kontrola filtra powietrza, ciśnienia w ogumieniu i oporów toczenia',
            check: 'Stan wkładu filtra powietrza w airboxie, swoboda obrotu kół (brak trzymających tłoczków zacisków hamulcowych) oraz stan napędu.',
            how: 'Zdejmij pokrywę airboxu i oceń wkład filtra powietrza; unieś koła na stojakach warsztatowych i sprawdź lekkość obrotu.',
            tool: 'Stojaki warsztatowe przód/tył, manometr do opon.',
            expected: 'Drożny filtr powietrza, koła obracają się swobodnie po puszczeniu hamulca.',
            abnormal: 'Zatkany olejem i kurzem filtr powietrza działa jak zaciągnięte ssanie, dramatycznie wzbogacając mieszankę!',
            nextText: 'Jeśli filtr powietrza i podwozie są w normie → przejdź do KROKU 2 (Układ paliwowy i czujniki).',
            causes: 'Brudny filtr powietrza, zapieczone tłoczki w zaciskach hamulcowych, zużyty łańcuch napędowy.',
            repair: 'Wymień filtr powietrza, zregeneruj zaciski hamulcowe i wyreguluj naciąg łańcucha.',
            passNext: 'step_2',
            failNext: 'step_2'
          },
          step_2: {
            title: isCarb
              ? 'KROK 2: Kontrola rurek emulsyjnych, iglic, poziomu pływaków i domykania ssania'
              : 'KROK 2: Kontrola regulatora ciśnienia paliwa (FPR), czujnika ECT, MAP i sondy Lambda (O₂)',
            check: isCarb
              ? `Stan rurek emulsyjnych (rozpylaczy), poziom pływaków (${getParamText(ctx, 'floatHeight', 'Wg DTR')}) oraz domykanie tłoczków ssania.`
              : `Ciśnienie paliwa (${fuelPressSpec}), rezystancja czujnika temperatury ECT oraz sygnał sondy Lambda i czujnika MAP.`,
            how: isCarb
              ? 'Sprawdź pod lupą otwory rurek emulsyjnych (wytarcie w owal przez iglicę!), sprawdź poziom paliwa w komorach i szczelność tłoczków ssania.'
              : 'Sprawdź czy z wężyka podciśnieniowego regulatora FPR nie sączy się paliwo oraz czy czujnik ECT pokazuje rzeczywistą temperaturę 80–90°C po rozgrzaniu.',
            tool: isCarb
              ? 'Lupa warsztatowa 10×, suwmiarka, analizator spalin CO.'
              : 'Multimetr cyfrowy, manometr ciśnienia paliwa, skaner diagnostyczny.',
            expected: isCarb
              ? 'Okrągłe otwory rurek emulsyjnych, prawidłowy poziom paliwa, zawartość CO na biegu jałowym w granicach 1.5–3.5%.'
              : 'Prawidłowe ciśnienie paliwa ' + fuelPressSpec + ', termistor ECT ~250–350 Ω w 80°C, sprawna pętla korekcji sondy O₂.',
            abnormal: isCarb
              ? 'Wyrobione w owal rurki emulsyjne lub zawyżony poziom paliwa powodujący przepał rzędu 9–11 l/100 km.'
              : 'Zawyżone ciśnienie paliwa, pęknięta membrana FPR lub zaniżony odczyt temperatury silnika (stała praca na wzbogaceniu rozruchowym).',
            nextText: 'Przejdź do KROKU 3 (Kontrola termostatu i temperatury roboczej silnika).',
            causes: isCarb
              ? 'Zużycie rurek emulsyjnych i iglic (bardzo częste w FZR600, YZF600R, Bandit 600, CBR600F), nieszczelne zaworki iglicowe.'
              : 'Uszkodzony regulator ciśnienia paliwa FPR, uszkodzony czujnik ECT lub sonda Lambda.',
            repair: isCarb
              ? 'Wymień rurki emulsyjne i iglice na nowe, ustaw poziom pływaków i wyreguluj skład mieszanki.'
              : 'Wymień regulator ciśnienia paliwa FPR / uszkodzony czujnik ECT.',
            passNext: 'step_3',
            failNext: 'step_3'
          },
          step_3: {
            title: 'KROK 3: Kontrola temperatury roboczej silnika i termostatu',
            check: `Temperatura otwarcia termostatu (${thermoSpec}) i utrzymywanie temperatury roboczej 80–90°C podczas jazdy.`,
            how: 'Obserwuj temperaturę płynu chłodniczego podczas jazdy poza miastem w chłodniejszy dzień.',
            tool: 'Termometr pokładowy / pirometr IR.',
            expected: 'Silnik szybko osiąga ~80–85°C i utrzymuje tę temperaturę w trasie.',
            abnormal: 'Temperatura w trasie spada do 55–65°C (zablokowany otwarty termostat) — w silnikach EFI sterownik utrzymuje wówczas wzbogaconą dawkę dla niedogrzanego silnika!',
            nextText: 'Wymień termostat i wykonaj synchronizację przepustnic.',
            causes: 'Termostat zablokowany w pozycji otwartej.',
            repair: 'Wymień termostat na nowy wraz z uszczelką i odpowietrz układ chłodzenia.',
            passNext: 'step_1',
            failNext: 'step_1'
          }
        }
      },
      {
        id: 'overheating',
        number: 11,
        title: 'Silnik się przegrzewa',
        subtitle: 'Temperatura powyżej 108–112°C, wyrzucanie płynu, brak chłodzenia',
        icon: '🌡️',
        steps: {
          step_1: {
            title: isLiquid
              ? 'KROK 1: Kontrola poziomu płynu w CHŁODNICY (nie tylko w zbiorniczku!) oraz korka ciśnieniowego'
              : 'KROK 1: Kontrola czystości użebrowania cylindrów, chłodnicy oleju oraz składu mieszanki',
            check: isLiquid
              ? `Poziom płynu pod korkiem chłodnicy, szczelność korka ciśnieniowego (1.1 bar) oraz załączanie wentylatora (${fanSpec}).`
              : 'Czystość żeberek chłodzących głowicy i bloku, drożność chłodnicy oleju oraz poziom oleju silnikowego.',
            how: isLiquid
              ? 'NA ZIMNYM SILNIKU odkręć korek bezpośrednio na chłodnicy i sprawdź czy płyn sięga pod samą szyjkę. Przetestuj korek chłodnicy pompką ciśnieniową.'
              : 'Sprawdź stan lameli chłodnicy oleju, poziom oleju oraz czy silnik nie pracuje na zbyt ubogiej mieszance (nieszczelne króćce ssące).',
            tool: isLiquid
              ? 'Tester ciśnieniowy korków i układu chłodzenia, multimetr.'
              : 'Pirometr IR, wakuometr, tester szczelności dolotu.',
            expected: isLiquid
              ? `Pełna chłodnica bez pęcherzy powietrza, korek utrzymuje 1.1 bar, wentylator startuje przy ${fanSpec}.`
              : 'Czyste ożebrowanie i chłodnica oleju, temperatura oleju w normie roboczej (80–115°C).',
            abnormal: isLiquid
              ? 'Brak płynu w chłodnicy (mimo pełnego zbiorniczka wyrównawczego!), nieszczelny korek lub niedziałający wentylator.'
              : 'Przegrzewanie głowicy spowodowane ubogą mieszanką (lewe powietrze) lub niskim stanem oleju.',
            nextText: 'Przejdź do KROKU 2 (Test termostatu, pompy wody i drożności chłodnicy).',
            causes: isLiquid
              ? 'Uszkodzony korek chłodnicy, przepalony bezpiecznik wentylatora (zablokowane śmigło kamykiem), uszkodzony termoswitch.'
              : 'Zbyt uboga mieszanka paliwowo-powietrzna, zaklejona błotem chłodnica oleju.',
            repair: isLiquid
              ? 'Wymień korek ciśnieniowy chłodnicy, uzupełnij i odpowietrz układ chłodzenia, napraw obwód wentylatora.'
              : 'Usuń nieszczelności dolotu, wzbogać mieszankę do wartości fabrycznej i wyczyść chłodnicę oleju.',
            passNext: 'step_2',
            failNext: 'step_2'
          },
          step_2: {
            title: 'KROK 2: Weryfikacja otwarcia termostatu, wirnika pompy wody i drożności chłodnicy',
            check: `Otwarcie termostatu (${thermoSpec}), obieg płynu wymuszany przez pompę wody oraz czystość rdzenia chłodnicy.`,
            how: 'Porównaj pirometrem temperaturę węża wejściowego i wyjściowego chłodnicy po przekroczeniu 85°C (oba muszą być gorące!). Sprawdź, czy lamele chłodnicy za przednim kołem nie są zalepione błotem.',
            tool: 'Pirometr IR, naczynie z termometrem do testu termostatu.',
            expected: `Pełne otwarcie termostatu przy ${thermoSpec}, równomiernie gorąca cała powierzchnia chłodnicy.`,
            abnormal: 'Silnik ma >100°C, a chłodnica lub dolny wąż pozostają chłodne (zablokowany zamknięty termostat lub uszkodzony wirnik pompy wody).',
            nextText: 'Jeśli obieg jest drożny, a płyn jest wyrzucany do zbiorniczka pod ciśnieniem → przejdź do KROKU 3 (Test CO₂ uszczelki pod głowicą).',
            causes: 'Zablokowany termostat, skorodowany/oberwany wirnik pompy wody, zabita owadami i błotem chłodnica.',
            repair: 'Wymień termostat, napraw pompę wody i dokładnie przemyj rdzeń chłodnicy od wewnątrz na zewnątrz.',
            passNext: 'step_3',
            failNext: 'step_3'
          },
          step_3: {
            title: 'KROK 3: Test obecności spalin (CO₂) w układzie chłodzenia — uszczelka pod głowicą (UPG)',
            check: 'Szczelność uszczelki pod głowicą oraz brak przedmuchu gazów spalinowych do płaszcza wodnego.',
            how: 'Zamontuj tester reakcyjny CO₂ w szyjce chłodnicy i uruchom silnik na 3–5 minut przy podwyższonych obrotach.',
            tool: 'Tester chemiczny CO₂ z płynem reakcyjnym, tester Leak Down.',
            expected: 'Płyn reakcyjny pozostaje niebieski (brak spalin w układzie chłodzenia); węże chłodnicy nie twardnieją na kamień zaraz po zimnym rozruchu.',
            abnormal: 'Zmiana barwy płynu testera na zielony/żółty oraz bąbelki gazu w chłodnicy podczas próby Leak Down.',
            nextText: 'W przypadku potwierdzenia obecności CO₂ zdemontuj głowicę.',
            causes: 'Przepalona uszczelka pod głowicą (UPG) lub odkształcenie płaszczyzny głowicy po wcześniejszym przegrzaniu.',
            repair: 'Zdemontuj głowicę, sprawdź jej szczelność i płaskość (planowanie), zamontuj nową uszczelkę MLS i nowe śruby głowicy dokręcone momentem z DTR.',
            passNext: 'step_1',
            failNext: 'step_1'
          }
        }
      },
      {
        id: 'abnormal_noise',
        number: 12,
        title: 'Występują nietypowe hałasy',
        subtitle: 'Lokalizacja akustyczna: rozrząd i napinacz CCT vs zawory vs kosz sprzęgła vs panewki',
        icon: '🔊',
        steps: {
          step_1: {
            title: 'KROK 1: Lokalizacja strefy hałasu (Góra głowicy vs Tunel łańcucha rozrządu CCT vs Kosz sprzęgła vs Dół karteru)',
            check: 'Charakterystyka dźwięku w funkcji obrotów, temperatury silnika oraz wciśnięcia klamki sprzęgła.',
            how: 'Osłuchaj silnik stetoskopem mechanika w 4 punktach: (1) pokrywa zaworów, (2) napinacz łańcucha rozrządu CCT, (3) prawy dekiel sprzęgła, (4) dolny karter na wysokości wału korbowego.',
            tool: 'Stetoskop warsztatowy z sondą igłową.',
            expected: 'Jednolity szum pracy mechanizmów bez metalicznego grzechotania przy schodzeniu z obrotów i bez głuchego łomotu pod obciążeniem.',
            abnormal: 'ROZPOZNANIE: (A) Metaliczne grzechotanie przy 3500–5500 rpm i przy odpuszczaniu gazu = Napinacz łańcucha rozrządu CCT (idź do KROKU 2). (B) Szum/klekot na luzie, który CICHNIE po wciśnięciu klamki sprzęgła = Kosz sprzęgłowy / brak synchronizacji (idź do KROKU 3). (C) Głuche, ciężkie stukanie rosnące z obrotami i po rozgrzaniu oleju = Panewka korbowodowa (idź do KROKU 4).',
            nextText: 'Przejdź do odpowiedniego kroku w zależności od zlokalizowanej strefy dźwięku.',
            causes: 'Osłabiona sprężyna napinacza CCT, rozsynchronizowane gaźniki/przepustnice wzbudzające kosz sprzęgła, zużyta panewka korbowodowa.',
            repair: 'Dokładna lokalizacja stetoskopem pozwala uniknąć niepotrzebnego rozbierania silnika.',
            passNext: 'step_2',
            failNext: 'step_2'
          },
          step_2: {
            title: 'KROK 2: Weryfikacja napinacza łańcucha rozrządu (CCT), ślizgów i luzów zaworowych',
            check: `Stopień wysunięcia napinacza CCT, napięcie łańcucha rozrządu oraz luzy zaworowe (IN: ${valveInSpec} | EX: ${valveExSpec}).`,
            how: 'Ustaw wał w GMP, zdemontuj napinacz CCT i sprawdź ile ząbków zapadki pozostało do końca zakresu oraz czy sprężyna skrętna napinacza nie pękła.',
            tool: 'Klucze nasadowe, wkrętak blokujący napinacz, szczelinomierz.',
            expected: 'Sprawny mechanizm samoregulacji napinacza, łańcuch napięty między kołami wałków rozrządu, nienaruszone okładziny ślizgów.',
            abnormal: 'Napinacz wysunięty do końca lub cofający się pod naciskiem palca (typowe dla CBR600F4/F4i, Hornet, FZ6, GSX-R, Daytona 675).',
            nextText: 'Jeśli rozrząd jest cichy, a hałas dochodzi z okolic sprzęgła → przejdź do KROKU 3.',
            causes: 'Pęknięta sprężyna napinacza automatycznego CCT lub wyciągnięty łańcuch rozrządu.',
            repair: 'Wymień napinacz łańcucha rozrządu CCT na nowy (lub zmodernizowany OEM) wraz z łańcuchem i uszczelką.',
            passNext: 'step_3',
            failNext: 'step_3'
          },
          step_3: {
            title: 'KROK 3: Weryfikacja hałasu kosza sprzęgłowego i wpływu synchronizacji 3–4 cylindrów',
            check: `Reakcja hałasu na wciśnięcie klamki sprzęgła oraz synchronizacja podciśnień (${syncSpec}).`,
            how: 'Na biegu jałowym wciśnij klamkę sprzęgła — jeśli grzechotanie z prawej strony silnika natychmiast ustaje, przyczyną jest luz na koszu sprzęgłowym wzbudzany przez nierówną pracę cylindrów na wolnych obrotach.',
            tool: 'Wakuometr 4-kanałowy, stetoskop.',
            expected: `Po dokładnej synchronizacji przepustnic/gaźników (${syncSpec}) hałas kosza sprzęgłowego wycisza się o 70–80%.`,
            abnormal: 'Głośne uderzenia kosza mimo idealnej synchronizacji lub chrobotanie pojawiające się dopiero PO wciśnięciu klamki (łożysko wyciskowe).',
            nextText: 'Jeśli hałas jest głębokim stukiem niezależnym od sprzęgła → przejdź do KROKU 4 (Diagnostyka panewek i nieszczelności wydechu).',
            causes: 'Brak synchronizacji gaźników/przepustnic, zużyte sprężyny tłumika drgań skrętnych w koszu sprzęgłowym, zużyte łożysko igiełkowe kosza.',
            repair: 'Wykonaj precyzyjną synchronizację cylindrów, a w razie zużycia mechanicznego wymień łożysko wyciskowe lub zregeneruj kosz sprzęgła.',
            passNext: 'step_4',
            failNext: 'step_4'
          },
          step_4: {
            title: 'KROK 4: Odróżnienie nieszczelnej uszczelki kolektora wydechowego od zatarcia panewki korbowodowej',
            check: `Szczelność miedzianych uszczelek kolektora wydechowego przy głowicy vs ciśnienie oleju (${getParamText(ctx, 'oilPressure', 'Wg DTR')}) i obecność opiłków w filtrze oleju.`,
            how: 'UWAGA WARSZTATOWA: Nieszczelna uszczelka kolektora wydechowego na jednym cylindrze potrafi brzmieć łudząco podobnie do metalicznego stukania zaworu/tłoka! Sprawdź najpierw dokręcenie flansz wydechu, a następnie zmierz ciśnienie oleju i rozetnij filtr oleju w poszukiwaniu złotych/srebrnych opiłków panewki.',
            tool: 'Manometr ciśnienia oleju, obcinak do puszek filtrów oleju, magnes neodymowy.',
            expected: 'Szczelne flansze kolektora wydechowego, czysty olej bez brokatu metalicznego, prawidłowe ciśnienie oleju.',
            abnormal: 'Złocisto-miedziany brokat w oleju i głuche stukanie przy 3000–4500 obr./min oznaczają obróconą lub wytartą panewkę korbowodową.',
            nextText: 'W przypadku opiłków panewki natychmiast wyłącz silnik, aby uratować czopy wału korbowego.',
            causes: 'Jazda ze zbyt niskim poziomem oleju (lub długie wheelie bez przegrody w misce olejowej), rozrzedzenie oleju benzyną, wydmuchana uszczelka kolektora.',
            repair: 'Jeśli to wydech: wymień miedziane pierścienie uszczelniające kolektora. Jeśli to panewka: rozpołów kartery, zweryfikuj wał korbowy, korbowody i pompę oleju.',
            passNext: 'step_1',
            failNext: 'step_1'
          }
        }
      }
    ];
  }

  // ============================================================================
  // 8. SCHEMATY TECHNICZNE SVG (7 AUTORSKICH, CZYTELNYCH SCHEMATÓW Z ZOOMEM)
  // ============================================================================
  const TECHNICAL_SCHEMATICS = [
    {
      id: 'sch_ignition',
      title: '1. Schemat zapłonu 3–4 Cyl.: Wasted Spark (1–4 / 2–3) oraz 4× COP + CKP/CMP',
      category: 'UKŁAD ZAPŁONOWY',
      description: 'Porównanie dwóch architektur zapłonu stosowanych w motocyklach 400–650 cm³: układ 2 cewek podwójnych (iskra tracona na parze 1–4 oraz 2–3) oraz układ 4 indywidualnych fajkocewek COP sterowanych sekwencyjnie przez ECU na podstawie czujników CKP i CMP.',
      checkpoints: [
        'Punkt P1: Zasilanie +12V po wyłączniku Kill Switch (wspólne dla wszystkich cewek — kolor zwykle B/W lub R/B).',
        'Punkt P2: Kluczowanie masą pierwotną z modułu TCI/ECU (Kanał A = Cyl 1+4, Kanał B = Cyl 2+3 lub indywidualnie COP 1..4).',
        'Punkt P3: Czujnik położenia wału CKP (rezystancja 100–550 Ω, napięcie szczytowe ≥ 1.5 V_peak).',
        'Punkt P4: Uzwojenie wtórne cewki podwójnej ( pomiar pomiędzy fajkami 1 i 4 lub 2 i 3: 10–25 kΩ + fajki 2×5 kΩ).'
      ],
      svg: `<svg viewBox="0 0 920 440" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#090d16;border-radius:12px;font-family:monospace">
        <defs>
          <linearGradient id="igGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        <rect x="10" y="10" width="900" height="420" rx="10" fill="url(#igGrad)" stroke="#334155" stroke-width="2"/>
        <text x="28" y="38" fill="#38bdf8" font-size="15" font-weight="bold">ARCHITEKTURA ZAPŁONU R4 / R3: WASTED SPARK (1-4 / 2-3) ORAZ SEKWENCYJNY COP</text>

        <!-- Akumulator i Kill Switch -->
        <rect x="28" y="60" width="150" height="90" rx="8" fill="#111827" stroke="#f59e0b" stroke-width="2"/>
        <text x="42" y="84" fill="#fbbf24" font-size="12" font-weight="bold">AKUMULATOR 12V</text>
        <text x="42" y="104" fill="#e2e8f0" font-size="11">Bezpiecznik IGN 10A/15A</text>
        <text x="42" y="124" fill="#10b981" font-size="11">Kill Switch [RUN]</text>
        <text x="42" y="140" fill="#94a3b8" font-size="10">Punkt P1: +12V zasilanie</text>

        <!-- Czujniki CKP / CMP -->
        <rect x="28" y="175" width="150" height="110" rx="8" fill="#111827" stroke="#38bdf8" stroke-width="2"/>
        <text x="40" y="198" fill="#38bdf8" font-size="12" font-weight="bold">CZUJNIKI WAŁU</text>
        <text x="40" y="218" fill="#e2e8f0" font-size="11">CKP (Pickup): 100-550 Ω</text>
        <text x="40" y="236" fill="#e2e8f0" font-size="11">V_peak ≥ 1.5V (rozruch)</text>
        <text x="40" y="256" fill="#a855f7" font-size="11">CMP (Wałek): Hall 5V</text>
        <text x="40" y="274" fill="#94a3b8" font-size="10">Punkt P3: Synchronizacja</text>

        <!-- Blokady bezpieczeństwa -->
        <rect x="28" y="305" width="150" height="105" rx="8" fill="#111827" stroke="#10b981" stroke-width="1.5"/>
        <text x="40" y="328" fill="#10b981" font-size="12" font-weight="bold">BLOKADY (INTERLOCK)</text>
        <text x="40" y="348" fill="#cbd5e1" font-size="11">• Stopka boczna</text>
        <text x="40" y="366" fill="#cbd5e1" font-size="11">• Czujnik luzu (N)</text>
        <text x="40" y="384" fill="#cbd5e1" font-size="11">• Czujnik Tip-Over</text>

        <!-- Moduł TCI / ECU -->
        <rect x="225" y="110" width="185" height="240" rx="10" fill="#1e1b4b" stroke="#a855f7" stroke-width="2.5"/>
        <text x="245" y="140" fill="#c084fc" font-size="14" font-weight="bold">MODUŁ TCI / ECU</text>
        <text x="245" y="165" fill="#e2e8f0" font-size="11">Pin +12V (po Kill Switch)</text>
        <text x="245" y="185" fill="#e2e8f0" font-size="11">Pin GND (Masa siłowa)</text>
        <text x="245" y="215" fill="#38bdf8" font-size="11">Wejście CKP+ / CKP-</text>
        <text x="245" y="235" fill="#38bdf8" font-size="11">Wejście CMP / TPS / MAP</text>
        <text x="245" y="268" fill="#f97316" font-size="11" font-weight="bold">Tranzystory kluczujące:</text>
        <text x="245" y="288" fill="#fdba74" font-size="11">• Wyjście IC1 (Cyl 1-4)</text>
        <text x="245" y="308" fill="#fdba74" font-size="11">• Wyjście IC2 (Cyl 2-3)</text>
        <text x="245" y="328" fill="#94a3b8" font-size="10">lub 4× COP (IC1..IC4)</text>

        <!-- Połączenia do ECU -->
        <path d="M178 95 L225 160" stroke="#f59e0b" stroke-width="2.5" fill="none"/>
        <path d="M178 220 L225 220" stroke="#38bdf8" stroke-width="2.5" fill="none"/>
        <path d="M178 350 L225 310" stroke="#10b981" stroke-width="2" fill="none"/>

        <!-- Sekcja Wasted Spark -->
        <rect x="460" y="55" width="430" height="175" rx="8" fill="#0f172a" stroke="#f97316" stroke-width="2"/>
        <text x="476" y="80" fill="#fb923c" font-size="13" font-weight="bold">WARIANT A: UKŁAD WASTED SPARK (2 CEWKI PODWÓJNE)</text>
        <rect x="480" y="95" width="175" height="62" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
        <text x="492" y="116" fill="#fde047" font-size="11" font-weight="bold">CEWKA NR 1 (SKRAJNE)</text>
        <text x="492" y="134" fill="#cbd5e1" font-size="10">Pierw: 2.0-4.0Ω | Wt: 12-22kΩ</text>
        <text x="492" y="149" fill="#38bdf8" font-size="11" font-weight="bold">→ ŚWIECA CYL 1 &amp; CYL 4</text>

        <rect x="685" y="95" width="185" height="62" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
        <text x="697" y="116" fill="#fde047" font-size="11" font-weight="bold">CEWKA NR 2 (ŚRODKOWE)</text>
        <text x="697" y="134" fill="#cbd5e1" font-size="10">Pierw: 2.0-4.0Ω | Wt: 12-22kΩ</text>
        <text x="697" y="149" fill="#10b981" font-size="11" font-weight="bold">→ ŚWIECA CYL 2 &amp; CYL 3</text>

        <text x="480" y="182" fill="#e2e8f0" font-size="11">• Kolejność zapłonu R4 (wał 180°): 1 – 2 – 4 – 3 (lub 1 – 3 – 4 – 2)</text>
        <text x="480" y="202" fill="#94a3b8" font-size="11">• Brak iskry na 1 i 4 jednocześnie = sprawdź Cewkę 1 lub przewód IC1 z modułu!</text>

        <!-- Sekcja COP -->
        <rect x="460" y="250" width="430" height="160" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
        <text x="476" y="275" fill="#38bdf8" font-size="13" font-weight="bold">WARIANT B: UKŁAD 3× / 4× COP (FAJKOCEWKI INDYWIDUALNE)</text>
        <rect x="480" y="292" width="90" height="65" rx="6" fill="#1e293b" stroke="#38bdf8"/>
        <text x="492" y="315" fill="#38bdf8" font-size="11" font-weight="bold">COP CYL 1</text>
        <text x="492" y="333" fill="#cbd5e1" font-size="10">0.8–1.8 Ω</text>
        <text x="492" y="348" fill="#fde047" font-size="10">Świeca #1</text>

        <rect x="582" y="292" width="90" height="65" rx="6" fill="#1e293b" stroke="#38bdf8"/>
        <text x="594" y="315" fill="#38bdf8" font-size="11" font-weight="bold">COP CYL 2</text>
        <text x="594" y="333" fill="#cbd5e1" font-size="10">0.8–1.8 Ω</text>
        <text x="594" y="348" fill="#fde047" font-size="10">Świeca #2</text>

        <rect x="684" y="292" width="90" height="65" rx="6" fill="#1e293b" stroke="#38bdf8"/>
        <text x="696" y="315" fill="#38bdf8" font-size="11" font-weight="bold">COP CYL 3</text>
        <text x="696" y="333" fill="#cbd5e1" font-size="10">0.8–1.8 Ω</text>
        <text x="696" y="348" fill="#fde047" font-size="10">Świeca #3</text>

        <rect x="786" y="292" width="90" height="65" rx="6" fill="#1e293b" stroke="#a855f7"/>
        <text x="798" y="315" fill="#c084fc" font-size="11" font-weight="bold">COP CYL 4</text>
        <text x="798" y="333" fill="#cbd5e1" font-size="10">(dla R4/V4)</text>
        <text x="798" y="348" fill="#fde047" font-size="10">Świeca #4</text>

        <text x="480" y="385" fill="#e2e8f0" font-size="11">• Test warsztatowy: Zamień COP miejscami między Cyl 1 a Cyl 2 i sprawdź czy błąd wędruje.</text>

        <path d="M410 278 L460 130" stroke="#f97316" stroke-width="2" fill="none"/>
        <path d="M410 315 L460 325" stroke="#38bdf8" stroke-width="2" fill="none"/>
      </svg>`
    },
    {
      id: 'sch_electrical',
      title: '2. Schemat elektryczny główny i układ ładowania 3-fazowego (Stojan – Regulator – Rozruch)',
      category: 'ELEKTRYKA I ŁADOWANIE',
      description: 'Obwód prądowy motocykla 3–4 cylindrowego: stojan 3-fazowy (3 żółte przewody Y1–Y2–Y3), regulator/prostownik (SCR lub MOSFET), główny bezpiecznik 30A na przekaźniku rozrusznika oraz dystrybucja zasilania.',
      checkpoints: [
        'Stojan 3-fazowy (piny Y1-Y2, Y2-Y3, Y1-Y3): rezystancja 0.2–0.9 Ω, napięcie jałowe ~65–80 V AC przy 5000 rpm, brak przejścia do masy (OL!).',
        'Wyjście regulatora napięcia (B+ / Masa): 14.0–14.8 V DC przy 5000 obr./min.',
        'Złącze 3-pinowe między stojanem a regulatorem: najczęstsze miejsce przegrzania i stopienia izolacji.',
        'Przekaźnik rozrusznika: bezpiecznik główny 30A oraz spadek napięcia podczas kręcenia (<0.5 V na styku roboczym).'
      ],
      svg: `<svg viewBox="0 0 920 420" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#090d16;border-radius:12px;font-family:monospace">
        <rect x="10" y="10" width="900" height="400" rx="10" fill="#0f172a" stroke="#a855f7" stroke-width="2"/>
        <text x="28" y="38" fill="#c084fc" font-size="15" font-weight="bold">OBWÓD ŁADOWANIA 3-FAZOWEGO I ROZRUCHU (STOJAN → REGULATOR → AKUMULATOR → ROZRUSZNIK)</text>

        <!-- Stojan -->
        <rect x="30" y="75" width="210" height="170" rx="8" fill="#1e293b" stroke="#facc15" stroke-width="2"/>
        <text x="45" y="102" fill="#fde047" font-size="13" font-weight="bold">ALTERNATOR (STOJAN 3~)</text>
        <text x="45" y="126" fill="#e2e8f0" font-size="11">Uzwojenie w gwiazdę (Y)</text>
        <text x="45" y="148" fill="#38bdf8" font-size="11">• R(Y1-Y2-Y3) = 0.2–0.9 Ω</text>
        <text x="45" y="168" fill="#10b981" font-size="11">• U_AC (5000 rpm) = 60–85V</text>
        <text x="45" y="190" fill="#f87171" font-size="11" font-weight="bold">• Izolacja do masy = OL (∞)!</text>
        <text x="45" y="216" fill="#94a3b8" font-size="10">3 przewody żółte (lub białe)</text>

        <!-- 3 przewody fazowe -->
        <line x1="240" y1="120" x2="330" y2="120" stroke="#facc15" stroke-width="3"/>
        <line x1="240" y1="155" x2="330" y2="155" stroke="#facc15" stroke-width="3"/>
        <line x1="240" y1="190" x2="330" y2="190" stroke="#facc15" stroke-width="3"/>
        <text x="255" y="112" fill="#fde047" font-size="10">Kostka 3-fazowa</text>

        <!-- Regulator napięcia -->
        <rect x="330" y="75" width="215" height="170" rx="8" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
        <text x="345" y="102" fill="#34d399" font-size="13" font-weight="bold">REGULATOR / PROSTOWNIK</text>
        <text x="345" y="126" fill="#e2e8f0" font-size="11">6 diod + klucze SCR / MOSFET</text>
        <text x="345" y="148" fill="#38bdf8" font-size="11">• Test diody: 0.45–0.65 V</text>
        <text x="345" y="170" fill="#10b981" font-size="11" font-weight="bold">• Wyjście: 14.0–14.8V DC</text>
        <text x="345" y="192" fill="#f97316" font-size="11">• Radiator chłodzony pędem</text>
        <text x="345" y="216" fill="#94a3b8" font-size="10">Wyjście: B+ (R/W) oraz GND (G)</text>

        <!-- Przekaźnik rozrusznika i bezpiecznik 30A -->
        <rect x="610" y="65" width="275" height="135" rx="8" fill="#1e293b" stroke="#f97316" stroke-width="2"/>
        <text x="625" y="92" fill="#fb923c" font-size="13" font-weight="bold">PRZEKAŹNIK ROZRUSZNIKA</text>
        <text x="625" y="114" fill="#fde047" font-size="11" font-weight="bold">[BEZPIECZNIK GŁÓWNY 30A]</text>
        <text x="625" y="136" fill="#e2e8f0" font-size="11">Styk prądowy: Akumulator →</text>
        <text x="625" y="154" fill="#e2e8f0" font-size="11">Rozrusznik (prąd 80–140 A)</text>
        <text x="625" y="176" fill="#94a3b8" font-size="10">Cewka: Przycisk START + sprzęgło/luz</text>

        <!-- Akumulator i Rozrusznik -->
        <rect x="610" y="235" width="130" height="145" rx="8" fill="#111827" stroke="#38bdf8" stroke-width="2"/>
        <text x="622" y="262" fill="#38bdf8" font-size="12" font-weight="bold">AKUMULATOR</text>
        <text x="622" y="284" fill="#e2e8f0" font-size="11">Spocz: ≥12.6V</text>
        <text x="622" y="304" fill="#e2e8f0" font-size="11">Rozruch: ≥10.0V</text>
        <text x="622" y="324" fill="#10b981" font-size="11">Upływ: &lt;2.5 mA</text>

        <rect x="755" y="235" width="130" height="145" rx="8" fill="#111827" stroke="#ec4899" stroke-width="2"/>
        <text x="767" y="262" fill="#f472b6" font-size="12" font-weight="bold">ROZRUSZNIK M</text>
        <text x="767" y="284" fill="#e2e8f0" font-size="11">Szczotki &gt;6.5mm</text>
        <text x="767" y="304" fill="#e2e8f0" font-size="11">Bendiks 1-kier.</text>
        <text x="767" y="324" fill="#fde047" font-size="11">Masa na karter</text>

        <!-- Skrzynka bezpieczników -->
        <rect x="30" y="275" width="515" height="105" rx="8" fill="#111827" stroke="#38bdf8" stroke-width="1.5"/>
        <text x="45" y="300" fill="#38bdf8" font-size="12" font-weight="bold">STACYJKA (IGNITION SWITCH) → SKRZYNKA BEZPIECZNIKÓW WTÓRNYCH:</text>
        <text x="45" y="324" fill="#e2e8f0" font-size="11">• IGNITION / FI (15A): ECU, cewki zapłonowe, przekaźnik pompy paliwa, wtryskiwacze</text>
        <text x="45" y="344" fill="#e2e8f0" font-size="11">• FAN (10A/15A): Wentylator chłodnicy  • HEADLIGHT (15A)  • SIGNAL / TURN (10A)</text>
        <text x="45" y="364" fill="#94a3b8" font-size="10">Wskazówka: Brak zasilania zegarów i rozrusznika = sprawdź czerwony wtyk 30A na przekaźniku rozrusznika!</text>

        <path d="M545 140 L610 120" stroke="#ef4444" stroke-width="3" fill="none"/>
        <path d="M675 200 L675 235" stroke="#ef4444" stroke-width="3" fill="none"/>
        <path d="M820 200 L820 235" stroke="#f97316" stroke-width="3" fill="none"/>
      </svg>`
    },
    {
      id: 'sch_sync',
      title: '3. Schemat zasilania i synchronizacji 3–4 gaźników / przepustnic (Pary 1–2 oraz 3–4)',
      category: 'UKŁAD PALIWOWY',
      description: 'Układ śrub równoważących podciśnienie w kolektorach ssących silnika 4-cylindrowego (śruba A wyrównuje Cyl 1–2, śruba B wyrównuje Cyl 3–4, śruba centralna C synchronizuje parę lewą z prawą) oraz silnika 3-cylindrowego.',
      checkpoints: [
        'Przed synchronizacją: luzy zaworowe w normie, silnik rozgrzany do 80–90°C, szczelne króćce dolotowe.',
        'Śruba lewa (A): wyrównaj podciśnienie pomiędzy Cylindrem 1 a Cylindrem 2.',
        'Śruba prawa (B): wyrównaj podciśnienie pomiędzy Cylindrem 3 a Cylindrem 4.',
        'Śruba centralna (C): wyrównaj parę lewą (1+2) względem pary prawej (3+4) do tolerancji Δ ≤ 10–15 mmHg (2 kPa).'
      ],
      svg: `<svg viewBox="0 0 920 420" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#090d16;border-radius:12px;font-family:monospace">
        <rect x="10" y="10" width="900" height="400" rx="10" fill="#0f172a" stroke="#10b981" stroke-width="2"/>
        <text x="28" y="38" fill="#34d399" font-size="15" font-weight="bold">SYNCHRONIZACJA 4 GARDZIELI (CYL 1–2–3–4) ORAZ 3 GARDZIELI (R3) — WAKUOMETR 4-KANAŁOWY</text>

        <!-- 4 Gardziele -->
        <g transform="translate(50,70)">
          <rect x="0" y="0" width="160" height="150" rx="10" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
          <text x="32" y="28" fill="#38bdf8" font-size="14" font-weight="bold">GARDZIEL #1</text>
          <circle cx="80" cy="78" r="34" fill="#090d16" stroke="#f59e0b" stroke-width="2"/>
          <line x1="48" y1="78" x2="112" y2="78" stroke="#f59e0b" stroke-width="4"/>
          <text x="20" y="135" fill="#cbd5e1" font-size="11">Króciec podciśn. V1</text>

          <rect x="210" y="0" width="160" height="150" rx="10" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
          <text x="242" y="28" fill="#38bdf8" font-size="14" font-weight="bold">GARDZIEL #2</text>
          <circle cx="290" cy="78" r="34" fill="#090d16" stroke="#f59e0b" stroke-width="2"/>
          <line x1="258" y1="78" x2="322" y2="78" stroke="#f59e0b" stroke-width="4"/>
          <text x="230" y="135" fill="#cbd5e1" font-size="11">Króciec podciśn. V2</text>

          <rect x="440" y="0" width="160" height="150" rx="10" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
          <text x="472" y="28" fill="#34d399" font-size="14" font-weight="bold">GARDZIEL #3</text>
          <circle cx="520" cy="78" r="34" fill="#090d16" stroke="#f59e0b" stroke-width="2"/>
          <line x1="488" y1="78" x2="552" y2="78" stroke="#f59e0b" stroke-width="4"/>
          <text x="460" y="135" fill="#cbd5e1" font-size="11">Króciec podciśn. V3</text>

          <rect x="650" y="0" width="160" height="150" rx="10" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
          <text x="682" y="28" fill="#34d399" font-size="14" font-weight="bold">GARDZIEL #4</text>
          <circle cx="730" cy="78" r="34" fill="#090d16" stroke="#f59e0b" stroke-width="2"/>
          <line x1="698" y1="78" x2="762" y2="78" stroke="#f59e0b" stroke-width="4"/>
          <text x="670" y="135" fill="#cbd5e1" font-size="11">Króciec podciśn. V4</text>

          <!-- Śruby synchronizacji -->
          <circle cx="185" cy="78" r="18" fill="#7c2d12" stroke="#f97316" stroke-width="2.5"/>
          <text x="179" y="83" fill="#fff" font-size="13" font-weight="bold">A</text>
          <text x="148" y="114" fill="#fdba74" font-size="10">Śruba 1↔2</text>

          <circle cx="405" cy="78" r="21" fill="#4c1d95" stroke="#c084fc" stroke-width="2.5"/>
          <text x="399" y="83" fill="#fff" font-size="13" font-weight="bold">C</text>
          <text x="360" y="114" fill="#e9d5ff" font-size="10">CENTRALNA (1+2)↔(3+4)</text>

          <circle cx="625" cy="78" r="18" fill="#7c2d12" stroke="#f97316" stroke-width="2.5"/>
          <text x="619" y="83" fill="#fff" font-size="13" font-weight="bold">B</text>
          <text x="588" y="114" fill="#fdba74" font-size="10">Śruba 3↔4</text>
        </g>

        <!-- Wakuometr 4-kanałowy -->
        <rect x="50" y="255" width="810" height="135" rx="8" fill="#111827" stroke="#38bdf8" stroke-width="1.5"/>
        <text x="70" y="282" fill="#fde047" font-size="13" font-weight="bold">KOLEJNOŚĆ REGULACJI WAKUOMETREM (SILNIK ROZGRZANY 85°C, BIEG JAŁOWY 1200–1300 RPM):</text>
        <text x="70" y="306" fill="#e2e8f0" font-size="11">1. Śrubą [A] zrównaj słupek podciśnienia Cylindra 1 z Cylindrem 2 (przegazuj delikatnie po korekcie).</text>
        <text x="70" y="328" fill="#e2e8f0" font-size="11">2. Śrubą [B] zrównaj słupek podciśnienia Cylindra 3 z Cylindrem 4 (przegazuj delikatnie po korekcie).</text>
        <text x="70" y="350" fill="#e2e8f0" font-size="11">3. Śrubą centralną [C] zrównaj obie pary (1+2 oraz 3+4) na jedną linię (dopuszczalny rozrzut Δ ≤ 15 mmHg / 2 kPa).</text>
        <text x="70" y="372" fill="#34d399" font-size="11">4. Po odłączeniu wakuometru załóż szczelne gumowe kapturki na króćce pomiarowe V1..V4 i skoryguj obroty jałowe.</text>
      </svg>`
    },
    {
      id: 'sch_cooling',
      title: '4. Schemat układu chłodzenia cieczą (Mały obieg, Termostat, Chłodnica, Korek 1.1 bar)',
      category: 'UKŁAD CHŁODZENIA',
      description: 'Obieg cieczy chłodzącej w silniku 3–4 cylindrowym: pompa wody wymuszająca przepływ przez płaszcz cylindrów i głowicę 16V, termostat otwierający duży obieg przy 80–84°C, korek ciśnieniowy 1.1 bar ze zbiorniczkiem wyrównawczym oraz wymiennik ciepła woda–olej.',
      checkpoints: [
        'Mały obieg (<80°C): termostat zamknięty, płyn krąży między głowicą a pompą wody i chłodniczką oleju.',
        'Duży obieg (>82°C): termostat otwiera przepływ na górny króciec chłodnicy głównej (pełny skok zaworu >8 mm przy 95°C).',
        'Korek chłodnicy (1.1 bar / 108 kPa): zawór nadciśnieniowy wypuszcza nadmiar do zbiorniczka, a podciśnieniowy zasysa płyn przy stygnięciu.',
        'Wentylator chłodnicy: załączany przez ECU (czujnik ECT) lub wyłącznik termiczny przy 100–105°C.'
      ],
      svg: `<svg viewBox="0 0 920 400" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#090d16;border-radius:12px;font-family:monospace">
        <rect x="10" y="10" width="900" height="380" rx="10" fill="#0f172a" stroke="#06b6d4" stroke-width="2"/>
        <text x="28" y="38" fill="#22d3ee" font-size="15" font-weight="bold">SCHEMAT OBIEGU CHŁODZENIA CIECZĄ SILNIKA R3 / R4 (MAŁY I DUŻY OBIEG)</text>

        <!-- Blok i głowica -->
        <rect x="40" y="75" width="235" height="200" rx="10" fill="#1e293b" stroke="#f97316" stroke-width="2"/>
        <text x="58" y="102" fill="#fb923c" font-size="13" font-weight="bold">GŁOWICA 16V &amp; CYLINDRY</text>
        <text x="58" y="128" fill="#e2e8f0" font-size="11">• Płaszcz wodny wokół 4 tulei</text>
        <text x="58" y="150" fill="#e2e8f0" font-size="11">• Kanały wokół gniazd wydech.</text>
        <text x="58" y="172" fill="#fde047" font-size="11">• Czujnik ECT (NTC): 2.5kΩ@20°C</text>
        <text x="58" y="194" fill="#38bdf8" font-size="11">• Wymiennik woda-olej (pod filtrem)</text>
        <text x="58" y="245" fill="#94a3b8" font-size="10">Pompa wody (dolny karter)</text>

        <!-- Termostat -->
        <rect x="335" y="75" width="205" height="110" rx="8" fill="#1e293b" stroke="#facc15" stroke-width="2"/>
        <text x="350" y="100" fill="#fde047" font-size="13" font-weight="bold">OBUDOWA TERMOSTATU</text>
        <text x="350" y="122" fill="#e2e8f0" font-size="11">Początek otwarcia: 80–84°C</text>
        <text x="350" y="142" fill="#e2e8f0" font-size="11">Pełny skok (&gt;8mm): 95°C</text>
        <text x="350" y="164" fill="#38bdf8" font-size="10">Odpowietrznik w najwyższym pkt.</text>

        <!-- Chłodnica i wentylator -->
        <rect x="605" y="75" width="275" height="200" rx="10" fill="#1e293b" stroke="#06b6d4" stroke-width="2.5"/>
        <text x="625" y="102" fill="#22d3ee" font-size="13" font-weight="bold">CHŁODNICA ALUMINIOWA</text>
        <text x="625" y="126" fill="#fde047" font-size="11" font-weight="bold">Korek ciśnieniowy: 1.1 bar (108 kPa)</text>
        <text x="625" y="148" fill="#e2e8f0" font-size="11">• Wentylator: START 100–105°C</text>
        <text x="625" y="170" fill="#e2e8f0" font-size="11">• STOP wentylatora: ~95–98°C</text>
        <text x="625" y="194" fill="#10b981" font-size="11">• Zbiorniczek wyrównawczy (LOW/FULL)</text>
        <text x="625" y="245" fill="#94a3b8" font-size="10">Powrót schłodzonej cieczy do pompy</text>

        <!-- Rury przepływu -->
        <path d="M275 115 L335 115" stroke="#ef4444" stroke-width="4" fill="none"/>
        <path d="M540 115 L605 115" stroke="#ef4444" stroke-width="4" fill="none"/>
        <path d="M605 240 L275 240" stroke="#38bdf8" stroke-width="4" fill="none"/>
        <path d="M435 185 L435 240" stroke="#f59e0b" stroke-width="3" stroke-dasharray="6,4" fill="none"/>
        <text x="350" y="220" fill="#fbbf24" font-size="10">Mały obieg (By-pass &lt;80°C)</text>

        <rect x="40" y="300" width="840" height="68" rx="8" fill="#111827" stroke="#334155"/>
        <text x="58" y="325" fill="#f87171" font-size="12" font-weight="bold">DIAGNOSTYKA PRZEGRZEWANIA:</text>
        <text x="58" y="348" fill="#cbd5e1" font-size="11">Gorący silnik + zimna chłodnica = zablokowany termostat lub brak obiegu pompy wody. Bąbelki i wyrzucanie płynu = korek 1.1 bar lub UPG (test CO₂).</text>
      </svg>`
    },
    {
      id: 'sch_valvetrain',
      title: '5. Schemat rozrządu DOHC 16V / 12V i regulacji płytkowej (Shim under Bucket)',
      category: 'DIAGNOSTYKA MECHANICZNA',
      description: 'Przekrój głowicy DOHC z płytkami regulacyjnymi umieszczonymi pod szklankami popychaczy (lub nad szklankami w wybranych starszych generacjach), napinaczem łańcucha rozrządu CCT oraz wzorem doboru nowej płytki.',
      checkpoints: [
        'Pomiar luzu szczelinomierzem wykonuj WYŁĄCZNIE na zimnym silniku (<35°C) przy krzywce skierowanej przeciwnie do szklanki.',
        'Wzór na nową płytkę: Nowa_płytka = Stara_płytka + (Luz_zmierzony − Luz_docelowy).',
        'Przykład: Luz zmierzony = 0.10 mm (za ciasno!), cel = 0.18 mm, stara płytka = 1.90 mm → Nowa = 1.90 + (0.10 − 0.18) = 1.82 mm (zakładamy cieńszą płytkę!).',
        'Przed wyjęciem wałków rozrządu zawsze zablokuj lub zdemontuj napinacz CCT i podwójnie sprawdź znaki IN / EX oraz T na wale.'
      ],
      svg: `<svg viewBox="0 0 920 400" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#090d16;border-radius:12px;font-family:monospace">
        <rect x="10" y="10" width="900" height="380" rx="10" fill="#0f172a" stroke="#f97316" stroke-width="2"/>
        <text x="28" y="38" fill="#fb923c" font-size="15" font-weight="bold">ROZRZĄD DOHC 16V / 12V — POMIAR LUZÓW ZAWOROWYCH I DOBÓR PŁYTEK (SHIM UNDER BUCKET)</text>

        <!-- Schemat wałków i łańcucha -->
        <rect x="35" y="65" width="410" height="295" rx="8" fill="#111827" stroke="#334155" stroke-width="1.5"/>
        <circle cx="145" cy="145" r="42" fill="#1e293b" stroke="#38bdf8" stroke-width="3"/>
        <text x="115" y="150" fill="#38bdf8" font-size="12" font-weight="bold">WAŁEK IN</text>
        <circle cx="325" cy="145" r="42" fill="#1e293b" stroke="#f97316" stroke-width="3"/>
        <text x="295" y="150" fill="#fb923c" font-size="12" font-weight="bold">WAŁEK EX</text>
        <line x1="103" y1="145" x2="367" y2="145" stroke="#10b981" stroke-width="2" stroke-dasharray="5,5"/>
        <text x="155" y="90" fill="#34d399" font-size="11">Znaki IN — EX równolegle do głowicy</text>

        <!-- Szklanka i płytka -->
        <rect x="115" y="210" width="60" height="36" rx="4" fill="#334155" stroke="#cbd5e1" stroke-width="2"/>
        <text x="122" y="232" fill="#fff" font-size="10">Szklanka</text>
        <rect x="130" y="246" width="30" height="12" fill="#facc15" stroke="#ca8a04"/>
        <text x="182" y="256" fill="#fde047" font-size="11" font-weight="bold">← Płytka (np. 1.85 mm)</text>
        <text x="65" y="202" fill="#38bdf8" font-size="11" font-weight="bold">Luz szczelinomierzem</text>

        <text x="55" y="295" fill="#e2e8f0" font-size="11">• Napinacz CCT naciska tylny ślizg łańcucha</text>
        <text x="55" y="318" fill="#f87171" font-size="11">• Zawory osiadając w gniazdach ZMNIEJSZAJĄ luz!</text>
        <text x="55" y="340" fill="#cbd5e1" font-size="11">• Zbyt mały luz = podparty i wypalony zawór</text>

        <!-- Wzór i instrukcja po prawej -->
        <rect x="470" y="65" width="415" height="295" rx="8" fill="#1e1b4b" stroke="#a855f7" stroke-width="2"/>
        <text x="490" y="95" fill="#c084fc" font-size="14" font-weight="bold">ALGORYTM DOBORU PŁYTKI ZAWOROWEJ:</text>
        <rect x="490" y="112" width="375" height="52" rx="6" fill="#090d16" stroke="#fde047" stroke-width="1.5"/>
        <text x="505" y="143" fill="#fde047" font-size="14" font-weight="bold">NOWA = STARA + (ZMIERZONY − CEL)</text>

        <text x="490" y="192" fill="#e2e8f0" font-size="11">PRZYKŁAD WARSZTATOWY (ZAWÓR WYDECHOWY):</text>
        <text x="490" y="214" fill="#cbd5e1" font-size="11">• Wymagany luz (Cel): 0.22 – 0.31 mm (środek: 0.26 mm)</text>
        <text x="490" y="234" fill="#f87171" font-size="11">• Luz zmierzony na zimno: 0.14 mm (ZA CIASNO o 0.12 mm)</text>
        <text x="490" y="254" fill="#cbd5e1" font-size="11">• Wyjęta stara płytka (mikrometr): 1.95 mm</text>
        <text x="490" y="280" fill="#34d399" font-size="12" font-weight="bold">• Obliczenie: 1.95 + (0.14 − 0.26) = 1.83 → Płytka 1.825 / 1.85</text>
        <text x="490" y="315" fill="#38bdf8" font-size="11">Wskazówka: Po zamontowaniu wałków obróć wałem korbowym</text>
        <text x="490" y="335" fill="#38bdf8" font-size="11">o 4 pełne obroty i zmierz luzy ponownie przed zamknięciem pokrywy!</text>
      </svg>`
    },
    {
      id: 'sch_cv_carb',
      title: '6. Schemat budowy gaźnika podciśnieniowego CV (Keihin / Mikuni) i obwodów dawkowania',
      category: 'UKŁAD PALIWOWY',
      description: 'Trzy zakresy pracy gaźnika podciśnieniowego CV (Constant Velocity): obwód wolnych obrotów (0–1/4 gazu: dysza jałowa + śruba składu mieszanki), zakres średni (1/4–3/4 gazu: membrana CV + iglica + rurka emulsyjna) oraz pełne obciążenie (3/4–4/4: dysza główna).',
      checkpoints: [
        'Zakres 0–25% otwarcia przepustnicy: decyduje dysza wolnych obrotów (Pilot Jet #35–#42) oraz śruba składu mieszanki (Pilot Screw).',
        'Zakres 25–75% otwarcia przepustnicy: decyduje szczelność membrany podciśnieniowej, profil iglicy oraz otwór rurki emulsyjnej.',
        'Zakres 75–100% otwarcia przepustnicy (WOT): decyduje rozmiar dyszy głównej (Main Jet) oraz poziom paliwa w komorze pływakowej.',
        'Komora pływakowa: zaworek iglicowy z amortyzowanym trzpieniem i O-ring gniazda mosiężnego.'
      ],
      svg: `<svg viewBox="0 0 920 400" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#090d16;border-radius:12px;font-family:monospace">
        <rect x="10" y="10" width="900" height="380" rx="10" fill="#0f172a" stroke="#f59e0b" stroke-width="2"/>
        <text x="28" y="38" fill="#fbbf24" font-size="15" font-weight="bold">BUDOWA I DIAGNOSTYKA GAŹNIKA PODCIŚNIENIOWEGO CV (KEIHIN CVK/VP • MIKUNI BDSR/BST)</text>

        <rect x="35" y="65" width="270" height="295" rx="8" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
        <text x="52" y="94" fill="#38bdf8" font-size="13" font-weight="bold">1. BIEG JAŁOWY (0 – 1/4 GAZU)</text>
        <text x="52" y="120" fill="#e2e8f0" font-size="11">• Dysza wolnych obr. (Pilot Jet)</text>
        <text x="52" y="142" fill="#e2e8f0" font-size="11">• Śruba składu mieszanki (O-ring!)</text>
        <text x="52" y="164" fill="#e2e8f0" font-size="11">• Otwory przejściowe (By-pass)</text>
        <text x="52" y="186" fill="#e2e8f0" font-size="11">• Tłoczek ssania (Enrichener)</text>
        <text x="52" y="225" fill="#f87171" font-size="11" font-weight="bold">Objawy usterki:</text>
        <text x="52" y="247" fill="#cbd5e1" font-size="10">Zimny kolektor na wolnych obrotach,</text>
        <text x="52" y="265" fill="#cbd5e1" font-size="10">konieczność jazdy na ssaniu, strzały</text>
        <text x="52" y="283" fill="#cbd5e1" font-size="10">w wydech przy schodzeniu z obrotów.</text>

        <rect x="325" y="65" width="270" height="295" rx="8" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
        <text x="342" y="94" fill="#34d399" font-size="13" font-weight="bold">2. ŚREDNIE OBROTY (1/4 – 3/4)</text>
        <text x="342" y="120" fill="#e2e8f0" font-size="11">• Membrana podciśnieniowa CV</text>
        <text x="342" y="142" fill="#e2e8f0" font-size="11">• Iglica + zapinka wysokości</text>
        <text x="342" y="164" fill="#e2e8f0" font-size="11">• Rurka emulsyjna (rozpylacz)</text>
        <text x="342" y="186" fill="#e2e8f0" font-size="11">• Dysza powietrza głównego</text>
        <text x="342" y="225" fill="#f87171" font-size="11" font-weight="bold">Objawy usterki:</text>
        <text x="342" y="247" fill="#cbd5e1" font-size="10">Dziura w przyspieszeniu 4000–7000 rpm</text>
        <text x="342" y="265" fill="#cbd5e1" font-size="10">(pęknięta membrana) lub nadmierne</text>
        <text x="342" y="283" fill="#cbd5e1" font-size="10">spalanie (wyrobiona rurka emulsyjna).</text>

        <rect x="615" y="65" width="270" height="295" rx="8" fill="#1e293b" stroke="#f97316" stroke-width="2"/>
        <text x="632" y="94" fill="#fb923c" font-size="13" font-weight="bold">3. PEŁNA MOC (3/4 – 4/4 WOT)</text>
        <text x="632" y="120" fill="#e2e8f0" font-size="11">• Dysza główna (Main Jet)</text>
        <text x="632" y="142" fill="#e2e8f0" font-size="11">• Poziom paliwa / wysokość pływaka</text>
        <text x="632" y="164" fill="#e2e8f0" font-size="11">• Zaworek iglicowy + sitko</text>
        <text x="632" y="186" fill="#e2e8f0" font-size="11">• Kompensacja ciśnienia RAM-Air</text>
        <text x="632" y="225" fill="#f87171" font-size="11" font-weight="bold">Objawy usterki:</text>
        <text x="632" y="247" fill="#cbd5e1" font-size="10">Dławienie przy pełnym gazie powyżej</text>
        <text x="632" y="265" fill="#cbd5e1" font-size="10">8000 rpm (zbyt niski poziom pływaka)</text>
        <text x="632" y="283" fill="#cbd5e1" font-size="10">lub zalewanie na postoju (zaworek).</text>
      </svg>`
    },
    {
      id: 'sch_efi',
      title: '7. Schemat układu wtryskowego EFI (Czujniki wejściowe → ECU → Elementy wykonawcze)',
      category: 'UKŁAD PALIWOWY',
      description: 'Kompletna pętla sterowania wtryskiem wielopunktowym EFI w motocyklach 3–4 cylindrowych (PGM-FI / DSFI / YCC-T / SDTV): pompa wysokiego ciśnienia 3.0–3.5 bar, wtryskiwacze Primary i Secondary, czujniki CKP, CMP, MAP/IAP, TPS, ECT, IAT, O₂ oraz Tip-Over.',
      checkpoints: [
        'Zasilanie czujników z ECU ( linia referencyjna V_ref): 5.0 V ± 0.1 V (wspólna dla TPS, MAP i czujników ciśnienia — zwarcie jednego czujnika kładzie całą linię 5V!).',
        'Pompa paliwa i regulator FPR: stałe ciśnienie 2.9–3.5 bar po włączeniu zapłonu i podczas pracy.',
        'Wtryskiwacze paliwa: stałe +12V po przekaźniku głównym, kluczowane masą przez ECU (rezystancja uzwojenia 11.5–14.5 Ω).',
        'Czujnik przechyłu (Tip-Over Sensor): w razie wykrycia kąta >60° odcina przekaźnik pompy paliwa, wtryskiwacze i cewki zapłonowe.'
      ],
      svg: `<svg viewBox="0 0 920 420" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#090d16;border-radius:12px;font-family:monospace">
        <rect x="10" y="10" width="900" height="400" rx="10" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
        <text x="28" y="38" fill="#38bdf8" font-size="15" font-weight="bold">ARCHITEKTURA UKŁADU WTRYSKOWEGO EFI (PGM-FI / SDTV / YCC-T / KEIHIN / DENSO / MIKUNI)</text>

        <!-- Czujniki wejściowe -->
        <rect x="28" y="65" width="265" height="320" rx="8" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
        <text x="45" y="92" fill="#38bdf8" font-size="13" font-weight="bold">CZUJNIKI WEJŚCIOWE (SENSORS)</text>
        <text x="45" y="118" fill="#fde047" font-size="11">• CKP (Wał korbowy) + CMP (Wałek)</text>
        <text x="45" y="142" fill="#e2e8f0" font-size="11">• TPS (Położenie przepustnicy 0.5-4.5V)</text>
        <text x="45" y="166" fill="#e2e8f0" font-size="11">• MAP / IAP (Podciśnienie w kolekt.)</text>
        <text x="45" y="190" fill="#e2e8f0" font-size="11">• ECT (Temp. płynu chłodniczego NTC)</text>
        <text x="45" y="214" fill="#e2e8f0" font-size="11">• IAT (Temp. powietrza w airboxie)</text>
        <text x="45" y="238" fill="#e2e8f0" font-size="11">• Sonda Lambda O₂ (korekta składu)</text>
        <text x="45" y="262" fill="#e2e8f0" font-size="11">• Czujnik biegu (GPS) + Prędkości (VSS)</text>
        <text x="45" y="286" fill="#f87171" font-size="11">• Tip-Over Sensor (Czujnik wywrotki)</text>
        <text x="45" y="325" fill="#34d399" font-size="10">Linia zasilania czujników z ECU: V_ref = 5.0V</text>
        <text x="45" y="345" fill="#94a3b8" font-size="10">Masa sygnałowa czujników: Sensor GND</text>

        <!-- Sterownik ECU -->
        <rect x="345" y="95" width="220" height="255" rx="10" fill="#1e1b4b" stroke="#a855f7" stroke-width="2.5"/>
        <text x="368" y="128" fill="#c084fc" font-size="14" font-weight="bold">STEROWNIK SILNIKA ECU</text>
        <text x="368" y="156" fill="#e2e8f0" font-size="11">Mapa dawki Bazowej:</text>
        <text x="368" y="176" fill="#cbd5e1" font-size="10">• Niskie obciążenia: RPM × MAP</text>
        <text x="368" y="194" fill="#cbd5e1" font-size="10">• Wysokie obciążenia: RPM × TPS</text>
        <text x="368" y="222" fill="#e2e8f0" font-size="11">Mapa kąta zapłonu 3D</text>
        <text x="368" y="246" fill="#fde047" font-size="11">Pamięć błędów DTC / FI</text>
        <text x="368" y="270" fill="#34d399" font-size="11">Immobilizer (HISS / KISS)</text>
        <text x="368" y="310" fill="#94a3b8" font-size="10">Złącze diagnostyczne Dealer/OBD</text>

        <!-- Elementy wykonawcze -->
        <rect x="615" y="65" width="275" height="320" rx="8" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
        <text x="632" y="92" fill="#34d399" font-size="13" font-weight="bold">ELEMENTY WYKONAWCZE (ACTUATORS)</text>
        <text x="632" y="118" fill="#fde047" font-size="11">• Przekaźnik i Pompa Paliwa (3.0-3.5 bar)</text>
        <text x="632" y="142" fill="#e2e8f0" font-size="11">• Wtryskiwacze Primary #1..#4 (12 Ω)</text>
        <text x="632" y="166" fill="#e2e8f0" font-size="11">• Wtryskiwacze Secondary (Supersport)</text>
        <text x="632" y="190" fill="#e2e8f0" font-size="11">• Fajkocewki COP #1..#4 / Cewki WN</text>
        <text x="632" y="214" fill="#e2e8f0" font-size="11">• Siłownik 2. przepustnic (STVA) / YCC-T</text>
        <text x="632" y="238" fill="#e2e8f0" font-size="11">• Zawór wolnych obrotów (IACV / ISC)</text>
        <text x="632" y="262" fill="#e2e8f0" font-size="11">• Zawór dopalania spalin PAIR / AIS</text>
        <text x="632" y="286" fill="#e2e8f0" font-size="11">• Serwomotor wydechu (EXUP/SET/H-TEV)</text>
        <text x="632" y="310" fill="#38bdf8" font-size="11">• Przekaźnik wentylatora chłodnicy</text>

        <path d="M293 215 L345 215" stroke="#38bdf8" stroke-width="3" fill="none"/>
        <path d="M565 215 L615 215" stroke="#10b981" stroke-width="3" fill="none"/>
      </svg>`
    }
  ];

  // ============================================================================
  // 6. DIAGNOSTYKA PORÓWNAWCZA KAŻDEGO CYLINDRA (R3: 1–3 | R4/V4: 1–4) + SHIM CALC
  // ============================================================================
  function createEmptyCylinderRecord(cylNum) {
    return {
      cyl: cylNum,
      compressionDry: '',
      compressionWet: '',
      leakDownPct: '',
      leakDownLocation: 'Brak / <8%',
      exhaustTempC: '',
      syncVacuum: '',
      sparkPlugState: 'Jasnobrązowa (OK)',
      sparkPresent: 'TAK (Silna niebieska)',
      injectorOrCarbTest: 'Prawidłowy (OK)',
      valveIntakeMm: '',
      valveExhaustMm: '',
      mechanicNotes: ''
    };
  }

  function getMeasurementSheetForModel(modelId, cylCount) {
    const all = loadJson(STORAGE_KEYS.MEASUREMENTS, {});
    const count = [1, 2, 3, 4, 6].includes(cylCount) ? cylCount : (cylCount === 3 ? 3 : 4);
    const existing = all[modelId];
    if (existing && Array.isArray(existing.cylinders) && existing.cylinders.length === count) {
      return existing;
    }
    const cylinders = [];
    for (let i = 1; i <= count; i++) {
      cylinders.push(createEmptyCylinderRecord(i));
    }
    return {
      modelId: modelId,
      updatedAt: null,
      mileageKm: '',
      engineTempC: '85',
      generalNotes: '',
      cylinders: cylinders
    };
  }

  function saveMeasurementSheetForModel(sheet) {
    const all = loadJson(STORAGE_KEYS.MEASUREMENTS, {});
    sheet.updatedAt = new Date().toISOString();
    all[sheet.modelId] = sheet;
    saveJson(STORAGE_KEYS.MEASUREMENTS, all);
  }

  function analyzeNumericRow(values, unit, maxAllowedSpread, minThreshold) {
    const nums = values
      .map((v, idx) => ({ cyl: idx + 1, val: parseFloat(String(v).replace(',', '.')) }))
      .filter(x => !isNaN(x.val) && isFinite(x.val));
    if (nums.length < 2) {
      return {
        ready: false,
        summary: 'Wprowadź pomiary dla co najmniej 2 cylindrów, aby obliczyć rozrzut Δ i odchylenia.',
        status: 'neutral',
        deviations: {}
      };
    }
    const rawVals = nums.map(x => x.val);
    const min = Math.min(...rawVals);
    const max = Math.max(...rawVals);
    const avg = rawVals.reduce((a, b) => a + b, 0) / rawVals.length;
    const spread = max - min;
    const spreadPct = max > 0 ? ((spread / max) * 100) : 0;

    const deviations = {};
    let hasWarning = false;
    nums.forEach(item => {
      const diffFromAvg = item.val - avg;
      const diffFromMax = max - item.val;
      let warn = false;
      if (maxAllowedSpread != null && diffFromMax > maxAllowedSpread) warn = true;
      if (minThreshold != null && item.val < minThreshold) warn = true;
      if (warn) hasWarning = true;
      deviations[item.cyl] = {
        val: item.val,
        diffAvg: (diffFromAvg >= 0 ? '+' : '') + diffFromAvg.toFixed(2),
        warn: warn
      };
    });
    if (maxAllowedSpread != null && spread > maxAllowedSpread) {
      hasWarning = true;
    }

    return {
      ready: true,
      min: min.toFixed(2),
      max: max.toFixed(2),
      avg: avg.toFixed(2),
      spread: spread.toFixed(2),
      spreadPct: spreadPct.toFixed(1),
      unit: unit,
      status: hasWarning ? 'warn' : 'ok',
      summary: `Średnia: ${avg.toFixed(2)} ${unit} • Min: ${min.toFixed(2)} ${unit} • Max: ${max.toFixed(2)} ${unit} • Rozrzut Δ: ${spread.toFixed(2)} ${unit} (${spreadPct.toFixed(1)}%)`,
      deviations: deviations
    };
  }

  function calculateShim(measuredStr, targetMinStr, targetMaxStr, currentShimStr) {
    const measured = parseFloat(String(measuredStr).replace(',', '.'));
    const tMin = parseFloat(String(targetMinStr).replace(',', '.'));
    const tMax = parseFloat(String(targetMaxStr).replace(',', '.'));
    const currentShim = parseFloat(String(currentShimStr).replace(',', '.'));
    if ([measured, tMin, tMax, currentShim].some(v => isNaN(v) || !isFinite(v)) || tMin <= 0 || tMax < tMin) {
      return { valid: false, message: 'Wprowadź poprawne wartości liczbowe (w mm).' };
    }
    const targetMid = (tMin + tMax) / 2;
    const inSpec = measured >= tMin && measured <= tMax;
    const exactNewShim = currentShim + (measured - targetMid);
    const rounded025 = Math.round(exactNewShim * 40) / 40; // skok co 0.025 mm
    const rounded050 = Math.round(exactNewShim * 20) / 20; // skok co 0.05 mm
    const resultingClearance = measured + (currentShim - rounded050);

    return {
      valid: true,
      inSpec: inSpec,
      targetMid: targetMid.toFixed(3),
      exactNewShim: exactNewShim.toFixed(3),
      rounded025: rounded025.toFixed(3),
      rounded050: rounded050.toFixed(2),
      resultingClearance: resultingClearance.toFixed(3),
      statusText: inSpec
        ? `Luz ${measured.toFixed(2)} mm mieści się w normie (${tMin.toFixed(2)}–${tMax.toFixed(2)} mm)`
        : measured < tMin
        ? `ZA MAŁY LUZ (zawór ciasny o ${(tMin - measured).toFixed(2)} mm) — zastosuj CIEŃSZĄ płytkę!`
        : `ZA DUŻY LUZ (zawór luźny o ${(measured - tMax).toFixed(2)} mm) — zastosuj GRUBSZĄ płytkę!`
    };
  }

  // ============================================================================
  // STYLE LOKALNE MODUŁU (ZACHOWUJĄCE IDENTYFIKACJĘ NAPRAWNIKA)
  // ============================================================================
  function renderModuleStyles() {
    return `<style>
      .mc-wrap { color:#f8fafc; padding-bottom:36px; }
      .mc-hero {
        background: linear-gradient(135deg, rgba(168,85,247,0.22) 0%, rgba(15,23,42,0.95) 50%, rgba(249,115,22,0.22) 100%);
        border: 1px solid rgba(168,85,247,0.45);
        box-shadow: 0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08);
        border-radius: 16px;
        padding: 18px;
        margin-bottom: 16px;
      }
      .mc-tabs {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 8px;
        margin-bottom: 16px;
      }
      .mc-tab-btn {
        background: rgba(15,23,42,0.9);
        border: 1px solid rgba(148,163,184,0.25);
        color: #cbd5e1;
        border-radius: 12px;
        padding: 11px 12px;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        text-align: left;
        transition: all 0.18s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .mc-tab-btn.active {
        background: linear-gradient(135deg, rgba(168,85,247,0.32), rgba(249,115,22,0.28));
        border-color: #f97316;
        color: #fff;
        box-shadow: 0 0 16px rgba(249,115,22,0.3);
      }
      .mc-card {
        background: rgba(15,23,42,0.92);
        border: 1px solid rgba(148,163,184,0.22);
        border-radius: 14px;
        padding: 16px;
        margin-bottom: 14px;
      }
      .mc-grid-models {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(265px, 1fr));
        gap: 10px;
        max-height: 410px;
        overflow-y: auto;
        padding-right: 4px;
      }
      .mc-model-item {
        background: rgba(9,13,22,0.88);
        border: 1px solid rgba(148,163,184,0.2);
        border-radius: 11px;
        padding: 11px 12px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .mc-model-item:hover {
        border-color: rgba(56,189,248,0.6);
      }
      .mc-model-item.selected {
        background: linear-gradient(135deg, rgba(168,85,247,0.24), rgba(249,115,22,0.18));
        border: 1.5px solid #f97316;
        box-shadow: 0 0 14px rgba(249,115,22,0.25);
      }
      .mc-badge {
        display: inline-block;
        padding: 2px 7px;
        border-radius: 99px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.3px;
      }
      .mc-input, .mc-select {
        width: 100%;
        background: #090d16;
        border: 1px solid rgba(148,163,184,0.32);
        color: #f8fafc;
        border-radius: 9px;
        padding: 8px 10px;
        font-size: 12px;
      }
      .mc-input:focus, .mc-select:focus {
        outline: none;
        border-color: #f97316;
      }
      .mc-cyl-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      .mc-cyl-table th, .mc-cyl-table td {
        border: 1px solid rgba(148,163,184,0.2);
        padding: 8px;
        vertical-align: top;
      }
      .mc-cyl-table th {
        background: rgba(30,41,59,0.9);
        color: #fde047;
        font-weight: 800;
        text-align: center;
      }
      .mc-8pt-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 10px;
        margin-top: 12px;
      }
      .mc-8pt-box {
        background: rgba(9,13,22,0.9);
        border: 1px solid rgba(148,163,184,0.22);
        border-left: 4px solid #a855f7;
        border-radius: 10px;
        padding: 11px 13px;
      }
      @media (max-width: 680px) {
        .mc-tabs { grid-template-columns: 1fr 1fr; }
        .mc-cyl-scroll { overflow-x: auto; }
      }
    </style>`;
  }

  function renderActiveModelBanner(ctx) {
    if (!ctx || !ctx.model) return '';
    const m = ctx.model;
    const e = ctx.engine || {};
    const fuelBadge = (m.fuelSystem || e.fuelSystem) === 'carb' ? 'GAŹNIKI' : 'WTRYSK EFI';
    const coolMap = { liquid: 'CIECZ', 'air-oil': 'POWIETRZE-OLEJ', air: 'POWIETRZE' };
    const coolBadge = coolMap[m.cooling || e.cooling] || 'CIECZ';
    return `
      <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;background:rgba(9,13,22,0.88);border:1px solid rgba(249,115,22,0.45);border-radius:12px;padding:11px 14px;margin-bottom:14px">
        <div>
          <div style="font-size:10px;color:#fb923c;font-weight:800;letter-spacing:0.6px">AKTYWNY MOTOCYKL DIAGNOSTYCZNY (HIERARCHIA: MARKA → MODEL → ROCZNIK → GENERACJA → KOD SILNIKA)</div>
          <div style="font-size:15px;font-weight:900;color:#fff;margin-top:2px">
            ${esc(m.brand)} ${esc(m.model)} <span style="color:#fde047">(${esc(m.years)})</span>
            <span style="color:#94a3b8;font-size:12px;font-weight:600">• Gen: ${esc(m.generation)} • Silnik: ${esc(m.engineCode)}</span>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <span class="mc-badge" style="background:rgba(168,85,247,0.25);color:#e9d5ff;border:1px solid #a855f7">${esc(m.displacementCc)} cm³</span>
          <span class="mc-badge" style="background:rgba(249,115,22,0.25);color:#fed7aa;border:1px solid #f97316">${esc(m.cylinders)} CYL • ${esc(m.layout)}</span>
          <span class="mc-badge" style="background:rgba(16,185,129,0.22);color:#a7f3d0;border:1px solid #10b981">${esc(fuelBadge)}</span>
          <span class="mc-badge" style="background:rgba(56,189,248,0.22);color:#bae6fd;border:1px solid #38bdf8">${esc(coolBadge)}</span>
          <span class="mc-badge" style="background:rgba(250,204,21,0.2);color:#fef08a;border:1px solid #facc15">${esc(e.valvetrain || 'DOHC')} • ${esc(e.valvesTotal || (m.cylinders * 4))}V</span>
        </div>
      </div>`;
  }

  // ============================================================================
  // ZAKŁADKA 1: KATALOG MOTOCYKLI 3–4 CYL. + BAZA PARAMETRÓW SERWISOWYCH
  // ============================================================================
  function renderTabKatalog(ctx) {
    const d = getData();
    const q = state.searchQuery.trim().toLowerCase();
    const filtered = d.MODELS.filter(m => {
      if (state.filterBrand !== 'ALL' && m.brand !== state.filterBrand) return false;
      if (state.filterCylinders !== 'ALL' && String(m.cylinders) !== state.filterCylinders) return false;
      if (state.filterLayout !== 'ALL' && m.layout !== state.filterLayout) return false;
      if (state.filterFuel !== 'ALL' && m.fuelSystem !== state.filterFuel) return false;
      if (state.filterCooling !== 'ALL' && m.cooling !== state.filterCooling) return false;
      if (state.filterDisplacement !== 'ALL') {
        const cc = m.displacementCc || 600;
        if (state.filterDisplacement === 'under500' && cc >= 500) return false;
        if (state.filterDisplacement === '500_650' && (cc < 500 || cc > 650)) return false;
        if (state.filterDisplacement === '650_800' && (cc < 650 || cc > 800)) return false;
        if (state.filterDisplacement === '800_1000' && (cc < 800 || cc > 1000)) return false;
        if (state.filterDisplacement === '1000_1300' && (cc < 1000 || cc > 1300)) return false;
        if (state.filterDisplacement === 'over1300' && cc <= 1300) return false;
      }
      if (!q) return true;
      const hay = `${m.brand} ${m.model} ${m.years} ${m.generation} ${m.engineCode} ${m.variant} ${m.displacementCc}`.toLowerCase();
      return hay.includes(q);
    });

    const m = ctx.model;
    const e = ctx.engine || {};
    const paramEntries = Object.entries(d.PARAM_KEYS || {});

    const modelCardsHtml = filtered.map(item => {
      const isSel = item.id === m.id;
      const fuelLbl = item.fuelSystem === 'carb' ? 'Gaźniki' : 'EFI';
      return `
        <div class="mc-model-item ${isSel ? 'selected' : ''}" onclick="window.NAPRAWNIK_MULTICYL.selectModel('${esc(item.id)}')">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
            <div style="font-weight:900;font-size:13px;color:#fff">${esc(item.brand)} ${esc(item.model)}</div>
            <span class="mc-badge" style="background:rgba(249,115,22,0.22);color:#fdba74;border:1px solid rgba(249,115,22,0.5)">${esc(item.displacementCc)} cc</span>
          </div>
          <div style="font-size:11px;color:#fde047;font-weight:700;margin-top:3px">
            Rocznik: ${esc(item.years)} • Gen: ${esc(item.generation)}
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:3px">
            Kod silnika: <strong style="color:#38bdf8">${esc(item.engineCode)}</strong>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">
            <span class="mc-badge" style="background:#1e293b;color:#e2e8f0">${esc(item.cylinders)} cyl (${esc(item.layout)})</span>
            <span class="mc-badge" style="background:#1e293b;color:#34d399">${esc(fuelLbl)}</span>
            <span class="mc-badge" style="background:#1e293b;color:#bae6fd">${esc(item.cooling)}</span>
          </div>
        </div>`;
    }).join('');

    const paramRowsHtml = paramEntries.map(([key, meta]) => {
      const p = (ctx.params || {})[key];
      const hasVal = p && p.value !== null && p.value !== undefined && p.value !== '';
      let badgeHtml = `<span class="mc-badge" style="background:rgba(239,68,68,0.2);color:#fca5a5;border:1px solid #ef4444">WYMAGA WERYFIKACJI W DTR OEM</span>`;
      if (hasVal) {
        if (p.confidence === 'A') {
          badgeHtml = `<span class="mc-badge" style="background:rgba(16,185,129,0.22);color:#6ee7b7;border:1px solid #10b981">POZIOM A • ZWERYFIKOWANE</span>`;
        } else if (p.confidence === 'B') {
          badgeHtml = `<span class="mc-badge" style="background:rgba(56,189,248,0.22);color:#7dd3fc;border:1px solid #38bdf8">POZIOM B • LITERATURA SERWISOWA</span>`;
        } else {
          badgeHtml = `<span class="mc-badge" style="background:rgba(250,204,21,0.22);color:#fde047;border:1px solid #facc15">POZIOM C • POTWIERDŹ DLA VIN</span>`;
        }
      }
      const valDisplay = hasVal
        ? `<strong style="color:#fff;font-size:13px">${esc(p.value)}</strong> <span style="color:#94a3b8">${esc(meta.unit)}</span>`
        : `<span style="color:#fca5a5;font-size:11px;font-style:italic">Niepotwierdzone dla tego wariantu — sprawdź w manualu OEM lub kliknij „Zapisz wartość warsztatową”</span>`;

      return `
        <tr>
          <td style="font-weight:700;color:#e2e8f0">${esc(meta.label)}</td>
          <td>${valDisplay}</td>
          <td>${badgeHtml}<div style="font-size:10px;color:#64748b;margin-top:2px">${esc(p && p.source ? p.source : 'Wymaga potwierdzenia wg numeru silnika/VIN')}</div></td>
          <td style="width:170px">
            <div style="display:flex;gap:4px">
              <input id="mc-param-in-${esc(key)}" class="mc-input" style="padding:5px 7px;font-size:11px" placeholder="Wartość (${esc(meta.unit || '-')})" value="${hasVal ? esc(p.value) : ''}">
              <button onclick="window.NAPRAWNIK_MULTICYL.saveCustomParam('${esc(key)}')" style="background:#10b981;color:#052e16;border:none;border-radius:7px;padding:5px 8px;font-size:11px;font-weight:900;cursor:pointer" title="Zapisz zweryfikowaną wartość warsztatową (Poziom A)">✓</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    const faultCardsHtml = ((m.faultIds && m.faultIds.length ? m.faultIds : e.faults) || []).map(fid => {
      const f = d.FAULTS[fid];
      if (!f) return '';
      return `
        <div style="background:rgba(9,13,22,0.85);border:1px solid rgba(249,115,22,0.35);border-radius:10px;padding:11px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <div style="font-weight:800;color:#fde047;font-size:13px">⚠️ ${esc(f.title)}</div>
            <span class="mc-badge" style="background:rgba(249,115,22,0.2);color:#fdba74">Dział ${esc(f.section)}</span>
          </div>
          <div style="font-size:11px;color:#cbd5e1;margin-top:5px"><strong>Objawy:</strong> ${esc(f.symptoms)}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:3px"><strong>Przyczyny:</strong> ${esc(f.causes)}</div>
          <div style="font-size:11px;color:#34d399;margin-top:4px"><strong>Weryfikacja i naprawa:</strong> ${esc(f.fix)}</div>
        </div>`;
    }).join('');

    return `
      <div class="mc-card">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
          <div>
            <div style="font-size:15px;font-weight:900;color:#fff">🔍 WYSZUKIWARKA I FILTRY KATALOGU MOTOCYKLI (1–4 CYL • 400 – >1300 cm³)</div>
            <div style="font-size:11px;color:#94a3b8">Szukaj po marce, modelu, pojemności (np. 650, 750, 800, 900, 1000, 1300), roczniku lub kodzie silnika (np. PC37E, SC57E, CP2, LC8, ShiftCam)</div>
          </div>
          <div style="font-size:12px;font-weight:800;color:#fde047">Znaleziono: ${filtered.length} / ${d.MODELS.length} modeli</div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:12px">
          <input id="mc-search-input" class="mc-input" placeholder="Szukaj modelu, rocznika, kodu silnika..." value="${esc(state.searchQuery)}" oninput="window.NAPRAWNIK_MULTICYL.setFilter('searchQuery', this.value)">
          <select class="mc-select" onchange="window.NAPRAWNIK_MULTICYL.setFilter('filterBrand', this.value)">
            <option value="ALL">Wszystkie marki (${d.MANUFACTURERS.length})</option>
            ${d.MANUFACTURERS.map(b => `<option value="${esc(b.name)}" ${state.filterBrand === b.name ? 'selected' : ''}>${esc(b.name)} (${esc(b.country)})</option>`).join('')}
          </select>
          <select class="mc-select" onchange="window.NAPRAWNIK_MULTICYL.setFilter('filterDisplacement', this.value)">
            <option value="ALL">Pojemność: Wszystkie</option>
            <option value="under500" ${state.filterDisplacement === 'under500' ? 'selected' : ''}>Do 500 cm³</option>
            <option value="500_650" ${state.filterDisplacement === '500_650' ? 'selected' : ''}>500–650 cm³</option>
            <option value="650_800" ${state.filterDisplacement === '650_800' ? 'selected' : ''}>650–800 cm³</option>
            <option value="800_1000" ${state.filterDisplacement === '800_1000' ? 'selected' : ''}>800–1000 cm³</option>
            <option value="1000_1300" ${state.filterDisplacement === '1000_1300' ? 'selected' : ''}>1000–1300 cm³</option>
            <option value="over1300" ${state.filterDisplacement === 'over1300' ? 'selected' : ''}>Powyżej 1300 cm³</option>
          </select>
          <select class="mc-select" onchange="window.NAPRAWNIK_MULTICYL.setFilter('filterCylinders', this.value)">
            <option value="ALL">Cylindry: Wszystkie (1–6)</option>
            <option value="1" ${state.filterCylinders === '1' ? 'selected' : ''}>1 cylinder</option>
            <option value="2" ${state.filterCylinders === '2' ? 'selected' : ''}>2 cylindry</option>
            <option value="3" ${state.filterCylinders === '3' ? 'selected' : ''}>3 cylindry</option>
            <option value="4" ${state.filterCylinders === '4' ? 'selected' : ''}>4 cylindry</option>
            <option value="6" ${state.filterCylinders === '6' ? 'selected' : ''}>6 cylindrów</option>
          </select>
          <select class="mc-select" onchange="window.NAPRAWNIK_MULTICYL.setFilter('filterLayout', this.value)">
            <option value="ALL">Układ: Wszystkie</option>
            <option value="Single" ${state.filterLayout === 'Single' ? 'selected' : ''}>1-cyl (Single)</option>
            <option value="R2" ${state.filterLayout === 'R2' ? 'selected' : ''}>Rzędowy R2</option>
            <option value="V2" ${state.filterLayout === 'V2' ? 'selected' : ''}>Widlasty V2</option>
            <option value="L2" ${state.filterLayout === 'L2' ? 'selected' : ''}>Widlasty L2 (Ducati)</option>
            <option value="Boxer" ${state.filterLayout === 'Boxer' ? 'selected' : ''}>Boxer B2</option>
            <option value="R3" ${state.filterLayout === 'R3' ? 'selected' : ''}>Rzędowy R3</option>
            <option value="R4" ${state.filterLayout === 'R4' ? 'selected' : ''}>Rzędowy R4</option>
            <option value="V4" ${state.filterLayout === 'V4' ? 'selected' : ''}>Widlasty V4</option>
          </select>
          <select class="mc-select" onchange="window.NAPRAWNIK_MULTICYL.setFilter('filterFuel', this.value)">
            <option value="ALL">Zasilanie: Gaźniki + EFI</option>
            <option value="carb" ${state.filterFuel === 'carb' ? 'selected' : ''}>Gaźniki (Carb)</option>
            <option value="efi" ${state.filterFuel === 'efi' ? 'selected' : ''}>Wtrysk paliwa (EFI)</option>
          </select>
          <select class="mc-select" onchange="window.NAPRAWNIK_MULTICYL.setFilter('filterCooling', this.value)">
            <option value="ALL">Chłodzenie: Wszystkie</option>
            <option value="liquid" ${state.filterCooling === 'liquid' ? 'selected' : ''}>Cieczą (Liquid)</option>
            <option value="air-oil" ${state.filterCooling === 'air-oil' ? 'selected' : ''}>Powietrze-olej (SACS)</option>
            <option value="air" ${state.filterCooling === 'air' ? 'selected' : ''}>Powietrzem (Air)</option>
          </select>
        </div>

        <div class="mc-grid-models">
          ${modelCardsHtml || `<div style="padding:18px;color:#fde047;background:rgba(250,204,21,0.08);border:1px solid rgba(250,204,21,0.35);border-radius:10px;grid-column:1/-1">
            <strong>Informacja katalogowa (${esc(state.filterBrand)}):</strong>
            ${esc(((d.MANUFACTURERS.find(x => x.name === state.filterBrand) || {}).note) || 'Brak modeli spełniających wybrane kryteria filtra.')}
            <div style="margin-top:6px;color:#cbd5e1;font-size:11px">Możesz dodać niestandardowy motocykl / projekt warsztatowy tej marki w formularzu „Rozszerz katalog” poniżej.</div>
          </div>`}
        </div>
      </div>

      <!-- SZCZEGÓŁOWA KARTA WYBRANEGO MODELU -->
      <div class="mc-card">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid rgba(148,163,184,0.2);padding-bottom:12px;margin-bottom:12px">
          <div>
            <div style="font-size:11px;color:#c084fc;font-weight:800">KARTA KATALOGOWA I DANE KONSTRUKCYJNE JEDNOSTKI NAPĘDOWEJ</div>
            <h3 style="margin:4px 0;font-size:18px;color:#fff">${esc(m.brand)} ${esc(m.model)} — ${esc(m.variant)}</h3>
            <div style="font-size:12px;color:#cbd5e1">
              Rocznik: <strong>${esc(m.years)}</strong> • Generacja/Rama: <strong>${esc(m.generation)}</strong> • Kod silnika: <strong style="color:#fde047">${esc(m.engineCode)}</strong>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button onclick="window.NAPRAWNIK_MULTICYL.setTab('drzewa')" style="background:linear-gradient(135deg,#a855f7,#f97316);color:#fff;border:none;border-radius:9px;padding:8px 13px;font-size:12px;font-weight:800;cursor:pointer">🌳 Uruchom drzewo diagnostyczne</button>
            <button onclick="window.NAPRAWNIK_MULTICYL.setTab('cylindry')" style="background:#0284c7;color:#fff;border:none;border-radius:9px;padding:8px 13px;font-size:12px;font-weight:800;cursor:pointer">📊 Pomiary ${esc(m.cylinders)} cylindrów</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-bottom:14px">
          <div style="background:#090d16;padding:9px 11px;border-radius:8px;border:1px solid rgba(148,163,184,0.18)">
            <div style="font-size:10px;color:#94a3b8">POJEMNOŚĆ / ŚREDNICA × SKOK</div>
            <div style="font-size:13px;font-weight:800;color:#fff">${esc(m.displacementCc)} cm³ (${esc(e.boreStroke || 'wg DTR')})</div>
          </div>
          <div style="background:#090d16;padding:9px 11px;border-radius:8px;border:1px solid rgba(148,163,184,0.18)">
            <div style="font-size:10px;color:#94a3b8">UKŁAD CYLINDRÓW / SUW</div>
            <div style="font-size:13px;font-weight:800;color:#fde047">${esc(m.cylinders)} cyl. • ${esc(m.layout)} (${esc(e.strokeType || '4T')})</div>
          </div>
          <div style="background:#090d16;padding:9px 11px;border-radius:8px;border:1px solid rgba(148,163,184,0.18)">
            <div style="font-size:10px;color:#94a3b8">UKŁAD ROZRZĄDU / ZAWORY</div>
            <div style="font-size:13px;font-weight:800;color:#38bdf8">${esc(e.valvetrain || 'DOHC')} • ${esc(e.valvesTotal || (m.cylinders * 4))} zaworów</div>
          </div>
          <div style="background:#090d16;padding:9px 11px;border-radius:8px;border:1px solid rgba(148,163,184,0.18)">
            <div style="font-size:10px;color:#94a3b8">ZASILANIE PALIWEM</div>
            <div style="font-size:13px;font-weight:800;color:#34d399">${esc(e.fuelDetail || (m.fuelSystem === 'carb' ? 'Gaźniki' : 'Wtrysk EFI'))}</div>
          </div>
          <div style="background:#090d16;padding:9px 11px;border-radius:8px;border:1px solid rgba(148,163,184,0.18)">
            <div style="font-size:10px;color:#94a3b8">UKŁAD ZAPŁONOWY</div>
            <div style="font-size:13px;font-weight:800;color:#e9d5ff">${esc(e.ignition || 'Elektroniczny TCI/ECU')}</div>
          </div>
          <div style="background:#090d16;padding:9px 11px;border-radius:8px;border:1px solid rgba(148,163,184,0.18)">
            <div style="font-size:10px;color:#94a3b8">STOPIEŃ SPRĘŻANIA</div>
            <div style="font-size:13px;font-weight:800;color:#fb923c">${esc(e.compressionRatio || 'Wg DTR OEM')}</div>
          </div>
        </div>

        ${e.notes ? `<div style="background:rgba(56,189,248,0.1);border-left:4px solid #38bdf8;padding:10px 12px;border-radius:8px;font-size:12px;color:#e2e8f0;margin-bottom:14px"><strong>Uwagi konstrukcyjne i diagnostyczne:</strong> ${esc(e.notes)}</div>` : ''}

        <h4 style="margin:12px 0 8px;color:#fb923c;font-size:14px">🔧 TYPOWE USTERKI SERWISOWE TEGO MODELU / RODZINY SILNIKÓW:</h4>
        ${faultCardsHtml || '<div style="font-size:12px;color:#94a3b8">Brak przypisanych specyficznych usterek.</div>'}

        <h4 style="margin:16px 0 6px;color:#38bdf8;font-size:14px">📋 BAZA 30 PARAMETRÓW SERWISOWYCH (Z OZNACZENIEM POZIOMU PEWNOŚCI DANYCH A / B / C)</h4>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:10px">
          Zasada rzetelności danych: Żadne brakujące lub niepotwierdzone wartości nie są zgadywane. Pola oznaczone jako <em>WYMAGA WERYFIKACJI W DTR OEM</em> lub <em>POZIOM B/C</em> należy potwierdzić z instrukcją serwisową dla konkretnego numeru VIN/rocznika. Możesz wpisać i zapisać własną zweryfikowaną wartość warsztatową (Poziom A).
        </div>
        <div class="mc-cyl-scroll">
          <table class="mc-cyl-table">
            <thead>
              <tr>
                <th>Parametr serwisowy</th>
                <th>Wartość dla ${esc(m.brand)} ${esc(m.model)} (${esc(m.engineCode)})</th>
                <th>Status weryfikacji i źródło</th>
                <th>Korekta warsztatowa (A)</th>
              </tr>
            </thead>
            <tbody>
              ${paramRowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- FORMULARZ DODAWANIA NOWEJ MARKI / MODELU DO BAZY -->
      <div class="mc-card">
        <div style="font-size:14px;font-weight:900;color:#34d399;margin-bottom:6px">➕ ROZSZERZ KATALOG: DODAJ WŁASNY MOTOCYKL / NOWĄ MARKĘ (3–4 CYLINDRY 400–650 cm³)</div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:10px">Architektura katalogu jest otwarta — możesz dodać dowolną markę (np. Cagiva, Bimota, Laverda, CFMoto, QJMotor, Kove) i model do lokalnej bazy warsztatu.</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">
          <input id="mc-new-brand" class="mc-input" placeholder="Marka (np. Kove / Honda)">
          <input id="mc-new-model" class="mc-input" placeholder="Model (np. 450RR)">
          <input id="mc-new-years" class="mc-input" placeholder="Rocznik (np. 2023–2025)">
          <input id="mc-new-gen" class="mc-input" placeholder="Generacja / Kod ramy">
          <input id="mc-new-eng" class="mc-input" placeholder="Kod silnika">
          <input id="mc-new-cc" class="mc-input" type="number" placeholder="Pojemność cm³ (400-650)">
          <select id="mc-new-cyl" class="mc-select">
            <option value="4">4 cylindry</option>
            <option value="3">3 cylindry</option>
          </select>
          <select id="mc-new-layout" class="mc-select">
            <option value="R4">Rzędowy R4</option>
            <option value="R3">Rzędowy R3</option>
            <option value="V4">Widlasty V4</option>
            <option value="V3">Widlasty V3</option>
          </select>
          <select id="mc-new-fuel" class="mc-select">
            <option value="efi">Wtrysk EFI</option>
            <option value="carb">Gaźniki</option>
          </select>
          <select id="mc-new-cool" class="mc-select">
            <option value="liquid">Chłodzony cieczą</option>
            <option value="air-oil">Powietrze-olej</option>
            <option value="air">Powietrzem</option>
          </select>
          <button onclick="window.NAPRAWNIK_MULTICYL.addCustomModel()" style="background:#10b981;color:#052e16;border:none;border-radius:9px;padding:9px 12px;font-weight:900;font-size:12px;cursor:pointer">+ Dodaj do katalogu</button>
        </div>
      </div>`;
  }

  // ============================================================================
  // ZAKŁADKA 2: INTELIGENTNE DRZEWA DIAGNOSTYCZNE (12 OBJAWÓW × 8 PUNKTÓW)
  // ============================================================================
  function renderTabDrzewa(ctx) {
    const trees = buildDiagnosticTrees(ctx);
    const activeTree = trees.find(t => t.id === state.activeTreeId) || trees[0];
    const step = activeTree.steps[state.activeStepId] || activeTree.steps.step_1;
    const stepKeys = Object.keys(activeTree.steps);

    const symptomButtonsHtml = trees.map(t => {
      const active = t.id === activeTree.id;
      return `
        <button onclick="window.NAPRAWNIK_MULTICYL.selectTree('${esc(t.id)}')"
          style="background:${active ? 'linear-gradient(135deg,rgba(168,85,247,0.35),rgba(249,115,22,0.3))' : 'rgba(9,13,22,0.85)'};
                 border:1.5px solid ${active ? '#f97316' : 'rgba(148,163,184,0.22)'};
                 color:#fff;border-radius:11px;padding:10px 11px;text-align:left;cursor:pointer">
          <div style="font-size:12px;font-weight:900;color:${active ? '#fde047' : '#e2e8f0'}">${esc(t.icon)} ${t.number}. ${esc(t.title)}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:3px">${esc(t.subtitle)}</div>
        </button>`;
    }).join('');

    const stepPillsHtml = stepKeys.map((sk, idx) => {
      const isCur = sk === state.activeStepId;
      return `
        <button onclick="window.NAPRAWNIK_MULTICYL.goToTreeStep('${esc(sk)}')"
          style="background:${isCur ? '#f97316' : '#1e293b'};color:${isCur ? '#090d16' : '#cbd5e1'};border:none;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:900;cursor:pointer">
          Krok ${idx + 1}
        </button>`;
    }).join('');

    return `
      <div class="mc-card">
        <div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:4px">🌳 WYBIERZ OBJAW DIAGNOSTYCZNY (12 DRZEW DECYZYJNYCH DLA ${esc(ctx.model.brand)} ${esc(ctx.model.model)})</div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:12px">
          Drzewo automatycznie uwzględnia konfigurację wybranego motocykla: <strong>${esc(ctx.model.cylinders)} cylindry (${esc(ctx.model.layout)})</strong>, układ zasilania <strong>${ctx.model.fuelSystem === 'carb' ? 'Gaźnikowy' : 'Wtryskowy EFI'}</strong> oraz chłodzenie <strong>${esc(ctx.model.cooling)}</strong>.
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px">
          ${symptomButtonsHtml}
        </div>
      </div>

      <div class="mc-card" style="border-color:#f97316">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid rgba(148,163,184,0.2);padding-bottom:12px">
          <div>
            <div style="font-size:11px;color:#fb923c;font-weight:800">AKTYWNA ŚCIEŻKA DIAGNOSTYCZNA (#${activeTree.number})</div>
            <h3 style="margin:3px 0;font-size:18px;color:#fff">${esc(activeTree.icon)} ${esc(activeTree.title)}</h3>
            <div style="font-size:13px;color:#fde047;font-weight:800">${esc(step.title)}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${stepPillsHtml}
          </div>
        </div>

        <!-- 8 OBOWIĄZKOWYCH PUNKTÓW DIAGNOSTYCZNYCH W KAŻDYM KROKU -->
        <div class="mc-8pt-grid">
          <div class="mc-8pt-box" style="border-left-color:#38bdf8">
            <div style="font-size:10px;font-weight:900;color:#38bdf8">1. CO SPRAWDZIĆ</div>
            <div style="font-size:12px;color:#f8fafc;margin-top:4px;line-height:1.45">${esc(step.check)}</div>
          </div>
          <div class="mc-8pt-box" style="border-left-color:#a855f7">
            <div style="font-size:10px;font-weight:900;color:#c084fc">2. JAK WYKONAĆ POMIAR</div>
            <div style="font-size:12px;color:#f8fafc;margin-top:4px;line-height:1.45">${esc(step.how)}</div>
          </div>
          <div class="mc-8pt-box" style="border-left-color:#f59e0b">
            <div style="font-size:10px;font-weight:900;color:#fbbf24">3. JAKIEGO NARZĘDZIA UŻYĆ</div>
            <div style="font-size:12px;color:#f8fafc;margin-top:4px;line-height:1.45">${esc(step.tool)}</div>
          </div>
          <div class="mc-8pt-box" style="border-left-color:#10b981">
            <div style="font-size:10px;font-weight:900;color:#34d399">4. JAKIE WYNIKI SĄ PRAWIDŁOWE DLA ${esc(ctx.model.brand)} ${esc(ctx.model.model)}</div>
            <div style="font-size:12px;color:#f8fafc;margin-top:4px;line-height:1.45">${esc(step.expected)}</div>
          </div>
          <div class="mc-8pt-box" style="border-left-color:#ef4444">
            <div style="font-size:10px;font-weight:900;color:#f87171">5. CO OZNACZA WYNIK NIEPRAWIDŁOWY</div>
            <div style="font-size:12px;color:#f8fafc;margin-top:4px;line-height:1.45">${esc(step.abnormal)}</div>
          </div>
          <div class="mc-8pt-box" style="border-left-color:#06b6d4">
            <div style="font-size:10px;font-weight:900;color:#22d3ee">6. JAKIE SĄ KOLEJNE KROKI</div>
            <div style="font-size:12px;color:#f8fafc;margin-top:4px;line-height:1.45">${esc(step.nextText)}</div>
          </div>
          <div class="mc-8pt-box" style="border-left-color:#f97316">
            <div style="font-size:10px;font-weight:900;color:#fb923c">7. MOŻLIWE PRZYCZYNY USTERKI</div>
            <div style="font-size:12px;color:#f8fafc;margin-top:4px;line-height:1.45">${esc(step.causes)}</div>
          </div>
          <div class="mc-8pt-box" style="border-left-color:#22c55e">
            <div style="font-size:10px;font-weight:900;color:#4ade80">8. SPOSÓB NAPRAWY</div>
            <div style="font-size:12px;color:#f8fafc;margin-top:4px;line-height:1.45">${esc(step.repair)}</div>
          </div>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;padding-top:12px;border-top:1px solid rgba(148,163,184,0.2)">
          <button onclick="window.NAPRAWNIK_MULTICYL.goToTreeStep('${esc(step.passNext)}')"
            style="flex:1;min-width:210px;background:linear-gradient(135deg,#059669,#10b981);color:#fff;border:none;border-radius:10px;padding:11px 14px;font-size:12px;font-weight:900;cursor:pointer">
            ✅ WYNIK PRAWIDŁOWY → Przejdź dalej (${esc(step.passNext.replace('_', ' ').toUpperCase())})
          </button>
          <button onclick="window.NAPRAWNIK_MULTICYL.goToTreeStep('${esc(step.failNext)}')"
            style="flex:1;min-width:210px;background:linear-gradient(135deg,#dc2626,#f97316);color:#fff;border:none;border-radius:10px;padding:11px 14px;font-size:12px;font-weight:900;cursor:pointer">
            ⚠️ WYNIK NIEPRAWIDŁOWY → Diagnozuj powiązany układ (${esc(step.failNext.replace('_', ' ').toUpperCase())})
          </button>
          <button onclick="window.NAPRAWNIK_MULTICYL.setTab('cylindry')"
            style="background:#1e293b;color:#38bdf8;border:1px solid #38bdf8;border-radius:10px;padding:11px 14px;font-size:12px;font-weight:800;cursor:pointer">
            📊 Wpisz pomiary do Karty Cylindrów
          </button>
        </div>
      </div>`;
  }

  // ============================================================================
  // ZAKŁADKA 3: DIAGNOSTYKA KAŻDEGO CYLINDRA (R3 / R4) + KALKULATOR PŁYTEK
  // ============================================================================
  function renderTabCylindry(ctx) {
    const m = ctx.model;
    const cylCount = m.cylinders === 3 ? 3 : 4;
    const sheet = getMeasurementSheetForModel(m.id, cylCount);
    const cyls = sheet.cylinders;

    const compAnalysis = analyzeNumericRow(cyls.map(c => c.compressionDry), 'bar', 1.5, 8.5);
    const leakAnalysis = analyzeNumericRow(cyls.map(c => c.leakDownPct), '%', 8.0, null);
    const tempAnalysis = analyzeNumericRow(cyls.map(c => c.exhaustTempC), '°C', 35.0, 90.0);
    const vacAnalysis = analyzeNumericRow(cyls.map(c => c.syncVacuum), 'mmHg', 15.0, null);

    const shimRes = calculateShim(
      state.shimCalc.measured,
      state.shimCalc.targetMin,
      state.shimCalc.targetMax,
      state.shimCalc.currentShim
    );

    const colHeadersHtml = cyls.map(c => `
      <th>
        <div style="font-size:13px">CYLINDER ${c.cyl}</div>
        <div style="font-size:10px;color:#94a3b8;font-weight:600">${c.cyl === 1 ? '(Lewy skrajny)' : c.cyl === cylCount ? '(Prawy skrajny)' : '(Środkowy)'}</div>
      </th>`).join('');

    function renderInputRow(label, field, placeholder, analysisObj) {
      const cells = cyls.map((c, idx) => {
        const dev = analysisObj && analysisObj.deviations ? analysisObj.deviations[idx + 1] : null;
        const borderCol = dev && dev.warn ? '#ef4444' : 'rgba(148,163,184,0.32)';
        const subText = dev ? `<div style="font-size:10px;margin-top:3px;color:${dev.warn ? '#fca5a5' : '#6ee7b7'}">Odch. od śr.: ${esc(dev.diffAvg)} ${esc(analysisObj.unit || '')} ${dev.warn ? '⚠️' : '✓'}</div>` : '';
        return `
          <td>
            <input class="mc-input" style="border-color:${borderCol}" value="${esc(c[field])}" placeholder="${esc(placeholder)}"
              onchange="window.NAPRAWNIK_MULTICYL.updateCylField(${idx}, '${esc(field)}', this.value)">
            ${subText}
          </td>`;
      }).join('');

      const summaryHtml = analysisObj
        ? `<div style="font-size:10px;margin-top:4px;color:${analysisObj.status === 'warn' ? '#fca5a5' : analysisObj.status === 'ok' ? '#6ee7b7' : '#94a3b8'}">${esc(analysisObj.summary)}</div>`
        : '';

      return `
        <tr>
          <td style="font-weight:800;color:#e2e8f0;min-width:175px">
            ${esc(label)}
            ${summaryHtml}
          </td>
          ${cells}
        </tr>`;
    }

    function renderSelectRow(label, field, options) {
      const cells = cyls.map((c, idx) => `
        <td>
          <select class="mc-select" onchange="window.NAPRAWNIK_MULTICYL.updateCylField(${idx}, '${esc(field)}', this.value)">
            ${options.map(opt => `<option value="${esc(opt)}" ${c[field] === opt ? 'selected' : ''}>${esc(opt)}</option>`).join('')}
          </select>
        </td>`).join('');
      return `
        <tr>
          <td style="font-weight:800;color:#e2e8f0">${esc(label)}</td>
          ${cells}
        </tr>`;
    }

    return `
      <div class="mc-card">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
          <div>
            <div style="font-size:15px;font-weight:900;color:#fff">📊 DIAGNOSTYKA PORÓWNAWCZA KAŻDEGO CYLINDRA (${cylCount} CYLINDRY — ${esc(m.layout)})</div>
            <div style="font-size:11px;color:#94a3b8">
              Model: <strong>${esc(m.brand)} ${esc(m.model)} (${esc(m.engineCode)})</strong> • Wpisz wyniki pomiarów dla każdego cylindra. System automatycznie oblicza średnią, rozrzut Δ oraz wskazuje odchylenia między cylindrami.
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button onclick="window.NAPRAWNIK_MULTICYL.loadDemoMeasurements()" style="background:#334155;color:#e2e8f0;border:1px solid #64748b;border-radius:8px;padding:7px 11px;font-size:11px;font-weight:800;cursor:pointer">🧪 Wczytaj przykładowy pomiar</button>
            <button onclick="window.NAPRAWNIK_MULTICYL.clearMeasurements()" style="background:rgba(239,68,68,0.18);color:#fca5a5;border:1px solid #ef4444;border-radius:8px;padding:7px 11px;font-size:11px;font-weight:800;cursor:pointer">🗑️ Wyczyść kartę</button>
          </div>
        </div>

        <div style="background:rgba(250,204,21,0.1);border:1px solid rgba(250,204,21,0.35);border-radius:9px;padding:9px 12px;font-size:11px;color:#fef08a;margin-bottom:12px">
          <strong>Wartości referencyjne dla ${esc(m.brand)} ${esc(m.model)}:</strong>
          Kompresja: <strong>${esc(getParamText(ctx, 'compressionPressure', 'Sprawdź w DTR OEM'))}</strong> •
          Luz zaworowy IN: <strong>${esc(getParamText(ctx, 'valveClearanceIntake', 'Sprawdź w DTR OEM'))}</strong> •
          Luz zaworowy EX: <strong>${esc(getParamText(ctx, 'valveClearanceExhaust', 'Sprawdź w DTR OEM'))}</strong> •
          Synchronizacja: <strong>Δ ≤ 15 mmHg (2 kPa)</strong>.
          <em>Uwaga: Ostateczną ocenę dopuszczalnego zużycia wykonaj zawsze względem tolerancji producenta dla numeru silnika/VIN.</em>
        </div>

        <div class="mc-cyl-scroll">
          <table class="mc-cyl-table">
            <thead>
              <tr>
                <th style="text-align:left">Badany parametr</th>
                ${colHeadersHtml}
              </tr>
            </thead>
            <tbody>
              ${renderInputRow('1. Kompresja na sucho (bar)', 'compressionDry', 'np. 12.5', compAnalysis)}
              ${renderInputRow('2. Kompresja z olejem (bar)', 'compressionWet', 'np. 12.8', null)}
              ${renderInputRow('3. Wynik Leak Down (%)', 'leakDownPct', 'np. 6', leakAnalysis)}
              ${renderSelectRow('4. Miejsce ucieczki Leak Down', 'leakDownLocation', [
                'Brak / <8% (Szczelny)',
                'Wydech (Zawory wydechowe)',
                'Dolot / Gardziel (Zawory ssące)',
                'Odma / Wlew oleju (Pierścienie / Tłok)',
                'Chłodnica / Bąbelki (Uszczelka UPG)'
              ])}
              ${renderInputRow('5. Temp. kolektora wydechowego (°C)', 'exhaustTempC', 'np. 210', tempAnalysis)}
              ${renderInputRow('6. Podciśnienie synchronizacji (mmHg)', 'syncVacuum', 'np. 240', vacAnalysis)}
              ${renderSelectRow('7. Stan świecy zapłonowej', 'sparkPlugState', [
                'Jasnobrązowa / Szara (OK)',
                'Czarna mokra (Zalana paliwem / Brak iskry)',
                'Czarna matowa (Zbyt bogata mieszanka)',
                'Zaolejona (Pierścienie / Uszczelniacze)',
                'Biała / Nadtopiona (Uboga mieszanka / Lewe powietrze)'
              ])}
              ${renderSelectRow('8. Obecność i jakość iskry', 'sparkPresent', [
                'TAK (Silna niebieska >6 mm)',
                'SŁABA (Żółta / Czerwona — przebicie)',
                'BRAK ISKRY (Martwy kanał)',
                'Przerywa po rozgrzaniu cewki'
              ])}
              ${renderSelectRow(m.fuelSystem === 'carb' ? '9. Test gaźnika (dysza / poziom / zaworek)' : '9. Test wtryskiwacza EFI (Ω / rozpylanie)', 'injectorOrCarbTest', [
                'Prawidłowy (OK)',
                'Przytkany / Zaniżona dawka (Ubogo)',
                'Leje / Nieszczelny zaworek (Bogato)',
                'Brak wysterowania elektrycznego / Zacięty'
              ])}
              ${renderInputRow('10. Luz zaworowy SSĄCY IN (mm)', 'valveIntakeMm', 'np. 0.16 / 0.17', null)}
              ${renderInputRow('11. Luz zaworowy WYDECHOWY EX (mm)', 'valveExhaustMm', 'np. 0.24 / 0.25', null)}
              ${renderInputRow('12. Uwagi mechanika dla cylindra', 'mechanicNotes', 'Notatka dla cylindra...', null)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- KALKULATOR PŁYTEK ZAWOROWYCH (SHIM CALCULATOR) -->
      <div class="mc-card" style="border-color:#a855f7">
        <div style="font-size:15px;font-weight:900;color:#c084fc;margin-bottom:4px">🧮 KALKULATOR PŁYTEK ZAWOROWYCH (DOHC 12V / 16V — SHIM CALCULATOR)</div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:12px">
          Wzór warsztatowy: <code>Nowa płytka = Stara płytka + (Luz zmierzony − Środek zakresu docelowego)</code>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px">
          <div>
            <label style="font-size:11px;color:#cbd5e1;display:block;margin-bottom:4px">Luz zmierzony na zimno (mm)</label>
            <input id="mc-shim-measured" class="mc-input" value="${esc(state.shimCalc.measured)}" oninput="window.NAPRAWNIK_MULTICYL.updateShim('measured', this.value)">
          </div>
          <div>
            <label style="font-size:11px;color:#cbd5e1;display:block;margin-bottom:4px">Norma MIN wg DTR (mm)</label>
            <input id="mc-shim-min" class="mc-input" value="${esc(state.shimCalc.targetMin)}" oninput="window.NAPRAWNIK_MULTICYL.updateShim('targetMin', this.value)">
          </div>
          <div>
            <label style="font-size:11px;color:#cbd5e1;display:block;margin-bottom:4px">Norma MAX wg DTR (mm)</label>
            <input id="mc-shim-max" class="mc-input" value="${esc(state.shimCalc.targetMax)}" oninput="window.NAPRAWNIK_MULTICYL.updateShim('targetMax', this.value)">
          </div>
          <div>
            <label style="font-size:11px;color:#cbd5e1;display:block;margin-bottom:4px">Obecna płytka z mikrometru (mm)</label>
            <input id="mc-shim-cur" class="mc-input" value="${esc(state.shimCalc.currentShim)}" oninput="window.NAPRAWNIK_MULTICYL.updateShim('currentShim', this.value)">
          </div>
        </div>
        ${shimRes.valid ? `
          <div style="background:#090d16;border:1px solid ${shimRes.inSpec ? '#10b981' : '#f97316'};border-radius:10px;padding:12px">
            <div style="font-size:13px;font-weight:900;color:${shimRes.inSpec ? '#34d399' : '#fde047'}">${esc(shimRes.statusText)}</div>
            <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:8px;font-size:12px;color:#e2e8f0">
              <div>Środek zakresu docelowego: <strong>${esc(shimRes.targetMid)} mm</strong></div>
              <div>Wyliczona dokładna płytka: <strong style="color:#38bdf8">${esc(shimRes.exactNewShim)} mm</strong></div>
              <div>Dobór płytki (skok co 0.05 mm): <strong style="color:#fde047;font-size:14px">${esc(shimRes.rounded050)} mm</strong></div>
              <div>Dobór płytki (skok co 0.025 mm): <strong style="color:#c084fc">${esc(shimRes.rounded025)} mm</strong></div>
              <div>Przewidywany luz po montażu: <strong style="color:#34d399">${esc(shimRes.resultingClearance)} mm</strong></div>
            </div>
          </div>` : `<div style="color:#fca5a5;font-size:12px">${esc(shimRes.message)}</div>`}
      </div>`;
  }

  // ============================================================================
  // ZAKŁADKA 4: ROZBUDOWANA DIAGNOSTYKA — 6 DZIAŁÓW (A–F)
  // ============================================================================
  function renderTabDzialy() {
    const q = state.sectionSearch.trim().toLowerCase();
    const totalCount = DIAGNOSTIC_SECTIONS.reduce((acc, s) => acc + s.procedures.length, 0);
    const filterButtons = [
      { id: 'ALL', label: `Wszystkie działy (A–H • ${totalCount} procedur)` }
    ].concat(DIAGNOSTIC_SECTIONS.map(s => ({ id: s.id, label: `${s.icon} ${s.code}: ${s.title}` })));

    const sectionsHtml = DIAGNOSTIC_SECTIONS
      .filter(s => state.activeSectionId === 'ALL' || s.id === state.activeSectionId)
      .map(sec => {
        const procs = sec.procedures.filter(p => {
          if (!q) return true;
          const hay = `${p.id} ${p.name} ${p.applicable || ''} ${p.symptom || ''} ${p.causes || ''} ${p.tools || ''} ${p.when || ''} ${(p.steps || []).join(' ')} ${p.measurementPoint || ''} ${p.referenceValue || ''} ${p.evaluation || ''} ${p.repairSteps || ''} ${p.verification || ''}`.toLowerCase();
          return hay.includes(q);
        });
        if (!procs.length) return '';

        const procsHtml = procs.map(p => {
          const isOpen = state.expandedProcedureId === p.id || q.length > 0;
          return `
            <div style="background:rgba(9,13,22,0.88);border:1px solid ${isOpen ? sec.color : 'rgba(148,163,184,0.2)'};border-radius:11px;margin-bottom:8px;overflow:hidden">
              <div onclick="window.NAPRAWNIK_MULTICYL.toggleProcedure('${esc(p.id)}')"
                style="padding:11px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px">
                <div>
                  <span class="mc-badge" style="background:rgba(255,255,255,0.08);color:${sec.color};margin-right:6px">${esc(p.id)}</span>
                  <strong style="font-size:13px;color:#fff">${esc(p.name)}</strong>
                  ${p.applicable ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px">🏍️ ${esc(p.applicable)}</div>` : ''}
                </div>
                <span style="color:#94a3b8;font-size:12px;white-space:nowrap">${isOpen ? '▲ Zwiń' : '▼ Rozwiń'}</span>
              </div>
              ${isOpen ? `
                <div style="padding:0 14px 13px;border-top:1px solid rgba(148,163,184,0.14);font-size:12px;color:#e2e8f0">
                  ${p.symptom ? `<div style="margin-top:8px;background:rgba(239,68,68,0.12);border-left:3px solid #ef4444;padding:6px 10px;border-radius:6px;color:#fca5a5"><strong>⚠️ Zgłoszony objaw:</strong> ${esc(p.symptom)}</div>` : ''}
                  ${p.causes ? `<div style="margin-top:6px;background:rgba(234,179,8,0.1);border-left:3px solid #eab308;padding:6px 10px;border-radius:6px;color:#fde047"><strong>🔎 Możliwe przyczyny:</strong> ${esc(p.causes)}</div>` : ''}
                  <div style="margin-top:9px;color:#fde047"><strong>🧰 Wymagane przyrządy:</strong> ${esc(p.tools)}</div>
                  <div style="margin-top:5px;color:#bae6fd"><strong>🔍 Kiedy wykonać:</strong> ${esc(p.when)}</div>
                  <div style="margin-top:8px;font-weight:800;color:#c084fc">📋 Procedura diagnostyczna krok po kroku:</div>
                  <ol style="margin:5px 0 8px 18px;padding:0;line-height:1.5">
                    ${(p.steps || []).map(st => `<li style="margin-bottom:4px">${esc(st)}</li>`).join('')}
                  </ol>
                  ${p.measurementPoint ? `<div style="margin-top:6px;color:#7dd3fc"><strong>🎯 Punkt pomiarowy:</strong> ${esc(p.measurementPoint)}</div>` : ''}
                  ${p.referenceValue ? `<div style="margin-top:6px;background:rgba(56,189,248,0.12);border-left:3px solid #38bdf8;padding:6px 10px;border-radius:6px;color:#bae6fd"><strong>📊 Wartość wzorcowa:</strong> ${esc(p.referenceValue)}</div>` : ''}
                  <div style="margin-top:6px;background:rgba(16,185,129,0.12);border-left:3px solid #10b981;padding:6px 10px;border-radius:6px;color:#a7f3d0">
                    <strong>✅ Interpretacja wyników:</strong> ${esc(p.evaluation)}
                  </div>
                  ${p.repairSteps ? `<div style="margin-top:6px;color:#fdba74"><strong>🔧 Czynności naprawcze:</strong> ${esc(p.repairSteps)}</div>` : ''}
                  ${p.verification ? `<div style="margin-top:6px;color:#86efac"><strong>🏁 Weryfikacja po naprawie:</strong> ${esc(p.verification)}</div>` : ''}
                  ${p.linkedTool ? `
                    <div style="margin-top:10px;padding-top:8px;border-top:1px dashed rgba(148,163,184,0.2);display:flex;align-items:center;gap:8px">
                      <span style="font-size:11px;color:#94a3b8">Powiązane narzędzie:</span>
                      <span style="font-size:11px;font-weight:800;color:#38bdf8;background:rgba(56,189,248,0.15);padding:2px 8px;border-radius:6px">${esc(p.linkedTool)}</span>
                    </div>` : ''}
                </div>` : ''}
            </div>`;
        }).join('');

        return `
          <div class="mc-card" style="border-top:3px solid ${sec.color}">
            <div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:3px">${esc(sec.icon)} ${esc(sec.code)} — ${esc(sec.title)}</div>
            <div style="font-size:11px;color:#94a3b8;margin-bottom:12px">${esc(sec.summary)}</div>
            ${procsHtml}
          </div>`;
      }).join('');

    return `
      <div class="mc-card">
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          ${filterButtons.map(b => `
            <button onclick="window.NAPRAWNIK_MULTICYL.setSection('${esc(b.id)}')"
              style="background:${state.activeSectionId === b.id ? '#f97316' : '#1e293b'};color:${state.activeSectionId === b.id ? '#090d16' : '#e2e8f0'};border:none;border-radius:8px;padding:7px 11px;font-size:11px;font-weight:800;cursor:pointer">
              ${esc(b.label)}
            </button>`).join('')}
        </div>
        <input id="mc-section-search" class="mc-input" placeholder="Szukaj procedury w działach A–H (np. Leak Down, synchronizacja, stojan, 2. bieg, zaworek iglicowy, TPS, ABS, SAG, CVT, wyciągarka)..."
          value="${esc(state.sectionSearch)}" oninput="window.NAPRAWNIK_MULTICYL.setSectionSearch(this.value)">
      </div>
      ${sectionsHtml}`;
  }

  // ============================================================================
  // ZAKŁADKA 5: SCHEMATY TECHNICZNE SVG Z POWIĘKSZANIEM (ZOOM)
  // ============================================================================
  function renderTabSchematy() {
    const active = TECHNICAL_SCHEMATICS.find(s => s.id === state.activeSchematicId) || TECHNICAL_SCHEMATICS[0];
    return `
      <div class="mc-card">
        <div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:4px">📐 INTERAKTYWNE SCHEMATY TECHNICZNE MOTOCYKLI 3–4 CYLINDROWYCH</div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:12px">
          Wybierz jeden z 7 oryginalnych schematów blokowo-pomiarowych. Użyj przycisków powiększania (Zoom), aby wygodnie odczytać punkty pomiarowe na ekranie telefonu lub komputera.
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px">
          ${TECHNICAL_SCHEMATICS.map(s => `
            <button onclick="window.NAPRAWNIK_MULTICYL.selectSchematic('${esc(s.id)}')"
              style="background:${s.id === active.id ? 'linear-gradient(135deg,rgba(56,189,248,0.28),rgba(168,85,247,0.25))' : '#090d16'};
                     border:1.5px solid ${s.id === active.id ? '#38bdf8' : 'rgba(148,163,184,0.22)'};
                     color:#fff;border-radius:10px;padding:9px 11px;text-align:left;cursor:pointer">
              <div style="font-size:10px;color:#38bdf8;font-weight:800">${esc(s.category)}</div>
              <div style="font-size:12px;font-weight:800;margin-top:2px">${esc(s.title)}</div>
            </button>`).join('')}
        </div>
      </div>

      <div class="mc-card" style="border-color:#38bdf8">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
          <div>
            <span class="mc-badge" style="background:rgba(56,189,248,0.2);color:#7dd3fc">${esc(active.category)}</span>
            <h3 style="margin:4px 0;font-size:16px;color:#fff">${esc(active.title)}</h3>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <button onclick="window.NAPRAWNIK_MULTICYL.zoomSchematic(-25)" style="background:#1e293b;color:#fff;border:1px solid #475569;border-radius:7px;padding:6px 10px;font-weight:900;cursor:pointer">🔍 −</button>
            <span style="font-size:12px;font-weight:800;color:#fde047;min-width:52px;text-align:center">${state.schematicZoom}%</span>
            <button onclick="window.NAPRAWNIK_MULTICYL.zoomSchematic(25)" style="background:#1e293b;color:#fff;border:1px solid #475569;border-radius:7px;padding:6px 10px;font-weight:900;cursor:pointer">🔍 +</button>
            <button onclick="window.NAPRAWNIK_MULTICYL.zoomSchematic(0)" style="background:#334155;color:#e2e8f0;border:none;border-radius:7px;padding:6px 10px;font-size:11px;font-weight:800;cursor:pointer">100%</button>
          </div>
        </div>

        <div style="font-size:12px;color:#cbd5e1;margin-bottom:12px">${esc(active.description)}</div>

        <div style="overflow:auto;background:#05080f;border:1px solid rgba(56,189,248,0.35);border-radius:12px;padding:10px">
          <div style="width:${state.schematicZoom}%;min-width:320px;transition:width 0.15s ease">
            ${active.svg}
          </div>
        </div>

        <div style="margin-top:14px">
          <div style="font-size:12px;font-weight:900;color:#fde047;margin-bottom:6px">📌 KLUCZOWE PUNKTY POMIAROWE NA TYM SCHEMACIE:</div>
          <ul style="margin:0;padding-left:18px;font-size:12px;color:#e2e8f0;line-height:1.55">
            ${active.checkpoints.map(cp => `<li>${esc(cp)}</li>`).join('')}
          </ul>
        </div>
      </div>`;
  }

  // ============================================================================
  // GŁÓWNA FUNKCJA RENDERUJĄCA MODUŁ: window.renderMulticyl(tabArg)
  // ============================================================================
  function renderMulticyl(tabArg) {
    if (tabArg && ['katalog', 'drzewa', 'cylindry', 'dzialy', 'schematy'].includes(tabArg)) {
      state.activeTab = tabArg;
    }
    const container = document.getElementById('screen') || document.getElementById('main');
    if (!container) return;

    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    const activeId = activeEl && activeEl.id ? activeEl.id : null;
    const selStart = activeEl && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null;

    const d = getData();
    const ctx = getSelectedModel();

    let tabContentHtml = '';
    if (state.activeTab === 'katalog') tabContentHtml = renderTabKatalog(ctx);
    else if (state.activeTab === 'drzewa') tabContentHtml = renderTabDrzewa(ctx);
    else if (state.activeTab === 'cylindry') tabContentHtml = renderTabCylindry(ctx);
    else if (state.activeTab === 'dzialy') tabContentHtml = renderTabDzialy(ctx);
    else if (state.activeTab === 'schematy') tabContentHtml = renderTabSchematy(ctx);

    container.innerHTML = `
      ${renderModuleStyles()}
      <div class="mc-wrap">
        <div class="mc-hero">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px">
            <div>
              <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(249,115,22,0.2);border:1px solid rgba(249,115,22,0.5);border-radius:99px;padding:3px 10px;font-size:10px;font-weight:900;color:#fdba74;margin-bottom:6px">
                🏍️ SEGMENT SPECJALISTYCZNY • 3–4 CYLINDRY • 400–650 cm³
              </div>
              <h2 style="margin:0;font-size:21px;font-weight:900;color:#fff;letter-spacing:0.3px">
                NAPRAWNIK — MOTOCYKLE 3–4 CYLINDRY (400–650 cm³)
              </h2>
              <div style="font-size:12px;color:#cbd5e1;margin-top:4px">
                R3 / R4 / V4 • Gaźniki &amp; EFI • Chłodzenie powietrzem, olejem i cieczą • ${d.MANUFACTURERS.length} marek • ${d.MODELS.length} modeli • ${Object.keys(d.ENGINES).length} profili silnikowych
              </div>
            </div>
            <button onclick="if(typeof nav==='function') nav('home')"
              style="background:rgba(15,23,42,0.9);color:#e2e8f0;border:1px solid rgba(148,163,184,0.35);border-radius:10px;padding:8px 13px;font-size:12px;font-weight:800;cursor:pointer">
              ← Powrót do Pulpitu
            </button>
          </div>
        </div>

        ${renderActiveModelBanner(ctx)}

        <div class="mc-tabs">
          <button class="mc-tab-btn ${state.activeTab === 'katalog' ? 'active' : ''}" onclick="window.NAPRAWNIK_MULTICYL.setTab('katalog')">
            <span>🗂️</span>
            <div>
              <div>1. KATALOG &amp; PARAMETRY</div>
              <div style="font-size:10px;color:#94a3b8;font-weight:600">${d.MODELS.length} modeli • 30 parametrów</div>
            </div>
          </button>
          <button class="mc-tab-btn ${state.activeTab === 'drzewa' ? 'active' : ''}" onclick="window.NAPRAWNIK_MULTICYL.setTab('drzewa')">
            <span>🌳</span>
            <div>
              <div>2. DRZEWA DIAGNOSTYCZNE</div>
              <div style="font-size:10px;color:#94a3b8;font-weight:600">12 objawów × 8 punktów</div>
            </div>
          </button>
          <button class="mc-tab-btn ${state.activeTab === 'cylindry' ? 'active' : ''}" onclick="window.NAPRAWNIK_MULTICYL.setTab('cylindry')">
            <span>📊</span>
            <div>
              <div>3. CYLINDRY 1–${ctx && ctx.model ? ctx.model.cylinders : 4} &amp; PŁYTKI</div>
              <div style="font-size:10px;color:#94a3b8;font-weight:600">Porównanie Δ + Shim Calc</div>
            </div>
          </button>
          <button class="mc-tab-btn ${state.activeTab === 'dzialy' ? 'active' : ''}" onclick="window.NAPRAWNIK_MULTICYL.setTab('dzialy')">
            <span>🔧</span>
            <div>
              <div>4. DZIAŁY DIAGNOSTYKI A–H</div>
              <div style="font-size:10px;color:#94a3b8;font-weight:600">Silnik • Paliwo • Elektryka • Hamulce • Zawieszenie • Napęd • Wydech • Quady</div>
            </div>
          </button>
          <button class="mc-tab-btn ${state.activeTab === 'schematy' ? 'active' : ''}" onclick="window.NAPRAWNIK_MULTICYL.setTab('schematy')">
            <span>📐</span>
            <div>
              <div>5. SCHEMATY TECHNICZNE</div>
              <div style="font-size:10px;color:#94a3b8;font-weight:600">7 schematów SVG + Zoom</div>
            </div>
          </button>
        </div>

        ${tabContentHtml}
      </div>`;

    if (activeId && typeof document.getElementById === 'function') {
      const restored = document.getElementById(activeId);
      if (restored && typeof restored.focus === 'function') {
        restored.focus();
        if (selStart !== null && typeof restored.setSelectionRange === 'function') {
          try { restored.setSelectionRange(selStart, selStart); } catch (_) {}
        }
      }
    }
  }

  // ============================================================================
  // PUBLICZNE API I OBSŁUGA AKCJI INTERFEJSU
  // ============================================================================
  const api = {
    state: state,
    getData: getData,
    DIAGNOSTIC_SECTIONS: DIAGNOSTIC_SECTIONS,
    TECHNICAL_SCHEMATICS: TECHNICAL_SCHEMATICS,
    buildDiagnosticTrees: buildDiagnosticTrees,
    calculateShim: calculateShim,
    analyzeNumericRow: analyzeNumericRow,
    getMeasurementSheetForModel: getMeasurementSheetForModel,

    setTab(tab) {
      state.activeTab = tab;
      renderMulticyl();
    },

    selectModel(modelId) {
      state.selectedModelId = modelId;
      try {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_MODEL, modelId);
      } catch (_) {}
      renderMulticyl();
    },

    setFilter(field, val) {
      state[field] = val;
      renderMulticyl();
    },

    saveCustomParam(paramKey) {
      const ctx = getSelectedModel();
      if (!ctx || !ctx.model) return;
      const input = document.getElementById('mc-param-in-' + paramKey);
      if (!input) return;
      const val = input.value.trim();
      const allCustom = loadJson(STORAGE_KEYS.CUSTOM_PARAMS, {});
      if (!allCustom[ctx.model.id]) allCustom[ctx.model.id] = {};
      if (!val) {
        delete allCustom[ctx.model.id][paramKey];
      } else {
        allCustom[ctx.model.id][paramKey] = {
          value: val,
          confidence: 'A',
          source: 'Zweryfikowano i zapisano w warsztacie (Poziom A)'
        };
      }
      saveJson(STORAGE_KEYS.CUSTOM_PARAMS, allCustom);
      if (typeof toast === 'function') toast('Zapisano parametr serwisowy (Poziom A)');
      renderMulticyl();
    },

    addCustomModel() {
      const brand = (document.getElementById('mc-new-brand') || {}).value || '';
      const model = (document.getElementById('mc-new-model') || {}).value || '';
      const years = (document.getElementById('mc-new-years') || {}).value || 'Wg VIN';
      const gen = (document.getElementById('mc-new-gen') || {}).value || 'Standard';
      const eng = (document.getElementById('mc-new-eng') || {}).value || 'OEM';
      const cc = parseInt((document.getElementById('mc-new-cc') || {}).value || '600', 10) || 600;
      const cyl = parseInt((document.getElementById('mc-new-cyl') || {}).value || '4', 10) || 4;
      const layout = (document.getElementById('mc-new-layout') || {}).value || 'R4';
      const fuel = (document.getElementById('mc-new-fuel') || {}).value || 'efi';
      const cool = (document.getElementById('mc-new-cool') || {}).value || 'liquid';

      if (!brand.trim() || !model.trim()) {
        if (typeof toast === 'function') toast('Podaj przynajmniej markę i nazwę modelu!');
        return;
      }

      const id = 'custom-' + brand.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
      const newEntry = {
        id: id,
        brand: brand.trim(),
        model: model.trim(),
        years: years.trim(),
        generation: gen.trim(),
        engineCode: eng.trim(),
        variant: `${cc} cm³ ${layout} (${fuel.toUpperCase()})`,
        displacementCc: cc,
        cylinders: cyl,
        layout: layout,
        fuelSystem: fuel,
        cooling: cool,
        engineId: id,
        faultIds: ['F_CARB_SYNC', 'F_VALVE_TIGHT', 'F_REGULATOR_STATOR'],
        customEngine: {
          code: eng.trim(),
          displacementCc: cc,
          cylinders: cyl,
          layout: layout,
          strokeType: '4T',
          cooling: cool,
          fuelSystem: fuel,
          valvetrain: 'DOHC',
          valvesTotal: cyl * 4,
          params: {}
        }
      };

      const customList = loadJson(STORAGE_KEYS.CUSTOM_MODELS, []);
      customList.push(newEntry);
      saveJson(STORAGE_KEYS.CUSTOM_MODELS, customList);
      state.selectedModelId = id;
      try {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_MODEL, id);
      } catch (_) {}
      if (typeof toast === 'function') toast('Dodano nowy motocykl do katalogu!');
      renderMulticyl();
    },

    selectTree(treeId) {
      state.activeTab = 'drzewa';
      state.activeTreeId = treeId;
      state.activeStepId = 'step_1';
      renderMulticyl();
    },

    goToTreeStep(stepId) {
      state.activeStepId = stepId;
      renderMulticyl();
    },

    updateCylField(cylIdx, field, val) {
      const ctx = getSelectedModel();
      if (!ctx || !ctx.model) return;
      const sheet = getMeasurementSheetForModel(ctx.model.id, ctx.model.cylinders);
      if (sheet.cylinders[cylIdx]) {
        sheet.cylinders[cylIdx][field] = val;
        saveMeasurementSheetForModel(sheet);
      }
      renderMulticyl();
    },

    loadDemoMeasurements() {
      const ctx = getSelectedModel();
      if (!ctx || !ctx.model) return;
      const cylCount = ctx.model.cylinders === 3 ? 3 : 4;
      const sheet = getMeasurementSheetForModel(ctx.model.id, cylCount);
      const demoDry = cylCount === 3 ? ['12.6', '12.4', '9.2'] : ['12.8', '12.6', '9.4', '12.7'];
      const demoWet = cylCount === 3 ? ['12.8', '12.6', '9.5'] : ['13.0', '12.8', '9.6', '12.9'];
      const demoLeak = cylCount === 3 ? ['5', '6', '22'] : ['5', '6', '24', '5'];
      const demoTemp = cylCount === 3 ? ['215', '210', '115'] : ['220', '215', '110', '218'];
      const demoVac = cylCount === 3 ? ['230', '225', '175'] : ['235', '230', '170', '235'];

      sheet.cylinders.forEach((c, idx) => {
        c.compressionDry = demoDry[idx];
        c.compressionWet = demoWet[idx];
        c.leakDownPct = demoLeak[idx];
        c.leakDownLocation = idx === 2 ? 'Wydech (Zawory wydechowe)' : 'Brak / <8% (Szczelny)';
        c.exhaustTempC = demoTemp[idx];
        c.syncVacuum = demoVac[idx];
        c.valveIntakeMm = '0.16';
        c.valveExhaustMm = idx === 2 ? '0.06' : '0.25';
        c.mechanicNotes = idx === 2 ? 'Podparty zawór wydechowy na Cyl 3!' : 'W normie';
      });
      saveMeasurementSheetForModel(sheet);
      renderMulticyl();
    },

    clearMeasurements() {
      const ctx = getSelectedModel();
      if (!ctx || !ctx.model) return;
      const all = loadJson(STORAGE_KEYS.MEASUREMENTS, {});
      delete all[ctx.model.id];
      saveJson(STORAGE_KEYS.MEASUREMENTS, all);
      renderMulticyl();
    },

    updateShim(field, val) {
      state.shimCalc[field] = val;
      renderMulticyl();
    },

    setSection(secId) {
      state.activeSectionId = secId;
      renderMulticyl();
    },

    setSectionSearch(q) {
      state.sectionSearch = q;
      renderMulticyl();
    },

    toggleProcedure(procId) {
      state.expandedProcedureId = state.expandedProcedureId === procId ? '' : procId;
      renderMulticyl();
    },

    selectSchematic(schId) {
      state.activeSchematicId = schId;
      renderMulticyl();
    },

    zoomSchematic(delta) {
      if (delta === 0) state.schematicZoom = 100;
      else state.schematicZoom = Math.max(75, Math.min(200, state.schematicZoom + delta));
      renderMulticyl();
    }
  };

  const root = typeof window !== 'undefined' ? window : globalThis;
  root.NAPRAWNIK_MULTICYL = api;
  root.renderMulticyl = renderMulticyl;
})();
