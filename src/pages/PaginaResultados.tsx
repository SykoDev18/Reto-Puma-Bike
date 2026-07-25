import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../styles/resultados.css'
import type { CategoriaResultado, EntradaIndice, Resultados } from '../types/resultados'
import { CONFIG } from '../data/config'
import { RUTAS } from '../data/rutas'
import {
  cargarResultados,
  construirIndice,
  formatearGeneradoEn,
  porDorsal,
  ROTULO_ESTADO,
} from '../lib/resultados'
import { desnivelAcumulado, proximoHito } from '../lib/perfil'
import { useScrollProgress } from '../hooks/useScrollProgress'
import { useHashParams } from '../hooks/useHashParams'
import { useMasVisible } from '../hooks/useMasVisible'
import { Cabecera } from '../components/Cabecera'
import { Riel } from '../components/Riel'
import { BarraKm } from '../components/BarraKm'
import { PieSitio } from '../components/PieSitio'
import { HitoPagina } from '../components/HitoPagina'
import { BuscadorResultados } from '../components/BuscadorResultados'
import { PlacaSellada } from '../components/PlacaSellada'
import { PodioCategoria } from '../components/PodioCategoria'
import { TablaResultados } from '../components/TablaResultados'
import { DescargaCSV } from '../components/DescargaCSV'
import { PreRegistroQuinta } from '../components/PreRegistroQuinta'

const nf = new Intl.NumberFormat('es-MX')

// Resultados es la META del roadbook: el riel llega al final de la ruta larga.
const RUTA_REFERENCIA = RUTAS.larga
const KM_PAGINA = RUTA_REFERENCIA.km

type Estado =
  | { fase: 'cargando' }
  | { fase: 'error'; mensaje: string }
  | { fase: 'listo'; datos: Resultados }

/** Qué resolvió la URL: uno, varios (dorsal repetido) o ninguno. */
type Seleccion =
  | { tipo: 'uno'; entrada: EntradaIndice }
  | { tipo: 'varios'; candidatos: EntradaIndice[]; dorsal: number }
  | { tipo: 'ninguno'; dorsal: number }

