import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';

export function Register() {
  const [company_name, setCompany] = useState('');
  const [contact_name, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/auth/register', {
        body: { company_name, contact_name, phone, email, password },
      });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setError('Цей email вже зареєстровано.');
        else if (err.status === 400) setError('Перевірте поля форми.');
        else setError('Помилка реєстрації. Спробуйте ще раз.');
      } else {
        setError('Немає зв’язку з сервером.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm card text-center">
          <h1 className="text-2xl font-bold text-burgundy-700 mb-3">Заявку надіслано</h1>
          <p className="text-neutral-700 mb-4">
            Чекайте схвалення менеджером. Ми повідомимо вас, коли акаунт буде активовано.
          </p>
          <Link to="/login" className="btn-primary inline-flex items-center justify-center">
            На сторінку входу
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm card">
        <h1 className="text-2xl font-bold text-burgundy-700 mb-4">Реєстрація</h1>
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
            <input type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-600">Пароль</span>
            <input type="password" autoComplete="new-password" minLength={6} className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div className="text-sm text-burgundy-700 bg-burgundy-50 border border-burgundy-100 rounded-lg p-2">{error}</div>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Надсилання…' : 'Надіслати заявку'}
          </button>
        </form>
        <div className="mt-4 text-sm text-center text-neutral-600">
          Вже маєте акаунт?{' '}
          <Link to="/login" className="text-burgundy-700 font-medium">Увійти</Link>
        </div>
      </div>
    </div>
  );
}
