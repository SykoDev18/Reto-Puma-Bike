import type { ReactNode } from 'react'

/**
 * Placa de dorsal (§6): fondo cal, número Martian Mono, borde noche grueso,
 * radio 2px y dos perforaciones circulares como SVG real (no pseudo-elemento).
 * Se ve correcta tanto en secciones oscuras como en franjas claras porque
 * hereda sus colores del token, sin condicionales.
 */
export function PlacaDorsal({
  numero,
  etiqueta,
  variante,
  className,
}: {
  numero: ReactNode
  etiqueta?: string
  variante?: string
  className?: string
}) {
  const clases = ['placa', variante, className].filter(Boolean).join(' ')
  return (
    <span className={clases}>
      <svg className="placa__hoyos" viewBox="0 0 54 14" aria-hidden="true">
        <circle cx="15" cy="7" r="4" />
        <circle cx="39" cy="7" r="4" />
      </svg>
      <b>{numero}</b>
      {etiqueta ? <small>{etiqueta}</small> : null}
    </span>
  )
}
