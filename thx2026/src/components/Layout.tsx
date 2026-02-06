import { Link, NavLink } from 'react-router-dom';
import { currentUser } from '../data/mock';

const navItems = [
  { path: '/', label: 'Unit Overview' },
  { path: '/admissions', label: 'Admissions & Placement' },
  { path: '/tasks', label: 'Tasks' },
  { path: '/alerts', label: 'Alerts' },
  { path: '/admin', label: 'Admin' }
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent text-ink-950">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-white/70 bg-white/80 backdrop-blur">
          <div className="p-6">
            <Link to="/" className="text-xl font-display font-semibold text-ink-900">
              Hospital Flow
            </Link>
            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-ink-400">Flow Command</p>
          </div>
          <nav className="px-4 pb-6 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'bg-ink-950 text-white shadow-panel'
                      : 'text-ink-700 hover:bg-ink-100/70'
                  }`
                }
              >
                <span>{item.label}</span>
                <span className="text-xs text-ink-300">→</span>
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto border-t border-ink-100 px-6 py-4">
            <div className="text-sm font-medium text-ink-900">{currentUser.name}</div>
            <div className="text-xs text-ink-500">Role: {currentUser.role}</div>
          </div>
        </aside>
        <main className="flex-1">
          <header className="flex flex-col gap-2 border-b border-white/70 bg-white/70 px-8 py-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-500">Live hospital flow command</p>
                <h1 className="text-2xl font-display font-semibold text-ink-950">Operational Dashboard</h1>
              </div>
              <div className="rounded-full bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-600">
                Assistive CV flags require human verification
              </div>
            </div>
            <p className="text-xs text-ink-500">
              HIPAA-sensitive view. Minimize PHI and verify alert context before action.
            </p>
          </header>
          <div className="px-8 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
