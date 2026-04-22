import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') ?? '', [params]);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Пароль повинен бути мінімум 6 символів.');
      return;
    }
    if (password !== confirm) {
      setError('Паролі не збігаються.');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/reset-password', { body: { token, password } });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.data?.error === 'token_expired') setError('Посилання застаріло. Запросіть нове.');
        else if (e.data?.error === 'token_used') setError('Це посилання вже використано.');
        else if (e.data?.error === 'invalid_token') setError('Посилання недійсне.');
        else setError('Не вдалося змінити пароль.');
      } else {
        setError('Немає зв’язку з сервером.');
      }
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm card">
          <h1 className="text-2xl font-bold text-burgundy-700 mb-1">Невірне посилання</h1>
          <p className="text-sm text-neutral-600 mb-4">
            У посиланні немає токена. Відкрийте останнє повідомлення від бота та
            натисніть на свіже посилання.
          </p>
          <Link to="/forgot-password" className="btn-secondary inline-flex items-center justify-center w-full">
            Запросити нове
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm card">
        <h1 className="text-2xl font-bold text-burgundy-700 mb-1">Новий пароль</h1>

        {done ? (
          <>
            <p className="text-sm text-neutral-600 mt-2">
              Пароль змінено. Перенаправляємо на сторінку входу…
            </p>
          </>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-neutral-600">Новий пароль</span>
              <input
                type="password"
                autoComplete="new-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-neutral-600">Повторіть пароль</span>
              <input
                type="password"
                autoComplete="new-password"
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={6}
                required
              />
            </label>
            {error && (
              <div className="text-sm text-burgundy-700 bg-burgundy-50 border border-burgundy-100 rounded-lg p-2">
                {error}
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Зберігаємо…' : 'Зберегти пароль'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
