import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'

type Nivel = 'h1' | 'h2' | 'h3'

/**
 * Título display (Anybody) cuyo eje de ANCHO se expande al entrar en vista
 * (font-stretch con transición). Con movimiento reducido nace expandido.
 */
export function TituloAncho({
  children,
  as = 'h2',
  className,
}: {
  children: ReactNode
  as?: Nivel
  className?: string
}) {
  const ref = useRef<HTMLHeadingElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) {
      el.classList.add('en-vista')
      return
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            el.classList.add('en-vista')
            observador.disconnect()
          }
        }
      },
      { threshold: 0.2 },
    )
    observador.observe(el)
    return () => observador.disconnect()
  }, [reduce])

  const cls = className ? `display expandible ${className}` : 'display expandible'
  switch (as) {
    case 'h1':
      return <h1 ref={ref} className={cls}>{children}</h1>
    case 'h3':
      return <h3 ref={ref} className={cls}>{children}</h3>
    default:
      return <h2 ref={ref} className={cls}>{children}</h2>
  }
}
