# Checkout attempt — partial local QA, 15 October 2026

Historical checkpoint. Bootstrap and frontend integration were subsequently approved and completed locally; see [latest integration QA](checkout-login-integration-2026-10-15.md). The partial status and counts below describe the earlier checkpoint only.

Status: **PARTIAL / NOT RELEASE READY**. Independent backend/API/limited invoice bridge are implemented. Session issuance and the Login recovery-first UI remain held for bootstrap architecture review. Existing local owner work is preserved. No migration was executed.

## Implemented scope

- Additive CheckoutSession/CheckoutAttempt models, enum, unique checkoutKey, unique nullable order relation, owned flow constraint, indexes, request HMAC and non-contact pricing snapshot. Order receives an inverse relation only. The draft SQL creates only two tables, with restrictive FKs. **No bootstrapId field** was added. WhatsApp schema/migration remain intact.
- Cookie-only authorization readers; absolute 30-day ceiling and revocation checked again under the session lock. No cookie writer, session issuer, locator authentication or renewal exists.
- One unresolved Login attempt per session/product via session-row serialization. Different tab flow IDs join the existing attempt; an explicit new flow naming the latest resolved predecessor is required for repeat purchase. Monotonic per-product creation timestamps keep the predecessor unambiguous within one millisecond.
- Original checkoutKey survives recovery/reconfirmation. Order/detail and COMMITTED transition share the canonical checkout transaction. COMMITTED means Order existence, not paid status.
- Lock order Session → Attempt → Product → Order, ReadCommitted/maxWait 5000/timeout 10000 for new mutations. DB time is read after session lock acquisition. Recipient verification and gateway calls occur outside locks.
- PROCESSING is reported as UNKNOWN, including an elapsed lease until locked recovery checks the original order identity and increments the fence. Old versions cannot finalize. Connection/transaction uncertainty is 503 CHECKOUT_UNKNOWN. Known validation rejection releases only a matching claim after locked absence check and version increment. Changed request/quote needs explicit reconfirmation; no new key or silent new price.
- Cookie+Origin guarded, bounded, rate-limited POST open/recover/confirm APIs. Confirm returns only flow/outcome/invoice, without a bearer. The public legacy checkout refuses new LOGIN and attempt-linked key replay; historical unlinked replay and other methods retain their path.
- Narrow committed-owner cookie bridge on invoice detail, payment reconciliation and QR download. Explicit legacy header always wins, including invalid headers which cannot fall back. Expired/revoked/foreign sessions fail closed. Existing DTO excludes phone/token/contact snapshots.
- Invoice page can use cookie auth when no legacy token is stored. Existing legacy readers/writers elsewhere remain unchanged. Existing charge initialization is shared between the two transports; it runs only for the actual creator, never recovery/replay.

**Partial customer behavior:** LoginFlow is not yet switched to attempt APIs, and no session can be bootstrapped through HTTP. Its old new-order POST is intentionally refused by the server. Do not deploy this checkpoint as a usable Login flow or claim end-to-end duplicate prevention is complete.

## Verification

All checks use allowlisted child-process environments and an isolated source copy without env files. Database configuration is a synthetic closed localhost endpoint. No remote/local database, real provider or real customer is contacted.

| Check | PASS | FAIL | SKIP / limit |
| --- | --- | --- | --- |
| New attempt unit/handler regression | 21 | 0 | 0; in-memory Prisma, serialized transaction fixture and mocked Roblox/provider, not MySQL concurrency evidence |
| npm test | 70 | 0 | 9 existing DB/HTTP/migration suites lack authorized integration prerequisites; SKIP is not PASS |
| Playwright bridge consumer | 6 | 0 | 0; actual production-built invoice page, all API traffic mocked |
| TypeScript | PASS | 0 | npx tsc --noEmit |
| ESLint | PASS | 0 | One existing StoreShell img warning |
| Production build | PASS | 0 | Isolated source copy; existing nested-lockfile/root inference and CSS optimizer warnings |
| Prisma validate / generate | PASS | 0 | No DB connection or migration; generated client matches the additive schema |
| Static migration assertions | PASS | 0 | Exactly two CREATE TABLE statements, expected unique indexes, nullable pricing snapshot and two ON DELETE RESTRICT FKs; not SQL execution evidence |
| git diff --check / task-file whitespace | PASS | 0 | Includes owner changes without staging; 14 new task files also checked for whitespace and high-signal credential patterns without printing matches |
| Bootstrap race / full recovery-first Login browser flow | NOT RUN | — | Issuance/IndexedDB coordinator/UI not implemented, awaiting architecture review |
| MySQL fencing/migration/provider integration | NOT RUN | — | No database/migration/payment authorization |

New regression coverage: committed response lost then refresh and quote drift; UNKNOWN followed by late commit; lease expiry followed by locked NOT_COMMITTED and old-version rejection; same original key on reconfirm; double-submit and logical one-order/one-dispatch; concurrent flow join and explicit repeat; expired/revoked session and absolute age ceiling; atomic transition failure/rollback (P2028); cross-session flow denial; caller sessionId rejection; missing cookie/Origin refusal; ID/MY/PH fail-closed pricing; historical replay; no bearer in confirm; invoice detail/payment/QR ownership, explicit bad legacy header, unrelated invoice and valid legacy compatibility.

