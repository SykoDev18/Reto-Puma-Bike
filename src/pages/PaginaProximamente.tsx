import { CONFIG, urlWhatsApp } from '../data/config'
import { Cabecera } from '../components/Cabecera'
import { PieSitio } from '../components/PieSitio'
import { PlacaDorsal } from '../components/PlacaDorsal'

interface Seccion {
  titulo: string
  descripcion: string
  mensaje: string
}

const SECCIONES: Record<'hoteles', Seccion> = {
  hoteles: {
    titulo: 'Hoteles',
    descripcion:
      'Los hospedajes de Actopan con tarifa para corredores. Estamos confirmando precios con cada hotel antes de publicarlos.',
    mensaje: `Hola, quiero información de hospedaje para el ${CONFIG.evento}.`,
  },
}

/**
 * Página honesta para las secciones que todavía no existen. Antes estos enlaces
 * apuntaban a `.html` heredados que, al borrarse, caían al fallback del router y
 * mostraban el Inicio como si fuera esa sección. Decir "todavía no" es mejor que
 * mostrar en silencio la página equivocada.
 */
export function PaginaProximamente({ seccion }: { seccion: 'hoteles' }) {
  const { titulo, descripcion, mensaje } = SECCIONES[seccion]

  return (
    <div>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <Cabecera paginaActual={seccion} ctaDorado={false} />

      <main id="contenido" className="superficie">
        <section className="seccion proximamente">
          <div className="contenedor">
            <PlacaDorsal numero="—" etiqueta="km" variante="placa--clave" />
            <h1 className="display display--condensado proximamente__titulo">{titulo}</h1>
            <p className="etiqueta proximamente__estado">Todavía no está publicada</p>
            <p className="serif proximamente__texto">{descripcion}</p>
            <div className="proximamente__acciones">
              <a className="boton boton--linea" href="#/">
                Volver al inicio
              </a>
              <a
                className="enlace-duro"
                href={urlWhatsApp(mensaje)}
                target="_blank"
                rel="noreferrer"
              >
                Preguntar por WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      <PieSitio />
    </div>
  )
}
