'use client';
import { useEffect, useState } from 'react';
import type { Region } from '@/lib/regionalPricing';
import type { PaymentQuote } from './RegionalPaymentSummary';
type ConfirmedQuote = PaymentQuote & { quoteToken: string; pricingRegion: Region };

/** Quote requests never create an order. The request key also hides stale region/quantity responses. */
export function useRegionalQuote(productId: number | undefined, variantId: number | undefined, region: Region | null, method: string, quantity?: number) {
  const [retry, setRetry] = useState(0);
  const payload = JSON.stringify({ productId, variantId, paymentMethod: method, ...(quantity !== undefined ? { quantity } : {}) });
  const key = `${region}:${payload}:${retry}`;
  const [result, setResult] = useState<{ key: string; quote: ConfirmedQuote | null; error: string } | null>(null);
  const active = Boolean(productId && variantId && region && method);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch('/api/checkout/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, signal: controller.signal })
        .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.errorCode); return data.data as ConfirmedQuote; })
        .then(quote => { if (quote.pricingRegion !== region) throw new Error('REGION_CHANGED'); if (!controller.signal.aborted) setResult({ key, quote, error: '' }); })
        .catch(error => { if (!controller.signal.aborted) setResult({ key, quote: null, error: error instanceof Error ? error.message : 'SYSTEM_ERROR' }); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [active, key, payload, region]);
  const current = active && result?.key === key ? result : null;
  return { quote: current?.quote ?? null, error: current?.error ?? '', loading: active && !current, retry: () => setRetry(n => n + 1) };
}
