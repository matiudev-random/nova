import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // `npm run dev:tunnel` publica el dev server vía Cloudflare Tunnel.
  // Vite bloquea hosts desconocidos por defecto; acá habilitamos el del túnel
  // y hacemos que el HMR (hot reload) hable por wss en el 443 en vez del 5173.
  server:
    mode === 'tunnel'
      ? {
          host: true,
          allowedHosts: ['.trycloudflare.com'],
          hmr: { clientPort: 443 },
        }
      : undefined,
  // `npm run preview:tunnel` sirve el build de producción por el mismo túnel.
  preview:
    mode === 'tunnel'
      ? { host: true, port: 5173, strictPort: true, allowedHosts: ['.trycloudflare.com'] }
      : undefined,
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'nova-mark.svg'],
      manifest: {
        id: '/',
        name: 'Nova — seguimiento de última vez',
        short_name: 'Nova',
        description:
          'Llevá la cuenta de las cosas que no son del día a día: cuándo cambiaste las sábanas, el cepillo de dientes o el filtro del agua.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#FFFFFF',
        background_color: '#FFFFFF',
        categories: ['lifestyle', 'productivity', 'utilities'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // Service worker propio (src/sw.js): precache + push. El generado no recibe push.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      // Permite probar el service worker con `npm run dev`, no solo en build.
      devOptions: { enabled: true, type: 'module', navigateFallback: 'index.html' },
    }),
  ],
}))
