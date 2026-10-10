# Cloudy Pink Store — Safe Product Deletion & Order Archiving

Approved implementation plan, 2026-10-09. Implementation is authorized; migration
or deployment against staging/production requires separate approval. Never modify
`defaultdb`. Root `AGENTS.md` and `plan.md` remain unchanged.

## 1. Summary and approved decisions

- Delete only unused Roblox/Game products with no orders, stock or reservations.
- Historical products use the existing reversible `Product.active` flag.
- Archive only Roblox/Game orders that are PAID, COMPLETED, have no refund,
  have a closed fulfillment job and no unresolved operational obligations.
- Cancelled, expired, refunded and review orders are excluded from v1.
- Every authenticated admin may archive/restore; existing ownership/contact
  restrictions remain intact. Apps automatic fulfillment is unchanged.
- Archiving changes visibility in the fulfillment workspace, never payment,
  delivery, refund, invoice, financial snapshots or provider references.
- Game production checkout and MY/PH payments remain disabled by existing gates.

## 2. Current architecture analysis

Initial inspection found branch `main`, clean working tree, Next.js 16.3.8,
Prisma 6.19.3 and MySQL. Read root instructions, roadmap and installed Next.js
Route Handlers guide before editing. The referenced Prisma Platform skill is
version 8 hosting guidance, not the installed Prisma 6/MySQL ORM API.

Catalog API/UI: `/api/admin/catalog`, `TopupAdmin`. Fulfillment API/UI:
`/api/admin/fulfillment`, per-order manual actions, `FulfillmentAdmin`.
Checkout locks Product before final pricing/availability checks and order insert.
Payments, manual actions and workers lock Order before transitions. Admin access
supports session authentication, same-origin cookie mutations, and five-minute
reauthentication. AdminAudit already stores order/action/session/time.
Completed refunds remain REQUIRES_REVIEW and are deliberately not archivable.
General order reports, invoices and revenue analytics remain archive-inclusive.

Planning did not connect to or change a database. Actual deployment topology,
remote schema, permissions and database latency must be checked during rollout.

## 3. Dependency and relationship map

| Relation | Existing rule | Implementation rule |
| --- | --- | --- |
| Product -> Order | RESTRICT | Any order, including archived/pending, blocks deletion |
| Product -> AccountStock | CASCADE | Any stock blocks deletion; replace FK with RESTRICT |
| Product -> ProductVariant | RESTRICT | Delete configuration explicitly after checks |
| ProductVariant -> RegionalPrice | CASCADE | Explicitly delete prices before variants |
| Order -> details/secret/job/audit | Order-linked history | Preserve |
| FulfillmentJob -> ProviderAttempt | RESTRICT | Preserve |
| Order -> AccountStock | Optional stock reference | Preserve |

No standalone reservation model exists. Pending orders and LOCKED stock represent
internal reservations; Username capacity confirmation is not external quota
reservation. READY, LOCKED and SOLD stock all block product deletion. Configuration
children may be removed only after checking all operational dependencies.

## 4. Database design

- Add nullable `Order.archivedAt`, default NULL for every existing order.
- Add indexes `(archivedAt, id)` and `(type, archivedAt, id)`; retain existing indexes.
- Use existing AdminAudit for archive/restore actors; no financial status enum changes.
- Add CatalogAudit: integer auto ID, productId snapshot, productName,
  productType, sessionId, action, createdAt; index `(productId, id)`.
- CatalogAudit deliberately has no Product/AdminSession FK, preserving history
  after product deletion and expired-session cleanup. No secrets/request bodies.
- Replace AccountStock's Product FK with RESTRICT in one ALTER. MySQL requires
  a distinct replacement constraint name: `AccountStock_productId_restrict_fkey`.
- No order deletion, automatic retention purge, historic data backfill or table drop.

## 5. Backend/API contracts

GET catalog adds `deletion: {allowed, reasonCodes}` computed with database-side
dependency counts; do not expose related order IDs or customer data. Mutation
checks use bounded existence probes inside the locked transaction.

`DELETE /api/admin/catalog/[id]`: exact `confirmationName` and ISO-millisecond
`expectedUpdatedAt`. Admin + CSRF + recent reauth. Lock Product, revalidate session,
compare version/name, reject any order/stock, explicitly delete prices/variants/
product, then insert CatalogAudit in the same transaction. Return `{id}`.

