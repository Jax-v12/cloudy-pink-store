const en = {
  title: 'Operations guide', close: 'Close guide', checking: 'Checking admin session…',
  intro: 'Follow the order snapshot and the recorded payment and delivery status. This guide does not change an order.',
  paymentRule: 'Process delivery only after the server confirms PAID. A payment screenshot, QR code or browser redirect is not payment confirmation.',
  sections: [
    { title: 'Premium Apps', steps: [
      'For ready accounts, the assigned account is delivered through its authorized invoice after verified payment. Check the invoice and stock state if delivery is unavailable; do not place a replacement order to retry.',
      'For activation, claim the paid order in Apps services. Use the dedicated delivery form for the configured invitation, link or voucher, then verify that the service is active.',
      'Record a non-sensitive delivery reference before marking activation completed. Customer acknowledgment alone does not confirm activation. Follow the product snapshot for duration and warranty.',
    ] },
    { title: 'Roblox Gamepass', steps: [
      'Claim the paid order. Check the Roblox recipient, Gamepass link, Robux to receive and required Gamepass purchase price in the order snapshot.',
      'Recheck the Gamepass owner, sale availability and exact listing price before buying. Keep the purchase action outside the store; claiming an order does not buy the Gamepass.',
      'After the actual purchase is confirmed, enter its non-sensitive transaction reference and mark delivery completed. Roblox pending time is separate from the purchase confirmation.',
    ] },
    { title: 'Roblox Via Username', steps: [
      'Claim the paid order and verify the exact username and Robux quantity from the snapshot.',
      'Check recipient eligibility and the transfer limits of the platform method being used. Perform the delivery, or use Waiting for customer when more information is needed.',
      'Keep a verifiable delivery reference and mark completed only after the transfer is confirmed. Payment alone does not complete delivery.',
    ] },
    { title: 'Roblox Via Login', steps: [
      'Claim the paid order. Only its assigned admin can open encrypted account access after recent password verification. The reveal lasts 60 seconds; authorized access is bounded to 72 hours from order creation.',
      'Use the account only for this top-up. Password and five backup codes belong only in the dedicated, consented order flow. Never request OTPs, cookies, session tokens or credentials through chat, notes or delivery evidence.',
      'If access has expired or more customer action is needed, use Waiting for customer or Review and contact the customer through the authorized order contact. Do not copy or retain the revealed credentials.',
      'After the top-up is confirmed, save a non-sensitive reference and mark completed. The application removes the active order secret on completion; backup retention is a separate operational control.',
    ] },
    { title: 'Problems, refunds and history', steps: [
      'Pending, expired or cancelled payment: do not fulfill the order. If payment is claimed, reconcile it through the existing verified payment process before taking a delivery action.',
      'An uncertain result is not success. Refresh the same invoice, inspect the activity and provider history, and use Review when needed. Do not repeat an uncertain purchase or transfer.',
      'A required refund is a separate process. Complete it only after the actual refund and its reference are verified. The refund button records the result; it does not send money.',
      'Archive eligible completed orders or expired/cancelled unpaid orders after all stock, account-access and delivery obligations are cleared. They leave the active list and remain recoverable. A verified late payment reopens the order for review. Removing an archived invoice still preserves financial history and customer invoice access; follow the on-screen checks.',
    ] },
  ],
};
type Copy = typeof en;
const id: Copy = {
  title: 'Panduan Operasional', close: 'Tutup panduan', checking: 'Memeriksa sesi admin…',
  intro: 'Ikuti snapshot pesanan serta status pembayaran dan pengiriman yang tercatat. Panduan ini tidak mengubah pesanan.',
  paymentRule: 'Proses pengiriman hanya setelah server mengonfirmasi PAID. Screenshot pembayaran, kode QR, atau redirect browser bukan konfirmasi pembayaran.',
  sections: [
    { title: 'Apps Premium', steps: [
      'Untuk akun siap pakai, akun yang dialokasikan dikirim melalui invoice berizin setelah pembayaran terverifikasi. Jika pengiriman belum tersedia, periksa invoice dan status stok; jangan membuat pesanan pengganti untuk mencoba ulang.',
      'Untuk aktivasi, ambil pesanan berbayar di layanan Apps. Gunakan formulir pengiriman khusus sesuai undangan, tautan, atau voucher yang dikonfigurasi, lalu pastikan layanan benar-benar aktif.',
      'Catat referensi pengiriman tanpa data sensitif sebelum menandai aktivasi selesai. Konfirmasi penerimaan pelanggan saja bukan bukti aktivasi. Ikuti masa aktif dan garansi pada snapshot produk.',
    ] },
    { title: 'Roblox Gamepass', steps: [
      'Ambil pesanan berbayar. Periksa penerima Roblox, tautan Gamepass, Robux diterima, dan harga pembelian Gamepass yang diwajibkan pada snapshot pesanan.',
      'Periksa ulang pemilik Gamepass, ketersediaan penjualan, dan harga listing yang tepat sebelum membeli. Pembelian dilakukan di luar toko; mengambil pesanan tidak otomatis membeli Gamepass.',
      'Setelah pembelian nyata terkonfirmasi, isi referensi transaksi tanpa data sensitif dan tandai pengiriman selesai. Masa pending Roblox terpisah dari konfirmasi pembelian.',
    ] },
    { title: 'Roblox Via Username', steps: [
      'Ambil pesanan berbayar, lalu periksa nama pengguna yang tepat dan jumlah Robux pada snapshot.',
      'Periksa kelayakan penerima dan batas transfer sesuai metode platform yang digunakan. Lakukan pengiriman, atau pilih Tunggu pelanggan jika masih memerlukan data tambahan.',
      'Simpan referensi pengiriman yang dapat diverifikasi dan tandai selesai hanya setelah transfer terkonfirmasi. Pembayaran saja tidak menyelesaikan pengiriman.',
    ] },
    { title: 'Roblox Via Login', steps: [
      'Ambil pesanan berbayar. Hanya admin yang ditugaskan dapat membuka akses akun terenkripsi setelah verifikasi ulang kata sandi terbaru. Tampilan berlangsung 60 detik; akses berizin dibatasi hingga 72 jam sejak pesanan dibuat.',
      'Gunakan akun hanya untuk top-up ini. Kata sandi dan lima kode cadangan hanya melalui alur pesanan khusus dengan persetujuan. Jangan meminta OTP, cookie, token sesi, atau kredensial melalui chat, catatan, maupun bukti pengiriman.',
      'Jika akses kedaluwarsa atau diperlukan tindakan pelanggan, pilih Tunggu pelanggan atau Tinjau dan hubungi melalui kontak pesanan berizin. Jangan menyalin atau menyimpan kredensial yang dibuka.',
      'Setelah top-up terkonfirmasi, simpan referensi tanpa data sensitif dan tandai selesai. Aplikasi menghapus rahasia aktif pesanan saat selesai; retensi backup merupakan kontrol operasional terpisah.',
    ] },
    { title: 'Kendala, pengembalian dana, dan histori', steps: [
      'Pembayaran menunggu, kedaluwarsa, atau dibatalkan: jangan kirim pesanan. Jika pelanggan mengaku membayar, cocokkan melalui proses verifikasi pembayaran yang tersedia sebelum melakukan tindakan pengiriman.',
      'Hasil yang belum pasti bukan keberhasilan. Muat ulang invoice yang sama, periksa aktivitas dan histori provider, lalu pilih Tinjau bila diperlukan. Jangan mengulangi pembelian atau transfer yang hasilnya belum pasti.',
      'Pengembalian dana wajib diproses terpisah. Tandai selesai hanya setelah refund nyata dan referensinya terverifikasi. Tombol pengembalian dana mencatat hasil; tombol itu tidak mengirim uang.',
      'Arsipkan pesanan selesai yang memenuhi syarat atau pesanan belum dibayar yang kedaluwarsa/dibatalkan setelah seluruh kewajiban stok, akses akun, dan pengiriman beres. Pesanan hilang dari daftar aktif dan tetap dapat dipulihkan. Pembayaran terlambat yang terverifikasi membukanya kembali untuk ditinjau. Penghapusan invoice terarsip tetap menjaga histori keuangan dan akses invoice pelanggan; ikuti verifikasi di layar.',
    ] },
  ],
};
const my: Copy = {
  title: 'Panduan Operasi', close: 'Tutup panduan', checking: 'Menyemak sesi pentadbir…',
  intro: 'Ikuti snapshot pesanan serta status bayaran dan penghantaran yang direkodkan. Panduan ini tidak mengubah pesanan.',
  paymentRule: 'Proses penghantaran hanya selepas pelayan mengesahkan PAID. Tangkapan skrin bayaran, kod QR atau redirect pelayar bukan pengesahan bayaran.',
  sections: [
    { title: 'Aplikasi Premium', steps: [
      'Untuk akaun sedia guna, akaun yang diperuntukkan dihantar melalui invois berizin selepas bayaran disahkan. Jika penghantaran belum tersedia, semak invois dan status stok; jangan buat pesanan ganti untuk mencuba semula.',
      'Untuk pengaktifan, ambil pesanan berbayar dalam perkhidmatan Apps. Gunakan borang penghantaran khusus mengikut jemputan, pautan atau baucar yang dikonfigurasi, kemudian pastikan perkhidmatan benar-benar aktif.',
      'Catat rujukan penghantaran tanpa data sensitif sebelum menandakan pengaktifan selesai. Pengakuan penerimaan pelanggan sahaja bukan bukti pengaktifan. Ikuti tempoh aktif dan jaminan dalam snapshot produk.',
    ] },
    { title: 'Roblox Gamepass', steps: [
      'Ambil pesanan berbayar. Semak penerima Roblox, pautan Gamepass, Robux diterima dan harga pembelian Gamepass yang diwajibkan dalam snapshot pesanan.',
      'Semak semula pemilik Gamepass, ketersediaan jualan dan harga listing yang tepat sebelum membeli. Pembelian dilakukan di luar kedai; mengambil pesanan tidak membeli Gamepass secara automatik.',
      'Selepas pembelian sebenar disahkan, isi rujukan transaksi tanpa data sensitif dan tandakan penghantaran selesai. Tempoh pending Roblox berasingan daripada pengesahan pembelian.',
    ] },
    { title: 'Roblox Nama Pengguna', steps: [
      'Ambil pesanan berbayar, kemudian semak nama pengguna yang tepat dan jumlah Robux dalam snapshot.',
      'Semak kelayakan penerima dan had pindahan mengikut kaedah platform yang digunakan. Lakukan penghantaran atau pilih Tunggu pelanggan jika maklumat tambahan diperlukan.',
      'Simpan rujukan penghantaran yang boleh disahkan dan tandakan selesai hanya selepas pindahan disahkan. Bayaran sahaja tidak melengkapkan penghantaran.',
    ] },
    { title: 'Roblox Log Masuk', steps: [
      'Ambil pesanan berbayar. Hanya pentadbir yang ditugaskan boleh membuka akses akaun tersulit selepas pengesahan semula kata laluan terkini. Paparan berlangsung 60 saat; akses berizin dihadkan hingga 72 jam sejak pesanan dibuat.',
      'Gunakan akaun hanya untuk tambah nilai ini. Kata laluan dan lima kod sandaran hanya melalui aliran pesanan khusus dengan persetujuan. Jangan minta OTP, kuki, token sesi atau maklumat sulit melalui chat, nota atau bukti penghantaran.',
      'Jika akses tamat atau tindakan pelanggan diperlukan, pilih Tunggu pelanggan atau Semak dan hubungi melalui hubungan pesanan berizin. Jangan salin atau simpan maklumat sulit yang dibuka.',
      'Selepas tambah nilai disahkan, simpan rujukan tanpa data sensitif dan tandakan selesai. Aplikasi memadam rahsia aktif pesanan apabila selesai; pengekalan backup ialah kawalan operasi berasingan.',
    ] },
    { title: 'Masalah, bayaran balik dan sejarah', steps: [
      'Bayaran menunggu, tamat atau dibatalkan: jangan hantar pesanan. Jika pelanggan mendakwa telah membayar, padankan melalui proses pengesahan bayaran yang tersedia sebelum tindakan penghantaran.',
      'Hasil yang belum pasti bukan kejayaan. Muat semula invois yang sama, semak aktiviti dan sejarah penyedia, kemudian pilih Semak jika perlu. Jangan ulang pembelian atau pindahan yang hasilnya belum pasti.',
      'Bayaran balik diproses secara berasingan. Tandakan selesai hanya selepas refund sebenar dan rujukannya disahkan. Butang bayaran balik merekodkan hasil; butang itu tidak menghantar wang.',
      'Arkibkan pesanan selesai yang layak atau pesanan belum berbayar yang tamat/dibatalkan selepas semua kewajipan stok, akses akaun dan penghantaran selesai. Pesanan meninggalkan senarai aktif dan boleh dipulihkan. Bayaran lewat yang disahkan membukanya semula untuk semakan. Pembuangan invois terarkib mengekalkan sejarah kewangan dan akses invois pelanggan; ikuti pengesahan pada skrin.',
    ] },
  ],
};
export const adminGuideTranslations = { ID: id, EN: en, MY: my };
