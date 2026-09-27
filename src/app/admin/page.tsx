'use client';

import { useLanguage } from '@/context/LanguageContext';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ProductSummary {
  name: string;
  price: number;
  category?: string | null;
}

interface StockItem {
  id: number;
  productId: number;
  emailAccount: string;
  profileName: string | null;
  pin: string | null;
  status: 'READY' | 'LOCKED' | 'SOLD';
  createdAt: string;
  product: ProductSummary;
}

interface ProductOption {
  id: number;
  name: string;
  price: number;
  category: string | null;
  stockAvailable: number;
}

interface EditingProduct {
  id: number;
  name: string;
  price: string;
  category: string;
}

export default function AdminPage() {
  const { t, language, setLanguage } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Tab mode
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'products'>('single');

  // Single form state
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Apps Premium');
  const [emailAccount, setEmailAccount] = useState('');
  const [passwordAccount, setPasswordAccount] = useState('');
  const [profileName, setProfileName] = useState('');
  const [pin, setPin] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Batch form state
  const [batchText, setBatchText] = useState('');
  const [batchProductMode, setBatchProductMode] = useState<'existing' | 'new'>('existing');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [batchNewProductName, setBatchNewProductName] = useState('');
  const [batchNewProductPrice, setBatchNewProductPrice] = useState('');
  const [batchNewCategory, setBatchNewCategory] = useState('Apps Premium');
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMessage, setBatchMessage] = useState('');
  const [batchIsSuccess, setBatchIsSuccess] = useState(false);

  // Product management state
  const [editingProduct, setEditingProduct] = useState<EditingProduct | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  const [editIsSuccess, setEditIsSuccess] = useState(false);

  const [stocks, setStocks] = useState<StockItem[]>([]);

  const refreshStocks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stock');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setStocks(json.data);
      }
    } catch (err: unknown) {
      console.error('Gagal memuat data stok:', err);
    }
  }, []);

  const loadProductOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/products', {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setProductOptions(json.data);
        if (json.data.length > 0) setSelectedProductId(String(json.data[0].id));
      }
    } catch (err: unknown) {
      console.error('Gagal memuat produk:', err);
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
  }, [refreshStocks, loadProductOptions]);

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
        throw new Error(json.message || 'Password salah.');
      }
      setIsAuthenticated(true);
      setPasswordInput('');
      await refreshStocks();
      await loadProductOptions();
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      setIsAuthenticated(false);
    } catch (err: unknown) {
      console.error('Logout error:', err);
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage('');

    try {
      const res = await fetch('/api/admin/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          price: Number(price),
          category,
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
      await refreshStocks();
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

    // Parse textarea — flexible: 2 to 4 pipe-separated parts per line
    const lines = batchText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

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

    // Resolve product info
    let resolvedProductName: string;
    let resolvedPrice: number;
    let resolvedCategory: string;

    if (batchProductMode === 'existing') {
      const found = productOptions.find((p) => String(p.id) === selectedProductId);
      if (!found) {
        setBatchMessage(t.batchErrorEmpty);
        setBatchLoading(false);
        return;
      }
      resolvedProductName = found.name;
      resolvedPrice = found.price;
      resolvedCategory = 'Apps Premium';
    } else {
      if (!batchNewProductName || !batchNewProductPrice) {
        setBatchMessage(t.batchErrorEmpty);
        setBatchLoading(false);
        return;
      }
      resolvedProductName = batchNewProductName;
      resolvedPrice = Number(batchNewProductPrice);
      resolvedCategory = batchNewCategory;
    }

    try {
      const res = await fetch('/api/admin/stock/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: resolvedProductName,
          price: resolvedPrice,
          category: resolvedCategory,
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
      await refreshStocks();
      await loadProductOptions();
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

  const handleSaveProduct = async () => {
    if (!editingProduct) return;
    setEditLoading(true);
    setEditMessage('');

    try {
      const res = await fetch(`/api/admin/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingProduct.name,
          price: Number(editingProduct.price),
          category: editingProduct.category,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || t.editError);
      }
      setEditIsSuccess(true);
      setEditMessage(t.editSuccess);
      setEditingProduct(null);
      await loadProductOptions();
      await refreshStocks();
    } catch (err: unknown) {
      setEditIsSuccess(false);
      setEditMessage(err instanceof Error ? err.message : t.editError);
    } finally {
      setEditLoading(false);
    }
  };

  if (authLoading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center font-sans relative bg-fixed bg-cover bg-center"
        style={{ backgroundImage: "url('/bg-anya.jpg')" }}
      >
        <div className="fixed inset-0 bg-pink-950/40 backdrop-blur-[2px] pointer-events-none"></div>
        <div className="relative z-10 bg-white/95 backdrop-blur-md px-6 py-4 rounded-2xl border-2 border-pink-300 shadow-xl text-pink-700 font-black animate-pulse text-sm">
          Memeriksa izin akses admin...
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main
        className="min-h-screen flex items-center justify-center p-4 font-sans relative bg-fixed bg-cover bg-center"
        style={{ backgroundImage: "url('/bg-anya.jpg')" }}
      >
        <div className="fixed inset-0 bg-pink-950/50 backdrop-blur-[3px] pointer-events-none"></div>

        <div className="relative z-10 bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border-4 border-pink-300">
          <div className="text-center mb-6">
            <span className="inline-block px-3 py-1 bg-pink-100 text-pink-700 text-[10px] font-black rounded-full mb-2 border border-pink-200 uppercase tracking-wider">
              Secret Control Room
            </span>
            <h1 className="text-2xl font-black text-pink-700">Admin Login</h1>
            <p className="text-xs text-neutral-500 mt-1">Masukkan kata sandi untuk mengelola stok akun</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">Kata Sandi Admin</label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-pink-50/50 border-2 border-pink-200 rounded-xl px-3.5 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-pink-500 font-mono transition"
              />
            </div>

            {loginError && (
              <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200 font-semibold">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white font-black rounded-xl text-sm shadow-md shadow-pink-300 transition active:scale-95 cursor-pointer"
            >
              Masuk Dashboard
            </button>

            <div className="text-center pt-2">
              <Link href="/" className="text-xs font-bold text-pink-600 hover:underline">
                ← Kembali ke Toko
              </Link>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen p-3 sm:p-6 md:p-10 font-sans relative bg-fixed bg-cover bg-center pb-24"
      style={{ backgroundImage: "url('/bg-anya.jpg')" }}
    >
      <div className="fixed inset-0 bg-pink-950/45 backdrop-blur-[2px] pointer-events-none"></div>

      <div className="relative z-10 max-w-5xl mx-auto space-y-6">
        {/* Top Bar Dashboard */}
        <div className="bg-white/95 backdrop-blur-md p-4 sm:p-6 rounded-3xl border-3 sm:border-4 border-pink-300 shadow-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-black bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full border border-pink-200 uppercase tracking-wide">
                Admin Panel Active
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-pink-700">{t.adminTitle}</h1>
            <p className="text-xs text-neutral-500">{t.encryptionNote}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Language switcher */}
            <div className="inline-flex bg-white/95 backdrop-blur-sm p-1 rounded-2xl border border-pink-300 shadow-sm mr-1">
              <button onClick={() => setLanguage('ID')} className={`px-2 py-1 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${language === 'ID' ? 'bg-pink-500 text-white' : 'text-neutral-600 hover:text-pink-600'}`}>ID</button>
              <button onClick={() => setLanguage('MY')} className={`px-2 py-1 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${language === 'MY' ? 'bg-pink-500 text-white' : 'text-neutral-600 hover:text-pink-600'}`}>MY</button>
              <button onClick={() => setLanguage('EN')} className={`px-2 py-1 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${language === 'EN' ? 'bg-pink-500 text-white' : 'text-neutral-600 hover:text-pink-600'}`}>EN</button>
            </div>
            <Link
              href="/"
              className="px-3.5 py-2 bg-pink-100 hover:bg-pink-200 text-pink-700 font-bold rounded-xl text-xs transition border border-pink-200"
            >
              Lihat Toko
            </Link>
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-300 transition active:scale-95 cursor-pointer"
            >
              Keluar (Logout)
            </button>
          </div>
        </div>

        {/* Card Form Tambah Stok */}
        <div className="bg-white/95 backdrop-blur-md p-5 sm:p-8 rounded-3xl border-3 sm:border-4 border-pink-300 shadow-2xl">
          {/* Tab Selector */}
          <div className="flex items-center gap-3 pb-4 mb-5 border-b-2 border-pink-100">
            <div className="inline-flex bg-pink-50 p-1 rounded-2xl border border-pink-200 gap-1">
              <button
                onClick={() => setActiveTab('single')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer ${
                  activeTab === 'single'
                    ? 'bg-pink-500 text-white shadow-sm shadow-pink-300'
                    : 'text-neutral-600 hover:text-pink-600'
                }`}
              >
                {t.tabSingle}
              </button>
              <button
                onClick={() => setActiveTab('batch')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer ${
                  activeTab === 'batch'
                    ? 'bg-pink-500 text-white shadow-sm shadow-pink-300'
                    : 'text-neutral-600 hover:text-pink-600'
                }`}
              >
                {t.tabBatch}
              </button>
              <button
                onClick={() => { setActiveTab('products'); setEditMessage(''); setEditingProduct(null); }}
                className={`px-4 py-2 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer ${
                  activeTab === 'products'
                    ? 'bg-pink-500 text-white shadow-sm shadow-pink-300'
                    : 'text-neutral-600 hover:text-pink-600'
                }`}
              >
                {t.tabProducts}
              </button>
            </div>
            <div>
              <p className="text-[10px] text-neutral-400 font-medium">{t.encryptionNote}</p>
            </div>
          </div>

          {/* === SINGLE INPUT FORM === */}
          {activeTab === 'single' && (
            <form onSubmit={handleAddStock} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">{t.adminProductName}</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Netflix Premium 1 Bulan"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full bg-pink-50/50 border-2 border-pink-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">{t.adminPrice}</label>
                <input
                  type="number"
                  required
                  placeholder="Contoh: 35000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-pink-50/50 border-2 border-pink-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">{t.adminCategory}</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-pink-50/50 border-2 border-pink-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">{t.adminProfileName}</label>
                <input
                  type="text"
                  placeholder="Contoh: Anya / Profil 1"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-pink-50/50 border-2 border-pink-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">{t.adminEmail}</label>
                <input
                  type="text"
                  required
                  placeholder="user.netflix@gmail.com"
                  value={emailAccount}
                  onChange={(e) => setEmailAccount(e.target.value)}
                  className="w-full bg-pink-50/50 border-2 border-pink-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">{t.adminPassword}</label>
                <input
                  type="text"
                  required
                  placeholder="PasswordRahasia123!"
                  value={passwordAccount}
                  onChange={(e) => setPasswordAccount(e.target.value)}
                  className="w-full bg-pink-50/50 border-2 border-pink-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">{t.adminPin}</label>
                <input
                  type="text"
                  placeholder="Contoh: 1234"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-pink-50/50 border-2 border-pink-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">{t.adminNotes}</label>
                <input
                  type="text"
                  placeholder="Contoh: Dilarang mengganti password"
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  className="w-full bg-pink-50/50 border-2 border-pink-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-medium"
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
                  disabled={formLoading}
                  className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white font-black rounded-2xl text-xs sm:text-sm shadow-md shadow-pink-300 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {formLoading ? t.btnSaving : t.btnSaveStock}
                </button>
              </div>
            </form>
          )}

          {/* === BATCH UPLOAD FORM === */}
          {activeTab === 'batch' && (
            <form onSubmit={handleBatchUpload} className="space-y-5">
              {/* Product Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <div className="inline-flex bg-pink-50 p-1 rounded-xl border border-pink-200 gap-1 mb-3">
                    <button
                      type="button"
                      onClick={() => setBatchProductMode('existing')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        batchProductMode === 'existing'
                          ? 'bg-pink-500 text-white'
                          : 'text-neutral-600 hover:text-pink-600'
                      }`}
                    >
                      {t.batchProductSelect}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchProductMode('new')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        batchProductMode === 'new'
                          ? 'bg-pink-500 text-white'
                          : 'text-neutral-600 hover:text-pink-600'
                      }`}
                    >
                      {t.batchProductNew}
                    </button>
                  </div>

                  {batchProductMode === 'existing' ? (
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      required
                      className="w-full bg-pink-50/50 border-2 border-pink-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-medium"
                    >
                      {productOptions.length === 0 && (
                        <option value="">{t.batchProductNew}</option>
                      )}
                      {productOptions.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.name} — {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p.price)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-1">
                        <input
                          type="text"
                          required
                          placeholder={t.adminProductName}
                          value={batchNewProductName}
                          onChange={(e) => setBatchNewProductName(e.target.value)}
                          className="w-full bg-pink-50/50 border-2 border-pink-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-medium"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          required
                          placeholder={t.adminPrice}
                          value={batchNewProductPrice}
                          onChange={(e) => setBatchNewProductPrice(e.target.value)}
                          className="w-full bg-pink-50/50 border-2 border-pink-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-medium"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder={t.adminCategory}
                          value={batchNewCategory}
                          onChange={(e) => setBatchNewCategory(e.target.value)}
                          className="w-full bg-pink-50/50 border-2 border-pink-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-medium"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Textarea */}
              <div>
                <div className="flex items-start justify-between mb-1.5">
                  <label className="block text-xs font-bold text-neutral-700">{t.batchInstruction}</label>
                </div>
                <div className="mb-2 flex flex-wrap gap-2 items-center">
                  <code className="text-[10px] bg-neutral-100 text-neutral-700 px-2 py-1 rounded-lg border border-neutral-200 font-mono">
                    {t.batchFormat}
                  </code>
                  <span className="text-[10px] text-neutral-400">{t.batchFormatNote}</span>
                </div>
                <textarea
                  required
                  rows={8}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder={t.batchPlaceholder}
                  className="w-full bg-pink-50/50 border-2 border-pink-200 rounded-2xl px-3.5 py-3 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-mono resize-y placeholder-neutral-400 leading-relaxed"
                />
                <p className="text-[10px] text-neutral-400 mt-1">
                  {batchText.split('\n').filter((l) => l.trim()).length} {t.totalData.toLowerCase()} baris
                </p>
              </div>

              {/* Feedback & Submit */}
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
                  disabled={batchLoading}
                  className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white font-black rounded-2xl text-xs sm:text-sm shadow-md shadow-pink-300 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {batchLoading ? t.btnProcessingBatch : t.btnProcessBatch}
                </button>
              </div>
            </form>
          )}

          {/* === PRODUCT MANAGEMENT TAB === */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              {/* Global feedback message */}
              {editMessage && (
                <div
                  className={`text-xs p-3 rounded-2xl border font-bold ${
                    editIsSuccess
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {editMessage}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b-2 border-pink-100 text-pink-800 uppercase text-[10px] tracking-wider bg-pink-50/60">
                      <th className="py-3 px-3 rounded-l-xl">{t.colProductName}</th>
                      <th className="py-3 px-3">{t.colProductPrice}</th>
                      <th className="py-3 px-3">{t.colProductCategory}</th>
                      <th className="py-3 px-3 text-center">{t.colProductStock}</th>
                      <th className="py-3 px-3 rounded-r-xl text-center">{t.colActions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pink-100">
                    {productOptions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-neutral-400 font-medium">
                          {t.loadingProducts}
                        </td>
                      </tr>
                    ) : (
                      productOptions.map((product) => {
                        const isEditing = editingProduct?.id === product.id;
                        return (
                          <tr key={product.id} className={`transition ${isEditing ? 'bg-pink-50/60' : 'hover:bg-pink-50/30'}`}>
                            <td className="py-3 px-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingProduct.name}
                                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                                  className="w-full bg-white border-2 border-pink-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-medium"
                                />
                              ) : (
                                <span className="font-bold text-neutral-800">{product.name}</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editingProduct.price}
                                  onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                                  className="w-full bg-white border-2 border-pink-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-medium"
                                />
                              ) : (
                                <span className="font-black text-pink-600">{formatRupiah(product.price)}</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingProduct.category}
                                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                                  className="w-full bg-white border-2 border-pink-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 focus:outline-none focus:border-pink-500 font-medium"
                                />
                              ) : (
                                <span className="text-neutral-500">{product.category || '-'}</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-300">
                                {product.stockAvailable}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={handleSaveProduct}
                                    disabled={editLoading}
                                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-[10px] transition active:scale-95 disabled:opacity-50 cursor-pointer"
                                  >
                                    {editLoading ? t.btnSavingEdit : t.btnSave}
                                  </button>
                                  <button
                                    onClick={() => { setEditingProduct(null); setEditMessage(''); }}
                                    disabled={editLoading}
                                    className="px-3 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-bold rounded-lg text-[10px] transition active:scale-95 disabled:opacity-50 cursor-pointer"
                                  >
                                    {t.btnCancel}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingProduct({
                                      id: product.id,
                                      name: product.name,
                                      price: String(product.price),
                                      category: product.category || '',
                                    });
                                    setEditMessage('');
                                  }}
                                  className="px-3 py-1.5 bg-pink-100 hover:bg-pink-200 text-pink-700 font-bold rounded-lg text-[10px] border border-pink-200 transition active:scale-95 cursor-pointer"
                                >
                                  {t.btnEdit}
                                </button>
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

        {/* Card Tabel Stok */}
        <div className="bg-white/95 backdrop-blur-md p-5 sm:p-8 rounded-3xl border-3 sm:border-4 border-pink-300 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-pink-100">
            <div>
              <h2 className="text-base sm:text-lg font-black text-neutral-800">{t.adminTitle}</h2>
              <p className="text-[11px] text-neutral-400">{t.totalData} {stocks.length}</p>
            </div>
            <button
              onClick={refreshStocks}
              className="text-xs font-bold text-pink-600 hover:text-pink-700 bg-pink-50 px-3 py-1 rounded-xl border border-pink-200 transition"
            >
              {t.btnRefreshTable}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-pink-100 text-pink-800 uppercase text-[10px] tracking-wider bg-pink-50/60">
                  <th className="py-3 px-3 rounded-l-xl">{t.tblProduct}</th>
                  <th className="py-3 px-3">{t.tblEmail}</th>
                  <th className="py-3 px-3">{t.tblProfile}</th>
                  <th className="py-3 px-3 rounded-r-xl text-center">{t.tblStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-100">
                {stocks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-neutral-400 font-medium">
                      {t.tblEmpty}
                    </td>
                  </tr>
                ) : (
                  stocks.map((item) => (
                    <tr key={item.id} className="hover:bg-pink-50/40 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-neutral-800">{item.product.name}</div>
                        <div className="text-[11px] font-black text-pink-600">
                          {formatRupiah(item.product.price)}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-neutral-700 font-medium">
                        {item.emailAccount}
                      </td>
                      <td className="py-3 px-3 text-neutral-600">
                        {item.profileName || '-'} {item.pin ? `(PIN: ${item.pin})` : ''}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase ${
                            item.status === 'READY'
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                              : item.status === 'LOCKED'
                              ? 'bg-amber-100 text-amber-700 border border-amber-300 animate-pulse'
                              : 'bg-neutral-100 text-neutral-500 border border-neutral-300'
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
      </div>
    </main>
  );
}
