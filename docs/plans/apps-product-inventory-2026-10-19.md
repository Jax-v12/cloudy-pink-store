# Inventaris Apps — keputusan pemilik, 19 Oktober 2026

Status: **DRAFT / belum dijual oleh implementasi ini**. Dua paket berikut berasal dari jawaban pemilik dalam sesi, bukan contoh kompetitor. [Roadmap](../../plan.md#benchmark--roadmap-peningkatan--19-oktober-2026) mendahulukan data produk nyata sebelum publikasi.

| Aplikasi / paket | Jenis akun | Masa aktif | Garansi | Harga | Pengiriman / aktivasi | Stok | Perangkat / region |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CapCut Pro Private 1 bulan | Private | 1 bulan; definisi kalender/nominal hari perlu dikonfirmasi sebelum mengisi `durationDays` | 25 hari | Belum diberikan | Pemilik belum mengetahui metode | Belum diberikan | Belum diberikan |
| CapCut Pro Private 7 hari | Private | 7 hari | 7 hari, sesuai klarifikasi pemilik | Belum diberikan | Pemilik belum mengetahui metode | Belum diberikan | Belum diberikan |

Nama paket tersedia sebagai pengisi awal form admin `/admin/apps`. Tidak ada produk/stok/harga rekaan, remote seed, atau klaim metode aktivasi yang dibuat. Form mendukung draft tidak aktif dengan harga belum diisi; detail terstruktur harus lengkap sebelum mengaktifkan penjualan baru melalui pengelola Apps.

Data yang masih diperlukan: harga setiap SKU, arti tepat satu bulan, batas perangkat/region dan penggunaan, isi paket/panduan, ketentuan klaim, dan keputusan akun siap pakai versus aktivasi. Jika memakai stok akun, operator memasukkan stok asli melalui jalur admin terenkripsi yang sudah ada. Jika memakai aktivasi, pilih undangan/tautan/voucher yang memang didukung produk. Jangan meminta password pelanggan generik.

Garansi dan masa aktif adalah dua hal berbeda. Perubahan kebijakan setelah pembelian tidak memperbarui snapshot pesanan lama. Untuk produk siap pakai, garansi mulai saat pembayaran terverifikasi; untuk aktivasi, mulai pada periode layanan yang terkonfirmasi. Perpanjangan aktivasi membeli pesanan baru, menjaga akhir periode sebelumnya, dan hanya satu penerus PENDING/PAID diperbolehkan dari satu pesanan sumber; perpanjangan berikutnya dimulai dari invoice penerus terbaru.
