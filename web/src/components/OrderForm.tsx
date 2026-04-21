import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { cacheGet, cacheSet } from '../cache';
import type { Address, OrderDetail, Wine } from '../types';
import { formatMoney } from '../format';

export interface OrderFormInitial {
  delivery_address_id: string;
  comment: string | null;
  items: { wine_id: string; quantity: number }[];
}

interface Props {
  orderId?: string;
  initial?: OrderFormInitial;
  submitLabel: string;
}

type Qty = Record<string, number>;

const WINES_TTL = 5 * 60 * 1000;
const ADDRS_TTL = 2 * 60 * 1000;

export function OrderForm({ orderId, initial, submitLabel }: Props) {
  const navigate = useNavigate();
  const cachedAddrs = cacheGet<Address[]>('addresses');
  const cachedWines = cacheGet<Wine[]>('wines');
  const [addresses, setAddresses] = useState<Address[]>(cachedAddrs ?? []);
  const [wines, setWines] = useState<Wine[]>(cachedWines ?? []);
  const [loading, setLoading] = useState(!cachedAddrs && !cachedWines);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [addressId, setAddressId] = useState<string>(() => {
    if (initial?.delivery_address_id) return initial.delivery_address_id;
    const def = cachedAddrs?.find((x) => x.is_default) ?? cachedAddrs?.[0];
    return def?.id ?? '';
  });
  const [comment, setComment] = useState<string>(initial?.comment ?? '');
  const [qty, setQty] = useState<Qty>(() => {
    const q: Qty = {};
    for (const it of initial?.items ?? []) q[it.wine_id] = it.quantity;
    return q;
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isCreate = !orderId && !initial;
  const [parseText, setParseText] = useState('');
  const [parseBusy, setParseBusy] = useState(false);
  const [parseInfo, setParseInfo] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api<Address[]>('/addresses'), api<Wine[]>('/wines')])
      .then(([a, w]) => {
        if (!active) return;
        setAddresses(a);
        setWines(w);
        cacheSet('addresses', a, ADDRS_TTL);
        cacheSet('wines', w, WINES_TTL);
        if (!initial) {
          setAddressId((current) => {
            if (current && a.some((x) => x.id === current)) return current;
            const def = a.find((x) => x.is_default) ?? a[0];
            return def?.id ?? '';
          });
        }
      })
      .catch(() => {
        if (active && !cachedAddrs) setLoadError('Не вдалося завантажити дані.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initial]);

  const total = useMemo(() => {
    let sum = 0;
    for (const w of wines) {
      const q = qty[w.id];
      if (!q || q <= 0) continue;
      sum += Number(w.price) * q;
    }
    return Math.round(sum * 100) / 100;
  }, [wines, qty]);

  const hasItems = useMemo(() => Object.values(qty).some((n) => n > 0), [qty]);

  function changeQty(id: string, value: number) {
    setQty((prev) => {
      const next = { ...prev };
      if (!Number.isFinite(value) || value <= 0) delete next[id];
      else next[id] = Math.floor(value);
      return next;
    });
  }

  async function onParse() {
    setParseError(null);
    setParseInfo(null);
    const text = parseText.trim();
    if (!text) {
      setParseError('Введіть або вставте текст замовлення.');
      return;
    }
    setParseBusy(true);
    try {
      const res = await api<{ items: { wine_id: string; quantity: number }[] }>(
        '/orders/parse',
        { method: 'POST', body: { text } }
      );
      const knownIds = new Set(wines.map((w) => w.id));
      const next: Qty = {};
      let recognized = 0;
      for (const it of res.items) {
        if (!knownIds.has(it.wine_id) || it.quantity <= 0) continue;
        next[it.wine_id] = Math.floor(it.quantity);
        recognized++;
      }
      if (recognized === 0) {
        setParseError('Жодної позиції не впізнано. Спробуйте іншими словами або заповніть вручну.');
        return;
      }
      setQty(next);
      setParseInfo(`Розпізнано позицій: ${recognized}. Перевірте кількості нижче.`);
    } catch (err) {
      if (err instanceof ApiError) {
        setParseError('Не вдалося розпізнати. Заповніть вручну.');
      } else {
        setParseError('Немає зв’язку з сервером.');
      }
    } finally {
      setParseBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!addressId) {
      setSubmitError('Оберіть адресу доставки.');
      return;
    }
    const items = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([wine_id, quantity]) => ({ wine_id, quantity }));
    if (items.length === 0) {
      setSubmitError('Додайте хоча б одну позицію.');
      return;
    }
    setBusy(true);
    try {
      const body = { delivery_address_id: addressId, comment: comment || null, items };
      if (orderId) {
        await api(`/orders/${orderId}`, { method: 'PUT', body });
        navigate(`/orders/${orderId}`, { replace: true });
      } else {
        const created = await api<{ id: string }>('/orders', { method: 'POST', body });
        navigate(`/orders/${created.id}`, { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setSubmitError('Це замовлення вже не можна редагувати.');
        else if (err.status === 400) setSubmitError('Перевірте позиції та адресу.');
        else setSubmitError('Не вдалося зберегти замовлення.');
      } else {
        setSubmitError('Немає зв’язку з сервером.');
      }
      setBusy(false);
    }
  }

  if (loading) return <div className="card">Завантаження…</div>;
  if (loadError) return <div className="card text-burgundy-700">{loadError}</div>;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {isCreate && (
        <section className="card">
          <h2 className="font-semibold text-burgundy-700 mb-2">Вставити текст замовлення</h2>
          <p className="text-xs text-neutral-500 mb-2">
            Напр., «3 каберне, 2 шардоне». Нижче все одно можна відкоригувати кількості вручну.
          </p>
          <textarea
            className="min-h-[96px] w-full p-3 rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-burgundy-500"
            value={parseText}
            onChange={(e) => setParseText(e.target.value)}
            placeholder="3 каберне, 2 шардоне"
            maxLength={10000}
          />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button
              type="button"
              onClick={onParse}
              disabled={parseBusy || !parseText.trim()}
              className="btn-secondary"
            >
              {parseBusy ? 'Розпізнаю…' : 'Розпізнати'}
            </button>
            {parseInfo && <div className="text-xs text-neutral-600">{parseInfo}</div>}
            {parseError && <div className="text-xs text-burgundy-700">{parseError}</div>}
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="font-semibold text-burgundy-700 mb-2">Адреса доставки</h2>
        {addresses.length === 0 ? (
          <div className="text-sm text-neutral-600">
            Немає жодної адреси. Додайте адресу у профілі.
          </div>
        ) : (
          <select
            className="input"
            value={addressId}
            onChange={(e) => setAddressId(e.target.value)}
            required
          >
            <option value="" disabled>Оберіть адресу…</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
                {a.is_default ? ' (за замовчуванням)' : ''}
              </option>
            ))}
          </select>
        )}
      </section>

      <section className="card">
        <h2 className="font-semibold text-burgundy-700 mb-2">Позиції</h2>
        <ul className="divide-y divide-neutral-200">
          {wines.map((w) => {
            const outOfStock = w.stock_quantity <= 0;
            const value = qty[w.id] ?? 0;
            return (
              <li
                key={w.id}
                className={`py-3 flex items-center justify-between gap-3 ${outOfStock ? 'opacity-50' : ''}`}
              >
                <div className="min-w-0">
                  <div className="truncate">
                    {w.name}
                    {w.year != null && <span className="text-neutral-500 font-normal"> {w.year}</span>}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {formatMoney(w.price)} ₴ {outOfStock && '· немає в наявності'}
                  </div>
                </div>
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  disabled={outOfStock}
                  value={value === 0 ? '' : value}
                  onChange={(e) => changeQty(w.id, e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="0"
                  className="h-12 w-20 px-2 text-center rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-burgundy-500 disabled:bg-neutral-100"
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Коментар</span>
          <textarea
            className="min-h-[96px] w-full p-3 rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-burgundy-500"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
          />
        </label>
      </section>

      <div className="card sticky bottom-0 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-neutral-500">Разом</div>
          <div className="text-lg font-bold text-burgundy-700">{formatMoney(total)} ₴</div>
        </div>
        <button type="submit" className="btn-primary flex-1" disabled={busy || !addressId || !hasItems}>
          {busy ? 'Збереження…' : submitLabel}
        </button>
      </div>
      {submitError && <div className="card text-burgundy-700 text-sm">{submitError}</div>}
    </form>
  );
}

export function detailToInitial(o: OrderDetail): OrderFormInitial {
  return {
    delivery_address_id: o.delivery_address_id,
    comment: o.comment,
    items: o.items.map((it) => ({ wine_id: it.wine_id, quantity: it.quantity })),
  };
}
