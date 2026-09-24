import { useState } from 'react'
import { addDays, formatShort, todayISO } from '../lib/dates.js'
import { intervalSuggestion, realInterval, STATUS } from '../lib/items.js'

const STATUS_COLOR = {
  [STATUS.OK]: 'text-ok',
  [STATUS.SOON]: 'text-soon',
  [STATUS.OVERDUE]: 'text-overdue',
}

const POSTPONE = [
  { days: 3, label: 'Posponer 3 días' },
  { days: 7, label: 'Posponer 1 semana' },
]

// Marcar hecho con fecha pasada: uno se acuerda dos días después.
const AGO = [
  { days: 1, label: 'ayer' },
  { days: 2, label: 'anteayer' },
]

function statusText({ status, daysLeft }) {
  if (status === STATUS.OVERDUE) {
    const d = -daysLeft
    return d === 1 ? 'Venció ayer' : `Venció hace ${d} días`
  }
  if (daysLeft === 0) return 'Vence hoy'
  if (daysLeft === 1) return 'Vence mañana'
  return `Vence en ${daysLeft} días`
}

function ElapsedDays({ days, approx, status }) {
  const tone = status === STATUS.OVERDUE ? 'text-overdue' : 'text-ink'
  if (days === 0) {
    return (
      <div className="font-display text-[26px] leading-none font-medium text-ok">hoy</div>
    )
  }
  return (
    <div className={`font-display leading-none tabular-nums ${tone}`}>
      <span className="text-[38px] font-medium tracking-tight">
        {approx && <span className="text-muted text-[26px] align-[3px] mr-px">~</span>}
        {days}
      </span>
      <span className="block text-[11px] text-muted font-sans mt-1">
        {days === 1 ? 'día' : 'días'}
      </span>
    </div>
  )
}

function EditForm({ item, onSave, onCancel }) {
  const [name, setName] = useState(item.name)
  const [intervalDays, setIntervalDays] = useState(item.intervalDays)
  const valid = name.trim().length > 0 && intervalDays >= 1

  function submit(e) {
    e.preventDefault()
    if (!valid) return
    onSave({ name, intervalDays })
  }

  return (
    <form className="pb-4 pl-[4.5rem] pr-1 flex flex-col gap-3" onSubmit={submit}>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Qué</span>
        <input
          id={`edit-name-${item.id}`}
          className="field-input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Cada cuántos días</span>
        <input
          id={`edit-interval-${item.id}`}
          className="field-input tabular-nums max-w-[8rem]"
          type="number"
          inputMode="numeric"
          min={1}
          max={3650}
          value={intervalDays}
          onChange={(e) => setIntervalDays(Number(e.target.value))}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary px-3.5 py-1.5 text-sm" disabled={!valid}>
          Guardar
        </button>
      </div>
    </form>
  )
}

// Para cuando no fue ni ayer ni anteayer.
function DoneAtPicker({ item, onPick, onCancel }) {
  const today = todayISO()
  const [date, setDate] = useState(today)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        id={`done-at-${item.id}`}
        className="field-input tabular-nums max-w-[11rem]"
        type="date"
        autoFocus
        max={today}
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <button
        type="button"
        className="btn-primary px-3.5 py-1.5 text-sm"
        disabled={!date || date > today}
        onClick={() => onPick(date)}
      >
        Marcar
      </button>
      <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  )
}

export function ItemRow({ item, info, onDone, onPostpone, onEdit, onRemove }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [picking, setPicking] = useState(false)

  const real = realInterval(item)
  const suggestion = intervalSuggestion(item)

  function close() {
    setOpen(false)
    setEditing(false)
    setConfirming(false)
    setPicking(false)
  }

  function postpone(days) {
    onPostpone(item.id, days)
    close()
  }

  function doneAt(date) {
    onDone(item, date)
    close()
  }

  // Ajustar al intervalo real: el número nuevo ya incluye lo que se posponía.
  function adjust() {
    onEdit(item.id, { name: item.name, intervalDays: suggestion.days, postponeDays: 0 })
    close()
  }

  return (
    <li className="border-b border-line">
      <div className="grid grid-cols-[3.75rem_1fr_auto] items-center gap-x-3 py-3.5">
        <ElapsedDays days={info.daysSince} approx={info.approx} status={info.status} />

        <button
          type="button"
          className="text-left min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
          onClick={() => (open ? close() : setOpen(true))}
          aria-expanded={open}
        >
          <div className="text-[17px] font-medium leading-snug truncate">{item.name}</div>
          <div className="text-[13px] leading-snug mt-0.5 flex flex-wrap gap-x-2">
            <span className={`font-medium ${STATUS_COLOR[info.status]}`}>{statusText(info)}</span>
            <span className="text-muted">cada {item.intervalDays} días</span>
            {suggestion && (
              <span className="font-medium text-amber-deep">~{suggestion.days} reales</span>
            )}
            {info.postponeDays > 0 && (
              <span className="text-muted">pospuesto {info.postponeDays} días</span>
            )}
          </div>
        </button>

        <button
          type="button"
          className="btn-primary px-3.5 py-1.5 text-sm"
          onClick={() => onDone(item)}
          disabled={info.daysSince === 0}
        >
          Hecho
        </button>
      </div>

      {open && editing && (
        <EditForm
          item={item}
          onSave={(patch) => {
            onEdit(item.id, patch)
            close()
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {open && !editing && (
        <div className="pb-4 pl-[4.5rem] pr-1 flex flex-col gap-3">
          <div className="text-[13px] leading-relaxed">
            <span className="text-muted">Últimas veces: </span>
            {[...item.history].reverse().slice(0, 5).map(formatShort).join(', ')}
            {info.approx && <span className="text-muted"> (aprox.)</span>}
            {real && (
              <span className="block text-muted">
                Lo hacés cada ~{real.days} días, según las últimas {real.samples}.
              </span>
            )}
          </div>

          {suggestion && (
            <div className="flex flex-col items-start gap-2 border-l-2 border-amber pl-3">
              <p className="text-[13px] leading-snug">
                Cargaste cada {item.intervalDays} días y lo hacés cada{' '}
                <span className="hl">~{suggestion.days}</span>.{' '}
                {suggestion.slower ? 'Te aviso antes de tiempo.' : 'Te aviso tarde.'}
              </p>
              <button type="button" className="chip" onClick={adjust}>
                Ajustar a {suggestion.days} días
              </button>
            </div>
          )}

          {picking ? (
            <DoneAtPicker item={item} onPick={doneAt} onCancel={() => setPicking(false)} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-muted">Lo hice</span>
              {AGO.map((a) => (
                <button
                  key={a.days}
                  type="button"
                  className="chip"
                  onClick={() => doneAt(addDays(todayISO(), -a.days))}
                >
                  {a.label}
                </button>
              ))}
              <button type="button" className="chip" onClick={() => setPicking(true)}>
                otro día
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {POSTPONE.map((p) => (
              <button key={p.days} type="button" className="chip" onClick={() => postpone(p.days)}>
                {p.label}
              </button>
            ))}
            <button type="button" className="chip" onClick={() => setEditing(true)}>
              Editar
            </button>
            {confirming ? (
              <span className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  className="btn-danger px-3.5 py-1.5 text-sm"
                  onClick={() => onRemove(item)}
                >
                  Sí, borrar
                </button>
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-sm"
                  onClick={() => setConfirming(false)}
                >
                  Cancelar
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn-ghost ml-auto px-3 py-1.5 text-sm"
                onClick={() => setConfirming(true)}
              >
                Borrar
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}
