# Roblox Via Login — Local QA, 14 Oktober 2026

Status: implementasi lokal untuk review; belum commit/push/deploy. Migration SQL disiapkan, **tidak dijalankan pada database mana pun**. Tidak mengakses Aiven/defaultdb/cloudy_staging, membaca `.env`/credential, atau membuat order/payment nyata.

## Hasil dan alur

Sebelum: Login memilih nominal, informasi pelanggan, payment dan summary sidebar pada satu halaman.

Sesudah:

1. `/roblox/[slug]?method=LOGIN`: paket admin aktif dengan harga regional/null state, tanpa summary sidebar atau quote/checkout sebelum lanjut.
2. `/roblox/[slug]/login/account`: username, country-phone picker internasional, WhatsApp, notification email, security guidance; validasi per-field/input retention.
3. `/roblox/[slug]/login/summary`: method/quantity/customer contact, server region/currency, payment method dan server quote subtotal/fee/discount/total; checkout hanya final confirmation.

Draft/contact/quote/idempotency state hanya di memori React Context pada shared layout. Back dan browser Back/Forward mempertahankan draft; refresh/direct entry tanpa draft kembali ke picker tanpa order. Phone country tidak memilih GeoIP/harga. Respons checkout ambigu mempertahankan key/payload; perubahan data tidak boleh membuat request order baru sebelum request sebelumnya diketahui.

Server metadata `max` menormalisasi E.164; SQL field `RobloxOrderDetail.whatsappE164` menyimpan **AES-GCM ciphertext**, bukan plaintext. New Login wajib phone, historical replay tetap kompatibel. DTO admin membuang field encrypted dan membuka `contactWhatsapp` hanya PAID+owner-session+LOGIN. Customer invoice/API public tidak diperluas dengan phone.

## Verifikasi

App diuji dari copy source tanpa env files di `.cache/login-qa/app`, dengan environment allowlist, database dummy localhost port tertutup, Sandbox, dan generated Prisma Client. Tidak menjalankan SQL migration. Semua API browser di-intercept fixture; external requests diblokir. Harga/fee/region/provider/checkout responses browser adalah **sintetis**, bukan integrasi production. Klik final dalam E2E hanya menerima response 503 mock dan tidak mencapai server checkout.

| Pemeriksaan | Hasil |
| --- | --- |
| Targeted Login/Roblox/regional unit tests | **18 PASS, 0 FAIL, 0 SKIP** |
| `npm test` | **48 PASS, 0 FAIL, 9 SKIP** (57 total) |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS, 0 errors; 1 existing StoreShell `<img>` warning |
| `npx prisma validate` | PASS |
| `prisma generate` | PASS; schema generation saja, bukan migration |
| `npm run build` | PASS pada isolated production build |
| New `tests/login-flow.e2e.mjs` | **19 PASS, 0 FAIL, 0 SKIP** |
| Updated `tests/roblox-p0c.e2e.mjs` | **41 PASS, 0 FAIL** |
| `git diff --check` | PASS |

Build harness mengeluarkan warning inferred workspace root karena nested lockfile, dan satu warning CSS optimizer pada build kedua. Build/TypeScript berhasil dan browser tidak menemukan page/console errors tak terduga; warning build tersebut tidak disembunyikan. Tidak mengubah config aplikasi untuk menghapus warning harness.

9 skipped suites membutuhkan MySQL/HTTP/migration prerequisites. Seluruh suite DB tetap SKIP karena database/migration tidak boleh dijalankan dalam task ini. Mock membuktikan domain validation/encryption/projection/replay, **bukan** SQL execution/DB rollback atau provider readiness.

## Browser dan visual

- Viewports: **375×812**, **810×1080**, **1440×900**.
- Normal/invalid form, no-password input, selected package, empty/null, customer-country US dengan region ID/MY/PH, unavailable MY/PH provider gates.
- Three-page navigation, Back/Forward, refresh/direct account/summary, single quote/method, no checkout sebelum confirmation.
- Mock ambiguous retries memakai key/payload sama; contact change setelah ambiguous response tidak menimbulkan checkout baru.
- Tidak ada contact/quote/token draft di URL/localStorage/sessionStorage; browser hanya mempersist locale yang sudah ada. Token invoice belum diuji success handoff karena security change belum disetujui dan tidak ada real checkout.
- Labels/focus/keyboard, page overflow dan console diperiksa. P0-C Gamepass/Username wizard, Apps storefront, Game disabled checkout, language ID/EN/MY dan region-unverified regression tetap lulus.
- Tampilan form dan summary diperiksa melalui screenshot synthetic; stale field errors setelah input valid ditemukan dan diperbaiki. Scroll horizontal mobile nav dan posisi Hubungi Kami tetap mengikuti pengecualian pemilik.

