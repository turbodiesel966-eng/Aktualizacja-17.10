# NAPRAWNIK MARKET — WebePartners (staging)

## Deployment status — 2026-11-13
- Worker: `naprawnik-market-staging`
- D1: `naprawnik-market-staging`, oddzielna od płatności.
- WebePartners API key stored as Cloudflare secret `WEBEPARTNERS_API_KEY`; publisher login stored as `WEBEPARTNERS_LOGIN`.
- Cron: `0 */6 * * *` (every six hours).
- Sync rotates one approved feed per run using D1 table `market_sync_state`.
- Imported rows: Motolak 14,054; TOOLES.PL 4,553; gadzetyrajdowe.pl 3,242 (21,849 total).
- TopBuy.eu is excluded from feed discovery/rotation after repeated Worker 1102 resource-limit failure.
- eTOMNAR has no confirmed accepted XML feed in the current API discovery response.

## Public API
- `GET /health`
- `GET /products?q=&category=&limit=&cursor=`
- `GET /categories`
Public product and category endpoints apply a workshop/motorcycle relevance filter. Affiliate destinations are copied from WebePartners feed records and use tracking URLs.

## APK-only wiring
`affiliate/market-ui.js` is included by `scripts/prepare-mobile.mjs` in the generated Android web assets. The production PWA source and production subscription/payment Worker are not changed. This PR remains unmerged; do not merge or deploy the GitHub production branch as part of this staging operation.

## Operational constraints
- Do not run all feeds in one invocation; CPU limits can be exceeded.
- One feed is synchronized per scheduled execution.
- TopBuy needs a separate investigation/streaming parser before it can re-enter rotation.
- No fabricated links, prices, stock or product details.
