/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b0f17',
          900: '#121827',
          800: '#1a2233',
          700: '#24324a',
          600: '#2d3f5c',
          500: '#3f526e',
          400: '#5f738f',
          300: '#8aa0b8',
          200: '#b7c6d7',
          100: '#dce5ef'
        },
        slateBlue: {
          700: '#2e3f5f',
          600: '#3a4c6e',
          500: '#4a5f84'
        },
        teal: {
          700: '#0f766e',
          600: '#0d9488',
          500: '#14b8a6'
        },
        amber: {
          600: '#d97706',
          500: '#f59e0b'
        },
        rose: {
          600: '#e11d48',
          500: '#f43f5e'
        },
        forest: {
          600: '#15803d',
          500: '#22c55e'
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        panel: '0 14px 30px rgba(15, 23, 42, 0.12)'
      }
    }
  },
  plugins: []
};
