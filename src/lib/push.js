import { pb, pbConfigured } from './pb.js'

// Avisos por PocketBase: el servidor ya tiene los ítems de la cuenta, así que el
// dispositivo solo se anota (endpoint + claves + zona horaria).
const BASE = '/api/nova/push'

export const configured = pbConfigured

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

function sameKey(buffer, base64) {
  if (!buffer) return false
  const a = new Uint8Array(buffer)
  const b = urlBase64ToUint8Array(base64)
  return a.length === b.length && a.every((x, i) => x === b[i])
}

async function serverKey() {
  try {
    const { publicKey } = await pb.send(`${BASE}/key`, {})
    return publicKey
  } catch {
    throw new Error('No pude conectar con el servidor de avisos.')
  }
}

export async function getSubscription() {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

// La suscripción del navegador, hecha con la clave actual del servidor. Si se
// había hecho con otra (la de Supabase, o el servidor regeneró sus claves),
// se rehace: con una clave vieja los avisos nunca llegarían.
export async function currentSubscription() {
  const sub = await getSubscription()
  if (!sub) return null
  const key = await serverKey()
  if (sameKey(sub.options?.applicationServerKey, key)) return sub
  await sub.unsubscribe()
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  })
}

// Pide permiso y suscribe este dispositivo. Debe llamarse desde un toque del usuario.
export async function subscribe() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    const err = new Error('Sin permiso para avisos.')
    err.code = permission
    throw err
  }
  const existing = await currentSubscription()
  if (existing) return existing
  const key = await serverKey()
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  })
}

// Anota (o actualiza) este dispositivo en la cuenta con la que se entró.
export async function register(subscription) {
  const { endpoint, keys } = subscription.toJSON()
  try {
    await pb.send(`${BASE}/subscription`, {
      method: 'POST',
      body: { endpoint, keys, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    })
  } catch {
    throw new Error('No pude anotar este dispositivo para los avisos.')
  }
}

export async function unsubscribe(subscription) {
  const { endpoint } = subscription.toJSON()
  await pb.send(`${BASE}/subscription`, { method: 'DELETE', body: { endpoint } })
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
