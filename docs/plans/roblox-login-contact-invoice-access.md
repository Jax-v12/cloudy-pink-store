# Roblox Via Login — Contact, Three Pages, and Invoice Access

Tanggal: 14 Oktober 2026. **Status: WhatsApp/tiga halaman disetujui dan diimplementasikan lokal; revisi invoice masih proposal.**

Anotasi terbaru 16 Oktober 2026 — dokumen ini mempertahankan desain dan snapshot source 14 Oktober, bukan kontrak runtime terkini. Pemilik kini secara eksplisit menyetujui pengecualian Via Login; **P2-3 RESOLVED** sebagai keputusan kebijakan. `AGENTS.md` §10 dan [dokumen account-access](roblox-login-account-access.md) menetapkan purpose/consent, enkripsi, TTL/penghapusan, owner/reauth/audit, batas reveal serta backup/restore. Collection/reveal dan kontrolnya tidak diubah; GAMEPASS/GIFT_USERNAME/LOGIN dipertahankan. Pernyataan tanpa-secret di bawah adalah desain historis, bukan larangan terkini atas pengecualian LOGIN. Proposal invoice/cookie/recovery dan persetujuan kebijakan bukan izin implementasi/rilis baru.

Baseline kode: `main`, HEAD `8e5548d721a84a4da18447d41ea1fe5fa8328b02`. Pemeriksaan awal source/schema/dokumentasi dilanjutkan implementasi lokal WhatsApp/tiga halaman setelah approval. Tidak membaca `.env`, mengakses database, menjalankan migration/seed, membuat order/pembayaran nyata, commit, push atau deploy. Perubahan lokal pemilik tetap dipertahankan; penghapusan dokumen lama tidak diaudit/dipulihkan.

## 1. Keputusan dan batas scope

Pengguna menyetujui **penyusunan desain**, bukan implementasi kontrak/schema/autentikasi:

- Login wajib memiliki WhatsApp untuk komunikasi order, username Roblox, dan email notifikasi.
- Country picker hanya untuk nomor telepon; tidak mengubah GeoIP, region, currency atau harga.
- Tiga URL: pilih nominal → informasi akun → ringkasan/konfirmasi.
- Draft hanya React Context pada shared layout, tanpa browser persistence atau PII/token di URL.
- Invoice hardening harus menjaga invoice yang sah dan kompatibilitas lama, tanpa IDOR/token leak.
- Tetap ID/EN/MY, harga ID/MY/PH independen, signed quote, idempotency, Sandbox, admin claim/contact policy, Gamepass/Username/Apps Premium.
- Tidak mengumpulkan password Roblox, OTP, cookies/session token, backup/recovery code atau screenshot security code. Ini tidak berubah karena label Via Login.

Perubahan kode, dependency, schema, migration dan invoice auth di bawah **baru boleh dikerjakan setelah review/persetujuan desain**. Migration remote tetap memerlukan persetujuan rollout terpisah dan verifikasi target; `defaultdb` selalu dilarang.

## 2. Temuan implementasi pada snapshot 14 Oktober 2026

| Area | Fakta source saat diperiksa |
| --- | --- |
| `prisma/schema.prisma`, Order | `customerEmail` dan plaintext bearer `accessToken` UUID unik sudah ada; tidak ada WhatsApp. |
| `RobloxOrderDetail` | Detail one-to-one milik Order: method, username, public Roblox identity, Gamepass fields; tidak ada nomor kontak. |
| `src/lib/commerce.ts` | Top-level input di-whitelist; detail Login/Username hanya `username`. Field WhatsApp sekarang ditolak. `requestDigest` memakai keyed hash canonical payload. |
| `src/lib/checkout.ts` | Replay idempotency diperiksa sebelum new-order validation; transaksi mengunci Product, membaca harga final, membuat Order/detail secara atomik. Roblox lookup di luar lock. |
| `src/app/api/checkout/route.ts` | First create dan replay mengembalikan `accessToken`. Provider call di luar transaksi; kegagalan charge mempertahankan order untuk reconciliation, bukan membuat charge kedua. |
| `TopupCatalog.tsx` | Login picker, form, payment selector, summary sidebar dan checkout berada pada halaman yang sama; token disimpan localStorage setelah sukses. |
| Apps/Roblox wizard | `src/app/apps/page.tsx` dan `RobloxCheckoutWizard.tsx` juga menulis token localStorage. Jangan mengubah journey/payload mereka dalam batch Login. |
| Invoice client | `src/app/order/[id]/page.tsx` membaca `token_<invoice>` untuk detail, POST payment reconciliation dan GET QRIS download. Tidak ada token → tidak mencoba cookie. |
| Invoice endpoints | Ketiga endpoint mencocokkan invoice + `x-order-token` di server sebelum data/credentials/QR/provider access. Order GET memiliki DTO eksplisit; token tidak dikirim dalam response ini. |
| Recovery | `POST /api/orders/[id]/recover` sengaja 410 `RECOVERY_UNAVAILABLE`; invoice/email bukan bukti kepemilikan. Tidak ada recovery email otomatis yang dapat diasumsikan tersedia. |
| Fulfillment admin | `adminAccess`, lalu `contactEmail` hanya jika PAID dan ownerSessionId sama dengan sesi admin. Tetapi `robloxDetail: true` disebarkan ke response: field baru akan bocor ke semua admin bila tidak diganti explicit select/DTO. |
| Quote | `/api/checkout/quote` menerima productId, variantId, paymentMethod, quantity; tidak membuat order. HMAC mengikat harga/region/provider/method. **Tidak ada timestamp/expiry quote eksplisit**; validitas final berasal dari perhitungan ulang server. |
| Payment | Hanya Midtrans ID/IDR QRIS saat capability tersedia; MY/PH belum memiliki adapter. Fee/discount saat ini nol, bukan alasan mengarang diskon atau mengaktifkan payment MY/PH. |

