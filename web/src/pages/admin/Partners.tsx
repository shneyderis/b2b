import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api';
import type { AdminPartner, AdminPartnerUser, PartnerStatus, Warehouse } from '../../types';

const STATUS_LABELS: Record<PartnerStatus, string> = {
  pending: 'На апруві',
  approved: 'Схвалено',
  rejected: 'Відхилено',
};

const TABS: PartnerStatus[] = ['pending', 'approved', 'rejected'];

export function AdminPartners() {
  const [tab, setTab] = useState<PartnerStatus>('pending');
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<PartnerStatus, number>>({ pending: 0, approved: 0, rejected: 0 });
  const [showCreate, setShowCreate] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  async function load(status: PartnerStatus) {
    setLoading(true);
    try {
      const rows = await api<AdminPartner[]>(`/admin/partners?status=${status}`);
      setPartners(rows);
      setError(null);
    } catch {
      setError('Не вдалося завантажити партнерів.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshCounts() {
    try {
      const all = await api<AdminPartner[]>('/admin/partners');
      const c: Record<PartnerStatus, number> = { pending: 0, approved: 0, rejected: 0 };
      for (const p of all) c[p.status]++;
      setCounts(c);
    } catch {}
  }

  useEffect(() => {
    void load(tab);
  }, [tab]);

  useEffect(() => {
    void refreshCounts();
    api<Warehouse[]>('/admin/warehouses').then(setWarehouses).catch(() => {});
  }, []);

  async function changeStatus(id: string, status: PartnerStatus) {
    try {
      await api(`/admin/partners/${id}/status`, { method: 'PUT', body: { status } });
      setPartners((prev) => prev.filter((p) => p.id !== id));
      void refreshCounts();
    } catch {
      alert('Не вдалося змінити статус.');
    }
  }

  async function updateDiscount(id: string, discount_percent: number) {
    try {
      const row = await api<AdminPartner>(`/admin/partners/${id}`, {
        method: 'PUT',
        body: { discount_percent },
      });
      setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, discount_percent: row.discount_percent } : p)));
    } catch {
      alert('Не вдалося оновити знижку.');
    }
  }

  async function updateWarehouse(id: string, warehouse_id: string) {
    try {
      await api(`/admin/partners/${id}`, { method: 'PUT', body: { warehouse_id } });
      const wh = warehouses.find((w) => w.id === warehouse_id);
      setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, warehouse_id, warehouse_name: wh?.name ?? null } : p)));
    } catch {
      alert('Не вдалося оновити склад.');
    }
  }

  async function updateLegalName(id: string, legal_name: string | null) {
    try {
      const row = await api<AdminPartner>(`/admin/partners/${id}`, {
        method: 'PUT',
        body: { legal_name },
      });
      setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, legal_name: row.legal_name } : p)));
    } catch {
      alert('Не вдалося оновити юридичну особу.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-burgundy-700">Партнери</h1>
        <button onClick={() => setShowCreate(true)} className="h-10 px-3 rounded-lg bg-burgundy-700 text-white text-sm font-medium">
          + Додати партнера
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-10 px-3 rounded-full text-sm whitespace-nowrap border ${
              tab === t ? 'bg-burgundy-700 text-white border-burgundy-700' : 'border-neutral-300 text-neutral-700'
            }`}
          >
            {STATUS_LABELS[t]} · {counts[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card">Завантаження…</div>
      ) : error ? (
        <div className="card text-burgundy-700">{error}</div>
      ) : partners.length === 0 ? (
        <div className="card text-neutral-500">Партнерів у цьому статусі немає.</div>
      ) : (
        <ul className="flex flex-col gap-3">
          {partners.map((p) => (
            <PartnerCard
              key={p.id}
              partner={p}
              warehouses={warehouses}
              onApprove={() => changeStatus(p.id, 'approved')}
              onReject={() => changeStatus(p.id, 'rejected')}
              onRestore={() => changeStatus(p.id, 'pending')}
              onDiscount={(n) => updateDiscount(p.id, n)}
              onWarehouse={(wid) => updateWarehouse(p.id, wid)}
              onLegalName={(value) => updateLegalName(p.id, value)}
              onUserAdded={() => load(tab)}
            />
          ))}
        </ul>
      )}

      {showCreate && (
        <CreatePartnerModal
          warehouses={warehouses}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void refreshCounts();
            if (tab === 'approved') void load('approved');
            else setTab('approved');
          }}
        />
      )}
    </div>
  );
}

function PartnerCard({
  partner,
  warehouses,
  onApprove,
  onReject,
  onRestore,
  onDiscount,
  onWarehouse,
  onLegalName,
  onUserAdded,
}: {
  partner: AdminPartner;
  warehouses: Warehouse[];
  onApprove: () => void;
  onReject: () => void;
  onRestore: () => void;
  onDiscount: (n: number) => void;
  onWarehouse: (warehouseId: string) => void;
  onLegalName: (value: string | null) => void;
  onUserAdded: () => void | Promise<void>;
}) {
  const [discount, setDiscount] = useState<string>(String(partner.discount_percent));
  const [legalName, setLegalName] = useState<string>(partner.legal_name ?? '');
  const [open, setOpen] = useState(partner.status === 'pending');
  const [showAddUser, setShowAddUser] = useState(false);

  useEffect(() => {
    setDiscount(String(partner.discount_percent));
  }, [partner.discount_percent]);

  useEffect(() => {
    setLegalName(partner.legal_name ?? '');
  }, [partner.legal_name]);

  function commitLegalName() {
    const trimmed = legalName.trim();
    const next = trimmed || null;
    if (next === (partner.legal_name ?? null)) return;
    onLegalName(next);
  }

  function commitDiscount() {
    const n = Number(discount.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setDiscount(String(partner.discount_percent));
      return;
    }
    if (n === Number(partner.discount_percent)) return;
    onDiscount(n);
  }

  return (
    <li className="card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-semibold text-burgundy-700">{partner.name}</div>
          {partner.legal_name && partner.legal_name !== partner.name && (
            <div className="text-xs text-neutral-700 mt-0.5">{partner.legal_name}</div>
          )}
          <div className="text-xs text-neutral-500 mt-0.5">
            {partner.city && <>{partner.city} · </>}
            {partner.users.length} користувач(ів) · {partner.addresses.length} адрес
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {partner.status === 'approved' && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-neutral-600">Знижка</span>
              <input
                type="text"
                inputMode="decimal"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                onBlur={commitDiscount}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                }}
                className="h-10 w-16 px-2 text-right rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-burgundy-500"
              />
              <span className="text-neutral-600">%</span>
            </label>
          )}
          {warehouses.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-neutral-600">Склад</span>
              <select
                value={partner.warehouse_id ?? ''}
                onChange={(e) => onWarehouse(e.target.value)}
                className="h-10 px-2 rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-burgundy-500"
              >
                {!partner.warehouse_id && <option value="" disabled>—</option>}
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {partner.status === 'pending' && (
        <div className="mt-3 flex gap-2">
          <button onClick={onApprove} className="btn-primary flex-1">Схвалити</button>
          <button onClick={onReject} className="btn-secondary flex-1">Відхилити</button>
        </div>
      )}
      {partner.status === 'rejected' && (
        <div className="mt-3">
          <button onClick={onRestore} className="btn-secondary">Повернути на розгляд</button>
        </div>
      )}

      <button
        className="mt-3 text-xs text-burgundy-700 hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Сховати деталі' : 'Показати деталі'}
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium text-neutral-700">Юридична особа</span>
            <input
              className="input"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              onBlur={commitLegalName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
              }}
              placeholder="ТОВ «…»"
              maxLength={255}
            />
          </label>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="font-medium text-neutral-700">Користувачі</div>
              <button
                type="button"
                onClick={() => setShowAddUser(true)}
                className="h-8 px-2 rounded-lg border border-burgundy-700 text-burgundy-700 text-xs"
              >
                + Додати
              </button>
            </div>
            {partner.users.length === 0 ? (
              <div className="text-neutral-500 text-xs">
                Логіна ще немає — натисніть «+ Додати» щоб створити.
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {partner.users.map((u) => (
                  <PartnerUserRow
                    key={u.id}
                    partnerId={partner.id}
                    user={u}
                    canDelete={partner.users.length > 1}
                    onChanged={onUserAdded}
                  />
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="font-medium text-neutral-700 mb-1">Адреси</div>
            {partner.addresses.length === 0 ? (
              <div className="text-neutral-500">—</div>
            ) : (
              <ul className="flex flex-col gap-1">
                {partner.addresses.map((a) => (
                  <li key={a.id} className="text-xs">
                    <div>
                      {a.label}
                      {a.is_default && <span className="ml-1 text-burgundy-700">(за замовчуванням)</span>}
                    </div>
                    <div className="text-neutral-500 whitespace-pre-wrap">{a.address}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {partner.notes && (
            <div className="sm:col-span-2">
              <div className="font-medium text-neutral-700 mb-1">Нотатки</div>
              <div className="text-xs whitespace-pre-wrap">{partner.notes}</div>
            </div>
          )}
        </div>
      )}

      {showAddUser && (
        <AddUserModal
          partnerId={partner.id}
          onClose={() => setShowAddUser(false)}
          onAdded={async () => {
            setShowAddUser(false);
            await onUserAdded();
          }}
        />
      )}
    </li>
  );
}

function PartnerUserRow({
  partnerId,
  user,
  canDelete,
  onChanged,
}: {
  partnerId: string;
  user: AdminPartnerUser;
  canDelete: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onReset() {
    if (busy) return;
    if (!window.confirm(`Згенерувати новий пароль для ${user.email}?`)) return;
    setBusy(true);
    try {
      const res = await api<{ password: string }>(
        `/admin/partners/${partnerId}/users/${user.id}/reset-password`,
        { method: 'POST', body: {} }
      );
      setNewPassword(res.password);
    } catch {
      alert('Не вдалося скинути пароль.');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (busy) return;
    if (!window.confirm(`Видалити логін ${user.email}? Цю дію не можна скасувати.`)) return;
    setBusy(true);
    try {
      await api(`/admin/partners/${partnerId}/users/${user.id}`, { method: 'DELETE' });
      await onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data?.error === 'last_user') {
        alert('Це останній логін партнера — його не можна видалити.');
      } else if (e instanceof ApiError && e.status === 409 && e.data?.error === 'self_delete') {
        alert('Не можна видалити свій власний обліковий запис.');
      } else {
        alert('Не вдалося видалити.');
      }
      setBusy(false);
    }
  }

  return (
    <li className="text-xs border border-neutral-200 rounded-lg p-2 flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{user.contact_name ?? '—'}</div>
        <div className="text-neutral-500 break-all">
          {user.email} · {user.phone ?? '—'}
          {user.telegram_id && ` · TG: ${user.telegram_id}`}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={busy}
          className="h-8 px-2 rounded-lg border border-neutral-300 text-neutral-700 text-xs disabled:opacity-50"
          title="Редагувати"
        >
          Ред.
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={busy}
          className="h-8 px-2 rounded-lg border border-burgundy-700 text-burgundy-700 text-xs disabled:opacity-50"
          title="Згенерувати новий пароль"
        >
          Пароль
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="h-8 px-2 rounded-lg border border-burgundy-700 bg-burgundy-700 text-white text-xs disabled:opacity-50"
            title="Видалити"
          >
            ✕
          </button>
        )}
      </div>

      {editing && (
        <EditUserModal
          partnerId={partnerId}
          user={user}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await onChanged();
          }}
        />
      )}
      {newPassword && (
        <ShowPasswordModal
          email={user.email}
          password={newPassword}
          onClose={() => setNewPassword(null)}
        />
      )}
    </li>
  );
}

function EditUserModal({
  partnerId,
  user,
  onClose,
  onSaved,
}: {
  partnerId: string;
  user: AdminPartnerUser;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [contact, setContact] = useState(user.contact_name ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setErr('Email обов’язковий.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/partners/${partnerId}/users/${user.id}`, {
        method: 'PUT',
        body: {
          email: email.trim(),
          phone: phone.trim() || null,
          contact_name: contact.trim() || null,
        },
      });
      await onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setErr('Email вже зайнятий.');
      else setErr('Не вдалося зберегти.');
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
        <h2 className="font-bold text-burgundy-700">Редагувати логін</h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Email</span>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Ім'я</span>
          <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Телефон</span>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        {err && <div className="text-sm text-burgundy-700">{err}</div>}
        <div className="flex gap-2 mt-1">
          <button type="submit" className="btn-primary flex-1" disabled={busy}>
            {busy ? 'Збереження…' : 'Зберегти'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={busy}>
            Скасувати
          </button>
        </div>
      </form>
    </div>
  );
}

