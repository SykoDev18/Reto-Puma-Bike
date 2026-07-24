import type { Ruta } from '../types/roadbook'
import { construirPathVertical } from '../lib/perfil'

/**
 * Perfil de elevación como línea SVG vertical. `pathLength={1}` permite que el
 * trazo "hecho" se dibuje con stroke-dashoffset = 1 - var(--progreso) por CSS,
 * sin medir longitudes en JS ni re-renderizar en scroll.
 */
export function Perfil({ ruta }: { ruta: Ruta }) {
  const d = construirPathVertical(ruta.perfil, ruta.km, { alto: 1000, xIzq: 8, xDer: 34 })
  return (
    <svg className="riel__svg" preserveAspectRatio="none" viewBox="0 0 40 1000" aria-hidden="true">
      <path className="riel__perfil-base" d={d} pathLength={1} />
      <path className="riel__perfil-hecho" d={d} pathLength={1} />
    </svg>
  )
}
