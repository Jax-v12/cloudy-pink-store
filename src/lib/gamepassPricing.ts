import { ROBLOX_MAX_GAMEPASS_UNITS } from './roblox';

export type GamepassRate = { units: number; price: number; maxUnits?: number | null; unitStep?: number };

/** Base units/price define the rate; maxUnits enables a quantity range. Legacy fixed packages remain valid. */
export function quoteGamepass(rate: GamepassRate, quantity = rate.units) {
  const maximum = rate.maxUnits ?? rate.units;
  const step = rate.unitStep ?? 1;
  if (![rate.units, rate.price, maximum, step, quantity].every(n => Number.isSafeInteger(n) && n > 0) ||
      rate.price > 2_147_483_647 || maximum > ROBLOX_MAX_GAMEPASS_UNITS || maximum < rate.units ||
      quantity < rate.units || quantity > maximum || (quantity - rate.units) % step !== 0) {
    throw new RangeError('INVALID_GAMEPASS_QUANTITY');
  }
  // Integer division rounded up, so the browser and checkout use precisely the same IDR price.
  const amount = (BigInt(rate.price) * BigInt(quantity) + BigInt(rate.units) - BigInt(1)) / BigInt(rate.units);
  if (amount > BigInt(2_147_483_647)) throw new RangeError('INVALID_GAMEPASS_PRICE');
  return { units: quantity, totalAmount: Number(amount) };
}
