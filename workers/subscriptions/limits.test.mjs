import test from "node:test";
import assert from "node:assert/strict";
import { limitsForTier, monthlyWindow, checkBackupLimits, countBackupItems, PLAN_LIMITS, GB } from "./src/limits.mjs";

test("limitsForTier zwraca prawidłowe zmniejszone limity PRO i limity AMATOR oraz WARSZTAT", () => {
  const amator = limitsForTier("amator");
  assert.equal(amator.vehicles, 1);
  assert.equal(amator.reminders, 5);
  assert.equal(amator.measurements, 20);
  assert.equal(amator.parts_searches, 10);
  assert.equal(amator.photos_local, 10);
  assert.equal(amator.ai_analyses, 0);
  assert.equal(amator.new_orders, 0);
  assert.equal(amator.cloud_backup, 0);

  const pro = limitsForTier("pro");
  assert.equal(pro.vehicles, 3);
  assert.equal(pro.reminders, 15);
  assert.equal(pro.measurements, 150);
  assert.equal(pro.parts_searches, 50);
  assert.equal(pro.photos, 50);
  assert.equal(pro.photo_bytes, 1 * GB);
  assert.equal(pro.ai_analyses, 5);
  assert.equal(pro.new_orders, 0);
  assert.equal(pro.cloud_backup, 1);

  const warsztat = limitsForTier("warsztat");
  assert.equal(warsztat.vehicles, 500);
  assert.equal(warsztat.reminders, 200);
  assert.equal(warsztat.measurements, 5000);
  assert.equal(warsztat.parts_searches, 300);
  assert.equal(warsztat.photos, 300);
  assert.equal(warsztat.photo_bytes, 10 * GB);
  assert.equal(warsztat.ai_analyses, 30);
  assert.equal(warsztat.new_orders, 30);
  assert.equal(warsztat.cloud_backup, 1);

  assert.equal(limitsForTier("warsztat", true), null); // Admin/Owner is unlimited
});

test("monthlyWindow wylicza prawidłowe okno czasowe dla odnowień", () => {
  const now = 1793540000;
  const w = monthlyWindow(now);
  assert.ok(w.start <= now);
  assert.ok(w.end > now);
  assert.ok(w.end > w.start);
});

test("checkBackupLimits wykrywa przekroczenie limitu i chroni przed nadpisaniem", () => {
  const nextBackup = {
    data: {
      naprawnik_vehicles: [{ id: "v1" }, { id: "v2" }, { id: "v3" }, { id: "v4" }],
      naprawnik_reminders: new Array(16).fill({ id: "r" }),
      naprawnik_measurements: [{ id: "m1" }]
    }
  };
  const prevBackup = {
    data: {
      naprawnik_vehicles: [{ id: "v1" }, { id: "v2" }, { id: "v3" }],
      naprawnik_reminders: new Array(15).fill({ id: "r" })
    }
  };

  // PRO ma limit 3 pojazdów i 15 przypomnień:
  const violations = checkBackupLimits("pro", false, nextBackup, prevBackup);
  assert.ok(violations);
  assert.equal(violations.length, 2);
  assert.equal(violations[0].metric, "vehicles");
  assert.equal(violations[0].limit, 3);
  assert.equal(violations[0].count, 4);

  // WARSZTAT ma limit 500 pojazdów - brak naruszeń:
  const warsztatViolations = checkBackupLimits("warsztat", false, nextBackup, prevBackup);
  assert.equal(warsztatViolations, null);

  // Jeśli użytkownik PRO już wcześniej miał 4 pojazdy (nie zwiększa liczby), nie blokujemy:
  const noIncreaseViolations = checkBackupLimits("pro", false, nextBackup, nextBackup);
  assert.equal(noIncreaseViolations, null);
});