Screenshot ignored/temporary (jangan stage):

- Mobile account: `.cache/login-qa/app/.cache/login-qa/screenshots/375-ID-normal-account.png`
- Mobile summary: `.cache/login-qa/app/.cache/login-qa/screenshots/375-ID-normal-summary.png`
- Tablet account/summary: file prefix `810-ID-normal-` pada direktori yang sama.
- Desktop account: `.cache/login-qa/app/.cache/login-qa/screenshots/1440-ID-normal-account.png`
- Desktop summary: `.cache/login-qa/app/.cache/login-qa/screenshots/1440-ID-normal-summary.png`

Full-page capture dengan background fixed dapat memutihkan area di luar viewport/posisi scroll; ini batas capture, bukan klaim layout aplikasi kehilangan background.

## File task

Dependency: `package.json`, `package-lock.json` (`libphonenumber-js` 1.13.15 production).

Backend/schema/migration:

- `prisma/schema.prisma`
- `prisma/migrations/202610140001_login_whatsapp/migration.sql`
- `src/lib/commerce.ts`, `src/lib/checkout.ts`
- `src/lib/loginContact.ts`, `src/lib/loginContactDto.ts`
- `src/app/api/admin/fulfillment/route.ts`, `src/components/FulfillmentAdmin.tsx`

Frontend:

- `src/app/roblox/[slug]/layout.tsx`
- `src/app/roblox/[slug]/login/account/page.tsx`
- `src/app/roblox/[slug]/login/summary/page.tsx`
- `src/context/LoginDraftContext.tsx`, `src/components/LoginFlow.tsx`
- `src/components/TopupCatalog.tsx`
- `src/lib/loginFlowTranslations.ts`, `src/lib/translations.ts`

Tests/docs:

- `tests/login-flow.test.mjs`, `tests/login-flow.e2e.mjs`
- `tests/roblox.test.mjs`, `tests/mysql.test.mjs`, `tests/http.test.mjs`, `tests/roblox-p0c.e2e.mjs`
- `docs/plans/roblox-login-contact-invoice-access.md`, laporan ini, task-progress `plan.md`.

File/perubahan lokal pemilik yang sudah ada sebelum task dipertahankan dan tidak termasuk implementasi ini.

## Batas dan langkah review

- Migration additive hanya `ADD COLUMN ... VARCHAR(255) NULL`; tidak drop/update/backfill/index. DB compatibility aktual belum dapat dinyatakan lulus sebelum SQL diterapkan/diuji dengan izin terpisah.
- Jangan menjalankan aplikasi baru terhadap DB lama yang belum memiliki kolom; Prisma detail queries memerlukan schema baru. Review SQL/backup/target diperlukan sebelum rollout.
- Invoice auth **belum berubah**: Login memakai handoff accessToken/localStorage lama sebagaimana fitur existing. Risiko ini tetap ada. Tidak ada session/cookie/recovery implementation dalam batch ini.
- Revisi desain invoice: **satu opaque HttpOnly Secure SameSite=Lax browser session**, per-invoice server grants, absolute max 90 hari/revocation, **tanpa arbitrary 32-invoice cap**, verified notification-email recovery. Recovery provider/sender/domain dan trust model harus direview; jangan menganggap email delivery sudah tersedia.
- MY/PH live payment tetap tidak tersedia; regional fixture tidak membuktikan adapter. Tidak mengumpulkan rahasia Roblox.
- Siap untuk **review kode dan SQL lokal**, bukan siap deploy atau klaim integrasi payment/database. Berhenti sebelum migration/commit/push/deploy.

## Post-review checkout fixes — 14 Oktober 2026

