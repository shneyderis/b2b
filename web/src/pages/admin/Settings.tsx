import { Link } from 'react-router-dom';

const cards: Array<{ to: string; title: string; desc: string; icon: string }> = [
  {
    to: '/admin/wines',
    title: 'Вина',
    desc: 'Ціни, залишки, активність у каталозі.',
    icon: '🍷',
  },
  {
    to: '/admin/warehouses',
    title: 'Склади',
    desc: 'Склади, їх Telegram-чати та персонал.',
    icon: '📦',
  },
];

export function AdminSettings() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-burgundy-700">Налаштування</h1>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((c) => (
          <li key={c.to}>
            <Link
              to={c.to}
              className="card flex items-start gap-3 hover:border-burgundy-300 transition-colors"
            >
              <span className="text-3xl shrink-0" aria-hidden>{c.icon}</span>
              <span className="min-w-0">
                <span className="block font-semibold text-burgundy-700">{c.title}</span>
                <span className="block text-sm text-neutral-600 mt-0.5">{c.desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
