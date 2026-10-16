# Via Login account access — owner-approved exception, 16 October 2026

**P2-3 policy conflict RESOLVED:** the owner explicitly approved a Via Login
exception in the current conversation on 16 October 2026 and instructed updating
the policy. AGENTS.md §10 now permits only the existing LOGIN password and five
backup-code envelope for the customer's explicitly confirmed top-up. This is a
documented owner decision, not a conclusion inferred from passing tests.
GAMEPASS, GIFT_USERNAME and LOGIN remain separate supported methods. Username,
Gamepass, Apps and Game still reject these Roblox account-access fields.

Owner update, 17 October 2026: new orders use a 72-hour account-access lifetime. Existing stored expiries are never extended or renewed. Preview and Production use the existing contents of cloudy_staging; defaultdb remains prohibited.

The exception is limited to the controls below; implementation and authorization
gates are unchanged by the policy update:

- Purpose/consent: only the assigned admin may use the supplied account access for
  this paid Login top-up. The existing final-confirmation disclosure explains the
  purpose, encryption, expiry and deletion. No account access for other purposes,
  automated login, onward sharing or new credential categories is authorized.
- Only a password and five distinct recovery/backup codes are permitted. OTPs,
  cookies/session tokens, other 2FA codes, security screenshots and screenshot/OCR
  upload remain prohibited for every method.
- Draft values stay in React memory; only explicit final confirmation submits
  them. Server validation and AES-GCM OrderSecret encryption bind access to the
  invoice and verified username atomically with checkout. Never put these values
  in browser storage, URLs, audit/log payloads, analytics, notifications, providers
  or ordinary invoice/list DTOs.
- Only the active owner of PAID LOGIN fulfillment may reveal, after same-origin
  authorization and recent admin reauthentication, under the Order lock and a
  committed metadata-only audit. Private/no-store, the existing rate limit,
  initial masking, visibility/ownership cleanup and a maximum 60-second display
  deadline remain mandatory. Archived, removed, refunded or completed work is
  denied; neither expiry nor a restore may renew authorization.
- Absolute operational access expires 72 hours after creation for new orders. Completion,
  cancellation/payment failure and expiry cleanup delete the envelope. Expired
  access is denied even before physical purge; financial Order history survives.
- Backups containing sensitive envelopes must be encrypted, access-restricted and
  used only for authorized recovery, never as an alternative reveal channel.
  Restore into an isolated environment, enforce the original wall-clock expiry,
  and purge expired/terminal secrets before enabling application access. Backups
  must have a documented finite retention/deletion policy; do not promise that a
  live-row deletion erases historical snapshots immediately. Verify actual backup
  retention, restore/purge behavior and deployed cron scheduling before release.
  Their operational verification remains pending, not a renewed policy conflict.

This approval does not authorize deployment, production/staging access, a schema
change, migration, real Roblox account access or Midtrans calls. Local P1-2 fixture
execution is separately authorized for Laragon's isolated test environment.

An [Indonesian visual design preview](roblox-login-account-preview.html) now shows
the complete requested field layout. It is a standalone review artifact, not an
application route: all nine inputs, the selector and both actions are disabled;
there is no form, script, request handler or credential persistence. The actual
store implementation is separate from this disabled design artifact. The earlier
checkpoint recorded operational approval; the current policy reconciliation above
was previously BLOCKED; the owner decision above now resolves that policy gate.
No release authorization follows from the preview or the policy exception.

## Observed local customer interface

The existing package → account → summary → invoice journey remains. The account
page contains username/contact fields, a masked Roblox password with a visibility
toggle, and five individually labelled masked backup-code inputs. WhatsApp has a
compact country-code/flag prefix; notification email sits alongside on wider
screens. The summary never shows the password/codes. All application labels,
errors and accessibility text support ID, EN and MY through LanguageContext.

Screenshot upload/OCR and automated Roblox login are excluded. The access purpose,
expiry and deletion behavior appear before submission and final confirmation.
Code usability is not verified against Roblox: only bounded input shape and five
distinct nonempty values are validated. The operator performs login manually.

## Existing implementation controls to preserve

