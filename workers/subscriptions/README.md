# NAPRAWNIK — Cloudflare subscriptions Worker

## Current production state — 2026-10-25

The `main` branch is the source of truth for the production release. The Worker `naprawnik-subscriptions-live` runs the current source from `workers/subscriptions/src/index.mjs`; the GitHub Pages UI is published from the same repository.

- Production is explicitly enabled with `PRODUCTION_ENABLED=true`; Stripe is configured for Live mode and retains the existing monthly/yearly prices.
- The production D1 database has the additive migration `0004_admin_promos_analytics.sql` applied. It creates server-side admin roles, one-time bootstrap state, hashed promo codes and redemptions, and opt-in analytics tables.
- The `ADMIN_BOOTSTRAP_KEY` is stored as a Cloudflare Worker secret. The first successful bootstrap can grant admin only to the authenticated account that wins the one-time bootstrap. Do not commit or log the key.
- Photo analysis is intentionally disabled by default. The Worker requires `PHOTO_ANALYSIS_ENABLED=true` plus a configured `OPENAI_API_KEY` before it can call OpenAI. Do not enable it until API spend limits are agreed.
- Anonymous analytics are sent only after a user opts in from application settings. Stored identifiers are hashed and raw IP addresses are not stored by this feature. Account counts are exact; browser counts are estimates, not people.
- No Checkout or payment transaction was run during the admin/promo rollout.

## Production hardening notes

- The Worker no longer overrides `PRODUCTION_ENABLED` in request code and fails closed unless the setting is explicitly `true`.
- CORS and Checkout return URLs use the production GitHub Pages origin.
- D1-backed request limits cover registration, account-data writes, billing portal, admin bootstrap/writes, promo redemptions, and analytics.
- Stripe webhook signature verification, event-idempotency, subscription lifecycle handling, and checkout locking remain enabled.

### Historical staging rollout performed 2026-10-25

The following section records staging work from earlier that day; it is historical context, not the current deployment state.

- Uploaded the branch's `workers/subscriptions/src/index.mjs` to `naprawnik-subscriptions-v2-staging` only. Uploaded the branch UI assets (`index.html`, `billing.js`, `sw.js`, and the technical catalogue) to `naprawnik-pwa-staging` only.
- Applied migrations `0002_request_limits.sql` and `0003_checkout_locks.sql` only to D1 database `naprawnik-subscriptions-v2-staging` (`c4f3dd75-cf41-48e6-bb48-67f7aff42176`). Confirmed the two tables and indexes exist; user, token, and subscription row counts were unchanged by the migrations. Live D1 was not touched.
- Set `PRODUCTION_ENABLED = "true"` and `STRIPE_EXPECT_LIVEMODE = "false"` only on the staging Worker. Configured the Stripe Test API and a new staging webhook secret as Cloudflare secrets; no secret values are stored here.
- Verified four Stripe Test recurring prices are active and in PLN: PRO 9 PLN/month and 100 PLN/year; WARSZTAT 19 PLN/month and 190 PLN/year.
- Ran a real Stripe Test-mode subscription lifecycle against a temporary staging user: `customer.subscription.created`, `invoice.paid`, and `invoice.payment_succeeded` were processed with no `last_error`; the account tier moved from `amator` to `pro`. Immediate cancellation then generated `customer.subscription.deleted`, processed successfully, and the tier returned to `amator`. Temporary user/subscription/customer-link rows were removed from staging D1; webhook audit rows were kept. The synthetic Stripe Test subscription is cancelled; a synthetic test customer remains in the Stripe Test account.
- No Stripe Live resources, Live Worker, Live D1, `main`, GitHub Pages production, or production deployment were changed.

**Remaining staging verification:** The available execution connection blocks direct HTTP reads of `workers.dev` hosts, so browser-level register → hosted Checkout → return redirect and the billing-portal button were not executed end-to-end in this session. The actual Stripe-to-Worker webhook path was verified independently as described above. `OPENAI_API_KEY` is not set on staging, so photo diagnosis intentionally fails closed until an OpenAI key is configured as a staging-only secret.

