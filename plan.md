# Cloudy Pink Store — Project Plan & Source of Truth

> This file is the persistent product plan for Cloudy Pink Store.
> Before changing architecture, routes, database models, checkout logic, admin flows, or Roblox behavior, read this file first.
> If code and this plan disagree, inspect the current code and preserve working behavior unless the user explicitly asks for a redesign.

## 1. Project Goal

Cloudy Pink Store is an e-commerce platform with three clearly separated service areas:

1. **Apps Premium** — existing feature set; already fairly complete and must keep working.
2. **Roblox Top-up** — current development focus.
3. **Game Top-up** — planned for later through a third-party provider/API.

Do not merge these three user journeys into one confusing catalog. They may share infrastructure such as authentication, payments, currency, order status, and admin components, but their customer-facing flows should stay distinct.

## 2. Current Priority

**Pembelian dan tampilan Game Top-up dinonaktifkan lokal, 31 Oktober 2026:** atas permintaan pemilik agar fokus Apps Premium dan Roblox selama katalog Game kosong, saklar kode `GAME_TOPUP_PURCHASES_ENABLED` default `false` menutup pembelian baru melalui gate server yang sama dengan katalog/checkout. Tindak lanjut visual menyembunyikan kartu/menu Game, menata dua kartu Apps/Roblox seimbang di tablet/desktop dan bertumpuk di mobile, serta memperbarui panduan pembelian ID/EN/MY. `/games` serta tautan detail lama tetap menampilkan pemberitahuan dan tautan Apps/Roblox tanpa formulir pembelian. Saklar memerlukan rebuild/rilis, bukan toggle admin; pengaman provider Production tetap berlaku. Bukti awal: 254 PASS / 0 FAIL / 9 SKIP; tindak lanjut visual: 25 tes terarah dan 36 skenario browser PASS, typecheck/lint/build terisolasi lulus. Tidak ada commit/push/deploy/akses DB remote/transaksi provider; fixture MySQL yang disesuaikan belum dijalankan pada MySQL. [QA dan batas bukti](docs/qa/game-purchases-paused-2026-10-31.md).

