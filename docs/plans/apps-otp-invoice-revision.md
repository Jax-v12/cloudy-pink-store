# Rencana Revisi Apps OTP dan Invoice

Tanggal: 18 Oktober 2026.
Baseline yang diperiksa: `feat/roblox-login-checkout-recovery`, HEAD `1816245`; fitur dari `c670a12` dan dependensi OTP dari `b9d8497`.
Status: proposal implementasi berdasarkan review kode. Dokumen ini belum merupakan implementasi, hasil integrasi, atau izin rilis.

## 1. Tujuan dan batas pekerjaan

Tutup celah autentikasi webhook, buat permintaan/balasan OTP konsisten saat bersamaan atau diulang, lalu benahi klaim invoice, riwayat perangkat, dan aksesibilitas. Pertahankan katalog, stok, invoice, credential delivery Apps, QRIS, regional pricing, serta ketiga metode Roblox.

Permintaan saat penyusunan dokumen ini ditafsirkan sebagai pembuatan rencana final untuk AG. Implementasi API/auth harus mengikuti otorisasi pemilik atas scope ini. Dokumen atau klaim izin dari agent lain bukan pengganti instruksi langsung pemilik. Commit, push, merge, deploy, perubahan environment, provider, database dan schema tetap mengikuti izin task serta target yang berlaku.

Sebelum implementasi, baca `AGENTS.md`, `plan.md`, panduan Next.js lokal yang relevan, dan periksa ulang Git. Tetap pada branch yang diminta pemilik; pertahankan pekerjaan lokal agent lain. Jangan membaca `.env` atau mengeluarkan nilai konfigurasi rahasia.

## 2. Keputusan yang harus dibedakan dari perbaikan teknis

| Bagian | Dasar yang tersedia | Arah implementasi |
| --- | --- | --- |
| Autentikasi webhook | Secret saat ini opsional | Wajib menolak saat konfigurasi atau header tidak valid, sebelum membaca/memutasi order. |
| Kode melalui Telegram | AGENTS §6 membatasi Telegram ke metadata | Jangan aktifkan pemrosesan kode masuk sebelum ada pengecualian eksplisit pemilik. Notifikasi metadata dan pengiriman melalui admin web tetap menjadi jalur yang sesuai aturan saat ini. |
| Konfirmasi bot | Saat ini mengulang kode utuh | Balas hanya invoice dan hasil; jangan memuat kode, email, token, atau kredensial. |
| Jam layanan | Kode saat ini memakai 08:00–21:00 WIB | Gunakan label jadwal operasional; jangan mengklaim kehadiran admin atau estimasi 1–10 menit yang belum disepakati. Jadwal baru tetap perlu keputusan pemilik. |
| Garansi | Kode memuat 25 hari; schema tidak memiliki `paidAt` atau kebijakan garansi | Konfirmasi durasi, produk yang berlaku, awal masa garansi, dan ketentuan. Sampai jelas, tampilkan informasi bantuan garansi tanpa klaim durasi/aktif yang tidak terbukti. |

Pengecualian Telegram, bila diminta, perlu menyebut bahwa kode akan berada dalam pesan masuk/riwayat layanan Telegram, pihak yang boleh mengirim, retensi, dan batas penggunaannya. Menghapus kode dari balasan bot tidak menghapus kode dari pesan admin. Jangan membuat flag environment yang dianggap sebagai pengganti persetujuan kebijakan.

## 3. Webhook: autentikasi, validasi, dan hasil yang jujur

File utama: `src/app/api/webhook/telegram/route.ts`, `src/lib/telegramWebhook.ts`, `src/lib/telegram.ts`.

