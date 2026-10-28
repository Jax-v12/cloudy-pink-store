# Store interaction QA — 28 October 2026

The owner requested hands-on checks across the store, with particular attention to transitions, dropdowns, buttons and Roblox cards. Initial implementation and QA were completed locally on `feat/roblox-login-checkout-recovery`, based on `e1bcf025329d098245d2aee1884e38eba8316c47`. Existing inventory/document changes and untracked work were preserved. No remote database operation or real transaction was performed. The owner subsequently authorized publishing these changes to `main`; release preflight is recorded below.

## Reproduced issues and fixes

| Issue | Before | Result |
| --- | --- | --- |
| Roblox details | Content height jumped immediately; opening one desktop card stretched all three cards and moved neighbouring summaries | Cards align independently; the selected card expands and collapses over 220 ms. Native `details`/keyboard behaviour remains intact. |
| Dropdown hit area | Summary height was 16 px on mobile and 20 px on desktop | At least 44 px; padding belongs to the clickable summary. |
| Moving controls | Whole-card hover translated the card and its controls | Border/shadow feedback remains; controls stay in place. |
| Wizard back | Returning to the first Gamepass/Username step left focus on the step button | Every actual step change focuses the current heading; drafts survive. |
| Other disclosures/transitions | FAQ and Login backup-code guide appeared immediately; several modal animation classes had no configured implementation | Shared disclosure animation, explicit backup-guide chevron, and a short entry animation for wizard steps, Login pages and recent-orders modal. Reduced-motion preferences disable these animations. |
| Invoice copy | Denied clipboard writes still displayed success and produced an unhandled rejection, reproduced in ID/EN/MY | Account/OTP copy waits for success, catches denied or missing clipboard access, and uses existing translated error messages. Feedback timers are cleaned up and stale copy responses are ignored. |

