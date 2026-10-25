/**
 * NAPRAWNIK Subscription + private user-data API for Cloudflare Workers / D1.
 * Module Worker, no third-party dependencies.
 *
 * IMPORTANT:
 * - This API requires Authorization: Bearer <per-user API token>.
 * - Tokens are stored as SHA-256 hashes in api_tokens; never trust user_id from JSON.
 * - Configure all Stripe Price IDs explicitly in Worker vars before enabling Checkout.
 * - Install schema.sql on a NEW/verified database first; it is additive and does not drop tables.
 */

const ACTIVE_SUB_STATUSES = new Set(["active", "trialing"]);
const BILLING_GRACE_SECONDS = 3 * 24 * 60 * 60;
const MAX_JSON_BYTES = 256 * 1024;
const MAX_WEBHOOK_BYTES = 1024 * 1024;
const RATE_LIMITS = Object.freeze({
  registration: Object.freeze({ maxRequests: 10, windowSeconds: 15 * 60 }),
  userDataWrites: Object.freeze({ maxRequests: 120, windowSeconds: 60 }),
});
const encoder = new TextEncoder();

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...extraHeaders,
    },
  });
}
function err(message, status = 400) { return json({ error: message }, status); }
function nowSeconds() { return Math.floor(Date.now() / 1000); }
function isString(v, max = 256) { return typeof v === "string" && v.length > 0 && v.length <= max; }
function asId(v) { return typeof v === "string" ? v : (v && typeof v.id === "string" ? v.id : null); }
function safeInt(v, fallback = 0) { const n = Number(v); return Number.isSafeInteger(n) && n >= 0 ? n : fallback; }

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function constantTimeStringEqual(a, b) {
  // Compare all bytes of the longer value; fold length into result.
  const aa = encoder.encode(a);
  const bb = encoder.encode(b);
  const length = Math.max(aa.length, bb.length);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < length; i++) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