**Wizard/estimate publication authorized, 29 October 2026:** owner requested pushing the completed local display and delivery-estimate changes to `origin/main`. Release scope includes only the reviewed storefront/wizard components, translations, transparent header logo, affected browser tests and their QA/roadmap documents. Existing inventory edits, prior-release QA additions and unrelated untracked work are excluded. Local build/typecheck/lint and 111 affected browser checks pass; the preceding broader visual/interaction QA remains recorded below. Source push and matching-SHA Production verification are separate steps. See [publication scope](docs/qa/roblox-delivery-estimates-2026-10-29.md#publication-authorization).

**Owner-supplied Roblox delivery estimates implemented locally, 29 October 2026:** Gamepass 5–10 days, Login 2 × 24 hours, Username 1–60 minutes are visible on the method cards, ordering pages and timing FAQ in ID/EN/MY. All surfaces reuse the same translated values and identify them as estimates. Gamepass pending guidance, payment expiry, fulfillment and Login retention remain unchanged. Typecheck/focused lint/isolated build/whitespace PASS; 111 affected browser scenarios PASS. No remote database/provider operation, commit, push or deployment. See [delivery-estimate QA](docs/qa/roblox-delivery-estimates-2026-10-29.md).

**Roblox wizard visual priorities implemented locally, 29 October 2026:** owner requested display refinements before new features. Duplicate Gamepass/Username descriptions and excess frames are removed; the three methods share a stepper style while retaining 5/4/3 steps and existing navigation guards. Prices/actions have clearer emphasis, single-package Login uses a full-width row with localized selection guidance, method copy is consistent, and the header uses a transparent version of the existing logo. Local verification: 226 unit PASS / 9 SKIP, 208 unique isolated browser scenarios PASS, final affected 54-case matrix rerun PASS, typecheck/lint/build/whitespace PASS (two existing staging-test lint warnings). No additional features, API/schema/dependency changes, remote database/provider operation, commit, push or deployment. See [wizard visual QA and previews](docs/qa/roblox-wizard-visual-polish-2026-10-29.md).

**Storefront polish published, 29 October 2026:** owner-authorized commit `0c42f5549922ef4d803241935e22a14fb66513eb` is pushed to `origin/main`. Existing-project Production deployment `dpl_9d3wKMiJnN5qttkJT4Y3Vcji6v6v` is READY with matching SHA and primary alias; public read-only smoke checks PASS across mobile/tablet/desktop. Refinements include compact mobile home/Apps, flatter panel hierarchy, pending-payment QRIS priority and paid delivery progress priority, clearer customer copy, consistent Roblox card headers, and mobile contact button relocation before the footer to prevent card obstruction while retaining floating behavior on tablet/desktop. See [storefront polish QA](docs/qa/storefront-polish-2026-10-29.md).

**Mockup UI published, 28 October 2026:** owner-authorized commit `7a40eedc14ab72823cb26329d1be8fc77c54ce3b` is pushed to `origin/main`. Existing-project Production deployment `dpl_64eU95bAF6ngMnEwF8RveTPnt6C9` is READY with matching SHA and primary alias; **18/18 read-only public smoke checks PASS** across mobile/tablet/desktop. No DB/provider/configuration changes. Release evidence is appended locally to the [mockup implementation QA](docs/qa/mockup-implementation-2026-10-28.md); the implementation checkpoint below records pre-publication verification.

**Selected mockup implementation, 28 October 2026:** owner approved local implementation after reviewing the collected mockups and requested simpler styling. Home branding/service artwork, Apps package metadata, restrained Roblox panels/icons, responsive Login package grid, and simplified invoice presentation are implemented on the current `main` checkout. Existing Gamepass five-step, Username four-step, Login three-stage and Apps/QRIS behavior remain intact. Verification: **226 unit PASS / 9 SKIP**, **154 isolated browser PASS**, typecheck/lint/build PASS (two existing lint warnings). No API/schema/dependency/configuration changes, remote DB/provider operation, commit, push or deployment. These are local fixture results, not operational/payment proof. See [implementation evidence and screenshots](docs/qa/mockup-implementation-2026-10-28.md).

**Interaction QA and local fixes, 28 October 2026:** owner requested broad feature checks and smoother dropdown/button/step interactions, especially Roblox cards. Local fixes isolate each card's expansion, enlarge disclosure targets to 44 px, animate native disclosures with reduced-motion support, restore wizard back-step focus, and report invoice clipboard success/failure accurately. Verification includes the ID/EN/MY viewport matrix, 20 new interaction cases, 37 help/progress cases, Apps, Login/admin fixtures and regional gates; final unit suite **226 PASS / 0 FAIL / 9 SKIP**, typecheck/lint/build PASS (two existing lint warnings). Separate public read-only observation covers 21 page/viewport checks. Changes remain uncommitted and unpublished on the existing feature branch; no real transaction, remote database operation or delivery proof. See [interaction QA, evidence and boundaries](docs/qa/store-interactions-2026-10-28.md).

**Roblox UX streamlining & Mayoblox benchmarking, 27 October 2026:** UI/UX optimized based on the Mayoblox comparison report ([docs/qa/mayoblox-comparison-2026-10-27.md](docs/qa/mayoblox-comparison-2026-10-27.md)). Starting price and direct buy CTA placed at the top of Roblox service cards; requirements, process, and timing folded into accessible <details> summaries (detailsSummary). Hero and location bar vertical padding tightened on mobile viewports, lifting the Gamepass buy CTA into the initial viewport fold (y=633-673 px vs y~1430 px previously). Added 3-step indicator (packages -> account -> summary) and collapsible backup code guide (backupGuideTitle, backupGuideSteps) to LoginFlow. Integrated area-aware WhatsApp support messages (whatsappRobloxMessage, whatsappGeneralMessage, whatsappMessage). Full i18n support maintained across ID/EN/MY. All verification suites PASS: npx tsc --noEmit (0 errors), npm run lint (0 errors), unit tests 20/20 PASS, npm run build PASS (Turbopack Next.js 16.4.2), Playwright visual tests 9/9 PASS, E2E service help 28/28 PASS, and login attempt 18/18 PASS. See [QA verification and boundaries](docs/qa/roblox-ux-streamlining-2026-10-27.md).

**Indonesia-only public market scope, 24 October 2026:** public storefront sales, quotes, Apps catalog prices, and Apps renewals now require verified Indonesia (`ID` / `IDR`), while stored `MY`/`PH` prices remain intact for admin configuration and historical orders. Existing idempotent order replay and authorized invoice access continue to work if a buyer's location changes after purchase. Full local test suite passes (**283 PASS / 0 FAIL / 0 SKIP** across unit, MySQL, HTTP, and migration suites + **9 PASS** in `tests/apps-roadmap.integration.mjs`), isolated production build on Next.js 16.4.2 / Node 24.22.1 passes, and **45 Indonesia-market browser scenarios + 9 Apps roadmap browser scenarios PASS** across `ID`/`EN`/`MY` and `375×812`, `810×1080`, `1440×900`. Committed as `5b2b85b6a80d370530401899e1d4f9de9dee4e9f` and pushed to `origin/feat/roblox-login-checkout-recovery`; Vercel Preview `dpl_68QbRnouC3a35hQGi9XuqcMdJTd5` ([`cloudy-pink-store-urb2fgz3b-jax-v12.vercel.app`](https://cloudy-pink-store-urb2fgz3b-jax-v12.vercel.app)) is **READY** with **6/6** authenticated HTTP smoke checks passing (`region: "ID", reason: "detected"`). `main` remains at `6757c56`. See [verification and boundaries](docs/qa/indonesia-market-launch-2026-10-24.md).

**Catalog copy fixes and purchase recheck, 21 October 2026:** P2 blanket product claims replaced with package/active-period/warranty guidance; P3 catalog search uses its own ID/EN/MY label while order tracking retains its existing action. Actual local paid-invoice testing exposed long-password mobile overflow; scoped text wrapping fixes it without changing credential values or access. Nine real-local-API browser cases PASS across the required locale/viewport matrix, plus HTTP sold-out rejection with no new order and denied invoice access. Seven Apps tests, typecheck, isolated final build, and lint checks pass (full lint has three warnings outside changed files). Current Preview Apps catalog is still empty. Fixes are local, not published; Preview purchase and actual callback delivery remain unverified. See [fixes, evidence, and remaining boundaries](docs/qa/catalog-copy-purchase-recheck-2026-10-21.md).

**Preview / Midtrans Sandbox verification, 21 October 2026:** Preview `72fd78e` remains READY. Nine deployed HTTP checks and 18 real browser page/locale/viewport cases PASS; Apps catalog returns zero products, so deployed CapCut purchase remains blocked by unavailable inventory. A separate purchase against isolated localhost `cloudy_test_capcut_purchase_20261021` completed through the official Midtrans Sandbox simulator at IDR44,000: provider settlement verified, private invoice delivery passed, one synthetic account SOLD, zero READY. Five local webhook-handler cases passed with constructed signed payloads and real provider status queries; actual Midtrans-to-Preview webhook delivery remains unverified. No shared database write, remote configuration change, commit, push, or deployment. See [evidence, copy findings, and exact limits](docs/qa/preview-midtrans-sandbox-2026-10-21.md).
**Indonesia release preparation, 25 October 2026:** owner approved Indonesia-only sales and Indonesian default copy while retaining EN/MY. The selective release starts at Production `fbe7e62`, includes the reviewed Indonesia gate from `5b2b85b` and copy corrections, and excludes admin consolidation `c43407d`. Local verification: 226 PASS / 0 FAIL / 9 SKIP, typecheck/lint/build PASS, 54 browser fixture scenarios PASS. Production publication requires matching-SHA/Ready/alias verification; final CapCut product terms and real stock validity remain unresolved. See [scope, evidence and release boundaries](docs/qa/indonesia-public-release-2026-10-25.md). Historical checkpoints below do not supersede this scope.

**Production source release, 20 October 2026:** reviewed Apps/OTP changes are published via main code merge `606c975` (application tree equals feature `d0f3c3a`). [Production](https://cloudy-pink-store.vercel.app) and [tested Preview](https://cloudy-pink-store-7au8syw4l-jax-v12.vercel.app) are READY at verified SHAs. Production-only aggregate metrics enabled; QA writes intercepted. New UI QA 9/9, real HTTP 13/13, Production renderer/noindex 8/8 PASS; manual cron #18 SUCCESS. Tablet MY CLS 0.4260 → 0.0063 in the same fixture, not field INP/p75. Both specifically approved local restore copies are disposed; encrypted backup deadlines remain. See [final evidence and exact remaining operator/provider tasks](docs/qa/remaining-roadmap-2026-10-20.md). CapCut stays two inactive zero-stock drafts; WhatsApp, real provider tests, guaranteed Aiven retention, reliable five-minute cadence/alert delivery and Telegram webhook setup remain open. Documentation publication after this checkpoint does not change application code.

**Remaining roadmap continuation, 20 October 2026:** owner requested all remaining work and authorized provisional CapCut test data. Two inactive drafts now exist in verified `cloudy_staging`: IDR44,000/MYR10 for 30 days (25-day warranty), IDR13,000/MYR3 for 7 days (7-day warranty), zero stocks; MYR is inventory-only until Apps payment supports it. OTP/admin review fixes, restore Apps quarantine, and attributed Roblox loading-layout fix are complete locally. Nine formerly skipped MySQL/HTTP/migration groups now PASS (53 checks); latest backup restores 26 orders/13 migrations with all Order digests matching. Five actual scheduled cron runs now succeed, but multi-hour gaps still fail the five-minute cadence requirement. Aiven login inspection confirms rotation but not a guaranteed retention TTL/provider-native restore. Follow [remaining-work evidence and release status](docs/qa/remaining-roadmap-2026-10-20.md); previous checkpoints below remain historical. No WhatsApp, Login operational gate, or real CapCut stock is enabled by source publication.

**Published checkpoint, 20 October 2026:** feature `dae9023` is pushed and its [Preview](https://cloudy-pink-store-gal0mqzx7-jax-v12.vercel.app) is READY at the matching SHA. Owner separately approved only the Midtrans expiry fix for main: `cad2e6c`, Production READY on the existing alias. [Cron #12](https://github.com/Jax-v12/cloudy-pink-store/actions/runs/39292455442) manually succeeded; subsequent read-only checks found no expired pending/secret backlog. This does not prove a five-minute scheduled cadence or alert delivery. Deployed QA: 9 localized/viewport fixture cases, 8 real HTTP checks, 2 noindex checks; public performance observations are recorded in [final operational QA](docs/qa/operations-roadmap-2026-10-20.md). WhatsApp/provider retention and operational release gates remain open. Source publication is committed; final evidence/harness authentication update is local, preserving unrelated OTP work without a redundant deployment.

**Operations continuation, 20 October 2026:** owner requested pending items 2/3 and selected WhatsApp H-3/H-1, then confirmed no WhatsApp provider. Two additive Apps migrations are now deployed to verified `cloudy_staging` (13 applied; 26 historical Order digests unchanged). Fresh encrypted backup/round-trip and a seven-day local expiry task are verified separately from provider retention, which still needs Aiven login. Scheduler exists on main but its visible scheduled runs fail on legitimate Midtrans 407 expiry; isolated fix commit `a5bd268` is reviewed. WhatsApp consent/verification, durable no-resend review queue and aggregate metrics are implemented, default nonactive pending operational setup. See [current evidence and remaining release gates](docs/qa/operations-roadmap-2026-10-20.md) and [WhatsApp runbook](docs/plans/apps-whatsapp-reminders.md). Prior local-only schema/reminder checkpoints below are historical; Production application publication is separate.

**Implementation checkpoint, 19 October 2026:** owner requested execution of the benchmark roadmap. P1/P2 and core manual Apps activation/renewal plus basic SEO are implemented locally; real product data, reminder dispatch, metrics and operational release gates remain open. Preserve the two confirmed CapCut package/warranty decisions in the [inventory](docs/plans/apps-product-inventory-2026-10-19.md). See [implementation QA and blockers](docs/qa/benchmark-implementation-2026-10-19.md); no commit, push, remote migration or release is implied. The documentation-only checkpoint immediately below is historical.

**Benchmark direction, 19 October 2026:** retain pink/Anya, mature Apps ready-account sales before adding customer-account activation/renewal, and introduce warranty terms per product with immutable purchase snapshots. Follow P0 → P1 → P2 → P3 → P4 in [Benchmark & Roadmap Peningkatan — 19 Oktober 2026](#benchmark--roadmap-peningkatan--19-oktober-2026), with the [detailed comparison and evidence boundaries](docs/qa/competitive-benchmark-2026-10-19.md). This update records the approved roadmap only; the feature phases are not implemented by this documentation task.

**Customer-experience update, 18 October 2026:** owner-requested priorities 1–3 are implemented locally: `/help` with FAQ and service terms, invoice progress from existing payment/delivery/refund state, and a requirements/process/timing comparison within the three Roblox method cards. All new copy uses ID/EN/MY through LanguageContext. No new delivery SLA, warranty duration or automatic refund policy is introduced. Existing Apps OTP/invoice work is preserved. See [verification and limits](docs/qa/service-help-order-progress-2026-10-18.md); publication and operational Login release gates remain separate.

**Preview publication, 18 October 2026:** owner explicitly approved pushing both `553ad13` and `b3a5a36` to `origin/feat/roblox-login-checkout-recovery`. Remote HEAD is `b3a5a361ffa04bcead32ab73655d27a14f9b8fa7`; the existing project's matching Preview is READY with its feature-branch alias. Real public-page review: 19 PASS; denied-access API checks: 2 PASS; deployed invoice renderer with a synthetic API: 9 PASS. One existing EN/MY paid-status wording issue is documented in the [published Preview review](docs/qa/service-help-preview-2026-10-18.md). No Production promotion or database operation was performed. This post-publication handoff is local documentation, outside the two pushed commits.

**P2 payment-label follow-up:** owner-requested fix/review/local commit `f2efd0c640e8546bf0fa7b61d865efd2e9160f0e` changes EN to `PAID` and MY to `BAYARAN DISAHKAN`. A subsequent explicit push request published it to the same feature branch. The matching Preview at `cloudy-pink-store-kijsbtcpf-jax-v12.vercel.app` is READY; two deployed EN/MY renderer smoke checks pass with synthetic invoice data. Production is unchanged; details and evidence are appended to the Preview QA above.

**Current owner direction, 17 October 2026:** integrate the complete local Via Login feature for Preview then Production on the existing `cloudy_staging` contents. Never access/copy `defaultdb`. New Login credentials expire 72 hours after Order creation; existing stored expiry is not extended. GitHub Actions checks existing cleanup/fulfillment endpoints every five minutes, with a fifteen-minute heartbeat warning. Old checkpoint exclusions and 24-hour policy notes below are historical. Local source/configuration work is authorized; Git publication/release and Sandbox transaction scenarios retain their explicit approval gates. Track code, Preview, operations and Production evidence separately in [current release QA](docs/qa/roblox-login-release-2026-10-17.md).

**Local checkpoint boundary (2026-10-16):** owner authorized one local commit on feat/roblox-login-checkout-recovery, excluding collection/reveal implementation and coupled changes. See [checkpoint manifest](docs/qa/git-checkpoint-2026-10-16.md). Earlier full-tree QA remains historical evidence; the selected snapshot is verified separately. No push/deploy/database operation is authorized.

**Latest verification:** [Laragon integration results](docs/qa/laragon-integration-verification-2026-10-16.md): P1-2 FIXED/VERIFIED locally; P2-3 owner exception RESOLVED. All six MySQL/HTTP groups executed: 53 PASS, 0 FAIL, 0 SKIP. Combined unique regression results: 201 PASS, 0 FAIL, 3 SKIP (empty-schema migration suites). No new runtime/test change or remote/release action.

**Completed current scope (2026-10-16): owner-approved Via Login exception documented and P1-2 verified using Laragon's existing isolated local test environment.** Preserve QRIS, durable checkout/recovery, all three Roblox methods and Apps Premium. Credential collection/reveal and its authorization controls are unchanged. The owner authorized opening Laragon and executing the required local tests, including their synthetic fixtures; no real customer Order/charge or provider call is authorized. The owner subsequently authorized backup and the three reviewed additive SQL updates only on existing localhost cloudy_test_general, plus the named synthetic integration fixtures. Creating a database, other migration targets/chains, staging/defaultdb access, environment/dependency changes and commit/push/merge/deploy remain prohibited. The historical checkout HTTP 400 investigation remains separate.

**P2-3 policy conflict RESOLVED by the owner's explicit exception approval in this conversation, 16 October 2026.** AGENTS.md §10 permits only the existing Via Login password/five-backup-code flow under [mandatory account-access controls](docs/plans/roblox-login-account-access.md): informed final confirmation, memory-only draft, invoice-bound AES-GCM, absolute 72-hour access for new orders, deletion lifecycle, paid active owner/recent reauthentication/audit and private/no-store masked reveal capped at 60 seconds. OTP/cookies/session tokens and other methods remain excluded. Backup/restore and cron behavior still require operational verification before release. Historical BLOCKED checkpoints below are superseded only for this policy decision, not for their unresolved integration/operational evidence.

Do not spend time implementing Game Top-up unless the user explicitly asks for it. Do not redesign or remove existing Apps Premium behavior unless required for compatibility with shared infrastructure.

Roblox must support all three methods:

- **Via Gamepass**
- **Via Login**
- **Via Username**

Do not remove any of these three methods unless the user explicitly asks.

## 3. Roblox Customer Experience

### Roblox landing page

`/roblox` is the main Roblox customer page. It should present the three Roblox methods clearly as separate choices/cards:

- Robux Gamepass
- Robux Via Login
- Robux Username

Each method has its own checkout flow because the required data and fulfillment steps differ.

### A. Via Gamepass

Target flow:

1. Customer chooses **Via Gamepass**.
2. Customer selects Robux amount using a slider/input.
3. Robux amount follows configurable `min`, `max`, and `step` values.
4. The price updates automatically in the visitor's server-resolved local currency (IDR/MYR/PHP) using the matching admin-configured regional Gamepass rate; it must not always show rupiah.
5. Customer enters required customer/Roblox information.
6. System calculates and shows the exact Gamepass price the customer must create so the intended Robux amount is received after Roblox marketplace fees.
7. Customer creates the Gamepass on Roblox.
8. Customer pastes the Gamepass URL.
9. Customer proceeds to payment.
10. After payment is confirmed, the order enters the Roblox fulfillment queue.
11. Admin processes the Gamepass purchase.
12. Order is marked completed when fulfillment is finished.

Important rules:

- Do not use Mayoblox sample prices as store prices.
- Store price/rate must come from admin configuration.
- Server must recalculate and validate amount/price; never trust browser-submitted totals.
- The Gamepass URL field should appear only when the customer reaches the relevant step.

### B. Via Login

Keep this as a distinct Roblox method. The owner approved the narrow account-access exception on 16 October 2026; AGENTS.md §10 and the account-access policy now permit the existing Login password/five-backup-code envelope with the mandatory controls below. This documentation task preserves collection/reveal and its authorization gates. Other Roblox methods still reject these fields.

Approved local flow (operational release checks remain separate):

1. Customer chooses **Via Login**.
2. Customer selects a package/amount.
3. Customer enters Roblox username, password, five distinct backup codes, WhatsApp with a country-code/flag prefix, and notification email. No OTP/session cookie is requested.
4. Customer pays.
5. Paid order enters the fulfillment queue as **Via Login**.
6. The assigned admin claims the verified-paid order and uses recent reauthentication to unlock encrypted account access through an audited action, for at most 60 seconds per view.
7. Admin marks the order as processing/completed.

Mandatory exception controls: the AES-GCM OrderSecret envelope binds invoice and verified username atomically with checkout; new-order access expires after 72 hours, with deletion on completion/cancellation/failure and expiry cleanup. Never return secrets in ordinary invoice/list/provider DTOs or put them in logs, notifications, URLs or browser storage. Preserve same-origin admin authorization, active ownership, recent reauthentication, audit and private/no-store responses. Display lasts at most 60 seconds. Backup copies are encrypted/restricted recovery artifacts, never an alternative reveal path; restore preserves original expiry and purges expired/terminal secrets before application access. Finite backup retention, restore and physical purge scheduling must be verified before release; this policy approval is not deployment authorization.

### C. Via Username

Target flow:

1. Customer chooses **Via Username**.
2. Customer selects a package/amount.
3. Customer enters Roblox username and any method-specific data required for delivery.
4. System validates the required fields.
5. Customer pays.
6. Paid order enters the fulfillment queue as **Via Username**.
7. Admin/worker performs the configured manual delivery process.
8. Order is marked completed after delivery is confirmed.

#### Via Username UX / Checkout Details

Use a four-step customer wizard for Via Username:

1. **Informasi Robux Username**
   - Explain that fulfillment uses the Roblox username only.
   - Do not request password, OTP, cookies, backup codes, or other account secrets.
   - Show only requirements that are actually used by the store's fulfillment process.

2. **Detail Akun**
   - Roblox username with a **Cek Username** action.
   - Show public identity/avatar when lookup succeeds.
   - Robux amount selector using slider + numeric input when the configured variant supports dynamic quantity.
   - Contact fields such as WhatsApp and notification email when required by the existing checkout.
   - Preserve draft values while moving backward/forward in the wizard during the same page session.
   - Do not create an Order or payment transaction at this stage.

   Username validation rules:
   - A confirmed nonexistent username blocks checkout.
   - Temporary Roblox API/provider failure must be shown as an availability/verification problem, not as proof that the username is invalid.

3. **Metode Pembayaran**
   - Show username, requested Robux, automatically server-resolved pricing region, currency, product price, payment/admin fee when applicable, discount when available, and final total.
   - Reuse the project's existing payment methods and fee calculation.
   - Do not hardcode gateway fees that are already calculated by shared payment infrastructure.

4. **Konfirmasi Order**
   - Show a final order summary before creation.
   - Create the order and payment transaction only on the final confirmation action.
   - Protect the final action against double-submit/idempotency issues.
   - Continue into the existing payment page (for example QRIS) and existing invoice flow.

Via Username pricing/configuration:

- Admin configuration should support active/inactive state and the existing pricing model.
- For dynamic quantity, support equivalents of `baseUnits`, `basePriceIdr` (or rate), `minUnits`, `maxUnits`, and `unitStep`.
- Example values such as 50 Robux / Rp8.500 are illustrative only and must never become hardcoded production prices.
- Server-side checkout must recalculate and validate requested Robux and price before order creation.

Via Username fulfillment:

- A successfully paid Username order must appear in **Ruang pengiriman** under the Username method.
- Useful admin information includes invoice, Roblox username, requested Robux, customer contact when needed, payment status, and fulfillment status.
- Do not automatically mark a paid order as completed. Completion happens only after the manual delivery is confirmed.
- Fulfillment transitions should use the existing backend state machine/allowed transitions and atomic database operations where an order is claimed or processed.
- Customer-facing invoice/status should clearly distinguish payment status from fulfillment status (for example: Siap Diproses, Sedang Diproses/Robux Sending, Selesai/Robux Delivered, Perlu Ditinjau, Dibatalkan).

## 4. Admin Pages and Their Purpose

### Katalog top-up

The **Katalog top-up** page is an admin configuration page, not a customer checkout page.

Its purpose is to manage top-up products/method settings. For Roblox it should allow the admin to manage, where relevant:

- Product/service name
- Roblox method: Gamepass / Login / Username
- Active/inactive status
- Slug
- Display label/description
- Pricing model
- Rate per Robux for slider-based methods
- Minimum Robux
- Maximum Robux
- Step/increment
- Fixed packages for methods that use package pricing
- Regional pricing for Indonesia / Malaysia / Philippines
- Currency per region (`IDR`, `MYR`, `PHP`)
- Region-specific rate or fixed-package amount
- Region-specific payment availability when relevant

For **Gamepass**, prefer configurable rate + min/max/step instead of forcing fixed packages. Rate configuration must support separate values per enabled region.

### Ruang pengiriman

The **Ruang pengiriman** page is the Roblox fulfillment dashboard for admins.

It should make operational work understandable instead of exposing technical worker details as the main UI. It should support filtering by Roblox method and useful order states.

Recommended statuses:

- Menunggu pembayaran
- Pembayaran terkonfirmasi
- Menunggu data pelanggan
- Siap diproses
- Sedang diproses
- Selesai
- Perlu ditinjau
- Dibatalkan

Useful filters:

- Gamepass
- Login
- Username
- Status
- Search by order/customer/username

Worker/API health may exist as secondary diagnostics, but it should not dominate the fulfillment UI.

## 5. Routing / UI Separation

Preferred customer routes:

```text
/                  -> landing/home portal
/apps              -> Apps Premium
/roblox            -> Roblox landing + method selection
/roblox/[slug]     -> Roblox product/method checkout when needed
/games             -> Game Top-up (later)
/games/[slug]      -> Game detail/checkout (later)
```

Navigation may show:

- Apps Premium
- Top-up Game
- Roblox

For now, Roblox is the active development priority.

## 6. Data Model Direction

Use product/service typing so shared infrastructure can distinguish categories without breaking existing Apps Premium behavior.

Example direction:

```prisma
enum ProductType {
  APPS
  GAME
  ROBLOX
}

enum RobloxMethod {
  GAMEPASS
  LOGIN
  USERNAME
}
```

Roblox order data may include fields such as:

```prisma
robloxMethod      RobloxMethod?
robloxUsername    String?
robloxGamepassUrl String? @db.Text
robuxAmount       Int?
pricingRegion     String?
currency          String?
```

The exact representation may use enums instead of strings if that fits the current schema better. Orders should preserve the region/currency that was actually used at checkout so historical totals remain reproducible even after admin pricing changes.

Do **not** add a persistent Roblox password field.

Exact model names may follow the existing schema. Prefer extending existing models cleanly rather than duplicating concepts.

## 7. Pricing Rules

Pricing must be controlled from admin configuration and validated server-side.

The store now uses **regional pricing**, not automatic exchange-rate conversion. Each supported country has its own independent product price. Changing the Indonesia price must not automatically change Malaysia or Philippines pricing.

Initial supported regions:

- **Indonesia** -> `IDR`
- **Malaysia** -> `MYR`
- **Philippines** -> `PHP`

For slider/rate pricing, pricing configuration must be region-aware. Conceptually:

```text
customer price = configured regional rate/rules applied to requested Robux
```

Example configuration direction:

```ts
regionalPricing = {
  ID: { currency: 'IDR', rate: ... },
  MY: { currency: 'MYR', rate: ... },
  PH: { currency: 'PHP', rate: ... },
}
```

Exact schema/model names should follow the existing codebase. Do not hardcode production prices in components.

For fixed-package methods, each package may also have independent regional amounts, for example:

```text
50 Robux
- Indonesia   -> configured IDR price
- Malaysia    -> configured MYR price
- Philippines -> configured PHP price
```

For Gamepass fulfillment, separately calculate the Roblox Gamepass listing amount required for the customer to receive the requested Robux after applicable marketplace fees.

Do not mix:

- Store price paid in IDR/MYR/PHP
- Customer country / pricing region
- Requested Robux amount
- Roblox Gamepass listing amount
- Payment-provider fees

These are separate values and should be named clearly in code and UI.

Server-side checkout must resolve and validate the customer's region on the server, load the official independent price for that region, and recalculate the total before creating the Order or payment transaction. Never trust currency, region, unit price, fees, or totals submitted by the browser. The customer cannot set or override a pricing region through a dropdown, URL parameter, request body, or local storage.

## 8. Payments & Currency

The store must support direct customer payment for the initial three markets:

- **Indonesia** in `IDR`
- **Malaysia** in `MYR`
- **Philippines** in `PHP`

This is a real multi-country checkout requirement, not display-only currency conversion. Customers from Malaysia and the Philippines must be able to create and pay orders using the payment integration configured for those markets.

### Automatic region detection (required customer UX; see section 16 and release status in section 17)

**Decision: pricing/payment region is fully automatic; customer-facing country/region dropdowns, country switchers, and manual pricing-region choices must be removed from the website.** Apply consistent server-resolved region behavior to Roblox landing/cards, all three Roblox checkout methods, product prices, quotes, invoices, and payment methods. Use the shared pricing/payment infrastructure for other service areas where applicable without breaking existing Apps Premium behavior.

The following **five mandatory rules** supersede the older manual region-selection behavior documented in section 15:

1. **No public region switcher.** Do not show a region/currency dropdown, tabs, flags functioning as selectors, or country-switch links on product pages, headers, or checkout. Do not use a customer-supplied `region`/`country` query parameter, local storage, or browser-provided region as an authority for pricing.
2. **Automatic server-side GeoIP detection.** Resolve the request's country using a reliable server-side geolocation service or deployment/CDN country metadata from a **trusted ingress**. Accept proxy/CDN country headers only if the origin is protected and their provenance is verified; never trust arbitrary `X-Forwarded-*` or client-supplied headers. Map country codes strictly to `ID`, `MY`, or `PH`. Avoid caches that leak one region's product prices, quotes, or rendered pages to visitors from another region.
3. **Server-validated checkout/payment region.** For every quote and final checkout, the server must use its resolved region, not any browser-supplied region/currency/price. Check that independent regional prices, product availability, provider, payment method, and currency are supported. Recalculate subtotal/fees/totals on the server and bind them to the existing signed `quoteToken`, preserving checkout idempotency. When a region or quote changes before order creation, refresh the quote and require renewed customer confirmation; never silently change totals or create an order. Validate gateway-country constraints where the provider exposes authoritative payment/billing-country checks; IP geolocation alone is **not** proof of billing country and cannot guarantee that a visitor cannot compare regions or use an international card.
4. **Incorrect-country correction without a dropdown.** Show a small **`Lokasi terdeteksi salah? Hubungi bantuan`** link or equivalent support path so legitimate customers (for example those traveling, behind VPNs, or incorrectly geolocated) can ask for help. Support/admin may investigate and use a narrowly scoped, server-authorized, auditable correction only after appropriate verification; this is not a self-service country selector or arbitrary price override. Until verified, do not force the buyer into a guessed region/price; if the location is indeterminate, show a neutral unavailable-for-checkout state and support guidance, not an IDR fallback.
5. **Transparent correct local price.** Display the automatically resolved country, ISO currency, regional product price, applicable payment fee/discount, and final amount clearly before payment. Keep Indonesian, Malaysian, and Philippine configured prices independent; do not convert automatically using FX or hide the applicable price. Persist region/currency and the confirmed amount in the order for later invoices, admin views, and refunds.

Supported mappings:

```text
ID -> Indonesia / IDR
MY -> Malaysia / MYR
PH -> Philippines / PHP
```

**Unsupported / undetected regions:** do not silently default to Indonesia. If the country cannot be detected reliably, or is outside the supported countries, show a clear availability message with a support route; block checkout until the location/region can be validated. Never expose a purchasable IDR checkout by default as a fallback.

**Region availability and UI states:** do not render `Belum ada produk yang tersedia` while showing active-looking purchase options below it. When a product/method is unavailable for the resolved region, hide or clearly disable purchase actions and explain why. MY/PH prices may exist before their gateways are ready, but **do not enable real checkout** for these regions until genuine local-capable gateway integrations and verified webhooks are implemented.

**Implementation/testing requirements:** inspect the hosting environment to find a trustworthy GeoIP source before selecting an implementation. When none is available, document and keep checkout blocked instead of fabricating location data. Local development and automated tests may use an explicitly test-only mocked geolocation source, never a public header or production override. Cover ID/MY/PH, missing or spoofed headers, unsupported countries, proxy/CDN configuration, travel/VPN false positives, cache separation, quotation/checkout region drift, payment-method restrictions, and support correction. Preserve historical orders and existing Apps Premium flows.

Do not silently convert a configured regional price using a live FX rate. Regional prices are intentionally independent.

### Payment gateway architecture

Keep payment infrastructure modular. Roblox logic must not be coupled directly to one payment provider. A provider or provider-adapter layer should decide how a payment is created for each supported country/currency.

The implementation may use one multi-country gateway or multiple gateways/adapters depending on provider support. The project plan does not require all countries to share the same provider.

Conceptual direction:

```text
checkout
  -> resolve region + currency
  -> calculate regional product price
  -> calculate supported payment fee
  -> create Order
  -> create payment through region-compatible provider adapter
  -> wait for verified webhook/callback
  -> mark payment confirmed
  -> send paid Roblox order to fulfillment queue
```

### Payment-method UX

Only show payment methods that are actually available for the customer's **server-resolved** region/currency. Do not present unsupported methods and fail later during payment creation.

Examples of method categories that may exist by market include bank transfer, QR payments, and local e-wallets, but the exact payment methods must come from the configured gateway/provider capabilities rather than being hardcoded into this plan.

### Payment verification

Payment success must be determined from trusted server-side provider verification/webhooks, not from a browser redirect alone.

Webhook handling must:

- verify the provider signature/authentication mechanism;
- match the provider transaction to the correct internal order;
- verify expected currency and amount where supported;
- be idempotent so duplicate callbacks do not duplicate fulfillment;
- keep payment status separate from Roblox fulfillment status.

### Admin configuration

Admin pricing/payment configuration should make regional differences clear. Where applicable, admin should be able to manage:

- enabled countries/regions;
- enabled currencies;
- independent prices/rates per region;
- regional fixed-package prices;
- available payment providers/methods per region;
- active/inactive state without deleting historical order data.

International payment support is now an explicit project requirement and should be implemented together with the shared checkout/payment architecture without breaking Apps Premium or the existing Roblox flows.

## 9. Order / Fulfillment Architecture

Shared checkout may branch by `ProductType`:

- **APPS** -> existing stock/account fulfillment behavior
- **ROBLOX** -> Roblox-specific manual fulfillment queue
- **GAME** -> third-party API fulfillment later

For Roblox, a successfully paid order should be routed to the fulfillment dashboard with its `RobloxMethod` and method-specific data.

The admin UI should show only the information necessary for that method.

## 10. Apps Premium Protection

Apps Premium existed before the Roblox expansion and is already relatively complete.

Rules:

- Do not remove working Apps Premium features.
- Do not force Apps Premium into the Roblox checkout UI.
- Avoid database migrations that accidentally invalidate existing App products/orders.
- Reuse shared infrastructure only when it reduces duplication without changing existing behavior.

## 11. Game Top-up — Later Phase

Game Top-up remains part of the long-term project, but it is **not the current focus**.

Planned direction:

- Dedicated `/games` UI similar to common game top-up stores.
- Game-specific fields such as User ID / Zone ID when required.
- Third-party provider/API integration.
- Payment webhook triggers provider fulfillment.
- Provider transaction ID and API logs available to admin.

Do not implement this phase unless explicitly requested.

## 12. Implementation Rules for Gemini, Codex and Other Coding Agents

Before making changes:

1. Inspect the current repository and relevant existing code.
2. Check what is already implemented before creating duplicate components/routes/models.
3. Preserve working behavior and existing user data.
4. Do not undo previous Roblox/Gamepass work unless it is broken or conflicts with this plan.
5. Keep the three Roblox methods available.
6. Keep Apps Premium working.
7. Focus only on the requested feature; avoid unrelated refactors.

After making changes:

1. Run read-only Prisma validation and schema checks where relevant. Never migrate, db push, reset, seed, or perform DB writes without separately approved instructions and target verification.
2. Run TypeScript/typecheck/lint/build commands available in the project.
3. Fix errors caused by the change.
4. Summarize exactly what changed and mention anything still incomplete.

## 13. Current Roblox UX Direction

The existing Roblox customer page with three cards — **Gamepass**, **Via Login**, and **Via Username** — is the intended high-level structure.

The current admin pages also remain useful, but their roles must be clear:

- **Katalog top-up** = configure products, methods, pricing, limits, packages, and active state.
- **Ruang pengiriman** = process paid Roblox orders and track fulfillment status.

Do not delete these pages merely because they look empty when no data exists; improve their UX and connect them to real Roblox configuration/order data.

## 14. Source-of-Truth Priority

When instructions conflict, use this priority:

1. The user's newest explicit request in the current Codex thread.
2. This project plan.
3. Existing repository behavior and tests.
4. Older chat assumptions or temporary implementation notes.

If a requested change would materially conflict with this plan, point out the conflict before making a destructive architectural change.

## 15. Regional Pricing Implementation Notes (2026-10-08)

- Roblox Gamepass, Username and Login now share region-aware pricing. `ProductVariant.price` remains the authoritative Indonesian rupiah price for backward compatibility. `RegionalPrice` stores independently configured MY/PH amounts and per-region availability; an optional ID row controls ID availability and mirrors the legacy price. Missing MY/PH pricing never falls back to ID or FX conversion.
- Monetary integers use rupiah for IDR and sen/centavo for MYR/PHP (scale 100). `regionalPricing.ts` parses decimal admin input and calculates proportional rates with integer rounding. Fixed packages use the same configuration. Never pass MYR/PHP stored integers directly as major-unit amounts to a future gateway.
- Migration `202610070001_regional_pricing` is additive. Existing IDR orders retain their totals and gain ID/MIDTRANS defaults and subtotal backfill. New orders snapshot region, currency, product subtotal, customer payment fee, discount, final amount, provider and transaction reference. Existing fields and data remain intact.
- `paymentProvider.ts` provides region capabilities, fee calculation, charge creation and normalized server-verified status. Only Midtrans ID/IDR QRIS is implemented. It is advertised when `MIDTRANS_SERVER_KEY` is configured; this does not prove credentials are live/valid. Existing customer fee remains zero (merchant gateway fees are not automatically passed through); discount remains zero because no discount engine exists.
- MY/MYR and PH/PHP pricing can be configured and displayed, but payments are **not active**. Their method lists are empty and checkout rejects them before order creation. Direct international payment still requires a merchant-enabled provider, official API integration, credentials and verified currency/amount/reference webhooks. Do not enable these regions by adding method labels or converting to IDR. Midtrans documentation explicitly limits charges to IDR: https://docs.midtrans.com/docs/can-i-receive-payments-using-other-currency-than-idr
- `/api/checkout/quote` recalculates the selected Roblox price and payment fee without creating an order. Final checkout recalculates under the existing product transaction lock. Region/method participate in checkout idempotency, and unsupported or browser-submitted monetary fields are rejected. Historical requests without region/method retain their original request digest.
- Resumption audit (2026-10-08): the user confirmed no international merchant/provider account exists yet. MY/PH payment activation therefore remains blocked, while regional pricing and provider readiness are implemented. New regional checkout requests require the server's HMAC `quoteToken`, binding the displayed product, variant, quantity, region, currency, provider, method and totals. Price/fee changes before order creation return `PRICE_CHANGED` without creating an order; the UI refreshes the quote and requires confirmation again. Existing order retries are resolved before quote validation so their original snapshots remain recoverable.
- Region selection is manual, defaults to ID and is carried from Roblox cards into the checkout URL. Changing it in-place preserves wizard draft fields. No trusted country-detection infrastructure was found, so no IP/geolocation inference is used. UI language remains independent of pricing region.
- Midtrans webhook still verifies SHA-512 and fetches provider status. Provider, region, currency, amount and reference must match the order; reference adoption and fulfillment queuing are atomic. Duplicate settlement creates only one fulfillment job. Payment success does not complete Roblox delivery. Invoice and admin order views format the stored currency; existing rupiah revenue analytics include IDR only, never summed foreign minor units.
- Before running this version against an existing store database, apply the provided migration using `npx prisma migrate deploy` and regenerate Prisma Client. Development validation uses isolated localhost `cloudy_test_*` databases; the main store database is not migrated by the implementation task.
- Validation includes `prisma format`, `prisma validate`, schema-versus-migration diff, TypeScript, ESLint, production build, unit tests, isolated MySQL/HTTP regression tests, and browser region-switch/draft checks. Use `TEST_DATABASE_URL` for commerce tests, `TEST_BASE_URL` with `tests/start-http-server.mjs` for HTTP tests, and a **fresh empty separate** `TEST_MIGRATION_DATABASE_URL` for the legacy-order migration test. Provider calls in tests are mocked; no real payment was made.

## 16. New UX Decision — Fully Automatic Region (2026-10-08)

- **Requested change, not an implementation claim:** the manual region picker/default-to-ID described in the section 15 implementation audit represents *existing code at the time of the audit* and must now be replaced. Do not delete that audit history or claim this feature already works merely because it is in the plan.
- New behavior is defined in **section 8: Automatic region detection**, including five mandatory rules: no public dropdown, trusted server GeoIP, server-side regional checkout validation, support-assisted correction without self-selection, and transparent local pricing/currency.
- The three Roblox methods (Gamepass/Login/Username), admin-configured independent prices, the server-signed quote flow, and existing payment/fulfillment protections must remain intact. The admin can still configure prices for each region; buyers cannot switch the region from the storefront.
- **Release blocker:** the earlier audit found no trusted GeoIP infrastructure. Codex must first inspect deployment configuration and implement/test a trusted signal or clearly report that automatic determination cannot yet be safely enabled. Do not ship an unverified IP/header guess as trusted pricing authority.
- **International payment blocker remains:** MY/PH provider accounts/credentials/webhooks are not set up yet. GeoIP detection does not solve international payment processing. No real MY/PH checkout until suitable live integrations exist.


### Implementation audit — automatic region and admin repair (2026-10-08)

- Removed the public country selector and region-bearing purchase links. Language selection is explicitly labeled as language and does not determine prices. Catalogs disclose only the authenticated detected region's price/currency/methods; unavailable options have no purchase action. Empty catalogs no longer render active-looking service purchase cards.
- `requestRegion.ts` verifies request-scoped HMAC country attestations from a trusted ingress. Raw CDN/forwarded headers, query/body country values, cookies and language cannot select a checkout region. This ingress contract is implemented and tested but **was not deployed or enabled at the time of this historical audit**: the user confirmed local/ngrok hosting and no verified GeoIP source existed at that time. Revalidate against current Vercel configuration; never use an unverified header as trusted pricing authority. Unverified or unsupported locations need a blocked checkout state and support guidance.
- Quotes and every new Roblox order require the server-resolved region and signed quote, including legacy clients. Existing idempotent retries resolve before new location/price checks to preserve historical invoices. Regional responses are private/no-store; server-rendered page shells contain no region-specific prices. Region drift while paginating discards incompatible catalog data; quote drift requires review and renewed confirmation.
- Incorrect-location support is available; self-service corrections and unaudited admin overrides are not implemented. Checkout remains blocked until trustworthy verification is possible. See `docs/regional-deployment.md` for ingress prerequisites, trust boundaries and the required constraints for any future support correction facility. IP-derived country is not billing-country proof.
- Both screenshot errors were caused by missing regional schema in the configured database (Prisma P2022, `Order.pricingRegion`). Applied the existing assisted-login and regional migrations after checking that no Roblox secrets were stored. The three existing orders and one stock row were preserved. Authenticated `/api/admin/orders` and `/api/admin/fulfillment?type=ROBLOX` subsequently returned HTTP 200, with three and two rows respectively. Admin load errors now have a specific translated message; failed order fetches no longer log a client exception that opens the development overlay.
- Sections 9–14 remain intact: Apps Premium and the three Roblox methods retain separate fulfillment; payment confirmation does not complete Roblox delivery. Section 11 remains the later Game Top-up phase, without a new live game integration.
- Validation at that time: 39 unit/database checks and the separate HTTP integration test passed; Prisma schema validation and migration status were clean; TypeScript, ESLint and `next build` passed. `npm run build` initially hit a Windows Prisma DLL lock held by the running development server during its `prebuild` generation step; the already-current generated client was used for the successful production build. Browser checks verified unavailable location despite `?region=ID`, no buyer country switcher, working admin order/fulfillment lists and no console errors in the isolated admin harness. Gateway and GeoIP attestations in tests are fixtures, not proof of a live provider or GeoIP deployment.

---

## 17. ROADMAP TERPADU — ACTIVE SOURCE OF TRUTH (updated 2026-10-13; see §25–26 for current UX scope)

**2026-10-13 update:** `P0-A2` has already been committed/deployed (`b12c28b`); do not rerun its old local implementation checklist. **P0-C Roblox screenshot-driven UX (§25)** is now the current user-requested milestone, to be implemented locally only. `P0-B` checkout 400 remains open pending evidence. P1/P2/P3 unchanged.


**Tujuan:** satu dokumen untuk semua coding agent (Antigravity/Gemini, Codex, ChatGPT Work), agar tidak perlu prompt satu-satu untuk perbaikan kecil. Baca `AGENTS.md`, seluruh `plan.md`, kondisi Git `main`, dan kode relevan sebelum mengedit. Catatan lama adalah histori, bukan selalu status implementasi terkini.

**Scope kerja:** tuntaskan milestone yang diizinkan beserta tes dalam satu batch; jangan menganggap seluruh roadmap sebagai izin mengerjakan semua fase, mengubah database remote, atau melakukan deploy. Prioritas **saat ini adalah P0-C: perbaikan UI/UX Roblox berbasis screenshot** (§25–26). P0-A1/P0-A2 telah dirilis dan harus dipertahankan; P0-B checkout 400 tetap OPEN menunggu errorCode, tanpa perubahan spekulatif. Semua persyaratan keamanan lama tetap berlaku.

### Baseline yang sudah diverifikasi / dilaporkan

- Repository: `Jax-v12/cloudy-pink-store`, branch utama **main**, Next.js App Router / Prisma / Aiven MySQL / Vercel.
- **Testing-only:** lokal dan Vercel sebelumnya dikonfirmasi memakai Aiven `cloudy_staging`, tidak pernah `defaultdb`. Jangan cetak atau berbagi kredensial `.env` atau `DATABASE_URL`. Runtime Prisma guard **tidak** melindungi Prisma CLI.
- Midtrans tetap **Sandbox** (`NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false`); MY/PH belum memiliki gateway pembayaran lokal yang aktif. Jangan hidupkan pembayaran riil.
- Security hardening `69d19b2` sebelumnya sudah deployed; admin, katalog produk, QRIS image dan headers telah di-smoke-test.
- **QRIS release `9fc5f50`:** `fix: secure QRIS download via server-side proxy`; lima file berubah. User telah membuktikan Vercel deployment berstatus **Ready**, alias `https://cloudy-pink-store.vercel.app`, dan **tombol Download QRIS berhasil mengunduh gambar** pada invoice testing Sandbox. Ini adalah bukti end-to-end untuk alur yang diuji, bukan jaminan semua format/edge case.
- Review pascarilis terhadap `9fc5f50` melaporkan suite **34 pass, 0 fail, 9 skipped**; typecheck/build berhasil, lint satu warning `<img>` lama. Audit lebih lanjut menemukan peluang perbaikan JPEG, test coverage, limiter, dan konsistensi validator (detail §24).
- Console sebelumnya menampilkan **HTTP 400 `/api/checkout`**, terpisah dari CORS unduhan QRIS. Sampai sekarang **errorCode spesifik belum diketahui**; jangan klaim sudah selesai.
- Admin invoice removal adalah **soft removal** yang bisa dipulihkan; riwayat keuangan tidak boleh hard delete.

### Milestone / gate

| Urutan | Area | Status terkini | Syarat selesai |
| --- | --- | --- | --- |
| **P0-A1** | QRIS same-origin download dasar | **Selesai dan berhasil diuji di website** pada commit `9fc5f50` | Jangan implementasi ulang; pertahankan perilaku |
| **P0-A2** | QA & hardening QRIS setelah review | **DONE: committed/deployed `b12c28b`; post-release browser recheck belum dikonfirmasi** | Pertahankan implementasi; jangan ulang patch |
| **P0-C** | Roblox customer UX: one-time method selection, text legibility, Via Login package grid | **Implemented locally; isolated QA passed; awaiting user review** | 41 browser cases passed on production build; remaining limits in `docs/qa/p0c-2026-10-13.md`; user review before commit/release |
| **P0-B** | Checkout 400 diagnosis | **Terbuka** | Ada `errorCode` aktual dan bukti root cause; perubahan hanya bila ada bug |
| **P1** | Security/integration/operational QA | Sebagian smoke test; 9 integration skipped | Rencana test terisolasi, backup/recovery, monitoring |
| **P2** | ID/MY/PH pembayaran live | **Blocked** sampai merchant/provider sah siap | Integrasi resmi, metode sesuai negara, webhook/payout/refund diverifikasi |
| **P3** | UX/Admin/Roblox/Game backlog | Ditunda | Scope dan izin baru setelah stabilisasi |

## 18. P0-A1 — DOWNLOAD QRIS BASELINE (DONE; PRESERVE)

Bug asal: gambar QRIS Midtrans Sandbox bisa ditampilkan melalui `<img>`, tetapi browser `fetch` untuk menyimpan gambar secara langsung ke `api.sandbox.midtrans.com` ditolak karena CORS. CSP allowlisting tidak memberikan izin CORS.

**Implementasi yang sudah dirilis, jangan dibangun ulang:**

- `GET /api/orders/[id]/qris/download`: validasi pasangan invoice dan `x-order-token` di database sebelum mengambil QR; unauthorized => HTTP 404; bukan `PENDING` / tidak tersedia => safe error.
- URL remote hanya berasal dari Order terautentikasi, bukan input client. `isValidOrderQrUrl` mewajibkan HTTPS, host Midtrans persis sesuai mode, path QR yang sesuai, tanpa port/kredensial/query/hash; `fetch` dengan `redirect: 'error'` dan timeout 5 detik.
- Upstream response harus `image/png` / `image/jpeg`, sesuai magic bytes; max 2 MiB dengan incremental streaming dan cancellation, termasuk bila `Content-Length` hilang. Mid-stream network/timeout failure => HTTP 502, kegagalan internal/DB => HTTP 500.
- `Content-Disposition` aman, `Cache-Control: private, no-store`; raw QR string `000201...` tetap dapat dijadikan PNG tanpa remote fetch.
- UI untuk data URI memakai direct client download; URL Midtrans memakai same-origin endpoint + `x-order-token`, dengan loading dan error terjemahan ID/MY/EN.
- User telah mengonfirmasi QRIS berhasil di-download di Vercel utama setelah deployment commit `9fc5f50` berstatus Ready. Jangan ulang QA yang sudah cukup kecuali area terdampak patch berikutnya.

**Catatan:** sejumlah acceptance edge case pada spesifikasi awal belum memiliki regresi eksplisit; pekerjaan tersebut dipindahkan ke §24, bukan alasan menyatakan fitur dasar gagal.

## 19. P0-B — INVESTIGATE SEPARATE CHECKOUT HTTP 400 (OPEN)

1. Lacak kontrak frontend ke `src/app/api/checkout/route.ts`, `src/lib/checkout.ts` dan `src/lib/commerce.ts` **secara read-only**. Tidak perlu menciptakan order atau menghubungi Midtrans untuk investigasi kode.
2. Minta ke operator **hanya `errorCode` non-sensitif** dari DevTools → Network → `/api/checkout` → Response. Jangan meminta body payload penuh, email, order token, Roblox credentials, header rahasia, atau customer personal data.
3. Bedakan `STOCK_EMPTY`, `INVALID_INPUT` email/variant/quantity/details/idempotency, region/payment method unavailable, Roblox user/gamepass validation failure, dan signed quote drift. Semua hanya kandidat sampai dibuktikan.
4. Jika request memang invalid, dokumentasikan penolakan yang wajar dan UX; jangan melonggarkan validasi. Jika bug aplikasi terbukti, lakukan perubahan minimal, tes dengan mocked provider dan DB disposable lokal berizin.
5. **Completion gate:** penyebab respons 400 ditetapkan berdasarkan bukti, bukan spekulasi. Jika user belum menyediakan `errorCode`, tetap status OPEN.

## 20. P1 — SECURITY, REGRESSION & OPERATIONS (PRESERVE)

### Invariants wajib

- Remote Aiven hanya `cloudy_staging` selama testing; **jangan mengakses `defaultdb`**. Tulis data untuk tes hanya di instance localhost disposable `cloudy_test_*` jika secara terpisah diizinkan; Prisma CLI tidak terlindungi runtime guard.
- Jangan jalankan `prisma migrate deploy`, db push, reset, seed, maupun mutasi DB untuk patch QRIS, karena **tidak ada perubahan schema**.
- Pertahankan cookie Admin HttpOnly/SameSite/Secure, Origin/CSRF check, recent reauth untuk aksi sensitif, locking dan audit log, safe soft delete & restore. Tidak boleh menghapus hard financial Order.
- Pertahankan trusted Vercel proxy edge boundary untuk IP/GeoIP; jangan memakai country/region client-supplied untuk mengubah harga. VERCEL env saja bukan bukti kriptografis.
- Cron tetap memakai `CRON_SECRET` exact tanpa `trim()`, time-safe verify, no-store responses.
- Midtrans Sandbox webhook harus diverifikasi server-side; amount/currency/provider/reference/order matching, idempotensi settlement, stock locking, dan fulfillment atomic. Payment PAID berbeda dari fulfillment COMPLETED.
- Lindungi invoice `x-order-token`, kredensial Apps Premium, data pelanggan, provider secret. Hindari log sensitif dan akses via akun ChatGPT sharing.
- CSP/security headers tetap dipakai. CSP tidak menyelesaikan CORS; evaluasi `unsafe-inline` dan HSTS preload sebelum custom-domain launch.
- `npm audit --omit=dev` terakhir **dilaporkan** 0 advisory setelah compatible updates; masih ada beberapa dev-only advisory. Jangan `npm audit fix --force` secara membabi buta.

### Verification & release readiness

- Tes terkini (reported) **34 passed, 0 failed, 9 skipped**. Integrasi MySQL/HTTP skipped berarti belum end-to-end ter-cover, bukan otomatis bug. Jika menjalankan, gunakan terpisah `TEST_DATABASE_URL` hanya `cloudy_test_*`; jangan jalankan terhadap Aiven remote.
- Smoke-test pasca setiap user-approved deploy: halaman utama, Apps, Roblox, region/quote, invoice-token access, QR render/download PNG/JPEG bila tersedia, admin login dan fulfillment/archive, status polling, console dan mobile.
- Verifikasi backup & recovery Aiven di lingkungan terpisah sebelum menerima pembayaran live; snapshot belum sama dengan tested restore/PITR.
- Monitor webhook errors, cron cleanup/fulfillment, payout/refund-required queue, order review, rate-limit failures. Vercel `Ready` berarti build berhasil, bukan bukti pembayaran berjalan.

## 21. P2 — REAL PAYMENT / INTERNATIONAL READINESS (BLOCKED)

- **Sekarang hanya Midtrans Sandbox**. Jangan mengaktifkan key live, settlement, atau membuat real payments sebagai bagian P0/P1.
- Indonesia: sebelum real launch, butuh merchant berwenang, verifikasi sesuai syarat provider, settlement, refund, fees, operasional, kebijakan customer support/terms/privacy dan explicit approval.
- Malaysia/Filipina: konfigurasi harga IDR/MYR/PHP sengaja terpisah, tidak otomatis FX conversion. Checkout MY/PH harus tetap disabled sampai tersedia provider yang secara eksplisit mendukung mata uang/metode lokal (FPX/DuitNow/GCash/Maya dan/atau international card sesuai merchant country), webhook, payout, refunds, dan dokumen kontrak.
- Backend auto region menggunakan trusted Vercel ingress dan policy server-side; IP bukan jaminan negara tagihan. Wrong-location correction via support, bukan arbitrary frontend switcher.
- Jangan menggunakan akun/identitas pihak lain atau melanggar eligibility provider untuk mengaktifkan pembayaran.

## 22. P3 — FEATURE & UX BACKLOG (SEPARATE SCOPE)

- Pertahankan tiga metode Roblox: **Gamepass**, **Via Login**, **Via Username**; username check, independent regional prices, signed quote, pembayaran aman, manual fulfillment; dilarang menyimpan Roblox password/OTP/cookies/session tokens.
- Pertahankan Apps Premium catalog/stock locking/credential security, dan hanya jual akses digital yang resmi/diizinkan.
- Game Top-up API & provider nyata tetap nanti; jangan hidupkan simulasi sebagai transaksi Production.
- Admin: search invoice, laporan per currency (IDR tidak dicampur MYR/PHP minor units), archive/restore, stok, fulfillment statuses, audit/operasional.
- Testing/dummy cleanup harus eksplisit dan terisolasi; hindari hard-delete riwayat Order untuk menghindari foreign keys.
- UX: Anya Theme, responsif mobile, accessibility, availability/fee transparency, clear customer status, support entry point.

## 23. CODING AGENT HANDOFF — ONE KICKOFF PER MILESTONE

**NOTICE (2026-10-13):** The old P0-A2 kickoff below is retained as history. For the next coding-agent run, use the **§26 P0-C kickoff** instead; do not repeat deployed QRIS hardening.


Coding agent harus membaca `AGENTS.md`, seluruh `plan.md`, `git status`, dan diff yang ada; hanya melanjutkan scope terbaru yang diizinkan. Tidak boleh membuat branch tambahan secara otomatis; pakai `main` sesuai workflow pengguna. Jangan overwrite pekerjaan lokal yang belum di-commit.

**Kickoff yang berlaku untuk milestone saat ini: lihat §26.** Instruksi P0-A2 sebelumnya sudah selesai dan tidak boleh dijalankan ulang. Agent cukup membaca satu kickoff di §26 dan menyelesaikan perbaikan visual §25 pada branch `main` secara lokal.

Agent boleh melakukan local code edits, mocked tests dan koreksi yang logis dalam milestone yang diizinkan tanpa prompt per satu bug. **Tetap minta izin terpisah** sebelum commit/push/deploy, database write/migration, Vercel env edit, payment/live activation, atau penghapusan data pelanggan.

### Status stabilisasi

- [x] Commit `9fc5f50` sudah masuk `main` dan Vercel Production **Ready**.
- [x] Customer Sandbox QRIS tampil dan **Download QRIS berhasil** di website utama.
- [x] Audit hardening QRIS setelah rilis (§24) dan regresi selesai; `b12c28b` telah deployed Vercel Ready (QA browser baru belum dikonfirmasi).
- [ ] Checkout 400 terdiagnosis secara spesifik bila `errorCode` diberikan.
- [ ] QA integrasi/operasi sesuai milestone P1 (terpisah).

## 24. P0-A2 — POST-RELEASE QRIS AUDIT FIXES (DONE; HISTORICAL AUDIT)

**Audit reviewed:** commit `9fc5f50` (2026-10-13). Ini adalah arsip persyaratan P0-A2 yang **sudah diimplementasikan dan di-deploy** melalui `b12c28b`. Instruksi A–F di bawah dipertahankan sebagai audit histori, **bukan pekerjaan untuk diulang**. Bukti tes: 38 pass/0 fail/9 skipped, lint/typecheck/build lulus; user belum mengonfirmasi smoke-test browser setelah P0-A2.

### A. JPEG extension mismatch — confirmed bug, highest priority

- Lokasi: `src/app/order/[id]/page.tsx` download handler, saat remote Midtrans URL dibuat menjadi `blob:`.
- Kode klien saat ini selalu menetapkan `link.download = QRIS-<invoice>.png`, termasuk saat server mengembalikan JPEG dan `Content-Disposition: ...jpg`. Header server tidak mengatur nama file ketika frontend memakai `blob:` dan `a.download` eksplisit.
- **Fix:** gunakan `blob.type` (hanya `image/png` atau `image/jpeg`) untuk menentukan `.png`/`.jpg`. Reject MIME lain dan tampilkan `t.downloadFailed`. Sanitasi invoice untuk filename. Jangan mengandalkan Content-Disposition untuk blob URL. Untuk QR `data:image/png`, tetap `.png`; tipe data lain hanya jika benar-benar didukung.
- Tes client handler atau pure filename helper: PNG menghasilkan `.png`, JPEG `.jpg`, MIME unknown gagal dengan aman; pertahankan pengunduhan data URI yang berjalan.

### B. Missing security regression tests

Tambahkan tes nyata pada `tests/security.test.mjs` atau file test yang relevan, tanpa database remote:

- Order `status !== 'PENDING'` dengan QR => HTTP 400 `QRIS_NOT_AVAILABLE`; Order PENDING dengan `qrisUrl: null` => HTTP 400.
- Invoice salah dengan token valid dan invoice benar dengan token salah => masing-masing HTTP 404. Mock DB harus benar-benar memeriksa `where.invoice` DAN `where.accessToken`. **Catatan:** mock utama yang ada sebenarnya sudah menguji keduanya; tambahkan tes eksplisit invoice salah, dan rapikan mock tambahan jika sesuai.
- Simulasikan upstream redirect 302 menuju external host. Assert outbound `fetch` dipanggil dengan `redirect: 'error'` dan redirect tidak boleh di-follow. Dalam mocking, pastikan test bisa menangkap regresi bila opsi fetch berubah menjadi default follow; jangan membuat mock 302 yang tetap gagal tanpa memeriksa opsi.
- Pertahankan suite existing untuk SSRF, raw QR, PNG/JPEG, MIME/magic mismatch, >2 MiB streaming tanpa Content-Length, timeout/mid-stream failure dan cleanup.

### C. Authenticated per-invoice rate limiting

- Masalah: bearer `x-order-token` yang valid memungkinkan request berulang ke proxy, setiap hit dapat memicu outbound Midtrans. UI anti-double-click saja tidak menghalangi scripted HTTP requests.
- Gunakan `consumeRateLimit` dari `src/lib/rateLimit.ts` **setelah** cek invoice+token dan status QRIS valid, **sebelum** membuat QR/fetch ke Midtrans. Key scope misalnya `qris-download`, key `order.invoice`, limit awal **10 download per 60_000 ms per invoice** (sesuaikan setelah QA; jangan mengandalkan IP/shared fallback). Backend limiter saat ini menggunakan DB `rateLimit` untuk counter: ini akan menjadi write operasional saat route live, **bukan izin bagi coding agent untuk mengakses/memutasi staging selama pengerjaan atau tes**.
- Tes rate limit via mock/injection, tidak menjalankan `consumeRateLimit` nyata dari unit test. Verifikasi up to limit lulus; over limit mendapat 429 + `Retry-After` yang sesuai dan private/no-store; request ditolak harus **tidak** memanggil upstream fetch. Jangan membocorkan invoice existence sebelum token auth. Jika dependency-injection seam dibutuhkan, jaga minimal dan kompatibel.
- Rate limiting tidak cukup sebagai pencegah semua abuse; laporkan kebutuhan monitoring apabila login/token exposure terdeteksi. Jangan sampai limiter IP bersama memblokir normal buyers.

### D. Sibling QR URL validator mismatch

- `src/app/api/orders/[id]/route.ts` sekarang menggunakan `isGatewayQrUrl`: menerima host production atau sandbox saat URL sesuai pola.
- Download proxy memakai `isValidOrderQrUrl`: hanya menerima host yang **sama dengan configured Midtrans environment**.
- Selaraskan display QR di order-detail dan keamanan download. Pilihan yang direkomendasikan: gunakan `isValidOrderQrUrl` untuk remote QR di detail juga, selama tidak menimbulkan regresi pada alur raw QR dan data existing. Dengan perubahan environment, sandbox QR lawas yang masih PENDING akan tidak tampil dan tidak bisa diunduh — ini lebih konsisten daripada tampil tapi gagal download. Dokumentasikan behavior ini dan buat tes Sandbox/Production mismatch.
- Tetap pertahankan host pinning, redirect:error dan sanitasi penuh; jangan melemahkan validator proxy untuk menampilkan QR lintas environment.

### E. Translation and implementation scope

- `src/app/order/[id]/page.tsx`: hapus fallback literal hardcoded `t.downloadFailed || 'Gagal mengunduh QRIS. Silakan coba lagi.'`, karena `downloadFailed` ada di ID/MY/EN dan AGENTS.md melarang hardcoded UI strings. Cukup gunakan terjemahan yang ada.
- Interface `OrderDbClient` dan dependency injection `dbClient` boleh dipertahankan selama typecheck sukses; **jangan lakukan refactor arsitektur besar** demi abstraksi yang tidak diperlukan. Jika memperkenalkan mock limiter, pastikan TypeScript typing jelas.
- Jangan edit checkout, kredensial, payment gateway, Prisma schema, tampilan desain atau fitur lain yang tidak terkait.

### F. Verification, release and exact handoff

- Lakukan `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check`, dan `git status --short`.
- Uji eksplisit PNG/JPEG filename, no token/wrong token/wrong invoice, non-PENDING/null QRIS, malicious redirect prevention, rate limit 10/min, environment host mismatch, serta existing tests. Jangan memalsukan coverage atau menyatakan 9 skipped sebagai passed.
- `plan.md` harus diperbarui dengan status checklist berdasarkan bukti. Seluruh bagian lain dan histori tetap ada; jangan menghapus P0-B, P1/P2/P3.
- Semua perubahan awal **lokal saja pada branch main**. Jangan membuat branch lain, jangan commit, push, deploy, database migration, remote DB writes, env secrets update, atau live payment. Berikan laporan diff, hasil tes dan blockers untuk review.
- Setelah operator memberikan izin commit & push, tunggu Vercel `Ready`, cocokkan alias dan commit, lalu tes ulang PNG download di invoice Sandbox dan JPEG path menggunakan mock jika Midtrans tidak menyediakan sampel JPEG. **Tidak melakukan pembayaran nyata.**

### Acceptance checklist P0-A2 (completed via `b12c28b`; historical)

- [x] PNG/JPEG filename konsisten dari browser dan server; data URI tetap berjalan.
- [x] Non-PENDING/null QR, wrong invoice, malicious redirect regression tests berhasil.
- [x] Per-invoice rate limiting terautentikasi bekerja tanpa shared-IP false blocking, dan tanpa real DB accesses saat unit test.
- [x] URL display dan download memakai host/mode policy yang konsisten.
- [x] Error string hanya melalui i18n ID/MY/EN; tidak ada unrelated refactor.
- [x] Suite pass, skip count transparan, user review sebelum commit/deploy.

**Historical note:** Section 24 was originally written before the P0-A2 implementation. Its tasks were subsequently implemented and the release was approved; do not repeat its old 'NEW' instructions. The release confirmation below supersedes that status.

**Release confirmation (2026-10-13):** P0-A2 was committed on `main` as `b12c28b`, pushed to GitHub, and Vercel Production deployment `https://cloudy-pink-store-kxqx76cv5-jax-v12.vercel.app` reported **Ready** with aliases including `https://cloudy-pink-store.vercel.app`. Reported checks before release: 38 passed / 0 failed / 9 skipped; TypeScript/lint/build succeeded. **Do not claim post-P0-A2 QRIS smoke test was performed** unless the user explicitly confirms it; an earlier P0-A1 Sandbox download did succeed in the browser. The lines above are preserved as historical development instructions, not commands to rerun the release.

---

## 25. P0-C — ROBLOX CUSTOMER UI/UX CORRECTION (CURRENT USER-APPROVED DESIGN SCOPE, 2026-10-13)

### A. Screenshot reference and non-negotiable decisions

The user provided four reference screenshots of the Roblox storefront and asked for the following changes. Treat these as **explicit current user requirements**, superseding older instructions requiring the detail-page method selector. Screenshots are visual guidance, not an authorization to copy arbitrary prices, discounts, imagery, supplier names or to add financial features.

| Reference | Existing view / requested comparison | Design decision |
| --- | --- | --- |
| **Gambar 1** | `/roblox` landing: hero and three method cards, **Via Gamepass**, **Via Login**, **Via Username** | **Preserve** these three customer choices as the *only place* the buyer initially selects a Roblox method. Keep the pink/Anya-themed service cards and per-region availability information. |
| **Gambar 2** | Detail for Gamepass: a redundant tab row `Via Gamepass / Via Username / Via Login`, along with the line `1. Pilih metode`, after choosing from Gambar 1 | **REMOVE** the second method selector from the detail page. The method must be determined by the card the buyer clicked; a detail flow cannot silently switch to another method. Keep a clear Back to Roblox catalog link. |
| **Gambar 2 and 3** | Dark heading/subtitle and step labels over a detailed pink anime background, some text hard to read | **Fix contrast and hierarchy** using solid/light high-opacity surfaces or a proper contrast panel; headings, steps, breadcrumb, prices and help text must remain clearly legible. |
| **Gambar 3** | `Via Login`: large mostly empty selection panel (`Belum ada paket tersedia untuk metode ini`) and a payment sidebar with dashes and disabled CTA | Replace the Login fixed-package selection design with a **compact grid of selectable Robux denomination cards**, visually inspired by Gambar 4; gracefully distinguish empty configuration from a presentation bug. Do not fake packages. |
| **Gambar 4** | Reference image: dense clean grid of pink-tinted denomination cards showing Robux amount, icon, price, optionally genuine original price and discount badge | Apply this **visual language** to Via Login (not as hard-coded product/price data). Read amounts, prices, availability and optional discounts from server/admin data. Keep cards large enough to read on small screens. |

**Priority order:** 1) remove repeated method selection, 2) make all detail text readable, 3) rebuild Via Login package cards and empty state, 4) test regressions, 5) report and stop for review. Do this as one coherent local coding batch, not a series of micro-prompts.

