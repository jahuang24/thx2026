import { useParams } from 'react-router-dom';
import { alerts, beds, patients, tasks } from '../data/mock';

export function PatientDetailPage() {
  const { patientId } = useParams();
  const patient = patients.find((item) => item.id === patientId);
  const patientAlerts = alerts.filter((alert) => alert.patientId === patientId);
  const patientTasks = tasks.filter((task) => task.patientId === patientId);
  const bed = beds.find((item) => item.id === patient?.bedId);

  if (!patient) {
    return <div className="rounded-2xl bg-white/80 p-6">Patient not found.</div>;
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-400">Patient</p>
        <h2 className="text-2xl font-display font-semibold text-ink-900">{patient.name ?? 'Patient Record'}</h2>
        <p className="text-sm text-ink-500">MRN: {patient.mrn} • Acuity: {patient.acuityLevel}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
            <h3 className="text-lg font-display font-semibold text-ink-900">Risk Flags</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
                <p className="text-xs text-ink-500">Fall risk</p>
                <p className="text-sm font-semibold text-ink-900">{patient.fallRisk ? 'Yes' : 'No'}</p>
              </div>
              <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
                <p className="text-xs text-ink-500">Mobility risk</p>
                <p className="text-sm font-semibold text-ink-900">{patient.mobilityRisk}</p>
              </div>
              <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
                <p className="text-xs text-ink-500">Acuity</p>
                <p className="text-sm font-semibold text-ink-900">{patient.acuityLevel}</p>
              </div>
              <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
                <p className="text-xs text-ink-500">Assigned bed</p>
                <p className="text-sm font-semibold text-ink-900">{bed ? `${bed.roomId} ${bed.bedLabel}` : 'Unassigned'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
            <h3 className="text-lg font-display font-semibold text-ink-900">Notes</h3>
            <p className="mt-3 text-sm text-ink-600">{patient.notes ?? 'No notes recorded.'}</p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
            <h3 className="text-lg font-display font-semibold text-ink-900">Active Alerts</h3>
            <div className="mt-4 space-y-3">
              {patientAlerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
                  <p className="text-sm font-semibold text-ink-900">{alert.category.replace('_', ' ')}</p>
                  <p className="text-xs text-ink-500">Severity: {alert.severity}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
            <h3 className="text-lg font-display font-semibold text-ink-900">Active Tasks</h3>
            <div className="mt-4 space-y-3">
              {patientTasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
                  <p className="text-sm font-semibold text-ink-900">{task.type}</p>
                  <p className="text-xs text-ink-500">Status: {task.status}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
