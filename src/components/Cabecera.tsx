import { useState } from 'react'
import { CONFIG, urlWhatsApp } from '../data/config'
import logo from '../assets/logo_retopuma.webp'

export type ClavePagina =
  | 'inicio'
  | 'ruta'
  | 'categorias'
  | 'inscripciones'
  | 'resultados'
  | 'coleccion'
  | 'anuncios'
  | 'hoteles'

interface Pagina {
  clave: ClavePagina
  href: string
  nombre: string
  /**
   * Kilómetro REAL de la ruta larga donde vive esa parada del roadbook en el
   * Inicio. Solo lo llevan las entradas que están ancladas a un kilómetro
   * verdadero: numerar por decorar está prohibido (dirección §5).
   */
  km?: string
}

// Todo el índice vive ya en la app React (hash routing). Colección y Hoteles
// aún no tienen página: van a una ruta "Próximamente" honesta en vez de caer al
// fallback del router y mostrar el Inicio como si fueran esa sección.
const PAGINAS: Pagina[] = [
  { clave: 'inicio', href: '#/', nombre: 'Inicio', km: '0.0' },
  { clave: 'ruta', href: '#/ruta', nombre: 'Ruta', km: '8.4' },
  { clave: 'categorias', href: '#/categorias', nombre: 'Categorías', km: '22.1' },
  { clave: 'inscripciones', href: '#/inscripciones', nombre: 'Inscripciones', km: '48.9' },
  { clave: 'resultados', href: '#/resultados', nombre: 'Resultados', km: '74.5' },
  { clave: 'anuncios', href: '#/anuncios', nombre: 'Avisos' },
  { clave: 'coleccion', href: '#/coleccion', nombre: 'Colección' },
  { clave: 'hoteles', href: '#/hoteles', nombre: 'Hoteles' },
]

/**
 * Índice del roadbook. El CTA solo se pinta en oro cuando `ctaDorado` es true:
 * mientras el hero es visible, el oro vive allá y aquí queda en cal con borde.
 * Así nunca hay dos elementos dorados en la misma pantalla (dirección §2).
 */
export function Cabecera({
  paginaActual,
  ctaDorado = true,
}: {
  paginaActual?: ClavePagina
  ctaDorado?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const postevento = CONFIG.estado === 'postevento'

  // Ya corrida la edición, el CTA lleva a Resultados. Dentro de Resultados eso
  // sería un enlace a sí mismo, así que ahí el CTA pasa al pre-registro de la 5ª.
  const enResultados = paginaActual === 'resultados'
  const ctaHref = !postevento
    ? '#/inscripciones'
    : enResultados
      ? urlWhatsApp(`Hola, quiero que me avisen cuando abran las inscripciones de la 5ª edición del ${CONFIG.evento}.`)
      : '#/resultados'
  const ctaTexto = !postevento ? 'Inscríbete' : enResultados ? 'Avísame de la 5ª' : 'Ver resultados'
  const ctaExterno = postevento && enResultados

  return (
    <header className="cabecera">
      <div className="cabecera__fila">
        <a className="marca" href="#/" aria-label={`${CONFIG.evento}, inicio`}>
          <span className="marca__placa">
            <img src={logo} alt="" width="40" height="40" />
          </span>
          <span className="marca__nombre">
            {CONFIG.evento}
            <small>
              {CONFIG.edicion} · {CONFIG.sede.split(',')[0]}
            </small>
          </span>
        </a>

        <button
          className="nav-toggle"
          type="button"
          aria-expanded={abierto}
          aria-controls="nav-indice"
          onClick={() => setAbierto((v) => !v)}
        >
          <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M0 1h20M0 7h20M0 13h20" />
          </svg>
          <span className="visually-hidden">Abrir menú</span>
        </button>

        <nav
          className={abierto ? 'nav-indice abierto' : 'nav-indice'}
          id="nav-indice"
          aria-label="Navegación principal"
          onClick={() => setAbierto(false)}
        >
          {PAGINAS.map((p) => (
            <a
              key={p.clave}
              href={p.href}
              aria-current={p.clave === paginaActual ? 'page' : undefined}
              // Ya corrida la edición, Resultados es lo que la gente viene a
              // buscar: se destaca en el índice. No en oro (ese lo tiene el CTA),
              // sino en --cal con una marca de 2px.
              data-destacado={postevento && p.clave === 'resultados' ? 'si' : undefined}
            >
              {p.km ? <span className="km">KM {p.km}</span> : null}
              <span className="n">{p.nombre}</span>
            </a>
          ))}
        </nav>

        <a
          className={`boton ${ctaDorado ? 'boton--oro' : 'boton--linea'} boton--chico`}
          href={ctaHref}
          target={ctaExterno ? '_blank' : undefined}
          rel={ctaExterno ? 'noreferrer' : undefined}
        >
          {ctaTexto}
        </a>
      </div>
    </header>
  )
}
