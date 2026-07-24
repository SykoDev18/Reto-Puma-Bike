import { useEffect, useState } from 'react'

/**
 * Detecta el hito (nota) activo con IntersectionObserver. El estado de React
 * cambia SOLO cuando cambia el índice activo, no en cada frame de scroll.
 * Observa elementos con `[data-nota-indice]`.
 */
export function useHitoActivo(cantidad: number): number {
  const [activo, setActivo] = useState<number>(0)

  useEffect(() => {
    const nodos = Array.from(
      document.querySelectorAll<HTMLElement>('[data-nota-indice]'),
    )
    if (nodos.length === 0) return

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue
          const indice = Number(entrada.target.getAttribute('data-nota-indice'))
          setActivo((prev) => (prev === indice ? prev : indice))
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
    nodos.forEach((nodo) => observador.observe(nodo))
    return () => observador.disconnect()
  }, [cantidad])

  return activo
}
