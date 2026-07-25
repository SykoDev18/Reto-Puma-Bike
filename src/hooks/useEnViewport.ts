import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * ¿El elemento está visible en el viewport? Cambio DISCRETO (no por frame):
 * el estado de React solo se actualiza cuando entra o sale, con
 * IntersectionObserver y nunca con la posición del scroll.
 *
 * Se usa para coordinar el único elemento en oro de la pantalla: mientras el
 * hero es visible, el oro vive en su CTA; cuando sale, pasa al de la cabecera.
 */
export function useEnViewport(ref: RefObject<Element | null>, margen = '0px'): boolean {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          setVisible((prev) => (prev === entrada.isIntersecting ? prev : entrada.isIntersecting))
        }
      },
      { threshold: 0, rootMargin: margen },
    )
    observador.observe(el)
    return () => observador.disconnect()
  }, [ref, margen])

  return visible
}
