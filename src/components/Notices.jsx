import { configured, isIOS, isStandalone, showLocalTest } from '../lib/push.js'

const link =
  'underline underline-offset-4 decoration-line hover:text-ink hover:decoration-ink rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50'

// Por qué este dispositivo no puede recibir avisos. Conviene decirlo y no
// esconder la fila: casi siempre es la URL, y así no parece que la app falla.
function unsupportedReason() {
  if (!window.isSecureContext) {
    return <span>Abrí Nova por https: por http el navegador no deja activarlos.</span>
  }
  if (!configured) return <span>Falta configurar el servidor de avisos.</span>
  return <span>Este navegador no los soporta.</span>
}

// Fila "Avisos" del pie: activar/desactivar los push de este dispositivo.
export function Notices({ status, onEnable, onDisable, notify }) {
  async function test() {
    try {
      await showLocalTest()
    } catch (err) {
      notify('No pude mostrar la notificación: ' + err.message)
    }
  }

  let content
  // Va primero: en iPhone sin instalar no existe ni la API de notificaciones,
  // así que este aviso tiene que ganarle al de "no soportado".
  if (isIOS() && !isStandalone()) {
    content = (
      <span>
        Para recibir avisos en iPhone, instalá Nova: <b className="font-medium text-ink">Compartir</b>{' '}
        → <b className="font-medium text-ink">Agregar a inicio</b>.
      </span>
    )
  } else if (status === 'unsupported') {
    content = unsupportedReason()
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
