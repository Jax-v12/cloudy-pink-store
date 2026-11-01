# Public sales preparation — 1 November 2026

The owner chose preparation for real sales, with activation only after all prerequisites are ready. This task updates local recovery UI and records final CapCut terms; it does not activate sales or alter existing Production availability. Branch: `main`; baseline HEAD: `ac09f90178b5834b76112f6f62ccdbc3d0b96eec`.

## Changes

- Added a branded not-found page and page error boundary using the existing StoreShell, pink palette, language provider, and navigation. New text is present in ID/EN/MY. The fallback offers home/help and, for errors, a retry. It never renders the original error message, identifiers, URLs, or customer data. Its order/payment wording directs customers to check their existing order before ordering again.
- Followed the installed Next.js **16.4.2** documentation: `error.tsx` receives **`retry`**, not the older `reset` prop. The root layout itself is outside this boundary; root-layout crashes, offline browser failures and all possible runtime faults are not claimed covered.
- Updated only local CapCut draft/inventory documentation with the owner's confirmed one-device, no-password-change/no-sharing, 7/25-day warranty, unusable-account refund, and invoice/OTP terms for the 7- and 30-day private packages. Prices/slugs remain unchanged. Account entitlement/region still need verification; no stock account was opened or created.
- Added an updated readiness plan that supersedes the earlier demo choice and distinguishes source/build, public HTTP, provider and operational evidence.

## Verification

| Check | Result and limits |
| --- | --- |
| Reproduction | Before adding the routes, the new 404 browser regression failed on the missing Indonesian recovery heading. Preserved output is in the local task cache. |
| Unit/regression suite | **258 PASS / 0 FAIL / 10 SKIP**. The skipped groups require separate disposable MySQL/HTTP/migration environments; they were not enabled or counted as passes. No real provider access. |
| Product build | **PASS**, default Turbopack Next.js 16.4.2; latest follow-up BUILD_ID `eMttVHWLMiK4vMA8toF_6` (initial recovery build `3yVxP7f58j6icGrbEPlOE`). Fresh environment-free snapshot with synthetic loopback database port 0, Production-origin test configuration and real Google font retrieval. Existing nested-lockfile root warning is informational. No environment files copied. |
| TypeScript / focused ESLint | **PASS**. Typecheck covers the product snapshot after build; ESLint covers all changed runtime files and the new browser regression. No quality gates disabled. |
| Product snapshot parity | **223 runtime/public/schema/package/config files match**; text line endings normalized, binary assets compared byte-for-byte. No API/schema/payment-mode/dependency changes. |
| Appearance regression | **54 PASS**: six views × three languages × three viewports. Images, tracking, Apps terms and Login package grid checked with intercepted API fixtures. |
| Roblox wizard regression | **54 PASS**: Gamepass, Username, Login single/multiple/unavailable/empty × three languages × three viewports. No order or provider call. |
| Metadata/help/privacy | **45 PASS**: five public pages × three languages × three viewports; sitemap/robots, metadata, support links, terms, keyboard focus, overflow and page errors. |
| Interaction regression | **20 PASS**: dropdowns, reduced motion, draft/back focus, fixture checkout failure/retry, help and recent-order dialog keyboard behavior. All mutation requests fulfilled locally by fixtures. |
| Product 404 | **9 PASS**: HTTP 404, noindex, translated recovery copy, home navigation and keyboard focus in all viewport/language combinations. |
| Real framework error boundary | **9 PASS**, plus repeat 404 matrix in a separate probe build. A fixture-only route throws a synthetic client-render error; the actual root error boundary renders, hides the internal message, and keyboard retry successfully remounts the child. Probe BUILD_ID `h2Sz8HxLcFw6QW5_ZGoLC`. The probe route exists only under `.cache/.../probe-app`, never product `src/app`, and is excluded from release. |
| Mutation check | Inverted the recovery heading condition only in JavaScript responses served to a temporary browser context. The 404 regression failed at the expected heading, proving it catches the wrong branch. Product source and build files were never mutated; the ordinary recovery matrix passed again afterward. |
| Initial recovery/UI browser matrix | **191 PASS / 0 FAIL** across the above suites, counting the 404 matrix once, not its repeat in the probe build. These precede the email-guidance follow-up below. Cases from different suites can exercise overlapping flows; this is not 191 independent integrations. |
| Visual inspection | Viewed home mobile ID, Apps tablet ID, Login desktop EN, 404 mobile ID, error mobile ID and desktop EN captures. Opaque readable panels, working focus rings, wrapping controls, no page overflow. Existing accepted mobile navigation/contact placement preserved. No Safari/Firefox/real-device/performance-audit claim. |
| CapCut draft | JSON parses; two packages preserve duration/warranty pairs 7/7 and 30/25. This is static preparation, not a catalog mutation or entitlement test. |
| Whitespace / staging | `git diff --check` and cached check pass; nothing staged. Prior local work retained. |

