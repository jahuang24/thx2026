import type { RoomStatus } from '../types';

const statusStyles: Record<RoomStatus, string> = {
  READY: 'bg-forest-500/15 text-forest-600',
  NOT_READY: 'bg-amber-500/15 text-amber-600',
  CLEANING: 'bg-teal-500/15 text-teal-700',
  NEEDS_MAINTENANCE: 'bg-rose-500/15 text-rose-600',
  OCCUPIED: 'bg-ink-100 text-ink-600'
};

export function StatusPill({ status }: { status: RoomStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        statusStyles[status]
      }`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
