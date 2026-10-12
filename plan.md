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

**Current priority: stabilization (QRIS download + checkout 400) first, then resume Roblox.** Read sections 17–23 for the active queue. Retain all three Roblox methods; do not implement unrelated roadmap items in the same task.

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

Keep this as a distinct Roblox method, but **do not store or expose a Roblox password in the application database**.

Target flow:

1. Customer chooses **Via Login**.
2. Customer selects a package/amount.
3. Customer enters non-secret account/order information such as Roblox username and contact information.
4. Customer pays.
5. Paid order enters the fulfillment queue as **Via Login**.
6. Admin handles the assisted login/fulfillment process outside persistent password storage.
7. Admin marks the order as processing/completed.

Security rule: do not add `robloxPassword` persistence, password-reveal controls, logs containing passwords, or plaintext/encrypted Roblox-password storage. If the exact assisted-login mechanism needs to change later, ask the user before designing a credential-handling system.

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

### Automatic region detection (required customer UX; implementation status documented in sections 16 and 17)

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

1. Run read-only Prisma validation/checks as relevant. Never execute a migration, db push, reset, seed, or any database write without separate explicit user approval and verified target DB.
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
- `requestRegion.ts` verifies request-scoped HMAC country attestations from a trusted ingress. Raw CDN/forwarded headers, query/body country values, cookies and language cannot select a checkout region. This ingress contract is implemented and tested but **not deployed or enabled**: the user confirmed local/ngrok hosting and no verified GeoIP source exists. Unverified or unsupported locations receive a neutral blocked state and the existing store WhatsApp support link. There is no default IDR Roblox checkout.
- Quotes and every new Roblox order require the server-resolved region and signed quote, including legacy clients. Existing idempotent retries resolve before new location/price checks to preserve historical invoices. Regional responses are private/no-store; server-rendered page shells contain no region-specific prices. Region drift while paginating discards incompatible catalog data; quote drift requires review and renewed confirmation.
- Incorrect-location support is available; self-service corrections and unaudited admin overrides are not implemented. Checkout remains blocked until trustworthy verification is possible. See `docs/regional-deployment.md` for ingress prerequisites, trust boundaries and the required constraints for any future support correction facility. IP-derived country is not billing-country proof.
- Both screenshot errors were caused by missing regional schema in the configured database (Prisma P2022, `Order.pricingRegion`). Applied the existing assisted-login and regional migrations after checking that no Roblox secrets were stored. The three existing orders and one stock row were preserved. Authenticated `/api/admin/orders` and `/api/admin/fulfillment?type=ROBLOX` subsequently returned HTTP 200, with three and two rows respectively. Admin load errors now have a specific translated message; failed order fetches no longer log a client exception that opens the development overlay.
- Sections 9–14 remain intact: Apps Premium and the three Roblox methods retain separate fulfillment; payment confirmation does not complete Roblox delivery. Section 11 remains the later Game Top-up phase, without a new live game integration.
- Validation: 39 unit/database checks and the separate HTTP integration test passed; Prisma schema validation and migration status are clean; TypeScript, ESLint and `next build` passed. `npm run build` initially hit a Windows Prisma DLL lock held by the running development server during its `prebuild` generation step; the already-current generated client was used for the successful production build. Browser checks verified unavailable location despite `?region=ID`, no buyer country switcher, working admin order/fulfillment lists and no console errors in the isolated admin harness. Gateway and GeoIP attestations in tests are fixtures, not proof of a live provider or GeoIP deployment.

---

## 17. ROADMAP TERPADU — ACTIVE SOURCE OF TRUTH (2026-10-12)

**Purpose:** A single durable task list for Gemini, Codex, and ChatGPT Work. Agents must read AGENTS.md and this full file first, then check working-tree changes before writing code. Historical chapters 1–16 remain for requirements and architectural decisions; dated statements in old audit notes are not necessarily current. This section overrides old scheduling claims such as "Roblox first" while preserving all permanent Roblox and Apps Premium requirements.

**Execution model:** Complete the currently approved milestone as one coherent batch, including bug fixes that are direct consequences and regression tests; do not stop for a new user prompt after each tiny issue. Do not interpret this roadmap as blanket authorization to execute later milestones, modify remote data, deploy, or activate payments.

### Baseline and verified versus reported status

