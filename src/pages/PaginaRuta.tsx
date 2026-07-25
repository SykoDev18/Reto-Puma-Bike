import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Hito, IdRuta } from '../types/roadbook'
import { RUTAS, ORDEN_RUTAS } from '../data/rutas'
import { desnivelAcumulado, proximoHito } from '../lib/perfil'
import { useScrollProgress } from '../hooks/useScrollProgress'
import { useHitoActivo } from '../hooks/useHitoActivo'
import { Cabecera } from '../components/Cabecera'
import { Riel } from '../components/Riel'
import { BarraKm } from '../components/BarraKm'
import { PieSitio } from '../components/PieSitio'
import { Nota } from '../components/Nota'
import { PlacaDorsal } from '../components/PlacaDorsal'
import { TituloAncho } from '../components/TituloAncho'
import { EmbedFacade } from '../components/EmbedFacade'
import paisaje from '../assets/img/paisaje-mezquital.webp'
import detalle from '../assets/img/detalle-llanta.webp'
import terraceria from '../assets/img/img_3.webp'

const DESCRIPCIONES: Record<string, string> = {
  salida:
    'El pelotón se forma cuando todavía está oscuro. A las ocho en punto la carretera se abre, el polvo se levanta y arranca la jornada.',
  meta:
    'Cruzas de vuelta al Pabellón Gastronómico. Barbacoa, ximbo y la medalla que confirma que te atreviste a recorrerlo.',
  abasto:
    'Agua, fruta y electrolitos. Rellena aquí: el siguiente tramo es largo y el sol del Mezquital no perdona.',
  'Santiago de El Jaguey':
    'Primer poblado del recorrido. El asfalto cede a la terracería y el Valle empieza a mostrar el mezquite y el maguey.',
  Boxaxni:
    'Nombre hñähñu del territorio. Tramo rodador entre parcelas, con el tepetate blanco marcando el camino.',
  Dajiedhi:
    'La primera subida seria de la ruta. Administra la fuerza: lo que se gana aquí se cobra más adelante.',
  'La Estancia':
    'Respiro antes del último tercio. Caminos anchos y firmes para recuperar el ritmo.',
  'El Rincón':
    'El giro que anuncia el regreso. De aquí en adelante el perfil afloja y la meta se siente cerca.',
}

function describir(hito: Hito): string {
  return (
    DESCRIPCIONES[hito.nombre] ??
    DESCRIPCIONES[hito.tipo] ??
    'Tramo de camino ancho y rodable por el Valle del Mezquital.'
  )
}

const nf = new Intl.NumberFormat('es-MX')

