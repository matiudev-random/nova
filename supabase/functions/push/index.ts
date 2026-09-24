// Lo que llama la app:
//   GET    → clave pública VAPID para suscribirse
//   POST   → guarda/actualiza la suscripción y reemplaza su agenda
//   DELETE → borra la suscripción (y su agenda, en cascada)
import { admin, CORS, ensureVapid, json } from './vapid.ts'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

type Schedule = { itemId: string; name: string; dueAt: string }

function localToday(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  const db = admin()

  if (req.method === 'GET') {
    const { publicKey } = await ensureVapid(db)
    return json({ publicKey })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Cuerpo inválido.' }, 400)
  }
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : null
  if (!endpoint) return json({ error: 'Falta endpoint.' }, 400)

  if (req.method === 'DELETE') {
    await db.from('subscriptions').delete().eq('endpoint', endpoint)
    return json({ ok: true })
  }

  if (req.method !== 'POST') return json({ error: 'Método no soportado.' }, 405)

  const keys = body.keys as { p256dh?: string; auth?: string } | undefined
  if (!keys?.p256dh || !keys?.auth) return json({ error: 'Faltan claves de la suscripción.' }, 400)
  const tz = typeof body.tz === 'string' && body.tz ? body.tz : 'UTC'
  const schedules = (Array.isArray(body.schedules) ? body.schedules : []).filter(
    (s: Schedule) =>
      s && typeof s.itemId === 'string' && typeof s.name === 'string' && ISO_DATE.test(s.dueAt),
  ) as Schedule[]

  const { data: sub, error } = await db
    .from('subscriptions')
    .upsert(
      { endpoint, p256dh: keys.p256dh, auth: keys.auth, tz, last_seen_at: new Date().toISOString() },
      { onConflict: 'endpoint' },
    )
    .select('id')
    .single()
  if (error || !sub) return json({ error: error?.message ?? 'No pude guardar la suscripción.' }, 500)

  // La agenda se reemplaza entera: la app manda siempre el estado completo.
  // Lo que ya venció al momento de sincronizar no se avisa: el usuario lo está viendo.
  const today = localToday(tz)
  await db.from('schedules').delete().eq('subscription_id', sub.id)
  if (schedules.length > 0) {
    const rows = schedules.map((s) => ({
      subscription_id: sub.id,
      item_id: s.itemId,
      name: s.name.slice(0, 80),
      due_at: s.dueAt,
      notified_at: s.dueAt <= today ? new Date().toISOString() : null,
    }))
    const { error: insErr } = await db.from('schedules').insert(rows)
    if (insErr) return json({ error: insErr.message }, 500)
  }

  return json({ ok: true, scheduled: schedules.length })
})
