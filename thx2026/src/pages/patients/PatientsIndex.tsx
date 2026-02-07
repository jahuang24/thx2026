import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { fetchPatients, type PatientRecord } from '../../services/patientApi';

export function PatientsIndexPage() {
  const [patients, setPatients] = useState<PatientRecord[]>([]);

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

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <h2 className="text-2xl font-display font-semibold text-ink-900">Patients</h2>
        <p className="text-sm text-ink-500">Role-limited PHI. Open patient detail for full view.</p>
      </header>
      <div className="space-y-3">
        {patients.map((patient) => (
          <div key={patient.id} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-900">{patient.name ?? 'Patient'}</p>
                <p className="text-xs text-ink-500">MRN: {patient.mrn}</p>
              </div>
              <Link
                className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700"
                to={`/patients/${patient.id}`}
              >
                View
              </Link>
            </div>
          </div>
        ))}
        {patients.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink-200 bg-white/80 p-4 text-sm text-ink-500">
            No patients found.
          </div>
        )}
      </div>
    </div>
  );
}
