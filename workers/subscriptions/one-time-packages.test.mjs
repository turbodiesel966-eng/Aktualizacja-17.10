import test from "node:test";
import assert from "node:assert/strict";
import { oneTimeCheckout, oneTimePriceMap, grantOneTimePurchaseFromWebhook } from "./src/index.mjs";

const PRICE = "price_test_pro_3d";
const NOW = Math.floor(Date.now() / 1000);

test("mapowanie pakietów jednorazowych jest rozdzielone od mapy abonamentów", () => {
  const map = oneTimePriceMap({
    STRIPE_PRICE_PRO_3D: "price_a",
    STRIPE_PRICE_PRO_7D: "price_b",
    STRIPE_PRICE_WARSZTAT_3D: "price_c",
    STRIPE_PRICE_WARSZTAT_7D: "price_d",
  });
  assert.deepEqual(map.get("price_a"), { tier: "pro", durationDays: 3, amount: 300 });
  assert.deepEqual(map.get("price_b"), { tier: "pro", durationDays: 7, amount: 700 });
  assert.deepEqual(map.get("price_c"), { tier: "warsztat", durationDays: 3, amount: 500 });
  assert.deepEqual(map.get("price_d"), { tier: "warsztat", durationDays: 7, amount: 1000 });
});

function makeCheckoutEnv(currentTier = "amator") {
  const state = { lock: null, form: null, posts: 0, currentTier, pastPurchases: [], customerId: null, customerPastPurchases: [] };
  const env = {
    STRIPE_SECRET_KEY: "sk_test_mock_key",
    STRIPE_EXPECT_LIVEMODE: "false",
    STRIPE_PRICE_PRO_3D: PRICE,
    STRIPE_PRICE_PRO_7D: "price_test_pro_7d",
    STRIPE_PRICE_WARSZTAT_7D: "price_test_warsztat_7d",
    APP_BASE_URL: "https://staging.example.test/app/",
    CHECKOUT_SUCCESS_URL: "https://staging.example.test/app/?checkout=success",
    CHECKOUT_CANCEL_URL: "https://staging.example.test/app/?checkout=cancelled",
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() {
                if (sql.includes("INSERT INTO request_limits")) return { request_count: 1 };
                if (sql.includes("SELECT id, email FROM users")) return { id: "user_test_1", email: "owner@example.test" };
                if (sql.includes("SELECT session_id, expires_at FROM checkout_locks")) return null;
                if (sql.includes("FROM one_time_purchases") && sql.includes("duration_days = 7") && !sql.includes("JOIN")) {
                  return state.pastPurchases.includes(params[1]) ? { checkout_session_id: "cs_past" } : null;
                }
                if (sql.includes("SELECT stripe_customer_id FROM stripe_customers")) {
                  return state.customerId ? { stripe_customer_id: state.customerId } : null;
                }
                if (sql.includes("FROM one_time_purchases") && sql.includes("JOIN stripe_customers")) {
                  return state.customerPastPurchases?.includes(params[1]) ? { checkout_session_id: "cs_cust_past" } : null;
                }
                if (sql.includes("SELECT user_id, idempotency_key, tier, duration_days, session_id, expires_at FROM one_time_checkout_locks")) {
                  return state.lock ? { ...state.lock } : null;
                }
                throw new Error("Unexpected checkout first SQL: " + sql);
              },
              async all() {
                if (sql.includes("SELECT tier, status, current_period_end, grace_until FROM subscriptions WHERE user_id")) {
                  return { results: state.currentTier === "amator" ? [] : [{
                    tier: state.currentTier, status: "active", current_period_end: NOW + 3600, grace_until: null
                  }] };
                }
                if (sql.includes("SELECT tier, expires_at FROM promo_redemptions WHERE user_id")) return { results: [] };
                if (sql.includes("SELECT tier, expires_at FROM one_time_purchases WHERE user_id")) return { results: [] };
                if (sql.includes("SELECT tier, duration_days FROM one_time_purchases WHERE user_id = ?")) return { results: [] };
                throw new Error("Unexpected checkout all SQL: " + sql);
              },
              async run() {
                if (sql.includes("UPDATE users SET tier = ?")) {
                  state.currentTier = params[0];
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("INSERT INTO one_time_checkout_locks")) {
                  const [userId,idempotencyKey,tier,durationDays,expiresAt,createdAt] = params;
                  state.lock = { user_id:userId,idempotency_key:idempotencyKey,tier,duration_days:durationDays,session_id:null,expires_at:expiresAt,created_at:createdAt };
                  return { meta:{changes:1} };
                }
                if (sql.includes("UPDATE one_time_checkout_locks SET session_id")) {
                  const [sessionId,expiresAt,userId,idempotencyKey] = params;
                  if (!state.lock || state.lock.user_id!==userId || state.lock.idempotency_key!==idempotencyKey) return {meta:{changes:0}};
                  state.lock.session_id=sessionId; state.lock.expires_at=expiresAt;
                  return {meta:{changes:1}};
                }
                if (sql.includes("INSERT INTO checkout_requests")) return {meta:{changes:1}};
                if (sql.includes("DELETE FROM one_time_checkout_locks")) { state.lock=null; return {meta:{changes:1}}; }
                throw new Error("Unexpected checkout run SQL: " + sql);
              }
            };
          }
        };
      }
    }
  };
  return { env, state };
}

