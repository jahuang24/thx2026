import { useNavigate } from 'react-router-dom';

export function Login() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8 rounded-3xl border border-white/80 bg-white/80 p-8 shadow-panel text-center">
        <h1 className="text-3xl font-display font-semibold text-ink-950">Welcome</h1>
        <button
          onClick={() => navigate('/doctor-login')}
          className="w-full rounded-full bg-ink-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink-800"
        >
          Doctor Login
        </button>
        <button
          onClick={() => navigate('/patient-portal')}
          className="w-full rounded-full border border-ink-200 bg-white px-4 py-3 text-sm font-semibold text-ink-900 transition hover:bg-ink-50"
        >
          Patient Portal
        </button>
      </div>
    </div>
  );
}