`PATCH /api/admin/catalog/[id]`: boolean `active`, `expectedUpdatedAt`.
Same-state calls return changed=false without another audit. Stale changes return
PRODUCT_CHANGED. Preserve variants, independent regional prices and checkout gates.
Legacy POST catalog product edits lock Product and audit active-state changes too.
Variant saves lock and reread Product; touch Product.updatedAt to invalidate stale
delete confirmations when dependent configuration changes.

`PATCH /api/admin/fulfillment/[id]/archive`: only `{archived: boolean}`.
Require Roblox/Game, PAID + COMPLETED + refund NONE, job.completedAt, no lease
token/live lease, no OrderSecret and no linked LOCKED stock. Restore clears only
archivedAt. Already-desired state returns 200 with changed=false and no duplicate
audit. Return `{id, archivedAt, changed}`.

GET fulfillment accepts `archive=active|archived|all`, default active. Preserve
type/method/status/payment/search/cursor/limit. Return archivedAt, canArchive and
archiveReasonCodes. Pending/review monitoring uses active orders independently
of archive tab. Preserve region/currency metadata and contact redaction.

Errors: 400 invalid input, 401 session, 403 CSRF/reauth/unsupported type,
404 missing target, 409 dependency/version/eligibility conflict, 503 transient or
ambiguous database result, 500 unexpected failure. All use success/errorCode and
private,no-store. Never expose raw Prisma messages.

## 6. Frontend UX

Catalog cards show Delete and Deactivate/Reactivate plus active-state label.
Delete dialog names the product, explains permanence, requires typing the exact
name and verifies admin password through existing reauth endpoint. Dependency
blocks offer deactivation. Clear removed editors only after confirmed success.
Failed/ambiguous mutations refresh state; do not optimistically report success.
Reauth errors keep the dialog available and require password entry again.

Fulfillment adds Active/Archived/All view, eligible Archive action, reasons when
ineligible, confirmation explaining invoice preservation, archive timestamp and
Restore. Reset cursor on filter changes; retain search and other filters.
Native modal dialog handles focus trapping and Escape; busy actions are disabled.
All new strings, reasons, errors and audit labels use LanguageContext ID/EN/MY.

## 7. Authorization and security

- Authenticate before reading dependencies; derive actor from server session.
- Use adminAccess(req,true,true) for permanent deletion, adminAccess(req,true)
  for other mutations; recheck expiry/reauth after acquiring resource lock.
- Do not accept actor IDs, archive timestamps, payment/refund/delivery status.
- Preserve existing fulfillment ownership and contact restrictions.
- Audit and mutation commit together; audit failure rolls back everything.
- No Telegram events, credential logging, request-body capture or new secrets.
- Keep audit snapshots when sessions expire; no new automatic retention policy.
- Rollout uses separate migration privileges; runtime needs no DDL and no added
  permission to delete financial records. Deployment permission verification is
  an operator task, not a configuration change made by this implementation.

## 8. Transactions and concurrency

Use interactive Prisma 6 transactions with ReadCommitted, maxWait=5000ms and
timeout=10000ms for new/catalog mutation paths; keep Prisma global config unchanged.
Product-first locking serializes delete/edit/checkout. Checkout winning first
creates a dependency and blocks delete. Delete winning first makes checkout fail
without creating an order/charge. FK RESTRICT provides independent protection.

Order-first locking serializes archive with manual actions/payments/workers.
Job validation follows the existing Order -> Job ordering. No external I/O in
transactions. Eligible jobs are completed and cannot be claimed or resumed by
the existing state machine. Archive/restore races are linearized by the order
lock; the last successful transition determines the final visibility.

Retry P2034 once with a new transaction and short jitter. Never reuse failed
transaction clients. P2028/P1017 can leave an uncertain response: return 503 and
refresh state before another operator action, without gateway/worker replay.
Map P2003 on deletion to dependency conflict. Log only safe code, operation,
attempt and elapsed time. Do not increase global timeouts to mask slow queries.

References: https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions
and https://www.prisma.io/docs/orm/v6/reference/error-reference .

## 9. Implementation dependency order

