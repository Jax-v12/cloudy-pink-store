# Game Top-up purchases paused — 31 October 2026

Owner request: temporarily stop Game Top-up purchases and focus on Apps Premium and Roblox while the Game catalog is empty.

## Behavior and scope

- `src/lib/storeAvailability.ts` defines the shared code switch `GAME_TOPUP_PURCHASES_ENABLED = false`. This is a code setting requiring a rebuild/release, not an admin toggle or environment change.
- `checkoutEnabled('GAME')` now rejects new purchases in every environment, including the local simulator. Catalog and locked order creation already consume this canonical gate; direct checkout returns HTTP 409 `PRODUCT_UNAVAILABLE` without creating an order.
- `/games` and `/games/[slug]` show a localized unavailable panel with Apps Premium and Roblox links. They do not load the catalog, collect customer details or expose a checkout form while paused. The homepage Game card states availability honestly.
- Apps Premium and Roblox gates, methods, catalog data, existing invoice access, payment recovery and fulfillment remain in place. Historical Game worker tests create explicit historical fixtures instead of buying a new package through the paused checkout.
- Re-enabling the switch does not bypass the existing Production provider restriction. A real Game provider remains separate work.

## Evidence

- Red/green: three focused tests initially failed for environment policy, catalog availability and direct checkout; after implementation all four passed, including historical replay.
- Mutation: changing the switch to `true` made the focused suite fail. The original switch was restored and all four tests passed again.
- `npm test`: **254 PASS / 0 FAIL / 9 SKIP**. MySQL/HTTP integration prerequisites were not configured; skipped tests are not integration proof. The changed MySQL historical-order fixtures have not been executed against MySQL in this task.
- `npx tsc --noEmit`, `npm run lint`, final focused ESLint and relevant `git diff --check`: PASS.
- Isolated Next.js 16.4.2 production build generated BUILD_ID `FKx7z8AOxDrd873HhUeSI`; the production renderer started successfully on loopback port 3186. Source was copied without env files; its database URL points to unusable localhost port 0 with a `cloudy_test_*` name. The nested snapshot produces an expected workspace-root/lockfile warning.
- `tests/game-purchases.e2e.mjs`: **27 PASS** across ID/EN/MY and 375×812, 810×1080, 1440×900. Covers homepage status, listing/direct detail routes, no Game API requests or purchase fields, no page overflow, keyboard focus and Apps/Roblox navigation. Apps/Roblox catalogs use empty isolated responses; this is browser/UI evidence, not real catalog/provider integration.
- Screenshots: `.cache/game-purchases-20261031/browser/`. Mobile ID, tablet MY and desktop EN screenshots were visually inspected; all nine locale/viewport screenshots were captured.

## Release boundary

Local changes on `main`; existing workspace edits preserved. No stage, commit, push, deployment, remote database access, credential/environment changes or provider transactions. The switch takes effect in Production only after a separately authorized release.

## Visual follow-up — 31 October 2026

Owner requested that the storefront also reflect the removal of Game Top-up from the current offering.

- Game links are hidden from the shared public navigation while the switch is off; the homepage only shows Roblox and Apps Premium.
- Homepage service cards use two equal columns on tablet/desktop and a single column on mobile. Ordering instructions in ID/EN/MY now describe Apps Premium and all three Roblox methods.
- Direct legacy `/games` routes retain the unavailable panel and the server purchase block. Admin configuration/history and existing work are preserved.
- Browser regression first failed against the old build because two public Game links still existed. The updated `tests/game-purchases.e2e.mjs` passes **36 scenarios**, including two-card layout, absence of Game navigation/card links, active navigation and the prior direct-route/keyboard checks at all three viewport sizes and locales.
- Focused unit/security/language/recent-order regression: **25 PASS / 0 FAIL / 0 SKIP**. TypeScript, focused ESLint and relevant whitespace checks PASS. The earlier full unit suite remains 254 PASS / 0 FAIL / 9 SKIP; it was not rerun for these presentation-only edits.
- Isolated production build PASS, BUILD_ID `2OyfSaCsfO2xIxa2PsK__`. The three edited source files match the browser-tested snapshot. Homepage screenshots `home-375-ID.png`, `home-810-MY.png`, `home-1440-EN.png` were visually reviewed; all nine homepage locale/viewport screenshots were captured in the same cache directory.
- Local only; no publication, remote database/provider action or environment change.

## Scoped release preflight — 31 October 2026

Owner explicitly requested deployment to the existing Vercel project. The release is prepared from `67e8ea2` on `main` with exactly 12 allowlisted files/partial files. It excludes unrelated storage, metadata, inventory, admin, dependency and earlier QA changes; shared `StoreShell.tsx`, `TopupCatalog.tsx` and `plan.md` contain only this task's hunks in the release snapshot.

- Exact release snapshot: `.cache/game-purchases-20261031/release-app`; production build PASS, BUILD_ID `NnuBJGlLkX7Enzmi15bVB`.
- Full release-snapshot suite: **230 PASS / 0 FAIL / 9 SKIP** with an explicit unusable loopback `cloudy_test_*` database URL. The initial attempt stopped four test modules on missing local CA configuration; no connection was opened. Explicit synthetic loopback configuration resolved this harness prerequisite without changing code or TLS rules. Missing DB/HTTP prerequisites remain SKIP.
- Exact snapshot browser suite: **36 PASS** in ID/EN/MY at 375×812, 810×1080, 1440×900, using isolated catalog fixtures and no transactions.
- Build TypeScript check, allowlisted ESLint and patch whitespace validation PASS. Production audit: zero advisories. Full audit: one existing transitive development-only Zod high advisory in the unchanged lockfile; no application Zod imports. Its separately prepared local dependency fix is intentionally excluded from this focused feature release; assess it with the pending dependency release. Audits do not establish provider or operational readiness.
- Verified Vercel project `cloudy-pink-store`, project ID `prj_Oz6McF6kBIkykqRNw8cqo5ousj9m`, team `team_xR3F67Zs5jclFdfh9XhzU7dx`; primary production domain `cloudy-pink-store.vercel.app`. Prior Production was READY at `67e8ea2e6b52a02ca77873c4f732e160533be55a`.
- Scope: publish new-purchase pause and focused storefront only. No migration, environment/payment-mode change, direct remote database access or provider transaction. Publication outcome is recorded separately after the matching deployment finishes.
