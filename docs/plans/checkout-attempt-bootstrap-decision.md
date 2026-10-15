# Checkout attempt bootstrap — decision checkpoint, 15 October 2026

Status: the owner approved local bootstrap implementation and frontend integration on 15 October 2026. Both are now implemented and verified with isolated fixtures; see [integration QA](../qa/checkout-login-integration-2026-10-15.md). No migration has been applied. Existing Login work is preserved. MySQL/payment integration and release remain separate gates.

## Approved and prepared

- CheckoutSession and CheckoutAttempt additive models, original unique checkoutKey, nullable unique order relation, request digest and non-contact quote snapshot, state/version/lease/expiry fields.
- Session authorization enforces the approved absolute 30 days (both expiresAt and createdAt ceiling), without renewal. An uncommitted attempt starts at 30 minutes; finalization requires the current version and live lease under lock.
- Draft migration only creates the two tables and their indexes/FKs. Order receives a Prisma inverse relation only, with no SQL column change. Existing WhatsApp schema/migration remain intact.

## Original bootstrap gap and approved decision

Two initial requests without cookies have no shared authenticated browser identity. With independent session issuance, tab A can receive credential A, begin an attempt, and then lose its cookie to tab B's delayed Set-Cookie response. Server uniqueness per session/product cannot converge attempts that were assigned different sessions. IP/UA is not safe ownership evidence, and Web Locks alone does not satisfy the approved authoritative-server requirement.

The user approved IndexedDB coordination and then implementation of this design on 15 October, with explicit conditions: the UUID is not authentication, no credential reissue based on it, and **no bootstrapId schema field**. IndexedDB and once-only issuance now follow the approved design below.

## Approved issuance design (implemented locally)

A separate bootstrapId column is not necessary: the existing UUID `CheckoutSession.id` is assigned the non-secret bootstrap locator during the one initial insert. Session authorization still exclusively hashes the independent random cookie credential; accepting session.id/flowId from a caller never authorizes an attempt. This reuses the existing primary-key constraint rather than adding another identity/index.

1. In one origin-scoped IndexedDB read-write transaction, create/read the single bootstrap UUID. Wait for transaction **completion**, not just request success, before making HTTP calls. Concurrent tabs get the same committed value. Do not wait for network inside an IndexedDB transaction. A timeout, blocked upgrade, quota error, unavailable storage, abort, or invalid existing record stops Login checkout. Web Locks may reduce work but are not needed for correctness.
2. Once a UUID exists, retries and new tabs reuse it. Never delete/replace it on timeout, lost response, lease expiry, tab crash or cookie absence. A browser coordinator crash is not permission to generate another identity. Per-tab purchase flowId remains separate and only in sessionStorage.
3. Bootstrap POST requires same-origin/CSRF checks, bounded exact input, source/locator rate limits and private/no-store. A valid existing cookie takes precedence: authenticate it, reject mismatched locator and return status **without Set-Cookie**. An invalid/expired cookie is not permission to replace it automatically.
4. For an initial cookie-less request, generate an independent 256-bit random credential on the server. In a short ReadCommitted transaction, insert CheckoutSession with `id = locator`, SHA-256 tokenHash and DB-clock absolute 30-day expiry. There is no preliminary lookup-then-issue path. The unique primary-key insert elects one winner. Only a transaction whose insert/commit is known to have succeeded can emit its new credential, once, as `__Host-cloudy_checkout; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=<absolute deadline>`, without Domain and without a JS-readable copy.
5. A conflicting insert, including retry after a lost successful response, returns a generic bootstrap-pending/blocked result **with no Set-Cookie**. It cannot read/reconstruct/reissue the stored credential. P1017/P2028 or an uncertain commit also return UNKNOWN with no Set-Cookie. No retry handler may mint a replacement credential for that locator. Keep the session row (or a future reviewed permanent issuance tombstone); deleting expired issuance records would break this invariant and is not authorized cleanup.
6. The first request that successfully presents the cookie is the ownership acknowledgement. It may return non-sensitive session readiness, not a credential. All attempt operations still lock the session, recheck expiry/revocation and enforce ownership; no contacts/order/payment exist at bootstrap. A separate activatedAt field is unnecessary if every operation requires the issued credential before it can create an attempt.
7. If the winner's cookie never reaches the browser, the UUID can indicate unresolved issuance but cannot recover ownership. Stop checkout; allow bounded status/ack checks with backoff and a support message. Do not create a new session/attempt or use legacy checkout. Verified cross-browser/lost-cookie recovery remains out of scope.

### Set-Cookie race and attacker analysis

