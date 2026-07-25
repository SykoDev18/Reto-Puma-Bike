// Contrato de los comunicados del comité. Igual que los resultados, está
// pensado para que un backend lo sirva tal cual y el front no cambie.

export type TipoAviso = 'convocatoria' | 'logistica' | 'resultados' | 'patrocinadores'

export interface Aviso {
  /** "012" — se conserva como string: el cero a la izquierda es parte del folio. */
  id: string
  /** ISO (YYYY-MM-DD). */
  fecha: string
  tipo: TipoAviso
  titulo: string
  /**
   * OBLIGATORIO y con texto real. Un flyer puede acompañar, nunca sustituir:
   * Google no lee la imagen, un lector de pantalla tampoco, y a 360px un flyer
   * cuadrado se lee mal. Un aviso sin cuerpo no se publica.
   */
  cuerpo: string
  /** Ruta pública del flyer. Opcional. */
  imagen?: string
  /** Obligatorio si hay imagen. Describe lo que se ve, no dice "aviso". */
  imagenAlt?: string
  enlace?: { texto: string; url: string }
  fijado?: boolean
  /** ISO. Pasada la fecha sale de fijados y baja al archivo. NO se borra. */
  vigenteHasta?: string
}

export interface Anuncios {
  /** ISO con o sin hora: cuándo se actualizó el tablero. */
  actualizado: string
  avisos: Aviso[]
}

export const TIPOS: readonly TipoAviso[] = [
  'convocatoria',
  'logistica',
  'resultados',
  'patrocinadores',
]

export const ROTULO_TIPO: Record<TipoAviso, string> = {
  convocatoria: 'Convocatoria',
  logistica: 'Logística',
  resultados: 'Resultados',
  patrocinadores: 'Patrocinadores',
}
