// CONTRATO con el sistema de cronometraje. Los nombres de campo NO se traducen
// ni se renombran: el backend hace mapeo directo a la tabla `participantes`.
import type { Sexo, TipoBicicleta } from './roadbook'

export type RutaElegida = 'infantil' | '40' | '80'
export type TallaJersey = 'CH' | 'M' | 'G' | 'XG' | '2XG'

/** Estado del formulario. `fecha_nacimiento` se guarda en ISO y se envía DD/MM/AAAA. */
export interface DatosFormulario {
  nombre: string
  apellido_paterno: string
  apellido_materno: string
  /** ISO YYYY-MM-DD mientras se captura. */
  fecha_nacimiento: string
  sexo: Sexo | ''
  tipo_bicicleta: TipoBicicleta
  peso_90_mas: boolean
  categoria_id: number | null
  ruta: RutaElegida | ''
  equipo: string
  kit: string
  talla_jersey: TallaJersey | ''
  email: string
  telefono: string
  contacto_emergencia_nombre: string
  contacto_emergencia_tel: string
  tipo_sangre: string
  deslinde: boolean
  privacidad: boolean
}

export type CampoFormulario = keyof DatosFormulario
export type ErroresFormulario = Partial<Record<CampoFormulario, string>>

// ---- Payload (§7). Estructura exacta, sin campos extra. -------------------
export interface PayloadParticipante {
  nombre: string
  apellido_paterno: string
  apellido_materno: string
  /** DD/MM/AAAA */
  fecha_nacimiento: string
  edad_nominal: number
  sexo: Sexo
  equipo: string
  email: string
  telefono: string
}

export interface PayloadCompetencia {
  categoria_id: number
  categoria_clave: string
  categoria_nombre: string
  ruta: RutaElegida
  tipo_bicicleta: TipoBicicleta
}

export interface PayloadKit {
  nombre: string
  precio: number
  talla_jersey: string | null
}

export interface PayloadEmergencia {
  nombre: string
  telefono: string
  tipo_sangre: string | null
}

export interface PayloadConsentimiento {
  deslinde: boolean
  privacidad: boolean
}

export interface PayloadRegistro {
  folio: string
  creado_en: string
  participante: PayloadParticipante
  competencia: PayloadCompetencia
  kit: PayloadKit
  emergencia: PayloadEmergencia
  consentimiento: PayloadConsentimiento
  origen: 'web'
}

/** Los cuatro controles del recorrido, más la meta. */
export type NumeroControl = 1 | 2 | 3 | 4 | 5

export interface Control {
  numero: NumeroControl
  km: number
  titulo: string
  /** Campos que se validan para poder salir de este control. */
  campos: CampoFormulario[]
}
