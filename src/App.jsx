import { useCallback, useEffect, useState } from 'react'
import { AddItemForm } from './components/AddItemForm.jsx'
import { Backup } from './components/Backup.jsx'
import { ItemRow } from './components/ItemRow.jsx'
import { Notices } from './components/Notices.jsx'
import { Summary } from './components/Summary.jsx'
import { Toast } from './components/Toast.jsx'
import { useItems } from './hooks/useItems.js'
import { usePush } from './hooks/usePush.js'
import { formatShort, todayISO } from './lib/dates.js'
import { describeItem, STATUS } from './lib/items.js'

const SECTIONS = [
  { status: STATUS.OVERDUE, title: 'Vencido' },
  { status: STATUS.SOON, title: 'Vence pronto' },
  { status: STATUS.OK, title: 'Al día' },
]

function App() {
  const { items, addItem, markDone, postpone, editItem, restoreItem, removeItem, importItems } =
    useItems()
  const push = usePush(items)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState(null)
  const closeToast = useCallback(() => setToast(null), [])

  const notify = (message) => setToast({ message })

  // Hecho y Borrar guardan el estado previo para poder deshacer desde el toast.
  // `date` llega solo si se marcó con fecha pasada ("lo hice ayer").
  function done(item, date) {
    markDone(item.id, date)
    const when = date && date !== todayISO() ? ` (${formatShort(date)})` : ''
    setToast({
      message: `Hecho: ${item.name}${when}`,
      action: { label: 'Deshacer', fn: () => restoreItem(item) },
    })
  }

  function remove(item) {
    removeItem(item.id)
    setToast({
      message: `Borrado: ${item.name}`,
      action: { label: 'Deshacer', fn: () => restoreItem(item) },
    })
  }

  const rows = items
    .map((item) => ({ item, info: describeItem(item) }))
    .sort((a, b) => a.info.daysLeft - b.info.daysLeft)

  const count = (status) => rows.filter((r) => r.info.status === status).length
  const overdue = count(STATUS.OVERDUE)
  const soon = count(STATUS.SOON)

  // Número en el ícono de la app instalada: lo vencido. Se limpia si no hay nada.
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return
    const p = overdue > 0 ? navigator.setAppBadge(overdue) : navigator.clearAppBadge()
    p?.catch?.(() => {})
  }, [overdue])

  async function enablePush() {
    const r = await push.enable()
    notify(r.ok ? 'Listo: te aviso cuando venza algo.' : r.message)
  }

  return (
    <main className="mx-auto flex max-w-[32rem] flex-col gap-6 px-5 pb-24 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/nova-mark.svg" alt="" width="30" height="30" className="rounded-lg" />
          <span className="font-display text-[22px] font-semibold tracking-tight">Nova</span>
        </div>
        {!adding && items.length > 0 && (
          <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
            Nuevo
          </button>
        )}
      </header>

      {adding ? (
        <AddItemForm
          onAdd={(data) => {
            addItem(data)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      ) : items.length === 0 ? (
        <section className="flex flex-col gap-4 pt-6">
          <h1 className="font-display text-[34px] leading-[1.15] font-medium tracking-tight text-balance">
            Todo lo que hacés <span className="hl">cada tanto</span>, en un solo lugar.
          </h1>
          <p className="max-w-[36ch] text-[15px] text-muted">
            Sábanas, cepillo de dientes, filtro del agua. Cargás cada cuánto toca y Nova te dice
            cuánto pasó desde la última vez.
          </p>
          <div>
            <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
              Agregar el primero
            </button>
          </div>
        </section>
      ) : (
        <Summary overdue={overdue} soon={soon} next={rows[0]} />
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-7">
          {SECTIONS.map(({ status, title }) => {
            const group = rows.filter((r) => r.info.status === status)
            if (group.length === 0) return null
            return (
              <section key={status}>
                <h2 className="mb-0.5 flex items-baseline gap-2 border-b-2 border-ink pb-1.5">
                  <span className="text-[15px] font-semibold">{title}</span>
                  <span className="text-[13px] text-muted tabular-nums">{group.length}</span>
                </h2>
                <ul>
                  {group.map(({ item, info }) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      info={info}
                      onDone={done}
                      onPostpone={postpone}
                      onEdit={editItem}
                      onRemove={remove}
                    />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <footer className="mt-4 pt-5 border-t border-line flex flex-col gap-3 text-sm text-muted">
        <Notices status={push.status} onEnable={enablePush} onDisable={push.disable} notify={notify} />
        <Backup items={items} onImport={importItems} notify={notify} />
      </footer>

      <Toast toast={toast} onClose={closeToast} />
    </main>
  )
}

export default App
