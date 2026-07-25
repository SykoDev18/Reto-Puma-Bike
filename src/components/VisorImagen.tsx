import { useCallback, useEffect, useRef, useState } from 'react'

export interface ImagenAmpliable {
  src: string
  alt: string
  /** Pie opcional, se repite dentro del visor. */
  pie?: string
}

/**
 * Visor de ampliación. UN solo componente para Colección y Anuncios: son la
 * misma necesidad (ver un flyer o una prenda en grande) y duplicarlo garantizaría
 * que uno de los dos se quede sin el manejo de foco.
 *
 * Sin librerías de lightbox. Hace lo que hace falta y nada más:
 * - cierra con Esc y con clic en el fondo,
 * - ATRAPA el foco mientras está abierto (Tab cicla entre cerrar y la imagen),
 * - devuelve el foco al elemento que lo abrió,
 * - bloquea el scroll del fondo.
 */
export function VisorImagen({
  imagen,
  onCerrar,
}: {
  imagen: ImagenAmpliable | null
  onCerrar: () => void
}) {
  const dialogoRef = useRef<HTMLDivElement>(null)
  const cerrarRef = useRef<HTMLButtonElement>(null)
  const previoRef = useRef<Element | null>(null)

  const abierto = imagen !== null

  useEffect(() => {
    if (!abierto) return

    // Quién tenía el foco antes, para devolvérselo al cerrar.
    previoRef.current = document.activeElement
    cerrarRef.current?.focus()

    const desbordeAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCerrar()
        return
      }
      if (e.key !== 'Tab') return

      // Trampa de foco: sin esto, tabular saca al usuario al fondo de la página
      // mientras el visor sigue abierto y tapando todo.
      const foco = dialogoRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], img[tabindex="0"], [tabindex]:not([tabindex="-1"])',
      )
      if (foco === undefined || foco.length === 0) return
      const primero = foco[0]
      const ultimo = foco[foco.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = desbordeAnterior
      if (previoRef.current instanceof HTMLElement) previoRef.current.focus()
    }
  }, [abierto, onCerrar])

  if (imagen === null) return null

  return (
    <div
      className="visor"
      role="dialog"
      aria-modal="true"
      aria-label={imagen.alt}
      ref={dialogoRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <div className="visor__caja">
        <button className="visor__cerrar" type="button" onClick={onCerrar} ref={cerrarRef}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l14 14M15 1L1 15" />
          </svg>
          <span className="visually-hidden">Cerrar el visor</span>
        </button>
        <img className="visor__img" src={imagen.src} alt={imagen.alt} />
        {imagen.pie === undefined ? null : <p className="visor__pie">{imagen.pie}</p>}
      </div>
    </div>
  )
}

/**
 * Estado del visor + el disparador. Devuelve las props que van a un <button>
 * que envuelve la miniatura, para que ampliar funcione con clic Y con teclado
 * sin que cada página lo vuelva a resolver.
 */
export function useVisor() {
  const [imagen, setImagen] = useState<ImagenAmpliable | null>(null)
  const cerrar = useCallback(() => setImagen(null), [])
  const abrir = useCallback((img: ImagenAmpliable) => setImagen(img), [])
  return { imagen, abrir, cerrar }
}
