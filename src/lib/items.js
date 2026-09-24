import { addDays, daysBetween, todayISO } from './dates.js'

export const STATUS = {
  OK: 'ok',
  SOON: 'soon',
  OVERDUE: 'overdue',
}

// Hacen falta dos huecos entre marcas reales para animarse a decir cada cuánto
// lo hace de verdad, y una diferencia así de grande para proponer el cambio.
const MIN_GAPS = 2
const MIN_DIFF_DAYS = 2
const MIN_DIFF_RATIO = 0.25

// `approx`: la última vez se cargó a ojo ("hace como un mes"), no con fecha exacta.
// `approxStart`: esa carga a ojo es la primera fecha del historial. No se limpia
// nunca: hay que ignorarla para medir el intervalo real.
export function createItem({ name, intervalDays, lastDoneAt = todayISO(), approx = false }) {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    intervalDays: Number(intervalDays),
    lastDoneAt,
    approx,
    approxStart: approx,
    postponeDays: 0,
    history: [lastDoneAt],
    createdAt: todayISO(),
  }
}

// Marcar hecho fija una fecha real: se va lo aproximado y lo pospuesto.
// La fecha puede ser pasada ("lo hice ayer"), así que el historial se mantiene
// ordenado y sin repetidos, y `lastDoneAt` es siempre la marca más nueva.
export function markItemDone(item, date = todayISO()) {
  const history = [...new Set([...item.history, date])].sort().slice(-20)
  return {
    ...item,
    lastDoneAt: history.at(-1),
    approx: false,
    postponeDays: 0,
    history,
  }
}

// Posponer corre el vencimiento sin tocar la última vez real.
export function postponeItem(item, days) {
  return { ...item, postponeDays: (item.postponeDays ?? 0) + days }
}

// Todo lo derivado del ítem sale de acá: cuánto pasó, cuánto falta, estado.
export function describeItem(item, today = todayISO()) {
  const postponeDays = item.postponeDays ?? 0
  const span = item.intervalDays + postponeDays
  const daysSince = daysBetween(item.lastDoneAt, today)
  const dueAt = addDays(item.lastDoneAt, span)
  const daysLeft = span - daysSince
  // "Pronto" = dentro del último 20% del intervalo, mínimo 1 día.
  const soonThreshold = Math.max(1, Math.round(item.intervalDays * 0.2))

  let status = STATUS.OK
  if (daysLeft < 0) status = STATUS.OVERDUE
  else if (daysLeft <= soonThreshold) status = STATUS.SOON

  return {
    daysSince,
    daysLeft,
    dueAt,
    status,
    postponeDays,
    approx: Boolean(item.approx),
    progress: Math.min(1, daysSince / span),
  }
}

// ---- Intervalo real (lo que dice el historial, no lo que se cargó) ----

// Días entre marcas consecutivas. Si la primera fecha se cargó a ojo, el hueco
// que sale de ella es inventado y no cuenta.
function historyGaps(item) {
  const dates = [...new Set(item.history ?? [])].sort()
  const real = (item.approxStart ?? item.approx) ? dates.slice(1) : dates
  const gaps = []
  for (let i = 1; i < real.length; i++) gaps.push(daysBetween(real[i - 1], real[i]))
  return gaps
}

// Mediana y no promedio: una vez que lo dejaste pasar tres meses no debería
// mover la medición.
function median(nums) {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

// Cada cuántos días lo hace en realidad. `null` mientras no haya suficientes
// marcas reales para decir algo.
export function realInterval(item) {
  const gaps = historyGaps(item)
  if (gaps.length < MIN_GAPS) return null
  return { days: median(gaps), samples: gaps.length + 1 }
}

// Lo mismo, pero solo cuando vale la pena ofrecer cambiar el intervalo cargado.
export function intervalSuggestion(item) {
  const real = realInterval(item)
  if (!real) return null
  const diff = Math.abs(real.days - item.intervalDays)
  if (diff < MIN_DIFF_DAYS || diff / item.intervalDays < MIN_DIFF_RATIO) return null
  return { ...real, slower: real.days > item.intervalDays }
}

// Más urgente primero: lo vencido (más vencido arriba), después lo que vence antes.
export function sortByUrgency(items, today = todayISO()) {
  return [...items].sort(
    (a, b) => describeItem(a, today).daysLeft - describeItem(b, today).daysLeft,
  )
}

// Editar nombre o intervalo sin tocar fechas ni historial. Ajustar el intervalo
// al real también limpia lo pospuesto: ya está contemplado en el número nuevo.
export function updateItem(item, { name, intervalDays, postponeDays }) {
  return {
    ...item,
    name: name.trim() || item.name,
    intervalDays: Math.max(1, Number(intervalDays) || item.intervalDays),
    postponeDays: postponeDays ?? item.postponeDays ?? 0,
  }
}
