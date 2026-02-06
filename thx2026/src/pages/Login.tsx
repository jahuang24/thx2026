import { useNavigate } from 'react-router-dom';

export function LoginPage() {
  const navigate = useNavigate();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="grid w-full max-w-4xl gap-6 rounded-3xl border border-white/80 bg-white/80 p-8 shadow-panel md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-400">Hospital Flow Dashboard</p>
          <h1 className="text-3xl font-display font-semibold text-ink-950">Clinician Command Center</h1>
          <p className="text-sm text-ink-500">
            Secure access for doctors, charge nurses, and EVS teams. CV alerts are assistive and must be verified
            by a human before action.
          </p>
          <div className="rounded-2xl border border-ink-100 bg-ink-50/60 p-4 text-xs text-ink-500">
            HIPAA-sensitive system. Role-based access controls and audit logging enabled.
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-ink-600">Email</label>
            <input
              required
              type="email"
              className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm"
              placeholder="name@hospital.org"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-600">Password</label>
            <input
              required
              type="password"
              className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm"
              placeholder="••••••••"
            />
          </div>
          <button className="w-full rounded-full bg-ink-900 px-4 py-3 text-sm font-semibold text-white">
            Sign in
          </button>
          <p className="text-[11px] text-ink-400">
            This MVP uses mock auth. Production will use secure SSO + MFA.
          </p>
        </form>
      </div>
    </div>
  );
}
