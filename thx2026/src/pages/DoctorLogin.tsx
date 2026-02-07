import { useNavigate } from 'react-router-dom';

export function DoctorLogin() {
  const navigate = useNavigate();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    navigate('/doctor-dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-4xl gap-6 rounded-3xl border border-white/80 bg-white/80 p-8 shadow-panel md:grid-cols-[1.1fr_1fr]">

        <p className="text-3xl font-semibold uppercase tracking-[0.25em] text-black pb-4 text-center">Hospital Portal</p>

        <form onSubmit={handleSubmit} className="space-y-4 flex flex-col items-center">
          <div className="w-full">
            <label className="text-xs font-semibold text-ink-600">Email</label>
            <input
              required
              type="email"
              className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm"
              placeholder="name@hospital.org"
            />
          </div>
          <div className="w-full">
            <label className="text-xs font-semibold text-ink-600">Password</label>
            <input
              required
              type="password"
              className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm"
              placeholder="••••••••"
            />
          </div>

          <button className="mt-8 rounded-full bg-ink-900 px-10 py-4 text-sm font-semibold text-white">
            Sign in
          </button>

        </form>
      </div>
    </div>
  );
}
