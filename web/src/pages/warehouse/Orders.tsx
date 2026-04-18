import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../api';
import type { WarehouseOrderListItem } from '../../types';
import { formatDate, formatMoney } from '../../format';

export function WarehouseOrders() {
  const [items, setItems] = useState<WarehouseOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<WarehouseOrderListItem[]>('/warehouse/orders')
      .then((rows) => { if (active) { setItems(rows); setError(null); } })
      .catch((e) => {
        if (active) setError(e instanceof ApiError ? 'Не вдалося завантажити замовлення.' : 'Немає зв’язку з сервером.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-burgundy-700">Замовлення до відвантаження</h1>
      {loading ? (
        <div className="card">Завантаження…</div>
      ) : error ? (
        <div className="card text-burgundy-700">{error}</div>
      ) : items.length === 0 ? (
        <div className="card text-neutral-500">Підтверджених замовлень немає.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((o) => (
            <li key={o.id}>
              <Link
                to={`/warehouse/orders/${o.id}`}
                className="card flex items-center justify-between gap-3 hover:border-burgundy-500"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-burgundy-700">№{o.order_number}</span>
                    <span className="text-xs rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
                      Підтверджено
                    </span>
                  </div>
                  <div className="text-sm text-neutral-800 mt-1 truncate">{o.partner_name}</div>
                  <div className="text-sm text-neutral-600 truncate">{o.address_label} · {o.address_text}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    Створено: {formatDate(o.created_at)}
                    {o.updated_at && o.updated_at !== o.created_at && (
                      <> · Оновлено: {formatDate(o.updated_at)}</>
                    )}
                  </div>
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
