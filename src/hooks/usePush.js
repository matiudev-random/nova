import { useEffect, useRef, useState } from 'react'
import {
  getSubscription,
  pushSupported,
  subscribe,
  syncSchedules,
  unsubscribe,
} from '../lib/push.js'

// status: 'unsupported' | 'loading' | 'off' | 'enabling' | 'on' | 'denied'
export function usePush(items) {
  const [status, setStatus] = useState(() => (pushSupported() ? 'loading' : 'unsupported'))
  const subRef = useRef(null)

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

  // Cada cambio en los ítems reenvía la agenda (con un respiro para no spamear).
  useEffect(() => {
    if (status !== 'on' || !subRef.current) return
    const t = setTimeout(() => {
      syncSchedules(subRef.current, items).catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [items, status])

  async function enable() {
    if (status === 'enabling') return { ok: false, message: 'Ya estoy en eso.' }
    setStatus('enabling')
    try {
      // Si el navegador ya tiene una suscripción, se reutiliza: nunca dos por dispositivo.
      const sub = (await getSubscription()) ?? (await subscribe())
      subRef.current = sub
      await syncSchedules(sub, items)
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
      }
    }
    subRef.current = null
    setStatus('off')
  }

  return { status, enable, disable }
}
