# Storefront visual polish — 29 October 2026

## Scope

The owner approved the five proposed refinements after reviewing the implemented mockups: compact mobile content, fewer nested panels, payment-first pending invoices, clearer supporting text/customer copy, and consistent Roblox cards. Work remains local on `main`; no commit, push, deployment, database/provider operation or configuration change was requested for this follow-up. Earlier unpublished card-alignment work is preserved.

- Home: smaller mobile banner, tighter service-card spacing and simpler purchase steps. Remove the repeated technical trust strip while retaining branding, navigation, invoice lookup and contact placement.
- Apps: remove the filter panel's extra frame; place category and search action on one mobile row. Keep search/filter behavior, product terms, stock and checkout intact.
- Invoice: pending QRIS, countdown and download precede delivery progress in DOM/keyboard reading order. Paid/ended orders show progress before invoice details. Flatten invoice metadata, regional totals and progress containers; retain every price/fee/discount row and existing payment/fulfillment condition. Reserve a responsive square for loading QR images.
- Text: use the existing secondary token, darkened to `#655B6D`, in affected storefront components. Contrast is approximately 6.42:1 on white and 6.18:1 on `#FFF9FC`. Replace server implementation wording with price/order review guidance in ID/EN/MY.
- Roblox: consistent `Robux via Gamepass`, `Robux via Login`, `Robux via Username` headings, smaller desktop header minimum height, independently expanding disclosures. Login cards omit a package name only when it duplicates the displayed amount; distinct admin package names remain visible.

No API, schema, pricing calculation, auth, regional gate, checkout state, payment reconciliation or secret lifecycle changes.

## Verification

- Red: new pending-invoice reading-order assertion failed on the previous build (`375 ID`, QRIS followed progress).
- Final isolated production build/typecheck: PASS, Next.js 16.4.2, 28 prerendered pages. Renderer copies source/assets/config only, rejects env files, uses a blocked localhost database URL and existing dependencies. Multiple-lockfile warning is specific to this nested renderer.
- Focused ESLint: PASS, including the final QRIS/test edits.
- Unit suite: 226 PASS, 0 FAIL, 9 SKIP. No configured test database/HTTP/migration targets; skipped tests are not integration proof.
- Appearance: 54 PASS, 0 FAIL across ID/EN/MY at 375×812, 810×1080 and 1440×900. Includes pending/paid/completed order placement, image loading, no overflow, Login nominal deduplication and retention of distinct package names.
- Interactions: 20 PASS, 0 FAIL, covering independent disclosures, equal closed-card heights, reduced motion, keyboard, Gamepass/Username wizard drafts and retry behavior.
- Help/progress: 37 PASS, 0 FAIL, including expired/cancelled/refund states, Apps without delivered credentials and unknown-region purchase blocking.
- Login attempt regression: 43 PASS, 0 FAIL, covering package/account/summary navigation, credential masking and refresh cleanup, safe bootstrap/recovery, duplicate submission and other service navigation.
- Static review identified missing QR image dimensions and a skipped heading level; both are corrected. Browser inspection confirms mobile home/Apps/invoices, tablet Login and desktop home/cards.
- Additional single-product fixtures: desktop cards equal at 1024 (362.5 px) and 1440 (346.5 px), with identical buy-button positions. Mobile cards stack without overflow.

All browser API responses are isolated synthetic fixtures; unknown external traffic is blocked. Product amounts and the visibly labeled QR fixture in screenshots are not real catalog/payment evidence.

Final browser total: **154 PASS, 0 FAIL**. Whitespace check PASS and static review has no remaining actionable findings. The isolated renderer was stopped after verification.

## Artifacts

Logs, final screenshots and capture scripts: `.cache/storefront-polish-20261029/`. Main previews:

- `browser/home-375-ID.png`, `browser/home-1440-ID.png`
- `browser/apps-375-ID.png`
- `browser/invoice-pending-375-ID.png`, `browser/invoice-paid-375-ID.png`
- `browser/login-packages-810-ID.png`
- `card-aligned-1440.png`

Existing unrelated inventory documents, mockups, scripts and untracked work remain intact. Publication requires a new request for this change.

## Mobile contact overlap follow-up

The owner's latest screenshot showed the floating contact pill covering the Apps service heading. On screens below 640 px the same contact link now participates in normal page flow before the footer, with a minimum 44 px touch target. Tablet/desktop retain the existing floating position, destination and service-specific message. Admin exclusion and localized accessible name are unchanged.

The new geometry regression failed against the previous UI (`375 ID`: contact intersects a service card). After the fix, the 54-case ID/EN/MY appearance matrix passes, including mobile non-overlap and touch-target checks. Isolated build/typecheck, focused lint and whitespace checks pass. Visual inspection confirms the mobile Apps heading is unobstructed. This is a local follow-up; no publication or WhatsApp message was performed.

## Publication authorization

The owner explicitly authorized pushing these storefront refinements and the mobile contact position fix to Vercel via `origin/main`. Release scope is limited to the tested UI components, styling, translations, regression tests, roadmap updates, and this QA document. Preflight confirmed passing unit suite (226 PASS / 0 FAIL / 9 SKIP), typecheck, lint, isolated production build (28/28 prerendered routes), and 154 browser appearance/interaction checks. Unrelated inventory drafts, mockups, and local environment files remain excluded.
