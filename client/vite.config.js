import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function noCacheLoginAssets() {
  return {
    name: 'no-cache-login-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.split('?')[0].match(/\/login\/[^/]+\.(jpe?g|png|webp)$/i)) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), noCacheLoginAssets()],
  server: {
    host: true,
    port: parseInt(process.env.PORT || '5173'),
    // Avoid stale images in embedded / cached dev browsers
    headers: {
      'Cache-Control': 'no-store',
    },
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
});
