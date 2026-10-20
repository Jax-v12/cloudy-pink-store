# Benchmark roadmap implementation — 19 Oktober 2026

Branch: `feat/roblox-login-checkout-recovery`; base HEAD `f2efd0c640e8546bf0fa7b61d865efd2e9160f0e`. Implementasi lokal atas permintaan pemilik setelah [benchmark](competitive-benchmark-2026-10-19.md). Tidak ada commit, push, shared-database migration, Preview baru, atau Production release dalam pekerjaan ini.

## Hasil dan status fase

| Fase | Status | Implementasi / batas |
| --- | --- | --- |
| P0 | Sebagian; operasional BLOCKED | Matriks bukti tersedia; [inventaris CapCut](../plans/apps-product-inventory-2026-10-19.md) berasal dari jawaban pemilik. Harga, stok, perangkat/region, ketentuan rinci dan metode pengiriman belum lengkap. Retensi backup provider dan eksekusi scheduler deployment masih belum terverifikasi. |
| P1 | Implementasi lokal | Apps memakai kartu dua kolom pada mobile, pencarian/kategori server, detail sebelum pembayaran, error/retry yang tidak menjadi false empty, label/focus form. Roblox memiliki kartu lebih ringkas dan copy yang membedakan proses toko dengan pending Roblox tanpa janji lima hari. Identitas pink/Anya dan logo dipertahankan. |
| P2 | Implementasi lokal; data nyata pending | Metadata Apps/admin, Product/SKU terpisah, kelompok aplikasi eksplisit, snapshot harga/ketentuan saat konfirmasi, garansi per produk, legacy fallback tanpa tanggal rekaan, bantuan invoice dengan state dan audited reopening. Belum mengisi katalog bersama. |
| P3 | Inti lokal; operasional sebagian | Ready-account tetap memakai stok; activation tanpa stok palsu masuk antrean setelah paid. Claim/owner/reauth, pengiriman terenkripsi, acknowledgment tanpa auto-complete, bukti aktivasi, periode layanan dan renewal order tersedia. Reminder dispatch belum diimplementasikan; metode aktivasi CapCut belum diputuskan. |
| P4 | SEO dasar lokal; pengukuran pending | Metadata Apps/Roblox/help/privacy, robots/sitemap publik dari APP_ORIGIN tervalidasi, private noindex metadata/HTTP dan bahasa dokumen ID/EN/MY. Pengukuran funnel/vitals sebelum-sesudah belum dilakukan; tidak mengklaim peningkatan performa atau menambahkan promosi/testimoni palsu. |

## Kontrak dan perubahan

- `src/lib/appsProduct.ts` adalah parser bounded metadata versi 1, aturan garansi, response katalog, dan filter server. Metadata operator ditampilkan apa adanya; tidak membuat terjemahan ketentuan produk yang belum disediakan.
- `Product.appsConfig` nullable mempertahankan produk lama. Paket terstruktur memuat appGroup, jenis akun, durasi hari, perangkat/region, isi/panduan/aturan, garansi dan mode/metode fulfillment. Produk baru dapat disimpan tidak aktif tanpa harga/konfigurasi lengkap; aktivasi penjualan lewat pengelola baru membutuhkan konfigurasi valid dan harga positif.
- `GET /api/products` mendukung `q`, `category`, `slug`, cursor/limit. Filter berada di query sebelum pagination. DTO Apps membawa metadata dan `appsPolicyToken` yang mengikat Product, harga dan konfigurasi.
- Checkout memeriksa token tersebut di bawah lock Product, lalu menyalin konfigurasi ke `Order.appsSnapshot` di transaksi yang sama. Ketentuan berubah memerlukan persetujuan ulang; request legacy tanpa metadata tetap kompatibel.
- `/apps/[slug]` menampilkan detail, harga, stok/mode, email penerima dan persetujuan eksplisit sebelum membuat pesanan. Hanya final submit memanggil checkout; navigasi/pencarian/quantity tidak membuat Order.
- `/admin/apps` dan `/api/admin/apps/products` mengelola metadata serta draft paket; updatedAt mencegah penyimpanan metadata yang sudah berubah. Link pengelola tersedia dari tab produk admin lama; jalur tambah stok terenkripsi lama tetap ada.
- `AppsService` menyimpan hubungan renewal, pengiriman terenkripsi dan tanggal layanan. `AppsSupport` menyimpan kategori masalah/status/timestamp; riwayat transisi memakai AdminAudit. Tidak menerima deskripsi bebas berisi password/OTP.
- Paid activation membuat satu job dan tetap QUEUED. Worker GAME tidak mengirim aktivasi secara otomatis. Admin harus mengambil tugas; pengiriman dan bukti complete hanya untuk owner dengan sesi/recent reauth yang masih valid setelah Order lock.
- Acknowledgment pelanggan bukan bukti aktivasi. Admin mencatat referensi bukti non-PII untuk complete; `activationConfirmedAt` dipisahkan dari periode entitlement yang dapat dimulai di masa depan untuk renewal.
- Renewal hanya untuk layanan ACTIVATION yang sudah aktif, melalui invoice owner yang sah. Satu penerus PENDING/PAID yang masih mengikat diperbolehkan per sumber; request dengan key sama merecover Order yang sama. Penerus yang fully refunded dan belum aktif boleh diganti. Renewal berikutnya memakai invoice penerus terbaru. Masa layanan dimulai dari maksimum waktu konfirmasi dan akhir layanan sumber; tanpa autobilling.
- Pengiriman undangan/link/voucher dibatasi 72 jam, terpisah dari kebijakan rahasia Roblox Login. API dan UI menyembunyikannya pada expiry, timer membersihkan plaintext dari state browser, dan cron cleanup menghapus ciphertext secara bounded di bawah Order lock dengan audit. Owner dapat mengirim ulang aktivasi yang belum selesai. Pelanggan melihat batas waktu dan jalur bantuan. Backup copies tetap memerlukan gate retensi/restore operasional sebelum aktivasi nyata.
- Email penerima hanya dapat dilihat owner tugas melalui action ber-reauth, diaudit dan ditutup setelah maksimal 60 detik/halaman disembunyikan. Data pengiriman tidak dimasukkan audit, Telegram, URL atau browser storage.
- Bantuan menerima NO_ACCESS, STOPPED_WORKING atau DELIVERY_HELP; klaim akses membutuhkan garansi aktif, sementara bantuan pengiriman tetap tersedia untuk paid/no-refund. Open request idempoten; request terminal dapat dibuka kembali secara diaudit. Tidak otomatis refund atau mengganti stok.
- UI baru memakai translation map ID/EN/MY melalui LanguageContext. Login, GAMEPASS, GIFT_USERNAME, QRIS dan state/invoice lama dipertahankan.