**Webhook cleanup note:** Stripe Test now has a new active endpoint `we_1UUYLcJgi8iwHKRbMbchKh12` with the current secret synced to staging. The previous active Test endpoint `we_1UUIzCJgi8iwHKRb19EbXeDC` points to the same URL; the connected Stripe API tool does not expose its disable/delete operation, so it remains active and should be disabled in the Stripe Test Dashboard to avoid signature-failure retries. It is labelled as superseded. This note applies to Stripe Test only.

## Migrations and staging

1. Copy `wrangler.example.toml` to local `wrangler.toml` and substitute a verified staging-only D1 ID and test Stripe Price IDs.
2. Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with Stripe **test mode** values using `wrangler secret put`; do not store secret values in Git.
3. Verify that `ALLOWED_ORIGINS` is exactly the origin that serves the app, and that `APP_BASE_URL` plus both return URLs are HTTPS and on the same origin.
4. Migrations `0002_request_limits.sql` and `0003_checkout_locks.sql` have been applied to the verified staging database only (see the rollout notes above). Never apply them to Live as part of this PR.
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

Before production, reconcile the Live Cloudflare variables with the actual GitHub Pages origin, inspect the Live Stripe price IDs/mode without printing secrets, disable the superseded active Stripe Test webhook endpoint, configure `OPENAI_API_KEY` on staging if photo diagnosis is in scope, and run the browser-level staging `register → Checkout → return → /api/me → Billing Portal/cancel` test. The Stripe Test webhook lifecycle has already been verified. Only then plan a separately reviewed production release.

### Remote D1 inventory (read-only, 2026-10-25)

A read-only schema inventory on 2026-10-25 initially found that the live, v2-staging and separate sandbox D1 databases lacked `request_limits` and `checkout_locks`. Since that inventory, migrations `0002_request_limits.sql` and `0003_checkout_locks.sql` have been applied to `naprawnik-subscriptions-v2-staging` only and verified by a fresh schema query. The Live and separate sandbox D1 databases were not modified. The query returned no row changes during schema verification.

- `STRIPE_EXPECT_LIVEMODE` is mandatory: use `false` on staging and `true` only in a separately approved production environment. Checkout reads the selected Stripe Price and rejects a mismatch in live/test mode, active status, PLN currency, or recurring interval before acquiring a checkout lock. Signed webhook events whose `livemode` does not match this binding are rejected.
- The staging Worker now contains the branch source and the staging-only D1 migrations are present. The test subscription lifecycle webhook was verified against this version. Do not deploy this branch to Live as part of the staging work.

## Additional payment safety checks (pre-release)

- A staging Worker must set `STRIPE_EXPECT_LIVEMODE = "false"`; an explicitly approved live Worker would need `"true"`. Missing/invalid value fails closed.
- Before a new Checkout, the Worker reads the selected Stripe Price and rejects it if inactive, not PLN, not recurring at the requested month/year interval, or if its `livemode` differs from the environment. Validation occurs before checkout lock/session creation.
- Webhook events must include a `livemode` value matching the Worker environment; mismatched events are rejected before processing.
- Before creating a billing portal session, the Worker verifies the Stripe Customer's `livemode`. Older accounts may have a customer ID in `subscriptions` but no `stripe_customers` link; the Worker repairs that link only after the Customer's mode is validated.
- Billing portal creation is limited to 10 requests per account per 15 minutes. The limit uses the D1 `request_limits` table and cannot work until migration `0002_request_limits.sql` has been applied.
- The client displays a neutral “Open Stripe portal” action for an existing paid subscription. Actual upgrade/downgrade availability depends on the Stripe Billing Portal configuration and must be verified with the connected test account before claiming in-product plan switching is supported.