function ShowPasswordModal({
  email,
  password,
  onClose,
}: {
  email: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-20 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-lg w-full max-w-md p-4 flex flex-col gap-3"
      >
        <h2 className="font-bold text-burgundy-700">Новий пароль</h2>
        <p className="text-sm text-neutral-600">
          Для <span className="font-medium">{email}</span>. Скопіюйте зараз — пізніше цей пароль
          неможливо буде переглянути.
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={password}
            className="input font-mono text-sm"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button type="button" onClick={copy} className="btn-secondary shrink-0">
            {copied ? '✓' : 'Копія'}
          </button>
        </div>
        <button type="button" onClick={onClose} className="btn-primary">
          Готово
        </button>
      </div>
    </div>
  );
}

function AddUserModal({
  partnerId,
  onClose,
  onAdded,
}: {
  partnerId: string;
  onClose: () => void;
  onAdded: () => void | Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      setErr('Перевірте поля (пароль мінімум 6 символів).');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/partners/${partnerId}/users`, {
        method: 'POST',
        body: {
          email: email.trim(),
          password,
          phone: phone.trim() || undefined,
          contact_name: contact.trim() || undefined,
        },
      });
      await onAdded();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setErr('Email вже зайнятий.');
      else setErr('Не вдалося створити логін.');
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
        <h2 className="font-bold text-burgundy-700">Новий логін для партнера</h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Email</span>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Пароль (мін. 6 символів)</span>
          <input type="text" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Ім'я (необов'язково)</span>
          <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Телефон (необов'язково)</span>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        {err && <div className="text-sm text-burgundy-700">{err}</div>}
        <div className="flex gap-2 mt-1">
          <button type="submit" className="btn-primary flex-1" disabled={busy}>
            {busy ? 'Збереження…' : 'Створити'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={busy}>Скасувати</button>
        </div>
      </form>
    </div>
  );
}

function CreatePartnerModal({ warehouses, onClose, onCreated }: {
  warehouses: Warehouse[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [city, setCity] = useState('');
  const [discount, setDiscount] = useState('0');
  const [warehouseId, setWarehouseId] = useState<string>(warehouses[0]?.id ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const d = Number(discount.replace(',', '.'));
    if (!name.trim() || !email.trim() || password.length < 6 || !Number.isFinite(d) || d < 0 || d > 100) {
      setError('Перевірте поля.');
      return;
    }
    setBusy(true);
    try {
      await api('/admin/partners', {
        method: 'POST',
        body: {
          name: name.trim(),
          legal_name: legalName.trim() || undefined,
          city: city.trim() || undefined,
          discount_percent: d,
          warehouse_id: warehouseId || undefined,
          user: {
            email: email.trim(),
            password,
            phone: phone.trim() || undefined,
            contact_name: contact.trim() || undefined,
          },
        },
      });
      onCreated();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError('Email вже зайнятий.');
      else setError('Не вдалося створити партнера.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-20 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="bg-white rounded-xl shadow-lg w-full max-w-md p-4 flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="font-bold text-burgundy-700">Новий партнер</h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Назва (бренд / заклад)</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Юридична особа</span>
          <input className="input" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="ТОВ «…»" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Місто</span>
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Київ" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Знижка, %</span>
          <input className="input text-right" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </label>
        {warehouses.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-600">Склад</span>
            <select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
        )}
        <div className="text-sm font-medium text-neutral-700 mt-1">Контактна особа</div>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Ім’я</span>
          <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Email</span>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Телефон</span>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Пароль (мін. 6 символів)</span>
          <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
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