test("server blocks duplicate or lower-tier one-time purchases before contacting Stripe", async () => {
  const originalFetch = globalThis.fetch;
  const { env, state } = makeCheckoutEnv("pro");
  let stripeCalls = 0;
  globalThis.fetch = async () => { stripeCalls += 1; throw new Error("Stripe must not be called"); };
  try {
    const request = new Request("https://worker.example.test/api/one-time-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "one-time-active-0001" },
      body: JSON.stringify({ tier: "pro", durationDays: 7 })
    });
    const response = await oneTimeCheckout(request, env, { userId: "user_test_1" });
    const data = await response.json();
    assert.equal(response.status, 409);
    assert.match(data.error, /już aktywny dostęp/);
    assert.equal(stripeCalls, 0);
    assert.equal(state.posts, 0);
    assert.equal(state.lock, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("server rejects 3-day one-time packages with 400", async () => {
  const { env } = makeCheckoutEnv();
  const request = new Request("https://worker.example.test/api/one-time-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": "one-time-3d-0001" },
    body: JSON.stringify({ tier: "pro", durationDays: 3 })
  });
  const response = await oneTimeCheckout(request, env, { userId: "user_test_1" });
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.match(data.error, /wyłącznie pakiety 7-dniowe/);
});

test("server blocks repeat 7-day purchase on same account with 409", async () => {
  const { env, state } = makeCheckoutEnv();
  state.pastPurchases = ["pro"];
  const request = new Request("https://worker.example.test/api/one-time-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": "one-time-repeat-0001" },
    body: JSON.stringify({ tier: "pro", durationDays: 7 })
  });
  const response = await oneTimeCheckout(request, env, { userId: "user_test_1" });
  const data = await response.json();
  assert.equal(response.status, 409);
  assert.match(data.error, /został już wcześniej wykorzystany/);
});

test("server blocks repeat 7-day purchase for same Stripe customer identity with 409", async () => {
  const { env, state } = makeCheckoutEnv();
  state.customerId = "cus_mock_identity_1";
  state.customerPastPurchases = ["warsztat"];
  const request = new Request("https://worker.example.test/api/one-time-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": "one-time-repeat-cus-0001" },
    body: JSON.stringify({ tier: "warsztat", durationDays: 7 })
  });
  const response = await oneTimeCheckout(request, env, { userId: "user_test_1" });
  const data = await response.json();
  assert.equal(response.status, 409);
  assert.match(data.error, /został już wcześniej wykorzystany/);
});

