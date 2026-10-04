type InvoiceState = {
  type: 'APPS' | 'GAME' | 'ROBLOX';
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  fulfillmentStatus: 'NOT_READY' | 'QUEUED' | 'PROCESSING' | 'WAITING_CUSTOMER' | 'COMPLETED' | 'REQUIRES_REVIEW';
  refundStatus: 'NONE' | 'REQUIRED' | 'COMPLETED';
  account: unknown | null;
  qrisUrl: string | null;
};

/** Payment and delivery are independent: top-ups never require an Apps account stock. */
export function orderNotice(order: InvoiceState) {
  if (order.refundStatus === 'COMPLETED') return 'refundCompleted';
  if (order.refundStatus === 'REQUIRED') return 'refundRequired';
  if (order.status === 'PENDING') return order.qrisUrl ? null : 'paymentPending';
  if (order.status !== 'PAID') return null;
  if (order.fulfillmentStatus === 'REQUIRES_REVIEW') return 'review';
  if (order.type === 'APPS') return order.account ? null : 'accountReview';
  const notices = {
    NOT_READY: 'review', QUEUED: 'queued', PROCESSING: 'processing',
    WAITING_CUSTOMER: 'waitingCustomer', COMPLETED: 'completed',
  } as const;
  return notices[order.fulfillmentStatus];
}
