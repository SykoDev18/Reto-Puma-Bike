import type { Control, NumeroControl } from '../types/registro'
import type { Ruta } from '../types/roadbook'
import { Perfil } from './Perfil'
import { HuellaPuma } from './HuellaPuma'

/**
 * Progreso del formulario sobre el PERFIL DE ELEVACIÓN del sitio, no una barra.
 * Cada control es un control de paso anclado a un kilómetro real, y la huella
 * marca dónde vas. Reutiliza <Perfil> en su variante horizontal.
 */
export function ControlProgreso({
  ruta,
  controles,
  actual,
  sellados,
  onIr,
}: {
  ruta: Ruta
  controles: Control[]
  actual: NumeroControl
  /** Controles ya completados: se marcan como sellados. */
  sellados: Set<NumeroControl>
  onIr: (control: NumeroControl) => void
}) {
  const pos = (km: number) => `${Math.min(100, (km / ruta.km) * 100).toFixed(2)}%`
  const kmActual = controles.find((c) => c.numero === actual)?.km ?? 0

  return (
    <div className="progreso">
      <div className="progreso__perfil">
        <Perfil ruta={ruta} orientacion="horizontal" className="progreso__linea" />
        <span className="progreso__huella" style={{ left: pos(kmActual) }}>
          <HuellaPuma />
        </span>
      </div>

      <ol className="progreso__controles">
        {controles.map((control) => {
          const sellado = sellados.has(control.numero)
          const esActual = control.numero === actual
          const alcanzable = sellado || esActual
          return (
            <li
              key={control.numero}
              className="progreso__control"
              style={{ left: pos(control.km) }}
              data-estado={esActual ? 'actual' : sellado ? 'sellado' : 'pendiente'}
            >
              <button
                type="button"
                className="progreso__punto"
                onClick={() => onIr(control.numero)}
                disabled={!alcanzable}
                aria-current={esActual ? 'step' : undefined}
              >
                <span className="visually-hidden">
                  {esActual ? 'Control actual: ' : sellado ? 'Control completado: ' : 'Control pendiente: '}
                  {control.titulo}
                </span>
              </button>
              <span className="progreso__rotulo" aria-hidden="true">
                <span className="progreso__km dato">KM {control.km === 74.48 ? '74.5' : control.km}</span>
                <span className="progreso__titulo">{control.titulo}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
