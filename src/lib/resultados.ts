import type {
  CategoriaResultado,
  Corredor,
  EntradaIndice,
  EstadoCorredor,
  Resultados,
} from '../types/resultados'

// ===========================================================================
// Carga
// ===========================================================================

/** Ruta pública del JSON. Es exactamente lo que el backend va a servir después. */
export const URL_RESULTADOS = '/data/resultados-2026.json'

/**
 * Carga los resultados. NO se importa el JSON: son 177 kB y entrarían al bundle,
 * los pagaría también quien solo abre el Inicio. Cuando exista el backend, aquí
 * solo cambia la URL.
 */
export async function cargarResultados(url: string = URL_RESULTADOS): Promise<Resultados> {
  const respuesta = await fetch(url)
  if (!respuesta.ok) throw new Error('No se pudieron cargar los resultados')
  const crudo: unknown = await respuesta.json()
  return validarResultados(crudo)
}

// ---- Validación en el borde -----------------------------------------------
// Los datos vienen de fuera: se validan aquí y adentro ya son del tipo. Sin
// `as` para callar al compilador; los type guards hacen el estrechamiento.

const ESTADOS: readonly EstadoCorredor[] = ['OK', 'SIN_TIEMPO', 'REVISION', 'DNF', 'DNS', 'DSQ']

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const esEstado = (v: unknown): v is EstadoCorredor =>
  typeof v === 'string' && ESTADOS.some((e) => e === v)

const numeroONulo = (v: unknown): v is number | null => v === null || typeof v === 'number'
const textoONulo = (v: unknown): v is string | null => v === null || typeof v === 'string'

function esCorredor(v: unknown): v is Corredor {
  return (
    esObjeto(v) &&
    typeof v.dorsal === 'number' &&
    typeof v.nombre === 'string' &&
    textoONulo(v.equipo) &&
    numeroONulo(v.posicion) &&
    textoONulo(v.tiempo) &&
    typeof v.vueltas_hechas === 'number' &&
    typeof v.vueltas_totales === 'number' &&
    esEstado(v.estado) &&
    (v.nota === undefined || typeof v.nota === 'string')
  )
}

function esCategoria(v: unknown): v is CategoriaResultado {
  return (
    esObjeto(v) &&
    typeof v.id === 'string' &&
    typeof v.clave === 'string' &&
    typeof v.clave_provisional === 'boolean' &&
    typeof v.nombre === 'string' &&
    typeof v.ruta === 'string' &&
    typeof v.grupo === 'string' &&
    Array.isArray(v.corredores) &&
    v.corredores.every(esCorredor)
  )
}

/** Valida la carga completa o lanza. Nunca devuelve datos a medias. */
export function validarResultados(v: unknown): Resultados {
  if (
    esObjeto(v) &&
    typeof v.evento === 'string' &&
    typeof v.edicion === 'string' &&
    typeof v.anio === 'number' &&
    typeof v.generado_en === 'string' &&
    typeof v.version === 'number' &&
    typeof v.parcial === 'boolean' &&
    (v.nota_parcial === undefined || typeof v.nota_parcial === 'string') &&
    Array.isArray(v.categorias) &&
    v.categorias.every(esCategoria)
  ) {
    return {
      evento: v.evento,
      edicion: v.edicion,
      anio: v.anio,
      generado_en: v.generado_en,
      version: v.version,
      parcial: v.parcial,
      nota_parcial: v.nota_parcial,
      categorias: v.categorias,
    }
  }
  throw new Error('El archivo de resultados no cumple el contrato de cronometraje')
}

// ===========================================================================
// Texto y búsqueda
// ===========================================================================

/**
 * Minúsculas y sin diacríticos: "Hernandez" tiene que encontrar a "Hernández".
 * NFD separa la letra de su acento y el rango ̀-ͯ borra los acentos.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Aplana las 21 categorías en un índice plano. Se construye UNA vez. */
export function construirIndice(resultados: Resultados): EntradaIndice[] {
  const indice: EntradaIndice[] = []
  let n = 0
  for (const categoria of resultados.categorias) {
    for (const corredor of categoria.corredores) {
      indice.push({
        n,
        dorsal: corredor.dorsal,
        dorsalTexto: String(corredor.dorsal),
        nombre: corredor.nombre,
        nombreNormalizado: normalizar(corredor.nombre),
        categoriaId: categoria.id,
        categoriaNombre: categoria.nombre,
        ruta: categoria.ruta,
        corredor,
      })
      n += 1
    }
  }
  return indice
}

