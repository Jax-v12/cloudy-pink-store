import { prisma } from './prisma';
import { encryptData, decryptData } from './crypto';
import { normalizeWhatsapp } from './loginContact';
import { CommerceError } from './commerce';
import { requireCurrentSession } from './adminMutation';
import { InputError } from './http';

type Window = { daysBefore: number; periodEnd: Date; dueAt: Date; expiresAt: Date };
export function reminderWindows(end: Date): Window[] {
  return [3, 1].map(daysBefore => ({ daysBefore, periodEnd: end,
    dueAt: new Date(end.getTime() - daysBefore * 86400_000), expiresAt: new Date(end.getTime() - (daysBefore - 1) * 86400_000) }));
}
type Service = { reminderOptIn: boolean; reminderPhone: string | null; reminderVerifiedAt: Date | null; activeUntil: Date | null };
type Order = { type: string; status: string; refundStatus: string; fulfillmentStatus: string; archivedAt: Date | null; removedFromAdminAt: Date | null };
export function reminderEligible(order: Order, service: Service, window: Window, now: Date): boolean {
  return order.type === 'APPS' && order.status === 'PAID' && order.refundStatus === 'NONE' && order.fulfillmentStatus === 'COMPLETED' &&
    !order.archivedAt && !order.removedFromAdminAt && service.reminderOptIn && !!service.reminderPhone && !!service.reminderVerifiedAt &&
    service.activeUntil?.getTime() === window.periodEnd.getTime() && now >= window.dueAt && now < window.expiresAt;
}
export function whatsappReady(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.WHATSAPP_REMINDERS_ENABLED === 'true' && !!env.WHATSAPP_ACCESS_TOKEN && !/[\r\n]/.test(env.WHATSAPP_ACCESS_TOKEN) &&
    /^\d{5,32}$/.test(env.WHATSAPP_PHONE_NUMBER_ID || '') && /^[a-z0-9_]{1,128}$/.test(env.WHATSAPP_TEMPLATE_NAME || '') && /^v\d{1,3}\.\d{1,2}$/.test(env.WHATSAPP_GRAPH_VERSION || '');
}
type Message = { phone: string; language: string; daysBefore: number; periodEnd: Date };
export async function sendWhatsappReminder(message: Message, env = process.env, request = fetch): Promise<'ACCEPTED' | 'REJECTED' | 'UNKNOWN'> {
  if (!whatsappReady(env)) throw new Error('WHATSAPP_UNAVAILABLE');
  if (!normalizeWhatsapp(message.phone) || ![3, 1].includes(message.daysBefore) || !['ID', 'EN', 'MY'].includes(message.language) || !Number.isFinite(message.periodEnd.getTime())) throw new InputError();
  try {
    const response = await request(`https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000), cache: 'no-store',
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: message.phone.slice(1), type: 'template', template: {
        name: env.WHATSAPP_TEMPLATE_NAME, language: { code: ({ ID: 'id', EN: 'en', MY: 'ms' } as Record<string, string>)[message.language] },
        components: [{ type: 'body', parameters: [String(message.daysBefore), message.periodEnd.toISOString().slice(0, 10)].map(text => ({ type: 'text', text })) }],
      } }),
    });
    // Retain no provider payload or message/recipient identifier. Bound response bytes.
    const reader = response.body?.getReader(); if (!reader) return 'UNKNOWN';
    const chunks: Uint8Array[] = []; let bytes = 0;
    try { while (true) { const { value, done } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 16384) { await reader.cancel(); return 'UNKNOWN'; } chunks.push(value); } }
    finally { reader.releaseLock(); }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (response.ok && Array.isArray(body.messages) && body.messages.length === 1 && typeof body.messages[0]?.id === 'string' && body.messages[0].id.length <= 512) return 'ACCEPTED';
    return !response.ok && response.status >= 400 && response.status < 500 && body.error && !body.messages ? 'REJECTED' : 'UNKNOWN';
  } catch { return 'UNKNOWN'; }
}

// Invoice callers establish ownership; admin actions require recent reauthentication again under the Order lock.
export async function setAppsReminder(orderId: number, input: { enabled: boolean; phone?: unknown; language?: unknown; consent?: unknown }) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id=${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { appsService: true } });
    const service = order?.appsService;
    if (!order || order.type !== 'APPS' || !service) throw new CommerceError('ORDER_NOT_AVAILABLE');
    if (input.enabled) {
      if (!whatsappReady()) throw new CommerceError('WHATSAPP_UNAVAILABLE', 503);
      if (order.status !== 'PAID' || order.refundStatus !== 'NONE' || order.fulfillmentStatus !== 'COMPLETED' || order.archivedAt || order.removedFromAdminAt || !service.activeUntil || service.activeUntil <= new Date()) throw new CommerceError('ORDER_NOT_AVAILABLE');
      const phone = normalizeWhatsapp(input.phone);
      if (!phone || input.consent !== true || !['ID', 'EN', 'MY'].includes(String(input.language))) throw new InputError();
      await tx.appsService.update({ where: { orderId }, data: { reminderOptIn: true, reminderPhone: encryptData(phone), reminderConsentAt: new Date(), reminderVerifiedAt: null, reminderLanguage: String(input.language) } });
    } else {
      await tx.appsService.update({ where: { orderId }, data: { reminderOptIn: false, reminderPhone: null, reminderVerifiedAt: null } });
    }
    await tx.adminAudit.create({ data: { orderId, sessionId: 'invoice-owner', action: input.enabled ? 'apps-reminder-consented-v1' : 'apps-reminder-opted-out' } });
  });
}

export async function adminAppsReminder(orderId: number, sessionId: string, action: 'reminder-contact' | 'reminder-verify', evidence?: unknown, consentAt?: unknown) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id=${orderId} FOR UPDATE`;
    await requireCurrentSession(tx, sessionId, true);
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { appsService: true } });
    const service = order?.appsService;
    if (!order || order.type !== 'APPS' || order.status !== 'PAID' || order.refundStatus !== 'NONE' || order.archivedAt || order.removedFromAdminAt || !service?.reminderOptIn || !service.reminderPhone || !service.activeUntil || service.activeUntil <= new Date()) throw new CommerceError('ORDER_NOT_AVAILABLE');
    if (action === 'reminder-verify') {
      if (typeof evidence !== 'string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(evidence)) throw new InputError();
      if (typeof consentAt !== 'string' || service.reminderConsentAt?.toISOString() !== consentAt) throw new CommerceError('INVALID_TRANSITION');
      await tx.appsService.update({ where: { orderId }, data: { reminderVerifiedAt: new Date() } });
    }
    await tx.adminAudit.create({ data: { orderId, sessionId, action: action === 'reminder-contact' ? 'apps-reminder-contact-viewed' : `apps-reminder-verified:${evidence}` } });
    return action === 'reminder-contact' ? { orderId, recipientPhone: decryptData(service.reminderPhone), consentAt: service.reminderConsentAt?.toISOString(), displayUntil: new Date(Date.now() + 60000).toISOString() } : null;
  });
}

