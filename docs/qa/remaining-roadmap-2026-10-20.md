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

Menunggu commit source final, Preview dengan SHA cocok, QA renderer/CLS, lalu rilis main ke proyek Vercel yang sama. Flag metrics disiapkan hanya untuk Production; Preview tetap nonaktif karena database dipakai bersama. Gate Login/aktivasi/WhatsApp yang belum terpenuhi tetap terbuka walaupun source dipublikasikan.
