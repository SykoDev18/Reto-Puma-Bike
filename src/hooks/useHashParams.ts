import { useCallback, useEffect, useState } from 'react'

/** Parte de ruta del hash: '#/categorias?rama=F' -> '/categorias'. */
export function rutaDelHash(hash: string): string {
  return hash.replace(/^#/, '').split('?')[0].replace(/\/$/, '') || '/'
}

/** Query del hash: '#/categorias?rama=F' -> 'rama=F'. */
function queryDelHash(hash: string): string {
  const i = hash.indexOf('?')
  return i < 0 ? '' : hash.slice(i + 1)
}

/**
 * Estado de filtros en la URL, dentro del hash, para poder compartir el enlace
 * por WhatsApp. Se escribe con replaceState: no ensucia el historial ni dispara
 * hashchange, así que cambiar un filtro no remonta la página.
 */
export interface OpcionesParams {
  /**
   * true = deja entrada en el historial (pushState), para que el botón "atrás"
   * del navegador retroceda de paso en vez de salir de la página.
   * false (por defecto) = replaceState, para filtros que no son navegación.
   */
  historial?: boolean
}

export function useHashParams(): [
  URLSearchParams,
  (cambios: Record<string, string | null>, opciones?: OpcionesParams) => void,
] {
  const [query, setQuery] = useState(() => queryDelHash(window.location.hash))

  // Si el hash cambia por fuera (botón atrás, un enlace compartido, otra
  // pestaña), hay que resincronizar: si no, los filtros se quedarían pegados a
  // un estado que la URL ya no dice.
  // `hashchange` cubre los enlaces; `popstate` cubre el botón atrás cuando el
  // paso se empujó con pushState (que no dispara hashchange).
  useEffect(() => {
    const alCambiar = () => setQuery(queryDelHash(window.location.hash))
    window.addEventListener('hashchange', alCambiar)
    window.addEventListener('popstate', alCambiar)
    return () => {
      window.removeEventListener('hashchange', alCambiar)
      window.removeEventListener('popstate', alCambiar)
    }
  }, [])

  const actualizar = useCallback(
    (cambios: Record<string, string | null>, opciones?: OpcionesParams) => {
      const params = new URLSearchParams(queryDelHash(window.location.hash))
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === null || valor === '') params.delete(clave)
        else params.set(clave, valor)
      }
      const texto = params.toString()
      const ruta = rutaDelHash(window.location.hash)
      const nuevoHash = texto ? `#${ruta}?${texto}` : `#${ruta}`
      if (opciones?.historial === true) {
        // pushState no dispara hashchange, así que sincronizamos a mano.
        window.history.pushState(null, '', nuevoHash)
      } else {
        window.history.replaceState(null, '', nuevoHash)
      }
      setQuery(texto)
    },
    [],
  )

  return [new URLSearchParams(query), actualizar]
}
