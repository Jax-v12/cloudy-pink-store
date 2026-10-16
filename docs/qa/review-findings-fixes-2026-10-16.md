# Seven review findings — local fixes, 16 October 2026

Latest result: [authorized local integration verification](laragon-integration-verification-2026-10-16.md). P1-2 is now FIXED/VERIFIED locally; P2-3 is RESOLVED by owner exception. Seven findings fixed/resolved locally. Counts and unresolved labels below are historical checkpoints.

Latest owner decision: [Via Login exception and Laragon preflight](login-policy-laragon-preflight-2026-10-16.md).
P2-3's policy conflict is now resolved by explicit approval; the BLOCKED count
below describes this earlier checkpoint. P1-2 remains NEEDS VERIFICATION because
the existing local test schemas need separately authorized additive SQL updates.

Branch: `feat/roblox-login-checkout-recovery`. HEAD/baseline: `22402a5`.
The existing staged/unstaged/untracked work was inspected and preserved. Nothing
was staged, committed, pushed, merged or deployed. This report covers the seven
findings supplied in the execution request and the scoped verification of their
fixes; it is not a new repository-wide review.

**Result: 5 FIXED locally, 1 BLOCKED, 1 NEEDS VERIFICATION.** All six safe code/test
changes are implemented. P1-2 remains unverified against actual MySQL/HTTP. P2-3's
documentation is reconciled, but its underlying security-policy decision remains
blocked. Passing synthetic tests do not resolve either limitation.

Continuation: [verification follow-up](review-verification-followup-2026-10-16.md)
rechecks environment availability, repeats cookie-loss locally, and records the
latest regression results without changing account-access. P1-2 actual MySQL/HTTP
remains NOT RUN and P2-3 remains BLOCKED; do not infer completion from earlier
passing mock/browser results.

## Findings

| Finding | Root cause | Fix | Tests/evidence | Status |
| --- | --- | --- | --- | --- |
| P1-1 expired-order cleanup | Expiry deletion changed any non-completed fulfillment to review; monitoring counted unpaid/refund-completed review rows | Keep the Order lock, condition the transition on paid active unfinished fulfillment with no refund, audit deletion atomically, count actual deletions; reviewCount requires paid active work and excludes completed refunds | Cleanup matrix: PENDING/PAID/EXPIRED/CANCELLED/COMPLETED, repeat, renewal, completion race, audit rollback; actual GET handler with fake DB and empty cookie jar checks reviewCount and anonymous denial | FIXED locally |
| P1-2 outdated integration tests | Login fixtures omit required fields, assume no encrypted secret and permanent reveal 410; catalog race could pass after early validation rejection | Shared synthetic Login fixture, current denial/reauth/owner/reveal/redaction assertions, existing-secret retention fixtures, actual SSR heading, official quote prepared before a two-party Product-lock barrier | Safe assigned-file tests: 3 PASS / 3 SKIP; broader focused domain/attempt/Roblox run: 45 PASS / 3 SKIP. Actual SQL/HTTP assertions are not run | NEEDS VERIFICATION |
| P2-1 checkout cleanup | No lifecycle cleanup for session/attempt rows | Existing cleanup cron path processes at most 20 expired eligible sessions, at most 100 attempts per session; lock Session, recheck DB time/expiry/leases, delete children before empty parent. Live sessions, active attempts/leases and all committed/order-linked authorization tombstones remain | Batched/idempotent cleanup, live invoice/lease preservation, post-lock expiry/lease changes, cron integration, historical Order preservation, post-GC legacy-replay denial | FIXED locally |
| P2-2 Indonesia default / username check | Empty phone-country default; Login had no public lookup control | Default ID/+62; controlled lookup through existing public endpoint with name/display name/avatar/User ID, timeout, loading, not-found, throttle/network failure, abort and stale-result fencing; ID/EN/MY copy | Actual browser/IndexedDB with isolated API fixtures: default/flags, all response states, avatar decode, username-change race, all three locales and viewports, keyboard operation, no early confirmation | FIXED locally |
| P2-3 contradictory documentation | AGENTS prohibits Roblox secrets while existing runtime and prior product checkpoint collect/reveal them | Separate current normative policy from observed/historical implementation; preserve all three methods and all access gates; mark policy reconciliation BLOCKED consistently | Documentation/source inspection, linked files and byte-size/whitespace checks. No collection/reveal implementation change | BLOCKED |
| P3-1 TLS temp directory | Every TLS URL normalization created another private directory | Cache one private temp directory across process/module reloads; immutable public-CA hash filenames reuse identical material and preserve rotations. Revalidate source, expiry and cached content on each call; strict TLS unchanged | 10 TLS PASS; source-edit/expiry/rotation/tamper regressions and cache-integrity mutation caught. Final build has no new tracing warnings | FIXED locally |
| P3-2 WhatsApp retention | Payment failure deleted OrderSecret but retained encrypted contact; old terminal orders had no backfill | Clear Login WhatsApp in the same failure/expiry transaction; existing cron backfills at most 100 EXPIRED/CANCELLED contacts under their exact Order locks, rechecking terminal status | Payment failure/cancellation, rollback, repeated cleanup, paid/pending preservation and late settlement/refund-review tests | FIXED locally |

