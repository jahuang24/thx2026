import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export function Login() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col items-center">
      
      <div className="flex flex-grow flex-col items-center justify-center px-6 text-center text-ink-950">
          <h1 className="text-8xl font-display font-bold tracking-tigh p-12">
            Baywatch
          </h1>
          <p className="mx-auto text-2xl">
            Centralized medical dashboard and patient portal.
          </p>
      </div>

      {/* Bottom Banner with Glassy Effect */}
      <div className="w-full border-t border-white/40 bg-white/30 py-14 backdrop-blur-sm backdrop-saturate-150">
        <div className="flex flex-col items-center justify-center gap-20 px-6 sm:flex-row">

          <button
            onClick={() => navigate('/doctor-login')}
            className="min-w-[240px] rounded-full bg-ink-900 px-12 py-5 text-lg font-semibold text-white transition-all hover:bg-ink-800 hover:shadow-2xl active:scale-95 shadow-xl"
          >
            Hospital Portal
          </button>
          
          <button
            onClick={() => navigate('/patient-login')}
            className="min-w-[240px] rounded-full border border-ink-200 bg-white px-12 py-5 text-lg font-semibold text-ink-900 transition-all hover:bg-ink-50 hover:shadow-2xl active:scale-95 shadow-xl"
          >
            Patient Portal
          </button>
        </div>
      </div>
    </div>
  );
}