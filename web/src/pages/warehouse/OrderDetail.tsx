import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api';
import type { WarehouseOrderDetail as Detail } from '../../types';
import { formatDate, formatMoney } from '../../format';

export function WarehouseOrderDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api<Detail>(`/warehouse/orders/${id}`)
      .then((o) => { if (active) { setOrder(o); setError(null); } })
      .catch((e) => {
        if (active) setError(e instanceof ApiError ? 'Не вдалося завантажити замовлення.' : 'Немає зв’язку з сервером.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  async function ship() {
    if (!confirm('Позначити замовлення як відвантажене?')) return;
    setBusy(true);
    try {
      await api(`/warehouse/orders/${id}/ship`, { method: 'PUT' });
      navigate('/warehouse/orders', { replace: true });
    } catch {
      alert('Не вдалося оновити статус.');
      setBusy(false);
    }
  }

  if (loading) return <div className="card">Завантаження…</div>;
  if (error) return <div className="card text-burgundy-700">{error}</div>;
  if (!order) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-burgundy-700">Замовлення №{order.order_number}</h1>
        <Link to="/warehouse/orders" className="text-burgundy-700 text-sm">Назад</Link>
      </div>

      <section className="card flex flex-col gap-1">
        <div className="text-sm text-neutral-500">Партнер</div>
        <div className="font-medium">{order.partner_name}</div>
        {order.user_contact && <div className="text-sm text-neutral-700">{order.user_contact}</div>}
        {order.user_phone && <div className="text-sm text-neutral-700">{order.user_phone}</div>}
      </section>

      <section className="card flex flex-col gap-1">
        <div className="text-sm text-neutral-500">Адреса доставки</div>
        <div className="font-medium">{order.address_label}</div>
        <div className="text-sm text-neutral-700 whitespace-pre-wrap">{order.address_text}</div>
      </section>

      <section className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="text-left px-3 py-2">Найменування</th>
              <th className="text-right px-3 py-2 w-20">К-сть</th>
              <th className="text-right px-3 py-2 w-28">Ціна, ₴</th>
              <th className="text-right px-3 py-2 w-28">Сума, ₴</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id} className="border-t border-neutral-200">
                <td className="px-3 py-2">{it.name}</td>
                <td className="px-3 py-2 text-right">{it.quantity}</td>
                <td className="px-3 py-2 text-right">{formatMoney(it.price)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(Number(it.price) * it.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-200">
              <td colSpan={3} className="px-3 py-2 text-right font-semibold">Разом</td>
              <td className="px-3 py-2 text-right font-semibold">{formatMoney(order.total_amount)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {order.comment && (
        <section className="card">
          <div className="text-sm text-neutral-500 mb-1">Коментар</div>
          <div className="whitespace-pre-wrap">{order.comment}</div>
        </section>
      )}

      <div className="text-xs text-neutral-500">
        Створено: {formatDate(order.created_at)}
        {order.updated_at && order.updated_at !== order.created_at && (
          <> · Оновлено: {formatDate(order.updated_at)}</>
        )}
      </div>

      <button
        type="button"
        onClick={ship}
        disabled={busy}
        className="btn-primary"
      >
        {busy ? 'Зберігаємо…' : 'Відвантажено'}
      </button>
    </div>
  );
}