async function verifyStripeSignature(rawBody, signatureHeader, secret, toleranceSeconds = 300) {
  if (!signatureHeader || !secret) return false;
  let timestamp = null;
  const signatures = [];
  for (const part of signatureHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx < 1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t" && /^\d+$/.test(value)) timestamp = Number(value);
    if (key === "v1" && /^[0-9a-f]{64}$/i.test(value)) signatures.push(value.toLowerCase());
  }
  if (!timestamp || !signatures.length || Math.abs(nowSeconds() - timestamp) > toleranceSeconds) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`));
  const expected = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
  return signatures.some(signature => constantTimeStringEqual(signature, expected));
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}
function withCors(request, env, response) {
  const origin = allowedOrigin(request, env);
  if (!origin) return response;
  const h = new Headers(response.headers);
  h.set("access-control-allow-origin", origin);
  h.set("vary", "Origin");
  h.set("access-control-allow-headers", "Authorization, Content-Type, Idempotency-Key");
  h.set("access-control-allow-methods", "GET, POST, PUT, OPTIONS");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

async function readJson(request, limit = MAX_JSON_BYTES) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > limit) throw new Error("BODY_TOO_LARGE");
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > limit) throw new Error("BODY_TOO_LARGE");
  try { return JSON.parse(raw); } catch { throw new Error("INVALID_JSON"); }
}

async function authenticate(request, env) {
  const header = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+([A-Za-z0-9_-]{32,200})$/.exec(header);
  if (!match) return null;
  const tokenHash = await sha256Hex(match[1]);
  const row = await env.DB.prepare(
    "SELECT user_id, expires_at, revoked_at FROM api_tokens WHERE token_hash = ? LIMIT 1"
  ).bind(tokenHash).first();
  if (!row || row.revoked_at || (row.expires_at && Number(row.expires_at) <= nowSeconds())) return null;
  await env.DB.prepare("UPDATE api_tokens SET last_used_at = ? WHERE token_hash = ?")
    .bind(nowSeconds(), tokenHash).run();
  return { userId: row.user_id };
}

async function enforceRateLimit(request, env, scope, subject, policy) {
  const now = nowSeconds();
  const windowStart = Math.floor(now / policy.windowSeconds) * policy.windowSeconds;
  const identifier = subject || request.headers.get("CF-Connecting-IP") || "unknown";
  const subjectHash = await sha256Hex(scope + ":" + identifier);
  const row = await env.DB.prepare(`
    INSERT INTO request_limits (scope, subject_hash, window_start, request_count, updated_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(scope, subject_hash) DO UPDATE SET
      request_count = CASE
        WHEN request_limits.window_start = excluded.window_start THEN request_limits.request_count + 1
        ELSE 1
      END,
      window_start = excluded.window_start,
      updated_at = excluded.updated_at
    RETURNING request_count
  `).bind(scope, subjectHash, windowStart, now).first();
  if (!row) throw new Error("RATE_LIMIT_STORAGE_UNAVAILABLE");
  if (Math.random() < 0.01) {
    await env.DB.prepare("DELETE FROM request_limits WHERE updated_at < ?")
      .bind(now - 24 * 60 * 60).run().catch(() => {});
  }
  if (Number(row.request_count || 0) > policy.maxRequests) {
    const retryAfter = Math.max(1, windowStart + policy.windowSeconds - now);
    return json({ error: "Too many requests. Please retry later." }, 429, { "retry-after": String(retryAfter) });
  }
  return null;
}

function priceMap(env) {
  const entries = [
    [env.STRIPE_PRICE_PRO_MONTHLY, { tier: "pro", interval: "month" }],
    [env.STRIPE_PRICE_PRO_YEARLY, { tier: "pro", interval: "year" }],
    [env.STRIPE_PRICE_WARSZTAT_MONTHLY, { tier: "warsztat", interval: "month" }],
    [env.STRIPE_PRICE_WARSZTAT_YEARLY, { tier: "warsztat", interval: "year" }],
  ].filter(([id]) => typeof id === "string" && id.startsWith("price_"));
  const map = new Map();
  for (const [id, value] of entries) {
    if (map.has(id)) throw new Error("DUPLICATE_PRICE_ID_CONFIGURATION");
    map.set(id, value);
  }
  return map;
}

function safeReturnUrl(configured, fallback, appBase) {
  try {
    const base = new URL(appBase);
    const target = new URL(configured || fallback);
    if (base.protocol !== "https:" || target.protocol !== "https:" || target.origin !== base.origin) return null;
    return target.toString();
  } catch {
    return null;
  }
}
function tierRank(tier) { return tier === "warsztat" ? 2 : tier === "pro" ? 1 : 0; }
function highestTier(subscriptions) {
  const valid = subscriptions.filter(s => ACTIVE_SUB_STATUSES.has(s.status) && Number(s.current_period_end || 0) > nowSeconds());
  return valid.reduce((tier, s) => tierRank(s.tier) > tierRank(tier) ? s.tier : tier, "amator");
}
function subscriptionTierFromStripe(sub, map) {
  const items = sub.items && Array.isArray(sub.items.data) ? sub.items.data : [];
  const item = items[0];
  const priceId = item && item.price && item.price.id;
  if (priceId && map.has(priceId)) return { ...map.get(priceId), priceId };
  return null;
}
function stripeTimestamp(v) { return Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : null; }
function invoiceSubscriptionId(invoice) {
  return asId(invoice?.subscription) || asId(invoice?.parent?.subscription_details?.subscription);
}

async function persistSubscription(env, { userId, sub, priceInfo, statusOverride = null }) {
  const subscriptionId = asId(sub);
  if (!subscriptionId || !userId) throw new Error("SUBSCRIPTION_IDENTITY_MISSING");
  const customerId = asId(sub.customer);
  const status = statusOverride || String(sub.status || "incomplete");
  const itemPeriodEnds = (Array.isArray(sub?.items?.data) ? sub.items.data : [])
    .map(item => stripeTimestamp(item?.current_period_end))
    .filter(value => value !== null);
  const currentPeriodEnd = stripeTimestamp(sub.current_period_end)
    || (itemPeriodEnds.length ? Math.min(...itemPeriodEnds) : null)
    || (status === "canceled" ? nowSeconds() : null);
  if (!currentPeriodEnd) throw new Error("SUBSCRIPTION_PERIOD_END_MISSING");
  const cancelAtPeriodEnd = sub.cancel_at_period_end ? 1 : 0;
  await env.DB.prepare(`
    INSERT INTO subscriptions
      (stripe_subscription_id, user_id, stripe_customer_id, tier, price_id, billing_interval, status,
       current_period_end, cancel_at_period_end, grace_until, stripe_created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    ON CONFLICT(stripe_subscription_id) DO UPDATE SET
      user_id = excluded.user_id,
      stripe_customer_id = excluded.stripe_customer_id,
      tier = excluded.tier,
      price_id = excluded.price_id,
      billing_interval = excluded.billing_interval,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      grace_until = CASE WHEN excluded.status IN ('active','trialing') THEN NULL ELSE subscriptions.grace_until END,
      updated_at = excluded.updated_at
    WHERE subscriptions.user_id = excluded.user_id
  `).bind(
    subscriptionId, userId, customerId, priceInfo?.tier || "amator", priceInfo?.priceId || null,
    priceInfo?.interval || null, status, currentPeriodEnd, cancelAtPeriodEnd,
    stripeTimestamp(sub.created), nowSeconds()
  ).run();
}

async function recalcUserTier(env, userId) {
  const { results = [] } = await env.DB.prepare(
    "SELECT tier, status, current_period_end, grace_until FROM subscriptions WHERE user_id = ?"
  ).bind(userId).all();
  const now = nowSeconds();
  const eligible = results.filter(s => (
    (ACTIVE_SUB_STATUSES.has(s.status) && Number(s.current_period_end) > now) ||
    (s.status === "past_due" && Number(s.grace_until || 0) > now)
  ));
  const tier = eligible.reduce((best, s) => tierRank(s.tier) > tierRank(best) ? s.tier : best, "amator");
  await env.DB.prepare("UPDATE users SET tier = ?, updated_at = ? WHERE id = ?")
    .bind(tier, now, userId).run();
  return tier;
}

function requiredTierForDataKey(key) {
  const namespace = String(key || "").split(/[:/.]/, 1)[0].toLowerCase();
  if (namespace === "warsztat" || namespace === "workshop") return "warsztat";
  if (namespace === "pro" || namespace === "premium") return "pro";
  return "amator";
}
async function userHasTier(env, userId, minimumTier) {
  const currentTier = await recalcUserTier(env, userId);
  return tierRank(currentTier) >= tierRank(minimumTier);
}

async function userForSubscription(env, sub, eventObject = null) {
  const metadataUserId = sub?.metadata?.user_id || eventObject?.metadata?.user_id;
  if (isString(metadataUserId, 128)) {
    const row = await env.DB.prepare("SELECT id FROM users WHERE id = ? LIMIT 1").bind(metadataUserId).first();
    if (row) return row.id;
  }
  const subId = asId(sub);
  if (subId) {
    const row = await env.DB.prepare("SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ? LIMIT 1").bind(subId).first();
    if (row?.user_id) return row.user_id;
  }
  const customerId = asId(sub?.customer || eventObject?.customer);
  if (customerId) {
    const row = await env.DB.prepare("SELECT user_id FROM stripe_customers WHERE stripe_customer_id = ? LIMIT 1").bind(customerId).first();
    if (row?.user_id) return row.user_id;
  }
  return null;
}

async function fetchStripeSubscription(env, subscriptionId) {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY_MISSING");
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}?expand[]=items.data.price`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!response.ok) throw new Error(`STRIPE_SUBSCRIPTION_FETCH_FAILED_${response.status}`);
  return response.json();
}

async function claimWebhookEvent(env, event) {
  // An atomic conditional UPSERT grants a short lease to exactly one invocation.
  // Failed/stuck events can be reclaimed once the lease expires; processed events never are.
  const now = nowSeconds();
  const result = await env.DB.prepare(`INSERT INTO stripe_events
      (event_id, event_type, event_created, processed_at, processing, claimed_at, last_error)
    VALUES (?, ?, ?, NULL, 1, ?, NULL)
    ON CONFLICT(event_id) DO UPDATE SET processing = 1, claimed_at = excluded.claimed_at, last_error = NULL
    WHERE stripe_events.processed_at IS NULL
      AND (stripe_events.processing = 0 OR stripe_events.claimed_at IS NULL OR stripe_events.claimed_at < ?)`)
    .bind(event.id, event.type, stripeTimestamp(event.created), now, now - 300).run();
  if (Number(result.meta?.changes || 0) === 1) return "claimed";
  const current = await env.DB.prepare(
    "SELECT processed_at, processing, claimed_at FROM stripe_events WHERE event_id = ? LIMIT 1"
  ).bind(event.id).first();
  return current?.processed_at ? "processed" : "processing";
}
async function markWebhookProcessed(env, eventId) {
  await env.DB.prepare("UPDATE stripe_events SET processed_at = ?, processing = 0, claimed_at = NULL, last_error = NULL WHERE event_id = ?")
    .bind(nowSeconds(), eventId).run();
}
async function markWebhookFailed(env, eventId, message) {
  await env.DB.prepare("UPDATE stripe_events SET processing = 0, claimed_at = NULL, last_error = ? WHERE event_id = ?")
    .bind(String(message).slice(0, 500), eventId).run();
}

async function handleWebhook(request, env) {
  if (request.method !== "POST") return err("Method not allowed", 405);
  if (!env.STRIPE_WEBHOOK_SECRET) return err("Webhook secret is not configured", 500);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_WEBHOOK_BYTES) return err("Payload too large", 413);
  const rawBody = await request.text();
  if (encoder.encode(rawBody).byteLength > MAX_WEBHOOK_BYTES) return err("Payload too large", 413);
  const signature = request.headers.get("Stripe-Signature");
  if (!(await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET))) return err("Invalid Stripe signature", 400);
  let event;
  try { event = JSON.parse(rawBody); } catch { return err("Malformed JSON", 400); }
  if (!isString(event.id, 128) || !isString(event.type, 128) || !event.data?.object) return err("Invalid Stripe event", 400);

  try {
    const claimStatus = await claimWebhookEvent(env, event);
    if (claimStatus === "processed") return json({ received: true, duplicate: true });
    if (claimStatus !== "claimed") return err("Webhook event is already processing; retry later", 503);

    const obj = event.data.object;
    const map = priceMap(env);
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      if (obj.mode !== "subscription" || (obj.payment_status && obj.payment_status !== "paid" && event.type === "checkout.session.completed")) {
        await markWebhookProcessed(env, event.id);
        return json({ received: true, ignored: true });
      }
      const userId = obj.metadata?.user_id || obj.client_reference_id;
      const subscriptionId = asId(obj.subscription);
      const customerId = asId(obj.customer);
      if (!isString(userId, 128) || !subscriptionId || !customerId) throw new Error("CHECKOUT_METADATA_OR_IDS_MISSING");
      const user = await env.DB.prepare("SELECT id FROM users WHERE id = ? LIMIT 1").bind(userId).first();
      if (!user) throw new Error("CHECKOUT_USER_NOT_FOUND");
      await env.DB.prepare(`INSERT INTO stripe_customers (stripe_customer_id,user_id,created_at) VALUES (?,?,?)
        ON CONFLICT(stripe_customer_id) DO UPDATE SET user_id=excluded.user_id WHERE stripe_customers.user_id=excluded.user_id`)
        .bind(customerId, userId, nowSeconds()).run();
      const sub = await fetchStripeSubscription(env, subscriptionId);
      const info = subscriptionTierFromStripe(sub, map);
      if (!info) throw new Error("UNKNOWN_STRIPE_PRICE_ID");
      await persistSubscription(env, { userId, sub, priceInfo: info });
      await recalcUserTier(env, userId);
    } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subId = asId(obj);
      if (!subId) throw new Error("SUBSCRIPTION_ID_MISSING");
      // Fetch latest state to avoid out-of-order snapshot events reviving a canceled subscription.
      const latest = await fetchStripeSubscription(env, subId);
      const userId = await userForSubscription(env, latest, obj);
      if (!userId) throw new Error("SUBSCRIPTION_USER_NOT_RESOLVED");
      const info = subscriptionTierFromStripe(latest, map);
      if (!info) {
        if (latest.status === "canceled" || event.type === "customer.subscription.deleted") {
          const existing = await env.DB.prepare("SELECT tier, price_id, billing_interval FROM subscriptions WHERE stripe_subscription_id = ?").bind(subId).first();
          await persistSubscription(env, { userId, sub: { ...latest, status: "canceled" }, priceInfo: existing || { tier: "amator", priceId: null, interval: null } });
          await recalcUserTier(env, userId);
        } else throw new Error("UNKNOWN_STRIPE_PRICE_ID");
      } else {
        const normalized = event.type === "customer.subscription.deleted" ? { ...latest, status: "canceled" } : latest;
        await persistSubscription(env, { userId, sub: normalized, priceInfo: info });
        await recalcUserTier(env, userId);
      }
    } else if (event.type === "invoice.payment_failed") {
      const subId = invoiceSubscriptionId(obj);
      if (subId) {
        const existing = await env.DB.prepare("SELECT user_id, tier, price_id, billing_interval FROM subscriptions WHERE stripe_subscription_id = ? LIMIT 1").bind(subId).first();
        if (existing) {
          const graceUntil = nowSeconds() + BILLING_GRACE_SECONDS;
          await env.DB.prepare("UPDATE subscriptions SET status = 'past_due', grace_until = ?, updated_at = ? WHERE stripe_subscription_id = ?")
            .bind(graceUntil, nowSeconds(), subId).run();
          await recalcUserTier(env, existing.user_id);
        } else {
          // Stripe can deliver invoice.payment_failed before the subscription row exists locally.
          // Recover the subscription from Stripe so this failure is not acknowledged and lost.
          const latest = await fetchStripeSubscription(env, subId);
          const userId = await userForSubscription(env, latest, obj);
          const info = subscriptionTierFromStripe(latest, map);
          if (!userId) throw new Error("FAILED_INVOICE_USER_NOT_RESOLVED");
          if (!info) throw new Error("FAILED_INVOICE_PRICE_NOT_RESOLVED");
          const graceUntil = nowSeconds() + BILLING_GRACE_SECONDS;
          await persistSubscription(env, { userId, sub: { ...latest, status: "past_due" }, priceInfo: info });
          await env.DB.prepare("UPDATE subscriptions SET status = 'past_due', grace_until = ?, updated_at = ? WHERE stripe_subscription_id = ?")
            .bind(graceUntil, nowSeconds(), subId).run();
          await recalcUserTier(env, userId);
        }
      }
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
      const subId = invoiceSubscriptionId(obj);
      if (subId) {
        const latest = await fetchStripeSubscription(env, subId);
        const userId = await userForSubscription(env, latest, obj);
        const info = subscriptionTierFromStripe(latest, map);
        // A paid invoice must never be acknowledged if we cannot grant the matching plan.
        // Returning 500 lets Stripe retry after identity or price configuration is repaired.
        if (!userId) throw new Error("PAID_INVOICE_USER_NOT_RESOLVED");
        if (!info) throw new Error("PAID_INVOICE_PRICE_NOT_RESOLVED");
        await persistSubscription(env, { userId, sub: latest, priceInfo: info, statusOverride: latest.status === "past_due" ? "active" : null });
        await recalcUserTier(env, userId);
      }
    }
    await markWebhookProcessed(env, event.id);
    return json({ received: true });
  } catch (e) {
    if (isString(event.id, 128)) await markWebhookFailed(env, event.id, e instanceof Error ? e.message : "unknown error").catch(() => {});
    // 500 makes Stripe retry transient or unprocessed events. Never log request body/secrets.
    return err("Webhook processing failed", 500);
  }
}