1. Tolak request dengan respons generik `503` bila konfigurasi autentikasi wajib belum tersedia; tidak ada akses order atau pengiriman pesan. Header salah/hilang menghasilkan `401`. Jangan mengembalikan nilai secret atau detail konfigurasi internal.
2. Bandingkan secret dengan cara time-safe yang menangani panjang berbeda secara aman. Jangan menormalisasi secret secara diam-diam. Validasi konfigurasi sesuai kontrak provider sebelum mengaktifkan rute.
3. Validasi runtime struktur update, jenis pesan, ID, panjang teks dan invoice. Pertahankan batas body dan `private, no-store`; type assertion bukan validasi payload.
4. Setelah autentikasi, cocokkan chat yang diizinkan. Jika target adalah grup, keanggotaan grup saja tidak membuktikan kewenangan admin: rancangan izin pengirim harus jelas sebelum fitur kode diaktifkan.
5. Selama pengecualian kode Telegram belum ada, rute tidak menyimpan kode dari pesan. Bantuan bot mengarahkan admin ke halaman admin yang sah tanpa tautan berisi token atau kredensial.
6. Jika pengecualian disetujui, gunakan layanan domain OTP yang sama dengan admin web. Jangan menggandakan logika kelayakan/transaksi pada transport Telegram.
7. Pisahkan penolakan permanen dan kegagalan sementara. Update yang diabaikan atau sudah diproses dapat diakui `200`; kegagalan database sementara menghasilkan `5xx` agar dapat dicoba ulang. Log memakai diagnostik tersanitasi proyek, bukan objek error/body mentah.
8. Commit database mendahului balasan bot. Gagal mengirim konfirmasi tidak membatalkan kode yang sudah tersimpan dan tidak boleh membuat audit OTP kedua saat update diulang.

Aktivasi Telegram dua arah mensyaratkan deduplikasi persisten update dan korelasi ke permintaan OTP tertentu. Jangan memakai `Set` dalam memori, `sessionId: 'telegram-bot'`, atau status `REQUESTED` saja sebagai bukti deduplikasi. Schema belum mempunyai inbox/update receipt unik; bila solusi memerlukan schema baru, ajukan kontrak dan migrasi kecil yang ditinjau, lalu tunggu izin target database. Bagian ini tidak menjadi alasan menunda perbaikan autentikasi atau UI yang independen.

## 4. Satu aturan transaksi untuk permintaan dan balasan OTP

File terkait:

- `src/lib/appsOtp.ts` dan helper server terpisah untuk transaksi jika diperlukan. Jangan menambahkan Prisma ke helper yang diimpor Client Component.
- `src/app/api/orders/[id]/otp/route.ts`.
- `src/app/api/admin/orders/[id]/otp/route.ts`.
- `src/app/api/orders/[id]/route.ts`, `src/app/api/admin/orders/route.ts`, dan UI pemanggilnya bila DTO mendapat `requestId`.
- Webhook hanya memakai aturan ini setelah keputusan §2 dan prasyarat deduplikasi §3 terpenuhi.

### Penguncian dan kelayakan

1. Autentikasi invoice/admin dilakukan melalui helper existing. Konsumsi rate limit tetap mengikuti aturan proyek; jangan menambahkan network call ke transaksi.
2. Ambil lock `Order` berdasarkan ID atau invoice unik dengan SQL terparameterisasi, lalu periksa kelayakan dari state terkini. Jangan membangun snapshot dengan plain read sebelum lock dan menganggap plain read berikutnya pasti segar.
3. Pilihan terkecil: gunakan pola transaksi `READ COMMITTED` existing yang sesuai scope, atau ambil seluruh kolom kelayakan langsung dari `SELECT ... FOR UPDATE`. Jangan mengubah isolation level global. Jika memakai helper admin, pertahankan validasi sesi/Origin/CSRF dan aturan retry-nya.
4. Permintaan pelanggan dan semua balasan yang didukung harus mengambil lock order yang sama sebelum membaca state OTP atau menulis audit. Setelah lock, validasi ulang hak akses dan kelayakan: APPS, PAID, stok terkait tersedia, serta kebijakan removal/refund yang konsisten dengan akses invoice. Jangan memperluas aturan bisnis diam-diam; konflik eligibility perlu diselesaikan pada layanan bersama.
5. Baca audit yang relevan setelah lock. Gunakan `AdminAudit.id` untuk urutan kejadian, termasuk dua kejadian dengan `createdAt` identik; tanggal tetap dipakai untuk TTL. Jangan bergantung pada window lima audit tanpa membuktikan bahwa request yang diperlukan selalu ditemukan.
6. Tulis audit kode terenkripsi dan perubahan terkait secara atomik. HTTP ke Telegram/provider selalu setelah transaksi selesai. Jangan retry otomatis ketika hasil commit ambigu; retry berikutnya membaca hasil yang sudah tersimpan.

