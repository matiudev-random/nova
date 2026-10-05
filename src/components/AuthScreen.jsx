import { useState } from 'react'
import { errorMessage } from '../lib/pb.js'

// Entrada a la app. No hay registro: las cuentas se crean desde el panel de PocketBase.
export function AuthScreen({ onLogin, hasLocalItems }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const valid = email.includes('@') && password.length > 0

  async function submit(e) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      await onLogin(email.trim(), password)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex max-w-[32rem] flex-col gap-8 px-5 pb-24 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-2.5">
        <img src="/nova-mark.svg" alt="" width="30" height="30" className="rounded-lg" />
        <span className="font-display text-[22px] font-semibold tracking-tight">Nova</span>
      </header>

      <section className="flex flex-col gap-3 pt-4">
        <h1 className="font-display text-[34px] leading-[1.15] font-medium tracking-tight text-balance">
          Tus cosas, en <span className="hl">todos</span> tus dispositivos.
        </h1>
        <p className="max-w-[36ch] text-[15px] text-muted">
          {hasLocalItems
            ? 'Lo que ya cargaste en este dispositivo se sube a tu cuenta al entrar.'
            : 'Entrá para ver tus cosas en el teléfono y en la compu.'}
        </p>
      </section>

      <form className="rounded-2xl border border-ink p-5 flex flex-col gap-5" onSubmit={submit}>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Email</span>
          <input
            id="auth-email"
            className="field-input"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vos@ejemplo.com"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Contraseña</span>
          <input
            id="auth-password"
            className="field-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-overdue">
            {error}
          </p>
        )}

        <div className="flex justify-end pt-1">
          <button type="submit" className="btn-primary" disabled={!valid || busy}>
            {busy ? 'Un momento…' : 'Entrar'}
          </button>
        </div>
      </form>
    </main>
  )
}
