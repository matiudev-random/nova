import { isIOS, isStandalone, showLocalTest } from '../lib/push.js'

const link =
  'underline underline-offset-4 decoration-line hover:text-ink hover:decoration-ink rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50'

// Fila "Avisos" del pie: activar/desactivar los push de este dispositivo.
export function Notices({ status, onEnable, onDisable, notify }) {
  async function test() {
    try {
      await showLocalTest()
    } catch (err) {
      notify('No pude mostrar la notificación: ' + err.message)
    }
  }

  if (status === 'unsupported') return null

  let content
  if (isIOS() && !isStandalone()) {
    content = (
      <span>
        Para recibir avisos en iPhone, instalá Nova: <b className="font-medium text-ink">Compartir</b>{' '}
        → <b className="font-medium text-ink">Agregar a inicio</b>.
      </span>
    )
  } else if (status === 'denied') {
    content = <span>Bloqueados en el navegador. Permitilos en la configuración del sitio.</span>
  } else if (status === 'on') {
    content = (
      <>
        <span className="text-ok font-medium">Activados en este dispositivo</span>
        <button type="button" className={link} onClick={test}>
          Probar
        </button>
        <button type="button" className={link} onClick={onDisable}>
          Desactivar
        </button>
      </>
    )
  } else {
    content = (
      <button type="button" className={link} onClick={onEnable} disabled={status === 'loading' || status === 'enabling'}>
        {status === 'enabling' ? 'Activando…' : 'Avisarme cuando venza algo'}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span>Avisos</span>
      {content}
    </div>
  )
}
