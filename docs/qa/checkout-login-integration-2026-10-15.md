# Login checkout session integration — local QA, 15 October 2026

Status: **frontend connected locally; ready for review before authorized disposable-MySQL testing**. Not production/staging release approval. This supersedes the partial-runtime status in the earlier checkout-attempt checkpoint. No database access or migration was performed.

## Delivered

- `POST /api/checkout/session` uses the existing CheckoutSession UUID primary key as the non-secret locator. An origin-scoped IndexedDB read-write transaction creates/reads that UUID and must complete before HTTP. No bootstrapId schema field, dependency or migration change.
- Only a known successful unique INSERT/commit emits the independently random cookie. Existing valid cookie acknowledgement, conflicting inserts, invalid/expired cookies and uncertain commits emit no Set-Cookie. Attributes are __Host prefix, HttpOnly, Secure, SameSite=Lax, Path=/, absolute DB-clock expiry of 30 days, no Domain/renewal. UUID knowledge never authorizes or recovers a credential.
- Shared in-flight handshake avoids aborting the sole issuer during React StrictMode cleanup; it does not cache authorization. Repeated requests keep the same IndexedDB locator. Missing/blocked/failed/corrupt/aborted/timed-out storage or unacknowledged/lost cookie fail closed, without new UUID or legacy checkout fallback. Retries are bounded and recheck the same identity.
- LoginFlow/LoginDraftContext now use open/recover/confirm APIs, not legacy Login checkout. Three routes/design, contact validation, WhatsApp encryption, ID/EN/MY and server regional pricing remain intact. Contact, quote, request and credentials are never persisted; sessionStorage contains only the per-product flow UUID, IndexedDB only the bootstrap UUID. New Login writes no invoice token to localStorage or URL.
- Successful final confirmation navigates to the invoice through the cookie bridge, without clearing the draft first. Refresh inspects durable attempt state before an empty-draft redirect. COMMITTED shows the same invoice; UNKNOWN blocks new confirmation and polls at 1/2/4/8/16 seconds, then stops with an explicit recovery action. Polls never submit confirmation. Locked NOT_COMMITTED invalidates the previous UI quote and requires a fresh explicit click. EXPIRED/CANCELLED cannot revive old work; explicit Buy again starts another flow naming the resolved predecessor.
- Package changes before the first confirmation preserve the attempt key and advance version under existing locks. Once an attempt has a confirmation digest, selection stays locked through ambiguity. The DTO exposes only a non-sensitive selectionLocked boolean. An absent initial open can be retried with its original stored flow UUID under the server lock; an empty lookup never directly authorizes an Order.
- Generation/unmount guards ignore stale UI results, timers are cleaned up, and successful results are not displayed with an obsolete UNKNOWN message. The quote hook's optional revision leaves other callers' payloads unchanged.

## Final verification

All commands used the reviewed allowlisted environment runner, a dummy closed localhost endpoint, and isolated build copy without environment files. Prisma Client generation/validation do not connect to a database. Browser API calls and provider responses were fixtures; assets/documents came only from the isolated localhost production build. HTTPS `store.invalid` is intercepted entirely, preserving real Secure/HttpOnly browser cookie behavior without contacting that hostname.

| Check | PASS | FAIL | SKIP / limitation |
| --- | --- | --- | --- |
| Targeted attempt/bootstrap + browser-helper tests | 29 | 0 | 0; 25 actual domain/handler tests with fake Prisma/provider, 4 browser-helper tests |
| npm test | 78 | 0 | 9 existing database/HTTP/migration suites lack authorized prerequisites |
| Playwright Login attempt integration | 30 | 0 | 0; actual browser/IndexedDB and production-built UI, mocked APIs, no SQL/provider integration |
| TypeScript | PASS | 0 | npx tsc --noEmit |
| ESLint | PASS | 0 | Existing StoreShell img warning only |
| Production build | PASS | 0 | Existing workspace-root/nested-lockfile and CSS optimizer warnings |
| Prisma validate | PASS | 0 | Schema and migration unchanged in this follow-up |
| Diff/whitespace/security review | PASS | 0 | No staging/commit; scoped source/docs checked without printing credential-pattern matches |
| Real MySQL concurrency/migration/payment | NOT RUN | — | No database/migration/real-transaction authorization; mocks are not integration evidence |

Browser matrix:

- 375×812, 810×1080, 1440×900: three pages, form errors, back preserving contact, double-submit, delayed invoice navigation, no overflow, no private persistent storage or legacy checkout calls.
- Lost committed response + hard refresh; UNKNOWN + late commit; NOT_COMMITTED + changed quote + explicit confirmation with same flow; bounded five-attempt polling without another confirm.
- Simultaneous tabs without Web Locks: one atomic IndexedDB locator, one delayed cookie issuer, one server-owned attempt/logical order. Another browser knowing the flow cannot read the attempt or invoice.
- Lost bootstrap response, cookie loss/invalidity, IndexedDB unavailable/throw/abort/blocked/timeout/corrupt locator all stop safely. The locator is never silently replaced.
- Explicit repeat purchase, expired/cancelled attempt, independent ID/MY/PH fixture prices, null prices, foreign phone-country isolation, translated ID/MY picker, Gamepass/Username wizard navigation and Apps navigation with no Login bootstrap.