- GitHub project Jax-v12/cloudy-pink-store; Next.js App Router, Prisma, Aiven MySQL, Vercel. Latest user-confirmed Production Ready security commit: 69d19b2 on main; canonical alias https://cloudy-pink-store.vercel.app pointed to it.
- **Testing database:** user confirmed local .env and Vercel DATABASE_URL target Aiven cloudy_staging. **Never access defaultdb**. Runtime Prisma guard is not protection for Prisma CLI. Do not print secrets, database URLs, access tokens, customer data, or credentials.
- **Payments:** Midtrans Sandbox only, NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false, Sandbox server key. MY/PH merchant adapters not active. Do not enable real payments.
- **Production smoke tests already reported:** API products HTTP 200, CSP and nosniff headers active, Admin login and Ruang Pengiriman normal, and Sandbox QRIS image visible.
- **Confirmed current bug:** clicking Download QRIS on a pending Sandbox invoice fails because direct browser fetch of the api.sandbox.midtrans.com QR-code image is blocked by Midtrans CORS. Whitelisting the domain in CSP does not grant browser CORS access.
- **Separate unresolved issue:** Console also showed HTTP 400 on /api/checkout. Exact response errorCode was not provided. Diagnose independently; do not assume same cause as CORS.
- **Local changes not yet deployed, per Gemini report:** new authenticated same-origin QRIS endpoint, strict Midtrans URL validation, bounded streaming of image responses, direct-download frontend integration, translation updates and security tests. Last reported outcome 34 passed, 0 failed, 9 skipped; TypeScript, lint and production build passed. Inspect actual local diff; reports alone do not validate real browser behavior.
- **Admin archive:** existing archive/hide/remove invoice is a reversible administrative soft removal, not deletion of customer financial records. Protect historical orders.

### Priorities and completion gates

| Priority | Milestone | Current state | Acceptance gate |
| --- | --- | --- | --- |
| P0-A | Reliable Download QRIS | Local implementation reported; final mid-stream error handling pending | Review + tests + successful Sandbox browser download after approved deploy |
| P0-B | Diagnose checkout HTTP 400 | Not yet attributed | Concrete response errorCode and minimal tested fix only if genuine bug |
| P1 | Security, integration QA and operations | Some smoke tests passed; integrations skipped | Test coverage, restore drill, cron/webhook monitoring and operational checklist |
| P2 | Live payments for ID / MY / PH | Blocked on provider and merchant readiness | Legitimate merchant approval, actual supported methods, verified settlement & webhooks |
| P3 | Admin UX, catalog, Roblox enhancements, Game top-up | Backlog | Scope approval after stabilization |

## 18. P0-A — DOWNLOAD QRIS: FINISH AND VERIFY THE FIX

**Goal:** pending Sandbox invoice displays the QR image and downloads the same valid PNG/JPEG successfully, via Cloudy Pink Store same-origin API, without browser CORS errors.

**Reuse existing local changes; do not rebuild from scratch.**

1. Server endpoint GET /api/orders/[id]/qris/download. Require matching invoice + x-order-token in the DB query, 404 for absent/incorrect access. Only PENDING orders with QR are eligible. Do not reveal customer information to unauthorized callers.
2. Take QR URL ONLY from the authenticated stored Order, never from a browser-supplied URL. Validate exact Midtrans Sandbox/Production hostname and configured mode, HTTPS, known QR-code path, no embedded credentials, port override, query or fragment. Do not allow arbitrary hosts, private-network URLs, or redirects (use fetch redirect:error).
3. Remote fetch with 5-second timeout, no-store, maximum 2 MiB **incremental body streaming**; do not buffer an unbounded response before checking size. Fail on oversized content even with absent or false Content-Length. Cancel stream when invalid/too large.
4. Strict PNG/JPEG Content-Type and matching full PNG/JPEG magic bytes; reject HTML, SVG and mismatches. Use sanitized Content-Disposition name and correct png/jpg file extension. Return private,no-store. Preserve safe direct QR raw string (000201...) to PNG rendering.
5. **Remaining confirmed code-review issue:** a network failure or timeout thrown by body reader.read() after upstream headers currently reaches outer catch and returns HTTP 500. Catch mid-stream upstream failures separately as HTTP **502 UPSTREAM_FETCH_FAILED**. Clean up reader/cancel/release reliably; leave real DB/internal failures as HTTP 500. Test stream failure after partial bytes.
6. Frontend invoice page must use same-origin download endpoint plus x-order-token for remote Midtrans QR, not direct cross-origin fetch. Keep data:image/png immediate download, visible loading/error state, no duplicate clicks, translated errors for ID/MY/EN. QR image display should remain unaffected.
7. Review whether per-order authenticated download abuse needs a modest existing rate limit. Avoid shared-IP false 429, token leaks and extra Midtrans calls on each UI render. No unrelated checkout/DB schema changes.

