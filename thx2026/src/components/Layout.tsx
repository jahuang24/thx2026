import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
// Standard Lucide imports
import { 
  LayoutDashboard, 
  Stethoscope,
  UserPlus, 
  ClipboardList, 
  MessageSquare, 
  AlertTriangle, 
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { currentUser } from '../data/mock';
import { realtimeBus } from '../services/realtime';
import { store } from '../services/store';

export function Layout({ children, pageTitle }: { children: React.ReactNode; pageTitle?: string }) {
  const [messages, setMessages] = useState(store.messages);
  const [alerts, setAlerts] = useState(store.alerts);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const unsubscribeNew = realtimeBus.on('newMessage', () => setMessages([...store.messages]));
    const unsubscribeUpdated = realtimeBus.on('messageUpdated', () =>
      setMessages([...store.messages])
    );
    const unsubscribeAlertNew = realtimeBus.on('newAlert', () => setAlerts([...store.alerts]));
    const unsubscribeAlertUpdated = realtimeBus.on('alertUpdated', () => setAlerts([...store.alerts]));
    return () => {
      unsubscribeNew();
      unsubscribeUpdated();
      unsubscribeAlertNew();
      unsubscribeAlertUpdated();
    };
  }, []);

  const unreadMessages = useMemo(
    () => messages.filter((message) => message.sender === 'PATIENT' && !message.readByNurse).length,
    [messages]
  );
  const activeAlerts = useMemo(
    () => alerts.filter((alert) => alert.status === 'OPEN').length,
    [alerts]
  );

  const navItems = [
    { path: '/doctor-dashboard', label: 'Unit Overview', icon: LayoutDashboard },
    { path: '/triage-board', label: 'Triage Board', icon: Stethoscope },
    { path: '/admissions', label: 'Admissions & Placement', icon: UserPlus },
    { path: '/tasks', label: 'Tasks', icon: ClipboardList },
    { path: '/messages', label: 'Patient Messages', icon: MessageSquare, badge: unreadMessages },
    { path: '/alerts', label: 'Alerts', icon: AlertTriangle, badge: activeAlerts },
    { path: '/admin', label: 'Admin', icon: Settings }
  ];

  return (
    <div className="creative-shell text-ink-950">
      <div className="creative-backdrop" aria-hidden />
      <div className="creative-grid">
        <aside className={`nav-rail nav-rail--fixed flex flex-col transition-[width] duration-300 ease-in-out ${
          sidebarOpen ? 'w-72' : 'w-20'
        }`}>
          <div className="flex h-full flex-col overflow-hidden">
            <div className="p-6">
              <Link to="/" className="flex items-center gap-3 text-xl font-semibold text-ink-900">
                <div className="min-w-[34px] h-9 rounded-2xl bg-ink-950 text-white text-xs flex items-center justify-center tracking-[0.2em]">
                  HF
                </div>
                {sidebarOpen && <span className="nav-brand whitespace-nowrap">Hospital Flow</span>}
              </Link>
            </div>

            <nav className="px-4 pb-6 space-y-2">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `nav-link flex items-center gap-4 text-sm ${
                        isActive ? 'nav-link--active text-ink-950' : 'text-ink-700'
                      }`
                    }
                  >
                    <IconComponent size={20} className="flex-shrink-0" />
                    
                    {sidebarOpen && (
                      <div className="flex flex-1 items-center justify-between whitespace-nowrap overflow-hidden">
                        <span>{item.label}</span>
                        {item.badge && item.badge > 0 && (
                          <span className="ml-2 rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-600">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </nav>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="toggle-rail mt-auto flex items-center justify-center p-4 text-ink-700 transition-all duration-300 ease-in-out"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
          </div>
        </aside>

        <main
          className={`main-rail flex-1 transition-[padding-left] duration-300 ease-in-out ${
            sidebarOpen ? 'pl-72' : 'pl-20'
          }`}
        >
          <header className="page-header px-8 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-ink-400">Operational Atlas</p>
                <h1 className="font-display font-semibold text-ink-950">
                  {pageTitle}
                </h1>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-ink-900">{currentUser.name}</div>
                <div className="text-xs text-ink-500">{currentUser.role}</div>
              </div>
            </div>
          </header>
          <div className="px-8 py-6">{children}</div>
        </main>
      </div>

    </div>
  );
}