| Scenario | Required result and reason |
| --- | --- |
| Two cookie-less tabs, shared IndexedDB UUID | One INSERT wins; exactly that known-committed request may emit Set-Cookie. Every conflicting response has none. Database uniqueness **plus the once-only response rule**, not uniqueness alone, removes the competing cookie writer. |
| Loser's response arrives after the winner starts or commits an attempt | No Set-Cookie in the loser, so it cannot replace the winner's credential. Same-cookie tabs serialize attempts on the session row. |
| Winner's response is delayed while other requests time out | All requests retain the same locator; conflict/UNKNOWN responses cannot replace it. The eventual winning cookie can be acknowledged; no other session is minted. |
| Crash after insertion, before response / response lost | An orphaned issuance may block the browser. This is an explicit availability cost, not evidence of NOT_COMMITTED and not permission to reissue. |
| Attacker learns a victim's locator after issuance | Insert conflicts; no cookie or private response. A UUID-only attempt/recovery/invoice request remains unauthorized. |
| Attacker wins issuance for a known locator before the victim | Attacker receives only their own random credential for an empty session. The victim gets no cookie and cannot submit contacts/orders into that session. This can deny service, but must never fix the attacker's session into the victim browser. No endpoint accepts a caller-supplied credential; no bearer in JSON; __Host/Secure/no Domain prevents a subdomain from planting it. |
| Storage unavailable or corrupted | No bootstrap/checkout; no Web Locks-only or legacy fallback. |

This is the design's at-most-one credential-issuer argument **per stable locator**, not an assertion that the server can recognize every physical browser without a credential. If both cookie and IndexedDB are cleared/partitioned, or different locators are supplied, an anonymous server cannot distinguish a returning browser from a genuinely new customer. No IP/UA/email heuristic should pretend otherwise. A browser that detects loss/inconsistency stops. Complete protection across undetectable loss of both identity stores or across browsers needs an additional verified recovery/identity design. The owner approved local implementation with these limits and the fail-closed orphan behavior. Isolated handler/browser tests verify the local response policy and coordination; they do not prove real MySQL concurrency.

### Bootstrap evidence and remaining integration gates

- Browser tests with Web Locks absent and two cookie-less tabs; atomic IndexedDB completion/abort/crash/blocked/timeout/unavailable paths.
- Handler tests permuting winner/loser response order, uncertain insert commit, cookie acknowledgement, duplicate UUID, invalid cookie, expired/revoked session and response loss. Assert **at most one Set-Cookie** and no raw credential in JSON/storage/logs.
- Attacker with known locator cannot read, replace, acknowledge or get the victim's cookie; preemptive claim can only refuse the victim.
- A local MySQL concurrency test of the unique insert, under separate authorization. Mocks do not establish this property.
- No reset/cleanup endpoint silently permits reuse of an issued locator. Verified loss recovery remains a separate review.

Issuer behavior/identity-loss limits were approved for local implementation. `POST /api/checkout/session` now implements the sole cookie-writer path, and the client waits for credential acknowledgement before attempt operations. No bootstrap field was added. See the latest QA for test counts and unverified MySQL/deployment limits; this does not authorize deployment.

## Separate payment recovery blocker

An isolated probe ran actual createCheckout and the existing checkout/reconciliation route handlers against fake Prisma and provider adapters. It simulated a crash after Order commit and before the original gateway create call. Replay returned the existing order, and reconciliation receiving no provider transaction left it PENDING without a QR. One logical order existed; gateway create was never called. This proves no duplicate in that scenario but does not prove autonomous payment initialization recovery.

Do not retry gateway creation blindly, create a replacement order, claim PAID, or add an outbox in this batch. An approved payment-dispatch/recovery design or explicit operational acceptance is needed separately. No real provider or database was used.

## Scope and next step

Prisma validate and static SQL checks are not database execution evidence. Implemented cookie-only authorization readers, once-only session issuance, session/attempt locking and recovery, version fencing, original checkoutKey, atomic Order/detail/COMMITTED, explicit reconfirm after request/quote change, per-product join/repeat policy, open/recover/confirm endpoints, and the narrow invoice bridge. Tests use fake Prisma/provider and browser API fixtures only.

The canonical checkout domain entry point is still callable by isolated legacy DB fixtures. Public `/api/checkout` uses its gated wrapper: historical unlinked replay remains compatible, new LOGIN creation is refused, and an attempt-linked key cannot return an invoice bearer through the legacy path. New attempt handlers do not return a bearer. LoginFlow now uses these endpoints and the cookie invoice bridge; the legacy submission/token storage code has been removed from Login. Other checkout methods and legacy token readers/writers remain compatible.

Lock order: CheckoutSession → CheckoutAttempt → Product → Order. Recipient verification and gateway dispatch remain outside locks. Recovery locks the same session/attempt before checking the original order identity and incrementing version; an empty unlocked lookup or elapsed lease alone never permits a replacement. Unknown DB failures return 503 CHECKOUT_UNKNOWN. Known validation rejection can release only the matching claim after another lock/absence check/version increment. No financial history is deleted and no cleanup job was added.

The sessionStorage flow locator, recovery-first UI, bounded polling/backoff, explicit repeat/reconfirmation and no-bearer invoice handoff are now integrated. Browser tests use real IndexedDB, no Web Locks, delayed/lost responses and isolated server fixtures. Next: review, then separately authorize disposable localhost MySQL insert/lock/fencing/migration tests. The payment-initialization crash remains a separate release blocker. Remote/local migrations, real orders/payments, dependency installation, commit/push/deploy remain unauthorized in this task.
