import { useState } from 'react'
import type { NumeroControl, PayloadRegistro } from '../../types/registro'
import { CONFIG, urlWhatsApp } from '../../data/config'
import { mensajeResumen } from '../../lib/registro'
import { PlacaDorsal } from '../PlacaDorsal'

const nf = new Intl.NumberFormat('es-MX')

/** META · KM 74.5 — Confirmación. */
export function MetaConfirmacion({
  payload,
  onCorregir,
}: {
  payload: PayloadRegistro
  onCorregir: (control: NumeroControl) => void
}) {
  const [copiado, setCopiado] = useState(false)
  const p = payload.participante
  const nombreCompleto = `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno}`.trim()
  const rutaTexto =
    payload.competencia.ruta === 'infantil'
      ? 'Circuito infantil'
      : `${payload.competencia.ruta} km`

  const copiar = async () => {
    const texto = mensajeResumen(payload, CONFIG.evento)
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="meta">
      <p className="meta__rot">Lugar apartado</p>
      <h3 className="meta__titulo">Ya estás en la lista de salida</h3>

      <div className="meta__folio">
        <PlacaDorsal numero={payload.folio} etiqueta="folio" tono="oscuro" className="placa--folio" />
        <p className="serif medida">
          Guarda tu folio: con él se identifica tu registro en la entrega de kits. Tu número de
          corredor se asigna en ese momento.
        </p>
      </div>

      <dl className="resumen">
        <div>
          <dt>Competidor</dt>
          <dd>{nombreCompleto}</dd>
        </div>
        <div>
          <dt>Edad nominal</dt>
          <dd>
            <span className="cifra">{p.edad_nominal}</span> años
          </dd>
        </div>
        <div>
          <dt>Categoría</dt>
          <dd>
            {payload.competencia.categoria_clave} · {payload.competencia.categoria_nombre}
          </dd>
        </div>
        <div>
          <dt>Ruta</dt>
          <dd>
            {rutaTexto} · {payload.competencia.tipo_bicicleta}
          </dd>
        </div>
        <div>
          <dt>Kit</dt>
          <dd>
            {payload.kit.nombre} · <span className="cifra">${nf.format(payload.kit.precio)}</span>
            {payload.kit.talla_jersey !== null ? ` · talla ${payload.kit.talla_jersey}` : ''}
          </dd>
        </div>
        <div>
          <dt>Equipo</dt>
          <dd>{p.equipo}</dd>
        </div>
        <div>
          <dt>Contacto</dt>
          <dd>
            {p.email} · <span className="cifra">{p.telefono}</span>
          </dd>
        </div>
        <div>
          <dt>Emergencia</dt>
          <dd>
            {payload.emergencia.nombre} ·{' '}
            <span className="cifra">{payload.emergencia.telefono}</span>
            {payload.emergencia.tipo_sangre !== null ? ` · ${payload.emergencia.tipo_sangre}` : ''}
          </dd>
        </div>
      </dl>

      <div className="meta__acciones">
        <button className="boton boton--linea" type="button" onClick={copiar}>
          {copiado ? 'Datos copiados' : 'Copiar mis datos'}
        </button>
        <a
          className="boton boton--linea"
          href={urlWhatsApp(mensajeResumen(payload, CONFIG.evento))}
          target="_blank"
          rel="noreferrer"
        >
          Enviar por WhatsApp
        </a>
        <button className="enlace-duro" type="button" onClick={() => onCorregir(1)}>
          Corregir mis datos
        </button>
      </div>

      <p className="serif medida meta__nota">
        Te esperamos el {CONFIG.fechaTexto} a las {CONFIG.horaArranque} en el {CONFIG.salidaMeta},{' '}
        {CONFIG.sede}.
      </p>
    </div>
  )
}
