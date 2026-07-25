import type { Categoria, Grupo } from '../types/roadbook'
import { MAPA_RUTAS, NOMBRE_RUTA, ORDEN_GRUPOS } from '../data/categorias'

/**
 * Cómo se compite: grupo -> vueltas -> ruta asignada.
 * Las vueltas se DERIVAN de las categorías y la ruta sale de MAPA_RUTAS.
 * Nada de esto está escrito en el JSX.
 */
export function TablaCompetencia({ categorias }: { categorias: Categoria[] }) {
  const filas = ORDEN_GRUPOS.map((grupo: Grupo) => {
    const delGrupo = categorias.filter((c) => c.grupo === grupo)
    const vueltas = delGrupo.map((c) => c.vueltas)
    const min = Math.min(...vueltas)
    const max = Math.max(...vueltas)
    return {
      grupo,
      vueltas: min === max ? `${min}` : `${min} a ${max}`,
      rutas: MAPA_RUTAS[grupo].map((r) => NOMBRE_RUTA[r]).join(' o '),
    }
  })

  return (
    <table className="tabla">
      <caption className="visually-hidden">
        Vueltas y ruta asignada por grupo de categorías
      </caption>
      <thead>
        <tr>
          <th scope="col">Grupo</th>
          <th scope="col">Vueltas</th>
          <th scope="col">Ruta asignada</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.grupo}>
            <th scope="row">{f.grupo}</th>
            <td>
              <span className="cifra">{f.vueltas}</span> vueltas
            </td>
            <td>{f.rutas}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