async function checkout(request, env, auth) {
  if (request.method !== "POST") return err("Method not allowed", 405);
  if (!env.STRIPE_SECRET_KEY) return err("Stripe is not configured", 500);
  const body = await readJson(request);
  const idempotency = request.headers.get("Idempotency-Key");
  if (!idempotency || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotency)) {
    return err("A valid Idempotency-Key is required", 400);
  }
  const tier = body?.tier;
  const interval = body?.interval;
  if (!(["pro", "warsztat"].includes(tier)) || !(["month", "year"].includes(interval))) return err("Invalid tier or interval");
  const priceId = ({
    pro: { month: env.STRIPE_PRICE_PRO_MONTHLY, year: env.STRIPE_PRICE_PRO_YEARLY },
    warsztat: { month: env.STRIPE_PRICE_WARSZTAT_MONTHLY, year: env.STRIPE_PRICE_WARSZTAT_YEARLY },
  })[tier][interval];
  if (!priceId || !priceId.startsWith("price_")) return err("Price is not configured", 503);
  const appBase = env.APP_BASE_URL;
  if (!appBase || !/^https:\/\//.test(appBase)) return err("APP_BASE_URL must be an HTTPS URL", 500);
  const user = await env.DB.prepare("SELECT id, email FROM users WHERE id = ? LIMIT 1").bind(auth.userId).first();
  if (!user) return err("User not found", 404);
  // Prevent accidental duplicate billing: one account may have only one current active/trial subscription.
  const existingSub = await env.DB.prepare("SELECT stripe_subscription_id, tier, status, billing_interval, current_period_end FROM subscriptions WHERE user_id = ? AND status IN (?, ?) AND current_period_end > ? ORDER BY current_period_end DESC LIMIT 1").bind(auth.userId, "active", "trialing", nowSeconds()).first();
  if (existingSub) return err("An active subscription already exists. Refresh your plan or manage the current subscription instead of starting another checkout.", 409);
  const customer = await env.DB.prepare("SELECT stripe_customer_id FROM stripe_customers WHERE user_id = ? LIMIT 1").bind(auth.userId).first();
  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("line_items[0][price]", priceId);
  form.set("line_items[0][quantity]", "1");
  const appRoot = appBase.replace(/\/$/, "");
  const successUrl = safeReturnUrl(env.CHECKOUT_SUCCESS_URL, `${appRoot}/?checkout=success`, appBase);
  const cancelUrl = safeReturnUrl(env.CHECKOUT_CANCEL_URL, `${appRoot}/?checkout=cancelled`, appBase);
  if (!successUrl || !cancelUrl) return err("Checkout return URLs must use the APP_BASE_URL origin", 500);
  form.set("success_url", successUrl);
  form.set("cancel_url", cancelUrl);
  form.set("client_reference_id", auth.userId);
  form.set("metadata[user_id]", auth.userId);
  form.set("subscription_data[metadata][user_id]", auth.userId);
  form.set("subscription_data[metadata][plan_tier]", tier);
  if (user.email && !user.email.endsWith("@invalid.naprawnik.local") && isString(user.email, 320)) form.set("customer_email", user.email);
  if (customer?.stripe_customer_id) {
    form.delete("customer_email");
    form.set("customer", customer.stripe_customer_id);
  }
  const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" };
  headers["Idempotency-Key"] = `naprawnik-checkout-${auth.userId}-${idempotency}`;
  let response;
  try {
    response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers, body: form });
  } catch {
    console.error(JSON.stringify({ event: "stripe_checkout_network_error" }));
    return err("Could not reach Stripe Checkout. Please retry.", 502);
  }
  let result = null;
  try { result = await response.json(); } catch { /* Stripe error bodies may be empty or non-JSON. */ }
  if (!response.ok || !isString(result?.url, 2048) || !isString(result?.id, 128)) {
    console.error(JSON.stringify({
      event: "stripe_checkout_rejected",
      status: response.status,
      requestId: response.headers.get("request-id") || null,
      errorCode: isString(result?.error?.code, 128) ? result.error.code : null,
    }));
    return err("Could not create Checkout session", 502);
  }
  try {
    await env.DB.prepare("INSERT INTO checkout_requests (idempotency_key, user_id, session_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(idempotency_key) DO NOTHING")
      .bind(idempotency, auth.userId, result.id, nowSeconds()).run();
  } catch {
    // Stripe has created a valid hosted session. The webhook is authoritative for subscription state,
    // so a failed auxiliary audit insert must not strand the customer without the Checkout URL.
    console.error(JSON.stringify({
      event: "checkout_request_record_failed",
      requestId: response.headers.get("request-id") || null,
    }));
  }
  return json({ url: result.url, sessionId: result.id }, 200);
}

