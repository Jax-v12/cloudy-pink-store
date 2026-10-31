'use client';
import { formatMoney, type Currency, type Region } from '@/lib/regionalPricing';
import { refreshOrderPages } from '@/lib/adminOrderPages';
import { parseAppsConfig, type AppsConfig } from '@/lib/appsProduct';
import AdminDialog from '@/components/AdminDialog';
import AdminOperationsGuide from '@/components/AdminOperationsGuide';

import { useLanguage } from '@/context/LanguageContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function playAdminChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = () => {
      void ctx.close().catch(() => {});
    };
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // AudioContext blocked or unavailable
  }
}

interface ProductSummary {
  name: string;
  price: number;
  category?: string | null;
}

interface StockItem {
  id: number;
  productId: number;
  profileName: string | null;
  status: 'READY' | 'LOCKED' | 'SOLD';
  createdAt: string;
  product: ProductSummary;
}

interface ProductOption {
  id: number;
  name: string;
  slug: string;
  price: number;
  category: string | null;
  active: boolean;
  appsConfig: AppsConfig | null;
  updatedAt: string;
  stockAvailable: number;
}

const APPS_CONFIG_FIELDS = [
  'appGroup',
  'accountType',
  'durationDays',
  'devices',
  'regionRules',
  'included',
  'usageRules',
  'instructions',
  'warrantyDays',
  'warrantyTerms',
] as const;

interface AppsProductDraft {
  id?: number;
  name: string;
  slug: string;
  price: string;
  category: string;
  active: boolean;
  updatedAt?: string;
  config: Record<string, string>;
}

const createBlankDraft = (): AppsProductDraft => ({
  name: '',
  slug: '',
  price: '',
  category: 'Apps Premium',
  active: false,
  config: {},
});

interface OrderItem {
  id: number;
  invoice: string;
  customerEmail: string;
  totalAmount: number;
  currency: Currency;
  pricingRegion?: Region;
  paymentMethod?: string;
  type?: 'APPS' | 'GAME' | 'ROBLOX';
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  createdAt: string;
  product: {
    name: string;
  };
  otp?: {
    status: 'IDLE' | 'REQUESTED' | 'DELIVERED';
    requestId: number | null;
  } | null;
}

interface AnalyticsData {
  totalRevenue: number;
  totalSold: number;
  chartData: { date: string; revenue: number }[];
}

