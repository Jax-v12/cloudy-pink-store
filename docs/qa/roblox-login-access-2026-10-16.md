# Operational Via Login — local implementation and QA, 16 October 2026

> Historical implementation/QA checkpoint; the intervening P2-3 BLOCKED policy
> gate was resolved by the owner's explicit Via Login exception approval on
> 16 October 2026. AGENTS.md §10 and the [current policy](../plans/roblox-login-account-access.md)
> now permit only the existing Login password/five-backup-code flow under its
> mandatory controls. Collection/reveal is unchanged. Counts below are historical;
> policy resolution does not verify database/provider operation, backups or cron,
> and does not authorize release.

The owner explicitly requested operational password and five backup-code fields so
the admin can log in to fulfill the customer's top-up. This supersedes the earlier
mockup checkpoint and the old no-account-secrets Login product direction for this
task. [Implementation design](../plans/roblox-login-account-access.md).

## Result and implementation surface

- `LoginFlow`, `loginContact` and `LoginDraftContext`: username, masked password,
  five distinct masked backup codes, contact email and compact WhatsApp prefix.
  Eleven ASEAN countries/flags come first; international options remain. ID/EN/MY
  labels and accessibility text use LanguageContext. Region/price stay independent.
- Draft credentials remain in React memory through back/forward navigation. Reload
  discards them; observed terminal attempt outcomes clear secret state. Summary
  shows the access purpose, not values. Only the final explicit confirmation sends
  credentials; package/step/quote changes create no Order/payment.
- `loginCredentials`, `commerce` and `checkout`: bounded validation, exact password
  bytes, normalized backup-code edges, HMAC-bound retries and an AES-GCM version-1
  envelope bound to invoice and verified username. Nested OrderSecret insertion is
  atomic with Order/detail/COMMITTED. No schema/migration/dependency change.
- `loginAccess` and the existing fulfillment POST `action: reveal`: only a live,
  recently reauthenticated admin owning the PAID, non-refunded active Login job can
  reveal data. Rechecks occur under the Order lock; the metadata audit commits
  before returning plaintext. Archive/removal/completion, other methods, wrong
  owner, missing/expired data, corrupt envelopes and cross-invoice substitution
  fail closed. Ten reveal attempts per minute per admin; private/no-store responses.
- `LoginAccessPanel` / `FulfillmentAdmin`: explicit unlock, existing admin reauth,
  initially masked readonly fields, deliberate Show action, no automatic clipboard
  copy, and cleanup on close, visibility loss, ownership loss and unmount. In-flight
  requests are aborted and stale responses fenced. The view is hidden within 60
  seconds and uses the earlier deadline from session/reauth/secret expiry.
- `AdminDialog`: explicit Tab/Shift+Tab wrapping and focus restoration for the
  sensitive panel and other dialogs using this shared component. Existing busy/Esc
  behavior is preserved.
- Existing manual completion and payment-failure/cancellation transactions delete
  the same secret. The existing fulfillment worker purges expired secrets. An
  authorized expired-access request also deletes the row with review/audit changes
  atomically. Expiry always blocks access even before cleanup executes.

## Verification

| Check | Result | Scope and limits |
| --- | --- | --- |
| Focused account-access domain | 10 PASS, 0 FAIL | Actual validation/crypto/domain; fake transaction store |
| Domain + durable checkout regression | 36 PASS, 0 FAIL | Includes rollback, lost response, historical replay and public invoice redaction |
| Full local suite | 128 PASS, 0 FAIL, 9 SKIP | Database/HTTP/migration prerequisites not exercised |
| Customer browser | 42 PASS, 0 FAIL | Real UI/IndexedDB; isolated API/provider fixtures |
| Admin browser | 13 PASS, 0 FAIL | Real UI; isolated admin/reauth/reveal fixtures; Tab/Shift+Tab trap, Esc and restored focus |
| TypeScript | PASS | `tsc --noEmit`; production build also typechecks |
| Prisma validate | PASS | Closed dummy localhost URL; no connection/mutation |
| Full lint | 0 errors, 3 existing warnings | StoreShell image and two staging unused variables |
| Changed-file lint | PASS | Includes new credential/admin/browser code |
| Production build | PASS | Secret-free isolated copy; no remote DB/provider |
| Whitespace/staged checks | PASS | Nothing staged or committed |

Customer coverage includes all flags/locales at 375×812, 810×1080 and 1440×900,
masking/visibility, duplicate-code rejection, draft preservation, reload clearing,
secret-free summaries/storage, no early order, double submit, lost/unknown outcomes,
explicit requote/repeat, region isolation, null prices and other-method navigation.
Admin coverage includes reauthentication, masking/Show/close, wrong-password errors,
expiry, visibility/assignment loss, absence of browser persistence, unavailable
data, and keyboard focus. Screenshots use synthetic contacts and masked synthetic
credentials only. No real account login or provider payment was attempted.

TDD/review evidence: the initial seven new domain tests failed before implementation
and passed afterward. A maximum-length escaped-Unicode envelope exposed an overly
small read bound; the regression failed, then passed with the corrected bounded
limit. Wrong admin-password feedback was reproduced before its UI correction.
Inverting the owner gate in the isolated source caused the denial regression to
fail; the source was restored exactly and the focused regression passed again.
The extended keyboard check exposed native Tab escaping at the last control;
explicit focus wrapping/restoration was added in the shared dialog. An earlier
opener-only experiment did not resolve Tab wrapping and was replaced by that fix.

Test setup issues are separate from application fixes: Playwright's clock must be
installed before the timer is scheduled, and tests wait for the resulting render.
Visibility/assignment coverage injects a visibility event and parent-list refresh;
a real click behind the modal is correctly blocked. One initial concurrent browser
run recorded an existing fixture error in cookie-loss recovery; its focused rerun
and the complete sequential customer run passed without weakening an assertion.
Build reports the previously observed inferred-root/multiple-lockfile warning and
one generated CSS token warning in the isolated nested copy. Neither was suppressed.

## Operational limits and handoff

- Changes are local on `feat/roblox-login-checkout-recovery`, baseline `22402a5`.
  No commit/push/deploy. Existing untracked skills/workflow/lock files are preserved.
- No `.env`/credential-value read, remote database access, migration, seed, real
  Order/payment or real Roblox credential use. All runtime configuration used by
  checks is allowlisted and synthetic, with a closed localhost database target.
- Production needs HTTPS and the already-used encryption configuration plus the
  existing OrderSecret schema. Actual deployment/DB behavior is unverified here.
- Absolute access expiry is 24 hours; physical deletion of expired rows depends on
  the existing fulfillment-worker/cron schedule, which must be checked before
  release. No automatic cron/deployment configuration was added. Deleting active
  rows does not erase old backups; backup retention/restore remains an operations
  decision. The UI accurately distinguishes access expiry from cleanup.
- Backup-code format/usability and actual manual account access are not verified
  against Roblox. There is no automated login or screenshot/OCR upload.
- Older staging/provider integration harnesses were not run or widened to admit a
  new secret-writing fixture. Their previous results do not verify this contract;
  adapting/executing them requires scoped remote-fixture authorization. No existing
  isolation guard was relaxed. Legacy pre-attempt browser harnesses were not used
  as evidence for the current cookie/attempt flow.
- Local code/React/security review and the owner-gate mutation check are complete.
  No unresolved finding remains in the implemented local scope. Real integration,
  operational cleanup verification and release remain separately authorized work.
