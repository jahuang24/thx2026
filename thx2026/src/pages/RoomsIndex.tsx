import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { rooms } from '../data/mock';
import { StatusPill } from '../components/StatusPill';
import type { RoomStatus } from '../types';

type FloorplanSlot = {
  roomId: string;
  label: string;
  points: [number, number][];
};

const statusFills: Record<RoomStatus, string> = {
  READY: 'rgba(59, 130, 246, 0.78)',
  NOT_READY: 'rgba(245, 158, 11, 0.78)',
  CLEANING: 'rgba(20, 184, 166, 0.78)',
  NEEDS_MAINTENANCE: 'rgba(244, 63, 94, 0.78)',
  OCCUPIED: 'rgba(100, 116, 139, 0.7)'
};

export function RoomsIndexPage() {
  const navigate = useNavigate();
  const floorplanRooms: FloorplanSlot[] = useMemo(
    () => [
      { roomId: 'room-401', label: '401', points: [[0.524578, 0.346939], [0.524578, 0.260544], [0.333456, 0.261224], [0.380044, 0.346939]] },
      { roomId: 'room-402', label: '402', points: [[0.526412, 0.260544], [0.526412, 0.347619], [0.668012, 0.347619], [0.668012, 0.260544]] },
      { roomId: 'room-403', label: '403', points: [[0.669479, 0.260544], [0.669479, 0.347619], [0.811079, 0.347619], [0.811079, 0.260544]] },
      { roomId: 'room-404', label: '404', points: [[0.812546, 0.260544], [0.812546, 0.347619], [0.954879, 0.347619], [0.954879, 0.260544]] },
      { roomId: 'room-405', label: '405', points: [[0.330888, 0.266667], [0.245415, 0.42381], [0.290536, 0.508844], [0.376009, 0.35102]] },
      { roomId: 'room-406', label: '406', points: [[0.396185, 0.382993], [0.396185, 0.492517], [0.524945, 0.492517], [0.524945, 0.382993]] },
      { roomId: 'room-407', label: '407', points: [[0.526412, 0.382993], [0.526412, 0.492517], [0.668012, 0.492517], [0.668012, 0.382993]] },
      { roomId: 'room-408', label: '408', points: [[0.669479, 0.382993], [0.669479, 0.492517], [0.811079, 0.492517], [0.811079, 0.382993]] },
      { roomId: 'room-409', label: '409', points: [[0.812913, 0.382993], [0.812913, 0.492517], [0.954512, 0.492517], [0.954512, 0.382993]] },
      { roomId: 'room-410', label: '410', points: [[0.392517, 0.387075], [0.309611, 0.540816], [0.337858, 0.595238], [0.392517, 0.495238]] },
      { roomId: 'room-411', label: '411', points: [[0.243947, 0.427211], [0.158474, 0.585034], [0.203595, 0.669388], [0.289068, 0.512245]] },
      { roomId: 'room-412', label: '412', points: [[0.308144, 0.543537], [0.220836, 0.704762], [0.24945, 0.758503], [0.336757, 0.597279]] },
      { roomId: 'room-413', label: '413', points: [[0.15774, 0.588435], [0.069332, 0.751701], [0.114453, 0.836054], [0.202861, 0.672789]] },
      { roomId: 'room-414', label: '414', points: [[0.219736, 0.708163], [0.132795, 0.868707], [0.161042, 0.922449], [0.248349, 0.761905]] }
    ],
    []
  );

  const labels = floorplanRooms.map((slot) => {
    const centroid = slot.points.reduce(
      (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
      [0, 0]
    );
    return {
      roomId: slot.roomId,
      label: slot.label,
      x: centroid[0] / slot.points.length,
      y: centroid[1] / slot.points.length
    };
  });

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-semibold text-ink-900">Room Allocation</h2>
            <p className="text-sm text-ink-500">Click a room to open its details.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-100 bg-white px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> Ready
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-100 bg-white px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-teal-500" /> Cleaning
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-100 bg-white px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Not ready
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-100 bg-white px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-slate-400" /> Occupied
            </span>
          </div>
        </div>
      </header>

      <section className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-panel">
        <div className="relative aspect-[2726/1470] w-full">
          <img
            src="/Floorplan.png"
            alt="Hospital floorplan"
            className="absolute inset-0 h-full w-full object-contain"
          />
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
            {floorplanRooms.map((slot) => {
              const room = rooms.find((item) => item.id === slot.roomId);
              if (!room) return null;
              const points = slot.points.map((point) => `${point[0]},${point[1]}`).join(' ');
              return (
                <g
                  key={room.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/rooms/${room.id}`)}
                >
                  <polygon
                    points={points}
                    fill={statusFills[room.status]}
                    stroke="rgba(255,255,255,0.75)"
                    strokeWidth="0.003"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={labels.find((label) => label.roomId === slot.roomId)?.x ?? 0}
                    y={labels.find((label) => label.roomId === slot.roomId)?.y ?? 0}
                    fill="#ffffff"
                    fontSize="0.02"
                    fontWeight="600"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {slot.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
      </section>
    </div>
  );
}