## Verification on the final code

All commands used the existing reviewed `.cache/login-qa/run.cjs` environment
allowlist: synthetic configuration, a closed localhost DB port, no TEST_DATABASE_URL
or TEST_BASE_URL, and no provider/notification credentials. Build/browser use the
existing secret-free source copy under `.cache/login-qa/app`; the copy excludes
environment files. Prisma generation compiles the client only; it does not connect
or apply migrations. No dependency installation was performed.

| Check | Result | Limits |
| --- | --- | --- |
| Cleanup targeted suite | 19 PASS / 0 FAIL / 0 SKIP | Query-aware transactional fake with exact parent table/id lock assertions; not MySQL locking proof |
| TLS targeted suite | 10 PASS / 0 FAIL / 0 SKIP | Public trust roots / local temp files; no Aiven connection |
| Cleanup + attempt + payment-recovery tests | 59 PASS / 0 FAIL / 0 SKIP | Real domain/handlers with fake DB/provider; includes webhook and HTTP 202 behavior |
| `npm test` | 152 PASS / 0 FAIL / 9 SKIP (161 total) | Final local regression suite; skips below |
| `npx tsc --noEmit` | PASS | Separate command and production build both typechecked |
| `npm run lint` | PASS: 0 errors / 3 existing warnings | StoreShell img; two unused staging-test variables |
| `npm run build` including `prisma generate` | PASS | Isolated source copy, Next 16.3.8 / Prisma 6.19.3; existing inferred-root/multiple-lockfile and generated-CSS warnings remain |
| Customer browser | 43 PASS / 0 FAIL / 0 SKIP | Latest complete run: real UI/IndexedDB, isolated request fixtures; 375x812, 810x1080, 1440x900 and ID/EN/MY |
| Admin browser | 13 PASS / 0 FAIL / 0 SKIP | Final build; existing access/reauth/masking/expiry/visibility/ownership/keyboard protections preserved |
| Final-build public-lookup smoke | 1 PASS / 0 FAIL | Repeat of the customer default/lookup case, not an additional unique scenario |
| Visual inspection | PASS for the changed form/lookup | Rendered screenshots inspected at 375/810/1440; existing mobile navigation/contact positioning left intact |
| `git diff --check`, cached check | PASS | No staged files |
| Scoped fix review / mutation checks | PASS | Cleanup payment-status and TLS cache-integrity mutations fail their tests; source restored and regressions pass |

The nine SKIP entries are: commerce MySQL; catalog/archive MySQL; invoice-removal
MySQL; general authorization HTTP; catalog/archive HTTP; invoice-removal HTTP;
catalog/archive migration; invoice-removal migration; regional migration. The
required disposable localhost DB and matching HTTP service were not supplied or
used. No database was created and no migration test was executed. SKIP is not PASS.

The first complete customer browser run recorded 42 PASS / 1 FAIL at the fixture
error counter in the cookie-loss scenario. The same transient is documented in
the earlier Login QA. A focused rerun passed, and the later complete current
customer run passed 43/43 with error assertions unchanged. Sanitized fixture-route
instrumentation was temporarily added; the complete rerun did not reproduce the
failure and the instrumentation was removed. Its intermittent root cause is not
proven; this remains a test-harness limitation, not a claimed application fix.

## Review interactions and implementation limits

- Review found an unsafe intermediate GC design: deleting a committed attempt
  removed the relation used to deny legacy bearer replay. A regression first
  demonstrated that failure, then passed after keeping **all committed/order-linked
  tombstones and their parent sessions**. Those records do not grant access after
  session expiry, but remain necessary for the existing authorization contract.
  Their eventual deletion requires a separately designed durable discriminator;
  no auth/schema change was made here. This is a caught patch regression, not an
  additional preexisting production vulnerability claim.
