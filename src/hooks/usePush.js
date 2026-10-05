import { useEffect, useRef, useState } from 'react'
import {
  currentSubscription,
  getSubscription,
  pushSupported,
  register,
  subscribe,
  unsubscribe,
} from '../lib/push.js'

// status: 'unsupported' | 'loading' | 'off' | 'enabling' | 'on' | 'denied'
export function usePush(user) {
  const [status, setStatus] = useState(() => (pushSupported() ? 'loading' : 'unsupported'))
  const subRef = useRef(null)
  const userId = user?.id ?? null

  useEffect(() => {
    if (status !== 'loading') return
    getSubscription()
      .then((sub) => {
        subRef.current = sub
        if (sub) setStatus('on')
        else setStatus(Notification.permission === 'denied' ? 'denied' : 'off')
      })
      .catch(() => setStatus('off'))
  }, [status])

  // Con sesión y avisos activos: se vuelve a anotar el dispositivo (por si cambió
  // la cuenta, la zona horaria o la clave del servidor). Sin red, queda para la próxima.
  useEffect(() => {
    if (status !== 'on' || !userId) return
    let cancelled = false
    currentSubscription()
      .then(async (sub) => {
        if (cancelled || !sub) return
        subRef.current = sub
        await register(sub)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [status, userId])

  async function enable() {
    if (status === 'enabling') return { ok: false, message: 'Ya estoy en eso.' }
    setStatus('enabling')
    try {
      // Si el navegador ya tiene una suscripción válida, se reutiliza: nunca dos por dispositivo.
      const sub = await subscribe()
      subRef.current = sub
      await register(sub)
      setStatus('on')
      return { ok: true }
    } catch (err) {
      setStatus(err.code === 'denied' ? 'denied' : 'off')
      return { ok: false, message: err.message }
    }
  }

  async function disable() {
    if (subRef.current) {
      try {
        await unsubscribe(subRef.current)
      } catch {
        // Si el servidor no responde, igual se desuscribe localmente.
        await subRef.current.unsubscribe().catch(() => {})
      }
    }
    subRef.current = null
    setStatus('off')
  }

  return { status, enable, disable }
}
