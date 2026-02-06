import { rooms } from '../data/mock';
import { Link } from 'react-router-dom';
import { StatusPill } from '../components/StatusPill';

export function RoomsIndexPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <h2 className="text-2xl font-display font-semibold text-ink-900">Rooms</h2>
        <p className="text-sm text-ink-500">All unit rooms with readiness states.</p>
      </header>
      <div className="space-y-3">
        {rooms.map((room) => (
          <div key={room.id} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-900">Room {room.roomNumber}</p>
                <p className="text-xs text-ink-500">{room.type}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={room.status} />
                <Link
                  className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700"
                  to={`/rooms/${room.id}`}
                >
                  View
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
