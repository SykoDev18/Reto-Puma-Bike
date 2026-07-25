import { useCallback, useMemo, useRef, useState } from 'react'
import '../styles/categorias.css'
import type { Rama } from '../types/roadbook'
import { CATEGORIAS } from '../data/categorias'
import { CONFIG } from '../data/config'
import { RUTAS } from '../data/rutas'
import { construirEje, filaDeEdad } from '../lib/eje'
import { desnivelAcumulado, proximoHito } from '../lib/perfil'
import { useScrollProgress } from '../hooks/useScrollProgress'
import { useHashParams } from '../hooks/useHashParams'
import { Cabecera } from '../components/Cabecera'
import { Riel } from '../components/Riel'
import { BarraKm } from '../components/BarraKm'
import { PieSitio } from '../components/PieSitio'
import { HitoPagina } from '../components/HitoPagina'
import { WidgetCategoria } from '../components/WidgetCategoria'
import type { ResultadoWidget } from '../components/WidgetCategoria'
import { EjeEdad } from '../components/EjeEdad'
import type { EstadoFiltros } from '../components/EjeEdad'
import { FiltrosCategorias } from '../components/FiltrosCategorias'
import { BandaAbiertas } from '../components/BandaAbiertas'
import { TablaCompetencia } from '../components/TablaCompetencia'
import { Preguntas } from '../components/Preguntas'

const nf = new Intl.NumberFormat('es-MX')

// Esta página es el KM 22.1 del roadbook: el riel sigue mostrando la ruta larga.
const RUTA_REFERENCIA = RUTAS.larga
const KM_PAGINA = 22.1

const esRama = (v: string | null): v is Rama => v === 'V' || v === 'F'

