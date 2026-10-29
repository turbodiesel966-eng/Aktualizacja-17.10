const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../mobile-workshop-calculators.js');

test('2T oil mix uses ratio 1:X and returns millilitres', () => {
  assert.equal(calc.oilMlPerLiter(50), 20);
  assert.equal(calc.oilAmountMl(5, 50), 100);
  assert.equal(calc.oilAmountMl(2.5, 40), 62.5);
});

test('engine displacement calculation handles a 40 x 39 mm single cylinder', () => {
  assert.equal(calc.displacementCc(40, 39, 1), 49.01);
  assert.equal(calc.displacementCc(50, 50, 2), 196.35);
});

test('chain ratio is rear teeth divided by front teeth', () => {
  assert.equal(calc.ratioResult(14, 52), 3.714);
});

test('invalid and unsafe numeric inputs are rejected', () => {
  assert.throws(() => calc.oilMlPerLiter(0), /większą od zera/);
  assert.throws(() => calc.oilAmountMl(-1, 50), /większą od zera/);
  assert.throws(() => calc.displacementCc(40, 39, 5), /Liczba cylindrów/);
  assert.throws(() => calc.ratioResult('abc', 52), /większą od zera/);
});
