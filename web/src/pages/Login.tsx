import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ApiError } from '../api';

export function Login() {
  const { login, isTelegram, tgAuthStatus, token } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (token) navigate('/', { replace: true });
  }, [token, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403 && err.data?.error === 'partner_not_approved') {
          setError('Заявка ще не схвалена менеджером.');
        } else if (err.status === 401) {
          setError('Невірний email або пароль.');
        } else {
          setError('Помилка входу. Спробуйте ще раз.');
        }
      } else {
        setError('Немає зв’язку з сервером.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (isTelegram) {
    return <TelegramFlow />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm card">
        <h1 className="text-2xl font-bold text-burgundy-700 mb-4">Вхід</h1>
        {tgAuthStatus === 'error' && (
          <div className="mb-3 text-sm text-burgundy-700 bg-burgundy-50 border border-burgundy-100 rounded-lg p-2">
            Не вдалося увійти через Telegram. Скористайтеся email та паролем.
          </div>
        )}
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
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-600">Пароль</span>
            <input
              type="password"
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <div className="text-sm text-burgundy-700 bg-burgundy-50 border border-burgundy-100 rounded-lg p-2">{error}</div>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Вхід…' : 'Увійти'}
          </button>
        </form>
        <div className="mt-4 text-sm text-center text-neutral-600">
          Ще не маєте акаунту?{' '}
          <Link to="/register" className="text-burgundy-700 font-medium">Реєстрація</Link>
        </div>
      </div>
    </div>
  );
}

function TelegramFlow() {
  const { tgAuthStatus, onboardTelegram, token } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) navigate('/', { replace: true });
  }, [token, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onboardTelegram(companyName.trim(), phone.trim());
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403 && err.data?.error === 'partner_not_approved') {
          // status already reflected via tgAuthStatus
        } else if (err.status === 400 && err.data?.error === 'invalid_phone') {
          setError('Невірний формат телефону.');
        } else {
          setError('Не вдалося надіслати заявку. Спробуйте ще раз.');
        }
      } else {
        setError('Немає зв’язку з сервером.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm card">
        {(tgAuthStatus === 'pending' || tgAuthStatus === 'idle') && (
          <>
            <h1 className="text-2xl font-bold text-burgundy-700 mb-2">Вхід…</h1>
            <p className="text-sm text-neutral-600">Перевіряємо ваш обліковий запис.</p>
          </>
        )}

        {tgAuthStatus === 'not_approved' && (
          <>
            <h1 className="text-2xl font-bold text-burgundy-700 mb-2">Заявка прийнята</h1>
            <p className="text-sm text-neutral-600">
              Очікуйте на підтвердження менеджера. Після схвалення відкрийте Mini App знову.
            </p>
          </>
        )}

        {tgAuthStatus === 'error' && (
          <>
            <h1 className="text-2xl font-bold text-burgundy-700 mb-2">Помилка</h1>
            <p className="text-sm text-neutral-600">
              Не вдалося увійти через Telegram. Спробуйте пізніше або зверніться до менеджера.
            </p>
          </>
        )}

        {tgAuthStatus === 'not_linked' && (
          <>
            <h1 className="text-2xl font-bold text-burgundy-700 mb-2">Ласкаво просимо</h1>
            <p className="text-sm text-neutral-600 mb-4">
              Заповніть заявку, щоб отримати доступ до каталогу.
            </p>
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-neutral-600">Назва закладу</span>
                <input
                  className="input"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  maxLength={255}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-neutral-600">Телефон</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+380…"
                  required
                />
              </label>
              {error && (
                <div className="text-sm text-burgundy-700 bg-burgundy-50 border border-burgundy-100 rounded-lg p-2">
                  {error}
                </div>
              )}
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? 'Надсилаємо…' : 'Надіслати заявку'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
