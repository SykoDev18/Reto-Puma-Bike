import type { Aviso } from '../types/anuncios'
import { ROTULO_TIPO } from '../types/anuncios'
import { fechaCorta } from '../lib/anuncios'

/**
 * Un comunicado del pizarrón de la meta: numerado, fechado y firmado por su
 * tipo. Es un papel clavado, no una tarjeta flotante — regla de 1px, radio 2px,
 * sin sombra.
 *
 * El texto es SIEMPRE texto: el flyer, si lo hay, acompaña. Así lo lee Google,
 * lo lee un lector de pantalla y se lee bien a 360px.
 */
export function TarjetaAviso({
  aviso,
  fijado,
  dorado,
  atenuado,
  resaltado,
  onAmpliar,
}: {
  aviso: Aviso
  /** Se muestra en la zona de fijados (vigente y marcado por el comité). */
  fijado: boolean
  /** Solo el primer fijado lleva el marcador en oro: uno por pantalla. */
  dorado: boolean
  /** El filtro atenúa, nunca oculta: la estructura completa sigue visible. */
  atenuado: boolean
  /** Se llegó por enlace directo (#/anuncios/012). */
  resaltado: boolean
  onAmpliar: (src: string, alt: string, pie: string) => void
}) {
  const enlaceDirecto = `#/anuncios/${aviso.id}`

  return (
    <article
      className="aviso-card"
      id={`aviso-${aviso.id}`}
      data-tipo={aviso.tipo}
      data-atenuado={atenuado ? 'si' : undefined}
      data-resaltado={resaltado ? 'si' : undefined}
      aria-labelledby={`aviso-titulo-${aviso.id}`}
    >
      <header className="aviso-card__cabeza">
        <p className="aviso-card__folio">
          {/* Folio y fecha SÍ van en --crono: son los datos duros del
              comunicado, lo que se cita cuando alguien pregunta "¿cuál aviso?". */}
          <span className="aviso-card__num dato">AVISO {aviso.id}</span>
          <span className="aviso-card__sep" aria-hidden="true">
            ·
          </span>
          <time className="dato" dateTime={aviso.fecha}>
            {fechaCorta(aviso.fecha)}
          </time>
        </p>
        <p className="aviso-card__marcas">
          {fijado ? (
            <span className="marca-fijado" data-oro={dorado ? 'si' : undefined}>
              Fijado
            </span>
          ) : null}
          <span className="marca-tipo">{ROTULO_TIPO[aviso.tipo]}</span>
        </p>
      </header>

      <h3 className="aviso-card__titulo" id={`aviso-titulo-${aviso.id}`}>
        {aviso.titulo}
      </h3>

      <p className="aviso-card__cuerpo serif">{aviso.cuerpo}</p>

      {aviso.imagen === undefined || aviso.imagenAlt === undefined ? null : (
        <figure className="aviso-card__flyer">
          {/* Ancho máximo controlado: los flyers son cuadrados y a sangre se
              ven mal, sobre todo en un celular. */}
          <button
            className="aviso-card__lupa"
            type="button"
            onClick={() => onAmpliar(aviso.imagen ?? '', aviso.imagenAlt ?? '', aviso.titulo)}
            aria-label={`Ampliar el flyer del aviso ${aviso.id}`}
          >
            <img src={aviso.imagen} alt={aviso.imagenAlt} loading="lazy" decoding="async" />
          </button>
        </figure>
      )}

      <footer className="aviso-card__pie">
        {aviso.enlace === undefined ? null : (
          <a className="enlace-duro" href={aviso.enlace.url}>
            {aviso.enlace.texto}
          </a>
        )}
        {/* El enlace directo es lo que se pega en el grupo de WhatsApp. */}
        <a className="aviso-card__permalink" href={enlaceDirecto}>
          <span className="visually-hidden">Enlace directo al aviso {aviso.id}</span>
          <span aria-hidden="true">#{aviso.id}</span>
        </a>
      </footer>
    </article>
  )
}
