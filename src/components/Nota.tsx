import type { ReactNode } from 'react'
import type { Hito, TipoHito } from '../types/roadbook'
import { PlacaDorsal } from './PlacaDorsal'
import { TituloAncho } from './TituloAncho'

const TIPO_ROTULO: Record<TipoHito, string> = {
  salida: 'Salida',
  meta: 'Meta',
  abasto: 'Abastecimiento',
  poblado: 'Poblado',
  cima: 'Cima',
}

const nf = new Intl.NumberFormat('es-MX')

/** Nota del roadbook anclada a un kilómetro, con placa, rótulo y media opcional. */
export function Nota({
  hito,
  indice,
  desnivel,
  descripcion,
  media,
  activa,
}: {
  hito: Hito
  indice: number
  desnivel: number
  descripcion: string
  media?: ReactNode
  activa: boolean
}) {
  const kmTxt = Number.isInteger(hito.km) ? String(hito.km) : hito.km.toFixed(2)
  const nombre = hito.nombre.replace(' · Pabellón Gastronómico', '')

  return (
    <section className={activa ? 'nota activa' : 'nota'} data-nota-indice={indice}>
      <div className="nota__km">
        <PlacaDorsal numero={kmTxt} etiqueta="km" />
        <span className="rotulo">
          <span className="tipo">
            {TIPO_ROTULO[hito.tipo]}
            {hito.supuesto ? (
              <span className="flag" title="Kilómetro por confirmar con el comité">
                km supuesto
              </span>
            ) : null}
          </span>
          <span className="desnivel">+{nf.format(desnivel)} m acumulados</span>
        </span>
      </div>

      <div className={media ? 'nota__cuerpo' : 'nota__cuerpo nota__cuerpo--simple'}>
        <div>
          <TituloAncho as="h2">{nombre}</TituloAncho>
          {hito.nombre.includes('Pabellón') ? (
            <p className="medida">Pabellón Gastronómico, Actopan.</p>
          ) : null}
          <p className="serif">{descripcion}</p>
        </div>
        {media ? <div>{media}</div> : null}
      </div>
    </section>
  )
}
