# Via Login release implementation — 17 October 2026

Base: `eca3f3e675aae3302df37bb7feb46a03044e5b88`, branch `feat/roblox-login-checkout-recovery`. No branch switch, staging, commit, push or deployment was performed. Existing local source and tooling were preserved. This report supersedes the old overall BLOCKED label with separate evidence states.

## Status

| Stage | State | Evidence / next requirement |
| --- | --- | --- |
| Local code | COMPLETE | Complete customer collection, encrypted checkout and owner/reauth/audited reveal preserved; new 72-hour policy, database guard, scheduler and restore helper implemented. |
| Vercel configuration | UPDATED, deployment pending | Existing project now has Production DATABASE_URL and release-branch-specific Preview DATABASE_URL targeting only cloudy_staging. No unscoped Preview DATABASE_URL remains. No defaultdb connection or data copy. |
| Preview application | NOT DEPLOYED | Await explicit Git publication/release approval; current local code is not evidence of a remote deployment. |
| Backup/restore rehearsal | VERIFIED | Actual scoped logical dump authenticated and restored locally, counts match; expiry-aware synthetic rehearsal and audit rollback PASS. |
| Provider backup retention | UNVERIFIED | Authenticated Aiven console shows Free-1-1gb and three backup rows, but no contractual finite deletion interval. Do not infer a three-day retention limit from visible rows. |
| Scheduled purge | IMPLEMENTED, NOT ACTIVATED | GitHub workflow needs default-branch publication, store-operations environment/secret configuration and an observed scheduled success. |
| Production application | NOT DEPLOYED | Requires successful Preview, operational evidence and explicit target-specific release approval. |

## Changes and policy

- Existing coupled Login form/draft/translations, validation/HMAC request identity, atomic encrypted OrderSecret and protected admin reveal remain together. No credential material enters invoice/list/provider DTOs, storage, notifications or ordinary logs.
- New account-access TTL is 72 hours from Order creation. Reveal takes the earlier of stored expiry and the absolute lifetime; old stored 24-hour expiries are not extended. Display remains bounded by sixty seconds, session and recent reauthentication.
- Both deployed Preview and Production require Aiven cloudy_staging. defaultdb is forbidden regardless of environment. Ambiguous database query/path overrides fail closed; localhost cloudy_test_* remains available only outside deployed environments. Independent review found Preview's former localhost acceptance; a failing regression reproduced it, and the guard was corrected.
- GitHub cron uses existing cleanup/fulfillment routes every five minutes, limited transient retries, timeout, no redirects, explicit JSON success and no raw response/header output. A failure in cleanup does not skip fulfillment. Heartbeat warning is fifteen minutes.
- The recovery-only CLI refuses remote/defaultdb/ambiguous targets and requires a localhost cloudy_test_* restore with application access disabled. It drains expired/terminal envelopes in transactions of at most 100, preserving stored timestamps and financial history with metadata audits.
- AGENTS.md, roadmap, account-access policy, activation guide and method/operations docs now reflect the owner decision. New [release procedure](../plans/roblox-login-release.md) describes remaining configuration and acceptance.

## Current verification

| Check | Result |
| --- | --- |
| TDD for new TTL/legacy preservation, target policy and heartbeat | Five failures before implementation; focused 55 PASS after implementation. Preview-only local-target rejection separately reproduced/fixed. |
| Current npm test equivalent with isolated environment | 162 PASS / 0 FAIL / 9 SKIP |
| Six local MySQL/HTTP groups | 53 PASS / 0 FAIL / 0 SKIP |
| Customer browser fixtures | 43 PASS / 0 FAIL / 0 SKIP |
| Admin browser fixtures | 13 PASS / 0 FAIL / 0 SKIP |
| TypeScript | PASS |
| Prisma schema validation / Client generation | PASS, Prisma 6.19.3 preserved |
| ESLint | PASS, zero errors / three existing warnings |
| Production build, final source snapshot | PASS; isolated nested-workspace root warning and generated CSS optimizer warning recorded |
| Remote read-only schema/TLS preflight | cloudy_staging, MySQL 8.4.8, strict certificate verification, TLSv1.2; ten applied migrations with matching checksums, zero pending |
| Scoped encrypted logical backup and actual restore | PASS; 25 restored Orders, count match; no remote mutation |
| Restore expiry/terminal purge rehearsal | PASS; legacy expiry, absolute 72 hours, terminal deletion, active retention, original timestamps, history, idempotency, real MySQL audit rollback and 101-row backlog |
| Workflow HTTP runner tests | Four PASS, included in unit total |
| Recovery CLI target-denial test | One PASS, included in unit total |
| Runtime dependency audit | Zero vulnerabilities (`npm audit --omit=dev`) |
| Final independent review | No remaining required findings; Preview target finding resolved |