export async function runAppsReminders() {
  // Count uncertainty immediately: a cron retry must not turn a timeout green.
  const reviewCount = () => prisma.appsReminder.count({ where: { status: { in: ['REJECTED', 'UNKNOWN'] } } });
  if (!whatsappReady()) return { configured: false, attempted: 0, accepted: 0, review: await reviewCount() };
  const now = new Date();
  const services = await prisma.appsService.findMany({ where: { reminderOptIn: true, reminderVerifiedAt: { not: null },
    order: { type: 'APPS', status: 'PAID', refundStatus: 'NONE', fulfillmentStatus: 'COMPLETED', archivedAt: null, removedFromAdminAt: null },
    OR: [3, 1].map(days => ({ activeUntil: { gt: new Date(now.getTime() + (days - 1) * 86400_000), lte: new Date(now.getTime() + days * 86400_000) }, reminders: { none: { daysBefore: days } } })),
  }, orderBy: [{ activeUntil: 'asc' }, { orderId: 'asc' }], take: 20 });
  const result = { configured: true, attempted: 0, accepted: 0, review: 0 };
  for (const service of services) {
    for (const window of reminderWindows(service.activeUntil!)) {
      if (now < window.dueAt || now >= window.expiresAt) continue;
      const message = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id=${service.orderId} FOR UPDATE`;
        const order = await tx.order.findUnique({ where: { id: service.orderId }, include: { appsService: true } });
        if (!order?.appsService || !reminderEligible(order, order.appsService, window, new Date())) return null;
        // An attempted row is permanent: timeout/crash/uncertain commit must never resend.
        const job = await tx.appsReminder.upsert({ where: { orderId_daysBefore_periodEnd: { orderId: order.id, daysBefore: window.daysBefore, periodEnd: window.periodEnd } }, create: { orderId: order.id, ...window }, update: {} });
        if (job.status !== 'PENDING' || job.attemptedAt) return null;
        const phone = decryptData(order.appsService.reminderPhone!);
        await tx.appsReminder.update({ where: { id: job.id }, data: { status: 'UNKNOWN', attemptedAt: new Date() } });
        return { id: job.id, phone, language: order.appsService.reminderLanguage, ...window };
      });
      if (!message) continue;
      result.attempted++;
      // Provider calls stay outside transactions. Cancellation cannot recall an in-flight request.
      const outcome = await sendWhatsappReminder(message);
      await prisma.appsReminder.updateMany({ where: { id: message.id, status: 'UNKNOWN' }, data: { status: outcome, acceptedAt: outcome === 'ACCEPTED' ? new Date() : null } });
      if (outcome === 'ACCEPTED') result.accepted++; else result.review++;
      if (result.attempted >= 3) return { ...result, review: Math.max(result.review, await reviewCount()) };
    }
  }
  return { ...result, review: Math.max(result.review, await reviewCount()) };
}

export async function purgeAppsReminderContacts() {
  const rows = await prisma.appsService.findMany({ where: { reminderPhone: { not: null }, OR: [{ reminderOptIn: false }, { activeUntil: { lte: new Date() } }, { order: { refundStatus: { not: 'NONE' } } }, { order: { archivedAt: { not: null } } }, { order: { removedFromAdminAt: { not: null } } }] }, select: { orderId: true }, take: 100, orderBy: { orderId: 'asc' } });
  for (const row of rows) await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id=${row.orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: row.orderId }, include: { appsService: true } });
    const s = order?.appsService;
    if (order && s?.reminderPhone && (!s.reminderOptIn || !s.activeUntil || s.activeUntil <= new Date() || order.refundStatus !== 'NONE' || order.archivedAt || order.removedFromAdminAt)) {
      await tx.appsService.update({ where: { orderId: row.orderId }, data: { reminderPhone: null, reminderOptIn: false, reminderVerifiedAt: null } });
      await tx.adminAudit.create({ data: { orderId: row.orderId, sessionId: 'system-cleanup', action: 'apps-reminder-contact-purged' } });
    }
  });
  return rows.length;
}
