import { useMemo, useState } from 'react';
import { beds, rooms, units } from '../data/mock';
import type { RoomType } from '../types';

export function AdminPage() {
  const capacityByRoom = useMemo(() => {
    const map = new Map<string, number>();
    beds.forEach((bed) => {
      map.set(bed.roomId, (map.get(bed.roomId) ?? 0) + 1);
    });
    return map;
  }, []);

  const [roomConfigs, setRoomConfigs] = useState(() =>
    rooms.map((room) => ({
      id: room.id,
      purpose: room.type as RoomType,
      capacity: capacityByRoom.get(room.id) ?? 1
    }))
  );

  const updateRoomConfig = (roomId: string, patch: Partial<{ purpose: RoomType; capacity: number }>) => {
    setRoomConfigs((prev) =>
      prev.map((config) =>
        config.id === roomId ? { ...config, ...patch } : config
      )
    );
  };

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
            {rooms.map((room) => {
              const config = roomConfigs.find((item) => item.id === room.id);
              return (
                <div key={room.id} className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">Room {room.roomNumber}</p>
                      <p className="text-xs text-ink-500">Unit {room.unitId}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="text-xs font-semibold text-ink-600">
                        Purpose
                        <select
                          value={config?.purpose ?? room.type}
                          onChange={(event) =>
                            updateRoomConfig(room.id, { purpose: event.target.value as RoomType })
                          }
                          className="ml-2 rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-900"
                        >
                          <option value="ICU">ICU</option>
                          <option value="MED_SURG">Med Surg</option>
                          <option value="OBS">Observation</option>
                          <option value="ISOLATION">Isolation</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-ink-600">
                        Capacity
                        <input
                          type="number"
                          min={1}
                          max={8}
                          value={config?.capacity ?? capacityByRoom.get(room.id) ?? 1}
                          onChange={(event) =>
                            updateRoomConfig(room.id, {
                              capacity: Number(event.target.value || 1)
                            })
                          }
                          className="ml-2 w-20 rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-900"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
