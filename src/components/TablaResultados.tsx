import { useMemo, useState } from 'react'
import type { CategoriaResultado, Corredor } from '../types/resultados'
import {
  clasificados,
  diferenciaConPrimero,
  ordenarCorredores,
  ROTULO_ESTADO,
  tiempoDelPrimero,
} from '../lib/resultados'
import type { CriterioOrden, SentidoOrden } from '../lib/resultados'

const COLUMNAS: Array<{ clave: CriterioOrden | null; rotulo: string }> = [
  { clave: 'posicion', rotulo: 'Pos' },
  { clave: 'dorsal', rotulo: 'Dorsal' },
  { clave: 'nombre', rotulo: 'Nombre' },
  { clave: null, rotulo: 'Vueltas' },
  { clave: null, rotulo: 'Tiempo' },
  { clave: null, rotulo: 'Dif' },
  { clave: null, rotulo: 'Estado' },
]

const ariaSort = (activa: boolean, sentido: SentidoOrden): 'ascending' | 'descending' | 'none' =>
  !activa ? 'none' : sentido === 'asc' ? 'ascending' : 'descending'

/**
 * Tabla completa de UNA categoría. `<table>` de verdad, con `<caption>` y
 * `<th scope>` — no divs: es una tabla de datos y los lectores de pantalla
 * necesitan la relación fila/encabezado.
 *
 * En móvil no se encoge ni se hace scroll horizontal: cada fila se re-maqueta
 * como tarjeta apilada, con el rótulo de la columna en `data-rot`.
 */
export function TablaResultados({
  categoria,
  resaltado,
}: {
  categoria: CategoriaResultado
  /** El corredor que llegó desde la búsqueda; se compara por identidad porque
      hay dorsales repetidos y el número no basta para distinguirlos. */
  resaltado: Corredor | null
}) {
  const [criterio, setCriterio] = useState<CriterioOrden>('posicion')
  const [sentido, setSentido] = useState<SentidoOrden>('asc')

  const filas = useMemo(
    () => ordenarCorredores(categoria.corredores, criterio, sentido),
    [categoria, criterio, sentido],
  )
  const base = useMemo(() => tiempoDelPrimero(categoria), [categoria])
  const enRevision = useMemo(
    () => categoria.corredores.some((c) => c.estado === 'REVISION'),
    [categoria],
  )
  const conPosicion = clasificados(categoria)

  const alternar = (clave: CriterioOrden) => {
    if (clave === criterio) setSentido((s) => (s === 'asc' ? 'desc' : 'asc'))
    else {
      setCriterio(clave)
      setSentido('asc')
    }
  }

  if (categoria.corredores.length === 0) {
    return (
      <div className="tabla-res__vacia">
        <p className="serif">Sin resultados publicados para esta categoría.</p>
      </div>
    )
  }

  return (
    <div className="tabla-res__marco">
      <table className="tabla-res">
        <caption className="tabla-res__caption">
          {/* Solo la ruta va en --crono: los conteos de personas son `cifra`. */}
          {categoria.nombre} · ruta de <span className="dato">{categoria.ruta}</span> km ·{' '}
          <span className="cifra">{categoria.corredores.length}</span> en competencia,{' '}
          <span className="cifra">{conPosicion}</span> con posición.
        </caption>
        <thead>
          <tr>
            {COLUMNAS.map((col) => {
              // A un const local sí le sobrevive el estrechamiento dentro del
              // closure del onClick; a `col.clave` no.
              const clave = col.clave
              const activa = clave !== null && clave === criterio
              return (
                <th
                  key={col.rotulo}
                  scope="col"
                  aria-sort={clave === null ? undefined : ariaSort(activa, sentido)}
                >
                  {clave === null ? (
                    col.rotulo
                  ) : (
                    <button
                      className="tabla-res__orden"
                      type="button"
                      onClick={() => alternar(clave)}
                      data-activa={activa ? 'si' : undefined}
                    >
                      {col.rotulo}
                      {/* ↑ ↓ · están en el subconjunto de la fuente; los
                          triángulos geométricos no, y caerían a otra tipografía. */}
                      <span aria-hidden="true" className="tabla-res__flecha">
                        {activa ? (sentido === 'asc' ? '↑' : '↓') : '·'}
                      </span>
                    </button>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {filas.map((c, i) => {
            const diferencia = diferenciaConPrimero(c, base)
            const esResaltado = resaltado !== null && c === resaltado
            return (
              <tr
                key={`${c.dorsal}-${c.posicion}-${i}`}
                data-estado={c.estado}
                data-resaltado={esResaltado ? 'si' : undefined}
                aria-current={esResaltado ? 'true' : undefined}
                id={esResaltado ? 'fila-resaltada' : undefined}
              >
                <th scope="row" data-rot="Pos">
                  {c.posicion === null ? (
                    <span className="tabla-res__vacio">—</span>
                  ) : (
                    <span className="dato">{c.posicion}</span>
                  )}
                </th>
                <td data-rot="Dorsal">
                  <span className="dato">{c.dorsal}</span>
                </td>
                <td data-rot="Nombre" className="tabla-res__nombre">
                  {c.nombre}
                </td>
                <td data-rot="Vueltas">
                  {/* Dato medido: va en --crono, como el tiempo. */}
                  <span className="dato">
                    {c.vueltas_hechas}/{c.vueltas_totales}
                  </span>
                </td>
                <td data-rot="Tiempo">
                  {c.tiempo === null ? (
                    <span className="tabla-res__vacio">—</span>
                  ) : (
                    <span className="dato">{c.tiempo}</span>
                  )}
                </td>
                <td data-rot="Dif">
                  {diferencia === null ? (
                    <span className="tabla-res__vacio">—</span>
                  ) : (
                    <span className="dato">{diferencia}</span>
                  )}
                </td>
                <td data-rot="Estado" className="tabla-res__estado">
                  <span className="tabla-res__rotulo-estado">{ROTULO_ESTADO[c.estado]}</span>
                  {c.nota ? <span className="tabla-res__nota">{c.nota}</span> : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {enRevision ? (
        <p className="tabla-res__pie">
          Los resultados marcados están en revisión por el comité de cronometraje.
        </p>
      ) : null}
    </div>
  )
}
