import { useCallback, useRef } from 'react'
import '../styles/inicio.css'
import { CONFIG, urlWhatsApp } from '../data/config'
import { RUTAS } from '../data/rutas'
import { CATEGORIAS } from '../data/categorias'
import { desnivelAcumulado, proximoHito } from '../lib/perfil'
import type { Grupo } from '../types/roadbook'
import { useScrollProgress } from '../hooks/useScrollProgress'
import { useEnViewport } from '../hooks/useEnViewport'
import { Cabecera } from '../components/Cabecera'
import { Riel } from '../components/Riel'
import { BarraKm } from '../components/BarraKm'
import { PieSitio } from '../components/PieSitio'
import { PlacaDorsal } from '../components/PlacaDorsal'
import { TituloAncho } from '../components/TituloAncho'
import { EmbedFacade } from '../components/EmbedFacade'
import { FranjaClara } from '../components/FranjaClara'
import { CuentaRegresiva } from '../components/CuentaRegresiva'
import { HitoPagina } from '../components/HitoPagina'
import { TarjetaRuta } from '../components/TarjetaRuta'
import { WidgetCategoria } from '../components/WidgetCategoria'
import { GridPatrocinadores } from '../components/GridPatrocinadores'
import { CarruselAvisos } from '../components/CarruselAvisos'
import { PreRegistroQuinta } from '../components/PreRegistroQuinta'
import portadaVideo from '../assets/img/img_1.webp'
import jerseyFrente from '../assets/Anuncio/jersey3.webp'
import jerseyEspalda from '../assets/Anuncio/jersey2.webp'

const nf = new Intl.NumberFormat('es-MX')

// El Inicio es la PORTADA del roadbook: el riel muestra la ruta larga completa.
const RUTA_REFERENCIA = RUTAS.larga

// Kilómetros reales de la ruta larga donde se ancla cada parada de la portada.
const KM_RECORRIDO = 8.4
const KM_QUIEN_CORRE = 22.1
const KM_INSCRIPCION = 48.9

const GRUPOS: Grupo[] = ['Infantiles', 'Grupo Menor', 'Grupo Mayor']
const DESCRIPCION_GRUPO: Record<Grupo, string> = {
  Infantiles: 'Circuito corto dentro del Pabellón, por edad y rodada. Pañales, AA, A, B y C.',
  'Grupo Menor': 'Juveniles, máster, rodadores y E-Bike. Menos vueltas, mismo territorio.',
  'Grupo Mayor': 'Elite, juvenil mayor y máster de mayor volumen. La jornada completa.',
}

