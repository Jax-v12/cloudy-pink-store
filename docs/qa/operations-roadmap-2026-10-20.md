# Roadmap operations follow-up — 20 Oktober 2026

Kelanjutan benchmark 19 Oktober; branch `feat/roblox-login-checkout-recovery`. Pemilik meminta pekerjaan pending nomor 2/3 dan memilih WhatsApp H-3/H-1, kemudian mengonfirmasi belum memiliki penyedia WhatsApp. Tidak membuka akun berbayar atau mengirim pesan pelanggan.

## Bukti operasional

- Target runtime Vercel diverifikasi: project `cloudy-pink-store`, team `jax-v12`, project ID `prj_Oz6McF6kBIkykqRNw8cqo5ousj9m`. Production tetap terpisah dari publikasi feature Preview.
- GitHub environment `store-operations` sekarang memiliki `CRON_SECRET` dan `STORE_CRON_ORIGIN=https://cloudy-pink-store.vercel.app/`, hanya mengizinkan main. Ini menggantikan catatan historis environment kosong.
- Workflow memang sudah ada di main. Sebelas scheduled run yang terlihat gagal; [run #11](https://github.com/Jax-v12/cloudy-pink-store/actions/runs/39262802273) memakai main `4256f35`. Tidak mengartikan lima menit dalam YAML sebagai bukti interval aktual; daftar tersebut memiliki jeda jauh lebih panjang.
- Pemeriksaan endpoint terotorisasi: cleanup HTTP 500; fulfillment HTTP 200/success. Error tersanitasi cleanup: `CLEANUP_REQUIRES_RETRY` dan `GATEWAY_STATUS_UNVERIFIED`. Heartbeat fulfillment terakhir sesuai run; bukan bukti cleanup berhasil.
- GET status Midtrans Sandbox atas dua pending yang sudah ada, tanpa charge/expire/refund: HTTP 200 dengan kode 407; identitas, nominal, IDR dan transaction ID cocok. [Dokumentasi Midtrans](https://docs.midtrans.com/reference/status-code-4xx) mendefinisikan 407 sebagai expired. Fix hanya menerima pasangan 407/expire dan mempertahankan seluruh pemeriksaan identitas. Commit terpisah `a5bd268`; review independen menyetujui. Runtime Production belum menerima fix pada checkpoint ini.

## Backup dan schema bersama

- Backup baru `cloudy_staging` dibuat terenkripsi AES-GCM, key dilindungi DPAPI CurrentUser dan ACL owner/SYSTEM. Tidak menulis dump plaintext. Footer/schema dump dan authenticated decrypt round-trip byte-for-byte lulus. **Tidak melakukan SQL restore baru** pada run ini; bukti restore SQL lokal 17 Oktober tetap dilaporkan terpisah.
- Key/blob backup baru dijadwalkan kedaluwarsa pada `2026-10-26T16:03:43.421Z` (26 Oktober, 23:03 WIB), dengan task `CloudyOperationsBackupExpiry20261019`, `StartWhenAvailable`, current-user interactive logon. Path/symlink/manifest checks lulus. Status Ready bukan bukti penghapusan masa depan; komputer harus tersedia dan pengguna login.
- Retensi backup Aiven tetap **BLOCKED**: dashboard meminta login. Dokumentasi umum tidak menetapkan retensi tepat service ini. Tidak mengubah plan/provider atau mengklaim visible backups sebagai retensi.
- Sebelum migrasi: identity MySQL 8.4.8, TLS terverifikasi, 11 applied migrations. Dua checksum lokal berbeda hanya karena CRLF; bentuk LF cocok persis dengan history. Migrations deployment memakai salinan LF yang diverifikasi, tanpa mengedit history DB.
- `202610190001_apps_service_metadata` dan `202610190002_apps_reminders_metrics` diterapkan dengan `prisma migrate deploy` hanya ke **cloudy_staging**. Postflight: **13 applied, checksum cocok, 26/26 digest pesanan lama tidak berubah**, jumlah pesanan tetap 26. Tidak seed produk/stock atau membuat order/pembayaran uji remote. Schema additive; rollback aplikasi tidak menghapus tabel atau histori baru.

## WhatsApp dan pengukuran

- WhatsApp Cloud API adapter tanpa dependency baru; default nonaktif jika flag, token, sender, versi API dan approved template belum lengkap. Operator belum memiliki penyedia, sehingga ini merupakan **implementasi siap konfigurasi, bukan pengiriman operasional**. Tidak menambahkan secret atau mengumpulkan nomor pelanggan saat nonaktif.
- Invoice pemilik: explicit consent versi 1 dan nomor internasional tervalidasi, disimpan terenkripsi. Admin dengan recent reauth memeriksa kepemilikan/persetujuan, memakai consent version yang sama; perubahan nomor membatalkan verifikasi sebelumnya. Reveal maksimal 60 detik dan clear saat tab disembunyikan.
- H-3 dan H-1 dihitung sebagai jendela 24 jam masing-masing sebelum `activeUntil`; tidak mengirim H-3 yang sudah lewat atau setelah layanan berakhir. Lock Order dan unique `(orderId, daysBefore, periodEnd)` mencegah kirim ganda. Maksimum tiga send per invocation; HTTP provider di luar transaksi.
- UNKNOWN ditulis sebelum request. Timeout, crash, atau commit ambigu tidak pernah otomatis mengirim ulang. ACCEPTED berarti diterima API, **bukan delivered**. UNKNOWN/REJECTED persisten membuat cron gagal termasuk immediate retry. Ada antrean admin, recent reauth, guard 60 detik terhadap in-flight review, referensi non-PII dan audit untuk REVIEWED; tindakan ini tidak mengirim pesan.
- Opt-out menghapus nomor langsung. Cleanup menghapus nomor setelah expiry/refund/archive dan materi aktivasi kedaluwarsa, sebelum rekonsiliasi pembayaran yang dapat gagal. GitHub runner memanggil cleanup/fulfillment/reminders dengan bounded retry; kegagalan satu endpoint tidak melewati yang lain.
- Metrik menyimpan counter harian ber-dimensi terbatas: area publik, view/final-submit, dan bucket LCP/CLS/INP/TTFB/FCP; retensi 30 hari. Tidak ada event log, query/path, invoice, email, nomor, cookie/session ID atau payload provider. Rate limiter keamanan memakai mekanisme existing yang terpisah dari counter. Fetch tanpa credentials/referrer; DNT/GPC dihormati. Halaman privat tidak mengirim vitals, termasuk setelah SPA navigation.
- Paid counts berasal dari server; browser tidak boleh mengirim PAID. Admin melihat agregat 30 hari, bukan unique users/cohort conversion. Feature flag metrik default nonaktif; Preview tidak mengisi funnel Production pada database bersama.
- Lihat [runbook WhatsApp](../plans/apps-whatsapp-reminders.md) untuk prasyarat operator. Tidak ada pengingat aktif sebelum akun dan template siap.

## Verifikasi checkpoint

- Full regression sesudah implementasi awal: **213 PASS / 0 FAIL / 9 SKIP**. Sembilan grup baseline tetap tanpa prasyarat terpisah. Tidak mengulang full suite setelah perubahan satu predicate health; regresi MySQL khusus di bawah memverifikasinya.
- Integration reminders/metrics localhost: **8 grup PASS**, termasuk concurrency, consent, verification version, ambiguous send, authorized review, recipient purge dan reject PII/paid spoofing. API provider seluruhnya sintetis.
- Regresi health pada database disposable kedua: FAIL sebelum fix (fresh UNKNOWN mendapat HTTP 200), lalu **PASS** sesudah fix; dua panggilan cron berurutan tetap HTTP 503 sampai review.
- Migrasi localhost: upgrade 12 → 13 dan seluruh 13 pada schema kosong PASS; database-to-schema diff kosong pada upgrade. Tidak hard-delete Order/financial fixture history.
- TypeScript PASS. Full ESLint menemukan dua error state-in-effect pada UI baru; keduanya diperbaiki dan targeted lint pada komponen terdampak PASS. Tiga warning baseline tetap terpisah.
- Isolated production build PASS (68s compilation), dengan workspace-root warning. Snapshot build mendahului perubahan satu predicate reminder health; build publikasi harus memverifikasi SHA akhir.
- Snapshot index rilis disusun tanpa enam file OTP/recent-orders/Telegram yang sudah dirty sebelumnya. Admin hanya membawa dua hunk link Apps; invoice mempertahankan perubahan Apps dengan penyederhanaan timer OTP tetap unstaged. Snapshot awal kehilangan dua script harness, sehingga dua grup gagal import; setelah script index ikut disalin, hanya dua grup itu dijalankan ulang: 6 PASS. Gabungan snapshot rilis: **211 unique PASS / 0 FAIL / 9 SKIP**, dengan production build/typecheck **PASS** pada source index akhir. Tidak mengulang kasus yang sudah lulus.
- Independent review menemukan dan memverifikasi perbaikan: caller cron, durable failure signal, private-route telemetry, submit setelah final guard; hasil ambigu immediate-retry diperbaiki dengan regresi nyata MySQL.
- Automatic approval review menolak peluncuran renderer lokal berkonfigurasi uji dengan alasan hanya “blocked by policy”. Perintah tidak diulang. QA browser diarahkan ke Preview terpublikasi, dengan fixture API terisolasi bila perlu; hasilnya harus ditambahkan terpisah.

## Publication and deployed verification

- Feature commit **`dae9023e14a43831cf71040af4eb0833e9f55b5f`** pushed ke `origin/feat/roblox-login-checkout-recovery`. Deployment **`dpl_HoqGsjHAjjWuE2wgT92Un27psT8K`**, target Preview, **READY** dan commit SHA cocok: [immutable Preview](https://cloudy-pink-store-gal0mqzx7-jax-v12.vercel.app). Tidak mempromosikan Apps ke Production.
- Pemilik memberikan persetujuan task+target main untuk fix cron saja. Managed worktree terpisah dari origin/main menerima cherry-pick dua file identik dengan commit reviewed `a5bd268`: **`cad2e6ca9eb1fffe74a3df1d01cf3f15041bbeeb`** dipush fast-forward ke main. Deployment **`dpl_z8JMZrpARsoZ5hQC1PRb8Tncnauo`**, **READY**, SHA cocok dan alias **`https://cloudy-pink-store.vercel.app`** terverifikasi. Worktree sementara telah diarsipkan secara recoverable.
- [Run cron #12](https://github.com/Jax-v12/cloudy-pink-store/actions/runs/39292455442) pada main cad2e6c **SUCCESS**, 15 detik, **workflow_dispatch** (bukan scheduled event). GitHub secret/origin yang ada berhasil dipakai oleh runner. Screenshot `cron-success.jpg` tersimpan di cache QA.
- Post-run read-only: heartbeat fulfillment `2026-10-19T17:14:58.895Z` (20 Oktober 00:14:58 WIB), **0 expired pending** dan **0 expired Login secrets**. Ini membuktikan backlog expired yang diperiksa sudah kosong, bukan klaim jumlah purge nonzero atau bukti lima menit cadence. Tidak membuat transaksi baru atau melakukan provider charge/expire/refund.
- HTTP nyata pada Preview: **8 PASS** — katalog Apps/Roblox sukses; admin products/metrics/review tanpa sesi 401; invoice yang tidak sah dan preferensi reminder tanpa token 404; cron reminder tanpa secret 401. Apps aktual tetap **0 produk**, Roblox **2 produk**; tidak mengisi data contoh.
- HTML private: **2 PASS** — `/admin/apps` dan invoice sintetis nonexisting memiliki noindex metadata serta X-Robots-Tag. Tidak membaca invoice pelanggan atau mengklaim UI tanpa token sebagai akses data.
- Renderer Preview terautentikasi menggunakan local-development OIDC hanya sebagai header origin yang sama, tanpa pull file env, perubahan proteksi, atau token di URL/output. **9 PASS** = ID/EN/MY × 375×812, 810×1080, 1440×900 untuk consent/stop/unavailable, tidak menyimpan nomor di browser storage, antrean review, agregat, dan no overflow. Seluruh API writes pada skenario ini fixture terisolasi: 2 preference writes dan 1 review write per case, **0 write remote** dan **0 pesan nyata**. Screenshot/result di `.cache/operations-20261019/browser/`.
- Satu tambahan harness OIDC serta hasil akhir dokumen ini disimpan lokal setelah commit publikasi; tidak mengubah source aplikasi yang sudah diuji/dipublikasikan atau memicu deployment kedua hanya untuk bukti.

## Pengukuran halaman publik

Satu observasi browser terisolasi per halaman/viewport, cache context baru, tanpa CPU/network throttling dan tanpa request tulis. F2 dan dae masing-masing diuji di deployment immutable terproteksi dengan origin-scoped OIDC. Ini **bukan field p75**, eksperimen terkontrol, atau bukti persentase peningkatan.

| SHA | Halaman | Lebar | TTFB ms | LCP ms | CLS | Transfer resource bytes |
| --- | --- | --- | --- | --- | --- | --- |
| f2efd0c | Apps | 375 | 27 | 1164 | 0.0008 | 2565080 |
| dae9023 | Apps | 375 | 29 | 2176 | 0 | 740236 |
| f2efd0c | Apps | 1440 | 28 | 400 | 0.0004 | 2565080 |
| dae9023 | Apps | 1440 | 26 | 324 | 0.0006 | 763318 |
| f2efd0c | Roblox | 375 | 27 | 732 | 0.0698 | 713276 |
| dae9023 | Roblox | 375 | 31 | 640 | **0.1081** | 726059 |
| f2efd0c | Roblox | 1440 | 29 | 248 | 0.0318 | 713276 |
| dae9023 | Roblox | 1440 | 29 | 260 | 0.0490 | 736539 |

Tidak ada overflow pada delapan observasi. INP tidak dinilai tanpa rangkaian interaksi terkontrol. Apps mengirim resource lebih sedikit pada observasi ini, tetapi LCP mobile tidak konsisten; tidak mengklaim seluruh performa meningkat. **Follow-up P4:** telusuri sumber CLS Roblox mobile 0.1081 dengan attribution/layout-shift trace, terutama transisi lokasi/loading/kartu; jangan mengoptimalkan dari dugaan atau satu angka. RUM agregat tetap default nonaktif dan Preview tidak mencampur counter funnel dengan Production.

## Gate yang masih terbuka

WhatsApp tidak dapat diaktifkan karena pemilik belum memiliki provider/approved template; nomor/pesan nyata tidak dikumpulkan/dikirim. Retensi backup Aiven memerlukan login operator; pengiriman alert dan interval scheduled aktual GitHub setelah recovery belum terverifikasi. Satu manual success tidak menutup gate cadence lima menit/heartbeat 15 menit. Login/aktivasi nyata tetap mengikuti gate operasional tersebut. Harga, stok dan detail CapCut tetap mengikuti inventaris produk yang belum lengkap.

MySQL lokal yang dinyalakan task dihentikan secara graceful setelah kepemilikan PID/parent/listener diverifikasi. Database fixture dipertahankan; tidak drop database/hard-delete histori. Working tree pekerjaan OTP sebelumnya tetap ada di delapan file dan tidak masuk release Apps maupun main fix.
