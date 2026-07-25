import type { CategoriaResultado } from '../types/resultados'
import { diferenciaConPrimero, podio, tiempoDelPrimero } from '../lib/resultados'
import { PlacaDorsal } from './PlacaDorsal'

/**
 * Podio de UNA competencia. La clave es `categoria.id` (`N-40`, `N-80`): la
 * misma categoría corre dos rutas y son dos podios distintos. Fusionarlos sería
 * publicar resultados falsos.
 *
 * `dorado` lo decide la página: solo el podio que domina la pantalla pinta al
 * 1º en --oro-puma, para que nunca haya dos dorados a la vez (dirección §2).
 */
export function PodioCategoria({
  categoria,
  dorado,
}: {
  categoria: CategoriaResultado
  dorado: boolean
}) {
  const lugares = podio(categoria)
  const base = tiempoDelPrimero(categoria)

  return (
    <article className="podio" data-visible-id={categoria.id} id={`podio-${categoria.id}`}>
      <header className="podio__cabeza">
        <h3 className="podio__nombre">{categoria.nombre}</h3>
        <p className="podio__meta">
          <span className="dato">{categoria.ruta}</span> km
          <span className="podio__sep" aria-hidden="true">
            ·
          </span>
          {/* `cifra`: un conteo de personas no sale de un cronómetro. */}
          <span className="cifra">{categoria.corredores.length}</span> en competencia
          {categoria.clave_provisional ? (
            <span className="flag" title="Categoría fuera del catálogo del sistema">
              clave provisional
            </span>
          ) : null}
        </p>
      </header>

      {lugares.length === 0 ? (
        <p className="podio__vacio">Sin resultados publicados para esta categoría.</p>
      ) : (
        <ol className="podio__lista">
          {lugares.map((c, i) => {
            const diferencia = diferenciaConPrimero(c, base)
            const esPrimero = c.posicion === 1
            return (
              <li
                // El dorsal solo no basta como clave: hay dorsales repetidos.
                key={`${c.dorsal}-${c.posicion}-${i}`}
                className="podio__lugar"
                data-estado={c.estado}
                data-oro={esPrimero && dorado ? 'si' : undefined}
              >
                <PlacaDorsal
                  numero={c.posicion}
                  etiqueta="lugar"
                  variante={esPrimero && dorado ? 'placa--oro' : undefined}
                />
                <div className="podio__quien">
                  <p className="podio__corredor">
                    <span className="dato podio__dorsal">{c.dorsal}</span>
                    <b>{c.nombre}</b>
                  </p>
                  <p className="podio__tiempo">
                    {c.tiempo === null ? (
                      <span className="podio__sin">—</span>
                    ) : (
                      <span className="dato">{c.tiempo}</span>
                    )}
                    {/* Solo del 2º en adelante: la diferencia del 1º consigo
                        mismo no es información. */}
                    {!esPrimero && diferencia !== null ? (
                      <span className="dato podio__dif">{diferencia}</span>
                    ) : null}
                  </p>
                  {c.nota ? (
                    <p
                      className={
                        c.estado === 'REVISION' ? 'podio__nota podio__nota--revision' : 'podio__nota'
                      }
                    >
                      {c.nota}
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </article>
  )
}
