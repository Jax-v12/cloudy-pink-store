# Remaining local integration readiness — 17 October 2026

Base: `eca3f3e675aae3302df37bb7feb46a03044e5b88`, branch `feat/roblox-login-checkout-recovery`.

## Result

The existing password and five-backup-code implementation is integrated in the local working tree. It was not rebuilt or removed. Public Login UI, GAMEPASS, GIFT_USERNAME, Apps, checkout recovery and admin fulfillment were checked against the pushed public-UI baseline. One confirmed expiry edge case was fixed with two regressions. The complete local implementation is ready for an explicitly authorized local code checkpoint; activation/deployment remains blocked on the operational evidence below.

No commit, push, merge, deployment, migration, database access, real Order or charge was performed. Tests use synthetic data and in-memory transaction stores. No real Roblox account access was attempted. The remote Preview still runs the public-only commit above; it does not receive these local changes automatically.

## Inventory and dependency boundary

All 31 initial modified/untracked files were recorded with SHA-256 hashes and copied byte-for-byte into ignored `.cache/local-integration-2026-10-17/original-files/` before editing. Twenty-nine remain byte-identical. Only `src/lib/loginAccess.ts` and `tests/login-access.test.mjs` received the described fix/regressions. No original file was deleted or reverted. This QA document is one additional file.

The feature is a coupled unit: customer form/draft/validation/translations -> commerce parsing and keyed digest -> atomic checkout/OrderSecret -> authenticated fulfillment reveal -> admin panel. Include the shared synthetic fixture together with its dependent tests. The already committed public username field, flags, translations, dialog focus helper and safe browser transport helper are reused from the base commit. No package, lockfile, Prisma schema or migration change is needed.

### Ready for the next local code checkpoint: 23 files

Twelve source files:

- `src/app/api/admin/fulfillment/[id]/route.ts`
- `src/components/FulfillmentAdmin.tsx`
- `src/components/LoginFlow.tsx`
- `src/components/LoginAccessPanel.tsx`
- `src/context/LoginDraftContext.tsx`
- `src/lib/checkout.ts`
- `src/lib/commerce.ts`
- `src/lib/loginAccess.ts`
- `src/lib/loginContact.ts`
- `src/lib/loginCredentials.ts`
- `src/lib/loginFlowTranslations.ts`
- `src/lib/robloxOpsTranslations.ts`

Ten test/fixture files:

- `tests/admin-catalog-archive.test.mjs`
- `tests/checkout-attempt.test.mjs`
- `tests/http.test.mjs`
- `tests/login-access-fixture.mjs`
- `tests/login-access.e2e.mjs`
- `tests/login-access.test.mjs`
- `tests/login-attempt.e2e.mjs`
- `tests/login-flow.test.mjs`
- `tests/mysql.test.mjs`
- `tests/roblox.test.mjs`

Plus `docs/qa/local-integration-readiness-2026-10-17.md`. This is a proposed allowlist, not staging or commit authorization. Database-backed test code can be checkpointed with its explicit NOT RUN status; it is not evidence that those groups executed in this task.

### Preserved separately: 9 development/reference files

- `.agents/skills/code-review-and-quality/SKILL.md`
- `.agents/skills/debugging-and-error-recovery/SKILL.md`
- `.agents/skills/ponytail/SKILL.md`
- `.agents/skills/security-and-hardening/SKILL.md`
- `.agents/skills/security-and-hardening/references/hardening-patterns.md`
- `.agents/skills/test-driven-development/SKILL.md`
- `skills-lock.json`
- `workflow.md`
- `docs/plans/roblox-login-account-preview.html`

These do not implement runtime dependencies and are excluded from the proposed feature checkpoint. The static preview is a design reference, not an operational credential form. Its separate inclusion would need a documentation/tooling checkpoint decision.

## Confirmed defect and minimal correction

The former reveal gate trusted only `OrderSecret.expiresAt`. With a synthetically extended expiry timestamp, an Order older than 24 hours could still return account access; a nearly expired Order could receive a display deadline past its absolute lifetime. This demonstrates an edge case/inconsistent-metadata failure, not evidence that any real record was affected.

`loginAccess.ts` now uses the earlier of the secret expiry and `Order.createdAt + LOGIN_ACCESS_TTL_MS`. Expired access is deleted under the existing Order lock and its review status/audit are committed atomically, including when the stored expiry is too late. The admin display deadline is capped by the same effective expiry, the session, reauthentication and sixty-second limits.

TDD: the two added regressions failed against the previous implementation (10 PASS / 2 FAIL). After the minimal correction: 12 PASS / 0 FAIL. Reversing the new expiry condition in the isolated copy caused the targeted expiry regression to fail; restoring the exact bytes made it pass again. The original working tree was not used for that temporary mutation.

## Focused security and integration audit

