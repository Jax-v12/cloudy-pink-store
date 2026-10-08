import { CommerceError, requestDigest } from './commerce';
import { InputError } from './http';
import { quoteRegionalQuantity, type RegionalRate, type Region } from './regionalPricing';
import { paymentMethods, paymentTotals } from './paymentProvider';

export function checkoutPricing(type: string, productPrice: number, variant: (RegionalRate & { method: string | null }) | null, region: Region, methodId: string, quantity?: number) {
  if (type !== 'ROBLOX' && region !== 'ID') throw new InputError();
  if (quantity !== undefined && (type !== 'ROBLOX' || !['GAMEPASS', 'GIFT_USERNAME'].includes(variant?.method ?? ''))) throw new InputError();
  let quote;
  try {
    quote = type === 'ROBLOX' && variant ? quoteRegionalQuantity(variant, region, quantity)
      : { units: variant?.units ?? 1, totalAmount: variant?.price ?? productPrice, currency: 'IDR' as const, pricingRegion: 'ID' as const };
  } catch (error) {
    if (error instanceof Error && error.message === 'REGIONAL_PRICE_UNAVAILABLE') throw new CommerceError('REGIONAL_PRICE_UNAVAILABLE');
    throw new InputError();
  }
  const methods = paymentMethods(region);
  if (!methods.length) throw new CommerceError('PAYMENT_REGION_UNAVAILABLE');
  const method = methods.find(m => m.id === methodId);
  if (!method) throw new CommerceError('PAYMENT_METHOD_UNAVAILABLE', 400);
  return { ...quote, ...paymentTotals(quote.totalAmount, method), paymentProvider: method.provider, paymentMethod: method.id };
}

/** Binds confirmation to server-calculated money, quantity, product and payment route. */
export function checkoutQuoteToken(productId: number, variantId: number, quote: ReturnType<typeof checkoutPricing>) {
  return requestDigest({ purpose: 'regional-quote-v1', productId, variantId, ...quote });
}
