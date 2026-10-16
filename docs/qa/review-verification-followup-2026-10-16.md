# Review verification follow-up — 16 October 2026

Current result: [authorized local integration verification](laragon-integration-verification-2026-10-16.md) supersedes the schema approval/environment blocker below. P1-2 FIXED/VERIFIED locally, P2-3 RESOLVED; combined 201 PASS, 0 FAIL, 3 SKIP. Cookie-loss analysis below remains applicable.

Superseded for current authorization/status by [owner exception and Laragon
preflight](login-policy-laragon-preflight-2026-10-16.md): P2-3 is now resolved by
explicit owner approval and Laragon/local tests are authorized. The preflight
found existing test schemas are outdated; schema/migration approval is still
pending. The NOT RUN/BLOCKED environment/policy statements below are historical
evidence from before that approval, not current decision requirements for P2-3.

Branch/HEAD: `feat/roblox-login-checkout-recovery` / `22402a5`. This continues the
[seven-finding fixes](review-findings-fixes-2026-10-16.md); it does not repeat the
original review. All previous local work remains intact. No application or
test source has been changed by this verification follow-up. All 166 source/test
files were byte-compared with the prior isolated build copy before refreshing it;
there were zero differences.

## P1-2 — NEEDS VERIFICATION; actual MySQL/HTTP NOT RUN

Rechecked `tests/mysql.test.mjs`, `tests/http.test.mjs` and
`tests/admin-catalog-archive.test.mjs`, their resource gates, synthetic Login
fixtures, and the Product-lock race barrier. The barrier still requires both
operations to reach the real Product lock; early validation failure cannot count
as successful concurrency evidence. The quote is prepared before contention.

Environment discovery emitted only availability/classification flags:

- `TEST_DATABASE_URL`: absent.
- `TEST_BASE_URL`: absent.
- `TEST_MIGRATION_DATABASE_URL`: absent.
- No matching MySQL/MariaDB Windows service was returned, and no listener was
  found on known local MySQL ports 3306/33307 or HTTP harness port 3112 at preflight.
- Port 3144 was also initially unused; this task started only the existing
  secret-free browser-fixture server there. It does not supply the MySQL/HTTP
  integration environment expected by the skipped tests.
- No `.env` or secret value was opened or printed. No DB connection was attempted,
  no database was created, and no staging/defaultdb access occurred.

No suitable already-configured and authorized disposable environment was found.
The actual integration bodies remain **NOT RUN**. They write fixture Orders;
migration suites also execute SQL, so neither was substituted with staging or
invoked by overriding the resource/isolation gates. The current no-Order and
no-migration boundaries remain in force.

Alternative evidence obtained without a database: **72 PASS / 0 FAIL / 3 SKIP**
across the three P1-2 files plus checkout-attempt, Login-access, cleanup, and
payment-recovery suites. These exercise actual domain/handlers with fake
transactions/providers: cookie/Origin authorization, lost-response recovery,
idempotency/fencing, secret validation/redaction and access denials, atomic cleanup,
late settlement and HTTP 202 handling. This is not proof of real SQL row locks,
foreign keys, transaction isolation, or a running HTTP service backed by MySQL.

The full regression suite's nine SKIP entries remain the three MySQL groups,
three database-backed HTTP groups, and three migration groups listed in the
previous QA report. **NOT RUN/SKIP are not PASS.**

## Intermittent cookie-loss investigation

Used the unchanged production build and existing customer fixture, with temporary
diagnostic derivatives under ignored `.cache/login-qa/`. Diagnostics record only
fixture path, phase, error category and counts; no headers, cookie values,
credentials, contacts or request bodies are emitted.

1. **30 sequential cookie-loss repetitions: 30 PASS / 0 FAIL / 0 SKIP.** Every
   iteration creates and closes its own BrowserContext and local session/attempt
   Maps. The scenario reaches account navigation, clears the HttpOnly checkout
   cookie, reloads the picker and expects the blocked state. Additional assertions
   check absence of a replacement checkout cookie, exactly one original issuer,
   one existing attempt, zero confirmations, zero in-memory orders and no legacy
   fallback. Browser-context cookie inspection uses only synthetic fixture data;
   values are never logged.
