import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

const tgUrl = import.meta.env.VITE_MANAGER_TELEGRAM_URL as string | undefined;
const waUrl = import.meta.env.VITE_MANAGER_WHATSAPP_URL as string | undefined;

export function Layout() {
  const { role, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const navLinkCls = ({ isActive }: { isActive: boolean }) =>
    `h-12 flex items-center px-3 text-sm font-medium rounded-lg ${
      isActive ? 'bg-burgundy-700 text-white' : 'text-burgundy-700 hover:bg-burgundy-100'
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10 no-print">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-burgundy-700 text-xl font-bold tracking-tight">Winery</span>
            <span className="text-neutral-400 text-sm">B2B</span>
          </div>
          <button onClick={handleLogout} className="h-10 px-3 rounded-lg text-sm text-burgundy-700 hover:bg-burgundy-100">
            Вийти
          </button>
        </div>
        {role === 'partner' && (
          <nav className="max-w-3xl mx-auto px-4 pb-2 flex gap-2 overflow-x-auto no-print">
            <NavLink to="/orders" className={navLinkCls}>Замовлення</NavLink>
            <NavLink to="/orders/new" className={navLinkCls}>Нове замовлення</NavLink>
            <NavLink to="/profile" className={navLinkCls}>Профіль</NavLink>
          </nav>
        )}
        {role === 'admin' && (
          <nav className="max-w-5xl mx-auto px-4 pb-2 flex gap-2 overflow-x-auto no-print">
            <NavLink to="/admin/orders" className={navLinkCls}>Замовлення</NavLink>
            <NavLink to="/admin/wines" className={navLinkCls}>Вина</NavLink>
            <NavLink to="/admin/partners" className={navLinkCls}>Партнери</NavLink>
          </nav>
        )}
      </header>

      <main className={`flex-1 w-full mx-auto px-4 py-4 ${role === 'admin' ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <Outlet />
      </main>

      {role === 'partner' && (tgUrl || waUrl) && (
        <footer className="bg-white border-t border-neutral-200 sticky bottom-0 no-print">
          <div className="max-w-3xl mx-auto px-4 py-3 flex gap-2">
            {tgUrl && (
              <a
                href={tgUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-12 flex items-center justify-center rounded-lg bg-burgundy-700 text-white font-medium"
              >
                Менеджер у Telegram
              </a>
            )}
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-12 flex items-center justify-center rounded-lg border border-burgundy-700 text-burgundy-700 font-medium"
              >
                WhatsApp
              </a>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
