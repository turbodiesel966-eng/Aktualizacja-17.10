import test from "node:test";
import assert from "node:assert/strict";
import { enforceRateLimit, requiredTierForDataKey, isReservedDataKey, safeReturnUrl } from "./src/index.mjs";
import { readFile } from "node:fs/promises";

function fakeLimitEnv() {
  const counters = new Map();
  return {
    counters,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                assert.match(sql, /INSERT INTO request_limits/);
                const [scope, subjectHash, windowStart, now] = args;
                const key = scope + ':' + subjectHash;
                const prior = counters.get(key);
                const count = prior && prior.windowStart === windowStart ? prior.count + 1 : 1;
                counters.set(key, { windowStart, count, updatedAt: now });
                return { request_count: count };
              },
              async run() { return { success: true }; }
            };
          }
        };
      }
    }
  };
}

test("rate limit zwraca 429 po przekroczeniu limitu i rozdziela klientów", async () => {
  const env = fakeLimitEnv();
  const policy = { maxRequests: 2, windowSeconds: 900 };
  const requestA = new Request("https://api.example/api/register", { method: "POST", headers: { "CF-Connecting-IP": "203.0.113.10" } });
  const requestB = new Request("https://api.example/api/register", { method: "POST", headers: { "CF-Connecting-IP": "203.0.113.11" } });
  assert.equal(await enforceRateLimit(requestA, env, "registration", "203.0.113.10", policy), null);
  assert.equal(await enforceRateLimit(requestA, env, "registration", "203.0.113.10", policy), null);
  const limited = await enforceRateLimit(requestA, env, "registration", "203.0.113.10", policy);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  assert.equal(await enforceRateLimit(requestB, env, "registration", "203.0.113.11", policy), null);
});

test("mapowanie namespace danych wymaga właściwego planu", () => {
  assert.equal(requiredTierForDataKey("pro:calibration"), "pro");
  assert.equal(requiredTierForDataKey("premium.data"), "pro");
  assert.equal(requiredTierForDataKey("warsztat:klienci"), "warsztat");
  assert.equal(requiredTierForDataKey("workshop/log"), "warsztat");
  assert.equal(requiredTierForDataKey("naprawnik_notes"), "amator");
  assert.equal(isReservedDataKey("naprawnik_license"), true);
  assert.equal(isReservedDataKey("billing:status"), true);
  assert.equal(isReservedDataKey("naprawnik_notes"), false);
});

test("Checkout return URL musi być HTTPS i mieć zgodne origin", () => {
  const base = "https://staging.example.test/app/";
  assert.equal(safeReturnUrl("https://staging.example.test/app/?checkout=success", "https://staging.example.test/app/?checkout=success", base), "https://staging.example.test/app/?checkout=success");
  assert.equal(safeReturnUrl("https://evil.example.test/callback", base, base), null);
  assert.equal(safeReturnUrl("http://staging.example.test/callback", base, base), null);
});

test("Worker nie nadpisuje przełącznika produkcji i stosuje kontrole", async () => {
  const source = await readFile(new URL("./src/index.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /PRODUCTION_ENABLED:\s*["\x27]true["\x27]/);
  assert.match(source, /url\.pathname === ["\x27]\/api\/register["\x27][\s\S]{0,300}enforceRateLimit/);
  assert.match(source, /url\.pathname === ["\x27]\/api\/data["\x27][\s\S]{0,700}enforceRateLimit/);
  assert.match(source, /originHeader && !allowedOrigin\(request, env\)/);
  assert.match(source, /An active subscription for the required plan is needed/);
});
