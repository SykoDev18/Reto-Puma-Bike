import type { Ruta } from '../types/roadbook'
import { construirPathHorizontal, construirPathVertical } from '../lib/perfil'

type Orientacion = 'vertical' | 'horizontal'

/**
 * Perfil de elevación como línea SVG.
 *
 * - `vertical` (por defecto): la columna vertebral del riel. `pathLength={1}`
 *   permite dibujar el trazo "hecho" con stroke-dashoffset = 1 - var(--progreso)
 *   por CSS, sin medir longitudes en JS ni re-renderizar en scroll.
 * - `horizontal`: mini-perfil para las tarjetas de ruta (estático).
 *
 * Siempre aria-hidden: los mismos datos se publican en texto junto al gráfico.
 */
export function Perfil({
  ruta,
  orientacion = 'vertical',
  className,
}: {
  ruta: Ruta
  orientacion?: Orientacion
  className?: string
}) {
  if (orientacion === 'horizontal') {
    const ancho = 320
    const alto = 68
    const d = construirPathHorizontal(ruta.perfil, ruta.km, { ancho, alto, margen: 3 })
    return (
      <svg
        className={className ? `mini-perfil ${className}` : 'mini-perfil'}
        viewBox={`0 0 ${ancho} ${alto}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path className="mini-perfil__linea" d={d} />
      </svg>
    )
  }

  const d = construirPathVertical(ruta.perfil, ruta.km, { alto: 1000, xIzq: 8, xDer: 34 })
  return (
    <svg
      className={className ? `riel__svg ${className}` : 'riel__svg'}
      preserveAspectRatio="none"
      viewBox="0 0 40 1000"
      aria-hidden="true"
    >
      <path className="riel__perfil-base" d={d} pathLength={1} />
      <path className="riel__perfil-hecho" d={d} pathLength={1} />
    </svg>
  )
}
