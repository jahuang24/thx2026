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
    <div className="min-h-screen bg-transparent text-ink-950">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className={`border-r border-white/70 bg-white/80 backdrop-blur flex flex-col transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'w-72' : 'w-20'
        }`}>
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-6">
              <Link to="/doctor-dashboard" className="flex items-center gap-3 text-xl font-display font-semibold text-ink-900">
                <div className="min-w-[32px] h-8 bg-ink-950 rounded-lg flex items-center justify-center text-white text-xs">
                  HF
                </div>
                {sidebarOpen && <span className="whitespace-nowrap">Hospital Flow</span>}
              </Link>
            </div>

            <nav className="px-4 pb-24 space-y-1">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-ink-950 text-white shadow-panel'
                          : 'text-ink-700 hover:bg-ink-100/70'
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
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <header className="flex flex-col gap-2 border-b border-white/70 bg-white/70 px-8 py-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-display font-semibold text-ink-950">
                Operational Dashboard {'> '} {pageTitle}
              </h1>
              <div className="text-right">
                <div className="text-sm font-medium text-ink-900">{currentUser.name}</div>
                <div className="text-xs text-ink-500">{currentUser.role}</div>
              </div>
            </div>
          </header>
          <div className="px-8 py-6">{children}</div>
        </main>
      </div>

      {/* Sliding Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`fixed bottom-0 left-0 z-50 flex items-center justify-center border-t border-r border-ink-100 p-4 text-ink-700 hover:bg-ink-100/70 bg-white/80 backdrop-blur transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'w-72' : 'w-20'
        }`}
        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
      >
        {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>
    </div>
  );
}