**Required tests:** no/wrong token; wrong invoice; non-PENDING; malicious URL/host; valid PNG/JPEG/raw-QR; wrong MIME/magic; malicious redirects; no Content-Length; >2 MiB incremental stream; timeout during connect and after partial body; cleanup; same-origin frontend call. Run npm test, npx tsc --noEmit, npm run lint, npm run build. Document skipped tests honestly.

**Only after approved commit and deployment:** use a *testing* PENDING invoice to verify QR visible, Download QRIS works, file decodes properly, no CORS error. No real payment required. Do not claim fully solved from unit tests alone.

## 19. P0-B — INVESTIGATE SEPARATE /api/checkout HTTP 400

- Inspect frontend and server validation contract read-only, without sending extra checkout/payment requests to remote staging.
- Request only the NON-SENSITIVE response errorCode from DevTools Network → /api/checkout → Response; never request full payload with email, invoice token, passwords or headers.
- Distinguish intended errors from defects: STOCK_EMPTY in Apps inventory; INVALID_INPUT email, extra fields or variants; missing/invalid idempotency key; unavailable provider/region; invalid Roblox URL/details, and price quote mismatch. Confirm actual cause from errorCode and code, not a guess.
- For legitimate rejected input, document expected behavior and improve user-visible guidance as needed. For proven bug, make minimal fix with mock/disposable-local regression. Do not weaken fraud, price or CSRF checks.
- Acceptance gate: the observed 400 has a verifiable root cause, and either expected rejection or tested correction.

## 20. P1 — SECURITY & REGRESSION PRESERVATION

### Security invariants

- Only cloudy_staging on remote Aiven during testing; only cloudy_test_* on disposable localhost for data-writing integration tests; never defaultdb. Prisma CLI is outside the application runtime database guard. NO migrate, db push, seed, reset, or staging mutation without separate user approval.
- Preserve admin HttpOnly/SameSite/Secure sessions, Origin CSRF, five-minute reauthentication, order/fulfillment row locks, audit trails, soft invoice removal. Do not turn soft remove into irreversible deletion to bypass product foreign keys.
- Keep rate limit trust anchored in actual Vercel Edge proxy settings; user-controlled headers/VERCEL flag alone are not cryptographic authentication. Non-Vercel proxy headers require strict operator-guaranteed overwrite.
- Keep CRON_SECRET exact-value validation (never trim secrets), timed-safe comparison, no-store responses, and worker/cleanup authorization.
- Payment status depends on verified Midtrans webhook/status, matching invoice/provider/IDR currency/amount/reference, atomic stock/order changes and idempotent fulfillment. Payment success is distinct from Roblox delivery completion.
- Customer invoice access token required; Apps credentials encrypted server-side; no passwords, tokens or gateway secrets in logging/Telegram.
- CSP/security headers remain enabled. Current CSP permits unsafe-inline; review HSTS includeSubDomains/preload before custom domains. CSP and CORS are separate protections.
- Last Gemini-reported npm audit --omit=dev: 0 vulnerabilities after compatible dependencies updated; five dev-only advisories remained. Recheck periodically; never blindly run npm audit fix --force.

### Test and operational requirements

- Last Gemini-reported suite: **34 passed, 0 failed, 9 skipped**. The skipped MySQL/HTTP suites require isolated local TEST_DATABASE_URL / TEST_BASE_URL and may not touch cloudy_staging. Clearly report whether they were run, skipped, or blocked.
- Manual smoke tests after release: home, Apps, Roblox, region-aware quote, checkout errors, token-auth invoice, QR image and download, status polling, Admin, archived/removed invoice filters, mobile and Console.
- Keep Midtrans Sandbox; do not make paid transactions, perform refunds, purge customer orders, or use real login credentials for debugging.
- Aiven backups were observed, but actual recovery/PITR restore has not been verified. Prepare restore drill only on isolated destination before handling real money.
- Monitor checkout errors, webhook failures, cron cleanup/fulfillment heartbeats, backlog, refund-required and review queues, rate limit 429s, and log hygiene.
- Production deployment Ready is a build signal, not proof that end-to-end checkout is correct.
- This QRIS fix requires **no Prisma migration**. Do not rerun migrations just to deploy it.

