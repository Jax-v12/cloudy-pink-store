# Application TLS and Login payment recovery — 15 October 2026

Scope: local implementation and review only. No remote database/provider requests, migration, staging fixture, environment-file edit, dependency change, commit, push or deployment. Previously completed Aiven integration evidence is not rerun or relabeled as evidence for this change.

## Application strict TLS

- `src/lib/prisma.ts` preserves the existing target guard, including the unconditional production/defaultdb prohibition. The Prisma 6.19.3 client receives an explicit datasource override through `databaseTlsUrl`.
- Aiven always uses `sslaccept=strict` and a validated CA through `sslcert`. Unsupported `ssl-mode` is removed. Hostname and certificate verification remain enabled; no system-trust or insecure fallback.
- Trust is explicit: `DATABASE_CA_CERT_BASE64` contains the official public CA encoded as one-line base64. Local processes may instead use `DATABASE_CA_CERT_PATH` pointing to the owner's public `docs/ca.pem`, or an existing explicit `sslcert` path. Vercel requires the base64 variable, so an ignored repository certificate is never assumed to exist there.
- The helper rejects oversized/malformed material, multiple certificates, private keys, non-CA certificates and invalid validity dates. A private temporary directory contains a fresh CA copy, with file mode 0600 on POSIX. The application's filesystem bundle stays unchanged. CA provenance is the operator-supplied official certificate; the actual server chain and hostname are verified by Prisma when connecting.
- Development hot reload refuses to reuse a real Prisma singleton without a matching configuration fingerprint. Restart the development server after installing this code or changing connection/CA settings. Public CA rotation also requires a process restart/new deployment.
- Isolated localhost `cloudy_test_*` behavior remains unchanged. This task did not perform a new Aiven handshake or query `Ssl_cipher` in the application. Actual Vercel execution remains unverified.

### Setup required later, by the operator

1. In the existing Vercel project's Settings → Environment Variables, add **`DATABASE_CA_CERT_BASE64`**, without a `NEXT_PUBLIC_` prefix. Encode the approved official CA locally and transfer it directly into the setting without printing it in AI output. No private key belongs in this variable. Select only the authorized staging/Preview environment/branch initially. No variable value is included in this report.
2. Keep the existing approved staging database target and payment-mode configuration. The application's database guard still blocks production/defaultdb; this work grants no permission to alter that policy or any Production setting.
3. A newly authorized deployment is required to use new Vercel settings; existing deployments are unaffected. This task does not deploy.
4. Locally, set the process-only `DATABASE_CA_CERT_PATH` to the actual absolute public CA path, or supply the same base64 configuration, together with an already approved staging connection. Restart Next.js. Do not overwrite `.env` or infer authorization to connect from this setup guide.

