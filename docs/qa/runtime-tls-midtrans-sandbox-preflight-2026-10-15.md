# Runtime TLS and Midtrans Sandbox preflight — 15 October 2026

## Verdict

- **Application runtime TLS: PASS.** Verified by an actual local Next.js development Route Handler importing the application's `src/lib/prisma.ts` singleton.
- **Payment recovery review: PASS**, after one focused HTTP 202 validation fix and three additional synthetic regression scenarios.
- **Sandbox execution: awaiting explicit owner approval.** No Midtrans Sandbox request, staging Order/fixture write, migration, defaultdb access, production/Vercel environment change, commit, push or deployment in this task.

## Actual application TLS evidence

The existing runtime configuration loader selected `cloudy_staging` in memory before any Prisma connection. The official local `docs/ca.pem` was provided through the process-only `DATABASE_CA_CERT_PATH`. Next.js ran in development mode on a temporary loopback listener, with an allowlist admitting only the temporary probe GET and an ephemeral authorization header. Payment/Telegram configuration was disabled for this process.

The temporary handler used the actual application singleton, not the staging harness client or a database mock. It performed `SELECT DATABASE(), VERSION()` and `SHOW SESSION STATUS` for SSL cipher/version inside one Prisma transaction, ensuring those results describe the same physical connection. No customer tables were queried.

| Evidence | Observed result |
| --- | --- |
| Database | `cloudy_staging` |
| MySQL | `8.4.8` |
| Protocol | `TLSv1.2` |
| Cipher | `ECDHE-RSA-AES256-GCM-SHA384` |
| Prisma engine | `c2990dca591cba766e3b7ef5d9e8a84796e47ab7` |
| Official CA and strict application connection | Successful read-only queries |
| Unrelated CA control, same service/database | Query did not succeed; TLS certificate/trust error |

The engine's [version-matched MySQL parser and strict-mode test](https://github.com/prisma/prisma-engines/blob/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/quaint/src/connector/mysql/url.rs#L338) confirm strict mode keeps both certificate verification and hostname validation enabled. The application constructs `sslaccept=strict` and an explicit CA path, with no invalid-certificate fallback. This is actual encrypted runtime evidence plus a failed wrong-CA control. An independent wrong-hostname endpoint test was not performed; hostname enforcement is established from the active engine's strict configuration and matching engine implementation.

The initial probe classifier expected Prisma code P1011. This engine's certificate failure did not expose that code, so two preliminary probes did not pass the reporter's negative-control criterion despite positive application encryption. The classifier was corrected to record the failed query and sanitized TLS/certificate error categories. No certificate checks or application configuration were weakened to make the probe pass.

The probe listener/process tree stopped and its owned temporary source route was removed. Next's generated development route types initially referenced the removed route; regenerating development types with a dummy localhost target removed that stale reference. TypeScript then passed. The reusable non-secret helper/result are ignored under `.cache/`; no public diagnostic API remains. `docs/ca.pem` remains ignored and unchanged. Vercel runtime behavior was not exercised.

## Midtrans contract and recovery review

