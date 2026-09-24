import { describeItem } from './items.js'

const BASE = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const ENDPOINT = `${BASE}/functions/v1/push`
const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}`, apikey: KEY }

export const configured = Boolean(BASE && KEY)

export function pushSupported() {
  return (
    configured && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  )
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
}

export function isIOS() {
  return /iP(hone|ad|od)/.test(navigator.userAgent)
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function getSubscription() {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

// Pide permiso y suscribe este dispositivo. Debe llamarse desde un toque del usuario.
export async function subscribe() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    const err = new Error('Sin permiso para avisos.')
    err.code = permission
    throw err
  }
  const res = await fetch(ENDPOINT, { headers: HEADERS })
  if (!res.ok) throw new Error('No pude conectar con el servidor de avisos.')
  const { publicKey } = await res.json()
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
}

// Manda la agenda completa: el servidor solo conoce nombre + fecha de vencimiento.
export async function syncSchedules(subscription, items) {
  const { endpoint, keys } = subscription.toJSON()
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      endpoint,
      keys,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      schedules: items.map((it) => ({
        itemId: it.id,
        name: it.name,
        dueAt: describeItem(it).dueAt,
      })),
    }),
  })
  if (!res.ok) throw new Error('No pude guardar la agenda de avisos.')
}

export async function unsubscribe(subscription) {
  const { endpoint } = subscription.toJSON()
  await fetch(ENDPOINT, { method: 'DELETE', headers: HEADERS, body: JSON.stringify({ endpoint }) })
  await subscription.unsubscribe()
}

// Muestra una notificación local, sin servidor. Sirve para saber si el
// dispositivo deja mostrar avisos: si esta no aparece, ningún push va a aparecer.
export async function showLocalTest() {
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('Prueba de Nova', {
    body: 'Si ves esto, los avisos se muestran bien.',
    tag: 'nova-test',
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
  })
}
