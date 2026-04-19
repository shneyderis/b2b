import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../api';
import type { AdminOrderListItem, AdminPartner, OrderStatus } from '../../types';
import { STATUS_COLORS, STATUS_LABELS, formatDate, formatMoney } from '../../format';

const STATUSES: OrderStatus[] = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const partnerId = searchParams.get('partner_id') ?? '';
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo = searchParams.get('date_to') ?? '';

  const [items, setItems] = useState<AdminOrderListItem[]>([]);
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (partnerId) q.set('partner_id', partnerId);
    if (dateFrom) q.set('date_from', dateFrom);
    if (dateTo) q.set('date_to', dateTo);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [status, partnerId, dateFrom, dateTo]);

  useEffect(() => {
    let active = true;
    api<AdminPartner[]>('/admin/partners')
      .then((rows) => active && setPartners(rows))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<AdminOrderListItem[]>(`/admin/orders${qs}`)
      .then((rows) => {
        if (active) {
          setItems(rows);
          setError(null);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof ApiError ? 'Не вдалося завантажити.' : 'Немає зв’язку з сервером.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [qs]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  function reset() {
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-burgundy-700">Замовлення</h1>
        <Link
          to="/admin/orders/new"
          className="h-10 px-3 flex items-center rounded-lg bg-burgundy-700 text-white text-sm font-medium"
        >
          Нове замовлення
        </Link>
      </div>

      <section className="card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Статус</span>
          <select className="input" value={status} onChange={(e) => update('status', e.target.value)}>
            <option value="">Усі</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Партнер</span>
          <select className="input" value={partnerId} onChange={(e) => update('partner_id', e.target.value)}>
            <option value="">Усі</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Дата від</span>
          <input type="date" className="input" value={dateFrom} onChange={(e) => update('date_from', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Дата до</span>
          <input type="date" className="input" value={dateTo} onChange={(e) => update('date_to', e.target.value)} />
        </label>
        <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
          <button onClick={reset} className="h-10 px-3 rounded-lg text-sm text-burgundy-700 hover:bg-burgundy-100">
            Скинути фільтри
          </button>
        </div>
      </section>

      {loading ? (
        <div className="card">Завантаження…</div>
      ) : error ? (
        <div className="card text-burgundy-700">{error}</div>
      ) : items.length === 0 ? (
        <div className="card text-neutral-500">Замовлень не знайдено.</div>
      ) : (
        <section className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="text-left px-3 py-2">№</th>
                <th className="text-left px-3 py-2">Дата</th>
                <th className="text-left px-3 py-2">Партнер</th>
                <th className="text-left px-3 py-2">Адреса</th>
                <th className="text-left px-3 py-2">Статус</th>
                <th className="text-left px-3 py-2">Хто замовив</th>
                <th className="text-right px-3 py-2">Сума</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-t border-neutral-200 hover:bg-burgundy-50 cursor-pointer">
                  <td className="px-3 py-2 font-semibold text-burgundy-700">
                    <Link to={`/admin/orders/${o.id}`} className="block">№{o.order_number}</Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/admin/orders/${o.id}`} className="block">{formatDate(o.created_at)}</Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/admin/orders/${o.id}`} className="block">{o.partner_name}</Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/admin/orders/${o.id}`} className="block truncate max-w-[200px]">{o.address_label}</Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/admin/orders/${o.id}`} className="block">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_COLORS[o.status]}`}>
                        {STATUS_LABELS[o.status]}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/admin/orders/${o.id}`} className="block">{o.user_contact ?? '—'}</Link>
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    <Link to={`/admin/orders/${o.id}`} className="block">{formatMoney(o.total_amount)} ₴</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
