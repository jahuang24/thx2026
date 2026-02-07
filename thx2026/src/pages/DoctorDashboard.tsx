import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertList } from '../components/AlertList';
import { RoomRow } from '../components/RoomRow';
import { StatusPill } from '../components/StatusPill';
import { StatCard } from '../components/StatCard';
import { alerts as seedAlerts, beds, rooms } from '../data/mock';
import { realtimeBus } from '../services/realtime';
import { store } from '../services/store';
import { fetchPatients, type PatientRecord } from '../services/patientApi';
import type { Room, RoomStatus } from '../types';

type FloorplanSlot = {
  roomId: string;
  label: string;
  points: [number, number][];
};

const statusFills: Record<RoomStatus, { color: string; opacity: number }> = {
  READY: { color: '#e1f4e7', opacity: 1 },
  NOT_READY: { color: '#f59e0b', opacity: 0.75 },
  CLEANING: { color: '#14b8a6', opacity: 0.75 },
  NEEDS_MAINTENANCE: { color: '#f43f5e', opacity: 0.75 },
  OCCUPIED: { color: '#dce5ef', opacity: 1 }
};

export function DoctorDashboard() {
  const navigate = useNavigate();
  const [liveAlerts, setLiveAlerts] = useState(seedAlerts);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = realtimeBus.on('newAlert', ({ alert }) => {
      setLiveAlerts((prev) => [alert as typeof prev[number], ...prev]);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const result = await fetchPatients();
      if (active) setPatients(result);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const derivedBeds = useMemo(() => {
    const occupiedByBed = new Map<string, string>();
    const occupiedByRoom = new Map<string, string[]>();
    patients.forEach((patient) => {
      if (patient.bedId) {
        occupiedByBed.set(patient.bedId, patient.id);
        return;
      }
      if (patient.roomId) {
        const list = occupiedByRoom.get(patient.roomId) ?? [];
        list.push(patient.id);
        occupiedByRoom.set(patient.roomId, list);
      }
    });

    const nextBeds = beds.map((bed) => ({
      ...bed,
      occupied: occupiedByBed.has(bed.id),
      patientId: occupiedByBed.get(bed.id) ?? null
    }));

    occupiedByRoom.forEach((patientIds, roomId) => {
      patientIds.forEach((patientId) => {
        const target = nextBeds.find((bed) => bed.roomId === roomId && !bed.occupied);
        if (target) {
          target.occupied = true;
          target.patientId = patientId;
        }
      });
    });

    return nextBeds;
  }, [patients]);

  const derivedRooms = useMemo<Room[]>(() => {
    const roomOccupancy = new Map<string, { occupied: number; total: number }>();
    derivedBeds.forEach((bed) => {
      const entry = roomOccupancy.get(bed.roomId) ?? { occupied: 0, total: 0 };
      entry.total += 1;
      if (bed.occupied) entry.occupied += 1;
      roomOccupancy.set(bed.roomId, entry);
    });

    return rooms.map((room): Room => {
      const occupancy = roomOccupancy.get(room.id);
      const isFull = occupancy ? occupancy.occupied >= occupancy.total && occupancy.total > 0 : false;
      return {
        ...room,
        status: isFull ? 'OCCUPIED' : 'READY',
        maintenanceFlags: [],
        readinessReasons: []
      };
    });
  }, [derivedBeds]);

  const stats = useMemo(() => {
    const readyRooms = derivedRooms.filter((room) => room.status === 'READY').length;
    const cleaningRooms = derivedRooms.filter((room) => room.status === 'CLEANING').length;
    const occupiedBeds = derivedBeds.filter((bed) => bed.occupied).length;
    const occupancyRate = Math.round((occupiedBeds / derivedBeds.length) * 100);

    return {
      occupancyRate,
      readyRooms,
      cleaningRooms,
      openAlerts: store.alerts.filter((alert) => alert.status === 'OPEN').length
    };
  }, [derivedBeds, derivedRooms]);

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

  const labels = useMemo(() => {
    return floorplanRooms.map((slot) => {
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
  }, [floorplanRooms]);

  const hoveredRoom = useMemo(
    () => (hoveredRoomId ? derivedRooms.find((room) => room.id === hoveredRoomId) : null),
    [derivedRooms, hoveredRoomId]
  );

  const hoveredLabel = useMemo(
    () => (hoveredRoomId ? labels.find((label) => label.roomId === hoveredRoomId) : null),
    [hoveredRoomId, labels]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Occupancy"
          value={`${stats.occupancyRate}%`}
          hint="Live bed utilization"
          accent="bg-slateBlue-600/10 text-slateBlue-700"
          icon={<span className="text-lg">▣</span>}
        />
        <StatCard
          label="Rooms Ready"
          value={`${stats.readyRooms}`}
          hint="Immediate placement"
          accent="bg-forest-500/10 text-forest-600"
          icon={<span className="text-lg">✓</span>}
        />
        <StatCard
          label="Rooms Cleaning"
          value={`${stats.cleaningRooms}`}
          hint="EVS in progress"
          accent="bg-teal-500/10 text-teal-700"
          icon={<span className="text-lg">✧</span>}
        />
        <StatCard
          label="Open Alerts"
          value={`${stats.openAlerts}`}
          hint="Operational safety" 
          accent="bg-rose-500/10 text-rose-600"
          icon={<span className="text-lg">!</span>}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2.3fr_1fr]">
        <section className="space-y-3">
          <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-semibold text-ink-900">Unit Floorplan</h2>
              <span className="text-xs text-ink-400">Click a room to open</span>
            </div>
            <div className="mt-4 relative aspect-[2726/1470] w-full">
              <img
                src="/Floorplan.png"
                alt="Hospital floorplan"
                className="absolute inset-0 h-full w-full object-contain"
              />
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
                {floorplanRooms.map((slot) => {
                  const room = derivedRooms.find((item) => item.id === slot.roomId);
                  if (!room) return null;
                  const points = slot.points.map((point) => `${point[0]},${point[1]}`).join(' ');
                  const fill = statusFills[room.status];
                  return (
                    <g
                      key={room.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/rooms/${room.id}`)}
                      onPointerEnter={() => setHoveredRoomId(room.id)}
                      onPointerLeave={() => setHoveredRoomId(null)}
                    >
                      <polygon
                        points={points}
                        fill="transparent"
                        stroke="transparent"
                        strokeWidth="0.025"
                        vectorEffect="non-scaling-stroke"
                      />
                      <polygon
                        points={points}
                        fill={fill.color}
                        fillOpacity={fill.opacity}
                        stroke="rgba(255,255,255,0.75)"
                        strokeWidth="0.003"
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="pointer-events-none absolute inset-0">
                {labels.map((label) => (
                  <span
                    key={label.roomId}
                    className="absolute -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-ink-950"
                    style={{ left: `${label.x * 100}%`, top: `${label.y * 100}%` }}
                  >
                    {label.label}
                  </span>
                ))}
              </div>
              {hoveredRoom && hoveredLabel && (
                <div
                  className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[110%] rounded-2xl border border-white/70 bg-white/95 p-3 text-xs text-ink-700 shadow-xl"
                  style={{ left: `${hoveredLabel.x * 100}%`, top: `${hoveredLabel.y * 100}%` }}
                >
                  <p className="text-sm font-semibold text-ink-900">Room {hoveredRoom.roomNumber}</p>
                  <p className="text-xs text-ink-500">{hoveredRoom.type.replace('_', ' ')} • {hoveredRoom.unitId}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <StatusPill status={hoveredRoom.status} />
                    <span className="text-[11px] text-ink-400">Click to open</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold text-ink-900">Unit Rooms</h2>
            <button className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700">
              Filter
            </button>
          </div>
          <div className="space-y-3">
            {derivedRooms.map((room) => (
              <RoomRow key={room.id} room={room} beds={derivedBeds} patients={patients as any} />
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-semibold text-ink-900">Live Alerts</h2>
              <span className="text-xs text-ink-400">Updated in real-time</span>
            </div>
            <div className="mt-4 max-h-[360px] overflow-y-auto pr-2 scrollbar-thin">
              <AlertList alerts={liveAlerts} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