The first metadata-browser attempt used a prior build without a configured public origin and failed on its empty sitemap. This was a test-build configuration mismatch, not a demonstrated Production regression. A fresh build with the documented Production-origin test configuration passed all 45 scenarios; no product validation or assertion was relaxed.

## Dependency audit

- Production audit (`npm audit --omit=dev --json`): **0 findings**.
- Complete lockfile audit: **16 moderate package entries**, **0 high / 0 critical**, all flowing from the `minimatch` advisory [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). The primary advisory describes attacker-supplied pattern amplification at `optimizationLevel >= 2`; source search found no direct application import/use of minimatch. This is a tooling-dependency risk, not evidence of an exploitable storefront endpoint.
- No dependency edit or auto-fix. npm's proposed major downgrades of ESLint/Next lint config are not a reviewed remediation. A compatible patch requires its own dependency authorization and verification.
- The audit helper initially combined npm notices with JSON, causing its summary parser to fail. The completed audit JSON was parsed separately; audit results above come from that JSON, not a claimed green helper exit. The production audit subsequently completed normally.

## Public read-only evidence

Ten GET probes to `https://cloudy-pink-store.vercel.app` returned the expected status: nine HTTP 200 and one HTTP 404. The five public pages, robots, sitemap and Apps/Roblox catalog endpoints respond; HSTS/nosniff are present. Sitemap contains exactly `/`, `/apps`, `/roblox`, `/help`, `/privacy`; robots advertises it.

The public Apps response reports one visible 7-day CapCut SKU with `stockAvailable: 1` and `checkoutEnabled: true`; the 30-day SKU is absent from that response. The Roblox response reports Gamepass/Username/Login with checkout enabled. Only safe public fields were retained. No stock contents, invoice, credential, admin session, customer data, checkout submission, payment, delivery or direct DB access was used. These probes do not verify current deployment SHA, merchant mode, account entitlement, or readiness for real sales.

## Scope and release allowlist

Fourteen explicit files/parts form the proposed release packet after the follow-up email guidance fix:

```text
src/app/error.tsx
src/app/not-found.tsx
src/components/StoreRecovery.tsx
src/components/AppsCatalog.tsx
src/lib/appsTranslations.ts
src/lib/storeRecoveryTranslations.ts
src/lib/translations.ts
tests/store-recovery.e2e.mjs
tests/apps-roadmap.e2e.mjs
docs/plans/capcut-drafts-2026-10-20.json
docs/plans/apps-product-inventory-2026-10-19.md
docs/plans/public-sales-readiness-2026-11-01.md
docs/qa/public-sales-readiness-2026-11-01.md
plan.md (only the new task handoff)
```

Review existing inventory/document diffs before staging; preceding local edits must not be discarded or silently swept into an unrelated release. All cache helpers, probe routes, screenshots, build output, installed skills, machine configuration and unrelated QA/workflow files are excluded. No stage/commit/push/PR/deploy performed. Source hashes and logs stay in `.cache/launch-readiness-20261101/`.