2. **Controlled catalogue-header/navigation ordering: 1 PASS / 0 FAIL.** A barrier
   holds the second catalogue request before reading its headers while the test
   clears the cookie and navigates back. Releasing the request after navigation
   did not reproduce the error counter failure. An initial probe incorrectly
   awaited `requestfailed` while interception was still held and timed out;
   correcting that probe ordering is not an application fix or regression result.
3. Full existing customer sequence with sanitized diagnostics, alongside the
   separate existing admin browser suite: **43 customer PASS / 13 admin PASS,
   0 FAIL / 0 SKIP**. The cookie-loss case also passed in its full-suite position.

Inspected the session bootstrap, checkout cookie reader, in-flight bootstrap
coordination and provider-context recovery. Bootstrap shares only an in-flight
promise and clears it on completion. IndexedDB stores a public locator; it is not
a credential. The server will not reissue credentials for an existing locator or
invalid cookie. Recovery requires the authenticated cookie and Origin where
appropriate. The browser tests use new contexts and fixture Maps; no real
database/provider state is shared. These observations and passing fixtures do not
prove that the earlier intermittent failure can never recur.

The original failure remains **NOT REPRODUCED; root cause UNPROVEN**. No runtime
fix, arbitrary delay, retry, relaxed assertion, cookie reset workaround, or auth
change was introduced. No new permanent regression test was added for a guessed
cause. The bounded investigation stops after the three approaches above; further
work needs diagnostic evidence from a failing run, not speculative changes.

## P2-3 — BLOCKED

Rechecked AGENTS.md §10, plan.md's current priority and historical operational
checkpoint, and the [account-access policy decision](../plans/roblox-login-account-access.md).
The conflict remains explicit: AGENTS prohibits Roblox account secrets including
encrypted storage; the existing local Login runtime collects password/five backup
codes and permits gated admin reveal. The older product approval is retained as
historical context; it is not silently treated as current policy resolution.

An owner decision is still needed between retaining the no-account-secrets policy
with a separately reviewed transition plan, or authorizing a precisely scoped
exception with purpose/consent, operator privileges, retention/deletion/backups and
release criteria. Neither choice was implemented or approved in this task.
GAMEPASS, GIFT_USERNAME and LOGIN remain intact. Account-access collection,
encryption, reveal, authorization, reauthentication and audits are unchanged.

## Final verification

| Check | Result | Boundary |
| --- | --- | --- |
| P1-2 alternative domain/handler verification | 72 PASS / 0 FAIL / 3 SKIP | In-memory DB/provider doubles; actual integration NOT RUN |
| `npm test` | 152 PASS / 0 FAIL / 9 SKIP | No database/migration prerequisites supplied |
| Cookie-loss repetitions | 30 PASS / 0 FAIL / 0 SKIP | Existing scenario plus synthetic cookie/attempt assertions |
| Controlled request-order probe | 1 PASS / 0 FAIL | Diagnostic probe only, not an application fix |
| Full customer diagnostic browser sequence | 43 PASS / 0 FAIL / 0 SKIP | Existing fixture assertions unchanged; diagnostic derivative |
| Admin browser | 13 PASS / 0 FAIL / 0 SKIP | Separate browser contexts; synthetic API responses |
| `npx tsc --noEmit` | PASS | Separate command |
| `npm run lint` | PASS, 0 errors / 3 existing warnings | StoreShell image and two staging unused variables |
| `npm run build` including `prisma generate` | PASS | Isolated source copy; existing inferred-root/multiple-lockfile and generated-CSS warnings remain |
| `git diff --check` and cached check | PASS | Nothing staged; final documentation checked |

Browser results are reported separately; repetitions and probes are not added to
the unique unit/regression count. Runtime configuration uses the existing OS
allowlist wrapper and closed localhost database port. No dependency installation,
migration, real Order, charge/provider call, Vercel environment edit or release
operation was performed.

## Additional changes and handoff

Only documentation is proposed for this follow-up: this report, an annotation in
the earlier review-fix QA, and the plan handoff/current priority. Ignored diagnostic
scripts/results are investigation artifacts and are not proposed commit files.
Application and test behavior remains unchanged.

The patch can be retained as a **local review checkpoint**, with its unresolved
statuses explicitly recorded. It does not have complete integration/security
policy sign-off for merge or release. Before a future authorized commit, audit
explicit file selection because earlier unrelated/local owner work remains in
the tree. No commit/push/merge/deploy was performed.
