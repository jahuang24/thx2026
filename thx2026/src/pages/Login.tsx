import { useNavigate } from 'react-router-dom';
import logo from '../assets/baywatchlogo.png';

export function Login() {
  const navigate = useNavigate();

  const animationStyles = `
    @keyframes sweep {
      0% {
        -webkit-mask-position: 150% 0;
        mask-position: 150% 0;
      }
      100% {
        -webkit-mask-position: -50% 0;
        mask-position: -50% 0;
      }
    }

    .heartbeat-mask {
      /* This mask uses transparency. It does not "paint" a background color. */
      -webkit-mask-image: linear-gradient(
        to right,
        transparent 0%,
        transparent 5%,
        black 15%,
        black 25%,
        transparent 45%,
        transparent 100%
      );
      mask-image: linear-gradient(
        to right,
        transparent 0%,
        transparent 5%,
        black 15%,
        black 25%,
        transparent 45%,
        transparent 100%
      );
      -webkit-mask-size: 200% 100%;
      mask-size: 200% 100%;
      animation: sweep 3s linear infinite;
    }
  `;

  const monitorGreen = '#00C271';

  return (
    /* Removed 'bg-white' to prevent overriding your global background */
    <div className="relative flex min-h-screen flex-col items-center">
      <style>{animationStyles}</style>
      
      <div className="flex flex-grow items-center justify-between gap-20 px-12 text-ink-950">
        <div className="flex items-center">
          <img src={logo} alt="Baywatch Logo" className="w-64" />
          <h1 className="font-display text-8xl font-bold tracking-tight">
            Baywatch
          </h1>
        </div>

        {/* Animation Container - Fully transparent background */}
        <div className="relative flex h-[292px] w-[600px] items-center justify-center bg-transparent">
          
          <p className="pointer-events-none z-10 max-w-sm text-center text-3xl font-medium leading-tight">
            Centralized medical dashboard and patient portal.
          </p>

          <div className="absolute inset-0">
            <svg
              className="heartbeat-mask"
              version="1.0"
              xmlns="http://www.w3.org/2000/svg"
              width="600px"
              height="292px"
              viewBox="0 0 150 73"
              preserveAspectRatio="xMidYMid meet"
              style={{ background: 'transparent' }}
            >
              <polyline
                fill="none"
                stroke={monitorGreen}
                strokeWidth="2.5"
                strokeMiterlimit="10"
                points="0,45.486 38.514,45.486 44.595,33.324 50.676,45.486 57.771,45.486 62.838,55.622 71.959,9 80.067,63.729 84.122,45.486 97.297,45.486 103.379,40.419 110.473,45.486 150,45.486"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="w-full border-t border-white/40 bg-white/30 py-14 backdrop-blur-sm backdrop-saturate-150">
        <div className="flex flex-col items-center justify-center gap-20 px-6 sm:flex-row">
          <button 
            onClick={() => navigate('/doctor-login')}
            className="min-w-[240px] rounded-full bg-ink-900 px-12 py-5 text-lg font-semibold text-white transition-all hover:shadow-[0_0_15px_#ae6bff] active:scale-95"
          >
            Staff Portal
          </button>
          
          <button 
            onClick={() => navigate('/patient-login')}
            className="min-w-[240px] rounded-full border border-ink-200 bg-white px-12 py-5 text-lg font-semibold text-ink-900 transition-all hover:shadow-[0_0_15px_#ae6bff] active:scale-95"
          >
            Patient Portal
          </button>
        </div>
      </div>
    </div>
  );
}