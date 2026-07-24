import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * Escribe el progreso de scroll [0..1] como custom property `--progreso` sobre
 * el ref, en un único listener con requestAnimationFrame. NO usa estado de
 * React: el árbol no se re-renderiza en cada frame. `onFrame` (opcional) recibe
 * el progreso para actualizar textos por DOM directo, nunca por setState.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  onFrame?: (progreso: number) => void,
): void {
  // Guardamos onFrame en un ref para no re-suscribir el listener cuando cambie
  // su identidad (p. ej. al cambiar de ruta).
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let raf = 0
    const medir = () => {
      raf = 0
      const alto = document.documentElement.scrollHeight - window.innerHeight
      const progreso = alto > 0 ? Math.min(1, Math.max(0, window.scrollY / alto)) : 0
      el.style.setProperty('--progreso', String(progreso))
      onFrameRef.current?.(progreso)
    }
    const alScroll = () => {
      if (!raf) raf = requestAnimationFrame(medir)
    }

    medir()
    window.addEventListener('scroll', alScroll, { passive: true })
    window.addEventListener('resize', alScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', alScroll)
      window.removeEventListener('resize', alScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [ref])
}
