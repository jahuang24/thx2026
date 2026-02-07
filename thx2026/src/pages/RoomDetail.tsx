import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertList } from '../components/AlertList';
import { StatusPill } from '../components/StatusPill';
import { alerts, beds, cvEvents, rooms, tasks } from '../data/mock';
import { fetchPatients, type PatientRecord } from '../services/patientApi';

export function RoomDetailPage() {
  const { roomId } = useParams();
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const room = rooms.find((item) => item.id === roomId);
  const roomBeds = beds.filter((bed) => bed.roomId === roomId);

  const roomTasks = tasks.filter((task) => task.roomId === roomId);
  const roomEvents = cvEvents.filter((event) => event.roomId === roomId);
  const roomAlerts = alerts.filter((alert) => alert.roomId === roomId);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const result = await fetchPatients();
      if (active) {
        setPatients(result);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const patientByBedId = useMemo(() => {
    const map = new Map<string, PatientRecord>();
    for (const patient of patients) {
      if (patient.bedId) {
        map.set(patient.bedId, patient);
      }
    }
    return map;
  }, [patients]);

  const patientById = useMemo(() => {
    const map = new Map<string, PatientRecord>();
    for (const patient of patients) {
      map.set(patient.id, patient);
    }
    return map;
  }, [patients]);

  const roomBedsWithOccupants = useMemo(
    () =>
      roomBeds.map((bed) => {
        const occupant = patientByBedId.get(bed.id) ?? (bed.patientId ? patientById.get(bed.patientId) : undefined);
        return {
          bed,
          occupant,
          occupied: Boolean(occupant) || bed.occupied
        };
      }),
    [patientByBedId, patientById, roomBeds]
  );

  const timeline = useMemo(() => {
    return [
      {
        label: 'ADD ROOM TIMELINE ITEMS',
        time: '2h ago'
      }
    ];
  }, []);

  if (!room) {
    return <div className="rounded-2xl bg-white/80 p-6">Room not found.</div>;
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-400">Room</p>
            <h2 className="text-2xl font-display font-semibold text-ink-900">{room.roomNumber}</h2>
            <p className="text-sm text-ink-500">{room.type.replace('_', ' ')} • {room.unitId}</p>
          </div>
          <StatusPill status={room.status} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
            <p className="text-xs text-ink-500">Last cleaned</p>
            <p className="text-sm font-semibold text-ink-900">{room.lastCleanedAt ? new Date(room.lastCleanedAt).toLocaleString() : 'N/A'}</p>
          </div>
          <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
            <p className="text-xs text-ink-500">Maintenance flags</p>
            <p className="text-sm font-semibold text-ink-900">
              {room.maintenanceFlags.length > 0 ? room.maintenanceFlags.join(', ') : 'None'}
            </p>
          </div>
          <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
            <p className="text-xs text-ink-500">Readiness reasons</p>
            <p className="text-sm font-semibold text-ink-900">
              {room.readinessReasons.length > 0 ? room.readinessReasons.join(', ') : 'Ready'}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
            <h3 className="text-lg font-display font-semibold text-ink-900">Beds</h3>
            <div className="mt-4 space-y-3">
              {roomBedsWithOccupants.map(({ bed, occupant, occupied }) => (
                <div key={bed.id} className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">Bed {bed.bedLabel}</p>
                      <p className="text-xs text-ink-500">{occupied ? 'Occupied' : 'Available'}</p>
                      {occupant ? (
                        <p className="text-xs text-ink-600">Patient: {occupant.name || occupant.mrn}</p>
                      ) : null}
                    </div>
                    {occupant ? (
                      <Link
                        to={`/monitor/${occupant.id}`}
                        className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700"
                      >
                        Open monitor
                      </Link>
                    ) : (
                      <button className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700">
                        Assign
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
            <h3 className="text-lg font-display font-semibold text-ink-900">Room Timeline</h3>
            <div className="mt-4 space-y-3">
              {timeline.map((item) => (
                <div key={item.label} className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
                  <p className="text-sm font-semibold text-ink-900">{item.label}</p>
                  <p className="text-xs text-ink-500">{item.time}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
            <h3 className="text-lg font-display font-semibold text-ink-900">Open Alerts</h3>
            <div className="mt-4">
              <AlertList alerts={roomAlerts} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
            <h3 className="text-lg font-display font-semibold text-ink-900">Recent CV Events</h3>
            <div className="mt-4 space-y-3">
              {roomEvents.map((event) => (
                <div key={event.id} className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
                  <p className="text-sm font-semibold text-ink-900">{event.eventType.replace('_', ' ')}</p>
                  <p className="text-xs text-ink-500">Confidence {Math.round(event.confidence * 100)}%</p>
                  <p className="text-xs text-ink-400">{new Date(event.capturedAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <h3 className="text-lg font-display font-semibold text-ink-900">Active Tasks</h3>
        <div className="mt-4 space-y-3">
          {roomTasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{task.type}</p>
                  <p className="text-xs text-ink-500">Status: {task.status}</p>
                </div>
                <button className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700">
                  Update
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