Referensi source utama: `src/lib/commerce.ts:21,49,56`, `src/lib/checkout.ts:19`, `src/app/api/admin/fulfillment/route.ts:30,46`, `src/app/api/orders/[id]/route.ts:8`, `src/app/api/orders/[id]/payment/route.ts:12`, `src/app/api/orders/[id]/qris/download/route.ts:26`.

## 3. Schema WhatsApp minimal

Tambahkan **satu field nullable** pada detail Roblox, bukan pada semua jenis Order:

```prisma
model RobloxOrderDetail {
  // Existing fields/relations remain unchanged.
  whatsappE164 String? @db.VarChar(255)
}
```

- Tetap bagian dari pesanan melalui relasi one-to-one `orderId`; tidak menambah tabel kontak terpisah.
- Simpan E.164 yang sudah tervalidasi memakai `encryptData` dari `src/lib/crypto.ts`. AES-GCM envelope untuk maksimum 16 karakter E.164 muat di 255; uji panjang aktual sebelum SQL disetujui.
- Nullable untuk kompatibilitas order lama/Gamepass/Username. Semua **order Login baru** wajib mengisinya melalui invariant aplikasi; SQL NOT NULL global akan merusak metode lain/record lama.
- Tanpa backfill, default phone, indeks/search nomor, penyimpanan plaintext tambahan, maupun foreign key baru. Order lama tetap null dan UI mengatakan kontak belum tersedia.
- Jangan memakai `OrderSecret`: lifecycle itu punya TTL/cleanup fulfillment, berbeda dari kontak pesanan. Tidak mengubah crypto key/environment atau menganggap encryption merupakan izin mengumpulkan rahasia Roblox.
- Policy penggunaan: hanya komunikasi order; bukan marketing, lookup publik atau payload provider/Telegram. Tidak ada purge/retention otomatis baru dalam batch ini; retention PII tetap memerlukan keputusan operasional tersendiri.

SQL review lokal di `prisma/migrations/202610140001_login_whatsapp/migration.sql` bersifat additive: `ADD COLUMN whatsappE164 VARCHAR(255) NULL` pada `RobloxOrderDetail`; **sudah disiapkan, belum dijalankan**.

## 4. Nomor internasional dan validasi

