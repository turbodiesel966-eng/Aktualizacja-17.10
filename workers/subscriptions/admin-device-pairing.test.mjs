import test from "node:test";
import assert from "node:assert/strict";
import { createAdminDeviceLink, adminMobileLogin } from "./src/index.mjs";

function makeEnv() {
  const state = {
    ownerId: "owner-account",
    admins: new Map([["owner-account", { role: "admin" }]]),
    codes: new Map(),
    tokens: [],
    limits: new Map()
  };
  const now = Math.floor(Date.now() / 1000);
  state.adminSettings = { singleton: 1, bootstrapped_by: state.ownerId, bootstrapped_at: now - 100 };

  function statement(sql, params = []) {
    return {
      async first() {
        if (sql.includes("INSERT INTO request_limits")) {
          const [scope, subjectHash, windowStart] = params;
          const key = scope + ":" + subjectHash;
          const old = state.limits.get(key);
          const count = old && old.windowStart === windowStart ? old.count + 1 : 1;
          state.limits.set(key, { windowStart, count });
          return { request_count: count };
        }
        if (sql.includes("SELECT role FROM admin_users")) {
          const found = state.admins.get(params[0]);
          return found ? { role: found.role } : null;
        }
        if (sql.includes("SELECT bootstrapped_by FROM admin_settings")) {
          return state.adminSettings ? { bootstrapped_by: state.adminSettings.bootstrapped_by } : null;
        }
        if (sql.includes("SELECT user_id FROM admin_device_codes")) {
          const [hash, queryNow] = params;
          const found = state.codes.get(hash);
          return found && found.used_at === null && found.expires_at > queryNow
            ? { user_id: found.user_id }
            : null;
        }
        throw new Error("Unexpected first() SQL: " + sql);
      },
      async run() {
        if (sql.includes("DELETE FROM request_limits")) {
          return { success: true, meta: { changes: 0 } };
        }
        if (sql.includes("DELETE FROM admin_device_codes")) {
          let count = 0;
          for (const [hash, row] of state.codes) {
            if (row.expires_at <= params[0] || row.used_at !== null) {
              state.codes.delete(hash);
              count++;
            }
          }
          return { success: true, meta: { changes: count } };
        }
        if (sql.includes("INSERT INTO admin_device_codes")) {
          const [code_hash, user_id, created_at, expires_at, created_by] = params;
          state.codes.set(code_hash, { code_hash, user_id, created_at, expires_at, used_at: null, created_by });
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.includes("UPDATE admin_device_codes SET used_at")) {
          const [usedAt, hash, queryNow] = params;
          const row = state.codes.get(hash);
          if (row && row.used_at === null && row.expires_at > queryNow) {
            row.used_at = usedAt;
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 0 } };
        }
        if (sql.includes("INSERT INTO api_tokens")) {
          const [token_hash, user_id, created_at, expires_at, last_used_at] = params;
          state.tokens.push({ token_hash, user_id, created_at, expires_at, revoked_at: null, last_used_at });
          return { success: true, meta: { changes: 1 } };
        }
        throw new Error("Unexpected run() SQL: " + sql);
      }
    };
  }

  return {
    state,
    env: {
      DB: {
        prepare(sql) {
          const prepared = statement(sql, []);
          prepared.bind = (...params) => statement(sql, params);
          return prepared;
        }
      }
    }
  };
}

test("właściciel może wygenerować kod parowania ważny 10 minut, bez zapisania jawnego kodu w bazie", async () => {
  const { env, state } = makeEnv();
  const request = new Request("https://api.example/api/admin/device-link", {
    method: "POST", headers: { "CF-Connecting-IP": "203.0.113.8" }, body: "{}"
  });
  const response = await createAdminDeviceLink(request, env, { userId: state.ownerId });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.match(data.code, /^NP-MOB-[A-F0-9]{24}$/);
  assert.equal(data.expiresInSeconds, 600);
  assert.equal(state.codes.size, 1);
  assert.equal(state.codes.has(data.code), false);
  assert.equal([...state.codes.values()][0].user_id, state.ownerId);
  assert.equal([...state.codes.values()][0].expires_at - [...state.codes.values()][0].created_at, 600);
});

test("kod jednorazowy łączy telefon z istniejącym kontem admina i nie może być użyty dwa razy", async () => {
  const { env, state } = makeEnv();
  const generated = await createAdminDeviceLink(new Request("https://api.example/api/admin/device-link", {
    method: "POST", headers: { "CF-Connecting-IP": "203.0.113.8" }, body: "{}"
  }), env, { userId: state.ownerId });
  const code = (await generated.json()).code;
  const loginRequest = () => new Request("https://api.example/api/admin/mobile-login", {
    method: "POST", headers: { "CF-Connecting-IP": "203.0.113.9", "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
  const response = await adminMobileLogin(loginRequest(), env);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.role, "admin");
  assert.match(data.token, /^[a-f0-9]{64}$/);
  assert.equal(state.tokens.length, 1);
  assert.equal(state.tokens[0].user_id, state.ownerId);
  assert.notEqual(state.tokens[0].token_hash, data.token);
  const row = [...state.codes.values()][0];
  assert.ok(row.used_at > 0);

  const replay = await adminMobileLogin(loginRequest(), env);
  assert.equal(replay.status, 401);
  assert.equal(state.tokens.length, 1);
});

test("konto niebędące właścicielem nie może tworzyć kodu parowania", async () => {
  const { env, state } = makeEnv();
  const response = await createAdminDeviceLink(new Request("https://api.example/api/admin/device-link", {
    method: "POST", headers: { "CF-Connecting-IP": "203.0.113.10" }, body: "{}"
  }), env, { userId: "ordinary-user" });
  assert.equal(response.status, 403);
  assert.equal(state.codes.size, 0);
});

test("błędny kod mobilny nie tworzy tokena admina", async () => {
  const { env, state } = makeEnv();
  const response = await adminMobileLogin(new Request("https://api.example/api/admin/mobile-login", {
    method: "POST", headers: { "CF-Connecting-IP": "203.0.113.11", "Content-Type": "application/json" },
    body: JSON.stringify({ code: "NP-MOB-000000000000000000000000" })
  }), env);
  assert.equal(response.status, 401);
  assert.equal(state.tokens.length, 0);
});