test("one-time Checkout uses payment mode, exact server price and idempotency; does not call a real payment system in this test", async () => {
  const originalFetch = globalThis.fetch;
  const { env, state } = makeCheckoutEnv();
  const PRICE_7D = "price_test_pro_7d";
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://api.stripe.com/v1/prices/" + PRICE_7D && init.method !== "POST") {
      return new Response(JSON.stringify({ id: PRICE_7D, active:true, livemode:false, currency:"pln", type:"one_time", unit_amount:700, recurring:null }), {
        status:200, headers:{"content-type":"application/json"}
      });
    }
    if (url === "https://api.stripe.com/v1/checkout/sessions" && init.method === "POST") {
      state.posts += 1;
      state.form = new URLSearchParams(init.body);
      assert.equal(state.form.get("mode"), "payment");
      assert.equal(state.form.get("line_items[0][price]"), PRICE_7D);
      assert.equal(state.form.get("line_items[0][quantity]"), "1");
      assert.equal(state.form.get("metadata[purchase_type]"), "one_time");
      assert.equal(state.form.get("metadata[package_key]"), "pro_7d");
      return new Response(JSON.stringify({ id:"cs_test_one_time_7d", url:"https://checkout.stripe.com/c/pay/cs_test_one_time_7d", status:"open", expires_at:NOW+3600 }), {
        status:200, headers:{"content-type":"application/json"}
      });
    }
    throw new Error("Unexpected Stripe mock request: " + url);
  };
  try {
    const request = new Request("https://worker.example.test/api/one-time-checkout", {
      method:"POST",
      headers:{"Content-Type":"application/json","Idempotency-Key":"one-time-test-0001"},
      body:JSON.stringify({tier:"pro",durationDays:7})
    });
    const response = await oneTimeCheckout(request, env, { userId:"user_test_1" });
    const data = await response.json();
    assert.equal(response.status,200);
    assert.match(data.url,/^https:\/\/checkout\.stripe\.com\//);
    assert.equal(state.posts,1);
    assert.equal(state.lock.session_id,"cs_test_one_time_7d");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function makeGrantEnv() {
  const state = { purchase:null, userTier:"amator", deleteLock:false };
  const env = {
    STRIPE_SECRET_KEY:"sk_test_mock_key",
    STRIPE_EXPECT_LIVEMODE:"false",
    STRIPE_PRICE_PRO_3D:PRICE,
    DB:{
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() {
                if (sql.includes("SELECT id FROM users WHERE id = ?")) return {id:params[0]};
                if (sql.includes("SELECT user_id, tier, duration_days, price_id, amount_total FROM one_time_purchases")) return state.purchase ? {...state.purchase} : null;
                throw new Error("Unexpected grant first SQL: " + sql);
              },
              async all() {
                if (sql.includes("SELECT tier, status, current_period_end, grace_until FROM subscriptions WHERE user_id")) return {results:[]};
                if (sql.includes("SELECT tier, expires_at FROM promo_redemptions WHERE user_id")) return {results:[]};
                if (sql.includes("SELECT tier, expires_at FROM one_time_purchases WHERE user_id")) return {results:state.purchase && state.purchase.expires_at > params[1] ? [{tier:state.purchase.tier,expires_at:state.purchase.expires_at}] : []};
                throw new Error("Unexpected grant all SQL: " + sql);
              },
              async run() {
                if (sql.includes("INSERT INTO one_time_purchases")) {
                  const [checkout_session_id,payment_intent_id,user_id,tier,duration_days,price_id,amount_total,granted_at,expires_at,created_at]=params;
                  if(!state.purchase) state.purchase={checkout_session_id,payment_intent_id,user_id,tier,duration_days,price_id,amount_total,granted_at,expires_at,created_at};
                  return {meta:{changes:1}};
                }
                if (sql.includes("UPDATE users SET tier = ?")) { state.userTier=params[0]; return {meta:{changes:1}}; }
                if (sql.includes("DELETE FROM one_time_checkout_locks")) { state.deleteLock=true; return {meta:{changes:1}}; }
                throw new Error("Unexpected grant run SQL: " + sql);
              }
            };
          }
        };
      }
    },
    state
  };
  return {env,state};
}

test("paid one-time Checkout grants only the validated temporary entitlement and is idempotent", async () => {
  const originalFetch=globalThis.fetch;
  const {env,state}=makeGrantEnv();
  const session={
    id:"cs_test_paid_once",mode:"payment",payment_status:"paid",livemode:false,
    client_reference_id:"user_test_1",customer:"cus_test_once",
    metadata:{user_id:"user_test_1",purchase_type:"one_time",package_key:"pro_3d",plan_tier:"pro",duration_days:"3"},
    amount_total:300,currency:"pln",payment_intent:"pi_test_once",
    line_items:{data:[{price:{id:PRICE,currency:"pln",unit_amount:300,recurring:null},quantity:1,amount_total:300,currency:"pln"}]}
  };
  globalThis.fetch=async (input,init={})=>{
    assert.match(String(input),/\/v1\/checkout\/sessions\/cs_test_paid_once\?expand/);
    return new Response(JSON.stringify(session),{status:200,headers:{"content-type":"application/json"}});
  };
  const event={id:"evt_mock_paid_once",created:NOW-10};
  const snapshot={id:session.id,metadata:{user_id:"user_test_1"},client_reference_id:"user_test_1"};
  try {
    await grantOneTimePurchaseFromWebhook(env,event,snapshot);
    assert.equal(state.userTier,"pro");
    assert.ok(state.purchase);
    assert.equal(state.purchase.amount_total,300);
    assert.equal(state.purchase.duration_days,3);
    assert.equal(state.purchase.expires_at,state.purchase.granted_at+3*86400);
    assert.equal(state.deleteLock,true);
    await grantOneTimePurchaseFromWebhook(env,event,snapshot);
    assert.equal(state.purchase.checkout_session_id,session.id);
  } finally { globalThis.fetch=originalFetch; }
});

test("unpaid or wrong-mode one-time sessions never grant an entitlement", async () => {
  const originalFetch=globalThis.fetch;
  const {env,state}=makeGrantEnv();
  globalThis.fetch=async ()=>new Response(JSON.stringify({
    id:"cs_test_unpaid_once",mode:"payment",payment_status:"unpaid",livemode:false
  }),{status:200,headers:{"content-type":"application/json"}});
  try {
    await assert.rejects(()=>grantOneTimePurchaseFromWebhook(env,{id:"evt_unpaid",created:NOW},{id:"cs_test_unpaid_once",metadata:{user_id:"user_test_1"},client_reference_id:"user_test_1"}),/PAYMENT_NOT_VERIFIED/);
    assert.equal(state.purchase,null);
    assert.equal(state.userTier,"amator");
  } finally { globalThis.fetch=originalFetch; }
});