The MY/PH browser payment methods are fixtures only. Real server gates remain unavailable for those providers. Token/phone/contact privacy assertions and browser page errors/unexpected-network counters are checked. No real order or charge was created; logical-order counters exist only inside fixtures.

During implementation: missing session handler produced expected TDD RED; TypeScript caught a local variable shadow, which was corrected. Browser harness teardown initially left a rejected promise from a disposed asset response; awaiting the dispatcher inside the error boundary fixed teardown while retaining application-error counters. An intermediate run had 28 PASS / 2 fixture timeouts: fixture version advanced on unchanged package, and the outsider test waited for an enabled Continue before selecting a package. Both fixtures were corrected against actual behavior; final full run above is 30 PASS. No application validation, security attribute, assertion or timeout was weakened to obtain that result.

Previous `login-flow.e2e.mjs` and `login-checkout.e2e.mjs` use historical legacy-checkout fixtures and were not counted/run against this new contract. The new integrated suite replaces that evidence for the Login attempt flow; earlier P0-C/invoice-bridge counts remain historical, not added to the final 30.

## Files changed by this follow-up

- `src/app/api/checkout/session/route.ts` — initial issuance and cookie acknowledgement.
- `src/lib/checkoutSession.ts` — remove obsolete no-issuer comment; authorization unchanged.
- `src/lib/checkoutBrowser.ts` — atomic IndexedDB locator, safe handshake/request/DTO parsing and UUID-only sessionStorage.
- `src/context/LoginDraftContext.tsx` — durable attempt coordination, recovery, explicit confirmation/repeat, bounded polling and lifecycle guards.
- `src/components/LoginFlow.tsx` — connect existing three-page UI, safe status/recovery/invoice actions; remove legacy token/key path.
- `src/components/useRegionalQuote.ts` — optional revision to invalidate a prior quote after recovery.
- `src/lib/checkoutAttempt.ts` — safe pre-confirmation variant switch and selectionLocked DTO.
- `src/lib/loginFlowTranslations.ts` — new status/recovery/repeat labels in ID/EN/MY.
- `tests/checkout-attempt.test.mjs`, `tests/checkout-browser.test.mjs`, `tests/login-attempt.e2e.mjs`.
- This QA report, bootstrap decision document, prior-checkpoint pointer, task-progress only in `plan.md`.

Existing owner changes, earlier WhatsApp/schema/migration work, legacy invoice access, other methods and payment configuration were preserved. No new dependency or Prisma/SQL changes in this follow-up.

Screenshots (synthetic contacts, temporary and excluded from commit):

- `.cache/login-qa/attempt-flow/375-summary.png`
- `.cache/login-qa/attempt-flow/810-summary.png`
- `.cache/login-qa/attempt-flow/1440-summary.png`

All three were visually inspected. The accepted horizontal mobile navigation and fixed Contact Us position remain. No redesign was performed; the existing floating help button remains near the payment selector on the mobile screenshot. No new page overflow or blocked confirmation was observed.

## Security review and remaining limits

Used Ponytail, TDD, Security, Debugging and Code Review. Reviewed single cookie-writer branches, public-locator non-authorization, cookie flags/absolute lifetime, CSRF/rate limiting/input limits, ownership, lock/fence/original-key behavior, no network/provider calls under locks, no bearer/PII persistence or logging, invoice legacy-header precedence, no automatic confirm/charge on recovery, stale UI cleanup and unchanged regional gates. No unresolved security blocker was found within the approved stable-locator/same-browser design by static and isolated-fixture review. This is not proof of MySQL scheduling or deployment behavior.

- The anonymous server cannot recognize a returning customer if both cookie and IndexedDB are undetectably erased, or in another browser. Known identity loss blocks rather than replacing credentials. An attacker knowing a locator can preempt issuance to deny service but cannot place their cookie into the victim browser or read a previously issued session. Verified recovery remains outside scope.
- A lost winning cookie response can orphan issuance and block that browser. This is the explicitly approved fail-closed availability cost. Do not delete session rows/tombstones or reset the locator to work around it.
- The existing crash window after Order commit but before gateway initialization remains a separate payment recovery blocker. No payment outbox, automatic retry charge or general invoice recovery was implemented. COMMITTED means Order exists, not PAID, QR initialized or delivered.
- Ready for separate authorization to test the additive schema and these locks/unique constraints on a disposable **localhost cloudy_test_*** database. Verify DB time/transaction behavior and late commit/insert races there. Not ready to claim staging/production/payment integration: target/history/backup, migration approval and payment-crash disposition remain separate gates. Schema must precede new application queries; rollback must retain attempt gating and the cookie invoice bridge for already-created invoices.

No env/credential reads, remote/defaultdb/cloudy_staging access, migrations, real orders/payments, dependency install, commit, push or deploy. Stop for review.
