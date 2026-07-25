import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import '../styles/inscripciones.css'
import type {
  CampoFormulario,
  DatosFormulario,
  ErroresFormulario,
  NumeroControl,
  PayloadRegistro,
} from '../types/registro'
import { CONFIG, urlWhatsApp } from '../data/config'
import { CATEGORIAS } from '../data/categorias'
import { RUTAS } from '../data/rutas'
import { categoriasElegibles, edadNominal } from '../lib/categorias'
import {
  CONTROLES,
  DATOS_INICIALES,
  crearPayload,
  erroresDeControl,
  fechaHoraIsoLocal,
  folioNuevo,
  mensajeWhatsApp,
  rutaPermitida,
  validarRegistro,
} from '../lib/registro'
import { desnivelAcumulado, proximoHito } from '../lib/perfil'
import { useScrollProgress } from '../hooks/useScrollProgress'
import { useHashParams } from '../hooks/useHashParams'
import { useBorrador } from '../hooks/useBorrador'
import { Cabecera } from '../components/Cabecera'
import { Riel } from '../components/Riel'
import { BarraKm } from '../components/BarraKm'
import { PieSitio } from '../components/PieSitio'
import { HitoPagina } from '../components/HitoPagina'
import { FranjaClara } from '../components/FranjaClara'
import { ControlProgreso } from '../components/ControlProgreso'
import { PlacaViva } from '../components/PlacaViva'
import { Control1Quien } from '../components/controles/Control1Quien'
import { Control2Como } from '../components/controles/Control2Como'
import { Control3Kit } from '../components/controles/Control3Kit'
import { Control4Seguridad } from '../components/controles/Control4Seguridad'
import { MetaConfirmacion } from '../components/controles/MetaConfirmacion'

const nf = new Intl.NumberFormat('es-MX')
const RUTA_REFERENCIA = RUTAS.larga
const KM_PAGINA = 48.9
const CLAVE_BORRADOR = `reto-puma-bike-registro-${CONFIG.anioEvento}`

const kitConJersey = (nombre: string): boolean =>
  CONFIG.kits.some((k) => k.nombre === nombre && k.incluye.some((i) => /jersey/i.test(i)))

// ---- Estado del formulario: UN solo reducer, sin librerías -----------------
interface EstadoForm {
  datos: DatosFormulario
  /** Campos que el usuario ya tocó: solo esos muestran error. */
  tocados: CampoFormulario[]
  /** Aviso visible cuando el motor tuvo que limpiar la categoría. */
  avisoRecalculo: string | null
  enviado: PayloadRegistro | null
}

type Accion =
  | { tipo: 'campo'; parche: Partial<DatosFormulario> }
  | { tipo: 'tocar'; campos: CampoFormulario[] }
  | { tipo: 'restaurar'; datos: DatosFormulario }
  | { tipo: 'limpiarCategoria'; motivo: string }
  | { tipo: 'quitarAviso' }
  | { tipo: 'enviar'; payload: PayloadRegistro }
  | { tipo: 'corregir' }

function reducir(estado: EstadoForm, accion: Accion): EstadoForm {
  switch (accion.tipo) {
    case 'campo':
      return { ...estado, datos: { ...estado.datos, ...accion.parche } }
    case 'tocar': {
      const nuevos = accion.campos.filter((c) => !estado.tocados.includes(c))
      return nuevos.length === 0 ? estado : { ...estado, tocados: [...estado.tocados, ...nuevos] }
    }
    case 'restaurar':
      return { ...estado, datos: accion.datos, tocados: [], avisoRecalculo: null }
    case 'limpiarCategoria':
      return {
        ...estado,
        datos: { ...estado.datos, categoria_id: null },
        avisoRecalculo: accion.motivo,
      }
    case 'quitarAviso':
      return estado.avisoRecalculo === null ? estado : { ...estado, avisoRecalculo: null }
    case 'enviar':
      return { ...estado, enviado: accion.payload }
    case 'corregir':
      return { ...estado, enviado: null }
    default:
      return estado
  }
}

/** Valida en el borde: nunca confiamos en la forma de lo guardado en sesión. */
function validarBorrador(valor: unknown): DatosFormulario | null {
  if (typeof valor !== 'object' || valor === null) return null
  const bruto: Record<string, unknown> = { ...valor }
  const datos: DatosFormulario = { ...DATOS_INICIALES }
  for (const clave of Object.keys(DATOS_INICIALES)) {
    const esperado = DATOS_INICIALES[clave as CampoFormulario]
    const recibido = bruto[clave]
    if (typeof esperado === 'string' && typeof recibido === 'string') {
      Object.assign(datos, { [clave]: recibido })
    } else if (typeof esperado === 'boolean' && typeof recibido === 'boolean') {
      Object.assign(datos, { [clave]: recibido })
    } else if (clave === 'categoria_id' && (typeof recibido === 'number' || recibido === null)) {
      datos.categoria_id = typeof recibido === 'number' ? recibido : null
    }
  }
  return datos
}