### B. Method selection: choose ONCE, then lock method to detail route

**Desired flow:**

`/roblox` → click `Beli sekarang` under exactly one method card → `/roblox/[slug]?method=GAMEPASS|LOGIN|GIFT_USERNAME` (or another existing safe canonical route) → **detail view immediately shows only the chosen method** → choose Robux amount/package and fill required details → confirmed Sandbox payment → existing invoice.

Implementation guidelines:

1. On `/roblox`, preserve `RobloxServiceCards.tsx` with the three distinct choices; `GIFT_USERNAME` is the technical method key for the user-facing `Via Username`. Do not rename database enum or break existing links.
2. In `src/components/TopupCatalog.tsx`, **remove** the detail-only `RobloxMethodSelector` and the `1. Pilih metode` header (and any `role=tabpanel`/`aria-labelledby` attributes only meaningful for that removed tab UI). Delete unused imports/state/change handlers after confirming no other flows depend on them. Do **not** remove the method cards on `/roblox`.
3. In `src/app/roblox/[slug]/page.tsx`, preserve/validate the incoming method from the originating card. `isRobloxMethod` already recognizes `GAMEPASS`, `LOGIN`, `GIFT_USERNAME`. No user-controlled price/country changes; `?method=` is **UI navigation, not authority for price or fulfillment**. Validate method-compatible variants again server-side in final checkout.
4. Handle direct/old links safely: if a detail URL lacks a valid method or the selected product has no variants for that method, show clear method-specific unavailable/help guidance with a way back to `/roblox`; optionally use a canonical redirect only if that is unambiguous and preserves draft semantics. **Never silently default a Login/Username entry to Gamepass.** Determine compatibility from configured data, not from a hardcoded slug heuristic.
5. After selection, use method-specific breadcrumb and title, e.g. `Roblox / Via Gamepass`, `Roblox / Via Login`, `Roblox / Via Username`; no generic instruction saying `Pilih cara mendapatkan Robux` after the choice has already been made. Keep page language translations ID/MY/EN.
6. Preserve separate implementations, state machines and fulfillment: Gamepass wizard is not Login; Username remains its own flow. Changing the URL must not inject one method's fields into another method's order.

