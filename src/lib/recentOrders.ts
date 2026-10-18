export interface RecentOrderItem {
  invoice: string;
  productName: string;
  type: string;
  status: string;
  createdAt: string;
}

const STORAGE_KEY = 'cloudy_recent_orders';
const MAX_ITEMS = 5;

export function getRecentOrders(): RecentOrderItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RecentOrderItem =>
        Boolean(item && typeof item.invoice === 'string' && typeof item.productName === 'string'),
    ).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function saveRecentOrder(order: RecentOrderItem): void {
  if (typeof window === 'undefined' || !order.invoice) return;
  try {
    const current = getRecentOrders();
    const filtered = current.filter(item => item.invoice !== order.invoice);
    filtered.unshift(order);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_ITEMS)));
  } catch {
    // Graceful fallback if localStorage is disabled or quota is reached
  }
}
