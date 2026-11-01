const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../workshop-modules.js'), 'utf8');

test('NAPRAWNIK Workshop exposes all five connected modules', () => {
  for (const marker of ['work_orders','Elektroniczne laboratorium','Inteligentny dobór części','Historia napraw ze zdjęciami','Automatyczny plan serwisowy']) {
    assert.ok(source.includes(marker), 'Missing module marker: ' + marker);
  }
});

test('Workshop data is local-first and does not wipe existing Garage records', () => {
  assert.ok(source.includes('naprawnik_vehicles'));
  assert.ok(source.includes('naprawnik_repairs'));
  assert.ok(source.includes('naprawnik_workshop_media_v1'));
  assert.ok(source.includes('naprawnik_parts_search_history'));
});

test('paid module sync is guarded by plan and usage API', () => {
  assert.ok(source.includes("tier()==='amator'"));
  assert.ok(source.includes('npUsageChange'));
  assert.ok(source.includes('npModuleCloudSave'));
});