MySQL `REPEATABLE READ` memakai snapshot dari consistent read pertama; locking read membaca state terbaru. Dasar rancangan: [consistent reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-consistent-read.html) dan [locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html). Isolation runtime belum diverifikasi terhadap database dalam pekerjaan dokumentasi ini.

### Permintaan aktif, korelasi, dan retry

- Pertahankan TTL OTP existing 15 menit; tentukan batas tunggal: pada `now >= expiresAt`, state sudah kedaluwarsa. Tidak ada perluasan TTL akibat refresh atau retry.
- Pakai ID audit permintaan sebagai `requestId`; nomor invoice mengidentifikasi order, bukan satu permintaan OTP.
- Klik ganda/retry permintaan yang masih `REQUESTED` mengembalikan permintaan aktif yang sama tanpa audit/notifikasi tambahan. Permintaan baru setelah kode terkirim atau kedaluwarsa mendapatkan ID baru.
- Admin web menerima `requestId` dari DTO berizin dan mengirim `{ code, requestId }`. Validasi field, integer dan kepemilikan di server. Halaman lama yang tidak membawa ID diminta refresh; jangan diam-diam mengikat kode ke permintaan terbaru.
- Di bawah lock, balasan hanya diterima untuk request aktif yang cocok. Retry request yang sudah dijawab mengembalikan hasil tersimpan tanpa audit kedua; balasan untuk ID lama ditolak walaupun order mempunyai request baru.
- Pertahankan pembacaan audit lama agar invoice tidak rusak. Evaluasi aturan legacy tanpa mengarang ID atau menulis ulang data historis. Tambahan field/kontrak perlu diperbarui bersama pada validator, DTO, admin, invoice dan tests.
- Jika Telegram kelak diaktifkan, notifikasi/reply harus membawa korelasi request yang dapat diverifikasi dan update receipt harus atomik dengan hasil domain. Format `/otp <invoice> <kode>` saja tidak cukup untuk mengatasi replay ke request baru.
- TTL tampilan bukan bukti penghapusan ciphertext aplikasi atau pesan Telegram. Catat retensi/purge/backup kode secara terpisah sebelum menyatakan lifecycle secret selesai.

## 5. Invoice: jadwal, garansi, dan panduan

File utama: `src/app/order/[id]/page.tsx`, `src/lib/translations.ts`, dan `src/context/LanguageContext.tsx` sesuai mekanisme terjemahan existing.

- Teks faktual: ID "Jam operasional: 08:00–21:00 WIB"; EN "Operating hours: 08:00–21:00 WIB"; MY "Waktu operasi: 08:00–21:00 WIB". Di luar jadwal, jelaskan bahwa permintaan ditangani pada jam operasional. Jangan menulis "Admin Online" berdasarkan waktu saja.
- Jam pada order PAID tetap diperbarui dan disinkronkan lagi saat tab kembali aktif. Pertahankan countdown QRIS satu detik untuk PENDING; pembaruan jadwal/garansi dapat lebih jarang. Bersihkan interval/listener saat unmount.
- Setelah kebijakan garansi dikonfirmasi, gunakan tanggal awal yang berwenang dan timestamp expiry yang tetap. Jika pemilik memilih sejak order dibuat, `createdAt` dapat digunakan dengan label yang jelas. Jika sejak pembayaran/pengiriman, schema saat ini belum menyediakan timestamp khusus: jangan menebaknya dari `updatedAt` atau membuat schema tanpa izin.
- Badge aktif hanya jika tanggal valid, produk eligible, dan expiry di masa depan. Saat expiry tercapai, teks/warna menjadi "Masa Garansi Berakhir". Kebijakan/tanggal tidak tersedia menghasilkan informasi bantuan, bukan garansi baru dari `Date.now()`.
- Durasi, satuan hari, label selesai, error dan a11y tersedia dalam ID/EN/MY; hilangkan teks literal "25 Hari" dari markup. Jangan membuat janji penggantian/S&K baru tanpa kebijakan pemilik.
- Tampilkan FAQ umum yang benar untuk produk terkait. FAQ Netflix/Household hanya setelah ada pemetaan eksplisit yang ditinjau; `name.includes('netflix')` bukan kontrak katalog. Jangan menganggap semua Apps memakai satu profil, PIN, Smart TV atau aturan Household.
- Jika belum ada metadata panduan, gunakan bantuan umum yang aman atau arahkan ke admin. Penambahan konfigurasi produk/schema menjadi usulan terpisah; jangan mengubah katalog atau membuat fixture pada database operasional.

