import { useEffect, useMemo, useState } from 'react';
import { AlertList } from '../components/AlertList';
import { RoomRow } from '../components/RoomRow';
import { StatCard } from '../components/StatCard';
import { alerts as seedAlerts, beds, rooms } from '../data/mock';
import { realtimeBus } from '../services/realtime';
import { store } from '../services/store';
import { fetchPatients, type PatientRecord } from '../services/patientApi';
import type { Room } from '../types';

export function DoctorDashboard() {
  const [liveAlerts, setLiveAlerts] = useState(seedAlerts);
  const [patients, setPatients] = useState<PatientRecord[]>([]);

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
