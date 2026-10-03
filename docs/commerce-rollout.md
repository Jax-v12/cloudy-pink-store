# Commerce rollout and operations

## Implemented boundaries

- Apps retains IDR integer pricing and encrypted stock. Games and Roblox use variants and immutable order snapshots.
- Production game checkout is hard-disabled until a real provider is implemented and verified. `GAME_PROVIDER=simulator` works only outside production; it never delivers real products. SKU and optional zone are configurable. The initial game input format is alphanumeric, underscore or hyphen; expand validation when the provider is selected.
- Roblox is enabled with `ROBLOX_CHECKOUT_ENABLED=true`, then active products and variants in `/admin/commerce`. Gift variants require a capacity confirmation no older than 24 hours at checkout. Confirmation is an operator check, not automatic reservation of Roblox's external transfer quota. Stop selling when capacity is exhausted; monitor existing queued orders before enabling more packages.
- Login requires a password and exactly five distinct backup codes, as explicitly requested. Both are encrypted together before insertion. OTPs and session cookies are rejected. Username is operational order metadata, not an account credential used for sign-in on this store.
- Existing customer invoice tokens and Apps API response fields remain supported. New clients send a random `idempotency-key` (32–128 URL-safe characters) and reuse it with identical normalized input. Legacy requests without this header remain supported but do not provide retry deduplication.

## Migrate without losing existing data

1. Stop accepting new checkouts during deployment and pause old cron callers. Back up the current MySQL database using the operator's established backup method; verify restoration in an isolated database. Do not place SQL dumps in the repository or a public directory.
2. This repository previously had no migration history. The `202610010000_baseline` migration describes that existing schema. For an **existing database only**, compare the database with the baseline before running `npx prisma migrate resolve --applied 202610010000_baseline`. Do not run the baseline CREATE statements against existing tables. Resolve drift, including older manual hardening migrations, before proceeding.
3. Run `npx prisma migrate deploy`, then `npx prisma generate` and `npm run build`. A fresh empty database applies both migrations automatically. The additive commerce migration defaults products/orders to Apps, fills product-name snapshots, and marks historical paid Apps orders completed.
4. Deploy the new application and smoke-test Apps checkout, payment, retrieval, and expiry with Midtrans sandbox. Then enable Roblox. Configure the real gateway and retain the current webhook URL `/api/webhook/payment` when moving to production.
5. Keep the new application/schema when disabling new sales. Turning off `ROBLOX_CHECKOUT_ENABLED` does not stop existing invoices, manual fulfillment, refunds, or secret purging. Do not roll back to the old payment service while non-Apps orders exist: it expects stock for every paid order.

On Windows, Prisma generation requires the engine DLL not to be locked by a running dev server. Stop the project's dev server, generate, and restart it if `EPERM` occurs. Do not switch the deployed application to a no-engine client.

## Scheduled work

Configure an external scheduler to invoke both endpoints **every minute**, over HTTPS, with `Authorization: Bearer <CRON_SECRET>`:

- `GET /api/cron/cleanup`: existing expired-payment reconciliation; only expired pending reservations can release stock.
- `GET /api/cron/fulfillment`: processes up to ten game jobs and purges up to 100 expired credential records per invocation. It records a heartbeat only after a successful run. Scale the schedule/batch capacity if the retention backlog grows; credentials cannot be revealed after their expiry even before deletion runs.

No in-process timer is required. The hosting scheduler itself is external configuration and is not provisioned by this repository. The admin workspace shows unfinished work, review counts, last successful run, and a warning after three minutes without a heartbeat. Alert on cron HTTP errors, overdue heartbeats, and growing review/retention queues.

## Delivery and sensitive access

