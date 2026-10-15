import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const ensure = (condition, code) => { if (!condition) throw new Error(code); };
const fail = code => { throw new Error(code); };

export function workerArguments(cases = []) {
  ensure(Array.isArray(cases) && cases.length <= 4 && cases.every(name => typeof name === 'string' && name.length <= 160 && /^[A-Za-z0-9 ,_/+()-]+$/.test(name)), 'STAGING_CASE_REJECTED');
  const filter = cases.length ? ['--test-name-pattern=^staging: (?:' + cases.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')$'] : [];
  return ['--import', new URL('./register.mjs', import.meta.url).href, '--test', '--test-concurrency=1', ...filter, '--test-reporter=' + new URL('./reporter.mjs', import.meta.url).href, fileURLToPath(new URL('./checkout.integration.mjs', import.meta.url))];
}

export function stagingTarget(input) {
  let url;
  try { url = new URL(input); } catch { fail('STAGING_TARGET_REJECTED'); }
  const keys = [...url.searchParams.keys()];
  ensure(url.protocol === 'mysql:' && url.hostname.startsWith('mysql-26d9d666-') && url.hostname.endsWith('.aivencloud.com') && url.pathname === '/cloudy_staging' && url.username && url.password && !url.hash && new Set(keys).size === keys.length && keys.every(key => ['ssl-mode', 'sslaccept', 'sslcert'].includes(key)) && (!url.searchParams.has('ssl-mode') || url.searchParams.get('ssl-mode') === 'REQUIRED') && (!url.searchParams.has('sslaccept') || url.searchParams.get('sslaccept') === 'strict'), 'STAGING_TARGET_REJECTED');
  return url;
}

export function writeApproval(runId, approval) {
  ensure(typeof runId === 'string' && uuid.test(runId), 'STAGING_RUN_ID_INVALID');
  ensure(approval === `cloudy_staging:${runId}`, 'STAGING_WRITE_APPROVAL_REQUIRED');
  return true;
}

