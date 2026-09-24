import { useEffect } from 'react'

// Aviso breve abajo. Si trae `action`, muestra el botón (p. ej. Deshacer).
export function Toast({ toast, onClose, duration = 6000 }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [toast, onClose, duration])

  if (!toast) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 flex justify-center px-4 pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink text-paper pl-4 pr-1.5 py-1.5 text-[15px] shadow-lg max-w-[32rem]">
        <span className="min-w-0 truncate">{toast.message}</span>
        {toast.action ? (
          <button
            type="button"
            className="shrink-0 rounded-full bg-amber text-ink font-medium px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
            onClick={() => {
              toast.action.fn()
              onClose()
            }}
          >
            {toast.action.label}
          </button>
        ) : (
          <button
            type="button"
            className="shrink-0 rounded-full px-3 py-1.5 text-sm text-paper/70 hover:text-paper"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
