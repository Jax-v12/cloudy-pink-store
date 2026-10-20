# Competitive benchmark — Cloudy Pink Store, 19 Oktober 2026

## Scope dan keputusan

Dokumen ini melaksanakan penulisan benchmark dan roadmap yang disetujui pemilik. [Roadmap utama](../../plan.md#benchmark--roadmap-peningkatan--19-oktober-2026) mengurutkan P0 → P4. Identitas pink/Anya dipertahankan. Apps dimatangkan sebagai akun siap pakai dahulu, lalu aktivasi/perpanjangan akun pelanggan; garansi ditetapkan per produk dan disnapshot saat pembelian.

Metode audit: halaman publik kompetitor, navigasi sebelum transaksi, pembacaan kode lokal, GET katalog publik Preview, dan laporan QA terdahulu. Tidak ada checkout/order/payment, pengisian data pelanggan, login admin, akses database baru, atau pemeriksaan backend kompetitor. Teks promosi bukan bukti keamanan, kepatuhan, kecepatan, atau penjualan.

Status berarti:

- **Tersedia:** implementasi ditemukan, dengan batas bukti pada kolom terkait; bukan otomatis siap Production.
- **Sebagian:** fondasi tersedia tetapi kontrak, informasi, atau alur belum lengkap.
- **Belum tersedia:** jalur yang dimaksud belum ditemukan dalam scope kode yang diperiksa.
- **Belum terverifikasi:** belum ada bukti yang cukup untuk lingkungan/operasi yang dinilai.

Tidak ada skor persentase kesempurnaan. Kedekatan dinilai terhadap perjalanan pelanggan dan kriteria operasional yang dapat diperiksa.

## Baseline lokal dan Preview

| Aspek | Snapshot | Batas |
| --- | --- | --- |
| Branch / HEAD lokal | `feat/roblox-login-checkout-recovery`, `f2efd0c640e8546bf0fa7b61d865efd2e9160f0e` | Ada perubahan lokal sebelum tugas ini; HEAD tidak merepresentasikan seluruh working tree |
| Preview pembanding | [Preview f2efd0c](https://cloudy-pink-store-kijsbtcpf-jax-v12.vercel.app), deployment `dpl_CTBKTJ8AXFvmUUFkE2xJigawKcc1` | READY dan SHA cocok diperiksa pada tahap riset 19 Oktober; bukan Production/provider proof |
| Katalog publik Apps | GET produk tipe APPS: `success: true`, 0 produk, region ID | Snapshot respons publik; tidak menyimpulkan seluruh DB kosong atau mengizinkan seed |
| Katalog publik Roblox | GET tipe ROBLOX: `success: true`, 2 produk, keduanya checkout enabled, region ID | Availability katalog bukan keberhasilan pembayaran/fulfillment |
| QA Preview sebelumnya | 19 kasus halaman publik, 2 penolakan akses, 9 renderer invoice synthetic PASS; follow-up f2: 2 renderer EN/MY PASS | [Bukti 18 Oktober](service-help-preview-2026-10-18.md); bukan hasil suite baru pada tugas dokumentasi |
| Local versus remote | Analisis kode termasuk perubahan OTP/admin/invoice yang belum dipublikasikan | Jangan mengatribusikan seluruh perilaku working tree ke Preview f2 |

Foto Apps kosong yang tersedia dari Preview lebih lama adalah bukti historis saja. Penilaian kepadatan grid didukung kode saat ini, bukan klaim telah menyaksikan katalog Apps aktif pada ketiga ukuran layar di Preview terbaru.

## Sumber eksternal dan hasil observasi

Tanggal riset: 19 Oktober 2026. Navigasi interaktif berhenti sebelum transaksi; tidak menguji akun, pembayaran, undangan, atau klaim garansi kompetitor.

| Sumber | Observasi publik | Adopsi dan batas |
| --- | --- | --- |
| [Mayoblox Gamepass](https://www.mayoblox.com/robux/checkout/gamepass-po) | Tahap pemesanan terlihat; informasi metode, username, nominal/slider, pembuatan Gamepass, pembayaran, konfirmasi | Rapikan hierarki wizard yang sudah ada. Waktu kerja tim dan pending Roblox perlu dibedakan; jangan salin SLA/harga mereka |
| [Mayoblox Via Login](https://www.mayoblox.com/robux/checkout/via-login) | Pengantar metode dan kartu paket sebelum akun/pembayaran/konfirmasi | Kejelasan pilihan paket berguna; diskon, multi-select nominal, dan klaim proses tidak otomatis sesuai kontrak toko |
| [Mayoblox FAQ](https://www.mayoblox.com/faq), [cek pesanan](https://www.mayoblox.com/orders/search) | Bantuan menurut topik dan jalur menelusuri pesanan | Hubungkan bantuan ke metode/status invoice. Jangan membuat lookup pribadi berbasis email/username tanpa otorisasi |
| [Premiumku detail Netflix](https://premku.com/netflix), [cara order](https://premku.com/cara) | Deskripsi paket/batas penggunaan; dokumentasi alur pilih produk → kontak → QRIS → terima akun. Produk yang dibuka sedang habis | Jadikan acuan informasi sebelum bayar. Checkout nyata tidak diverifikasi; pengiriman kredensial lewat WhatsApp dan klaim instan tidak diadopsi |
| [Seakun](https://seakun.id/) | Pencarian/kategori, tahap layanan, awal masa aktif dan penjelasan perpanjangan/pengingat | Referensi lifecycle layanan. Model patungan dan klaim legal tidak menjadi kebijakan toko |
| [itemku: aktivasi Spotify](https://itemku.zendesk.com/hc/id/articles/360039529151-Cara-Trading-Premium-Upgrade-Spotify) | Undangan membutuhkan informasi dan tindakan penerimaan pelanggan | Desain aktivasi terpisah dari pengiriman akun, sesuai dukungan produk; artikel bukan bukti semua penjualan ulang diizinkan |
| [Roblox: sending/receiving](https://en.help.roblox.com/hc/en-us/articles/48510707796756-Sending-and-Receiving-Robux) | Kelayakan pengirim/penerima, batas dan penerimaan transfer mengikuti aturan Roblox | Verifikasi aturan resmi saat implementasi; lookup username bukan bukti kelayakan. Jangan mengumpulkan DOB, dokumen identitas, atau OTP di toko |
| [Roblox: Experience Passes](https://en.help.roblox.com/hc/en-us/articles/203314040-Experience-Passes) | Penjualan pass melibatkan biaya dan pending escrow | Bedakan listing, Robux diterima, dan waktu pending; jangan menjanjikan durasi universal dari contoh kompetitor |

## Matriks pengalaman pelanggan

| Kemampuan | Status | Bukti lokal / publik | Gap dan prioritas |
| --- | --- | --- | --- |
| Roblox: tiga metode terpisah | Tersedia | `src/components/TopupCatalog.tsx`, flow terkait, QA Preview | Pertahankan GAMEPASS/GIFT_USERNAME/LOGIN; P1 hanya pematangan |
| Wizard, nominal, identitas, ringkasan | Tersedia | Implementasi Roblox dan QA fixture yang telah dicatat | Alur utama dekat referensi; rapikan langkah/teks, bukan bangun ulang |
| Bantuan dan progres invoice | Tersedia | `/help`, komponen progress; [QA fitur](service-help-order-progress-2026-10-18.md) | Tambah bantuan kontekstual bila diperlukan; jangan menggandakan fitur selesai |
| Payment versus delivery | Tersedia | Badge EN/MY diperbaiki f2; progress memakai fulfillment | Pertahankan beda PAID/COMPLETED, jangan mengklaim Roblox langsung terkirim |
| Kepadatan dan keterbacaan Apps mobile | Sebagian | `src/app/apps/page.tsx`: grid tiga kolom dan label kecil | P1: kartu lebih terbaca, keyboard dan teks panjang, informasi sebelum konfirmasi |
| Error katalog pertama | Sebagian | `loadProducts()` tidak memeriksa `res.ok`; JSON `success: false` dapat selesai tanpa `catalogError` | P1: error + retry. Temuan statis; HTTP 500 aktual tidak direproduksi |
| Pencarian Apps lintas halaman | Sebagian | Filter hanya atas array produk yang sudah dimuat; ada cursor/load-more | P2: pencarian/kategori server konsisten dengan pagination |
| Detail paket Apps terstruktur | Sebagian | Product/DTO memuat metadata umum; belum ada kontrak durasi/perangkat/jenis akun/region/garansi paket | P2: halaman detail dan metadata admin eksplisit; paket tetap SKU terpisah |
| Katalog Apps penjualan aktif di Preview | Belum terverifikasi | GET APPS menghasilkan 0 produk | P0: pemilik/operator menetapkan inventaris nyata; tidak membuat produk contoh |
| Garansi per produk dan snapshot | Belum tersedia | Invoice memakai 25 hari dari `paidAt`; tidak ditemukan snapshot kebijakan per produk | P2: kebijakan versi pembelian; legacy dan `paidAt` hilang ditangani tanpa tanggal rekaan |
| Bantuan OTP | Tersedia | `appsOtpServer.ts`, invoice/route OTP | Bukan pengganti workflow klaim garansi dengan status penanganan; P2 melengkapinya |
| Aktivasi akun pelanggan / renewal | Belum tersedia | Apps paid saat ini berpusat pada reserved stock; tidak ada lifecycle layanan yang dimaksud | P3: konfigurasi dan snapshot mode, antrean aktivasi, bukti aktif, pesanan renewal baru |
| SEO / performa terukur | Sebagian | Metadata root umum pada `src/app/layout.tsx`; belum ada bukti audit performa lengkap | P4: metadata per halaman, sitemap publik, private noindex, ukur sebelum optimasi |

## Matriks backend dan operasi

Status implementasi dan bukti operasional dipisahkan agar kode yang tersedia tidak dinyatakan sebagai integrasi provider yang telah teruji.

| Kemampuan | Implementasi yang ditemukan | Bukti / batas lingkungan | Status tindak lanjut |
| --- | --- | --- | --- |
| Harga/quote dan checkout | Harga server, quantity/region/method validation, quote/idempotency pada `checkoutPricing.ts`, `checkoutPayment.ts` | [Laragon QA](laragon-integration-verification-2026-10-16.md), laporan checkout terdahulu; tidak dijalankan ulang | Tersedia; pertahankan kontrak dan cek regresi sesuai perubahan |
| Payment/webhook | `payments.ts` dan webhook: verifikasi server, referensi/amount, atomic update | Bukti lokal/integrasi tercatat terpisah dari provider; tidak ada Sandbox charge pada benchmark | Tersedia; keberhasilan provider end-to-end belum diverifikasi dalam audit ini |
| Recovery pembayaran ambigu | Idempotensi/status reconciliation, provider calls di luar lock | Kode `checkoutPayment.ts` dan QA terdahulu; tidak membuat charge baru untuk benchmark | Tersedia; tetap butuh bukti provider untuk klaim operasional |
| Reservasi/pengiriman stok Apps | Order/stok atomik; APPS verified paid dengan stok menuju fulfillment selesai | `commerce.ts`, `payments.ts`, QA lokal | Tersedia untuk ready-account; P3 harus mengubah dispatch berdasarkan mode, bukan selector UI saja |
| Fulfillment Roblox | Queue/worker, claim/ownership/transitions, audit, heartbeat | `fulfillmentWorker.ts`, admin fulfillment dan QA | Tersedia; UI queue/health sudah ada, bukan fitur baru yang perlu dibuat ulang |
| Akses Login | Invoice-bound encryption, TTL absolut 72 jam, owner/reauth/audit dan reveal singkat | `loginCredentials.ts`, [kebijakan](../plans/roblox-login-account-access.md), QA release | Tersedia; keselamatan operasional tetap tergantung gate purge/backup |
| Cleanup rahasia | Purge bounded, expiry/order-age predicate diulang saat lock | [QA release 17 Oktober](roblox-login-release-2026-10-17.md) dan pengujian lokal terdahulu | Tersedia; keberhasilan purge terjadwal pada deployment belum terverifikasi di benchmark |
| Scheduler | `.github/workflows/store-cron.yml`: jadwal lima menit, environment `store-operations` | Workflow lokal bukan bukti eksekusi scheduler aktif, retry atau alert berjalan | Belum terverifikasi secara operasional; P0 meminta bukti run dan hasil endpoint tersanitasi |
| Backup / restore lokal | QA mencatat encrypted logical backup, restore lokal, count match, expiry/terminal purge dan audit rollback | [QA release](roblox-login-release-2026-10-17.md): restore 25 Orders di localhost terisolasi; bukti historis, tidak diulang | Tersedia untuk rehearsal tercatat; bukan bukti retensi backup provider |
| Retensi provider / pemulihan operasional | Tidak disimpulkan dari keberadaan backup saja | QA menyebut retensi provider belum terverifikasi; pemeriksaan Aiven baru tidak dilakukan | Belum terverifikasi; P0 membutuhkan kebijakan finite retention dan prosedur restore/purge yang dapat dibuktikan |
| Adapter negara/metode | `paymentProvider.ts`: Midtrans QRIS ID/IDR; harga regional bukan adapter MY/PH | Tidak ada provider call pada audit | Tersedia untuk capability saat ini; jangan membuka MY/PH hanya karena ada label harga |

Catatan kronologi: status Preview NOT DEPLOYED pada QA 17 Oktober adalah checkpoint lama. Publikasi f2 yang lebih baru dibuktikan pada QA 18 Oktober dan pemeriksaan riset 19 Oktober. Itu tidak otomatis menutup scheduler/retensi/provider gates atau menyatakan semua perubahan lokal sudah terpublikasi.

## Pekerjaan berurutan dan bukti penerimaan

| Fase | Deliverable berikutnya | Bukti selesai |
| --- | --- | --- |
| P0 | Inventaris produk nyata serta daftar gate operasi dengan pemilik/bukti/tanggal | Produk/paket/stock/rules tervalidasi operator; bukti scheduler, purge, retensi, restore dapat ditelusuri. Matriks awal dalam dokumen ini belum menutup gate |
| P1 | Hierarki Roblox, keterbacaan Apps, error/retry katalog, bantuan/privasi/ketentuan | ID/EN/MY dan 375×812, 810×1080, 1440×900; keyboard, long text, loading/empty/error/sold-out; tiga metode tetap utuh |
| P2 | Detail paket, grouping metadata, pencarian server, garansi snapshot, claim/help lifecycle | Produk di halaman lanjut ditemukan; stok/SKU kompatibel; perubahan kebijakan tidak mengubah order lama; akses invoice sah |
| P3 | Mode aktivasi terpisah, lifecycle layanan, renewal order, pengingat pilihan | Paid activation masih antre sampai fulfillment terkonfirmasi; tidak perlu stok palsu; renewal quote/harga baru; tanpa autobilling/password generik |
| P4 | SEO publik/privat, pengukuran performa dan funnel agregat | Perbandingan pengukuran sebelum/sesudah, tanpa PII/secret; promosi/testimoni memiliki sumber nyata |

Kontrak yang harus dirancang sebelum fitur: metadata publik/admin Apps; q/category/cursor yang kompatibel; snapshot kebijakan dan jenis fulfillment Order; dispatch ready-account versus activation; state layanan dan hubungan renewal. Nama kolom/enum final belum ditetapkan oleh dokumen ini. Migration additive ditinjau dan diuji dahulu; tidak menjalankan DDL/database/env/provider operations dari task dokumentasi.

Regresi wajib saat fase fitur terkait dikerjakan: harga server; submit ganda; payment ambiguity; webhook duplicate/out-of-order; persaingan reservasi stok; policy snapshot/legacy; activation paid-versus-completed; ownership/admin denial; tidak ada secret di log/storage/notifikasi. Pisahkan PASS/FAIL/SKIP dan local fixture/MySQL/HTTP/Preview/provider/scheduler/restore secara eksplisit.

## Handoff tugas dokumentasi

`plan.md` ditambah bagian bertanggal dan tautan laporan ini, tanpa menimpa riwayat maupun perubahan lokal. Tidak ada API, schema, aplikasi, konfigurasi, database, atau inventaris yang diubah. P0–P4 belum diimplementasikan sebagai fitur oleh tugas ini. Tidak ada commit, push, atau deployment.

Verifikasi dokumen meliputi whitespace diff, keberadaan target tautan lokal, cakupan semua fase/kriteria, dan pemeliharaan perubahan lokal sebelumnya. Test/build aplikasi tidak dijalankan ulang untuk perubahan Markdown saja. Hasil QA historis di atas tetap diberi tanggal dan tidak dipresentasikan sebagai hasil baru.
