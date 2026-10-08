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

**Focus on Roblox first.**

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

### Automatic region detection (required customer UX; planned, not yet implemented)

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

## 12. Implementation Rules for Codex

Before making changes:

1. Inspect the current repository and relevant existing code.
2. Check what is already implemented before creating duplicate components/routes/models.
3. Preserve working behavior and existing user data.
4. Do not undo previous Roblox/Gamepass work unless it is broken or conflicts with this plan.
5. Keep the three Roblox methods available.
6. Keep Apps Premium working.
7. Focus only on the requested feature; avoid unrelated refactors.

After making changes:

1. Run the relevant Prisma validation/migration checks when schema changes.
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
