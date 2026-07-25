import { CONFIG, urlWhatsApp } from '../data/config'

const MENSAJE = `Hola, quiero pre-registrarme a la quinta edición del ${CONFIG.evento}. Avísenme en cuanto abran inscripciones.`

/**
 * Pre-registro a la 5ª edición. Deliberadamente discreto y SIN fecha: no hay
 * fecha confirmada y ponerle una inventada es peor que no ponerla. Solo
 * WhatsApp, que es por donde el comité contesta de verdad.
 *
 * No lleva oro: el oro de la pantalla pertenece a la placa del 1º lugar.
 */
export function PreRegistroQuinta({ titulo = 'La quinta edición' }: { titulo?: string }) {
  return (
    <aside className="quinta">
      <p className="etiqueta">{titulo}</p>
      <p className="quinta__linea">
        {/* `cifra` y no `dato`: un año no sale de un cronómetro ni de un GPS,
            así que no le toca --crono (dirección §2). */}
        <span className="cifra">2027</span>
        <span className="quinta__sep" aria-hidden="true">
          ·
        </span>
        <span className="quinta__rot">fecha por confirmar</span>
      </p>
      <p className="serif medida quinta__texto">
        Escríbenos y te avisamos en cuanto abran inscripciones.
      </p>
      <a className="boton boton--linea" href={urlWhatsApp(MENSAJE)} target="_blank" rel="noreferrer">
        Avisarme por WhatsApp
      </a>
    </aside>
  )
}
