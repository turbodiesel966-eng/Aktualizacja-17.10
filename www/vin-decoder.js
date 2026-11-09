/* NAPRAWNIK — KOMPLEKSOWY DEKODER I CZYTNIK NUMERÓW VIN (ISO 3779 / ISO 3780)
 * Obsługa 100% Offline (baza WMI, algorytm sumy kontrolnej, rok modelowy, plant code)
 * oraz automatyczne wzbogacanie danymi Online (oficjalne bezpłatne API NHTSA vPIC bez kluczy).
 * Bezpieczne działanie w przeglądarce PWA oraz odizolowanym środowisku Android APK.
 */
(function (global) {
  'use strict';

  // 1. Tablice wag i transliteracji znaków do sumy kontrolnej (ISO 3779 / US DOT)
  const CHAR_VALUES = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
    'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
    'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9
  };
  const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

  // 2. Tabela dekodowania roku modelowego (znak 10)
  const YEAR_CODES_MODERN = {
    'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014, 'F': 2015, 'G': 2016, 'H': 2017,
    'J': 2018, 'K': 2019, 'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024, 'S': 2025,
    'T': 2026, 'V': 2027, 'W': 2028, 'X': 2029, 'Y': 2030,
    '1': 2031, '2': 2032, '3': 2033, '4': 2034, '5': 2035, '6': 2036, '7': 2037, '8': 2038, '9': 2039
  };
  const YEAR_CODES_CLASSIC = {
    'A': 1980, 'B': 1981, 'C': 1982, 'D': 1983, 'E': 1984, 'F': 1985, 'G': 1986, 'H': 1987,
    'J': 1988, 'K': 1989, 'L': 1990, 'M': 1991, 'N': 1992, 'P': 1993, 'R': 1994, 'S': 1995,
    'T': 1996, 'V': 1997, 'W': 1998, 'X': 1999, 'Y': 2000,
    '1': 2001, '2': 2002, '3': 2003, '4': 2004, '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009
  };

  // 3. Rozbudowana baza producentów WMI (znaki 1–3) ze szczególnym uwzględnieniem motocykli i skuterów
  const WMI_DATABASE = {
    // JAPONIA
    'JH2': { make: 'Honda', mfr: 'Honda Motor Co., Ltd.', country: 'Japonia', region: 'Azja', type: 'Motocykl' },
    'JH4': { make: 'Honda', mfr: 'Honda Motor Co., Ltd.', country: 'Japonia', region: 'Azja', type: 'Motocykl / ATV' },
    '1HF': { make: 'Honda', mfr: 'Honda of America Mfg., Inc.', country: 'USA', region: 'Ameryka Północna', type: 'Motocykl' },
    '3H1': { make: 'Honda', mfr: 'Honda de Mexico', country: 'Meksyk', region: 'Ameryka Północna', type: 'Motocykl' },
    'MLH': { make: 'Honda', mfr: 'Thai Honda Mfg. Co., Ltd.', country: 'Tajlandia', region: 'Azja', type: 'Motocykl / Skuter' },
    'VTM': { make: 'Honda', mfr: 'Montesa Honda S.A.', country: 'Hiszpania', region: 'Europa', type: 'Motocykl' },
    'ZD4': { make: 'Aprilia', mfr: 'Aprilia S.p.A. (Piaggio Group)', country: 'Włochy', region: 'Europa', type: 'Motocykl / Skuter' },
    'JYA': { make: 'Yamaha', mfr: 'Yamaha Motor Co., Ltd.', country: 'Japonia', region: 'Azja', type: 'Motocykl / Skuter' },
    'JY4': { make: 'Yamaha', mfr: 'Yamaha Motor Co., Ltd.', country: 'Japonia', region: 'Azja', type: 'Motocykl / ATV' },
    'VG5': { make: 'Yamaha', mfr: 'MBK Industrie / Yamaha Motor', country: 'Francja', region: 'Europa', type: 'Skuter / Motocykl' },
    'SA5': { make: 'Yamaha', mfr: 'Yamaha Motor España S.A.', country: 'Hiszpania', region: 'Europa', type: 'Skuter / Motocykl' },
    'MH3': { make: 'Yamaha', mfr: 'Yamaha Motor Indonesia', country: 'Indonezja', region: 'Azja', type: 'Skuter / Motocykl' },
    'JS1': { make: 'Suzuki', mfr: 'Suzuki Motor Corporation', country: 'Japonia', region: 'Azja', type: 'Motocykl' },
    'JS2': { make: 'Suzuki', mfr: 'Suzuki Motor Corporation', country: 'Japonia', region: 'Azja', type: 'Motocykl / Skuter' },
    'VSE': { make: 'Suzuki', mfr: 'Suzuki Motor España', country: 'Hiszpania', region: 'Europa', type: 'Motocykl / Skuter' },
    'JKB': { make: 'Kawasaki', mfr: 'Kawasaki Heavy Industries', country: 'Japonia', region: 'Azja', type: 'Motocykl' },
    'JKA': { make: 'Kawasaki', mfr: 'Kawasaki Heavy Industries', country: 'Japonia', region: 'Azja', type: 'Motocykl' },
    'ML5': { make: 'Kawasaki', mfr: 'Kawasaki Motors Enterprise', country: 'Tajlandia', region: 'Azja', type: 'Motocykl' },

    // WŁOCHY
    'ZAP': { make: 'Piaggio', mfr: 'Piaggio & C. S.p.A. (Vespa / Gilera)', country: 'Włochy', region: 'Europa', type: 'Skuter / Motocykl' },
    'ZAPM': { make: 'Piaggio', mfr: 'Piaggio & C. S.p.A.', country: 'Włochy', region: 'Europa', type: 'Skuter' },
    'ZDM': { make: 'Ducati', mfr: 'Ducati Motor Holding S.p.A.', country: 'Włochy', region: 'Europa', type: 'Motocykl' },
    'ML3': { make: 'Ducati', mfr: 'Ducati Motor Thailand', country: 'Tajlandia', region: 'Azja', type: 'Motocykl' },
    'ZBN': { make: 'Benelli', mfr: 'Benelli Q.J. S.r.l.', country: 'Włochy', region: 'Europa', type: 'Motocykl' },
    'ZCG': { make: 'MV Agusta', mfr: 'MV Agusta Motor S.p.A. / Cagiva', country: 'Włochy', region: 'Europa', type: 'Motocykl' },
    'ZGU': { make: 'Moto Guzzi', mfr: 'Moto Guzzi S.p.A. (Piaggio Group)', country: 'Włochy', region: 'Europa', type: 'Motocykl' },
    'VTH': { make: 'Derbi', mfr: 'Nacional Motor S.A.U. (Derbi / Piaggio)', country: 'Hiszpania', region: 'Europa', type: 'Skuter / Moped' },

    // AUSTRIA / NIEMCY / UK
    'VBK': { make: 'KTM', mfr: 'KTM AG (Husqvarna / GasGas)', country: 'Austria', region: 'Europa', type: 'Motocykl' },
    'VBM': { make: 'Husqvarna', mfr: 'Husqvarna Motorcycles GmbH', country: 'Austria', region: 'Europa', type: 'Motocykl' },
    'WB1': { make: 'BMW', mfr: 'BMW Motorrad AG', country: 'Niemcy', region: 'Europa', type: 'Motocykl' },
    'WB3': { make: 'BMW', mfr: 'BMW Motorrad AG (seria C/G)', country: 'Niemcy', region: 'Europa', type: 'Skuter / Motocykl' },
    'WMX': { make: 'BMW', mfr: 'BMW Motorrad AG', country: 'Niemcy', region: 'Europa', type: 'Motocykl' },
    'SMT': { make: 'Triumph', mfr: 'Triumph Motorcycles Ltd.', country: 'Wielka Brytania', region: 'Europa', type: 'Motocykl' },
    'SMT3': { make: 'Triumph', mfr: 'Triumph Motorcycles Thailand', country: 'Tajlandia', region: 'Azja', type: 'Motocykl' },

    // TAJWAN / CHINY / KOREA / FRANCJA
    'RFG': { make: 'SYM', mfr: 'Sanyang Motor Co., Ltd.', country: 'Tajwan', region: 'Azja', type: 'Skuter / Motocykl' },
    'RFR': { make: 'SYM', mfr: 'Sanyang Motor Co., Ltd.', country: 'Tajwan', region: 'Azja', type: 'Skuter' },
    'RFB': { make: 'Kymco', mfr: 'Kwang Yang Motor Co., Ltd.', country: 'Tajwan', region: 'Azja', type: 'Skuter / Motocykl' },
    'LBP': { make: 'Kymco', mfr: 'Changzhou Kwang Yang Motor (Kymco)', country: 'Chiny', region: 'Azja', type: 'Skuter' },
    'LPR': { make: 'Kymco', mfr: 'Kymco Healthcare / Changzhou', country: 'Chiny', region: 'Azja', type: 'Skuter' },
    'VG6': { make: 'Peugeot', mfr: 'Peugeot Motocycles', country: 'Francja', region: 'Europa', type: 'Skuter' },
    'LAL': { make: 'Benelli / QJ', mfr: 'Zhejiang Qianjiang Motorcycle (QJ / Benelli)', country: 'Chiny', region: 'Azja', type: 'Motocykl' },
    'LBB': { make: 'Zongshen', mfr: 'Chongqing Zongshen Motorcycle Group', country: 'Chiny', region: 'Azja', type: 'Motocykl / Silniki' },
    'LB5': { make: 'Lifan', mfr: 'Lifan Industry (Group) Co., Ltd.', country: 'Chiny', region: 'Azja', type: 'Motocykl' },
    'LL8': { make: 'Loncin', mfr: 'Loncin Motor Co., Ltd. (Voge)', country: 'Chiny', region: 'Azja', type: 'Motocykl' },
    'LC6': { make: 'Changzhou Haojue', mfr: 'Haojue Suzuki Motorcycle', country: 'Chiny', region: 'Azja', type: 'Motocykl' },
    '1HD': { make: 'Harley-Davidson', mfr: 'Harley-Davidson Motor Company', country: 'USA', region: 'Ameryka Północna', type: 'Motocykl' },
    '5HD': { make: 'Harley-Davidson', mfr: 'Harley-Davidson (Eksport)', country: 'USA', region: 'Ameryka Północna', type: 'Motocykl' },
    'ME4': { make: 'Honda', mfr: 'Honda Motorcycle and Scooter India', country: 'Indie', region: 'Azja', type: 'Skuter / Motocykl' },
    'MDH': { make: 'Bajaj', mfr: 'Bajaj Auto Ltd. (KTM / Triumph)', country: 'Indie', region: 'Azja', type: 'Motocykl' },
    'MAL': { make: 'Hero', mfr: 'Hero MotoCorp Ltd.', country: 'Indie', region: 'Azja', type: 'Motocykl' },

    // POJAZDY SAMOCHODOWE I DOSTAWCZE (częste w serwisie / flocie warsztatu)
    'WVW': { make: 'Volkswagen', mfr: 'Volkswagen AG', country: 'Niemcy', region: 'Europa', type: 'Osobowy' },
    'WV1': { make: 'Volkswagen', mfr: 'Volkswagen AG Nutzfahrzeuge', country: 'Niemcy', region: 'Europa', type: 'Dostawczy' },
    'WV2': { make: 'Volkswagen', mfr: 'Volkswagen AG Transporter/Bus', country: 'Niemcy', region: 'Europa', type: 'Dostawczy / Bus' },
    'WAU': { make: 'Audi', mfr: 'Audi AG', country: 'Niemcy', region: 'Europa', type: 'Osobowy' },
    'WBA': { make: 'BMW', mfr: 'Bayerische Motoren Werke AG', country: 'Niemcy', region: 'Europa', type: 'Osobowy' },
    'WBS': { make: 'BMW M', mfr: 'BMW M GmbH', country: 'Niemcy', region: 'Europa', type: 'Sportowy' },
    'WDB': { make: 'Mercedes-Benz', mfr: 'Mercedes-Benz AG', country: 'Niemcy', region: 'Europa', type: 'Osobowy' },
    'WDD': { make: 'Mercedes-Benz', mfr: 'Mercedes-Benz AG', country: 'Niemcy', region: 'Europa', type: 'Osobowy' },
    'WP0': { make: 'Porsche', mfr: 'Dr. Ing. h.c. F. Porsche AG', country: 'Niemcy', region: 'Europa', type: 'Sportowy' },
    'W0L': { make: 'Opel', mfr: 'Opel Automobile GmbH', country: 'Niemcy', region: 'Europa', type: 'Osobowy' },
    'VF1': { make: 'Renault', mfr: 'Renault S.A.S.', country: 'Francja', region: 'Europa', type: 'Osobowy / Dostawczy' },
    'VF3': { make: 'Peugeot', mfr: 'Automobiles Peugeot', country: 'Francja', region: 'Europa', type: 'Osobowy / Dostawczy' },
    'VF7': { make: 'Citroën', mfr: 'Automobiles Citroën', country: 'Francja', region: 'Europa', type: 'Osobowy / Dostawczy' },
    'ZFA': { make: 'Fiat', mfr: 'FCA Italy S.p.A.', country: 'Włochy', region: 'Europa', type: 'Osobowy / Dostawczy' },
    'ZAR': { make: 'Alfa Romeo', mfr: 'Alfa Romeo (FCA)', country: 'Włochy', region: 'Europa', type: 'Osobowy' },
    'ZFF': { make: 'Ferrari', mfr: 'Ferrari S.p.A.', country: 'Włochy', region: 'Europa', type: 'Sportowy' },
    '1FA': { make: 'Ford', mfr: 'Ford Motor Company', country: 'USA', region: 'Ameryka Północna', type: 'Osobowy' },
    '1FT': { make: 'Ford', mfr: 'Ford Motor Company (Trucks)', country: 'USA', region: 'Ameryka Północna', type: 'Ciężarowy / Pick-up' },
    'JT': { make: 'Toyota', mfr: 'Toyota Motor Corporation', country: 'Japonia', region: 'Azja', type: 'Osobowy' },
    'JN': { make: 'Nissan', mfr: 'Nissan Motor Co., Ltd.', country: 'Japonia', region: 'Azja', type: 'Osobowy' },
    'JM': { make: 'Mazda', mfr: 'Mazda Motor Corporation', country: 'Japonia', region: 'Azja', type: 'Osobowy' }
  };

  // 4. Dekodowanie ogólnego regionu geograficznego z 1. znaku VIN
  function getRegionFromChar(c) {
    if ('12345'.includes(c)) return 'Ameryka Północna';
    if ('67'.includes(c)) return 'Oceania (Australia / Nowa Zelandia)';
    if ('89'.includes(c)) return 'Ameryka Południowa';
    if ('ABCDEFGH'.includes(c)) return 'Afryka';
    if ('JKLMNPR'.includes(c)) return 'Azja';
    if ('STUVWXYZ'.includes(c)) return 'Europa';
    return 'Nieznany region';
  }

  // 5. Dekodowanie kraju z pierwszych 2 znaków VIN (ISO 3780)
  function getCountryFromPrefix(wmi2) {
    const c0 = wmi2.charAt(0);
    const c1 = wmi2.charAt(1);
    if (c0 === '1' || c0 === '4' || c0 === '5') return 'USA';
    if (c0 === '2') return 'Kanada';
    if (c0 === '3') return (c1 >= 'A' && c1 <= 'W') ? 'Meksyk' : 'Ameryka Północna';
    if (c0 === '6') return 'Australia';
    if (c0 === '7') return 'Nowa Zelandia';
    if (c0 === '8' || c0 === '9') return (c0 === '9') ? 'Brazylia' : 'Ameryka Południowa';
    if (c0 === 'J') return 'Japonia';
    if (c0 === 'K') return (c1 >= 'L' && c1 <= 'R') ? 'Korea Południowa' : 'Azja';
    if (c0 === 'L') return 'Chiny';
    if (c0 === 'M') {
      if (c1 >= 'A' && c1 <= 'E') return 'Indie';
      if (c1 >= 'F' && c1 <= 'K') return 'Indonezja';
      if (c1 >= 'L' && c1 <= 'R') return 'Tajlandia';
      return 'Azja Południowo-Wschodnia';
    }
    if (c0 === 'S') {
      if (c1 >= 'A' && c1 <= 'M') return 'Wielka Brytania';
      if (c1 >= 'N' && c1 <= 'T') return 'Niemcy';
      if (c1 >= 'U' && c1 <= 'Z') return 'Polska';
      return 'Europa';
    }
    if (c0 === 'T') {
      if (c1 >= 'A' && c1 <= 'H') return 'Szwajcaria';
      if (c1 >= 'J' && c1 <= 'P') return 'Czechy';
      if (c1 >= 'R' && c1 <= 'V') return 'Węgry';
      return 'Europa';
    }
    if (c0 === 'V') {
      if (c1 >= 'A' && c1 <= 'E') return 'Austria';
      if (c1 >= 'F' && c1 <= 'R') return 'Francja';
      if (c1 >= 'S' && c1 <= 'W') return 'Hiszpania';
      return 'Europa';
    }
    if (c0 === 'W') return 'Niemcy';
    if (c0 === 'X') return (c1 >= 'L' && c1 <= 'R') ? 'Holandia' : 'Europa Wschodnia / Rosja';
    if (c0 === 'Y') return (c1 >= 'S' && c1 <= 'W') ? 'Szwecja' : 'Europa Północna';
    if (c0 === 'Z') return (c1 >= 'A' && c1 <= 'R') ? 'Włochy' : 'Europa Południowa';
    return 'Nieokreślony';
  }

  // 6. Walidacja VIN (ISO 3779)
  function validateVin(rawVin) {
    const raw = String(rawVin || '').trim();
    const clean = raw.toUpperCase().replace(/[\s\-_.]/g, '');
    const illegalChars = [];
    for (const ch of clean) {
      if (ch === 'I' || ch === 'O' || ch === 'Q') {
        if (!illegalChars.includes(ch)) illegalChars.push(ch);
      }
    }
    const isValidLength = clean.length === 17;
    const isAlphanumeric = /^[A-Z0-9]+$/.test(clean);

    let checkDigitActual = clean.length >= 9 ? clean.charAt(8) : '';
    let checkDigitExpected = null;
    let checkDigitValid = false;

    if (isValidLength && isAlphanumeric && illegalChars.length === 0) {
      let sum = 0;
      for (let i = 0; i < 17; i++) {
        const char = clean.charAt(i);
        const val = CHAR_VALUES[char] !== undefined ? CHAR_VALUES[char] : 0;
        sum += val * WEIGHTS[i];
      }
      const remainder = sum % 11;
      checkDigitExpected = remainder === 10 ? 'X' : String(remainder);
      checkDigitValid = checkDigitActual === checkDigitExpected;
    }

    return {
      raw: raw,
      clean: clean,
      isValidLength: isValidLength,
      length: clean.length,
      isAlphanumeric: isAlphanumeric,
      hasIllegalChars: illegalChars.length > 0,
      illegalChars: illegalChars,
      checkDigitActual: checkDigitActual,
      checkDigitExpected: checkDigitExpected,
      checkDigitValid: checkDigitValid,
      isStandardIsoCompliant: isValidLength && isAlphanumeric && illegalChars.length === 0
    };
  }

  // 7. Lokalny dekoder offline (WMI, VDS, VIS)
  function decodeLocal(cleanVin) {
    const val = validateVin(cleanVin);
    if (!val.isStandardIsoCompliant) {
      return {
        success: false,
        validation: val,
        error: val.hasIllegalChars
          ? `Znaki [${val.illegalChars.join(', ')}] są niedozwolone w numerze VIN (norma ISO 3779 wyklucza I, O, Q z powodu podobieństwa do cyfr 1 i 0).`
          : `Numer VIN musi liczyć dokładnie 17 znaków (obecnie wpisano ${val.length}).`,
        source: 'local'
      };
    }

    const vin = val.clean;
    const wmi3 = vin.slice(0, 3);
    const wmi2 = vin.slice(0, 2);
    const vds = vin.slice(3, 9);
    const vis = vin.slice(9, 17);
    const char10 = vin.charAt(9);
    const char11 = vin.charAt(10);
    const serial = vin.slice(11, 17);

    // Identyfikacja producenta z WMI
    const wmiMatch = WMI_DATABASE[wmi3] || WMI_DATABASE[wmi2] || null;
    const region = wmiMatch ? wmiMatch.region : getRegionFromChar(vin.charAt(0));
    const country = wmiMatch ? wmiMatch.country : getCountryFromPrefix(wmi2);
    const make = wmiMatch ? wmiMatch.make : 'Nieustalona marka (brak w lokalnym WMI)';
    const manufacturer = wmiMatch ? wmiMatch.mfr : 'Nieustalony producent fabryczny';
    const vehicleType = wmiMatch ? wmiMatch.type : 'Pojazd silnikowy (motocykl / skuter / auto)';

    // Dekodowanie roku modelowego
    // W normie ISO 3779 pozycja 7 (char 6) określa wiek: cyfra = lata 1980–2009, litera = od roku 2010.
    const char7 = vin.charAt(6);
    const isChar7Numeric = /^[0-9]$/.test(char7);
    const yearCandidateModern = YEAR_CODES_MODERN[char10] || null;
    const yearCandidateClassic = YEAR_CODES_CLASSIC[char10] || null;

    let modelYear = null;
    let yearNote = '';
    if (yearCandidateModern) {
      if (isChar7Numeric && yearCandidateClassic) {
        modelYear = `${yearCandidateClassic} lub ${yearCandidateModern}`;
        yearNote = `Znak '${char10}' w pozycji 10 wskazuje rocznik ${yearCandidateClassic} (cykl I) lub ${yearCandidateModern} (cykl II).`;
      } else {
        modelYear = String(yearCandidateModern);
        yearNote = `Znak '${char10}' w pozycji 10 koduje rok modelowy ${yearCandidateModern}.`;
      }
    } else {
      modelYear = 'Nieustalony';
      yearNote = `Znak '${char10}' w pozycji 10 nie odpowiada standardowemu kodowi roku.`;
    }

    // Lista pól potwierdzonych i nieustalonych
    const confirmed = [];
    const unconfirmed = [];

    if (wmiMatch) {
      confirmed.push({ label: 'Marka', value: make, confidence: 'WYSOKA (WMI OEM)' });
      confirmed.push({ label: 'Producent', value: manufacturer, confidence: 'WYSOKA (WMI OEM)' });
      confirmed.push({ label: 'Kraj produkcji', value: country, confidence: 'WYSOKA (ISO 3780)' });
      confirmed.push({ label: 'Region świata', value: region, confidence: 'WYSOKA' });
      confirmed.push({ label: 'Typ pojazdu', value: vehicleType, confidence: 'ŚREDNIA (kategoria WMI)' });
    } else {
      confirmed.push({ label: 'Kraj pochodzenia', value: country, confidence: 'ŚREDNIA (prefix ISO 3780)' });
      confirmed.push({ label: 'Region świata', value: region, confidence: 'ŚREDNIA (prefix ISO 3780)' });
      unconfirmed.push('Dokładna marka i fabryka (brak WMI w pamięci lokalnej offline)');
    }

    if (yearCandidateModern) {
      confirmed.push({ label: 'Rok modelowy', value: String(modelYear), confidence: 'WYSOKA (Znak 10 VIS)', note: yearNote });
    } else {
      unconfirmed.push('Rok modelowy');
    }

    confirmed.push({ label: 'Kod zakładu (Plant Code)', value: char11, confidence: 'PEWNA (Pozycja 11 VIS)' });
    confirmed.push({ label: 'Numer seryjny (VIS)', value: serial, confidence: 'PEWNA (Pozycje 12–17 VIS)' });

    unconfirmed.push('Pojemność skokowa i kod silnika (wymaga weryfikacji w dowodzie lub DTR)');
    unconfirmed.push('Dokładna nazwa handlowa modelu (VDS jest definiowany wewnętrznie przez producenta)');

    return {
      success: true,
      source: 'local_iso3779',
      validation: val,
      wmi: wmi3,
      vds: vds,
      vis: vis,
      make: make,
      manufacturer: manufacturer,
      model: null,
      modelYear: modelYear,
      yearNote: yearNote,
      country: country,
      region: region,
      plantCode: char11,
      serialNumber: serial,
      vehicleType: vehicleType,
      engineDisplacement: null,
      engineCylinders: null,
      fuelType: null,
      confirmed: confirmed,
      unconfirmed: unconfirmed,
      onlineEnriched: false
    };
  }

  // 8. Wzbogacanie danych online (NHTSA vPIC Public API - bezpieczne, bezpłatne, bez kluczy)
  async function fetchOnlineVinData(cleanVin, timeoutMs = 4500) {
    if (typeof fetch === 'undefined') return null;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(cleanVin)}?format=json`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller ? controller.signal : undefined
      });
      if (timer) clearTimeout(timer);
      if (!res.ok) return null;
      const json = await res.json();
      if (json && Array.isArray(json.Results) && json.Results.length > 0) {
        return json.Results[0];
      }
    } catch (_) {
      // Ignorujemy błędy sieci / timeout / CORS w trybie offline
    } finally {
      if (timer) clearTimeout(timer);
    }
    return null;
  }

  // Pomocnik czyszczenia pustych wartości z API
  function cleanApiVal(val) {
    if (!val) return null;
    const str = String(val).trim();
    if (!str || str.toLowerCase() === 'not applicable' || str.toLowerCase() === 'n/a' || str === '0') return null;
    return str;
  }

  // 9. Pełne dekodowanie (Lokalne ISO + Opcjonalne Wzbogacenie Online)
  async function decode(vinInput, options = {}) {
    const local = decodeLocal(vinInput);
    if (!local.success) {
      return local;
    }

    // Zapis w historii sprawdzonych numerów VIN (przed ewentualnym wcześniejszym powrotem)
    function recordHistory(res) {
      try {
        if (typeof localStorage !== 'undefined' && res && res.validation) {
          const HIST_KEY = 'naprawnik_vin_history';
          let hist = [];
          try { hist = JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch (_) { hist = []; }
          if (!Array.isArray(hist)) hist = [];
          hist = hist.filter(h => h.vin !== res.validation.clean);
          hist.unshift({
            vin: res.validation.clean,
            make: res.make,
            model: res.model || '',
            year: res.modelYear || '',
            country: res.country,
            date: new Date().toLocaleString('pl-PL'),
            online: res.onlineEnriched || false
          });
          if (hist.length > 30) hist = hist.slice(0, 30);
          localStorage.setItem(HIST_KEY, JSON.stringify(hist));
        }
      } catch (_) {}
    }

    // Jeśli użytkownik zażądał tylko lokalnego lub nie ma internetu
    if (options.offlineOnly) {
      recordHistory(local);
      return local;
    }

    try {
      const apiData = await fetchOnlineVinData(local.validation.clean, options.timeout || 4500);
      if (apiData) {
        const apiMake = cleanApiVal(apiData.Make);
        const apiModel = cleanApiVal(apiData.Model);
        const apiYear = cleanApiVal(apiData.ModelYear);
        const apiMfr = cleanApiVal(apiData.Manufacturer);
        const apiType = cleanApiVal(apiData.VehicleType);
        const apiCountry = cleanApiVal(apiData.PlantCountry);
        const apiCity = cleanApiVal(apiData.PlantCity);
        const apiDisplCC = cleanApiVal(apiData.DisplacementCC);
        const apiDisplL = cleanApiVal(apiData.DisplacementL);
        const apiCyl = cleanApiVal(apiData.EngineCylinders);
        const apiFuel = cleanApiVal(apiData.FuelTypePrimary);
        const apiSeries = cleanApiVal(apiData.Series);
        const apiDrive = cleanApiVal(apiData.DriveType);

        // Nadpisujemy / uzupełniamy
        if (apiMake) local.make = apiMake;
        if (apiModel) local.model = apiModel;
        if (apiYear) local.modelYear = apiYear;
        if (apiMfr) local.manufacturer = apiMfr;
        if (apiType) local.vehicleType = apiType;
        if (apiCountry) local.country = apiCountry;
        if (apiDisplCC) local.engineDisplacement = `${Math.round(Number(apiDisplCC))} cm³`;
        else if (apiDisplL) local.engineDisplacement = `${apiDisplL} L`;
        if (apiCyl) local.engineCylinders = `${apiCyl} cyl.`;
        if (apiFuel) local.fuelType = apiFuel;

        local.onlineEnriched = true;
        local.source = 'iso3779_and_nhtsa_vpic';

        // Aktualizacja list potwierdzone/nieustalone
        local.confirmed = [];
        local.confirmed.push({ label: 'Marka', value: local.make, confidence: 'WYSOKA (vPIC / WMI)' });
        if (local.model) local.confirmed.push({ label: 'Model', value: local.model, confidence: 'WYSOKA (vPIC)' });
        local.confirmed.push({ label: 'Rok modelowy', value: String(local.modelYear), confidence: 'WYSOKA (vPIC / VIS)' });
        local.confirmed.push({ label: 'Producent', value: local.manufacturer, confidence: 'WYSOKA' });
        local.confirmed.push({ label: 'Kraj produkcji', value: local.country + (apiCity ? ` (${apiCity})` : ''), confidence: 'WYSOKA' });
        local.confirmed.push({ label: 'Typ pojazdu', value: local.vehicleType, confidence: 'WYSOKA' });
        if (local.engineDisplacement) local.confirmed.push({ label: 'Pojemność silnika', value: local.engineDisplacement, confidence: 'WYSOKA' });
        if (local.engineCylinders) local.confirmed.push({ label: 'Liczba cylindrów', value: local.engineCylinders, confidence: 'WYSOKA' });
        if (local.fuelType) local.confirmed.push({ label: 'Rodzaj paliwa', value: local.fuelType, confidence: 'WYSOKA' });
        if (apiSeries) local.confirmed.push({ label: 'Seria / generacja', value: apiSeries, confidence: 'ŚREDNIA' });
        if (apiDrive) local.confirmed.push({ label: 'Układ napędowy', value: apiDrive, confidence: 'ŚREDNIA' });
        local.confirmed.push({ label: 'Kod zakładu', value: local.plantCode, confidence: 'PEWNA' });
        local.confirmed.push({ label: 'Numer seryjny', value: local.serialNumber, confidence: 'PEWNA' });

        // Nowe nieustalone
        local.unconfirmed = [];
        if (!local.model) local.unconfirmed.push('Dokładna nazwa handlowa modelu');
        if (!local.engineDisplacement) local.unconfirmed.push('Pojemność skokowa silnika');
        if (!local.engineCylinders) local.unconfirmed.push('Liczba cylindrów silnika');
      }
    } catch (_) {
      // W razie niepowodzenia sieci zwracamy dane z dekodera lokalnego
    }

    recordHistory(local);
    return local;
  }

  // 10. Zapis wyniku do Czarnej Skrzynki
  function saveToBlackbox(decoded, customNote = '') {
    if (!decoded || !decoded.validation || !decoded.validation.clean) return false;
    try {
      if (typeof localStorage === 'undefined') return false;
      const LOG_KEY = 'naprawnik_log';
      let logs = [];
      try { logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch (_) { logs = []; }
      if (!Array.isArray(logs)) logs = [];

      const desc = [
        `[ODCZYT VIN: ${decoded.validation.clean}]`,
        `Marka: ${decoded.make || 'Nieustalona'}`,
        decoded.model ? `Model: ${decoded.model}` : null,
        decoded.modelYear ? `Rok: ${decoded.modelYear}` : null,
        `Kraj: ${decoded.country || '—'}`,
        decoded.engineDisplacement ? `Silnik: ${decoded.engineDisplacement}` : null,
        customNote ? `Uwagi mechanika: ${customNote}` : null
      ].filter(Boolean).join(' | ');

      logs.push({
        vin: decoded.validation.clean,
        desc: desc,
        date: new Date().toLocaleString('pl-PL'),
        type: 'vin_decode'
      });
      localStorage.setItem(LOG_KEY, JSON.stringify(logs));
      return true;
    } catch (_) {
      return false;
    }
  }

  // 11. Pobranie historii sprawdzonych VIN
  function getVinHistory() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const hist = JSON.parse(localStorage.getItem('naprawnik_vin_history') || '[]');
      return Array.isArray(hist) ? hist : [];
    } catch (_) {
      return [];
    }
  }

  // Eksport globalnego modułu
  global.NAPRAWNIK_VIN = {
    validateVin: validateVin,
    decodeLocal: decodeLocal,
    decodeOnline: fetchOnlineVinData,
    decode: decode,
    saveToBlackbox: saveToBlackbox,
    getVinHistory: getVinHistory,
    WMI_DATABASE: WMI_DATABASE
  };

})(typeof window !== 'undefined' ? window : globalThis);
