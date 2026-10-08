/** Trusted test caller obtains an official quote; fixture cache preserves replay payloads. */
export function quotedCheckout(prisma, create, pricing, token) {
  const tokens = new Map();
  return async (body, key, region = 'ID') => {
    let quoteToken = body.quoteToken;
    if (quoteToken === undefined && body.variantId && !('pricingRegion' in body)) {
      quoteToken = tokens.get(key);
      if (!quoteToken) {
        const variant = await prisma.productVariant.findUnique({ where: { id: body.variantId }, include: { product: true, regionalPrices: true } });
        if (variant?.product.type === 'ROBLOX') {
          quoteToken = token(body.productId, variant.id, pricing('ROBLOX', variant.product.price, variant, region, body.paymentMethod ?? 'QRIS', body.quantity));
          tokens.set(key, quoteToken);
        }
      }
    }
    return create({ ...body, ...(quoteToken ? { quoteToken } : {}) }, key, region);
  };
}
