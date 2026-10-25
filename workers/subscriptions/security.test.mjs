import test from "node:test";
import assert from "node:assert/strict";
import { enforceRateLimit, requiredTierForDataKey, isReservedDataKey, safeReturnUrl, isSubscriptionLifecycleEvent, graceUntilForFailedInvoice, checkoutLockAction, ensureStripeCustomerLink } from "./src/index.mjs";
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


test("webhook obsługuje pauzowanie i wznowienie subskrypcji", () => {
  for (const type of [
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "customer.subscription.resumed",
    "customer.subscription.pending_update_applied",
    "customer.subscription.pending_update_expired"
  ]) assert.equal(isSubscriptionLifecycleEvent(type), true, type);
  assert.equal(isSubscriptionLifecycleEvent("invoice.payment_failed"), false);
});

test("ponowienie invoice.payment_failed nie przedłuża okresu tolerancji", () => {
  const invoice = { created: 1_800_000_000 };
  const firstGraceEnd = graceUntilForFailedInvoice({ status: "active", grace_until: null }, invoice, 1_800_000_010);
  assert.equal(firstGraceEnd, invoice.created + 3 * 24 * 60 * 60);

  const retryGraceEnd = graceUntilForFailedInvoice(
    { status: "past_due", grace_until: firstGraceEnd },
    invoice,
    firstGraceEnd + 60 * 60
  );
  assert.equal(retryGraceEnd, firstGraceEnd);

  const lateRetryGraceEnd = graceUntilForFailedInvoice(
    { status: "past_due", grace_until: firstGraceEnd },
    { created: invoice.created + 2 * 24 * 60 * 60 },
    firstGraceEnd + 4 * 24 * 60 * 60
  );
  assert.equal(lateRetryGraceEnd, firstGraceEnd);
});

test("blokada Checkout rozróżnia ten sam plan, inny plan i wygasłą blokadę", () => {
  const now = 1_800_000_000;
  assert.equal(checkoutLockAction(null, "pro", "month", now), "acquire");
  assert.equal(checkoutLockAction({ tier: "pro", billing_interval: "month", expires_at: now - 1 }, "pro", "month", now), "acquire");
  assert.equal(checkoutLockAction({ tier: "pro", billing_interval: "month", session_id: null, expires_at: now + 300 }, "pro", "month", now), "in_progress");
  assert.equal(checkoutLockAction({ tier: "pro", billing_interval: "month", session_id: "cs_test_x", expires_at: now + 300 }, "pro", "month", now), "inspect_session");
  assert.equal(checkoutLockAction({ tier: "pro", billing_interval: "month", session_id: "cs_test_x", expires_at: now + 300 }, "warsztat", "month", now), "different_plan");
});

test("powiązanie klienta Stripe odtwarza się przy webhooku i nie przenosi klienta do innego konta", async () => {
  const customers = new Map();
  const customersByUser = new Map();
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            if (sql.includes("INSERT INTO stripe_customers")) {
              return {
                async run() {
                  const [customerId, userId] = params;
                  if (customers.has(customerId)) {
                    if (customers.get(customerId) === userId) return { success: true, meta: { changes: 0 } };
                    return { success: true, meta: { changes: 0 } };
                  }
                  if (customersByUser.has(userId) && customersByUser.get(userId) !== customerId) {
                    throw new Error("UNIQUE constraint failed: stripe_customers.user_id");
                  }
                  customers.set(customerId, userId);
                  customersByUser.set(userId, customerId);
                  return { success: true, meta: { changes: 1 } };
                }
              };
            }
            if (sql.includes("SELECT user_id FROM stripe_customers")) {
              return { async first() { const userId = customers.get(params[0]); return userId ? { user_id: userId } : null; } };
            }
            throw new Error("Unexpected SQL: " + sql);
          }
        };
      }
    }
  };

  await ensureStripeCustomerLink(env, "cus_test_1", "user_1");
  await ensureStripeCustomerLink(env, "cus_test_1", "user_1");
  assert.equal(customers.get("cus_test_1"), "user_1");
  await assert.rejects(
    ensureStripeCustomerLink(env, "cus_test_1", "user_2"),
    /STRIPE_CUSTOMER_ALREADY_LINKED_TO_DIFFERENT_USER/
  );
  assert.equal(customers.get("cus_test_1"), "user_1");
});

test("Worker atomowo blokuje drugi Checkout i ma migrację blokad", async () => {
  const source = await readFile(new URL("./src/index.mjs", import.meta.url), "utf8");
  const migration = await readFile(new URL("./migrations/0003_checkout_locks.sql", import.meta.url), "utf8");
  const acquireAt = source.indexOf("INSERT INTO checkout_locks");
  const stripeAt = source.indexOf('fetch("https://api.stripe.com/v1/checkout/sessions"');
  assert.ok(acquireAt >= 0 && stripeAt > acquireAt, "blokada musi powstać przed wywołaniem Stripe");
  assert.match(source, /ON CONFLICT\(user_id\)[\s\S]{0,300}WHERE checkout_locks\.expires_at <= \?/);
  assert.match(migration, /user_id TEXT PRIMARY KEY/);
  assert.match(migration, /idempotency_key TEXT NOT NULL UNIQUE/);
  assert.doesNotMatch(migration, /DROP TABLE/i);
});
