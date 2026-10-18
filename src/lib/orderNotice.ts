type InvoiceState = {
  type: 'APPS' | 'GAME' | 'ROBLOX';
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  fulfillmentStatus: 'NOT_READY' | 'QUEUED' | 'PROCESSING' | 'WAITING_CUSTOMER' | 'COMPLETED' | 'REQUIRES_REVIEW';
  refundStatus: 'NONE' | 'REQUIRED' | 'COMPLETED';
  account: unknown | null;
  qrisUrl: string | null;
};

/** Display only server-reported milestones; payment alone never completes a top-up. */
export function orderProgress(order: Pick<InvoiceState, 'type' | 'status' | 'fulfillmentStatus' | 'refundStatus' | 'account'>): {
  stage: 'payment' | 'queued' | 'processing' | 'completed' | null;
  message: 'pending' | 'queued' | 'processing' | 'completed' | 'waitingCustomer' | 'review' | 'preparing' | 'accountReady' | 'expired' | 'cancelled' | 'refundRequired' | 'refundCompleted';
} {
  if (order.refundStatus === 'COMPLETED') return { stage: null, message: 'refundCompleted' };
  if (order.refundStatus === 'REQUIRED') return { stage: null, message: 'refundRequired' };
  if (order.status === 'EXPIRED') return { stage: null, message: 'expired' };
  if (order.status === 'CANCELLED') return { stage: null, message: 'cancelled' };
  if (order.status === 'PENDING') return { stage: 'payment', message: 'pending' };
  if (order.fulfillmentStatus === 'REQUIRES_REVIEW') return { stage: null, message: 'review' };
  if (order.type === 'APPS') return order.account
    ? { stage: 'completed', message: 'accountReady' }
    : { stage: 'processing', message: 'preparing' };
  switch (order.fulfillmentStatus) {
    case 'QUEUED': return { stage: 'queued', message: 'queued' };
    case 'PROCESSING': return { stage: 'processing', message: 'processing' };
    case 'WAITING_CUSTOMER': return { stage: 'processing', message: 'waitingCustomer' };
    case 'COMPLETED': return { stage: 'completed', message: 'completed' };
    default: return { stage: null, message: 'review' };
  }
}

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

export function showFulfillmentDetails(order: Pick<InvoiceState, 'status' | 'refundStatus'>): boolean {
  return order.status === 'PAID' || order.refundStatus !== 'NONE';
}

export function formatQrCountdown(expiresAt: string | Date | null | undefined, nowMs = Date.now()): string | null {
  const target = expiresAt instanceof Date ? expiresAt.getTime() : typeof expiresAt === 'string' ? Date.parse(expiresAt) : NaN;
  if (!Number.isFinite(target) || !Number.isFinite(nowMs)) return null;
  const totalSeconds = Math.max(0, Math.floor((target - nowMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':');
}
