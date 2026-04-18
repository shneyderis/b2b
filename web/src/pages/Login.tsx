import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ApiError } from '../api';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm card">
        <h1 className="text-2xl font-bold text-burgundy-700 mb-4">Вхід</h1>
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
