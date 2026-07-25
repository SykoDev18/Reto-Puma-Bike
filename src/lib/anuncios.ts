import type { Anuncios, Aviso, TipoAviso } from '../types/anuncios'
// Extensión explícita: es un import de VALOR y el cargador de tipos de Node
// (--experimental-strip-types, el que corre los tests) no resuelve sin ella.
import { TIPOS } from '../types/anuncios.ts'

// ===========================================================================
// Carga
// ===========================================================================

export const URL_ANUNCIOS = '/data/anuncios.json'

/**
 * Carga los avisos. NO se importa: la gracia de este archivo es que el comité
 * pueda cambiarlo sin recompilar el sitio. Cuando exista el admin del backend,
 * aquí solo cambia la URL.
 */
export async function cargarAnuncios(url: string = URL_ANUNCIOS): Promise<Anuncios> {
  const respuesta = await fetch(url)
  if (!respuesta.ok) throw new Error('No se pudieron cargar los avisos')
  const crudo: unknown = await respuesta.json()
  return validarAnuncios(crudo)
}

// ---- Validación en el borde -----------------------------------------------

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const esTipo = (v: unknown): v is TipoAviso => typeof v === 'string' && TIPOS.some((t) => t === v)

const textoNoVacio = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

const esEnlace = (v: unknown): v is { texto: string; url: string } =>
  esObjeto(v) && textoNoVacio(v.texto) && textoNoVacio(v.url)

function esAviso(v: unknown): v is Aviso {
  if (!esObjeto(v)) return false
  if (!textoNoVacio(v.id) || !textoNoVacio(v.fecha) || !esTipo(v.tipo)) return false
  if (!textoNoVacio(v.titulo)) return false
  // La regla de la página: sin texto real no se publica. Se valida en el borde,
  // no en el render, para que el fallo se vea al cargar y no en silencio.
  if (!textoNoVacio(v.cuerpo)) return false
  // Si hay imagen, el alt es obligatorio. Una imagen sin alt es información
  // perdida para quien usa lector de pantalla.
  if (v.imagen !== undefined && (!textoNoVacio(v.imagen) || !textoNoVacio(v.imagenAlt))) return false
  if (v.enlace !== undefined && !esEnlace(v.enlace)) return false
  if (v.fijado !== undefined && typeof v.fijado !== 'boolean') return false
  if (v.vigenteHasta !== undefined && !textoNoVacio(v.vigenteHasta)) return false
  return true
}

export function validarAnuncios(v: unknown): Anuncios {
  if (esObjeto(v) && textoNoVacio(v.actualizado) && Array.isArray(v.avisos) && v.avisos.every(esAviso)) {
    return { actualizado: v.actualizado, avisos: v.avisos }
  }
  throw new Error('El archivo de avisos no cumple el contrato')
}

// ===========================================================================
// Vigencia y orden
// ===========================================================================

/** Compara solo la fecha (YYYY-MM-DD), sin zona horaria ni hora. */
function soloFecha(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * ¿Sigue vigente? Sin `vigenteHasta` un aviso no caduca. Con ella, el último
 * día vigente es la propia fecha (inclusive): "vigente hasta el 4" incluye el 4.
 */
export function estaVigente(aviso: Aviso, hoyIso: string): boolean {
  if (aviso.vigenteHasta === undefined) return true
  return soloFecha(hoyIso) <= soloFecha(aviso.vigenteHasta)
}

/** Del más reciente al más viejo. A igual fecha, el folio mayor primero. */
export function porFechaDesc(a: Aviso, b: Aviso): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1
  return a.id < b.id ? 1 : -1
}

export interface Tablero {
  /** Fijados Y vigentes. Van arriba. */
  fijados: Aviso[]
  /** Todo lo demás, incluidos los fijados que ya vencieron. */
  archivo: Aviso[]
}

/**
 * Separa el tablero. Un aviso fijado cuya `vigenteHasta` ya pasó se despublica
 * SOLO de la zona de fijados y baja al archivo — no se borra: el histórico es
 * útil y borrarlo rompería los enlaces que ya circulan por WhatsApp.
 */
export function armarTablero(avisos: readonly Aviso[], hoyIso: string): Tablero {
  const fijados: Aviso[] = []
  const archivo: Aviso[] = []
  for (const aviso of avisos) {
    if (aviso.fijado === true && estaVigente(aviso, hoyIso)) fijados.push(aviso)
    else archivo.push(aviso)
  }
  return { fijados: fijados.sort(porFechaDesc), archivo: archivo.sort(porFechaDesc) }
}

/** Los N más recientes y vigentes: es lo que se asoma en el Inicio. */
export function masRecientes(avisos: readonly Aviso[], hoyIso: string, cuantos = 3): Aviso[] {
  return avisos
    .filter((a) => estaVigente(a, hoyIso))
    .sort(porFechaDesc)
    .slice(0, cuantos)
}

// ===========================================================================
// Agrupación por mes
// ===========================================================================

export interface GrupoMes {
  /** "2026-07" — clave estable para React. */
  clave: string
  /** "Julio 2026" — rótulo ya formateado. */
  etiqueta: string
  avisos: Aviso[]
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** "2026-07" -> "Julio 2026". Sin `new Date`: evita el corrimiento de zona. */
export function etiquetaMes(clave: string): string {
  const [anio, mes] = clave.split('-')
  const indice = Number(mes) - 1
  const nombre = MESES[indice]
  return nombre === undefined ? clave : `${nombre} ${anio}`
}

/** Agrupa por mes conservando el orden de entrada (ya ordenado desc). */
export function agruparPorMes(avisos: readonly Aviso[]): GrupoMes[] {
  const grupos: GrupoMes[] = []
  for (const aviso of avisos) {
    const clave = aviso.fecha.slice(0, 7)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo !== undefined && ultimo.clave === clave) ultimo.avisos.push(aviso)
    else grupos.push({ clave, etiqueta: etiquetaMes(clave), avisos: [aviso] })
  }
  return grupos
}

// ===========================================================================
// Presentación
// ===========================================================================

/** "2026-07-18" -> "18 JUL 2026", el rótulo del comunicado. */
const ABREVIATURAS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

export function fechaCorta(iso: string): string {
  const [anio, mes, dia] = soloFecha(iso).split('-')
  const abrev = ABREVIATURAS[Number(mes) - 1]
  return abrev === undefined ? iso : `${dia} ${abrev} ${anio}`
}

/** "18 de julio de 2026" para el encabezado de la página. */
export function fechaLarga(iso: string): string {
  const [anio, mes, dia] = soloFecha(iso).split('-')
  const nombre = MESES[Number(mes) - 1]
  return nombre === undefined ? iso : `${Number(dia)} de ${nombre.toLowerCase()} de ${anio}`
}

/** Filtro por tipo. `null` = todos. Atenúa en la UI, no oculta. */
export function coincideTipo(aviso: Aviso, tipo: TipoAviso | null): boolean {
  return tipo === null || aviso.tipo === tipo
}

/** Cuántos avisos hay de cada tipo, para los contadores del filtro. */
export function contarPorTipo(avisos: readonly Aviso[]): Record<TipoAviso, number> {
  const cuenta: Record<TipoAviso, number> = {
    convocatoria: 0,
    logistica: 0,
    resultados: 0,
    patrocinadores: 0,
  }
  for (const aviso of avisos) cuenta[aviso.tipo] += 1
  return cuenta
}
