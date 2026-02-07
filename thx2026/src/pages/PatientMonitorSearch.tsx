import React from 'react';
import { Link } from 'react-router-dom';
import { patients } from '../data/mock';

export function PatientMonitorSearch() {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <h2 className="text-2xl font-display font-semibold text-ink-900">Patient Monitor — All Patients</h2>
        <p className="mt-1 text-sm text-ink-500">Select a patient to open the live monitor.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {patients.map((p) => (
          <Link
            key={p.id}
            to={`/monitor/${p.id}`}
            className="block rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel hover:shadow-lg transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-ink-400">{'Room'}</div>
                <div className="mt-1 text-lg font-semibold text-ink-900">{p.name}</div>
              </div>
              <div className="text-xs text-ink-500">View</div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}

export default PatientMonitorSearch;
