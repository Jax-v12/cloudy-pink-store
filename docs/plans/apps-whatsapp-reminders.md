# Apps expiry reminders — WhatsApp

Keputusan pemilik: WhatsApp H-3 dan H-1; belum memiliki penyedia (20 Oktober 2026). Implementasi menggunakan adapter Meta Cloud API, nonaktif secara default. Tidak ada akun baru, biaya, token, nomor pelanggan atau pesan nyata yang dibuat oleh task ini.

Meta Cloud API adalah layanan resmi untuk menghubungkan website dengan pengiriman WhatsApp otomatis. Pengingat H-3/H-1 membutuhkan akun bisnis, nomor pengirim dan template pesan yang disetujui; akun WhatsApp biasa belum menjadi layanan API. Pemilik menyelesaikan identitas, persetujuan ketentuan dan biaya yang berlaku, lalu memasukkan credential langsung ke secret store. Bantuan WhatsApp manual yang sudah tersedia tetap dapat dipakai. Source telah dirilis, tetapi flag pengiriman tetap nonaktif sampai prasyarat ini dipenuhi dan diuji dengan penerima yang disetujui.

## Prasyarat aktivasi operator

1. Siapkan akun pengirim WhatsApp Business Platform melalui Meta atau pilih penyedia lain. Jika penyedia berbeda, review adapter sebelum mengaktifkan flag; jangan memasukkan endpoint arbitrer ke konfigurasi.
2. Siapkan utility template yang disetujui untuk bahasa `id`, `en`, `ms`. Body memakai tepat dua text parameters: jumlah hari (`3`/`1`), lalu tanggal akhir UTC `YYYY-MM-DD`. Isi pesan hanya pengingat layanan Apps dan cara bantuan/berhenti; tanpa password, voucher, OTP, token atau tautan akses invoice.
3. Operator memasukkan token langsung ke secret store target, bukan chat/source. Key yang diperlukan: `WHATSAPP_ACCESS_TOKEN` (Secret), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION` (versi resmi yang didukung), `WHATSAPP_TEMPLATE_NAME`. `WHATSAPP_REMINDERS_ENABLED=true` diaktifkan terakhir setelah uji provider yang diizinkan. Semua key harus tersedia; tidak ada versi/template rekaan yang dipakai runtime.
4. Pelanggan memilih pengingat pada invoice sah dengan explicit consent. Admin memverifikasi kepemilikan nomor dan persetujuan melalui bantuan, bukan hanya validasi format, lalu mencatat referensi non-PII. Perubahan nomor harus diverifikasi kembali.
5. Jadwal cleanup/fulfillment/reminders harus menuju satu runtime untuk shared DB. Jangan menjalankan dua sender berbeda. Pantau kegagalan Actions, antrean review dan heartbeat; ukur interval aktual GitHub, bukan menganggap cron expression sebagai SLA lima menit.
6. Uji acceptance provider menggunakan nomor operator yang disetujui dan persetujuan terpisah untuk pesan nyata. Hasil fixture tidak menggantikan approved template/account/delivery evidence. Jangan mengirim notifikasi percobaan kepada pelanggan.

Contoh body usulan (harus ditinjau/disetujui Meta, bukan template aktif): “Layanan Apps Anda berakhir dalam {{1}} hari, pada {{2}} (tanggal UTC). Untuk memesan perpanjangan, buka toko dan invoice Anda. Untuk berhenti menerima pengingat, gunakan pengaturan pengingat di invoice atau hubungi bantuan.” Persetujuan pelanggan tidak meliputi promosi atau auto-billing.

## Penanganan kegagalan dan privasi

- Setiap periode hanya satu percobaan per H-3/H-1. ACCEPTED bukan delivered; status webhook delivery belum diintegrasikan dan tidak diklaim.
- UNKNOWN setelah timeout/crash tidak otomatis diulang. Cron tetap gagal selama UNKNOWN/REJECTED belum ditinjau. Admin memeriksa provider lalu mencatat REVIEWED; tidak ada tombol resend. Dalam panggilan cron bersamaan, reservasi UNKNOWN sementara dapat menyebabkan warning konservatif sampai acceptance tercatat.
- Verifikasi nomor/consent dan disposition review memerlukan recent reauth. Contact reveal dibatasi 60 detik; nomor tidak masuk daftar, audit, log, storage browser, metrik, atau notifikasi admin.
- Nomor dienkripsi sebelum insert, dihapus ketika opt-out atau cleanup setelah expiry/refund/archive. Backup copies memiliki retensi terpisah yang harus dibuktikan sebelum rilis operasional.
- Setelah opt-out, request yang sudah in-flight tidak dapat ditarik kembali. Tidak ada auto-renewal, auto-charge, pembuatan stok atau perubahan status payment/fulfillment akibat pengingat.

Referensi protokol: [Meta Cloud API documentation collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api), [Meta template message example](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/). Dokumen Meta developer langsung terkena HTTP 429 saat pemeriksaan; akun/template/provider aktual tetap prasyarat verifikasi tersendiri.
