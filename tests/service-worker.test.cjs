const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Service Worker clears only its own old caches and bumps its version', () => {
  const source = read('sw.js');
  assert.match(source, /const CACHE='naprawnik-v5-38'/);
  assert.match(source, /ks\.filter\(k=>k\.startsWith\('naprawnik-'\)&&k!==CACHE\)/);
});

test('PWA manifest has valid relative scope, start URL and matching app icon', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, 'NAPRAWNIK — Warsztat i Diagnostyka');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.src === './assets/naprawnik-icon-192.svg' && icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.src === './assets/naprawnik-icon-512.svg' && icon.sizes === '512x512' && icon.purpose === 'maskable'));
  const index = read('index.html');
  assert.match(index, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(index, /<link rel="icon" type="image\/svg\+xml" href="\.\/assets\/naprawnik-icon\.svg">/);
  const sw = read('sw.js');
  assert.ok(sw.includes("'./manifest.webmanifest'"));
  assert.ok(sw.includes("'./assets/naprawnik-icon.svg'"));
  assert.ok(sw.includes("'./assets/naprawnik-icon-192.svg'"));
  assert.ok(sw.includes("'./assets/naprawnik-icon-512.svg'"));
  assert.ok(sw.includes("'./assets/workshop-icons.svg'"));
  const icon = read('assets/naprawnik-icon.svg');
  assert.match(icon, /<svg\b/);
  assert.match(icon, /viewBox="0 0 512 512"/);
});
