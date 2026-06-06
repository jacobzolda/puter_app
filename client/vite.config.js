import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'P.U.T.E.R.',
        short_name: 'PUTER',
        description: 'Personal Utility To Enhance Relaxation',
        theme_color: '#4a7c59',
        background_color: '#f7f7f5',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell: HTML, JS, CSS, and static assets.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Navigate to cached index.html when offline (SPA shell renders; API calls fail gracefully).
        navigateFallback: 'index.html',
        // Never intercept /api/* navigations with the fallback — those must reach the network.
        navigateFallbackDenylist: [/^\/api\//],
        // API routes are network-only: live data only, never stale cache.
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    // Dev mode: proxy /api to the Express backend running separately on 3001.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
