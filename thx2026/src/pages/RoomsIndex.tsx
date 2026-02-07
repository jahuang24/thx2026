import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { rooms } from '../data/mock';
import { StatusPill } from '../components/StatusPill';
import type { RoomStatus } from '../types';
import floorplanImg from '../assets/bigger_floorplan.png';

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
      // top outer row
      { roomId: 'room-500', label: '500', points: [[0.55, 0.14], [0.55, 0.24], [0.605, 0.24], [0.605, 0.14]] },
      { roomId: 'room-501', label: '501', points: [[0.605, 0.14], [0.605, 0.24], [0.66, 0.24], [0.66, 0.14]] },
      { roomId: 'room-502', label: '502', points: [[0.66, 0.14], [0.66, 0.24], [0.715, 0.24], [0.715, 0.14]] },
      { roomId: 'room-503', label: '503', points: [[0.715, 0.14], [0.715, 0.24], [0.77, 0.24], [0.77, 0.14]] },
      { roomId: 'room-504', label: '504', points: [[0.77, 0.14], [0.77, 0.24], [0.825, 0.24], [0.825, 0.14]] },
      { roomId: 'room-505', label: '505', points: [[0.825, 0.14], [0.825, 0.24], [0.88, 0.24], [0.88, 0.14]] },
      { roomId: 'room-506', label: '506', points: [[0.88, 0.14], [0.88, 0.24], [0.935, 0.24], [0.935, 0.14]] },
      { roomId: 'room-510', label: '510', points: [[0.935, 0.14], [0.935, 0.24], [0.99, 0.24], [0.99, 0.14]] },

      // inner top rooms
      { roomId: 'room-507', label: '507', points: [[0.55, 0.28], [0.55, 0.36], [0.62, 0.36], [0.62, 0.28]] },
      { roomId: 'room-508', label: '508', points: [[0.62, 0.28], [0.62, 0.36], [0.69, 0.36], [0.69, 0.28]] },
      { roomId: 'room-509', label: '509', points: [[0.69, 0.28], [0.69, 0.36], [0.76, 0.36], [0.76, 0.28]] },

      // second row
      { roomId: 'room-520', label: '520', points: [[0.74, 0.36], [0.74, 0.44], [0.80, 0.44], [0.80, 0.36]] },
      { roomId: 'room-521', label: '521', points: [[0.80, 0.36], [0.80, 0.44], [0.86, 0.44], [0.86, 0.36]] },
      { roomId: 'room-522', label: '522', points: [[0.86, 0.36], [0.86, 0.44], [0.92, 0.44], [0.92, 0.36]] },
      { roomId: 'room-523', label: '523', points: [[0.92, 0.36], [0.92, 0.44], [0.98, 0.44], [0.98, 0.36]] },

      // central cluster
      { roomId: 'room-407', label: '407', points: [[0.70, 0.48], [0.70, 0.56], [0.78, 0.56], [0.78, 0.48]] },
      { roomId: 'room-408', label: '408', points: [[0.78, 0.48], [0.78, 0.56], [0.86, 0.56], [0.86, 0.48]] },
      { roomId: 'room-409', label: '409', points: [[0.66, 0.56], [0.66, 0.64], [0.74, 0.64], [0.74, 0.56]] },
      { roomId: 'room-420', label: '420', points: [[0.74, 0.56], [0.74, 0.64], [0.82, 0.64], [0.82, 0.56]] },
      { roomId: 'room-411', label: '411', points: [[0.82, 0.56], [0.82, 0.64], [0.90, 0.64], [0.90, 0.56]] },
      { roomId: 'room-413', label: '413', points: [[0.82, 0.64], [0.82, 0.72], [0.90, 0.72], [0.90, 0.64]] },
      { roomId: 'room-415', label: '415', points: [[0.70, 0.64], [0.70, 0.74], [0.82, 0.74], [0.82, 0.64]] },

      // right vertical stack
      { roomId: 'room-332', label: '332', points: [[0.94, 0.34], [0.94, 0.42], [0.99, 0.42], [0.99, 0.34]] },
      { roomId: 'room-333', label: '333', points: [[0.94, 0.42], [0.94, 0.50], [0.99, 0.50], [0.99, 0.42]] },
      { roomId: 'room-334', label: '334', points: [[0.94, 0.58], [0.94, 0.66], [0.99, 0.66], [0.99, 0.58]] },
      { roomId: 'room-343', label: '343', points: [[0.94, 0.74], [0.94, 0.82], [0.99, 0.82], [0.99, 0.74]] },
      { roomId: 'room-335', label: '335', points: [[0.86, 0.50], [0.86, 0.58], [0.94, 0.58], [0.94, 0.50]] },
      { roomId: 'room-342', label: '342', points: [[0.86, 0.66], [0.86, 0.74], [0.94, 0.74], [0.94, 0.66]] },

      // angled west wing
      { roomId: 'room-805', label: '805', points: [[0.47, 0.28], [0.52, 0.34], [0.49, 0.40], [0.44, 0.34]] },
      { roomId: 'room-804', label: '804', points: [[0.44, 0.34], [0.49, 0.40], [0.45, 0.46], [0.40, 0.40]] },
      { roomId: 'room-810', label: '810', points: [[0.40, 0.40], [0.45, 0.46], [0.41, 0.52], [0.36, 0.46]] },
      { roomId: 'room-813', label: '813', points: [[0.36, 0.46], [0.41, 0.52], [0.37, 0.58], [0.32, 0.52]] },
      { roomId: 'room-812', label: '812', points: [[0.32, 0.52], [0.37, 0.58], [0.33, 0.64], [0.28, 0.58]] },
      { roomId: 'room-831', label: '831', points: [[0.28, 0.58], [0.33, 0.64], [0.29, 0.70], [0.24, 0.64]] },
      { roomId: 'room-818', label: '818', points: [[0.33, 0.64], [0.38, 0.70], [0.34, 0.76], [0.29, 0.70]] },
      { roomId: 'room-816', label: '816', points: [[0.38, 0.70], [0.43, 0.76], [0.39, 0.82], [0.34, 0.76]] },
      { roomId: 'room-806', label: '806', points: [[0.43, 0.76], [0.48, 0.82], [0.44, 0.88], [0.39, 0.82]] },
      { roomId: 'room-885', label: '885', points: [[0.24, 0.70], [0.29, 0.76], [0.21, 0.88], [0.16, 0.82]] },
      { roomId: 'room-899', label: '899', points: [[0.29, 0.76], [0.41, 0.76], [0.41, 0.92], [0.29, 0.92]] },
      { roomId: 'room-850', label: '850', points: [[0.41, 0.76], [0.56, 0.76], [0.56, 0.92], [0.41, 0.92]] },

      // bottom/right strip
      { roomId: 'room-346', label: '346', points: [[0.74, 0.90], [0.81, 0.90], [0.81, 0.98], [0.74, 0.98]] },
      { roomId: 'room-347', label: '347', points: [[0.81, 0.90], [0.88, 0.90], [0.88, 0.98], [0.81, 0.98]] },
      { roomId: 'room-ER', label: 'EMERGENCY ROOM', points: [[0.64, 0.86], [0.74, 0.86], [0.74, 0.98], [0.64, 0.98]] },
      { roomId: 'room-VACANT', label: 'VACANT ROOM', points: [[0.88, 0.90], [0.98, 0.90], [0.98, 0.98], [0.88, 0.98]] }
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
            src={floorplanImg}
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