## Data CapCut dan blocker

Pemilik menetapkan CapCut Pro Private 1 bulan dengan garansi 25 hari, serta Private 7 hari dengan garansi 7 hari. Nama paket tersedia sebagai template form admin; belum dibuat sebagai produk aktif di database bersama. Satu bulan belum diasumsikan 30 hari. Harga, stok nyata, perangkat/region, isi/panduan/rules dan fulfillment mode masih menunggu data operator. Tidak ada seed produk contoh atau penambahan stock palsu.

Konektor GitHub mengembalikan `workflow_runs: []` untuk commit f2 yang diperiksa. Ini hanya hasil query commit tersebut, bukan bukti bahwa seluruh scheduler repository tidak aktif. Tetap diperlukan bukti scheduled execution, hasil purge, retry dan alert dari target deployment yang benar. Tidak memanggil endpoint cron remote untuk membuat bukti.

[Dokumentasi backup MySQL Aiven](https://aiven.io/docs/products/mysql/concepts/mysql-backups) menyatakan retensi tergantung service plan; [free-tier docs](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier) menyebut backup tetapi tidak memberi angka retensi yang dapat dipakai untuk menutup gate layanan ini. Tiga backup yang terlihat pada QA lama tidak dipakai sebagai janji retensi tiga hari. Bukti restore lokal terdahulu tetap sah sesuai [QA 17 Oktober](roblox-login-release-2026-10-17.md), terpisah dari retensi provider.

Copy Gamepass mengacu pada [Roblox Experience Passes](https://en.help.roblox.com/hc/en-us/articles/203314040-Experience-Passes): terdapat pending escrow dan biaya transaksi, tanpa durasi universal lima hari pada sumber tersebut. Tidak mengubah harga, fee, payment mode, atau aturan kelayakan dari klaim kompetitor.

## Verifikasi

| Pemeriksaan | Hasil / batas |
| --- | --- |
| Focused domain/handler cases | 18 PASS: parser, garansi/snapshot, expiry, false-empty error, server filter, activation payment dispatch, legacy stock, renewal, invoice ownership, expired session/recent reauth |
| Full regression | **207 PASS / 0 FAIL / 9 SKIP** pada versi kode terakhir. Sembilan grup HTTP/MySQL/migration lama tidak diberi prasyarat masing-masing pada full suite; bukan PASS. Skenario baru memakai integration runner tersendiri di bawah |
| New MySQL integration | 9 PASS pada localhost `cloudy_test_benchmark_20261019`; termasuk actual locks, atomic records, duplicate settlement, owned actions, physical purge, distinct-key renewal contention/replay, refunded replacement dan legacy stock |
| Empty-schema migration | Seluruh 12 migration APPLIED di database disposable tersebut; database-to-schema diff kosong |
| Existing-schema fixture upgrade | 11 migration lama → synthetic legacy Product/Order → migration Apps; digest baris lama tetap sama, snapshot legacy tetap NULL; database-to-schema diff kosong |
| Browser Apps | **9 PASS** ID/EN/MY × 375×812 / 810×1080 / 1440×900 pada build terakhir: error/retry, search, detail/consent, invoice/acknowledgment, purchased guide, expired cached delivery hidden, admin draft form, keyboard dan no page overflow |
| Shared help/Roblox/browser regression | **37 PASS** pada build terakhir dengan API fixture; mencakup FAQ/keyboard, tiga method link, invoice/status edge cases dan unknown region |
| TypeScript / ESLint | TypeScript PASS; lint 0 error, 3 warning lama (StoreShell img dan dua unused variables di Sandbox harness) |
| Build | Isolated production build **PASS** pada snapshot terakhir; semua file `src/` cocok byte-for-byte dengan working tree. Workspace-root warning dan satu generated CSS optimizer warning teramati; tidak mematikan gate atau mengklaim warning sebagai error |
| HTTP tanpa database | **5 PASS**: admin/invoice HTML private noindex metadata + X-Robots-Tag; Apps action/renew POST tanpa akses 404; admin list tanpa sesi 401 |

MySQL integration script menolak target selain nama database disposable eksplisit pada localhost dan menolak outbound fetch. Seluruh data integration adalah fixture sintetis; synthetic status/refund bukan bukti Midtrans/provider sebenarnya. Target upgrade terpisah: `cloudy_test_benchmark_upgrade_20261019`. Tidak ada akses defaultdb, shared staging data, customer Order, Sandbox charge atau provider activation. Schema/table/financial fixture history tetap tersimpan; tidak melakukan DROP database/hard-delete Order untuk cleanup.

Browser menggunakan renderer lokal dengan database dinonaktifkan (port 0), intercept API dan menolak request luar. Pengujian tidak membuat pesanan/pembayaran nyata. Screenshot/result berada di ignored `.cache/benchmark-20261019/browser/`. HTTP no-auth/noindex memakai server lokal tersebut; fixture bukan bukti ingress atau produksi.

Perubahan OTP/Telegram/recent-orders yang ada sebelum task ini tetap cocok hash pada enam file sumber/test yang tidak disentuh. Dua file dirty yang memang perlu diintegrasikan (`admin/page.tsx` dan `order/[id]/page.tsx`) menerima patch terarah; perbaikan OTP/pagination/timer sebelumnya dipertahankan. Index Git tetap kosong.

Final documentation checks: 42 tautan lokal valid, whitespace diff PASS. Renderer task dihentikan; proses MySQL yang dinyalakan task ini dihentikan secara graceful setelah uji, mengembalikan kondisi awal service yang semula tidak berjalan. Dua database uji tetap ada untuk reproduksi, berisi hanya fixture task; tidak menghapus database/histori. Satu percobaan peluncuran server dengan konfigurasi kunci uji sempat ditolak automatic approval review (alasan tool hanya “blocked by policy”); pengujian dilanjutkan dengan renderer tanpa akses database/kunci, tanpa melewati penolakan tersebut.

Review independen memeriksa snapshot drift, payment-versus-activation, ownership/reauth, klaim ulang, replacement refund, renewal contention, expiry/purge/redelivery dan instruksi invoice. Temuan ditindaklanjuti dengan regresi; gate operasional tetap terbuka.

## Rilis dan pemulihan

Migration `202610190001_apps_service_metadata` additive: dua nullable JSON columns dan dua tabel dengan restrictive FKs; telah diuji di localhost saja. **Jangan mempublikasikan runtime ini sebelum schema target memiliki migration tersebut.** Catalog dan invoice memakai selection baru, termasuk shared endpoint yang juga melayani Roblox.

Urutan rilis selanjutnya: verifikasi target bersama dan backup/readiness → tinjau/terapkan migration yang diotorisasi → generate/build seluruh perubahan yang saling terkait → Preview SHA cocok dan smoke → tutup gate scheduler/retensi/provider sesuai scope → baru pertimbangkan Production. Jika rollback aplikasi diperlukan, biarkan kolom/tabel additive dan data pesanan tetap ada; jangan drop histori atau mengubah status payment/stok untuk rollback UI.

P0 operasi, aktivasi/penjualan CapCut nyata, pengingat otomatis, serta pengukuran funnel/performa belum dinyatakan selesai. Tidak ada izin baru yang diturunkan dari keberhasilan fixture atau dari dokumen ini.
