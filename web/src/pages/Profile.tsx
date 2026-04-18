import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import type { Address, Profile as ProfileData } from '../types';

function formatDiscount(v: string | number | undefined) {
  if (v === undefined || v === null || v === '') return '0';
  const n = Number(v);
  return Number.isFinite(n) ? n.toString() : String(v);
}

export function Profile() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const p = await api<ProfileData>('/profile');
        if (active) setData(p);
      } catch (e) {
        if (active) setLoadError(e instanceof ApiError ? 'Не вдалося завантажити профіль.' : 'Немає зв’язку з сервером.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="card">Завантаження…</div>;
  if (loadError) return <div className="card text-burgundy-700">{loadError}</div>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <ProfileForm data={data} onSaved={setData} />
      <AddressesSection />
    </div>
  );
}

function ProfileForm({ data, onSaved }: { data: ProfileData; onSaved: (p: ProfileData) => void }) {
  const [company_name, setCompany] = useState(data.partner?.name ?? '');
  const [contact_name, setContact] = useState(data.user.contact_name ?? '');
  const [phone, setPhone] = useState(data.user.phone ?? '');
  const [email, setEmail] = useState(data.user.email);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api('/profile', {
        method: 'PUT',
        body: { company_name, contact_name, phone, email },
      });
      const fresh = await api<ProfileData>('/profile');
      onSaved(fresh);
      setMsg({ kind: 'ok', text: 'Збережено.' });
    } catch (err) {
      const text = err instanceof ApiError ? 'Не вдалося зберегти. Перевірте поля.' : 'Немає зв’язку з сервером.';
      setMsg({ kind: 'err', text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="text-lg font-bold text-burgundy-700 mb-3">Профіль</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Назва компанії</span>
          <input className="input" value={company_name} onChange={(e) => setCompany(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Контактна особа</span>
          <input className="input" value={contact_name} onChange={(e) => setContact(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Телефон</span>
          <input type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Email</span>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <div className="flex items-center justify-between bg-burgundy-50 border border-burgundy-100 rounded-lg p-3">
          <span className="text-sm text-neutral-700">Знижка</span>
          <span className="text-burgundy-700 font-semibold">{formatDiscount(data.partner?.discount_percent)}%</span>
        </div>
        {msg && (
          <div
            className={`text-sm rounded-lg p-2 border ${
              msg.kind === 'ok'
                ? 'text-green-800 bg-green-50 border-green-200'
                : 'text-burgundy-700 bg-burgundy-50 border-burgundy-100'
            }`}
          >
            {msg.text}
          </div>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Збереження…' : 'Зберегти'}
        </button>
      </form>
    </section>
  );
}

function AddressesSection() {
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Address | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const list = await api<Address[]>('/addresses');
      setItems(list);
      setError(null);
    } catch {
      setError('Не вдалося завантажити адреси.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function remove(id: string) {
    if (!confirm('Видалити цю адресу?')) return;
    try {
      await api(`/addresses/${id}`, { method: 'DELETE' });
      await refresh();
    } catch {
      alert('Не вдалося видалити адресу.');
    }
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-burgundy-700">Адреси доставки</h2>
        {!creating && !editing && (
          <button onClick={() => setCreating(true)} className="h-10 px-3 rounded-lg bg-burgundy-700 text-white text-sm font-medium">
            Додати
          </button>
        )}
      </div>

      {creating && (
        <AddressForm
          onCancel={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await refresh();
          }}
        />
      )}
      {editing && (
        <AddressForm
          initial={editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}

      {loading ? (
        <div className="text-sm text-neutral-500">Завантаження…</div>
      ) : error ? (
        <div className="text-sm text-burgundy-700">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-neutral-500">Поки що немає адрес.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((a) => (
            <li key={a.id} className="border border-neutral-200 rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{a.label}</span>
                {a.is_default && (
                  <span className="text-xs bg-burgundy-100 text-burgundy-700 rounded-full px-2 py-0.5">За замовчуванням</span>
                )}
              </div>
              <div className="text-sm text-neutral-600 whitespace-pre-wrap">{a.address}</div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(a)} className="h-10 px-3 rounded-lg border border-burgundy-700 text-burgundy-700 text-sm">
                  Редагувати
                </button>
                <button onClick={() => remove(a.id)} className="h-10 px-3 rounded-lg border border-neutral-300 text-neutral-700 text-sm">
                  Видалити
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddressForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: Address;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body = { label, address, is_default: isDefault };
      if (initial) {
        await api(`/addresses/${initial.id}`, { method: 'PUT', body });
      } else {
        await api('/addresses', { method: 'POST', body });
      }
      await onSaved();
    } catch {
      setErr('Не вдалося зберегти.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="border border-burgundy-100 bg-burgundy-50 rounded-lg p-3 mb-3 flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Назва (напр. «Офіс»)</span>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Адреса</span>
        <textarea
          className="min-h-[96px] w-full p-3 rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-burgundy-500"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
      </label>
      <label className="flex items-center gap-2 h-12">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        <span className="text-sm">За замовчуванням</span>
      </label>
      {err && <div className="text-sm text-burgundy-700">{err}</div>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy ? 'Збереження…' : 'Зберегти'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary flex-1" disabled={busy}>
          Скасувати
        </button>
      </div>
    </form>
  );
}
