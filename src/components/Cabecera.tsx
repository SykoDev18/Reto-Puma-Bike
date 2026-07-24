import { useState } from 'react'
import logo from '../assets/logo_retopuma.webp'

interface Pagina {
  href: string
  nombre: string
  actual?: boolean
}

// Durante la migración: "Ruta" es la app React (/). El resto apunta a las
// páginas heredadas hasta migrarlas. Sin kilómetros decorativos en el menú:
// los km verdaderos viven en el riel.
const PAGINAS: Pagina[] = [
  { href: '/', nombre: 'Inicio' },
  { href: '/', nombre: 'Ruta', actual: true },
  { href: 'categorias.html', nombre: 'Categorías' },
  { href: 'inscripciones.html', nombre: 'Inscripciones' },
  { href: 'resultados.html', nombre: 'Resultados' },
  { href: 'coleccion.html', nombre: 'Colección' },
  { href: 'hoteles.html', nombre: 'Hoteles' },
]

export function Cabecera() {
  const [abierto, setAbierto] = useState(false)

  return (
    <header className="cabecera">
      <div className="cabecera__fila">
        <a className="marca" href="/" aria-label="Reto Puma Bike, inicio">
          <span className="marca__placa">
            <img src={logo} alt="" />
          </span>
          <span className="marca__nombre">
            Reto Puma Bike
            <small>Cuarta edición · Actopan</small>
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
            <a key={p.nombre} href={p.href} aria-current={p.actual ? 'page' : undefined}>
              <span className="n">{p.nombre}</span>
            </a>
          ))}
        </nav>

        <a className="boton boton--oro boton--chico" href="inscripciones.html">
          Inscríbete
        </a>
      </div>
    </header>
  )
}
