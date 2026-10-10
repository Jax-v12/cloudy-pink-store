import { NextResponse } from 'next/server';
import { ProductType, FulfillmentStatus, OrderStatus, RobloxMethod, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { adminAccess } from '@/lib/adminAccess';
import { apiError } from '@/lib/apiError';
import { InputError, pagination, pageResult, privateHeaders } from '@/lib/http';
import { archiveEligibility, removeEligibility } from '@/lib/orderArchive';

export async function GET(req: Request) {
  try {
    const session = await adminAccess(req);
    const { limit, cursor } = pagination(req);
    const query = new URL(req.url).searchParams;
    const archive = query.get('archive') ?? 'active';
    if (!['active', 'archived', 'removed', 'all'].includes(archive)) throw new InputError();
    const type = query.get('type'); const status = query.get('status');
    const method = query.get('method'); const payment = query.get('payment'); const search = (query.get('q') || '').trim();
    if (search.length > 120) throw new InputError();
    if (method && (!Object.values(RobloxMethod).includes(method as RobloxMethod) || (type && type !== 'ROBLOX'))) throw new InputError();
    if (payment && !Object.values(OrderStatus).includes(payment as OrderStatus)) throw new InputError();
    if (type && !Object.values(ProductType).includes(type as ProductType)) throw new InputError();
    if (status && !Object.values(FulfillmentStatus).includes(status as FulfillmentStatus)) throw new InputError();
    const filters: Prisma.OrderWhereInput = {
      ...(type ? { type: type as ProductType } : {}),
      ...(status ? { fulfillmentStatus: status as FulfillmentStatus } : {}),
      ...(method ? { robloxDetail: { is: { method: method as RobloxMethod } } } : {}),
      ...(payment ? { status: payment as OrderStatus } : {}),
      ...(search ? { OR: [{ invoice: { contains: search } }, { customerEmail: { contains: search } }, { robloxDetail: { is: { username: { contains: search } } } }] } : {}),
    };
    const archiveFilter = archive === 'active' ? { archivedAt: null, removedFromAdminAt: null } : archive === 'archived' ? { archivedAt: { not: null }, removedFromAdminAt: null } : archive === 'removed' ? { removedFromAdminAt: { not: null } } : { removedFromAdminAt: null };
    const rows = await prisma.order.findMany({ where: { ...filters, ...archiveFilter, ...(cursor ? { id: { lt: cursor } } : {}) }, take: limit + 1, orderBy: { id: 'desc' }, select: {
      id: true, invoice: true, type: true, status: true, fulfillmentStatus: true, refundStatus: true,
      archivedAt: true, removedFromAdminAt: true, secret: { select: { orderId: true } }, accountStock: { select: { status: true } },
      customerEmail: true, totalAmount: true, currency: true, pricingRegion: true, productName: true, variantName: true, units: true, createdAt: true,
      paymentMethod: true,
      robloxDetail: true, gameDetail: true,
      job: { select: { completedAt: true, leaseToken: true, leaseUntil: true, ownerSessionId: true, evidence: true, attempts: { take: 10, orderBy: { id: 'desc' }, select: { id: true, operation: true, outcome: true, createdAt: true } } } },
      audits: { take: 10, orderBy: { id: 'desc' }, select: { id: true, action: true, createdAt: true } },
    } });
    const page = pageResult(rows, limit);
    const [heartbeat, reviewCount, pendingCount] = await Promise.all([
      prisma.workerHeartbeat.findUnique({ where: { name: 'fulfillment' } }),
      prisma.order.count({ where: { AND: [filters, { archivedAt: null, removedFromAdminAt: null, fulfillmentStatus: 'REQUIRES_REVIEW' }] } }),
      prisma.order.count({ where: { AND: [filters, { archivedAt: null, removedFromAdminAt: null, fulfillmentStatus: { in: ['QUEUED', 'PROCESSING', 'WAITING_CUSTOMER'] } }] } }),
    ]);
    return NextResponse.json({ success: true, ...page, data: page.data.map(({ customerEmail, secret, accountStock, ...row }) => ({ ...row, ...archiveEligibility({ ...row, secret, accountStock }), ...removeEligibility({ ...row, secret, accountStock }), contactEmail: row.status === 'PAID' && row.job?.ownerSessionId === session.id ? customerEmail : null, owned: row.job?.ownerSessionId === session.id,
      job: row.job ? { evidence: row.job.evidence, attempts: row.job.attempts } : null })),
      monitoring: { lastRun: heartbeat?.succeededAt ?? null, overdue: !heartbeat || Date.now() - heartbeat.succeededAt.getTime() > 180_000, reviewCount, pendingCount },
    }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}
