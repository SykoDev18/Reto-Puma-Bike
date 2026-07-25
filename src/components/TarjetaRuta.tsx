import type { Ruta } from '../types/roadbook'
import { Perfil } from './Perfil'
import { PlacaDorsal } from './PlacaDorsal'
import { TituloAncho } from './TituloAncho'

const nf = new Intl.NumberFormat('es-MX')

/**
 * Bloque horizontal de una ruta: placas de distancia y desnivel, mini-perfil
 * real (aria-hidden, con los mismos datos en texto), poblados y enlace a Ruta.
 */
export function TarjetaRuta({
  ruta,
  poblados,
  dificultad,
}: {
  ruta: Ruta
  poblados: string[]
  dificultad: string
}) {
  return (
    <article className="ruta-bloque">
      <div className="ruta-bloque__cabeza">
        <TituloAncho as="h3" className="display--ancho ruta-bloque__titulo">
          {ruta.etiqueta}
        </TituloAncho>
        <div className="placas">
          <PlacaDorsal numero={nf.format(ruta.km)} etiqueta="km" />
          <PlacaDorsal numero={`+${nf.format(ruta.desnivel)}`} etiqueta="m desnivel" />
        </div>
      </div>

      <div className="ruta-bloque__cuerpo">
        <Perfil ruta={ruta} orientacion="horizontal" />
        <p className="ruta-bloque__poblados">
          {poblados.map((nombre, i) => (
            <span key={nombre}>
              {i > 0 ? <span className="lectura__sep"> · </span> : null}
              {nombre}
            </span>
          ))}
        </p>
        <p className="ruta-bloque__meta medida serif">
          100% camino ancho y rodable. Dificultad {dificultad}.
        </p>
        <a className="enlace-duro" href="#/ruta">
          Ver el roadbook completo
        </a>
      </div>
    </article>
  )
}
