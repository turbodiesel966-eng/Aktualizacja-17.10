import test from "node:test";
import assert from "node:assert/strict";
import {
  isAdminUser, bootstrapAdmin, getAdminStats, createAdminPromo, redeemPromo, trackVisit
} from "./src/index.mjs";

function createDb({ userIds = ["owner-1", "friend-1"], accountCount = 2 } = {}) {
  const state = {
    userIds, accountCount, adminSettings: null, admins: new Map(), promos: [],
    redemptions: [], visits: [], rateCounts: new Map(), promoInsert: null
  };
  function statement(sql, params = []) {
    return {
      sql, params,
      async first() {
        if (sql.includes("INSERT INTO request_limits")) {
          const [scope, subjectHash, windowStart] = params;
          const key = scope + ":" + subjectHash;
          const old = state.rateCounts.get(key);
          const count = old && old.windowStart === windowStart ? old.count + 1 : 1;
          state.rateCounts.set(key, { windowStart, count });
          return { request_count: count };
        }
        if (sql.includes("SELECT role FROM admin_users")) {
          const admin = state.admins.get(params[0]);
          return admin ? { role: admin.role } : null;
        }
        if (sql.includes("SELECT id, tier, duration_days") || sql.includes("FROM promo_codes WHERE code_hash")) {
          const p = state.promos.find(x => x.code_hash === params[0]);
          return p ? { ...p } : null;
        }
        if (sql.includes("SELECT id FROM promo_redemptions WHERE promo_id")) {
          return state.redemptions.find(x => x.promo_id === params[0] && x.user_id === params[1]) || null;
        }
        if (sql.includes("SELECT redemption_count, max_redemptions, enabled, expires_at FROM promo_codes")) {
          return state.promos.find(x => x.id === params[0]) || null;
        }
        if (sql.includes("SELECT COUNT(*) AS count FROM users")) return { count: state.accountCount };
        if (sql.includes("SELECT COUNT(DISTINCT user_id) AS count FROM app_visits")) return { count: 2 };
        if (sql.includes("SELECT COUNT(*) AS count FROM app_visits")) return { count: 7 };
        if (sql.includes("SELECT COUNT(DISTINCT visitor_hash) AS count FROM app_visits")) return { count: 3 };
        if (sql.includes("SELECT COUNT(*) AS count FROM promo_codes")) return { count: state.promos.filter(x => x.enabled === 1 && x.expires_at > params[0]).length };
        if (sql.includes("SELECT COALESCE(SUM(redemption_count), 0) AS count FROM promo_codes")) return { count: state.promos.reduce((n, p) => n + p.redemption_count, 0) };
        throw new Error("Unexpected first() SQL in admin-promos tests: " + sql);
      },
      async all() {
        if (sql.includes("SELECT tier, status, current_period_end, grace_until FROM subscriptions WHERE user_id")) return { results: [] };
        if (sql.includes("SELECT tier, expires_at FROM promo_redemptions WHERE user_id")) {
          return { results: state.redemptions.filter(r => r.user_id === params[0] && r.expires_at > params[1]).map(r => ({ tier: r.tier, expires_at: r.expires_at })) };
        }
        if (sql.includes("FROM promo_codes ORDER BY created_at DESC")) return { results: state.promos.map(p => ({ ...p })) };
        if (sql.includes("SELECT COUNT")) return { results: [{ count: 0 }] };
        throw new Error("Unexpected all() SQL in admin-promos tests: " + sql);
      },
      async run() {
        if (sql.includes("INSERT INTO promo_codes")) {
          const [id, code_hash, code_hint, label, tier, duration_days, max_redemptions, starts_at, expires_at, enabled, created_by, created_at] = params;
          state.promoInsert = { id, code_hash, code_hint, label, tier, duration_days, max_redemptions, starts_at, expires_at, enabled, created_by, created_at };
          state.promos.push({ ...state.promoInsert, redemption_count: 0 });
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.includes("UPDATE users SET tier = ?")) return { success: true, meta: { changes: 1 } };
        if (sql.includes("INSERT INTO app_visits")) {
          state.visits.push({ id: params[0], visitor_hash: params[1], session_hash: params[2], user_id: params[3], visit_day: params[4], visited_at: params[5] });
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.includes("DELETE FROM app_visits") || sql.includes("DELETE FROM promo_redemptions")) return { success: true, meta: { changes: 0 } };
        throw new Error("Unexpected run() SQL in admin-promos tests: " + sql);
      }
    };
  }
  return {
    state,
    env: {
      DB: {
        prepare(sql) { return { ...statement(sql, []), bind(...params) { return statement(sql, params); } }; },
        async batch(stmts) {
          const results = [];
          let previousChanges = 0;
          for (const st of stmts) {
            const { sql, params } = st;
            if (sql.includes("INSERT OR IGNORE INTO admin_settings")) {
              if (!state.adminSettings) {
                state.adminSettings = { singleton: 1, bootstrapped_by: params[0], bootstrapped_at: params[1] };
                previousChanges = 1;
              } else previousChanges = 0;
              results.push({ success: true, meta: { changes: previousChanges } });
            } else if (sql.includes("INSERT OR IGNORE INTO admin_users")) {
              if (state.adminSettings?.bootstrapped_by === params[2] && !state.admins.has(params[0])) {
                state.admins.set(params[0], { role: "admin", granted_at: params[1] });
                previousChanges = 1;
              } else previousChanges = 0;
              results.push({ success: true, meta: { changes: previousChanges } });
            } else if (sql.includes("UPDATE promo_codes SET redemption_count")) {
              const [id, now, now2, promoId, userId] = params;
              const promo = state.promos.find(p => p.id === id);
              const exists = state.redemptions.some(r => r.promo_id === promoId && r.user_id === userId);
              if (promo && promo.enabled === 1 && promo.starts_at <= now && promo.expires_at > now2 && promo.redemption_count < promo.max_redemptions && !exists) {
                promo.redemption_count += 1; previousChanges = 1;
              } else previousChanges = 0;
              results.push({ success: true, meta: { changes: previousChanges } });
            } else if (sql.includes("INSERT INTO promo_redemptions")) {
              if (previousChanges === 1) {
                const [id, promo_id, user_id, tier, granted_at, expires_at, redeemed_at] = params;
                if (!state.redemptions.some(r => r.promo_id === promo_id && r.user_id === user_id)) {
                  state.redemptions.push({ id, promo_id, user_id, tier, granted_at, expires_at, redeemed_at });
                  previousChanges = 1;
                } else previousChanges = 0;
              } else previousChanges = 0;
              results.push({ success: true, meta: { changes: previousChanges } });
            } else throw new Error("Unexpected batch SQL in admin-promos tests: " + sql);
          }
          return results;
        }
      }
    }
  };
}

