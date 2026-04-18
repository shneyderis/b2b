import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, apiBlob } from '../api';
import type { OrderDetail as OrderDetailData } from '../types';
import { STATUS_COLORS, STATUS_LABELS, formatDate, formatMoney } from '../format';

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    api<OrderDetailData>(`/orders/${id}`)
      .then((o) => {
        if (active) {
          setData(o);
          setError(null);
        }
      })
      .catch((e) => {
        if (active) {
          if (e instanceof ApiError && e.status === 404) setError('Замовлення не знайдено.');
          else setError('Не вдалося завантажити замовлення.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function downloadPdf() {
    if (!id) return;
    setPdfBusy(true);
    try {
      const blob = await apiBlob(`/orders/${id}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order-${data?.order_number ?? id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      alert('Не вдалося завантажити PDF.');
    } finally {
      setPdfBusy(false);
    }
  }

  async function remove() {
    if (!id || !confirm('Видалити це замовлення?')) return;
    setRemoving(true);
    try {
      await api(`/orders/${id}`, { method: 'DELETE' });
      navigate('/orders', { replace: true });
    } catch (e) {
      setRemoving(false);
      if (e instanceof ApiError && e.status === 409) alert('Це замовлення вже не можна видалити.');
      else alert('Не вдалося видалити замовлення.');
    }
  }

  if (loading) return <div className="card">Завантаження…</div>;
  if (error) return <div className="card text-burgundy-700">{error}</div>;
  if (!data) return null;

  const editable = data.status === 'new';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/orders" className="text-burgundy-700 text-sm">← До списку</Link>
      </div>

      <section className="card">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xl font-bold text-burgundy-700">Замовлення №{data.order_number}</div>
            <div className="text-sm text-neutral-500 mt-1">{formatDate(data.created_at)}</div>
          </div>
          <span className={`text-xs rounded-full px-2 py-1 ${STATUS_COLORS[data.status]}`}>
            {STATUS_LABELS[data.status]}
          </span>
        </div>

        <div className="mt-3">
          <div className="text-sm text-neutral-600">Адреса доставки</div>
          <div className="font-medium">{data.address_label}</div>
          <div className="text-sm text-neutral-700 whitespace-pre-wrap">{data.address_text}</div>
        </div>

        {data.comment && (
          <div className="mt-3">
            <div className="text-sm text-neutral-600">Коментар</div>
            <div className="text-sm whitespace-pre-wrap">{data.comment}</div>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="font-semibold text-burgundy-700 mb-2">Позиції</h2>
        <ul className="divide-y divide-neutral-200">
          {data.items.map((it) => (
            <li key={it.id} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate">{it.name}</div>
                <div className="text-xs text-neutral-500">
                  {it.quantity} × {formatMoney(it.price)} ₴
                </div>
              </div>
              <div className="font-medium">{formatMoney(Number(it.price) * it.quantity)} ₴</div>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-neutral-200">
          <span className="text-sm text-neutral-600">Разом</span>
          <span className="text-lg font-bold text-burgundy-700">{formatMoney(data.total_amount)} ₴</span>
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <button onClick={downloadPdf} className="btn-secondary" disabled={pdfBusy}>
          {pdfBusy ? 'Готуємо PDF…' : 'Завантажити PDF'}
        </button>
        {editable && (
          <>
            <Link to={`/orders/${data.id}/edit`} className="btn-primary flex items-center justify-center">
              Редагувати
            </Link>
            <button onClick={remove} className="h-12 px-4 rounded-lg border border-neutral-300 text-neutral-700" disabled={removing}>
              {removing ? 'Видалення…' : 'Видалити'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