### C. Readability: heading, breadcrumb, stepper, forms and summary

- On the detail page, **do not put dark magenta/dark gray text directly on the busy `/bg-anya.jpg` collage**. Make headings and subtitles part of a near-opaque white/light-pink rounded panel (preferred), or use genuinely high-contrast white text with a dark scrim. Do not rely on thin drop shadows for legibility.
- Fix the specific breadcrumb `Kembali ke katalog` and large heading in Gambar 2 (currently low contrast). Ensure breadcrumb has a real click target and visible hover/focus styles. Avoid duplicating `← Beranda` and `Kembali ke katalog` as visually equivalent navigation without hierarchy; keep both only if clearly distinct.
- Gamepass stepper: numbered circles, connective lines and labels must remain readable against the themed image. Put the stepper on a high-opacity panel or integrate into the wizard container. Use dark text on pale panels and adequate step states; do not use low-opacity gray for the only label identifying a step.
- Via Login panel and order summary: maintain readable dark labels, pink accents, clear price typography, explicit selected-card state, and distinguish unavailable content from clickable elements. Any help/error/empty-state text must be readable, not pink on transparent pink.
- Contrast targets: **WCAG AA ≥4.5:1** for normal text, **≥3:1** for large text and important control boundaries. Avoid hardcoded 9–10px essential labels; use roughly 12–14px as a practical minimum where space allows, and larger for primary price/action. Preserve logical keyboard tab order, visible focus, accessible radio labels and screen-reader status messages.
- Check desktop, tablet and phone widths **~1440, 810 and 375 CSS px**. No clipped stepper labels, horizontal scroll of entire page, overlapping floating WhatsApp/contact widget, or payment summary covering form actions. The reference screenshot is visual direction; use a responsive layout, not fixed pixel positioning.
- Keep Anya theme, pink gradients and existing brand imagery. **Do not change product assets, rebuild the entire landing page or redesign Apps Premium/Game** under this milestone.

