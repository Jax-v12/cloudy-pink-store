# Cara mengaktifkan top-up

## Roblox

1. Di environment server/hosting, tambahkan `ROBLOX_CHECKOUT_ENABLED=true`. Jika memakai reverse proxy, isi `APP_ORIGIN` dengan alamat utama toko, misalnya `https://toko.example.com`. Gunakan alamat toko sendiri, tanpa path tambahan.
2. Restart aplikasi atau redeploy agar environment baru terbaca.
3. Masuk ke `/admin`, lalu buka **Ruang pengiriman · Katalog top-up**. Pada tab **Katalog top-up**, buat produk dengan jenis Roblox, nama, dan slug; centang **Aktif**.
4. Klik **Paket baru** pada produk. Isi nama paket, harga dalam rupiah, jumlah Robux yang diterima pelanggan, dan metode. Centang **Aktif**, lalu simpan.
5. Untuk Gamepass, isi juga harga Gamepass yang akan dibeli. Nilai ini berbeda dari harga rupiah dan target Robux bersih pelanggan.
6. Untuk Username, cek langganan Roblox Plus, saldo, batas transfer, dan antrean pesanan. Centang konfirmasi kapasitas ketika mengaktifkan paket. Konfirmasi perlu diperbarui maksimal setiap 24 jam. Nonaktifkan paket jika kapasitas habis.
7. Pelanggan dapat memesan di `/roblox`. Setelah pembayaran, buka tab **Ruang pengiriman**, klik **Ambil pesanan**, lakukan pengiriman, isi referensi, lalu **Konfirmasi pengiriman** setelah berhasil.

Untuk transfer Username yang belum diterima, pilih **Tunggu pelanggan**. Untuk Login, pelanggan memasukkan username, password, dan lima kode backup. Admin harus mengambil pesanan dan memverifikasi ulang password admin sebelum membuka kredensial. Password/kode dihapus setelah selesai atau maksimal tujuh hari.

## Games

**Versi saat ini belum bisa menjual top-up Games sungguhan.** Katalog dan formulir sudah tersedia, tetapi provider nyata belum dipilih dan dihubungkan. Mengubah environment saja tidak dapat membuka checkout Games di produksi.

Untuk mencoba di komputer pengembangan:

1. Isi `GAME_PROVIDER=simulator` pada `.env` lokal.
2. Jalankan `npm run dev`, bukan server produksi. Simulator tidak bekerja dengan `NODE_ENV=production`.
3. Di `/admin/commerce` → **Katalog top-up**, buat produk jenis Game dan aktifkan.
4. Buat paket: isi harga rupiah, jumlah unit, SKU provider untuk simulasi, dan centang **Memerlukan Zone ID** jika diperlukan. Aktifkan paket.
5. Coba melalui `/games`. Simulator hanya menyimulasikan hasil pengiriman; tidak mengirim saldo atau item ke akun game. Checkout masih menggunakan Midtrans, jadi gunakan konfigurasi sandbox saat pengujian.

Untuk penjualan nyata, pilih provider, sediakan dokumentasi/sandbox, implementasikan API pengiriman dan pengecekan status pada adapter, lalu uji timeout serta pengiriman berulang sebelum membuka checkout produksi.

## Cron dan pembayaran

Pastikan environment Midtrans dan URL webhook `/api/webhook/payment` benar. Pada scheduler hosting, panggil kedua endpoint berikut setiap menit menggunakan header `Authorization: Bearer <CRON_SECRET>`:

- `/api/cron/cleanup`: memeriksa pembayaran kedaluwarsa dan melepaskan stok Apps yang sesuai.
- `/api/cron/fulfillment`: menjalankan pekerjaan Games dan menghapus kredensial yang melewati masa simpan.

Scheduler belum otomatis dibuat oleh kode ini. Periksa indikator worker di ruang pengiriman setelah scheduler aktif.

## Login admin

Pada 3 Oktober 2026, kegagalan login ditemukan karena database belum memiliki kolom baru `AdminSession.reauthenticatedAt`. Database sudah dibackup, backup berhasil dipulihkan pada database pengujian, lalu migrasi diterapkan ke database aplikasi.

Gunakan nilai `ADMIN_PASSWORD` dari environment server yang menjalankan aplikasi. Setelah mengubah environment, restart/redeploy aplikasi. Jika mendapat pesan terlalu banyak percobaan, tunggu sampai jendela pembatasan 15 menit berakhir. Pesan login sekarang membedakan password salah, pembatasan percobaan, database belum dimigrasi, ketidakcocokan `APP_ORIGIN`, serta kegagalan menyimpan cookie sesi.

Panduan migrasi dan operasi lebih lengkap tersedia di [commerce-rollout.md](commerce-rollout.md).