Primary sources checked: [API headers and idempotency](https://docs.midtrans.com/reference/api-headers), [Core API QRIS](https://docs.midtrans.com/reference/qris), [transaction status](https://docs.midtrans.com/reference/get-transaction-status).

- The implemented payment method is Core API `qris`, acquirer `gopay`, ID/IDR. QRIS is covered by the documented POST idempotency contract; it is not in the documented unsupported-method list.
- Keys are operation-specific and global across endpoints, with a maximum of 46 characters. The implementation deterministically produces exactly 46 hexadecimal characters from the original invoice and charge-operation namespace. Retries do not rotate the key or change the committed payload.
- Midtrans retains successful idempotent responses for five minutes and returns HTTP 202 for an in-process request. This application allows bounded retries for four minutes after the durable first-dispatch timestamp, reconciles before each attempt, and has a shorter dispatch lease and request timeout. It never treats this key as permanent idempotency.
- **Concrete issue fixed:** `response.ok` includes HTTP 202. Previously a contradictory success-shaped body with HTTP 202 could be persisted as a confirmed charge. The adapter now explicitly rejects HTTP 202 as unconfirmed regardless of body fields, preserving the existing recovery/reconciliation path. No architecture, schema, ownership, throttle or external API contract change.
- A structured matching provider 404 only permits considering a retry under the existing durable marker, lease, unchanged key and active window. It is not proof that an earlier charge failed. Empty/ambiguous lookup, incomplete 404, processing response, timeout and outage do not authorize a new dispatch.
- After four minutes an unresolved dispatch returns `PAYMENT_REQUIRES_REVIEW`; finding an existing provider transaction still reconciles without charging. Historical unmarked attempts are status-only. An Order committed before any dispatch can be recovered while still eligible, without creating another Order.
- Charge/status validation retains the original `order_id`, total amount, IDR/ID region, provider and transaction-reference checks. Payment state transitions use verified provider status. Invoice ownership/Origin is checked before reconciliation, and webhook signature, amount, currency and provider-reference checks remain in place. Payment network calls hold no database locks.

## Prepared scenarios

All fixtures are synthetic. Local provider fakes are not evidence of real Midtrans behavior. The fault cases below are prepared and covered locally; a later authorized run must distinguish actual Sandbox observations from intentionally injected faults.

| Scenario | Prepared action and expected result | Later provider evidence |
| --- | --- | --- |
| QRIS charge succeeds | One committed IDR Order, one stable-key charge; verified reference and QR, then verified settlement | Actual Sandbox create/status and simulator settlement |
| Order committed before charge | Interrupt before dispatch; authenticated invoice refresh recovers that same Order | Sandbox charge attached to original invoice |
| Charge response lost | Forward one real charge, suppress its response locally; reconcile the existing transaction | Status recovers original provider reference, no replacement |
| Timeout and same-key retry | Inject transport failure, reconcile first; retry eligible operation with unchanged key and payload | Distinguish observed status recovery from an actual repeated Sandbox POST |
| Request still processing | HTTP 202 remains UNKNOWN with no confirmed QR/reference; same-key bounded retry or later status resolves it | Deterministic local fixture; real Sandbox 202 only if actually observed, never falsely reported as forced |
| Concurrent retry | Multiple owned refreshes for one invoice; durable lease and provider key prevent duplicate operations | One provider transaction identity |
| Duplicate/late webhook | Replay signed synthetic notifications for an owned Sandbox invoice; verified status drives transitions | One payment transition/job; local replay is not proof of public notification delivery |
| Ambiguity beyond retry window | Preserve first timestamp, advance controlled local time beyond four minutes; perform status-only review | No post-window charge; no claim that provider idempotency lasts longer |
| Existing charge found again | Discard local response/reference in controlled fixtures and recover by original invoice | Same provider transaction/reference, zero extra charge |

### Proposed permission boundary for the next run

Request authorization for **at most six new synthetic Login Orders and six QRIS Sandbox transactions, each IDR 1,000, aggregate simulated amount at most IDR 6,000**, on `cloudy_staging` only. This is a ceiling, not a requirement to create six transactions. No real funds or live payment endpoint are involved.

The scope must include namespaced synthetic Product/variant fixtures at that fixed server-authoritative price, owned CheckoutSession/CheckoutAttempt/counter records, Order/detail writes, payment reference/QR/status updates, Sandbox status lookups and simulator settlement, local signed webhook replay and the resulting synthetic fulfillment-job records. Keep the fulfillment worker, Roblox network calls and notifications disabled. Use synthetic email under `example.invalid`, reserved fictional phone data, and a stubbed Roblox identity boundary; do not reuse customer data or allow that stub to reach a general running application.

Before the first provider call, a private runtime must verify that the configured merchant key and mode are Sandbox, that the exact endpoint is `api.sandbox.midtrans.com`, that the database is `cloudy_staging` over strict TLS, and that the fixture IDs are owned by the approved run. Do not print the key or connection string. Merchant configuration has not been verified by contacting Sandbox in this task.

Record owned synthetic IDs in a private local run journal. Cleanup must preserve financial history: verify terminal provider status before final archival, archive the synthetic Orders, deactivate synthetic catalog entries and remove only owned disposable sessions/attempts/counters. Do not hard-delete Orders or existing staging records. Any unverified provider outcome stops new charges and is reported for review.

The proposed permission does not include deployment, Vercel settings, migrations, production access, real Roblox fulfillment or a public tunnel/webhook exposure. Public delivery verification would need a separately approved callback arrangement; local signed replay alone will not be called end-to-end webhook delivery.

## Local verification and limits

- RED: the new HTTP-202/success-shaped-body regression failed against the prior adapter, persisting a QR where UNKNOWN was required.
- GREEN: focused set **90 PASS, 0 FAIL, 0 SKIP**. Includes new tests for empty/unstructured 404/processing status lookups and both standard and contradictory HTTP 202 charge responses.
- Full `npm test`, with dummy localhost configuration and no DB/HTTP fixture URLs: **117 PASS, 0 FAIL, 9 SKIP** (126 total). All nine skips are existing DB/HTTP/migration integration entry points requiring separate disposable resources. No staging mutation or migration suite was executed.
- Mutation: removing the explicit HTTP 202 rejection was detected; original source was restored byte-for-byte.
- TypeScript PASS after refreshing the probe's generated route types; lint PASS with the existing `StoreShell.tsx:41` image warning; build PASS with a dummy localhost database and synthetic payment configuration; whitespace checks PASS.
- Five-axis local review found no unresolved blocking code issue within the bounded recovery contract. No new dependency, public endpoint, permanent configuration or schema change.
- Prior staging integration/migration evidence was not rerun. The independent quote-expiry skip and actual Vercel/public-webhook/provider behavior remain separate limits. Long-outstanding ambiguity and historical missing-charge records still require operator review.

Skills: Ponytail, Test Driven Development, Security and Hardening, Debugging and Error Recovery, Code Review and Quality.