export default function AdminPage() {
  const { t, language, setLanguage } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Tab mode
  const [activeTab, setActiveTab] = useState<'overview' | 'single' | 'batch' | 'products' | 'orders'>('overview');

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Single form state
  const [emailAccount, setEmailAccount] = useState('');
  const [passwordAccount, setPasswordAccount] = useState('');
  const [profileName, setProfileName] = useState('');
  const [pin, setPin] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Batch & shared product selection state
  const [batchText, setBatchText] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productCursor, setProductCursor] = useState<number | null>(null);
  const productDepthRef = useRef(1);
  const productLoadingRef = useRef(false);
  const selectedProductRef = useRef<ProductOption | null>(null);
  useEffect(() => {
    selectedProductRef.current = productOptions.find(product => String(product.id) === selectedProductId) ?? null;
  }, [productOptions, selectedProductId]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMessage, setBatchMessage] = useState('');
  const [batchIsSuccess, setBatchIsSuccess] = useState(false);

  // Unified Apps Product management state
  const [productDraft, setProductDraft] = useState<AppsProductDraft | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  const [editIsSuccess, setEditIsSuccess] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');

  // Orders state
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [otpSendingId, setOtpSendingId] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const seenOrderIdsRef = useRef<Set<number>>(new Set());
  const seenOtpRequestIdsRef = useRef<Set<number>>(new Set());
  const loadedOrderCursorsRef = useRef<number[]>([]);
  const initialOrdersLoadedRef = useRef(false);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem('cloudy_admin_sound');
        if (saved !== null) {
          setSoundEnabled(saved === 'true');
        }
      } catch {
        // Ignore storage errors
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('cloudy_admin_sound', String(next));
      } catch {
        // Ignore storage errors
      }
      if (next) playAdminChime();
      return next;
    });
  };

  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [stockCursor, setStockCursor] = useState<number | null>(null);
  const [orderCursor, setOrderCursor] = useState<number | null>(null);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [pageError, setPageError] = useState(false);

  const refreshStocks = useCallback(async (cursor?: number) => {
    setStocksLoading(true);
    try {
      const res = await fetch('/api/admin/stock' + (cursor ? '?cursor=' + cursor : ''));
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error('REQUEST_FAILED');
      if (Array.isArray(json.data)) {
        setStocks(previous => (cursor ? [...previous, ...json.data] : json.data));
        setStockCursor(json.pagination.nextCursor);
        setPageError(false);
      }
    } catch (err: unknown) {
      console.error('Gagal memuat data stok:', err);
      setPageError(true);
    } finally {
      setStocksLoading(false);
    }
  }, []);

  const loadProductOptions = useCallback(async (cursor?: number) => {
    if (productLoadingRef.current) return;
    productLoadingRef.current = true;
    setProductsLoading(true);
    try {
      const fetchPage = async (pageCursor?: number) => {
        const res = await fetch('/api/admin/apps/products' + (pageCursor ? '?cursor=' + pageCursor : ''));
        const json = await res.json();
        if (!res.ok || !json.success || !Array.isArray(json.data)) throw new Error('REQUEST_FAILED');
        const nextCursor: unknown = json.pagination?.nextCursor;
        if (nextCursor !== null && (typeof nextCursor !== 'number' || !Number.isSafeInteger(nextCursor) || nextCursor <= 0)) throw new Error('REQUEST_FAILED');
        const data: ProductOption[] = json.data;
        return { data, nextCursor };
      };
      if (cursor) {
        const page = await fetchPage(cursor);
        setProductOptions(previous => [...new Map([...previous, ...page.data].map(product => [product.id, product])).values()]);
        setProductCursor(page.nextCursor);
        productDepthRef.current++;
      } else {
        const refreshed = await refreshOrderPages<ProductOption>(productDepthRef.current, fetchPage);
        const retained = selectedProductRef.current;
        // New products can move the selected item just beyond the refreshed pages.
        const options = retained && !refreshed.rows.some(product => product.id === retained.id)
          ? [...refreshed.rows, retained] : refreshed.rows;
        setProductOptions(options);
        setProductCursor(refreshed.nextCursor);
        productDepthRef.current = refreshed.cursors.length + 1;
        setSelectedProductId(previous => options.some(product => String(product.id) === previous) ? previous : options[0] ? String(options[0].id) : '');
      }
    } catch (err: unknown) {
      console.error('Gagal memuat produk:', err);
    } finally {
      productLoadingRef.current = false;
      setProductsLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async (cursor?: number) => {
    setOrdersLoading(true);
    try {
      if (cursor) {
        const res = await fetch(`/api/admin/orders?cursor=${cursor}`);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(res.status === 401 ? 'UNAUTHORIZED' : 'LOAD_FAILED');
        if (Array.isArray(json.data)) {
          const incoming: OrderItem[] = json.data;
          if (!loadedOrderCursorsRef.current.includes(cursor)) {
            loadedOrderCursorsRef.current = [...loadedOrderCursorsRef.current, cursor];
          }
          for (const row of incoming) {
            seenOrderIdsRef.current.add(row.id);
            if (row.otp?.status === 'REQUESTED' && typeof row.otp.requestId === 'number') {
              seenOtpRequestIdsRef.current.add(row.otp.requestId);
            }
          }
          setOrders(previous => {
            const seenIds = new Set(previous.map(item => item.id));
            const merged = [...previous];
            for (const row of incoming) {
              if (!seenIds.has(row.id)) {
                seenIds.add(row.id);
                merged.push(row);
              }
            }
            return merged;
          });
          setOrderCursor(json.pagination.nextCursor);
          setOrdersError('');
        }
        return;
      }

      const refreshed = await refreshOrderPages<OrderItem>(loadedOrderCursorsRef.current.length + 1, async pageCursor => {
        const res = await fetch('/api/admin/orders' + (pageCursor ? `?cursor=${pageCursor}` : ''));
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(res.status === 401 ? 'UNAUTHORIZED' : 'LOAD_FAILED');
        if (!Array.isArray(json.data)) throw new Error('LOAD_FAILED');
        return { data: json.data, nextCursor: json.pagination?.nextCursor ?? null };
      });
      const combined = refreshed.rows;
      const lastNextCursor = refreshed.nextCursor;
      loadedOrderCursorsRef.current = refreshed.cursors;

      let hasNewOrder = false;
      let hasNewRequestedOtp = false;
      for (const row of combined) {
        if (!seenOrderIdsRef.current.has(row.id)) {
          hasNewOrder = true;
          seenOrderIdsRef.current.add(row.id);
        }
        if (row.otp?.status === 'REQUESTED' && typeof row.otp.requestId === 'number') {
          if (!seenOtpRequestIdsRef.current.has(row.otp.requestId)) {
            hasNewRequestedOtp = true;
            seenOtpRequestIdsRef.current.add(row.otp.requestId);
          }
        }
      }
      if (initialOrdersLoadedRef.current && (hasNewOrder || hasNewRequestedOtp)) {
        let soundAllowed = true;
        try {
          soundAllowed = localStorage.getItem('cloudy_admin_sound') !== 'false';
        } catch {
          soundAllowed = true;
        }
        if (soundAllowed) {
          playAdminChime();
        }
      }
      initialOrdersLoadedRef.current = true;

      setOrders(combined);
      setOrderCursor(lastNextCursor);
      setOtpInputs(prev => {
        const activeKeys = new Set<string>();
        for (const row of combined) {
          if (row.otp?.status === 'REQUESTED' && row.otp.requestId !== null) {
            activeKeys.add(`${row.id}:${row.otp.requestId}`);
          }
        }
        let changed = false;
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (activeKeys.has(k)) {
            next[k] = v;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      setOrdersError('');
    } catch (err: unknown) {
      setOrdersError(err instanceof Error ? err.message : 'LOAD_FAILED');
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      void loadOrders();
    }, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated, loadOrders]);

  const handleSendOtp = async (order: OrderItem) => {
    const orderId = order.id;
    const requestId = order.otp?.status === 'REQUESTED' ? order.otp.requestId : null;
    if (!requestId || otpSendingId !== null) return;
    const draftKey = `${orderId}:${requestId}`;
    const code = (otpInputs[draftKey] || '').trim();
    if (!code) return;
    setOtpSendingId(orderId);
    setOrdersError('');
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, requestId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (res.status === 409) {
          void loadOrders();
          throw new Error('OTP_REFRESH_REQUIRED');
        }
        throw new Error(res.status === 401 ? 'UNAUTHORIZED' : 'LOAD_FAILED');
      }
      setOtpInputs(prev => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      setOrders(prev => prev.map(row => (row.id === orderId ? { ...row, otp: { status: 'DELIVERED', requestId } } : row)));
    } catch (err: unknown) {
      setOrdersError(err instanceof Error ? err.message : 'LOAD_FAILED');
    } finally {
      setOtpSendingId(null);
    }
  };

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch('/api/admin/analytics');
      const json = await res.json();
      if (json.success && json.data) {
        setAnalyticsData(json.data);
      }
    } catch (err: unknown) {
      console.error('Gagal memuat analitik:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function initializeAuth() {
      try {
        const res = await fetch('/api/admin/auth');
        const json = await res.json();

        if (!ignore) {
          if (res.ok && json.authenticated) {
            setIsAuthenticated(true);
            await refreshStocks();
            await loadProductOptions();
            await loadOrders();
            await loadAnalytics();
          } else {
            setIsAuthenticated(false);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          console.error('Auth check error:', err);
          setIsAuthenticated(false);
        }
      } finally {
        if (!ignore) {
          setAuthLoading(false);
        }
      }
    }

    initializeAuth();
    return () => {
      ignore = true;
    };
  }, [refreshStocks, loadProductOptions, loadOrders, loadAnalytics]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const messages: Record<string, string> = {
          INVALID_CREDENTIALS: t.loginFailed,
          RATE_LIMIT_EXCEEDED: t.rateLimited,
          DATABASE_SCHEMA_OUTDATED: t.loginDatabaseError,
          CSRF_REJECTED: t.loginOriginError,
          ADMIN_NOT_CONFIGURED: t.loginConfigError,
        };
        throw new Error(messages[json.errorCode] || t.loginSystemError);
      }
      const sessionCheck = await fetch('/api/admin/auth', { cache: 'no-store' });
      if (!sessionCheck.ok || !(await sessionCheck.json()).authenticated) throw new Error(t.loginSessionError);
      setIsAuthenticated(true);
      setPasswordInput('');
      await refreshStocks();
      await loadProductOptions();
      await loadOrders();
      await loadAnalytics();
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : t.loginFailed);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/admin/auth', { method: 'DELETE' });
      if (!response.ok) throw new Error('LOGOUT_FAILED');
      loadedOrderCursorsRef.current = [];
      setStocks([]);
      setOrders([]);
      setOtpInputs({});
      setIsAuthenticated(false);
    } catch (err: unknown) {
      console.error('Logout error:', err);
      setPageError(true);
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage('');

    const found = productOptions.find(p => String(p.id) === selectedProductId);
    if (!found) {
      setIsSuccess(false);
      setFormMessage(t.batchErrorEmpty);
      setFormLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: found.id,
          productName: found.name,
          price: Math.max(1, found.price),
          category: found.category || 'Apps Premium',
          emailAccount,
          passwordAccount,
          profileName,
          pin,
          additionalInfo,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menambahkan stok.');
      }

      setIsSuccess(true);
      setFormMessage(t.encryptionNote);
      setEmailAccount('');
      setPasswordAccount('');
      setProfileName('');
      setPin('');
      setAdditionalInfo('');
      await Promise.all([refreshStocks(), loadProductOptions()]);
    } catch (err: unknown) {
      setIsSuccess(false);
      setFormMessage(err instanceof Error ? err.message : t.errSystem);
    } finally {
      setFormLoading(false);
    }
  };

  const handleBatchUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setBatchLoading(true);
    setBatchMessage('');
    setBatchIsSuccess(false);

    const lines = batchText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) {
      setBatchMessage(t.batchErrorEmpty);
      setBatchLoading(false);
      return;
    }

    const parsedStocks: { emailAccount: string; passwordAccount: string; profileName: string | null; pin: string | null }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split('|');
      const email = parts[0]?.trim();
      const pass = parts[1]?.trim();

      if (!email || !pass) {
        setBatchMessage(t.batchErrorFormat.replace('{line}', String(i + 1)));
        setBatchLoading(false);
        return;
      }

      parsedStocks.push({
        emailAccount: email,
        passwordAccount: pass,
        profileName: parts[2]?.trim() || null,
        pin: parts[3]?.trim() || null,
      });
    }

    const found = productOptions.find(p => String(p.id) === selectedProductId);
    if (!found) {
      setBatchMessage(t.batchErrorEmpty);
      setBatchLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/stock/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: found.id,
          productName: found.name,
          price: Math.max(1, found.price),
          category: found.category || 'Apps Premium',
          stocks: parsedStocks,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || t.errSystem);
      }

      setBatchIsSuccess(true);
      setBatchMessage(t.batchSuccess.replace('{count}', String(json.data?.insertedCount ?? parsedStocks.length)));
      setBatchText('');
      await Promise.all([refreshStocks(), loadProductOptions()]);
    } catch (err: unknown) {
      setBatchIsSuccess(false);
      setBatchMessage(err instanceof Error ? err.message : t.errSystem);
    } finally {
      setBatchLoading(false);
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const handleSaveAppsProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productDraft || editLoading) return;
    setEditLoading(true);
    setEditMessage('');

    try {
      const hasConfig = Object.values(productDraft.config).some(Boolean);
      const config = hasConfig
        ? parseAppsConfig({
            ...productDraft.config,
            version: 1,
            durationDays: Number(productDraft.config.durationDays),
            warrantyDays: Number(productDraft.config.warrantyDays),
            activationMethod:
              productDraft.config.fulfillmentMode === 'ACTIVATION' ? productDraft.config.activationMethod : null,
          })
        : null;
      const res = await fetch('/api/admin/apps/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: productDraft.id,
          name: productDraft.name,
          slug: productDraft.slug,
          category: productDraft.category,
          price: Number(productDraft.price),
          active: productDraft.active,
          appsConfig: config,
          updatedAt: productDraft.updatedAt,
        }),
      });
      const json = await res.json();
      if (json.errorCode === 'REAUTH_REQUIRED') {
        setReauthOpen(true);
        throw new Error(t.apps.reauth);
      }
      if (!res.ok || !json.success) {
        throw new Error(json.message || t.apps.error);
      }
      setEditIsSuccess(true);
      setEditMessage(t.apps.saved);
      setProductDraft(null);
      await Promise.all([loadProductOptions(), refreshStocks()]);
    } catch (err: unknown) {
      setEditIsSuccess(false);
      setEditMessage(err instanceof Error ? err.message : t.apps.error);
    } finally {
      setEditLoading(false);
    }
  };

  const handleReauth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editLoading) return;
    setEditLoading(true);
    setEditMessage('');
    try {
      const res = await fetch('/api/admin/reauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: reauthPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(t.apps.error);
      setReauthPassword('');
      setReauthOpen(false);
      setEditIsSuccess(true);
      setEditMessage(t.apps.saved);
    } catch (err: unknown) {
      setEditIsSuccess(false);
      setEditMessage(err instanceof Error ? err.message : t.apps.error);
    } finally {
      setEditLoading(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center font-sans bg-[#FFF9FC]">
        <div className="bg-white px-6 py-4 rounded-2xl border border-[#F1E4ED] shadow-xs text-pink-600 font-extrabold animate-pulse text-sm">
          Memeriksa izin akses admin...
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="relative min-h-screen flex items-center justify-center p-4 font-sans bg-[#FFF9FC] text-[#251D2C] overflow-hidden">
        <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-pink-200/40 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-purple-200/35 blur-3xl" />
        </div>

        <div className="relative z-10 bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-[0_18px_40px_-14px_rgba(157,23,77,0.14)] border border-[#F1E4ED]">
          <div className="text-center mb-6">
            <span className="inline-block px-3 py-1 bg-pink-50 text-pink-700 text-[10px] font-extrabold rounded-full mb-2.5 border border-pink-200 uppercase tracking-wider">
              Secret Control Room
            </span>
            <h1 className="text-2xl font-extrabold text-[#251D2C]">Admin Login</h1>
            <p className="text-xs text-[#756C7D] mt-1">Masukkan kata sandi untuk mengelola stok akun</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#251D2C] mb-1.5">Kata Sandi Admin</label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                className="w-full bg-[#FFF9FC] border border-[#F1E4ED] rounded-xl px-3.5 py-2.5 text-sm text-[#251D2C] placeholder-[#756C7D]/60 focus:outline-none focus:border-pink-500 focus:bg-white font-mono transition"
              />
            </div>

            {loginError && (
              <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 font-semibold">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white font-extrabold rounded-xl text-sm shadow-sm shadow-pink-600/20 transition active:scale-[0.98] cursor-pointer"
            >
              Masuk Dashboard
            </button>

            <div className="text-center pt-2">
              <Link href="/" className="text-xs font-bold text-pink-700 hover:underline">
                ← Kembali ke Toko
              </Link>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen p-3 sm:p-6 md:p-8 font-sans bg-[#FFF9FC] text-[#251D2C] pb-24">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-pink-200/35 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-purple-200/25 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-6">
        {/* Top Bar Dashboard */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-[#F1E4ED] shadow-[0_12px_32px_-12px_rgba(157,23,77,0.08)] flex flex-col lg:flex-row justify-between lg:items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold bg-pink-50 text-pink-700 px-2.5 py-0.5 rounded-full border border-pink-200 uppercase tracking-wide">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Admin Panel Active
              </span>
              <a
                href="/admin/commerce"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#F1E4ED] bg-[#FFF9FC] hover:border-pink-300 hover:bg-pink-50 px-3 py-0.5 text-[11px] font-bold text-pink-700 transition"
              >
                {t.commerce.fulfillmentAdmin} · {t.commerce.catalogAdmin} ↗
              </a>
              <AdminOperationsGuide />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#251D2C]">{t.adminTitle}</h1>
            <p className="text-xs text-[#756C7D] mt-0.5">{t.encryptionNote}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Language switcher */}
            <div className="inline-flex bg-[#FFF9FC] p-1 rounded-xl border border-[#F1E4ED]">
              <button
                onClick={() => setLanguage('ID')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  language === 'ID' ? 'bg-pink-600 text-white shadow-2xs' : 'text-[#756C7D] hover:text-[#251D2C]'
                }`}
              >
                ID
              </button>
              <button
                onClick={() => setLanguage('MY')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  language === 'MY' ? 'bg-pink-600 text-white shadow-2xs' : 'text-[#756C7D] hover:text-[#251D2C]'
                }`}
              >
                MY
              </button>
              <button
                onClick={() => setLanguage('EN')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  language === 'EN' ? 'bg-pink-600 text-white shadow-2xs' : 'text-[#756C7D] hover:text-[#251D2C]'
                }`}
              >
                EN
              </button>
            </div>
            <button
              type="button"
              onClick={toggleSound}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-[#FFF9FC] border-[#F1E4ED] text-[#756C7D]'
              }`}
              title={`${t.adminSoundToggle}: ${soundEnabled ? t.adminSoundOn : t.adminSoundOff}`}
            >
              <span>{soundEnabled ? '🔔' : '🔕'}</span>
              <span className="hidden sm:inline">{soundEnabled ? t.adminSoundOn : t.adminSoundOff}</span>
            </button>
            <Link
              href="/"
              className="px-3.5 py-2 bg-[#FFF9FC] hover:bg-pink-50 text-[#251D2C] font-bold rounded-xl text-xs transition border border-[#F1E4ED]"
            >
              Lihat Toko
            </Link>
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer"
            >
              Keluar (Logout)
            </button>
          </div>
        </div>

        {/* Main Workspace Card */}
        <div className="bg-white p-5 sm:p-8 rounded-3xl border border-[#F1E4ED] shadow-[0_12px_32px_-12px_rgba(157,23,77,0.08)]">
          {/* Tab Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b border-[#F1E4ED]">
            <div role="tablist" className="flex flex-wrap bg-[#FFF9FC] p-1 rounded-2xl border border-[#F1E4ED] gap-1">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'overview'}
                onClick={() => {
                  setActiveTab('overview');
                  loadAnalytics();
                }}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'bg-pink-600 text-white shadow-xs'
                    : 'text-[#756C7D] hover:text-[#251D2C]'
                }`}
              >
                {t.tabOverview}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'single'}
                onClick={() => setActiveTab('single')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'single'
                    ? 'bg-pink-600 text-white shadow-xs'
                    : 'text-[#756C7D] hover:text-[#251D2C]'
                }`}
              >
                {t.tabSingle}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'batch'}
                onClick={() => setActiveTab('batch')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'batch'
                    ? 'bg-pink-600 text-white shadow-xs'
                    : 'text-[#756C7D] hover:text-[#251D2C]'
                }`}
              >
                {t.tabBatch}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'products'}
                onClick={() => {
                  setActiveTab('products');
                  setEditMessage('');
                  setProductDraft(null);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'products'
                    ? 'bg-pink-600 text-white shadow-xs'
                    : 'text-[#756C7D] hover:text-[#251D2C]'
                }`}
              >
                {t.tabProducts}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'orders'}
                onClick={() => {
                  setActiveTab('orders');
                  loadOrders();
                }}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                  activeTab === 'orders'
                    ? 'bg-pink-600 text-white shadow-xs'
                    : 'text-[#756C7D] hover:text-[#251D2C]'
                }`}
              >
                {t.tabOrders}
              </button>
            </div>
            <div>
              <p className="text-[11px] text-[#756C7D] font-medium">{t.encryptionNote}</p>
            </div>
          </div>

          {/* === OVERVIEW / ANALYTICS TAB === */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {analyticsLoading && !analyticsData ? (
                <div className="text-center py-10 text-[#756C7D] font-semibold animate-pulse">
                  {t.loadingAnalytics || 'Loading analytics...'}
                </div>
              ) : analyticsData ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-pink-600 to-rose-500 p-5 sm:p-6 rounded-2xl shadow-md shadow-pink-500/15 text-white">
                      <p className="text-xs font-bold text-pink-100 uppercase tracking-wider mb-1">
                        {t.statTotalRevenue || 'Total Revenue'}
                      </p>
                      <h3 className="text-2xl sm:text-3xl font-extrabold">{formatRupiah(analyticsData.totalRevenue)}</h3>
                    </div>
                    <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-5 sm:p-6 rounded-2xl shadow-md shadow-purple-500/15 text-white">
                      <p className="text-xs font-bold text-purple-100 uppercase tracking-wider mb-1">
                        {t.statTotalSold || 'Total Sold'}
                      </p>
                      <h3 className="text-2xl sm:text-3xl font-extrabold">
                        {analyticsData.totalSold} <span className="text-sm font-semibold text-purple-200">Akun</span>
                      </h3>
                    </div>
                  </div>

                  <div className="bg-[#FFF9FC] p-4 sm:p-6 rounded-2xl border border-[#F1E4ED]">
                    <h4 className="text-sm font-extrabold text-[#251D2C] mb-4">{t.chartTitle || 'Last 7 Days Revenue'}</h4>
                    <div className="h-[250px] sm:h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analyticsData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#EC4899" stopOpacity={0.6} />
                              <stop offset="95%" stopColor="#EC4899" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#756C7D', fontWeight: 600 }}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#756C7D', fontWeight: 600 }}
                            tickFormatter={value => `Rp${value / 1000}k`}
                          />
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1E4ED" />
                          <Tooltip
                            contentStyle={{
                              borderRadius: '12px',
                              border: '1px solid #F1E4ED',
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.08)',
                            }}
                            labelStyle={{ fontWeight: 'bold', color: '#251D2C', marginBottom: '4px' }}
                            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                            formatter={(value: any) => [formatRupiah(Number(value) || 0), t.statTotalRevenue || 'Revenue']}
                          />
                          <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="#EC4899"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorRevenue)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-rose-600 font-semibold">
                  {t.errAnalytics || 'Failed to load analytics.'}
                </div>
              )}
            </div>
          )}

          {/* === SINGLE INPUT FORM === */}
          {activeTab === 'single' && (
            <form onSubmit={handleAddStock} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="single-product-select" className="block text-xs font-bold text-[#251D2C]">
                    {t.batchProductSelect}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('products');
                      setEditMessage('');
                    }}
                    className="text-xs font-bold text-pink-600 hover:text-pink-700 hover:underline cursor-pointer"
                  >
                    {t.apps.manage} →
                  </button>
                </div>
                <select
                  id="single-product-select"
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  required
                  className="w-full bg-[#FFF9FC] border border-[#F1E4ED] rounded-xl px-3.5 py-2.5 text-xs text-[#251D2C] focus:outline-none focus:border-pink-500 font-semibold"
                >
                  {productOptions.length === 0 && (
                    <option value="">{productsLoading ? t.loadingProducts : t.emptyCatalog}</option>
                  )}
                  {productOptions.map(p => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} — {formatRupiah(p.price)} ({p.active ? t.apps.active : t.commerce.unavailable} · {t.colProductStock}:{' '}
                      {p.stockAvailable})
                    </option>
                  ))}
                </select>
                {productCursor !== null && <button type="button" disabled={productsLoading} onClick={() => void loadProductOptions(productCursor)} className="mt-2 min-h-11 px-3 py-2.5 text-xs font-bold text-pink-700 disabled:opacity-50">{t.loadMore}</button>}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#251D2C] mb-1">{t.adminEmail}</label>
                <input
                  type="text"
                  required
                  placeholder="user.netflix@gmail.com"
                  value={emailAccount}
                  onChange={e => setEmailAccount(e.target.value)}
                  className="w-full bg-[#FFF9FC] border border-[#F1E4ED] rounded-xl px-3.5 py-2.5 text-xs text-[#251D2C] focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#251D2C] mb-1">{t.adminPassword}</label>
                <input
                  type="text"
                  required
                  placeholder="PasswordRahasia123!"
                  value={passwordAccount}
                  onChange={e => setPasswordAccount(e.target.value)}
                  className="w-full bg-[#FFF9FC] border border-[#F1E4ED] rounded-xl px-3.5 py-2.5 text-xs text-[#251D2C] focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#251D2C] mb-1">{t.adminProfileName}</label>
                <input
                  type="text"
                  placeholder="Contoh: Anya / Profil 1"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  className="w-full bg-[#FFF9FC] border border-[#F1E4ED] rounded-xl px-3.5 py-2.5 text-xs text-[#251D2C] focus:outline-none focus:border-pink-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#251D2C] mb-1">{t.adminPin}</label>
                <input
                  type="text"
                  placeholder="Contoh: 1234"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  className="w-full bg-[#FFF9FC] border border-[#F1E4ED] rounded-xl px-3.5 py-2.5 text-xs text-[#251D2C] focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#251D2C] mb-1">{t.adminNotes}</label>
                <input
                  type="text"
                  placeholder="Contoh: Dilarang mengganti password"
                  value={additionalInfo}
                  onChange={e => setAdditionalInfo(e.target.value)}
                  className="w-full bg-[#FFF9FC] border border-[#F1E4ED] rounded-xl px-3.5 py-2.5 text-xs text-[#251D2C] focus:outline-none focus:border-pink-500 font-medium"
                />
              </div>

              <div className="sm:col-span-2 mt-2">
                {formMessage && (
                  <div
                    className={`text-xs p-3 rounded-2xl border mb-3 font-bold ${
                      isSuccess
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {formMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={formLoading || productOptions.length === 0}
                  className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white font-extrabold rounded-xl text-xs sm:text-sm shadow-sm shadow-pink-600/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {formLoading ? t.btnSaving : t.btnSaveStock}
                </button>
              </div>
            </form>
          )}

          {/* === BATCH UPLOAD FORM === */}
          {activeTab === 'batch' && (
            <form onSubmit={handleBatchUpload} className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="batch-product-select" className="block text-xs font-bold text-[#251D2C]">
                    {t.batchProductSelect}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('products');
                      setEditMessage('');
                    }}
                    className="text-xs font-bold text-pink-600 hover:text-pink-700 hover:underline cursor-pointer"
                  >
                    {t.apps.manage} →
                  </button>
                </div>
                <select
                  id="batch-product-select"
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  required
                  className="w-full bg-[#FFF9FC] border border-[#F1E4ED] rounded-xl px-3.5 py-2.5 text-xs text-[#251D2C] focus:outline-none focus:border-pink-500 font-semibold"
                >
                  {productOptions.length === 0 && (
                    <option value="">{productsLoading ? t.loadingProducts : t.emptyCatalog}</option>
                  )}
                  {productOptions.map(p => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} — {formatRupiah(p.price)} ({p.active ? t.apps.active : t.commerce.unavailable} · {t.colProductStock}:{' '}
                      {p.stockAvailable})
                    </option>
                  ))}
                </select>
                {productCursor !== null && <button type="button" disabled={productsLoading} onClick={() => void loadProductOptions(productCursor)} className="mt-2 min-h-11 px-3 py-2.5 text-xs font-bold text-pink-700 disabled:opacity-50">{t.loadMore}</button>}
              </div>

              <div>
                <div className="flex items-start justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#251D2C]">{t.batchInstruction}</label>
                </div>
                <div className="mb-2 flex flex-wrap gap-2 items-center">
                  <code className="text-[10px] bg-[#FFF9FC] text-pink-700 px-2.5 py-1 rounded-lg border border-[#F1E4ED] font-mono font-bold">
                    {t.batchFormat}
                  </code>
                  <span className="text-[11px] text-[#756C7D]">{t.batchFormatNote}</span>
                </div>
                <textarea
                  required
                  rows={8}
                  value={batchText}
                  onChange={e => setBatchText(e.target.value)}
                  placeholder={t.batchPlaceholder}
                  className="w-full bg-[#FFF9FC] border border-[#F1E4ED] rounded-2xl px-3.5 py-3 text-xs text-[#251D2C] focus:outline-none focus:border-pink-500 font-mono resize-y placeholder-[#756C7D]/60 leading-relaxed"
                />
                <p className="text-[11px] text-[#756C7D] mt-1">
                  {batchText.split('\n').filter(l => l.trim()).length} {t.totalData.toLowerCase()} baris
                </p>
              </div>

              <div>
                {batchMessage && (
                  <div
                    className={`text-xs p-3 rounded-2xl border mb-3 font-bold ${
                      batchIsSuccess
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {batchMessage}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={batchLoading || productOptions.length === 0}
                  className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white font-extrabold rounded-xl text-xs sm:text-sm shadow-sm shadow-pink-600/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {batchLoading ? t.btnProcessingBatch : t.btnProcessBatch}
                </button>
              </div>
            </form>
          )}

          {/* === PRODUCT MANAGEMENT TAB === */}
          {activeTab === 'products' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProductDraft(createBlankDraft());
                      setEditMessage('');
                    }}
                    className="rounded-xl bg-pink-600 hover:bg-pink-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-xs transition cursor-pointer"
                  >
                    + {t.apps.newProduct}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const existing = productOptions.find(p => p.slug === 'capcut-pro-private-1-bulan');
                      if (existing) {
                        setProductDraft({
                          id: existing.id,
                          name: existing.name,
                          slug: existing.slug,
                          price: String(existing.price),
                          category: existing.category || 'Apps Premium',
                          active: existing.active,
                          updatedAt: existing.updatedAt,
                          config: existing.appsConfig
                            ? Object.fromEntries(
                                Object.entries(existing.appsConfig)
                                  .filter(([key]) => key !== 'version')
                                  .map(([key, val]) => [key, val === null ? '' : String(val)])
                              )
                            : {},
                        });
                      } else {
                        setProductDraft({
                          ...createBlankDraft(),
                          name: 'CapCut Pro Private 1 bulan',
                          slug: 'capcut-pro-private-1-bulan',
                        });
                      }
                      setEditMessage('');
                    }}
                    className="rounded-xl border border-[#F1E4ED] bg-[#FFF9FC] hover:border-pink-300 hover:bg-pink-50 px-3.5 py-2 text-xs font-bold text-[#251D2C] transition cursor-pointer"
                  >
                    CapCut Pro Private 1 bulan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const existing = productOptions.find(p => p.slug === 'capcut-pro-private-7-hari');
                      if (existing) {
                        setProductDraft({
                          id: existing.id,
                          name: existing.name,
                          slug: existing.slug,
                          price: String(existing.price),
                          category: existing.category || 'Apps Premium',
                          active: existing.active,
                          updatedAt: existing.updatedAt,
                          config: existing.appsConfig
                            ? Object.fromEntries(
                                Object.entries(existing.appsConfig)
                                  .filter(([key]) => key !== 'version')
                                  .map(([key, val]) => [key, val === null ? '' : String(val)])
                              )
                            : {},
                        });
                      } else {
                        setProductDraft({
                          ...createBlankDraft(),
                          name: 'CapCut Pro Private 7 hari',
                          slug: 'capcut-pro-private-7-hari',
                        });
                      }
                      setEditMessage('');
                    }}
                    className="rounded-xl border border-[#F1E4ED] bg-[#FFF9FC] hover:border-pink-300 hover:bg-pink-50 px-3.5 py-2 text-xs font-bold text-[#251D2C] transition cursor-pointer"
                  >
                    CapCut Pro Private 7 hari
                  </button>
                </div>
                <Link
                  href="/admin/apps"
                  className="rounded-xl border border-[#F1E4ED] bg-[#FFF9FC] hover:border-pink-300 hover:bg-pink-50 px-3.5 py-2 text-xs font-bold text-pink-700 transition"
                >
                  {t.apps.services} · {t.apps.reminderReview} →
                </Link>
              </div>

              {editMessage && (
                <div
                  role="status"
                  className={`text-xs p-3 rounded-2xl border font-bold ${
                    editIsSuccess
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {editMessage}
                </div>
              )}

              {productDraft && (
                <form
                  onSubmit={handleSaveAppsProduct}
                  className="grid gap-4 rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] p-4 sm:p-5 sm:grid-cols-2"
                >
                  {(['name', 'slug', 'price', 'category'] as const).map(key => (
                    <label key={key} className="text-xs font-bold text-[#251D2C]">
                      {t.apps[key]}
                      <input
                        required={key !== 'price'}
                        type={key === 'price' ? 'number' : 'text'}
                        min={0}
                        max={key === 'price' ? 2147483647 : undefined}
                        maxLength={key === 'category' ? 50 : 100}
                        value={productDraft[key]}
                        onChange={e => setProductDraft({ ...productDraft, [key]: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-[#F1E4ED] bg-white px-3 py-2 text-xs font-medium text-[#251D2C] focus:border-pink-500 focus:outline-none"
                      />
                    </label>
                  ))}
                  {APPS_CONFIG_FIELDS.map(key => (
                    <label key={key} className="text-xs font-bold text-[#251D2C]">
                      {t.apps[key]}
                      <textarea
                        rows={2}
                        maxLength={
                          ['usageRules', 'instructions', 'warrantyTerms'].includes(key)
                            ? 2000
                            : key === 'included'
                              ? 1000
                              : 300
                        }
                        value={productDraft.config[key] || ''}
                        onChange={e =>
                          setProductDraft({
                            ...productDraft,
                            config: { ...productDraft.config, [key]: e.target.value },
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-[#F1E4ED] bg-white px-3 py-2 text-xs font-normal text-[#251D2C] focus:border-pink-500 focus:outline-none"
                      />
                    </label>
                  ))}
                  <label className="text-xs font-bold text-[#251D2C]">
                    {t.apps.fulfillmentMode}
                    <select
                      value={productDraft.config.fulfillmentMode || ''}
                      onChange={e =>
                        setProductDraft({
                          ...productDraft,
                          config: { ...productDraft.config, fulfillmentMode: e.target.value, activationMethod: '' },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[#F1E4ED] bg-white px-3 py-2 text-xs font-medium text-[#251D2C] focus:border-pink-500 focus:outline-none"
                    >
                      <option value="">{t.apps.select}</option>
                      {(['READY_ACCOUNT', 'ACTIVATION'] as const).map(key => (
                        <option key={key} value={key}>
                          {t.apps[key]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {productDraft.config.fulfillmentMode === 'ACTIVATION' && (
                    <label className="text-xs font-bold text-[#251D2C]">
                      {t.apps.activationMethod}
                      <select
                        required
                        value={productDraft.config.activationMethod || ''}
                        onChange={e =>
                          setProductDraft({
                            ...productDraft,
                            config: { ...productDraft.config, activationMethod: e.target.value },
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-[#F1E4ED] bg-white px-3 py-2 text-xs font-medium text-[#251D2C] focus:border-pink-500 focus:outline-none"
                      >
                        <option value="">{t.apps.select}</option>
                        {(['INVITATION', 'LINK', 'VOUCHER'] as const).map(key => (
                          <option key={key} value={key}>
                            {t.apps[key]}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="flex items-center gap-2.5 text-xs font-bold text-[#251D2C] sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={productDraft.active}
                      onChange={e => setProductDraft({ ...productDraft, active: e.target.checked })}
                      className="h-4 w-4 accent-pink-600"
                    />
                    {t.apps.active}
                  </label>
                  <div className="flex gap-3 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={editLoading}
                      className="rounded-xl bg-pink-600 hover:bg-pink-700 px-5 py-2.5 text-xs font-extrabold text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      {editLoading ? t.btnSavingEdit : t.apps.save}
                    </button>
                    <button
                      type="button"
                      disabled={editLoading}
                      onClick={() => setProductDraft(null)}
                      className="rounded-xl border border-[#F1E4ED] bg-white hover:bg-pink-50 px-4 py-2.5 text-xs font-bold text-[#251D2C] transition cursor-pointer"
                    >
                      {t.apps.cancel}
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#F1E4ED] text-[#756C7D] uppercase text-[10px] tracking-wider bg-[#FFF9FC]">
                      <th className="py-3 px-3 rounded-l-xl">{t.colProductName}</th>
                      <th className="py-3 px-3">{t.colProductPrice}</th>
                      <th className="py-3 px-3">{t.colProductCategory}</th>
                      <th className="py-3 px-3 text-center">{t.tblStatus}</th>
                      <th className="py-3 px-3 text-center">{t.colProductStock}</th>
                      <th className="py-3 px-3 rounded-r-xl text-center">{t.colActions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1E4ED]">
                    {productOptions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#756C7D] font-medium">
                          {productsLoading ? t.loadingProducts : t.emptyCatalog}
                        </td>
                      </tr>
                    ) : (
                      productOptions.map(product => {
                        const isEditing = productDraft?.id === product.id;
                        return (
                          <tr key={product.id} className={`transition ${isEditing ? 'bg-pink-50/60' : 'hover:bg-[#FFF9FC]'}`}>
                            <td className="py-3 px-3">
                              <div className="font-bold text-[#251D2C]">{product.name}</div>
                              <div className="text-[11px] font-mono text-[#756C7D]">{product.slug}</div>
                              {product.appsConfig && (
                                <div className="text-[11px] text-[#756C7D] mt-0.5">
                                  {product.appsConfig.accountType} ·{' '}
                                  {t.apps.days.replace('{days}', String(product.appsConfig.durationDays))}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-extrabold text-pink-600">{formatRupiah(product.price)}</span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="text-[#251D2C] font-medium">{product.category || '-'}</div>
                              <div className="text-[11px] text-[#756C7D]">
                                {product.appsConfig ? t.apps[product.appsConfig.fulfillmentMode] : t.apps.READY_ACCOUNT}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                                  product.active
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {product.active ? t.apps.active : t.commerce.unavailable}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {product.stockAvailable}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setProductDraft({
                                    id: product.id,
                                    name: product.name,
                                    slug: product.slug,
                                    price: String(product.price),
                                    category: product.category || 'Apps Premium',
                                    active: product.active,
                                    updatedAt: product.updatedAt,
                                    config: product.appsConfig
                                      ? Object.fromEntries(
                                          Object.entries(product.appsConfig)
                                            .filter(([key]) => key !== 'version')
                                            .map(([key, val]) => [key, val === null ? '' : String(val)])
                                        )
                                      : {},
                                  });
                                  setEditMessage('');
                                }}
                                className="px-3 py-1.5 bg-[#FFF9FC] hover:bg-pink-50 text-pink-700 font-bold rounded-lg text-[10px] border border-[#F1E4ED] transition cursor-pointer"
                              >
                                {t.btnEdit}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'products' && productCursor !== null && <button type="button" disabled={productsLoading} onClick={() => void loadProductOptions(productCursor)} className="min-h-11 px-3 py-2.5 text-xs font-bold text-pink-700 disabled:opacity-50">{t.loadMore}</button>}

          {/* === TRANSACTION HISTORY TAB === */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex justify-end mb-2 gap-2">
                {orderCursor !== null && (
                  <button disabled={ordersLoading} onClick={() => loadOrders(orderCursor)} className="text-xs font-bold text-pink-600">
                    {t.loadMore}
                  </button>
                )}
                <button
                  onClick={() => loadOrders()}
                  disabled={ordersLoading}
                  className="px-3.5 py-1.5 bg-[#FFF9FC] hover:bg-pink-50 text-pink-700 font-bold rounded-xl text-xs border border-[#F1E4ED] transition disabled:opacity-50 cursor-pointer"
                >
                  {ordersLoading ? t.loadingOrders : t.btnRefreshTable}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#F1E4ED] text-[#756C7D] uppercase text-[10px] tracking-wider bg-[#FFF9FC]">
                      <th className="py-3 px-3 rounded-l-xl">{t.tblOrderInvoice}</th>
                      <th className="py-3 px-3">{t.tblOrderDate}</th>
                      <th className="py-3 px-3">{t.tblOrderCustomer}</th>
                      <th className="py-3 px-3">{t.tblOrderProduct}</th>
                      <th className="py-3 px-3">{t.tblOrderTotal}</th>
                      <th className="py-3 px-3 rounded-r-xl text-center">{t.tblOrderStatus}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1E4ED]">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#756C7D] font-medium">
                          {ordersLoading ? t.loadingOrders : t.tblOrderEmpty}
                        </td>
                      </tr>
                    ) : (
                      orders.map(order => {
                        const otpDraftKey =
                          order.otp?.status === 'REQUESTED' && order.otp.requestId !== null
                            ? `${order.id}:${order.otp.requestId}`
                            : null;
                        return (
                          <tr key={order.id} className="hover:bg-[#FFF9FC] transition">
                            <td className="py-3 px-3 font-mono font-bold text-[#251D2C]">
                              <div>{order.invoice}</div>
                              <div className="text-[11px] font-sans font-normal text-[#756C7D] mt-0.5">
                                {t.regional.region}:{' '}
                                {order.pricingRegion
                                  ? t.regional[order.pricingRegion as Region] || order.pricingRegion
                                  : t.regional.notAvailable}{' '}
                                · {order.paymentMethod || t.regional.notAvailable}
                              </div>
                              <div className="text-[11px] font-sans font-normal text-[#756C7D]">
                                {t.regional.payerCountry}: {t.regional.payerCountryUnavailable} · {t.regional.vpnCheck}:{' '}
                                {t.regional.vpnUnassessed}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-[#756C7D] whitespace-nowrap">
                              {new Date(order.createdAt).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-3 px-3 text-[#251D2C] font-medium">{order.customerEmail}</td>
                            <td className="py-3 px-3 text-[#251D2C] font-bold">{order.product?.name || '-'}</td>
                            <td className="py-3 px-3 font-extrabold text-pink-600">
                              {formatMoney(order.totalAmount, order.currency, language)}
                            </td>
                            <td className="py-3 px-3 text-center space-y-1.5">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase ${
                                  order.status === 'PAID'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : order.status === 'PENDING'
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {order.status}
                              </span>
                              {order.otp && order.status === 'PAID' && (
                                <div className="flex flex-col items-center gap-1 pt-1">
                                  {order.otp.status === 'REQUESTED' && (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                      ⏳ {t.adminOtpRequested}
                                      {order.otp.requestId ? ` #${order.otp.requestId}` : ''}
                                    </span>
                                  )}
                                  {order.otp.status === 'DELIVERED' && (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      ✓ {t.adminOtpDelivered}
                                    </span>
                                  )}
                                  {otpDraftKey !== null && (
                                    <div className="flex items-center gap-1">
                                      <input
                                        key={otpDraftKey}
                                        type="text"
                                        maxLength={24}
                                        aria-label={`${t.adminOtpPlaceholder} ${order.invoice}`}
                                        placeholder={t.adminOtpPlaceholder}
                                        value={otpInputs[otpDraftKey] || ''}
                                        onChange={e => setOtpInputs(prev => ({ ...prev, [otpDraftKey]: e.target.value }))}
                                        className="w-28 bg-white border border-[#F1E4ED] rounded-lg px-2 py-1 text-[11px] font-mono text-[#251D2C] focus:outline-none focus:border-pink-500"
                                      />
                                      <button
                                        type="button"
                                        disabled={otpSendingId === order.id || !(otpInputs[otpDraftKey] || '').trim()}
                                        onClick={() => handleSendOtp(order)}
                                        className="px-2.5 py-1 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold rounded-lg text-[10px] transition cursor-pointer"
                                      >
                                        {t.adminBtnSendOtp}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {ordersError && (
          <p role="alert" className="text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-xs font-bold">
            {ordersError === 'UNAUTHORIZED'
              ? t.regional.adminSessionExpired
              : ordersError === 'OTP_REFRESH_REQUIRED'
                ? t.adminOtpRefreshRequired
                : t.regional.adminLoadError}
          </p>
        )}
        {pageError && (
          <p role="alert" className="text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-xs font-bold">
            {t.errSystem}
          </p>
        )}

        {/* Card Tabel Stok */}
        <div className="bg-white p-5 sm:p-8 rounded-3xl border border-[#F1E4ED] shadow-[0_12px_32px_-12px_rgba(157,23,77,0.08)] overflow-hidden">
          <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-[#F1E4ED]">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#251D2C]">{t.adminTitle}</h2>
              <p className="text-[11px] text-[#756C7D]">
                {t.totalData} {stocks.length}
              </p>
              {stockCursor !== null && (
                <button disabled={stocksLoading} onClick={() => refreshStocks(stockCursor)} className="text-xs font-bold text-pink-600">
                  {t.loadMore}
                </button>
              )}
            </div>
            <button
              disabled={stocksLoading}
              onClick={() => refreshStocks()}
              className="text-xs font-bold text-pink-700 hover:bg-pink-50 bg-[#FFF9FC] px-3.5 py-1.5 rounded-xl border border-[#F1E4ED] transition cursor-pointer"
            >
              {t.btnRefreshTable}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F1E4ED] text-[#756C7D] uppercase text-[10px] tracking-wider bg-[#FFF9FC]">
                  <th className="py-3 px-3 rounded-l-xl">{t.tblProduct}</th>
                  <th className="py-3 px-3">{t.tblEmail}</th>
                  <th className="py-3 px-3">{t.tblProfile}</th>
                  <th className="py-3 px-3 rounded-r-xl text-center">{t.tblStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1E4ED]">
                {stocks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#756C7D] font-medium">
                      {t.tblEmpty}
                    </td>
                  </tr>
                ) : (
                  stocks.map(item => (
                    <tr key={item.id} className="hover:bg-[#FFF9FC] transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#251D2C]">{item.product.name}</div>
                        <div className="text-[11px] font-extrabold text-pink-600">{formatRupiah(item.product.price)}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-[#756C7D] font-medium">{t.credentialsHidden}</td>
                      <td className="py-3 px-3 text-[#756C7D]">{item.profileName || '-'}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase ${
                            item.status === 'READY'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'LOCKED'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse'
                                : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {reauthOpen && (
          <AdminDialog
            title={t.apps.reauth}
            busy={editLoading}
            onClose={() => {
              setReauthOpen(false);
              setReauthPassword('');
            }}
          >
            <form onSubmit={handleReauth} className="space-y-4">
              <label className="block text-xs font-bold text-[#251D2C]">
                {t.apps.password}
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={reauthPassword}
                  onChange={e => setReauthPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#F1E4ED] bg-[#FFF9FC] px-3 py-2.5 text-xs text-[#251D2C] focus:border-pink-500 focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={editLoading}
                className="rounded-xl bg-pink-600 hover:bg-pink-700 px-4 py-2.5 text-xs font-extrabold text-white transition cursor-pointer"
              >
                {t.apps.reauth}
              </button>
            </form>
          </AdminDialog>
        )}
      </div>
    </main>
  );
}
