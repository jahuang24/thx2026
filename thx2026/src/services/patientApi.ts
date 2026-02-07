const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:5050';

export type PatientRecord = {
  id: string;
  name: string;
  mrn: string;
  dob?: string | null;
};

export async function fetchPatients(): Promise<PatientRecord[]> {
  const response = await fetch(`${API_BASE}/patients`);
  if (!response.ok) return [];
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data.map((item) => ({
    id: item._id ?? item.id,
    name: item.name ?? 'Patient',
    mrn: item.mrn ?? '',
    dob: item.dob ?? null
  }));
}
