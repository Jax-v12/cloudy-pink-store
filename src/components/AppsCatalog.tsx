'use client';
import { observeCheckout } from './AggregateMetrics';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StoreShell from './StoreShell';
import DetectedLocation from './DetectedLocation';
import { useLanguage } from '@/context/LanguageContext';
import { parseCatalogResponse, type AppsProduct } from '@/lib/appsProduct';
import { formatMoney } from '@/lib/regionalPricing';

export function AppsPackageDetails({ product }: { product: AppsProduct }) {
  const { t } = useLanguage();
  const a = t.apps;
  const config = product.appsConfig;
  if (!config) return <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{a.legacy}</p>;
  return (
    <dl className="grid gap-3.5 text-sm sm:grid-cols-2">
      {(
        [
          'accountType',
          'durationDays',
          'devices',
          'regionRules',
          'included',
          'usageRules',
          'instructions',
          'warrantyDays',
          'warrantyTerms',
        ] as const
      ).map(key => (
        <div key={key} className="min-w-0 rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] p-4">
          <dt className="text-xs font-extrabold uppercase tracking-wider text-pink-700">{a[key]}</dt>
          <dd className="mt-1.5 whitespace-pre-wrap break-words leading-6 font-medium text-[#251D2C]">{config[key]}</dd>
        </div>
      ))}
      <div className="min-w-0 rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] p-4">
        <dt className="text-xs font-extrabold uppercase tracking-wider text-pink-700">{a.fulfillmentMode}</dt>
        <dd className="mt-1.5 font-bold text-[#251D2C]">
          {a[config.fulfillmentMode]}
          {config.activationMethod ? ` · ${a[config.activationMethod]}` : ''}
        </dd>
      </div>
    </dl>
  );
}

