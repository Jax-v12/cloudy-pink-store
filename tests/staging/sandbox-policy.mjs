import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const ensure = (condition, code) => { if (!condition) throw new Error(code); };
const fail = code => { throw new Error(code); };

export function workerArguments(cases = []) {
  ensure(Array.isArray(cases) && cases.length <= 12 && cases.every(name => typeof name === 'string' && name.length <= 160 && /^[A-Za-z0-9 ,_/+()#.-]+$/.test(name)), 'SANDBOX_CASE_REJECTED');
  const filter = cases.length ? ['--test-name-pattern=^sandbox: (?:' + cases.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')$'] : [];
  return ['--import', new URL('./register.mjs', import.meta.url).href, '--test', '--test-concurrency=1', ...filter, '--test-reporter=' + new URL('./sandbox-reporter.mjs', import.meta.url).href, fileURLToPath(new URL('./sandbox.integration.mjs', import.meta.url))];
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
    runId, writable, namespace: `sbx-it-${hex}`, email: `${hex}@sandbox.invalid`, username: `Sbx${hex.slice(0, 16)}`,
    source: `2001:db8:${hex.match(/.{4}/g).slice(0, 6).join(':')}`,
    products: new Set(), variants: new Set(), regionalPairs: new Set(), sessions: new Set(), createdSessions: new Set(),
    hashes: new Set(), flows: new Set(), attempts: new Set(), keys: new Set(), orders: new Set(), invoices: new Set(),
    rateLimits: new Set(), fulfillmentJobs: new Set(), charges: [], faults: {},
  };
  scope.rateSource = new URL(`http://[${scope.source}]`).hostname;
  scope.sessionId = () => { ensure(scope.sessions.size < 12, 'SANDBOX_FIXTURE_BUDGET_EXCEEDED'); const id = crypto.randomUUID(); scope.sessions.add(id); scope.journal?.(); return id; };
  scope.flowId = () => { ensure(scope.flows.size < 24, 'SANDBOX_FIXTURE_BUDGET_EXCEEDED'); const id = crypto.randomUUID(); scope.flows.add(id); return id; };
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
    checkoutSession: { id: scope.sessions, tokenHash: scope.hashes }, checkoutAttempt: { id: scope.attempts, sessionId: scope.sessions, checkoutKey: scope.keys, orderId: scope.orders },
    order: { id: scope.orders, productId: scope.products, invoice: scope.invoices, checkoutKey: scope.keys }, robloxOrderDetail: { orderId: scope.orders },
    rateLimit: { id: scope.rateLimits }, fulfillmentJob: { orderId: scope.orders }, orderSecret: { orderId: scope.orders },
  };
  if (Object.entries(sets[model] || {}).some(([key, values]) => belongs(values, where[key]))) return true;
  if (model === 'checkoutAttempt' && scope.sessions.has(where.sessionId_flowId?.sessionId) && scope.flows.has(where.sessionId_flowId?.flowId)) return true;
  if (model === 'regionalPrice' && scope.variants.has(where.variantId_region?.variantId) && ['ID', 'MY', 'PH'].includes(where.variantId_region?.region)) return true;
  if (model === 'fulfillmentJob' && where.orderId && belongs(scope.orders, where.orderId)) return true;
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
  ensure(data && typeof data === 'object', 'SANDBOX_DATA_REJECTED');
  const creating = operation === 'create' || operation === 'createMany';
  const fields = {
    product: creating ? ['slug', 'name', 'price', 'type', 'active', 'category'] : ['active'],
    productVariant: creating ? ['productId', 'name', 'price', 'units', 'method', 'active', 'maxUnits', 'unitStep', 'capacityCheckedAt'] : ['price', 'active', 'capacityCheckedAt'],
    regionalPrice: creating ? ['variantId', 'region', 'amount', 'active'] : ['amount', 'active'],
    checkoutSession: creating ? ['id', 'tokenHash', 'createdAt', 'expiresAt', 'revokedAt'] : ['createdAt', 'expiresAt', 'revokedAt'],
    checkoutAttempt: creating ? ['sessionId', 'flowId', 'productId', 'variantId', 'checkoutKey', 'expiresAt', 'createdAt'] : ['state', 'version', 'variantId', 'requestHash', 'quoteSnapshot', 'leaseUntil', 'expiresAt', 'orderId'],
    order: creating ? ['invoice', 'productId', 'type', 'productName', 'variantName', 'units', 'totalAmount', 'currency', 'pricingRegion', 'productSubtotal', 'paymentFee', 'discount', 'paymentProvider', 'paymentMethod', 'customerEmail', 'accountStockId', 'checkoutKey', 'requestHash', 'expiresAt', 'robloxDetail'] : ['status', 'archivedAt', 'removedFromAdminAt', 'paymentReference', 'qrisUrl', 'fulfillmentStatus', 'refundStatus', 'accountStockId'],
    rateLimit: creating ? ['id', 'points', 'expiresAt'] : ['points'],
    fulfillmentJob: creating ? ['orderId', 'type', 'status', 'payload'] : ['status', 'payload'],
    orderSecret: creating ? ['orderId', 'secretType', 'encryptedData'] : [],
  };
  const invalidKeys = Object.keys(data).filter(key => !fields[model]?.includes(key));
  ensure(fields[model] && invalidKeys.length === 0, `SANDBOX_DATA_REJECTED_FIELDS_${model}_${invalidKeys.join(',')}`);
  if (creating) {
    if (model === 'product') ensure(data.slug?.startsWith(scope.namespace + '-') && data.name?.startsWith(scope.namespace) && data.type === 'ROBLOX' && data.price === 0, 'SANDBOX_DATA_REJECTED_PRODUCT');
    if (model === 'productVariant') ensure(scope.products.has(data.productId) && data.name?.startsWith(scope.namespace) && data.method === 'LOGIN' && data.price === 1000, 'SANDBOX_DATA_REJECTED_VARIANT');
    if (model === 'regionalPrice') ensure(scope.variants.has(data.variantId) && ['ID', 'MY', 'PH'].includes(data.region), 'SANDBOX_DATA_REJECTED_REGIONAL_PRICE');
    if (model === 'rateLimit') ensure(rateIdAllowed(data.id, scope), 'SANDBOX_DATA_REJECTED_RATE_LIMIT');
    if (model === 'checkoutSession') ensure(scope.sessions.has(data.id) && /^[a-f\d]{64}$/.test(data.tokenHash), 'SANDBOX_DATA_REJECTED_SESSION');
    if (model === 'checkoutAttempt') ensure(scope.sessions.has(data.sessionId) && scope.flows.has(data.flowId) && scope.products.has(data.productId) && scope.variants.has(data.variantId) && uuid.test(data.checkoutKey), 'SANDBOX_DATA_REJECTED_ATTEMPT');
    if (model === 'order') {
      ensure(scope.orders.size < 6, 'SANDBOX_ORDER_BUDGET_EXCEEDED');
      ensure(scope.products.has(data.productId) && scope.keys.has(data.checkoutKey) && data.customerEmail === scope.email && data.type === 'ROBLOX' && data.accountStockId === null && data.totalAmount === 1000 && data.currency === 'IDR' && data.pricingRegion === 'ID' && data.paymentProvider === 'MIDTRANS' && data.paymentMethod === 'QRIS' && /^INV-[a-f\d-]{36}$/.test(data.invoice), 'SANDBOX_DATA_REJECTED_ORDER_PROPERTIES');
      const detail = data.robloxDetail?.create;
      ensure(data.robloxDetail && Object.keys(data.robloxDetail).length === 1 && detail && detail.username === scope.username && detail.method === 'LOGIN' && Object.keys(detail).every(key => ['method', 'username', 'robloxUserId', 'displayName', 'whatsappE164', 'gamepassUrl', 'gamepassPrice', 'gamepassId', 'gamepassVerifiedAt'].includes(key)), 'SANDBOX_DATA_REJECTED_ROBLOX_DETAIL');
      if (detail.whatsappE164) ensure(/^[a-f\d]{32}:[a-f\d]{32}:[a-f\d]+$/.test(detail.whatsappE164), 'SANDBOX_DATA_REJECTED_WHATSAPP');
    }
    if (model === 'fulfillmentJob') {
      ensure(scope.orders.has(data.orderId), 'SANDBOX_DATA_REJECTED_FULFILLMENT_JOB');
    }
  }
  if ('orderId' in data && data.orderId !== null) ensure(scope.orders.has(data.orderId), 'SANDBOX_DATA_REJECTED_ORDER_ID');
  if (model === 'checkoutAttempt' && !creating && 'variantId' in data) ensure(scope.variants.has(data.variantId), 'SANDBOX_DATA_REJECTED_ATTEMPT_VARIANT');
  if (model === 'order' && !creating && 'status' in data) ensure(['PENDING', 'PAID', 'CANCELLED', 'EXPIRED'].includes(data.status), 'SANDBOX_DATA_REJECTED_ORDER_STATUS');
}

function ownResult(model, row, scope) {
  if (!row) return;
  const set = { product: 'products', productVariant: 'variants', checkoutSession: 'sessions', checkoutAttempt: 'attempts', order: 'orders', fulfillmentJob: 'fulfillmentJobs' }[model];
  if (set) scope[set].add(row.id || row.orderId);
  if (model === 'checkoutSession') { scope.hashes.add(row.tokenHash); scope.createdSessions.add(row.id); }
  if (model === 'checkoutAttempt') scope.keys.add(row.checkoutKey);
  if (model === 'order') scope.invoices.add(row.invoice);
  if (model === 'regionalPrice') scope.regionalPairs.add(`${row.variantId}:${row.region}`);
  scope.journal?.();
}

export function guardedClient(client, scope, transaction = null) {
  const models = ['product', 'productVariant', 'regionalPrice', 'checkoutSession', 'checkoutAttempt', 'order', 'robloxOrderDetail', 'rateLimit', 'fulfillmentJob', 'orderSecret'];
  return new Proxy({}, { get(_target, key) {
    if (key === 'then') return undefined;
    if (key === '$transaction') return async (callback, options) => {
      ensure(typeof callback === 'function', 'SANDBOX_OPERATION_REJECTED');
      const state = { committedAttempt: false };
      return client.$transaction(tx => callback(guardedClient(tx, scope, state)), options);
    };
    if (key === '$queryRaw') return async (strings, ...values) => {
      const sql = Array.isArray(strings) && strings.raw ? strings.join('?').replace(/\s*=\s*/g, ' = ').replace(/\s+/g, ' ').trim() : '';
      const valid = sql === 'SELECT CURRENT_TIMESTAMP(3) AS now' && values.length === 0 ||
        sql === 'SELECT id FROM `CheckoutSession` WHERE id = ? FOR UPDATE' && values.length === 1 && scope.createdSessions.has(values[0]) ||
        sql === 'SELECT id FROM `Product` WHERE id = ? FOR UPDATE' && values.length === 1 && scope.products.has(values[0]) ||
        sql === 'SELECT id FROM `Order` WHERE id = ? FOR UPDATE' && values.length === 1 && scope.orders.has(values[0]) ||
        sql === 'SELECT id FROM `FulfillmentJob` WHERE orderId = ? FOR UPDATE' && values.length === 1 && scope.orders.has(values[0]) ||
        sql === 'SELECT id FROM `CheckoutAttempt` WHERE sessionId = ? AND flowId = ? FOR UPDATE' && values.length === 2 && scope.createdSessions.has(values[0]) && scope.flows.has(values[1]);
      ensure(valid, 'SANDBOX_RAW_QUERY_REJECTED');
      ensure(scope.writable || !sql.includes('FOR UPDATE'), 'SANDBOX_WRITES_DISABLED');
      return client.$queryRaw(strings, ...values);
    };
    if (!models.includes(key)) return async () => fail('SANDBOX_OPERATION_REJECTED');
    return new Proxy({}, { get(_delegate, operation) { return async (args = {}) => {
      const reading = ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findMany', 'count'].includes(operation);
      const writing = ['create', 'createMany', 'update', 'updateMany', 'upsert', 'deleteMany'].includes(operation);
      ensure(reading || writing, 'SANDBOX_OPERATION_REJECTED');
      if (writing) ensure(scope.writable, 'SANDBOX_WRITES_DISABLED');
      if (operation === 'deleteMany') ensure(['checkoutAttempt', 'checkoutSession', 'rateLimit', 'fulfillmentJob', 'orderSecret'].includes(key), 'SANDBOX_OPERATION_REJECTED');
      if (operation === 'createMany') ensure(key === 'regionalPrice' && Array.isArray(args.data) && args.data.length > 0 && args.data.length <= 3, 'SANDBOX_OPERATION_REJECTED');
      if (operation === 'create' && key === 'rateLimit') fail('SANDBOX_OPERATION_REJECTED');
      if (writing && !['create', 'createMany', 'upsert'].includes(operation) && key === 'checkoutSession') ensure(belongs(scope.createdSessions, args.where?.id), 'SANDBOX_FIXTURE_SCOPE_REJECTED');
      if (operation === 'deleteMany' && key === 'checkoutAttempt') ensure(belongs(scope.attempts, args.where?.id), 'SANDBOX_FIXTURE_SCOPE_REJECTED');
      if (operation === 'deleteMany' && key === 'fulfillmentJob') ensure(belongs(scope.orders, args.where?.orderId), 'SANDBOX_FIXTURE_SCOPE_REJECTED');
      const creating = ['create', 'createMany'].includes(operation);
      if (operation === 'create') {
        const limit = { product: [scope.products, 2], productVariant: [scope.variants, 2], checkoutSession: [scope.createdSessions, 12], checkoutAttempt: [scope.attempts, 12], order: [scope.orders, 6] }[key];
        if (limit) ensure(limit[0].size < limit[1], 'SANDBOX_FIXTURE_BUDGET_EXCEEDED');
      }
      if (!creating) {
        if (key === 'rateLimit' && operation === 'upsert' && rateIdAllowed(args.where?.id, scope) && !scope.rateLimits.has(args.where.id)) {
          const existing = await client.rateLimit.findUnique({ where: { id: args.where.id }, select: { id: true } });
          ensure(!existing || scope.rateLimits.has(args.where.id), 'SANDBOX_COUNTER_COLLISION');
          ensure(scope.rateLimits.size < 32, 'SANDBOX_FIXTURE_BUDGET_EXCEEDED');
          scope.rateLimits.add(args.where.id); scope.journal?.();
        }
        ensure(scopedWhere(key, args.where, scope), 'SANDBOX_FIXTURE_SCOPE_REJECTED');
      }
      if (writing && operation !== 'deleteMany') {
        if (operation === 'upsert') {
          if (key === 'rateLimit') {
            ensure(args.create?.id === args.where.id, 'SANDBOX_DATA_REJECTED');
            validateData(key, 'create', args.create, scope); validateData(key, 'update', args.update, scope);
          } else if (key === 'fulfillmentJob') {
            ensure(args.create?.orderId === args.where.orderId && scope.orders.has(args.where.orderId), 'SANDBOX_DATA_REJECTED');
            validateData(key, 'create', args.create, scope); validateData(key, 'update', args.update, scope);
          } else fail('SANDBOX_OPERATION_REJECTED');
        } else validateData(key, operation, args.data, scope);
      }
      const result = await client[key][operation](args);
      if (operation === 'create') ownResult(key, result, scope);
      if (operation === 'upsert' && key === 'fulfillmentJob') scope.fulfillmentJobs.add(args.where.orderId);
      if (operation === 'createMany' && key === 'regionalPrice') for (const row of args.data) scope.regionalPairs.add(`${row.variantId}:${row.region}`);
      return result;
    }; } });
  } });
}
