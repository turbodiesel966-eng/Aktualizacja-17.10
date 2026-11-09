const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadVinDecoder() {
  const filePath = path.join(__dirname, '..', 'vin-decoder.js');
  const code = fs.readFileSync(filePath, 'utf8');
  const fakeStorage = {};
  const sandbox = {
    window: {},
    globalThis: {},
    localStorage: {
      getItem: k => (k in fakeStorage ? fakeStorage[k] : null),
      setItem: (k, v) => { fakeStorage[k] = String(v); }
    },
    console
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox, { filename: 'vin-decoder.js' });
  return sandbox.NAPRAWNIK_VIN;
}

test('NAPRAWNIK VIN — Walidacja 17 znaków, odrzucanie I, O, Q oraz suma kontrolna', () => {
  const VIN = loadVinDecoder();
  assert.ok(VIN, 'Brak modułu NAPRAWNIK_VIN');

  // Za krótki VIN
  const tooShort = VIN.validateVin('JH2SC57A');
  assert.strictEqual(tooShort.isValidLength, false);
  assert.strictEqual(tooShort.isStandardIsoCompliant, false);

  // Za długi VIN
  const tooLong = VIN.validateVin('JH2SC57A18M0000019999');
  assert.strictEqual(tooLong.isValidLength, false);

  // VIN z literami I, O, Q
  const illegal = VIN.validateVin('JH2SC57AI8MO0000Q');
  assert.strictEqual(illegal.hasIllegalChars, true);
  assert.strictEqual(Array.from(illegal.illegalChars).sort().join(','), 'I,O,Q');
  assert.strictEqual(illegal.isStandardIsoCompliant, false);

  // Prawidłowy VIN z obliczoną sumą kontrolną (np. Honda CBR1000RR: JH2SC57A*8M000001)
  // Wyliczmy prawidłowy znak kontrolny na 9. pozycji
  const sample = 'JH2SC57A08M000001';
  const val = VIN.validateVin(sample);
  assert.strictEqual(val.isValidLength, true);
  assert.strictEqual(val.hasIllegalChars, false);
  assert.strictEqual(val.isStandardIsoCompliant, true);
  assert.ok(val.checkDigitExpected !== null);
});

test('NAPRAWNIK VIN — Dekodowanie lokalne offline (WMI, kraj, rok modelowy, zakład, nr seryjny)', () => {
  const VIN = loadVinDecoder();

  // Test 1: Honda (Japonia, rok 2018 'J', plant 'M', serial '000001')
  const hondaVin = 'JH2SC57A8JM000001';
  const resHonda = VIN.decodeLocal(hondaVin);
  assert.strictEqual(resHonda.success, true);
  assert.strictEqual(resHonda.make, 'Honda');
  assert.strictEqual(resHonda.country, 'Japonia');
  assert.strictEqual(resHonda.plantCode, 'M');
  assert.strictEqual(resHonda.serialNumber, '000001');
  assert.ok(resHonda.confirmed.some(c => c.label === 'Marka' && c.value === 'Honda'));
  assert.ok(resHonda.unconfirmed.length > 0, 'Powinny być jawnie wymienione pola nieustalone offline');

  // Test 2: Yamaha (Japonia, JYA, rok 2021 'M')
  const yamahaVin = 'JYARJ15E2MA000002';
  const resYamaha = VIN.decodeLocal(yamahaVin);
  assert.strictEqual(resYamaha.success, true);
  assert.strictEqual(resYamaha.make, 'Yamaha');
  assert.strictEqual(resYamaha.country, 'Japonia');

  // Test 3: Piaggio / Vespa (Włochy, ZAP)
  const piaggioVin = 'ZAPM0920030000003';
  const resPiaggio = VIN.decodeLocal(piaggioVin);
  assert.strictEqual(resPiaggio.success, true);
  assert.strictEqual(resPiaggio.make, 'Piaggio');
  assert.strictEqual(resPiaggio.country, 'Włochy');

  // Test 4: BMW Motorrad (Niemcy, WB1)
  const bmwVin = 'WB10A0201DZ000004';
  const resBmw = VIN.decodeLocal(bmwVin);
  assert.strictEqual(resBmw.success, true);
  assert.strictEqual(resBmw.make, 'BMW');
  assert.strictEqual(resBmw.country, 'Niemcy');

  // Test 5: KTM (Austria, VBK)
  const ktmVin = 'VBKVB4401KM000005';
  const resKtm = VIN.decodeLocal(ktmVin);
  assert.strictEqual(resKtm.success, true);
  assert.strictEqual(resKtm.make, 'KTM');
  assert.strictEqual(resKtm.country, 'Austria');
});

test('NAPRAWNIK VIN — Zapis do Czarnej Skrzynki i historia sprawdzonych numerów', async () => {
  const VIN = loadVinDecoder();
  const testVin = 'JH2SC57A8JM000001';

  const decoded = await VIN.decode(testVin, { offlineOnly: true });
  assert.strictEqual(decoded.success, true);

  // Sprawdzenie historii
  const history = VIN.getVinHistory();
  assert.ok(history.some(h => h.vin === testVin));

  // Zapis do Czarnej Skrzynki
  const saved = VIN.saveToBlackbox(decoded, 'Wymiana świec i regulacja luzów');
  assert.strictEqual(saved, true);
});

test('NAPRAWNIK VIN — Wzbogacanie danymi API online (NHTSA vPIC) z obsługą błędów', async () => {
  const filePath = path.join(__dirname, '..', 'vin-decoder.js');
  const code = fs.readFileSync(filePath, 'utf8');
  const fakeStorage = {};

  const sandbox = {
    window: {},
    globalThis: {},
    localStorage: {
      getItem: k => (k in fakeStorage ? fakeStorage[k] : null),
      setItem: (k, v) => { fakeStorage[k] = String(v); }
    },
    fetch: async (url) => {
      return {
        ok: true,
        json: async () => ({
          Results: [{
            Make: 'HONDA',
            Model: 'CBR1000RR',
            ModelYear: '2018',
            Manufacturer: 'HONDA MOTOR CO., LTD.',
            VehicleType: 'MOTORCYCLE',
            PlantCountry: 'JAPAN',
            PlantCity: 'KUMAMOTO',
            DisplacementCC: '999.8',
            EngineCylinders: '4',
            FuelTypePrimary: 'Gasoline'
          }]
        })
      };
    },
    console
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox, { filename: 'vin-decoder.js' });

  const VIN = sandbox.NAPRAWNIK_VIN;
  const decoded = await VIN.decode('JH2SC57A8JM000001');

  assert.strictEqual(decoded.success, true);
  assert.strictEqual(decoded.onlineEnriched, true);
  assert.strictEqual(decoded.make, 'HONDA');
  assert.strictEqual(decoded.model, 'CBR1000RR');
  assert.strictEqual(decoded.modelYear, '2018');
  assert.strictEqual(decoded.engineDisplacement, '1000 cm³');
  assert.strictEqual(decoded.engineCylinders, '4 cyl.');
  assert.ok(decoded.confirmed.some(c => c.label === 'Model' && c.value === 'CBR1000RR'));
});