| Boundary | Evidence and result |
| --- | --- |
| Customer secret entry | Password and exactly five distinct backup codes; bounded validation and exact password preservation; other methods reject the fields. ID/EN/MY labels and public lookup/contact UI preserved. |
| Browser persistence | Secret draft remains in React memory. Back retains it, reload discards it, terminal outcomes clear it. No secret in localStorage/sessionStorage/IndexedDB or summary. Browser fixture assertions pass. |
| Submission | Only explicit final confirmation sends credentials. Quote/package/recovery paths retain their previous contracts; no automatic confirm on recovery. |
| Encryption | Existing AES-256-GCM helper with random IV and authenticated tag; versioned envelope binds invoice and verified username. OrderSecret is inserted in the Order/detail/attempt transaction. Missing key fails creation, with no plaintext fallback. Actual key values/custody/rotation were not inspected. |
| Reveal authorization | Existing admin session + same-origin mutation check + recent reauthentication + session-scoped rate limit. Live session, PAID LOGIN status, refund/archive/removal/completion and active job owner checked again under the Order lock. Nonowner/unpaid/wrong-method/corrupt/cross-order payload tests fail closed. |
| Audit/error privacy | Metadata audit commits before plaintext is returned; audit failure rolls back. Public invoice/list/provider payloads omit secret content/ciphertext. Error reporting emits controlled codes, not request data or decryption output. Reveal responses are private/no-store. |
| Admin UI | Masked readonly values, explicit Show, maximum sixty-second view with earlier server deadline, abort/epoch fencing, close/visibility/unmount/assignment cleanup. Reauthentication and keyboard trap/restore fixtures pass. |
| Expiry and cleanup | Absolute 24-hour reveal/display clamp fixed. Existing worker/manual/payment cleanup uses transactions and preserves financial history. Cleanup tests cover idempotency, completion while waiting and audit failure rollback. Physical purge scheduling is an operational gate. |
| Race/rollback | Order locks serialize reveal with completion/ownership/cleanup; checkout uses existing attempt/session fences and atomic secret insertion. Real MySQL lock scheduling was not re-executed. |

The shared auth/password implementation, CSP and payment provider configuration were preserved. No dependency or schema upgrade was introduced. This audit is scoped to the remaining local integration; it does not repeat the previous committed-file review or claim a new repository-wide penetration test.

## Verification on the complete local snapshot

An isolated copy contains the tracked baseline plus all original local source/tests, with no environment files copied. The reviewed runtime wrapper allowlists operating-system inputs and supplies a dummy database target at closed loopback port 9. No DB/HTTP test target or live provider configuration is supplied. The commands below run against this exact source copy; source equality is checked after build and mutation restoration.

| Check | Latest result |
| --- | --- |
| Focused account-access regression | 12 PASS / 0 FAIL / 0 SKIP |
| `npm test` | 156 PASS / 0 FAIL / 9 SKIP |
| Customer browser fixtures | 43 PASS / 0 FAIL / 0 SKIP |
| Admin browser fixtures | 13 PASS / 0 FAIL / 0 SKIP |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS, 0 errors / 3 existing warnings |
| `npm run build` including Prisma Client generation | PASS |
| Expiry-gate mutation | Detected; source restored exactly; targeted regression PASS |
| Secret/data-flow inspection and candidate scanning | PASS within the proposed file scope; no secret values emitted |
| `git diff --check` / staged whitespace | PASS; staging remains empty |

Counts overlap: the focused domain regressions are included in `npm test`; browser fixture counts are separate. An initial pre-fix targeted baseline had 66 PASS / 0 FAIL / 1 SKIP. It is not added to the final totals.

The nine skipped groups are catalog/archive HTTP, archive historical migration, catalog/archive MySQL, invoice-removal HTTP, removal historical migration, invoice-removal MySQL, general HTTP authorization, general MySQL integration, and the historical WhatsApp/checkout-attempt migration replay. They require DB/HTTP or empty-schema prerequisites; several create synthetic persisted Orders or execute migrations. They remain NOT RUN under this task's restrictions. Historical Laragon integration results are not relabeled as a fresh verification of the new fix.

Browser checks use the production-rendered local app at loopback port 3144 with synthetic API/provider fixtures and isolated browser contexts. They cover 375/810/1440 sizes, all three locales, customer fields/validation/clearing, public UI compatibility and the admin reveal dialog. Screenshots contain masked synthetic credentials only, under ignored `.cache/local-integration-2026-10-17/app/.cache/login-qa/`. The local server was stopped afterward.

Existing lint warnings: StoreShell image element and two unused staging-test variables. The nested isolated build reports the existing multiple-lockfile/root inference warning. No warning was suppressed, and no quality assertion was weakened.

## Activation gates and owner handoff

Local code checkpoint: GO for the 23-file feature/document allowlist, after separate commit authorization and preflight. No staging/commit was performed here.

Account-access activation: BLOCKED until the mandatory controls in [the approved design](../plans/roblox-login-account-access.md) have operational evidence:

1. Prove `/api/cron/fulfillment` runs often enough, retries/alerts on failures, and handles the bounded purge backlog. The local `vercel.json` has a region setting and no cron definition; this does not prove whether an external scheduler exists. No scheduler or Vercel configuration was changed.
2. Provide an encrypted/restricted backup retention policy with a finite duration, and restore verification that preserves original creation/expiry times and purges expired/terminal secrets before application access. The new absolute-lifetime regression is mock evidence, not a real backup restore.
3. Verify deployment prerequisites (existing OrderSecret schema and secure server encryption/hash configuration, HTTPS and appropriate key custody) without printing values. Actual remote integration, live provider/account access, and a deployed account-access browser/security check remain separate authorized work.

The owner was asked for existing cron/retention/restore evidence during this task; no approval or operational success is inferred from elapsed time. These gates do not require removing the local Login feature. The earlier public Preview network trace limitation is separate and is not resolved by these local tests.