const esControl = (v: string | null): v is '1' | '2' | '3' | '4' | '5' =>
  v === '1' || v === '2' || v === '3' || v === '4' || v === '5'

/**
 * Categoría preseleccionada por enlace profundo (`#/inscripciones?categoria=26`),
 * que es lo que prometen las tarjetas de Categorías y el widget. Si con los
 * datos capturados deja de ser válida, el recálculo la limpia con aviso.
 */
function categoriaDeLaUrl(): number | null {
  const hash = window.location.hash
  const i = hash.indexOf('?')
  if (i < 0) return null
  const valor = new URLSearchParams(hash.slice(i + 1)).get('categoria')
  if (valor === null) return null
  const id = Number(valor)
  return CATEGORIAS.some((c) => c.id === id) ? id : null
}

export function PaginaInscripciones() {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const kmRielRef = useRef<HTMLDivElement>(null)
  const barraKmRef = useRef<HTMLElement>(null)
  const desnivelRef = useRef<HTMLElement>(null)
  const proxRef = useRef<HTMLSpanElement>(null)
  const tituloControlRef = useRef<HTMLHeadingElement>(null)

  const alFrame = useCallback((progreso: number) => {
    const km = progreso * RUTA_REFERENCIA.km
    const siguiente = proximoHito(RUTA_REFERENCIA.hitos, km)
    const nombre = (siguiente ? siguiente.nombre : 'Meta').replace(' · Pabellón Gastronómico', '')
    if (kmRielRef.current) kmRielRef.current.textContent = `KM ${km.toFixed(0)}`
    if (barraKmRef.current) barraKmRef.current.textContent = km.toFixed(0)
    if (desnivelRef.current) {
      desnivelRef.current.textContent = `+${nf.format(desnivelAcumulado(RUTA_REFERENCIA.perfil, km))}`
    }
    if (proxRef.current) proxRef.current.textContent = nombre
  }, [])
  useScrollProgress(contenedorRef, alFrame)

  const [estado, dispatch] = useReducer(
    reducir,
    undefined,
    (): EstadoForm => ({
      datos: { ...DATOS_INICIALES, categoria_id: categoriaDeLaUrl() },
      tocados: [],
      avisoRecalculo: null,
      enviado: null,
    }),
  )
  const { datos } = estado

  // ---- El paso activo vive en la URL: el botón "atrás" retrocede de control.
  const [params, setParams] = useHashParams()
  const controlUrl = params.get('control')
  const control: NumeroControl = esControl(controlUrl) ? (Number(controlUrl) as NumeroControl) : 1
  const modoTodo = params.get('vista') === 'todo'

  const irAControl = useCallback(
    (numero: NumeroControl) => {
      setParams({ control: String(numero) }, { historial: true })
    },
    [setParams],
  )

  // ---- Borrador: la señal se cae y la gente recarga.
  const { hayGuardado, guardar, leer, olvidar } = useBorrador<DatosFormulario>(CLAVE_BORRADOR)
  // OJO: no guardar en el primer render. Al recargar la página, el estado
  // arranca vacío y guardar aquí BORRARÍA el borrador que queremos ofrecer.
  const montado = useRef(false)
  useEffect(() => {
    if (!montado.current) {
      montado.current = true
      return
    }
    guardar(datos)
  }, [datos, guardar])

  const recuperar = () => {
    const guardado = leer(validarBorrador)
    if (guardado) dispatch({ tipo: 'restaurar', datos: guardado })
  }

  // ---- Motor de categorías: memoizado sobre sus entradas REALES.
  const edad = useMemo(
    () => (datos.fecha_nacimiento === '' ? null : edadNominal(datos.fecha_nacimiento, CONFIG.anioEvento)),
    [datos.fecha_nacimiento],
  )
  const elegibles = useMemo(() => {
    if (edad === null || datos.sexo === '') return null
    return categoriasElegibles({
      edadNominal: edad,
      sexo: datos.sexo,
      tipoBicicleta: datos.tipo_bicicleta,
      peso90mas: datos.peso_90_mas,
    })
  }, [edad, datos.sexo, datos.tipo_bicicleta, datos.peso_90_mas])

  const idsElegibles = useMemo(() => {
    if (!elegibles) return new Set<number>()
    const ids = new Set<number>()
    if (elegibles.recomendada) ids.add(elegibles.recomendada.id)
    for (const a of elegibles.alternativas) ids.add(a.id)
    return ids
  }, [elegibles])

  const categoriaElegida = useMemo(
    () => CATEGORIAS.find((c) => c.id === datos.categoria_id) ?? null,
    [datos.categoria_id],
  )

  // Recalcula al cambiar rama, fecha, bici o peso: preselecciona la recomendada
  // y limpia la elección si dejó de ser válida, SIEMPRE con aviso visible.
  useEffect(() => {
    if (!elegibles) return
    if (datos.categoria_id === null) {
      if (elegibles.recomendada) {
        dispatch({ tipo: 'campo', parche: { categoria_id: elegibles.recomendada.id } })
      }
      return
    }
    if (!idsElegibles.has(datos.categoria_id)) {
      const anterior = CATEGORIAS.find((c) => c.id === datos.categoria_id)
      dispatch({
        tipo: 'limpiarCategoria',
        motivo: anterior
          ? `Quitamos ${anterior.nombre} porque ya no corresponde a los datos que cambiaste. Elige de nuevo.`
          : 'Tu categoría dejó de ser válida con los datos que cambiaste. Elige de nuevo.',
      })
    }
  }, [elegibles, idsElegibles, datos.categoria_id])

  // La ruta se sugiere desde MAPA_RUTAS según el grupo de la categoría elegida.
  useEffect(() => {
    if (!categoriaElegida) return
    const sugerida = rutaPermitida(categoriaElegida.grupo, datos.ruta)
    if (sugerida !== '' && sugerida !== datos.ruta) {
      dispatch({ tipo: 'campo', parche: { ruta: sugerida } })
    }
  }, [categoriaElegida, datos.ruta])

  // ---- Validación: nunca mientras se escribe. Solo en blur o al avanzar.
  const todosLosErrores = useMemo(
    () =>
      validarRegistro(datos, {
        anioEvento: CONFIG.anioEvento,
        kits: CONFIG.kits,
        kitConJersey,
      }),
    [datos],
  )
  const erroresVisibles: ErroresFormulario = useMemo(() => {
    const salida: ErroresFormulario = {}
    for (const campo of estado.tocados) {
      const mensaje = todosLosErrores[campo]
      if (mensaje !== undefined) salida[campo] = mensaje
    }
    return salida
  }, [estado.tocados, todosLosErrores])

  const onCampo = useCallback(
    <C extends CampoFormulario>(campo: C, valor: DatosFormulario[C]) => {
      const parche: Partial<DatosFormulario> = {}
      parche[campo] = valor
      dispatch({ tipo: 'campo', parche })
      dispatch({ tipo: 'quitarAviso' })
    },
    [],
  )
  const onBlur = useCallback((campo: CampoFormulario) => {
    dispatch({ tipo: 'tocar', campos: [campo] })
  }, [])

  const definicion = CONTROLES.find((c) => c.numero === control) ?? CONTROLES[0]
  const sellados = useMemo(() => {
    const listos = new Set<NumeroControl>()
    for (const c of CONTROLES) {
      if (c.campos.length === 0) continue
      if (Object.keys(erroresDeControl(todosLosErrores, c.campos)).length === 0) listos.add(c.numero)
    }
    return listos
  }, [todosLosErrores])

  const avanzar = () => {
    const faltantes = erroresDeControl(todosLosErrores, definicion.campos)
    if (Object.keys(faltantes).length > 0) {
      dispatch({ tipo: 'tocar', campos: definicion.campos })
      return
    }
    if (control === 4) {
      enviar()
      return
    }
    const siguiente = (control + 1) as NumeroControl
    irAControl(siguiente)
  }

  const enviar = () => {
    const faltantes = validarRegistro(datos, {
      anioEvento: CONFIG.anioEvento,
      kits: CONFIG.kits,
      kitConJersey,
    })
    if (Object.keys(faltantes).length > 0) {
      dispatch({ tipo: 'tocar', campos: Object.keys(faltantes) as CampoFormulario[] })
      return
    }
    const categoria = CATEGORIAS.find((c) => c.id === datos.categoria_id)
    const kit = CONFIG.kits.find((k) => k.nombre === datos.kit)
    if (!categoria || !kit) return

    // SUPUESTO: el consecutivo del folio lo asignará el backend. Mientras, se
    // genera en el cliente solo para que el usuario tenga un comprobante.
    const consecutivo = Math.floor(Math.random() * 999999) + 1
    const payload = crearPayload({
      folio: folioNuevo(CONFIG.anioEvento, consecutivo),
      creadoEn: fechaHoraIsoLocal(new Date()),
      datos,
      categoria,
      kit,
      anioEvento: CONFIG.anioEvento,
      kitConJersey: kitConJersey(kit.nombre),
    })

    console.log(payload)
    // TODO BACKEND: POST /api/registros

    dispatch({ tipo: 'enviar', payload })
    irAControl(5)
    olvidar()
  }

  // Al CAMBIAR de control, mueve el foco al encabezado nuevo. En el primer
  // render no: enfocar al entrar deja un anillo de foco que parece un error.
  const controlPrevio = useRef<NumeroControl | null>(null)
  useEffect(() => {
    const cambio = controlPrevio.current !== null && controlPrevio.current !== control
    controlPrevio.current = control
    if (cambio && !modoTodo) tituloControlRef.current?.focus()
  }, [control, modoTodo])

  const postevento = CONFIG.estado === 'postevento'
  const mensajeWa = mensajeWhatsApp(datos, CONFIG.anioEvento, CONFIG.evento)
  const kitElegido = CONFIG.kits.find((k) => k.nombre === datos.kit) ?? null

  const cuerpoControl = (numero: NumeroControl) => {
    switch (numero) {
      case 1:
        return (
          <Control1Quien
            datos={datos}
            errores={erroresVisibles}
            edad={edad}
            onCampo={onCampo}
            onBlur={onBlur}
          />
        )
      case 2:
        return (
          <Control2Como
            datos={datos}
            errores={erroresVisibles}
            edad={edad}
            elegibles={elegibles}
            categoriaElegida={categoriaElegida}
            onCampo={onCampo}
            onBlur={onBlur}
          />
        )
      case 3:
        return (
          <Control3Kit
            datos={datos}
            errores={erroresVisibles}
            kits={CONFIG.kits}
            kitConJersey={kitConJersey}
            onCampo={onCampo}
          />
        )
      case 4:
        return (
          <Control4Seguridad
            datos={datos}
            errores={erroresVisibles}
            onCampo={onCampo}
            onBlur={onBlur}
          />
        )
      default:
        return null
    }
  }

  return (
    <div ref={contenedorRef}>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <Riel ruta={RUTA_REFERENCIA} kmRef={kmRielRef} />
      <BarraKm kmRef={barraKmRef} desnivelRef={desnivelRef} proxRef={proxRef} />
      <Cabecera paginaActual="inscripciones" ctaDorado={false} />

      <main id="contenido" className="superficie">
        {/* ---- Encabezado oscuro ---- */}
        <section className="seccion-insc">
          <div className="contenedor">
            <HitoPagina
              km={KM_PAGINA}
              rotulo="Inscripción"
              desnivel={desnivelAcumulado(RUTA_REFERENCIA.perfil, KM_PAGINA)}
            />
            <h1 className="display display--condensado titulo-insc">Aparta tu lugar</h1>

            {postevento ? (
              <div className="aviso aviso--cerrado">
                <p className="aviso__titulo">Inscripciones cerradas</p>
                <p className="serif">
                  Te avisamos cuando abran las de la siguiente edición. Si quieres que te
                  escribamos, mándanos un mensaje.
                </p>
                <a
                  className="boton boton--oro"
                  href={urlWhatsApp(
                    `Hola, quiero que me avisen cuando abran las inscripciones del ${CONFIG.evento}.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  Avísenme por WhatsApp
                </a>
              </div>
            ) : (
              /* ---- LOS DOS CAMINOS, con el mismo peso visual ---- */
              <div className="caminos-insc">
                <div className="camino-insc">
                  <h2 className="camino-insc__titulo">En línea</h2>
                  <p className="serif">Llénalo tú, tardas 3 minutos.</p>
                  <a className="boton boton--linea" href="#formulario">
                    Empezar el registro
                  </a>
                </div>
                <div className="camino-insc">
                  <h2 className="camino-insc__titulo">Por WhatsApp</h2>
                  <p className="serif">Te ayudamos a registrarte por mensaje.</p>
                  <a
                    className="boton boton--linea"
                    href={urlWhatsApp(mensajeWa)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Escribir al comité
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ---- ZONA DE LUZ: el formulario ---- */}
        <FranjaClara className="zona-formulario">
          <div className="contenedor" id="formulario">
            {postevento ? (
              <div className="kits-referencia">
                <h2 className="subtitulo-insc">Los kits de esta edición</h2>
                <ul className="kits-lista">
                  {CONFIG.kits.map((kit) => (
                    <li key={kit.nombre}>
                      <h3>{kit.nombre}</h3>
                      <p className="kit-ref__precio">
                        <span className="cifra">${nf.format(kit.precio)}</span> MXN
                      </p>
                      <ul>
                        {kit.incluye.map((i) => (
                          <li key={i}>{i}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="registro">
                <div className="registro__form">
                  {hayGuardado && estado.enviado === null ? (
                    <div className="aviso aviso--borrador">
                      <p className="serif">Tienes un registro a medias en este dispositivo.</p>
                      <div className="aviso__acciones">
                        <button className="boton boton--linea boton--chico" type="button" onClick={recuperar}>
                          Recupera tus datos
                        </button>
                        <button className="enlace-duro" type="button" onClick={olvidar}>
                          Empezar de nuevo
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {estado.enviado === null ? (
                    <>
                      <ControlProgreso
                        ruta={RUTA_REFERENCIA}
                        controles={CONTROLES}
                        actual={control}
                        sellados={sellados}
                        onIr={irAControl}
                      />

                      <p className="modo-todo">
                        <button
                          className="enlace-duro"
                          type="button"
                          onClick={() => setParams({ vista: modoTodo ? null : 'todo' })}
                        >
                          {modoTodo ? 'Ver un control a la vez' : 'Ver todo el formulario en una página'}
                        </button>
                      </p>

                      <p className="visually-hidden" aria-live="polite">
                        {modoTodo
                          ? 'Mostrando el formulario completo.'
                          : `Control ${control} de 4: ${definicion.titulo}.`}
                      </p>

                      {estado.avisoRecalculo !== null ? (
                        <p className="aviso aviso--recalculo serif" role="alert">
                          {estado.avisoRecalculo}
                        </p>
                      ) : null}

                      {modoTodo ? (
                        // Modo scroll continuo: conserva TODO lo capturado.
                        <>
                          {CONTROLES.filter((c) => c.numero !== 5).map((c) => (
                            <fieldset className="control" key={c.numero}>
                              <legend className="control__leyenda">
                                <span className="control__km dato">KM {c.km}</span>
                                <span className="control__titulo">{c.titulo}</span>
                              </legend>
                              {cuerpoControl(c.numero)}
                            </fieldset>
                          ))}
                          <div className="control__acciones">
                            <button className="boton boton--oro" type="button" onClick={enviar}>
                              Apartar mi lugar
                            </button>
                          </div>
                        </>
                      ) : (
                        <fieldset className="control">
                          <legend className="control__leyenda">
                            <span className="control__km dato">
                              KM {definicion.km} · control {control} de 4
                            </span>
                            <h2 className="control__titulo" ref={tituloControlRef} tabIndex={-1}>
                              {definicion.titulo}
                            </h2>
                          </legend>

                          {cuerpoControl(control)}

                          <div className="control__acciones">
                            {control > 1 ? (
                              <button
                                className="boton boton--linea"
                                type="button"
                                onClick={() => irAControl((control - 1) as NumeroControl)}
                              >
                                Atrás
                              </button>
                            ) : null}
                            <button className="boton boton--oro" type="button" onClick={avanzar}>
                              {control === 4 ? 'Apartar mi lugar' : 'Siguiente control'}
                            </button>
                          </div>
                        </fieldset>
                      )}

                      <p className="wa-parcial">
                        <a
                          className="enlace-duro"
                          href={urlWhatsApp(mensajeWa)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Prefiero terminar por WhatsApp
                        </a>
                        <span className="wa-parcial__nota serif">
                          El mensaje ya lleva lo que capturaste.
                        </span>
                      </p>
                    </>
                  ) : (
                    <MetaConfirmacion
                      payload={estado.enviado}
                      onCorregir={(numero) => {
                        dispatch({ tipo: 'corregir' })
                        irAControl(numero)
                      }}
                    />
                  )}
                </div>

                {/* La placa se arma en vivo mientras se llena el formulario. */}
                <aside className="registro__placa">
                  <PlacaViva
                    datos={datos}
                    categoria={categoriaElegida}
                    precioKit={kitElegido?.precio ?? null}
                  />
                </aside>
              </div>
            )}
          </div>
        </FranjaClara>
      </main>

      <PieSitio />
    </div>
  )
}
