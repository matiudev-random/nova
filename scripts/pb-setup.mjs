// Crea o actualiza la colección `items` en PocketBase. Se puede correr las veces
// que haga falta: si ya existe, le reaplica campos, reglas e índices.
//
//   npm run pb:setup
//
// Lee VITE_PB_URL de .env y PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD de .env.local
// (superusuario; .env.local no se sube a git y Vite no lo expone a la app).

const URL_BASE = process.env.VITE_PB_URL
const EMAIL = process.env.PB_ADMIN_EMAIL
const PASSWORD = process.env.PB_ADMIN_PASSWORD

if (!URL_BASE || !EMAIL || !PASSWORD) {
  console.error('Faltan VITE_PB_URL (.env) o PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD (.env.local).')
  process.exit(1)
}

let token = ''

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '1',
      ...(token && { Authorization: token }),
    },
    body: body && JSON.stringify(body),
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`)
    err.status = res.status
    throw err
  }
  return data
}

const auth = await api('/api/collections/_superusers/auth-with-password', {
  method: 'POST',
  body: { identity: EMAIL, password: PASSWORD },
})
token = auth.token
console.log('Superusuario OK.')

const users = await api('/api/collections/users')

// Cada usuario ve y toca solo lo suyo, y no puede pasarle un ítem a otro.
const OWN = 'user = @request.auth.id'
const items = {
  name: 'items',
  type: 'base',
  listRule: OWN,
  viewRule: OWN,
  createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
  updateRule: `${OWN} && (@request.body.user:isset = false || @request.body.user = @request.auth.id)`,
  deleteRule: OWN,
  fields: [
    {
      name: 'user',
      type: 'relation',
      required: true,
      collectionId: users.id,
      cascadeDelete: true,
      maxSelect: 1,
    },
    // `uid` es el id que genera la app (UUID); el id del registro es de PocketBase.
    { name: 'uid', type: 'text', required: true, max: 64 },
    { name: 'name', type: 'text', required: true, max: 120 },
    { name: 'intervalDays', type: 'number', required: true, onlyInt: true, min: 1 },
    { name: 'lastDoneAt', type: 'text', required: true, pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    { name: 'approx', type: 'bool' },
    { name: 'approxStart', type: 'bool' },
    { name: 'postponeDays', type: 'number', onlyInt: true },
    { name: 'history', type: 'json', maxSize: 20000 },
    { name: 'createdAt', type: 'text', max: 10 },
    // Reloj del dispositivo que hizo el último cambio: gana el más nuevo.
    { name: 'clientUpdatedAt', type: 'number', onlyInt: true },
    // Los borrados quedan como marca para que lleguen a los otros dispositivos.
    { name: 'deleted', type: 'bool' },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
  indexes: ['CREATE UNIQUE INDEX `idx_items_user_uid` ON `items` (`user`, `uid`)'],
}

let existing = null
try {
  existing = await api('/api/collections/items')
} catch (err) {
  if (err.status !== 404) throw err
}

if (existing) {
  // Conserva los ids de los campos que ya existen para no perder datos.
  const byName = new Map(existing.fields.map((f) => [f.name, f]))
  const fields = items.fields.map((f) => (byName.has(f.name) ? { ...byName.get(f.name), ...f } : f))
  const keep = existing.fields.filter((f) => f.system)
  for (const f of keep) if (!fields.some((x) => x.name === f.name)) fields.unshift(f)
  await api(`/api/collections/${existing.id}`, { method: 'PATCH', body: { ...items, fields } })
  console.log('Colección `items` actualizada.')
} else {
  await api('/api/collections', { method: 'POST', body: items })
  console.log('Colección `items` creada.')
}

const u = users.passwordAuth
console.log(
  `users: login con contraseña ${u?.enabled ? 'activado' : 'DESACTIVADO'}, ` +
    `registro ${users.createRule === '' ? 'abierto' : `con regla: ${users.createRule}`}.`,
)
