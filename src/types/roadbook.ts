// Contratos de datos del roadbook y de categorías. Sin `any`, sin `as`.

export interface PuntoPerfil {
  km: number
  altitud: number
}

export type TipoHito = 'salida' | 'poblado' | 'abasto' | 'cima' | 'meta'

export interface Hito {
  km: number
  nombre: string
  tipo: TipoHito
  /** Kilómetro estimado, pendiente de confirmación del comité. */
  supuesto?: boolean
}

export type IdRuta = 'corta' | 'larga'

export interface Ruta {
  id: IdRuta
  etiqueta: string
  km: number
  desnivel: number
  /** Desnivel del perfil resampleado (referencia, no oficial). */
  desnivelDerivado?: number
  komootId: string
  fuente: string
  perfil: PuntoPerfil[]
  hitos: Hito[]
}

// ---- Categorías (motor reutilizable por el backend) ----------------------
export type Rama = 'V' | 'F'
export type Sexo = 'M' | 'F'
export type Grupo = 'Infantiles' | 'Grupo Menor' | 'Grupo Mayor'
export type TipoBicicleta = 'MTB' | 'E-Bike'

export interface Categoria {
  id: number
  nombre: string
  clave: string
  grupo: Grupo
  rama: Rama
  edadMin: number | null
  edadMax: number | null
  descripcionEdad: string
  vueltas: number
  abierta: boolean
  rodadas?: string
  requierePeso?: number
  requiereEbike?: boolean
}

export interface EntradaElegibilidad {
  edadNominal: number | null
  sexo: Sexo | ''
  tipoBicicleta?: TipoBicicleta
  peso90mas?: boolean
}

export interface ResultadoElegibilidad {
  recomendada: Categoria | null
  alternativas: Categoria[]
  sinCoincidencia: boolean
  infantiles: boolean
  soloEbike?: boolean
}
