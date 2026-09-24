import { useState } from 'react'
import { addDays, todayISO } from '../lib/dates.js'

const PRESETS = [
  { name: 'Sábanas', intervalDays: 14 },
  { name: 'Cepillo de dientes', intervalDays: 90 },
  { name: 'Esponja de cocina', intervalDays: 14 },
  { name: 'Filtro de agua', intervalDays: 60 },
  { name: 'Limpiar la heladera', intervalDays: 30 },
]

// Cuándo fue la última vez, a ojo. `daysAgo: null` = ni idea → se asume que ya toca.
const WHEN = [
  { key: 'today', label: 'Hoy', daysAgo: 0, approx: false },
  { key: 'days', label: 'Hace unos días', daysAgo: 3, approx: true },
  { key: 'week', label: 'Hace una semana', daysAgo: 7, approx: true },
  { key: 'month', label: 'Hace un mes', daysAgo: 30, approx: true },
  { key: 'unknown', label: 'Ni idea', daysAgo: null, approx: true },
  { key: 'exact', label: 'Fecha exacta', daysAgo: 0, approx: false },
]

export function AddItemForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [intervalDays, setIntervalDays] = useState(30)
  const [when, setWhen] = useState('today')
  const [exactDate, setExactDate] = useState(todayISO())

  const valid = name.trim().length > 0 && intervalDays >= 1

  function submit(e) {
    e.preventDefault()
    if (!valid) return
    const choice = WHEN.find((w) => w.key === when)
    const today = todayISO()
    let lastDoneAt = today
    if (when === 'exact') lastDoneAt = exactDate
    else if (choice.daysAgo === null) lastDoneAt = addDays(today, -intervalDays)
    else lastDoneAt = addDays(today, -choice.daysAgo)
    onAdd({ name, intervalDays, lastDoneAt, approx: choice.approx })
  }

  function applyPreset(p) {
    setName(p.name)
    setIntervalDays(p.intervalDays)
  }

  return (
    <form className="rounded-2xl border border-ink p-5 flex flex-col gap-5" onSubmit={submit}>
      <div>
        <h2 className="font-display text-2xl font-medium leading-tight">Algo nuevo</h2>
        <p className="text-sm text-muted mt-1">Elegí uno o escribí lo tuyo.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.name} type="button" className="chip" onClick={() => applyPreset(p)}>
            {p.name}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Qué</span>
        <input
          id="item-name"
          className="field-input text-lg"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cambiar las sábanas"
          maxLength={60}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Cada cuántos días</span>
        <input
          id="item-interval"
          className="field-input tabular-nums max-w-[8rem]"
          type="number"
          inputMode="numeric"
          min={1}
          max={3650}
          value={intervalDays}
          onChange={(e) => setIntervalDays(Number(e.target.value))}
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-muted mb-2">Última vez</legend>
        <div className="flex flex-wrap gap-2">
          {WHEN.map((w) => (
            <button
              key={w.key}
              type="button"
              className={`chip ${when === w.key ? 'chip-on' : ''}`}
              aria-pressed={when === w.key}
              onClick={() => setWhen(w.key)}
            >
              {w.label}
            </button>
          ))}
        </div>
        {when === 'exact' && (
          <input
            id="item-last"
            className="field-input tabular-nums max-w-[11rem] mt-1"
            type="date"
            max={todayISO()}
            value={exactDate}
            onChange={(e) => setExactDate(e.target.value)}
          />
        )}
        {when === 'unknown' && (
          <p className="text-sm text-muted mt-1">
            Se toma como que ya toca. Cuando lo hagas, Hecho fija la fecha real.
          </p>
        )}
      </fieldset>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={!valid}>
          Agregar
        </button>
      </div>
    </form>
  )
}
