import { useMemo, useState, useEffect } from 'react';
import { beds, rooms } from '../data/mock';
import { recommendBeds } from '../logic/recommendation';
import type { RecommendationScore, Room } from '../types';
import { fetchPatients, updatePatientAssignment, type PatientRecord } from '../services/patientApi';
import {
  ensureAdmissionsQueue,
  fetchAdmissions,
  updateAdmissionStatus,
  type AdmissionRecord
} from '../services/admissionsApi';

export function AdmissionsPage() {
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [selectedAdmission, setSelectedAdmission] = useState<AdmissionRecord | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationScore[]>([]);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [assigningBedId, setAssigningBedId] = useState<string | null>(null);

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

  useEffect(() => {
    let active = true;
    const load = async () => {
      await ensureAdmissionsQueue();
      const result = await fetchAdmissions();
      if (active) {
        setAdmissions(result);
        if (!selectedAdmission && result.length) {
          setSelectedAdmission(result[0]);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [selectedAdmission]);

  const pendingAdmissions = useMemo(
    () => admissions.filter((admission) => admission.admitStatus === 'PENDING'),
    [admissions]
  );

  const derivedBeds = useMemo(() => {
    const occupiedByBed = new Map<string, string>();
    patients.forEach((patient) => {
      if (patient.bedId) {
        occupiedByBed.set(patient.bedId, patient.id);
      }
    });
    return beds.map((bed) => ({
      ...bed,
      occupied: occupiedByBed.has(bed.id),
      patientId: occupiedByBed.get(bed.id) ?? null
    }));
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

  const handleRecommend = (admission: AdmissionRecord) => {
    setSelectedAdmission(admission);
    const enrichedPatients = patients.map((patient) => ({
      ...patient,
      acuityLevel: 'LOW',
      mobilityRisk: 'LOW',
      fallRisk: false,
      unitId: 'unit-1'
    }));
    setRecommendations(recommendBeds(admission as any, derivedRooms, derivedBeds as any, enrichedPatients as any));
  };

  const handleAssign = async (admission: AdmissionRecord, recommendation: RecommendationScore) => {
    if (assigningBedId) return;
    if (!admission.patientId) return;
    setAssigningBedId(recommendation.bedId);
    const assignedAt = new Date().toISOString();
    const success = await updatePatientAssignment(admission.patientId, {
      roomId: recommendation.roomId,
      bedId: recommendation.bedId
    });
    if (success) {
      await updateAdmissionStatus(admission.id, { admitStatus: 'ASSIGNED', assignedAt });
      const [nextAdmissions, nextPatients] = await Promise.all([fetchAdmissions(), fetchPatients()]);
      setAdmissions(nextAdmissions);
      setPatients(nextPatients);
      setRecommendations([]);
      setSelectedAdmission(null);
    }
    setAssigningBedId(null);
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <h2 className="text-2xl font-display font-semibold text-ink-900">Admissions & Placement</h2>
        <p className="text-sm text-ink-500">Transparent recommendations with explainable scoring.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-display font-semibold text-ink-900">Pending Admissions</h3>
            <span className="text-xs text-ink-400">{pendingAdmissions.length} waiting</span>
          </div>
          <div className="mt-4 space-y-3">
            {pendingAdmissions.map((admission) => {
              const patient = patients.find((item) => item.id === admission.patientId);
              return (
                <button
                  key={admission.id}
                  onClick={() => handleRecommend(admission)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedAdmission?.id === admission.id
                      ? 'border-ink-900 bg-ink-900 text-white'
                      : 'border-ink-100 bg-white/90 text-ink-900 hover:border-ink-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{patient?.name ?? 'Patient'}</p>
                      <p className="text-xs opacity-80">Request: {admission.requestedType}</p>
                    </div>
                    <span className="text-xs">{new Date(admission.requestedAt).toLocaleTimeString()}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
          <h3 className="text-lg font-display font-semibold text-ink-900">Placement Recommendation</h3>
          {selectedAdmission ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
                <p className="text-xs text-ink-500">Selected admission</p>
                <p className="text-sm font-semibold text-ink-900">{selectedAdmission.id}</p>
              </div>
              {recommendations.length === 0 ? (
                <button
                  onClick={() => handleRecommend(selectedAdmission)}
                  className="w-full rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Recommend placement
                </button>
              ) : (
                <div className="space-y-3">
                  {recommendations.slice(0, 3).map((rec) => (
                    <div key={rec.bedId} className="rounded-xl border border-ink-100 bg-white/90 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-ink-900">Bed {rec.bedId}</p>
                          <p className="text-xs text-ink-500">Room {rec.roomId.replace('room-', '')}</p>
                        </div>
                        <span className="text-xs font-semibold text-ink-600">Score {rec.totalScore}</span>
                      </div>
                      <ul className="mt-3 text-xs text-ink-500">
                        {rec.rationale.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                      <button
                        className="mt-3 rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700 disabled:opacity-60"
                        onClick={() => selectedAdmission && handleAssign(selectedAdmission, rec)}
                        disabled={assigningBedId === rec.bedId}
                      >
                        {assigningBedId === rec.bedId ? 'Assigning...' : 'Assign'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-500">Select a pending admission to view recommendations.</p>
          )}
        </section>
      </div>
    </div>
  );
}
