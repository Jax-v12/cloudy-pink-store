# Local integration verification — 16 October 2026

This supersedes the environment blocker in the [previous preflight](login-policy-laragon-preflight-2026-10-16.md).
It continues the supplied findings; the original review was not repeated.

## Authorization and target

The owner explicitly approved the proposed local schema preparation and fixture
tests after the named-target approval question and explanation. The scope is the
existing **cloudy_test_general**, MySQL **8.4.3**, TCP **127.0.0.1:3306** only.
The three additive repository SQL files and historical assisted-Login fixture
replay were authorized. No new database, staging/defaultdb access, remote schema
change, real customer Order, external provider request, charge, environment edit,
commit, push, merge or deployment was performed.

Laragon was already launched in the preceding preflight. Its window was not
targetable; its installed MySQL executable was started bound to localhost. The
MySQL service remains available locally. The temporary HTTP harness was stopped
after testing.

## Backup and schema preparation

- Backup: ignored `.cache/login-qa/local-backup-20261016/cloudy_test_general.sql`.
  Directory ACL allows the current Windows user and SYSTEM only.
- `mysqldump --single-transaction` completed successfully; **61,099 bytes**.
  Database marker, Order table definition and completion footer verified.
- SHA-256: `8673844015231cbe8b9c63641392e39e7779210bb46690ee9b489119e92f02a7`.
- Applied only the reviewed SQL from `20261010145353_add_removed_from_admin_at`,
  `202610140001_login_whatsapp`, and `202610150001_checkout_attempts`, in that order.
  This was targeted local schema preparation, not `prisma migrate deploy` or a
  migration-history baseline. No repository schema/migration file was changed.
- Existing Order count and sum of IDs matched immediately before/after DDL.
  Prisma DMMF column comparison now reports **schemaReady=true**, no missing fields.
- Backup restore was not exercised. These checks do not establish a staging or
  production recovery procedure.

## Executed verification

Each integration file ran sequentially against the same explicitly selected test
schema. Synthetic configuration was constructed from an OS-variable allowlist;
no `.env`, real keys or connection-string values were displayed. A preload
blocked external fetches, Roblox responses were deterministic fixtures, and Game
fulfillment used the simulator. The actual HTTP server used the existing
production build from the environment-free source copy, port 3112, signed GeoIP
fixtures and its existing external-provider block. Payment states/webhooks were
synthetic; no real Midtrans call or charge occurred.

| File/check | PASS | FAIL | SKIP |
| --- | ---: | ---: | ---: |
| `tests/mysql.test.mjs` | 17 | 0 | 0 |
| `tests/admin-catalog-archive.test.mjs` | 16 | 0 | 0 |
| `tests/http.test.mjs` | 1 | 0 | 0 |
| `tests/admin-invoice-removal.test.mjs` | 8 | 0 | 0 |
| `tests/admin-catalog-archive-http.test.mjs` | 6 | 0 | 0 |
| `tests/admin-invoice-removal-http.test.mjs` | 5 | 0 | 0 |
| **Six file total** | **53** | **0** | **0** |
| `npm test`, safe default environment | 152 | 0 | 9 |
| **Combined unique executed results** | **201** | **0** | **3** |

The six-file total includes four unit tests already present in the 152 default
passes. The combined count replaces six default skipped groups with their actual
integration results and counts those four tests once. Node's parent/subtest
counting is retained; the HTTP parent test contains multiple endpoint assertions.
No skip is counted as a pass.

Remaining skips are archive, invoice-removal and regional migration suites. Each
requires an empty isolated schema and replays older migration chains. No suitable
empty target was supplied/authorized, database creation remains prohibited, and
the updated nonempty schema was not reset to satisfy them. The historical
assisted-Login SQL fixture inside `mysql.test.mjs` did execute successfully; that
is distinct from these three skipped migration suites.

## Findings and limits

- **P1-2 FIXED and VERIFIED locally.** Updated Login fixtures reach the actual
  database and HTTP assertions. Tests cover encrypted single-secret creation,
  replay, retention, permission/reauth/owner checks, response redaction and
  completion denial. Five catalog races each require both operations to reach
  the real Product lock and assert exactly one valid winner, rather than accepting
  a validation failure as concurrency evidence.
- **P2-3 RESOLVED by owner-approved policy exception**, documented in AGENTS §10
  and the account-access design. All three Roblox methods and the existing access
  implementation remain unchanged. This resolution is not authorization to deploy.
- **Seven findings: seven fixed/resolved locally.** Operational release readiness
  remains separate from resolving the supplied findings.
- Cookie-loss evidence remains the [prior investigation](review-verification-followup-2026-10-16.md):
  30 isolated repetitions, controlled catalog-header/navigation probe and full
  43-customer/13-admin fixture runs passed. The intermittent error was not
  reproduced; its root cause remains unproven. No guessed runtime fix or relaxed
  assertion was added. Browser runs are prior evidence, not new DB integration.
- Six requested skills were applied to scope, safety, existing assertions,
  diagnostic evidence and final diff checks. React hooks/abort cleanup, memory-only
  secret draft, labels/status feedback and translation boundaries were checked
  without adding UI changes. No new bug reproduced and no runtime/test fix was
  needed in this continuation.

The additional repository changes in this continuation are this report and
current-status links/authorization in the roadmap and prior QA reports. Local
backup/preflight/runner/guard helpers and logs remain ignored. Nothing was staged.

| Final check | Result |
| --- | --- |
| TypeScript `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS, 0 errors / 3 existing warnings (StoreShell img and two staging-test unused variables) |
| Isolated `npm run build`, including `prisma generate` | PASS, Next 16.3.8 / Prisma 6.19.3 |
| `git diff --check`, cached check | PASS; staged diff empty |

Build retained the existing inferred-root/multiple-lockfile and generated-CSS
warnings. No compiler error or additional runtime fix was required. The local
patch is suitable for a focused local commit with explicit file selection and
the normal staged audit; backups, test logs and machine configuration must remain
excluded. No commit was made. Release still needs independently authorized target
preflight/migration, backup/restore and scheduled retention verification, and the
three empty-schema migration suites remain unexecuted.
