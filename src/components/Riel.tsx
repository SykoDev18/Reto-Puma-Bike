import type { RefObject } from 'react'
import type { Ruta } from '../types/roadbook'
import { Perfil } from './Perfil'

/**
 * Riel fijo del roadbook: perfil de elevación, marcas de kilometraje y la
 * huella de puma. La huella y el trazo se mueven por CSS (var(--progreso));
 * solo el kilometraje de texto se actualiza por DOM directo (kmRef).
 */
export function Riel({ ruta, kmRef }: { ruta: Ruta; kmRef: RefObject<HTMLDivElement | null> }) {
  const marcas: number[] = []
  for (let km = 0; km <= ruta.km; km += 10) marcas.push(km)
  if (marcas[marcas.length - 1] !== Math.round(ruta.km)) marcas.push(ruta.km)

  return (
    <aside className="riel" aria-hidden="true">
      <Perfil ruta={ruta} />
      <div className="riel__ticks">
        {marcas.map((km) => (
          <div key={km} className="riel__tick" style={{ top: `${((km / ruta.km) * 100).toFixed(2)}%` }}>
            <span>{Math.round(km)}</span>
          </div>
        ))}
      </div>
      <div className="riel__huella">
        <svg viewBox="0 0 100 100">
          <g fill="currentColor">
            <path d="M50 92c-14 0-25-8-25-19 0-10 11-16 25-16s25 6 25 16c0 11-11 19-25 19z" />
            <ellipse cx="21" cy="47" rx="8" ry="12" />
            <ellipse cx="39" cy="33" rx="8.5" ry="13.5" />
            <ellipse cx="61" cy="33" rx="8.5" ry="13.5" />
            <ellipse cx="79" cy="47" rx="8" ry="12" />
          </g>
        </svg>
      </div>
      <div className="riel__km-actual" ref={kmRef}>KM 0</div>
    </aside>
  )
}
