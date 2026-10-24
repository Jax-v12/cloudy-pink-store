# Indonesia-only public market scope and readiness — 24 October 2026

Public storefront sales, quotes, Apps catalog pricing, and Apps renewals are restricted to verified Indonesia (`ID` / `IDR`), while preserving stored `MY`/`PH` regional pricing rows for admin management and historical order snapshots. All three customer journeys (`Apps Premium`, `Roblox Top-up`, `Game Top-up`) and all three Roblox methods (`GAMEPASS`, `GIFT_USERNAME`, `LOGIN`) remain intact. No schema, migration, dependency, payment provider adapter, or remote database state was modified.

## Changes

- `src/lib/requestRegion.ts`: `resolveVercelRegion` and `resolveSignedIngressRegion` now resolve `{ region: 'ID', reason: 'detected' }` only when the verified country is `'ID'`; other two-letter ISO countries (including `MY` and `PH`) return `{ region: null, reason: 'unsupported' }`. Missing or invalid ingress headers continue to fail closed with `reason: 'unverified'`.
- `src/lib/checkout.ts`: `createCheckout` enforces `resolvedRegion === 'ID'` (`!resolvedRegion` → `REGION_UNVERIFIED`, `resolvedRegion !== 'ID'` → `PAYMENT_REGION_UNAVAILABLE`) for all new purchases and renewals after idempotency replay (`existing`), before Roblox recipient lookup, product/stock locking, or order creation. Existing committed/idempotent orders remain recoverable even if the visitor's location later changes.
- `src/app/api/products/route.ts`: `APPS` catalog items expose `price: region ? p.price : null` and require `Boolean(region && methods.length)` for `checkoutEnabled`, matching `ROBLOX` region gating and preventing foreign/unverified visitors from receiving active purchase state or prices.
- `src/app/api/orders/[id]/renew/route.ts`: `GET` verifies invoice ownership (`renewalSource`) before checking `resolveRequestRegion(req).region` (unauthorized requests still return `404` without leaking invoice existence; unverified/non-ID owners receive `409 / REGION_UNVERIFIED`). `POST` forwards `resolveRequestRegion(req).region` to `createCheckout`.
- `src/lib/appsProduct.ts`, `src/components/AppsCatalog.tsx`, `src/components/AppsOrderPanel.tsx`: `AppsProduct.price` is typed as `number | null`; `parseCatalogResponse` extracts `region: 'ID' | null` from `body.location.region === 'ID'`. `AppsCatalog` renders `DetectedLocation`, disables purchase when `region !== 'ID'` or `price === null`, shows localized unavailable states, and clears `region` on `REGION_UNVERIFIED` / `PAYMENT_REGION_UNAVAILABLE` checkout responses. `AppsOrderPanel` handles `REGION_UNVERIFIED` / `PAYMENT_REGION_UNAVAILABLE` on renewal offer and confirmation.
- `src/components/StoreShell.tsx`, `src/lib/regionalTranslations.ts`: added `indonesiaOnly` banner notice and updated `locationUnavailable` copy across `ID`, `EN`, and `MY` (`LanguageContext`).
- Tests updated/added: `tests/indonesia-market.test.mjs`, `tests/indonesia-market.e2e.mjs`, `tests/region.test.mjs`, `tests/apps-checkout.test.mjs`, `tests/apps-access.test.mjs`, `tests/apps-roadmap.test.mjs`, `tests/apps-roadmap.e2e.mjs`, `tests/apps-roadmap.integration.mjs`, `tests/checkout-attempt.test.mjs`, `tests/http.test.mjs`.

## Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS (0 errors) |
| `npm run lint` | PASS (0 errors, 3 existing warnings) |
| ESLint on changed source & test files | PASS (0 errors, 1 existing `<img>` warning in `StoreShell.tsx`) |
| Full test suite (`tests/*.test.mjs`, including 9 local MySQL/HTTP/migration suites) | **283 PASS / 0 FAIL / 0 SKIP** (226 unit/regression + 57 MySQL/HTTP/migration across `mysql.test.mjs`, `admin-catalog-archive.test.mjs`, `admin-invoice-removal.test.mjs`, `http.test.mjs`, `admin-catalog-archive-http.test.mjs`, `admin-invoice-removal-http.test.mjs`, `regional-migration.test.mjs`, `admin-catalog-archive-migration.test.mjs`, `admin-invoice-removal-migration.test.mjs` against disposable `127.0.0.1:3306/cloudy_test_*`) |
| Local MySQL Apps integration (`tests/apps-roadmap.integration.mjs`) | **9 PASS / 0 FAIL** (`127.0.0.1:3306/cloudy_test_benchmark_20261019`, no provider calls) |
| Mutation check on `requestRegion.ts` (`country === 'ID'` inverted in isolated snapshot) | PASS (caught by 2 failures in `tests/region.test.mjs`; snapshot restored) |
| Isolated Next.js 16.4.2 production build (`.cache/indonesia-launch-20261024/app`) | PASS on Node `v24.22.1` |
| Browser matrix `tests/indonesia-market.e2e.mjs` (`375×812`, `810×1080`, `1440×900` × `ID`/`EN`/`MY`) | **45 PASS / 0 FAIL** (ID/MY/PH/null catalog & detail gating, Roblox method links, location drift on submit, renewal unavailable alert while preserving invoice access, zero horizontal overflow, zero page errors) |
| Browser regression `tests/apps-roadmap.e2e.mjs` (`375×812`, `810×1080`, `1440×900` × `ID`/`EN`/`MY`) | **9 PASS / 0 FAIL** (catalog error/retry, search, package detail, consent/focus, invoice acknowledgement, expiry hiding, admin Apps dialog) |
| Read-only public Production probe (`https://cloudy-pink-store.vercel.app`) | **9 HTTP 200 PASS** (`/`, `/apps`, `/roblox`, `/help`, `/privacy`, `/robots.txt`, `/sitemap.xml`, `/api/products?type=APPS`, `/api/products?type=ROBLOX`) |
| `git diff --check` | PASS |

The isolated Next production servers (`127.0.0.1:3178` and `127.0.0.1:3112`) and local `mysqld` (`127.0.0.1:3306`) started for verification were cleanly stopped after completing the suites. No remote database, Midtrans API, or customer order was created or mutated.

## Remaining boundaries

1. **Production readiness gates unchanged:** real CapCut stock and final product/claim terms, WhatsApp Business Platform/API configuration, Vercel function Node runtime patch rollout (`v24.21.0` observed previously vs `v24.22.1`), and live payment approval remain open.