Disclosure animation is progressive enhancement using [`::details-content` and intrinsic size interpolation](https://developer.chrome.com/blog/styling-details). Browsers without these CSS capabilities retain the native disclosure without the height animation. Real Safari/Firefox devices and phone performance were not measured.

## Verification

Local browser checks use Chrome with intercepted API responses or in-memory handlers. The isolated renderer contains no `.env` files and has a blocked loopback database target. Fixtures never reach the shared database, payment provider, real customers, real clipboard or messaging services.

The viewport matrix is **375×812, 810×1080, 1440×900** with **ID/EN/MY** unless noted.

| Check | Result | Coverage/evidence |
| --- | --- | --- |
| New interaction regression | 20 PASS | `tests/store-interactions.e2e.mjs`: cards, separate product selections, desktop neighbour stability, intermediate opening/closing sizes, rapid reversal, reduced motion, keyboard focus, draft preservation, Gamepass guide, final submission failure/retry, duplicate clicks, invoice navigation and recent-orders dismissal. |
| Help/order progress | 37 PASS | `tests/service-help.e2e.mjs`: FAQ/terms, three methods, payment versus delivery, refund/cancel/expiry and unavailable-region states. |
| Apps | 9 PASS | `tests/apps-roadmap.e2e.mjs`: error/retry/search/detail/consent, invoice acknowledgement and expiry, admin product form. Rechecked after the clipboard fix. |
| Indonesia market | 45 PASS | `tests/indonesia-market.e2e.mjs`: browser plus actual catalog handler with in-memory products; no DB/provider. |
| Login attempt flow | 43 unique cases verified | Broad run: 40 PASS, 3 stale Indonesian-label selector failures. Corrected the selector; all 9 ASEAN locale/viewport cases then PASS, including new backup-guide keyboard assertions. Other broad cases cover secrets in memory, validation, back/reload, ambiguous recovery, double submit, storage failure and independent methods. Evidence: `login.log`, `login-asean-final.log`. |
| Admin account access | 13 unique cases verified | Broad run: 10 PASS, 3 stale Indonesian password-label selector failures. All 3 affected ID viewport cases PASS after correcting the selector. Masking, reauth, focus, expiry, visibility/assignment loss and unavailable access use synthetic fixtures. Evidence: `admin-access.log`, `admin-id-final.log`. |
| Navigation/admin controls | 9 PASS | Header/footer navigation, language switching, legacy admin tabs, fulfillment filters, product type and all three package-method selections; zero API mutations. `general-results.json`. |
| Invoice clipboard | 3 PASS | ID/EN/MY at 375×812: denied, pending and successful account/OTP copy, plus missing clipboard support; no unhandled page errors. `tests/invoice-interactions.e2e.mjs`. |
| Pending QR invoice | 9 PASS | `tests/indonesia-copy.e2e.mjs`: languages/reload, public pages, pending QR guidance/layout and synthetic PNG download filename. No provider QR or payment. |
| Unit suite | 226 PASS / 0 FAIL / 9 SKIP | Final `npm test`; skipped groups require isolated MySQL/HTTP/migration services that were not run. |
| Typecheck | PASS | `npx tsc --noEmit` and final isolated production build typecheck. |
| Lint | PASS with 2 existing warnings | Existing unused variables in `tests/staging/sandbox-policy.mjs` and `tests/staging/sandbox.integration.mjs`. Changed-file lint has no warnings. |
| Build | PASS | Final isolated Next.js 16.4.2 Turbopack production build, 28 prerendered pages. Duplicate-lockfile root warning comes from the nested renderer copy. |

Browser fixture transport was also made direct-to-loopback in the help and public-copy suites. Their prior virtual-origin proxy intermittently failed on cancelled navigation/prefetch fulfillment (`Route is already handled!`). API/external interception and local-target guards remain in place; assertions were not weakened.

The initial new interaction regression reproduced 13 failures before the UI fixes. The clipboard regression independently reproduced failure in all three locales before the clipboard fix. Baseline numeric measurements showed desktop neighbour heights changing from 360 px to 664.25 px when one dropdown opened; after the fix, neighbouring heights/positions stay unchanged. Screenshots of settled expanded cards were inspected locally.

## Public site observation and boundaries

[Production](https://cloudy-pink-store.vercel.app) was inspected read-only before local changes: `/`, `/roblox`, `/apps`, `/games`, `/help`, `/privacy`, `/admin` × three viewports = **21 checks**. All returned HTTP 200 with no page JavaScript errors or page-level horizontal overflow. Roblox details opened/closed with pointer and keyboard. The public Roblox page offered Gamepass and Login checkout links; Username had no buy link at that observation. All non-GET and off-origin requests were blocked by the browser harness; no order was attempted. This observation does not publish or verify the new local fixes.

There was no real Sandbox/Production checkout, webhook settlement, account/Robux delivery, provider QR download, authenticated remote admin mutation, scheduler operation, remote database access or catalog/stock creation. This is UI/local readiness, not operational release proof. Existing Login activation/retention/restore gates and catalog availability remain separate.

## Artifacts and reproduction

Logs and screenshots are local-only under `.cache/interaction-20261028/`. Main evidence files: `interactions-final.log`, `help-final.log`, `apps-final.log`, `market.log`, `login.log`, `login-asean-final.log`, `admin-access.log`, `admin-id-final.log`, `general-results.json`, `invoice-final.log`, `invoice-download-final.log`, `unit-tests-final.log`, `build-final.log`, `typecheck-final.log`, `lint-final.log`. Expanded-card screenshots: `after-375.png`, `after-1440.png`; public snapshots: `public-roblox-{375,810,1440}.png`.

Use the existing Playwright installation through `PLAYWRIGHT_MODULE` or the script argument and point `TEST_RENDERER_URL` to the isolated local renderer. `service-help.e2e.mjs` accepts the renderer as its second script argument. The older Login/admin suites use loopback port 3144 behind `https://store.invalid` fixtures. Keep credentials and remote services out of the renderer. Temporary renderer processes are stopped after verification.

## Main publication preflight — 28 October 2026

The owner explicitly requested pushing to `main`. A fresh `git fetch origin main` confirmed the remote baseline is the same `e1bcf02` as the tested source. The checkout was switched to `main` with all uncommitted work preserved. Only this task's source, tests, roadmap checkpoint and QA report are selected for commit; unrelated inventory files, credentials, caches, machine configuration and untracked work are excluded.

The existing Production alias resolves through the Vercel connector to project `prj_Oz6McF6kBIkykqRNw8cqo5ousj9m` (`cloudy-pink-store`), baseline deployment `dpl_JqCoULcJXb26jCktLvrf9pbEdcGh`, READY at `e1bcf025329d098245d2aee1884e38eba8316c47` on `main`. Git push should trigger the existing integration; do not create a second deployment or change environment settings. The project-details request with explicit team scope returned 403, while deployment inspection by the existing public alias succeeded.

`npm audit --omit=dev` reports **0 vulnerabilities**. Full `npm audit` reports one existing high advisory for transitive, dev-only `zod@4.6.5`, brought in solely by `eslint-config-next → eslint-plugin-react-hooks` (and its validation-error helper). [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) concerns memory exhaustion while validating oversized collections; patched version is 4.6.6. Application source/tests do not import Zod, and this dependency is used by linting repository-owned configuration, not public request data. The vulnerable collection input is not reachable from this release's runtime or deployment inputs. No dependency/lockfile change is part of this UI release. Defer the tooling patch to a separately reviewed update; review date **29 October 2026**. This is a documented dev-tool advisory, not a clean full audit.

Publication must still be confirmed independently by remote commit SHA and matching Vercel READY/alias evidence, followed by read-only public smoke checks. Local/fixture payment and delivery boundaries above remain unchanged after publication.
