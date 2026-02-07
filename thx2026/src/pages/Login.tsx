import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export function Login() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center">
      {/* This pushes the banner to the bottom */}
      <div className="flex-grow" />

      {/* Bottom Banner with Blur - Increased padding to py-20 and blur to xl */}
      <div className="w-full border-t border-white/30 bg-white/20 py-16 backdrop-blur-xl">
        {/* Increased gap between buttons */}
        <div className="flex flex-col items-center justify-center gap-16 px-6 sm:flex-row">
          <button
            onClick={() => navigate('/doctor-login')}
            className="min-w-[200px] rounded-full bg-ink-900 px-12 py-5 text-lg font-semibold text-white transition hover:bg-ink-800 shadow-xl"
          >
            Doctor Login
          </button>
          
          <button
            onClick={() => navigate('/patient-login')}
            className="min-w-[200px] rounded-full border border-ink-200 bg-white px-12 py-5 text-lg font-semibold text-ink-900 transition hover:bg-ink-50 shadow-xl"
          >
            Patient Portal
          </button>
        </div>
      </div>
    </div>
  );
}