### D. Via Login: package picker styled like Gambar 4

**User intent:** Via Login should feel like a polished Roblox denomination catalog, not a blank generic form with a sidebar full of dashes. The reference uses compact rounded pink cards in a dense grid.

**Required UI:**

1. On the `LOGIN` detail page, render a clear heading such as `Pilih nominal Robux` followed by a **responsive grid of selectable package cards** (one/card for an active configured LOGIN `ProductVariant`). Each card shows a Roblox/Robux-style decorative icon (use existing safe assets/inline SVG, no external unverified image dependency), **Robux quantity**, **actual selling price for the server-detected region**, and a strong selected state (border/ring/check/aria-checked). If the current schema provides a genuine package label, show it; do not show meaningless unit counts or duplicate labels.
2. **Pricing must be data-driven:** use the existing product API, `regionalAmount`, `formatMoney` and independently configured IDR/MYR/PHP prices. Quote/checkout must use existing server-signed total and idempotency. The screen must not derive MYR/PHP by relabeling IDR or using client-provided region.
3. The reference image's package denominations, original prices, sale prices, discount percentages and pink badge labels are **samples of the visual layout, NOT store prices**. Do not seed 160/240/.../10,000 Robux, copy Rp values or invent `Disc 15%` / strikethrough prices. Show a discount/original price only when **real admin-configured, validated discount data** already exists; otherwise omit discount label and original price cleanly. Do not add a discount engine/schema migration under this task.
4. Support one clearly selected package at a time with existing checkout contract. The reference mentions that multiple nominal packages can be selected simultaneously, but **current storefront appears to create a single-variant order**. **Do not fake multi-select, sum prices only in frontend, or send unsupported cart payload.** Multi-item cart/order is a separate future architecture decision requiring explicit approval, verified backend support and tests. Make single-select state obvious.
5. Layout target: compact cards with pale-pink background, roughly 2 columns on narrow phones if legible, 3–4 on desktop as width allows (may use 1 column on exceptionally narrow devices). Robux amount and final price must be larger/more legible than optional badges. Consistent card dimensions and spacing; keyboard navigation works.
6. The sidebar/order summary should show selected method **Via Login**, chosen denomination, customer price, supported payment method, region/currency, applicable fee/discount, and verified total. When the package changes, recompute the quote. Disable pay until valid selection, region, provider, form and quote are confirmed. Preserve responsive sticky summary on wide screens; stack below product picker on mobile without blocking content.
7. **Fix the misleading screenshot label** `Status pembayaran` over the QRIS select if that text is currently used for method selection. The user-facing label should say `Metode pembayaran` (via the existing translations). A payment status is not a selectable payment method.
8. If the user's screen shows **`Belum ada paket tersedia untuk metode ini`**, diagnose before redesigning away the problem: inspect `/api/products?type=ROBLOX&slug=...` response shape without exposing secrets, active LOGIN variant filters, slug, product availability, and region prices. This may be genuinely **zero active LOGIN variants**, a data configuration issue, or a filtering/UI bug. **Do not invent hardcoded packages**. If no valid packages exist, display a compact helpful empty state with admin/support direction; hide/reduce the order summary, no misleading empty price rows, and disable/hide checkout affordances. Do not create or edit remote product rows without explicit approval.
9. If the current data model/admin does not allow creating LOGIN denominations, document exactly what is missing and provide an additive *proposal* only; do not apply schema migrations or seed staging under this milestone.
10. Preserve current safe Via Login requirement: **do not request, display, save, log or transmit Roblox passwords, OTP, cookies, backup codes or session tokens**. The package visual redesign must not expand credential collection. Customer identity/contact and manual fulfillment stay under existing workflow.

### E. Keep Gamepass and Username functional and distinct

- **Gamepass:** No second method selector. Preserve slider/input, min/max/step, Roblox Gamepass listing price calculation, username verification, Gamepass URL guide, 5-step progression (minus redundant method-selection wrapper only), quote refresh and payment-on-final-confirmation. Fix headings/step contrast from Gambar 2.
- **Via Username:** No second method selector. Preserve username verification and 4-step wizard, draft state when navigating backward, regional pricing, supported payment selection and manual fulfillment. Do not turn Username into a fixed-price Login grid unless separately requested.
- **Via Login:** Fixed-package card grid per §25.D, current payment and manual fulfillment intact. Selection must never accidentally submit a Gamepass variant or gamepassUrl field. A valid active Login variant stays Login on server and on invoice.
- Method availability: always show three high-level method choices on `/roblox`, but a method with no configured/region-available packages should be visibly unavailable/non-purchasable. No redirect into a broken detail checkout and no invented stock/discounts.

### F. Target files and minimally invasive implementation path

Inspect and modify only relevant files after reading actual current code:

- `src/components/RobloxServiceCards.tsx` — ensure method-card links correctly identify the chosen method and unavailable status.
- `src/app/roblox/[slug]/page.tsx` — validate/canonicalize chosen method from query (or route), avoid silent Gamepass default for invalid deep links.
- `src/components/TopupCatalog.tsx` — remove detail-only selector and tab semantics; method-specific hero, Via Login denomination-card grid + appropriate summary/empty state.
- `src/components/RobloxMethodSelector.tsx` — remove its use from detail UI only. Delete file only if verified unused everywhere and not needed for other flows; no broad component removal.
- `src/components/RobloxCheckoutWizard.tsx` — stepper/readability adjustments for Gamepass/Username without changing business logic.
- `src/components/DetectedLocation.tsx`, `src/components/RegionalPaymentSummary.tsx`, `src/components/StoreShell.tsx` — alter only if needed for contrast/spacing; preserve trusted region data.
- `src/lib/translations.ts`, `src/lib/regionalTranslations.ts` — all new titles, empty state, CTA and payment labels ID/MY/EN via `LanguageContext`, no hardcoded UI strings.
- `tests/*` — add small targeted tests for method route, picker rendering/state, empty config, pricing/locale, and safe checkout payload. Prefer existing test infrastructure. No unapproved browser automation against Production and no remote DB writes.

### G. Completion checklist / QA evidence

- [ ] On `/roblox`, all three high-level choices **Gamepass/Login/Username** remain visible and clearly labeled (available vs unavailable state is accurate).
- [ ] Click `Beli sekarang` under Gamepass → its detail starts immediately in Gamepass and **does not display the three-method tabs or `1. Pilih metode` again**.
- [ ] Click Via Login or Via Username → the respective method is fixed correctly; old/direct/invalid URLs handled safely, not silently defaulted to Gamepass.
- [ ] Gamepass hero, breadcrumb, step labels and instructions remain readable over Anya background; contrast verified at desktop/tablet/mobile widths.
- [ ] Via Login shows a compact responsive pink **denomination-card** design inspired by Gambar 4; selected/disabled/focus states work; real product/region prices only.
- [ ] If Login has no active packages or no price for the visitor's region, display honest helpful empty/unavailable state and no fake checkout summary or active payment CTA; report backend/config evidence separately.
- [ ] Product selection updates server quote and summary consistently; no price/cart/discount fabrication. Existing single-variant checkout still validates the chosen Login variant, region, amount, method, and idempotency.
- [ ] `Status pembayaran` is not used as the label for a method selector; ID/MY/EN UI copy is coherent and legible.
- [ ] Gamepass and Via Username checkout workflows, progress, identity checks, invoice and fulfillment remain functional; admin product settings unaffected.
- [ ] Automated tests, TypeScript, lint, production build and `git diff --check` pass; browser/manual QA scope and skipped suites reported honestly.
- [ ] UI changes stay **local on `main` until user approves diff**; no commit/push/deploy/migrate/env changes or real payments.

### H. Detailed working instructions for one Antigravity/Codex batch

**First:** inspect `git status -sb`, `AGENTS.md`, current `plan.md` and references/screenshots or the screenshot requirements above. Identify the most minimal component changes preserving checkout behavior. Review the existing variant and quote contracts before modifying picker selection. Avoid wholesale rewrites of TopupCatalog and wizard.

**Then:** implement §§25.B–E completely in one local batch. Use example/mock variants for visual/tests, **not remote database inserts**. Audit the exact reason the current Login panel is empty without claiming zero products purely from the screenshot. Test responsive display (375/810/1440), keyboard navigation, real pricing format, selected state, empty/unavailable view, and method-specific checkout payload.

**Finally:** run `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check`, `git status --short`, and relevant tests that do not write remote data. Report files, actual test counts and skips, UI screenshot/QA results if available, missing data/config requirements, remaining risks, and next recommended step. **STOP before commit, push, Vercel deploy, DB writes/migrations, creating real orders, or editing `.env`.**

---

## 26. ACTIVE HANDOFF / RELEASE LOG — 2026-10-13

### Latest verified milestones (do not reset)

| Area | Evidence / status |
| --- | --- |
| P0-A1 base QRIS | Commit `9fc5f50` on `main`, Vercel Ready and a Sandbox invoice QRIS download succeeded in browser. |
| P0-A2 QRIS hardening | Commit `b12c28b` pushed to `main`. Vercel Production deployment **Ready**, verified alias `https://cloudy-pink-store.vercel.app`, build 42 seconds. Local tests reported 38 pass / 0 fail / 9 skipped. Post-deploy customer QRIS smoke retest **not yet confirmed in the conversation**. |
| P0-B checkout 400 | **OPEN**; needs actual non-secret errorCode from DevTools before changing validation. Do not conflate with UI work. |
| **P0-C Roblox UX** | **Implemented locally, not committed/deployed.** OpenCode work preserved; Codex reproduced and corrected mobile card layout, method-specific copy, empty-catalog methods and critical contrast. See the dated QA report below before repeating work. |
| P1/P2/P3 | Preserved in previous sections; P2 real international payment adapters remain blocked pending authorized provider/merchant setup. |

### Single kickoff for the next Antigravity / Codex session

> **Baca AGENTS.md dan seluruh plan.md. Tetap di branch main. Jangan menimpa pekerjaan lokal. Kerjakan seluruh milestone P0-C di §25 dalam satu batch: hapus pemilihan metode kedua di halaman detail Roblox, buat judul/breadcrumb/stepper kontras dan terbaca di atas Anya Theme, serta desain ulang Via Login menjadi grid kartu nominal seperti Gambar 4 dengan harga dan paket nyata dari admin. Audit kenapa Via Login saat ini menampilkan “Belum ada paket tersedia”; jangan membuat data/discount palsu atau mengubah DB untuk mengakalinya. Pertahankan Gamepass, Username, invoice, quote, Midtrans Sandbox, dan seluruh pengamanan checkout. Jalankan test/typecheck/lint/build/diff-check, laporkan perubahan dan kendala, kemudian berhenti untuk review. Jangan commit/push/deploy, migrasi, mengakses defaultdb, menulis ke Aiven remote, atau mengubah environment.**

**This project remains TESTING ONLY; runtime target is `cloudy_staging` and Midtrans Sandbox. No authority to change financial or production settings is implied by this document.**

### P0-C local continuation — 2026-10-13

- Latest user restriction supersedes historical staging permissions: **no Aiven/defaultdb access, no `.env` or secret/log reads, no schema/migration/env changes, no orders/payments, no commit/push/deploy**.
- OpenCode's local implementation was audited and retained. Browser fixtures use `route.fulfill()` against a separate copy of the app without environment files. Synthetic prices/fees are test data only; this does not verify production GeoIP, gateways or configured Login packages.
- Reproduced UI issues: 375 px Login grid had one column; Username hero described Gamepass; empty catalog removed all three method cards; wizard CTA/step numbers had low contrast (1.82:1). Corrected these and added an opaque breadcrumb background; existing translations reused.
- Unit/regression verification: **42 passed, 0 failed, 9 skipped**. Skipped suites require isolated MySQL/HTTP/migration prerequisites and are not evidence of live integration.
- Browser suite: `tests/roblox-p0c.e2e.mjs`, three requested viewports, all three methods, region/locale/empty/null states, keyboard selection, quote retry, username lookup, draft retention and Apps/Game smoke. Final run and screenshots: [QA report](docs/qa/p0c-2026-10-13.md).
- Final browser verification on the isolated production build: **41 passed, 0 failed**. Typecheck, lint (one existing image warning), production build and diff-check passed. No final order submission or live invoice/fulfillment was exercised.
- Earlier local catalog HTTP 500 remains **historically unconfirmed**. An isolated unavailable database reproduced `SYSTEM_ERROR`; a separate connection probe returned `PrismaClientInitializationError / P1001`. The product query precedes GeoIP resolution. No old secret-bearing logs or real environment/database were inspected; no speculative backend patch was made.
- Login packages are absent according to the user; no packages were created. Credentials exposed by the earlier OpenCode session require operator rotation/revocation and review of the old logs. No credential values were inspected or reported.
- P0-B, live invoice/fulfillment and P1/P2/P3 remain outside this UI QA scope. **Stop for user review before commit.**

**End of living project plan.**

### P0-C release authorization — 14 Oktober 2026

User approved committing the reviewed P0-C files on `main`, pushing to `origin/main`, and deploying the existing linked Vercel project to Production. This supersedes the earlier stop-before-release instructions for this milestone only. Prefer the deployment triggered by the Git push; do not create a duplicate project or deployment. Verify Ready, matching commit SHA and non-transactional public storefront smoke tests before reporting success. No environment/credential/payment changes, database writes/migrations or order creation are authorized. Credential rotation remains an urgent separate follow-up. The QA evidence above describes pre-release validation; final deployment results must be reported separately after verification.

## 27. Via Login redesign — design review checkpoint (14 Oktober 2026)

- Latest user scope is **technical proposal only** before contract/schema/invoice-auth implementation. This supersedes the older Login sidebar direction for this task; historical sections stay intact.
- Approved page direction: `/roblox/[slug]?method=LOGIN` → `/roblox/[slug]/login/account` → `/roblox/[slug]/login/summary`, with shared layout React Context, memory-only draft, and safe empty-draft handling on refresh/direct access.
- WhatsApp must belong to new Login orders, with international client/server validation and admin contact authorization; phone-country selection must not affect GeoIP/pricing. Roblox account secrets remain prohibited.
- Inspected Order/detail models, commerce/checkout/idempotency, quote, invoice detail/payment/QR download/recovery, legacy token writers, and fulfillment contact projection. No DB, environment or credential access occurred.
- Proposal: [Login contact and invoice access](docs/plans/roblox-login-contact-invoice-access.md). Covers encrypted nullable contact, new-Login requirement and legacy replay, explicit contact DTO, cookie/server-grant options, header-token compatibility, rollout/rollback and test matrix.
- Review decisions include phone-validation dependency, schema/contract, cookie grant approach, proposed 90-day TTL/32-invoice browser limit and recovery limitations. These are proposals, not deployed configuration or implemented features.
- Only proposal documentation/progress changed in this task. No code/schema/auth changes, migration/seed, real orders/payments, remote access, commit/push/deploy or application testing. Next step: user reviews design; implementation approval and remote rollout approval are separate.

