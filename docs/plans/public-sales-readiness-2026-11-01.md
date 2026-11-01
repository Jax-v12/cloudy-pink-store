# Persiapan penjualan publik — 1 November 2026

Keputusan terbaru pemilik: **siapkan untuk penjualan nyata; aktivasi menunggu semua syarat siap**. Ini menggantikan pilihan tahap demo dalam rencana 31 Oktober. Mode demo tidak ditambahkan. Tujuan belum selesai selama bukti operasional di bawah belum terpenuhi; keberhasilan build atau tampilan tidak menutup syarat pembayaran, stok, delivery, dan recovery.

Pemilik kemudian mengizinkan rilis paket 14 file/bagian melalui commit/push `main` ke Vercel Production yang sudah ada. Izin ini mencakup kode/dokumentasi; update katalog, database, payment-mode dan transaksi tetap terpisah. Identitas target dan status publikasi dicatat pada [laporan QA](../qa/public-sales-readiness-2026-11-01.md#publication-authorization--1-november-2026).

Persiapan lokal berlangsung di `main`, baseline `ac09f90178b5834b76112f6f62ccdbc3d0b96eec`. Perbaikan metadata/invoice/admin yang dahulu disebut belum dirilis sudah tercatat dipublikasikan pada 31 Oktober di roadmap dan QA masing-masing. Pemeriksaan HTTP baru membuktikan sitemap publik berisi lima URL; jangan memakai temuan sitemap kosong lama sebagai kondisi sekarang. Identitas deployment tidak diperiksa ulang melalui control plane pada task ini.

## Kesiapan dan tindakan berikutnya

| Area | Kondisi dan bukti | Syarat sebelum aktivasi penjualan nyata |
| --- | --- | --- |
| Tampilan dan interaksi | Beranda, katalog Apps, detail Apps, invoice pending/paid/completed, serta tiga wizard Roblox diperiksa dengan API sintetis dalam ID/EN/MY dan ukuran 375×812, 810×1080, 1440×900. Pink/Anya dan navigasi yang sudah disetujui dipertahankan. | Rilis hanya perubahan yang telah direview, lalu smoke ulang deployment yang SHA-nya cocok. Bukti ini tidak membuktikan katalog atau delivery nyata. |
| Halaman pemulihan | Persiapan lokal menambahkan 404 berdesain toko, tautan beranda/bantuan, dan fallback error dengan coba lagi. Detail error internal tidak ditampilkan. | Verifikasi retry nyata di error boundary dan publikasikan hanya setelah izin rilis. Error root layout tetap memerlukan penanganan framework; jangan mengklaim semua kegagalan browser/jaringan tertangani. |
| Metadata dan bantuan | GET publik homepage/Apps/Roblox/help/privacy/robots/sitemap berhasil; sitemap memiliki lima URL dan robots mengiklankannya. HSTS dan nosniff terpasang. | Informasi produk dan kontak harus sesuai operasi yang benar-benar tersedia. Domain khusus opsional; perubahan domain/konfigurasi perlu izin tersendiri. |
| Ketentuan CapCut | Pemilik mengonfirmasi final pada 1 November; konfigurasi draf lokal diperbarui. [Ketentuan dan batas](apps-product-inventory-2026-10-19.md). | Terapkan ke dua SKU yang tepat melalui update katalog berizin, tinjau ringkasan sebelum pembayaran, dan pertahankan snapshot pesanan lama. Konfirmasi ketentuan bukan izin mutasi remote. |
| Stok dan hak akses Apps | API publik saat pemeriksaan menampilkan `capcut-pro-private-7-hari`, `stockAvailable: 1`, `checkoutEnabled: true`. Stok tidak dibuka; kualitas dan hak aksesnya belum diketahui. Paket 30 hari tidak tampil pada respons tersebut. | Verifikasi entitlement/region serta stok akun sah lewat operator. Gunakan jalur admin terenkripsi; jangan mengisi kredensial melalui chat/dokumen/fixture. Angka stok publik bukan bukti akun berfungsi. |
| Roblox | API publik menampilkan Gamepass, Username, dan Login dengan checkout aktif. Sumber membedakan PAID dari delivery; wizard diuji dengan fixture. | Pastikan operator, kemampuan fulfillment, klaim/antrean dan penanganan gagal untuk setiap metode yang dijual. Login memerlukan penutupan gate retensi/restore sebelum menerima rahasia pelanggan asli. |
| Pembayaran nyata | Bukti pembayaran yang tersedia sebelumnya adalah Midtrans Sandbox. Task ini tidak membaca key/mode akun atau melakukan charge. | Operator memastikan merchant dan kanal aktif, endpoint/key/webhook cocok, serta payout/refund dapat digunakan. Perubahan payment-mode/credential dan transaksi memerlukan izin task+target baru. |
| OTP Apps | Kode menyediakan permintaan dari invoice berotorisasi, notifikasi metadata ke tim, serta jawaban melalui jalur OTP yang ada. Tidak ada pesan tim/provider dikirim pada task ini. | Uji operasional permintaan → tim menerima → kode tersedia pada invoice dengan akun dan skenario berizin. Tidak menjanjikan pengiriman instan atau batas waktu respons yang belum ditetapkan. |
| Backup dan Login | Aiven retention/restore tetap belum terverifikasi dan sebelumnya ditunda. | Bukti retensi finite, akses backup terbatas, restore teruji dan purge pascarestore. Backup saja bukan bukti recovery. Akses Aiven/DB remote belum diizinkan. |
| Monitoring dan SOP | Panduan operasional admin sudah ada. Bukti scheduler cron-job.org dan email gagal/pulih berasal dari task terdahulu. | Operator memastikan penanggung jawab antrean/support/refund dan memeriksa kesehatan scheduler sebelum aktivasi. Tidak ada perubahan scheduler atau klaim pemeriksaan baru pada task ini. |
| Dependency | Audit produksi saat ini nol temuan. Audit lengkap melaporkan 16 paket tooling terdampak satu advisory moderate `minimatch`; tidak ada temuan high/critical. | Tinjau patch kompatibel sebelum perubahan dependency. Jangan menjalankan auto-fix yang menyarankan downgrade besar. Ini risiko tooling, bukan bukti eksploitasi endpoint toko. |

## Ketentuan CapCut yang telah disetujui

| Ketentuan | CapCut Pro Private 7 hari | CapCut Pro Private 30 hari |
| --- | --- | --- |
| Perangkat | 1 | 1 |
| Penggunaan | Jangan ubah sandi atau memberikan akses kepada orang lain | Sama |
| Garansi | 7 hari | 25 hari |
| Refund | Jika akun sama sekali tidak bisa digunakan; ditangani tim | Sama |
| Pengiriman | Username/password di invoice setelah pembayaran terverifikasi; tekan Dapatkan Kode OTP untuk permintaan ke tim | Sama |

Jangan menambahkan pengecualian garansi, kecepatan respons, refund otomatis, atau aturan lain yang tidak diberikan pemilik. Harga pada inventaris adalah keputusan terdahulu dan tidak diubah pada task ini. MYR/PHP tetap bukan metode pembayaran yang diaktifkan.

## Rancangan update katalog yang dapat ditinjau

Pencocokan GET katalog publik setelah konfirmasi pemilik menemukan empat field paket tujuh hari belum sama dengan ketentuan lokal: `devices`, `usageRules`, `instructions`, `warrantyTerms`. Jenis akun, masa aktif dan angka garansinya sudah sama. Paket 30 hari tidak ada pada respons publik; ini tidak membuktikan record-nya hilang atau boleh dibuat ulang. Region dan entitlement masih perlu bukti.

Kontrak admin `POST /api/admin/apps/products` menyimpan objek produk lengkap, bukan partial PATCH. Setelah izin task+target diberikan, baca record APPS yang tepat melalui admin berotorisasi, termasuk halaman berikutnya/inaktif; cocokkan slug tujuh hari dan `capcut-pro-private-1-bulan` untuk paket 30 hari. Gunakan `id` dan `updatedAt` terbaru dari record itu. Pertahankan nama/slug/harga/kategori/active dan field config yang tidak disetujui berubah; gabungkan hanya ketentuan yang telah dikonfirmasi dengan durasi/garansi paket yang tepat. Jangan mengirim JSON draf ini langsung sebagai request body. Jika record berubah, server menolak dengan 409; baca ulang dan tinjau, jangan melewati pemeriksaan tersebut. Jangan membuat ulang SKU 30 hari atau mengaktifkannya hanya karena tidak tampil publik.

Validasi lokal `parseAppsConfig` menerima kedua konfigurasi lengkap hasil penggabungan draf dengan durasi/garansi 7/7 dan 30/25. Preview browser ketentuan memakai konfigurasi tersebut dengan stok sintetis, bukan data akun operasional. Perubahan ketentuan katalog menghasilkan policy token baru; checkout dengan konfirmasi lama ditolak, dan snapshot pesanan lama dipertahankan oleh jalur checkout yang sudah ada. Pembaruan stok, availability dan aktivasi pembayaran tetap keputusan/izin terpisah.

## Urutan menuju aktivasi

1. Selesaikan QA dan review paket lokal; dokumentasikan bukti dan batasnya.
2. Dengan izin rilis yang menyebut target: stage allowlist eksplisit, commit/push `main`, tunggu Vercel SHA sama/READY/alias dan smoke baca-saja. Rollback kode ke rilis sebelumnya yang telah diverifikasi; tidak ada migration pada paket ini.
3. Dengan izin katalog/data yang menyebut target: terapkan ketentuan hanya ke dua SKU CapCut dan siapkan stok sah melalui admin. Verifikasi tampilan dan snapshot ketentuan tanpa mengubah invoice lama.
4. Tutup gate merchant/payment, retensi/restore, fulfillment dan operasional. Jalankan transaksi end-to-end terbatas hanya setelah skenario/nominal/target disetujui; operator melakukan tindakan uang nyata.
5. Aktifkan/promosikan penjualan setelah semua layanan yang akan dijual punya bukti pembayaran, invoice, delivery dan penanganan gagal/refund yang sesuai. Layanan yang belum siap memerlukan keputusan availability tersendiri.

Persiapan ini **tidak menutup checkout yang sudah tersedia** pada situs publik. Menunggu aktivasi pada goal ini tidak berarti konfigurasi Production saat ini telah diblokir. Tidak ada commit/push/deploy, mutasi DB/katalog, perubahan environment/payment-mode/scheduler atau transaksi pada task ini.