export function PaginaCategorias() {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const kmRielRef = useRef<HTMLDivElement>(null)
  const barraKmRef = useRef<HTMLElement>(null)
  const desnivelRef = useRef<HTMLElement>(null)
  const proxRef = useRef<HTMLSpanElement>(null)

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

  // El eje se calcula UNA vez desde los datos. Filtrar no lo recalcula.
  const eje = useMemo(() => construirEje(CATEGORIAS), [])
  const abiertas = useMemo(() => CATEGORIAS.filter((c) => c.abierta), [])

  // Filtros con estado en la URL (compartible por WhatsApp).
  const [params, setParams] = useHashParams()
  const filtros: EstadoFiltros = {
    rama: esRama(params.get('rama')) ? (params.get('rama') as Rama) : 'todas',
    grupo: params.get('grupo') ?? 'todos',
    busqueda: params.get('q') ?? '',
  }
  const cambiarFiltros = useCallback(
    (cambios: Partial<EstadoFiltros>) => {
      setParams({
        ...(cambios.rama !== undefined ? { rama: cambios.rama === 'todas' ? null : cambios.rama } : {}),
        ...(cambios.grupo !== undefined ? { grupo: cambios.grupo === 'todos' ? null : cambios.grupo } : {}),
        ...(cambios.busqueda !== undefined ? { q: cambios.busqueda } : {}),
      })
    },
    [setParams],
  )

  const coincidencias = useMemo(() => {
    const q = filtros.busqueda.trim().toLocaleLowerCase('es-MX')
    return CATEGORIAS.filter((c) => {
      if (filtros.rama !== 'todas' && c.rama !== filtros.rama) return false
      if (filtros.grupo !== 'todos' && c.grupo !== filtros.grupo) return false
      if (q !== '' && !`${c.nombre} ${c.clave}`.toLocaleLowerCase('es-MX').includes(q)) return false
      return true
    }).length
  }, [filtros.rama, filtros.grupo, filtros.busqueda])

  // Resultado del widget: resalta el eje. Estado DISCRETO, no por frame.
  const [resultado, setResultado] = useState<ResultadoWidget | null>(null)
  const alResultado = useCallback((r: ResultadoWidget) => {
    setResultado((prev) =>
      prev &&
      prev.edad === r.edad &&
      prev.sexo === r.sexo &&
      prev.recomendada?.id === r.recomendada?.id
        ? prev
        : r,
    )
  }, [])

  const edadMarcador = resultado?.edad ?? null
  const ramaResaltada: Rama | null =
    resultado?.sexo === 'M' ? 'V' : resultado?.sexo === 'F' ? 'F' : null
  const filaMarcador = edadMarcador !== null ? filaDeEdad(eje, edadMarcador) : -1

  // Rama visible en móvil: sigue al widget si ya respondió, si no al filtro.
  const ramaMovil: Rama =
    ramaResaltada ?? (filtros.rama === 'todas' ? 'V' : filtros.rama)
  const [ramaMovilManual, setRamaMovilManual] = useState<Rama | null>(null)
  const ramaMovilFinal = ramaMovilManual ?? ramaMovil

  return (
    <div ref={contenedorRef}>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <Riel ruta={RUTA_REFERENCIA} kmRef={kmRielRef} />
      <BarraKm kmRef={barraKmRef} desnivelRef={desnivelRef} proxRef={proxRef} />
      <Cabecera paginaActual="categorias" />

      <main id="contenido" className="superficie">
        {/* ============ Encabezado ============ */}
        <section className="seccion-cat">
          <div className="contenedor">
            <HitoPagina
              km={KM_PAGINA}
              rotulo="Quién corre"
              desnivel={desnivelAcumulado(RUTA_REFERENCIA.perfil, KM_PAGINA)}
            />
            {/* Sin TituloAncho a propósito: esta página es técnica y va
                CONDENSADA (§3.1); el eje de ancho expandido se quedó en el Inicio. */}
            <h1 className="display display--condensado titulo-cat">
              <span className="cifra titulo-cat__num">{CATEGORIAS.length}</span> categorías con
              premiación
            </h1>
            <p className="serif intro-cat">
              La categoría se define por una sola variable: tu edad nominal. Abajo, cada categoría
              ocupa el tramo de edad que le corresponde de verdad: varonil a la izquierda, femenil a
              la derecha.{' '}
              <span className="medida">
                Las que no dependen de la edad viven en su propia banda, más abajo.
              </span>
            </p>
          </div>
        </section>

        {/* ============ ¿Cuál me toca? (arriba, es lo que la gente viene a hacer) */}
        <section className="seccion-cat seccion--carbon" id="cual-me-toca">
          <div className="contenedor">
            <h2 className="subtitulo-cat">¿Cuál me toca?</h2>
            <WidgetCategoria variante="completo" onResultado={alResultado} />
            <FiltrosCategorias
              filtros={filtros}
              onCambio={cambiarFiltros}
              coincidencias={coincidencias}
              total={CATEGORIAS.length}
            />
          </div>
        </section>

        {/* ============ El eje de edad ============ */}
        <section className="seccion-cat">
          <div className="contenedor">
            <h2 className="subtitulo-cat">El eje de edad</h2>

            {/* Móvil: una rama a la vez (a 360px no cabe el eje de dos columnas). */}
            <div className="selector selector--movil" role="group" aria-label="Rama a mostrar">
              <button
                type="button"
                aria-pressed={ramaMovilFinal === 'V'}
                onClick={() => setRamaMovilManual('V')}
              >
                Varonil
              </button>
              <button
                type="button"
                aria-pressed={ramaMovilFinal === 'F'}
                onClick={() => setRamaMovilManual('F')}
              >
                Femenil
              </button>
            </div>

            <EjeEdad
              eje={eje}
              filtros={filtros}
              recomendadaId={resultado?.recomendada?.id ?? null}
              ramaResaltada={ramaResaltada}
              edadMarcador={edadMarcador}
              filaMarcador={filaMarcador}
              ramaMovil={ramaMovilFinal}
            />
          </div>
        </section>

        {/* ============ Sin límite de edad ============ */}
        <section className="seccion-cat seccion--carbon">
          <div className="contenedor">
            <h2 className="subtitulo-cat">Sin límite de edad</h2>
            <p className="serif intro-cat">
              Estas <span className="cifra">{abiertas.length}</span> categorías no tienen posición
              en el eje porque no se definen por edad, sino por condición.
            </p>
            <BandaAbiertas categorias={abiertas} filtros={filtros} />
          </div>
        </section>

        {/* ============ Cómo se compite ============ */}
        <section className="seccion-cat">
          <div className="contenedor">
            <h2 className="subtitulo-cat">Cómo se compite</h2>
            <TablaCompetencia categorias={CATEGORIAS} />
            <p className="medida serif nota-comite">
              Vueltas y ruta por confirmar con el comité antes de la publicación oficial. La salida
              es a las {CONFIG.horaArranque} desde el {CONFIG.salidaMeta}.
            </p>
          </div>
        </section>

        {/* ============ Preguntas ============ */}
        <section className="seccion-cat seccion--carbon">
          <div className="contenedor">
            <h2 className="subtitulo-cat">Preguntas</h2>
            <Preguntas />
          </div>
        </section>
      </main>

      <PieSitio />
    </div>
  )
}