## 6. Riwayat perangkat, modal, dan suara admin

File utama: `src/components/StoreShell.tsx`, `src/lib/recentOrders.ts`, `src/app/order/[id]/page.tsx`, `src/app/admin/page.tsx`, dan terjemahan.

### Riwayat dan modal

- Awali render server dan render browser pertama dengan state yang sama. Baca storage setelah mount atau saat interaksi melalui pola yang lolos aturan React/lint proyek. Uji juga preferensi suara admin yang saat ini dibaca saat inisialisasi.
- Minimalkan data baru: daftar invoice non-rahasia dan waktu kunjungan sudah cukup untuk membuka kembali invoice; hindari menyimpan nama produk/status pembayaran yang dapat bocor atau kedaluwarsa. Kebijakan retensi daftar perangkat harus jelas dan terbatas. Jangan menambah token, email, kontak, kode, atau kredensial ke daftar.
- Validasi seluruh bentuk storage, tipe/panjang/enum/tanggal dan jumlah maksimum lima item. JSON rusak, storage ditolak atau quota penuh harus menghasilkan fallback aman. Data lama diperlakukan sebagai input tidak tepercaya.
- Saat membuka daftar, jangan memanggil endpoint invoice penuh untuk mengambil nama/status karena responsnya dapat memuat kredensial Apps. Pembukaan invoice tetap melalui otorisasi existing; daftar lokal bukan bukti kepemilikan atau pembayaran.
- Tombol "Hapus daftar pesanan di perangkat ini" menghapus key riwayat baru dan state UI. Teks menjelaskan bahwa pesanan di toko tetap ada. Tindakan ini tidak menjanjikan logout/pencabutan akses; token invoice lama tidak dihapus atau dipindah diam-diam.
- Dialog memindahkan fokus ke dalam, menahan Tab/Shift+Tab, menyediakan Escape dan tombol tutup, mencegah interaksi dengan latar, lalu mengembalikan fokus ke pemicu. Reuse pola modal existing bila sesuai. Seluruh listener/scroll lock dibersihkan, label terjemahan lengkap, konten panjang tetap dapat dijangkau.
- Riwayat bukan jaminan akses selamanya: akses invoice tetap bergantung pada token/sesi existing, termasuk expiry sesi Login Roblox. Jangan memperluas auth atau mengklaim pemulihan pesanan hanya dari invoice ID.

### Suara admin

- Tentukan order baru berdasarkan ID yang belum terlihat, bukan bertambahnya jumlah halaman; halaman penuh tetap dapat menerima order baru. Bedakan initial load dari event baru dan OTP request baru berdasarkan identitas request.
- Audio diaktifkan melalui interaksi pengguna yang sesuai kebijakan browser. Gunakan ulang atau tutup `AudioContext` setelah bunyi dan bersihkan saat unmount; kegagalan audio/storage tidak boleh menggagalkan pembaruan daftar.
- Hindari polling yang menimpa pagination atau mengulang bunyi untuk event yang sama. Pertahankan batas query/pagination existing.

## 7. Pengujian yang membuktikan perilaku

Review script/config sebelum menjalankan checks. Unit/route tests menggunakan fixture sintetis dan mock transport tanpa koneksi provider/Telegram. Database integration hanya pada localhost disposable `cloudy_test_*` yang secara spesifik diizinkan; jangan akses Aiven, `cloudy_staging`, atau `defaultdb` untuk pengujian.