async function createBillingPortalSession(request, env, auth) {
  if (request.method !== "POST") return err("Method not allowed", 405);
  if (!env.STRIPE_SECRET_KEY) return err("Stripe is not configured", 500);
  const appBase = env.APP_BASE_URL;
  if (!appBase || !/^https:\/\//.test(appBase)) return err("APP_BASE_URL must be an HTTPS URL", 500);
  const customer = await env.DB.prepare(
    "SELECT stripe_customer_id FROM stripe_customers WHERE user_id = ? LIMIT 1"
  ).bind(auth.userId).first();
  if (!customer?.stripe_customer_id) return err("No Stripe billing customer is linked to this account", 409);

  const form = new URLSearchParams();
  form.set("customer", customer.stripe_customer_id);
  form.set("return_url", `${appBase.replace(/\/$/, "")}/?billing=return`);
  form.set("locale", "pl");
  let response;
  try {
    response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
  } catch {
    console.error(JSON.stringify({ event: "stripe_billing_portal_network_error" }));
    return err("Could not reach Stripe billing portal. Please retry.", 502);
  }
  let result = null;
  try { result = await response.json(); } catch { /* Stripe error bodies may be empty or non-JSON. */ }
  let portalUrl = null;
  try {
    const parsed = new URL(result?.url || "");
    if (parsed.protocol === "https:" && parsed.hostname === "billing.stripe.com") portalUrl = parsed.toString();
  } catch { /* Never redirect to an untrusted URL. */ }
  if (!response.ok || !portalUrl) {
    console.error(JSON.stringify({
      event: "stripe_billing_portal_rejected",
      status: response.status,
      requestId: response.headers.get("request-id") || null,
      errorCode: isString(result?.error?.code, 128) ? result.error.code : null,
    }));
    return err("Could not create billing portal session", 502);
  }
  return json({ url: portalUrl }, 200);
}

async function getMe(env, auth) {
  const user = await env.DB.prepare("SELECT id, email, tier, updated_at FROM users WHERE id = ? LIMIT 1").bind(auth.userId).first();
  if (!user) return err("User not found", 404);
  const { results = [] } = await env.DB.prepare(`SELECT tier, status, billing_interval, current_period_end, cancel_at_period_end, grace_until
    FROM subscriptions WHERE user_id = ? ORDER BY current_period_end DESC`).bind(auth.userId).all();
  const currentTier = await recalcUserTier(env, auth.userId);
  return json({ user: { ...user, tier: currentTier }, subscriptions: results });
}

async function readUserData(env, auth, url) {
  const key = url.searchParams.get("key");
  if (key) {
    if (!isString(key, 128)) return err("Invalid key");
    const requiredTier = requiredTierForDataKey(key);
    if (requiredTier !== "amator" && !(await userHasTier(env, auth.userId, requiredTier))) {
      return err("An active subscription for the required plan is needed to access this data", 403);
    }
    const row = await env.DB.prepare("SELECT data_key, json_value, revision, updated_at FROM user_data WHERE user_id = ? AND data_key = ? LIMIT 1")
      .bind(auth.userId, key).first();
    return json({ item: row || null });
  }
  const currentTier = await recalcUserTier(env, auth.userId);
  const { results = [] } = await env.DB.prepare("SELECT data_key, json_value, revision, updated_at FROM user_data WHERE user_id = ? ORDER BY updated_at DESC LIMIT 500")
    .bind(auth.userId).all();
  return json({ items: results.filter(row => tierRank(requiredTierForDataKey(row.data_key)) <= tierRank(currentTier)) });
}
async function writeUserData(request, env, auth) {
  if (request.method !== "PUT" && request.method !== "POST") return err("Method not allowed", 405);
  const body = await readJson(request);
  if (!isString(body?.key, 128) || body.key.includes("\u0000")) return err("Invalid key");
  const requiredTier = requiredTierForDataKey(body.key);
  if (requiredTier !== "amator" && !(await userHasTier(env, auth.userId, requiredTier))) {
    return err("An active subscription for the required plan is needed to write this data", 403);
  }
  if (typeof body?.value === "undefined") return err("Missing value");
  const clientUpdatedAt = Number(body.updatedAt);
  if (!Number.isFinite(clientUpdatedAt) || clientUpdatedAt < 0 || clientUpdatedAt > Date.now() + 5 * 60 * 1000) return err("Invalid updatedAt");
  const value = JSON.stringify(body.value);
  if (encoder.encode(value).byteLength > 128 * 1024) return err("Value too large", 413);
  const serverNow = Date.now();
  const current = await env.DB.prepare("SELECT revision, updated_at, json_value FROM user_data WHERE user_id = ? AND data_key = ? LIMIT 1")
    .bind(auth.userId, body.key).first();
  // Timestamps from devices are hints only; reject stale writes and require revision for optimistic concurrency.
  if (current && Number(clientUpdatedAt) < Number(current.updated_at)) {
    return json({ conflict: true, reason: "STALE_CLIENT_TIMESTAMP", current: { revision: current.revision, updatedAt: current.updated_at, value: safeParse(current.json_value) } }, 409);
  }
  if (current && body.revision !== Number(current.revision)) {
    return json({ conflict: true, reason: "REVISION_MISMATCH", current: { revision: current.revision, updatedAt: current.updated_at, value: safeParse(current.json_value) } }, 409);
  }
  if (!current && body.revision !== undefined && Number(body.revision) !== 0) return err("New records must use revision 0", 409);
  const nextRevision = current ? Number(current.revision) + 1 : 1;
  const effectiveUpdatedAt = Math.max(Math.floor(clientUpdatedAt), Number(current?.updated_at || 0) + 1, serverNow);
  await env.DB.prepare(`INSERT INTO user_data (user_id, data_key, json_value, revision, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, data_key) DO UPDATE SET json_value = excluded.json_value, revision = excluded.revision, updated_at = excluded.updated_at
    WHERE user_data.revision = ? AND user_data.updated_at <= excluded.updated_at`)
    .bind(auth.userId, body.key, value, nextRevision, effectiveUpdatedAt, Number(current?.revision || 0)).run();
  const saved = await env.DB.prepare("SELECT data_key, json_value, revision, updated_at FROM user_data WHERE user_id = ? AND data_key = ?")
    .bind(auth.userId, body.key).first();
  if (!saved || Number(saved.revision) !== nextRevision) return json({ conflict: true, reason: "CONCURRENT_WRITE", current: saved ? { ...saved, value: safeParse(saved.json_value) } : null }, 409);
  return json({ saved: { key: saved.data_key, value: safeParse(saved.json_value), revision: saved.revision, updatedAt: saved.updated_at } }, 200);
}
function safeParse(value) { try { return JSON.parse(value); } catch { return null; } }


function testPanelHtml(key) {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NAPRAWNIK — panel testowy Stripe/D1</title>
<style>
:root{color-scheme:light dark;--bg:#0f1115;--panel:#1a1d24;--text:#e8e8ea;--accent:#5b8cff;--border:#2a2e38}
@media (prefers-color-scheme: light){:root{--bg:#f5f6f8;--panel:#fff;--text:#1a1a1a;--accent:#2f5fd0;--border:#dde1e8}}
body{background:var(--bg);color:var(--text);font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:16px}
h1{font-size:18px}label{display:block;margin:12px 0 4px;font-size:13px;opacity:.8}
input,select,button{width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--panel);color:var(--text);font-size:15px;box-sizing:border-box}
button{background:var(--accent);color:#fff;border:none;margin-top:14px;font-weight:600}
pre{white-space:pre-wrap;word-break:break-all;background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:12px;margin-top:10px}
a.result{display:block;margin-top:10px;color:var(--accent)}
.warn{font-size:12px;opacity:.7;margin-top:18px}
</style></head><body>
<h1>⚠️ Panel testowy NAPRAWNIK (tylko środowisko testowe)</h1>
<p style="font-size:13px;opacity:.8">Ta strona jest serwowana przez ten sam Worker — żadnych problemów z CORS. Służy wyłącznie do ręcznego testu End-to-End. Nie zostawiaj jej dostępnej w środowisku produkcyjnym bez TEST_PANEL_KEY.</p>
<label>Token API użytkownika (Bearer, z D1 → api_tokens)</label>
<input id="token" placeholder="wklej token wygenerowany dla testowego użytkownika">
<label>Plan</label>
<select id="tier"><option value="pro">PRO</option><option value="warsztat">WARSZTAT</option></select>
<label>Okres</label>
<select id="interval"><option value="month">Miesięcznie</option><option value="year">Rocznie</option></select>
<button id="goMe">1. Sprawdź /api/me (status planu)</button>
<button id="goCheckout">2. Utwórz testową sesję Stripe Checkout</button>
<pre id="out">Wynik pojawi się tutaj.</pre>
<p class="warn">Po kliknięciu 2. otworzy się link do Stripe Checkout w trybie testowym — zapłać kartą 4242 4242 4242 4242, dowolna przyszła data, dowolny CVC. Po płatności wróć tu i kliknij ponownie "1." — plan powinien się zmienić.</p>
<script>
const out = document.getElementById('out');
function show(x){ out.textContent = typeof x === 'string' ? x : JSON.stringify(x, null, 2); }
async function call(path, opts) {
  const token = document.getElementById('token').value.trim();
  if (!token) { show('Wklej najpierw token.'); return null; }
  const headers = { 'Authorization': 'Bearer ' + token };
  if (opts && opts.body) headers['content-type'] = 'application/json';
  try {
    const r = await fetch(path, { method: (opts && opts.method) || 'GET', headers, body: opts && opts.body ? JSON.stringify(opts.body) : undefined });
    const data = await r.json().catch(() => ({}));
    show({ status: r.status, data });
    return { status: r.status, data };
  } catch (e) { show('Błąd sieci: ' + e.message); return null; }
}
document.getElementById('goMe').addEventListener('click', () => call('/api/me'));
document.getElementById('goCheckout').addEventListener('click', async () => {
  const tier = document.getElementById('tier').value;
  const interval = document.getElementById('interval').value;
  const res = await call('/api/checkout', { method: 'POST', body: { tier, interval } });
  if (res && res.data && res.data.url) {
    const a = document.createElement('a'); a.href = res.data.url; a.target = '_blank'; a.rel = 'noopener';
    a.className = 'result'; a.textContent = '➡️ Otwórz testowy Stripe Checkout';
    out.after(a);
  }
});
</script></body></html>`;
}

async function registerAnonymousUser(request, env) {
  if (request.method !== 'POST') return err('Method not allowed', 405);
  const body = await readJson(request);
  let email = null;
  if (body && body.email !== undefined && body.email !== null && body.email !== '') {
    if (!isString(body.email, 320) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return err('Invalid email');
    email = body.email.trim().toLowerCase();
  }
  const userId = crypto.randomUUID();
  // The database requires an email; use an internal-only placeholder when signup email is omitted.
  const effectiveEmail = email || ("guest-" + userId + "@invalid.naprawnik.local");
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  const hash = await sha256Hex(token);
  const now = nowSeconds();
  const expiresAt = now + 365 * 24 * 60 * 60;
  await env.DB.prepare("INSERT INTO users (id, email, tier, created_at, updated_at) VALUES (?, ?, 'amator', ?, ?)").bind(userId, effectiveEmail, now, now).run();
  await env.DB.prepare('INSERT INTO api_tokens (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(hash, userId, now, expiresAt).run();
  return json({ token, user: { id: userId, tier: 'amator' }, expiresAt }, 201);
}


export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") {
        const origin = allowedOrigin(request, env);
        if (!origin) return new Response(null, { status: 403 });
        return withCors(request, env, new Response(null, { status: 204, headers: { "access-control-max-age": "86400" } }));
      }
      const originHeader = request.headers.get("Origin");
      if (url.pathname !== "/webhooks/stripe" && originHeader && !allowedOrigin(request, env)) {
        return err("Origin not allowed", 403);
      }
      let response;
      if (url.pathname === "/health" && request.method === "GET") { response = json({ ok: true, service: "naprawnik-subscriptions", version: "2.1.0", enabled: env.PRODUCTION_ENABLED === "true" }); } else if (url.pathname === "/webhooks/stripe") {
        response = await handleWebhook(request, env);
      } else if (env.PRODUCTION_ENABLED !== "true") { response = err("Production service is not enabled", 503);      } else if (url.pathname === "/api/register" && request.method === "POST") {
        const limited = await enforceRateLimit(request, env, "registration", request.headers.get("CF-Connecting-IP") || "unknown", RATE_LIMITS.registration);
        response = limited || await registerAnonymousUser(request, env);
      } else if (url.pathname === "/api/checkout" && request.method === "POST") {
        const auth = await authenticate(request, env);
        if (!auth) response = err("Unauthorized", 401);
        else response = await checkout(request, env, auth);
      } else if (url.pathname === "/api/billing-portal" && request.method === "POST") {
        const auth = await authenticate(request, env);
        if (!auth) response = err("Unauthorized", 401);
        else response = await createBillingPortalSession(request, env, auth);
      } else if (url.pathname === "/api/me" && request.method === "GET") {
        const auth = await authenticate(request, env);
        if (!auth) response = err("Unauthorized", 401);
        else response = await getMe(env, auth);
      } else if (url.pathname === "/api/data" && request.method === "GET") {
        const auth = await authenticate(request, env);
        if (!auth) response = err("Unauthorized", 401);
        else response = await readUserData(env, auth, url);
      } else if (url.pathname === "/api/data" && ["POST", "PUT"].includes(request.method)) {
        const auth = await authenticate(request, env);
        if (!auth) response = err("Unauthorized", 401);
        else {
          const limited = await enforceRateLimit(request, env, "user-data-write", auth.userId, RATE_LIMITS.userDataWrites);
          response = limited || await writeUserData(request, env, auth);
        }
      } else {
        response = err("Not found", 404);
      }
      return withCors(request, env, response);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      if (message === "BODY_TOO_LARGE") return err("Payload too large", 413);
      if (message === "INVALID_JSON") return err("Malformed JSON", 400);
      // Do not expose exception details or secrets to clients.
      return json({ error: "Internal server error" }, 500);
    }
  },
};

export { enforceRateLimit, requiredTierForDataKey, safeReturnUrl };