/**
 * Busca por nombre parcial o por dorsal. NUNCA elige por el usuario: devuelve
 * todas las coincidencias (hasta `limite`) para que él escoja. En estos datos
 * hay nombres repetidos con dorsales distintos y dorsales repetidos.
 */
export function buscar(
  indice: readonly EntradaIndice[],
  consulta: string,
  limite = 8,
): EntradaIndice[] {
  const q = normalizar(consulta)
  if (q === '') return []

  const soloDigitos = /^\d+$/.test(q)
  const encontradas: EntradaIndice[] = []

  for (const entrada of indice) {
    const coincide = soloDigitos
      ? entrada.dorsalTexto.startsWith(q)
      : entrada.nombreNormalizado.includes(q)
    if (coincide) {
      encontradas.push(entrada)
      if (encontradas.length >= limite) break
    }
  }
  return encontradas
}

/** Cuántas coincidencias hay en total (para decir "y N más"). */
export function contarCoincidencias(indice: readonly EntradaIndice[], consulta: string): number {
  const q = normalizar(consulta)
  if (q === '') return 0
  const soloDigitos = /^\d+$/.test(q)
  let total = 0
  for (const entrada of indice) {
    if (soloDigitos ? entrada.dorsalTexto.startsWith(q) : entrada.nombreNormalizado.includes(q)) {
      total += 1
    }
  }
  return total
}

/** Todas las entradas de un dorsal. Puede devolver más de una: 25 y 127 se repiten. */
export function porDorsal(indice: readonly EntradaIndice[], dorsal: number): EntradaIndice[] {
  return indice.filter((e) => e.dorsal === dorsal)
}

// ===========================================================================
// Tiempos — las centésimas son parte del dato
// ===========================================================================

/** "HH:MM:SS.CC" -> centésimas. `null` si no hay tiempo o el formato no cuadra. */
export function aCentesimas(tiempo: string | null): number | null {
  if (tiempo === null) return null
  const m = /^(\d+):([0-5]\d):([0-5]\d)\.(\d{2})$/.exec(tiempo.trim())
  if (m === null) return null
  const [, hh, mm, ss, cc] = m
  return ((Number(hh) * 60 + Number(mm)) * 60 + Number(ss)) * 100 + Number(cc)
}

const dos = (n: number): string => String(n).padStart(2, '0')

/**
 * Formatea una diferencia con signo. Nunca redondea a segundos: en Elite Varonil
 * el 1º y el 2º se separan por 4.29 s y el podio se decide por centésimas.
 * El signo es − (U+2212), no un guion: en la mono se lee como signo.
 */
export function formatearDiferencia(centesimas: number): string {
  const signo = centesimas < 0 ? '−' : '+'
  const abs = Math.abs(centesimas)
  const cc = abs % 100
  const totalSeg = Math.floor(abs / 100)
  const ss = totalSeg % 60
  const totalMin = Math.floor(totalSeg / 60)
  const mm = totalMin % 60
  const hh = Math.floor(totalMin / 60)
  const reloj = hh > 0 ? `${hh}:${dos(mm)}:${dos(ss)}` : `${dos(mm)}:${dos(ss)}`
  return `${signo}${reloj}.${dos(cc)}`
}

/**
 * Tiempo del 1º lugar de la categoría, en centésimas.
 * `null` cuando el 1º no tiene tiempo — pasa de verdad: en Z-40 el campeón es
 * SIN_TIEMPO. En ese caso no hay diferencia calculable y no se inventa una
 * promoviendo al 2º a referencia.
 */
export function tiempoDelPrimero(categoria: CategoriaResultado): number | null {
  const primero = categoria.corredores.find((c) => c.posicion === 1)
  return primero === undefined ? null : aCentesimas(primero.tiempo)
}

/** Diferencia contra el 1º. `null` si falta cualquiera de los dos tiempos. */
export function diferenciaConPrimero(
  corredor: Corredor,
  baseCentesimas: number | null,
): string | null {
  if (baseCentesimas === null) return null
  const propio = aCentesimas(corredor.tiempo)
  if (propio === null) return null
  if (propio === baseCentesimas) return null
  return formatearDiferencia(propio - baseCentesimas)
}

// ===========================================================================
// Podios y orden
// ===========================================================================

