import { useState } from 'react';
import { store } from '../services/store';

export function AlertsPage() {
  const [alerts, setAlerts] = useState(store.alerts);

  const handleAck = (id: string) => {
    const note = window.prompt('Add an acknowledgement note (optional):') ?? '';
    store.acknowledgeAlert(id, note, 'Jordan Lee');
    setAlerts([...store.alerts]);
  };

  const handleResolve = (id: string) => {
    store.resolveAlert(id);
    setAlerts([...store.alerts]);
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <h2 className="text-2xl font-display font-semibold text-ink-900">Alerts Command</h2>
        <p className="text-sm text-ink-500">Acknowledge and resolve safety alerts with audit-friendly notes.</p>
      </header>

      <div className="space-y-4">
        {alerts.map((alert) => (
          <div key={alert.id} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-900">{alert.category.replace('_', ' ')}</p>
                <p className="text-xs text-ink-500">Room {alert.roomId?.replace('room-', '')}</p>
                <p className="text-xs text-ink-500">Status: {alert.status}</p>
              </div>
              <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600">
                {alert.severity}
              </span>
            </div>
            <p className="mt-3 text-xs text-ink-500">{alert.notes}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {alert.status !== 'ACK' && (
                <button
                  onClick={() => handleAck(alert.id)}
                  className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700"
                >
                  Acknowledge
                </button>
              )}
              {alert.status !== 'RESOLVED' && (
                <button
                  onClick={() => handleResolve(alert.id)}
                  className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700"
                >
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