export default function AppsCatalog({ slug }: { slug?: string }) {
  const { t, language } = useLanguage();
  const a = t.apps;
  const router = useRouter();
  const [products, setProducts] = useState<AppsProduct[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [region, setRegion] = useState<'ID' | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [filters, setFilters] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [email, setEmail] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invoice, setInvoice] = useState('');
  const activeRequest = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const checkoutKey = useRef({ body: '', key: '' });
  const requestId = useRef(0);

  const load = useCallback(
    async (next: number | null = null) => {
      activeRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;
      const id = ++requestId.current;
      setLoading(true);
      setError('');
      if (!next) {
        setCursor(null);
        setProducts([]);
        setAgree(false);
      }
      const params = new URLSearchParams(filters);
      if (slug) params.set('slug', slug);
      if (next) params.set('cursor', String(next));
      try {
        const page = await parseCatalogResponse(await fetch('/api/products?' + params, { signal: controller.signal }));
        if (id === requestId.current && !controller.signal.aborted) {
          setProducts(old => (next ? [...old, ...page.data.filter(p => !old.some(o => o.id === p.id))] : page.data));
          setCursor(page.nextCursor);
          setRegion(page.region);
        }
      } catch {
        if (!controller.signal.aborted && id === requestId.current) setError(t.errSystem);
      } finally {
        if (!controller.signal.aborted && id === requestId.current) setLoading(false);
      }
    },
    [filters, slug, t.errSystem]
  );

  useEffect(() => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const id = ++requestId.current;
    const params = new URLSearchParams(filters);
    if (slug) params.set('slug', slug);
    fetch('/api/products?' + params, { signal: controller.signal })
      .then(parseCatalogResponse)
      .then(page => {
        if (!controller.signal.aborted && id === requestId.current) {
          setProducts(page.data);
          setCursor(page.nextCursor);
          setRegion(page.region);
          setError('');
          setAgree(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && id === requestId.current) setError(t.errSystem);
      })
      .finally(() => {
        if (!controller.signal.aborted && id === requestId.current) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, slug, revision, t.errSystem]);

  const product = slug ? products.find(p => p.slug === slug) : null;
  const ready = (p: AppsProduct) =>
    region === 'ID' &&
    p.price !== null &&
    p.checkoutEnabled &&
    (p.appsConfig?.fulfillmentMode === 'ACTIVATION' || p.stockAvailable > 0);
  const availability = (p: AppsProduct) =>
    !region || !p.checkoutEnabled
      ? t.commerce.unavailable
      : ready(p)
        ? p.appsConfig?.fulfillmentMode === 'ACTIVATION'
          ? a.ACTIVATION
          : `${t.stockRemaining} ${p.stockAvailable}`
        : t.stockOut;
  const money = (n: number | null) => (region && n !== null ? formatMoney(n, 'IDR', language) : t.regional.unavailable);

  async function checkout(event: React.FormEvent) {
    event.preventDefault();
    if (!product || !ready(product) || !agree || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    observeCheckout();
    const body = JSON.stringify({
      productId: product.id,
      customerEmail: email,
      ...(product.appsPolicyToken ? { appsPolicyToken: product.appsPolicyToken } : {}),
    });
    if (checkoutKey.current.body !== body) checkoutKey.current = { body, key: crypto.randomUUID() };
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'idempotency-key': checkoutKey.current.key },
        body,
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        if (json.errorCode === 'APPS_TERMS_CHANGED') {
          await load();
          throw new Error(a.changed);
        }
        if (['REGION_UNVERIFIED', 'PAYMENT_REGION_UNAVAILABLE'].includes(json.errorCode)) {
          setRegion(null);
          throw new Error(t.regional.locationUnavailable);
        }
        throw new Error(t.errSystem);
      }
      if (!json.data?.invoice || !json.data?.accessToken) throw new Error(t.errSystem);
      // Preserve the existing invoice access mechanism; never persist account credentials.
      localStorage.setItem(`token_${json.data.invoice}`, json.data.accessToken);
      router.push(`/order/${encodeURIComponent(json.data.invoice)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errSystem);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <StoreShell>
      <DetectedLocation region={region} loading={loading} />
      <section className="rounded-3xl border border-[#F1E4ED] bg-white p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-200 bg-pink-50 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-pink-700 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-500" aria-hidden="true" />
              {t.badge}
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#251D2C] sm:text-3xl">
              {product?.name || t.catalogTitle}
            </h1>
          </div>
        </div>

        {!slug && (
          <>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{t.catalogSubtitle}</p>
            <form
              className="my-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-[#F1E4ED] pb-4 sm:my-6 sm:grid-cols-[1fr_1fr_auto]"
              onSubmit={event => {
                event.preventDefault();
                activeRequest.current?.abort();
                setLoading(true);
                setError('');
                setProducts([]);
                setCursor(null);
                setFilters(new URLSearchParams({ q: query.trim(), category: category.trim() }).toString());
                setRevision(n => n + 1);
              }}
            >
              <label className="col-span-2 text-sm font-bold text-[#251D2C] sm:col-span-1">
                {t.searchPlaceholder}
                <input
                  type="search"
                  maxLength={100}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#F1E4ED] bg-white px-3.5 py-2.5 text-sm font-medium text-[#251D2C] focus:border-pink-500 focus:outline-none"
                />
              </label>
              <label className="min-w-0 text-sm font-bold text-[#251D2C]">
                {a.category}
                <input
                  maxLength={50}
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#F1E4ED] bg-white px-3.5 py-2.5 text-sm font-medium text-[#251D2C] focus:border-pink-500 focus:outline-none"
                />
              </label>
              <button className="rounded-xl bg-pink-600 hover:bg-pink-700 px-5 py-2.5 text-sm font-extrabold text-white transition cursor-pointer">
                {t.searchButton}
              </button>
            </form>
          </>
        )}

        {slug && (
          <Link
            href="/apps"
            className="my-4 inline-flex items-center gap-2 rounded-xl border border-[#F1E4ED] bg-[#FFF9FC] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#251D2C] hover:border-pink-300 hover:bg-pink-50 transition"
          >
            ← {a.back}
          </Link>
        )}

        {error && (
          <div role="alert" className="my-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => void load(cursor && products.length ? cursor : null)}
              className="mt-3 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 transition cursor-pointer"
            >
              {a.retry}
            </button>
          </div>
        )}

        {loading && (
          <p role="status" className="min-h-24 py-6 text-sm font-semibold text-[var(--text-secondary)]">
            {t.loadingCatalog}
          </p>
        )}

        {!loading && !error && !products.length && (
          <div role="status" className="rounded-2xl border border-dashed border-[#F1E4ED] bg-[#FFF9FC] py-10 px-4 text-center">
            <p className="text-sm sm:text-base font-bold text-[#251D2C]">{filters ? t.searchEmpty : t.emptyCatalog}</p>
          </div>
        )}

        {!slug && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map(p => {
              const isReady = ready(p);
              return (
                <article
                  key={p.id}
                  className="group flex min-w-0 flex-col justify-between rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC]/60 p-4 sm:p-5 transition hover:border-pink-300 hover:bg-white"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="rounded-lg border border-pink-100 bg-white px-2.5 py-0.5 text-[11px] font-bold text-pink-700 truncate">
                        {p.appsConfig?.appGroup || p.category}
                      </p>
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${isReady ? 'bg-emerald-500' : 'bg-amber-400'}`}
                        aria-hidden="true"
                      />
                    </div>
                    <h2 className="mt-3 break-words text-base sm:text-lg font-extrabold leading-6 text-[#251D2C] group-hover:text-pink-600 transition-colors">
                      {p.name}
                    </h2>
                    <p className="mt-2.5 text-lg sm:text-xl font-extrabold text-pink-600">{money(p.price)}</p>
                    {p.appsConfig ? (
                      <dl className="mt-4 divide-y divide-[#F1E4ED] text-xs sm:text-sm">
                        {([
                          [a.accountType, p.appsConfig.accountType],
                          [a.durationDays, String(p.appsConfig.durationDays)],
                          [a.warrantyDays, String(p.appsConfig.warrantyDays)],
                        ]).map(([label, value]) => (
                          <div key={label} className="flex justify-between gap-3 py-2">
                            <dt className="text-[var(--text-secondary)]">{label}</dt>
                            <dd className="min-w-0 break-words text-right font-medium text-[#251D2C]">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : <p className="mt-2 text-xs text-[var(--text-secondary)]">{a.details}</p>}
                    <p className="mt-1.5 text-xs font-bold text-[#251D2C]">{availability(p)}</p>
                  </div>
                  <Link
                    href={`/apps/${encodeURIComponent(p.slug)}`}
                    className="mt-4 block rounded-xl bg-pink-600 hover:bg-pink-700 px-3 py-2.5 text-center text-xs sm:text-sm font-extrabold text-white transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-600"
                  >
                    {a.details}
                  </Link>
                </article>
              );
            })}
          </div>
        )}

        {!slug && cursor && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void load(cursor)}
            className="mt-6 rounded-xl border border-[#F1E4ED] bg-white px-5 py-2.5 text-sm font-bold text-[#251D2C] hover:border-pink-300 hover:bg-pink-50 transition cursor-pointer"
          >
            {t.loadMore}
          </button>
        )}

        {product && (
          <div className="space-y-6 mt-2">
            <AppsPackageDetails product={product} />
            <form onSubmit={checkout} className="space-y-4 rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1E4ED] pb-3.5">
                <p className="text-lg sm:text-xl font-extrabold text-[#251D2C]">
                  {t.modalTotal}: <span className="text-pink-600">{money(product.price)}</span>
                </p>
                <p className="rounded-full border border-[#F1E4ED] bg-white px-3 py-1 text-xs font-bold text-[#251D2C]">
                  {availability(product)}
                </p>
              </div>
              <label className="block text-sm font-bold text-[#251D2C]">
                {a.email}
                <input
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={150}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={busy}
                  className="mt-1.5 w-full rounded-xl border border-[#F1E4ED] bg-white px-4 py-3 text-sm font-medium text-[#251D2C] focus:border-pink-500 focus:outline-none"
                />
              </label>
              <p className="text-xs sm:text-sm leading-6 text-[var(--text-secondary)]">{a.emailHint}</p>
              <label className="flex items-start gap-3 text-xs sm:text-sm leading-6 font-medium text-[#251D2C] cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={agree}
                  onChange={e => setAgree(e.target.checked)}
                  disabled={busy}
                  className="mt-1 h-4 w-4 shrink-0 accent-pink-600"
                />
                <span>{a.agree}</span>
              </label>
              <button
                disabled={busy || !agree || !ready(product)}
                className="w-full rounded-xl bg-pink-600 hover:bg-pink-700 p-3.5 text-sm font-extrabold text-white disabled:opacity-50 transition cursor-pointer"
              >
                {busy ? a.processing : t.btnPayNow}
              </button>
            </form>
          </div>
        )}
      </section>

      {!slug && (
        <form
          className="mt-6 rounded-3xl border border-[#F1E4ED] bg-white p-5 sm:p-6"
          onSubmit={event => {
            event.preventDefault();
            if (invoice.trim()) router.push('/order/' + encodeURIComponent(invoice.trim()));
          }}
        >
          <label className="block text-sm font-extrabold text-[#251D2C]">
            {t.trackTitle}
            <input
              value={invoice}
              onChange={e => setInvoice(e.target.value)}
              maxLength={191}
              placeholder={t.trackPlaceholder}
              className="mt-2 w-full rounded-xl border border-[#F1E4ED] bg-[#FFF9FC] px-4 py-3 text-sm font-medium text-[#251D2C] focus:border-pink-500 focus:bg-white focus:outline-none"
            />
          </label>
          <button className="mt-3 rounded-xl border border-[#F1E4ED] bg-pink-50 hover:bg-pink-100 px-5 py-2.5 text-sm font-extrabold text-pink-700 transition cursor-pointer">
            {t.trackButton}
          </button>
        </form>
      )}
    </StoreShell>
  );
}
