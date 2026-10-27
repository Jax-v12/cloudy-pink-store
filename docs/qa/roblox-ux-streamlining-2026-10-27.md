# Roblox UX Streamlining & Mayoblox Benchmarking QA — 27 Oktober 2026

## Ringkasan Eksekutif

Menindaklanjuti perbandingan UX antara Mayoblox dan Cloudy Pink Store ([laporan awal](mayoblox-comparison-2026-10-27.md)), alur pembelian dan penyajian informasi dioptimalkan agar pengunjung mobile dapat menjangkau opsi pembelian Roblox lebih cepat tanpa menghilangkan identitas visual Anya/Pink atau alur multi-langkah yang sudah ada.

Perubahan difokuskan pada:
1. **Penyajian Kartu Layanan Roblox (`/roblox`)**: Harga mulai dan tombol aksi Beli (`f.buy`) dipindahkan ke bagian atas kartu; rincian kebutuhan, proses, dan estimasi waktu dirapikan ke dalam elemen `<details>` yang dapat dilipat (`comparison.detailsSummary`), sehingga pengguna mobile langsung melihat aksi beli pada layar pertama.
2. **Kerapatan Tata Letak (Hero & Lokasi)**: Padding hero `TopupCatalog` dan komponen `DetectedLocation` diperingkas pada layar kecil (`375×812`), menghemat ruang vertikal tanpa memotong teks atau melanggar aksesibilitas.
3. **Indikator Alur & Panduan Login (`LoginFlow`)**: Penambahan stepper 3 tahap (`Paket` → `Detail Akun` → `Ringkasan Pesanan`) dan panduan langkah pembuatan kode cadangan Roblox yang dapat dilipat (`backupGuideTitle`, `backupGuideSteps`) langsung di dalam formulir.
4. **Bantuan WhatsApp Kontekstual (`StoreShell`)**: Pesan default WhatsApp disesuaikan menurut halaman yang sedang dikunjungi: pesan spesifik Roblox pada `/roblox` (mengarahkan nomor invoice dan melarang pengiriman sandi/OTP), pesan Apps pada `/apps`, dan pesan umum pada halaman lainnya.
5. **Internasionalisasi Penuh (i18n)**: Semua label, panduan, dan pesan bantuan baru diterjemahkan secara lengkap dalam 3 bahasa (**ID**, **EN**, **MY**).

---

## Metrik Pengukuran Posisi Vertikal (Viewport Mobile 375×812)

| Elemen pada `/roblox` | Posisi Vertikal Sebelum | Posisi Vertikal Sesudah | Penghematan Vertikal | Status Layar Awal (Fold) |
| --- | --- | --- | --- | --- |
| Judul Gamepass | ~911 px | 542 px | -369 px | Masuk layar pertama |
| Tombol Beli Gamepass | ~1.430 px | 633–673 px | -757–797 px | **Masuk layar pertama (< 812 px)** |
| Judul Login | ~1.591 px | 804 px | -787 px | Tepat di batas layar pertama |
| Tombol Beli Login | ~2.087 px | 895 px | -1.192 px | Hanya butuh 1 kali scroll ringan |
| Judul Username | ~2.248 px | 1.065 px | -1.183 px | Terlihat langsung saat scroll |

---

## Bukti Verifikasi Lokal

1. **Whitespace & Git Check**:
   - `git diff --check`: 0 error / warning.
2. **Typecheck & Linter**:
   - `npx tsc --noEmit`: PASS (0 type error).
   - `npm run lint`: PASS (0 error, 1 pre-existing warning Next.js `<img>` pada `StoreShell.tsx`).
3. **Unit & Translation Tests**:
   - `tests/login-public-ui.test.mjs`: PASS (verifikasi kelengkapan `backupGuideSteps`, `detailsSummary`, `whatsappRobloxMessage`, dan `whatsappGeneralMessage` pada ID/EN/MY).
   - `tests/login-flow.test.mjs`, `tests/roblox-p0c-catalog.test.mjs`, `tests/indonesia-market.test.mjs`, `tests/roblox.test.mjs`: 20/20 PASS.
4. **Production Build**:
   - `npm run build`: PASS (Turbopack Next.js 16.4.2, 28 rute terbangun statis/dinamis tanpa kendala).
5. **Playwright Visual & Layout Matrix**:
   - `verify-ux-improvements.mjs`: 9/9 skenario PASS pada `375×812`, `810×1080`, `1440×900` × `ID`, `EN`, `MY`.
   - `tests/service-help.e2e.mjs`: 28/28 skenario PASS.
   - `tests/login-attempt.e2e.mjs`: 18/18 skenario PASS.

---

## Batasan & Keamanan

- Tidak ada kredensial, kunci API, atau variabel lingkungan (`.env`) yang disentuh atau dicetak.
- Tidak ada akses remote DB, seed, atau mutasi data transaksi.
- Hak akses dan isolasi data tetap terjaga; pesan WhatsApp Roblox menegaskan pelanggan untuk tidak mengirimkan sandi/OTP ke admin.
