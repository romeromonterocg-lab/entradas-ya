import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, Vite hace de "Nginx": /api/<servicio>/... -> servicio (sin el prefijo).
// payments y notifications NO se exponen.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const ruta = (destino, prefijo) => ({
    target: destino,
    changeOrigin: true,
    rewrite: (p) => p.replace(new RegExp(`^/api/${prefijo}`), ''),
  });
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api/auth': ruta(env.DEV_AUTH_URL || 'http://localhost:3001', 'auth'),
        '/api/events': ruta(env.DEV_EVENTS_URL || 'http://localhost:3002', 'events'),
        '/api/tickets': ruta(env.DEV_TICKETS_URL || 'http://localhost:3004', 'tickets'),
        '/api/orders': ruta(env.DEV_ORDERS_URL || 'http://localhost:3006', 'orders'),
        '/api/checkin': ruta(env.DEV_CHECKIN_URL || 'http://localhost:3007', 'checkin'),
      },
    },
  };
});
