import { useCallback, useEffect, useRef, useState } from 'react'
import { createItem, markItemDone, postponeItem, updateItem } from '../lib/items.js'
import { clearLocal, loadDeleted, loadItems, saveDeleted, saveItems } from '../lib/storage.js'
import { applyRemote, pushAndPull, settledDeletes } from '../lib/sync.js'
import { errorMessage, pb } from '../lib/pb.js'

const SYNC_DELAY = 1000
const SYNC_EVERY = 30_000

// Todo cambio local lleva la hora: es lo que decide quién gana al sincronizar.
const touch = (it) => ({ ...it, updatedAt: Date.now() })

// sync.status: 'off' (sin sesión) | 'syncing' | 'ok' | 'error'
export function useItems(user) {
  const [items, setItems] = useState(loadItems)
  const [sync, setSync] = useState({ status: 'off', error: null, at: null })
  const itemsRef = useRef(items)
  const deletedRef = useRef(loadDeleted())
  const running = useRef(false)
  const again = useRef(false)
  const timer = useRef(null)
  // Sube al cerrar sesión: una sincronización que vuelve tarde ya no aplica nada.
  const generation = useRef(0)
  const userId = user?.id ?? null

  useEffect(() => {
    itemsRef.current = items
    saveItems(items)
  }, [items])

  const setDeleted = (next) => {
    deletedRef.current = next
    saveDeleted(next)
  }

  const syncNow = useCallback(async () => {
    if (!userId || !pb.authStore.isValid) return
    // Una sola a la vez; si piden otra en el medio, se encadena al terminar.
    if (running.current) {
      again.current = true
      return
    }
    running.current = true
    const gen = generation.current
    setSync((s) => ({ ...s, status: 'syncing' }))
    try {
      const records = await pushAndPull(itemsRef.current, deletedRef.current)
      if (gen !== generation.current) return
      const done = settledDeletes(records, deletedRef.current)
      if (done.length) {
        const next = { ...deletedRef.current }
        for (const id of done) delete next[id]
        setDeleted(next)
      }
      setItems((prev) => applyRemote(prev, records, deletedRef.current))
      setSync({ status: 'ok', error: null, at: Date.now() })
    } catch (err) {
      if (gen !== generation.current) return
      setSync((s) => ({ ...s, status: 'error', error: errorMessage(err) }))
    } finally {
      running.current = false
      if (again.current) {
        again.current = false
        syncNow()
      }
    }
  }, [userId])

  const scheduleSync = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(syncNow, SYNC_DELAY)
  }, [syncNow])

  // Al iniciar sesión, al volver a la app, al recuperar red y cada tanto.
  useEffect(() => {
    if (!userId) {
      setSync({ status: 'off', error: null, at: null })
      return
    }
    syncNow()
    const onVisible = () => document.visibilityState === 'visible' && syncNow()
    const tick = setInterval(() => document.visibilityState === 'visible' && syncNow(), SYNC_EVERY)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', syncNow)
    return () => {
      clearInterval(tick)
      clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', syncNow)
    }
  }, [userId, syncNow])

  // Cambio local: se guarda ya y se sube con un respiro, para juntar toques seguidos.
  const change = (fn) => {
    setItems(fn)
    scheduleSync()
  }

  const update = (id, fn) =>
    change((prev) => prev.map((it) => (it.id === id ? touch(fn(it)) : it)))

  const undelete = (ids) => {
    if (!ids.some((id) => id in deletedRef.current)) return
    const next = { ...deletedRef.current }
    for (const id of ids) delete next[id]
    setDeleted(next)
  }

  const addItem = (data) => change((prev) => [...prev, touch(createItem(data))])
  const markDone = (id, date) => update(id, (it) => markItemDone(it, date))
  const postpone = (id, days) => update(id, (it) => postponeItem(it, days))
  const editItem = (id, patch) => update(id, (it) => updateItem(it, patch))
  // Vuelve un ítem a un estado anterior; si se había borrado, lo reincorpora.
  const restoreItem = (snapshot) => {
    undelete([snapshot.id])
    const item = touch(snapshot)
    change((prev) =>
      prev.some((it) => it.id === item.id)
        ? prev.map((it) => (it.id === item.id ? item : it))
        : [...prev, item],
    )
  }
  const removeItem = (id) => {
    setDeleted({ ...deletedRef.current, [id]: Date.now() })
    change((prev) => prev.filter((it) => it.id !== id))
  }

  // Importar mezcla por id: lo del archivo pisa lo local, lo nuevo se agrega.
  const importItems = (incoming) => {
    undelete(incoming.map((it) => it.id))
    change((prev) => {
      const byId = new Map(prev.map((it) => [it.id, it]))
      for (const it of incoming) byId.set(it.id, touch(it))
      return [...byId.values()]
    })
  }

  // Cerrar sesión: este dispositivo se olvida de los ítems (siguen en el servidor).
  const reset = () => {
    generation.current++
    again.current = false
    clearTimeout(timer.current)
    clearLocal()
    deletedRef.current = {}
    setItems([])
  }

  return {
    items,
    sync,
    syncNow,
    addItem,
    markDone,
    postpone,
    editItem,
    restoreItem,
    removeItem,
    importItems,
    reset,
  }
}
