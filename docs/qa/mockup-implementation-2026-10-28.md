# Mockup implementation — 28 October 2026

## Scope and current state

Implemented locally on `main`, uncommitted and unpublished. Owner approved implementing the selected mockup collection after reviewing images, with the latest preference for simple white panels, dark/neutral text and restrained pink accents. Earlier ornate/blue-text variants are superseded. Unrelated inventory documents, existing untracked files and other work remain intact.

- Home: supplied logo and Anya service artwork, two-column desktop hero, separate service cards, invoice lookup and purchase steps. Mobile stacks the content. Navigation, recent-orders dialog and contact-button placement remain functional.
- Apps: retain real search, pagination, stock/availability and checkout; show account type, duration and warranty from each product's existing configuration. No illustrative catalog or stock was inserted.
- Roblox: restrained method icons/cards; Gamepass keeps five steps and Username four, including identity lookup, quantity input/slider, email, distinct Gamepass creation/link step, payment selection and final confirmation. No added WhatsApp field or fabricated Gamepass verification button.
- Login: small monochrome Robux icon and three columns from the small/tablet breakpoint, two on narrow phones. Existing three stages, five backup-code fields, guide, contact, consent, encrypted credential lifecycle and recovery flow remain unchanged.
- Invoice: compact brand logo, plain background, neutral informational panels and one monetary total for Roblox. Payment breakdown, progress, QRIS countdown/download, authorization and Apps delivery behavior are preserved.

No API/schema/dependency/auth/payment/GeoIP configuration changed. Actual prices, limits and availability still come from existing application data. All new assets in `public/store/` are copies of the owner's supplied artwork, rendered with Next Image; screenshots themselves are not shipped as page backgrounds.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript | PASS | `npx tsc --noEmit`; final isolated production build typecheck also passed. |
| Lint | PASS with warnings | 0 errors; two pre-existing unused-variable warnings in staging tests. |
| Unit/domain suite | 226 PASS, 0 FAIL, 9 SKIP | Existing repository register hook and a sanitized process environment; no test DB/HTTP/migration targets configured. SKIPs are not integration evidence. |
| Production build | PASS | Next.js 16.4.2, 28 prerendered pages; isolated copy, no env files, blocked loopback DB URL. Nested lockfile warning is specific to the renderer copy. |
| Appearance | 54 PASS, 0 FAIL | Six views across ID/EN/MY at 375×812, 810×1080, 1440×900. Decoded-image loading, overflow, invoice tracking, Apps terms and three-column Login grid. |
| Interactions | 20 PASS, 0 FAIL | Dropdown targets/animation/reduced motion, stable neighbours, Gamepass/Username drafts, guide, confirmation/retry and dialog keyboard behavior. |
| Help/progress | 37 PASS, 0 FAIL | Locale/viewport links, independent methods, payment/fulfillment transitions, edge states and unknown-region checkout gate. |
| Login attempts | 43 PASS, 0 FAIL | Three stages, validation, navigation, safe bootstrap, double submit, recovery, two tabs and non-Login regressions. |
| Static review | No remaining actionable findings | Hero dimensions corrected to actual 1774×887; mobile logo fits beside recent-order badge. |

Browser total: **154 PASS / 0 FAIL**. All API calls are intercepted fixtures. These checks prove local rendering/interactions, not database/provider/payment/delivery or operational readiness. QRIS appearance screenshot uses a clearly labeled fixture graphic, not a payment code. No remote DB, Sandbox charge, customer order, commit, push or deployment was performed.

## Test diagnosis

One existing card-position assertion initially failed in desktop MY: focusing the disclosure scrolled the page 6 px. Sibling heights remained 456 px and their document positions were unchanged; their viewport positions all moved by -6 px. The test now compares `getBoundingClientRect().y + scrollY` before/after. Height assertions and the 1 px tolerance remain intact, so real neighbour movement still fails. Final interaction suite passes.

The new appearance fixture initially omitted the invoice's existing status-reconciliation POST; it was blocked and reported as an unexpected request. The fixture now responds synthetically to that exact endpoint. No application payment code changed. The first interaction invocation also needed the repository's `tests/register.mjs` loader for extensionless TypeScript imports; final runs use that loader.

## Artifacts and rerun

Local logs, isolated renderer and screenshots: `.cache/mockup-implementation-20261028/`. Representative final screenshots in `browser/`:

- `home-1440-ID.png`, `home-375-ID.png`
- `apps-375-ID.png`
- `login-packages-810-ID.png`
- `invoice-pending-375-ID.png`, `invoice-paid-375-ID.png`, `invoice-completed-375-ID.png`

Use the existing external Playwright installation via `PLAYWRIGHT_MODULE`, set `TEST_RENDERER_URL` to the loopback renderer, and run `node --import ./tests/register.mjs tests/mockup-appearance.e2e.mjs`. Existing interaction/help/Login suites remain the regression harnesses. Keep the renderer isolated: no env-file copy and no real API passthrough. Renderer process is stopped after verification.

## Publication authorization

After reviewing the implementation, the owner explicitly requested pushing this change to `main` for viewing. Release scope is the selected UI/source/assets/tests and this QA handoff on the existing Git origin and linked Vercel project. Preflight confirmed local and remote `main` at `f948e477e704923266fe90db9ef8f21083d2628c`, linked project `cloudy-pink-store`, and unchanged local verification evidence above. Other local files remain excluded. No DB/provider/configuration changes are authorized or required. Commit/push/deployment results must be verified separately after publication.
