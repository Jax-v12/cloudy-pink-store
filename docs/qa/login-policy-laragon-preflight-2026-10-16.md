# Owner Login exception and Laragon preflight — 16 October 2026

Superseded by [authorized local integration verification](laragon-integration-verification-2026-10-16.md): owner approved the named local schema work; backup and additive SQL completed; all six MySQL/HTTP groups PASS. P1-2 FIXED/VERIFIED locally. Pending-approval statements below describe the preceding checkpoint.

Branch/HEAD: `feat/roblox-login-checkout-recovery` / `22402a5`.
This continues the existing review fixes; no new repository-wide review occurred.

## P2-3 — RESOLVED by explicit owner decision

The owner explicitly approved making the Via Login exception in the current
conversation. Updated AGENTS.md §10, plan.md and the account-access/method design
documents to permit only the existing LOGIN password and five-backup-code flow.
The exception has mandatory purpose/consent, memory-only draft, server validation,
invoice/username-bound AES-GCM, absolute 24-hour access, deletion lifecycle,
PAID active-owner/recent-reauth/CSRF/metadata-audit authorization, private/no-store
responses, masking and a maximum 60-second display deadline. OTP/session cookies,
other 2FA codes/security screenshots and all other methods remain excluded.

Backup policy: encrypted and access-restricted recovery artifacts, never an
alternative reveal channel; original wall-clock expiry survives restores; purge
expired/terminal secrets in isolation before enabling access. Document finite
backup retention/deletion and verify actual backup/restore/cron operation before
release. Operational verification remains pending; the owner policy conflict is
resolved. This is not deployment or real account-login authorization.

No collection/reveal implementation, auth gate, schema source or dependency was
changed. GAMEPASS, GIFT_USERNAME and LOGIN remain intact. AGENTS remains below
24,000 bytes even with CRLF line endings.

## P1-2 — NEEDS VERIFICATION; existing test schema is not ready

Owner authorization now permits opening Laragon and running the required local
isolated P1-2 tests and synthetic fixtures. The earlier no-new-database,
no-migration, no-staging/defaultdb, no-provider and no-release boundaries were not
silently widened.

Laragon was launched. Its process has a main window, but the Computer Use helper
did not expose a targetable Laragon window. The installed MySQL 8.4.3 server was
therefore started directly using Laragon's existing configuration, overriding
both classic and X-protocol bind addresses to **127.0.0.1 only**. Verified classic
port 3306 and X-protocol port 33060 belong to that local server. No configuration
file was edited and no database initialized or created.

Metadata-only connection to the existing **cloudy_test_general** on TCP localhost
confirmed MySQL 8.4.3 / port 3306 / the exact schema identity. No environment,
credential, account-field or connection-string value was printed. The schema is
missing:

- `Order.removedFromAdminAt` and its current indexes;
- `RobloxOrderDetail.whatsappE164`;
- `CheckoutSession` and `CheckoutAttempt`.

Read-only information_schema queries restricted to `^cloudy_test_[a-z0-9_]+$`
confirmed all eleven existing local test schemas lack both checkout tables and
the WhatsApp column. No application schema or defaultdb was queried. No fixture
mutation or integration test body was started against this incompatible schema.

The required additive repository SQL has been inspected:

1. `prisma/migrations/20261010145353_add_removed_from_admin_at/migration.sql`:
   nullable column and two indexes.
2. `prisma/migrations/202610140001_login_whatsapp/migration.sql`: nullable contact
   column; application encryption remains responsible for new writes.
3. `prisma/migrations/202610150001_checkout_attempts/migration.sql`: two tables,
   unique keys/indexes and restrictive foreign keys; no Order deletion.

The MySQL integration suite also replays the historical
`202610040001_assisted_login` SQL inside its fixture test. That replay changes
fulfillment/audits and deletes Roblox OrderSecret fixture rows in the test schema;
it is not a harmless read-only assertion. The outstanding approval question names
**cloudy_test_general only**, a local backup before changes, the three additive
schema updates and that historical fixture replay. No DDL, migration, database
creation, Order/charge or provider call has been performed in this checkpoint.

## Verification and handoff

- Relevant Login/access/attempt/cleanup regressions: **62 PASS, 0 FAIL, 0 SKIP**,
  using the existing secret-free wrapper and transaction/provider doubles.
- Whitespace/cached checks: PASS; nothing staged. Documentation-only follow-up
  does not justify repeating the unchanged full browser/build suite yet.
- Last complete local verification remains **152 PASS / 0 FAIL / 9 SKIP** plus
  43 customer and 13 admin browser fixture PASS, as recorded in the previous QA;
  those are historical results, not a new MySQL integration result.
- Current finding count: **6 FIXED locally/policy resolved, 1 NEEDS VERIFICATION
  (P1-2)**. Actual P1-2 MySQL/HTTP remains NOT RUN pending local schema approval.
- No runtime/account-access edit, environment/dependency edit, remote database
  access, Midtrans/Roblox provider call, commit/push/merge/deploy.

Laragon and its localhost-only MySQL process remain running for the authorized
local verification. Do not apply schema or run the historical migration test
until the outstanding named-target approval is received. Existing user work and
existing databases remain preserved.