- Webhooks validate SHA-512, database amount/currency, and the gateway's current status. A payment and its single fulfillment job commit atomically. Late payment records PAID plus required review/refund without allocating a replacement stock item or dispatching a top-up.
- Workers durably record the first attempt before external I/O. After interruption or timeout they check status using the same reference; unknown results require review and never trigger blind resending. Production adapters must provide bounded network timeouts and documented reference/status semantics before enabling checkout.
- Admins claim Roblox orders before handling them. An active session cannot steal another session's job. An expired owner's claim can be recovered; review the existing transfer history before continuing, because external manual actions cannot be rolled back by the store.
- For Username, verify the exact recipient and capacity, send through Roblox Plus, then choose Waiting for customer until receipt is confirmed. For Gamepass, verify owner, purchase amount, and target net Robux. The store does not claim instant receipt.
- Complete only after verifying success and entering a non-sensitive delivery reference. Refunds are performed externally and recorded separately using a refund reference. These buttons do not transfer funds.
- For Login, claim the paid order and reauthenticate using the admin password. Reveal requires reauthentication within five minutes, current job ownership, PROCESSING status, and an unexpired secret. The response is no-store. The UI clears revealed values after one minute, on blur, when hidden, on another action, or on unmount. No automatic clipboard copying is performed.
- Secret records are deleted on completion, expiry, cancellation, completed refund, or seven-day retention. Audit records contain actions/session IDs, never credential values. Keep infrastructure request-body capture disabled for checkout, reauth, and secret responses. Database backups need their own retention/access controls; deleting a live row cannot remove past backups.
- Game provider and audit histories are structured metadata. Never put passwords, codes, email addresses, or gateway keys into evidence or Telegram messages.

## Verification

`npm test` runs pure security tests and reports MySQL/HTTP integration tests as skipped when their explicit environment variables are absent.

For database tests, create a disposable localhost MySQL database named `cloudy_test_<suffix>`, set `DATABASE_URL` and `TEST_DATABASE_URL` to that database, and run `npx prisma migrate deploy` followed by `npm test`. The test runner refuses non-local or non-test names. Fixtures are retained for inspection; no test deletes a production database.

For HTTP integration tests, start the built Next.js app on localhost against the **same isolated test database** with `ADMIN_PASSWORD=isolated-http-test-password`, `ENCRYPTION_KEY=test-key`, and `ROBLOX_CHECKOUT_ENABLED=true`. Set `TEST_BASE_URL` to its localhost URL before `npm test`. Do not point this test server at production or use real payment/Telegram credentials.

Release checks: `npx prisma validate`, `npm run lint`, `npx tsc --noEmit`, `npm run build`; then test mobile layouts, keyboard navigation, all three languages, and Midtrans sandbox. MYR/USD pricing and production game provider integration remain future work.

The test loader uses Node.js 24 module hooks (validated with Node 24.16). Use Node 24 for the test commands.

Set `APP_ORIGIN` to the canonical public HTTPS origin behind a reverse proxy. Cookie-authenticated mutations require an exact matching Origin; direct local development falls back to the request Host. This avoids relying on an internal Next.js request hostname for CSRF validation.

## Local verification record (2026-10-02)

- Prisma schema validation, TypeScript, ESLint, and Next.js production build passed.
- 17 tests passed with no skips using isolated MySQL 8.4 and a local production HTTP server. Coverage includes checkout/stock concurrency, repeated webhooks, both manual non-login methods, encrypted login secrets, retention, refund replay, provider crash/timeout recovery, token authorization, CSRF, and reauthentication.
- Browser checks covered the portal at desktop and 390px mobile width, ID/EN/MY switching, and the Login package form; no browser console errors were observed.
- Both migrations applied to the isolated database. The configured remote database was not modified. Real Midtrans sandbox payment execution and hosting scheduler activation remain environment rollout checks.

## Login repair and migration (2026-10-03)

The configured application database still used the baseline schema. Admin session creation failed because the generated client expected `reauthenticatedAt`; the UI previously displayed the same generic message for all login failures. A private backup was written outside the repository, restored successfully to an isolated MySQL instance, and the additive migration was verified there. The remote baseline matched exactly, then both migration records were applied to the configured database. Real admin login, authenticated session lookup, catalog access, and logout all returned HTTP 200 using the existing environment password, without logging the password or session token. Login errors now distinguish schema/configuration issues, rejected origins, rate limits, and cookie persistence failures. All 17 tests, lint, TypeScript, and the production build passed.

For a short Indonesian activation guide, see [aktivasi-topup.md](aktivasi-topup.md).