export function PaginaRuta() {
  const [rutaId, setRutaId] = useState<IdRuta>('larga')
  const ruta = RUTAS[rutaId]

  const contenedorRef = useRef<HTMLDivElement>(null)
  const kmRielRef = useRef<HTMLDivElement>(null)
  const barraKmRef = useRef<HTMLElement>(null)
  const desnivelRef = useRef<HTMLElement>(null)
  const proxRef = useRef<HTMLSpanElement>(null)

  // Se ejecuta en cada frame de scroll: escribe texto por DOM directo, sin setState.
  const alFrame = useCallback(
    (progreso: number) => {
      const km = progreso * ruta.km
      const desnivel = desnivelAcumulado(ruta.perfil, km)
      const siguiente = proximoHito(ruta.hitos, km)
      const nombreSiguiente = (siguiente ? siguiente.nombre : 'Meta').replace(
        ' · Pabellón Gastronómico',
        '',
      )
      if (kmRielRef.current) kmRielRef.current.textContent = `KM ${km.toFixed(0)}`
      if (barraKmRef.current) barraKmRef.current.textContent = km.toFixed(0)
      if (desnivelRef.current) desnivelRef.current.textContent = `+${nf.format(desnivel)}`
      if (proxRef.current) proxRef.current.textContent = nombreSiguiente
    },
    [ruta],
  )

  useScrollProgress(contenedorRef, alFrame)
  const activo = useHitoActivo(ruta.hitos.length)

  const poblados = ruta.hitos.filter((h) => h.tipo === 'poblado')
  const pobladoFotoKm = (poblados[1] ?? poblados[0])?.km

  return (
    <div ref={contenedorRef}>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <Riel ruta={ruta} kmRef={kmRielRef} />
      <BarraKm kmRef={barraKmRef} desnivelRef={desnivelRef} proxRef={proxRef} />
      <Cabecera paginaActual="ruta" />

      <main id="contenido" className="superficie">
        {/* Hero */}
        <section className="ruta-hero contenedor">
          <p className="etiqueta">Territorio hñähñu · Valle del Mezquital</p>
          <div className="ruta-hero__top">
            <TituloAncho as="h1" className="ruta-hero__titulo">
              El camino
              <br />
              se gana
              <br />
              pedaleando
            </TituloAncho>
            <PlacaDorsal numero="04" etiqueta="edición" variante="placa--grande" />
          </div>
          <p className="ruta-hero__intro serif">
            Dos recorridos por camino ancho y rodable, con el convento de Actopan a la espalda y el
            tepetate blanco bajo la llanta. Elige tu distancia: el perfil de abajo es real,
            kilómetro por kilómetro.{' '}
            <span className="medida">Salida 8:00 a. m. desde el Pabellón Gastronómico.</span>
          </p>

          <div className="selector" role="group" aria-label="Elegir ruta">
            {ORDEN_RUTAS.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={id === rutaId}
                onClick={() => setRutaId(id)}
              >
                {RUTAS[id].etiqueta.toLowerCase()}
              </button>
            ))}
          </div>

          <div className="ruta-metricas">
            <div className="metrica">
              <span className="num">
                {nf.format(ruta.km)}
                <span className="unidad">km</span>
              </span>
              <span className="rot">distancia</span>
            </div>
            <div className="metrica">
              <span className="num">
                +{nf.format(ruta.desnivel)}
                <span className="unidad">m</span>
              </span>
              <span className="rot">desnivel</span>
            </div>
            <div className="metrica">
              <span className="num num--texto">{ruta.id === 'larga' ? 'Exigente' : 'Media'}</span>
              <span className="rot">dificultad</span>
            </div>
            <div className="metrica">
              <span className="num num--texto">100% rodable</span>
              <span className="rot">terreno</span>
            </div>
          </div>
        </section>

        {/* Banda a sangre: el territorio al amanecer */}
        <figure className="banda">
          <img
            src={paisaje}
            alt="Camino de terracería del Valle del Mezquital al amanecer, con mezquites y magueyes a contraluz."
            loading="lazy"
          />
          <figcaption className="banda__cap">Valle del Mezquital · terracería al amanecer</figcaption>
        </figure>

        {/* Roadbook: notas ancladas a km */}
        <div className="contenedor">
          {ruta.hitos.map((hito, i) => {
            let media: ReactNode = null
            if (hito.tipo === 'salida') {
              media = (
                <EmbedFacade
                  src={`https://www.komoot.com/tour/${ruta.komootId}/embed?layout=classic&profile=1`}
                  titulo={`Mapa Komoot de la ruta ${ruta.etiqueta}`}
                  etiqueta="Mapa interactivo · Komoot"
                />
              )
            } else if (hito.km === pobladoFotoKm) {
              media = (
                <figure className="foto">
                  <img
                    src={terraceria}
                    alt="Ciclistas subiendo por terracería entre mezquites del Valle del Mezquital."
                    loading="lazy"
                  />
                  <figcaption>Camino ancho y rodable: terracería y tepetate del Valle.</figcaption>
                </figure>
              )
            }
            return (
              <Nota
                key={`${ruta.id}-${hito.km}`}
                hito={hito}
                indice={i}
                desnivel={desnivelAcumulado(ruta.perfil, hito.km)}
                descripcion={describir(hito)}
                media={media}
                activa={i === activo}
              />
            )
          })}
        </div>

        {/* Textura de transición: polvo de terracería */}
        <figure className="divisor-polvo" aria-hidden="true">
          <img src={detalle} alt="" loading="lazy" />
        </figure>

        {/* Antes de rodar (independiente de ruta) */}
        <section className="seccion seccion--carbon">
          <div className="contenedor">
            <p className="etiqueta">Antes de rodar</p>
            <div className="nota__cuerpo">
              <div>
                <TituloAncho as="h2" className="display--medio">
                  Casco puesto. Siempre.
                </TituloAncho>
                <ul className="lista-seguridad">
                  <li>Casco obligatorio durante todo el recorrido.</li>
                  <li>Lleva kit de reparación: cámara o mechas, y bomba o CO₂.</li>
                  <li>Respeta las indicaciones del staff, de las comunidades y del resto del pelotón.</li>
                </ul>
              </div>
              <div>
                <h3 className="subtitulo">Abastecimientos</h3>
                <p className="serif medida">
                  Habrá puntos de agua, fruta y electrolitos definidos por el comité. Los kilómetros
                  exactos se confirman antes del evento; carga agua suficiente entre uno y otro y no
                  dependas solo de la ruta.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PieSitio />
    </div>
  )
}
