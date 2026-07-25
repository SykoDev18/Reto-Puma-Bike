import type { ReactNode } from 'react'

/** Las dos perforaciones de la placa, como SVG real (no pseudo-elemento). */
export function PerforacionesPlaca() {
  return (
    <svg className="placa__hoyos" viewBox="0 0 54 14" aria-hidden="true">
      <circle cx="15" cy="7" r="4" />
      <circle cx="39" cy="7" r="4" />
    </svg>
  )
}

/**
 * Placa de dorsal (§6): fondo cal, número Martian Mono, borde noche grueso,
 * radio 2px y dos perforaciones circulares.
 *
 * `tono='oscuro'` la invierte (fondo noche, texto cal) para que funcione DENTRO
 * de las franjas claras, donde la placa clara desaparecería.
 */
export function PlacaDorsal({
  numero,
  etiqueta,
  variante,
  className,
  tono = 'claro',
}: {
  numero: ReactNode
  etiqueta?: string
  variante?: string
  className?: string
  tono?: 'claro' | 'oscuro'
}) {
  const clases = [
    'placa',
    tono === 'oscuro' ? 'placa--oscura' : null,
    variante,
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <span className={clases}>
      <PerforacionesPlaca />
      <b>{numero}</b>
      {etiqueta ? <small>{etiqueta}</small> : null}
    </span>
  )
}
