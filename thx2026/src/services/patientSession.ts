const SESSION_KEY = 'thx.patient.session.v1';

export type PatientSession = {
  id: string;
  name: string;
  mrn: string;
  dob?: string | null;
};

export const getPatientSession = (): PatientSession | null => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PatientSession;
  } catch {
    return null;
  }
};

export const setPatientSession = (session: PatientSession) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearPatientSession = () => {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
};