### Local implementation after WhatsApp approval — 14 Oktober 2026

- User approved WhatsApp schema/contract, three Login pages, and production dependency `libphonenumber-js` with max metadata. Implemented memory-only draft, international phone normalization, new-Login contact requirement, encrypted nullable `RobloxOrderDetail.whatsappE164`, and owner-only admin contact DTO.
- Migration `202610140001_login_whatsapp` contains only nullable ADD COLUMN; **never executed**. No database/remote/defaultdb/staging access, env/credential reads, real order/payment, commit/push/deploy.
- [Local QA](docs/qa/roblox-login-2026-10-14.md): targeted 18 PASS; unit/regression 48 PASS, 9 SKIP; TypeScript/lint/schema validation/build PASS; isolated browser 19 Login + 41 P0-C PASS on 375/810/1440 viewports. DB/migration suites remain skipped, not integration evidence.
- Invoice design revised to one browser session cookie + server per-invoice grants, max 90-day expiry/revocation, no arbitrary 32-invoice cap, verified email recovery proposal. **No invoice authentication/token/cookie changes implemented**; existing legacy access risk remains.
- Next step: review local code/additive SQL and revised invoice/recovery design. Separate approval needed before any migration, invoice security implementation or release.

### Login post-review checkout fixes — 14 Oktober 2026

- Reproduced both final-review bugs against the existing isolated production build before editing (0 PASS, 2 FAIL). Added focused success/ambiguous-recovery browser regressions, without real orders/payments or repeating P0-C implementation.
- Successful invoice handoff has separate shared-context state; no premature draft clear, no Promise assumption for router.push, and a shared submit latch remains held during navigation. Empty-draft guards still apply before checkout success.
- Immutable original request/key replay is explicit and independent of current draft/quote. Unknown outcomes continue blocking a new order; committed backend replay precedes quote validation. A rejected stale quote requires fresh user confirmation, without API/schema changes.
- Invoice proposal now requires recovery session rotation, predecessor revocation and safe atomic grant transfer/issuance. Legacy invoice auth remains unchanged; no hardening implementation.
- Final checks: targeted 19 PASS; npm test 49 PASS / 9 SKIP; new checkout browser 11 PASS plus affected Login browser 19 PASS; TypeScript/lint/build/diff-check PASS (existing warnings documented). See [updated QA](docs/qa/roblox-login-2026-10-14.md).
- Both checkout findings **FIXED locally**. Preserve existing local work and reviewed schema/migration. No env/credentials/remote DB/migration/order/payment/commit/push/deploy. Stop for review; database/provider/staging integration and legacy access hardening remain separate authorized work.

### Durable Login checkout attempts — partial checkpoint, 15 October 2026

- User approved two additive models, original checkoutKey, absolute 30-day session/initial 30-minute attempt expiry, locking/version fencing, memory-only contacts, non-secret per-tab flowId, and a limited committed-attempt invoice bridge. Runtime implementation is not complete.
- Prepared CheckoutSession/CheckoutAttempt schema and draft `202610150001_checkout_attempts` SQL (never applied). Prisma validate passed in the isolated environment; Order gains an inverse Prisma relation only, without a new SQL column.
- IndexedDB coordination was approved with security limits; **no bootstrapId schema field** is authorized. Issuance/identity-loss recovery is still held for review. The updated [decision checkpoint](docs/plans/checkout-attempt-bootstrap-decision.md) proposes reusing the existing session UUID PK as a non-secret locator, with one known-committed cookie writer and no credential reissue from UUID. Web Locks alone and unprotected legacy fallback remain forbidden.
- A targeted fake-DB/provider probe confirmed the separate crash-before-charge gap: existing order replay does not initialize a missing charge, and status-only reconciliation cannot recover QR when no provider transaction exists. No outbox/automatic charge retry implemented.
- Independent backend delivered locally: cookie-only auth readers, 30-day ceiling, open/recover/confirm APIs, 30-minute attempt/lease fencing, original key, per-product join/explicit repeat, atomic Order/detail/COMMITTED, quote reconfirmation, and narrow detail/payment/QR invoice bridge. New Login creation through the public legacy endpoint is refused; historical replay is preserved. No issuer or recovery-first Login UI integration exists yet, so this partial checkpoint blocks new Login purchases and must not be deployed.
- [Partial QA](docs/qa/checkout-attempt-2026-10-15.md): 21 new attempt regressions PASS; npm test 70 PASS / 9 SKIP; bridge Playwright 6 PASS (375/810/1440), TypeScript/lint/Prisma/build PASS with documented existing warnings. These are mocks/static checks, not MySQL/bootstrap/payment evidence. Preserve prior Login fixes; no DB access/migration, real order/payment, dependency install, commit/push/deploy. Stop for bootstrap and code review, with payment-dispatch recovery still a separate blocker.

### Login bootstrap and frontend integration — 15 October 2026

- Owner approved implementation of the existing bootstrap design using CheckoutSession.id as non-secret locator, with IndexedDB coordination and no extra bootstrapId schema field. Implemented POST session issuance/acknowledgement: only a known successful unique insert emits the independent random HttpOnly Secure Lax cookie, absolute 30 days, Path=/, no Domain/renewal. Conflicts, invalid/expired cookie and uncertain commits never reissue credentials.
- Connected the existing three Login pages/context to attempt APIs and the narrow invoice bridge. Removed Login legacy checkout/token persistence. Only UUID locators persist; contacts/quotes remain in memory. Recovery precedes empty-draft guards, UNKNOWN polls at bounded backoff and blocks confirmation, NOT_COMMITTED refreshes quote before an explicit click, and repeat purchase is explicit. Package selection before first confirm advances the fence without changing checkoutKey; ambiguous attempts keep the package locked.
- [Current QA](docs/qa/checkout-login-integration-2026-10-15.md): 29 targeted domain/handler/browser-helper tests PASS; npm test 78 PASS / 9 SKIP; production-built Playwright 30 PASS / 0 FAIL on 375/810/1440, including two tabs without Web Locks, delayed one-writer bootstrap, lost response + refresh, late commit, IDOR denial, cookie/storage failure, bounded polling, repeat, ID/MY/PH/null prices and other-method navigation. TypeScript/lint/build/Prisma/diff checks PASS with existing warnings. These are isolated fixtures, not actual MySQL/provider evidence.
- Frontend is connected locally and ready for review before separately authorized disposable localhost cloudy_test_* DB tests. Real insert/locking/migration/backup/staging/provider behavior is unverified; payment crash-before-charge gap remains outside scope and blocks release. No outbox/general invoice recovery, schema/SQL/dependency/env changes, database access/migration, real order/payment, commit/push/deploy. Existing local work preserved. Stop for review.

### Authorized staging migrations — 15 October 2026

- Owner authorized staging-only logical backup and the two pending migrations. Aiven Free Plan has no Fork & restore; no dashboard login, API token, plan upgrade, or new service was requested or used. Production `defaultdb` was not accessed.
- Reverified explicit `cloudy_staging` on service `mysql-26d9d666`, MySQL 8.4.8. All eight previous migration checksums matched; only `202610140001_login_whatsapp` and `202610150001_checkout_attempts` were pending. SQL/schema diff was additive and limited to those changes.
- Backup **SUCCESS** using MySQL 8.4.3 mysqldump, single transaction, staging only, no global/table locks, tablespaces or GTID export. Private backup directory outside Git: `%LOCALAPPDATA%/CloudyPinkStoreBackups/cloudy_staging/20261015T123546Z-27decb80/`. ACL permits only the current Windows user and SYSTEM. Dump: 59,782 bytes, 16 tables; table coverage, per-table row counts, completion footer and reread SHA-256 passed. No backup contents, customer data or credentials were emitted. Restore was not performed or proven.
- A local preflight predicate initially mistook FK `ON DELETE RESTRICT` for a DELETE statement; corrected the predicate without changing SQL. The first dump command was rejected before export because mysqldump does not support the mysql client's `--connect-timeout` option. Removed that option for mysqldump; the subsequent dump passed before any migration was run.
- `prisma migrate deploy` **PASS**, exit 0, using an explicit in-memory staging DATABASE_URL. Both approved migrations **APPLIED**. Postflight: 10 successful migrations, checksums match, zero pending; `prisma migrate status` **UP TO DATE**, exit 0; database-to-schema diff empty.
- Schema verification **PASS**: nullable `RobloxOrderDetail.whatsappE164` VARCHAR(255), CheckoutSession/CheckoutAttempt, 10 indexes including primary/unique indexes, and two foreign keys with RESTRICT delete / CASCADE update. Existing Order row fingerprints were unchanged; historical WhatsApp values remain NULL.
- Staging schema is ready for integration work; no fixtures/integration tests or payment/provider operations were run. Existing MySQL test guards require disposable localhost `cloudy_test_*` and must not be bypassed for remote staging. A separately scoped staging test plan/authorization is still needed. Restore confidence and the previously documented payment crash-before-charge gap remain unverified release concerns.
- No `.env`, application source, migration SQL, production configuration or existing user changes were modified by this task. No commit, push or deployment. Local operational helper lives only under ignored `.cache/`; private verification manifests remain alongside the backup.

### Aiven staging integration harness — 15 October 2026

- Prepared separate `tests/staging/` entry points, fixture scope/Prisma forwarding guard, safe reporter and 23 real-DB integration scenarios. Existing localhost register/guards and application code remain unchanged. No remote fixture writes, migrations, orders/payments, provider calls, commit/push/deploy were performed.
- [Harness QA and exact proposed fixture operations](docs/qa/staging-integration-harness-2026-10-15.md): local guard TDD **16 PASS**, integration listing **24 SKIP** (23 await permission; one independent quote-expiry contract is absent). Syntax, TypeScript and targeted ESLint PASS; unsafe-OR mutation was detected and restored. MySQL integration has not run.
- Read-only target identity confirmed `cloudy_staging`, MySQL 8.4.8. Found existing Prisma connection has empty `Ssl_cipher`: this engine ignores `ssl-mode`. Harness now requires `sslaccept=strict` in memory; actual secure preflight is **BLOCKED by certificate trust**, awaiting a trusted public Aiven CA file path. No insecure fallback or `.env` change. This transport finding does not rerun or alter previously applied migrations.
- Fixture execution still requires separate user approval bound to a unique run ID, after strict read-only preflight passes. Proposed writes are limited to namespaced catalog/session/attempt/synthetic Order/detail/counter records. Cleanup archives/cancels Orders, deactivates fixtures and deletes only owned attempts/sessions/counters; no global cleanup. No permission to execute is implied by this checkpoint.

### Authorized strict-TLS staging integration execution — 15 October 2026

- Owner supplied public `docs/ca.pem` and explicitly approved the prepared fixture suite after secure preflight. CA validity/self-signature/no-private-key checks and Prisma strict certificate/hostname validation PASS; `cloudy_staging`, MySQL 8.4.8 and encrypted sessions VERIFIED. CA remains ignored/untracked/unstaged. No `.env` or application TLS config change.
- [Execution QA](docs/qa/staging-integration-harness-2026-10-15.md): **23 distinct integration scenarios PASS, 1 SKIP** cumulatively. Full run had 21 PASS, one harness variant-update failure and one lock-test cancellation, plus a failed cleanup hook; those issues are recorded, not hidden. Scoped recovery cleanup completed, then only the two affected scenarios were rerun: **2 PASS**, exit 0, automatic cleanup PASS.
- Harness-only fixes: Windows ESM file URLs, owned variant update validation, bounded release of the real contention lock after Prisma's transaction deadline, safe diagnostic codes and literal case selection. No application/database timeout, checkout contract, schema, migration, dependency or existing localhost guard changes. Local regressions **19 PASS**, syntax/typecheck/targeted lint/diff checks recorded in QA.
- Final scoped postflight: zero sessions/attempts/counters/active Products for either run. Three catalog Products/eight variants remain inactive and 12 synthetic Orders remain CANCELLED/archived; no hard-delete financial rows, provider references or fulfillment jobs. All five original Order full-row digests still match the private pre-migration backup manifest. Final history: 10 matching successful migrations, zero pending; no migration command was run.
- No `defaultdb`, real customer fields in output, Midtrans/Roblox network call, backup deletion, commit/push/deploy. Runtime crypto/cookies stayed ephemeral; only non-secret ID journals in ignored `.cache/`. Independent quote expiry remains 1 SKIP; actual restore/live provider/browser/ingress behavior, application TLS rollout and the existing payment crash-before-charge gap remain separate release concerns. Stop after authorized testing and verification.

### Final checkout blockers — local implementation, 15 October 2026

- [Local implementation, setup and QA](docs/qa/checkout-release-blockers-2026-10-15.md): application Prisma 6.19.3 now builds strict Aiven TLS from an explicitly supplied official CA. Vercel requires `DATABASE_CA_CERT_BASE64`; local processes may use `DATABASE_CA_CERT_PATH`. No ignored certificate deployment assumption, relaxed verification, production environment edit or guard relaxation. Restart is required after connection/CA changes to avoid retaining an old development client.
- New Login orders atomically opt into bounded payment recovery through existing CheckoutAttempt JSON metadata. Authenticated invoice refresh reconciles first, uses a durable dispatch lease and the same original invoice/operation-specific Midtrans idempotency key, and never recreates an Order. Retry stops four minutes after first dispatch; ambiguous older/historical payments remain status-only or require review. No schema migration/public API/dependency change.
- Local regression evidence: **87 PASS, 0 FAIL, 0 SKIP**; TypeScript, lint (one existing image warning), production build with dummy localhost target and whitespace check PASS. TLS/lease/retry-window mutation checks recorded in QA. Previously completed Aiven migration/integration runs were not repeated; independent quote expiry remains its previous 1 SKIP.
- Runtime Aiven handshake, Vercel deployment and real Midtrans Sandbox behavior still require their own authorized verification after CA configuration/restart. No remote database/provider calls, staging fixtures, `.env` edits, commit/push/deploy in this task. Stop after local implementation/review.

### Application runtime TLS and Sandbox preflight — 15 October 2026

- [Runtime proof, recovery review and bounded Sandbox proposal](docs/qa/runtime-tls-midtrans-sandbox-preflight-2026-10-15.md): actual local Next.js development handler/application Prisma singleton verified `cloudy_staging`, MySQL 8.4.8, TLSv1.2 and `ECDHE-RSA-AES256-GCM-SHA384`; unrelated CA failed with a TLS certificate error. Matching Prisma engine strict-mode implementation verifies certificate and hostname checks. Probe removed and local process stopped; no customer-table read or remote write.
- Midtrans contract reviewed against official Core API QRIS/idempotency/status documentation. Key is 46 characters, stable per charge operation; documented five-minute lifetime supports the conservative four-minute recovery window. Empty/ambiguous lookups remain UNKNOWN. Concrete HTTP 202 success-shaped-body gap reproduced and fixed with one explicit response-status condition; no architecture/schema/ownership/rate-limit change.
- Focused **90 PASS**; full local suite **117 PASS, 9 SKIP, 0 FAIL** (DB/HTTP/migration resource gates). TypeScript/lint/build/whitespace checks and HTTP 202 mutation review PASS. Temporary generated dev route references were regenerated after probe removal. No previously successful staging migration/integration rerun.
- Nine Sandbox scenarios are prepared, including which faults are deterministic local injections and which require real provider evidence. Await explicit permission for the proposed ceiling of six synthetic staging Orders/QRIS Sandbox transactions at IDR 1,000 each, isolated fixtures/status/settlement/local webhook replay and scoped archival cleanup. No Sandbox API call, new staging Order/fixture, production/Vercel environment edit, commit, push or deploy yet.

### Via Login screenshot and ASEAN contact picker — historical partial checkpoint, 16 October 2026

- Latest owner request: username, password, five backup codes and an ASEAN-focused phone-country selector with flags, following the attached screenshot. This is a new account-access product direction; the existing runtime still rejects Roblox secrets while mockup versus operational handling is clarified.
- Implemented locally: eleven ASEAN countries first, localized group labels in ID/EN/MY, local selected-country SVG flags, and the remaining international countries preserved without duplicates. Country selection still cannot change GeoIP/prices. No checkout/API/schema/payment/auth changes.
- [Account-access design checkpoint](docs/plans/roblox-login-account-access.md) is concrete and ready for review: masked fields, memory-only draft, final-confirmation submission, existing OrderSecret/AES-GCM reuse subject to lifecycle review, proposed 24-hour expiry, owner/recent-reauth admin reveal and cleanup. Password/backup fields, upload/OCR and credential access are **not implemented**.
- [Local QA](docs/qa/roblox-login-asean-2026-10-16.md): 7 focused PASS; full suite 118 PASS / 9 SKIP / 0 FAIL; browser 39 PASS / 0 FAIL with isolated API fixtures and 375/810/1440 layouts; TypeScript/build/whitespace PASS, lint 0 errors with 3 existing warnings. New country-filter mutation detected and restored; post-restoration focused browser PASS. Build warnings and test setup issues are documented separately from passing checks.
- Preserve actual branch `feat/roblox-login-checkout-recovery` and preexisting untracked work. No secret/env access, database access, real order/payment, migration, commit/push/deploy. Overall screenshot request remains incomplete pending the account-access decision; earlier Sandbox authorization remains pending and is not implied by this UI request.
- Follow-up design artifact: [complete account-field preview](docs/plans/roblox-login-account-preview.html), Indonesian only, with the requested username/password/five backup-code layout and ASEAN flag examples. All controls are disabled; this is not a storefront route or an operational credential form. Three isolated responsive preview checks PASS; mobile/desktop visual review PASS. Operational-access decision remains pending, with no additional application/runtime change.

### Operational Via Login — historical local implementation checkpoint, 16 October 2026

> Historical account-access approval/result record. The later P2-3 review-fix request preserves collection/reveal but requires conflicting security decisions to be marked BLOCKED. Claims below about superseding the prohibition or having no pending design decision describe the earlier checkpoint only; the current credential-policy decision remains BLOCKED under AGENTS.md §10 and the account-access design. Test counts below were not rerun by this documentation update.

