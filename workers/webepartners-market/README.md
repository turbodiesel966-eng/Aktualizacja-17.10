# NAPRAWNIK MARKET — WebePartners

This is an isolated APK-only integration. It must not be wired into the production PWA, production subscription Worker, Stripe secrets, or production D1 database.

## Architecture
- Android APK / local HTML UI calls a dedicated Cloudflare Worker.
- Dedicated D1 database stores normalized catalog rows and sync history.
- Worker fetches only explicit HTTPS feed URLs copied from the publisher's WebePartners Datafeeds panel.
- Feed URLs and admin token are Worker secrets; never ship them in the APK or Git.
- Scheduled refresh runs every six hours after the staging Worker is provisioned.
- Public endpoints expose product search and categories. Admin endpoints require a bearer token.

## Initial deployment prerequisites
1. Create a NEW D1 database named `naprawnik-market-staging`; do not reuse any subscriptions database.
2. Apply `schema.sql` to that new database.
3. Create a separate Worker named `naprawnik-market-staging` with binding `DB`.
4. Set Worker secrets `MARKET_ADMIN_TOKEN` and `FEED_CONFIG`.
5. FEED_CONFIG is a JSON array of approved feeds, for example:
   `[{"program":"Program name","url":"https://exact-feed-url-from-panel","category":"narzedzia"}]`
6. Verify `GET /health`, then admin sync and product search.

## Supported category vocabulary
`czesci`, `motocykle`, `narzedzia`, `diagnostyka`, `elektronika`, `chemia-eksploatacja`, `wyposazenie-warsztatu`, `akcesoria`, `inne`.

## Feed handling
The adapter accepts common XML product/item/entry feeds and common fields such as title/name, product ID/SKU, price, brand, category, image URL and affiliate deep link. Real WebePartners feed schema must be checked against an actual feed before production use. Unrecognized XML formats must be mapped explicitly rather than silently treated as valid.

## Current known blockers
- No WebePartners API key has been generated yet.
- Exact feed URLs and schemas have not yet been supplied/verified.
- Program participation/approval is required before using each merchant's feed and links.
- No Worker or database is deployed by this source-only commit.
