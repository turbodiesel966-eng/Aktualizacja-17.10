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

## One-time WARSZTAT trial and ADMIN entitlement

- Migration `0007_workshop_trial.sql` adds a single-row-per-account trial table. It is additive and does not alter existing users, subscriptions, tokens, or workshop data.
- An authenticated account can request `POST /api/trial/activate`. The Worker stores the grant in D1 and fixes its expiry at 24 hours from the first activation. The unique `user_id` key and `INSERT OR IGNORE` prevent re-claiming after expiry, including concurrent activation attempts.
- The trial is included in the server-calculated entitlement and `GET /api/me`; the app displays the activation control in the WARSZTAT plan card. Clearing local app storage does not reset the trial.
- ADMIN remains a separate role in `admin_users`, not a paid plan. Server-side plan checks grant ADMIN access to PRO/WARSZTAT protected data, and the account response identifies the role so the APK can unlock the corresponding interface. The local role marker is presentation-only; every protected API still verifies the bearer token and database role.
- Migration 0007 has **not** been applied to any Cloudflare D1 database and this branch has **not** been deployed. Apply only to a verified staging database after review; never run it against Live as part of this change.
- Standard email/password signup, email verification, password reset and account linking are not implemented by this Worker. Anonymous bearer-token accounts remain the current identity model. Do not add a password flow without a configured transactional email/verification provider and a reviewed account-linking migration; otherwise it could expose accounts or orphan paid subscriptions.

## Server-side protection

- Anonymous registration: maximum 10 requests per client IP per 15-minute fixed window.
- One hosted Stripe Checkout is allowed at a time per account; an open session is reused only for the same tier and billing interval.
- Authenticated `/api/data` writes: maximum 120 requests per account per 60-second fixed window.
- The limiter stores SHA-256 hashes of limiter subjects, not raw client IP values; a Cloudflare edge rate-limiting rule is still recommended against distributed abuse.
- Data keys prefixed `pro:` or `premium:` require an active PRO/WARSZTAT subscription; `warsztat:` or `workshop:` require WARSZTAT. Reserved key namespaces such as licence, subscription, billing, entitlement, tier, plan and API token cannot be written as ordinary user data.
- All server-side protected computations and records must have explicit Worker-side entitlement checks. Client-only features in static HTML are not tamper-proof and should not be treated as a security boundary.

## Current live rollout — 2026-10-25

- Production Worker: `naprawnik-subscriptions-live`, latest deployed version `08d51ae0-b9f3-4483-a5be-94cc4425d8be` at 100% traffic.
- Confirmed bindings: `DB` is the Live D1 database `a2da4f07-f769-45f0-9ead-3bd67c385e85`; `PRODUCTION_ENABLED=true`; `STRIPE_EXPECT_LIVEMODE=true`; the allowed origin, return URLs, and all four recurring Price IDs match the GitHub Pages app. The secret values remain masked and were not read or logged.
- A read-only D1 schema inventory confirmed the tables/indexes from migrations `0001` through `0004`, including `request_limits`, `checkout_locks`, `admin_settings`, `admin_users`, `promo_codes`, and `promo_redemptions`.
- A token-lifetime defect was confirmed and fixed: a token reaching its original 365-day deadline can now renew on use only when the account has a current server-verified subscription/grace entitlement or a valid promotional entitlement. Expired tokens without active entitlement and revoked tokens remain rejected. Regression tests cover both cases.
- GitHub Actions validation and Pages deployment passed at commit `e8119ff8a1eed3506f303f58e8ce86a775670729`. The Worker was deployed separately after that commit, with the same binding IDs and secret names verified afterward.
- The Worker’s admin-only `GET /api/admin/stripe-diagnostics` checks settings and does only Stripe Price `GET` requests; it never creates Checkout sessions or makes payments. The actual `STRIPE_SECRET_KEY` value cannot be inspected through Cloudflare settings. If a checkout still displays a generic availability error, run this diagnostics action from the owner panel before changing any keys.
- The first admin bootstrap has not been claimed yet. `admin_settings`, `admin_users`, and promo tables are empty. Bootstrap should be run once from the owner’s own app session, not from a temporary audit account.
- No Checkout session, PaymentIntent, charge, or payment transaction was created in this audit. Do not use real or test payments as a diagnostic step.

### Historical staging rollout

Earlier staging records below are historical context only. Staging and Live use separate Worker/D1 resources and separate Stripe modes. Never copy a staging D1 ID, Price ID, or test key into the Live configuration.

### Migration inventory history

An earlier read-only inventory on 2026-10-25 found that the Live, v2-staging and sandbox databases lacked some request-limit and Checkout-lock tables at that time. The current Live database was checked again after subsequent changes and now contains those tables. The staging-specific notes above refer only to their stated staging resources.

## Payment safety controls in the current Worker

- `STRIPE_EXPECT_LIVEMODE` must be explicit: `false` for staging and `true` for Live. Checkout reads the selected Stripe Price and rejects inactive prices, non-PLN currency, wrong recurrence, or a mode mismatch before acquiring a Checkout lock.
- Signed webhook events whose `livemode` does not match the Worker environment are rejected before processing. Failed/unresolved paid subscription events return an error so Stripe can retry after the issue is repaired.
- Before creating a Billing Portal session, the Worker verifies the Stripe Customer’s `livemode`. Older accounts may have a customer ID in `subscriptions` but no `stripe_customers` link; the Worker repairs that link only after validating the Customer’s mode.
- Billing Portal creation is limited to 10 requests per account per 15 minutes using the D1 `request_limits` table.
- The UI directs an existing paid subscriber to Stripe Billing Portal rather than creating a second subscription. Upgrades/downgrades depend on the Stripe Billing Portal configuration and are not claimed as verified until that configuration is checked.
