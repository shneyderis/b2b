import type { OrderStatus } from './types';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Нове',
  confirmed: 'Підтверджено',
  shipped: 'Відправлено',
  delivered: 'Доставлено',
  cancelled: 'Скасовано',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-burgundy-100 text-burgundy-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-amber-100 text-amber-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-neutral-200 text-neutral-600',
};

export function formatMoney(v: string | number | null | undefined): string {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  if (!Number.isFinite(n)) return '0,00';
  return n
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}