1. Keep the password/codes in the existing memory-only draft. Never put them in
   localStorage, sessionStorage, IndexedDB, URLs, analytics, error messages or
   notifications. Clear secret state on observed COMMITTED/EXPIRED/CANCELLED outcomes
   and discard the context on unmount/reload. JavaScript cannot guarantee physical
   memory erasure or control a user's browser password manager.
2. Validate only on the server-authorized LOGIN variant. Reject these fields for
   Gamepass, Username, Apps and Game. Bound request/body/field lengths, require five
   distinct nonempty codes, and preserve the password exactly rather than trimming
   it. Passwords are limited to 1,024 characters and reject NUL; codes are limited
   to 64 characters, reject control characters, and have outer whitespace trimmed.
   No undocumented Roblox-specific length/digit format is imposed.
3. Submit only through the existing cookie-authenticated final confirmation route;
   public operation requires HTTPS. Quotes, package selection and step changes do
   not transmit credentials or create orders. The keyed request digest binds the
   credentials without changing historical retry identity when they were absent.
4. Reuse the existing `OrderSecret` table and AES-256-GCM helper. No schema/migration
   changes are required. The encrypted version-1 envelope binds the invoice and
   verified username and is nested in the same Order/detail/attempt transaction.
   No plaintext/ciphertext enters CheckoutAttempt JSON, provider requests or public
   invoice DTOs. Missing encryption configuration fails creation without fallback.
5. Absolute access expiry is 72 hours after order creation for new orders, with
   no renewal on retries or reads. Delete it on completion, cancellation or failed
   payment. Check expiry on every access even if the worker has not run. Expired
   PAID orders still awaiting fulfillment may require review; unpaid and terminal
   fulfillment states must not be overwritten. Deletion does not delete
   financial/order history. Backup copies need a separately agreed
   retention/restore policy; a row deletion does not erase old backups.
   Physical expiry cleanup uses the existing fulfillment worker/cron; its deployed
   schedule is not verified by local tests. An authorized expired-access request
   also deletes the secret and records review/audit atomically before returning an
   unavailable response. No UI promises immediate physical deletion at hour 72.
6. The existing admin fulfillment POST `action: reveal` is now a gated action,
   never fields in the fulfillment list. It requires the existing admin session,
   same-origin/CSRF check, recent reauthentication
   (the current five-minute gate), PAID order, LOGIN method, no refund, active
   fulfillment claim owned by this session, PROCESSING/WAITING_CUSTOMER state and
   an unexpired secret. Archived/removed/completed orders are denied. Session,
   recent reauthentication and ownership are rechecked under the order lock; a
   metadata-only audit commits before plaintext is returned. The action is limited
   to ten attempts per minute per admin session. Denied requests do not decrypt.
7. Return private/no-store responses. The admin panel masks values initially,
   hides them after 60 seconds, on navigation/visibility loss, and on ownership or
   authorization loss. No automatic clipboard copy, export, provider transmission,
   archive-triggered reveal, account login or automatic delivery completion.

The display deadline is the earliest of 60 seconds, secret expiry, admin-session
expiry and reauthentication expiry. Closing/unmounting aborts in-flight requests;
an epoch guard prevents stale responses reopening data. All responses are private
and no-store. This is a local implementation, not a deployed-service guarantee.

## Implementation surface and verification

- Customer: `LoginFlow`, `LoginDraftContext`, input validation and translations.
- Server: commerce input/digest, final checkout/attempt commit, explicit admin reveal
  handler/DTO, fulfillment panel and existing purge/payment/manual cleanup paths.
- Tests: unauthorized, unpaid, wrong method, nonowner, expired claim/secret and
  stale reauthentication denial; no secret in list/invoice/provider/log/storage;
  duplicate submission, lost response, retry identity, atomic rollback, expiry and
  cleanup; all three locales and required viewports with synthetic credentials.
- [Operational QA](../qa/roblox-login-access-2026-10-16.md) records local checks and
  explicitly separates fixture evidence from actual MySQL/provider operation.
- Rollout requires review of the final contract and code. Remote database/provider
  access, environment changes, commit/push/deployment and real customer credentials
  remain outside the present authorization.

P2-3's policy decision is resolved by the explicit owner exception above. This task does
not change credential collection/reveal. Deployment, remote database access, real
customer credentials and actual account login remain separately authorized work;
none was performed by this documentation update.
