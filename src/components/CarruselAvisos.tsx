import { useId, useState } from 'react'

export interface Aviso {
  src: string
  alt: string
}

/**
 * Carrusel de avisos accesible: sin autoplay, navegable con teclado (flechas y
 * los propios botones), con la lámina anunciada por aria-live y el resto oculto
 * a la tecnología asistiva.
 */
export function CarruselAvisos({ avisos }: { avisos: Aviso[] }) {
  const [indice, setIndice] = useState(0)
  const idPanel = useId()
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
      aria-label="Avisos del evento"
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
          <img
            key={aviso.src}
            src={aviso.src}
            alt={aviso.alt}
            hidden={i !== indice}
            loading="lazy"
            decoding="async"
          />
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
              key={aviso.src}
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
