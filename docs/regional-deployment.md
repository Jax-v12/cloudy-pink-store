# Automatic regional pricing & GeoIP security architecture

The storefront automatically determines regional pricing using server-side GeoIP.
Customers cannot choose or override their country or product prices through browser controls,
cookies, URL parameters, request bodies, or client-crafted headers.

Apps Premium retains its existing IDR flow; historical invoices always preserve their stored snapshot.
Roblox top-up prices are calculated independently for supported regions (ID: IDR, MY: MYR, PH: PHP).

## GeoIP Detection Architecture & Modes

`src/lib/requestRegion.ts` determines customer location based on the configured `GEOIP_SOURCE`:

### 1. Vercel Edge Boundary Mode (`GEOIP_SOURCE=vercel` or default when `VERCEL=1`)

When deployed on Vercel (such as `cloudy-pink-store.vercel.app`):

- **Architectural Boundary Trust (Bukan Autentikasi Kriptografis atau Jaminan Runtime Resmi)**:
  - `VERCEL=1` maupun keberadaan header `x-vercel-id` **bukanlah bukti autentikasi kriptografis dan bukan jaminan runtime resmi**. Vercel tidak menandatangani request HTTP biasa ke functions dengan HMAC atau signature digital.
  - Perlindungan mode ini bergantung pada **trusted Vercel Edge boundary**, **konfigurasi deployment**, dan **penanganan header oleh proxy** (di mana edge proxy publik Vercel menyaring dan menimpa header tersebut sebelum diteruskan ke fungsi aplikasi).
- **Perilaku Teruji pada Deployment Staging Saat Ini**:
  - Pengujian langsung pada deployment staging (`cloudy-pink-store.vercel.app`) menunjukkan bahwa Vercel Edge bertindak sebagai reverse proxy yang menimpa (*overwrite*) header `x-vercel-ip-country` dan `x-vercel-id` buatan klien dengan data koneksi IP klien sebenarnya.
- **Jaminan Resmi & Batasan Vercel**:
  - Berdasarkan dokumentasi resmi Vercel, `x-vercel-ip-country` disediakan berdasarkan alamat IP soket publik klien, dan `x-vercel-id` disediakan sebagai identifier pelacakan rute (trace ID).
  - Vercel tidak menjamin keaslian lokasi fisik pengguna jika pengguna menggunakan VPN, proxy komersial, atau rute jaringan khusus ISP.
- **Pengecekan Server-Side di `src/lib/requestRegion.ts`**:
  - Memeriksa `process.env.VERCEL === '1'` sebagai penjaga konfigurasi deployment agar mode Vercel tidak aktif di lingkungan non-Vercel.
  - Memeriksa keberadaan `x-vercel-id` sebagai header pelacakan yang disisipkan oleh Edge. Format string tidak dijadikan tumpuan keamanan karena Vercel tidak menjamin format tersebut sebagai kontrak permanen.
  - Memvalidasi bahwa `x-vercel-ip-country` adalah format ISO 2-huruf kapital (`^[A-Z]{2}$`).
  - Tanpa konfigurasi deployment Vercel yang sesuai atau jika header Edge tidak ada (misalnya direct origin access atau container mandiri tanpa reverse proxy Vercel), mode ini langsung *fail-closed* ke `{ region: null, reason: 'unverified' }`.

### 2. Trusted Signed Ingress Contract (`GEOIP_SOURCE=signed-ingress`)

Digunakan ketika traffic dilewatkan melalui reverse proxy eksternal yang dikontrol operator (misalnya Cloudflare Worker, NGINX, Envoy) atau pada test harness terisolasi (`tests/start-http-server.mjs`, `tests/http.test.mjs`):

- **Autentikasi Kriptografis Sejati**:
  - Menggunakan HMAC-SHA256 yang ditandatangani oleh ingress proxy dengan kunci rahasia bersama `GEOIP_INGRESS_SECRET` (minimal 32 karakter) dan `GEOIP_INGRESS_AUDIENCE`.
  - Ingress proxy menghitung HMAC dari pesan canonical:
    `JSON.stringify(['store-geo-v1', audience, method, pathname + search, country, timestamp])`.
  - Signature dikirim via `x-store-geo-signature`, timestamp 13-digit via `x-store-geo-timestamp`, dan kode negara 2-huruf via `x-store-geo-country`.
- **Fail-Closed Total**:
  - Konfigurasi kurang, secret pendek, audience salah, selisih waktu > 60 detik (membatasi masa berlaku signature hingga jendela waktu 60 detik, tetapi tidak mencegah penggunaan ulang dalam jendela tersebut), atau ketidaksesuaian signature selalu menghasilkan `{ region: null, reason: 'unverified' }`.

### 3. Penanganan `GEOIP_SOURCE` Tidak Dikenal

Jika `GEOIP_SOURCE` disetel ke nilai yang tidak dikenal (misalnya `unknown`, `cloudflare`, dsb.) atau environment tidak memiliki konfigurasi yang valid, sistem **selalu gagal secara fail-closed** (`reason: 'unverified'`), tanpa ada fallback diam-diam ke mode lain atau ke region Indonesia (`ID`).

## Client Spoof Resistance & Server-Side Enforcement

1. **No Client Country Switcher**: The storefront UI contains no dropdowns or selectors for pricing regions. Language selection is strictly linguistic and never alters prices.
2. **Ignored Spoof Vectors**:
   - URL parameters (`?region=...`, `?country=...`) are ignored by `resolveRequestRegion`.
   - Client cookies (`region=...`, `pricingRegion=...`) are ignored.
   - Non-edge headers (`cf-ipcountry`, `x-forwarded-for`, `x-real-ip`) are ignored.
   - Request body fields (`pricingRegion`, `currency`, `totalAmount`) are rejected by `createCheckout` and strict JSON schemas with HTTP 400 (`INVALID_INPUT`).
3. **Server Quotation & Binding (`quoteToken`)**:
   - `/api/checkout/quote` recalculates prices based on server-resolved region and database rates.
   - Returns a cryptographically signed HMAC `quoteToken` binding product, variant, quantity, region, currency, payment provider, method, and amounts.
4. **Idempotency & Price Drift Protection**:
   - `/api/checkout` verifies the `quoteToken` under transactional database locks.
   - If pricing rates or detected region change between quote and final checkout, the transaction aborts with `PRICE_CHANGED` without creating an order or charging the customer.

## Incorrect Detection and Support

When location cannot be determined or belongs to an unsupported country (`reason: 'unsupported'` or `'unverified'`), checkout remains blocked and presents a neutral message linking to store WhatsApp support. There is no automatic fallback to IDR.

## Payments and Currency

- **IDR (Indonesia)**: Settled in IDR via Midtrans QRIS integration.
- **MYR (Malaysia) & PHP (Philippines)**: Display configured regional prices, but payment creation remains disabled until local merchant gateway accounts, verified API credentials, and signed webhooks are fully implemented.

## Validation Suite

- `tests/region.test.mjs`:
  - Unit tests for HMAC signed-ingress verification, batasan jendela waktu timestamp (60 detik), and audience binding.
  - Unit tests for invalid/unknown `GEOIP_SOURCE` configurations (enforcing fail-closed behavior).
  - Unit tests for Vercel Edge boundary mode in isolated test scope (`VERCEL=1`), including unsupported countries, missing headers, malformed country codes, and immunity to spoof vectors.
  - Unit tests for requests outside Vercel boundary (`VERCEL` not `'1'`), confirming fail-closed rejection.
- `tests/http.test.mjs`: Full end-to-end HTTP integration tests under the signed ingress harness.
- Production checks: `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
