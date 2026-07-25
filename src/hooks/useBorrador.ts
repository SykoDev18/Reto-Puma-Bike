import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Borrador en sessionStorage. En Actopan la señal se cae y la gente recarga:
 * si se pierde todo, se pierde la inscripción. No restaura solo (sería
 * invasivo): avisa que hay un borrador y el usuario decide recuperarlo.
 */
export function useBorrador<T>(clave: string) {
  const [hayGuardado, setHayGuardado] = useState(false)
  const yaRevisado = useRef(false)

  useEffect(() => {
    if (yaRevisado.current) return
    yaRevisado.current = true
    try {
      setHayGuardado(window.sessionStorage.getItem(clave) !== null)
    } catch {
      setHayGuardado(false)
    }
  }, [clave])

  const guardar = useCallback(
    (datos: T) => {
      try {
        window.sessionStorage.setItem(clave, JSON.stringify(datos))
      } catch {
        // Modo privado o cuota llena: seguir sin borrador es aceptable.
      }
    },
    [clave],
  )

  /** Lee y valida en el borde: nunca confiamos en la forma de lo guardado. */
  const leer = useCallback(
    (validar: (valor: unknown) => T | null): T | null => {
      try {
        const texto = window.sessionStorage.getItem(clave)
        if (texto === null) return null
        return validar(JSON.parse(texto))
      } catch {
        return null
      }
    },
    [clave],
  )

  const olvidar = useCallback(() => {
    try {
      window.sessionStorage.removeItem(clave)
    } catch {
      // sin acción
    }
    setHayGuardado(false)
  }, [clave])

  return { hayGuardado, guardar, leer, olvidar }
}
