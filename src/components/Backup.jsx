import { useRef } from 'react'
import { todayISO } from '../lib/dates.js'
import { parseBackup, serializeBackup } from '../lib/storage.js'

export function Backup({ items, onImport, notify }) {
  const fileRef = useRef(null)

  function exportJson() {
    const blob = new Blob([serializeBackup(items)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nova-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
    notify(`Copia guardada: nova-${todayISO()}.json`)
  }

  async function importJson(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const incoming = parseBackup(await file.text())
      onImport(incoming)
      notify(incoming.length === 1 ? 'Importé 1 ítem.' : `Importé ${incoming.length} ítems.`)
    } catch (err) {
      notify(err.message)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span>Copia de seguridad</span>
      <button
        type="button"
        className="underline underline-offset-4 decoration-line hover:text-ink hover:decoration-ink rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        onClick={exportJson}
        disabled={items.length === 0}
      >
        Exportar
      </button>
      <button
        type="button"
        className="underline underline-offset-4 decoration-line hover:text-ink hover:decoration-ink rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        onClick={() => fileRef.current?.click()}
      >
        Importar
      </button>
      <input
        ref={fileRef}
        id="backup-file"
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={importJson}
      />
    </div>
  )
}
