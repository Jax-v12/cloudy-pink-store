# Roblox: tiga metode

Halaman `/roblox` menampilkan tiga kartu layanan. Alur Gamepass pada `/roblox/[slug]`: pengantar tarif → username, slider nominal dan email → buat Gamepass serta kirim link → pilih QRIS → konfirmasi order. Invoice/pembayaran baru dibuat pada konfirmasi terakhir. Data tetap tersedia ketika kembali ke langkah sebelumnya selama halaman belum ditutup. Tab mendukung tombol panah, Home, dan End. Metode pada kartu katalog dibawa ke halaman paket melalui `?method=`. Teks tersedia dalam ID, EN, dan MY melalui LanguageContext.

## Katalog dan pengiriman

- Admin membuat varian untuk setiap metode: `GAMEPASS`, `GIFT_USERNAME`, atau `LOGIN`.
- Admin mengisi tarif dasar rupiah/Robux, batas maksimum, dan kelipatan slider. Total rupiah = ceil(harga dasar × nominal pilihan / Robux dasar), dihitung ulang server. Contoh tarif ilustrasi Rp7.000/50 Robux: pilihan 100 Robux menjadi Rp14.000. Tarif toko tetap berasal dari konfigurasi admin. Harga Gamepass dihitung oleh server dengan `ceil(units × 100 / 70)`; 100 Robux menghasilkan 143 Robux. Harga lama pada snapshot pesanan tidak diubah.
- Gamepass meminta username dan tautan Roblox. Panduan ilustrasi menjelaskan Creator Hub, pembuatan pass, Item for Sale, harga, dan tautan publik. Estimasi pending sekitar lima hari dimulai setelah pembelian pass, bukan sejak pembayaran QRIS.
- Username meminta username tanpa password. Pengiriman tetap manual melalui mekanisme gift/transfer yang dioperasikan admin; tidak ada bot atau Group Payout otomatis baru. Pemeriksaan kapasitas Roblox Plus tetap berlaku. Jangan menjanjikan pengiriman instan sebelum kelayakan penerima dipastikan.
- Login hanya meminta username dan email kontak. Admin mengoordinasikan pemenuhan berbantu setelah pembayaran. Aplikasi tidak meminta atau menyimpan password Roblox, kode backup, OTP, maupun cookie sesi; tidak ada tombol buka kredensial.
- Tombol cek username menampilkan identitas publik dan avatar jika tersedia. Checkout memeriksa ulang username serta pemilik/harga/status penjualan Gamepass. Hasil negatif menolak checkout. Gangguan Roblox menghasilkan metadata belum terverifikasi untuk pemeriksaan manual admin; bukan bukti akun valid.
- Admin mengambil pesanan berbayar secara atomik sebelum memproses dan menyertakan referensi sebelum penyelesaian. Gunakan Menunggu data pelanggan jika pelanggan perlu berpartisipasi, lalu Lanjutkan setelah siap.

## Migrasi dan aktivasi

1. Backup database dan uji pemulihannya sebelum penerapan di hosting.
2. Jalankan `npx prisma migrate deploy` untuk migrasi `202610030001_roblox_methods` dan `202610030002_gamepass_quantity`, kemudian `npx prisma generate` dan build/restart aplikasi. Migrasi menambah metadata identitas/pemeriksaan Gamepass dan menghitung ulang harga varian Gamepass; tidak mengubah pesanan historis.
Migrasi slider menambah `maxUnits` dan `unitStep`. Tarif Gamepass lama dengan nominal kelipatan 5 mendapat rentang sampai setidaknya 5.000 Robux, dibatasi agar total rupiah tetap muat pada integer; nominal dasar yang lebih besar dipertahankan. Paket lama yang tidak sesuai kelipatan 5 tetap berupa nominal tetap sampai dikonfigurasi admin. Tidak ada perubahan snapshot pesanan historis.

3. Ikuti [aktivasi-topup.md](aktivasi-topup.md) untuk flag `ROBLOX_CHECKOUT_ENABLED`, paket, dan cron. UI tetap dapat dilihat ketika pemesanan dinonaktifkan.

## Pengujian

`npm test` menjalankan pengujian unit. Integrasi memerlukan `TEST_DATABASE_URL` pada MySQL localhost dengan nama `cloudy_test_*`. Tidak boleh menunjuk database aplikasi.