TDD started with missing-module RED, then implementation. A known-price rejection initially retained PROCESSING until its lease expired; the safe early-rejection path now proves absence under the same lock and advances version. Tests pass without weakening the lease/UNKNOWN checks. The initial ad-hoc SQL probe incorrectly matched DELETE inside ON DELETE RESTRICT; it was corrected to inspect statement operations, without changing SQL.

Playwright initially rejected Secure __Host cookies on the HTTP fixture (2 PASS, 4 fixture setup FAIL). It now uses reserved HTTPS `store.invalid`, fulfilled entirely from the isolated localhost build, preserving Secure/HttpOnly/SameSite. No request reaches that hostname. Final 6 PASS cover invoice refresh, reconciliation and QR download on 375×812, 810×1080 and 1440×900, plus missing/invalid/legacy credentials. This injects a synthetic cookie and **does not verify real issuance, DB authorization, GeoIP or payment**. The actual handler tests separately exercise query-level authorization with fake Prisma.

Screenshots (temporary, not for commit):

- `.cache/login-qa/attempt-bridge/375-cookie-invoice.png`
- `.cache/login-qa/attempt-bridge/810-cookie-invoice.png`
- `.cache/login-qa/attempt-bridge/1440-cookie-invoice.png`

Mobile/desktop screenshots were inspected; no new overflow or blocked action was observed. The white QR placeholder is a synthetic one-pixel image, not proof of a valid payment QR. No navigation/help-button redesign was made. Existing Login/P0-C historical E2E counts are not reused as proof of this new feature.

## Files for this checkpoint

- `prisma/schema.prisma`, `prisma/migrations/202610150001_checkout_attempts/migration.sql`
- `src/lib/checkoutSession.ts`, `src/lib/checkoutAttempt.ts`, `src/lib/loginAttemptCheckout.ts`
- `src/lib/checkoutAttemptHttp.ts`, `src/lib/checkoutPayment.ts`, `src/lib/invoiceAccess.ts`, `src/lib/checkout.ts`
- `src/app/api/checkout/attempts/route.ts`
- `src/app/api/checkout/attempts/[flowId]/recover/route.ts`, `src/app/api/checkout/attempts/[flowId]/confirm/route.ts`
- `src/app/api/checkout/route.ts`
- `src/app/api/orders/[id]/route.ts`, `src/app/api/orders/[id]/payment/route.ts`, `src/app/api/orders/[id]/qris/download/route.ts`
- `src/app/order/[id]/page.tsx`
- `tests/checkout-attempt.test.mjs`, `tests/checkout-attempt-bridge.e2e.mjs`
- This report, `docs/plans/checkout-attempt-bootstrap-decision.md`, task-progress only in `plan.md`

## Review and remaining blockers

Used Ponytail, TDD, Security, Debugging and Code Review. Reviewed ownership, explicit-header precedence, DTOs/logging, original-key identity, lock order, lease fencing, no network under locks, quote reconfirmation and rollback behavior. Production callers were checked: the old HTTP path uses the gated wrapper; attempt confirmation supplies the owned/fenced context. Direct canonical-domain calls in existing isolated DB fixtures retain their historical behavior, and are not a public authorization path.

1. **Bootstrap architecture:** IndexedDB coordination is approved, but issuance/recovery is not. The updated decision document proposes using the existing session UUID primary key as the public locator, with at-most-one successful cookie writer, no credential recovery from UUID, and explicit fail-closed orphan behavior. No bootstrap field/code was added. Loss of both cookie and IndexedDB cannot be resolved by anonymous identity heuristics; that limitation requires review.
2. **Payment initialization crash:** an earlier isolated probe of actual domain/legacy/reconciliation handlers found one committed Order, zero charge calls and no QR recovered when the request crashes before gateway initialization. Replay/status cannot create another charge. No outbox or automatic charge retry was added. This remains a separate release blocker; no paid/fulfilled claim is made.
3. **Integration proof:** real MySQL locking/late-commit schedules, SQL application to an empty and old fixture schema, backup/restore and sandbox provider integration remain unverified. This checkpoint is suitable for code/design review only, not staging/production rollout.

Future rollout needs separate authorization: review/approve bootstrap and payment recovery → complete recovery-first UI and browser race tests → authorized disposable localhost DB tests → review target/history/backup → additive schema first → client/build and compatible backend/bridge → Login frontend → authorized staging checks → production approval. Running the new app before the tables exist can fail Prisma reads, including legacy replay relations. No schema downgrade is needed for rollback; keep the new tables/history. An application rollback must retain the new-LOGIN gate and invoice cookie bridge for already committed attempts (or explicitly suspend new Login purchases). Rolling back to unguarded legacy creation or removing access for new cookie-only invoices is unsafe.

No env/credential reads, database access/migration, real order/payment, dependency installation, staging, commit, push or deployment. Stop for architecture/code review.
