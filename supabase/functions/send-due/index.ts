// La llama pg_cron cada hora: manda un push por dispositivo con lo que ya toca.
import webpush from 'npm:web-push@3.6.7'
import { admin, ensureVapid, json, VAPID_SUBJECT } from './vapid.ts'

type Due = {
  subscription_id: string
  endpoint: string
  p256dh: string
  auth: string
  item_id: string
  name: string
  due_at: string
}

function listNames(names: string[]) {
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`
}

Deno.serve(async () => {
  const db = admin()
  const { publicKey, privateKey } = await ensureVapid(db)
  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey)

  const { data, error } = await db.rpc('due_schedules')
  if (error) return json({ error: error.message }, 500)
  const due = (data ?? []) as Due[]

  // Un aviso por dispositivo, aunque toquen varias cosas.
  const bySub = new Map<string, Due[]>()
  for (const row of due) {
    const list = bySub.get(row.subscription_id) ?? []
    list.push(row)
    bySub.set(row.subscription_id, list)
  }

  let sent = 0
  let removed = 0
  for (const [subscriptionId, rows] of bySub) {
    const names = rows.map((r) => r.name)
    const payload = JSON.stringify({
      title: names.length === 1 ? names[0] : `${names.length} cosas ya tocan`,
      body: names.length === 1 ? 'Ya toca. Abrí Nova para marcarlo.' : listNames(names),
      tag: 'nova-due',
      url: '/',
    })
    const sub = { endpoint: rows[0].endpoint, keys: { p256dh: rows[0].p256dh, auth: rows[0].auth } }

    try {
      // urgency high: Android entrega al momento en vez de esperar a que el teléfono despierte.
      await webpush.sendNotification(sub, payload, { TTL: 60 * 60 * 12, urgency: 'high' })
      sent++
      await db
        .from('schedules')
        .update({ notified_at: new Date().toISOString() })
        .eq('subscription_id', subscriptionId)
        .in('item_id', rows.map((r) => r.item_id))
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      // 404/410: la suscripción ya no existe en el navegador. Se limpia.
      if (status === 404 || status === 410) {
        await db.from('subscriptions').delete().eq('id', subscriptionId)
        removed++
      } else {
        console.error('push failed', subscriptionId, status, (err as Error).message)
      }
    }
  }

  return json({ due: due.length, devices: bySub.size, sent, removed })
})
