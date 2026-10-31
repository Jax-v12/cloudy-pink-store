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
