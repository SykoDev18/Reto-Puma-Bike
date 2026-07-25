import { CONFIG, urlWhatsApp } from '../data/config'

const NAVEGA: Array<{ href: string; nombre: string }> = [
  { href: '#/', nombre: 'Inicio' },
  { href: '#/ruta', nombre: 'Ruta' },
  { href: '#/categorias', nombre: 'Categorías' },
  { href: '#/inscripciones', nombre: 'Inscripciones' },
  { href: '#/resultados', nombre: 'Resultados' },
  { href: '#/anuncios', nombre: 'Avisos' },
  { href: '#/coleccion', nombre: 'Colección' },
  { href: '#/hoteles', nombre: 'Hoteles' },
]

/** Pie compartido por todas las páginas. El año se calcula en runtime. */
export function PieSitio() {
  return (
    <footer className="pie">
      <div className="contenedor">
        <div className="pie__grid">
          <div>
            <h2>{CONFIG.evento}</h2>
            <p>
              Más que una competencia: un desafío, una conexión y una celebración de cada kilómetro
              del Valle del Mezquital.
            </p>
          </div>
          <div>
            <h3>Navega</h3>
            <ul>
              {NAVEGA.map((p) => (
                <li key={p.nombre}>
                  <a href={p.href}>{p.nombre}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Contacto</h3>
            <ul>
              <li>
                <a
                  href={urlWhatsApp(`Hola, quiero información del ${CONFIG.evento}.`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp {CONFIG.contacto.whatsappVisible}
                </a>
              </li>
              <li>
                <a href={`mailto:${CONFIG.contacto.email}`}>{CONFIG.contacto.email}</a>
              </li>
              <li className="medida">{CONFIG.contacto.direccion}</li>
              <li>
                <a href={CONFIG.redes.instagram} target="_blank" rel="noreferrer">
                  Instagram
                </a>{' '}
                ·{' '}
                <a href={CONFIG.redes.facebook} target="_blank" rel="noreferrer">
                  Facebook
                </a>{' '}
                ·{' '}
                <a href={CONFIG.redes.youtube} target="_blank" rel="noreferrer">
                  YouTube
                </a>
              </li>
            </ul>
          </div>
        </div>
        <p className="pie__final">
          © {new Date().getFullYear()} {CONFIG.evento}. {CONFIG.sede}.
        </p>
      </div>
    </footer>
  )
}