Counts overlap; do not add them as unique totals. The nine skips in the isolated suite are six resource-gated DB/HTTP groups executed separately above, plus three historical empty-schema migration suites not rerun. No current migration is pending, and this task changes no schema or migration SQL.

The production-rendered fixture browsers use loopback port 3144, three sizes (375×812, 810×1080, 1440×900) and ID/EN/MY. All API/provider requests are isolated fixtures. Real MySQL/HTTP checks use existing localhost cloudy_test_general with synthetic fixtures and blocked external fetches. These are not Midtrans Sandbox or real Roblox account evidence. No provider request, new remote Order/fixture or real account login was performed.

All application builds/checks run in an ignored source copy without environment files and with dummy loopback database configuration. One initial lint failure came from placing the temporary runner in the copy's root; that helper was moved outside the lint target, and normal lint then passed without changing lint rules. Existing warnings are StoreShell image and two staging-test unused variables. The final nested build also emitted the previously observed generated-CSS optimizer warning; it was not suppressed.

## Operational evidence and boundaries

Vercel connector access returned 403 for the linked team; the existing authenticated Vercel CLI succeeded. Environment values were supplied only through runtime/stdin; no value was printed or added to source. Metadata reread confirms Production-only DATABASE_URL plus Preview override for feat/roblox-login-checkout-recovery, both Secret type. Existing shared encryption and checkout-hash configuration records were preserved. Runtime key compatibility and deployed target still require post-deployment verification. Environment edits affect future deployments; no deployment was triggered here.

The logical backup contains only cloudy_staging. mysqldump uses strict hostname/CA verification and a consistent transaction. An unsupported connect-timeout option was diagnosed using installed-client help and removed. Dump completion/schema markers, zero warnings/errors, authenticated AES-256-GCM round-trip and restored counts were validated before declaring success. No plaintext SQL file was written. The random backup key is DPAPI CurrentUser-wrapped; the backup directory ACL is restricted to the operator and SYSTEM. Ignored artifacts remain under .cache/login-release-20261017/backup.

The export deletion deadline is 24 October 2026 at 06:28 WIB (23 October 23:28 UTC), at most seven days after creation. Windows task CloudyLoginBackupExpiry20261017 is registered Ready, checks the ownership manifest and exact workspace paths, and deletes only this task's encrypted export and wrapped key after expiry. StartWhenAvailable is enabled; an offline machine cannot promise wall-clock physical deletion, and the task must run when available. Provider-managed backups have a separate, still-unverified retention policy.

No migration ran because schema/checksums are current. Restores, synthetic purge and integration writes were confined to localhost cloudy_test_*; restored application access remains disabled. The local MySQL service was started for these authorized checks. No defaultdb access was attempted.

Git publication and activation remain separate steps of the accepted plan. GitHub secrets/environment are not configured and no live scheduled purge has been claimed. No GitHub tool capable of configuring Actions secrets was available, and no gh CLI was present. Owner setup or an authorized credentialed Actions administration path is needed. Midtrans Sandbox scenarios/amounts still need their specific approval. Do not run staging fixture writers on the shared database after Production activation.

The exact candidate file list and SHA-256 digests are recorded in ignored `.cache/login-release-20261017/release-files.json` for the next explicitly authorized checkpoint. No local skills/workflow tooling, static mockup, environment configuration, backup or cache is included in that proposed allowlist. Index remains empty. Temporary browser and HTTP fixture servers were stopped after verification; the local MySQL service remains available.
