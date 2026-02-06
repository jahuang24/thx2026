import { Link } from 'react-router-dom';
import { patients } from '../../data/mock';

export function PatientsIndexPage() {
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
      </div>
    </div>
  );
}
