import { useEffect, useMemo, useState } from 'react';
import { AgentFeedPanel } from '../components/AgentFeedPanel';
import { realtimeBus } from '../services/realtime';
import { store } from '../services/store';

export function AlertsPage() {
  const [alerts, setAlerts] = useState(store.alerts);
  const [agentMessages, setAgentMessages] = useState(store.agentMessages);

  useEffect(() => {
    const refreshAlerts = () => setAlerts([...store.alerts]);
    const refreshAgentFeed = () => setAgentMessages([...store.agentMessages]);
    const unsubscribeAlertNew = realtimeBus.on('newAlert', refreshAlerts);
    const unsubscribeAlertUpdated = realtimeBus.on('alertUpdated', refreshAlerts);
    const unsubscribeAgentFeed = realtimeBus.on('agentFeedUpdated', refreshAgentFeed);
    return () => {
      unsubscribeAlertNew();
      unsubscribeAlertUpdated();
      unsubscribeAgentFeed();
    };
  }, []);

  const handleAck = (id: string) => {
    const note = window.prompt('Add an acknowledgement note (optional):') ?? '';
    store.acknowledgeAlert(id, note, 'Jordan Lee');
    setAlerts([...store.alerts]);
  };

  const handleResolve = (id: string) => {
    store.resolveAlert(id);
    setAlerts([...store.alerts]);
  };

  const activeAlerts = useMemo(() => alerts.filter((alert) => alert.status === 'OPEN'), [alerts]);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <h2 className="text-2xl font-display font-semibold text-ink-900">Alerts Command</h2>
        <p className="text-sm text-ink-500">Acknowledge and resolve safety alerts with audit-friendly notes.</p>
        <p className="mt-2 text-xs font-semibold text-ink-600">{activeAlerts.length} active alert(s)</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="space-y-4">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{alert.category.replace('_', ' ')}</p>
                  <p className="text-xs text-ink-500">
                    {alert.roomId ? `Room ${alert.roomId.replace('room-', '')}` : 'No room linked'}
                  </p>
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
          {!alerts.length ? (
            <div className="rounded-2xl border border-dashed border-ink-200 bg-white/80 p-4 text-sm text-ink-500">
              No alerts yet.
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
          <AgentFeedPanel messages={agentMessages} />
        </section>
      </div>
      {!agentMessages.length ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white/80 p-4 text-xs text-ink-500">
          Agent feed updates appear here when monitor signals, room assignment changes, or significant condition changes are detected.
        </div>
      ) : null}
    </div>
  );
}
