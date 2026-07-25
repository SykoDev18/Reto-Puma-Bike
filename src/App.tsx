import { lazy, Suspense, useEffect, useState } from 'react'
import { rutaDelHash } from './hooks/useHashParams'

// Carga diferida por página: el chunk inicial no arrastra las demás vistas.
// Vite hace el code-splitting con el import() dinámico.
const PaginaInicio = lazy(() =>
  import('./pages/PaginaInicio').then((m) => ({ default: m.PaginaInicio })),
)
const PaginaRuta = lazy(() => import('./pages/PaginaRuta').then((m) => ({ default: m.PaginaRuta })))
const PaginaCategorias = lazy(() =>
  import('./pages/PaginaCategorias').then((m) => ({ default: m.PaginaCategorias })),
)
const PaginaInscripciones = lazy(() =>
  import('./pages/PaginaInscripciones').then((m) => ({ default: m.PaginaInscripciones })),
)
const PaginaResultados = lazy(() =>
  import('./pages/PaginaResultados').then((m) => ({ default: m.PaginaResultados })),
)
const PaginaProximamente = lazy(() =>
  import('./pages/PaginaProximamente').then((m) => ({ default: m.PaginaProximamente })),
)

type Vista =
  | 'inicio'
  | 'ruta'
  | 'categorias'
  | 'inscripciones'
  | 'resultados'
  | 'coleccion'
  | 'hoteles'

/**
 * Enrutado por hash, sin dependencias. Ignora la query del hash
 * ('#/categorias?rama=F') para que cambiar un filtro no cambie de vista.
 */
function vistaDesdeHash(hash: string): Vista {
  switch (rutaDelHash(hash)) {
    case '/ruta':
      return 'ruta'
    case '/categorias':
      return 'categorias'
    case '/inscripciones':
      return 'inscripciones'
    case '/resultados':
      return 'resultados'
    case '/coleccion':
      return 'coleccion'
    case '/hoteles':
      return 'hoteles'
    default:
      return 'inicio'
  }
}

export default function App() {
  const [vista, setVista] = useState<Vista>(() => vistaDesdeHash(window.location.hash))

  useEffect(() => {
    const alCambiar = () => {
      const siguiente = vistaDesdeHash(window.location.hash)
      setVista((prev) => {
        if (prev === siguiente) return prev
        window.scrollTo({ top: 0, behavior: 'auto' })
        return siguiente
      })
    }
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])

  return (
    <Suspense fallback={<div className="cargando" role="status">Cargando el roadbook…</div>}>
      {vista === 'ruta' ? (
        <PaginaRuta />
      ) : vista === 'categorias' ? (
        <PaginaCategorias />
      ) : vista === 'inscripciones' ? (
        <PaginaInscripciones />
      ) : vista === 'resultados' ? (
        <PaginaResultados />
      ) : vista === 'coleccion' || vista === 'hoteles' ? (
        <PaginaProximamente seccion={vista} />
      ) : (
        <PaginaInicio />
      )}
    </Suspense>
  )
}
