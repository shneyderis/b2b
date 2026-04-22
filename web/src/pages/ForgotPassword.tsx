import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api('/auth/forgot-password', { body: { email: email.trim() } });
    } catch {
      // Backend always returns 200 even when the email is unknown. We
      // surface the same confirmation to the user either way — don't
      // leak which addresses are registered.
    }
    setSent(true);
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm card">
        <h1 className="text-2xl font-bold text-burgundy-700 mb-1">Скидання паролю</h1>

        {sent ? (
          <>
            <p className="text-sm text-neutral-600 mt-2">
              Якщо такий обліковий запис існує та привʼязаний до Telegram, ми надішлемо
              посилання для скидання паролю в чат з ботом. Посилання діє 30 хвилин.
            </p>
            <p className="text-xs text-neutral-500 mt-3">
              Немає Telegram? Зверніться до менеджера — він згенерує новий пароль.
            </p>
            <Link to="/login" className="btn-secondary mt-4 inline-flex items-center justify-center w-full">
              Повернутись до входу
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-neutral-600 mb-4">
              Введіть email. Ми надішлемо посилання в Telegram-бота — потрібно, щоб ваш
              обліковий запис вже був привʼязаний до Telegram.
            </p>
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-neutral-600">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? 'Надсилаємо…' : 'Надіслати посилання'}
              </button>
              <Link to="/login" className="text-sm text-center text-neutral-600 hover:text-burgundy-700">
                ← Повернутись до входу
              </Link>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
