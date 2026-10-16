import { geoHeaders } from './geo-fixture.mjs';
import { quotedCheckout } from './checkout-fixture.mjs';
import { mockRoblox } from './roblox-fixture.mjs';
import { loginCredentialsFixture } from './login-access-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const base = process.env.TEST_BASE_URL; const db = process.env.TEST_DATABASE_URL;
test('HTTP authorization, CSRF, reauthentication and response redaction', { skip: !base || !db }, async () => {
  const endpoint = new URL(base); const database = new URL(db);
  assert.ok(['127.0.0.1', 'localhost'].includes(endpoint.hostname));
  assert.ok(['127.0.0.1', 'localhost'].includes(database.hostname) && /^\/cloudy_test_[a-z0-9_]+$/.test(database.pathname));
  process.env.DATABASE_URL = db; process.env.ENCRYPTION_KEY = 'test-key'; process.env.ROBLOX_CHECKOUT_ENABLED = 'true'; process.env.MIDTRANS_SERVER_KEY = 'isolated-test-midtrans-key';
  delete process.env.TELEGRAM_BOT_TOKEN;
  const restoreRoblox = mockRoblox();
  const { prisma } = await import('../src/lib/prisma.ts');
  const { createCheckout: rawCheckout } = await import('../src/lib/checkout.ts');
  const { checkoutPricing, checkoutQuoteToken } = await import('../src/lib/checkoutPricing.ts');
  const createCheckout = quotedCheckout(prisma, rawCheckout, checkoutPricing, checkoutQuoteToken);
  const { applyPaymentStatus } = await import('../src/lib/payments.ts');
  try {
    await prisma.rateLimit.deleteMany({});
    const p = await prisma.product.create({ data: { name: 'HTTP Roblox', slug: `http-${crypto.randomUUID()}`, price: 0, type: 'ROBLOX', variants: { create: { name: 'Login 100', price: 2000, units: 100, method: 'LOGIN', active: true } } }, include: { variants: true } });
    const secret = loginCredentialsFixture();
    const loginDetails = { username: 'httptest', whatsappE164: '+12133734253', ...secret };
    const { order } = await createCheckout({ productId: p.id, variantId: p.variants[0].id, customerEmail: 'http@example.test', details: loginDetails }, crypto.randomUUID());
    assert.equal(await prisma.orderSecret.count({ where: { orderId: order.id } }), 1);
    await applyPaymentStatus(order.id, { provider: 'MIDTRANS', invoice: order.invoice, amount: order.totalAmount, currency: 'IDR', region: 'ID', reference: 'tx-' + order.invoice, state: 'paid', cancelled: false, qr: null });
    const request = (path, init = {}, country = 'ID') => { const url = new URL(path, base); return fetch(url, { ...init, headers: { ...geoHeaders(url, country, init.method || 'GET'), ...init.headers } }); };
    // The HTTP harness mocks Roblox and blocks external providers.
    const userLookup = await request('/api/roblox/user?username=customer');
    assert.equal(userLookup.status, 200); assert.equal((await userLookup.json()).data.id, 42);
    assert.equal((await request('/api/roblox/user?username=unknown_user')).status, 404);
    assert.equal((await request('/api/roblox/user?username=%3Cinvalid%3E')).status, 400);
    assert.equal((await request('/api/roblox/gamepass?id=9999999999999999999')).status, 400);
    const passLookup = await request('/api/roblox/gamepass?id=123');
    assert.equal(passLookup.status, 200); assert.ok(passLookup.headers.get('cache-control').includes('no-store'));
    assert.equal((await passLookup.json()).data.price, 143);
    const catalogPage = await request('/roblox');
    assert.equal(catalogPage.status, 200); assert.ok((await catalogPage.text()).includes('Top-up Robux, diproses dengan teliti'));
    const methodPage = await request(`/roblox/${p.slug}?method=LOGIN`);
    assert.equal(methodPage.status, 200);
    const loginPage = await methodPage.text();
    assert.match(loginPage, /<h1\b[^>]*>Pilih nominal Robux<\/h1>/);
    assert.ok(loginPage.includes('Pilih paket yang tersedia, isi informasi kontak, lalu periksa pesananmu.'));
    assert.equal((await request('/api/admin/fulfillment')).status, 401);
    assert.equal((await request(`/api/admin/fulfillment/${order.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reveal' }) })).status, 401);
    assert.equal((await request(`/api/orders/${order.invoice}`, { headers: { 'x-order-token': 'wrong' } })).status, 404);
    const customer = await request(`/api/orders/${order.invoice}`, { headers: { 'x-order-token': order.accessToken } });
    assert.equal(customer.status, 200); assert.ok(customer.headers.get('cache-control').includes('no-store'));
    const text = await customer.text(); assert.ok(!text.includes('ciphertext'));
    for (const value of [secret.password, ...secret.backupCodes]) assert.ok(!text.includes(value));
    const login = await request('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: endpoint.origin }, body: JSON.stringify({ password: 'isolated-http-test-password' }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().find(c => c.startsWith('admin_session_token=')).split(';')[0];
    const headers = { Cookie: cookie, Origin: endpoint.origin, 'Content-Type': 'application/json' };
    const createRate = body => request('/api/admin/catalog', { method: 'POST', headers, body: JSON.stringify({ kind: 'variant', productId: p.id, name: 'Slider rate', price: 7000, units: 50, maxUnits: 5000, unitStep: 5, method: 'GAMEPASS', active: true, ...body }) });
    assert.equal((await createRate({ unitStep: 3 })).status, 400);
    assert.equal((await createRate({ maxUnits: 49 })).status, 400);
    const rateResponse = await createRate({}); assert.equal(rateResponse.status, 200);
    const rate = (await rateResponse.json()).data;
    assert.equal(rate.maxUnits, 5000); assert.equal(rate.unitStep, 5); assert.equal(rate.gamepassPrice, 72);
    const catalog = await request(`/api/products?type=ROBLOX&slug=${p.slug}`);
    const publicRate = (await catalog.json()).data[0].variants.find(v => v.id === rate.id);
    assert.equal(publicRate.maxUnits, 5000); assert.equal(publicRate.unitStep, 5);
    const regionalResponse = await createRate({ name: 'Regional rate', regionalPrices: [
      { region: 'ID', amount: 7000, active: true }, { region: 'MY', amount: 250, active: true }, { region: 'PH', amount: 3000, active: true },
    ] });
    assert.equal(regionalResponse.status, 200); const regional = (await regionalResponse.json()).data;
    const regionalCatalog = await (await request(`/api/products?type=ROBLOX&slug=${p.slug}`)).json();
    assert.equal(regionalCatalog.location.region, 'ID');
    assert.equal(regionalCatalog.paymentMethods[0].id, 'QRIS');
    assert.ok(regionalCatalog.data[0].variants.find(v => v.id === regional.id).regionalPrices.every(r => r.region === 'ID'));
    const catalogPath = '/api/products?type=ROBLOX&slug=' + p.slug;
    for (const [country, amount] of [['MY', 250], ['PH', 3000]]) {
      const response = await request(catalogPath, {}, country); const catalog = await response.json();
      assert.match(response.headers.get('cache-control'), /private.*no-store/);
      assert.equal(catalog.location.region, country); assert.deepEqual(catalog.paymentMethods, []);
      assert.equal(catalog.data[0].checkoutEnabled, false);
      assert.equal(catalog.data[0].variants.find(v => v.id === regional.id).price, amount);
    }
    const unsigned = await fetch(new URL(catalogPath + '&region=ID', base), { headers: { 'cf-ipcountry': 'ID', 'x-vercel-ip-country': 'ID', cookie: 'region=ID' } });
    const unknown = await unsigned.json(); assert.equal(unknown.location.region, null);
    assert.equal(unknown.data[0].variants[0].price, null); assert.equal(unknown.data[0].checkoutEnabled, false);
    assert.deepEqual(unknown.paymentMethods, []);
    const unsupported = await (await request(catalogPath, {}, 'US')).json(); assert.equal(unsupported.location.reason, 'unsupported');
    const orderCount = await prisma.order.count();
    const priceQuote = pricingRegion => request('/api/checkout/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id, variantId: regional.id, quantity: 100, paymentMethod: 'QRIS' }) }, pricingRegion);
    const unsignedQuote = await fetch(new URL('/api/checkout/quote', base), { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-ipcountry': 'ID' }, body: JSON.stringify({ productId: p.id, variantId: regional.id, quantity: 100, paymentMethod: 'QRIS' }) });
    assert.equal(unsignedQuote.status, 409); assert.equal((await unsignedQuote.json()).errorCode, 'REGION_UNVERIFIED');
    const regionOverride = await request('/api/checkout/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id, variantId: regional.id, quantity: 100, pricingRegion: 'ID', paymentMethod: 'QRIS' }) });
    assert.equal(regionOverride.status, 400);
    const idQuote = await priceQuote('ID'); assert.equal(idQuote.status, 200);
    const idQuoteData = (await idQuote.json()).data; assert.equal(idQuoteData.totalAmount, 14000); assert.equal(idQuoteData.paymentFee, 0); assert.equal(idQuoteData.currency, 'IDR');
    assert.match(idQuoteData.quoteToken, /^[a-f0-9]{64}$/);
    for (const region of ['MY', 'PH']) {
      const unavailable = await priceQuote(region); assert.equal(unavailable.status, 409); assert.equal((await unavailable.json()).errorCode, 'PAYMENT_REGION_UNAVAILABLE');
    }
    assert.equal(await prisma.order.count(), orderCount, 'Quotes never create orders');
    assert.equal((await createRate({ regionalPrices: [{ region: 'MY', amount: 2.5, active: true }] })).status, 400);
    assert.equal((await createRate({ regionalPrices: [{ region: 'US', amount: 100, active: true }] })).status, 400);
    const updateID = await createRate({ id: regional.id, price: 9000 }); assert.equal(updateID.status, 200);
    assert.equal((await prisma.regionalPrice.findUnique({ where: { variantId_region: { variantId: regional.id, region: 'MY' } } })).amount, 250);
    const regionalBody = { productId: p.id, variantId: regional.id, quantity: 100, paymentMethod: 'QRIS', customerEmail: 'regional-http@example.test', details: { username: 'customer', gamepassUrl: 'https://www.roblox.com/game-pass/123/example' } };
    const postRegional = (quoteToken, key) => request('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'idempotency-key': key }, body: JSON.stringify({ ...regionalBody, quoteToken }) });
    const drifting = await request('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify({ ...regionalBody, customerEmail: 'drift@example.test', quoteToken: idQuoteData.quoteToken }) }, 'MY');
    assert.equal(drifting.status, 409); assert.equal((await drifting.json()).errorCode, 'PAYMENT_REGION_UNAVAILABLE');
    const unverifiedCheckout = await fetch(new URL('/api/checkout', base), { method: 'POST', headers: { 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID(), 'cf-ipcountry': 'ID' }, body: JSON.stringify({ ...regionalBody, customerEmail: 'unknown-location@example.test', quoteToken: idQuoteData.quoteToken }) });
    assert.equal(unverifiedCheckout.status, 409); assert.equal((await unverifiedCheckout.json()).errorCode, 'REGION_UNVERIFIED');
    const outdated = await postRegional(idQuoteData.quoteToken, crypto.randomUUID());
    assert.equal(outdated.status, 409); assert.equal((await outdated.json()).errorCode, 'PRICE_CHANGED');
    assert.equal(await prisma.order.count(), orderCount);
    const refreshedQuote = (await (await priceQuote('ID')).json()).data;
    assert.equal(refreshedQuote.totalAmount, 18000);
    const regionalKey = crypto.randomUUID();
    const regionalCheckout = await postRegional(refreshedQuote.quoteToken, regionalKey);
    assert.equal(regionalCheckout.status, 202); const regionalInvoice = (await regionalCheckout.json()).data.invoice;
    const duplicate = await postRegional(refreshedQuote.quoteToken, regionalKey);
    assert.equal((await duplicate.json()).data.invoice, regionalInvoice);
    const regionalOrder = await prisma.order.findUnique({ where: { invoice: regionalInvoice } });
    assert.equal(regionalOrder.totalAmount, 18000); assert.equal(regionalOrder.productSubtotal, 18000);
    assert.equal(regionalOrder.pricingRegion, 'ID'); assert.equal(regionalOrder.currency, 'IDR');
    const giftResponse = await createRate({ name: 'Username dynamic', method: 'GIFT_USERNAME', units: 20, price: 3501, maxUnits: 200, unitStep: 2, capacityConfirmed: true });
    assert.equal(giftResponse.status, 200); const gift = (await giftResponse.json()).data;
    assert.equal(gift.maxUnits, 200); assert.equal(gift.unitStep, 2); assert.equal(gift.gamepassPrice, null);
    assert.equal((await createRate({ method: 'GIFT_USERNAME', capacityConfirmed: true, unitStep: 0 })).status, 400);
    assert.equal((await createRate({ method: 'GIFT_USERNAME', capacityConfirmed: false })).status, 400);
    const usernamePayload = { productId: p.id, variantId: gift.id, quantity: 22, customerEmail: 'username-http@example.test', details: { username: 'customer' } };
    const usernameQuote = await request('/api/checkout/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.id, variantId: gift.id, quantity: 22, paymentMethod: 'QRIS' }) });
    usernamePayload.quoteToken = (await usernameQuote.json()).data.quoteToken;
    const usernameKey = crypto.randomUUID();
    const postUsername = () => request('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'idempotency-key': usernameKey }, body: JSON.stringify(usernamePayload) });
    const createdUsername = await postUsername(); assert.equal(createdUsername.status, 202);
    const usernameInvoice = (await createdUsername.json()).data;
    const retriedUsername = await postUsername(); assert.equal((await retriedUsername.json()).data.invoice, usernameInvoice.invoice);
    const usernameOrder = await prisma.order.findUnique({ where: { invoice: usernameInvoice.invoice } });
    assert.equal(usernameOrder.totalAmount, 3852); assert.equal(usernameOrder.units, 22);
    const usernameCustomer = await request('/api/orders/' + usernameInvoice.invoice, { headers: { 'x-order-token': usernameInvoice.accessToken } });
    const usernameCustomerBody = await usernameCustomer.json();
    assert.equal(usernameCustomerBody.data.robloxDetail.method, 'GIFT_USERNAME');
    assert.equal(usernameCustomerBody.data.fulfillmentStatus, 'NOT_READY');
    const contactBefore = await request('/api/admin/fulfillment?q=' + order.invoice, { headers });
    assert.equal((await contactBefore.json()).data[0].contactEmail, null);
    const action = body => request(`/api/admin/fulfillment/${order.id}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const csrf = await request(`/api/admin/fulfillment/${order.id}`, { method: 'POST', headers: { ...headers, Origin: 'https://evil.example' }, body: JSON.stringify({ action: 'claim' }) });
    assert.equal(csrf.status, 403);
    assert.equal((await action({ action: 'claim' })).status, 200);
    const beforeReauth = await action({ action: 'reveal' }); assert.equal(beforeReauth.status, 403); assert.equal((await beforeReauth.json()).errorCode, 'REAUTH_REQUIRED');
    const reauth = await request('/api/admin/reauth', { method: 'POST', headers, body: JSON.stringify({ password: 'isolated-http-test-password' }) }); assert.equal(reauth.status, 200);
    const reveal = await action({ action: 'reveal' }); assert.equal(reveal.status, 200); assert.ok(reveal.headers.get('cache-control').includes('no-store'));
    const revealed = (await reveal.json()).data;
    assert.equal(revealed.username, loginDetails.username); assert.ok(revealed.password === secret.password);
    assert.ok(JSON.stringify(revealed.backupCodes) === JSON.stringify(secret.backupCodes));
    assert.ok(Date.parse(revealed.displayUntil) <= Date.now() + 60_000);
    assert.equal(await prisma.adminAudit.count({ where: { orderId: order.id, action: 'login-access-reveal' } }), 1);
    const otherLogin = await request('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: endpoint.origin }, body: JSON.stringify({ password: 'isolated-http-test-password' }) });
    assert.equal(otherLogin.status, 200);
    const otherCookie = otherLogin.headers.getSetCookie().find(c => c.startsWith('admin_session_token=')).split(';')[0];
    const otherHeaders = { ...headers, Cookie: otherCookie };
    assert.equal((await request('/api/admin/reauth', { method: 'POST', headers: otherHeaders, body: JSON.stringify({ password: 'isolated-http-test-password' }) })).status, 200);
    const unowned = await request(`/api/admin/fulfillment/${order.id}`, { method: 'POST', headers: otherHeaders, body: JSON.stringify({ action: 'reveal' }) });
    assert.equal(unowned.status, 404); assert.equal((await unowned.json()).errorCode, 'LOGIN_ACCESS_UNAVAILABLE');
    assert.equal(await prisma.adminAudit.count({ where: { orderId: order.id, action: 'login-access-reveal' } }), 1);
    await request('/api/admin/auth', { method: 'DELETE', headers: otherHeaders });
    const list = await request('/api/admin/fulfillment', { headers }); const listed = await list.text(); assert.ok(!listed.includes('ciphertext'));
    for (const value of [secret.password, ...secret.backupCodes]) assert.ok(!listed.includes(value));
    for (const q of [order.invoice, 'httptest', 'http@example.test']) {
      const response = await request('/api/admin/fulfillment?' + new URLSearchParams({ type: 'ROBLOX', method: 'LOGIN', payment: 'PAID', status: 'PROCESSING', q, limit: '1' }), { headers });
      assert.equal(response.status, 200); const body = await response.json();
      assert.equal(body.data[0].contactEmail, 'http@example.test'); assert.equal(body.data[0].id, order.id); assert.equal(body.data[0].robloxDetail.method, 'LOGIN');
      assert.equal(body.data[0].contactWhatsapp, '+12133734253');
      assert.equal('whatsappE164' in body.data[0].robloxDetail, false);
      assert.equal(body.monitoring.pendingCount, 1);
    }
    for (const query of ['method=INVALID', 'type=APPS&method=LOGIN', 'payment=INVALID', 'q=' + 'x'.repeat(121)]) assert.equal((await request('/api/admin/fulfillment?' + query, { headers })).status, 400);
    const mismatch = await request('/api/admin/fulfillment?method=GAMEPASS&q=' + order.invoice, { headers });
    assert.equal((await mismatch.json()).data.length, 0);
    const unsafeCheckout = await request('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify({ productId: p.id, variantId: p.variants[0].id, customerEmail: 'http@example.test', details: { ...loginDetails, otp: 'synthetic-denied' } }) });
    assert.equal(unsafeCheckout.status, 400); assert.equal((await unsafeCheckout.json()).errorCode, 'INVALID_INPUT');
    assert.equal((await action({ action: 'complete', evidence: 'http-delivery-reference' })).status, 200);
    const completedReveal = await action({ action: 'reveal' }); assert.equal(completedReveal.status, 404); assert.equal((await completedReveal.json()).errorCode, 'LOGIN_ACCESS_UNAVAILABLE');
    assert.equal(await prisma.orderSecret.count({ where: { orderId: order.id } }), 0);
    const reviewPrefix = 'REVIEW-FIXTURE-' + crypto.randomUUID();
    const reviewCases = [
      ...['PENDING', 'EXPIRED', 'CANCELLED'].map(status => ({ status, refundStatus: 'NONE' })),
      ...['NONE', 'REQUIRED', 'COMPLETED'].map(refundStatus => ({ status: 'PAID', refundStatus })),
      { status: 'PAID', refundStatus: 'NONE', archivedAt: new Date() },
      { status: 'PAID', refundStatus: 'NONE', removedFromAdminAt: new Date() },
    ];
    await prisma.order.createMany({ data: reviewCases.map((patch, index) => ({ productId: p.id, type: 'ROBLOX', invoice: reviewPrefix + '-' + index,
      customerEmail: 'review@example.test', totalAmount: 2000, expiresAt: new Date(Date.now() + 60000), fulfillmentStatus: 'REQUIRES_REVIEW', ...patch })) });
    const reviews = await request('/api/admin/fulfillment?' + new URLSearchParams({ q: reviewPrefix, limit: '20' }), { headers });
    assert.equal(reviews.status, 200); const reviewBody = await reviews.json();
    assert.equal(reviewBody.data.length, 6); assert.equal(reviewBody.monitoring.reviewCount, 2);
    for (const payment of ['PENDING', 'EXPIRED', 'CANCELLED']) {
      const response = await request('/api/admin/fulfillment?' + new URLSearchParams({ q: reviewPrefix, payment }), { headers });
      assert.equal(response.status, 200); assert.equal((await response.json()).monitoring.reviewCount, 0);
    }
    await request('/api/admin/auth', { method: 'DELETE', headers });
  } finally { restoreRoblox(); await prisma.$disconnect(); }
});
