import type { Categoria } from '../types/roadbook'
import { PlacaDorsal } from './PlacaDorsal'
import { plural } from '../lib/texto'
import type { EstadoFiltros } from './EjeEdad'
import { coincideConFiltros } from './EjeEdad'

// REGLA DE NEGOCIO A CONFIRMAR CON EL COMITÉ: edades mínimas de las categorías
// abiertas. Viven aquí (y en el motor de elegibilidad), no en el JSX de la página.
const MINIMO_ELITE = 16
const MINIMO_RODADORES = 13

/** Condición de acceso, derivada de los propios datos de la categoría. */
function condicion(c: Categoria): string {
  if (c.requiereEbike) return 'Requiere bicicleta eléctrica'
  if (c.requierePeso) return `${c.requierePeso} kg o más`
  if (c.nombre.startsWith('Elite')) return `Libre, desde ${MINIMO_ELITE} años`
  if (c.nombre.startsWith('Rodadores')) return `Recreativa, desde ${MINIMO_RODADORES} años`
  return c.descripcionEdad
}

/**
 * Banda de categorías SIN posición en el eje. Están fuera del eje porque no se
 * definen por edad, y esa ausencia es justamente el dato que comunica qué
 * significa "categoría abierta".
 */
export function BandaAbiertas({
  categorias,
  filtros,
}: {
  categorias: Categoria[]
  filtros: EstadoFiltros
}) {
  return (
    <ul className="abiertas">
      {categorias.map((c) => (
        <li
          className="abierta"
          key={c.id}
          data-atenuada={coincideConFiltros(c, filtros) ? undefined : 'si'}
        >
          <PlacaDorsal numero={c.clave} etiqueta="clave" variante="placa--clave" />
          <div className="abierta__cuerpo">
            <h3 className="abierta__nombre">{c.nombre}</h3>
            <p className="abierta__condicion">{condicion(c)}</p>
            <p className="abierta__meta medida">
              {c.grupo} · <span className="cifra">{c.vueltas}</span> {plural(c.vueltas, 'vuelta')}
            </p>
            <a className="enlace-duro" href={`#/inscripciones?categoria=${c.id}`}>
              Inscribirme
            </a>
          </div>
        </li>
      ))}
    </ul>
  )
}