1. Save plan and inspect current diff.
2. Add schema/migration; verify against a disposable database.
3. Add transaction helper, product lifecycle and audit; integrate legacy edits.
4. Add archive policy/service/endpoints and listing filter.
5. Add dialogs, actions and ID/EN/MY translations.
6. Add unit, MySQL race/rollback, HTTP and upgrade tests.
7. Run validation, typecheck, lint, build, regression and browser QA.
8. Report verified changes and leave staging/production rollout for approval.

## 10. Migration/deployment checklist

- Tests refuse anything except localhost `cloudy_test_*`; providers use mocks.
- Never target defaultdb. Do not migrate cloudy_staging under implementation approval.
- Before approved rollout, verify target, MySQL version, migration history, FK
  integrity and restorable backup. Halt on orphan stock; never delete it to proceed.
- Assess ALTER/index metadata lock duration and deployment request timeout limits.
- Use migrate deploy, then generate/build; no db push, reset or destructive SQL.
- Schema must be installed before new app routes are served.
- Test old-order upgrade and representative active/archive/search query plans.
- The older regional migration test explicitly selects fields present at its
  historical schema version, avoiding new-client SELECT of archivedAt.
- Smoke-test with dedicated fixtures; verify invoice/report/webhook continuity.

## 11. Test matrix and acceptance criteria

| Scenario | Expected |
| --- | --- |
| Unused product with variants/regional prices | Atomic delete and one persistent audit |
| Paid/pending/expired/cancelled/archived order dependency | Reject, preserve all records |
| READY/LOCKED/SOLD stock dependency | Reject via service and FK |
| APPS product/order, direct forged mutation | Reject |
| Wrong name/stale version/unknown payload fields | Reject |
| Deactivate/reactivate and legacy editor | Audit real transitions, retain regional config |
| Concurrent checkout/delete and variant/delete | No orphan order/config/charge |
| Completed Gamepass/Login/Username/Game | Archive with unchanged financial snapshots |
| Pending/queued/processing/waiting/review/refund | Reject |
| Missing/open job, lease, secret or locked stock | Reject |
| Restore, duplicate archive/restore, conflicting calls | Idempotent state and accurate audit |
| Completion/claim/worker race | Never hide unfinished work |
| Audit failure | Full rollback |
| P2028/P1017/P2034, response loss | No false success, bounded safe retry |
| Auth/CSRF/expired reauth/other admin | Enforce authorization; retain contact redaction |
| Invoice valid/invalid token after archive | Unchanged accessibility/security |
| Duplicate webhook/reconciliation and mismatches | Preserve verification and one job |
| Apps automatic delivery and cleanup | No regression |
| IDR/MYR/PHP and all Roblox methods | Preserve prices, snapshots and provider gates |
| Search/filter/cursor/monitoring and reports | Preserve behavior and financial visibility |
| Legacy upgrade | NULL archive markers, unchanged records, stock RESTRICT |
| ID/EN/MY, mobile, keyboard | Translated, accessible controls |

Run prisma validate, tsc --noEmit, lint, build and unit/MySQL/HTTP/upgrade tests.
Skipped suites do not count as passing. Provider calls must be mocked and all
fixtures isolated; never test by changing a customer's order.

## 12. Risks, rollback and file inventory

Risks: migration metadata locks, database latency/pool failures, ambiguous commit
responses, archived visibility filtering, incomplete refund/review workflow and
session-based (not person-based) admin identity. Financial eligibility uses the
existing verified payment model, not independent bank settlement/dispute proof.

Rollback app only, retaining added fields/audits/indexes and stock RESTRICT. Old
app may show archived rows again but loses no financial data. Do not remove audit
history or roll the FK back to CASCADE. Permanent product deletion is recoverable
only through reviewed backup recovery, never by overwriting newer transactions.

Modify: prisma/schema.prisma; src/app/api/admin/catalog/route.ts;
src/app/api/admin/fulfillment/route.ts; src/components/TopupAdmin.tsx;
src/components/FulfillmentAdmin.tsx; src/lib/commerceTranslations.ts;
tests/regional-migration.test.mjs.

Add: this document; prisma/migrations/202610090001_admin_catalog_archive/migration.sql;
src/lib/adminMutation.ts; src/lib/catalogLifecycle.ts; src/lib/orderArchive.ts;
src/app/api/admin/catalog/[id]/route.ts;
src/app/api/admin/fulfillment/[id]/archive/route.ts;
src/components/AdminDialog.tsx (shared accessible confirmation wrapper);
tests/admin-catalog-archive.test.mjs; tests/admin-catalog-archive-http.test.mjs;
tests/admin-catalog-archive-migration.test.mjs.