- Expired unused attempts can still be removed from an expired session containing
  permanent committed markers or active sibling leases. Eligibility is applied
  to each attempt; protected siblings and their parent are retained. A dedicated
  mixed-sibling regression proves cleanup still makes progress in this case.
- Cleanup follows Session -> Attempt or Order -> dependent-row locking, matching
  the affected checkout/payment/fulfillment paths. No provider request was added
  inside a transaction. No historical Order/financial record is deleted.
- Pending payment recovery, original operation keys, bounded dispatch lease,
  server-confirmed settlement, duplicate/out-of-order webhook handling, stock
  transactions and late-payment refund review remain covered by synthetic tests.
- WhatsApp is retained for PENDING/PAID fulfillment; expiry/cancellation clears it.
  A later payment remains PAID + REQUIRES_REVIEW + refund REQUIRED and does not
  restore erased contact or create a delivery job. Existing notification email and
  financial history are retained.
- Gamepass and Username runtime code was not edited. Existing Roblox domain tests,
  checkout/recovery tests and browser navigation checks cover their relevant
  shared contracts. Apps fulfillment/pricing behavior was not redesigned.
- New TLS filesystem reads initially produced broad Turbopack tracing warnings.
  A temp-path-only refactor did not resolve them. The final precise argument
  annotations match Next's own runtime-file loading pattern and exclude only
  runtime-created CA files from build asset discovery; source-CA reading and
  certificate/integrity checks remain active. Final rebuild confirms both new
  warnings are gone. No compiler/lint gate was disabled.
- Cron integration is implemented through existing cleanup/fulfillment handlers.
  Deployment scheduler configuration and real MySQL lock/FK/performance behavior
  are unverified. `vercel.json` has no cron schedule; none was added or deployed.
- TLS immutable CA files remain for the process/temp lifetime so existing clients
  do not lose trust paths. Backups, temp lifecycle and remote rotation are not
  verified by these tests.
- P2-3 needs an explicit risk/security policy decision as described in the
  [account-access document](../plans/roblox-login-account-access.md). This task did
  not weaken the no-account-secrets rule or alter collection/reveal/auth controls.

## Files touched in this task

Some listed files already contained owner changes; those were retained. Other
preexisting modified/untracked files remain untouched by this task.

| Area | Files |
| --- | --- |
| Cleanup/payment/monitoring | `src/lib/fulfillmentWorker.ts`, `src/lib/stockCleaner.ts`, `src/lib/payments.ts`, `src/app/api/admin/fulfillment/route.ts` |
| TLS | `src/lib/databaseTls.ts` |
| Login UI/copy | `src/components/LoginUsernameField.tsx` (new), `src/components/LoginFlow.tsx`, `src/context/LoginDraftContext.tsx`, `src/lib/loginFlowTranslations.ts` |
| Tests | `tests/cleanup.test.mjs` (new), `tests/database-tls.test.mjs`, `tests/http.test.mjs`, `tests/mysql.test.mjs`, `tests/admin-catalog-archive.test.mjs`, `tests/login-attempt.e2e.mjs`, `tests/login-access.test.mjs` |
| Policy/design/handoff | `AGENTS.md`, `plan.md`, `docs/roblox-methods.md`, `docs/plans/roblox-login-account-access.md`, `docs/plans/roblox-login-contact-invoice-access.md`, `docs/qa/roblox-login-access-2026-10-16.md`, this report |

Temporary build copies, mutation helpers and fixture screenshots stay under
ignored `.cache/`; they are not proposed commit artifacts. No environment,
dependency/lockfile, schema, migration or deployment configuration change belongs
to this task.

## Handoff

The safe local fixes are ready for owner review as a feature-branch patch. **A full
seven-finding clean sign-off is not available:** the credential-policy decision is
BLOCKED and actual P1-2 MySQL/HTTP verification is still required. Commit/release
authorization was not requested or exercised. Before any commit, audit the exact
file selection because the working tree also contains earlier uncommitted work.

Skills used: code-review-and-quality, security-and-hardening,
test-driven-development, debugging-and-error-recovery, ponytail, and the triggered
vercel:react-best-practices checklist. Scoped test/fix review delegation followed
the TDD/review skill instructions; no separate user chat was created.
