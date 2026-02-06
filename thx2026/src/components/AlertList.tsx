import type { Alert } from '../types';

const severityStyles: Record<Alert['severity'], string> = {
  LOW: 'bg-ink-100 text-ink-600',
  MEDIUM: 'bg-amber-500/15 text-amber-600',
  HIGH: 'bg-rose-500/15 text-rose-600'
};

export function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div key={alert.id} className="rounded-xl border border-ink-100 bg-white/90 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-900">{alert.category.replace('_', ' ')}</p>
              <p className="text-xs text-ink-500">Room {alert.roomId?.replace('room-', '')}</p>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${severityStyles[alert.severity]}`}
            >
              {alert.severity}
            </span>
          </div>
          <p className="mt-2 text-xs text-ink-500">{alert.notes ?? 'No notes recorded.'}</p>
          <div className="mt-3 text-xs text-ink-400">Status: {alert.status}</div>
        </div>
      ))}
    </div>
  );
}