| Area | Kasus minimum |
| --- | --- |
| Webhook auth | Konfigurasi kosong; header hilang/salah/panjang berbeda; chat/payload salah; tidak ada query order atau pesan pada penolakan autentikasi. |
| Kebijakan Telegram | Selama pengecualian belum ada, pesan berisi kode tidak memutasi OTP. Notifikasi/konfirmasi tidak membawa secret. |
| OTP server | Auth denied; non-APPS/unpaid/stock tidak eligible; request tidak ada/expired; request aktif; ID request lama; audit bertimestamp sama; kode terenkripsi dan admin list tidak memuat plaintext. |
| Retry/concurrency | Dua request bersamaan menghasilkan satu request aktif; dua balasan satu request menghasilkan satu audit balasan; perubahan eligibility bersamaan; retry setelah commit ambigu membaca hasil lama; request baru menolak replay lama. Mock tidak membuktikan lock MySQL. |
| Telegram dua arah, jika disetujui | Duplicate/update lama; receipt atomik; crash sebelum/sesudah commit; database gagal sementara memberi respons retry; konfirmasi bot gagal tanpa audit OTP kedua. |
| Invoice | Batas 08:00/21:00 WIB; paid tab melewati pergantian jam/hari; expiry garansi tepat; kebijakan/tanggal kosong; produk non-Netflix; tidak ada janji durasi palsu. |
| Riwayat/modal | SSR dan hydration dengan storage terisi; JSON/storage rusak; limit/dedupe; hapus hanya key daftar; tidak ada token/PII/secret baru; fokus/Tab/Shift+Tab/Escape/restore; akses invoice tetap diautentikasi. |
| Suara | Halaman sudah penuh menerima order baru; request OTP baru; initial load senyap; mute; storage ditolak; audio diblokir; pagination dan cleanup. |

Mulai dari tests terdekat: `tests/apps-otp.test.mjs`, `tests/telegram-webhook.test.mjs`, `tests/recent-orders.test.mjs`. Tambahkan route/concurrency coverage pada fixture proyek yang sesuai; parser test saja tidak membuktikan autentikasi atau transaksi.

Urutan checks: targeted tests → TypeScript/lint → build dan regression yang relevan → browser/visual → diff review. Gunakan script/perintah yang tersedia di `AGENTS.md`; periksa perubahan unstaged dengan `git diff --check`, dan staged dengan `git diff --cached --check` bila memang ada staging berizin. Jangan menganggap staged check membuktikan file unstaged bersih.

Browser memeriksa ID/EN/MY pada 375×812, 810×1080, dan 1440×900: modal kosong/terisi, keyboard, jadwal, garansi aktif/berakhir/tidak tersedia dan non-Netflix. Capture hanya data sintetis. Bedakan fixture browser, MySQL integration, preview deployment dan provider asli; laporkan PASS/FAIL/SKIP beserta jumlah/alasan. Jangan menulis "semua lulus" sebelum hasil aktual tersedia.

## 8. Urutan pengerjaan dan kriteria selesai

1. Pastikan scope implementasi dan keputusan §2. Perbaiki autentikasi dan logging terlebih dahulu; pemrosesan kode Telegram tetap tidak aktif sampai prasyaratnya terpenuhi.
2. Perbaiki layanan OTP request/reply bersama, korelasi request, pemanggil dan tests. Tidak ada migrasi atau perubahan kontrak auth di luar proposal yang diotorisasi.
3. Perbaiki teks invoice/timer serta UI riwayat/modal/suara dengan terjemahan lengkap. Kerjakan bagian yang tidak bergantung pada keputusan garansi/Telegram.
4. Jalankan checks sesuai dampak, review diff final, dan catat hasil pada QA yang disepakati. Dokumen rencana ini sendiri tidak memerlukan full test suite/build.
5. Sebelum rilis, semua temuan P1 yang berlaku harus selesai, keputusan kebijakan tercatat, dan klaim integrasi dibatasi pada bukti yang benar-benar ada. Ready pada Vercel atau screenshot tidak membuktikan pembayaran/OTP provider.

Handoff menyertakan branch/SHA terbaru, file yang berubah, kontrak/keputusan, hasil checks dan batas yang belum diuji. Stage/commit/push/deploy hanya sesuai instruksi pemilik yang mencakup task dan target.

Rollback lokal memakai patch terarah atas perubahan sendiri dengan pekerjaan agent lain tetap utuh. Masalah webhook ditangani dengan menghentikan penerimaan kode sambil mempertahankan notifikasi metadata dan admin web; jangan rollback celah fail-open. Perubahan data, receipt persisten atau schema kelak memerlukan rancangan rollout/rollback tersendiri sebelum mutasi berizin.
