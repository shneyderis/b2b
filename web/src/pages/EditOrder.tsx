import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { OrderForm, detailToInitial } from '../components/OrderForm';
import type { OrderDetail } from '../types';

export function EditOrder() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    api<OrderDetail>(`/orders/${id}`)
      .then((o) => {
        if (active) setData(o);
      })
      .catch((e) => {
        if (active) setError(e instanceof ApiError && e.status === 404 ? 'Замовлення не знайдено.' : 'Не вдалося завантажити замовлення.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <div className="card">Завантаження…</div>;
  if (error) return <div className="card text-burgundy-700">{error}</div>;
  if (!data) return null;
  if (data.status !== 'new') return <Navigate to={`/orders/${data.id}`} replace />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-burgundy-700">Редагування №{data.order_number}</h1>
        <Link to={`/orders/${data.id}`} className="text-burgundy-700 text-sm">Скасувати</Link>
      </div>
      <OrderForm orderId={data.id} initial={detailToInitial(data)} submitLabel="Зберегти" />
    </div>
  );
}
