import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api';
import type { Warehouse } from '../../types';

export function AdminWarehouses() {
  const [items, setItems] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateWh, setShowCreateWh] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);

  async function refresh() {
    try {
      const rows = await api<Warehouse[]>('/admin/warehouses');
      setItems(rows);
      setError(null);
    } catch {
      setError('Не вдалося завантажити склади.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function patchChatId(id: string, telegram_chat_id: string) {
    const trimmed = telegram_chat_id.trim();
    try {
      const row = await api<Warehouse>(`/admin/warehouses/${id}`, {
        method: 'PUT',
        body: { telegram_chat_id: trimmed || null },
      });
      setItems((prev) => prev.map((w) => (w.id === id ? row : w)));
    } catch {
      alert('Не вдалося зберегти.');
      await refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-burgundy-700">Склади</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateWh(true)} className="h-10 px-3 rounded-lg bg-burgundy-700 text-white text-sm font-medium">
            + Склад
          </button>
          <button onClick={() => setShowCreateUser(true)} className="h-10 px-3 rounded-lg border border-burgundy-700 text-burgundy-700 text-sm font-medium" disabled={items.length === 0}>
            + Працівник
          </button>
        </div>
      </div>

      <div className="card text-xs text-neutral-600">
        <div className="font-medium text-neutral-800 mb-1">Як отримати <code>Telegram chat ID</code> для складу</div>
        <ol className="list-decimal list-inside space-y-1">
          <li>Створи окрему групу в Telegram для цього складу.</li>
          <li>Додай туди бота-нотифікатора (того самого, що й у менеджерську групу).</li>
          <li>Напиши будь-яке повідомлення у групі.</li>
          <li>Відкрий у браузері <code className="break-all">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code>.</li>
          <li>Знайди блок <code>chat</code> — звідти скопіюй поле <code>id</code> (формат <code>-1001234567890</code>) у колонку нижче.</li>
        </ol>
        <div className="mt-2">Якщо поле порожнє — склад нотифікацій не отримує.</div>
      </div>

      {loading ? (
        <div className="card">Завантаження…</div>
      ) : error ? (
        <div className="card text-burgundy-700">{error}</div>
      ) : items.length === 0 ? (
        <div className="card text-neutral-500">Складів ще немає.</div>
      ) : (
        <section className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="text-left px-3 py-2">Назва</th>
                <th className="text-left px-3 py-2">Telegram chat ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <WarehouseRow key={w.id} warehouse={w} onPatchChat={(v) => patchChatId(w.id, v)} />
              ))}
            </tbody>
          </table>
        </section>
      )}

      {showCreateWh && (
        <CreateWarehouseModal
          onClose={() => setShowCreateWh(false)}
          onCreated={async () => {
            setShowCreateWh(false);
            await refresh();
          }}
        />
      )}

      {showCreateUser && (
        <CreateStaffModal
          warehouses={items}
          onClose={() => setShowCreateUser(false)}
          onCreated={() => setShowCreateUser(false)}
        />
      )}
    </div>
  );
}

function WarehouseRow({ warehouse, onPatchChat }: { warehouse: Warehouse; onPatchChat: (v: string) => Promise<void> | void }) {
  const [chat, setChat] = useState<string>(warehouse.telegram_chat_id ?? '');

  useEffect(() => {
    setChat(warehouse.telegram_chat_id ?? '');
  }, [warehouse.telegram_chat_id]);

  function commit() {
    if ((warehouse.telegram_chat_id ?? '') === chat.trim()) return;
    void onPatchChat(chat);
  }

  return (
    <tr className="border-t border-neutral-200">
      <td className="px-3 py-2 font-medium">{warehouse.name}</td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={chat}
          onChange={(e) => setChat(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
          }}
          placeholder="-1001234567890"
          className="h-10 w-full max-w-xs px-2 rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-burgundy-500 font-mono text-xs"
        />
      </td>
    </tr>
  );
}

function CreateWarehouseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void | Promise<void> }) {
  const [name, setName] = useState('');
  const [chat, setChat] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr('Вкажіть назву.'); return; }
    setBusy(true);
    setErr(null);
    try {
      await api('/admin/warehouses', {
        method: 'POST',
        body: { name: name.trim(), telegram_chat_id: chat.trim() || null },
      });
      await onCreated();
    } catch (e) {
      setErr(e instanceof ApiError ? 'Не вдалося створити.' : 'Немає зв’язку з сервером.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-20 flex items-center justify-center p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}
            className="bg-white rounded-xl shadow-lg w-full max-w-md p-4 flex flex-col gap-3">
        <h2 className="font-bold text-burgundy-700">Новий склад</h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Назва</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Telegram chat ID (необов’язково)</span>
          <input className="input font-mono text-xs" placeholder="-1001234567890" value={chat} onChange={(e) => setChat(e.target.value)} />
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

function CreateStaffModal({ warehouses, onClose, onCreated }: {
  warehouses: Warehouse[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [contact, setContact] = useState('');
  const [whId, setWhId] = useState(warehouses[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!whId) { setErr('Оберіть склад.'); return; }
    setBusy(true);
    setErr(null);
    try {
      await api('/admin/warehouse-users', {
        method: 'POST',
        body: { email, password, contact_name: contact || undefined, warehouse_id: whId },
      });
      setOk(true);
      setTimeout(onCreated, 1000);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setErr('Email вже зайнятий.');
      else setErr('Не вдалося створити.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-20 flex items-center justify-center p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}
            className="bg-white rounded-xl shadow-lg w-full max-w-md p-4 flex flex-col gap-3">
        <h2 className="font-bold text-burgundy-700">Працівник складу</h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Email</span>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Пароль (мінімум 6)</span>
          <input type="text" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Ім’я (необов’язково)</span>
          <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Склад</span>
          <select className="input" value={whId} onChange={(e) => setWhId(e.target.value)} required>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        {err && <div className="text-sm text-burgundy-700">{err}</div>}
        {ok && <div className="text-sm text-green-700">Створено.</div>}
        <div className="flex gap-2 mt-1">
          <button type="submit" className="btn-primary flex-1" disabled={busy || ok}>
            {busy ? 'Збереження…' : 'Створити'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={busy}>Скасувати</button>
        </div>
      </form>
    </div>
  );
}
