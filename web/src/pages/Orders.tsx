import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { cacheGet, cacheSet } from '../cache';
import type { Address, OrderListItem, OrderStatus, Wine } from '../types';
import { STATUS_COLORS, STATUS_LABELS, formatDate, formatMoney } from '../format';

const WINES_TTL = 5 * 60 * 1000;
const ADDRS_TTL = 2 * 60 * 1000;

function prefetchOrderFormData() {
  if (!cacheGet<Wine[]>('wines')) {
    api<Wine[]>('/wines').then((w) => cacheSet('wines', w, WINES_TTL)).catch(() => {});
  }
  if (!cacheGet<Address[]>('addresses')) {
    api<Address[]>('/addresses').then((a) => cacheSet('addresses', a, ADDRS_TTL)).catch(() => {});
  }
}

const STATUSES: OrderStatus[] = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') as OrderStatus | null;
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    prefetchOrderFormData();
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const qs = statusParam ? `?status=${encodeURIComponent(statusParam)}` : '';
    api<OrderListItem[]>(`/orders${qs}`)
      .then((rows) => {
        if (active) {
          setItems(rows);
          setError(null);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof ApiError ? 'Не вдалося завантажити замовлення.' : 'Немає зв’язку з сервером.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [statusParam]);

  function setStatus(s: OrderStatus | null) {
    const next = new URLSearchParams(searchParams);
    if (s) next.set('status', s);
    else next.delete('status');
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-burgundy-700">Замовлення</h1>
        <Link to="/orders/new" className="h-10 px-3 rounded-lg bg-burgundy-700 text-white text-sm font-medium flex items-center">
          + Нове
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setStatus(null)}
          className={`h-10 px-3 rounded-full text-sm whitespace-nowrap border ${
            !statusParam ? 'bg-burgundy-700 text-white border-burgundy-700' : 'border-neutral-300 text-neutral-700'
          }`}
        >
          Усі
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`h-10 px-3 rounded-full text-sm whitespace-nowrap border ${
              statusParam === s ? 'bg-burgundy-700 text-white border-burgundy-700' : 'border-neutral-300 text-neutral-700'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card">Завантаження…</div>
      ) : error ? (
        <div className="card text-burgundy-700">{error}</div>
      ) : items.length === 0 ? (
        <div className="card text-neutral-500">Замовлень поки немає.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((o) => (
            <li key={o.id}>
              <Link
                to={`/orders/${o.id}`}
                className="card flex items-center justify-between gap-3 hover:border-burgundy-500"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-burgundy-700">№{o.order_number}</span>
                    <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-600 mt-1 truncate">{o.address_label}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">{formatDate(o.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatMoney(o.total_amount)} ₴</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
