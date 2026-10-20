# Inventaris Apps — keputusan pemilik, 19 Oktober 2026

Status: **DRAFT / belum dijual oleh implementasi ini**. Dua paket berikut berasal dari jawaban pemilik dalam sesi, bukan contoh kompetitor. [Roadmap](../../plan.md#benchmark--roadmap-peningkatan--19-oktober-2026) mendahulukan data produk nyata sebelum publikasi.

| Aplikasi / paket | Jenis akun | Masa aktif | Garansi | Harga | Pengiriman / aktivasi | Stok | Perangkat / region |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CapCut Pro Private 1 bulan | Private | **30 hari**, dikonfirmasi pemilik 20 Oktober | 25 hari | **Rp44.000 / RM10** | Usulan akun siap pakai untuk draft pengujian; metode nyata belum dikonfirmasi | **0**, tidak membuat akun contoh | Usulan satu perangkat; region belum diverifikasi |
| CapCut Pro Private 7 hari | Private | 7 hari | 7 hari, sesuai klarifikasi pemilik | **Rp13.000 / RM3** | Usulan akun siap pakai untuk draft pengujian; metode nyata belum dikonfirmasi | **0**, tidak membuat akun contoh | Usulan satu perangkat; region belum diverifikasi |

Pada 20 Oktober pemilik mengizinkan pengisian data sementara untuk pengujian. Kedua SKU disimpan secara atomik sebagai **draft tidak aktif** di `cloudy_staging`, disertai audit dan tanpa stok. Harga IDR tersimpan di Product; harga MYR **baru dicatat dalam inventaris**, karena checkout Apps saat ini hanya IDR. Tidak ada pembayaran Malaysia yang diaktifkan. Rincian usulan tersedia di [data draft](capcut-drafts-2026-10-20.json); semua bagian belum terverifikasi diberi label DRAF/USULAN dan harus ditinjau sebelum penjualan.

Data yang masih diperlukan sebelum dijual: konfirmasi batas perangkat/region dan penggunaan, entitlement/panduan, ketentuan klaim, dan metode pengiriman nyata. Jika memakai stok akun, operator memasukkan stok asli melalui jalur admin terenkripsi yang sudah ada. Jika memakai aktivasi, pilih undangan/tautan/voucher yang memang didukung produk. Jangan meminta password pelanggan generik. Persetujuan draft pengujian tidak membuktikan akses CapCut, stok, atau kemampuan provider.

Garansi dan masa aktif adalah dua hal berbeda. Perubahan kebijakan setelah pembelian tidak memperbarui snapshot pesanan lama. Untuk produk siap pakai, garansi mulai saat pembayaran terverifikasi; untuk aktivasi, mulai pada periode layanan yang terkonfirmasi. Perpanjangan aktivasi membeli pesanan baru, menjaga akhir periode sebelumnya, dan hanya satu penerus PENDING/PAID diperbolehkan dari satu pesanan sumber; perpanjangan berikutnya dimulai dari invoice penerus terbaru.
