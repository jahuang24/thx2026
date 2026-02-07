import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setPatientSession } from '../services/patientSession';

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:5050';

export function PatientLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'sign-in' | 'new'>('sign-in');
  const [name, setName] = useState('');
  const [mrn, setMrn] = useState('');
  const [dob, setDob] = useState('');
  const [recordsRequired, setRecordsRequired] = useState(false);
  const [documents, setDocuments] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const needsRecord = mode === 'new' || recordsRequired;
    if (needsRecord && documents.length === 0) {
      setError('Please upload at least one PDF medical document.');
      setLoading(false);
      return;
    }
    const encodeFile = (file: File) =>
      new Promise<{ name: string; type: string; data: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result?.toString() ?? '';
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve({ name: file.name, type: file.type || 'application/pdf', data: base64 });
        };
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsDataURL(file);
      });

    const medicalRecord = needsRecord
      ? {
          notes: notes.trim(),
          documents: documents.length ? await Promise.all(documents.map(encodeFile)) : []
        }
      : undefined;

    try {
      const response = await fetch(`${API_BASE}/patients/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), mrn: mrn.trim(), dob: dob || null, medicalRecord })
      });

      if (response.status === 409) {
        setRecordsRequired(true);
        setMode('new');
        setError('We could not find that record. Please create a new patient profile.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const message = await response.text();
        setError(message || 'Unable to sign in. Please check your details.');
        setLoading(false);
        return;
      }

      const patient = await response.json();
      setPatientSession({
        id: patient._id ?? patient.id,
        name: patient.name,
        mrn: patient.mrn,
        dob: patient.dob ?? null
      });
      navigate('/patient-portal');
    } catch {
      setError('Unable to reach the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f3f7ff,_#ffffff_55%,_#f7fafc)] px-6 py-12 text-slate-900">
      <div className="mx-auto grid w-full max-w-4xl gap-6 rounded-[32px] border border-slate-200 bg-white/90 p-8 shadow-xl md:grid-cols-[1.05fr_1fr]">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Patient Portal</p>
          <h1 className="text-3xl font-semibold text-slate-900">Welcome to your bedside care</h1>
          <p className="text-sm text-slate-600">
            Sign in to see messages from your care team and share your health record.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-500">
            First-time patients must provide basic medical records to help your care team.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-600">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('sign-in');
                  setRecordsRequired(false);
                  setError(null);
                }}
                className={`rounded-full px-3 py-2 text-xs font-semibold ${
                  mode === 'sign-in'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                Returning patient
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('new');
                  setRecordsRequired(true);
                  setError(null);
                }}
                className={`rounded-full px-3 py-2 text-xs font-semibold ${
                  mode === 'new'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                New patient
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Full name</label>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Medical Record Number (MRN)</label>
            <input
              required
              value={mrn}
              onChange={(event) => setMrn(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              placeholder="MRN-2451"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Date of birth</label>
            <input
              type="date"
              value={dob}
              onChange={(event) => setDob(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            />
          </div>

          {recordsRequired && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Medical record</p>
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Upload PDFs (medical documents)
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    setDocuments(files);
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {documents.length ? `${documents.length} file(s) selected` : 'No files selected'}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  placeholder="Anything else you want the care team to know."
                />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            {loading
              ? mode === 'new'
                ? 'Creating profile…'
                : 'Signing in…'
              : mode === 'new'
                ? 'Create profile'
                : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
