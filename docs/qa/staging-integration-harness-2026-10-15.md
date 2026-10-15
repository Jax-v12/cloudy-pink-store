# Aiven staging integration harness — 15 October 2026

Latest status: **strict TLS VERIFIED; 23 distinct staging integration scenarios PASS across the full and targeted runs; 1 SKIP**. See the authorized execution checkpoint below for failures, repairs and cleanup evidence. The initial preparation sections describe the earlier read-only task, before the owner supplied the public CA and explicitly authorized fixture execution. No production access, migration rerun, provider call, commit, push or deployment occurred. Existing work and the private logical backup were preserved.

## Entry points and trust boundaries

- `tests/staging/run.mjs preflight` is the default, read-only mode. It loads only connection configuration internally, selects `cloudy_staging` in memory, verifies the expected Aiven service, requires strict TLS, and checks database identity/history/schema prerequisites. No credential or connection string is printed or saved.
- `tests/staging/run.mjs run --run-id=<new UUIDv4> --allow-fixture-writes=cloudy_staging:<same UUIDv4>` is prepared for a separately approved run. The matching run-specific approval is required before loading configuration or creating a client. **This command was not run.** An environment flag or previous migration approval is not human authorization to execute it.
- `tests/register.mjs`, the localhost tests, and `src/lib/prisma.ts` remain unchanged. The staging loader is separate and refuses startup without approval. The worker receives an OS environment allowlist, an explicit staging URL and synthetic ephemeral test keys; application/payment/notification secrets are excluded. Any ORM-populated environment values are removed before importing application code.
- The database boundary forwards to the actual PrismaClient/interactive transaction client. It restricts delegates, fields, identities, bulk operations and parameterized lock queries. It blocks unsafe/raw writes, unscoped selectors, foreign relations, arbitrary counters and Order deletion. It does not emulate MySQL storage, locks, unique constraints, commits or rollbacks.
- Actual backend checkout/claim/recovery/session/crypto/invoice code is imported. Session bootstrap and invoice Route Handlers execute in-process with synthetic Request objects. No HTTP server/browser is started. Only the Roblox fetch boundary returns deterministic synthetic identities/gamepass data; every other fetch, including payment, fails and is recorded as a test failure. These tests cannot prove live Roblox/Midtrans, ingress GeoIP or browser integration.

## Read-only finding: Prisma TLS

The target identity was reconfirmed as `cloudy_staging`, MySQL 8.4.8. The existing Prisma connection returned an empty session `Ssl_cipher`: the existing `ssl-mode=REQUIRED` URL parameter does not enable TLS in this Prisma engine. An explicit strict-TLS read-only probe failed certificate validation. No insecure fallback was added.

