# Recoverable hiding of closed unpaid top-ups — 31 October 2026

Owner requested that unusable expired orders no longer clutter the admin queue. Implemented through the existing Archive/Removed workflow, preserving invoices and financial history rather than deleting Orders.

## Behavior

- Roblox and historical Game orders in EXPIRED/CANCELLED + NOT_READY + no refund may be archived only when no order secret, linked stock or fulfillment job remains. Pending orders, paid unfinished orders, other delivery states and unresolved obligations remain ineligible.
- The existing API exposes `canArchive`; the fulfillment card therefore offers Archive instead of Cannot archive yet for an eligible closed order. Confirmation hides it from Active; Archived can restore it. The existing Removed flow still requires archive, exact invoice confirmation and recent admin reauthentication.
- No schema, endpoint/body format, authorization or provider-call changes. Archive/remove remain transactionally locked and audited. Existing completed paid-order behavior is retained; Apps archival support is unchanged.
- A verified late payment for an expired/cancelled order clears both visibility flags and reopens it as PAID / REQUIRES_REVIEW / refund REQUIRED, matching the existing late-payment financial state. It never fulfills automatically. A `payment-reopened` audit is added atomically only when previously hidden. Duplicates do not reopen normal completed paid orders or create another audit. Mismatched or pending provider results cannot reopen an order.
- ID/EN/MY archive confirmation, eligibility explanations and audit labels are updated. The locally added Operations guide now covers closed unpaid archive and late-payment reopening.

## Verification

- RED: archive policy rejected a safe expired order, and verified late payment left its archive flags set. Both reproductions failed before implementation and pass afterward. Initial fake-client setup was corrected to install before importing Prisma-dependent helpers; no application database guard was weakened.
- Focused policy/payment suite: 22 PASS / 0 FAIL / 2 prerequisite SKIP before integration configuration.
- Fresh task-owned MySQL 8.4.3, loopback port 33162, four new `cloudy_test_closed_orders_20261031_*` schemas. Data-directory/port/bind/server-UUID identity was verified before schema creation and shutdown; all 13 existing migrations applied to the main test database. No older fixtures were reset.
- Full configured suite: **320 PASS / 0 FAIL / 0 SKIP**, about 49.1 seconds. New MySQL/HTTP checks cover idempotent archive, restore without financial drift, remove/recover, active/archived list filtering, authorized customer invoice access, late-payment reopening, duplicate settlement, remaining obligations, concurrent archive/settlement, and rollback of payment/visibility changes if audit creation fails.
- Browser: **9 locale/viewport scenarios PASS** at 375×812, 810×1080, 1440×900 in ID/EN/MY. Includes Archive confirmation/cancel for a closed row and the prior guide, session denial/retry, keyboard and draft-retention checks. Every browser API response is an isolated fixture; it makes no real mutation. Real local HTTP archive/restore mutations are covered separately in the MySQL suite.
- Default Next.js 16.4.2 Turbopack production build and its TypeScript check PASS, BUILD_ID `xJZUX32-JYN9DNfe25wML`. Standalone typecheck, focused ESLint and whitespace PASS. Environment-free app snapshot is under `.cache/closed-orders-20261031/app`; database/provider configuration is synthetic and runtime external fetches are rejected. Public font asset retrieval during build is separate from test/provider traffic.
- Mutation: inverted the new archive guard only on the isolated source snapshot; the regression failed. Original bytes were restored. No mutation remains.
- Visual: the desktop ID expired-card capture shows the Archive button and no irrelevant evidence input. Captures use synthetic orders, not the attached private image. Artifacts are in `.cache/admin-operations-20261031/browser/`; TAP/target/migration/summary evidence is in `.cache/closed-orders-20261031/`.

## Handoff

Both task-owned servers are stopped; synthetic fixture files remain for inspection. No Aiven/defaultdb access, Production order mutation, real payment/provider transaction, commit, push or deployment occurred. Earlier local admin-guide/UI work is preserved. A deployment remains necessary before the feature affects the public admin application.

## Authorized release preflight

The owner subsequently requested deployment of the completed work. Target: existing `cloudy-pink-store` Vercel project, Production through Git `main`. The release allowlist contains 17 files, including only the two relevant roadmap entries. Source/build parity passes for 220 runtime, public, schema and configuration files; all 11 staged changed runtime files match the tested final build after Git line-ending normalization. Staged whitespace and high-confidence secret-pattern screening pass. Unrelated inventory, roadmap, QA and untracked work remain excluded. No migration, environment change, direct remote database access or real provider transaction is part of this release. Publication identity and smoke evidence will be recorded after deployment.
