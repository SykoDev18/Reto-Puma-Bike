import { useEffect, useRef, useState } from 'react'

type Estado = 'listo' | 'copiado' | 'falla'

/**
 * Copia un dato al portapapeles con confirmación VISIBLE (no solo un cambio de
 * ícono) y respaldo si el navegador la bloquea.
 *
 * `navigator.clipboard` solo existe en contexto seguro (https o localhost) y
 * puede fallar por permisos. Cuando falla no se finge éxito: se selecciona el
 * texto para que la persona lo copie a mano, que es lo que iba a hacer de todos
 * modos con una CLABE de 18 dígitos.
 */
export function BotonCopiar({
  valor,
  etiqueta,
  objetivoRef,
}: {
  valor: string
  /** Qué se copia, para el lector de pantalla: "Copiar la CLABE". */
  etiqueta: string
  /** Elemento con el texto, para seleccionarlo si el portapapeles falla. */
  objetivoRef?: React.RefObject<HTMLElement | null>
}) {
  const [estado, setEstado] = useState<Estado>('listo')
  const temporizador = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(temporizador.current), [])

  const anunciar = (siguiente: Estado) => {
    setEstado(siguiente)
    window.clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(() => setEstado('listo'), 2600)
  }

  const seleccionarComoRespaldo = () => {
    const nodo = objetivoRef?.current
    if (nodo === null || nodo === undefined) return
    const rango = document.createRange()
    rango.selectNodeContents(nodo)
    const seleccion = window.getSelection()
    seleccion?.removeAllRanges()
    seleccion?.addRange(rango)
  }

  const copiar = async () => {
    try {
      if (navigator.clipboard === undefined) throw new Error('sin portapapeles')
      await navigator.clipboard.writeText(valor)
      anunciar('copiado')
    } catch {
      seleccionarComoRespaldo()
      anunciar('falla')
    }
  }

  return (
    <span className="copiar">
      <button className="copiar__boton" type="button" onClick={copiar} data-estado={estado}>
        {estado === 'copiado' ? 'Copiado' : estado === 'falla' ? 'Selecciónalo' : 'Copiar'}
        <span className="visually-hidden">
          {' '}
          {etiqueta}
        </span>
      </button>
      {/* role=status: la confirmación se ANUNCIA, no solo se ve. */}
      <span className="visually-hidden" role="status">
        {estado === 'copiado'
          ? `${etiqueta} copiada al portapapeles`
          : estado === 'falla'
            ? `No se pudo copiar automáticamente. ${etiqueta} quedó seleccionada para copiarla a mano.`
            : ''}
      </span>
    </span>
  )
}