Usulan dependency: **`libphonenumber-js` dengan metadata `max`**, versi/paket-lock ditinjau saat implementasi. Belum terpasang dalam package.json yang diperiksa; penambahannya merupakan bagian desain yang memerlukan persetujuan. Library mendukung parsing E.164, metadata country/calling-code dan validasi digit yang lebih kuat daripada length-only. [Dokumentasi maintainer](https://github.com/catamphetamine/libphonenumber-js).

- Client menggunakan country picker (daftar country dari library) + input `type=tel`/`inputMode=tel`; label ID/EN/MY, country dapat ditampilkan dengan localized country name dan calling code. Jangan hardcode hanya ID/MY/PH bila pengguna meminta nomor internasional.
- Picker diawali pilihan eksplisit pengguna, bukan perubahan country pricing. Nomor negara berbeda dari GeoIP boleh; misalnya region MY tidak harus memakai +60.
- Shared pure validator client/server: bounded raw input; parse strict tanpa extracting phone dari kalimat bebas; normalize national prefix memakai metadata, bukan concat/trimming digit sembarang; reject extension, malformed/unsupported calling code, invalid length/digits.
- Client menghasilkan canonical E.164 (`+` + maksimal 15 digit); server menerima **canonical string**, memverifikasi ulang dan menolak non-canonical input. Regex E.164 hanya guard sintaks, bukan satu-satunya validator.
- `isValid()` membuktikan kesesuaian numbering plan, **bukan** kepemilikan, nomor aktif atau akun WhatsApp. Tidak mengirim OTP/SMS atau memanggil WhatsApp verification API pada scope ini.
- Username mengikuti pola server yang ada; email mengikuti batas/validator yang ada. Error per field tetap menjaga input. Tidak perlu menambahkan username ke URL baru; Login tidak memakai lookup GET yang membawa username dalam URL. Lookup authoritative di checkout tetap server-side seperti sekarang.
- Nomor tidak masuk logs, analytics, traces/HAR/screenshot dengan data nyata, URL/link `wa.me`, Telegram, rate-limit key plaintext, atau public response. Admin menyalin nomor dari tampilan berizin; tidak ada auto-send pesan.

## 5. Kontrak checkout dan idempotency

Top-level money/region/quote contract tidak berubah. Tambahan hanya detail Login:

```ts
// Shape only: no real customer data or token values.
type LoginDetails = {
  username: string;
  whatsappE164: string;
};
// POST /api/checkout body retains:
// productId, variantId, customerEmail, paymentMethod, quoteToken, details.
// LOGIN remains a fixed package; do not add quantity/cart or client totals.
```

Aturan implementasi setelah approval:

1. `checkoutInput` boleh membawa `details.whatsappE164` yang tervalidasi/normalized bila hadir, tetapi tidak menyisipkan default/null pada payload lama sebelum hashing. Unknown/secret fields tetap ditolak.
2. `requestDigest` memasukkan canonical phone ketika hadir, tanpa ciphertext acak. Phone tidak dapat dicari dengan unhashed digest. Perubahan nomor dengan key yang sama menghasilkan `409 IDEMPOTENCY_CONFLICT`; payload sama mengembalikan invoice yang sama.
3. Pertahankan replay **sebelum** syarat phone untuk order baru: retry Login lama tanpa phone masih cocok digest historis, tanpa membuat order, backfill atau mengganti kontaknya.
4. Sesudah replay, method ditentukan dari variant server. Login baru wajib phone; Gamepass/Username/Apps menolak field itu. Revalidate di dalam lock setelah variant dibaca ulang, tidak mengandalkan UI.
5. Pisahkan hasil parse kontak (`loginContact`) dari object detail yang dikirim ke `verifyRobloxDetails`, agar lookup Roblox tidak menerima nomor. Encrypt setelah validasi dan setelah digest; persist ciphertext bersama nested Order/detail create pada transaksi yang sama.
6. Missing/invalid phone: proposed `400 WHATSAPP_REQUIRED` / `400 INVALID_WHATSAPP` dan terjemahan per-field. Product/region/provider/quote/idempotency errors yang ada tetap berlaku. Response baru/bridge memakai `success/errorCode`, private/no-store tanpa echo phone/token.
7. Quote endpoint tetap tanpa PII/phone; phone tidak mengubah provider, fee, price atau GeoIP. Provider charge tetap menerima input yang sekarang, bukan WhatsApp. Tidak mengubah webhook/payment state machine.

Old Login tabs yang mencoba membuat **order baru** tanpa phone harus ditolak dengan pesan refresh/data required. Kompatibilitas berarti historical retry/invoice terjaga, bukan membolehkan order baru melanggar syarat phone. Apps/Gamepass/Username tidak ditambah field wajib atau perubahan payload.

## 6. Akses WhatsApp admin

- Ganti `robloxDetail: true` pada fulfillment listing menjadi explicit fields. Jangan spread Prisma detail mentah. Buang ciphertext sebelum serialisasi response apa pun.
- Tambah DTO `contactWhatsapp: string | null` **di luar robloxDetail**, bukan phone/ciphertext nested yang ikut terkirim ke semua admin.
- Persis gate email yang berlaku: admin session valid, order PAID, job owner adalah sesi admin tersebut, method LOGIN. Baru decrypt server-side. Sesi admin lain, unpaid/unclaimed, atau legacy null → null, tanpa decrypt.
- Claim expired/reassigned memindahkan kemampuan kontak sesuai policy session yang ada. Archive/restore tidak memberi hak kontak baru. Jangan memperluas hak karena order completed atau archived.
- `FulfillmentAdmin` menampilkan nomor+copy hanya saat DTO berisi nomor; instruksi bahwa penggunaannya terbatas pada order. General admin orders/report/analytics, public catalog, customer invoice DTO dan provider/notification tidak ditambah phone.
- Decode failure: fail closed dengan safe error, tanpa ciphertext/plaintext fallback atau data sensitif di logs. Unknown fields/tampering/input invalid tetap ditolak.
- Uji deep JSON response, bukan hanya menyembunyikan nomor di UI. Tidak menambah search-by-phone karena query bisa masuk URL/log.

## 7. Revisi invoice — satu browser session, grants server

**Belum diimplementasikan; perlu review baru.** Keputusan terbaru pengguna mengganti rekomendasi cookie per invoice. Frontend Login lokal saat ini tetap memakai handoff invoice lama; tidak ada auth/token/cookie change dalam batch WhatsApp.

Rekomendasi: satu cookie opaque `__Host-invoice-session` untuk browser/origin, dengan InvoiceAccessSession dan InvoiceAccessGrant di server. Cookie tidak memuat daftar invoice, Order.accessToken, email, telepon atau username. Value 32-byte CSPRNG base64url; server menyimpan SHA-256 hash, bukan value. Atribut HttpOnly, Secure, SameSite=Lax, Path=/, tanpa Domain mengikuti [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

- **Tidak ada batas otomatis 32 invoice/browser.** Cookie berukuran tetap; jumlah grant adalah kapasitas server yang diukur. Gunakan indeks, expiry dan rate limits issuance/recovery, bukan evict akses pelanggan tanpa kebutuhan terukur.
- Session mempunyai masa maksimum **90 hari absolut dari issuance**, dengan revokedAt/expiresAt diperiksa server. Grant expiresAt tidak melampaui session. Renewal tidak boleh memperpanjang session yang sama melewati 90 hari; reauthentication/recovery terverifikasi menerbitkan session baru.
- Session cookie bukan bukti kepemilikan semua invoice. Setiap request mengecek active session + active grant + tepat Order.invoice yang diminta. Tidak memberi akses lewat ID/email/phone saja.
- Bootstrap session dilakukan same-origin sebelum final checkout; issuance grant tidak mengganti cookie active pada setiap order. Uji parallel tabs/first bootstrap agar response cookie terlambat tidak membuat invoice kehilangan akses. Jangan mengaitkan session ke fingerprint/IP atau nomor negara telepon.
- Browser/origin berbeda dan cookie hilang perlu verified recovery. Checkout/invoice tidak menaruh token dalam URL atau localStorage pada mode baru. HTTPS wajib; global/env actual belum diperiksa.
- HttpOnly mengurangi pencurian token oleh JS, bukan menghilangkan XSS; same-origin malicious JS masih dapat menggunakan session. Pertahankan CSP, no-store, CSRF dan server authorization.

## 8. Schema invoice revisi (belum ditambahkan)

Usulan **terpisah dari migration WhatsApp**:

| Model | Fields/invariant |
| --- | --- |
| InvoiceAccessSession | id, tokenHash unik CHAR(64), createdAt, expiresAt, revokedAt; hash session credential; index expiry. |
| InvoiceAccessGrant | sessionId, orderId, createdAt, expiresAt, revokedAt; unique(sessionId, orderId); FK session cascade hanya authorization rows, FK Order restrict; index order/expiry. |
| InvoiceRecoveryChallenge | id opaque, sessionId, orderId, codeMac, createdAt, expiresAt, attempts, consumedAt, sentAt; expiry/consumption dan session binding; tanpa code/plaintext email/phone tambahan. |

Order mendapat inverse relations saja. Tidak menghapus/mengubah accessToken lama atau financial data. Cleanup hanya expired authorization/challenge; cron stok tidak diubah. Revocation session memutus semua grants session; grant revocation memutus satu invoice/session. Full invoice revocation juga harus mencabut bearer legacy yang masih aktif melalui prosedur berizin; revoked cookie saja tidak mencabut token lama.

## 9. Authorization, compatibility dan verified recovery revisi

### Issuance dan authorization

- Shared helper untuk invoice detail, payment reconciliation dan QRIS download: validasi ID/credential, authorize sebelum relation credentials/decryption/provider.
- Valid legacy x-order-token masih cocok pasangan invoice+token. Invalid explicit header tidak fallback ke cookie. Tanpa header: hash browser cookie, active session, active grant dan invoice yang sama. Semua deny seragam 404/private-no-store; DB failure bukan allow fallback.
- Cookie-auth POST, bootstrap, exchange/recovery wajib sameOrigin/JSON dan CSRF policy. SameSite saja tidak cukup. Header-only legacy clients tidak tiba-tiba diwajibkan cookie.
- Mode checkout cookie baru harus didesain tanpa raw-token response. Order/contact/grant issuance atomik, network/provider di luar lock. Replay memakai key+digest semula, memberi akses ke invoice sama, bukan order/charge baru. Semua cabang replay/P2002/commit ambigu diuji.
- Dual-mode endpoints di-rollout sebelum Login frontend berpindah. Apps/Gamepass/Username journey dan legacy payload tetap; perubahan shared invoice hanya compatibility layer. Migration/auth rollout menunggu approval terpisah.

### Bridge invoice lama

Usulan POST /api/orders/[id]/access: same-origin + valid legacy x-order-token untuk tepat invoice itu. Create/reuse grant bagi browser session, tanpa rotate token/payment/provider. Response tidak echo token/PII. Invoice UI boleh exchange token lama; **hapus token invoice itu dari localStorage hanya setelah cookie-auth GET benar-benar berhasil**. Jika cookie/exchange gagal, legitimate legacy header masih bekerja. Jangan bulk-delete token atau memberi grant hanya berdasarkan email/nomor invoice. Legacy writers yang belum dimigrasi tetap risiko yang dinyatakan, bukan otomatis dianggap hardened.

### Recovery terverifikasi bila cookie hilang/expired

**Usulan alur toko, bukan OTP Roblox.** Endpoint existing recover saat ini tetap 410; tidak diaktifkan dalam batch ini.

1. POST /api/orders/[id]/recover menerima notification email di body bounded, bukan URL. Same-origin, source/per-invoice/per-email-HMAC rate limit dan response generik 202 yang sama untuk pasangan cocok/tidak cocok; jangan bocorkan invoice existence/email.
2. Hanya alamat yang cocok notification email tersimpan menerima kode verifikasi toko. Siapkan session browser unprivileged tanpa grants dan challenge opaque yang terikat session+order. Email/phone yang diketik sendiri belum memberi akses.
3. Kode usulan 8 digit CSPRNG, expires 10 menit, maksimum 5 attempts, single-use. Simpan keyed MAC dengan purpose separation dan challenge/order identity; raw code tidak di DB/log/URL. Challenge ID hanya state memori response, tanpa browser persistence. Kebijakan ini perlu security review sebelum implementasi.
4. POST /api/orders/[id]/recover/verify menerima challengeId+code dalam body, mengecek session binding, URI order match, expiry, attempt limit dan unused state. Lock/conditional update konsumsi challenge + grant dibuat atomik; duplicate/concurrent verify tidak memberi grants tambahan tak berwenang.
5. Recovery berhasil **wajib merotasi session identifier**: terbitkan credential opaque baru dari server dan Set-Cookie, bukan meningkatkan hak session bootstrap dengan identifier lama. Konsumsi challenge, penerbitan session/grant dan pencabutan session pendahulu yang terikat challenge dilakukan atomik; identifier lama tidak lagi diterima. Jika browser memiliki grants lain yang masih sah, pemindahan/penerbitan ulang hanya dari session yang telah diotorisasi server, tanpa memperpanjang expiry grant asal atau menyalin grants berdasarkan ID dari client. Grant hasil recovery hanya untuk invoice yang dibuktikan. Tidak mengembalikan raw Order.accessToken atau mengubah payment/delivery. Wrong/replayed/expired code dan challenge invoice/browser lain ditolak seragam. Session lain pada browser/perangkat yang hilang tidak diketahui dari challenge: pencabutan melalui policy grant/session server yang disetujui, bukan otomatis memberi akses atau mencabut session pelanggan lain. Kebijakan full invoice revocation tetap mencakup bearer legacy (§8).

**Prasyarat operasional yang belum tersedia/diverifikasi:** delivery email server terpercaya, sender/domain, provider API resmi/credentials, cara pemberitahuan pelanggan, failure/retry dan abuse monitoring. Provider/email dependency belum dipilih; jangan mengarang endpoint/konfigurasi, memasang SDK, membaca env atau mengirim email sekarang. Provider send di luar transaksi. Notification email lama hanya divalidasi format, belum verified mailbox: kode recovery membuktikan akses mailbox yang tersimpan, bukan identitas pembayar; alamat salah/tidak dapat diakses memerlukan proses support terverifikasi, bukan bypass email+invoice/WhatsApp. Pemilik perlu menyetujui trust model ini sebelum hardening dirilis.

Uji anti-enumeration body/status/timing yang proporsional, rate-limit enumeration, brute-force, replay/concurrency, cross-invoice/browser challenge, denied CSRF, blocked email send, revocation/expiry dan compatibility legacy. Jangan mengaktifkan cookie-only issuance sampai recovery nyata dan regression gates siap atau pengguna menyetujui batas operasional secara eksplisit.

## 10. Frontend tiga halaman

| URL | UI dan request |
| --- | --- |
| `/roblox/[slug]?method=LOGIN` | Paket aktif Login, server region, selected/unavailable/null state, tombol Lanjut. Tanpa form kontak/sidebar summary atau checkout. |
| `/roblox/[slug]/login/account` | Pink rounded card; username, country picker+WhatsApp, email; security guide; validasi per field; Kembali/Lanjut. Tidak mengumpulkan account secrets atau create order. |
| `/roblox/[slug]/login/summary` | Halaman penuh: method/Robux/username/region/currency, payment method, valid server quote subtotal/fee/discount/total, Kembali/Konfirmasi. Hanya final button POST checkout. |

Shared `src/app/roblox/[slug]/layout.tsx` membungkus client `LoginDraftProvider`; layout/context tidak melakukan DB read atau menyimpan PII di server-rendered props. Nested account/summary mempertahankan provider selama soft navigation pada slug sama. Tidak menambahkan StoreShell ganda.

Draft: product/variant identity, phone country/raw input/canonical phone, username/email, chosen payment method, in-memory idempotency state. **Kontak tetap PII**, walaupun bukan account secret: hanya memory terbatas, tidak disebut non-sensitif untuk membenarkan persistence. Quote token tetap memory component, bukan URL/storage. Draft cleared saat slug berubah, keluar flow, successful checkout; usulan inactivity expiry 30 menit, dengan pesan translated.

- Browser refresh/direct account/summary tanpa valid draft: tampilkan pesan draft unavailable berterjemahan lalu replace ke picker Login, tanpa POST order/payment. Jangan menganggap Next layout state bertahan hard reload.
- Back button dan browser Back memakai client navigation; form values dipertahankan. Langkah summary hanya bila package, username, phone dan email valid. Step direct bypass ditolak di client; server tetap final authority.
- Ambil ulang katalog saat summary entry untuk availability/region/product changes, abort stale requests. Price null/inactive/wrong method → blok confirm dan arahkan pilih ulang, tetap jangan fallback IDR.
- Fetch quote saat summary masuk dan payment berubah; tampilkan loading/error/retry, bukan cached price sebagai total valid. Quote sebenarnya tidak punya explicit expiry: jangan menambah timestamp contract diam-diam. Refresh quote pada page revisit/focus sebelum konfirmasi yang sudah stale; perubahan harga memerlukan reconfirm, sementara checkout server tetap menghitung ulang.
- Snapshot confirmation dipakai untuk satu klik final; in-flight controls disabled, mutation bukan efek mounting. Payment unavailable MY/PH tetap blocked walau harga bisa tampil; fixture MY/PH bukan aktivasi provider.
- Discount hanya dari quote nyata (jika nol, tampilkan zero atau omit row konsisten, tanpa promo palsu). Safety copy menyebut password, OTP, session token, backup/recovery codes tidak boleh diserahkan. UI country-phone diberi penjelasan tidak menentukan harga.
- Integrasi `TopupCatalog` mengubah branch LOGIN saja. Gamepass/Username/Apps/admin workflows selain explicit Login contact DTO tidak direwrite. New text/errors/a11y masuk map ID/EN/MY melalui LanguageContext.

## 11. File impact setelah desain disetujui

Existing: `prisma/schema.prisma`, `src/lib/commerce.ts`, `src/lib/checkout.ts`, `src/app/api/checkout/route.ts`, `src/app/api/admin/fulfillment/route.ts`, `src/components/FulfillmentAdmin.tsx`, `src/components/TopupCatalog.tsx`, `src/app/order/[id]/page.tsx`, tiga invoice route handlers, relevant translations, `tests/*`, task-progress `plan.md`.

New proposed: shared slug layout/provider, Login account/summary pages, Login flow components, phone validation helper, invoice authorization/grant helper, legacy exchange route, tests dan migration WhatsApp additive yang sudah disiapkan. Invoice helpers/routes/models/migration tetap future proposal, belum dibuat.

Tidak mengubah Gamepass/Username/Apps feature logic, provider setup, checkout money/quote algorithm, webhook signature/state machine, Prisma global timeouts, admin auth policy, stock cron, payment environment/keys atau GeoIP. Shared invoice endpoint/client perubahan adalah **compatibility layer** yang tetap harus regression-tested terhadap ketiganya.

## 12. Urutan implementasi dan rollout

1. Review proposal: approve phone dependency+field/contract, cookie/grant/legacy mode, TTL/cap/recovery policy. Ini gate sebelum kode/schema/auth changes.
2. Implement lokal additive schema + dua SQL migration yang direview (phone; invoice grants), generate client secara terisolasi, tanpa apply remote. DTO privacy disiapkan bersamaan agar encrypted field tidak bocor.
3. Shared phone validator, parse/normalized idempotency, atomic encrypted contact; admin explicit projections. Legacy historical retries tetap berhasil; non-Login behavior unchanged.
4. Dual invoice auth, grant issuance/replay+cookie, legacy exchange, CSRF, safe errors. Uji header/cookie matrix sebelum invoice client beralih.
5. Tiga halaman/provider/translations, cookie-mode final confirm, draft guards, safe bridge invoice client. Uji semua UI state dan quote drift.
6. Unit/HTTP/MySQL/migration/browser fixtures isolated; compile/lint/build/diff review. Tidak menghubungi remote, Midtrans atau membuat transaksi nyata.
7. Ajukan hasil kode+migration SQL+QA. Minta persetujuan **terpisah** sebelum staging/remote rollout, commit/push/deploy sesuai scope release terbaru.
8. Rollout berizin: verifikasi target bukan defaultdb, migration history/FK/MySQL dan backup/PITR/restore; nilai metadata locks. Schema additive dahulu melalui `migrate deploy`, lalu build/client+compatible app. UI new Login dan backend requirement berada dalam batch compatible yang sama; old tabs mendapat safe validation, bukan financial corruption.
9. Cek Ready+SHA jika deploy disetujui, smoke non-transaksional/fixtures sah. Vercel Ready/mock bukan payment integration evidence. Jangan gunakan customer order untuk smoke.

## 13. Risiko dan rollback

| Risiko | Mitigasi/rollback |
| --- | --- |
| Phone leak karena nested select/spread | Explicit DTO sebelum fitur dibuka; encrypted field tak pernah keluar; regression whole-response. |
| Key/decrypt failure | Fail closed, safe diagnostic; ciphertext retained; jangan fallback plaintext atau rotate key dalam batch. |
| Contract lama dan hash drift | Absent field tidak diberi default; early replay; required hanya new Login; exact digest tests. |
| Cookie CSRF/IDOR/mixed credentials | Shared invoice-bound auth; invalid header tidak fallback; Origin check pada cookie mutations; 404 seragam. |
| Session expiry, cleared browser | 90-day absolute session expiry; legacy exchange dan verified recovery yang masih memerlukan rollout approval. |
| Lost response dekat commit | Atomic Order/contact/grant; retain/replay key; safe ambiguous outcome; no second charge. |
| Session/grant revocation vs legacy bearer | Jangan klaim full revocation sampai legacy capability ikut dicabut melalui prosedur berizin. |
| Grant/session/challenge growth | Fixed-size cookie dan indexed grants/session queries, private/no-store; expiry denied; cleanup nonfinancial terpisah, bukan purge Order. |
| Phone country mengubah harga | Tidak dipakai GeoIP/quote; negative tampering tests. |
| XSS masih dapat memakai session | HttpOnly bukan XSS cure; CSP/escaping, no new bearer JSON/storage untuk cookie Login. |

Rollback **tidak boleh langsung kembali ke aplikasi sebelum cookie support** setelah cookie-only invoice diterbitkan, karena pelanggan baru tidak punya localStorage token. Pertahankan invoice dual-auth/grant support sebagai compatibility patch meski UI redesign dimatikan. Backend harus tetap menyimpan phone untuk new Login; jika UI baru bermasalah, sementara disable entrypoint Login melalui release yang direview, bukan mengubah data/key/payment/env diam-diam. Apps/Gamepass/Username tetap berjalan.

Schema/tabel additive ditinggalkan; tidak drop field/table, decrypt/backfill massal, atau hapus financial history. Memulihkan seluruh versi lama tanpa cookie compatibility bukan rollback aman. Jika migration gagal, aplikasi baru belum dideploy dan operator menilai hasil aktual; jangan reset/db push/destructive down. Restore backup hanya prosedur operator berizin, bukan otomatis menimpa transaksi baru.

## 14. Rencana pengujian dan acceptance

| Kelompok | Cases wajib |
| --- | --- |
| Phone | National→E.164 untuk ID/MY/PH dan country lain, shared calling-code, invalid length/digits/code/extension, bounded input, server revalidation; country phone tidak mengubah price/GeoIP. |
| Commerce | Required new Login; forbidden on metode lain; secret/unknown field rejected; username/email normal/invalid; exact legacy replay; canonical phone hash conflict; encryption atomic rollback. |
| Admin privacy | Owner PAID Login receives phone; unpaid/unclaimed/other admin/reassigned/expired session denied; legacy null; ciphertext/phone tidak nested/public/log/provider/Telegram. |
| Invoice isolation | Cookie A→invoice A succeeds, cookie A→B 404; wrong/missing/expired/revoked; header valid+cookie invalid, header invalid+cookie valid; existing Apps credential decryption hanya after auth. |
| Bridge | Valid legacy exchange, wrong-token 404, no email-only recovery, no raw token JSON, storage removal only after cookie GET succeeds; cookie disabled → legacy fallback; no bulk token deletion. |
| CSRF | Wrong/missing Origin cookie payment/issuance/exchange rejected, cross-origin POST/form rejected; ordinary same-origin works; legacy explicit token path unchanged. |
| Concurrency | Concurrent checkout replay one order/provider call; grants for different invoices don't overwrite; same-invoice retries grants safe; failure at grant/commit/network yields rollback or explicit ambiguous state. |
| Cookie policy | HttpOnly/Secure/Lax/host-only/Path/name, no document.cookie token read, browser real cookie sending, fixed-size cookie tanpa arbitrary invoice cap, TTL/revocation denied tanpa delete Order; verified recovery scenarios. |
| QR/payment | Auth/rate-limit before upstream; PNG/JPEG/environment-host/redirect/size guards unchanged; reconciliation never creates charge; archived/removed invoice access intact. |
| Frontend | Selection→account→summary, back/browser-back values retained, refresh/direct empty-draft redirects, safe field errors/input retention, no sidebar, no order before final, focus/tab/labels/overflow. |
| Price/method | ID/MY/PH independent, price null, inactive variant, unknown region, no provider, quote error/drift, fee/discount real only; MY/PH remains unavailable without adapter. |
| Regression | Existing Gamepass/Username wizards, Apps checkout/invoice, admin ownership/archive/restore, signed webhook/idempotency, historical snapshots and regional migration tests. |
| Migration | Empty disposable MySQL + old fixture records: unchanged totals/token/status, phone null, grants empty, proper indexes/FK; historical tests select only historical fields. |

Test prerequisites: safe isolated app copy tanpa env files; mocked provider/Roblox/region boundary only in test harness; disposable localhost `cloudy_test_*` only dengan izin, no remote/defaultdb. Unit mocks test rollback/interfaces; MySQL test local fixtures bukan transaksi gateway. E2E `route.fulfill()` untuk catalog/quote/checkout response; assert no real `/api/checkout` request escapes fixture dan no payments. Tidak menulis customer data/sensitive traces.

Checks setelah implementasi: targeted tests, `tsc --noEmit`, lint, production build, Prisma validate, whitespace diff; relevant isolated integration/E2E. Browser **375×812**, **810×1080**, **1440×900**, ID/EN/MY, screenshots sintetik dan security-no-storage assertions. PASS/FAIL/SKIP/untested dilaporkan benar; hasil WhatsApp/frontend lokal tercatat di [QA](../qa/roblox-login-2026-10-14.md). Invoice/session/recovery dan DB integration/migration masih belum diuji karena belum diimplementasikan atau dilarang dijalankan.

## 15. Review gates

Rekomendasi untuk disetujui sebagai satu desain:

1. WhatsApp/tiga halaman **sudah disetujui dan diimplementasikan lokal**: `whatsappE164` ciphertext nullable, new Login requirement, max metadata validation, explicit admin DTO.
2. Revisi satu InvoiceAccessSession cookie + grants server, dual auth/exchange dan verified recovery; belum disetujui untuk implementasi.
3. Policy **maksimum 90 hari session** dengan revocation server, tanpa limit otomatis 32 invoice; verified-channel recovery+email provider readiness perlu review.
4. Tiga URL dan memory-only PII draft/quote, existing signed quote contract tanpa menambah expiry waktu diam-diam.

Persetujuan desain tidak berarti persetujuan menjalankan migration remote, mengubah environment/credential/live payment, membuat order nyata, commit, push atau deploy. **Berhenti untuk review.**

## 16. Local implementation checkpoint

WhatsApp/tiga halaman disetujui untuk implementasi lokal. Schema memakai whatsappE164 nullable yang berisi ciphertext AES-GCM, API input canonical E.164, metadata max client/server, explicit admin DTO. File migration additive disiapkan tetapi tidak dijalankan. Sistem invoice legacy tetap dipakai; cookie/session/recovery hanya revisi desain. Hasil QA akhir dicatat terpisah setelah verifikasi.

Current-phase rollback: selama invoice masih legacy, rollback UI/WhatsApp application dapat mempertahankan kolom nullable additive dan ciphertext. Jangan drop/decrypt data kontak. Ketentuan rollback cookie di atas baru berlaku jika hardening invoice disetujui dan diterapkan kelak.
