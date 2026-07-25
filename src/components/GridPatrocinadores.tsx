import { PATROCINADORES } from '../data/patrocinadores'

/**
 * Rejilla de patrocinadores: solo logos, sin tarjetas, sin sombras y sin radio.
 * Escala de grises en reposo y color completo al hover/foco. Los principales
 * van primero y a mayor tamaño (el orden lo resuelve data/patrocinadores.ts).
 */
export function GridPatrocinadores() {
  return (
    <ul className="patrocinadores">
      {PATROCINADORES.map((p) => (
        <li
          key={p.slug}
          className={p.principal ? 'patrocinador patrocinador--principal' : 'patrocinador'}
        >
          <img src={p.logo} alt={p.nombre} loading="lazy" decoding="async" />
        </li>
      ))}
    </ul>
  )
}