Final review menemukan dua kegagalan di luar cakupan respons 503-only QA awal. Sebelum edit, `tests/login-checkout.e2e.mjs --reproduce` terhadap production build lama menghasilkan **0 PASS, 2 FAIL**: success handoff kembali ke picker saat invoice navigation ditunda, dan quote baru memblokir replay request ambigu. Tidak membuat order/payment nyata.

Perbaikan:

- Invoice sukses menjadi state terpisah di shared Login context. Draft tidak dibersihkan sebelum `router.push`; guard kosong dilewati hanya sesudah response invoice/token valid. Lock submit tetap aktif selama navigasi, dengan link invoice sebagai tindakan aman bila transisi lambat. Tidak menganggap router.push sebagai Promise.
- Request body dan key dibekukan dalam snapshot memori. Aksi **Pulihkan permintaan sebelumnya** mengirim ulang snapshot asli, tanpa mengganti quote atau key. Konfirmasi order baru dinonaktifkan selama hasil sebelumnya belum pasti, termasuk recovery 503/network/malformed response/rate limit/conflict.
- Audit backend: lookup key+requestHash mendahului quote/region validation, diulang di dalam lock Product, dan P2002 memakai replay yang sama. Committed replay mengembalikan invoice lama tanpa membuat order/charge baru. Tidak mengubah backend/API/schema.
- Recovery adalah replay POST existing, bukan endpoint inquiry baru: bila belum ada commit dan quote asli masih valid, server dapat membuat order pertama dari intent yang semula dikonfirmasi. Bila quote asli sudah berubah, server menolak; UI mengambil quote terbaru dan menunggu klik konfirmasi pengguna. Tidak ada automatic order pada harga baru.
- Invoice legacy/localStorage tetap; desain recovery cookie future kini mewajibkan rotasi identifier, pencabutan session pendahulu dan penerbitan/pemindahan grant terotorisasi atomik, tanpa perpanjangan expiry grant asal. Tidak mengimplementasikan hardening.

| Pemeriksaan terakhir | PASS | FAIL | SKIP |
| --- | --- | --- | --- |
| Targeted Login/Roblox/regional unit tests | 19 | 0 | 0 |
| npm test | 49 | 0 | 9 |
| New checkout Playwright regression | 11 | 0 | 0 |
| Updated Login flow Playwright | 19 | 0 | 0 |
| TypeScript | PASS | 0 | 0 |
| ESLint | PASS | 0 | 0 |
| Isolated production build | PASS | 0 | 0 |
| git diff --check + trailing whitespace task files | PASS | 0 | 0 |

Skenario baru: success+delayed navigation, synchronous double-submit, empty/direct/refresh draft, 503 setelah logical commit, network loss, malformed success, quote berubah, identical original key/body, rate-limit recovery, unresolved recovery setelah kontak berubah, current price null, absent commit dengan stale quote dan explicit fresh confirmation, serta absent commit dengan quote asli masih valid. Logical-order counters dan server replay memakai mocks; bukan bukti SQL concurrency/provider integration.

Satu kegagalan awal fixture unit akibat binding Prisma cached diperbaiki dengan penggantian mock pada objek binding yang sama. Satu kegagalan fixture browser harga null akibat transisi belum selesai diperbaiki dengan menunggu summary tersedia sebelum mengubah fixture. Lint sempat menolak pembacaan ref saat render; UI sekarang memakai state context dan ref hanya untuk event latch/snapshot. Final checks di atas lulus tanpa melemahkan assertions atau quality gates.

Testing tetap menggunakan app copy tanpa env files, allowlisted environment, dummy localhost port tertutup dan Sandbox; semua API/external requests browser di-intercept. Build menghasilkan warning nested lockfile/workspace root dan CSS optimizer yang sudah ada; lint hanya satu warning StoreShell `<img>`. Full P0-C 41-scenario suite tidak diulang; bukti historisnya tetap terpisah.

Risiko/batas: hard refresh atau keluar dari lifetime Login context menghilangkan snapshot memori; recovery invoice umum belum diimplementasikan. Token legacy tetap risiko yang belum di-hardening. DB/HTTP/migration prerequisites tetap 9 SKIP, SQL belum dijalankan, Aiven/backup/payment/Vercel tidak diverifikasi. Schema/migration yang direview tidak diubah. Tidak commit/push/deploy; kedua bug lokal **FIXED**, menunggu review dan rollout berizin terpisah.
