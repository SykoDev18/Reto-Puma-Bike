import { useCallback, useRef } from 'react'
import '../styles/coleccion.css'
import { CONFIG, urlWhatsApp } from '../data/config'
import { RUTAS } from '../data/rutas'
import { desnivelAcumulado, proximoHito } from '../lib/perfil'
import { useScrollProgress } from '../hooks/useScrollProgress'
import { Cabecera } from '../components/Cabecera'
import { Riel } from '../components/Riel'
import { BarraKm } from '../components/BarraKm'
import { PieSitio } from '../components/PieSitio'
import { FranjaClara } from '../components/FranjaClara'
import { TituloAncho } from '../components/TituloAncho'
import { DatosPago } from '../components/DatosPago'
import { VisorImagen, useVisor } from '../components/VisorImagen'
import jerseyFrente from '../assets/Anuncio/jersey3.webp'
import jerseyEspalda from '../assets/Anuncio/jersey2.webp'
import jerseyPrimera from '../assets/Catalogo/Primera edicion/4.webp'
import jerseySegunda from '../assets/Catalogo/Segunda edicion/1.webp'
import jerseyTercera from '../assets/Catalogo/Tercera edicion/6.webp'

const nf = new Intl.NumberFormat('es-MX')
// El riel sigue mostrando la ruta larga, pero Colección NO lleva marcador de
// kilómetro: no es una parada del recorrido y numerarla no significaría nada.
const RUTA_REFERENCIA = RUTAS.larga

// Etiquetas duras, no un selector de compra: aquí no se agrega nada a un carrito.
const TALLAS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']

const MENSAJE_APARTAR = `Hola, quiero apartar un jersey del ${CONFIG.evento} 4ª edición. Talla: ___`
const MENSAJE_TALLA = `Hola, tengo dudas con la talla del jersey del ${CONFIG.evento}.`

// SUPUESTO: las tomas del jersey son de la edición anterior (el arte definitivo
// de la 4ª no está entregado) y vienen con FONDO SÓLIDO claro y una sombra
// horneada en el pixel. Sobre --cal casi no se nota, que es justo por qué esta
// página va en zona de luz; sobre --noche se vería el recuadro.
// FALTA: jersey-frente.png y jersey-espalda.png de la 4ª edición, con fondo
// transparente y 1600px del lado mayor.
const PIEZA = {
  frente: {
    src: jerseyFrente,
    alt: 'Jersey del Reto Puma Bike, vista frontal: la cara de un puma sobre fondo turquesa y negro, con el logotipo Reto Puma y marcas de zarpazo.',
    pie: 'Frente',
  },
  espalda: {
    src: jerseyEspalda,
    alt: 'Jersey del Reto Puma Bike, vista de espalda: la mascota ciclista del evento sobre el degradado turquesa a negro, con marcas de zarpazo en los hombros.',
    pie: 'Espalda',
  },
}

// Cada pieza está identificada por su propio arte, que trae impresa la edición
// ("2DO RETO PUMA", "3ER RETO PUMA"). Por eso se puede rotular sin inventar.
const ARCHIVO = [
  {
    src: jerseyPrimera,
    alt: 'Jersey de manga larga de la primera edición del Reto Puma Bike: cara de puma en amarillo sobre negro con la palabra RETO PUMA.',
    edicion: 'Primera edición',
  },
  {
    src: jerseySegunda,
    alt: 'Jersey de manga larga de la segunda edición: puma sobre fondo turquesa y negro, con la leyenda 2DO RETO PUMA en las mangas.',
    edicion: 'Segunda edición',
  },
  {
    src: jerseyTercera,
    alt: 'Jersey de manga corta de la tercera edición: puma en tonos dorados sobre gris y negro, con la leyenda 3ER RETO PUMA.',
    edicion: 'Tercera edición',
  },
  // La medalla de la 2ª (Catalogo/Medallas/10.webp) queda FUERA de la tira: es
  // plata sobre blanco y, en escala de grises sobre --cal, se ve como un hueco.
  // Además trae su propio rótulo horneado, que duplicaría el pie. Entra cuando
  // haya una toma sobre fondo contrastante.
]

