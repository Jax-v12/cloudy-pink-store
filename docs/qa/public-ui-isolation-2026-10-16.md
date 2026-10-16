# Public Login UI isolation and browser fixture stability — 2026-10-16

Base: `8ee1d6d4da988d6850649a6330e330924b58c88c`, branch `feat/roblox-login-checkout-recovery`.

## Decision

GO for the independently assembled public UI patch, subject to a separate authorized Git checkpoint task. This is not approval to stage the complete mixed working-tree files. No commit, push, deployment, migration, database access, order or provider charge was performed.

The independent snapshot is `.cache/public-ui-isolation/candidate-public`; its portable patch is `.cache/public-ui-isolation/public-ui-only.patch`, based on the commit above. The manifest beside the patch records the exact candidate tree and its explicit file list. These ignored artifacts preserve the mixed original work rather than replacing it.

## ECONNRESET investigation

The fixture failure mode is CONFIRMED: a renderer read proxied by Playwright `route.fetch()` can fail with `ECONNRESET`, whose default retry count is zero. The unchanged cookie probe reproduced 1 failure in 10 runs. CSS/font failures occurred before session issuance, checkout confirmation or order creation, so this reproduction does not establish an application cookie-loss defect.

The underlying TCP reset trigger is UNRESOLVED. Sanitized HTTP lifecycle tracing showed the local server remained alive and listening; normal idle socket timeout/closure was observed. There is insufficient evidence to attribute the specific reset to a keep-alive race, port collision, server teardown or application cookie logic. Do not report that hypothesis as a confirmed root cause.

The minimal harness change proxies only GET/HEAD renderer traffic to a validated loopback HTTP origin, refuses `/api` traffic and mutation methods, refuses redirects, and permits one native Playwright retry. Installed Playwright retries ECONNRESET only; HTTP error responses remain unchanged. Checkout/auth APIs retain their fixture handling. Cookie, authorization and checkout recovery assertions were not relaxed. No application change was made to address the transport reset.

The real loopback transport regression intentionally resets a TCP connection. Red: 4 PASS / 2 FAIL with the former zero-retry behavior. Green: 6 PASS / 0 FAIL with one retry. It also checks persistent resets stop after two requests, HTTP 503 is not retried, redirects are not followed, API/mutation requests are refused and nonlocal origins are refused.

After the fix: cookie probe 30 PASS / 0 FAIL; current mixed-tree customer browser fixtures 43 PASS / 0 FAIL and admin fixtures 13 PASS / 0 FAIL. These are isolated fixtures, not real database or payment integration evidence.

## Independent public UI scope: 23 files

The original 13 independent files are retained: `src/components/AdminDialog.tsx` and all 12 files in `public/flags/` (11 flags and their MIT license).

Public-only extraction adds five source files/hunks:

- `src/components/LoginUsernameField.tsx`: existing public username API, display name, avatar, user ID, loading/error states, abort/stale-response handling.
- `src/components/LoginFlow.tsx`: username component, public contact grid, ASEAN grouping/flags, responsive styling. Password, backup-code, consent and secret payload changes are excluded.
- `src/context/LoginDraftContext.tsx`: Indonesia as initial phone country only.
- `src/lib/loginContact.ts`: 11 ASEAN phone-country constants only; credential types/validation changes are excluded.
- `src/lib/loginFlowTranslations.ts`: nine public lookup/country-group strings per ID/EN/MY locale only.

Four test files: `tests/login-attempt.e2e.mjs` (HEAD recovery/authorization cases plus public UI cases and safe renderer proxy), `tests/browser-fixture-transport.mjs`, `tests/browser-fixture-transport.e2e.mjs`, `tests/login-public-ui.test.mjs`. This QA document is the final file.

The candidate is assembled from `git archive HEAD` plus explicit public hunks, without copying environment files or the other uncommitted feature files. It uses HEAD checkout, commerce, API routes and Prisma schema. It introduces no new credential collection/reveal implementation. GAMEPASS, GIFT_USERNAME and LOGIN remain available through their existing contracts. The existing public username route is reused.

## Verification

| Check | Final result |
| --- | --- |
| Independent public candidate browser fixtures | 40 PASS / 0 FAIL / 0 SKIP |
| Targeted public UI, Login, Roblox, checkout attempt and payment recovery tests | 55 PASS / 0 FAIL / 0 SKIP |
| Independent candidate complete Node test suite | 144 PASS / 0 FAIL / 9 SKIP |
| Real loopback transport regression | 6 PASS / 0 FAIL |
| TypeScript | PASS |
| Lint | PASS, 3 existing warnings |
| Production build including Prisma Client generation | PASS |

The 55 targeted tests overlap the complete suite; do not add them to its count. The nine skipped tests require database/HTTP or historical-migration prerequisites; no database environment was supplied or accessed and SKIP is not PASS. The browser suite uses synthetic API fixtures and production-rendered pages, including 375×812, 810×1080 and 1440×900 layouts and ID/EN/MY text. Build/test success is separate from real provider integration.

An initial candidate fixture extraction omitted the public username API fixture; that setup failure was corrected in the candidate test, after which all 40 browser cases passed. It did not require an application fix.

## Preserved local work and remaining boundaries

All original 45 local files remain present. Forty-three retain their exact initial content hashes. Only `tests/login-attempt.e2e.mjs` and `tests/login-access.e2e.mjs` receive the authorized helper import/proxy replacement; removing those two hunks recovers their prior content. The mixed application and account-access files are untouched.

Account-access modules, admin reveal/fulfillment changes, checkout/commerce changes and their sensitive fixtures remain outside this public candidate and require their separate review and release gates, including purge/backup-restore verification. Development skills/workflow files and the static preview also remain excluded. In particular, the full original LoginFlow, draft context, contact and translation files cannot safely be staged wholesale for this public checkpoint: use the exported public-only hunks.

No real Roblox credentials were used. Secret scanning reports only paths/counts, never values. The final patch has an explicit file allowlist, passes Git whitespace/applicability checks, and is verified against an alternate index without changing the main index.
