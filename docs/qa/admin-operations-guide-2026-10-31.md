# Fulfillment presentation and operations guide — 31 October 2026

Owner requested correction of the fulfillment cards shown in an attached image and an operations guide within the admin dashboard. Apps Premium and all three Roblox methods remain available; stock preparation remains deferred.

## Changes

- Unpaid, expired and cancelled orders no longer show a delivery/refund evidence input with no applicable action. This reuses `showFulfillmentDetails` from the existing invoice presentation policy, while preserving cancelled orders that still have a refund obligation. Archived/removed and completed records do not expose active delivery inputs.
- NOT_READY delivery on expired/cancelled orders is shown as delivery not started. A paid NOT_READY order is presented for review instead of suggesting payment is still awaited. Terminal payment cards explain that delivery must wait for verified reconciliation of any payment claim. These are presentation changes; server order states and allowed transitions are unchanged.
- Paid Login instructions are no longer displayed on expired/unpaid orders. Card typography, status badges, spacing and text contrast are clearer; empty provider/admin history disclosures are omitted. Search/evidence placeholders are localized.
- The Operations guide button appears in the main admin dashboard, commerce fulfillment/catalog page and Apps admin. Its scrollable dialog checks the existing `/api/admin/auth` session endpoint whenever opened, then shows Apps Premium, Gamepass, Via Username, Via Login and problem/refund/history instructions. Unauthorized and failed checks do not reveal the guide body; a failed check can be retried. The generic guide text is static client content, not confidential server data.
- Native service disclosures participate in the existing dialog focus trap. Escape/close restores the trigger's focus; the guide does not navigate away or discard the delivery-reference draft. Closing during a session request aborts the request. All new UI/guide text is available through LanguageContext in ID/EN/MY.
- Instructions follow existing implementation: verified payment before fulfillment, assigned ownership, Login recent reauthentication/60-second reveal/72-hour order-age bound, dedicated encrypted delivery forms, non-sensitive delivery evidence, manual refund recording, and preservation of financial history. No new SLA, warranty or provider action is implied.

## Verification

| Check | Result |
| --- | --- |
| Reproduction | The new browser test failed against the prior release because an expired Login order exposed an evidence input. Initial cold navigation exceeded the 10-second navigation timeout; the navigation-only allowance was aligned with existing browser harnesses, retaining the 10-second UI assertion timeout. The reproduced input failure then occurred immediately. |
| Unit regression | **254 PASS / 0 FAIL / 9 SKIP**. DB integration prerequisites are not configured for this UI task; prior 308/0/0 evidence remains separate. |
| TypeScript | `npx tsc --noEmit`: PASS. |
| ESLint | Focused runtime/test ESLint: PASS, including the final browser harness. |
| Default production build | Next.js 16.4.2 **Turbopack PASS**, BUILD_ID `23ibMrYayz68CQfpeqfIj`. Environment-free snapshot `.cache/admin-operations-20261031/app-turbo`, unusable local test database port 0. All eight changed runtime files match the browser-tested build bytes. |
| Additional Webpack check | Compilation passed, but generated route type checking FAILED on the pre-existing `handleQrisDownload` export in `src/app/api/orders/[id]/qris/download/route.ts`. That file has no task diff and remains unchanged. No type check, API guard or assertion was disabled. The project-default Turbopack build and standalone typecheck pass; Webpack compatibility is a separate baseline finding. |
| New browser suite | **9 locale/viewport scenarios PASS**, covering pending/expired/cancelled/completed/archived/paid/refund-required orders; guide opening from all three admin pages; five guide sections; valid/denied/failed-and-retried session checks; keyboard cycling/Escape/focus restoration; no mutation requests; and preservation of an entered delivery-reference draft. |
| Existing admin regression | **10 PASS**, covering pagination/selection and editor focus, busy-close prevention and input retained after failure. |
| Visual | ID/EN/MY at 375×812, 810×1080, 1440×900. Mobile ID expired-card viewport, tablet MY guide and desktop EN expired card inspected. Captures use synthetic identities, invoices and prices, not data from the attached image. A focused mobile scenario was rerun after adding the viewport capture; it is not counted as another unique scenario. |
| Whitespace/review | Relevant `git diff --check`: PASS. Reviewed session denial/abort behavior, display-only status decisions, shared dialog semantics, existing refunds/archive rules and guide content against server implementations. |

The 19 unique browser scenarios use a loopback renderer and intercepted auth/order APIs. They prove UI behavior, not authenticated Production admin access, real provider settlement, customer delivery or Aiven retention/restore readiness.

## Scope and handoff

Runtime files: `src/components/FulfillmentAdmin.tsx`, `AdminOperationsGuide.tsx`, `AppsAdmin.tsx`; `src/app/admin/page.tsx`, `src/app/admin/commerce/page.tsx`; `src/lib/adminGuideTranslations.ts`, `robloxOpsTranslations.ts`, `translations.ts`. Regression: `tests/admin-operations.e2e.mjs`.

