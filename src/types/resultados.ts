// Contrato del sistema de cronometraje. Es el mismo shape que va a servir el
// backend, así que estos nombres NO se cambian sin el comité: cualquier cambio
// rompe la importación de resultados.

export type EstadoCorredor = 'OK' | 'SIN_TIEMPO' | 'REVISION' | 'DNF' | 'DNS' | 'DSQ'

export interface Corredor {
  dorsal: number
  nombre: string
  /** `null` en los 781 registros de 2026: los PDF oficiales no traen equipo. */
  equipo: string | null
  /** Viene del sistema. NO se renumera: en N-40 falta la posición 32. */
  posicion: number | null
  /** "HH:MM:SS.CC" — las centésimas son parte del dato, no se truncan. */
  tiempo: string | null
  vueltas_hechas: number
  vueltas_totales: number
  estado: EstadoCorredor
  /** Motivo visible cuando el estado es 'REVISION' o 'SIN_TIEMPO'. */
  nota?: string
}

export interface CategoriaResultado {
  /** CLAVE ÚNICA = clave + ruta ("N-80"). Una misma clave corre dos rutas. */
  id: string
  clave: string
  /** true si la categoría no está en el catálogo del front. Se renderiza igual. */
  clave_provisional: boolean
  nombre: string
  /** "40" | "80" — se conserva como string tal cual llega del sistema. */
  ruta: string
  grupo: string
  corredores: Corredor[]
}

export interface Resultados {
  evento: string
  edicion: string
  anio: number
  /** ISO con offset. Los resultados se corrigen: la hora de corte importa. */
  generado_en: string
  version: number
  parcial: boolean
  nota_parcial?: string
  categorias: CategoriaResultado[]
}

/**
 * Una fila del índice de búsqueda: aplanado de las 21 categorías, construido
 * UNA sola vez. `n` es su posición global y sirve para desambiguar los dorsales
 * repetidos (25 y 127 aparecen dos veces cada uno en estos datos).
 */
export interface EntradaIndice {
  n: number
  dorsal: number
  dorsalTexto: string
  nombre: string
  /** Nombre sin acentos y en minúsculas: "Hernandez" encuentra "Hernández". */
  nombreNormalizado: string
  categoriaId: string
  categoriaNombre: string
  ruta: string
  corredor: Corredor
}
