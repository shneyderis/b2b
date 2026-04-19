import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api';
import type { AdminWine } from '../../types';
import { formatMoney } from '../../format';

export function AdminWines() {
  const [wines, setWines] = useState<AdminWine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(false);

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

  async function patch(id: string, body: Partial<AdminWine>) {
    try {
      const row = await api<AdminWine>(`/admin/wines/${id}`, { method: 'PUT', body });
      setWines((prev) => prev.map((w) => (w.id === id ? row : w)));
    } catch {
      alert('Не вдалося зберегти.');
      await load();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-burgundy-700">Вина</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing((v) => !v)}
            className={`h-10 px-3 rounded-lg text-sm font-medium border ${
              editing
                ? 'bg-burgundy-700 text-white border-burgundy-700'
                : 'border-burgundy-700 text-burgundy-700'
            }`}
          >
            {editing ? 'Готово' : 'Редагувати'}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="h-10 px-3 rounded-lg bg-burgundy-700 text-white text-sm font-medium"
          >
            + Додати вино
          </button>
        </div>
      </div>

      {editing && (
        <div className="card text-xs text-neutral-600 bg-amber-50 border-amber-200">
          Режим редагування. Ціна та залишок зберігаються по виходу з поля або Enter;
          перемикач «Активне» — одразу.
        </div>
      )}

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
                <WineRow key={w.id} wine={w} editing={editing} onPatch={patch} />
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

function WineRow({
  wine,
  editing,
  onPatch,
}: {
  wine: AdminWine;
  editing: boolean;
  onPatch: (id: string, body: Partial<AdminWine>) => Promise<void>;
}) {
  const [price, setPrice] = useState<string>(String(wine.price));
  const [stock, setStock] = useState<string>(String(wine.stock_quantity));

  useEffect(() => {
    setPrice(String(wine.price));
    setStock(String(wine.stock_quantity));
  }, [wine.price, wine.stock_quantity]);

  function commitPrice() {
    const n = Number(price.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) {
      setPrice(String(wine.price));
      return;
    }
    if (n === Number(wine.price)) return;
    void onPatch(wine.id, { price: n });
  }

  function commitStock() {
    const n = Math.floor(Number(stock));
    if (!Number.isFinite(n) || n < 0) {
      setStock(String(wine.stock_quantity));
      return;
    }
    if (n === wine.stock_quantity) return;
    void onPatch(wine.id, { stock_quantity: n });
  }

  return (
    <tr className={`border-t border-neutral-200 ${!wine.is_active ? 'opacity-60' : ''}`}>
      <td className="px-3 py-2">{wine.name}</td>
      <td className="px-3 py-2 text-right">
        {editing ? (
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={commitPrice}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
            }}
            className="h-10 w-full px-2 text-right rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-burgundy-500"
          />
        ) : (
          formatMoney(wine.price)
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {editing ? (
          <input
            type="number"
            min={0}
            step={1}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            onBlur={commitStock}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
            }}
            className="h-10 w-full px-2 text-right rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-burgundy-500"
          />
        ) : (
          wine.stock_quantity
        )}
      </td>
      <td className="px-3 py-2 text-center">
        {editing ? (
          <button
            type="button"
            role="switch"
            aria-checked={wine.is_active}
            onClick={() => onPatch(wine.id, { is_active: !wine.is_active })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              wine.is_active ? 'bg-burgundy-700' : 'bg-neutral-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white transition ${
                wine.is_active ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        ) : !wine.is_active ? (
          <span className="text-xs rounded-full px-2 py-0.5 bg-neutral-100 text-neutral-600 border border-neutral-200">приховано</span>
        ) : wine.stock_quantity <= 0 ? (
          <span className="text-xs rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">немає</span>
        ) : (
          <span className="text-xs rounded-full px-2 py-0.5 bg-green-50 text-green-700 border border-green-200">в продажу</span>
        )}
      </td>
    </tr>
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