- Owner explicitly chose operational access: the admin needs username/password/five backup codes to log in and perform the top-up. This resolves the earlier blocker and supersedes the earlier no-account-secrets Login direction only for this task. No additional design approval is pending for these fields. Existing release/remote/environment permissions remain separate.
- Implemented customer fields with masking, compact ASEAN flag/calling-code prefix, independent phone/pricing region, memory-only draft, final-confirmation-only submission, secret-free summary and terminal-outcome clearing. All application text is ID/EN/MY through LanguageContext; screenshot/OCR upload and automated account login are excluded.
- Existing OrderSecret/AES-GCM stores a versioned invoice/username-bound envelope atomically with Order/detail/COMMITTED. Password bytes are preserved; five distinct bounded codes are normalized and bound into the keyed request digest. Historical retries remain compatible; other categories/methods reject these fields. No schema/migration/dependency change.
- Existing fulfillment POST reveal is now narrowly authorized: PAID Login, active claimed owner, no refund/archive/removal/completion, live session, recent reauthentication, order lock, metadata-only audit and private/no-store response. UI initially masks data, requires an explicit Show action, hides within 60 seconds/on visibility loss, aborts requests and fences stale responses. Shared AdminDialog now wraps Tab/Shift+Tab and restores opener focus.
- Absolute access expiry is 24 hours. Completion/payment cancellation/failure and existing expiry cleanup delete the same secret. Expired authorized reads also delete/review/audit atomically. Physical purge timing still depends on the existing worker/cron; deployed scheduling and backup retention must be verified separately, without promising immediate physical deletion at hour 24.
- [Operational QA](docs/qa/roblox-login-access-2026-10-16.md): 10 focused domain PASS; 36 domain/checkout PASS; full suite **128 PASS / 9 SKIP / 0 FAIL**; customer browser **42 PASS / 0 FAIL**, admin browser **13 PASS / 0 FAIL** across 375/810/1440 and ID/EN/MY. TypeScript, Prisma validate, build, changed-file lint and whitespace PASS. Full lint has three existing warnings; isolated build warnings and initial fixture/keyboard failures are recorded. Owner-gate mutation detected, source restored and regression PASS.
- Branch remains `feat/roblox-login-checkout-recovery`, baseline `22402a5`; untracked preexisting work preserved. No real credentials/account login, secret/env-value reads, DB connection/mutation, provider request, migration, commit/push/deploy. Application verification used a secret-free isolated build and synthetic API/transaction fixtures. Remote integration and cleanup scheduling are unverified; older staging/provider fixture guards were not widened or run for this new write contract. Local feature work is complete; release remains separately authorized.

### Seven code-review fixes — local checkpoint, 16 October 2026

- Implemented safe cleanup/status/audit/review-count fixes, expired unused checkout-session/attempt cleanup through existing cron, ID/+62 default and public username lookup, TLS temp caching, terminal unpaid WhatsApp erasure/backfill, and current synthetic integration fixtures. All three Roblox methods and earlier local work remain intact; credential collection/reveal was not changed.
- Preserve all committed/order-linked attempt tombstones and their parent sessions even after expiry: the existing legacy-replay authorization gate depends on that relation. A failing post-cleanup replay regression caught an unsafe intermediate deletion policy; final cleanup retains these markers. Deleting them needs a separately designed permanent discriminator, not an auth/schema change in this task.
- [Review-fix QA and complete file list](docs/qa/review-findings-fixes-2026-10-16.md): **5 FIXED locally / 1 BLOCKED / 1 NEEDS VERIFICATION**. Full suite **152 PASS / 0 FAIL / 9 SKIP**; customer fixture browser **43 PASS**, admin fixture browser **13 PASS**; TypeScript/lint/build/whitespace PASS. Three existing lint warnings and existing isolated-build warnings remain; no new TLS tracing warning remains. An initial intermittent cookie-loss fixture failure did not reproduce in the later complete run; its root cause remains unproven.
- P2-3 policy reconciliation remains **BLOCKED** as documented above. P1-2 SQL/HTTP assertions were updated but actual disposable MySQL/HTTP execution remains **NEEDS VERIFICATION**. All DB/migration suites stayed gated; no new DB, remote access, real Order/payment/provider request, migration, env/dependency change, commit/push/deploy occurred.
- Safe local patch is ready for owner review; full seven-finding clean sign-off is pending those limits. Cron scheduling, real MySQL locks/FKs, provider integration and backup retention remain separately authorized operational verification. No release or commit authorization is implied.

### P1-2 / cookie-loss verification follow-up — 16 October 2026

- [Follow-up evidence and limits](docs/qa/review-verification-followup-2026-10-16.md): P1-2 stays **NEEDS VERIFICATION**, actual MySQL/HTTP **NOT RUN**. No TEST_DATABASE_URL/TEST_BASE_URL/migration-test target or known local test-service listener was available. No DB was created, connected, migrated or replaced with staging. Alternative domain/handler checks: **72 PASS / 0 FAIL / 3 SKIP**; mock results are not SQL/HTTP integration proof.
- Cookie-loss: **30/30 isolated repetitions PASS**, controlled catalogue/navigation probe **1 PASS**, complete customer diagnostic suite **43 PASS**, admin suite **13 PASS**. The original intermittent failure did not reproduce; its root cause remains **UNPROVEN**, so no guessed runtime fix or relaxed assertion was added. The investigation stops after these three approaches. Recovery/cookie behavior and test isolation were inspected within this scope, without repeating the original code review.
- P2-3 remains **BLOCKED**: the normative no-account-secrets rule conflicts with existing account-access behavior. The required owner risk/security decision remains in the linked account-access design; no collection/reveal/auth change was made and all three Roblox methods remain intact.
- Final `npm test`: **152 PASS / 0 FAIL / 9 SKIP**; TypeScript, lint, build and whitespace PASS. Three existing lint warnings and existing isolated-build warnings remain. All 166 source/test files matched the prior isolated source copy byte-for-byte before the final rebuild; additional changes are documentation only, with diagnostic scripts/results under ignored .cache.
- No Order/charge/provider call, database or migration operation, environment/dependency edit, commit/push/merge/deploy. A local review-checkpoint commit may preserve these explicit limitations after authorized file selection; full integration/policy sign-off and release are still pending. Stop after this verification report.

### Owner Login exception and Laragon preflight — 16 October 2026

- Owner explicitly approved the Via Login policy exception. **P2-3 RESOLVED**: AGENTS.md §10 and current design/method docs now permit only the existing Login password/five-backup-code envelope with purpose/consent, memory-only draft, encryption, absolute 24-hour expiry/deletion, PAID owner/reauth/audit/CSRF, private/no-store and at most 60-second display. Backup/restore and deployed purge remain operational release checks; account-access implementation and all three methods are unchanged.
- Owner also authorized opening Laragon and running required isolated local P1-2 fixtures. Laragon launched; its UI was not targetable by the helper, so installed MySQL 8.4.3 was started with classic/X binds pinned to 127.0.0.1. Read-only metadata verified existing `cloudy_test_general`, port 3306. No DB was initialized or created.
- **P1-2 NEEDS VERIFICATION / actual MySQL/HTTP NOT RUN**: all eleven existing `cloudy_test_*` schemas lack CheckoutSession/CheckoutAttempt and WhatsApp; chosen general schema also lacks removedFromAdminAt. [Concrete SQL/preflight report](docs/qa/login-policy-laragon-preflight-2026-10-16.md) lists the three additive SQL files and the suite's historical migration replay. Prior no-migration scope requires explicit approval of those changes on `cloudy_test_general` only; the question is pending. No DDL/fixture Order/provider call was performed.
- Relevant mock/domain regressions: **62 PASS / 0 FAIL / 0 SKIP**; whitespace checks PASS. Current finding count **6 FIXED/resolved / 1 NEEDS VERIFICATION**. Full 152 PASS/9 SKIP and browser 43+13 remain the previous checkpoint, not freshly run integration evidence. No runtime/env/dependency/release operation changed; Laragon/local-only MySQL remain running for the next authorized step.

## Benchmark & Roadmap Peningkatan — 19 Oktober 2026

### Tujuan dan hasil pembandingan

Pertahankan identitas **pink/Anya**; tingkatkan kejelasan produk, kenyamanan checkout, dan keandalan operasional. Apps dikembangkan bertahap: **akun siap pakai dahulu, kemudian aktivasi/perpanjangan akun pelanggan**, dengan **ketentuan garansi per produk**. Paket tetap Product/SKU terpisah dan tiga metode Roblox tetap memiliki workflow berbeda.

Pembandingan 19 Oktober 2026 mencakup halaman publik, navigasi sebelum transaksi, kode lokal, dan QA yang tersedia. Backend kompetitor tidak dapat dinilai dari tampilan. Klaim keamanan, kecepatan, dan angka penjualan mereka bukan bukti teknis. [Laporan rinci](docs/qa/competitive-benchmark-2026-10-19.md) memisahkan status **tersedia**, **sebagian**, **belum tersedia**, dan **belum terverifikasi**, tanpa persentase kesempurnaan yang tidak terukur.

| Bagian | Kondisi Cloudy Pink | Penilaian |
| --- | --- | --- |
| Alur Roblox | Tiga metode, wizard, nominal, pemeriksaan username, ringkasan, invoice, dan progres | Struktur alur sudah dekat dengan referensi; pertahankan perilaku yang bekerja |
| Tampilan Roblox | Identitas dan kartu informatif tersedia | Perlu pematangan hierarki, panjang penjelasan, stepper, dan konsistensi |
| Apps siap pakai | Pencarian lokal, stok, konfirmasi, pembayaran, pengiriman akun, bantuan OTP | Alur dasar tersedia; informasi paket dan cakupan pencarian masih kurang |
| Katalog Apps aktual | API publik Preview mengembalikan 0 produk Apps saat pemeriksaan | Belum dapat dinilai sebagai katalog penjualan aktif; bukan bukti data lokal juga kosong |
| Backend transaksi | Harga server, verifikasi pembayaran, transaksi stok, idempotensi, recovery, pemisahan payment/fulfillment | Fondasi cukup lengkap; kesiapan operasi memerlukan bukti tersendiri |
| Aktivasi/perpanjangan Apps | Fulfillment saat ini berpusat pada stok akun | Memerlukan jalur bisnis dan fulfillment baru |

### Referensi dan batas adopsi