Root instructions/roadmap, environment files, Midtrans, checkout, webhook and
fulfillment state machine are not part of the changes.

## 13. Remove archived invoices (2026-10-10)

Continues the uncommitted Gemini implementation on main after `fac7c1d`.
This is reversible admin visibility only: customer tokens, invoices, financial
snapshots, fulfillment jobs/details/provider attempts and existing audits survive.
Revenue analytics remain inclusive. Ordinary admin order lists now exclude
removed invoices, including the fulfillment All view. Removed is a separate view.

The single additive migration `20261010145353_add_removed_from_admin_at` adds
nullable `Order.removedFromAdminAt` and indexes `(removedFromAdminAt,id)` and
`(type,removedFromAdminAt,id)`. No backfill, DROP, FK or enum changes. Corrected
Gemini's lowercase table identifier to match the canonical `Order` table on
case-sensitive MySQL hosts. Migration lock comments are generated boilerplate.

`PATCH /api/admin/fulfillment/[id]/remove` accepts:

- Remove: `{ removed: true, confirmationInvoice: "exact complete invoice" }`.
- Restore to archive: `{ removed: false }`.

Authenticate and verify CSRF before any lookup. Removal requires five-minute
reauthentication both at the route and after acquiring Order then FulfillmentJob
locks. Compare the invoice exactly on the server; reject extra fields and invalid
IDs/types/oversized bodies. Reuse the archive obligation policy plus archivedAt:
only PAID/COMPLETED Roblox or Game, refund NONE, completed job, no lease token or
unexpired lease, no OrderSecret or locked stock. Write visibility and the `remove`
or `restore_removed` audit atomically. Same-state retries have no duplicate audit.
Recent reauth and exact confirmation are still required for removal retries.

Removed implies archived. The old archive endpoint rejects removed invoices;
restore-from-removed clears only removedFromAdminAt and retains archivedAt.
It does not requeue delivery. Inconsistent removed-without-archive rows fail closed.
All transitions serialize on the Order lock using the existing bounded mutation
transaction/retry/error handling.

The translated dialog displays the full invoice, product and final statuses,
explains retained customer access, requires exact invoice typing, and preserves
input/error state after failure. Attempt removal first; request a password only
after REAUTH_REQUIRED, using the existing reauth endpoint and unchanged limiter.
Refresh list state after every outcome, including an ambiguous network failure.

Validation uses only explicitly selected disposable localhost `cloudy_test_*`
databases and the mocked production-mode HTTP harness. Added removal policy,
MySQL concurrency/rollback/session-lock, HTTP authorization/filter/pagination/
invoice/analytics, and additive migration tests. The historical storefront HTTP
assertion now matches the already-deployed Anya heading; storefront code unchanged.
Browser QA covers removal, restoration, password errors, reauth reuse, keyboard
Escape, ID/EN/MY and a 390px mobile viewport. Staging migration, push and deployment
still require separate user approval. No protected or remote database is accessed.

Final local results: full suite 81 passed / 0 failed / 0 skipped (serial test files,
production HTTP harness, all three historical migration fixtures enabled).
Focused removal policy/MySQL suite repeated after test-helper lint cleanup:
8 passed / 0 failed / 0 skipped. Prisma validate/generate, TypeScript, production
build and git diff --check passed. ESLint: no errors; the existing StoreShell.tsx
`<img>` warning remains. Local MySQL 8.4.3 on 127.0.0.1:3306; fresh databases
`cloudy_test_remove_20261010_02`, `cloudy_test_remove_migration_20261010_02`,
`cloudy_test_remove_archive_20261010_02`, `cloudy_test_remove_regional_20261010_02`.
All eight migrations deployed cleanly to the first; history up to date. Windows
MySQL uses lower_case_table_names=1; remote case-sensitive behavior, metadata-lock
duration and backup/restore readiness still need rollout verification.

Initial full run exposed the stale storefront headline assertion (80/81);
after correcting only that assertion, the fresh full run above passed.
Prisma generation initially hit a DLL lock from the existing dev server on 3000;
the verified project dev processes were stopped and generation/build then passed.
The temporary test HTTP server was stopped after QA. No commit, push or deployment.
