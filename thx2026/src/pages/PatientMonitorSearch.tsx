import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { fetchPatients, type PatientRecord } from '../services/patientApi';

export function PatientMonitorSearch() {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const result = await fetchPatients();
      if (active) {
        setPatients(result);
        setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <h2 className="text-2xl font-display font-semibold text-ink-900">Patient Monitor — All Patients</h2>
        <p className="mt-1 text-sm text-ink-500">Select a patient to open the live monitor.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {patients.map((patient) => (
          <Link
            key={patient.id}
            to={`/monitor/${patient.id}`}
            className="block rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel hover:shadow-lg transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-ink-400">Patient</div>
                <div className="mt-1 text-lg font-semibold text-ink-900">{patient.name ?? 'Patient'}</div>
                <div className="mt-1 text-xs text-ink-500">MRN: {patient.mrn}</div>
              </div>
              <div className="text-xs text-ink-500">View</div>
            </div>
          </Link>
        ))}
        {!loading && patients.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink-200 bg-white/80 p-4 text-sm text-ink-500">
            No patients found.
          </div>
        )}
        {loading && (
          <div className="rounded-2xl border border-dashed border-ink-200 bg-white/80 p-4 text-sm text-ink-500">
            Loading patients...
          </div>
        )}
      </section>
    </div>
  );
}

export default PatientMonitorSearch;
