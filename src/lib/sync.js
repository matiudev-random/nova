import { pb } from './pb.js'

// Sincronización con PocketBase, pensada para andar sin red:
// - localStorage es la copia de trabajo; el servidor, la que comparten los dispositivos.
// - Cada ítem lleva `updatedAt` (ms, reloj del dispositivo). Ante dos versiones, gana
//   la más nueva. Los borrados viajan como `deleted: true` para que no "resuciten".
// - Sin realtime: ngrok gratis bloquea el SSE de PocketBase. Se sincroniza al abrir,
//   al volver a la app, al recuperar red, después de cada cambio y cada tanto.

const items = () => pb.collection('nova_items')

function toRecord(item, deleted = false) {
  return {
    uid: item.id,
    name: item.name,
    intervalDays: item.intervalDays,
    lastDoneAt: item.lastDoneAt,
    approx: Boolean(item.approx),
    approxStart: Boolean(item.approxStart),
    postponeDays: item.postponeDays ?? 0,
    history: item.history ?? [item.lastDoneAt],
    createdAt: item.createdAt ?? '',
    clientUpdatedAt: item.updatedAt ?? 0,
    deleted,
  }
}

function toItem(r) {
  return {
    id: r.uid,
    name: r.name,
    intervalDays: r.intervalDays,
    lastDoneAt: r.lastDoneAt,
    approx: r.approx,
    approxStart: r.approxStart,
    postponeDays: r.postponeDays ?? 0,
    history: Array.isArray(r.history) ? r.history : [r.lastDoneAt],
    createdAt: r.createdAt || undefined,
    updatedAt: r.clientUpdatedAt ?? 0,
  }
}

async function upsert(remote, data) {
  const user = pb.authStore.record.id
  return remote ? items().update(remote.id, data) : items().create({ ...data, user })
}

// Sube lo local que sea más nuevo que el servidor y devuelve cómo quedó el servidor.
// `deleted` son los borrados locales: { [id]: ms }.
export async function pushAndPull(localItems, deleted) {
  const list = await items().getFullList({ batch: 500 })
  const byUid = new Map(list.map((r) => [r.uid, r]))

  for (const item of localItems) {
    const remote = byUid.get(item.id)
    if (remote && remote.clientUpdatedAt >= (item.updatedAt ?? 0)) continue
    byUid.set(item.id, await upsert(remote, toRecord(item)))
  }

  for (const [id, at] of Object.entries(deleted)) {
    const remote = byUid.get(id)
    // Nunca llegó al servidor, ya está borrado, o alguien lo cambió después: nada que subir.
    if (!remote || remote.deleted || remote.clientUpdatedAt >= at) continue
    byUid.set(id, await items().update(remote.id, { deleted: true, clientUpdatedAt: at }))
  }

  return [...byUid.values()]
}

// Aplica el estado del servidor sobre lo local. Devuelve `prev` tal cual si no
// cambia nada, para no disparar renders ni otra sincronización.
export function applyRemote(prev, records, deleted) {
  const byId = new Map(prev.map((it) => [it.id, it]))
  let changed = false
  for (const r of records) {
    const local = byId.get(r.uid)
    const localAt = local?.updatedAt ?? deleted[r.uid] ?? -1
    if (r.clientUpdatedAt <= localAt) continue
    if (r.deleted) {
      if (local) {
        byId.delete(r.uid)
        changed = true
      }
    } else {
      byId.set(r.uid, toItem(r))
      changed = true
    }
  }
  return changed ? [...byId.values()] : prev
}

// Borrados locales que ya no hace falta recordar: el servidor ya los tiene
// (o nunca supo del ítem).
export function settledDeletes(records, deleted) {
  const byUid = new Map(records.map((r) => [r.uid, r]))
  return Object.keys(deleted).filter((id) => {
    const r = byUid.get(id)
    return !r || r.deleted || r.clientUpdatedAt > deleted[id]
  })
}
