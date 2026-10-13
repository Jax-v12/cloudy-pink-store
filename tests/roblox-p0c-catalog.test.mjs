import test from 'node:test';
import assert from 'node:assert/strict';
import { regionalAmount } from '../src/lib/regionalPricing.ts';

test('null regional prices excluded from available variants', () => {
  const variants = [
    { id: 1, price: 50000, units: 100, regionalPrices: [{ region: 'MY', amount: 2000, active: true }] },
    { id: 2, price: 100000, units: 200, regionalPrices: [{ region: 'MY', amount: null, active: false }] },
    { id: 3, price: 150000, units: 300, regionalPrices: [] },
  ];

  // MY visitor should see variant 1 only
  const myPriced = variants.filter(v => regionalAmount(v, 'MY') !== null);
  assert.equal(myPriced.length, 1);
  assert.equal(myPriced[0].id, 1);
  assert.equal(regionalAmount(myPriced[0], 'MY'), 2000);

  // ID visitor sees IDR prices
  const idPriced = variants.filter(v => regionalAmount(v, 'ID') !== null);
  assert.equal(idPriced.length, 3);
  assert.equal(regionalAmount(variants[0], 'ID'), 50000);

  // PH visitor with no active PH prices sees nothing
  const phPriced = variants.filter(v => regionalAmount(v, 'PH') !== null);
  assert.equal(phPriced.length, 0);
});

test('Login method with zero available packages displays empty state', () => {
  const product = {
    id: 1,
    name: 'Roblox',
    variants: [
      { id: 1, method: 'LOGIN', price: null, units: 100 },
      { id: 2, method: 'GAMEPASS', price: 50000, units: 100 },
    ]
  };

  const loginVariants = product.variants.filter(v => v.method === 'LOGIN' && v.price !== null);
  assert.equal(loginVariants.length, 0);

  const gamepassVariants = product.variants.filter(v => v.method === 'GAMEPASS' && v.price !== null);
  assert.equal(gamepassVariants.length, 1);
});

test('regional price safety: never use IDR fallback for MY/PH', () => {
  const variant = { price: 100000, units: 100, regionalPrices: [] };

  // ID uses base price
  assert.equal(regionalAmount(variant, 'ID'), 100000);

  // MY/PH without explicit price get null, not IDR fallback
  assert.equal(regionalAmount(variant, 'MY'), null);
  assert.equal(regionalAmount(variant, 'PH'), null);
});

test('inactive regional price treated as unavailable', () => {
  const variant = {
    price: 100000,
    units: 100,
    regionalPrices: [
      { region: 'MY', amount: 3500, active: false },
      { region: 'PH', amount: 22000, active: true },
    ]
  };

  assert.equal(regionalAmount(variant, 'MY'), null);
  assert.equal(regionalAmount(variant, 'PH'), 22000);
  assert.equal(regionalAmount(variant, 'ID'), 100000);
});
