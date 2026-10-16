# Via Login release operations

Owner decisions, 17 October 2026: use the existing `cloudy_staging` contents in Preview and Production, never access/copy `defaultdb`, keep all three Roblox methods and Apps, and give new Login orders at most 72 hours of account access from creation. Stored old expiries remain authoritative and are never extended. Payment mode remains Sandbox.

## Configuration and publication

Use only linked project `jax-v12/cloudy-pink-store` (`prj_Oz6McF6kBIkykqRNw8cqo5ousj9m`). Restrict Preview database configuration to reviewed release branch `feat/roblox-login-checkout-recovery`. Runtime clients must verify `cloudy_staging`, strict TLS and the expected schema before accepting checkout. Never switch targets by weakening the database guard. Preserve shared encryption/hash keys so existing ciphertext and checkout identities remain valid; verify compatibility without displaying values. Origins remain environment-specific.

Commit the complete coupled source/test implementation after explicit Git approval; exclude local skills, workflow notes, caches, machine configuration, environment files and backups. Obtain target-specific push/release approval after review. Wait for the existing project's deployment and verify exact SHA, Ready state and alias. Do not deploy a second project or silently copy data from the former Production database.

## Temporary scheduler

The workflow `.github/workflows/store-cron.yml` runs every five minutes, offset from the top of the hour, and supports manual dispatch. GitHub scheduled workflows require the file on the default branch; a branch-local YAML file is not proof of activation. Check available Actions minutes and execution notifications before enabling it. Scheduled execution can be delayed or dropped during load: expiry authorization must work independently of cron.

Create the GitHub environment `store-operations` with variable `STORE_CRON_ORIGIN` (exact HTTPS origin, no path/query), secret `CRON_SECRET` (the exact existing server value, never trimmed), and, only for a protected Preview target, `VERCEL_AUTOMATION_BYPASS_SECRET`. Restrict environment deployment branches to the reviewed default branch. No secret belongs in workflow source, command arguments, URLs or job output.

The workflow calls existing `/api/cron/cleanup` and `/api/cron/fulfillment`, validates success, rejects redirects and login pages, retries transient failures at most three times, and still attempts fulfillment if cleanup fails. Use one scheduler for the shared database. Before Production activation, manual Preview checks may verify synthetic expired records; after activation, point the scheduler at the stable Production origin and disable any duplicate Preview scheduler. Require a successful scheduled run, then verify the fulfillment heartbeat. The admin warning threshold is fifteen minutes; a shared heartbeat does not prove both deployments are healthy.

Enable GitHub's existing workflow-failure notifications for the operator. Review HTTP failures, missed runs, Actions quota and purge backlog. The worker purges at most 100 expired records per invocation; verify repeated runs drain a synthetic backlog in the isolated local database. Moving to a VPS or Vercel scheduler later must disable the old schedule first.

## Backup and restore

Before schema changes, verify target identity and migration checksums, then produce and validate a logical dump of only `cloudy_staging`. Encrypt the dump, restrict access to the operator, keep decryption material separate from the dump, and set a deletion deadline no later than seven days. Do not overwrite an existing artifact, print SQL/customer values or store plaintext dumps. Record counts/checksums and the restore result only. No migration is needed when all existing migrations match.

Inspect the current Aiven plan's actual encrypted-backup retention/deletion and access policy, including provider-managed copies. Do not infer retention from the number of visible snapshots. Never restore the whole Aiven service into Production for this test, because other databases are outside scope. Restore the scoped logical dump into a fresh localhost `cloudy_test_*` database while application access is disabled; compare counts/history and original creation/expiry timestamps. Purge expired/terminal envelopes there, with metadata audit and without deleting financial history. Prove purge with synthetic legacy-expired, new-expired, active and completed examples, including rollback and replay. Do not enable the restored application until cleanup has passed.

## Acceptance and rollback

Track code, Preview, operations and Production separately in the release QA report. Prove ciphertext storage, owner-only paid/reauthenticated reveal, sixty-second display, old expiry preservation, new 72-hour boundaries and deletion on completion/cancellation/failure. Run local MySQL/HTTP tests and fixture browsers in ID/EN/MY at 375×812, 810×1080 and 1440×900. Fixture success is not a provider transaction or a production security test.

Any Midtrans Sandbox transaction needs a separately approved scenario, target and amount. After Production activation, do not run staging fixture generators, migration replay suites or test-order writes against the shared database. Use isolated localhost databases for write tests. MYR/PHP payments remain unavailable.

On deployment failure, keep the last verified app serving and preserve database history. Roll back only to a reviewed `cloudy_staging`-compatible snapshot; old deployments that require `defaultdb` or renew credential expiry are not valid rollback targets. No destructive down migration, reset or automatic provider resend is allowed.