export function PaginaColeccion() {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const kmRielRef = useRef<HTMLDivElement>(null)
  const barraKmRef = useRef<HTMLElement>(null)
  const desnivelRef = useRef<HTMLElement>(null)
  const proxRef = useRef<HTMLSpanElement>(null)
  const { imagen, abrir, cerrar } = useVisor()

  const alFrame = useCallback((progreso: number) => {
    const km = progreso * RUTA_REFERENCIA.km
    const desnivel = desnivelAcumulado(RUTA_REFERENCIA.perfil, km)
    const siguiente = proximoHito(RUTA_REFERENCIA.hitos, km)
    const nombre = (siguiente ? siguiente.nombre : 'Meta').replace(' · Pabellón Gastronómico', '')
    if (kmRielRef.current) kmRielRef.current.textContent = `KM ${km.toFixed(0)}`
    if (barraKmRef.current) barraKmRef.current.textContent = km.toFixed(0)
    if (desnivelRef.current) desnivelRef.current.textContent = `+${nf.format(desnivel)}`
    if (proxRef.current) proxRef.current.textContent = nombre
  }, [])
  useScrollProgress(contenedorRef, alFrame)

  const kitConJersey = CONFIG.kits.find((k) => k.incluye.some((i) => /jersey/i.test(i)))

  return (
    <div ref={contenedorRef}>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <Riel ruta={RUTA_REFERENCIA} kmRef={kmRielRef} />
      <BarraKm kmRef={barraKmRef} desnivelRef={desnivelRef} proxRef={proxRef} />
      <Cabecera paginaActual="coleccion" ctaDorado={false} />

      {/* Colección es una de las tres zonas de luz (§3) y aquí ocupa casi toda
          la página: producto sobre papel, como catálogo impreso. El corte es
          duro, sin transición, porque lo da el cambio de --fondo heredado. */}
      <main id="contenido">
        <FranjaClara className="coleccion">
          <div className="contenedor">
            {/* ---------- 1 · Encabezado ---------- */}
            <header className="col-cabeza">
              <p className="etiqueta">Colección · {CONFIG.edicion}</p>
              <TituloAncho as="h1" className="display--medio col-titulo">
                Los recuerdos son para siempre
              </TituloAncho>
              <p className="serif col-intro">
                La carrera ya se corrió. Lo que queda del {CONFIG.fechaTexto} cabe en una prenda que
                se puede volver a usar: no es equipo para competir, es la constancia de que
                estuviste en el Valle del Mezquital ese domingo a las ocho de la mañana.
              </p>
            </header>

            {/* ---------- 2 · La pieza ---------- */}
            <section className="pieza" aria-labelledby="titulo-pieza">
              <h2 className="subtitulo-col" id="titulo-pieza">
                El jersey de la cuarta edición
              </h2>
              <div className="pieza__fotos">
                {[PIEZA.frente, PIEZA.espalda].map((vista) => (
                  <figure className="pieza__figura" key={vista.pie}>
                    <button
                      className="pieza__lupa"
                      type="button"
                      onClick={() => abrir(vista)}
                      aria-label={`Ampliar la vista de ${vista.pie.toLowerCase()} del jersey`}
                    >
                      <img src={vista.src} alt={vista.alt} loading="lazy" decoding="async" />
                    </button>
                    <figcaption>{vista.pie}</figcaption>
                  </figure>
                ))}
              </div>
              <p className="pieza__nota serif">
                Lleva la cara del puma al frente, sobre el turquesa y negro de la edición, y la
                mascota ciclista del evento en la espalda. Los zarpazos de las mangas son los
                mismos de la placa de dorsal.
              </p>
            </section>

            {/* ---------- 3 · Detalle ---------- */}
            <section className="detalle">
              <div className="detalle__bloque">
                <h2 className="subtitulo-col">Tallas</h2>
                {/* Etiquetas duras en monoespaciada. NO es un selector: no hay
                    carrito, no hay inventario y no hay existencias que mostrar. */}
                <ul className="tallas">
                  {TALLAS.map((talla) => (
                    <li className="talla" key={talla}>
                      {talla}
                    </li>
                  ))}
                </ul>
                {/* FALTA: tabla de medidas del proveedor (largo, pecho y manga
                    por talla). Sin ella no se inventan centímetros: se manda a
                    preguntar, que es lo honesto. */}
                <a
                  className="enlace-duro detalle__duda"
                  href={urlWhatsApp(MENSAJE_TALLA)}
                  target="_blank"
                  rel="noreferrer"
                >
                  ¿Dudas con la talla? Escríbenos
                </a>
              </div>

              <div className="detalle__bloque">
                <h2 className="subtitulo-col">Precio</h2>
                {kitConJersey === undefined ? null : (
                  <p className="serif detalle__texto">
                    El jersey viene incluido en el{' '}
                    <b>
                      {kitConJersey.nombre} (<span className="cifra">${nf.format(kitConJersey.precio)}</span>{' '}
                      MXN)
                    </b>
                    , junto con número de competidor, placa para bicicleta, medalla y
                    abastecimientos.
                  </p>
                )}
                {/* FALTA: precio del jersey por separado. Lo tiene que dar el
                    comité; mientras tanto no se publica ningún número inventado. */}
                <p className="serif detalle__texto">
                  Suelto, sin kit, la disponibilidad depende de las tallas que hayan sobrado de la
                  edición. <b>Consulta disponibilidad y precio por WhatsApp.</b>
                </p>
              </div>
            </section>

            {/* ---------- 4 · Cómo apartarlo ---------- */}
            <section className="apartar" aria-labelledby="titulo-apartar">
              <h2 className="subtitulo-col" id="titulo-apartar">
                Cómo apartarlo
              </h2>
              <ol className="pasos">
                <li className="paso">
                  <span className="paso__num cifra" aria-hidden="true">
                    1
                  </span>
                  <div className="paso__cuerpo">
                    <h3 className="paso__titulo">Apártalo por WhatsApp</h3>
                    <p className="serif">
                      Dinos tu talla y tu nombre completo. Te confirmamos si hay pieza antes de que
                      pagues nada.
                    </p>
                    {/* El único dorado de la página: es LA acción, y aquí no
                        compite con nada (la cabecera va con ctaDorado={false}). */}
                    <a
                      className="boton boton--oro"
                      href={urlWhatsApp(MENSAJE_APARTAR)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Apartar por WhatsApp
                    </a>
                  </div>
                </li>
                <li className="paso">
                  <span className="paso__num cifra" aria-hidden="true">
                    2
                  </span>
                  <div className="paso__cuerpo">
                    <h3 className="paso__titulo">Paga por transferencia</h3>
                    <p className="serif">
                      Depósito o transferencia a la cuenta del comité. No pedimos datos de tarjeta
                      por ningún medio: si alguien te los pide a nombre del evento, no es del
                      evento.
                    </p>
                    <DatosPago />
                  </div>
                </li>
              </ol>
            </section>

            {/* ---------- 5 · Ediciones pasadas ---------- */}
            <section className="archivo" aria-labelledby="titulo-archivo">
              <h2 className="subtitulo-col" id="titulo-archivo">
                Ediciones anteriores
              </h2>
              <p className="serif archivo__intro">
                No están a la venta. Es archivo: las piezas con las que se corrieron las tres
                ediciones que hicieron posible esta.
              </p>
              <ul className="archivo__tira">
                {ARCHIVO.map((pieza) => (
                  <li key={pieza.edicion}>
                    <figure>
                      <button
                        className="archivo__lupa"
                        type="button"
                        onClick={() => abrir({ src: pieza.src, alt: pieza.alt, pie: pieza.edicion })}
                        aria-label={`Ampliar: ${pieza.edicion}`}
                      >
                        <img src={pieza.src} alt={pieza.alt} loading="lazy" decoding="async" />
                      </button>
                      <figcaption>{pieza.edicion}</figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </FranjaClara>
      </main>

      <PieSitio />
      <VisorImagen imagen={imagen} onCerrar={cerrar} />
    </div>
  )
}
