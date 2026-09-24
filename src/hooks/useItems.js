import { useEffect, useState } from 'react'
import { createItem, markItemDone, postponeItem, updateItem } from '../lib/items.js'
import { loadItems, saveItems } from '../lib/storage.js'

export function useItems() {
  const [items, setItems] = useState(loadItems)

  useEffect(() => {
    saveItems(items)
  }, [items])

  const update = (id, fn) =>
    setItems((prev) => prev.map((it) => (it.id === id ? fn(it) : it)))

  const addItem = (data) => setItems((prev) => [...prev, createItem(data)])
  const markDone = (id, date) => update(id, (it) => markItemDone(it, date))
  const postpone = (id, days) => update(id, (it) => postponeItem(it, days))
  const editItem = (id, patch) => update(id, (it) => updateItem(it, patch))
  // Vuelve un ítem a un estado anterior; si se había borrado, lo reincorpora.
  const restoreItem = (snapshot) =>
    setItems((prev) =>
      prev.some((it) => it.id === snapshot.id)
        ? prev.map((it) => (it.id === snapshot.id ? snapshot : it))
        : [...prev, snapshot],
    )
  const removeItem = (id) => setItems((prev) => prev.filter((it) => it.id !== id))

  // Importar mezcla por id: lo del archivo pisa lo local, lo nuevo se agrega.
  const importItems = (incoming) =>
    setItems((prev) => {
      const byId = new Map(prev.map((it) => [it.id, it]))
      for (const it of incoming) byId.set(it.id, it)
      return [...byId.values()]
    })

  return { items, addItem, markDone, postpone, editItem, restoreItem, removeItem, importItems }
}