Correctness, accessibility, simplicity, security and performance review found no remaining required issue in this local patch: no new API/data model, mutation, external integration, secret handling or heavy dependency. Browser evidence checks actual Next error retry rather than merely calling a mock callback. Provider/DB integrations and the pending operational gates are explicitly outside this local verification.

The latest [readiness plan](../plans/public-sales-readiness-2026-11-01.md) owns the remaining decisions: authorized publication, applying terms to the correct operational SKUs, valid stock and fulfillment, Midtrans merchant/channel readiness, Aiven retention/restore and controlled end-to-end payment/delivery/refund evidence. All task-owned renderers are stopped after checks.

## Follow-up: final CapCut terms and email guidance

The initial 18-scenario preview validated the actual owner-approved draft data in the existing Apps detail page: both package configurations pass `parseAppsConfig`, their device/usage/invoice-OTP/refund text and duration/warranty pairs render, consent starts unchecked, and navigation submits no order. The screenshots exposed activation-specific email guidance on a ready-account package. A focused browser check then reproduced the missing ready-account guidance before the fix.

The detail form now asks for the purchaser's email for ready-account/legacy packages and retains recipient-account activation guidance only for `ACTIVATION`. ID/EN/MY translations are supplied. The existing Apps roadmap browser regression checks both branches and verifies switching the fixture back to ready-account resets consent without a mutation. No email validation, checkout request, fulfillment or API contract changes.

Latest follow-up verification: **18 final-term preview scenarios + 9 Apps roadmap scenarios PASS**, each covering ID/EN/MY ×375/810/1440. The latter checks activation and ready-account hints, error/retry/search/detail/consent, fixture invoice acknowledgment and admin form. Unit suite **258 PASS / 0 FAIL / 10 SKIP**, build, standalone TypeScript, focused ESLint and whitespace PASS. All **223** product snapshot files match the current runtime source. Viewed final mobile ID and desktop EN CapCut captures; the email hint is readable. The preceding broad 191-scenario matrix is kept as earlier evidence, not claimed rerun after the narrow hint change. Captures still show DRAF labels for unresolved region/entitlement; they are local previews and must not be mistaken for a finalized operational catalog.

A safe-field comparison against the public catalog found the seven-day SKU still differs in `devices`, `usageRules`, `instructions` and `warrantyTerms`; the 30-day SKU is absent from the public response. No account stock, token, credential or private order was retained. The readiness plan now documents full-record admin updates with current `id`/`updatedAt`, preservation of price/active/other fields, and reconciliation of the existing 30-day record instead of automatic creation. This is a reviewable preparation, not an executed catalog update.

## Publication authorization — 1 November 2026

The owner explicitly approved commit/push of the reviewed 14-file/part packet to `main` for automatic deployment to Vercel Production `cloudy-pink-store.vercel.app`. Catalog/database/payment-mode changes remain outside this authorization. All 14 candidate hashes match the reviewed packet before documentation of this authorization; runtime sources match the passing build. Only the two new task handoff paragraphs are included from `plan.md`; the inventory's pre-existing October test-history paragraphs are also retained unstaged. Other local work is preserved. Draft verification wording distinguishes the public catalog metadata read from uninspected stock account contents and direct DB access.

Target verification: linked project `prj_Oz6McF6kBIkykqRNw8cqo5ousj9m`, team `team_xR3F67Zs5jclFdfh9XhzU7dx`, project name `cloudy-pink-store`. Existing Production alias resolves to READY baseline deployment `dpl_CTnDEzmeNAdBTyw5Me2qE8wFhDKk`, SHA `ac09f90178b5834b76112f6f62ccdbc3d0b96eec`. Local and remote `main` match that SHA before staging. The local Git remote's former owner path redirects to canonical `Jax-v12/cloudy-pink-store`, stable GitHub repository ID `1389518288`; no remote URL was changed. The release will use the existing Git integration, not create a duplicate deployment or project. Actual publication requires matching new commit SHA, READY state, Production alias and read-only smoke evidence.
