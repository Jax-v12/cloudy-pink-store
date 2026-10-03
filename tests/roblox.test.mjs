import test from 'node:test';
import assert from 'node:assert/strict';
import { robloxGamepassPrice } from '../src/lib/roblox.ts';
import { parseDetails } from '../src/lib/commerce.ts';
import { verifyRobloxDetails } from '../src/lib/robloxVerification.ts';
import { robloxAvatarUrl } from '../src/lib/robloxApi.ts';

test('Gamepass calculator rounds up without floating-point overcharging', () => {
  assert.equal(robloxGamepassPrice(100), 143);
  assert.equal(robloxGamepassPrice(70), 100);
  assert.equal(robloxGamepassPrice(21), 30);
  for (let units = 1; units <= 10000; units++) {
    const price = robloxGamepassPrice(units);
    assert.equal(Math.floor(price * 70 / 100), units);
    assert.ok((price - 1) * 70 < units * 100);
  }
  for (const value of [0, -1, 1.5, Infinity, NaN]) assert.throws(() => robloxGamepassPrice(value));
});

test('Login accepts optional 2FA codes and keeps notes inside the secret', () => {
  const base = { username: 'customer', password: 'secret' };
  const parsed = parseDetails('ROBLOX', { method: 'LOGIN' }, { ...base, note: 'Private verification instructions' });
  assert.deepEqual(parsed.secret, { password: 'secret', backupCodes: [], note: 'Private verification instructions' });
  assert.equal('note' in parsed.roblox, false);
  assert.equal(parseDetails('ROBLOX', { method: 'LOGIN' }, { ...base, backupCodes: ['code1','code2','code3','code4','code5'] }).secret.backupCodes.length, 5);
  assert.throws(() => parseDetails('ROBLOX', { method: 'LOGIN' }, { ...base, backupCodes: ['same', 'same'] }));
  assert.throws(() => parseDetails('ROBLOX', { method: 'LOGIN' }, { ...base, backupCodes: Array.from({ length: 11 }, (_, i) => `code${i}`) }));
  assert.throws(() => parseDetails('ROBLOX', { method: 'LOGIN' }, { ...base, note: 'x'.repeat(301) }));
  assert.throws(() => parseDetails('ROBLOX', { method: 'GIFT_USERNAME' }, base));
});

test('checkout verification rejects wrong recipients, owner, sale status and price', async () => {
  const original = globalThis.fetch;
  const details = { method: 'GAMEPASS', username: 'customer', gamepassPrice: 143, gamepassUrl: 'https://www.roblox.com/game-pass/123/pass' };
  let user = { data: [{ id: 42, name: 'Customer', displayName: 'Customer' }] };
  let pass = { ProductType: 'Game Pass', Name: 'Pass', PriceInRobux: 143, IsForSale: true, Creator: { CreatorType: 'User', CreatorTargetId: 42 } };
  let outage = false;
  globalThis.fetch = async (input, init) => {
    assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
    if (outage) throw new Error('timeout');
    return Response.json(String(input).includes('users.roblox.com') ? user : pass);
  };
  try {
    const result = await verifyRobloxDetails(details);
    assert.equal(result.robloxUserId, '42'); assert.equal(result.username, 'Customer'); assert.ok(result.gamepassVerifiedAt);
    pass.Creator.CreatorTargetId = 43;
    await assert.rejects(verifyRobloxDetails(details), /GAMEPASS_OWNER_MISMATCH/);
    pass.Creator = { CreatorType: 'Group', CreatorTargetId: 42 };
    await assert.rejects(verifyRobloxDetails(details), /GAMEPASS_OWNER_MISMATCH/);
    pass.Creator.CreatorType = 'User'; pass.IsForSale = false;
    await assert.rejects(verifyRobloxDetails(details), /GAMEPASS_NOT_FOR_SALE/);
    pass.IsForSale = true; pass.PriceInRobux = 100;
    await assert.rejects(verifyRobloxDetails(details), /GAMEPASS_PRICE_MISMATCH/);
    pass.PriceInRobux = 143; user = { data: [] };
    await assert.rejects(verifyRobloxDetails(details), /ROBLOX_USER_NOT_FOUND/);
    outage = true;
    const unverified = await verifyRobloxDetails(details);
    assert.equal(unverified.robloxUserId, null); assert.equal(unverified.gamepassVerifiedAt, null);
    await assert.rejects(verifyRobloxDetails({ ...details, gamepassUrl: 'https://www.roblox.com/game-pass/9999999999999999999/x' }), /GAMEPASS_NOT_FOUND/);
  } finally { globalThis.fetch = original; }
});

test('public avatar lookup never reflects an arbitrary image host', async () => {
  const original = globalThis.fetch;
  try {
    for (const imageUrl of ['https://evil.example/a.png', 'https://rbxcdn.com.evil.example/a.png', 'http://tr.rbxcdn.com/a.png']) {
      globalThis.fetch = async () => Response.json({ data: [{ state: 'Completed', imageUrl }] });
      assert.equal(await robloxAvatarUrl(42), null);
    }
    globalThis.fetch = async () => Response.json({ data: [{ state: 'Completed', imageUrl: 'https://tr.rbxcdn.com/a.png' }] });
    assert.equal(await robloxAvatarUrl(42), 'https://tr.rbxcdn.com/a.png');
  } finally { globalThis.fetch = original; }
});