No API/schema/dependency/payment-mode change, remote database/provider call, customer mutation, commit, push or deployment. Existing local work is preserved. Screenshots and renderer helpers remain under `.cache/admin-operations-20261031/`; the local renderer is stopped after verification. The attached private order image is not copied into the repository or QA artifacts.

Follow-up: the owner then requested hiding unusable expired orders. Archive eligibility and the guide now include safe closed unpaid top-ups, with verified late-payment reopening; [follow-up verification](closed-order-archive-2026-10-31.md) supersedes the earlier completed-orders-only archive rule. Latest configured integration result is 320 PASS / 0 FAIL / 0 SKIP; the earlier UI-only counts above remain historical.

Publication follow-up: the owner authorized deployment. The guide, fulfillment presentation and closed-order archive were published together in commit `2d374aacfd7bf86ee135f5c45500cf8abe80da45`; Production deployment `dpl_7E243Mn1p5YaRxAjrL6teHPJ46ia` is READY on the same SHA and primary alias. Live public browser smoke passes 63/63; deployed admin assets pass all nine locale/viewport fixture scenarios. Real unauthenticated admin GETs correctly return 401; no real authenticated customer/order mutation was performed. [Publication details and evidence limits](closed-order-archive-2026-10-31.md#verified-publication--31-october-2026). This post-release handoff remains local.

## Smooth guide interactions — local follow-up, 31 October 2026

The owner requested smoother guide interactions after publication. The guide now keeps a stable viewport-bounded height, scrolls its content independently, and leaves its title and close button visible. Its panel/backdrop enter in 180 ms and leave in 140 ms; unmount and focus restoration wait for the actual closing animation, including animation cancellation and reduced-motion behavior. The pending session check is aborted as closing begins. No fixed delay or new dependency is introduced.

Service sections reuse the existing `store-disclosure` animation and native details/summary keyboard behavior, with a rotating decorative chevron. Unsupported disclosure-animation browsers retain the native fallback; nonessential motion respects the existing reduced-motion policy. Shared AdminDialog only accepts an optional className; other dialogs retain their existing behavior. No UI text, authorization contract, order state or payment logic changed.

- RED: the new desktop fixed-position/height assertion failed against the deployed prior guide, using intercepted synthetic APIs. Mobile was already height-capped and did not reproduce this desktop jump.
- Final guide browser suite: **9/9 PASS**, ID/EN/MY at 375×812, 810×1080 and 1440×900. Frame samples prove intermediate expansion AND collapse heights in supported Chrome, stable dialog bounds, reduced motion, focus/Escape, session denial/retry, entry points and retained delivery drafts. All APIs are fixtures; no customer mutations.
- Existing admin/editor browser regression: **10/10 PASS**. Production build **PASS**, BUILD_ID `Nf9eV0JNq6gt5VJuZxdy5`; all three changed runtime files match this snapshot. Standalone TypeScript, focused ESLint and whitespace **PASS**.
- Unit suite: **258 PASS / 0 FAIL / 10 SKIP**. MySQL/HTTP integration prerequisites are intentionally absent for this UI follow-up. The first harness run incorrectly set production NODE_ENV for unit fakes and failed; corrected to test mode without application changes or weakening isolation. Additional harness fixes used the package's actual ESLint executable path and a relative Windows ESM preload. Browser checks sample disclosure height directly because native pseudo-element transitions are not included in the element animation inventory; reduced-motion checks allow the existing global 0.01-ms focus transitions.
- An initial build was stopped while external Google font requests stalled; the completed final default Turbopack build uses IPv4-first DNS preference, with actual font retrieval and no mocked fonts, relaxed TLS or quality-gate bypass. Existing nested snapshot workspace-root warning remains informational.
- Inspected mobile ID and desktop EN captures. Evidence: `.cache/guide-smooth-20261031/` (build, unit, lint, types, browser and admin-regression logs/screenshots). No Firefox/Safari/device performance claim or new Production verification. This follow-up is **unstaged and not committed, pushed or deployed**; unrelated local work remains preserved.

Native disclosure enhancement reference: [Chrome for Developers](https://developer.chrome.com/blog/styling-details). The existing shared implementation is reused rather than adding another accordion controller.

Release authorization follow-up: the owner explicitly requested deployment of these smooth interactions. Target remains the existing `cloudy-pink-store` Vercel Production project through Git `main`. The release contains only AdminDialog, AdminOperationsGuide and its CSS module, the focused browser regression, this guide QA and the single relevant roadmap entry. Unrelated local inventory, QA and roadmap work remain excluded. No migration, environment, direct database or real payment changes are included. Exact publication identity and live smoke results follow after deployment.
