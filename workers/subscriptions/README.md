# NAPRAWNIK — Cloudflare subscriptions Worker

This source is a source-controlled mirror of the deployed `naprawnik-subscriptions-live` Worker plus pre-release changes. It has **not** been deployed by this branch.

## Read-only audit findings

- The deployed Worker source overwrote `PRODUCTION_ENABLED` with `true` on every request, despite its Cloudflare variable being `false`.
- The live Worker configuration returned a staging hostname for `ALLOWED_ORIGINS`, `APP_BASE_URL`, `CHECKOUT_SUCCESS_URL` and `CHECKOUT_CANCEL_URL`, rather than the GitHub Pages app origin.
- The deployed D1 schemas did not have a persistent request-limiter table.
- Stripe webhook signature verification and event-idempotency handling are already present in the deployed source; this branch keeps those mechanisms.
- Subscription `paused`/`resumed` lifecycle events are now handled explicitly; repeated failures of the same Stripe invoice no longer extend the grace period on every retry.
- A D1 checkout lock now prevents concurrent hosted Checkout sessions for the same account, and subscription events restore the Stripe customer-to-account mapping even if webhook events arrive out of order.

The source mirror no longer overrides environment variables in code. Worker requests fail closed when `PRODUCTION_ENABLED` is not exactly `true`. No Cloudflare variables, secrets, D1 data, deployed versions or Stripe settings were changed.

## Migrations and staging

1. Copy `wrangler.example.toml` to local `wrangler.toml` and substitute a verified staging-only D1 ID and test Stripe Price IDs.
2. Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with Stripe **test mode** values using `wrangler secret put`; do not store secret values in Git.
3. Verify that `ALLOWED_ORIGINS` is exactly the origin that serves the app, and that `APP_BASE_URL` plus both return URLs are HTTPS and on the same origin.
4. Apply migrations only to the staging DB after confirming the Wrangler environment and database ID. Migrations `0002_request_limits.sql` and `0003_checkout_locks.sql` have not been applied remotely by this branch.
5. Keep `PRODUCTION_ENABLED = false` until configuration and tests pass. Any staging deployment must be a deliberate separate action.

Suggested local checks:

```sh
node --check workers/subscriptions/src/index.mjs
node --test workers/subscriptions/security.test.mjs
```

## Photo diagnosis via OpenAI Responses API

The branch adds `POST /api/photo-diagnosis`. It requires the same valid Bearer token as billing APIs, and a server-recomputed active `pro` or `warsztat` subscription. Never accept a plan claim, image permission, or token from frontend `localStorage` as authorization.

Required staging-only secret:
- `OPENAI_API_KEY` — provision with Cloudflare secret management / Wrangler in the staging environment. Never put it in HTML, source control, chat, or `[vars]`.
- `OPENAI_VISION_MODEL` is a non-secret variable and defaults to `gpt-4.1-mini`.

Limits in the branch:
- up to 3 JPEG/PNG/WebP images;
- up to 1.5 MiB per image, 5 MiB request body;
- text fields are length-limited;
- 8 calls per authenticated account per hour through the D1 fixed-window limiter;
- a 45-second upstream timeout and generic error messages (no upstream body / key is returned to the client);
- Responses API request sets `store: false`. This does not replace configuring account-side OpenAI usage/budget limits or reviewing applicable data-handling requirements.

This endpoint has **not** been deployed or tested with a real OpenAI key by this branch. It intentionally fails closed if the key, current D1 rate-limit table, active subscription, or other required configuration is missing. The static frontend only sends images through `billing.js` and the Cloudflare API; the obsolete Netlify endpoint `/.netlify/functions/photo-diagnosis` is no longer used by this branch.

## Server-side protection

- Anonymous registration: maximum 10 requests per client IP per 15-minute fixed window.
- One hosted Stripe Checkout is allowed at a time per account; an open session is reused only for the same tier and billing interval.
- Authenticated `/api/data` writes: maximum 120 requests per account per 60-second fixed window.
- The limiter stores SHA-256 hashes of limiter subjects, not raw client IP values; a Cloudflare edge rate-limiting rule is still recommended against distributed abuse.
- Data keys prefixed `pro:` or `premium:` require an active PRO/WARSZTAT subscription; `warsztat:` or `workshop:` require WARSZTAT. Reserved key namespaces such as licence, subscription, billing, entitlement, tier, plan and API token cannot be written as ordinary user data.
- All server-side protected computations and records must have explicit Worker-side entitlement checks. Client-only features in static HTML are not tamper-proof and should not be treated as a security boundary.

## Production blockers

Before production, reconcile the Cloudflare variables with the actual app origin, inspect the live Stripe price IDs/mode without printing secret values, apply migrations to staging, test the real staging checkout and webhook cycle, and only then plan a separately reviewed production release.

### Remote D1 inventory (read-only, 2026-10-25)

A read-only `SELECT name FROM sqlite_master WHERE type = 'table'` was run against the configured live, v2-staging and sandbox D1 bindings. All three contained the existing application tables but **none contained `request_limits` or `checkout_locks`**. The query returned zero written rows and did not change any database. Consequently, the Worker version in this PR will fail closed for anonymous registration and user-data writes until migration `0002_request_limits.sql` is applied, and Checkout is not ready until migration `0003_checkout_locks.sql` is applied to the specifically verified staging database. Do not apply either migration to live as part of this PR.