/**
 * Los tres primeros lugares, en el orden que trae el sistema. Puede devolver
 * MÁS de tres: en EBV-40 hay dos corredores en posición 2 y no se reordenan ni
 * se descarta a ninguno. También puede traer un campeón sin tiempo (Z-40).
 */
export function podio(categoria: CategoriaResultado): Corredor[] {
  return categoria.corredores.filter((c) => c.posicion !== null && c.posicion <= 3)
}

/** Cuántos terminaron con posición asignada, para el "1º de N". */
export function clasificados(categoria: CategoriaResultado): number {
  return categoria.corredores.filter((c) => c.posicion !== null).length
}

export type CriterioOrden = 'posicion' | 'dorsal' | 'nombre'
export type SentidoOrden = 'asc' | 'desc'

/**
 * Orden estable. Los que no tienen posición (DNF) van SIEMPRE al final, aunque
 * se invierta el sentido: son el cierre de la lista, no el encabezado.
 */
export function ordenarCorredores(
  corredores: readonly Corredor[],
  criterio: CriterioOrden,
  sentido: SentidoOrden = 'asc',
): Corredor[] {
  const factor = sentido === 'asc' ? 1 : -1
  return [...corredores].sort((a, b) => {
    if (criterio === 'posicion') {
      if (a.posicion === null && b.posicion === null) return a.dorsal - b.dorsal
      if (a.posicion === null) return 1
      if (b.posicion === null) return -1
      return (a.posicion - b.posicion) * factor
    }
    if (criterio === 'dorsal') return (a.dorsal - b.dorsal) * factor
    return a.nombre.localeCompare(b.nombre, 'es-MX') * factor
  })
}

// ===========================================================================
// CSV — se arma en el cliente desde el JSON ya cargado
// ===========================================================================

const COLUMNAS = [
  'categoria_id',
  'categoria',
  'ruta_km',
  'grupo',
  'posicion',
  'dorsal',
  'nombre',
  'equipo',
  'vueltas_hechas',
  'vueltas_totales',
  'tiempo',
  'estado',
  'nota',
] as const

/** Escapa una celda para CSV: comillas dobles cuando hay coma, comilla o salto. */
export function celdaCsv(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return ''
  const texto = String(valor)
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/**
 * CSV separado por comas, con encabezado y la columna `estado`. El BOM NO se
 * pega aquí: lo agrega quien construye el Blob, para que esta función siga
 * siendo texto puro y comparable en los tests.
 */
export function aCSV(categorias: readonly CategoriaResultado[]): string {
  const filas: string[] = [COLUMNAS.join(',')]
  for (const categoria of categorias) {
    for (const c of categoria.corredores) {
      filas.push(
        [
          categoria.id,
          categoria.nombre,
          categoria.ruta,
          categoria.grupo,
          c.posicion,
          c.dorsal,
          c.nombre,
          c.equipo,
          c.vueltas_hechas,
          c.vueltas_totales,
          c.tiempo,
          c.estado,
          c.nota,
        ]
          .map(celdaCsv)
          .join(','),
      )
    }
  }
  // CRLF: es lo que Excel espera y no rompe a los demás.
  return filas.join('\r\n')
}

/**
 * BOM UTF-8 al inicio. Sin esto Excel en español abre Hernández como HernÃ¡ndez.
 * Se expone aparte para poder probar el CSV sin el BOM.
 */
export const BOM_UTF8 = '\uFEFF'

// ===========================================================================
// Presentación
// ===========================================================================

/** "5 de julio de 2026, 18:40" a partir del ISO con offset de `generado_en`. */
export function formatearGeneradoEn(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(fecha)
}

/** "1º", "2º"… El ordinal masculino es el que usa el comité en la premiación. */
export function ordinal(posicion: number): string {
  return `${posicion}º`
}

/** Rótulo corto y honesto de cada estado, para la tabla y la placa. */
export const ROTULO_ESTADO: Record<EstadoCorredor, string> = {
  OK: 'Finalizó',
  SIN_TIEMPO: 'Finalizó · tiempo no registrado',
  REVISION: 'En revisión',
  DNF: 'No terminó',
  DNS: 'No salió',
  DSQ: 'Descalificado',
}

/** ¿Se le puede entregar una tarjeta de finisher? */
export function permiteTarjeta(estado: EstadoCorredor): boolean {
  // REVISION no: repartir una tarjeta de un dato que va a cambiar es peor que
  // no darla. DNF/DNS/DSQ tampoco: no hay resultado que sellar.
  return estado === 'OK' || estado === 'SIN_TIEMPO'
}
