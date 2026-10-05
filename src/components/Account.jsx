import { formatTime } from '../lib/dates.js'

const link =
  'underline underline-offset-4 decoration-line hover:text-ink hover:decoration-ink rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50'

function syncLabel(sync) {
  if (sync.status === 'syncing') return 'Sincronizando…'
  if (sync.status === 'error') return <span className="text-overdue">{sync.error}</span>
  if (sync.at) return `Sincronizado ${formatTime(sync.at)}`
  return null
}

// Fila "Cuenta" del pie: quién está adentro, cómo va la sincronización, salir.
export function Account({ user, sync, onSync, onLogout }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>Cuenta</span>
        <span className="text-ink break-all">{user.email}</span>
        <button type="button" className={link} onClick={onLogout}>
          Salir
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span aria-live="polite">{syncLabel(sync)}</span>
        {sync.status === 'error' && (
          <button type="button" className={link} onClick={onSync}>
            Reintentar
          </button>
        )}
      </div>
    </div>
  )
}
