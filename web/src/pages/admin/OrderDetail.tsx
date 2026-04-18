import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, apiBlob } from '../../api';
import type { AdminOrderDetail as OrderData, AdminWine, OrderStatus } from '../../types';
import { STATUS_COLORS, STATUS_LABELS, formatDate, formatMoney } from '../../format';

const ALL_STATUSES: OrderStatus[] = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];

type Qty = Record<string, number>;

export function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<OrderData | null>(null);
  const [wines, setWines] = useState<AdminWine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState<Qty>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    return api<OrderData>(`/admin/orders/${id}`)
      .then((o) => {
        setData(o);
        setError(null);
        const next: Qty = {};
        for (const it of o.items) next[it.wine_id] = it.quantity;
        setQty(next);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setError('Замовлення не знайдено.');
        else setError('Не вдалося завантажити замовлення.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    void load();
    api<AdminWine[]>('/admin/wines').then(setWines).catch(() => {});
  }, [load]);

  const discount = Number(data?.discount_percent ?? 0);

  const editableTotal = useMemo(() => {
    let sum = 0;
    for (const w of wines) {
      const q = qty[w.id];
      if (!q || q <= 0) continue;
      const price = Math.round(Number(w.price) * (100 - discount)) / 100;
      sum += price * q;
    }
    return Math.round(sum * 100) / 100;
  }, [wines, qty, discount]);

  async function changeStatus(next: OrderStatus) {
    if (!id || !data || next === data.status) return;
    setStatusBusy(true);
    try {
      await api(`/admin/orders/${id}/status`, { method: 'PUT', body: { status: next } });
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) alert('Статус вже термінальний.');
      else alert('Не вдалося змінити статус.');
    } finally {
      setStatusBusy(false);
    }
  }

  async function downloadPdf() {
    if (!id) return;
    setPdfBusy(true);
    try {
      const blob = await apiBlob(`/admin/orders/${id}/pdf`);
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
    if (!id || !data) return;
    if (!confirm(`Видалити замовлення №${data.order_number}?`)) return;
    setRemoving(true);
    try {
      await api(`/admin/orders/${id}`, { method: 'DELETE' });
      navigate('/admin/orders', { replace: true });
    } catch (e) {
      setRemoving(false);
      if (e instanceof ApiError && e.status === 409) alert('Доставлене замовлення видалити не можна.');
      else alert('Не вдалося видалити.');
    }
  }

  function updateQty(wineId: string, value: number) {
    setQty((prev) => {
      const next = { ...prev };
      if (!Number.isFinite(value) || value <= 0) delete next[wineId];
      else next[wineId] = Math.floor(value);
      return next;
    });
  }

  async function saveItems() {
    if (!id) return;
    const items = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([wine_id, quantity]) => ({ wine_id, quantity }));
    if (items.length === 0) {
      setSaveError('Додайте хоча б одну позицію.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await api(`/admin/orders/${id}`, { method: 'PUT', body: { items } });
      setEditing(false);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setSaveError('Це замовлення вже не можна редагувати.');
      else setSaveError('Не вдалося зберегти.');
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    if (!data) return;
    const next: Qty = {};
    for (const it of data.items) next[it.wine_id] = it.quantity;
    setQty(next);
    setSaveError(null);
    setEditing(false);
  }

  if (loading) return <div className="card">Завантаження…</div>;
  if (error) return <div className="card text-burgundy-700">{error}</div>;
  if (!data) return null;

  const terminal = data.status === 'delivered' || data.status === 'cancelled';
  const canEdit = !terminal;
  const canDelete = data.status !== 'delivered';
  const availableStatuses = ALL_STATUSES.filter((s) => s !== 'delivered' && s !== 'cancelled' || s === data.status);

  return (
    <div className="flex flex-col gap-4 print:gap-2">
      <div className="flex items-center justify-between gap-2 no-print">
        <Link to="/admin/orders" className="text-burgundy-700 text-sm">← До списку</Link>
      </div>

      <section className="card">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div className="text-xl font-bold text-burgundy-700">Замовлення №{data.order_number}</div>
            <div className="text-sm text-neutral-500 mt-1">{formatDate(data.created_at)}</div>
          </div>
          <span className={`text-xs rounded-full px-2 py-1 ${STATUS_COLORS[data.status]}`}>
            {STATUS_LABELS[data.status]}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-neutral-600">Партнер</div>
            <div className="font-medium">{data.partner_name}</div>
            <div className="text-xs text-neutral-500">Знижка: {Number(data.discount_percent)}%</div>
          </div>
          <div>
            <div className="text-neutral-600">Хто замовив</div>
            <div className="font-medium">{data.user_contact ?? '—'}</div>
            <div className="text-xs text-neutral-500">{data.user_phone ?? '—'} · {data.user_email}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-neutral-600">Адреса доставки</div>
            <div className="font-medium">{data.address_label}</div>
            <div className="text-neutral-700 whitespace-pre-wrap">{data.address_text}</div>
          </div>
          {data.comment && (
            <div className="sm:col-span-2">
              <div className="text-neutral-600">Коментар</div>
              <div className="whitespace-pre-wrap">{data.comment}</div>
            </div>
          )}
        </div>
      </section>

      {canEdit && (
        <section className="card no-print">
          <label className="flex flex-col gap-1 max-w-xs">
            <span className="text-sm text-neutral-600">Змінити статус</span>
            <select
              className="input"
              value={data.status}
              onChange={(e) => changeStatus(e.target.value as OrderStatus)}
              disabled={statusBusy}
            >
              {availableStatuses.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>
        </section>
      )}

      <section className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-burgundy-700">Позиції</h2>
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)} className="h-10 px-3 rounded-lg text-sm text-burgundy-700 hover:bg-burgundy-100 no-print">
              Редагувати
            </button>
          )}
        </div>

        {!editing ? (
          <>
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
          </>
        ) : (
          <>
            <div className="text-xs text-neutral-500 mb-2">Ціни з урахуванням знижки {discount}%</div>
            <ul className="divide-y divide-neutral-200">
              {wines.map((w) => {
                const value = qty[w.id] ?? 0;
                const inactive = !w.is_active;
                const price = Math.round(Number(w.price) * (100 - discount)) / 100;
                return (
                  <li
                    key={w.id}
                    className={`py-3 flex items-center justify-between gap-3 ${inactive ? 'opacity-50' : ''}`}
                  >
                    <div className="min-w-0">
                      <div className="truncate">{w.name}</div>
                      <div className="text-xs text-neutral-500">
                        {formatMoney(price)} ₴ · залишок {w.stock_quantity}
                        {inactive && ' · неактивне'}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={value === 0 ? '' : value}
                      onChange={(e) => updateQty(w.id, e.target.value === '' ? 0 : Number(e.target.value))}
                      placeholder="0"
                      className="h-12 w-20 px-2 text-center rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-burgundy-500"
                    />
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between pt-3 mt-2 border-t border-neutral-200">
              <span className="text-sm text-neutral-600">Попередній підсумок</span>
              <span className="text-lg font-bold text-burgundy-700">{formatMoney(editableTotal)} ₴</span>
            </div>
            {saveError && <div className="mt-2 text-sm text-burgundy-700">{saveError}</div>}
            <div className="mt-3 flex gap-2">
              <button onClick={saveItems} className="btn-primary flex-1" disabled={saving}>
                {saving ? 'Збереження…' : 'Зберегти'}
              </button>
              <button onClick={cancelEdit} className="btn-secondary" disabled={saving}>
                Скасувати
              </button>
            </div>
          </>
        )}
      </section>

      <div className="flex flex-col sm:flex-row gap-2 no-print">
        <button onClick={downloadPdf} className="btn-secondary flex-1" disabled={pdfBusy}>
          {pdfBusy ? 'Готуємо PDF…' : 'Завантажити PDF'}
        </button>
        <button onClick={() => window.print()} className="btn-secondary flex-1">
          Друкувати
        </button>
        {canDelete && (
          <button
            onClick={remove}
            className="h-12 px-4 rounded-lg border border-burgundy-700 text-burgundy-700"
            disabled={removing}
          >
            {removing ? 'Видалення…' : 'Видалити замовлення'}
          </button>
        )}
      </div>
    </div>
  );
}
