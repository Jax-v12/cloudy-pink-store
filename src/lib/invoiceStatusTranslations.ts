const en = {
  queued: 'Payment received. Your order is queued for delivery. No additional payment is needed.',
  processing: 'Payment received. Our team is processing your delivery.',
  waitingCustomer: 'Payment received. Delivery is waiting for your action. Follow the instructions or contact support with your invoice number.',
  completed: 'Payment received and delivery confirmed by our team.',
  review: 'Payment received. This order needs a manual review. Contact support with your invoice number; do not pay again.',
  accountReview: 'Payment received, but your account details are not available yet. Contact support with your invoice number; do not pay again.',
  refundRequired: 'A refund is required for this order. Contact support with your invoice number to follow its progress.',
  refundCompleted: 'The refund for this order has been recorded as completed.',
};
type Copy = typeof en;
const id: Copy = {
  queued: 'Pembayaran sudah diterima. Pesananmu masuk antrean pengiriman. Tidak perlu membayar lagi.',
  processing: 'Pembayaran sudah diterima. Tim sedang memproses pengiriman pesananmu.',
  waitingCustomer: 'Pembayaran sudah diterima. Pengiriman menunggu tindakanmu. Ikuti petunjuk atau hubungi bantuan dengan nomor invoice.',
  completed: 'Pembayaran sudah diterima dan pengiriman telah dikonfirmasi oleh tim.',
  review: 'Pembayaran sudah diterima. Pesanan ini perlu ditinjau oleh tim. Hubungi bantuan dengan nomor invoice; jangan membayar ulang.',
  accountReview: 'Pembayaran sudah diterima, tetapi detail akun belum tersedia. Hubungi bantuan dengan nomor invoice; jangan membayar ulang.',
  refundRequired: 'Pesanan ini memerlukan pengembalian dana. Hubungi bantuan dengan nomor invoice untuk mengetahui perkembangannya.',
  refundCompleted: 'Pengembalian dana untuk pesanan ini telah dicatat selesai.',
};
const my: Copy = {
  queued: 'Bayaran telah diterima. Pesanan anda berada dalam giliran penghantaran. Tidak perlu membayar lagi.',
  processing: 'Bayaran telah diterima. Pasukan sedang memproses penghantaran pesanan anda.',
  waitingCustomer: 'Bayaran telah diterima. Penghantaran menunggu tindakan anda. Ikuti arahan atau hubungi sokongan dengan nombor invois.',
  completed: 'Bayaran telah diterima dan penghantaran telah disahkan oleh pasukan.',
  review: 'Bayaran telah diterima. Pesanan ini memerlukan semakan pasukan. Hubungi sokongan dengan nombor invois; jangan bayar semula.',
  accountReview: 'Bayaran telah diterima, tetapi butiran akaun belum tersedia. Hubungi sokongan dengan nombor invois; jangan bayar semula.',
  refundRequired: 'Pesanan ini memerlukan bayaran balik. Hubungi sokongan dengan nombor invois untuk mengetahui perkembangannya.',
  refundCompleted: 'Bayaran balik bagi pesanan ini telah direkodkan selesai.',
};
export const invoiceStatusTranslations = { ID: id, EN: en, MY: my };
