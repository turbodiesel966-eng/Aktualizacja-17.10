# NAPRAWNIK — Cloudflare subscriptions Worker

This source is a source-controlled mirror of the deployed `naprawnik-subscriptions-live` Worker plus pre-release changes. It has **not** been deployed by this branch.

## Read-only audit findings

- The deployed Worker source overwrote `PRODUCTION_ENABLED` with `true` on every request, despite its Cloudflare variable being `false`.
- The live Worker configuration returned a staging hostname for `ALLOWED_ORIGINS`, `APP_BASE_URL`, `CHECKOUT_SUCCESS_URL` and `CHECKOUT_CANCEL_URL`, rather than the GitHub Pages app origin.
- The deployed D1 schemas did not have a persistent request-limiter table.
- Stripe webhook signature verification and event-idempotency handling are already present in the deployed source; this branch keeps those mechanisms.

The source mirror no longer overrides environment variables in code. Worker requests fail closed when `PRODUCTION_ENABLED` is not exactly `true`. No Cloudflare variables, secrets, D1 data, deployed versions or Stripe settings were changed.

## Migrations and staging

1. Copy `wrangler.example.toml` to local `wrangler.toml` and substitute a verified staging-only D1 ID and test Stripe Price IDs.
2. Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with Stripe **test mode** values using `wrangler secret put`; do not store secret values in Git.
3. Verify that `ALLOWED_ORIGINS` is exactly the origin that serves the app, and that `APP_BASE_URL` plus both return URLs are HTTPS and on the same origin.
4. Apply migrations only to the staging DB after confirming the Wrangler environment and database ID. The migration for `request_limits` has not been applied remotely by this branch.
5. Keep `PRODUCTION_ENABLED = false` until configuration and tests pass. Any staging deployment must be a deliberate separate action.

Suggested local checks:

```sh
node --check workers/subscriptions/src/index.mjs
node --test workers/subscriptions/security.test.mjs
```

## Server-side protection

- Anonymous registration: maximum 10 requests per client IP per 15-minute fixed window.
- Authenticated `/api/data` writes: maximum 120 requests per account per 60-second fixed window.
- The limiter stores SHA-256 hashes of limiter subjects, not raw client IP values; a Cloudflare edge rate-limiting rule is still recommended against distributed abuse.
- Data keys prefixed `pro:` or `premium:` require an active PRO/WARSZTAT subscription; `warsztat:` or `workshop:` require WARSZTAT. Reserved key namespaces such as licence, subscription, billing, entitlement, tier, plan and API token cannot be written as ordinary user data.
- All server-side protected computations and records must have explicit Worker-side entitlement checks. Client-only features in static HTML are not tamper-proof and should not be treated as a security boundary.

## Production blockers

Before production, reconcile the Cloudflare variables with the actual app origin, inspect the live Stripe price IDs/mode without printing secret values, apply migrations to staging, test the real staging checkout and webhook cycle, and only then plan a separately reviewed production release.