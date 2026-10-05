/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Official iQmath logo palette */
        iqBlue: '#0088C7',
        iqBlueDark: '#006FA3',
        iqBlueLight: '#D6F0FA',
        iqGreen: '#8DC63F',
        iqGreenDark: '#6FA32E',
        iqGreenLight: '#EAF6D4',
        iqSlate: '#1E293B',
        iqMuted: '#64748B',
        canvas: '#F5F9FF',
        surface: '#FFFFFF',
        surfaceMuted: '#F5F9FF',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 24px -4px rgba(59, 130, 246, 0.10), 0 2px 8px -2px rgba(30, 41, 59, 0.04)',
        card: '0 8px 30px -8px rgba(30, 41, 59, 0.08)',
        lift: '0 16px 40px -12px rgba(59, 130, 246, 0.16)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.4s ease-out',
        'float-slow': 'floatSlow 8s ease-in-out infinite',
        'float-slower': 'floatSlower 12s ease-in-out infinite',
        'auth-grid-drift': 'authGridDrift 28s linear infinite',
        'auth-spin-slow': 'authSpinSlow 8s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '50%': { transform: 'translate(12px, -18px)' },
        },
        floatSlower: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '50%': { transform: 'translate(-16px, 14px)' },
        },
        authGridDrift: {
          '0%': { backgroundPosition: '0 0, 0 0' },
          '100%': { backgroundPosition: '48px 48px, 48px 48px' },
        },
        authSpinSlow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
}
