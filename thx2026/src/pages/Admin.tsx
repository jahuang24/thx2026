import { rooms, units } from '../data/mock';

export function AdminPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <h2 className="text-2xl font-display font-semibold text-ink-900">Admin Config</h2>
        <p className="text-sm text-ink-500">Manage units, rooms, beds, and access roles.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
          <h3 className="text-lg font-display font-semibold text-ink-900">Units</h3>
          <div className="mt-4 space-y-3">
            {units.map((unit) => (
              <div key={unit.id} className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
                <p className="text-sm font-semibold text-ink-900">{unit.name}</p>
                <p className="text-xs text-ink-500">Floor {unit.floor}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
          <h3 className="text-lg font-display font-semibold text-ink-900">Rooms</h3>
          <div className="mt-4 space-y-3">
            {rooms.map((room) => (
              <div key={room.id} className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Room {room.roomNumber}</p>
                    <p className="text-xs text-ink-500">{room.type}</p>
                  </div>
                  <button className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