| Referensi | Pola yang digunakan |
| --- | --- |
| [Mayoblox Gamepass](https://www.mayoblox.com/robux/checkout/gamepass-po), [Via Login](https://www.mayoblox.com/robux/checkout/via-login) | Kejelasan tahapan, informasi sebelum pesan, slider/paket; perbaiki wizard yang ada tanpa membangun ulang |
| [Mayoblox FAQ](https://www.mayoblox.com/faq), [pencarian pesanan](https://www.mayoblox.com/orders/search) | Bantuan menurut masalah dan tindak lanjut; akses pesanan toko tetap memerlukan hak yang sah |
| [Premiumku detail produk](https://premku.com/netflix) | Detail paket, batas penggunaan, dan stok sebelum pembayaran |
| [Seakun](https://seakun.id/) | Tahap layanan, masa aktif, dan perpanjangan; model grup tidak otomatis disalin |
| [Panduan aktivasi Spotify itemku](https://itemku.zendesk.com/hc/id/articles/360039529151-Cara-Trading-Premium-Upgrade-Spotify) | Undangan dengan syarat/tindakan pelanggan; pisahkan aktivasi dari pengiriman akun |

Aturan metode mengikuti [transfer Roblox](https://en.help.roblox.com/hc/en-us/articles/48510707796756-Sending-and-Receiving-Robux) dan [Experience Passes](https://en.help.roblox.com/hc/en-us/articles/203314040-Experience-Passes). Jangan menyalin batas umur, estimasi, harga, diskon, aset, atau klaim aman/legal dari kompetitor menjadi aturan toko. Jangan meminta DOB/identitas/OTP untuk meniru pemeriksaan kelayakan Roblox.

### P0 — Pastikan kesiapan produk dan operasi

- Inventarisasi produk Apps yang benar-benar dijual: paket, stok, cara penggunaan, perangkat/region, bantuan, dan sumber harga. Jangan mengisi katalog kosong dengan produk/stok contoh.
- Gunakan matriks backend pada laporan QA: checkout, webhook, stok, recovery, fulfillment, akses akun, cleanup, backup/restore; pisahkan bukti lokal, fixture, Preview, dan provider.
- Verifikasi eksekusi scheduler, purge rahasia, retensi backup, dan restore sebelum menyatakan Login siap operasional. Pertahankan bukti restore lokal yang sudah tercatat; jangan menganggapnya bukti retensi provider atau purge terjadwal di deployment.

**Selesai jika:** setiap produk dan kemampuan memiliki status, bukti bertanggal atau hambatan yang jelas. Matriks awal sudah didokumentasikan; inventaris produk nyata dan penutupan gate operasional tetap pending.

### P1 — Perbaiki kualitas UI dan informasi yang sudah ada

- Roblox: ringkas hierarki judul, penjelasan, kartu, stepper, ringkasan, dan instruksi tindakan pelanggan. Pertahankan satu pemilihan metode dan tiga workflow.
- Bedakan proses tim, pembelian Gamepass, pending Roblox, dan konfirmasi penerimaan. Estimasi toko hanya ditampilkan bila memiliki dasar operasional.
- Apps: kurangi kepadatan kartu mobile dan tampilkan informasi penting sebelum konfirmasi.
- Pemuatan katalog pertama harus menganggap HTTP gagal atau `success: false` sebagai error dengan coba lagi, bukan katalog kosong. Temuan saat ini berasal dari pembacaan kode, bukan insiden HTTP 500 yang direproduksi di Preview.
- Perjelas informasi toko, dukungan, privasi, dan ketentuan produk; pertahankan FAQ/progres invoice yang sudah selesai.

**Selesai jika:** pelanggan memahami produk, metode, total, tahap pesanan, dan tindakan berikutnya; seluruh state dan tiga bahasa terverifikasi pada ukuran layar wajib.

### P2 — Matangkan Apps siap pakai dan garansi per produk

- Tambahkan detail Apps: jenis akun, durasi, perangkat, batas penggunaan/region, isi paket, stok, panduan, dan ketentuan garansi.
- Pertahankan Product/SKU terpisah per paket agar stok/checkout kompatibel. Kelompok aplikasi memakai metadata eksplisit, bukan tebakan nama produk.
- Tambahkan kategori dan pencarian server yang mencakup seluruh katalog, kompatibel dengan pagination.
- Admin mengelola garansi per produk/paket; checkout menyimpan versi ketentuan pada pesanan sehingga perubahan admin tidak mengubah hak pesanan lama.
- Pertahankan jalur legacy tanpa snapshot; jangan membuat tanggal atau ketentuan historis dari asumsi.
- Bantuan/klaim dari invoice memiliki status penanganan dan referensi pesanan. Kredensial hanya ditampilkan melalui akses invoice yang sah, bukan chat/notifikasi.

**Selesai jika:** pelanggan dapat membandingkan paket dan memahami ketentuan sebelum membayar; admin menangani bantuan berdasarkan ketentuan saat pembelian.

### P3 — Tambahkan aktivasi dan perpanjangan secara terpisah

- Bedakan akun siap pakai dan aktivasi akun pelanggan melalui konfigurasi produk serta snapshot pesanan; produk lama tetap mode stok.
- Gunakan mekanisme produk yang didukung: undangan, tautan aktivasi, atau voucher; jangan menambah formulir password pelanggan generik.
- Pembayaran aktivasi menghasilkan antrean pekerjaan, bukan status layanan aktif. Catat tindakan pelanggan, proses admin, bukti aktivasi, serta awal/akhir layanan.
- Perpanjangan membuat pesanan baru yang terhubung ke layanan sebelumnya dengan harga/quote dan konfirmasi baru; tanpa penagihan otomatis.
- Pengingat bersifat pilihan dan memakai data minimum; tanpa password/kode akses di notifikasi.

**Selesai jika:** kedua model Apps berjalan tanpa stok palsu, dan payment tidak disamakan dengan aktivasi selesai.

### P4 — Optimasi setelah alur utama matang

- Lengkapi metadata halaman, preview tautan, sitemap publik, dan perlindungan indeks halaman privat.
- Ukur performa sebelum mengoptimalkan gambar, background, bundle, atau polling.
- Ukur titik berhenti checkout secara agregat tanpa rahasia atau data pribadi.
- Testimoni, promo, rekomendasi paket, dan statistik hanya dari data nyata. Leaderboard, popup pembelian, multi-cart, dan pilihan banyak nominal bukan prioritas awal.

**Selesai jika:** perubahan SEO/performa memiliki bukti terukur, halaman privat terlindungi dari indeks, dan informasi promosi memiliki sumber nyata.

### Kontrak, pengujian, dan batas implementasi

Fase fitur perlu merancang metadata publik/admin Apps dan garansi, parameter pencarian/kategori dengan pagination, snapshot ketentuan/fulfillment, serta pekerjaan aktivasi/perpanjangan terpisah dari reservasi stok. Schema additive ditinjau sebelum migrasi; produk/order lama harus tetap kompatibel.

- UI ID/EN/MY pada **375×812, 810×1080, 1440×900**: keyboard, teks panjang, loading, empty, error, stok habis.
- HTTP gagal tidak tampak kosong; pencarian menemukan produk di luar halaman pertama.
- Harga server, double-submit, pembayaran ambigu, webhook berulang, dan reservasi stok bersamaan tetap aman.
- Perubahan admin tidak mengubah snapshot garansi pesanan lama; legacy tidak memperoleh tanggal rekaan.
- Aktivasi dibayar belum selesai sebelum fulfillment terkonfirmasi.
- Invoice/admin menolak akses tanpa hak; rahasia tidak masuk log, storage, atau notifikasi.
- Provider, scheduler, purge, dan restore dilaporkan terpisah dari fixture; SKIP bukan PASS.

**Handoff dokumentasi:** bagian ini dan [laporan benchmark](docs/qa/competitive-benchmark-2026-10-19.md) ditambahkan tanpa menimpa riwayat/perubahan lokal. P0 → P4 adalah roadmap, bukan klaim fitur selesai. Pekerjaan ini tidak mengubah API, schema, konfigurasi, database, atau kode aplikasi; tidak mencakup commit, push, maupun deployment.

### Implementasi lanjutan — 19 Oktober 2026

Pemilik kemudian meminta roadmap dikerjakan dan memberi akses penuh untuk pekerjaan ini. Scope lokal berkembang menjadi UI/API/schema additive dan pengujian disposable localhost. Checkpoint dokumentasi sebelumnya tetap dipertahankan sebagai riwayat; bukan status implementasi terbaru.

- P0 sebagian: matriks dan [inventaris CapCut](docs/plans/apps-product-inventory-2026-10-19.md) tersedia; data harga/stok/perangkat/region/metode aktivasi dan bukti scheduler/retensi provider masih menghambat penjualan/rilis operasional.
- P1 lokal: Apps lebih terbaca, error/retry tidak false empty, detail sebelum bayar, pencarian server, bantuan/privasi; kartu Roblox lebih ringkas dan estimasi lima hari tanpa bukti dihapus.
- P2 lokal: metadata/admin paket, SKU tetap terpisah, token konfirmasi dan snapshot garansi, legacy fallback, bantuan invoice dengan lifecycle/audit.
- P3 inti lokal: activation dipisahkan dari stock delivery, paid tidak otomatis aktif, owner/recent reauth/evidence, periode layanan dan renewal yang menjaga sisa durasi/serialisasi sumber. Reminder dispatch dan metode CapCut nyata pending.
- P4 dasar lokal: metadata, robots/sitemap publik dan private noindex. Pengukuran funnel/performa serta optimasi berbasis pengukuran belum dilaksanakan.
- Migration baru hanya diuji di `cloudy_test_benchmark_20261019` dan `cloudy_test_benchmark_upgrade_20261019`. Runtime baru belum boleh dirilis sebelum additive migration pada target bersama yang terverifikasi; tidak mengakses defaultdb atau menjalankan transaksi provider.

[QA implementasi](docs/qa/benchmark-implementation-2026-10-19.md) memuat kontrak, bukti, batas fixture/provider, hasil review, dan urutan rilis/pemulihan. Tidak ada commit/push/deployment pada checkpoint ini.

**Bukti akhir lokal:** regression **207 PASS / 0 FAIL / 9 SKIP**; integration Apps MySQL **9 PASS**; browser fixture **9 Apps + 37 shared PASS**; HTTP tanpa database **5 PASS**. Migration kosong dan upgrade fixture lama PASS (digest lama utuh, diff schema kosong). TypeScript/lint/build PASS dengan warning yang dijelaskan di QA. Ini bukan bukti pembayaran provider, aktivasi CapCut nyata, eksekusi scheduler deployment atau kesiapan Production.

### Pembaruan keamanan Node.js — 22 Oktober 2026

- Node utama Windows diperbarui dari 24.16.0 ke **24.22.1**; npm **11.19.1**, hash vendor dan tanda tangan executable valid. Rilis ini memuat perbaikan Brotli RCE **CVE-2026-111497**. Proses yang sudah berjalan sebelum instalasi perlu dimulai ulang oleh pemilik aplikasi.
- Kebijakan lokal: `.node-version`, minimum engine `>=24.22.1 <25`, dan `engine-strict` untuk instalasi. Workflow cron memakai checkout/setup-node dengan SHA penuh serta pemeriksaan versi sebelum eksekusi. Perubahan workflow masih lokal, belum menjadi bukti eksekusi GitHub atau patch Vercel.
- Verifikasi Node baru: clean install dan Prisma generate PASS; regression **220 PASS / 0 FAIL / 9 SKIP**; TypeScript, lint, dan build PASS (3 warning lint lama). HTTP dengan fixture MySQL localhost membuktikan penolakan checkout stok habis tanpa pesanan baru, otorisasi invoice, pengiriman akun terenkripsi, serta empat halaman publik. Tidak ada pembayaran provider baru atau akses DB remote.
- **Belum ditutup:** audit masih mencatat lima High pada satu rantai development ESLint menuju `braces` (**CVE-2026-93687**), tanpa patch upstream. Konfigurasi lint saat ini tidak menerima pola dari pelanggan; dependency production tercatat nol temuan. Versi patch runtime deployment belum terverifikasi. Tidak ada penonaktifan rule, audit suppression, forced downgrade, commit, push, atau deployment.
- Bukti dan review independen disimpan sebagai artefak Codex Security `hardening/node-runtime-update-2026-10-22.md`; status keseluruhan sebagian, bukan klaim seluruh celah selesai.

### Rilis patch keamanan Node.js — 22 Oktober 2026

- Izin pemilik: push patch konfigurasi keamanan saja ke feature untuk Preview, kemudian patch yang sama ke `main` setelah Preview lolos. Lima file konfigurasi dirilis; perubahan Apps/UI dan dokumentasi lokal tidak ikut commit.
- Preview **1694861caf1812029b04c365bbcd5d7a13637f9b** dan Production **469c92aa11d19c5afcec6a6dfa36133740319a80** sudah dipush, deployment **Ready**, SHA cocok. Tree kedua commit identik; patch main hanya satu commit di atas `3aae3a9`. Worktree rilis terpisah sudah diarsipkan.
- [Preview](https://cloudy-pink-store-b1rgt7ohg-jax-v12.vercel.app) dan [Production](https://cloudy-pink-store.vercel.app): homepage, Apps, Roblox, bantuan, dan API produk masing-masing **5 PASS**. API Apps `success: true` dengan **0 produk**. Tidak ada seed, pesanan, pembayaran, notifikasi, atau akses DB langsung pada pemeriksaan rilis.
- Akses connector Vercel ditolak scope tim; CLI dengan sesi yang sudah ada berhasil memverifikasi proyek, deployment, dan alias. Proyek tetap Node **24.x**. [Bulletin resmi Vercel](https://vercel.com/kb/bulletin/node-js-security-advisory) menyatakan WAF otomatis mencakup serangan masuk dan patch runtime sedang digulirkan; respons eksternal yang didekompresi tetap memerlukan patch runtime. API/log deployment tidak memberi versi patch pasti, sehingga Ready bukan bukti fungsi berjalan pada 24.22.1.
- **Masih menunggu:** patch upstream `braces` (rilis terbaru masih 3.0.3); versi patch fungsi Vercel; eksekusi cron GitHub pada SHA main yang baru (belum ada run saat pemeriksaan). Tidak dispatch cron tambahan karena dapat menjalankan pekerjaan operasional.
- Node utama kembali diverifikasi **24.22.1**, npm **11.19.1**. Proses lama ternyata 9router di luar workspace; setelah pemilik melakukan restart, PID lama **25384** sudah berhenti. Pada cek terakhir belum ada listener baru di port **20128**, sehingga server 9router yang baru belum terverifikasi berjalan; kesiapan toko tidak bergantung pada klaim restart tersebut.
- Laporan tindak lanjut disimpan sebagai artefak Codex Security `hardening/node-runtime-release-2026-10-22.md`. Pemeriksaan lokal sebelumnya tetap menjadi bukti lokal, bukan diulang atau dilabeli sebagai tes provider/deployment.

### Verifikasi runtime fungsi dan cron Production — 22 Oktober 2026

- Pemilik meminta nomor 1 dan 2: log startup versi Node dan satu uji cron Production terkontrol. Hook bawaan Next.js pada `src/instrumentation.ts` hanya mencatat `STORE_NODE_RUNTIME` serta `process.version` di runtime Node; tanpa data request, customer, credential, atau nilai env lain.
- Perubahan satu file dirilis: feature **af4933fe2d30094f11336bc2dffda36c1ebefd0f**, main **6757c56625751554d634a5f6b09f73a4e94a3940**. Kedua deployment Ready dan SHA cocok; patch main terpisah melalui worktree yang sudah diarsipkan. Perubahan Apps/UI lokal tidak ikut dirilis.
- [Preview baru](https://cloudy-pink-store-jxll0f51y-jax-v12.vercel.app) dan [Production](https://cloudy-pink-store.vercel.app) masing-masing **5 HTTP PASS**. Bukti lokal baru: hook Node/Edge PASS, regression **220 PASS / 0 FAIL / 9 SKIP**, TypeScript/lint/build PASS (3 warning lint lama). Server hasil build mencatat versi lokal **24.22.1**; server uji dihentikan.
- **Temuan terkonfirmasi:** log `source:function` yang dibatasi ke masing-masing deployment menunjukkan **v24.21.0**, pada Preview maupun Production. Ini lebih rendah dari patch **24.22.1** untuk CVE-2026-111497. Minimum engine/build/Ready bukan bukti patch fungsi. Verifikasi versi selesai; remediasi runtime Vercel tetap **BLOCKED pada rollout/support Vercel**, tanpa klaim celah telah tertutup atau eksploitasi terjadi.
- Tepat satu [cron manual #31](https://github.com/Jax-v12/cloudy-pink-store/actions/runs/39781206313) dijalankan dari main **6757c56**: **Success**, 20 detik; job **119832634856**, **19:47:08–19:47:22 WIB**. Setup dan assertion versi runner **24.22.1** PASS; ketiga endpoint terautentikasi PASS. Run terjadwal sebelumnya **39777945979** pada main **469c92a** juga tercatat Success.
- Log request deployment Production pada jendela uji membuktikan tepat **1 GET HTTP 200** untuk masing-masing `/api/cron/cleanup`, `/api/cron/fulfillment`, `/api/cron/reminders` (3 total, tanpa halaman lanjutan). Tidak ada pemicu manual kedua. Bukti ini mencakup jumlah panggilan endpoint; bukan bukti delivery pelanggan tertentu, jumlah record purge, WhatsApp nyata, atau seluruh kasus idempotensi historis. Efek operasional cron berjalan sesuai izin; tidak mengambil data pelanggan atau body respons rahasia.
- Bulletin Vercel masih menyatakan rollout patch sedang berjalan dan WAF melindungi serangan masuk, bukan respons Brotli dari server luar. Tidak mencoba override patch yang tidak didukung atau mengganti major version tanpa bukti. Laporan `hardening/runtime-and-cron-verification-2026-10-22.md` beserta JSON runtime/request dan screenshot Success disimpan di artefak Codex Security; draft pertanyaan support disiapkan tetapi **tidak dikirim**.

### Lanjutan CapCut tujuh hari dan Apps/UI — 22 Oktober 2026

- Pemilik memilih roadmap CapCut → pembelian Sandbox → Apps/UI. Bukti pembayaran paket 30 hari sebelumnya dipertahankan; tidak membuat ulang transaksi atau mengisi kembali stoknya.
- Target baru hanya localhost **cloudy_test_capcut_e2e_20261022**, schema kosong dimigrasikan tanpa menyalin data pelanggan. Dua konfigurasi paket mengikuti keputusan pemilik; hanya paket tujuh hari Rp13.000/garansi7hari aktif di target lokal ini, dengan **1 stok sintetis terenkripsi / 0 pesanan**. Shared Preview/Production tidak diubah.
- Pemeriksaan baru **9 browser/API/MySQL PASS**, ID/EN/MY ×375/810/1440, pada katalog dan detail tujuh hari; search, consent, bahasa, layout serta tidak adanya checkout akibat navigasi terverifikasi. Lint tiga file dan build/TypeScript pada Node24.22.1 PASS; **0 panggilan Midtrans**.
- Tiga file perbaikan Apps/UI yang telah direview disiapkan dalam staging Git. Rilis feature Preview → main menunggu izin task+target yang sudah ditanyakan; docs/perubahan lokal lainnya tetap terpisah.
- Uji provider baru menunggu key Sandbox lokal dan pilihan callback. CLI tidak menyediakan key Sandbox yang dapat dipakai; guard berhenti sebelum provider dipanggil. Pemilik diminta mengisi key langsung di berkas ignored `.cache/capcut-e2e-20261022/.env.sandbox.local`, tanpa mengirimnya ke chat.
- Webhook Preview terhalang login Vercel; Midtrans tidak mendukung custom header untuk menembus proteksi tersebut. Usulan HTTPS sementara ngrok hanya menuju bridge POST webhook untuk satu invoice lokal menunggu persetujuan; belum membuka tunnel atau mengubah proteksi. Harness membatasi satu pembayaran Sandbox Rp13.000 dan menyimpan journal sebelum request.
- [QA dan panduan resume](docs/qa/capcut-seven-day-readiness-2026-10-22.md): lanjut dari DB/stok yang sudah ada, jangan mengulang seed/migrasi atau pembayaran lama. Pembayaran tujuh hari dan delivery provider nyata **belum diuji** pada checkpoint ini.

### Preview Apps/UI dan pembelian tujuh hari selesai — 23 Oktober 2026

- Izin terbaru pemilik: **Preview saja** untuk tiga file Apps/UI; satu pembayaran Midtrans Sandbox maksimal Rp13.000 dan webhook HTTPS sementara ke target localhost yang sudah disiapkan. Tidak ada izin rilis Apps/UI ke main pada kelanjutan ini.
- Commit feature **82b55064f9b4e953981655897879480db18f4072** hanya berisi label pencarian/katalog ID/EN/MY dan pembungkusan kredensial invoice. Sudah dipush ke `feat/roblox-login-checkout-recovery`; [Preview](https://cloudy-pink-store-a100w1sf5-jax-v12.vercel.app/apps) **Ready**, SHA dan alias cocok. Main tetap **6757c56**; dokumen/perubahan lokal lain tidak ikut commit.
- Pemeriksaan baru Preview: **5 HTTP PASS + 9 browser/API PASS**, ID/EN/MY ×375/810/1440. Katalog nyata tetap0 produk; pencarian, empty state, label, keyboard dan overflow diperiksa tanpa fixture respons atau checkout remote. Build/TypeScript/lint dan9 kasus lokal sebelumnya tetap bukti sebelumnya, tidak diulang.
- Target **cloudy_test_capcut_e2e_20261022** dipakai ulang tanpa seed/migrasi baru. Tepat **1 order / 1 charge Sandbox Rp13.000** melalui browser; replay idempotency mengembalikan invoice yang sama. Simulator resmi dan webhook HTTPS **asli Midtrans** menghasilkan pending200 lalu settlement200, tanpa polling/recovery atau payload signed buatan untuk menandai paid.
- Hasil akhir: **PAID / COMPLETED / 1 SOLD / 0 READY**, masa aktif7hari dan garansi7hari; kredensial pending tersembunyi, delivery berizin cocok di memori, akses tanpa token404, invoice375px tanpa overflow. Akun **sintetis/nonfungsional**, sehingga ini bukan bukti login/entitlement CapCut nyata atau pembelian melalui Preview deployment. Transaksi30hari lama tidak diulang.
- Asumsi prefixkey `SB-` pada helper dikoreksi setelah penjelasan pemilik: key terverifikasi lewat GET Sandbox dengan kontrol negatif401 dan hasil autentikasi404 untuk transaksi acak yang tidak ada. Key tidak diedit/ditampilkan; endpoint Production tidak dipanggil. Kendala DNS diatasi hanya dalam proses test dengan validasi TLS tetap aktif, tanpa mengubah Windows/config toko.
- Tunnel, bridge, server uji dan MySQL milik task dihentikan; DB/order/journal dipertahankan, tanpa mengisi ulang stok. [QA lengkap](docs/qa/capcut-seven-day-readiness-2026-10-22.md) memisahkan bukti Preview, local, provider, dan batas operasional.
- **Masih pending:** stok dan hak akses CapCut nyata serta ketentuan perangkat/region/klaim yang final; konfigurasi WhatsApp Business Platform/API; remediasi runtime Node Vercel/upstream dependency yang telah dicatat. Tidak menyatakan toko siap menerima pembayaran live.

### Pembatasan pasar publik khusus Indonesia — 24 Oktober 2026

- Pembelian baru, quote, harga katalog publik Apps/Roblox, serta penawaran/komit perpanjangan Apps kini dibatasi hanya untuk lokasi terverifikasi **Indonesia (`ID` / `IDR`)** melalui `resolveRequestRegion` dan `createCheckout`. Pengunjung dari `MY`, `PH`, negara lain, atau lokasi yang belum terverifikasi gagal tertutup (`unsupported` / `unverified`), menerima `price: null` dan `checkoutEnabled: false`, serta melihat pemberitahuan lokal ID/EN/MY tanpa selector region publik.
- Harga regional `MY`/`PH` di database dan admin tetap dipertahankan untuk konfigurasi masa depan dan histori pesanan; replay idempoten serta akses invoice yang sah tetap berjalan meskipun lokasi pelanggan berubah setelah transaksi dibuat. Otorisasi token invoice pada `/api/orders/[id]/renew` tetap diperiksa sebelum validasi region sehingga tidak membocorkan keberadaan invoice (`404` untuk akses tanpa hak).
- Bukti lokal: `npx tsc --noEmit` PASS, `npm run lint` PASS (0 error, 3 warning lama), seluruh suite `tests/*.test.mjs` **283 PASS / 0 FAIL / 0 SKIP** (226 unit/regresi + 57 integrasi MySQL/HTTP/migrasi pada `127.0.0.1:3306/cloudy_test_*`), `tests/apps-roadmap.integration.mjs` **9 PASS / 0 FAIL**, uji mutasi guard `country === 'ID'` tertangkap oleh `tests/region.test.mjs`, dan build produksi terisolasi Next.js 16.4.2 pada Node 24.22.1 PASS.
- Verifikasi browser terisolasi: **45 skenario `tests/indonesia-market.e2e.mjs` PASS** dan **9 skenario `tests/apps-roadmap.e2e.mjs` PASS** pada `ID`/`EN`/`MY` × `375×812`, `810×1080`, `1440×900` tanpa horizontal overflow atau page error. Probe HTTP baca-saja ke Production lulus **9/9** endpoint. Server renderer uji (`127.0.0.1:3178`) telah dihentikan.
- Commit **5b2b85b6a80d370530401899e1d4f9de9dee4e9f** (`feat(region): restrict public sales and renewals to Indonesia`, 20 file) dipush ke `origin/feat/roblox-login-checkout-recovery`; deployment Vercel Preview **dpl_68QbRnouC3a35hQGi9XuqcMdJTd5** ([`https://cloudy-pink-store-urb2fgz3b-jax-v12.vercel.app`](https://cloudy-pink-store-urb2fgz3b-jax-v12.vercel.app), alias [`https://cloudy-pink-store-git-feat-roblox-login-checkout-6e332a-jax-v12.vercel.app`](https://cloudy-pink-store-git-feat-roblox-login-checkout-6e332a-jax-v12.vercel.app)) berstatus **Ready** dan lulus **6/6** smoke HTTP baca-saja terautentikasi (`/`, `/apps`, `/roblox`, `/help`, `/api/products?type=APPS`, `/api/products?type=ROBLOX`, `region: "ID"`). `main` tetap pada `6757c56` sampai rilis Production disetujui. Lihat [laporan QA lengkap](docs/qa/indonesia-market-launch-2026-10-24.md).