The behavior is supported by the [MySQL URL parser at the installed engine commit](https://github.com/prisma/prisma-engines/blob/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/quaint/src/connector/mysql/url.rs): `sslaccept=strict` enables TLS and certificate checking; unrecognized parameters such as `ssl-mode` are discarded. The harness maps to strict TLS in memory and checks that `Ssl_cipher` is nonempty after connection. `.env` and application configuration were not changed.

A trusted **public Aiven CA certificate** is needed to complete secure preflight. If already stored locally, provide its path as the process-only `STAGING_CA_CERT`; the harness passes it as `sslcert` without printing certificate contents. No private key, dashboard login or API token is needed by the harness. Until this succeeds, the target identity is verified but the secure harness connection is **BLOCKED**. Earlier migration/schema results remain historical evidence; migrations were not rerun.

## Prepared coverage

The integration file contains **23 approval-gated scenarios**, all SKIP in this task:

1. Concurrent bootstrap elects one committed cookie writer.
2. READY attempt/tab joining preserves its original checkoutKey.
3. Pre-confirmation package change advances the version fence.
4. Cookie ownership and cross-session attempt denial.
5. Malformed, unknown, expired and revoked cookie denial.
6. Missing authorization and cross-Origin mutation denial.
7. Atomic Order/detail/COMMITTED and encrypted WhatsApp; safe DTO fields.
8. Concurrent double-submit produces one order.
9. Explicit repeat after a committed purchase creates a distinct intent.
10. Real MySQL session-hash and checkout-key uniqueness.
11. Injected failure immediately before COMMITTED causes real SQL rollback of Order/detail.
12. Injected lost acknowledgement after a real SQL commit recovers the same invoice.
13. UNKNOWN while recipient verification is held, followed by a late real commit.
14. Expired lease establishes absence under locks and fences the original claimant.
15. CANCELLED/EXPIRED cannot revive; explicit predecessor acknowledgement permits a new intent.
16. Attempt expiry and the absolute session lifetime.
17. Changed price rejects the old quote and requires explicit reconfirmation.
18. Persisted ID/MY/PH amounts, missing/inactive regional price denial, MY/PH payment gates.
19. Distinct GAMEPASS/GIFT_USERNAME details and authoritative totals.
20. Legacy replay/header-token compatibility using newly created synthetic legacy-shaped rows.
21. Committed-owner invoice DTO and unauthorized invoice denial without contact/credential exposure.
22. Real MySQL deadlock from opposing locks on two fixture Products; no Order side effect.
23. Real fixture Session lock contention/transaction timeout cannot report a successful Order.

An additional test is explicitly **SKIP** because the current quote token has no independent expiry field. Quote price drift, attempt expiry and session expiry are covered separately. This is a coverage/contract limitation, not proof of quote expiry and not a reason to weaken an assertion or change checkout architecture in this task.

Fault injection only interrupts before the final metadata write or discards the acknowledgement after the actual transaction returns. It does not simulate database persistence. Deterministic barriers have bounded waits; no server restart, connection kill, global lock/setting, schema mutation or load test is used. Remote transaction behavior remains unverified until an authorized execution.

## Fixture operations requiring separate approval

All records belong to `stg-it-<run UUID without hyphens>`. Email uses `<run>@staging.invalid`, username is generated from the run, and WhatsApp uses a fictional reserved number. Runtime cookies/keys never enter the journal or reporter. Catalog fixture activation is temporary and may be visible in the staging storefront during an approved run.

| Table | Proposed operations | Scope/cleanup |
| --- | --- | --- |
| Product | INSERT at most 2; UPDATE active | Exact newly created IDs plus run slug; deactivate, retain |
| ProductVariant | INSERT at most 4; UPDATE price/active/capacity time | Owned product/variant IDs; deactivate, retain |
| RegionalPrice | INSERT at most 3 distinct variant/region pairs; UPDATE amount/active | Only owned variants; retain with inactive catalog |
| CheckoutSession | INSERT at most 32 successfully tracked fixture sessions, plus intentional rejected uniqueness insert; UPDATE expiry/revocation/createdAt | DELETE only successfully created IDs with run-generated hashes |
| CheckoutAttempt | INSERT at most 40, plus intentional rejected uniqueness insert; UPDATE state/version/digest/lease/expiry/order link/snapshot | DELETE only owned IDs constrained by created fixture session and product |
| Order | INSERT synthetic unpaid orders through canonical checkout, at most 16 tracked IDs including rolled-back allocations; UPDATE CANCELLED/archive/removal timestamps | IDs + fixture product IDs + exact synthetic email, inside a transaction; **never DELETE** |
| RobloxOrderDetail | Nested INSERT in the canonical checkout transaction | Only synthetic Order IDs; encrypted Login WhatsApp; retained with archived Orders |
| RateLimit | Scoped UPSERT; DELETE for cleanup, at most 64 IDs | Only deterministic IDs from run-specific synthetic IPv6/locators/sessions; reject collisions with pre-existing counters |

No other tables may be mutated. No AccountStock, financial/provider status, fulfillment job, admin session or global rate-limit cleanup is allowed. ID/MY/PH are domain test inputs, not overrides to a real ingress or production country decision.

Cleanup uses one real transaction. Successful fixture Orders are cancelled and archived; catalog records are deactivated. Fixture attempts/sessions/counters are deleted by exact IDs with ownership predicates. Retaining synthetic financial history deliberately avoids hard-deleting Orders. Before/after server-side hashes of original Order rows check preservation without returning customer fields to the process/output.

`.cache/staging-runs/<UUID>.json` journals non-secret created record IDs only after approval; it is ignored by Git. An interrupted process may leave fixture rows. A namespace collision blocks rerunning that ID. There is no automatic crash cleanup or broad fallback: inspect the exact journal and obtain permission for any later recovery/cleanup. The journal contains no cookie, token, phone, email, URL or customer payload.

## Local verification and review

- TDD RED: the new focused test initially failed because the policy module did not exist. GREEN: **16 PASS, 0 FAIL** for target/permission/TLS/env isolation, scoped selectors, relation/Order-deletion/bulk-create rejection, fixture budgets, exact counters, real clientKey normalization, forwarding transactions/locks, reporter redaction and denied execution before config loading.
- Final isolated targeted run: **16 PASS, 0 FAIL, 24 SKIP** (23 permission-gated integration scenarios + one unsupported independent quote-expiry scenario). The local forwarding doubles test only the harness safety boundary; they are not MySQL integration evidence.
- Mutation review: changing OR scope validation from every branch to any branch caused the focused security test to fail; original policy bytes were restored. No database or application mutation was involved.
- Syntax checks: **PASS**, seven `.mjs` files. TypeScript `tsc --noEmit`: **PASS**. Targeted ESLint: **PASS**, no warnings. Staging preflight: **BLOCKED**, sanitized `STAGING_TLS_CERTIFICATE_UNTRUSTED`. No full suite/build/browser rerun because no application source changed.
- Security/code review: no changes to existing guards, public API, auth, schema, migrations or dependencies. Scoped cleanup and environment/log isolation reviewed. The shared skill reference `.agents/references/security-checklist.md` is not installed; the installed security skill's controls and repository invariants were reviewed directly.
- Skills used: ponytail, test-driven-development, security-and-hardening, debugging-and-error-recovery (TLS diagnosis), code-review-and-quality.

Preparation checkpoint's pending decision was the public CA path and explicit fixture approval. Both were supplied for the execution below. This document alone grants no authority for additional runs. Actual restore remains untested, and the previously recorded payment crash-before-charge limitation is outside this harness task.

## Authorized execution — 15 October 2026

The owner supplied `docs/ca.pem` and authorized the prepared synthetic fixture suite if strict TLS/preflight passed. The certificate was verified as a single current CA with valid self-signature and no private key. Prisma strict TLS with that CA successfully validated the service endpoint's certificate/hostname and established an encrypted connection to `cloudy_staging`. Both preflight and final postflight reported MySQL 8.4.8, 10 matching successful migrations and zero pending migrations. No migration command ran. The CA remains ignored by Git and is not staged/tracked; no certificate content or connection value was printed. `STAGING_CA_CERT` was process-only; `.env` and application configuration remain unchanged.

### Failures and focused fixes

- Initial worker startup failed before fixture initialization: Node on Windows treated filesystem paths passed to ESM preload/reporter flags as unsupported URL schemes. A no-database subprocess reproduced `ERR_UNSUPPORTED_ESM_URL_SCHEME`; a RED/GREEN smoke regression now exercises the actual staging loader/reporter using file URLs.
- Full run `4ebdedcd-c310-4d86-89f3-0851e522c6b4`: **21 scenario PASS, 1 FAIL, 1 CANCELLED, 1 SKIP**, with an additional failed cleanup hook. The final Node summary therefore counted **25 events: 21 PASS, 2 FAIL, 1 CANCELLED, 1 SKIP**. These failures were not counted as successful integration evidence.
- Package switching failed because the harness field allowlist rejected the application's legitimate `CheckoutAttempt.variantId` update. A local RED test reproduced `STAGING_DATA_REJECTED`; the guard now permits only owned fixture variants. Foreign variant updates still fail. No checkout implementation was changed.
- The contention test waited for Prisma to return while holding its competing fixture Session lock. Read-only inspection established MySQL's existing `innodb_lock_wait_timeout` is 120 seconds; this exceeded the test's 40-second deadline and also obstructed automatic cleanup. The test now observes the real Session lock query and releases its fixture lock after the actual Prisma transaction deadline plus 1 second, with a separate 20-second safety release. It still requires real `CHECKOUT_UNKNOWN`, no Order and locked recovery to NOT_COMMITTED. Application/database timeout settings were not changed.
- After the first worker exited, recovery cleanup validated the exact run journal, Product namespace, relation ownership and synthetic email before using the guarded client/transaction. Follow-up reads verified zero remaining fixture sessions/attempts/counters/active Products, with 12 synthetic Orders CANCELLED and archived. Original Order digests matched the private pre-migration backup manifest before and after this cleanup.
- Targeted run `8478692d-de7f-40a5-822c-0b88370cbe85` reran **only the two affected scenarios: 2 PASS, 0 FAIL, 0 CANCELLED, 0 SKIP**, exit 0. Automatic cleanup completed successfully. The runner now accepts up to four bounded literal `--case=<scenario name>` selectors for such retries; arbitrary regex syntax is rejected. The reporter includes allowlisted error codes without assertion values, and preserves legitimate underscore-containing scenario names.

### Final evidence

| Check | Result |
| --- | --- |
| Distinct remote integration scenarios | **23 PASS**, comprising 21 full-run passes plus 2 focused retry passes; no unresolved scenario failures |
| Independent quote expiry | **1 SKIP**: the existing quote contract has no independent expiry; no assertion or production behavior was weakened |
| Local harness safety/regression tests | **19 PASS, 0 FAIL, 0 SKIP**, including Windows launch, owned variant updates/foreign denial and lock instrumentation |
| Final local checks | **PASS**: syntax on seven files, project TypeScript, targeted ESLint without warnings, tracked/staged diff checks and scoped whitespace audit; no full suite/build/browser repeat |
| First run cleanup | **PASS after scoped recovery**: 0 sessions, 0 attempts, 0 counters; 2 Products and 4 variants inactive; 12 synthetic Orders archived |
| Targeted run cleanup | **PASS automatically**: 0 sessions, 0 attempts, 0 counters; 1 Product and 4 variants inactive; no Orders created |
| Original Order integrity | **PASS**: all 5 original Orders match the pre-migration manifest's full-row digests after excluding both fixture namespaces |
| Payment/provider effects | **0** provider references and **0** fulfillment jobs on either run's synthetic Orders; Roblox identity/gamepass responses were in-process fixtures, every other fetch blocked |
| Final target/history | **VERIFIED** `cloudy_staging`, encrypted strict TLS, MySQL 8.4.8; 10 successful/checksum-matching migrations, 0 pending |

The full remote suite was not repeated after the narrow harness fixes. This is cumulative scenario evidence across the original and focused runs, not a claim that a new full run passed. Retained inactive catalog/price fixtures and archived synthetic financial rows are intentional; no Order was hard-deleted. Non-secret journals and cleanup/postflight evidence remain in ignored `.cache/staging-runs/`.

Remaining limitations: actual backup restore, live providers, real browser/ingress integration and independent quote expiry are not proven. Strict TLS is enforced for this harness; the application's existing environment was deliberately not changed and its TLS configuration still needs a separately scoped release review. The existing payment crash-before-charge gap remains outside this task. Skills used: ponytail, test-driven-development, security-and-hardening, debugging-and-error-recovery, code-review-and-quality.