References: [Vercel writable temporary filesystem](https://vercel.com/docs/functions/runtimes), [environment variables apply to new deployments](https://vercel.com/docs/environment-variables), [Prisma 6 engine MySQL TLS parser](https://github.com/prisma/prisma-engines/blob/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/quaint/src/connector/mysql/url.rs).

## Payment crash recovery

The existing adapter uses Midtrans **Core API QRIS**, not Snap token creation. Invoice/payment refresh, QR download, signature/amount checks, provider-status verification and fulfillment reconciliation remain the canonical paths. No new public endpoint or SQL migration is introduced.

- New Login confirmations atomically commit `paymentRecovery: { version: 1 }` inside the existing private `CheckoutAttempt.quoteSnapshot` JSON, alongside the existing pricing snapshot. No contacts, bearer credentials or customer data are added to that metadata. The schema change is a comment only.
- Initial Login dispatch and authenticated invoice payment refresh first read provider status for the original invoice. A found transaction goes through `applyPaymentStatus`, which verifies provider/invoice/amount/currency/region/reference under the Order lock and atomically restores pending QR metadata when available.
- Only a verified provider not-found response permits dispatch consideration. Provider outage/timeout/malformed status never becomes proof of absence. An existing reference/QR, expired/terminal Order or historical attempt without the recovery marker cannot start a recovery charge.
- Before any charge request, a short transaction locks the Order and records first/last dispatch timestamps using database time. A 20-second durable dispatch lease prevents concurrent refreshes from submitting together. No HTTP call runs inside that transaction. Failed/uncertain persistence never proceeds to the provider.
- Every QRIS charge uses a stable, operation-specific hash of the original invoice as `Idempotency-Key` (46 characters). Request parameters come from the committed Order, never the retry body. The Order is never recreated during payment recovery. Confirmation replay remains read-only; the invoice refresh endpoint owns recovery.
- A lost response or timeout retains the original dispatch timestamps and key. Later refresh reconciles first, waits for the lease, and can repeat that same operation only within **four minutes of the first dispatch**, with a request deadline and a 15-second timeout. Retrying does not extend the window.
- After the window, status reconciliation and late/duplicate webhooks still work, but an unresolved missing transaction returns `PAYMENT_REQUIRES_REVIEW` (503). The application does not create a replacement charge or rotate the key. A crash before the first dispatch marker may still recover later while the Order remains eligible; a crash after marking but before sending consumes this bounded window.
- Existing historical orders remain status-only; retroactively marking them would incorrectly imply that their original requests used this protocol. Late paid notifications retain the existing review/refund behavior for released orders. QR authorization and signed webhook/verified-status checks are preserved.

The bound is deliberate: [Midtrans's documented idempotency contract](https://docs.midtrans.com/reference/api-headers) retains successful responses for five minutes, returns 202 for an operation still processing, and treats keys as global across POST endpoints. `order_id` alone is not permanent idempotency. Unbounded automatic recovery would need a separately reviewed durable dispatch/reconciliation contract; it is not implemented here.

## Validation and review

- Red: TLS tests failed before the helper existed; recovery tests reproduced the absent recovery function and absent provider key. Existing charge-only initialization could not meet these cases.
- Final targeted regression run: **87 PASS, 0 FAIL, 0 SKIP**, covering TLS configuration/validity/restart, Order commit before dispatch, lost response, timeout, concurrent retry, existing charge, exhausted retry window, persistence failure, malformed dispatch state, provider outage, delayed/duplicate webhook, signature/amount/reference rejection, actual invoice ownership/Origin handlers, quote/region compatibility, other Roblox methods, browser attempt DTOs, database isolation and QR security.
- Provider network requests are intercepted locally; no real Midtrans, Roblox or Telegram endpoint is contacted. Telegram config is explicitly empty, and any Prisma client construction uses a dummy localhost database on port 0. No database query is needed by this test set.
- TypeScript: PASS. ESLint: PASS, with one pre-existing `StoreShell.tsx:41` `no-img-element` warning. Production build: PASS with an explicit dummy localhost target and synthetic Sandbox configuration. Build is compilation evidence, not an encrypted remote runtime verification.
- Mutation review: disabling strict certificate verification was detected; reversing the dispatch lease condition and resetting the first-dispatch timestamp on retries were detected. Every source file was restored byte-for-byte. A preliminary `>=` → `>` boundary mutation remained green because the independent adapter deadline still rejected the boundary dispatch; the non-equivalent mutations above establish regression sensitivity.
- Five-axis local review covered correctness, simplicity, existing module boundaries, secrets/ownership/provider trust and bounded locking/network costs. It found and addressed the development singleton risk, strict timestamp handling and provider fixture isolation. No unresolved blocking local code finding remains within the bounded recovery policy.
- `git diff --check`: PASS. Nothing staged; CA remains ignored. Existing unrelated dirty work is preserved.

## Remaining limits and Sandbox readiness

No further local implementation blocker was found for a separately authorized Midtrans Sandbox test using the approved staging target. Before that test, supply the runtime CA setting, restart the application, and verify the application's own encrypted connection/target under the existing access rules. Vercel needs the setup above and separate deployment permission. Merchant Sandbox configuration, webhook reachability and actual provider behavior require real integration evidence and were not exercised here.

Ambiguous dispatch beyond the retry window and historical unmarked missing charges require operator review; there is no automatic re-charge outside that safety boundary. The previously recorded independent quote-expiry **1 SKIP** remains unchanged and outside these two fixes. No claim is made that prior staging passes validate this new payment recovery implementation.

Files in this task: `src/lib/databaseTls.ts`, `src/lib/prisma.ts`, `src/lib/checkout.ts`, `src/lib/checkoutPayment.ts`, `src/lib/paymentProvider.ts`, `src/lib/payments.ts`, `src/app/api/orders/[id]/payment/route.ts`, `prisma/schema.prisma` (comment), `tests/database-tls.test.mjs`, `tests/payment-recovery.test.mjs`, `tests/checkout-attempt.test.mjs`, this QA report and `plan.md`.

Skills applied: Ponytail, Test Driven Development, Security and Hardening, Debugging and Error Recovery, Code Review and Quality.
