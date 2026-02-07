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
    <div className="min-h-screen px-6 py-12 text-slate-900">
      <div className="mx-auto w-full max-w-4xl gap-6 rounded-[32px] border border-white/80 bg-white/80 p-8 shadow-panel md:grid-cols-[1.1fr_1fr]">
        
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/')}
              className="rounded-full bg-slate-200 px-6 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-300"
            >
              ←
            </button>
            <p className="text-3xl font-semibold uppercase tracking-[0.25em] text-black">Patient Portal</p>
            <div className="w-20"></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                  {documents.length ? `${documents.length} file(s) selected` : ''}
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

          <div className="w-full flex items-center justify-center">
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-ink-900 px-10 py-4 text-sm font-semibold text-white"
            >
              {loading
                ? mode === 'new'
                  ? 'Creating profile…'
                  : 'Signing in…'
                : mode === 'new'
                  ? 'Create profile'
                  : 'Sign in'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