export function isolatedEnvironment(source) {
  const result = {};
  for (const key of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'PATH', 'Path', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC']) if (source[key]) result[key] = source[key];
  return result;
}

export function fixtureScope(runId, writable = false) {
  ensure(uuid.test(runId), 'STAGING_RUN_ID_INVALID');
  const hex = runId.replaceAll('-', '').toLowerCase();
  const scope = {
    runId, writable, namespace: `stg-it-${hex}`, email: `${hex}@staging.invalid`, username: `Stg${hex.slice(0, 16)}`,
    source: `2001:db8:${hex.match(/.{4}/g).slice(0, 6).join(':')}`,
    products: new Set(), variants: new Set(), regionalPairs: new Set(), sessions: new Set(), createdSessions: new Set(), hashes: new Set(), flows: new Set(), attempts: new Set(), keys: new Set(), orders: new Set(), invoices: new Set(), rateLimits: new Set(), faults: {},
  };
  scope.rateSource = new URL(`http://[${scope.source}]`).hostname;
  scope.sessionId = () => { ensure(scope.sessions.size < 40, 'STAGING_FIXTURE_BUDGET_EXCEEDED'); const id = crypto.randomUUID(); scope.sessions.add(id); scope.journal?.(); return id; };
  scope.flowId = () => { ensure(scope.flows.size < 80, 'STAGING_FIXTURE_BUDGET_EXCEEDED'); const id = crypto.randomUUID(); scope.flows.add(id); return id; };
  scope.key = () => { const id = crypto.randomUUID(); scope.keys.add(id); return id; };
  scope.cookie = () => { const value = crypto.randomBytes(32).toString('base64url'); scope.hashes.add(crypto.createHash('sha256').update(value).digest('hex')); return value; };
  return scope;
}

function belongs(set, value) {
  return set.has(value) || Boolean(value && Array.isArray(value.in) && value.in.length && value.in.every(item => set.has(item)));
}

function scopedWhere(model, where, scope) {
  if (!where || typeof where !== 'object') return false;
  const sets = {
    product: { id: scope.products }, productVariant: { id: scope.variants, productId: scope.products }, regionalPrice: { variantId: scope.variants },
    checkoutSession: { id: scope.sessions, tokenHash: scope.hashes }, checkoutAttempt: { id: scope.attempts, sessionId: scope.sessions, checkoutKey: scope.keys },
    order: { id: scope.orders, productId: scope.products, invoice: scope.invoices, checkoutKey: scope.keys }, robloxOrderDetail: { orderId: scope.orders }, rateLimit: { id: scope.rateLimits },
  };
  if (Object.entries(sets[model] || {}).some(([key, values]) => belongs(values, where[key]))) return true;
  if (model === 'checkoutAttempt' && scope.sessions.has(where.sessionId_flowId?.sessionId) && scope.flows.has(where.sessionId_flowId?.flowId)) return true;
  if (model === 'regionalPrice' && scope.variants.has(where.variantId_region?.variantId) && ['ID', 'MY', 'PH'].includes(where.variantId_region?.region)) return true;
  if (Array.isArray(where.AND) && where.AND.some(clause => scopedWhere(model, clause, scope))) return true;
  return Array.isArray(where.OR) && where.OR.length > 0 && where.OR.every(clause => scopedWhere(model, clause, scope));
}

function rateIdAllowed(id, scope) {
  const keys = {
    'checkout-bootstrap-source': [scope.rateSource], 'checkout-bootstrap-locator': [...scope.sessions],
    ...Object.fromEntries(['open', 'confirm', 'recover'].flatMap(operation => [[`attempt-${operation}-source`, [scope.rateSource]], [`attempt-${operation}-session`, [...scope.sessions]]])),
  };
  return Object.entries(keys).some(([name, values]) => values.some(key => [-1, 0, 1].some(offset => {
    const width = name.startsWith('checkout-bootstrap') || name.includes('recover') ? 60000 : 900000;
    const window = Math.floor(Date.now() / width) + offset;
    return id === `${name}:${crypto.createHash('sha256').update(`${name}:${key}:${window}`).digest('hex')}`;
  })));
}

function validateData(model, operation, data, scope) {
  if (Array.isArray(data)) { for (const entry of data) validateData(model, operation, entry, scope); return; }
  ensure(data && typeof data === 'object', 'STAGING_DATA_REJECTED');
  const creating = operation === 'create' || operation === 'createMany';
  const fields = {
    product: creating ? ['slug', 'name', 'price', 'type', 'active', 'category'] : ['active'],
    productVariant: creating ? ['productId', 'name', 'price', 'units', 'method', 'active', 'maxUnits', 'unitStep', 'capacityCheckedAt'] : ['price', 'active', 'capacityCheckedAt'],
    regionalPrice: creating ? ['variantId', 'region', 'amount', 'active'] : ['amount', 'active'],
    checkoutSession: creating ? ['id', 'tokenHash', 'createdAt', 'expiresAt', 'revokedAt'] : ['createdAt', 'expiresAt', 'revokedAt'],
    checkoutAttempt: creating ? ['sessionId', 'flowId', 'productId', 'variantId', 'checkoutKey', 'expiresAt', 'createdAt'] : ['state', 'version', 'variantId', 'requestHash', 'quoteSnapshot', 'leaseUntil', 'expiresAt', 'orderId'],
    order: creating ? ['invoice', 'productId', 'type', 'productName', 'variantName', 'units', 'totalAmount', 'currency', 'pricingRegion', 'productSubtotal', 'paymentFee', 'discount', 'paymentProvider', 'paymentMethod', 'customerEmail', 'accountStockId', 'checkoutKey', 'requestHash', 'expiresAt', 'robloxDetail'] : ['status', 'archivedAt', 'removedFromAdminAt'],
    rateLimit: creating ? ['id', 'points', 'expiresAt'] : ['points'],
  };
  ensure(fields[model] && Object.keys(data).every(key => fields[model].includes(key)), 'STAGING_DATA_REJECTED');
  if (creating) {
    if (model === 'product') ensure(data.slug?.startsWith(scope.namespace + '-') && data.name?.startsWith(scope.namespace) && data.type === 'ROBLOX' && data.price === 0, 'STAGING_DATA_REJECTED');
    if (model === 'productVariant') ensure(scope.products.has(data.productId) && data.name?.startsWith(scope.namespace) && ['LOGIN', 'GAMEPASS', 'GIFT_USERNAME'].includes(data.method), 'STAGING_DATA_REJECTED');
    if (model === 'regionalPrice') ensure(scope.variants.has(data.variantId) && ['ID', 'MY', 'PH'].includes(data.region), 'STAGING_DATA_REJECTED');
    if (model === 'rateLimit') ensure(rateIdAllowed(data.id, scope), 'STAGING_DATA_REJECTED');
    if (model === 'checkoutSession') ensure(scope.sessions.has(data.id) && /^[a-f\d]{64}$/.test(data.tokenHash), 'STAGING_DATA_REJECTED');
    if (model === 'checkoutAttempt') ensure(scope.sessions.has(data.sessionId) && scope.flows.has(data.flowId) && scope.products.has(data.productId) && scope.variants.has(data.variantId) && uuid.test(data.checkoutKey), 'STAGING_DATA_REJECTED');
    if (model === 'order') {
      ensure(scope.products.has(data.productId) && scope.keys.has(data.checkoutKey) && data.customerEmail === scope.email && data.type === 'ROBLOX' && data.accountStockId === null && /^INV-[a-f\d-]{36}$/.test(data.invoice), 'STAGING_DATA_REJECTED');
      const detail = data.robloxDetail?.create;
      ensure(data.robloxDetail && Object.keys(data.robloxDetail).length === 1 && detail && detail.username === scope.username && ['LOGIN', 'GAMEPASS', 'GIFT_USERNAME'].includes(detail.method) && Object.keys(detail).every(key => ['method', 'username', 'robloxUserId', 'displayName', 'whatsappE164', 'gamepassUrl', 'gamepassPrice', 'gamepassId', 'gamepassVerifiedAt'].includes(key)), 'STAGING_DATA_REJECTED');
      if (detail.method === 'LOGIN') ensure(/^[a-f\d]{32}:[a-f\d]{32}:[a-f\d]+$/.test(detail.whatsappE164), 'STAGING_DATA_REJECTED');
    }
  }
  if ('orderId' in data && data.orderId !== null) ensure(scope.orders.has(data.orderId), 'STAGING_DATA_REJECTED');
  if (model === 'checkoutAttempt' && !creating && 'variantId' in data) ensure(scope.variants.has(data.variantId), 'STAGING_DATA_REJECTED');
  if (model === 'order' && !creating && 'status' in data) ensure(data.status === 'CANCELLED', 'STAGING_DATA_REJECTED');
}

function ownResult(model, row, scope) {
  if (!row) return;
  const set = { product: 'products', productVariant: 'variants', checkoutSession: 'sessions', checkoutAttempt: 'attempts', order: 'orders' }[model];
  if (set) scope[set].add(row.id);
  if (model === 'checkoutSession') { scope.hashes.add(row.tokenHash); scope.createdSessions.add(row.id); }
  if (model === 'checkoutAttempt') scope.keys.add(row.checkoutKey);
  if (model === 'order') scope.invoices.add(row.invoice);
  if (model === 'regionalPrice') scope.regionalPairs.add(`${row.variantId}:${row.region}`);
  scope.journal?.();
}

// A forwarding boundary, not a fake DB: locks, constraints, commits and rollbacks
// are executed by the actual PrismaClient and its actual transaction clients.
export function guardedClient(client, scope, transaction = null) {
  const models = ['product', 'productVariant', 'regionalPrice', 'checkoutSession', 'checkoutAttempt', 'order', 'robloxOrderDetail', 'rateLimit'];
  return new Proxy({}, { get(_target, key) {
    if (key === 'then') return undefined;
    if (key === '$transaction') return async (callback, options) => {
      ensure(typeof callback === 'function', 'STAGING_OPERATION_REJECTED');
      const state = { committedAttempt: false };
      const result = await client.$transaction(tx => callback(guardedClient(tx, scope, state)), options);
      if (state.committedAttempt && scope.faults.loseCommitAckOnce) {
        scope.faults.loseCommitAckOnce = false;
        throw Object.assign(new Error('STAGING_INJECTED_LOST_ACK'), { code: 'P1017' });
      }
      return result;
    };
    if (key === '$queryRaw') return async (strings, ...values) => {
      const sql = Array.isArray(strings) && strings.raw ? strings.join('?').replace(/\s+/g, ' ').trim() : '';
      const valid = sql === 'SELECT CURRENT_TIMESTAMP(3) AS now' && values.length === 0 ||
        sql === 'SELECT id FROM `CheckoutSession` WHERE id = ? FOR UPDATE' && values.length === 1 && scope.createdSessions.has(values[0]) ||
        sql === 'SELECT id FROM `Product` WHERE id = ? FOR UPDATE' && values.length === 1 && scope.products.has(values[0]) ||
        sql === 'SELECT id FROM `CheckoutAttempt` WHERE sessionId = ? AND flowId = ? FOR UPDATE' && values.length === 2 && scope.createdSessions.has(values[0]) && scope.flows.has(values[1]);
      ensure(valid, 'STAGING_RAW_QUERY_REJECTED');
      ensure(scope.writable || !sql.includes('FOR UPDATE'), 'STAGING_WRITES_DISABLED');
      if (sql === 'SELECT id FROM `CheckoutSession` WHERE id = ? FOR UPDATE') scope.faults.onSessionLock?.();
      return client.$queryRaw(strings, ...values);
    };
    if (!models.includes(key)) return async () => fail('STAGING_OPERATION_REJECTED');
    return new Proxy({}, { get(_delegate, operation) { return async (args = {}) => {
      const reading = ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findMany', 'count'].includes(operation);
      const writing = ['create', 'createMany', 'update', 'updateMany', 'upsert', 'deleteMany'].includes(operation);
      ensure(reading || writing, 'STAGING_OPERATION_REJECTED');
      if (writing) ensure(scope.writable, 'STAGING_WRITES_DISABLED');
      if (operation === 'deleteMany') ensure(['checkoutAttempt', 'checkoutSession', 'rateLimit'].includes(key), 'STAGING_OPERATION_REJECTED');
      if (operation === 'createMany') ensure(key === 'regionalPrice' && Array.isArray(args.data) && args.data.length > 0 && args.data.length <= 3, 'STAGING_OPERATION_REJECTED');
      if (operation === 'create' && key === 'rateLimit') fail('STAGING_OPERATION_REJECTED');
      if (writing && !['create', 'createMany', 'upsert'].includes(operation) && key === 'checkoutSession') ensure(belongs(scope.createdSessions, args.where?.id), 'STAGING_FIXTURE_SCOPE_REJECTED');
      if (operation === 'deleteMany' && key === 'checkoutAttempt') ensure(belongs(scope.attempts, args.where?.id), 'STAGING_FIXTURE_SCOPE_REJECTED');
      const creating = ['create', 'createMany'].includes(operation);
      if (operation === 'create') {
        const limit = { product: [scope.products, 2], productVariant: [scope.variants, 4], checkoutSession: [scope.createdSessions, 32], checkoutAttempt: [scope.attempts, 40], order: [scope.orders, 16] }[key];
        if (limit) ensure(limit[0].size < limit[1], 'STAGING_FIXTURE_BUDGET_EXCEEDED');
      }
      if (creating && key === 'regionalPrice') {
        const rows = Array.isArray(args.data) ? args.data : [args.data];
        ensure(new Set([...scope.regionalPairs, ...rows.map(row => `${row?.variantId}:${row?.region}`)]).size <= 3, 'STAGING_FIXTURE_BUDGET_EXCEEDED');
      }
      if (!creating) {
        if (key === 'rateLimit' && operation === 'upsert' && rateIdAllowed(args.where?.id, scope) && !scope.rateLimits.has(args.where.id)) {
          const existing = await client.rateLimit.findUnique({ where: { id: args.where.id }, select: { id: true } });
          ensure(!existing || scope.rateLimits.has(args.where.id), 'STAGING_COUNTER_COLLISION');
          ensure(scope.rateLimits.size < 64, 'STAGING_FIXTURE_BUDGET_EXCEEDED');
          scope.rateLimits.add(args.where.id); scope.journal?.();
        }
        ensure(scopedWhere(key, args.where, scope), 'STAGING_FIXTURE_SCOPE_REJECTED');
      }
      if (writing && operation !== 'deleteMany') {
        if (operation === 'upsert') {
          ensure(key === 'rateLimit' && args.create?.id === args.where.id, 'STAGING_DATA_REJECTED');
          validateData(key, 'create', args.create, scope); validateData(key, 'update', args.update, scope);
        } else validateData(key, operation, args.data, scope);
      }
      if (key === 'checkoutAttempt' && operation === 'update' && args.data.state === 'COMMITTED' && scope.faults.failCommittedOnce) {
        scope.faults.failCommittedOnce = false;
        throw Object.assign(new Error('STAGING_INJECTED_ROLLBACK'), { code: 'P2028' });
      }
      const result = await client[key][operation](args);
      if (operation === 'create') ownResult(key, result, scope);
      if (operation === 'createMany' && key === 'regionalPrice') for (const row of args.data) scope.regionalPairs.add(`${row.variantId}:${row.region}`);
      if (transaction && key === 'checkoutAttempt' && operation === 'update' && args.data.state === 'COMMITTED') transaction.committedAttempt = true;
      return result;
    }; } });
  } });
}
