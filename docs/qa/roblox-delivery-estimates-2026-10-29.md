# Roblox delivery estimates — 29 October 2026

## Owner-approved copy

The owner supplied these service estimates: Gamepass **5–10 days**, Login **2 × 24 hours**, Username **1–60 minutes**. They are displayed as estimates, with queue/verification caveats, rather than guaranteed deadlines. No business-day qualifier or new start-time promise is added. The Gamepass explanation continues to distinguish team processing from Roblox's pending period.

## Implementation

- `src/lib/serviceHelpTranslations.ts` owns the ID/EN/MY estimate strings. The timing FAQ and customer components reuse those values.
- `RobloxServiceCards` displays each estimate directly above its disclosure; opening the dropdown is not required.
- Gamepass/Username introductions and the Login flow display the same method-specific estimate and qualification.
- Payment expiry, order creation, fulfillment transitions, the Login 72-hour credential lifetime, prices, inventory and provider integration are unchanged. Earlier local wizard/logo work and unrelated inventory documents are preserved.

## Verification

- Reproduction: the new browser assertion fails on the previous isolated build because the approved estimate is not visible on the closed card. Evidence: `.cache/roblox-estimates-20261029/red-results.json`.
- Typecheck: PASS. Focused ESLint: PASS.
- Isolated production build: PASS, Next.js 16.4.2, typecheck and 28/28 prerendered routes. The nested renderer's existing multiple-lockfile warning is not an application failure.
- Browser verification: **111 PASS, 0 FAIL** across the affected suites: wizard appearance 54, storefront interactions 20, service-help/invoice/region gates 37. Locale/viewport coverage is ID/EN/MY at 375×812, 810×1080 and 1440×900. Independent expected strings verify all three approved estimates outside closed card disclosures and inside the timing FAQ; wizard checks verify the same localized copy before checkout.
- Test synchronization follows actual UI readiness: wait for the requested locale's estimate after hydration and the FAQ paragraph after the native disclosure opens. This resolves initial test timing failures without changing application behavior or adding sleeps.
- Screenshot review confirms the three estimates on desktop comparison cards and mobile Login. Closed-card heights, independent dropdown expansion, drafts, failed-submit retry, unknown-region blocking and invoice edge states remain covered.
- Final affected source hashes match the isolated renderer. Whitespace checks and static review pass. Domain/unit suites were not repeated for this copy/presentation change; no database integration or real delivery-time measurement was performed.
- Renderer shutdown output also contained five sanitized `Commerce operation failed INTERNAL_ERROR` messages. Their origin was not traced in this presentation-only scope; the intentionally blocked backend is not integration evidence. Browser error/unexpected-request assertions remained green.

Browser APIs are synthetic fixtures with unexpected API/external requests blocked. The renderer rejects env files and uses a deliberately blocked localhost database target in a sanitized environment. These checks do not measure real delivery times or prove payment/provider/fulfillment behavior.

## Artifacts and release boundary

Build/typecheck/lint/browser logs are under `.cache/roblox-estimates-20261029/`. Browser captures/results are under its isolated `app/.cache/` directory: `wizard-polish-20261029/browser/`, `interaction-20261028/browser/`, and `service-help-20261018/browser/`.

This is local work on `main`; no commit, push, deployment, database operation, provider call or real order is requested or performed.

The isolated renderer is stopped after verification.

## Publication authorization

The owner explicitly requested `push ke main` after reviewing the completed visual and estimate work. Publication scope includes the tested wizard/header/translation changes, the transparent logo, the two affected browser suites, their two QA documents and roadmap updates. Unrelated inventory documents, prior release-evidence edits, local skills, mockups, scripts and machine configuration are excluded. The configured `origin/main` matches local base `0c42f5549922ef4d803241935e22a14fb66513eb`; the existing Vercel project is confirmed as `jax-v12/cloudy-pink-store` (`prj_Oz6McF6kBIkykqRNw8cqo5ousj9m`). No environment, payment-mode, database or provider change is included. Push status and deployment readiness must be verified separately.
