// Trabajamos con fechas "solo día" (YYYY-MM-DD, hora local).
// Así "hoy" es hoy sin importar la hora ni la zona horaria.

const DAY_MS = 86_400_000

export function todayISO(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Días enteros de `from` a `to` (positivo si `to` es después).
export function daysBetween(fromISO, toISO) {
  return Math.round((parseISO(toISO) - parseISO(fromISO)) / DAY_MS)
}

export function addDays(iso, n) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return todayISO(d)
}

export function formatRelative(days) {
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  if (days < 30) {
    const w = Math.round(days / 7)
    return w === 1 ? 'hace 1 semana' : `hace ${w} semanas`
  }
  if (days < 365) {
    const m = Math.round(days / 30)
    return m === 1 ? 'hace 1 mes' : `hace ${m} meses`
  }
  const y = Math.round(days / 365)
  return y === 1 ? 'hace 1 año' : `hace ${y} años`
}

const shortDate = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })

// "14 sep"
export function formatShort(iso) {
  return shortDate.format(parseISO(iso)).replace('.', '')
}
