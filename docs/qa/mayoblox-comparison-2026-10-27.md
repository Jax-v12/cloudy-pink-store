# Mayoblox vs Cloudy Pink Store — 27 Oktober 2026

## Kesimpulan

Mayoblox lebih cepat mengarahkan pengunjung ke pembelian Roblox: tombol top-up/cek pesanan dan kartu metode terlihat lebih awal, katalog lebih luas, serta tutorial berada dekat formulir. Cloudy sudah memiliki fondasi alur pembelian, bantuan, dan perbandingan metode. Prioritasnya adalah ketersediaan layanan serta penataan informasi, bukan membangun ulang checkout.

Ini penilaian UX berdasarkan observasi, bukan pengukuran conversion rate atau audit keamanan kedua layanan.

## Sumber dan batas pemeriksaan

- Browser nyata pada [Mayoblox](https://www.mayoblox.com/) dan [Cloudy publik](https://cloudy-pink-store.vercel.app/), 27 Oktober 2026 WIB. REA tidak terhubung dan tidak digunakan; tidak ada instalasi REA.
- Homepage kedua situs diperiksa pada viewport 375×812, 810×1080, dan 1440×900. Lebar konten sedikit lebih kecil karena scrollbar. Screenshot awal Mayoblox setelah resize sempat belum stabil; diambil ulang setelah navigasi dan konfirmasi halaman.
- Cloudy: homepage, `/roblox`, Gamepass sampai detail informasi, Login sampai formulir akun kosong, `/apps`, dan `/help`.
- Mayoblox: homepage, Gamepass sampai detail informasi, Username sampai detail akun, Login sampai formulir akun kosong, dan pencarian pesanan.
- Kode lokal pendukung: branch `feat/roblox-login-checkout-recovery`, HEAD `c43407d`. Tidak memverifikasi SHA deployment; kode lokal dan situs publik tidak dinyatakan identik.
- Tidak memasukkan identitas/kontak/kredensial, membuat Order, membayar, mencari pesanan pelanggan, mengirim pesan, atau mengakses DB secara langsung. Navigasi/pemilihan paket dapat menjalankan perilaku sesi normal aplikasi; tidak dilakukan audit network untuk membuktikan nihil penulisan sesi.
- Payment, invoice berotorisasi, pengiriman aktual, kinerja lapangan, backend Mayoblox, serta seluruh matriks bahasa/keyboard tidak diuji. Tidak menjalankan regression/build karena tidak ada perubahan aplikasi.

## Perbandingan

| Aspek | Mayoblox yang terlihat | Cloudy yang terlihat | Implikasi |
| --- | --- | --- | --- |
| Fokus homepage | Hero dengan aksi top-up dan cek pesanan; pilihan layanan Roblox langsung menyusul | Banner, pengumuman Indonesia, pengenalan umum, kemudian tiga kategori layanan | Pertahankan Apps/Game/Roblox terpisah, tetapi bawa aksi pembelian lebih dekat ke awal |
| Visual | Ilustrasi kuat pada hero lalu area konten putih/pink ringan | Wallpaper Anya berulang di belakang hampir seluruh halaman, banyak panel besar | Pertahankan identitas Anya/pink sambil menenangkan latar area transaksi |
| Pemilihan metode | Kartu singkat dan mudah dipindai | Tiga kartu dengan kebutuhan, proses, waktu, dan harga; panjang pada mobile | Informasi Cloudy berguna, tetapi dapat disajikan bertahap dengan ringkasan awal |
| Gamepass | Pengenalan → detail akun/nominal → pembuatan Gamepass; slider dan catatan waktu | Pengenalan → detail → Gamepass → pembayaran → konfirmasi; slider dan penjelasan pending Roblox | Struktur Cloudy sudah memadai; tidak perlu mengejar jumlah langkah lebih sedikit tanpa mengukur friksi |
| Username | Halaman pembelian dan formulir nominal tersedia | Kartu menampilkan harga wilayah belum tersedia, tanpa tombol beli | Ketersediaan bisnis perlu diperiksa; UI saja tidak mengaktifkan metode |
| Login | Banyak paket, pengelompokan paket, indikator langkah, tutorial kode cadangan di formulir | Satu paket 160 Robux; formulir menyebut tujuan akses dan batas 72 jam, tetapi tidak menampilkan indikator langkah bernomor seperti Gamepass | Perjelas urutan paket → akun → konfirmasi dan berikan bantuan kontekstual |
| Bantuan | FAQ, formulir masalah dengan invoice, chat CS, tautan komunitas | FAQ/ketentuan/privasi serta WhatsApp | Perbaiki pintu bantuan sesuai produk dan pesanan sebelum menambah sistem chat baru |
| Pelacakan | Pencarian username/email atau invoice; Login dibatasi invoice | Input invoice dan kontrol Pesanan Saya | Permudah penemuan cek pesanan; jangan menyalin pencarian publik tanpa desain akses |
| Bukti kepercayaan | Testimoni, statistik, produk terjual, identitas pengelola ditampilkan | Tidak tampak blok bukti pelanggan/statistik di homepage yang diperiksa | Tampilkan bukti milik Cloudy yang dapat diverifikasi jika sudah tersedia |
| Produk lain | Item Roblox serta tautan layanan game lain | Apps Premium adalah kategori sendiri, tetapi katalog publik kosong pada pemeriksaan | Jangan mengganti/menghapus Apps; pastikan isi katalog sesuai layanan yang benar-benar dijual |

Statistik, testimoni, label keamanan, estimasi waktu, dan diskon Mayoblox adalah klaim yang ditampilkan situs. Keaslian maupun pencapaiannya tidak diverifikasi di sini.

## Temuan konkret

### 1. Jarak menuju pilihan layanan terlalu panjang pada mobile

Pada Cloudy `/roblox` dengan viewport 375×812 dan posisi halaman paling atas:

- Judul kartu Gamepass berada sekitar y=911 px.
- Tombol beli Gamepass sekitar y=1.430 px.
- Judul Login sekitar y=1.591 px; tombol belinya sekitar y=2.087 px.
- Judul Username sekitar y=2.248 px.

Mayoblox menampilkan keempat pilihan layanan dalam layar pertama setelah popup promosi ditutup. Perbandingan ini mencakup perbedaan tujuan halaman: homepage Mayoblox berfokus Roblox, homepage Cloudy merupakan portal beberapa layanan. Bahkan halaman khusus Roblox Cloudy masih mendahulukan banyak blok pengantar.

Usulan: ringkas pengantar, kurangi pengulangan pengumuman/lokasi saat kondisi normal, dan tampilkan tiga pilihan metode ringkas sebelum rincian kebutuhan/proses. Informasi ketersediaan, persyaratan, dan status lokasi tetap harus tersedia. Nav mobile horizontal dan posisi Hubungi Kami merupakan pengecualian desain yang telah diterima; bukan rekomendasi penggantian pada laporan ini.

### 2. Isi katalog merupakan hambatan nyata

Cloudy publik menampilkan satu paket Login 160 Robux seharga Rp27.200; Username belum tersedia; Apps menampilkan belum ada produk tersedia. Ini observasi UI, bukan diagnosis database atau bukti kegagalan API.

Mayoblox menawarkan banyak nominal Login, termasuk 160 Robux Rp31.400. Gamepass terlihat Rp7.000/50 Robux di Mayoblox dan Rp7.500/50 Robux di Cloudy. Angka ini snapshot harga tampilan, bukan perbandingan total akhir setelah biaya maupun kualitas pengiriman. Jangan mengubah harga Cloudy hanya agar mengikuti pesaing.

Usulan: pemilik menentukan paket/rate dan layanan yang siap dioperasikan; kemudian cek konfigurasi katalog melalui akses yang disetujui. Jangan membuat produk/stok sintetis untuk memperindah halaman publik.

### 3. Login perlu panduan dekat formulir

Mayoblox menampilkan langkah mendapatkan kode cadangan dan tombol video pada halaman akun. Cloudy menjelaskan lima kode cadangan dan larangan OTP, tetapi halaman yang diperiksa tidak menyediakan panduan pembuatan kode yang setara. Pengantar Cloudy juga menyebut informasi kontak, padahal langkahnya meminta akses akun.

Usulan: pengantar yang menyebut kebutuhan akses secara jelas, indikator tiga tahap, serta bantuan kode cadangan yang dapat dibuka tanpa meninggalkan draf. Pertahankan penjelasan tujuan akses/retensi dan seluruh kontrol yang ada. Fitur upload screenshot kode cadangan Mayoblox tidak sesuai aturan Cloudy dan tidak termasuk usulan.

### 4. Bantuan masih terasa untuk Apps pada halaman Roblox

Tautan WhatsApp Cloudy di halaman Roblox dan help menggunakan pesan pembuka mengenai akun premium. Itu kurang sesuai konteks pembeli Robux.

Usulan: pesan pembuka sesuai area layanan, dengan ajakan menyiapkan nomor invoice dan kendala. Jangan otomatis menyertakan rahasia atau data akun. FAQ singkat terkait metode dapat ditempatkan dekat pilihan/checkout; halaman `/help` yang sudah ada tetap digunakan.

### 5. Pertahankan kekuatan informasi Cloudy

Cloudy sudah menjelaskan persyaratan setiap metode, membedakan pembayaran dengan pengiriman, menyediakan FAQ dan ketentuan, serta menampilkan informasi akses akun pada formulir Login. Kode lokal `OrderProgress.tsx` dan `orderNotice.ts` menyediakan tahapan pembayaran/antrean/proses/selesai; invoice nyata tidak dibuka untuk membuktikan rendering dan operasi deployment.

Mayoblox punya popup promosi yang menutupi awal kunjungan. Menirunya tidak diperlukan. Menambah leaderboard, multi-cart, live-chat, atau janji waktu pengiriman juga bukan prioritas tanpa kebutuhan dan dukungan operasional.

## Urutan pekerjaan yang disarankan

1. **P0 — Kesiapan katalog:** tentukan status Username, paket Login, dan Apps yang benar-benar tersedia. Ini keputusan operasional; tidak diubah pada analisis ini.
2. **P1 — Tampilan awal:** ringkas hero dan kartu metode; targetkan semua metode dapat ditemukan lebih cepat pada mobile. Pertahankan identitas toko dan semua journey.
3. **P1 — Panduan pembelian:** indikator Login, bantuan kode cadangan, serta copy bantuan sesuai layanan. Reuse wizard dan komponen yang sudah ada.
4. **P2 — Kepercayaan dan bantuan:** tampilkan informasi proses, kebijakan, dan bukti pelanggan autentik bila tersedia. Ukur kebutuhan chat/tiket sebelum membangunnya.

Kriteria verifikasi implementasi berikutnya: tiga metode tetap ada; pemilihan paket dan back tetap aman; tidak ada Order akibat perpindahan langkah; harga dari konfigurasi server; ID/EN/MY konsisten; cek viewport 375×812, 810×1080, 1440×900; empty/loading/error/disabled serta keyboard diperiksa. Publikasi dan perubahan katalog remote memerlukan scope tersendiri.

## Bukti lokal

Screenshot disimpan di `.cache/mayoblox-comparison-20261027/`:

- `cloudy-home-375.png`, `mayoblox-home-375.png`
- `cloudy-home-810.png`, `mayoblox-home-810.png`
- `cloudy-home-1440.png`, `mayoblox-home-1440.png`
- `cloudy-roblox-375.png`, `cloudy-login-desktop.png`

Pada pengukuran homepage yang dilakukan, lebar dokumen tidak melampaui lebar viewport konten. Ini bukan sertifikasi aksesibilitas atau uji overflow seluruh halaman/state. Tidak ada klaim seluruh UX lulus.

Referensi implementasi yang dibaca: `src/app/page.tsx`, `src/components/StoreShell.tsx`, `RobloxServiceCards.tsx`, `RobloxCheckoutWizard.tsx`, `RobloxGamepassGuide.tsx`, `LoginFlow.tsx`, dan `OrderProgress.tsx`.

Analisis menghasilkan dokumen ini dan screenshot lokal. Tidak ada perubahan kode aplikasi, katalog, konfigurasi, commit, push, atau deployment.
