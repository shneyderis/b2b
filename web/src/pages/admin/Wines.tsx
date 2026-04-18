import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api';
import type { AdminWine } from '../../types';
import { formatMoney } from '../../format';

export function AdminWines() {
  const [wines, setWines] = useState<AdminWine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const rows = await api<AdminWine[]>('/admin/wines');
      setWines(rows);
      setError(null);
    } catch {
      setError('Не вдалося завантажити вина.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-burgundy-700">Вина</h1>
        <button onClick={() => setShowCreate(true)} className="h-10 px-3 rounded-lg bg-burgundy-700 text-white text-sm font-medium">
          + Додати вино
        </button>
      </div>

      {loading ? (
        <div className="card">Завантаження…</div>
      ) : error ? (
        <div className="card text-burgundy-700">{error}</div>
      ) : (
        <section className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="text-left px-3 py-2">Назва</th>
                <th className="text-right px-3 py-2 w-36">Ціна, ₴</th>
                <th className="text-right px-3 py-2 w-28">Залишок</th>
                <th className="text-center px-3 py-2 w-24">Активне</th>
              </tr>
            </thead>
            <tbody>
              {wines.map((w) => (
                <tr key={w.id} className={`border-t border-neutral-200 ${!w.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2">{w.name}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(w.price)}</td>
                  <td className="px-3 py-2 text-right">{w.stock_quantity}</td>
                  <td className="px-3 py-2 text-center">
                    {w.is_active ? (
                      <span className="text-xs rounded-full px-2 py-0.5 bg-green-50 text-green-700 border border-green-200">так</span>
                    ) : (
                      <span className="text-xs rounded-full px-2 py-0.5 bg-neutral-100 text-neutral-600 border border-neutral-200">ні</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {showCreate && (
        <CreateWineModal
          onClose={() => setShowCreate(false)}
          onCreated={(w) => {
            setWines((prev) => [...prev, w].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function CreateWineModal({ onClose, onCreated }: { onClose: () => void; onCreated: (w: AdminWine) => void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [sort, setSort] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const priceNum = Number(price.replace(',', '.'));
    const stockNum = Math.floor(Number(stock));
    const sortNum = Math.floor(Number(sort)) || 0;
    if (!name.trim() || !Number.isFinite(priceNum) || priceNum < 0 || !Number.isFinite(stockNum) || stockNum < 0) {
      setError('Перевірте поля.');
      return;
    }
    setBusy(true);
    try {
      const row = await api<AdminWine>('/admin/wines', {
        method: 'POST',
        body: { name: name.trim(), price: priceNum, stock_quantity: stockNum, sort_order: sortNum, is_active: true },
      });
      onCreated(row);
    } catch (e) {
      setError(e instanceof ApiError ? 'Не вдалося створити.' : 'Немає зв’язку з сервером.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-20 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="bg-white rounded-xl shadow-lg w-full max-w-md p-4 flex flex-col gap-3"
      >
        <h2 className="font-bold text-burgundy-700">Нове вино</h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Назва</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-600">Ціна, ₴</span>
            <input className="input text-right" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-600">Залишок</span>
            <input className="input text-right" type="number" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} required />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Порядок сортування</span>
          <input className="input text-right" type="number" step={1} value={sort} onChange={(e) => setSort(e.target.value)} />
        </label>
        {error && <div className="text-sm text-burgundy-700">{error}</div>}
        <div className="flex gap-2 mt-1">
          <button type="submit" className="btn-primary flex-1" disabled={busy}>
            {busy ? 'Збереження…' : 'Створити'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={busy}>
            Скасувати
          </button>
        </div>
      </form>
    </div>
  );
}
