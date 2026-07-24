import type { ReactNode } from 'react'

/**
 * Franja a fondo claro (§3) por herencia de custom properties: invierte
 * --fondo/--texto-color para sus descendientes. Ningún hijo necesita saber
 * en qué franja vive. (Se usará en Patrocinadores, Colección y Formulario.)
 */
export function FranjaClara({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={className ? `superficie superficie--clara ${className}` : 'superficie superficie--clara'}>
      {children}
    </section>
  )
}
