import type { RefObject } from 'react'

/**
 * Barra inferior persistente (móvil): kilometraje real que cambia al hacer
 * scroll. Los valores se escriben por DOM directo desde el rAF, sin setState.
 */
export function BarraKm({
  kmRef,
  desnivelRef,
  proxRef,
}: {
  kmRef: RefObject<HTMLElement | null>
  desnivelRef: RefObject<HTMLElement | null>
  proxRef: RefObject<HTMLSpanElement | null>
}) {
  return (
    <div className="barra-km" role="status" aria-live="off">
      <span>
        KM <b ref={kmRef}>0</b>
      </span>
      <span className="sep">·</span>
      <span>
        <b ref={desnivelRef}>+0</b> m
      </span>
      <span className="sep">·</span>
      <span>
        sig. <span className="prox" ref={proxRef} />
      </span>
    </div>
  )
}