export function PaginaResultados() {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const kmRielRef = useRef<HTMLDivElement>(null)
  const barraKmRef = useRef<HTMLElement>(null)
  const desnivelRef = useRef<HTMLElement>(null)
  const proxRef = useRef<HTMLSpanElement>(null)
  const podiosRef = useRef<HTMLDivElement>(null)
  const tablaRef = useRef<HTMLElement>(null)

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

  // ---- Carga: fetch, no import. El JSON no entra al bundle. ---------------
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    setEstado({ fase: 'cargando' })
    cargarResultados()
      .then((datos) => {
        if (vivo) setEstado({ fase: 'listo', datos })
      })
      .catch((e: unknown) => {
        if (vivo) {
          setEstado({
            fase: 'error',
            mensaje: e instanceof Error ? e.message : 'No se pudieron cargar los resultados',
          })
        }
      })
    return () => {
      vivo = false
    }
  }, [intento])

  const datos = estado.fase === 'listo' ? estado.datos : null

  // El índice de búsqueda se construye UNA vez, no en cada tecla.
  const indice = useMemo(() => (datos === null ? [] : construirIndice(datos)), [datos])

  // ---- Estado en la URL: el resultado consultado es compartible ----------
  const [params, setParams] = useHashParams()
  const paramDorsal = params.get('dorsal')
  const paramN = params.get('n')
  const paramCat = params.get('cat')

  const seleccion = useMemo<Seleccion | null>(() => {
    if (indice.length === 0 || paramDorsal === null) return null
    const dorsal = Number(paramDorsal)
    if (!Number.isInteger(dorsal)) return null

    const candidatos = porDorsal(indice, dorsal)
    if (candidatos.length === 0) return { tipo: 'ninguno', dorsal }

    // `n` desambigua los dorsales repetidos (25 y 127 aparecen dos veces).
    if (paramN !== null) {
      const n = Number(paramN)
      const exacta = candidatos.find((c) => c.n === n)
      if (exacta !== undefined) return { tipo: 'uno', entrada: exacta }
    }
    if (candidatos.length === 1) return { tipo: 'uno', entrada: candidatos[0] }
    // Más de uno y sin desempate: NO se elige por el usuario.
    return { tipo: 'varios', candidatos, dorsal }
  }, [indice, paramDorsal, paramN])

  const categorias: CategoriaResultado[] = datos?.categorias ?? []

  const categoriaActiva = useMemo<CategoriaResultado | null>(() => {
    if (categorias.length === 0) return null
    const buscada = categorias.find((c) => c.id === paramCat)
    return buscada ?? categorias[0]
  }, [categorias, paramCat])

  const categoriaDeSeleccion = useMemo<CategoriaResultado | null>(() => {
    if (seleccion === null || seleccion.tipo !== 'uno') return null
    return categorias.find((c) => c.id === seleccion.entrada.categoriaId) ?? null
  }, [seleccion, categorias])

  // Solo se resalta la fila si la tabla abierta ES la de esa persona.
  const resaltado =
    seleccion !== null &&
    seleccion.tipo === 'uno' &&
    categoriaActiva !== null &&
    categoriaActiva.id === seleccion.entrada.categoriaId
      ? seleccion.entrada.corredor
      : null

  const elegir = useCallback(
    (entrada: EntradaIndice) => {
      // Se escribe el dorsal (la forma corta y compartible) y, además, `n` y la
      // categoría: `n` desempata los dorsales repetidos y `cat` deja la tabla
      // lista para el enlace "Ver mi categoría completa".
      setParams(
        { dorsal: String(entrada.dorsal), n: String(entrada.n), cat: entrada.categoriaId },
        { historial: true },
      )
    },
    [setParams],
  )

  const verCategoria = useCallback(() => {
    tablaRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  const cambiarCategoria = useCallback(
    (id: string) => {
      setParams({ cat: id })
    },
    [setParams],
  )

  // El oro es escaso: solo el podio que domina la pantalla pinta al 1º en oro.
  // La clave son las categorías cargadas: los podios no existen hasta que llega
  // el fetch, así que el observador tiene que volver a montarse entonces.
  const podioDorado = useMasVisible(podiosRef, categorias.length)

  return (
    <div ref={contenedorRef}>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <Riel ruta={RUTA_REFERENCIA} kmRef={kmRielRef} />
      <BarraKm kmRef={barraKmRef} desnivelRef={desnivelRef} proxRef={proxRef} />
      <Cabecera paginaActual="resultados" ctaDorado={false} />

      <main id="contenido" className="superficie">
        {/* ============ 1 · ENCABEZADO ============ */}
        <section className="seccion-res">
          <div className="contenedor">
            <HitoPagina
              km={KM_PAGINA}
              rotulo="Meta"
              desnivel={desnivelAcumulado(RUTA_REFERENCIA.perfil, KM_PAGINA)}
            />
            {/* Página técnica: display CONDENSADA, como Categorías. */}
            <h1 className="display display--condensado titulo-res">Resultados</h1>
            <p className="ficha-res">
              <span className="ficha-res__edicion">{CONFIG.edicion}</span>
              <span className="ficha-res__sep" aria-hidden="true">
                ·
              </span>
              {/* `cifra` y no `dato`: la fecha y el conteo de categorías no
                  salen de un cronómetro. --crono se reserva a lo medido. */}
              <span className="cifra">{CONFIG.fechaCorta}</span>
              <span className="ficha-res__sep" aria-hidden="true">
                ·
              </span>
              <span className="cifra">
                {categorias.length || CONFIG.edicionCorrida.categoriasPublicadas}
              </span>
              <span className="ficha-res__rot">categorías</span>
            </p>

            {datos === null ? null : (
              <p className="generado">
                Actualizado: <span className="cifra">{formatearGeneradoEn(datos.generado_en)}</span>
                <span className="generado__nota">
                  {' '}
                  Los resultados se corrigen; la hora importa.
                </span>
              </p>
            )}

            {datos !== null && datos.parcial ? (
              <div className="aviso aviso--parcial">
                <p className="aviso__titulo">Publicación parcial</p>
                <p className="serif">{datos.nota_parcial}</p>
              </div>
            ) : null}
          </div>
        </section>

        {/* ============ 2 · BUSCA TU RESULTADO ============ */}
        <section className="seccion-res seccion--carbon" id="buscar">
          <div className="contenedor">
            {estado.fase === 'cargando' ? (
              <div className="esqueleto" role="status">
                <p className="esqueleto__rot">Cargando los resultados…</p>
                <div className="esqueleto__barra" />
                <div className="esqueleto__barra esqueleto__barra--corta" />
              </div>
            ) : estado.fase === 'error' ? (
              <div className="aviso aviso--error" role="alert">
                <p className="aviso__titulo">No se pudieron cargar los resultados</p>
                <p className="serif">
                  {estado.mensaje}. Puede ser tu conexión. Vuelve a intentarlo.
                </p>
                <button
                  className="boton boton--linea"
                  type="button"
                  onClick={() => setIntento((i) => i + 1)}
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <>
                <BuscadorResultados indice={indice} onElegir={elegir} />

                {seleccion === null ? null : seleccion.tipo === 'ninguno' ? (
                  <p className="buscador__vacio serif">
                    No hay ningún resultado con el dorsal{' '}
                    <span className="dato">{seleccion.dorsal}</span>. Puede que la categoría
                    todavía no esté publicada.
                  </p>
                ) : seleccion.tipo === 'varios' ? (
                  /* Dorsal repetido: se muestran TODOS. Un resultado equivocado
                     con tu nombre encima es peor que no encontrarlo. */
                  <div className="ambiguo">
                    <p className="serif">
                      El dorsal <span className="dato">{seleccion.dorsal}</span> aparece en{' '}
                      {seleccion.candidatos.length} registros. Elige el tuyo:
                    </p>
                    <ul className="sugerencias">
                      {seleccion.candidatos.map((entrada) => (
                        <li key={entrada.n}>
                          <button
                            className="sugerencia"
                            type="button"
                            onClick={() => elegir(entrada)}
                          >
                            <span className="sugerencia__dorsal dato">{entrada.dorsal}</span>
                            <span className="sugerencia__cuerpo">
                              <b className="sugerencia__nombre">{entrada.nombre}</b>
                              <span className="sugerencia__meta">
                                {entrada.categoriaNombre} · {entrada.ruta} km ·{' '}
                                {ROTULO_ESTADO[entrada.corredor.estado]}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : categoriaDeSeleccion === null ? null : (
                  <PlacaSellada
                    entrada={seleccion.entrada}
                    categoria={categoriaDeSeleccion}
                    onVerCategoria={verCategoria}
                  />
                )}
              </>
            )}
          </div>
        </section>

        {/* ============ 3 · PODIOS ============ */}
        {datos === null ? null : (
          <section className="seccion-res" id="podios">
            <div className="contenedor">
              <h2 className="subtitulo-res">Podios</h2>
              <p className="serif intro-res">
                Uno por categoría <b>y ruta</b>: la misma categoría corrió los 40 y los 80 km, y son
                dos competencias distintas.
              </p>
              <div className="podios" ref={podiosRef}>
                {datos.categorias.map((categoria) => (
                  <PodioCategoria
                    key={categoria.id}
                    categoria={categoria}
                    dorado={podioDorado === categoria.id}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ============ 4 · TABLA COMPLETA ============ */}
        {datos === null ? null : (
          <section className="seccion-res seccion--carbon" id="tabla" ref={tablaRef}>
            <div className="contenedor">
              <h2 className="subtitulo-res">Tabla completa</h2>

              <div className="selector-cat" role="group" aria-label="Categoría a mostrar">
                {datos.categorias.map((categoria) => (
                  <button
                    key={categoria.id}
                    type="button"
                    className="selector-cat__boton"
                    aria-pressed={categoriaActiva?.id === categoria.id}
                    onClick={() => cambiarCategoria(categoria.id)}
                  >
                    <span className="selector-cat__nombre">{categoria.nombre}</span>
                    <span className="selector-cat__meta">
                      <span className="dato">{categoria.ruta}</span> km ·{' '}
                      <span className="cifra">{categoria.corredores.length}</span>
                    </span>
                  </button>
                ))}
              </div>

              {/* Se monta UNA categoría a la vez: 113 filas como máximo, no 781. */}
              {categoriaActiva === null ? null : (
                <TablaResultados categoria={categoriaActiva} resaltado={resaltado} />
              )}
            </div>
          </section>
        )}

        {/* ============ 5 · CSV ============ */}
        {datos === null ? null : (
          <section className="seccion-res" id="csv">
            <div className="contenedor">
              <h2 className="subtitulo-res">Descargar los resultados</h2>
              <DescargaCSV todas={datos.categorias} activa={categoriaActiva} />
            </div>
          </section>
        )}

        {/* ============ 6 · PRE-REGISTRO 5ª ============ */}
        <section className="seccion-res seccion--carbon">
          <div className="contenedor">
            <PreRegistroQuinta />
          </div>
        </section>
      </main>

      <PieSitio />
    </div>
  )
}
