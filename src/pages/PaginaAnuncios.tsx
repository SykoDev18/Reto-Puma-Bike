import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../styles/anuncios.css'
import type { Anuncios, TipoAviso } from '../types/anuncios'
import { ROTULO_TIPO, TIPOS } from '../types/anuncios'
import { CONFIG } from '../data/config'
import { RUTAS } from '../data/rutas'
import {
  agruparPorMes,
  armarTablero,
  cargarAnuncios,
  coincideTipo,
  contarPorTipo,
  fechaLarga,
} from '../lib/anuncios'
import { desnivelAcumulado, proximoHito } from '../lib/perfil'
import { useScrollProgress } from '../hooks/useScrollProgress'
import { useHashParams, useRutaHash } from '../hooks/useHashParams'
import { Cabecera } from '../components/Cabecera'
import { Riel } from '../components/Riel'
import { BarraKm } from '../components/BarraKm'
import { PieSitio } from '../components/PieSitio'
import { TarjetaAviso } from '../components/TarjetaAviso'
import { VisorImagen, useVisor } from '../components/VisorImagen'

const nf = new Intl.NumberFormat('es-MX')
const RUTA_REFERENCIA = RUTAS.larga

/** Hoy, en fecha local ISO. Sin hora: la vigencia se compara por día. */
function hoyIso(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

const esTipo = (v: string | null): v is TipoAviso =>
  v !== null && TIPOS.some((t) => t === v)

type Estado =
  | { fase: 'cargando' }
  | { fase: 'error'; mensaje: string }
  | { fase: 'listo'; datos: Anuncios }

export function PaginaAnuncios() {
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

  // ---- Carga por fetch: el comité actualiza el JSON sin recompilar ---------
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    setEstado({ fase: 'cargando' })
    cargarAnuncios()
      .then((datos) => {
        if (vivo) setEstado({ fase: 'listo', datos })
      })
      .catch((e: unknown) => {
        if (vivo) {
          setEstado({
            fase: 'error',
            mensaje: e instanceof Error ? e.message : 'No se pudieron cargar los avisos',
          })
        }
      })
    return () => {
      vivo = false
    }
  }, [intento])

  const datos = estado.fase === 'listo' ? estado.datos : null

  // ---- Filtro por tipo, en la URL para poder compartirlo ------------------
  const [params, setParams] = useHashParams()
  const paramTipo = params.get('tipo')
  const tipoActivo: TipoAviso | null = esTipo(paramTipo) ? paramTipo : null

  const cambiarTipo = useCallback(
    (tipo: TipoAviso | null) => setParams({ tipo }),
    [setParams],
  )

  // ---- Enlace directo: #/anuncios/012 -------------------------------------
  const ruta = useRutaHash()
  const idDirecto = useMemo(() => {
    const m = /^\/anuncios\/(.+)$/.exec(ruta)
    return m === null ? null : m[1]
  }, [ruta])

  const hoy = useMemo(() => hoyIso(), [])
  const tablero = useMemo(
    () => (datos === null ? { fijados: [], archivo: [] } : armarTablero(datos.avisos, hoy)),
    [datos, hoy],
  )
  const meses = useMemo(() => agruparPorMes(tablero.archivo), [tablero.archivo])
  const cuenta = useMemo(
    () => (datos === null ? null : contarPorTipo(datos.avisos)),
    [datos],
  )

  // Al llegar por enlace directo (o al recargarlo), se salta al aviso.
  useEffect(() => {
    if (idDirecto === null || datos === null) return
    const nodo = document.getElementById(`aviso-${idDirecto}`)
    nodo?.scrollIntoView({ block: 'center' })
  }, [idDirecto, datos])

  const ampliar = useCallback(
    (src: string, alt: string, pie: string) => abrir({ src, alt, pie }),
    [abrir],
  )

  const coincidencias =
    datos === null ? 0 : datos.avisos.filter((a) => coincideTipo(a, tipoActivo)).length

  return (
    <div ref={contenedorRef}>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <Riel ruta={RUTA_REFERENCIA} kmRef={kmRielRef} />
      <BarraKm kmRef={barraKmRef} desnivelRef={desnivelRef} proxRef={proxRef} />
      <Cabecera paginaActual="anuncios" ctaDorado={false} />

      <main id="contenido" className="superficie">
        {/* ============ 1 · ENCABEZADO ============ */}
        <section className="seccion-anu">
          <div className="contenedor">
            <h1 className="display display--condensado titulo-anu">Avisos</h1>
            <p className="serif intro-anu">
              El pizarrón del comité. Todo lo que se publica aquí está escrito como texto: para que
              lo encuentre un buscador, lo lea un lector de pantalla y se lea bien en un celular.
              El flyer acompaña, nunca sustituye.
            </p>
            {datos === null ? null : (
              <p className="actualizado">
                Último publicado: <span className="dato">{fechaLarga(datos.actualizado)}</span>
              </p>
            )}
          </div>
        </section>

        {estado.fase === 'cargando' ? (
          <section className="seccion-anu seccion--carbon">
            <div className="contenedor">
              <div className="esqueleto" role="status">
                <p className="esqueleto__rot">Cargando los avisos…</p>
                <div className="esqueleto__barra" />
                <div className="esqueleto__barra esqueleto__barra--corta" />
              </div>
            </div>
          </section>
        ) : estado.fase === 'error' ? (
          <section className="seccion-anu seccion--carbon">
            <div className="contenedor">
              <div className="aviso aviso--error" role="alert">
                <p className="aviso__titulo">No se pudieron cargar los avisos</p>
                <p className="serif">{estado.mensaje}. Puede ser tu conexión.</p>
                <button
                  className="boton boton--linea"
                  type="button"
                  onClick={() => setIntento((i) => i + 1)}
                >
                  Reintentar
                </button>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* ============ FILTROS ============ */}
            <section className="seccion-anu seccion--carbon">
              <div className="contenedor">
                <div className="filtros-anu" role="group" aria-label="Filtrar avisos por tipo">
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={tipoActivo === null}
                    onClick={() => cambiarTipo(null)}
                  >
                    Todos <span className="cifra">{estado.datos.avisos.length}</span>
                  </button>
                  {TIPOS.map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      className="chip"
                      aria-pressed={tipoActivo === tipo}
                      onClick={() => cambiarTipo(tipoActivo === tipo ? null : tipo)}
                    >
                      {ROTULO_TIPO[tipo]} <span className="cifra">{cuenta?.[tipo] ?? 0}</span>
                    </button>
                  ))}
                </div>
                <p className="filtros-anu__cuenta" role="status">
                  {tipoActivo === null
                    ? `${estado.datos.avisos.length} avisos publicados.`
                    : `${coincidencias} de ${estado.datos.avisos.length} avisos. Los demás se atenúan, no se ocultan.`}
                </p>
              </div>
            </section>

            {/* ============ 2 · FIJADOS ============ */}
            {tablero.fijados.length === 0 ? null : (
              <section className="seccion-anu" id="fijados">
                <div className="contenedor">
                  <h2 className="subtitulo-anu">Vigentes</h2>
                  <div className="tablero">
                    {tablero.fijados.map((aviso, i) => (
                      <TarjetaAviso
                        key={aviso.id}
                        aviso={aviso}
                        fijado
                        // Un solo dorado por pantalla: solo el primer fijado.
                        dorado={i === 0}
                        atenuado={!coincideTipo(aviso, tipoActivo)}
                        resaltado={idDirecto === aviso.id}
                        onAmpliar={ampliar}
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ============ 3 · CRONOLÓGICO POR MES ============ */}
            <section className="seccion-anu seccion--carbon" id="archivo">
              <div className="contenedor">
                <h2 className="subtitulo-anu">Todos los avisos</h2>
                {meses.length === 0 ? (
                  <p className="serif medida">Todavía no hay avisos publicados.</p>
                ) : (
                  meses.map((mes) => (
                    <div className="mes" key={mes.clave}>
                      <h3 className="mes__rotulo">{mes.etiqueta}</h3>
                      <div className="tablero">
                        {mes.avisos.map((aviso) => (
                          <TarjetaAviso
                            key={aviso.id}
                            aviso={aviso}
                            fijado={false}
                            dorado={false}
                            atenuado={!coincideTipo(aviso, tipoActivo)}
                            resaltado={idDirecto === aviso.id}
                            onAmpliar={ampliar}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}

        {/* ============ 4 · REDES ============ */}
        <section className="seccion-anu">
          <div className="contenedor">
            <h2 className="subtitulo-anu">Todo lo demás, en nuestras redes</h2>
            <p className="serif intro-anu">
              Aquí van los comunicados oficiales. Las fotos de la carrera, los videos y la
              conversación del día a día viven en las redes del evento.
            </p>
            <div className="redes">
              <a className="boton boton--linea" href={CONFIG.redes.instagram} target="_blank" rel="noreferrer">
                Instagram
              </a>
              <a className="boton boton--linea" href={CONFIG.redes.facebook} target="_blank" rel="noreferrer">
                Facebook
              </a>
              <a className="boton boton--linea" href={CONFIG.redes.youtube} target="_blank" rel="noreferrer">
                YouTube
              </a>
            </div>
          </div>
        </section>
      </main>

      <PieSitio />
      <VisorImagen imagen={imagen} onCerrar={cerrar} />
    </div>
  )
}
