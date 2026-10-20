# Penyelesaian roadmap — 20 Oktober 2026

Pemilik meminta seluruh pekerjaan tersisa dilanjutkan, lalu mengonfirmasi harga/durasi CapCut dan mengizinkan detail sementara untuk pengujian. Pekerjaan lama tidak dibangun ulang. Cabang kerja tetap `feat/roblox-login-checkout-recovery`; rilis main disiapkan pada managed worktree terpisah untuk menjaga pekerjaan lokal.

## Perubahan dan bukti baru

- Dua draft CapCut tersimpan di target terverifikasi `cloudy_staging`, `active=false`, stok nol, disertai CatalogAudit. Harga IDR 44.000/13.000; masa aktif 30/7 hari; garansi 25/7 hari. Usulan lain berlabel DRAF/USULAN. Harga MYR 1.000/300 sen dicatat dalam [inventaris](../plans/apps-product-inventory-2026-10-19.md); belum menjadi pembayaran Apps MYR.
- Review independen menemukan refresh cursor admin yang melewatkan ID 51–55 setelah insert lima pesanan. Refresh sekarang membangun ulang rantai cursor dari respons terbaru, dengan depth yang sudah dimuat dan jalur load-more tetap tersedia.
- Tombol retry OTP tersedia ketika REQUESTED dengan teks ID/EN/MY. Pesan menunggu tidak lagi mengklaim Telegram sudah terkirim hanya karena permintaan tersimpan.
- Klaim TRY notifikasi OTP permanen mencegah pengiriman paralel atau pengiriman ulang setelah hasil ambigu/ACK gagal. Hanya penolakan Telegram eksplisit yang mengizinkan attempt berikutnya, maksimal tiga. HTTP tetap di luar lock; 429, 5xx, timeout, dan respons invalid tidak dikirim ulang. Parser Telegram memeriksa JSON `ok` dan membatasi respons 16 KiB sesuai [kontrak resmi](https://core.telegram.org/bots/api#making-requests).
- Trace Preview dae9023 mengaitkan CLS **0,1081** ke footer yang awalnya berada di y=566 lalu terdorong oleh kartu katalog. Placeholder kini menyediakan ruang sebelum katalog dimuat, dengan breakpoint sama seperti kartu akhir. Pengukuran sesudah perubahan dilaporkan terpisah di bawah.
- Recovery Apps menghapus delivery kadaluwarsa/terminal di bawah lock Order, mempertahankan timestamp asli, dan menghapus seluruh nomor/persetujuan reminder dari salinan restore. Ini mencegah state backup lama mengulang pesan yang mungkin telah terkirim. Pengiriman setelah pemulihan memerlukan persetujuan/verifikasi baru; payment/job recovery tetap diperiksa operator sebelum aplikasi online.

## QA lokal dan pemulihan

- Unit baseline pada snapshot tanpa env: **216 PASS, 0 FAIL, 9 SKIP**. Empat test route baru kemudian PASS: 502, timeout, ACK-write failure, dan POST paralel tertahan. Total unit unik terbaru **220 PASS**; sembilan grup yang semula SKIP dijalankan terpisah dengan prasyarat nyata di bawah.
- Sembilan grup MySQL/HTTP/migrasi: **53 PASS, 0 FAIL, 0 SKIP** (termasuk subtest). MySQL/archive/removal awalnya dijalankan paralel pada DB fixture yang sama; satu assertion count terinterferensi insert grup lain. Commerce diulang sendiri dan PASS 18/18. Tidak mengubah assertion untuk menyembunyikan kegagalan.
- Dua tes upgrade lama awalnya memilih field client terbaru yang belum ada pada schema historis. Pemilihan diubah ke kolom historis aktual/`select id`, mempertahankan assertion FK dan preservasi data. Pengulangan pada dua database kosong baru PASS; regional migration juga PASS.
- Build production terisolasi dan TypeScript PASS. Lint source dan recovery helper PASS dengan satu warning `img` StoreShell yang sudah ada. Perubahan terakhir skeleton hanya menyamakan breakpoint; build Preview final tetap harus diverifikasi.
- Mutation test pada snapshot terpisah membalik guard klaim notifikasi. Test benar-benar gagal (`exit=1`), kemudian source snapshot dipulihkan; source workspace tidak dimutasi. Test normal OTP terbaru PASS 12/12.
- Integrasi recovery Apps MySQL PASS: tiga order fixture menguji delivery baru dipertahankan, delivery >72 jam/unpaid dihapus, semua kontak dikarantina, timestamp utuh, dan pemanggilan ulang idempoten. Ini fixture, bukan bukti purge provider.
- Backup terenkripsi 19 Oktober terbukti berisi schema sebelum migrasi Apps, sehingga tidak dipakai sebagai bukti restore baru. Backup baru 20 Oktober memakai AES-GCM, key DPAPI CurrentUser dan ACL owner/SYSTEM; tidak menulis SQL plaintext ke file.
- Restore SQL backup baru ke localhost `cloudy_test_ops_restore_current_20261020` PASS: **26 Order, 13 migrasi**, tabel Apps/Reminder/Metrics terbaca, aplikasi tetap offline, waktu layanan tidak diperpanjang. Backlog purge pada backup aktual nol; bukti purge nonzero berasal dari fixture terpisah.
- Backup baru memiliki deadline **27 Oktober 2026 22:15:11 WIB** dan task `CloudyOperationsBackupExpiry20261020` Ready/StartWhenAvailable. CheckOnly PASS; penghapusan pada deadline belum terjadi dan tidak diklaim telah terbukti.

## Observasi provider dan hambatan nyata

- Setelah pemilik login, Console Aiven menunjukkan service `mysql-26d9d666`, MySQL 8.4.8, paket Free-1-1gb, tiga backup full tanggal 18/19/20 Oktober pukul sekitar 02:37 UTC, lokasi do-blr1. Backup 16/17 Oktober yang terlihat sebelumnya sudah tidak tercantum: bukti rotasi daftar, **bukan jaminan durasi retensi pasti**.
- Dialog konfigurasi backup hanya menampilkan backup_hour=2 dan backup_minute=37, tanpa retensi. Fork service disabled. [Dokumentasi Aiven](https://aiven.io/docs/products/mysql/concepts/mysql-backups) menyatakan retensi tergantung plan; [Free tier](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier) tidak menyediakan forking/support dan [tabel plan](https://aiven.io/pricing/mysql) tidak memberi TTL backup Free yang pasti. Durasi maksimum, pemusnahan salinan/binlog, dan provider-native restore tetap belum terverifikasi. Tidak upgrade, menghapus backup, atau mengakses `defaultdb`.
- [Cron #13](https://github.com/Jax-v12/cloudy-pink-store/actions/runs/39311515017), [#14](https://github.com/Jax-v12/cloudy-pink-store/actions/runs/39338891499), [#15](https://github.com/Jax-v12/cloudy-pink-store/actions/runs/39354783601), [#16](https://github.com/Jax-v12/cloudy-pink-store/actions/runs/39381381641), [#17](https://github.com/Jax-v12/cloudy-pink-store/actions/runs/39419712626) adalah **scheduled SUCCESS** pada main setelah fix. Waktu WIB 02:30, 06:01, 08:40, 13:36, 19:05. Eksekusi otomatis kini terbukti; cadence lima menit tetap belum tercapai. Delivery alert operator belum dibuktikan.
- WhatsApp masih disabled: pemilik belum mempunyai provider dan meminta penjelasan Meta Cloud API. Pendaftaran bisnis/nomor/template dan entry credential aman memerlukan pemilik; tidak membuat akun beridentitas rekaan, menerima kontrak/biaya, mengumpulkan nomor pelanggan, atau mengirim pesan nyata.
- Pembayaran/aktivasi CapCut nyata dan Sandbox provider baru belum diuji. Tidak mengubah mode Midtrans, mengirim charge baru, mengaktifkan produk draft, atau menyebut fixture sebagai bukti provider.

## Publikasi dan QA deployment

Source fixes feature `dea2a6f`, lalu UI follow-up **`d0f3c3ab34f1a610920f757572d946739c876c93`**, sudah dipush. [Preview yang diuji](https://cloudy-pink-store-7au8syw4l-jax-v12.vercel.app), deployment `dpl_AfU9tsSgVsR66sAPK7wdgHFEi7j4`, READY dan SHA cocok.

QA pertama menemukan CLS tablet MY **0,4260** saat hidrasi: navigasi lebih panjang memindahkan kontrol ke baris berikutnya (+52 px), judul menambah baris (+40 px). Navigasi kini mempertahankan pola mobile sampai breakpoint lg dan judul MY diringkas. Review independen, TypeScript dan lint PASS. QA ulang **9 PASS / 0 FAIL**, ID/EN/MY × tiga ukuran wajib, katalog fixture diperlambat satu detik. Retry OTP bekerja melalui keyboard; tidak ada overflow; seluruh mutation diintersep.

| Lebar | CLS ID | CLS EN | CLS MY |
| --- | --- | --- | --- |
| 375 | 0 | 0,0355 | 0,0044 |
| 810 | 0 | 0,0039 | 0,0063 |
| 1440 | 0 | 0,0025 | 0,0041 |

Tablet MY pada skenario sama turun 0,4260 → 0,0063. Ini hasil lab, bukan field p75/INP atau bukti semua metrik meningkat.

- Main code merge **`606c9752bbe7999bb5b6fc8c95dc25780270d4a3`** memiliki tree aplikasi identik dengan feature d0f3c3a. [Production code deployment](https://cloudy-pink-store-1rgk4jb86-jax-v12.vercel.app), `dpl_8JaRku2fofwgxu3NpBdJD8AdFumc`, READY/SHA cocok. Alias [toko](https://cloudy-pink-store.vercel.app), team dan git-main terverifikasi. Publikasi dokumentasi sesudahnya tidak mengubah kode aplikasi.
- `AGGREGATE_METRICS_ENABLED=true` ditambahkan hanya pada **Production** sebelum build. Preview tetap nonaktif. HTTP Production **13 PASS**, termasuk halaman publik, katalog, penolakan akses admin/invoice/cron, dan penolakan event PAID dari client (400 sebelum counter ditulis). Apps publik tetap nol karena dua produk baru adalah draft tidak aktif.
- Renderer Production nyata **6 PASS** untuk Apps/Roblox × tiga ukuran: HTTP 200, tanpa page error/overflow, client mencoba mengirim VIEW. Metrics QA diintersep sehingga tidak mencampur counter uji dengan data operasional. Private noindex **2 PASS**. Counter organik/field INP menunggu trafik nyata; tidak mengarang konversi.
- [Cron #18](https://github.com/Jax-v12/cloudy-pink-store/actions/runs/39449971428), main 606c975, manual pascarilis, **SUCCESS 12 detik**, memakai runner cleanup/fulfillment/reminders terbaru. Read-only terpisah: heartbeat cleanup `2026-10-20T15:36:34.910Z`, fulfillment `15:36:35.551Z`, expired pending/secrets nol. Provider reminder disabled; bukan bukti WhatsApp terkirim atau cadence lima menit.
- Production belum memiliki `TELEGRAM_WEBHOOK_SECRET`; POST kosong menghasilkan **503 fail-closed**. OTP melalui admin web tersedia; autentikasi/kebijakan webhook dua arah serta uji provider tetap perlu diselesaikan operator. Tidak mengubah bot/provider atau mengirim pesan uji nyata.
- Sebelum disposal, seluruh digest kolom **26 Order** pada restore terbaru cocok dengan sumber. Dua salinan yang dibuat task (`cloudy_test_ops_restore_20261020`, `cloudy_test_ops_restore_current_20261020`) dihapus setelah **persetujuan target spesifik pemilik**; kedua schema dipastikan tidak tersisa. Backup terenkripsi/`cloudy_staging` dipertahankan. Fixture lain dan restore historis tidak dihapus.
- HTTP harness lokal dihentikan, lalu MySQL task dihentikan secara graceful setelah verifikasi PID/parent/listener loopback.

## Hambatan yang masih memerlukan pemilik/provider

1. Stok CapCut asli, metode pengiriman dan ketentuan final sebelum mengaktifkan penjualan. Harga MYR masih inventory-only; merchant/payment Apps MY belum tersedia.
2. Akun WhatsApp bisnis, nomor pengirim, template ID/EN/MY dan credential langsung di secret store. Tidak meminta secret melalui chat.
3. Scheduler yang benar-benar mencapai lima menit serta bukti alert sampai ke operator; GitHub schedule sekarang sukses tetapi masih berjarak beberapa jam.
4. Kepastian tertulis TTL/pemusnahan backup/binlog Aiven dan jalur provider-native restore yang tersedia pada plan tersebut; tidak membeli upgrade atau menyimpulkan jaminan dari tiga backup yang terlihat.
5. Konfigurasi/kebijakan Telegram webhook dan uji payment/aktivasi provider dengan data/recipient/scenario nyata yang disepakati.

Gate operasional Login/aktivasi/WhatsApp tetap terbuka. Publikasi tidak mengaktifkan produk draft, mode pembayaran live, pengiriman WhatsApp, atau pengumpulan secret customer baru.
