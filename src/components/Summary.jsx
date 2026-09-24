function plural(n, one, many) {
  return n === 1 ? one : many.replace('{n}', n)
}

function whenText(daysLeft) {
  if (daysLeft === 0) return 'hoy'
  if (daysLeft === 1) return 'mañana'
  return `en ${daysLeft} días`
}

// Titular del día: dice lo que importa hoy, con el dato clave resaltado.
export function Summary({ overdue, soon, next }) {
  let line
  if (overdue > 0) {
    line = (
      <>
        Tenés <span className="hl">{plural(overdue, '1 cosa vencida', '{n} cosas vencidas')}</span>
        {soon > 0 ? ` y ${plural(soon, '1 por vencer', '{n} por vencer')}.` : '.'}
      </>
    )
  } else if (soon > 0) {
    line = (
      <>
        <span className="hl">{plural(soon, '1 cosa vence', '{n} cosas vencen')}</span> pronto.
      </>
    )
  } else {
    line = (
      <>
        Todo <span className="hl">al día</span>.
      </>
    )
  }

  return (
    <section className="pt-2 pb-1">
      <h1 className="font-display text-[34px] leading-[1.15] font-medium tracking-tight text-balance">
        {line}
      </h1>
      {next && overdue === 0 && (
        <p className="text-muted mt-2 text-[15px]">
          Lo más próximo: {next.item.name}, {whenText(next.info.daysLeft)}.
        </p>
      )}
    </section>
  )
}
