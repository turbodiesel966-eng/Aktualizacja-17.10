const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const source = fs.readFileSync(path.join(root,'affiliate/market-recommendations.js'),'utf8');
const mobile = fs.readFileSync(path.join(root,'www/affiliate/market-recommendations.js'),'utf8');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const mobileHtml = fs.readFileSync(path.join(root,'www/index.html'),'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root,'scripts/shared-manifest.json'),'utf8'));
const sw = fs.readFileSync(path.join(root,'sw.js'),'utf8');
const mobileSw = fs.readFileSync(path.join(root,'www/sw.js'),'utf8');

test('Market recommendations module exposes context cards, shopping list and click attribution', () => {
  assert.match(source, /NaprawnikMarketRecommendations/);
  assert.match(source, /market-recommendation-results/);
  assert.match(source, /naprawnik_market_shopping_list_v1/);
  assert.match(source, /naprawnik_market_clicks_v1/);
  assert.match(source, /data-market-add/);
  assert.match(source, /Kompatybilność niepotwierdzona/);
  assert.match(source, /naprawnik-market-live/);
});
test('Market recommendation source is byte-identical in PWA and generated APK', () => {
  assert.equal(source, mobile);
  assert.match(html, /market-recommendations\.js/);
  assert.match(mobileHtml, /market-recommendations\.js/);
});
test('Market nav is present in PWA and APK and accepts contextual search query', () => {
  assert.match(html, /data-nav="market"/);
  assert.match(mobileHtml, /data-nav="market"/);
  assert.match(html, /open\(arg \|\| ''\)/);
  assert.match(mobileHtml, /open\(arg \|\| ''\)/);
});
test('Market recommendation scripts and assets are cached separately for web and APK', () => {
  assert.match(sw, /market-recommendations\.js/);
  assert.match(mobileSw, /market-recommendations\.js/);
  assert.match(sw, new RegExp(manifest.cacheVersion));
  assert.match(mobileSw, new RegExp(manifest.nativeCacheVersion));
  assert.equal(manifest.appVersion, '5.51');
});
test('diagnostic, pinout, jetting, manuals and service schedule contain contextual Market cards', () => {
  for (const needle of ["context:'diagnosis'","context:'pinout'","context:'jetting'","context:'service'","context:'manuals'"]) {
    assert.ok(html.includes(needle), 'missing '+needle);
  }
});
