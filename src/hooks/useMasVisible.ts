import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * De todos los elementos con `[data-visible-id]` dentro del contenedor, cuál es
 * el MÁS visible ahora mismo. Devuelve su id, o `null` si ninguno se ve.
 *
 * Existe por la regla del oro escaso (dirección §2): en Resultados hay 21
 * podios y el 1º de cada uno querría ir en --oro-puma. Con esto solo lo lleva
 * el podio que domina la pantalla y nunca hay dos dorados a la vez.
 *
 * El estado de React cambia en eventos DISCRETOS (cuando cambia el ganador),
 * no por frame de scroll: un IntersectionObserver con escalones, no un listener.
 */
export function useMasVisible(
  contenedorRef: RefObject<Element | null>,
  /**
   * Cambia cuando cambia el CONTENIDO observado. Es obligatorio: en Resultados
   * los podios no existen en el primer render (los datos llegan por fetch), así
   * que sin esto el efecto correría una sola vez sobre un contenedor vacío y no
   * habría oro nunca.
   */
  clave: string | number,
): string | null {
  const [id, setId] = useState<string | null>(null)

  useEffect(() => {
    const contenedor = contenedorRef.current
    if (contenedor === null) return

    const objetivos = contenedor.querySelectorAll('[data-visible-id]')
    if (objetivos.length === 0) return

    const razones = new Map<string, number>()

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          const clave = entrada.target.getAttribute('data-visible-id')
          if (clave !== null) razones.set(clave, entrada.intersectionRatio)
        }
        let mejor: string | null = null
        let mejorRazon = 0
        for (const [clave, razon] of razones) {
          if (razon > mejorRazon) {
            mejorRazon = razon
            mejor = clave
          }
        }
        setId((previo) => (previo === mejor ? previo : mejor))
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    )

    for (const objetivo of objetivos) observador.observe(objetivo)
    return () => observador.disconnect()
  }, [contenedorRef, clave])

  return id
}
