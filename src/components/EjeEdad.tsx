import type { Categoria, Rama } from '../types/roadbook'
import type { Eje } from '../lib/eje'
import { longitudBarra } from '../lib/eje'
import { plural } from '../lib/texto'
import { PlacaDorsal } from './PlacaDorsal'
import { HuellaPuma } from './HuellaPuma'

export interface EstadoFiltros {
  rama: Rama | 'todas'
  grupo: string
  busqueda: string
}

/** ¿La categoría pasa los filtros? Si no, se ATENÚA (nunca se oculta). */
export function coincideConFiltros(categoria: Categoria, filtros: EstadoFiltros): boolean {
  if (filtros.rama !== 'todas' && categoria.rama !== filtros.rama) return false
  if (filtros.grupo !== 'todos' && categoria.grupo !== filtros.grupo) return false
  const q = filtros.busqueda.trim().toLocaleLowerCase('es-MX')
  if (q !== '') {
    const heno = `${categoria.nombre} ${categoria.clave}`.toLocaleLowerCase('es-MX')
    if (!heno.includes(q)) return false
  }
  return true
}

/**
 * El eje de edad: una sola grilla CSS. La POSICIÓN de cada categoría es su
 * tramo real de edad y la LONGITUD de la barra es proporcional a los años que
 * cubre. Las barras son enlaces (accesibles por teclado, sin un solo listener
 * de JS): el detalle aparece con :hover y :focus-visible por CSS.
 */
export function EjeEdad({
  eje,
  filtros,
  recomendadaId,
  ramaResaltada,
  edadMarcador,
  filaMarcador,
  ramaMovil,
}: {
  eje: Eje
  filtros: EstadoFiltros
  recomendadaId: number | null
  ramaResaltada: Rama | null
  edadMarcador: number | null
  filaMarcador: number
  ramaMovil: Rama
}) {
  const barrasDe = (rama: Rama) => eje.barras.filter((b) => b.categoria.rama === rama)

  return (
    <div
      className="eje"
      data-rama-resaltada={ramaResaltada ?? undefined}
      data-rama-movil={ramaMovil}
      style={{ ['--filas' as string]: eje.filas.length }}
    >
      <p className="eje__cabeza eje__cabeza--v">Varonil</p>
      <p className="eje__cabeza eje__cabeza--edad">Edad</p>
      <p className="eje__cabeza eje__cabeza--f">Femenil</p>

      {/* Carril central: las marcas de edad. Los números son datos medidos. */}
      {eje.filas.map((fila, i) => (
        <span
          key={fila.etiqueta}
          className="eje__marca"
          style={{ gridRow: i + 2 }}
        >
          <span className="dato">{fila.etiqueta}</span>
        </span>
      ))}

      {/* Marcador de la persona: la huella sobre su tramo, con la edad en placa. */}
      {edadMarcador !== null && filaMarcador >= 0 ? (
        <span
          className="eje__marcador"
          style={{ gridRow: filaMarcador + 2 }}
          data-lado={ramaResaltada ?? 'V'}
        >
          <HuellaPuma className="eje__huella" />
          <PlacaDorsal numero={edadMarcador} etiqueta="años" variante="placa--clave" />
        </span>
      ) : null}

      {/* Barras por rama */}
      {(['V', 'F'] as Rama[]).map((rama) =>
        barrasDe(rama).map((barra) => {
          const c = barra.categoria
          const atenuada = !coincideConFiltros(c, filtros)
          return (
            <a
              key={c.id}
              className="barra"
              href={`#/inscripciones?categoria=${c.id}`}
              data-rama={rama}
              data-grupo={c.grupo}
              data-atenuada={atenuada ? 'si' : undefined}
              data-recomendada={c.id === recomendadaId ? 'si' : undefined}
              style={{
                gridRow: `${barra.filaInicio + 2} / ${barra.filaFin + 3}`,
                ['--largo' as string]: `${longitudBarra(barra, eje)}%`,
              }}
            >
              <PlacaDorsal numero={c.clave} etiqueta="clave" variante="placa--clave" />
              <span className="barra__texto">
                <span className="barra__nombre">{c.nombre}</span>
                <span className="barra__meta">
                  <span className="dato">{c.descripcionEdad}</span> ·{' '}
                  <span className="cifra">{c.vueltas}</span> {plural(c.vueltas, 'vuelta')}
                  {/* Grupo y rodada solo al hover/foco: en móvil alargarían la barra. */}
                  <span className="barra__detalle">
                    {' '}
                    · {c.grupo}
                    {c.rodadas ? ` · rodada ${c.rodadas}` : ''}
                  </span>
                </span>
              </span>
            </a>
          )
        }),
      )}

      {/* Huecos de los datos: dibujados, no tapados. */}
      {eje.huecos.map((hueco) => (
        <div
          key={`${hueco.rama}-${hueco.etiqueta}`}
          className="hueco"
          data-rama={hueco.rama}
          style={{ gridRow: `${hueco.filaInicio + 2} / ${hueco.filaFin + 3}` }}
        >
          <p className="hueco__titulo">Sin categoría por edad</p>
          <p className="hueco__texto">
            Se compite en Elite {hueco.rama === 'F' ? 'Femenil' : 'Varonil'} o Rodadores{' '}
            {hueco.rama === 'F' ? 'Femenil' : 'Varonil'}.
          </p>
        </div>
      ))}
    </div>
  )
}
