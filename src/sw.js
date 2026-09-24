/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

self.skipWaiting()
clientsClaim()

// ---- Offline: precache del build + fuentes de Google ----
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

const yearInSeconds = 60 * 60 * 24 * 365
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-css',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: yearInSeconds }),
    ],
  }),
)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-files',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: yearInSeconds }),
    ],
  }),
)

// ---- Push: el servidor manda { title, body, tag, url } ----
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title ?? 'Nova', {
        body: data.body ?? 'Algo ya toca.',
        tag: data.tag ?? 'nova',
        // Si reemplaza un aviso anterior con la misma etiqueta, que igual suene.
        renotify: true,
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        data: { url: data.url ?? '/' },
      })
      // Sin la app abierta no sabemos cuántas cosas vencieron; un punto alcanza.
      if (navigator.setAppBadge) {
        try {
          await navigator.setAppBadge()
        } catch {
          // No soportado en este contexto.
        }
      }
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => 'focus' in w)
      if (open) {
        await open.focus()
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
