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
      id: 'A',
      code: 'DZIAŁ A',
      title: 'DIAGNOSTYKA MECHANICZNA',
      color: '#f97316',
      icon: '⚙️',
      summary: 'Kompresja, próba szczelności Leak Down, tłoki i pierścienie, luzy zaworowe 12V/16V, wałki rozrządu, łańcuch i napinacz CCT, uszczelka pod głowicą, ciśnienie oleju.',
      procedures: [
        {
          id: 'A1',
          name: 'Pomiar kompresji w silniku 3- i 4-cylindrowym',
          tools: 'Manometr kompresji z gwintem M10×1.0 / M12×1.25, naładowany akumulator (min. 12.6 V), klucz do świec 16 mm / 14 mm',
          when: 'Nierówna praca, spadek mocy, trudny rozruch, podejrzenie podpartych zaworów lub zużycia pierścieni.',
          steps: [
            'Rozgrzej silnik do temperatury roboczej (ok. 80–90°C płynu / oleju) i wyłącz zapłon.',
            'Odłącz zasilanie cewek zapłonowych (lub fajkocewek COP) oraz wtyczki wtryskiwaczy EFI / zamknij kranik paliwa.',
            'Wykręć WSZYSTKIE 3 lub 4 świece zapłonowe i ułóż je w kolejności cylindrów (Cyl 1 = lewy skrajny w układzie rzędowym poprzecznym).',
            'Wkręć końcówkę manometru w gniazdo świecy badanego cylindra. Otwórz przepustnicę całkowicie (WOT — 100%) i kręć rozrusznikiem przez 4–6 sekund do ustabilizowania wskazówki.',
            'Zapisz wynik dla każdego cylindra w zakładce „Diagnostyka Cylindrów” i porównaj rozrzut Δ pomiędzy skrajnymi cylindrami.'
          ],
          evaluation: 'W sprawnej jednostce wielocylindrowej różnica pomiędzy najsłabszym a najmocniejszym cylindrem nie powinna przekraczać 1.0–1.5 bar (100–150 kPa / maks. 10%). Wartość nominalną dla wybranego kodu silnika sprawdź w tabeli Parametrów Serwisowych.'
        },
        {
          id: 'A2',
          name: 'Próba szczelności cylindrów (Leak Down Test)',
          tools: 'Tester szczelności dwumanometryczny Leak Down, sprężarka powietrza (6–8 bar), klucz do obracania wałem korbowym i jego blokowania w GMP',
          when: 'Zaniżona kompresja na jednym lub kilku cylindrach — pozwala jednoznacznie odróżnić nieszczelność zaworów od zużycia pierścieni lub uszkodzenia uszczelki pod głowicą.',
          steps: [
            'Ustaw tłok badanego cylindra dokładnie w Górnym Martwym Punkcie (GMP / TDC) suwu sprężania (wszystkie krzywki zaworowe tego cylindra skierowane od popychaczy).',
            'Zablokuj wał korbowy (lub wrzuć 6. bieg i zablokuj tylne koło hamulcem) — ciśnienie sprężonego powietrza może obrócić wał!',
            'Skalibruj tester Leak Down i podłącz wąż do gniazda świecy. Podaj ciśnienie testowe i odczytaj procentowy spadek (% ubytku).',
            'Nasłuchuj miejsca ucieczki powietrza: kolektor dolotowy/gardziele = zawory ssące; wydech = zawory wydechowe; korek wlewu oleju/odma = pierścienie tłokowe lub gładź cylindra; bąbelki w chłodnicy = uszczelka pod głowicą.'
          ],
          evaluation: 'Ubytek do 5–8% oznacza bardzo dobrą szczelność; 10–15% to stan dopuszczalny eksploatacyjnie; powyżej 15–20% wymaga rewizji głowicy lub układu tłokowo-cylindrowego.'
        },
        {
          id: 'A3',
          name: 'Kontrola szczelności cylindrów i próba olejowa',
          tools: 'Manometr kompresji, strzykawka warsztatowa z wężykiem, 3–5 ml czystego oleju silnikowego 10W-40',
          when: 'Gdy pomiar kompresji na sucho wykazał spadek na wybranym cylindrze, a nie dysponujesz jeszcze zestawem Leak Down.',
          steps: [
            'Wstrzyknij 3–5 ml oleju silnikowego bezpośrednio na denko tłoka przez otwór świecy badanego cylindra (uważaj, aby nie wlać więcej — ryzyko podparcia hydraulicznego).',
            'Obróć wałem korbowym o 2 obroty bez manometru w celu rozprowadzenia filmu olejowego na pierścieniach.',
            'Ponownie zmierz kompresję przy całkowicie otwartej przepustnicy (WOT) i porównaj z wynikiem „na sucho”.'
          ],
          evaluation: 'Wyraźny wzrost ciśnienia po podaniu oleju (o >1.5–2.0 bar) wskazuje na nieszczelność pierścieni tłokowych lub owalizację cylindra. Brak wzrostu wskazuje na podparte/wypalone zawory lub nieszczelność uszczelki głowicy.'
        },
        {
          id: 'A4',
          name: 'Diagnostyka tłoków, pierścieni i gładzi cylindrowych (Nikasil / żeliwo)',
          tools: 'Endoskop warsztatowy HD z kamerą kątową 90°, średnicówka zegarowa, mikrometr, szczelinomierz',
          when: 'Nadmierne zużycie oleju (>0.4–0.5 l / 1000 km), niebieski dym z wydechu, przedmuchy do skrzyni korbowej.',
          steps: [
            'Przez otwór świecy wprowadź kamerę endoskopową przy tłoku w DMP i oceń ślady honowania (siatkę krzyżową), rysy wzdłużne oraz odkładanie nagaru olejowego na obwodzie denka tłoka.',
            'Sprawdź ciśnienie w skrzyni korbowej na biegu jałowym oraz po przygazowaniu (przedmuchy przez odmę do airboxu).',
            'Przy demontażu cylindrów zmierz owalizację i stożkowatość w 6 punktach oraz luz zamka pierścieni w cylindrze.'
          ],
          evaluation: 'Wytarcie siatki honowniczej, pionowe zatarcia na płaszczu tłoka lub zapieczone pierścienie zgarniające wymagają honowania/tulejowania lub wymiany kompletu pierścieni.'
        },
        {
          id: 'A5',
          name: 'Kontrola zaworów, przylgni i uszczelniaczy trzonków',
          tools: 'Endoskop z podświetleniem LED, próżniomierz do głowic, nafta kontrolna (przy zdjętej głowicy)',
          when: 'Zimny dym po rozruchu (uszczelniacze zaworowe), nieszczelność w próbie Leak Down w stronę dolotu lub wydechu.',
          steps: [
            'Oceń endoskopowo trzonki zaworów ssących od strony gardzieli dolotowych — mokry olej na grzybku zaworu ssącego świadczy o stwardniałych uszczelniaczach zaworowych.',
            'W silnikach wysokoobrotowych 400–600 cm³ (kręcących 14 000–16 500 obr./min) sprawdź symetrię osadzenia zaworów i brak wypalenia przylgni wydechowych.',
            'Po demontażu głowicy wykonaj próbę szczelności podciśnieniowej kanałów dolotowych i wydechowych.'
          ],
          evaluation: 'Wypalone gniazda wydechowe lub zużyte prowadnice zaworowe powodują utratę kompresji i brak możliwości trwałego wyregulowania luzów zaworowych.'
        },
        {
          id: 'A6',
          name: 'Pomiar luzów zaworowych i dobór płytek regulacyjnych (12V / 16V)',
          tools: 'Szczelinomierz listkowy precyzyjny (co 0.01–0.02 mm), mikrometr 0–25 mm (do pomiaru płytek), klucz dynamometryczny 8–15 Nm',
          when: 'Trudny rozruch na gorącym silniku, gaśnięcie po rozgrzaniu (zbyt ciasne zawory), metaliczne cykanie z głowicy (zbyt luźne zawory) lub interwał serwisowy.',
          steps: [
            'Pomiar wykonuj WYŁĄCZNIE na całkowicie ZIMNYM silniku (poniżej 35°C / po nocy w warsztacie).',
            'Zdejmij pokrywę zaworów, ustaw znaki rozrządu dla Cyl 1 w GMP sprężania i zmierz luzy na obu zaworach ssących (IN) oraz obu zaworach wydechowych (EX) każdego cylindra po kolei zgodnie z kolejnością zapłonu.',
            'Zapisz wszystkie 12 (R3) lub 16 (R4) pomiarów. Jeśli luz wykracza poza specyfikację modelu, oblicz nową grubość płytki w Kalkulatorze Płytek Zaworowych: Nowa = Stara + (Zmierzony − Cel).'
          ],
          evaluation: 'W 16-zaworowych silnikach R4 luzy zaworowe mają tendencję do ZMNIEJSZANIA SIĘ (osiadanie zaworów w gniazdach). Zbyt mały luz (<0.08 mm) grozi podparciem i wypaleniem zaworu!'
        },
        {
          id: 'A7',
          name: 'Diagnostyka wałków rozrządu, krzywek i łożyskowania w głowicy',
          tools: 'Mikrometr 25–50 mm, paski pomiarowe Plastigage, klucz dynamometryczny',
          when: 'Podczas regulacji płytkowej (płytki pod szklankami wymagają demontażu wałków), przy hałasach z górnej części głowicy lub po spadku ciśnienia oleju.',
          steps: [
            'Oceń wierzchołki wszystkich krzywek pod kątem wżerów zmęczeniowych (pittingu), przebarwień termicznych i wyrobienia warstwy utwardzanej.',
            'Sprawdź czopy wałków rozrządu oraz aluminiowe mostki łożyskowe w głowicy (brak rys zatarcia — wałki pracują bezpośrednio w filmie olejowym głowicy).',
            'Zmierz wysokość krzywek mikrometrem i luz olejowy czopów za pomocą paska Plastigage.'
          ],
          evaluation: 'Zatarcie mostków wałków rozrządu w aluminiowej głowicy świadczy o pracy przy zbyt niskim ciśnieniu oleju lub zatkaniu magistrali olejowej nadmierną ilością silikonu.'
        },
        {
          id: 'A8',
          name: 'Kontrola łańcucha rozrządu, ślizgów i napinacza (CCT)',
          tools: 'Stetoskop mechanika, wkrętak precyzyjny do napinacza zapadkowego/śrubowego, suwmiarka (pomiar długości 20 ogniw)',
          when: 'Metaliczne grzechotanie z prawej lub środkowej części silnika w zakresie 3000–5500 obr./min lub po odpuszczeniu gazu (typowe dla CBR 600 F4/F4i, Hornet, FZ6, GSX-R 600, Daytona 675).',
          steps: [
            'Za pomocą stetoskopu osłuchaj okolicę tunelu łańcucha rozrządu i korpusu napinacza (CCT) przy schodzeniu z obrotów.',
            'Sprawdź znaki na kołach wałków rozrządu względem znaku T na wale korbowym — rozciągnięty łańcuch powoduje opóźnienie faz wałków względem wału.',
            'Wyjmij napinacz (po wcześniejszym zablokowaniu wału w GMP!) i sprawdź wysunięcie trzpienia, stan sprężyny skrętnej/zapadki oraz zużycie okładzin ślizgów.'
          ],
          evaluation: 'Całkowite wysunięcie napinacza oznacza zużyty łańcuch rozrządu. Uszkodzona sprężyna napinacza przy sprawnym łańcuchu powoduje niebezpieczny luz i ryzyko przeskoczenia rozrządu o 1–2 zęby.'
        },
        {
          id: 'A9',
          name: 'Diagnostyka uszczelki pod głowicą (UPG) i płaszczyzny bloku',
          tools: 'Tester obecności CO₂ w układzie chłodzenia, próba Leak Down, liniał krawędziowy precyzyjny + szczelinomierz 0.03–0.05 mm',
          when: 'Wyrzucanie płynu chłodniczego do zbiorniczka wyrównawczego, twarde węże chłodnicy zaraz po rozruchu, para z wydechu lub emulsja wodno-olejowa („masło”) pod korkiem oleju.',
          steps: [
            'Na zimnym silniku zdejmij korek chłodnicy, zamontuj tester reakcyjny CO₂ i uruchom silnik — zmiana koloru płynu z niebieskiego na żółty/zielony potwierdza przedostawanie się spalin do płaszcza wodnego.',
            'Wykonaj pomiar kompresji sąsiednich cylindrów (np. Cyl 1–2 lub Cyl 2–3) — symetrycznie niska kompresja na dwóch sąsiednich cylindrach wskazuje na przepalenie mostka uszczelki.',
            'Po zdjęciu głowicy zmierz odkształcenie płaszczyzny głowicy i bloku liniałem krawędziowym po przekątnych.'
          ],
          evaluation: 'Jakakolwiek obecność CO₂ w płynie chłodniczym lub odkształcenie głowicy przekraczające limit serwisowy (zwykle 0.05 mm) wymaga planowania głowicy i montażu nowej uszczelki wielowarstwowej MLS.'
        },
        {
          id: 'A10',
          name: 'Kontrola ciśnienia oleju i układu smarowania',
          tools: 'Manometr ciśnienia oleju 0–10 bar z adapterem gwintowym (M14×1.5 / 1/8" BSPT), termometr serwisowy',
          when: 'Mruganie lub świecenie kontrolki ciśnienia oleju, głośna praca góry silnika, po naprawie głównej lub wymianie pompy oleju.',
          steps: [
            'Sprawdź poziom i lepkość oleju oraz brak rozcieńczenia oleju benzyną (powąchaj bagnet/wlew — nieszczelne zaworki iglicowe gaźników potrafią zalać karter paliwem!).',
            'Wykręć czujnik ciśnienia oleju z magistrali głównej i wkręć manometr warsztatowy.',
            'Rozgrzej silnik do temperatury pomiarowej (80–90°C) i odczytaj ciśnienie na biegu jałowym oraz przy obrotach pomiarowych określonych w DTR.'
          ],
          evaluation: 'Zbyt niskie ciśnienie oleju grozi natychmiastowym zatarciem panewek korbowodowych na czopach wału (szczególnie Cyl 2 i 3). Sprawdź smok olejowy w misce, zawór przelewowy i luz rotora pompy.'
        }
      ]
    },
    {
      id: 'B',
      code: 'DZIAŁ B',
      title: 'UKŁAD PALIWOWY (GAŹNIKI & EFI)',
      color: '#10b981',
      icon: '⛽',
      summary: 'Baterie 3–4 gaźników, synchronizacja podciśnień, poziomy pływaków, dysze i iglice, zaworki iglicowe, ssanie, króćce dolotowe, wtryskiwacze EFI, pompa i regulator ciśnienia, czujniki MAP/TPS/IAT.',
      procedures: [
        {
          id: 'B1',
          name: 'Kompleksowa rewizja baterii 3–4 gaźników',
          tools: 'Myjka ultradźwiękowa, zmywacz do gaźników, zestaw wkrętaków JIS (Japanese Industrial Standard!), sprężone powietrze z regulacją',
          when: 'Po dłuższym postoju motocykla, nierówna praca na wolnych obrotach, dławienie przy dodawaniu gazu, strzały w tłumik lub dolot.',
          steps: [
            'Zdemontuj baterię gaźników z króćców ssących (podgrzej gumowe króćce opalarką do 45°C, aby ich nie połamać). Używaj wkrętaków JIS, by nie objechać śrub komór pływakowych.',
            'Rozbierz każdy gaźnik osobno do dedykowanego pojemnika (Gaźnik 1, 2, 3, 4) — w niektórych modelach dysze główne lub iglice na skrajnych cylindrach (1/4) różnią się od środkowych (2/3)!',
            'Wyjmij wszystkie elementy gumowe (membrany podciśnieniowe, O-ringi śrub składu mieszanki) przed kąpielą w myjce ultradźwiękowej.',
            'Przedmuchaj i sprawdź drożność kanałów powietrza biegu jałowego, dysz wolnych obrotów (pilot jet) oraz rurek emulsyjnych.'
          ],
          evaluation: 'Nawet częściowo przytkana dysza wolnych obrotów (#35–#40 ma prześwit ok. 0.35 mm!) wyłącza cylinder z pracy na biegu jałowym, mimo że przy wysokich obrotach na dyszy głównej cylinder zaczyna pracować.'
        },
        {
          id: 'B2',
          name: 'Synchronizacja 3–4 gaźników i przepustnic wtryskowych (TB Sync)',
          tools: 'Wakuometr 4-kanałowy (słupkowy rtęciowy/cieczowy, zegarowy z tłumikami drgań lub elektroniczny), długi wkrętak kątowy do śrub synchronizacji, zewnętrzna butelka paliwowa (kroplówka)',
          when: 'Szarpnięcia przy małym otwarciu gazu, powolne schodzenie z obrotów, wibracje silnika, po każdej regulacji zaworów lub czyszczeniu gaźników/przepustnic.',
          steps: [
            'WARUNEK WSTĘPNY: Przed synchronizacją muszą być sprawdzone luzy zaworowe, szczelność króćców dolotowych oraz ustawione obroty jałowe na rozgrzanym silniku.',
            'Podłącz 3 lub 4 przewody wakuometru do króćców pomiarowych w kolektorach ssących (Cyl 1, 2, 3, [4]).',
            'W bateriach 4-gaźnikowych najpierw wyrównaj parę lewą (Cyl 1 z Cyl 2 śrubą lewą), następnie parę prawą (Cyl 3 z Cyl 4 śrubą prawą), a na końcu zsynchronizuj obie pary ze sobą śrubą centralną względem gaźnika bazowego.',
            'Po każdym obrocie śruby przegazuj lekko manetką (2500–3000 obr./min) i pozwól przepustnicom osiąść na zderzakach.'
          ],
          evaluation: 'Dopuszczalna różnica podciśnienia pomiędzy wszystkimi cylindrami nie powinna przekraczać 10–15 mmHg (ok. 1.3–2.0 kPa). Po synchronizacji skoryguj obroty biegu jałowego.'
        },
        {
          id: 'B3',
          name: 'Pomiar wysokości pływaków i rzeczywistego poziomu paliwa',
          tools: 'Suwmiarka głębokościowa, przezroczysty wężyk pomiarowy z adapterem do śruby spustowej komory pływakowej',
          when: 'Zalewanie świec, czarne zadymienie (zbyt wysoki poziom), brak mocy na wysokich obrotach lub gaśnięcie po ostrej jeździe (zbyt niski poziom).',
          steps: [
            'Metoda statyczna (wysokość pływaka): Przechyl gaźnik pod kątem ~45°, tak aby języczek pływaka jedynie musnął amortyzowany trzpień zaworka iglicowego (bez jego wciskania!) i zmierz odległość od przylgni komory do szczytu pływaka.',
            'Metoda dynamiczna (rzeczywisty poziom paliwa): Na zamontowanych gaźnikach podłącz przezroczysty wężyk do króćca spustowego, otwórz śrubę spustową i unieś wężyk obok linii podziału komory pływakowej.'
          ],
          evaluation: 'Wszystkie 3 lub 4 gaźniki muszą mieć identyczny poziom paliwa (z dokładnością do ±0.5–1.0 mm względem specyfikacji modelu). Różnice poziomów uniemożliwiają równą pracę silnika w całym zakresie obciążeń.'
        },
        {
          id: 'B4',
          name: 'Weryfikacja dysz głównych, dysz wolnych obrotów, iglic i rurek emulsyjnych',
          tools: 'Lupa warsztatowa 10×, mikrometr do iglic, przymiary kalibracyjne (bez rozpychania otworów!)',
          when: 'Dziura w przyspieszeniu w średnim zakresie (4000–7000 obr./min), przerywanie przy pełnym otwarciu gazu, po montażu przelotowego wydechu.',
          steps: [
            'Odczytaj oznaczenia wybitych rozmiarów dysz głównych (Main Jet) i wolnych obrotów (Pilot Jet) na każdym cylindrze i porównaj z katalogiem modelu.',
            'Sprawdź rurki emulsyjne (rozpylacze) pod kątem owalizacji otworu przez pracującą w nich iglicę — wyrobiona rurka emulsyjna silnie wzbogaca mieszankę w średnim zakresie obrotów!',
            'Sprawdź położenie zapinki na iglicy (jeśli regulowana) oraz stan stożka śruby składu mieszanki (Pilot Screw) wraz z podkładką i O-ringiem.'
          ],
          evaluation: 'Nigdy nie czyść dysz stalowym drutem — porysowanie kalibrowanego otworu zmienia charakterystykę przepływu paliwa.'
        },
        {
          id: 'B5',
          name: 'Test szczelności zaworków iglicowych i gniazd pływakowych',
          tools: 'Pompka ciśnieniowa/podciśnieniowa Mityvac z manometrem (0.2–0.3 bar), wacik polerski do gniazd mosiężnych',
          when: 'Wyciek paliwa przez przelew gaźników, zapach benzyny w oleju silnikowym, zalewanie jednego cylindra po postoju.',
          steps: [
            'Oceń gumowy stożek zaworka iglicowego pod lupą — widoczny wygnieciony pierścień (rowek) na stożku kwalifikuje zaworek do wymiany.',
            'W gaźnikach z wymiennymi gniazdami zaworków wymień O-ring zewnętrzny gniazda mosiężnego (często paliwo cieknie bokiem wokół gniazda, a nie przez sam zaworek!).',
            'Po złożeniu wykonaj test utrzymania ciśnienia na króćcu zasilającym baterii gaźników.'
          ],
          evaluation: 'Nieszczelny zaworek iglicowy przy uszkodzonym kraniku podciśnieniowym potrafi przelać paliwo przez cylinder do skrzyni korbowej, powodując rozrzedzenie oleju lub blokadę hydrauliczną (hydrolock).'
        },
        {
          id: 'B6',
          name: 'Kontrola układu rozruchowego (ssania / Enrichener / Fast Idle)',
          tools: 'Szczelinomierz, smar silikonowy/PTFE, wakuometr',
          when: 'Silnik nie wchodzi na podwyższone obroty po włączeniu ssania na zimno lub po wyłączeniu ssania zalewa wybrane cylindry i nie trzyma wolnych obrotów.',
          steps: [
            'Sprawdź płynność przesuwu wspólnej listwy ssania łączącej wszystkie 3–4 gaźniki.',
            'Wykręć tłoczki ssania (plunger) z każdego gaźnika: sprawdź stan gumowego uszczelniacza na czole tłoczka oraz czystość gniazda.',
            'Po cofnięciu dźwigni ssania upewnij się, że na każdym gaźniku pozostaje ok. 1–2 mm luzu na listwie i żaden tłoczek nie jest podciągnięty.'
          ],
          evaluation: 'Zapieczony tłoczek ssania w jednym gaźniku powoduje permanentne zalewanie tego cylindra po rozgrzaniu (czarna świeca, wypadanie zapłonów na wolnych obrotach).'
        },
        {
          id: 'B7',
          name: 'Kontrola króćców ssących i test szczelności dolotu (lewe powietrze)',
          tools: 'Wytwornica dymu diagnostycznego lub zmywacz hamulcowy / tester szczelności (z zachowaniem BHP ppoż.!)',
          when: 'Obroty zawieszają się na 2500–3500 obr./min i bardzo wolno opadają, uboga mieszanka (białe świece), strzały w wydech przy zamykaniu gazu.',
          steps: [
            'Obejrzyj gumowe króćce ssące (szczególnie od spodu i przy obejmach zaciskowych) pod kątem spękań starzeniowych oraz odklejenia gumy od aluminiowej flanszy.',
            'Sprawdź obecność i stan gumowych zaślepek na króćcach do synchronizacji oraz wężyków podciśnienia (do kranika paliwa, czujnika MAP/IAP, zaworu PAIR/AIS).',
            'Na pracującym silniku wykonaj punktowy test szczelności każdego połączenia króciec–głowica oraz króciec–gaźnik/przepustnica.'
          ],
          evaluation: 'Każda zmiana obrotów biegu jałowego podczas testu punktowego oznacza zasysanie „lewego powietrza” poza przepustnicą i wymaga wymiany króćców lub O-ringów.'
        },
        {
          id: 'B8',
          name: 'Diagnostyka wtryskiwaczy EFI (rezystancja, wydatek, kształt strugi)',
          tools: 'Multimetr cyfrowy, stetoskop / oscyloskop, menzurki pomiarowe + generator impulsów do wtryskiwaczy',
          when: 'Wypadanie zapłonu na jednym cylindrze w silniku EFI, zimniejszy kolektor wydechowy przy obecnej iskrze i prawidłowej kompresji.',
          steps: [
            'Na pracującym silniku przyłóż stetoskop do każdego wtryskiwacza — powinieneś słyszeć wyraźne, rytmiczne klikanie iglicy. W silnikach Supersport 600 (np. CBR600RR, R6, ZX-6R, GSX-R600) pamiętaj o dwóch rzędach wtryskiwaczy (Primary + Secondary pod airboxem).',
            'Odłącz wtyczkę i zmierz rezystancję uzwojenia każdego wtryskiwacza w temperaturze 20°C (typowo 11.5–14.5 Ω dla wtryskiwaczy wysokoomowych).',
            'Sprawdź wydatek paliwa przez 15 sekund do 4 menzurek oraz kąt rozpylania mgły paliwowej (brak lania zwartym strumieniem).'
          ],
          evaluation: 'Różnica wydatku pomiędzy wtryskiwaczami w listwie nie powinna przekraczać 5%. Lejący lub przytkany wtryskiwacz poddaj czyszczeniu ultradźwiękowemu z płukaniem wstecznym lub wymień.'
        },
        {
          id: 'B9',
          name: 'Kontrola pompy paliwa i filtrów (niskiego / wysokiego ciśnienia)',
          tools: 'Manometr ciśnienia paliwa z trójnikiem, multimetr (pomiar poboru prądu pompy), cylinder miarowy',
          when: 'Motocykl nie odpala (brak buczenia pompy po przekręceniu kluczyka), dławi się powyżej 8000–10000 obr./min pod pełnym obciążeniem.',
          steps: [
            'Po włączeniu zapłonu i przełącznika RUN nasłuchuj 2–3 sekundowego cyklu nabijania ciśnienia przez pompę paliwa.',
            'W starszych modelach gaźnikowych z pompą stykową (np. CBR600F2/F3, ZZR600, FZR600, Thundercat) sprawdź stan styków przerywacza pod czarną kopułką pompy Mitsubishi.',
            'W układach EFI zmierz ciśnienie na listwie wtryskowej (zwykle 3.0–3.5 bar) oraz sprawdź, czy nie spada ono przy gwałtownym otwarciu przepustnicy.'
          ],
          evaluation: 'Spadek ciśnienia paliwa pod obciążeniem wskazuje na przytkane sitko/filtr w module zbiornika lub zużyty komutator pompy paliwa.'
        },
        {
          id: 'B10',
          name: 'Test regulatora ciśnienia paliwa (FPR)',
          tools: 'Manometr paliwowy, pompka podciśnieniowa Mityvac',
          when: 'Czarny dym z wszystkich cylindrów w silniku EFI, trudny rozruch na ciepło, benzyna w wężyku podciśnieniowym regulatora.',
          steps: [
            'W układach z regulatorem podciśnieniowym na listwie zdejmij cienki wężyk podciśnienia z króćca regulatora — obecność choćby kropli paliwa w tym wężyku oznacza pękniętą membranę regulatora (paliwo jest zasysane bezpośrednio do cylindra!).',
            'Sprawdź utrzymanie ciśnienia resztkowego w układzie przez 5 minut po wyłączeniu zapłonu.'
          ],
          evaluation: 'Uszkodzony regulator zawyża lub zaniża ciśnienie na całej listwie, rozstrajając dawkę paliwa na wszystkich cylindrach jednocześnie.'
        },
        {
          id: 'B11',
          name: 'Diagnostyka czujników układu dolotowego (TPS, MAP/IAP, IAT)',
          tools: 'Multimetr cyfrowy o wysokiej impedancji, oscyloskop (do testu płynności ścieżki TPS)',
          when: 'Szarpnięcia przy przejściu z zamkniętego na lekko otwarty gaz, błędy FI/MIL na zestawie wskaźników, nieprawidłowa korekta dawki.',
          steps: [
            'Czujnik położenia przepustnicy (TPS): Zmierz napięcie zasilania (5.0 V ± 0.1 V) oraz napięcie sygnałowe przy powolnym otwieraniu manetki od 0% do 100% (typowo płynny wzrost od ~0.5–1.1 V do ~4.2–4.8 V bez żadnych przeskoków i przerw).',
            'Czujnik ciśnienia w kolektorze (MAP/IAP): Sprawdź szczelność cienkich wężyków podciśnieniowych łączących gardziele z czujnikiem (często parcieją lub spadają pod airboxem!).',
            'Czujnik temperatury powietrza dolotowego (IAT): Zmierz rezystancję termistora NTC w funkcji temperatury otoczenia.'
          ],
          evaluation: 'Wytarta ścieżka potencjometru TPS w dolnym zakresie otwarcia (5–15%) powoduje gwałtowne szarpanie w ruchu miejskim, często nie zapisując jeszcze błędu w pamięci ECU.'
        }
      ]
    },
    {
      id: 'C',
      code: 'DZIAŁ C',
      title: 'UKŁAD ZAPŁONOWY (WASTED SPARK & COP)',
      color: '#38bdf8',
      icon: '⚡',
      summary: 'Świece zapłonowe, cewki podwójne (1–4 / 2–3) oraz fajkocewki COP, przewody WN i fajki z rezystorem, czujnik CKP (Pickup) i CMP, moduły CDI/TCI/ECU, brak iskry i wypadanie zapłonów.',
      procedures: [
        {
          id: 'C1',
          name: 'Ocena stanu świec zapłonowych i dobór ciepłoty',
          tools: 'Szczelinomierz drutowy do świec, klucz dynamometryczny (11–18 Nm zależnie od gwintu M10/M12), lupa',
          when: 'Wypadanie zapłonów, trudny rozruch, po zalaniu silnika paliwem (świece w silnikach R4 600 cm³ typu CR9E/CR9EH-9 są bardzo wrażliwe na zalanie na zimno!).',
          steps: [
            'Porównaj kolor izolatora wszystkich 3 lub 4 świec ułożonych w kolejności cylindrów: jasnobrązowy/szarobrązowy = prawidłowy; czarny matowy/mokry = zalanie lub brak iskry; kredowobiały ze stopioną elektrodą = niebezpiecznie uboga mieszanka lub nieszczelny dolot.',
            'Sprawdź odstęp elektrod (zwykle 0.6–0.9 mm zgodnie z katalogiem modelu) oraz rezystancję wewnętrznego opornika przeciwzakłóceniowego (dla świec z literą „R” typowo 3.5–7.5 kΩ).',
            'Sprawdź izolator ceramiczny pod kątem pionowych czarnych linii przebicia elektrycznego.'
          ],
          evaluation: 'Świeca raz silnie zalana benzyną w silniku 4-cylindrowym często dostaje przebicia po izolatorze pod ciśnieniem sprężania, mimo że po wyjęciu na zewnątrz daje widoczną iskrę!'
        },
        {
          id: 'C2',
          name: 'Diagnostyka cewek podwójnych (Wasted Spark 1–4 / 2–3) oraz fajkocewek COP',
          tools: 'Multimetr cyfrowy, iskrownik testowy z regulowaną przerwą (tester długości iskry)',
          when: 'Brak pracy pary cylindrów (1 i 4 lub 2 i 3 w układzie Wasted Spark) albo pojedynczego cylindra w układzie COP (Coil-On-Plug), przerywanie po rozgrzaniu cewek.',
          steps: [
            'W układzie klasycznym (2 cewki podwójne dla R4): Cewka nr 1 obsługuje zazwyczaj cylindry skrajne (1 i 4), a Cewka nr 2 cylindry środkowe (2 i 3). Zmierz rezystancję uzwojenia pierwotnego pomiędzy pinami zasilania (typowo 1.8–4.5 Ω) oraz wtórnego pomiędzy dwoma wyjściami WN (typowo 10–25 kΩ bez fajek).',
            'W układzie indywidualnych fajkocewek COP: Zmierz rezystancję pierwotną (zwykle 0.8–2.2 Ω) i wykonaj test zamiany miejscami fajkocewek pomiędzy cylindrem sprawnym a niedziałającym.',
            'Sprawdź obudowę fajkocewek COP pod kątem mikropęknięć epoksydu i białego nalotu przebicia do ścianki gniazda w głowicy.'
          ],
          evaluation: 'Jeżeli po zamianie fajkocewki COP z Cyl 1 na Cyl 2 usterka (zimny kolektor / wypadanie zapłonu) przenosi się na Cyl 2, fajkocewka jest uszkodzona.'
        },
        {
          id: 'C3',
          name: 'Kontrola przewodów wysokiego napięcia i fajek z rezystorem',
          tools: 'Omomierz, środek dielektryczny do osłon gumowych',
          when: 'Przerywanie silnika podczas jazdy w deszczu lub dużej wilgotności, wypadanie zapłonu na pojedynczym cylindrze przy układzie z cewkami podwójnymi.',
          steps: [
            'Wykręć fajkę z przewodu WN i zmierz samą rezystancję opornika wewnątrz fajki (typowo 5 kΩ lub 10 kΩ zależnie od producenta — wartość jest często wybita na korpusie fajki NGK/Nichirin).',
            'Sprawdź końcówkę miedzianego rdzenia przewodu WN — jeśli jest zielona i skorodowana, przytnij przewód o 5 mm i wkręć fajkę w zdrowy rdzeń.',
            'Sprawdź gumowe uszczelnienie górne fajki chroniące głęboki kanał świecy w głowicy DOHC przed zalaniem wodą.'
          ],
          evaluation: 'Nieskończona rezystancja (OL) lub wartość >20 kΩ w fajce 5 kΩ powoduje osłabienie iskry i obciążenie termiczne cewki zapłonowej.'
        },
        {
          id: 'C4',
          name: 'Pomiar czujnika położenia wału korbowego (CKP / Pickup Coil)',
          tools: 'Multimetr z adapterem napięcia szczytowego (Peak Voltage Adapter) lub oscyloskop, szczelinomierz niemagnetyczny',
          when: 'Całkowity brak iskry na wszystkich cylindrach i brak wysterowania pompy/wtryskiwaczy podczas kręcenia rozrusznikiem.',
          steps: [
            'Rozepnij złącze czujnika CKP (impulsatora) i zmierz jego rezystancję w temperaturze 20°C oraz ponownie na gorącym silniku (częsta usterka: czujnik przerywa dopiero po rozgrzaniu oleju do 80°C!).',
            'Sprawdź brak zwarcia któregokolwiek z przewodów czujnika CKP do masy silnika (musi być OL / ∞).',
            'Podczas kręcenia rozrusznikiem zmierz napięcie szczytowe (Peak Voltage) generowane przez czujnik indukcyjny — powinno wynosić minimum 0.7–1.5 V_peak.'
          ],
          evaluation: 'Opiłki metalu przyklejone do magnetycznego rdzenia czujnika CKP lub uszkodzone uzwojenie powodują utratę synchronizacji zapłonu i nagłe gaśnięcie silnika.'
        },
        {
          id: 'C5',
          name: 'Diagnostyka czujnika położenia wałka rozrządu (CMP / Cam Sensor)',
          tools: 'Multimetr, oscyloskop 2-kanałowy (synchronizacja CKP + CMP)',
          when: 'Długie kręcenie rozrusznikiem przed zapłonem w silnikach EFI z sekwencyjnym wtryskiem, błąd czujnika CMP (np. kod 11 w Suzuki/Yamaha, kod 18 w Hondzie).',
          steps: [
            'Dla czujnika Halla (3-przewodowego): sprawdź zasilanie (5 V lub 12 V), masę czujnikową oraz przełączanie sygnału wyjściowego (0 V ↔ 5 V) podczas obracania wałem.',
            'Dla czujnika indukcyjnego (2-przewodowego): zmierz rezystancję uzwojenia oraz napięcie szczytowe przy rozruchu.'
          ],
          evaluation: 'Uszkodzenie czujnika CMP uniemożliwia ECU rozpoznanie, który z dwóch bliźniaczych cylindrów (np. 1 czy 4) jest w suwie sprężania, a który w suwie wydechu.'
        },
        {
          id: 'C6',
          name: 'Kontrola koła impulsowego (rotora impulsatora) i szczeliny powietrznej',
          tools: 'Szczelinomierz niemagnetyczny (mosiężny), klucz dynamometryczny',
          when: 'Po wywrotce motocykla na bok (pęknięty dekiel impulsatora), po pracach przy sprzęgle lub alternatorze.',
          steps: [
            'Sprawdź tarczę impulsową (trigger wheel) pod kątem skrzywienia zębów znacznikowych oraz stan wpustu (klina) ustalającego tarczę na czopie wału korbowego.',
            'Zmierz szczelinę powietrzną pomiędzy wypustem rotora a czołem czujnika CKP (typowo 0.4–0.9 mm).'
          ],
          evaluation: 'Ścięty klin na wale korbowym lub wygięty ząb koła impulsowego przesuwa kąt wyprzedzenia zapłonu na wszystkich cylindrach.'
        },
        {
          id: 'C7',
          name: 'Weryfikacja zasilania i mas modułu zapłonowego CDI / TCI / ECU',
          tools: 'Multimetr cyfrowy, żarówka próbnikowa 21W (test mas i zasilania pod obciążeniem)',
          when: 'Brak iskry mimo sprawnych cewek i czujnika CKP, zanik zapłonu przy wjechaniu w nierówność.',
          steps: [
            'Sprawdź napięcie zasilania +12V po wyłączniku awaryjnym (Kill Switch) bezpośrednio na pinie wtyczki modułu TCI/ECU oraz na przewodach zasilających cewki zapłonowe (zwykle czarno-biały lub czerwono-czarny).',
            'Sprawdź obwód blokad bezpieczeństwa (Safety Interlock): czujnik stopki bocznej, czujnik luzu (Neutral), czujnik klamki sprzęgła oraz czujnik przechyłu (Tip-Over / Bank Angle Sensor w motocyklach EFI).',
            'W motocyklach Honda (HISS), Yamaha, Kawasaki i Ducati sprawdź kontrolkę immobilizera przy włączaniu zapłonu.'
          ],
          evaluation: 'Spadek napięcia na wyłączniku Kill Switch lub stacyjce powyżej 0.5–0.8 V obniża energię iskry dokładnie w momencie kręcenia rozrusznikiem.'
        },
        {
          id: 'C8',
          name: 'Procedura szybkiej lokalizacji braku iskry (1 cylinder vs para 1–4 / 2–3 vs wszystkie)',
          tools: 'Tester iskry, multimetr',
          when: 'Silnik nie odpala lub pracuje na niepełnej liczbie cylindrów z powodu usterki zapłonu.',
          steps: [
            'PRZYPADEK 1 — Brak iskry na WSZYSTKICH cylindrach: Sprawdź Kill Switch, bezpiecznik Ignition, czujnik CKP, czujnik przechyłu (Tip-Over), blokadę stopki bocznej oraz zasilanie i masę ECU/TCI.',
            'PRZYPADEK 2 — Brak iskry na PARZE cylindrów (1 i 4 lub 2 i 3 w R4): Sprawdź wspólną cewkę zapłonową tej pary, przewód sterujący z modułu TCI/ECU do tej cewki lub końcówkę mocy tego kanału w module.',
            'PRZYPADEK 3 — Brak iskry na JEDNYM cylindrze: Sprawdź świecę zapłonową, fajkę z rezystorem, pojedynczy przewód WN lub pojedynczą fajkocewkę COP tego cylindra.'
          ],
          evaluation: 'Podział na 1 cylinder / parę bliźniaczą (1-4 lub 2-3) / wszystkie cylindry skraca czas diagnozy w silniku wielocylindrowym o 80%.'
        },
        {
          id: 'C9',
          name: 'Diagnostyka wypadania zapłonów (Misfire) pod obciążeniem i w wyższych obrotach',
          tools: 'Termometr pirometryczny IR, tester długości iskry (przerwa 6–8 mm), multimetr',
          when: 'Na wolnych obrotach silnik pracuje poprawnie, ale przy gwałtownym otwarciu gazu lub powyżej 7000 obr./min przerywa i dławi się.',
          steps: [
            'Sprawdź zdolność układu do przeskoku iskry na testerze z przerwą 6–8 mm — w cylindrze przy wysokim ciśnieniu sprężania potrzebne jest znacznie wyższe napięcie przebicia niż na wolnym powietrzu.',
            'Zmierz napięcie ładowania i napięcie na cewkach przy 5000 obr./min.',
            'Sprawdź świece pod kątem zużycia (zaokrąglenia) krawędzi elektrody środkowej oraz stanu gumowych osłon fajkocewek COP.'
          ],
          evaluation: 'Osłabiona cewka lub przebicie na fajce ujawnia się najpierw przy maksymalnym napełnieniu cylindra (duże otwarcie przepustnicy w średnich obrotach).'
        },
        {
          id: 'C10',
          name: 'Kontrola wyprzedzenia zapłonu w starszych i nowszych generacjach',
          tools: 'Lampa stroboskopowa indukcyjna',
          when: 'Brak mocy w górnym zakresie obrotów, przegrzewanie kolektorów wydechowych, spalanie stukowe.',
          steps: [
            'Wyjmij korek wziernika znaków na pokrywie impulsatora/alternatora.',
            'Podłącz sondę indukcyjną lampy stroboskopowej na przewód WN cylindra nr 1.',
            'Na biegu jałowym znak „F” (Fire) powinien pokrywać się ze znakiem na karterze, a po zwiększeniu obrotów powyżej 3000–4000 obr./min punkt zapłonu powinien płynnie przesunąć się na znaki wyprzedzenia dynamicznego.'
          ],
          evaluation: 'Brak przesuwu kąta wyprzedzenia zapłonu ze wzrostem obrotów wskazuje na uszkodzenie układu wyprzedzenia w module CDI/TCI lub błędny sygnał z czujnika TPS.'
        }
      ]
    },
    {
      id: 'D',
      code: 'DZIAŁ D',
      title: 'UKŁAD CHŁODZENIA',
      color: '#06b6d4',
      icon: '🌡️',
      summary: 'Chłodnica, pompa wody, termostat, wentylator i termoswitch, czujnik temperatury ECT, korek ciśnieniowy chłodnicy, próba szczelności, diagnostyka przegrzewania.',
      procedures: [
        {
          id: 'D1',
          name: 'Kontrola drożności chłodnicy (wewnętrznej i zewnętrznej)',
          tools: 'Pirometr IR (mapa termiczna rdzenia), sprężone powietrze / myjka niskociśnieniowa, grzebień do lameli',
          when: 'Wzrost temperatury podczas jazdy z prędkością przelotową, nierównomierny rozkład temperatury na powierzchni chłodnicy.',
          steps: [
            'Sprawdź stan zewnętrzny lameli chłodnicy (szczególnie w centralnym pasie za przednim kołem — błoto, owady i kamienie potrafią zablokować 40% przepływu powietrza). Myj wyłącznie prostopadle do rdzenia od strony wewnętrznej na zewnątrz!',
            'Po rozgrzaniu silnika i otwarciu termostatu zmierz pirometrem IR temperaturę górnej, środkowej i dolnej części chłodnicy.',
            'Zimne plamy w dolnej części gorącej chłodnicy świadczą o zakamienieniu rurek rdzenia (po stosowaniu wody kranowej zamiast płynu do chłodnic aluminiowych).'
          ],
          evaluation: 'Zablokowane lub pozaginane lamele chłodnicy w obudowanym motocyklu klasy Supersport 600 drastycznie obniżają odprowadzanie ciepła.'
        },
        {
          id: 'D2',
          name: 'Diagnostyka pompy wody, wirnika i uszczelnienia mechanicznego',
          tools: 'Lusterko inspekcyjne, klucz dynamometryczny',
          when: 'Wyciek płynu chłodniczego lub oleju z otworu kontrolnego (weep hole) pod korpusem pompy wody, przegrzewanie przy sprawnej chłodnicy i termostacie.',
          steps: [
            'Zlokalizuj mały otwór drenażowy (kontrolny) w dolnej części korpusu pompy wody: ślady płynu chłodniczego oznaczają zużycie uszczelnienia mechanicznego (ceramika/grafit), a wyciek oleju oznacza zużycie simeringu olejowego wałka pompy.',
            'Nigdy nie zaślepiaj otworu kontrolnego pompy wody — w razie zatkania płyn chłodniczy przedostanie się bezpośrednio do oleju silnikowego!',
            'Po zdjęciu pokrywy pompy sprawdź stan łopatek wirnika oraz napęd wałka pompy (często napędzany z wałka pompy oleju lub wałka wyrównoważającego).'
          ],
          evaluation: 'Korozja łopatek wirnika lub ścięcie płetwy napędowej wałka pompy zatrzymuje obieg płynu chłodniczego w silniku.'
        },
        {
          id: 'D3',
          name: 'Test termostatu (temperatura początku otwarcia i pełnego skoku)',
          tools: 'Naczynie z wodą, termometr laboratoryjny 0–110°C, suwmiarka',
          when: 'Silnik bardzo długo się nagrzewa w chłodne dni (termostat zablokowany w pozycji otwartej) lub gwałtownie się przegrzewa przy zimnej chłodnicy (zablokowany w pozycji zamkniętej).',
          steps: [
            'Na zamontowanym silniku kontroluj temperaturę węża prowadzącego od obudowy termostatu do chłodnicy: powinien pozostawać chłodny aż do osiągnięcia ok. 80–84°C, po czym gwałtownie zrobić się gorący.',
            'Po wyjęciu termostatu zawieś go na nitce w naczyniu z podgrzewaną wodą (nie może dotykać dna!) i obserwuj temperaturę początku otwarcia (zwykle 80–84°C) oraz pełny skok zaworu przy 95°C (minimum 8 mm).'
          ],
          evaluation: 'Termostat otwierający się zbyt późno lub o skoku mniejszym niż 8 mm dławi przepływ płynu i musi zostać wymieniony wraz z O-ringiem obudowy.'
        },
        {
          id: 'D4',
          name: 'Kontrola wentylatora chłodnicy, przekaźnika i wyłącznika termicznego',
          tools: 'Multimetr cyfrowy, przewód mostkujący z bezpiecznikiem 15A',
          when: 'Temperatura płynu w korku ulicznym przekracza 104–106°C, a wentylator chłodnicy nie uruchamia się.',
          steps: [
            'Obróć ręcznie śmigło wentylatora na wyłączonym zapłonie — musi obracać się lekko, bez zacięć (częsta usterka: mały kamyk spod koła klinuje łopatki wentylatora i przepala bezpiecznik FAN!).',
            'W starszych modelach z wyłącznikiem bimetalicznym (Thermoswitch) wkręconym w chłodnicę: zmostkuj wtyczkę czujnika przy włączonym zapłonie — jeśli wentylator ruszy, uszkodzony jest wyłącznik termiczny lub w górnej części chłodnicy jest korek powietrzny.',
            'W nowszych modelach EFI (gdzie wentylatorem steruje ECU na podstawie czujnika ECT): sprawdź przekaźnik wentylatora, bezpiecznik oraz odczyt temperatury ECT.'
          ],
          evaluation: 'W motocyklach 4-cylindrowych 600 cm³ wentylator załącza się standardowo dość wysoko: przy 100–105°C i wyłącza przy ok. 95–98°C.'
        },
        {
          id: 'D5',
          name: 'Pomiar czujnika temperatury płynu chłodniczego (ECT)',
          tools: 'Multimetr (pomiar Ω i V), termometr referencyjny',
          when: 'Błędne wskazania temperatury na desce rozdzielczej, brak załączania wentylatora lub zalewanie ciepłego silnika EFI (ECU „widzi” −20°C i wzbogaca dawkę jak na mrozie!).',
          steps: [
            'Zmierz rezystancję czujnika ECT (termistor NTC) na zimnym silniku (ok. 20°C — typowo 2.2–2.8 kΩ) oraz na gorącym silniku (ok. 80°C — typowo 250–350 Ω).',
            'W niektórych modelach czujnik posiada 3 piny lub dwa osobne uzwojenia: jedno dla ECU, a drugie dla wskaźnika na zegarach.'
          ],
          evaluation: 'Przerwa w obwodzie czujnika ECT powoduje przejście ECU w tryb awaryjny (często natychmiastowe uruchomienie wentylatora na stałe i zapalenie kontrolki FI).'
        },
        {
          id: 'D6',
          name: 'Test korka ciśnieniowego chłodnicy (1.1 bar / 108–122 kPa)',
          tools: 'Pompka ciśnieniowa z adapterem do badania korków chłodnicy',
          when: 'Zbyt wczesne gotowanie płynu (już przy 100°C), wyrzucanie płynu do zbiorniczka wyrównawczego lub zasysanie na płasko węży chłodnicy po ostygnięciu silnika.',
          steps: [
            'Sprawdź stan obu uszczelek gumowych korka: dolnej (zawór nadciśnieniowy ~1.1 bar) oraz małego talerzyka środkowego (zawór podciśnieniowy powrotny).',
            'Zamontuj korek na testerze ciśnieniowym: zawór musi utrzymać ciśnienie znamionowe wybitym na korku (np. 1.1 bar / 108 kPa) przez minimum 10 sekund.'
          ],
          evaluation: 'Nieszczelny korek obniża temperaturę wrzenia płynu o ok. 15–20°C (brak nadciśnienia w układzie). Zablokowany zaworek zwrotny uniemożliwia zassanie płynu ze zbiorniczka wyrównawczego podczas stygnięcia.'
        },
        {
          id: 'D7',
          name: 'Próba ciśnieniowa szczelności układu chłodzenia i odpowietrzanie',
          tools: 'Tester ciśnieniowy układu chłodzenia',
          when: 'Ubywanie płynu chłodniczego bez widocznych plam pod motocyklem, zapach glikolu wokół gorącego silnika.',
          steps: [
            'Na zimnym silniku zamontuj pompkę ciśnieniową w miejsce korka chłodnicy i wytwórz ciśnienie robocze (1.1–1.2 bar — nie przekraczaj 1.3 bar!).',
            'Obserwuj manometr przez 5 minut i skontroluj opaski zaciskowe węży (szczególnie pod gaźnikami/przepustnicami, gdzie znajdują się króćce wodne w głowicy i rurki metalowe z O-ringami).',
            'Podczas napełniania układu odkręć śrubę odpowietrzającą przy obudowie termostatu/pompy wody i ugnieć grube węże, aby usunąć poduszki powietrzne.'
          ],
          evaluation: 'Poduszka powietrzna przy wyłączniku termicznym lub w głowicy powoduje lokalne wrzenie płynu mimo pozornie prawidłowego poziomu w zbiorniczku wyrównawczym.'
        },
        {
          id: 'D8',
          name: 'Kompleksowa diagnostyka przegrzewania silnika wielocylindrowego',
          tools: 'Pirometr IR, tester ciśnieniowy, tester CO₂',
          when: 'Silnik przegrzewa się w korkach lub podczas jazdy szosowej.',
          steps: [
            'Rozróżnij warunki przegrzewania: (A) Przegrzewanie TYLKO na postoju/w korku = sprawdź wentylator, czujnik załączania, przekaźnik i poziom płynu.',
            '(B) Przegrzewanie podczas szybkiej jazdy = sprawdź drożność chłodnicy, pełne otwarcie termostatu, wirnik pompy wody, zbyt ubogą mieszankę paliwową lub przedmuch spalin przez uszczelkę głowicy (test CO₂).'
          ],
          evaluation: 'Zbyt uboga mieszanka lub opóźniony zapłon w silniku R4 znacząco podnoszą obciążenie cieplne głowicy i układu chłodzenia.'
        }
      ]
    },
    {
      id: 'E',
      code: 'DZIAŁ E',
      title: 'ELEKTRYKA I ŁADOWANIE',
      color: '#a855f7',
      icon: '🔋',
      summary: 'Alternator i stojan 3-fazowy, regulator napięcia (SCR/MOSFET), akumulator i test rozruchu, rozrusznik i sprzęgło jednokierunkowe, przekaźniki, bezpieczniki, wiązka, czujniki i ECU.',
      procedures: [
        {
          id: 'E1',
          name: 'Kompleksowa diagnostyka układu ładowania (14.0–14.8 V)',
          tools: 'Multimetr cyfrowy TrueRMS, miernik cęgowy prądu stałego DC',
          when: 'Rozładowywanie akumulatora w trakcie jazdy, przygasanie świateł, gaśnięcie silnika po włączeniu wentylatora chłodnicy lub przepalanie żarówek.',
          steps: [
            'Zmierz napięcie spoczynkowe w pełni naładowanego akumulatora (12.6–12.8 V).',
            'Uruchom silnik, włącz światła mijania i zmierz napięcie ładowania na klemach akumulatora przy 5000 obr./min: prawidłowy wynik to 13.8–14.8 V (optymalnie 14.0–14.5 V).',
            'Napięcie <13.5 V przy 5000 obr./min oznacza brak ładowania (sprawdź stojan i regulator); napięcie >15.0 V oznacza uszkodzenie regulatora napięcia (ryzyko zagotowania akumulatora i spalenia ECU!).'
          ],
          evaluation: 'W motocyklach Honda (CBR600F2/F3/F4/F4i, Hornet, VFR), Triumph (Daytona 675, Street Triple 675) oraz Suzuki GSX-R układ stojan–regulator–kostka 3-fazowa to punkt obowiązkowej kontroli przy każdym przeglądzie.'
        },
        {
          id: 'E2',
          name: 'Pomiar stojana 3-fazowego (uzwojenia Y1–Y2–Y3 i przebicie do masy)',
          tools: 'Multimetr cyfrowy (zakres niskich rezystancji Ω oraz napięcia zmiennego AC do 200 V)',
          when: 'Brak ładowania lub zaniżone napięcie ładowania po rozgrzaniu silnika.',
          steps: [
            'Rozepnij 3-pinową wtyczkę wychodzącą z lewego dekla silnika (3 żółte lub 3 białe przewody fazowe stojana).',
            'TEST 1 (Rezystancja międzyfazowa): Zmierz opór pomiędzy fazami 1–2, 2–3 oraz 1–3. Wszystkie 3 pomiary muszą być równe i wynosić 0.2–0.9 Ω (po odjęciu rezystancji przewodów miernika!).',
            'TEST 2 (Izolacja od masy — NAJWAŻNIEJSZY!): Zmierz rezystancję pomiędzy każdym z 3 pinów stojana a czystą masą bloku silnika. Wynik MUSI wynosić nieskończoność (OL). Jakakolwiek przejściówka do masy oznacza zwęglenie lakieru uzwojenia i konieczność wymiany stojana.',
            'TEST 3 (Napięcie jałowe AC): Na odpiętej wtyczce uruchom silnik i zmierz napięcie zmienne AC pomiędzy parami faz 1–2, 2–3 i 1–3 przy 5000 obr./min — powinno wynosić symetrycznie 60–85 V AC na każdej parze.'
          ],
          evaluation: 'Jeżeli na dwóch parach jest 70 V AC, a na trzeciej tylko 35 V AC — jedna faza stojana jest zwarta lub upalona.'
        },
        {
          id: 'E3',
          name: 'Test regulatora napięcia (stratny SCR vs MOSFET) i złączy wysokoprądowych',
          tools: 'Multimetr z funkcją testu diody, pirometr IR',
          when: 'Przeładowywanie akumulatora (>15 V), brak ładowania mimo sprawnego stojana lub stopiona kostka 3-fazowa pod owiewką/siedzeniem.',
          steps: [
            'Obejrzyj wtyczki regulatora napięcia: zaśniedziałe konektory 3 żółtych przewodów fazowych wytwarzają ogromną rezystancję przejścia, topiąc plastik kostki i niszcząc stojan.',
            'Na odpiętym regulatorze wykonaj test mostka prostowniczego (funkcja diody w multimetrze): w kierunku przewodzenia spadek napięcia między każdym pinem fazowym a wyjściem (+) oraz między masą (−) a każdym pinem fazowym powinien wynosić 0.45–0.65 V, a w kierunku zaporowym OL.',
            'Upewnij się, że aluminiowy radiator regulatora ma czysty styk termiczny z ramą i solidne połączenie masowe.'
          ],
          evaluation: 'Przy wymianie uszkodzonego regulatora tyrystorowego (SCR) warto zastosować nowoczesny regulator w technologii MOSFET (np. serii FH020AA) ze złączami hermetycznymi.'
        },
        {
          id: 'E4',
          name: 'Diagnostyka akumulatora i spadku napięcia podczas rozruchu',
          tools: 'Tester obciążeniowy akumulatora / multimetr z funkcją MIN/MAX',
          when: 'Rozrusznik kręci zbyt wolno, zegary resetują się przy naciśnięciu przycisku START, przekaźnik rozrusznika tylko „cyka”.',
          steps: [
            'Podłącz multimetr do klem akumulatora i obserwuj minimalne napięcie podczas kręcenia rozrusznikiem (przez 3 sekundy).',
            'Jeśli napięcie na w pełni naładowanym akumulatorze spada podczas rozruchu poniżej 9.6–10.0 V, akumulator utracił pojemność/prąd rozruchowy (zasiarczenie lub zwarcie celi).',
            'Zmierz pobór prądu spoczynkowego (upływność) przy wyłączonym zapłonie — nie powinien przekraczać 1.5–3.0 mA.'
          ],
          evaluation: 'Silniki 4-cylindrowe wymagają wysokiej prędkości obrotowej rozrusznika; spadek napięcia poniżej 9.5 V potrafi wyłączyć moduł zapłonowy TCI/ECU mimo że rozrusznik nadal obraca wałem.'
        },
        {
          id: 'E5',
          name: 'Kontrola rozrusznika, szczotek i sprzęgła jednokierunkowego (bendiksu)',
          tools: 'Multimetr (pomiar spadku napięcia na kablach prądowych), suwmiarka (długość szczotek)',
          when: 'Rozrusznik nie reaguje mimo kliknięcia przekaźnika, kręci bardzo ciężko na gorącym silniku lub słychać metaliczny zgrzyt i ślizganie przy rozruchu.',
          steps: [
            'Zmierz spadek napięcia pomiędzy dodatnią klemą akumulatora a śrubą prądową na rozruszniku podczas kręcenia (powinien być <0.5 V).',
            'Jeśli przekaźnik załącza napięcie na rozrusznik, a ten nie kręci — sprawdź zużycie szczotek węglowych (limit zwykle 6–7 mm) oraz czystość komutatora.',
            'Jeśli rozrusznik kręci z wysokim wyciem, a wał korbowy stoi lub zgrzyta — uszkodzone są rolki/sprężynki sprzęgła jednokierunkowego rozrusznika (Starter Clutch).'
          ],
          evaluation: 'Zużyte szczotki rozrusznika często uniemożliwiają domknięcie masy cewki przekaźnika rozrusznika w układach, gdzie obwód sterujący przechodzi przez wirnik.'
        },
        {
          id: 'E6',
          name: 'Diagnostyka przekaźnika rozrusznika, przekaźnika pompy paliwa i przekaźnika głównego',
          tools: 'Multimetr, zasilacz warsztatowy 12 V',
          when: 'Brak reakcji na przycisk START, brak zasilania pompy paliwa/wtryskiwaczy po włączeniu zapłonu.',
          steps: [
            'Na przekaźniku rozrusznika znajduje się zazwyczaj główny bezpiecznik 30A pod czerwoną osłoną wtyczki — wyjmij wtyczkę i sprawdź, czy konektory wokół bezpiecznika 30A nie są stopione!',
            'Sprawdź obecność napięcia 12 V i masy na cewce sterującej przekaźnika po naciśnięciu przycisku START (pamiętaj o wciśnięciu sprzęgła i biegu jałowym).'
          ],
          evaluation: 'Wypalone styki robocze przekaźnika klikają słyszalnie, ale nie przewodzą prądu rzędu 80–120 A do rozrusznika.'
        },
        {
          id: 'E7',
          name: 'Kontrola skrzynki bezpieczników i punktów masowych ramy/silnika',
          tools: 'Multimetr (pomiar spadku napięcia pod obciążeniem), preparat Kontakt S + Kontakt U',
          when: 'Niestabilna praca elektroniki, przygasanie podświetlenia, losowe błędy czujników.',
          steps: [
            'Sprawdź spadek napięcia między ujemną klemą akumulatora a blokiem silnika oraz między ujemną klemą a masą wiązki przedniej przy włączonych światłach drogowych (powinien wynosić <0.1–0.2 V).',
            'W motocyklach Honda sprawdź żółte/zielone wielopinowe kostki zbiorcze mas w wiązce głównej (często korodują pod taśmą izolacyjną).'
          ],
          evaluation: 'Słaba masa silnika zmusza prąd rozrusznika do powrotu przez linkę sprzęgła lub cienkie przewody masowe ECU, prowadząc do ich przepalenia!'
        },
        {
          id: 'E8',
          name: 'Inspekcja wiązki elektrycznej w newralgicznych punktach (główka ramy, złącze stacyjki)',
          tools: 'Multimetr, schemat elektryczny',
          when: 'Motocykl gaśnie przy skręcie kierownicy w lewo lub w prawo, zanika zasilanie zegarów lub zapłonu.',
          steps: [
            'Na uruchomionym silniku poruszaj wiązką elektryczną wokół główki ramy (lewa i prawa strona) oraz przy kostce pod stacyjką.',
            'Sprawdź miejsca przejścia wiązki obok gorących elementów głowicy i pod zbiornikiem paliwa pod kątem przetarcia izolacji do ramy.'
          ],
          evaluation: 'Złamane żyły miedziane wewnątrz nieuszkodzonej z zewnątrz izolacji PVC przy główce ramy to klasyczna usterka po kilkunastu latach eksploatacji.'
        },
        {
          id: 'E9',
          name: 'Diagnostyka czujników bezpieczeństwa (stopka boczna, luz, sprzęgło, przechył Tip-Over)',
          tools: 'Multimetr cyfrowy',
          when: 'Silnik odpala na luzie, ale gaśnie natychmiast po wrzuceniu 1. biegu lub nie kręci rozrusznikiem mimo wciśniętego sprzęgła.',
          steps: [
            'Czujnik stopki bocznej (Side Stand Switch): Sprawdź ciągłość obwodu przy złożonej stopce (często zabrudzony smarem z łańcucha trzpień czujnika nie wraca po złożeniu stopki!).',
            'Dioda układu blokad (Clutch/Neutral Diode w skrzynce bezpieczników): Sprawdź przewodzenie jednokierunkowe diody.',
            'Czujnik przechyłu (Tip-Over Sensor w owiewce przedniej lub pod siedzeniem): Upewnij się, że po demontażu czachy nie został zamontowany do góry nogami (strzałka „UP” musi być skierowana pionowo w górę!).'
          ],
          evaluation: 'Zamontowanie czujnika Tip-Over odwrotnie po naprawie owiewek odcina pompę paliwa i zapłon mimo sprawności wszystkich pozostałych elementów.'
        },
        {
          id: 'E10',
          name: 'Odczyt kodów usterek ECU (FI / MIL / Dealer Mode) i diagnostyka sterownika',
          tools: 'Zworka serwisowa (Dealer Tool / SCS Connector) lub skaner OBD2 z adapterem motocyklowym 4-pin / 6-pin',
          when: 'Świeci lub błyska kontrolka FI / MIL na zestawie wskaźników.',
          steps: [
            'Zlokalizuj złącze diagnostyczne pod siedzeniem i aktywuj tryb serwisowy (np. w Suzuki zmostkowanie pinów Dealer Mode wyświetla kod C00–C99 na ekranie LCD; w Hondzie/Yamaha/Kawasaki odczytaj kody błyskowe długie = dziesiątki, krótkie = jedności).',
            'W trybie Dealer Mode w Suzuki sprawdź także wskaźnik kreski przed kodem (`-C00`) służący do precyzyjnego ustawienia kąta początkowego czujnika TPS.'
          ],
          evaluation: 'Zawsze zapisz odczytane kody przed odłączeniem akumulatora lub wykasowaniem pamięci usterek.'
        }
      ]
    },
    {
      id: 'F',
      code: 'DZIAŁ F',
      title: 'SKRZYNIA BIEGÓW I NAPĘD',
      color: '#ec4899',
      icon: '⛓️',
      summary: 'Sprzęgło wielotarczowe mokre, skrzynia biegów (wypadanie 2. biegu, kły i wodziki), mechanizm zmiany biegów, łańcuch napędowy, zębatki, hałasy i szarpanie napędu.',
      procedures: [
        {
          id: 'F1',
          name: 'Diagnostyka i pomiar sprzęgła wielotarczowego (tarcze cierne, przekładki, sprężyny, kosz)',
          tools: 'Suwmiarka 0.02 mm, płyta pomiarowa + szczelinomierz, klucz dynamometryczny',
          when: 'Ślizganie sprzęgła przy przyspieszaniu powyżej 7000–9000 obr./min (obroty rosną, prędkość nie), ciągnięcie sprzęgła i trudności z wrzuceniem luzu na postoju.',
          steps: [
            'Najpierw sprawdź luz jałowy na klamce sprzęgła (musi wynosić 10–15 mm na końcu klamki) — brak luzu powoduje niepełne zasprzęglenie i spalenie tarcz!',
            'Po demontażu pakietu sprzęgła zmierz grubość tarcz ciernych suwmiarką, zwichrowanie przekładek stalowych na płycie pomiarowej (limit zwykle 0.10–0.15 mm) oraz wolną długość sprężyn dociskowych.',
            'Sprawdź palce kosza zewnętrznego i zabieraka wewnętrznego pod kątem wygniecionych rowków (notching) — rowki blokują rozsuwanie tarcz i powodują ciągnięcie sprzęgła.'
          ],
          evaluation: 'Nowe tarcze cierne przed montażem mocz w czystym oleju silnikowym przez minimum 2–4 godziny. Zwróć uwagę na odmienną pierwszą lub ostatnią tarczę w pakiecie (mniejsza średnica wewnętrzna ze sprężyną judder spring).'
        },
        {
          id: 'F2',
          name: 'Diagnostyka skrzyni biegów (wypadanie 2. biegu, zużycie kłów sprzęgłowych i wodzików)',
          tools: 'Przyrząd do kontroli bicia wałków, suwmiarka, mikrometr',
          when: 'Gwałtowne szarpnięcie lub wyskakiwanie 2. biegu na luz przy mocnym przyspieszaniu (klasyczna usterka wysokoobrotowych 600 cm³: R6 5EB, Thundercat, FZR600, ZX-6R, GSX-R).',
          steps: [
            'Objaw w jeździe próbnej: na 2. biegu powyżej 7000 obr./min przy mocnym odkręceniu gazu następuje gwałtowny przeskok napędu (jakby łańcuch przeskoczył po zębatce) lub całkowite wyrzucenie biegu.',
            'Przyczyna mechaniczna: zaokrąglone krawędzie kłów zabierakowych (dogs) kół zębatych 2. i 6. biegu powodują odepchnięcie koła przesuwnego i wygięcie wodzika wybieraka (shift fork).',
            'Naprawa wymaga demontażu skrzyni (w karterach dzielonych poziomo łatwiejszy dostęp od dołu bez zdejmowania głowicy!) i wymiany pary kół współpracujących oraz wygiętego wodzika + wałka wodzików.'
          ],
          evaluation: 'Nigdy nie wymieniaj samego wygiętego wodzika bez wymiany kół zębatych z zaokrąglonymi kłami — zaokrąglone kły natychmiast ponownie zegną nowy wodzik!'
        },
        {
          id: 'F3',
          name: 'Kontrola mechanizmu zmiany biegów (wałek wybieraka, sprężyna powrotna, gwiazda programatora)',
          tools: 'Szczelinomierz, klucz dynamometryczny',
          when: 'Dźwignia zmiany biegów nie wraca sama do pozycji środkowej po zmianie biegu, biegi wchodzą nieprecyzyjnie lub blokują się.',
          steps: [
            'Sprawdź zewnętrzny układ dźwigni i przegubów kulowych na setach podnóżków (zapieczony przegub kulowy na secie daje identyczny objaw jak usterka w skrzyni!).',
            'Po zdjęciu pokrywy mechanizmu wybieraka sprawdź pęknięcie sprężyny powrotnej wałka zmiany biegów (częsta usterka w Triumph Daytona/Street Triple 675 oraz Suzuki Bandit/GSF) oraz dokręcenie śruby gwiazdy programatora (detent star).'
          ],
          evaluation: 'Pęknięta sprężyna powrotna wałka wybieraka jest dostępna z zewnątrz po zdjęciu dekla bocznego / kosza sprzęgła bez rozpoławiania karterów.'
        },
        {
          id: 'F4',
          name: 'Pomiar wyciągnięcia łańcucha napędowego (na odcinku 20 ogniw) i regulacja zwisu',
          tools: 'Suwmiarka 300 mm, przymiar liniowy, klucz dynamometryczny do osi tylnego koła',
          when: 'Szarpanie przy jeździe ze stałą prędkością, cykliczne klikanie z okolic napędu, nierównomierny naciąg łańcucha przy obracaniu kołem.',
          steps: [
            'Obracaj tylnym kołem i znajdź miejsce, w którym łańcuch jest NAJBARDZIEJ napięty — właśnie w tym punkcie ustawiaj zwis łańcucha (zwykle 25–35 mm zgodnie z wahaczem modelu).',
            'Napnij górną gałąź łańcucha obciążeniem ok. 15 kg i zmierz odległość pomiędzy osiami 21 sworzni (odcinek 20 ogniw): dla łańcuchów 520/525/530 o podziałce 15.875 mm limit graniczny wynosi 319.4–320.0 mm.',
            'Sprawdź, czy pojedyncze ogniwa O-ring/X-ring nie są zatarte i czy układają się w linii prostej po zejściu z zębatki.'
          ],
          evaluation: 'Zbyt mocno napięty łańcuch napędowy niszczy łożysko wałka zdawczego skrzyni biegów oraz tuleje wahacza podczas ugięcia zawieszenia!'
        },
        {
          id: 'F5',
          name: 'Ocena zużycia zębatek (zdawczej i tylnej), osiowości kół i zabieraka gumowego',
          tools: 'Przyrząd laserowy do osiowania łańcucha, klucz dynamometryczny',
          when: 'Wymiana napędu, uderzenie przy dodawaniu i odejmowaniu gazu.',
          steps: [
            'Zdejmij osłonę przedniej zębatki zdawczej (tam zbiera się najwięcej starego smaru i kamyków): sprawdź profil zębów (brak wygięcia w „zęby rekina”) oraz zabezpieczenie nakrętki wałka zdawczego (podkładka zaginana!).',
            'Sprawdź luz obwodowy tylnej zębatki względem piasty koła — wybite gumy zabieraka (cush drive) powodują silne szarpnięcie przy każdym otwarciu gazu.'
          ],
          evaluation: 'Łańcuch i obie zębatki wymieniaj zawsze jako komplet. Przy montażu nowej przedniej zębatki zastosuj nową podkładkę zabezpieczającą i dokręć nakrętkę momentem z DTR.'
        },
        {
          id: 'F6',
          name: 'Diagnostyka nietypowych hałasów i wibracji układu napędowego i sprzęgła',
          tools: 'Stetoskop mechanika',
          when: 'Szum lub grzechotanie z dolnej części silnika zmieniające się po wciśnięciu klamki sprzęgła lub wrzuceniu biegu.',
          steps: [
            'Hałas na luzie, który CICHNIE po wciśnięciu klamki sprzęgła: luz kosza sprzęgłowego na sprężynach tłumika drgań skrętnych lub łożysko igiełkowe kosza sprzęgła (w wielu silnikach R4 lekki szum kosza na luzie przed synchronizacją gaźników jest zjawiskiem typowym — po dokładnej synchronizacji podciśnień cichnie o 70%!).',
            'Hałas pojawiający się TYLKO po wciśnięciu klamki sprzęgła: zużyte łożysko wyciskowe (oporowe) sprzęgła.',
            'Wycie zależne od prędkości jazdy na wybranym biegu: pitting kół zębatych tego przełożenia lub zużyte łożysko wałka zdawczego.'
          ],
          evaluation: 'Zawsze wykonaj precyzyjną synchronizację 3–4 gaźników/przepustnic przed pochopną wymianą kosza sprzęgłowego — nierówna praca cylindrów na wolnych obrotach wprawia kosz sprzęgła w głośne drgania skrętne.'
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
    const filterButtons = [
      { id: 'ALL', label: 'Wszystkie działy (A–F • 56 procedur)' }
    ].concat(DIAGNOSTIC_SECTIONS.map(s => ({ id: s.id, label: `${s.icon} ${s.code}: ${s.title}` })));

    const sectionsHtml = DIAGNOSTIC_SECTIONS
      .filter(s => state.activeSectionId === 'ALL' || s.id === state.activeSectionId)
      .map(sec => {
        const procs = sec.procedures.filter(p => {
          if (!q) return true;
          const hay = `${p.id} ${p.name} ${p.tools} ${p.when} ${p.steps.join(' ')} ${p.evaluation}`.toLowerCase();
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
                </div>
                <span style="color:#94a3b8;font-size:12px">${isOpen ? '▲ Zwiń' : '▼ Rozwiń procedurę'}</span>
              </div>
              ${isOpen ? `
                <div style="padding:0 14px 13px;border-top:1px solid rgba(148,163,184,0.14);font-size:12px;color:#e2e8f0">
                  <div style="margin-top:9px;color:#fde047"><strong>🧰 Wymagane przyrządy:</strong> ${esc(p.tools)}</div>
                  <div style="margin-top:5px;color:#bae6fd"><strong>🔍 Kiedy wykonać:</strong> ${esc(p.when)}</div>
                  <div style="margin-top:8px;font-weight:800;color:#c084fc">Kroki wykonawcze:</div>
                  <ol style="margin:5px 0 8px 18px;padding:0;line-height:1.5">
                    ${p.steps.map(st => `<li style="margin-bottom:4px">${esc(st)}</li>`).join('')}
                  </ol>
                  <div style="background:rgba(16,185,129,0.12);border-left:3px solid #10b981;padding:8px 10px;border-radius:6px;color:#a7f3d0">
                    <strong>✅ Interpretacja wyników:</strong> ${esc(p.evaluation)}
                  </div>
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
        <input id="mc-section-search" class="mc-input" placeholder="Szukaj procedury w działach A–F (np. Leak Down, synchronizacja, stojan, 2. bieg, zaworek iglicowy, TPS)..."
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
              <div>4. DZIAŁY DIAGNOSTYKI A–F</div>
              <div style="font-size:10px;color:#94a3b8;font-weight:600">Mechanika • Paliwo • Zapłon</div>
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