export function PaginaInicio() {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const kmRielRef = useRef<HTMLDivElement>(null)
  const barraKmRef = useRef<HTMLElement>(null)
  const desnivelRef = useRef<HTMLElement>(null)
  const proxRef = useRef<HTMLSpanElement>(null)

  // El oro es escaso: mientras el hero se ve, el único dorado es su CTA.
  // Cuando sale del viewport, el dorado pasa al CTA de la cabecera.
  const heroVisible = useEnViewport(heroRef)

  // Cada frame de scroll: se escribe por DOM directo, nunca con setState.
  const alFrame = useCallback((progreso: number) => {
    const km = progreso * RUTA_REFERENCIA.km
    const desnivel = desnivelAcumulado(RUTA_REFERENCIA.perfil, km)
    const siguiente = proximoHito(RUTA_REFERENCIA.hitos, km)
    const nombreSiguiente = (siguiente ? siguiente.nombre : 'Meta').replace(
      ' · Pabellón Gastronómico',
      '',
    )
    if (kmRielRef.current) kmRielRef.current.textContent = `KM ${km.toFixed(0)}`
    if (barraKmRef.current) barraKmRef.current.textContent = km.toFixed(0)
    if (desnivelRef.current) desnivelRef.current.textContent = `+${nf.format(desnivel)}`
    if (proxRef.current) proxRef.current.textContent = nombreSiguiente
  }, [])

  useScrollProgress(contenedorRef, alFrame)

  const postevento = CONFIG.estado === 'postevento'
  const { etiqueta, finishers, categoriasPublicadas } = CONFIG.edicionCorrida

  return (
    <div ref={contenedorRef}>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <Riel ruta={RUTA_REFERENCIA} kmRef={kmRielRef} />
      <BarraKm kmRef={barraKmRef} desnivelRef={desnivelRef} proxRef={proxRef} />
      <Cabecera paginaActual="inicio" ctaDorado={!heroVisible} />

      <main id="contenido" className="superficie">
        {/* ============ KM 0.0 · SALIDA ============ */}
        <section className="seccion-inicio" ref={heroRef}>
          <div className="contenedor">
            <HitoPagina km={0} rotulo="Salida" desnivel={0} />

            <div className="portada">
              <div className="portada__texto">
                <div className="portada__marca">
                  <PlacaDorsal
                    numero={CONFIG.numeroEdicion}
                    etiqueta="edición"
                    variante="placa--grande"
                  />
                  <TituloAncho as="h1" className="display--ancho portada__titulo">
                    Reto Puma Bike
                  </TituloAncho>
                </div>

                {/* Datos duros sobre una regla de 1px: no son adorno. */}
                <p className="ficha">
                  <span className="dato">{CONFIG.fechaCorta}</span>
                  <span className="ficha__sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="dato">08:00</span>
                  <span className="ficha__sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="ficha__lugar">{CONFIG.salidaMeta}</span>
                  <span className="ficha__sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="ficha__lugar">{CONFIG.sedeCorta}</span>
                </p>

                <div className="portada__distancias placas">
                  <span className="distancia">
                    <PlacaDorsal numero={RUTAS.corta.etiqueta.replace(' KM', '')} etiqueta="km" />
                    <span className="distancia__desnivel dato">
                      +{nf.format(RUTAS.corta.desnivel)} m
                    </span>
                  </span>
                  <span className="distancia">
                    <PlacaDorsal numero={RUTAS.larga.etiqueta.replace(' KM', '')} etiqueta="km" />
                    <span className="distancia__desnivel dato">
                      +{nf.format(RUTAS.larga.desnivel)} m
                    </span>
                  </span>
                </div>

                <div className="portada__acciones">
                  {postevento ? (
                    <a className="boton boton--oro" href="#/resultados">
                      Ver resultados
                    </a>
                  ) : (
                    <a className="boton boton--oro" href="#/inscripciones">
                      Inscríbete
                    </a>
                  )}
                  <a
                    className="enlace-duro"
                    href={urlWhatsApp(
                      postevento
                        ? `Hola, quiero que me avisen cuando abran las inscripciones de la 5ª edición del ${CONFIG.evento}.`
                        : `Hola, quiero inscribirme al ${CONFIG.evento} ${CONFIG.anioEvento}.`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {postevento ? 'Avisarme de la quinta' : 'Inscribirme por WhatsApp'}
                  </a>
                </div>
              </div>

              {/* El video no es fondo: es un documento del roadbook, en su ventana. */}
              <div className="portada__ventana">
                <EmbedFacade
                  src={`https://www.youtube-nocookie.com/embed/${CONFIG.videoHeroId}`}
                  titulo={`Video de la salida del ${CONFIG.evento}`}
                  etiqueta="Video · YouTube"
                  imagen={portadaVideo}
                  textoBoton="Cargar video"
                  pie="Salida · tercera edición"
                  alto={360}
                />
              </div>
            </div>

            {/* Estado del evento: misma parada (km 0.0), misma lectura de
                instrumento. En postevento la cuenta regresiva se sustituye por el
                cierre de la edición; el layout no cambia. */}
            <div className="estado">
              {postevento ? (
                <p className="lectura">
                  <span className="lectura__rot">{etiqueta}</span>
                  <span className="lectura__sep" aria-hidden="true">
                    ·
                  </span>
                  <b className="cifra">{categoriasPublicadas}</b>
                  <span className="lectura__rot">categorías</span>
                  {/* El conteo de finishers solo aparece si existe de verdad. */}
                  {finishers === null ? null : (
                    <>
                      <span className="lectura__sep" aria-hidden="true">
                        ·
                      </span>
                      <b className="cifra">{nf.format(finishers)}</b>
                      <span className="lectura__rot">finishers</span>
                    </>
                  )}
                  <span className="lectura__sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="lectura__rot">resultados publicados</span>
                </p>
              ) : (
                <CuentaRegresiva objetivoIso={CONFIG.horaArranqueIso} />
              )}
              {postevento ? (
                <a className="enlace-duro" href="#/resultados">
                  Buscar mi resultado
                </a>
              ) : null}
            </div>
          </div>
        </section>

        {/* ============ KM 8.4 · EL RECORRIDO ============ */}
        <section className="seccion-inicio seccion--carbon">
          <div className="contenedor">
            <HitoPagina
              km={KM_RECORRIDO}
              rotulo="El recorrido"
              desnivel={desnivelAcumulado(RUTA_REFERENCIA.perfil, KM_RECORRIDO)}
            />
            <TituloAncho as="h2" className="display--medio titulo-seccion">
              Dos maneras de recorrerlo
            </TituloAncho>
            <div className="rutas-doble">
              <TarjetaRuta
                ruta={RUTAS.corta}
                dificultad="media"
                poblados={['Dajiedhi', 'La Estancia', 'El Rincón']}
              />
              <TarjetaRuta
                ruta={RUTAS.larga}
                dificultad="exigente"
                poblados={[
                  'Santiago de El Jaguey',
                  'Boxaxni',
                  'Dajiedhi',
                  'La Estancia',
                  'El Rincón',
                ]}
              />
            </div>
          </div>
        </section>

        {/* ============ KM 22.1 · QUIÉN CORRE ============ */}
        <section className="seccion-inicio">
          <div className="contenedor">
            <HitoPagina
              km={KM_QUIEN_CORRE}
              rotulo="Quién corre"
              desnivel={desnivelAcumulado(RUTA_REFERENCIA.perfil, KM_QUIEN_CORRE)}
            />
            <TituloAncho as="h2" className="display--medio titulo-seccion">
              {CATEGORIAS.length} categorías, tres grupos
            </TituloAncho>

            <div className="grupos">
              {GRUPOS.map((grupo) => {
                const cuantas = CATEGORIAS.filter((c) => c.grupo === grupo).length
                return (
                  <div className="grupo" key={grupo}>
                    <p className="grupo__cuenta">
                      <span className="cifra">{cuantas}</span>
                      <span className="grupo__rot">categorías</span>
                    </p>
                    <h3 className="grupo__nombre">{grupo}</h3>
                    <p className="medida serif">{DESCRIPCION_GRUPO[grupo]}</p>
                  </div>
                )
              })}
            </div>

            <div className="widget-marco">
              <h3 className="subtitulo">¿Cuál me toca?</h3>
              <WidgetCategoria />
            </div>
          </div>
        </section>

        {/* ============ KM 48.9 · INSCRIPCIÓN ============ */}
        <section className="seccion-inicio seccion--carbon">
          <div className="contenedor">
            <HitoPagina
              km={KM_INSCRIPCION}
              rotulo="Inscripción"
              desnivel={desnivelAcumulado(RUTA_REFERENCIA.perfil, KM_INSCRIPCION)}
            />
            <TituloAncho as="h2" className="display--medio titulo-seccion">
              {postevento ? 'Inscripciones cerradas' : 'Aparta tu lugar'}
            </TituloAncho>

            {postevento ? (
              <div className="aviso">
                <p className="aviso__titulo">Cuarta edición</p>
                <p className="serif">
                  El registro de la {etiqueta} está cerrado: la carrera se corrió el{' '}
                  {CONFIG.fechaTexto}.{' '}
                  <a className="enlace-duro" href="#/resultados">
                    Ver resultados
                  </a>
                </p>
              </div>
            ) : null}

            <div className="kits">
              {CONFIG.kits.map((kit) => (
                <article className="kit" key={kit.nombre}>
                  <h3 className="kit__nombre">{kit.nombre}</h3>
                  <p className="kit__precio">
                    <span className="cifra">${nf.format(kit.precio)}</span>
                    <span className="kit__moneda">MXN</span>
                  </p>
                  <ul className="kit__lista">
                    {kit.incluye.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            {/* Con las inscripciones cerradas, los dos caminos de registro ya no
                llevan a ningún lado: se sustituyen por el pre-registro a la 5ª. */}
            {postevento ? <PreRegistroQuinta titulo="Pre-registro" /> : null}

            {postevento ? null : (
            /* Dos caminos de registro presentados como iguales. Aquí no hay oro. */
            <div className="caminos">
              <div className="camino">
                <h3 className="camino__titulo">Formulario en línea</h3>
                <p className="medida serif">
                  Te calcula la categoría, valida los datos y te da un folio para el sistema de
                  cronometraje.
                </p>
                <a className="boton boton--linea" href="#/inscripciones">
                  Abrir formulario
                </a>
              </div>
              <div className="camino">
                <h3 className="camino__titulo">WhatsApp con el comité</h3>
                <p className="medida serif">
                  Si prefieres que alguien te acompañe en el registro, escríbenos y lo llenamos
                  juntos.
                </p>
                <a
                  className="boton boton--linea"
                  href={urlWhatsApp(
                    `Hola, quiero inscribirme al ${CONFIG.evento} ${CONFIG.anioEvento}.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  Escribir por WhatsApp
                </a>
              </div>
            </div>
            )}
          </div>
        </section>

        {/* ====== ZONA DE LUZ: Colección + Patrocinadores en UNA franja ====== */}
        <FranjaClara className="zona-luz">
          <div className="contenedor">
            <section className="coleccion">
              <p className="etiqueta">Colección</p>
              <TituloAncho as="h2" className="display--medio titulo-seccion">
                El jersey de la edición
              </TituloAncho>
              <div className="coleccion__cuerpo">
                <div className="coleccion__fotos">
                  {/* SUPUESTO: el arte definitivo de la 4ª edición no está entregado;
                      estas tomas son de la edición anterior y traen fondo sólido. */}
                  <img
                    src={jerseyFrente}
                    alt="Jersey del Reto Puma Bike, vista frontal."
                    loading="lazy"
                    width="463"
                    height="666"
                  />
                  <img
                    src={jerseyEspalda}
                    alt="Jersey del Reto Puma Bike, vista de espalda."
                    loading="lazy"
                    width="414"
                    height="666"
                  />
                </div>
                <div className="coleccion__texto">
                  <p className="serif">
                    El jersey va incluido en el Kit Puma. Corte de manga corta, tela transpirable y
                    el puma del Mezquital al frente.
                  </p>
                  <a className="enlace-duro" href="#/coleccion">
                    Ver la colección
                  </a>
                </div>
              </div>
            </section>

            <hr className="corte-luz" />

            <section className="patrocinio">
              <p className="etiqueta">Quien lo hace posible</p>
              <GridPatrocinadores />
            </section>
          </div>
        </FranjaClara>

        {/* ============ KM 74.5 · META ============ */}
        <section className="seccion-inicio">
          <div className="contenedor">
            <HitoPagina
              km={RUTA_REFERENCIA.km}
              rotulo="Meta"
              desnivel={desnivelAcumulado(RUTA_REFERENCIA.perfil, RUTA_REFERENCIA.km)}
            />
            <TituloAncho as="h2" className="display--medio titulo-seccion">
              Avisos del comité
            </TituloAncho>
            {/* Los 3 más recientes, leídos del MISMO `anuncios.json` que la
                página de Anuncios. Una sola fuente: no hay dos listas que se
                puedan contradecir. */}
            <CarruselAvisos />
            <a className="enlace-duro avisos__todos" href="#/anuncios">
              Ver todos los avisos
            </a>
          </div>
        </section>
      </main>

      <PieSitio />
    </div>
  )
}
