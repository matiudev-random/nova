import PocketBase from 'pocketbase'

const URL_BASE = import.meta.env.VITE_PB_URL

export const pbConfigured = Boolean(URL_BASE)

// La sesión queda en localStorage (`pocketbase_auth`), así que sobrevive a recargas
// y funciona sin red hasta que el token vence.
export const pb = new PocketBase(URL_BASE)

// Sin esto, ngrok (plan gratis) contesta con su página de advertencia en vez de la API.
pb.beforeSend = (url, options) => {
  options.headers = { ...options.headers, 'ngrok-skip-browser-warning': '1' }
  return { url, options }
}

// Varias llamadas iguales en paralelo no se cancelan entre sí.
pb.autoCancellation(false)

const MESSAGES = {
  'Failed to authenticate.': 'Email o contraseña incorrectos.',
}

// Mensaje para mostrar a partir de un error del SDK.
export function errorMessage(err) {
  if (!err?.status) return 'No pude conectar con el servidor. Revisá la conexión.'
  const fields = err.response?.data ?? {}
  const first = Object.values(fields)[0]?.message
  const msg = first ?? err.response?.message ?? err.message
  return MESSAGES[msg] ?? msg
}
