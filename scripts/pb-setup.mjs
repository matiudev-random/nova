// Crea o actualiza las colecciones de Nova en PocketBase (`nova_items`, `nova_push_subs`). Se puede correr las veces
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
  name: 'nova_items',
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
    // Vencimiento ya avisado por push (lo escribe el servidor, no la app).
    { name: 'notifiedDue', type: 'text', max: 10 },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
  indexes: ['CREATE UNIQUE INDEX `idx_nova_items_user_uid` ON `nova_items` (`user`, `uid`)'],
}

// Dispositivos anotados para avisos. Sin reglas: solo el servidor la toca
// (rutas /api/nova/push/* del binario propio, ver server/).
const pushSubs = {
  name: 'nova_push_subs',
  type: 'base',
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null,
  fields: [
    {
      name: 'user',
      type: 'relation',
      required: true,
      collectionId: users.id,
      cascadeDelete: true,
      maxSelect: 1,
    },
    { name: 'endpoint', type: 'text', required: true, max: 1000 },
    { name: 'p256dh', type: 'text', required: true, max: 200 },
    { name: 'auth', type: 'text', required: true, max: 100 },
    { name: 'tz', type: 'text', max: 64 },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
  indexes: ['CREATE UNIQUE INDEX `idx_nova_push_subs_endpoint` ON `nova_push_subs` (`endpoint`)'],
}

async function find(name) {
  try {
    return await api(`/api/collections/${name}`)
  } catch (err) {
    if (err.status !== 404) throw err
    return null
  }
}

// Antes se llamaba `items`. Si la vieja es la de Nova (tiene `uid` y
// `clientUpdatedAt`), se renombra con los datos adentro.
let existing = await find('nova_items')
if (!existing) {
  const legacy = await find('items')
  const isNova = ['uid', 'clientUpdatedAt'].every((n) => legacy?.fields.some((f) => f.name === n))
  if (isNova) {
    existing = legacy
    console.log('Renombrando `items` → `nova_items`.')
  }
}

async function apply(def, existing) {
  if (existing) {
    // Conserva los ids de los campos que ya existen para no perder datos.
    const byName = new Map(existing.fields.map((f) => [f.name, f]))
    const fields = def.fields.map((f) => (byName.has(f.name) ? { ...byName.get(f.name), ...f } : f))
    const keep = existing.fields.filter((f) => f.system)
    for (const f of keep) if (!fields.some((x) => x.name === f.name)) fields.unshift(f)
    await api(`/api/collections/${existing.id}`, { method: 'PATCH', body: { ...def, fields } })
    console.log(`Colección \`${def.name}\` actualizada.`)
  } else {
    await api('/api/collections', { method: 'POST', body: def })
    console.log(`Colección \`${def.name}\` creada.`)
  }
}

await apply(items, existing)
await apply(pushSubs, await find(pushSubs.name))

const u = users.passwordAuth
console.log(
  `users: login con contraseña ${u?.enabled ? 'activado' : 'DESACTIVADO'}, ` +
    `registro ${users.createRule === '' ? 'abierto' : `con regla: ${users.createRule}`}.`,
)