## 21. P2 — REAL PAYMENT READINESS (BLOCKED UNTIL EXPLICIT APPROVAL)

**Never activate live payments merely by changing Midtrans environment variables.** Before any real customer transaction, establish an authorized merchant, business/payout eligibility, provider approval, costs/settlement/refund terms, customer support, privacy and refund policy, monitoring and recovery.

- Indonesia: Midtrans IDR QRIS only in current implementation; stay Sandbox until deliberate, documented Production launch approval.
- Malaysia (MYR) and Philippines (PHP): independent configured local prices already part of store design, but checkout stays **disabled** until actual supported provider accounts/adapters exist. Validate local channels (e.g. FPX/DuitNow, GCash/Maya) and international cards from provider contract for the merchant's registered country; do not infer from marketing pages. Validate gateway currencies/amounts, authenticated webhooks, refunds, and settlement minor units.
- Auto region detection must use a genuinely trusted ingress; Vercel country signals rely on Edge overwrite and are not proof of billing country. No customer-controlled pricing country override.
- Do not create accounts or submit credentials/business verification without user approval, and never bypass provider eligibility or represent the business inaccurately.

## 22. P3 — PRODUCT, ADMIN, UX, AND FUTURE WORK

- Roblox: preserve **Gamepass / Via Login / Via Username** separate flows, server quote signatures, independent IDR/MYR/PHP pricing, safe manual fulfillment, confirmed recipient and delivery evidence. Do not store Roblox passwords, OTPs, cookies or session secrets.
- Apps Premium: preserve stock reservation/locking, encrypted delivery credentials, invoice history; use only legal, authorized product sources.
- Game top-up: future real provider adapter/API, not part of current stabilization. Never enable simulator for Production sales.
- Admin: invoice/username search, export and financial reconciliation by currency without mixing IDR with sen/centavo, better archived/removed filters, catalog/product stock operations, explicit irreversible-action safeguards.
- Data cleanup: only explicitly approved isolated dummy data, never production transaction hard deletes or foreign-key bypass.
- UX: Anya Theme preservation, mobile responsiveness, accessibility, clear fees/prices, localized errors, transparent delivery estimates and customer support.

## 23. ONE KICKOFF PROMPT, APPROVAL GATES & DEFINITION OF DONE

For the next Gemini/Codex/Work session, a single kickoff is enough:

> Read AGENTS.md and plan.md as the project source of truth. Check Git status and existing local changes before edits. Complete **P0-A** in one small batch and perform read-only **P0-B** diagnosis as far as evidence allows; focus on mid-stream QRIS HTTP 502 handling, tests and accurate error reporting. Run npm test, TypeScript, lint and build. Do not access or mutate remote databases; never touch defaultdb, run Prisma migrations, change .env or Vercel env vars, commit, push or deploy. Report actual diffs, pass/fail/skip counts, unverified behavior, blockers and the next milestone. Stop for user review.

Coding agent may autonomously make necessary local edits and tests within this **authorized P0 scope**, not P1–P3 actions. Stop and request explicit user approval for commit/push, Vercel deployment, environment changes, real gateway action, database write/migration, or destructive data cleanup. A shared external account must not receive private GitHub access or secrets.

### P0 completion checklist

- [ ] Mid-stream network/timeout on QRIS image responds 502; cleanup/reject scenarios tested.
- [ ] Authorized Sandbox PENDING invoice QR displays **and downloads** correctly after approved release; no browser CORS error in download path.
- [ ] Checkout HTTP 400 has a concrete diagnosis from actual errorCode or is clearly documented as unresolved pending non-sensitive evidence.
- [ ] Unit/typecheck/lint/build pass, integration skips acknowledged, no unauthorized DB operations.
- [ ] User approves reviewed diff, deployment Ready/commit/alias verified, and postdeploy smoke tests pass.

**End of consolidated project roadmap.**
