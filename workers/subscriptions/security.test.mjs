import test from "node:test";
import assert from "node:assert/strict";
import { authenticate, enforceRateLimit, requiredTierForDataKey, isReservedDataKey, safeReturnUrl, isNativeAppRequest, billingReturnPage, isSubscriptionLifecycleEvent, graceUntilForFailedInvoice, checkoutLockAction, ensureStripeCustomerLink, checkout, handleWebhook, photoDiagnosis, createBillingPortalSession, diagnoseStripeConfig } from "./src/index.mjs";
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
  assert.match(source, /url\.pathname === ["\x27]\/api\/billing-portal["\x27][\s\S]{0,500}enforceRateLimit/);
  assert.match(source, /billingPortal: Object\.freeze\(\{ maxRequests: 10, windowSeconds: 15 \* 60 \}\)/);
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


function makeCheckoutTestEnv() {
  const state = { lock: null, sessions: new Map(), checkoutRequests: [], stripePosts: 0, priceLivemode: false, priceCurrency: "pln", checkoutForm: null };
  const env = {
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_EXPECT_LIVEMODE: "false",
    STRIPE_PRICE_PRO_MONTHLY: "price_test_pro_month",
    STRIPE_PRICE_PRO_YEARLY: "price_test_pro_year",
    STRIPE_PRICE_WARSZTAT_MONTHLY: "price_test_warsztat_month",
    STRIPE_PRICE_WARSZTAT_YEARLY: "price_test_warsztat_year",
    APP_BASE_URL: "https://app.example.test/",
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() {
                if (sql.includes("SELECT id, email FROM users")) return { id: "user_test_1", email: "test@example.test" };
                if (sql.includes("FROM subscriptions WHERE user_id = ?")) return null;
                if (sql.includes("FROM checkout_locks WHERE user_id = ?")) return state.lock ? { ...state.lock } : null;
                if (sql.includes("SELECT expires_at FROM one_time_checkout_locks WHERE user_id = ?")) return null;
                if (sql.includes("SELECT stripe_customer_id FROM stripe_customers")) return null;
                throw new Error("Unexpected first() SQL: " + sql);
              },
              async run() {
                if (sql.includes("INSERT INTO checkout_locks")) {
                  const [userId, key, tier, interval, expiresAt, createdAt, conditionNow] = params;
                  if (!state.lock || Number(state.lock.expires_at) <= Number(conditionNow)) {
                    state.lock = { user_id: userId, idempotency_key: key, tier, billing_interval: interval, session_id: null, expires_at: expiresAt, created_at: createdAt };
                    return { success: true, meta: { changes: 1 } };
                  }
                  return { success: true, meta: { changes: 0 } };
                }
                if (sql.includes("UPDATE checkout_locks SET session_id")) {
                  const [sessionId, expiresAt, userId, key] = params;
                  if (state.lock && state.lock.user_id === userId && state.lock.idempotency_key === key) {
                    state.lock.session_id = sessionId;
                    state.lock.expires_at = expiresAt;
                    return { success: true, meta: { changes: 1 } };
                  }
                  return { success: true, meta: { changes: 0 } };
                }
                if (sql.includes("INSERT INTO checkout_requests")) {
                  state.checkoutRequests.push(params);
                  return { success: true, meta: { changes: 1 } };
                }
                if (sql.includes("DELETE FROM checkout_locks")) {
                  if (state.lock && state.lock.user_id === params[0] && (!params[1] || state.lock.idempotency_key === params[1])) state.lock = null;
                  return { success: true, meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE checkout_locks SET expires_at")) {
                  if (state.lock && state.lock.user_id === params[1] && state.lock.idempotency_key === params[2]) state.lock.expires_at = params[0];
                  return { success: true, meta: { changes: 1 } };
                }
                throw new Error("Unexpected run() SQL: " + sql);
              }
            };
          }
        };
      }
    }
  };
  return { env, state };
}
function checkoutRequest(key, tier = "pro", interval = "month") {
  return new Request("https://api.example.test/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({ tier, interval })
  });
}
function mockStripeCheckoutFetch(state) {
  return async (input, init = {}) => {
    const url = String(input);
    const method = init.method || "GET";
    const pricePrefix = "https://api.stripe.com/v1/prices/";
    if (url.startsWith(pricePrefix) && method === "GET") {
      const priceId = decodeURIComponent(url.slice(pricePrefix.length));
      const interval = priceId.includes("_year") ? "year" : "month";
      return new Response(JSON.stringify({
        id: priceId, active: true, livemode: state.priceLivemode, currency: state.priceCurrency,
        recurring: { interval, interval_count: 1 }, unit_amount: 900
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "https://api.stripe.com/v1/checkout/sessions" && method === "POST") {
      state.stripePosts += 1;
      state.checkoutForm = new URLSearchParams(init.body);
      const id = "cs_test_" + state.stripePosts;
      const session = { id, url: "https://checkout.stripe.com/c/pay/" + id, status: "open", expires_at: Math.floor(Date.now() / 1000) + 3600 };
      state.sessions.set(id, session);
      return new Response(JSON.stringify(session), { status: 200, headers: { "content-type": "application/json" } });
    }
    const prefix = "https://api.stripe.com/v1/checkout/sessions/";
    if (url.startsWith(prefix) && method === "POST" && url.endsWith("/expire")) {
      const id = decodeURIComponent(url.slice(prefix.length, -"/expire".length));
      const session = state.sessions.get(id);
      if (!session || session.status !== "open") {
        return new Response(JSON.stringify({ error: { message: "session is not open" } }), { status: 400, headers: { "content-type": "application/json" } });
      }
      session.status = "expired";
      state.expirePosts = (state.expirePosts || 0) + 1;
      return new Response(JSON.stringify(session), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.startsWith(prefix) && method === "GET") {
      const session = state.sessions.get(decodeURIComponent(url.slice(prefix.length)));
      return session
        ? new Response(JSON.stringify(session), { status: 200, headers: { "content-type": "application/json" } })
        : new Response(JSON.stringify({ error: { message: "not found" } }), { status: 404, headers: { "content-type": "application/json" } });
    }
    throw new Error("Unexpected Stripe request: " + method + " " + url);
  };
}

test("Checkout tworzy jedną sesję i ponowne kliknięcie tej samej taryfy używa istniejącej", async () => {
  const originalFetch = globalThis.fetch;
  const { env, state } = makeCheckoutTestEnv();
  globalThis.fetch = mockStripeCheckoutFetch(state);
  try {
    const first = await checkout(checkoutRequest("test-checkout-key-001"), env, { userId: "user_test_1" });
    const firstBody = await first.json();
    assert.equal(first.status, 200);
    assert.match(firstBody.url, /^https:\/\/checkout\.stripe\.com\//);
    assert.equal(state.stripePosts, 1);
    assert.equal(state.checkoutForm?.get("branding_settings[display_name]"), "NAPRAWNIK");
    assert.ok(state.lock && state.lock.session_id);

    const second = await checkout(checkoutRequest("test-checkout-key-002"), env, { userId: "user_test_1" });
    const secondBody = await second.json();
    assert.equal(second.status, 200);
    assert.equal(secondBody.reused, true);
    assert.equal(secondBody.sessionId, firstBody.sessionId);
    assert.equal(state.stripePosts, 1);

    const differentPlan = await checkout(checkoutRequest("test-checkout-key-003", "warsztat", "month"), env, { userId: "user_test_1" });
    const differentPlanBody = await differentPlan.json();
    assert.equal(differentPlan.status, 200);
    assert.match(differentPlanBody.url, /^https:\/\/checkout\.stripe\.com\//);
    assert.equal(differentPlanBody.reused, undefined);
    assert.equal(state.expirePosts, 1);
    assert.equal(state.sessions.get(firstBody.sessionId).status, "expired");
    assert.equal(state.lock.tier, "warsztat");
    assert.equal(state.stripePosts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("niepoprawny URL powrotu nie zostawia blokady Checkout ani nie tworzy sesji Stripe", async () => {
  const originalFetch = globalThis.fetch;
  const { env, state } = makeCheckoutTestEnv();
  env.CHECKOUT_SUCCESS_URL = "https://attacker.example/return";
  globalThis.fetch = mockStripeCheckoutFetch(state);
  try {
    const response = await checkout(checkoutRequest("test-checkout-bad-return-001"), env, { userId: "user_test_1" });
    assert.equal(response.status, 500);
    assert.equal(state.lock, null);
    assert.equal(state.stripePosts, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("billing portal sprawdza tryb Stripe i odtwarza powiązanie legacy bez dostępu do Live", async () => {
  const originalFetch = globalThis.fetch;
  const state = { posts: 0, customerLivemode: false, returnUrl: null, linked: false };
  const env = {
    STRIPE_SECRET_KEY: "sk_test_mock_portal_key",
    STRIPE_EXPECT_LIVEMODE: "false",
    APP_BASE_URL: "https://staging.example.test/app/",
    DB: {
      prepare(sql) {
        return { bind(...params) {
          return {
            async first() {
              if (sql.includes("SELECT stripe_customer_id FROM stripe_customers")) {
                return state.linked ? { stripe_customer_id: "cus_test_portal" } : null;
              }
              if (sql.includes("SELECT stripe_customer_id FROM subscriptions")) {
                return { stripe_customer_id: "cus_test_portal" };
              }
              if (sql.includes("SELECT user_id FROM stripe_customers")) {
                return state.linked && params[0] === "cus_test_portal" ? { user_id: "user_test_1" } : null;
              }
              throw new Error("Unexpected portal first() SQL: " + sql);
            },
            async run() {
              if (sql.includes("INSERT INTO stripe_customers")) {
                state.linked = true;
                return { success: true, meta: { changes: 1 } };
              }
              throw new Error("Unexpected portal run() SQL: " + sql);
            }
          };
        } };
      }
    }
  };
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://api.stripe.com/v1/customers/cus_test_portal") {
      return new Response(JSON.stringify({ id: "cus_test_portal", livemode: state.customerLivemode }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "https://api.stripe.com/v1/billing_portal/sessions" && init.method === "POST") {
      state.posts += 1;
      state.returnUrl = init.body.get("return_url");
      return new Response(JSON.stringify({ url: "https://billing.stripe.com/p/session/test_portal" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error("Unexpected portal request: " + url);
  };
  try {
    state.customerLivemode = true;
    const mismatched = await createBillingPortalSession(new Request("https://api.example.test/api/billing-portal", { method: "POST" }), env, { userId: "user_test_1" });
    assert.equal(mismatched.status, 503);
    assert.equal(state.posts, 0);
    assert.equal(state.linked, false, "nie naprawiaj powiązania przed weryfikacją trybu klienta");

    state.customerLivemode = false;
    const ok = await createBillingPortalSession(new Request("https://api.example.test/api/billing-portal", { method: "POST" }), env, { userId: "user_test_1" });
    const body = await ok.json();
    assert.equal(ok.status, 200);
    assert.equal(body.url, "https://billing.stripe.com/p/session/test_portal");
    assert.equal(state.posts, 1);
    assert.equal(state.linked, true, "legacy customer link should be repaired after mode validation");
    assert.equal(state.returnUrl, "https://staging.example.test/app/?billing=return");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Checkout odrzuca cenę live w środowisku testowym przed blokadą i sesją", async () => {
  const originalFetch = globalThis.fetch;
  const { env, state } = makeCheckoutTestEnv();
  state.priceLivemode = true;
  globalThis.fetch = mockStripeCheckoutFetch(state);
  try {
    const response = await checkout(checkoutRequest("test-checkout-live-price-001"), env, { userId: "user_test_1" });
    assert.equal(response.status, 503);
    assert.equal(state.lock, null);
    assert.equal(state.stripePosts, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Checkout wymaga jawnego trybu Stripe dla środowiska", async () => {
  const originalFetch = globalThis.fetch;
  const { env, state } = makeCheckoutTestEnv();
  delete env.STRIPE_EXPECT_LIVEMODE;
  globalThis.fetch = mockStripeCheckoutFetch(state);
  try {
    const response = await checkout(checkoutRequest("test-checkout-no-mode-001"), env, { userId: "user_test_1" });
    assert.equal(response.status, 503);
    assert.equal(state.lock, null);
    assert.equal(state.stripePosts, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("dwa równoczesne Checkouty nie wywołują dwóch sesji Stripe", async () => {
  const originalFetch = globalThis.fetch;
  const { env, state } = makeCheckoutTestEnv();
  globalThis.fetch = mockStripeCheckoutFetch(state);
  try {
    const results = await Promise.all([
      checkout(checkoutRequest("test-checkout-race-001"), env, { userId: "user_test_1" }),
      checkout(checkoutRequest("test-checkout-race-002"), env, { userId: "user_test_1" })
    ]);
    assert.equal(state.stripePosts, 1);
    assert.ok(results.every(response => [200, 409].includes(response.status)));
    assert.ok(results.some(response => response.status === 200));
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("podpisany webhook odbiera dostęp po pause i przywraca go po resume", async () => {
  const originalFetch = globalThis.fetch;
  const now = Math.floor(Date.now() / 1000);
  const secret = "whsec_test_subscription_lifecycle_only";
  const state = {
    events: new Map(),
    customers: new Map(),
    subscriptions: new Map(),
    users: new Map([["user_test_1", { id: "user_test_1", tier: "pro" }]]),
    stripeStatus: "paused"
  };
  const env = {
    STRIPE_SECRET_KEY: "sk_test_mock_not_a_real_key",
    STRIPE_WEBHOOK_SECRET: secret,
    STRIPE_EXPECT_LIVEMODE: "false",
    STRIPE_PRICE_PRO_MONTHLY: "price_test_pro_month",
    STRIPE_PRICE_PRO_YEARLY: "price_test_pro_year",
    STRIPE_PRICE_WARSZTAT_MONTHLY: "price_test_warsztat_month",
    STRIPE_PRICE_WARSZTAT_YEARLY: "price_test_warsztat_year",
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() {
                if (sql.includes("SELECT id FROM users")) return state.users.get(params[0]) || null;
                if (sql.includes("SELECT user_id FROM stripe_customers")) {
                  const userId = state.customers.get(params[0]);
                  return userId ? { user_id: userId } : null;
                }
                if (sql.includes("SELECT user_id FROM subscriptions WHERE stripe_subscription_id")) {
                  const subscription = state.subscriptions.get(params[0]);
                  return subscription ? { user_id: subscription.user_id } : null;
                }
                if (sql.includes("SELECT processed_at, processing, claimed_at FROM stripe_events")) {
                  return state.events.get(params[0]) || null;
                }
                if (sql.includes("SELECT tier, price_id, billing_interval FROM subscriptions WHERE stripe_subscription_id")) {
                  const subscription = state.subscriptions.get(params[0]);
                  return subscription ? { tier: subscription.tier, price_id: subscription.price_id, billing_interval: subscription.billing_interval } : null;
                }
                if (sql.includes("SELECT user_id, stripe_customer_id, tier, price_id, billing_interval, status, grace_until FROM subscriptions")) {
                  const subscription = state.subscriptions.get(params[0]);
                  return subscription ? { ...subscription } : null;
                }
                throw new Error("Unexpected webhook first() SQL: " + sql);
              },
              async all() {
                if (sql.includes("SELECT tier, status, current_period_end, grace_until FROM subscriptions WHERE user_id")) {
                  return {
                    results: [...state.subscriptions.values()].filter(item => item.user_id === params[0]).map(item => ({
                      tier: item.tier, status: item.status, current_period_end: item.current_period_end, grace_until: item.grace_until
                    }))
                  };
                }
                if (sql.includes("SELECT tier, expires_at FROM promo_redemptions WHERE user_id")) return { results: [] };
                if (sql.includes("SELECT tier, expires_at FROM one_time_purchases WHERE user_id")) return { results: [] };
                if (sql.includes("FROM trial_entitlements WHERE user_id")) return { results: [] };
                throw new Error("Unexpected webhook all() SQL: " + sql);
              },
              async run() {
                if (sql.includes("INSERT INTO stripe_events")) {
                  const [id, type, created, claimedAt] = params;
                  const current = state.events.get(id);
                  if (current?.processed_at || (current?.processing && Number(current.claimed_at) >= Number(params[4]))) {
                    return { success: true, meta: { changes: 0 } };
                  }
                  state.events.set(id, { event_id: id, event_type: type, event_created: created, processed_at: null, processing: 1, claimed_at: claimedAt, last_error: null });
                  return { success: true, meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE stripe_events SET processed_at")) {
                  const [processedAt, id] = params;
                  const event = state.events.get(id);
                  if (event) Object.assign(event, { processed_at: processedAt, processing: 0, claimed_at: null, last_error: null });
                  return { success: true, meta: { changes: event ? 1 : 0 } };
                }
                if (sql.includes("UPDATE stripe_events SET processing = 0")) {
                  const [message, id] = params;
                  const event = state.events.get(id);
                  if (event) Object.assign(event, { processing: 0, claimed_at: null, last_error: message });
                  return { success: true, meta: { changes: event ? 1 : 0 } };
                }
                if (sql.includes("INSERT INTO stripe_customers")) {
                  const [customerId, userId] = params;
                  if (!state.customers.has(customerId)) {
                    state.customers.set(customerId, userId);
                    return { success: true, meta: { changes: 1 } };
                  }
                  return { success: true, meta: { changes: 0 } };
                }
                if (sql.includes("INSERT INTO subscriptions")) {
                  const [id, userId, customerId, tier, priceId, interval, status, periodEnd, cancelAtPeriodEnd, created, updated] = params;
                  const current = state.subscriptions.get(id);
                  state.subscriptions.set(id, {
                    stripe_subscription_id: id, user_id: userId, stripe_customer_id: customerId,
                    tier, price_id: priceId, billing_interval: interval, status,
                    current_period_end: periodEnd, cancel_at_period_end: cancelAtPeriodEnd,
                    grace_until: status === "active" || status === "trialing" ? null : current?.grace_until || null,
                    stripe_created_at: created, updated_at: updated
                  });
                  return { success: true, meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE users SET tier = ?")) {
                  const [tier, updatedAt, userId] = params;
                  const user = state.users.get(userId);
                  if (user) Object.assign(user, { tier, updated_at: updatedAt });
                  return { success: true, meta: { changes: user ? 1 : 0 } };
                }
                if (sql.includes("DELETE FROM checkout_locks")) return { success: true, meta: { changes: 0 } };
                throw new Error("Unexpected webhook run() SQL: " + sql);
              }
            };
          }
        };
      }
    }
  };

  globalThis.fetch = async input => {
    const url = String(input);
    if (url.includes("/v1/subscriptions/sub_test_lifecycle?")) {
      return new Response(JSON.stringify({
        id: "sub_test_lifecycle",
        customer: "cus_test_lifecycle",
        status: state.stripeStatus,
        current_period_end: now + 3600,
        cancel_at_period_end: false,
        created: now - 100,
        metadata: { user_id: "user_test_1" },
        items: { data: [{ price: { id: "price_test_pro_month" }, current_period_end: now + 3600 }] }
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error("Unexpected external fetch in webhook test: " + url);
  };

  async function sendEvent(id, type, object) {
    const event = { id, type, created: now, livemode: arguments.length > 3 ? arguments[3] : false, data: { object } };
    const rawBody = JSON.stringify(event);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(now + "." + rawBody)));
    const signature = [...mac].map(byte => byte.toString(16).padStart(2, "0")).join("");
    const request = new Request("https://worker.example.test/webhooks/stripe", {
      method: "POST",
      headers: { "content-type": "application/json", "Stripe-Signature": "t=" + now + ",v1=" + signature },
      body: rawBody
    });
    return handleWebhook(request, env);
  }

  try {
    // A successful Checkout must persist the subscription and grant the mapped plan.
    state.stripeStatus = "active";
    const checkoutCompleted = await sendEvent("evt_test_checkout_completed", "checkout.session.completed", {
      id: "cs_test_checkout_completed",
      object: "checkout.session",
      mode: "subscription",
      payment_status: "paid",
      metadata: { user_id: "user_test_1" },
      client_reference_id: "user_test_1",
      customer: "cus_test_lifecycle",
      subscription: "sub_test_lifecycle"
    });
    assert.equal(checkoutCompleted.status, 200);
    assert.equal(state.subscriptions.get("sub_test_lifecycle")?.status, "active");
    assert.equal(state.subscriptions.get("sub_test_lifecycle")?.tier, "pro");
    assert.equal(state.subscriptions.get("sub_test_lifecycle")?.price_id, "price_test_pro_month");
    assert.equal(state.users.get("user_test_1")?.tier, "pro");
    assert.equal(state.customers.get("cus_test_lifecycle"), "user_test_1");

    const object = { id: "sub_test_lifecycle", customer: "cus_test_lifecycle", metadata: { user_id: "user_test_1" } };
    state.stripeStatus = "paused";
    const paused = await sendEvent("evt_test_paused", "customer.subscription.paused", object);
    assert.equal(paused.status, 200);
    assert.equal(state.subscriptions.get("sub_test_lifecycle")?.status, "paused");
    assert.equal(state.users.get("user_test_1")?.tier, "amator");

    state.stripeStatus = "active";
    const resumed = await sendEvent("evt_test_resumed", "customer.subscription.resumed", object);
    assert.equal(resumed.status, 200);
    assert.equal(state.subscriptions.get("sub_test_lifecycle")?.status, "active");
    assert.equal(state.users.get("user_test_1")?.tier, "pro");

    // A delayed invoice.payment_failed must not downgrade a subscription Stripe already reports active.
    const failedInvoice = await sendEvent("evt_test_delayed_invoice_failed", "invoice.payment_failed", {
      id: "in_test_delayed",
      subscription: "sub_test_lifecycle",
      customer: "cus_test_lifecycle",
      created: now - 60
    });
    assert.equal(failedInvoice.status, 200);
    assert.equal(state.subscriptions.get("sub_test_lifecycle")?.status, "active");
    assert.equal(state.subscriptions.get("sub_test_lifecycle")?.grace_until, null);
    assert.equal(state.users.get("user_test_1")?.tier, "pro");

    // A live-mode event with a valid signature is still rejected by a test-only Worker.
    const wrongModeEvent = await sendEvent("evt_test_wrong_mode", "customer.subscription.deleted", object, true);
    assert.equal(wrongModeEvent.status, 400);
    assert.equal(state.subscriptions.get("sub_test_lifecycle")?.status, "active");
    assert.equal(state.users.get("user_test_1")?.tier, "pro");
  } finally {
    globalThis.fetch = originalFetch;
  }
});


function makePhotoTestEnv(tier = "pro", openAiKey = "sk_test_mock_openai_key") {
  const now = Math.floor(Date.now() / 1000);
  const state = { upstreamRequest: null, upstreamCalls: 0, storedTier: tier };
  const env = {
    PHOTO_ANALYSIS_ENABLED: "true",
    OPENAI_API_KEY: openAiKey,
    OPENAI_VISION_MODEL: "gpt-6-luna",
    PHOTO_MONTHLY_BUDGET_USD: "5",
    PHOTO_REQUEST_RESERVE_USD: "0.25",
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() {
                if (sql.includes("INSERT INTO request_limits")) return { request_count: 1 };
                if (sql.includes("INSERT INTO photo_usage_budget")) return { period_start: params[0], budget_microusd: params[1] };
                if (sql.includes("SELECT role FROM admin_users")) return null;
                throw new Error("Unexpected photo first() SQL: " + sql);
              },
              async all() {
                if (sql.includes("SELECT tier, status, current_period_end, grace_until FROM subscriptions WHERE user_id")) {
                  return {
                    results: [{
                      tier: state.storedTier,
                      status: "active",
                      current_period_end: now + 3600,
                      grace_until: null
                    }]
                  };
                }
                if (sql.includes("SELECT tier, expires_at FROM promo_redemptions WHERE user_id")) return { results: [] };
                if (sql.includes("SELECT tier, expires_at FROM one_time_purchases WHERE user_id")) return { results: [] };
                if (sql.includes("FROM trial_entitlements WHERE user_id")) return { results: [] };
                throw new Error("Unexpected photo all() SQL: " + sql);
              },
              async run() {
                if (sql.includes("UPDATE users SET tier = ?")) return { success: true, meta: { changes: 1 } };
                if (sql.includes("DELETE FROM request_limits")) return { success: true, meta: { changes: 0 } };
                if (sql.includes("UPDATE photo_usage_budget")) return { success: true, meta: { changes: 1 } };
                if (sql.includes("DELETE FROM photo_usage_budget")) return { success: true, meta: { changes: 0 } };
                throw new Error("Unexpected photo run() SQL: " + sql);
              }
            };
          }
        };
      }
    },
    state
  };
  return { env, state };
}
function makePhotoRequest({ mime = "image/jpeg", bytes = [0xff,0xd8,0xff,0xc0,0x00,0x11,0x08,0x03,0x00,0x04,0x00,0x03,0x01,0x11,0x00,0x02,0x11,0x00,0x03,0x11,0x00], symptoms = "Gubi iskrę na ciepło" } = {}) {
  const form = new FormData();
  form.append("symptoms", symptoms);
  form.append("category", "spark");
  form.append("make", "Yamaha");
  form.append("model", "Aerox");
  form.append("year", "2013");
  form.append("engine", "2T 50 cm3");
  form.append("extra", "");
  form.append("photos", new Blob([new Uint8Array(bytes)], { type: mime }), "plug.jpg");
  return new Request("https://worker.example.test/api/photo-diagnosis", { method: "POST", body: form });
}

test("analiza zdjęć jest zablokowana bez jawnego włączenia", async () => {
  const response = await photoDiagnosis(
    new Request("https://worker.example.test/api/photo-diagnosis", { method: "POST" }),
    { OPENAI_API_KEY: "sk_test_mock_openai_key" },
    { userId: "user_test_1" }
  );
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /tymczasowo wyłączona/);
});

test("analiza zdjęcia wymaga klucza OpenAI skonfigurowanego po stronie serwera", async () => {
  const response = await photoDiagnosis(
    new Request("https://worker.example.test/api/photo-diagnosis", { method: "POST" }),
    { PHOTO_ANALYSIS_ENABLED: "true" },
    { userId: "user_test_1" }
  );
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /nie jest skonfigurowana/);
});

test("analiza zdjęcia wymaga aktywnego PRO/WARSZTAT i nie wywołuje modelu dla planu AMATOR", async () => {
  const originalFetch = globalThis.fetch;
  const { env, state } = makePhotoTestEnv("amator");
  globalThis.fetch = async () => { state.upstreamCalls += 1; throw new Error("Upstream must not be called for AMATOR"); };
  try {
    const response = await photoDiagnosis(makePhotoRequest(), env, { userId: "user_test_1" });
    assert.equal(response.status, 403);
    assert.equal(state.upstreamCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("analiza zdjęcia przekazuje obrazy jako data URL do Responses API i zwraca wynik", async () => {
  const originalFetch = globalThis.fetch;
  const { env, state } = makePhotoTestEnv("pro");
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.openai.com/v1/responses");
    state.upstreamCalls += 1;
    state.upstreamRequest = JSON.parse(init.body);
    assert.equal(init.headers.authorization, "Bearer " + env.OPENAI_API_KEY);
    return new Response(JSON.stringify({
      output_text: "Możliwa usterka świecy; sprawdź szczelinę według DTR właściwego modelu."
    }), { status: 200, headers: { "content-type": "application/json", "x-request-id": "req_test_photo" } });
  };
  try {
    const response = await photoDiagnosis(makePhotoRequest(), env, { userId: "user_test_1" });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.model, "gpt-6-luna");
    assert.match(result.analysis, /Możliwa usterka świecy/);
    assert.equal(state.upstreamRequest.store, false);
    assert.equal(state.upstreamRequest.max_output_tokens, 1100);
    const content = state.upstreamRequest.input[0].content;
    assert.ok(content.some(item => item.type === "input_text" && item.text.includes("Gubi iskrę na ciepło")));
    const image = content.find(item => item.type === "input_image");
    assert.ok(image);
    assert.match(image.image_url, /^data:image\/jpeg;base64,/);
    assert.equal(state.upstreamCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("analiza zdjęcia odrzuca format spoza JPEG/PNG/WebP przed wywołaniem modelu", async () => {
  const originalFetch = globalThis.fetch;
  const { env, state } = makePhotoTestEnv("pro");
  globalThis.fetch = async () => { state.upstreamCalls += 1; throw new Error("Unsupported images must not reach the model"); };
  try {
    const response = await photoDiagnosis(makePhotoRequest({ mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] }), env, { userId: "user_test_1" });
    assert.equal(response.status, 415);
    assert.equal(state.upstreamCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("diagnostyka Stripe potwierdza konfigurację LIVE bez tworzenia Checkout", async () => {
  const originalFetch = globalThis.fetch;
  const prices = {
    price_pro_month: { id: "price_pro_month", active: true, livemode: true, currency: "pln", unit_amount: 900, type: "recurring", recurring: { interval: "month", interval_count: 1 } },
    price_pro_year: { id: "price_pro_year", active: true, livemode: true, currency: "pln", unit_amount: 10000, type: "recurring", recurring: { interval: "year", interval_count: 1 } },
    price_warsztat_month: { id: "price_warsztat_month", active: true, livemode: true, currency: "pln", unit_amount: 2900, type: "recurring", recurring: { interval: "month", interval_count: 1 } },
    price_warsztat_year: { id: "price_warsztat_year", active: true, livemode: true, currency: "pln", unit_amount: 30000, type: "recurring", recurring: { interval: "year", interval_count: 1 } },
    price_pro_3d: { id: "price_pro_3d", active: true, livemode: true, currency: "pln", unit_amount: 300, type: "one_time", recurring: null },
    price_pro_7d: { id: "price_pro_7d", active: true, livemode: true, currency: "pln", unit_amount: 700, type: "one_time", recurring: null },
    price_warsztat_3d: { id: "price_warsztat_3d", active: true, livemode: true, currency: "pln", unit_amount: 500, type: "one_time", recurring: null },
    price_warsztat_7d: { id: "price_warsztat_7d", active: true, livemode: true, currency: "pln", unit_amount: 1000, type: "one_time", recurring: null }
  };
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method, auth: init?.headers?.Authorization });
    const id = String(url).split("/").pop();
    return new Response(JSON.stringify(prices[id]), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const env = {
      PRODUCTION_ENABLED: "true",
      STRIPE_EXPECT_LIVEMODE: "true",
      STRIPE_SECRET_KEY: "sk_live_mock_secret",
      APP_BASE_URL: "https://example.test/app/",
      CHECKOUT_SUCCESS_URL: "https://example.test/app/?checkout=success&session_id={CHECKOUT_SESSION_ID}",
      CHECKOUT_CANCEL_URL: "https://example.test/app/?checkout=cancelled",
      STRIPE_PRICE_PRO_MONTHLY: "price_pro_month",
      STRIPE_PRICE_PRO_YEARLY: "price_pro_year",
      STRIPE_PRICE_WARSZTAT_MONTHLY: "price_warsztat_month",
      STRIPE_PRICE_WARSZTAT_YEARLY: "price_warsztat_year",
      STRIPE_PRICE_PRO_3D: "price_pro_3d",
      STRIPE_PRICE_PRO_7D: "price_pro_7d",
      STRIPE_PRICE_WARSZTAT_3D: "price_warsztat_3d",
      STRIPE_PRICE_WARSZTAT_7D: "price_warsztat_7d"
    };
    const response = await diagnoseStripeConfig(env);
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.ready, true);
    assert.equal(result.allPricesValid, true);
    assert.equal(result.prices.length, 8);
    assert.equal(calls.length, 8);
    assert.ok(calls.every(call => call.method === "GET" && call.url.startsWith("https://api.stripe.com/v1/prices/")));
    assert.doesNotMatch(JSON.stringify(result), /sk_live_mock_secret/);
    assert.doesNotMatch(calls.map(call => call.url).join(" "), /checkout\/sessions/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("diagnostyka Stripe wykrywa odrzucony klucz i nie ujawnia treści błędu Stripe", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "secret-like-private-upstream-detail" } }), {
    status: 401, headers: { "content-type": "application/json" }
  });
  try {
    const env = {
      PRODUCTION_ENABLED: "true",
      STRIPE_EXPECT_LIVEMODE: "true",
      STRIPE_SECRET_KEY: "sk_live_mock_secret",
      APP_BASE_URL: "https://example.test/app/",
      CHECKOUT_SUCCESS_URL: "https://example.test/app/?checkout=success",
      CHECKOUT_CANCEL_URL: "https://example.test/app/?checkout=cancelled",
      STRIPE_PRICE_PRO_MONTHLY: "price_pro_month",
      STRIPE_PRICE_PRO_YEARLY: "price_pro_year",
      STRIPE_PRICE_WARSZTAT_MONTHLY: "price_warsztat_month",
      STRIPE_PRICE_WARSZTAT_YEARLY: "price_warsztat_year",
      STRIPE_PRICE_PRO_3D: "price_pro_3d",
      STRIPE_PRICE_PRO_7D: "price_pro_7d",
      STRIPE_PRICE_WARSZTAT_3D: "price_warsztat_3d",
      STRIPE_PRICE_WARSZTAT_7D: "price_warsztat_7d"
    };
    const response = await diagnoseStripeConfig(env);
    const result = await response.json();
    assert.equal(result.ready, false);
    assert.equal(result.allPricesValid, false);
    assert.ok(result.prices.every(p => p.reason === "stripe_key_rejected"));
    assert.doesNotMatch(JSON.stringify(result), /secret-like-private-upstream-detail|sk_live_mock_secret/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("wygasły token aktywnego abonamentu rocznego jest odnawiany bez Checkoutu", async () => {
  const token = "a".repeat(64);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenHash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  const now = Math.floor(Date.now() / 1000);
  const state = { entitlementChecks: 0, tokenUpdates: [] };
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() {
                if (sql.includes("SELECT user_id, expires_at, revoked_at, device_id_hash FROM api_tokens")) {
                  assert.equal(params[0], tokenHash);
                  return { user_id: "annual-user", expires_at: now - 60, revoked_at: null, device_id_hash: null };
                }
                if (sql.includes("SELECT 1 AS active FROM subscriptions")) {
                  state.entitlementChecks += 1;
                  assert.deepEqual(params, ["annual-user", now, now, "annual-user", now, "annual-user", now]);
                  return { active: 1 };
                }
                throw new Error("Unexpected auth first() SQL: " + sql);
              },
              async run() {
                if (sql.includes("UPDATE api_tokens")) {
                  state.tokenUpdates.push(params);
                  return { success: true, meta: { changes: 1 } };
                }
                throw new Error("Unexpected auth run() SQL: " + sql);
              }
            };
          }
        };
      }
    }
  };
  const request = new Request("https://api.example.test/api/me", {
    headers: { Authorization: "Bearer " + token }
  });
  const auth = await authenticate(request, env);
  assert.deepEqual(auth, { userId: "annual-user", tokenHash, deviceIdHash: null });
  assert.equal(state.entitlementChecks, 1);
  assert.equal(state.tokenUpdates.length, 1);
  assert.equal(state.tokenUpdates[0][2], tokenHash);
  assert.equal(state.tokenUpdates[0][1] - state.tokenUpdates[0][0], 365 * 24 * 60 * 60);
});

test("wygasły token bez aktywnego abonamentu lub promocji nadal jest odrzucany", async () => {
  const token = "b".repeat(64);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenHash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  const now = Math.floor(Date.now() / 1000);
  const state = { tokenUpdates: [] };
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() {
                if (sql.includes("SELECT user_id, expires_at, revoked_at, device_id_hash FROM api_tokens")) {
                  assert.equal(params[0], tokenHash);
                  return { user_id: "free-user", expires_at: now - 60, revoked_at: null, device_id_hash: null };
                }
                if (sql.includes("SELECT 1 AS active FROM subscriptions")) return null;
                throw new Error("Unexpected auth first() SQL: " + sql);
              },
              async run() {
                state.tokenUpdates.push(params);
                return { success: true, meta: { changes: 1 } };
              }
            };
          }
        };
      }
    }
  };
  const request = new Request("https://api.example.test/api/me", {
    headers: { Authorization: "Bearer " + token }
  });
  assert.equal(await authenticate(request, env), null);
  assert.equal(state.tokenUpdates.length, 0);
});


test("native billing return requires the exact Capacitor Origin and never accepts lookalike hosts", () => {
  const requestFor = origin => new Request("https://api.example.test/api/checkout", {
    method: "POST",
    headers: { Origin: origin }
  });
  assert.equal(isNativeAppRequest(requestFor("https://localhost")), true);
  assert.equal(isNativeAppRequest(requestFor("https://localhost.evil.example")), false);
  assert.equal(isNativeAppRequest(requestFor("https://127.0.0.1")), false);
  assert.equal(isNativeAppRequest(requestFor("https://turbodiesel966-eng.github.io")), false);
  assert.equal(isNativeAppRequest(new Request("https://api.example.test/api/checkout", { method: "POST" })), false);
});

test("native Stripe return page handles only known results and sends no-store, non-embeddable HTML", async () => {
  for (const result of ["success", "cancelled", "portal"]) {
    const response = billingReturnPage(new URL("https://api.example.test/billing/return?result=" + result));
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("content-type").includes("text/html"));
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.ok(response.headers.get("content-security-policy").includes("default-src 'none'"));
    const html = await response.text();
    assert.ok(html.includes("NAPRAWNIK"));
    assert.equal(html.toLowerCase().includes("<script"), false);
    if (result === "success") assert.ok(html.toLowerCase().includes("wróć do aplikacji naprawnik"));
    if (result === "cancelled") assert.ok(html.toLowerCase().includes("anulowany"));
    if (result === "portal") assert.ok(html.includes("Panel abonamentu został zamknięty"));
  }
  const invalid = billingReturnPage(new URL("https://api.example.test/billing/return?result=https%3A%2F%2Fevil.example"));
  assert.equal(invalid.status, 400);
  assert.ok(invalid.headers.get("content-type").includes("text/plain"));
});

test("native checkout return URL branch does not replace the web checkout URLs", async () => {
  const source = await readFile(new URL("./src/index.mjs", import.meta.url), "utf8");
  assert.ok(source.includes("const nativeReturn = isNativeAppRequest(request)"));
  assert.ok(source.includes('workerOrigin + "/billing/return?result=success"'));
  assert.ok(source.includes('workerOrigin + "/billing/return?result=cancelled"'));
  assert.ok(source.includes('workerOrigin + "/billing/return?result=portal"'));
  assert.ok(source.includes("safeReturnUrl(env.CHECKOUT_SUCCESS_URL"));
  assert.ok(source.includes("safeReturnUrl(env.CHECKOUT_CANCEL_URL"));
});
