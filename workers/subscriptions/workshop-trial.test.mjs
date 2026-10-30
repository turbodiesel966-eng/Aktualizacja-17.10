import test from "node:test";
import assert from "node:assert/strict";
import { activateWorkshopTrial, userHasTier, recalcUserTier } from "./src/index.mjs";

function makeTrialEnv() {
  const state = { trial: null, tier: "amator", admins: new Set() };
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (sql.includes("INSERT OR IGNORE INTO trial_entitlements")) {
                if (!state.trial) {
                  state.trial = { user_id: args[0], tier: "warsztat", granted_at: args[1], expires_at: args[2], revoked_at: null };
                }
                return { meta: { changes: state.trial.granted_at === args[1] ? 1 : 0 } };
              }
              if (sql.includes("UPDATE users SET tier")) {
                state.tier = args[0];
                return { meta: { changes: 1 } };
              }
              throw new Error("Unexpected run SQL: " + sql);
            },
            async first() {
              if (sql.includes("FROM trial_entitlements WHERE user_id")) return state.trial;
              if (sql.includes("SELECT role FROM admin_users")) return state.admins.has(args[0]) ? { role: "admin" } : null;
              throw new Error("Unexpected first SQL: " + sql);
            },
            async all() {
              if (sql.includes("FROM subscriptions WHERE user_id")) return { results: [] };
              if (sql.includes("FROM promo_redemptions WHERE user_id")) return { results: [] };
              if (sql.includes("FROM one_time_purchases WHERE user_id")) return { results: [] };
              if (sql.includes("FROM trial_entitlements WHERE user_id")) {
                return { results: state.trial && state.trial.revoked_at === null && state.trial.expires_at > args[1] ? [state.trial] : [] };
              }
              throw new Error("Unexpected all SQL: " + sql);
            }
          };
        }
      };
    }
  };
  return { DB, state };
}

test("trial WARSZTAT jest przyznawany raz i trwa dokładnie 24 godziny", async () => {
  const env = makeTrialEnv();
  const auth = { userId: "customer-1" };
  const first = await activateWorkshopTrial(env, auth);
  const firstData = await first.json();
  assert.equal(first.status, 200);
  assert.equal(firstData.tier, "warsztat");
  assert.equal(firstData.expiresAt - firstData.grantedAt, 24 * 60 * 60);
  assert.equal(env.state.tier, "warsztat");

  const second = await activateWorkshopTrial(env, auth);
  const secondData = await second.json();
  assert.equal(second.status, 200);
  assert.equal(secondData.grantedAt, firstData.grantedAt);
  assert.equal(secondData.expiresAt, firstData.expiresAt);
});

test("wygasły trial nie może zostać uruchomiony ponownie", async () => {
  const env = makeTrialEnv();
  env.state.trial = {
    user_id: "customer-2", tier: "warsztat", granted_at: 100, expires_at: 101, revoked_at: null
  };
  const response = await activateWorkshopTrial(env, { userId: "customer-2" });
  assert.equal(response.status, 409);
  assert.equal(env.state.trial.granted_at, 100);
  assert.equal(env.state.trial.expires_at, 101);
});

test("ADMIN otrzymuje dostęp do chronionego planem zasobu niezależnie od tier", async () => {
  const env = makeTrialEnv();
  env.state.admins.add("owner-1");
  assert.equal(await userHasTier(env, "owner-1", "warsztat"), true);
  assert.equal(env.state.tier, "amator");
});

test("zwykłe konto nie otrzymuje automatycznego dostępu WARSZTAT", async () => {
  const env = makeTrialEnv();
  assert.equal(await userHasTier(env, "customer-3", "warsztat"), false);
  assert.equal(env.state.tier, "amator");
});
