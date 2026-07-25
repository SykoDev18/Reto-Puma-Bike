import { useId } from 'react'
import type { Rama } from '../types/roadbook'
import { ORDEN_GRUPOS } from '../data/categorias'
import type { EstadoFiltros } from './EjeEdad'

/**
 * Filtros discretos, debajo del widget. NO ocultan filas: atenúan, para que la
 * estructura completa del eje siga visible. El estado vive en la URL.
 */
export function FiltrosCategorias({
  filtros,
  onCambio,
  coincidencias,
  total,
}: {
  filtros: EstadoFiltros
  onCambio: (cambios: Partial<EstadoFiltros>) => void
  coincidencias: number
  /** Siempre CATEGORIAS.length: ningún total escrito a mano. */
  total: number
}) {
  const idBusqueda = useId()
  const idGrupo = useId()
  const idRama = useId()
  const ramas: Array<{ valor: Rama | 'todas'; texto: string }> = [
    { valor: 'todas', texto: 'Todas' },
    { valor: 'V', texto: 'Varonil' },
    { valor: 'F', texto: 'Femenil' },
  ]

  return (
    <div className="filtros">
      <div className="campo">
        <span className="campo__rot" id={idRama}>
          Rama
        </span>
        <div className="selector" role="group" aria-labelledby={idRama}>
          {ramas.map((r) => (
            <button
              key={r.valor}
              type="button"
              aria-pressed={filtros.rama === r.valor}
              onClick={() => onCambio({ rama: r.valor })}
            >
              {r.texto}
            </button>
          ))}
        </div>
      </div>

      <div className="campo">
        <label className="campo__rot" htmlFor={idGrupo}>
          Grupo
        </label>
        <select
          id={idGrupo}
          className="campo__input"
          value={filtros.grupo}
          onChange={(e) => onCambio({ grupo: e.target.value })}
        >
          <option value="todos">Todos los grupos</option>
          {ORDEN_GRUPOS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="campo campo--ancho">
        <label className="campo__rot" htmlFor={idBusqueda}>
          Buscar por nombre o clave
        </label>
        <input
          id={idBusqueda}
          className="campo__input"
          type="search"
          value={filtros.busqueda}
          placeholder="Máster, EBF, Rodadores…"
          onChange={(e) => onCambio({ busqueda: e.target.value })}
        />
      </div>

      <p className="filtros__cuenta" aria-live="polite">
        <span className="cifra">{coincidencias}</span> de{' '}
        <span className="cifra">{total}</span> coinciden
      </p>
    </div>
  )
}