Untuk pengujian HTTP sesudah build, jalankan `node tests/start-http-server.mjs`, lalu jalankan tes dengan `TEST_BASE_URL=http://127.0.0.1:3112` dan `TEST_DATABASE_URL` yang sama. Harness mengikat localhost, menggunakan kredensial dummy, menyimulasikan API Roblox dan memblokir permintaan ke provider eksternal. Tidak melakukan transaksi pembayaran nyata.

Cakupan: pembulatan pajak, pemilik Gamepass, Item for Sale, harga, username tidak ditemukan, gangguan API, penolakan input rahasia Roblox, penghapusan rahasia lama, filter antrean, transisi admin, token invoice, CSRF, serta checkout/pengiriman Apps yang sudah berjalan.

## Referensi alur

- [Mayoblox — pilihan jenis Robux](https://mayoblox.com/robux): referensi urutan pemilihan layanan; tidak menyalin merek atau aset.
- [Roblox Creator Hub — Passes](https://create.roblox.com/docs/production/monetization/passes): pembuatan pass dan pengaktifan penjualan.
- [Roblox — Regional pricing](https://create.roblox.com/docs/production/monetization/regional-pricing): harga regional dapat mengubah nominal pembelian; panduan mengingatkan untuk menonaktifkannya.

## Validasi 3 Oktober 2026

Migrasi berhasil diterapkan ke database aplikasi setelah backup privat di luar repository berhasil dipulihkan dan dimigrasi pada MySQL terisolasi. Seluruh 21 tes unit/integrasi/HTTP, validasi Prisma, lint, TypeScript, dan build produksi lulus. API publik username serta product-info Gamepass juga diverifikasi dapat diakses. Pengujian visual dan interaksi keyboard di browser belum dijalankan karena alat browser gagal memulai; markup halaman dan endpoint diuji melalui HTTP.

## Alur slider — 4 Oktober 2026

Halaman awal kini memakai tiga kartu metode. Gamepass memakai wizard lima langkah; nominal dipilih dengan slider/input angka sebelum pelanggan membuat Gamepass dan memasukkan link. Draft tetap di memori halaman dan belum membuat order sebelum konfirmasi. Admin mengatur tarif dasar, maksimum, dan kelipatan.

Migrasi slider diterapkan ke database aplikasi setelah backup privat berhasil dipulihkan dan diuji pada MySQL terisolasi. Typecheck, lint, validasi Prisma, build Next.js, dan seluruh 24 tes lulus. Tes meliputi tarif proporsional, pembulatan IDR, penolakan nominal di luar batas, snapshot pesanan dan idempotensi. Pengujian visual browser masih belum tersedia karena alat browser gagal memulai.

## Pemenuhan berbantu — 4 Oktober 2026

Ruang pengiriman kini menyediakan filter metode Roblox, pembayaran, dan status pemenuhan; pencarian invoice, username, atau email; pagination; serta ringkasan sesuai filter. Diagnostik worker berada di bagian sekunder. Semua teks baru tersedia dalam ID/EN/MY.

Migrasi `202610040001_assisted_login` menghapus ciphertext Roblox lama dan mencatat audit. Pesanan berbayar yang memiliki rahasia lama dan masih QUEUED/PROCESSING beralih ke WAITING_CUSTOMER; status pembayaran, invoice, stok Apps, dan pekerjaan pengiriman tetap dipertahankan. Tabel lama dipertahankan untuk kompatibilitas cleanup, tetapi checkout baru tidak menulis rahasia.

Saat deploy: hentikan versi aplikasi lama agar tidak menulis kredensial lagi, backup privat dan uji restore, jalankan `npx prisma migrate deploy`, kemudian jalankan versi baru. Jangan membuka kembali versi lama yang masih menerima password. Migrasi sudah diuji pada MySQL terisolasi; penerapan ke database hosting dilakukan bersamaan dengan deploy versi baru.

Validasi perubahan ini: seluruh 25 tes unit/integrasi MySQL/HTTP lulus, Prisma validate, lint, typecheck, serta build produksi lulus. Migrasi baru diterapkan dan diuji pada database localhost terisolasi; belum diterapkan ke database hosting. Pengujian visual browser belum dijalankan.
