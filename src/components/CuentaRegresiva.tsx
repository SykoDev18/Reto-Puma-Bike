import { useEffect, useRef } from 'react'

interface Restante {
  dias: number
  reloj: string
  terminado: boolean
}

const dosDigitos = (n: number): string => String(n).padStart(2, '0')

/** Cálculo puro del tiempo restante hasta el arranque. */
function calcular(objetivoMs: number, ahoraMs: number): Restante {
  const delta = objetivoMs - ahoraMs
  if (delta <= 0) return { dias: 0, reloj: '00:00:00', terminado: true }
  const totalSeg = Math.floor(delta / 1000)
  const dias = Math.floor(totalSeg / 86400)
  const horas = Math.floor((totalSeg % 86400) / 3600)
  const minutos = Math.floor((totalSeg % 3600) / 60)
  const segundos = totalSeg % 60
  return {
    dias,
    reloj: `${dosDigitos(horas)}:${dosDigitos(minutos)}:${dosDigitos(segundos)}`,
    terminado: false,
  }
}

/**
 * Cuenta regresiva como lectura de instrumento: una sola línea en monoespaciada.
 * Sin cuadritos y sin fondo (dirección §8). El tick de cada segundo se escribe
 * por DOM directo sobre refs, así que no re-renderiza el árbol.
 */
export function CuentaRegresiva({ objetivoIso }: { objetivoIso: string }) {
  const objetivoMs = new Date(objetivoIso).getTime()
  const inicial = calcular(objetivoMs, Date.now())

  const diasRef = useRef<HTMLElement>(null)
  const relojRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const pintar = () => {
      const { dias, reloj } = calcular(objetivoMs, Date.now())
      if (diasRef.current) diasRef.current.textContent = String(dias)
      if (relojRef.current) relojRef.current.textContent = reloj
    }
    pintar()
    const id = window.setInterval(pintar, 1000)
    return () => window.clearInterval(id)
  }, [objetivoMs])

  if (inicial.terminado) {
    return (
      <p className="lectura">
        <span className="lectura__rot">El pelotón ya arrancó</span>
      </p>
    )
  }

  return (
    <p className="lectura" role="timer">
      <span className="lectura__rot">Faltan</span>
      <b className="dato" ref={diasRef}>
        {inicial.dias}
      </b>
      <span className="lectura__rot">días</span>
      <span className="lectura__sep" aria-hidden="true">
        ·
      </span>
      <b className="dato" ref={relojRef}>
        {inicial.reloj}
      </b>
    </p>
  )
}
