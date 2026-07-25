import { PlacaDorsal } from './PlacaDorsal'

const nf = new Intl.NumberFormat('es-MX')

/**
 * Marcador de kilómetro de una sección del Inicio. El km es una posición real
 * de la ruta larga y el desnivel se calcula del perfil, no se escribe a mano.
 */
export function HitoPagina({
  km,
  rotulo,
  desnivel,
}: {
  km: number
  rotulo: string
  desnivel: number
}) {
  const kmTexto = Number.isInteger(km) ? String(km) : km.toFixed(1)
  return (
    <div className="hito">
      <PlacaDorsal numero={kmTexto} etiqueta="km" variante="placa--clave" />
      <span className="hito__rotulo">
        <span className="hito__tipo">{rotulo}</span>
        <span className="hito__desnivel dato">+{nf.format(desnivel)} m acumulados</span>
      </span>
    </div>
  )
}