test("jednorazowe bootstrap przyznaje admina pierwszemu poprawnemu kontu, a drugie konto odrzuca", async () => {
  const { env, state } = createDb();
  env.ADMIN_BOOTSTRAP_KEY = "NP-ADMIN-UNIT-TEST-KEY";
  const request = key => new Request("https://api.example/api/admin/bootstrap", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key })
  });
  const first = await bootstrapAdmin(request(env.ADMIN_BOOTSTRAP_KEY), env, { userId: "owner-1" });
  assert.equal(first.status, 200);
  assert.equal(await isAdminUser(env, "owner-1"), true);
  const second = await bootstrapAdmin(request(env.ADMIN_BOOTSTRAP_KEY), env, { userId: "friend-1" });
  assert.equal(second.status, 409);
  assert.equal(await isAdminUser(env, "friend-1"), false);
  assert.equal(state.admins.size, 1);
});

test("błędny klucz bootstrap nigdy nie nadaje uprawnień admina", async () => {
  const { env, state } = createDb();
  env.ADMIN_BOOTSTRAP_KEY = "NP-ADMIN-UNIT-TEST-KEY";
  const res = await bootstrapAdmin(new Request("https://api.example/api/admin/bootstrap", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: "wrong-key" })
  }), env, { userId: "owner-1" });
  assert.equal(res.status, 403);
  assert.equal(state.admins.size, 0);
  assert.equal(state.adminSettings, null);
});

test("kod promocyjny jest losowy i w bazie trafia wyłącznie skrót, nie pełny kod", async () => {
  const { env, state } = createDb();
  const response = await createAdminPromo(new Request("https://api.example/api/admin/promos", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tier: "pro", durationDays: 3, maxRedemptions: 1, expiresInDays: 14, label: "Test znajomych" })
  }), env, { userId: "owner-1" });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.match(data.code, /^NAP-[A-HJ-NP-Z2-9]{10}$/);
  assert.equal(state.promos.length, 1);
  assert.notEqual(state.promoInsert.code_hash, data.code);
  assert.equal(state.promoInsert.code_hash.length, 64);
  assert.equal(state.promoInsert.code_hint, data.code.slice(-4));
});

test("promocja aktywuje czasowy dostęp tylko raz na konto i respektuje limit użyć", async () => {
  const { env, state } = createDb();
  const code = "NAP-ABCDEFGHJK";
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("naprawnik-promo:" + code));
  const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
  const now = Math.floor(Date.now() / 1000);
  state.promos.push({
    id: crypto.randomUUID(), code_hash: hex, code_hint: code.slice(-4), label: "Konkurs", tier: "pro",
    duration_days: 3, max_redemptions: 1, redemption_count: 0, starts_at: now - 10, expires_at: now + 86400,
    enabled: 1, created_by: "owner-1", created_at: now - 10
  });
  const request = () => new Request("https://api.example/api/promo/redeem", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code })
  });
  const first = await redeemPromo(request(), env, { userId: "friend-1" });
  assert.equal(first.status, 200);
  const result = await first.json();
  assert.equal(result.tier, "pro");
  assert.equal(result.durationDays, 3);
  const duplicate = await redeemPromo(request(), env, { userId: "friend-1" });
  assert.equal(duplicate.status, 409);
  const otherUser = await redeemPromo(request(), env, { userId: "owner-1" });
  assert.equal(otherUser.status, 409);
  assert.equal(state.promos[0].redemption_count, 1);
  assert.equal(state.redemptions.length, 1);
});

test("licznik zapisuje tylko skróty identyfikatorów przeglądarki i sesji", async () => {
  const { env, state } = createDb();
  const visitorId = "raw-visitor-id-should-not-persist";
  const sessionId = "raw-session-id-should-not-persist";
  const res = await trackVisit(new Request("https://api.example/api/analytics/visit", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ visitorId, sessionId })
  }), env);
  assert.equal(res.status, 200);
  assert.equal(state.visits.length, 1);
  assert.notEqual(state.visits[0].visitor_hash, visitorId);
  assert.notEqual(state.visits[0].session_hash, sessionId);
  assert.equal(state.visits[0].user_id, null);
});

test("statystyki rozdzielają dokładne konta od szacunkowych przeglądarek", async () => {
  const { env } = createDb({ accountCount: 42 });
  const res = await getAdminStats(env);
  const data = await res.json();
  assert.equal(data.registeredAccounts, 42);
  assert.equal(data.uniqueBrowsers7dEstimate, 3);
  assert.match(data.note, /szacunkiem/i);
});
