// Eje de edad: funciones PURAS que derivan la retícula desde los datos.
// La página no dibuja el eje a mano; si la lista de categorías crece, el eje se
// recalcula solo. Sin DOM, testeable.
import type { Categoria, Rama } from '../types/roadbook'

/** Tope de edad usado solo para la ESCALA de los rangos abiertos ("60 y más"). */
export const EDAD_TOPE = 70 // SUPUESTO: no hay tope oficial; 70 da una escala legible.

export interface FilaEje {
  desde: number
  /** null = sin límite superior ("60 y más"). */
  hasta: number | null
  etiqueta: string
  anios: number
}

export interface BarraEje {
  categoria: Categoria
  filaInicio: number
  filaFin: number
  /** Años que cubre la categoría; define la longitud proporcional de la barra. */
  anios: number
}

export interface HuecoEje {
  rama: Rama
  filaInicio: number
  filaFin: number
  etiqueta: string
}

export interface Eje {
  filas: FilaEje[]
  barras: BarraEje[]
  huecos: HuecoEje[]
  maxAnios: number
  /**
   * Máximo de años entre los rangos ACOTADOS. Es el denominador de la escala:
   * usar el máximo absoluto aplastaría todas las barras, porque los rangos
   * abiertos ("40 y más") llegan hasta el tope artificial.
   */
  maxAniosAcotado: number
  edadTope: number
}

const inicioDe = (c: Categoria): number => c.edadMin ?? 0
const finDe = (c: Categoria, tope: number): number => c.edadMax ?? tope

function etiquetaIntervalo(desde: number, hasta: number, abierto: boolean): string {
  if (abierto) return `${desde}+`
  if (desde === 0) return `≤${hasta}`
  if (desde === hasta) return `${desde}`
  return `${desde}-${hasta}`
}

/**
 * Construye el eje a partir de las categorías POR EDAD (las abiertas no tienen
 * posición en el eje: viven en su propia banda, y esa ausencia es el dato).
 */
export function construirEje(categorias: Categoria[], edadTope: number = EDAD_TOPE): Eje {
  const porEdad = categorias.filter((c) => !c.abierta)
  if (porEdad.length === 0) {
    return { filas: [], barras: [], huecos: [], maxAnios: 1, maxAniosAcotado: 1, edadTope }
  }

  // Cortes: cada inicio de rango y cada "fin + 1" abre una fila nueva.
  const cortes = new Set<number>()
  for (const c of porEdad) {
    cortes.add(inicioDe(c))
    cortes.add(finDe(c, edadTope) + 1)
  }
  const ordenados = [...cortes].sort((a, b) => a - b)

  const filas: FilaEje[] = []
  for (let i = 0; i < ordenados.length - 1; i++) {
    const desde = ordenados[i]
    const hasta = ordenados[i + 1] - 1
    // Solo interesan los tramos que alguna categoría cubre de verdad.
    const cubierto = porEdad.some((c) => inicioDe(c) <= desde && finDe(c, edadTope) >= hasta)
    if (!cubierto) continue
    const abierto = hasta >= edadTope
    filas.push({
      desde,
      hasta: abierto ? null : hasta,
      etiqueta: etiquetaIntervalo(desde, hasta, abierto),
      anios: hasta - desde + 1,
    })
  }

  const limiteFila = (f: FilaEje): number => f.hasta ?? edadTope

  const barras: BarraEje[] = []
  for (const categoria of porEdad) {
    const ini = inicioDe(categoria)
    const fin = finDe(categoria, edadTope)
    const indices = filas
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => ini <= f.desde && fin >= limiteFila(f))
      .map(({ i }) => i)
    if (indices.length === 0) continue
    barras.push({
      categoria,
      filaInicio: indices[0],
      filaFin: indices[indices.length - 1],
      anios: fin - ini + 1,
    })
  }

  const maxAnios = barras.reduce((max, b) => Math.max(max, b.anios), 1)
  const maxAniosAcotado = barras.reduce(
    (max, b) => (b.categoria.edadMax === null ? max : Math.max(max, b.anios)),
    1,
  )

  // Huecos: tramos donde una rama NO tiene categoría por edad. No se tapan.
  const huecos: HuecoEje[] = []
  const ramas: Rama[] = ['V', 'F']
  for (const rama of ramas) {
    const deLaRama = barras.filter((b) => b.categoria.rama === rama)
    const cubierta = filas.map((_, i) =>
      deLaRama.some((b) => b.filaInicio <= i && b.filaFin >= i),
    )
    let inicio = -1
    for (let i = 0; i <= filas.length; i++) {
      const libre = i < filas.length && !cubierta[i]
      if (libre && inicio < 0) inicio = i
      if (!libre && inicio >= 0) {
        const fin = i - 1
        const desde = filas[inicio].desde
        const hasta = filas[fin].hasta
        huecos.push({
          rama,
          filaInicio: inicio,
          filaFin: fin,
          etiqueta: etiquetaIntervalo(desde, hasta ?? edadTope, hasta === null),
        })
        inicio = -1
      }
    }
  }

  return { filas, barras, huecos, maxAnios, maxAniosAcotado, edadTope }
}

/** Índice de fila donde cae una edad nominal (o -1 si queda fuera del eje). */
export function filaDeEdad(eje: Eje, edad: number): number {
  return eje.filas.findIndex((f) => edad >= f.desde && edad <= (f.hasta ?? eje.edadTope))
}

/**
 * Longitud proporcional de la barra, en % del carril.
 * Los rangos abiertos ("60 y más") ocupan el carril completo: no tienen tope
 * real, y fingir uno mentiría sobre el dato. El resto se escala contra el rango
 * acotado más largo, con un mínimo para que la placa y el nombre quepan.
 */
export function longitudBarra(barra: BarraEje, eje: Eje, minimo = 26): number {
  if (barra.categoria.edadMax === null) return 100
  const denominador = eje.maxAniosAcotado || eje.maxAnios
  const proporcion = (barra.anios / denominador) * 100
  return Math.max(minimo, Math.min(100, Math.round(proporcion)))
}
