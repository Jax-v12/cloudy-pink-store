import { quoteRobloxQuantity, type RobloxRate } from './robloxPricing';

export const REGIONS = ['ID', 'MY', 'PH'] as const;
export type Region = typeof REGIONS[number];
export const REGION_CURRENCY = { ID: 'IDR', MY: 'MYR', PH: 'PHP' } as const;
export type Currency = typeof REGION_CURRENCY[Region];
export type RegionalPrice = { region: string; amount: number; active: boolean };
export type RegionalRate = RobloxRate & { regionalPrices?: RegionalPrice[] };
export function isRegion(value: unknown): value is Region {
  return typeof value === 'string' && REGIONS.includes(value as Region);
}
export function currencyScale(currency: string) {
  if (currency === 'IDR') return 1;
  if (currency === 'MYR' || currency === 'PHP') return 100;
  throw new RangeError('UNSUPPORTED_CURRENCY');
}
/** Parse decimal input without binary floating-point multiplication. */
export function parseMoney(value: string, currency: Currency): number {
  const scale = currencyScale(currency);
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) throw new RangeError('INVALID_AMOUNT');
  const [whole, fraction = ''] = value.split('.');
  if (scale === 1 && /[1-9]/.test(fraction)) throw new RangeError('INVALID_AMOUNT');
  const amount = BigInt(whole) * BigInt(scale) + (scale === 1 ? BigInt(0) : BigInt(fraction.padEnd(2, '0')));
  if (amount > BigInt(2147483647)) throw new RangeError('INVALID_AMOUNT');
  return Number(amount);
}
export function formatMoney(amount: number, currency: Currency, language = 'ID') {
  return new Intl.NumberFormat(language === 'ID' ? 'id-ID' : language === 'MY' ? 'ms-MY' : 'en-US', {
    style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(amount / currencyScale(currency));
}
export function regionalAmount(rate: RegionalRate, region: Region): number | null {
  const price = rate.regionalPrices?.find(p => p.region === region);
  // Existing Indonesian prices remain authoritative; no FX or foreign fallback.
  if (region === 'ID') return price?.active === false ? null : rate.price;
  return price?.active ? price.amount : null;
}
export function quoteRegionalQuantity(rate: RegionalRate, region: Region, quantity?: number) {
  const amount = regionalAmount(rate, region);
  if (amount === null) throw new RangeError('REGIONAL_PRICE_UNAVAILABLE');
  return { ...quoteRobloxQuantity({ ...rate, price: amount }, quantity), pricingRegion: region, currency: REGION_CURRENCY[region] };
}
