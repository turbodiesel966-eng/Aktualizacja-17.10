import test from "node:test";
import assert from "node:assert/strict";
import { diagnoseStripeConfig } from "./src/index.mjs";

const PRICE_IDS = {
  PRO_MONTHLY: "price_1UUOdRJgi8iwHKRb5mvO8dOP",
  PRO_YEARLY: "price_1UUOdWJgi8iwHKRbl85b4ODT",
  WARSZTAT_MONTHLY: "price_1UUOrKJgi8iwHKRbHtsxzDcU",
  WARSZTAT_YEARLY: "price_1UUOrQJgi8iwHKRbIkeq1sUY",
  PRO_3D: "price_1UUfEJJgi8iwHKRbpU3ivTbn",
  PRO_7D: "price_1UUfELJgi8iwHKRbx6re7Hb3",
  WARSZTAT_3D: "price_1UUfEPJgi8iwHKRbqEotj0El",
  WARSZTAT_7D: "price_1UUfERJgi8iwHKRbrzkPLcQg",
};

function makeEnv(secret) {
  return {
    PRODUCTION_ENABLED: "true",
    STRIPE_EXPECT_LIVEMODE: "true",
    STRIPE_SECRET_KEY: secret,
    APP_BASE_URL: "https://turbodiesel966-eng.github.io/Aktualizacja-17.10/",
    CHECKOUT_SUCCESS_URL: "https://turbodiesel966-eng.github.io/Aktualizacja-17.10/?checkout=success&session_id={CHECKOUT_SESSION_ID}",
    CHECKOUT_CANCEL_URL: "https://turbodiesel966-eng.github.io/Aktualizacja-17.10/?checkout=cancelled",
    STRIPE_PRICE_PRO_MONTHLY: PRICE_IDS.PRO_MONTHLY,
    STRIPE_PRICE_PRO_YEARLY: PRICE_IDS.PRO_YEARLY,
    STRIPE_PRICE_WARSZTAT_MONTHLY: PRICE_IDS.WARSZTAT_MONTHLY,
    STRIPE_PRICE_WARSZTAT_YEARLY: PRICE_IDS.WARSZTAT_YEARLY,
    STRIPE_PRICE_PRO_3D: PRICE_IDS.PRO_3D,
    STRIPE_PRICE_PRO_7D: PRICE_IDS.PRO_7D,
    STRIPE_PRICE_WARSZTAT_3D: PRICE_IDS.WARSZTAT_3D,
    STRIPE_PRICE_WARSZTAT_7D: PRICE_IDS.WARSZTAT_7D,
  };
}

test("Stripe diagnostics identifies a restricted LIVE key and sanitizes error details", async () => {
  const originalFetch = globalThis.fetch;
  const fakeSecret = "rk_live_dont_expose_this_secret";
  globalThis.fetch = async (url, options) => {
    assert.equal(options?.method, "GET");
    assert.equal(options?.headers?.Authorization, "Bearer " + fakeSecret);
    assert.match(String(url), /^https:\/\/api\.stripe\.com\/v1\/prices\/price_/);
    return new Response(JSON.stringify({
      error: {
        type: "invalid_request_error",
        code: "restricted_key",
        message: "The restricted key " + fakeSecret + " cannot read this price.",
      },
    }), {
      status: 403,
      headers: { "content-type": "application/json", "request-id": "req_diag_redacted_123" },
    });
  };
  try {
    const response = await diagnoseStripeConfig(makeEnv(fakeSecret));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.stripeSecretConfigured, true);
    assert.equal(data.stripeSecretKind, "restricted");
    assert.equal(data.stripeSecretMode, "live");
    assert.equal(data.stripeSecretModeMatchesExpected, true);
    assert.equal(data.stripeSecretHasOuterWhitespace, false);
    assert.equal(data.ready, false);
    assert.equal(data.prices.length, 8);
    for (const price of data.prices) {
      assert.equal(price.stripeHttpStatus, 403);
      assert.equal(price.stripeErrorType, "invalid_request_error");
      assert.equal(price.stripeErrorCode, "restricted_key");
      assert.equal(price.stripeRequestId, "req_diag_redacted_123");
      assert.equal(price.stripeErrorHint, "Klucz Stripe nie ma wymaganych uprawnień do odczytu cen. Sprawdź Prices → Read.");
      assert.equal("stripeErrorMessage" in price, false);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Stripe diagnostics explains the exact missing LIVE Prices read permission", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: {
      type: "invalid_request_error",
      code: "more_permissions_required",
      message: "This key needs permission to read prices. This raw text must not be returned.",
    },
  }), {
    status: 403,
    headers: { "content-type": "application/json", "request-id": "req_more_permissions_test" },
  });
  try {
    const response = await diagnoseStripeConfig(makeEnv("rk_live_example_restricted_key"));
    const data = await response.json();
    assert.equal(data.ready, false);
    for (const price of data.prices) {
      assert.equal(price.stripeHttpStatus, 403);
      assert.equal(price.stripeErrorCode, "more_permissions_required");
      assert.equal(price.stripeErrorHint, "Dla tego sprawdzenia brakuje uprawnienia Stripe: Prices → Read (GET /v1/prices/{id}).");
    }
    assert.equal(JSON.stringify(data).includes("This raw text must not be returned"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Stripe diagnostics validates prices and reports no upstream error data on success", async () => {
  const originalFetch = globalThis.fetch;
  const expected = {
    [PRICE_IDS.PRO_MONTHLY]: { amount: 900, interval: "month", type: "recurring" },
    [PRICE_IDS.PRO_YEARLY]: { amount: 10000, interval: "year", type: "recurring" },
    [PRICE_IDS.WARSZTAT_MONTHLY]: { amount: 2900, interval: "month", type: "recurring" },
    [PRICE_IDS.WARSZTAT_YEARLY]: { amount: 30000, interval: "year", type: "recurring" },
    [PRICE_IDS.PRO_3D]: { amount: 300, type: "one_time" },
    [PRICE_IDS.PRO_7D]: { amount: 700, type: "one_time" },
    [PRICE_IDS.WARSZTAT_3D]: { amount: 500, type: "one_time" },
    [PRICE_IDS.WARSZTAT_7D]: { amount: 1000, type: "one_time" },
  };
  globalThis.fetch = async url => {
    const id = new URL(String(url)).pathname.split("/").pop();
    const item = expected[id];
    assert.ok(item, "Unexpected price ID: " + id);
    return new Response(JSON.stringify({
      id,
      object: "price",
      active: true,
      livemode: true,
      currency: "pln",
      unit_amount: item.amount,
      type: item.type,
      recurring: item.type === "recurring" ? { interval: item.interval, interval_count: 1 } : null,
    }), { status: 200, headers: { "content-type": "application/json", "request-id": "req_ok_123" } });
  };
  try {
    const response = await diagnoseStripeConfig(makeEnv("sk_live_example_standard_secret"));
    const data = await response.json();
    assert.equal(data.ready, true);
    assert.equal(data.stripeSecretKind, "standard");
    assert.equal(data.stripeSecretMode, "live");
    assert.equal(data.stripeSecretModeMatchesExpected, true);
    assert.equal(data.prices.every(price => price.valid === true), true);
    assert.equal(data.prices.every(price => price.stripeErrorHint === null && price.stripeRequestId === null), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
