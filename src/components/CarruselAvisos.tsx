import { useEffect, useId, useState } from 'react'
import type { Aviso } from '../types/anuncios'
import { ROTULO_TIPO } from '../types/anuncios'
import { cargarAnuncios, fechaCorta, masRecientes } from '../lib/anuncios'

/** Hoy en ISO local: la vigencia se compara por día, sin hora ni zona. */
function hoyIso(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/**
 * Los tres avisos más recientes del Inicio.
 *
 * Antes esto eran tres imágenes sueltas con `alt` escritos a mano en la página
 * — y los tres estaban mal: describían flyers de ediciones pasadas como si
 * fueran de esta. Ahora consume EXACTAMENTE los mismos datos que la página de
 * Anuncios (`/data/anuncios.json`), así que no hay dos fuentes que se
 * contradigan y el texto es texto de verdad, no pixeles.
 *
 * Sin autoplay y navegable con teclado: la lámina activa se anuncia por
 * aria-live y el resto queda oculto a la tecnología asistiva.
 */
export function CarruselAvisos() {
  const [avisos, setAvisos] = useState<Aviso[] | null>(null)
  const [indice, setIndice] = useState(0)
  const idPanel = useId()

  useEffect(() => {
    let vivo = true
    cargarAnuncios()
      .then((datos) => {
        if (vivo) setAvisos(masRecientes(datos.avisos, hoyIso(), 3))
      })
      // El Inicio no se rompe si los avisos fallan: simplemente no se pintan.
      .catch(() => {
        if (vivo) setAvisos([])
      })
    return () => {
      vivo = false
    }
  }, [])

  if (avisos === null) {
    return (
      <p className="carrusel__cargando" role="status">
        Cargando avisos…
      </p>
    )
  }
  if (avisos.length === 0) return null

  const ir = (siguiente: number) => {
    const total = avisos.length
    setIndice(((siguiente % total) + total) % total)
  }

  return (
    <div
      className="carrusel"
      role="group"
      aria-roledescription="carrusel"
      aria-label="Avisos recientes del comité"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          ir(indice + 1)
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          ir(indice - 1)
        }
      }}
    >
      <div className="carrusel__marco" id={idPanel} aria-live="polite">
        {avisos.map((aviso, i) => (
          <article className="lamina" key={aviso.id} hidden={i !== indice}>
            <p className="lamina__folio">
              <span className="dato">AVISO {aviso.id}</span>
              <span className="lamina__sep" aria-hidden="true">
                ·
              </span>
              <time className="dato" dateTime={aviso.fecha}>
                {fechaCorta(aviso.fecha)}
              </time>
              <span className="lamina__tipo">{ROTULO_TIPO[aviso.tipo]}</span>
            </p>
            <h3 className="lamina__titulo">{aviso.titulo}</h3>
            <p className="lamina__cuerpo serif">{aviso.cuerpo}</p>
            <a className="enlace-duro lamina__ir" href={`#/anuncios/${aviso.id}`}>
              Leer el aviso completo
            </a>
          </article>
        ))}
      </div>

      <div className="carrusel__mando">
        <button
          className="carrusel__flecha"
          type="button"
          onClick={() => ir(indice - 1)}
          aria-controls={idPanel}
        >
          <svg width="18" height="12" viewBox="0 0 18 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 6H1M6 1L1 6l5 5" />
          </svg>
          <span className="visually-hidden">Aviso anterior</span>
        </button>

        <span className="carrusel__puntos">
          {avisos.map((aviso, i) => (
            <button
              key={aviso.id}
              className={i === indice ? 'punto punto--activo' : 'punto'}
              type="button"
              aria-current={i === indice}
              aria-controls={idPanel}
              onClick={() => ir(i)}
            >
              <span className="visually-hidden">
                Aviso {i + 1} de {avisos.length}
              </span>
            </button>
          ))}
        </span>

        <button
          className="carrusel__flecha"
          type="button"
          onClick={() => ir(indice + 1)}
          aria-controls={idPanel}
        >
          <svg width="18" height="12" viewBox="0 0 18 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 6h16M12 1l5 5-5 5" />
          </svg>
          <span className="visually-hidden">Aviso siguiente</span>
        </button>
      </div>
    </div>
  )
}
