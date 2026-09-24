const KEY = 'nova.items.v1'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function loadItems() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveItems(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // Sin storage (modo privado, cuota llena): la app sigue funcionando en memoria.
  }
}

// ---- Copia de seguridad (JSON) ----

export function serializeBackup(items) {
  return JSON.stringify({ app: 'nova', version: 1, exportedAt: new Date().toISOString(), items }, null, 2)
}

function isItem(x) {
  return (
    x &&
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    Number(x.intervalDays) >= 1 &&
    typeof x.lastDoneAt === 'string' &&
    ISO_DATE.test(x.lastDoneAt)
  )
}

// Devuelve los ítems del archivo o lanza un error con mensaje para mostrar.
export function parseBackup(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  const list = Array.isArray(data) ? data : data?.items
  if (!Array.isArray(list)) throw new Error('El archivo no tiene la forma de una copia de Nova.')
  const items = list.filter(isItem).map((it) => ({
    ...it,
    intervalDays: Number(it.intervalDays),
    history: Array.isArray(it.history) ? it.history.filter((d) => ISO_DATE.test(d)) : [it.lastDoneAt],
    approx: Boolean(it.approx),
    postponeDays: Number(it.postponeDays) || 0,
  }))
  if (items.length === 0) throw new Error('No encontré ningún ítem en el archivo.')
  return items
}
