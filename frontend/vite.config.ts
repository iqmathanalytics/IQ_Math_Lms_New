import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc' // 👈 Restored your original SWC plugin

// Production default: /lms/ (www.iqmath.in/lms). Local dev stays at /.
// Override anytime with VITE_BASE_PATH (e.g. VITE_BASE_PATH=/lms/ npm run dev).
function resolveBase(mode: string): string {
  const env = loadEnv(mode, process.cwd(), '')
  const fromEnv = (env.VITE_BASE_PATH || process.env.VITE_BASE_PATH || '').trim()
  if (fromEnv) {
    return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`
  }
  return mode === 'production' ? '/lms/' : '/'
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: resolveBase(mode),
  plugins: [react()],
  server: {
    port: 5173, // ✅ Keeps the port fixed
    hmr: {
      overlay: false, // ✅ Fixes the WebSocket disconnect error
    },
  },
}))