const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Service Worker clears only its own old caches and bumps its version', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.match(source, /const CACHE='naprawnik-v5-25'/);
  assert.match(source, /ks\.filter\(k=>k\.startsWith\('naprawnik-'\)&&k!==CACHE\)/);
});
