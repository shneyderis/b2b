import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api';
import type { AdminPartner, AdminWine } from '../../types';
import { formatMoney } from '../../format';

type Qty = Record<string, number>;

export function AdminNewOrder() {
  const navigate = useNavigate();
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [wines, setWines] = useState<AdminWine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [partnerId, setPartnerId] = useState<string>('');
  const [addressId, setAddressId] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [qty, setQty] = useState<Qty>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [parseText, setParseText] = useState('');
  const [parseBusy, setParseBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseInfo, setParseInfo] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api<AdminPartner[]>('/admin/partners'), api<AdminWine[]>('/admin/wines')])
      .then(([p, w]) => {
        if (!active) return;
        setPartners(p);
        setWines(w);
      })
      .catch(() => {
        if (active) setLoadError('Не вдалося завантажити дані.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedPartner = useMemo(
    () => partners.find((x) => x.id === partnerId) ?? null,
    [partners, partnerId]
  );
  const discount = Number(selectedPartner?.discount_percent ?? 0);

  function onPartnerChange(id: string) {
    setPartnerId(id);
    const p = partners.find((x) => x.id === id);
    const def = p?.addresses.find((a) => a.is_default) ?? p?.addresses[0];
    setAddressId(def?.id ?? '');
  }

  function changeQty(id: string, value: number) {
    setQty((prev) => {
      const next = { ...prev };
      if (!Number.isFinite(value) || value <= 0) delete next[id];
      else next[id] = Math.floor(value);
      return next;
    });
  }

  const availableWines = useMemo(
    () => wines.filter((w) => w.is_active && w.stock_quantity > 0),
    [wines]
  );

  const total = useMemo(() => {
    let sum = 0;
    for (const w of availableWines) {
      const q = qty[w.id];
      if (!q || q <= 0) continue;
      const price = Math.round(Number(w.price) * (100 - discount)) / 100;
      sum += price * q;
    }
    return Math.round(sum * 100) / 100;
  }, [availableWines, qty, discount]);

  const hasItems = useMemo(() => Object.values(qty).some((n) => n > 0), [qty]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!partnerId) {
      setSubmitError('Оберіть партнера.');
      return;
    }
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
      const body = {
        partner_id: partnerId,
        delivery_address_id: addressId,
        comment: comment || null,
        items,
      };
      const created = await api<{ id: string }>('/admin/orders', { method: 'POST', body });
      navigate(`/admin/orders/${created.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) setSubmitError('Перевірте партнера, адресу та позиції.');
        else setSubmitError('Не вдалося створити замовлення.');
      } else {
        setSubmitError('Немає зв’язку з сервером.');
      }
      setBusy(false);
    }
  }

  function matchPartner(hint: string): AdminPartner[] {
    const normalized = hint.toLowerCase().replace(/[«»"'`]/g, '').trim();
    if (!normalized) return [];
    return partners
      .filter((p) =>
        p.name.toLowerCase().includes(normalized) ||
        (p.legal_name && p.legal_name.toLowerCase().includes(normalized))
      )
      .sort((a, b) => a.name.length - b.name.length);
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
      const res = await api<{ partner_hint: string | null; items: { wine_id: string; quantity: number }[] }>(
        '/admin/orders/parse',
        { method: 'POST', body: { text } }
      );

      const messages: string[] = [];

      if (res.partner_hint) {
        const matches = matchPartner(res.partner_hint);
        if (matches.length === 1) {
          onPartnerChange(matches[0].id);
          messages.push(`Партнер: ${matches[0].name}.`);
        } else if (matches.length > 1) {
          messages.push(`Знайдено кілька партнерів для «${res.partner_hint}» — оберіть вручну.`);
        } else {
          messages.push(`Партнера «${res.partner_hint}» не знайдено — оберіть вручну.`);
        }
      } else {
        messages.push('Партнер у тексті не вказаний — оберіть вручну.');
      }

      const knownIds = new Set(availableWines.map((w) => w.id));
      const next: Qty = {};
      for (const it of res.items) {
        if (!knownIds.has(it.wine_id)) continue;
        next[it.wine_id] = (next[it.wine_id] ?? 0) + it.quantity;
      }
      if (Object.keys(next).length === 0) {
        setParseError('Не вдалося розпізнати жодної позиції з каталогу.');
        return;
      }
      setQty(next);
      const total = Object.values(next).reduce((s, n) => s + n, 0);
      messages.push(`Додано ${Object.keys(next).length} позицій, ${total} шт.`);
      setParseInfo(messages);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setParseError('LLM не налаштовано на сервері.');
      } else if (err instanceof ApiError) {
        const detail = err.data?.detail || err.data?.error || err.message;
        setParseError(`Не вдалося розпізнати: ${detail}`);
      } else {
        setParseError('Немає зв’язку з сервером.');
      }
    } finally {
      setParseBusy(false);
    }
  }

  if (loading) return <div className="card">Завантаження…</div>;
  if (loadError) return <div className="card text-burgundy-700">{loadError}</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-burgundy-700">Нове замовлення за партнера</h1>
        <Link to="/admin/orders" className="text-burgundy-700 text-sm">Скасувати</Link>
      </div>

      <section className="card">
        <h2 className="font-semibold text-burgundy-700 mb-1">Розпізнати з тексту</h2>
        <p className="text-sm text-neutral-600 mb-3">
          Вставте SMS, лист або просто надиктуйте у будь-якій формі — LLM підставить партнера й
          позиції у форму нижче. Потім можна доправити руками.
        </p>
        <textarea
          className="min-h-[110px] w-full p-3 rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-burgundy-500"
          value={parseText}
          onChange={(e) => setParseText(e.target.value)}
          maxLength={10000}
          disabled={parseBusy}
          placeholder="Напр.: «Артанія: 3 каберне, 2 шардоне, будь ласка»"
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onParse}
            disabled={parseBusy || !parseText.trim()}
            className="btn-primary px-4"
          >
            {parseBusy ? 'Обробляємо…' : 'Розпізнати'}
          </button>
          {parseText && !parseBusy && (
            <button
              type="button"
              onClick={() => {
                setParseText('');
                setParseError(null);
                setParseInfo(null);
              }}
              className="h-10 px-3 rounded-lg text-sm text-neutral-600 hover:bg-neutral-100"
            >
              Очистити
            </button>
          )}
        </div>
        {parseError && (
          <div className="mt-3 text-sm text-burgundy-700 bg-burgundy-50 border border-burgundy-100 rounded-lg p-2">
            {parseError}
          </div>
        )}
        {parseInfo && parseInfo.length > 0 && (
          <div className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2">
            {parseInfo.map((m, i) => (
              <div key={i}>{m}</div>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center gap-3 text-sm text-neutral-500">
        <div className="flex-1 h-px bg-neutral-200" />
        <span>або заповніть вручну</span>
        <div className="flex-1 h-px bg-neutral-200" />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <section className="card">
          <h2 className="font-semibold text-burgundy-700 mb-2">Партнер</h2>
          <select
            className="input"
            value={partnerId}
            onChange={(e) => onPartnerChange(e.target.value)}
            required
          >
            <option value="" disabled>Оберіть партнера…</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.city ? ` — ${p.city}` : ''}
                {Number(p.discount_percent) > 0 ? ` (знижка ${p.discount_percent}%)` : ''}
              </option>
            ))}
          </select>
        </section>

        <section className="card">
          <h2 className="font-semibold text-burgundy-700 mb-2">Адреса доставки</h2>
          {!selectedPartner ? (
            <div className="text-sm text-neutral-600">Спочатку оберіть партнера.</div>
          ) : selectedPartner.addresses.length === 0 ? (
            <div className="text-sm text-neutral-600">
              У цього партнера немає збережених адрес.
            </div>
          ) : (
            <select
              className="input"
              value={addressId}
              onChange={(e) => setAddressId(e.target.value)}
              required
            >
              <option value="" disabled>Оберіть адресу…</option>
              {selectedPartner.addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                  {a.is_default ? ' (за замовчуванням)' : ''}
                </option>
              ))}
            </select>
          )}
        </section>

        <section className="card">
          <h2 className="font-semibold text-burgundy-700 mb-2">
            Позиції
            {discount > 0 && (
              <span className="ml-2 text-xs font-normal text-neutral-500">
                · ціни зі знижкою {discount}%
              </span>
            )}
          </h2>
          <ul className="divide-y divide-neutral-200">
            {availableWines.map((w) => {
              const value = qty[w.id] ?? 0;
              const priced = Math.round(Number(w.price) * (100 - discount)) / 100;
              return (
                <li key={w.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate">
                      {w.name}
                      {w.year != null && (
                        <span className="text-neutral-500 font-normal"> {w.year}</span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {formatMoney(priced)} ₴
                      {discount > 0 && (
                        <span className="ml-1 line-through text-neutral-400">
                          {formatMoney(w.price)} ₴
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={value === 0 ? '' : value}
                    onChange={(e) => changeQty(w.id, e.target.value === '' ? 0 : Number(e.target.value))}
                    placeholder="0"
                    className="h-12 w-20 px-2 text-center rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-burgundy-500"
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
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={busy || !partnerId || !addressId || !hasItems}
          >
            {busy ? 'Збереження…' : 'Створити'}
          </button>
        </div>
        {submitError && <div className="card text-burgundy-700 text-sm">{submitError}</div>}
      </form>
    </div>
  );
}
