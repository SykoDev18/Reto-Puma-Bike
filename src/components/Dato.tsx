import type { ReactNode } from 'react'

/** Número medido: monoespaciada + color --crono. Solo para datos de GPS/crono. */
export function Dato({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={className ? `dato ${className}` : 'dato'}>{children}</span>
}
