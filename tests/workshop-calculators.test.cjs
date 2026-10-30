const test = require('node:test');
const assert = require('node:assert/strict');
const calculators = require('../mobile-workshop-calculators.js');

test('mieszanka 2T: 5 litrów przy 1:50 wymaga 100 ml oleju', () => {
  assert.equal(calculators.oilAmountMl(5, 50), 100);
});

test('mieszanka 2T: oblicza ilość oleju na litr', () => {
  assert.equal(calculators.oilMlPerLiter(40), 25);
});

test('pojemność: cylinder 40 x 39 mm daje około 49,01 cm3', () => {
  assert.equal(calculators.displacementCc(40, 39, 1), 49.01);
});

test('pojemność: uwzględnia liczbę cylindrów', () => {
  assert.equal(calculators.displacementCc(40, 39, 2), 98.02);
});

test('przełożenie: 14 zębów z przodu i 52 z tyłu daje 3,714:1', () => {
  assert.equal(calculators.ratioResult(14, 52), 3.714);
});

test('kalkulatory odrzucają wartości zerowe, ujemne i nienumeryczne', () => {
  assert.throws(() => calculators.oilAmountMl(0, 50), /większą od zera/);
  assert.throws(() => calculators.oilMlPerLiter(-1), /większą od zera/);
  assert.throws(() => calculators.displacementCc('abc', 39, 1), /większą od zera/);
  assert.throws(() => calculators.ratioResult(14, 0), /większą od zera/);
});

test('pojemność odrzuca nieobsługiwaną liczbę cylindrów', () => {
  assert.throws(() => calculators.displacementCc(40, 39, 5), /Liczba cylindrów/);
});
