// Lógica PURA del registro: validación, formato y armado del payload.
// Sin DOM y sin React: el backend puede reutilizar estas funciones tal cual.
import type { Categoria, Grupo } from '../types/roadbook'
import type {
  CampoFormulario,
  Control,
  DatosFormulario,
  ErroresFormulario,
  PayloadRegistro,
  RutaElegida,
} from '../types/registro'
import type { Kit } from '../data/config'
import { MAPA_RUTAS } from '../data/categorias.ts'
import { edadNominal } from './categorias.ts'

/** Los cuatro controles del recorrido, anclados a kilómetros reales. */
export const CONTROLES: Control[] = [
  {
    numero: 1,
    km: 0,
    titulo: 'Quién eres',
    campos: ['nombre', 'apellido_paterno', 'apellido_materno', 'fecha_nacimiento', 'sexo'],
  },
  {
    numero: 2,
    km: 12,
    titulo: 'Cómo compites',
    campos: ['tipo_bicicleta', 'categoria_id', 'ruta'],
  },
  { numero: 3, km: 34, titulo: 'Tu kit', campos: ['kit', 'talla_jersey'] },
  {
    numero: 4,
    km: 58,
    titulo: 'Seguridad',
    campos: [
      'email',
      'telefono',
      'contacto_emergencia_nombre',
      'contacto_emergencia_tel',
      'deslinde',
    ],
  },
  { numero: 5, km: 74.48, titulo: 'Confirmación', campos: [] },
]

export const DATOS_INICIALES: DatosFormulario = {
  nombre: '',
  apellido_paterno: '',
  apellido_materno: '',
  fecha_nacimiento: '',
  sexo: '',
  tipo_bicicleta: 'MTB',
  peso_90_mas: false,
  categoria_id: null,
  ruta: '',
  equipo: '',
  kit: '',
  talla_jersey: '',
  email: '',
  telefono: '',
  contacto_emergencia_nombre: '',
  contacto_emergencia_tel: '',
  tipo_sangre: '',
  deslinde: false,
  privacidad: false,
}

const LETRAS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\s-]+$/
const CORREO = /^\S+@\S+\.\S+$/

/** Solo dígitos, máximo 10. */
export function soloDigitos(valor: string, max = 10): string {
  return valor.replace(/\D/g, '').slice(0, max)
}

/** Máscara visual de teléfono: 7721234567 -> "77 2123 4567". */
export function mascaraTelefono(valor: string): string {
  const d = soloDigitos(valor)
  if (d.length <= 2) return d
  if (d.length <= 6) return `${d.slice(0, 2)} ${d.slice(2)}`
  return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`
}

/** Capitaliza respetando es-MX (acentos y apóstrofos). */
export function capitalizar(valor = ''): string {
  return valor
    .trim()
    .toLocaleLowerCase('es-MX')
    .replace(/(^|\s|')([\p{L}])/gu, (_, inicio: string, letra: string) =>
      `${inicio}${letra.toLocaleUpperCase('es-MX')}`,
    )
}

/** ISO YYYY-MM-DD -> DD/MM/AAAA (formato del payload). */
export function fechaParaPayload(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** Día/mes/año por separado -> ISO. Devuelve '' si está incompleto o inválido. */
export function partesAIso(dia: string, mes: string, anio: string): string {
  if (dia === '' || mes === '' || anio === '') return ''
  const d = Number(dia)
  const M = Number(mes)
  const a = Number(anio)
  if (!Number.isInteger(d) || !Number.isInteger(M) || !Number.isInteger(a)) return ''
  if (M < 1 || M > 12 || d < 1 || d > 31 || anio.length !== 4) return ''
  // Rechaza fechas que no existen (31 de febrero, por ejemplo).
  const fecha = new Date(Date.UTC(a, M - 1, d))
  if (fecha.getUTCMonth() !== M - 1 || fecha.getUTCDate() !== d) return ''
  return `${String(a).padStart(4, '0')}-${String(M).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** ISO -> {dia, mes, anio} para los tres campos de captura. */
export function isoAPartes(iso: string): { dia: string; mes: string; anio: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? { dia: m[3], mes: m[2], anio: m[1] } : { dia: '', mes: '', anio: '' }
}

/**
 * Ruta permitida para un grupo. REGLA DE NEGOCIO A CONFIRMAR CON EL COMITÉ:
 * sale de MAPA_RUTAS, no está escrita en el JSX.
 */
export function rutaPermitida(grupo: Grupo, rutaActual: string): RutaElegida | '' {
  const opciones = MAPA_RUTAS[grupo] ?? []
  if (opciones.length === 0) return ''
  const encontrada = opciones.find((o) => o === rutaActual)
  return encontrada ?? opciones[0]
}

/** ¿El grupo permite elegir entre varias rutas? Infantiles no. */
export function rutaEsFija(grupo: Grupo): boolean {
  return (MAPA_RUTAS[grupo] ?? []).length <= 1
}

const dos = (n: number): string => String(n).padStart(2, '0')

/**
 * Marca de tiempo ISO con DESPLAZAMIENTO local ("2026-03-15T10:22:31-06:00"),
 * que es la forma del contrato. `toISOString()` devolvería UTC con Z.
 */
export function fechaHoraIsoLocal(d: Date): string {
  const offsetMin = -d.getTimezoneOffset()
  const signo = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const fecha = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
  const hora = `${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`
  return `${fecha}T${hora}${signo}${dos(Math.floor(abs / 60))}:${dos(abs % 60)}`
}

export function folioNuevo(anioEvento: number, consecutivo: number): string {
  return `RPB${anioEvento}-${String(consecutivo).padStart(6, '0')}`
}

export interface ContextoValidacion {
  anioEvento: number
  kits: Kit[]
  /** Kits cuyo contenido incluye jersey; determina si la talla es obligatoria. */
  kitConJersey: (nombre: string) => boolean
}

/**
 * Valida TODO el formulario y devuelve un mensaje por campo con problema.
 * Un objeto vacío significa que se puede enviar.
 */
export function validarRegistro(
  datos: DatosFormulario,
  ctx: ContextoValidacion,
): ErroresFormulario {
  const errores: ErroresFormulario = {}
  const edad = edadNominal(datos.fecha_nacimiento, ctx.anioEvento)

  if (datos.nombre.trim() === '' || !LETRAS.test(datos.nombre.trim())) {
    errores.nombre = 'Escribe tu nombre sin números.'
  }
  if (datos.apellido_paterno.trim() === '' || !LETRAS.test(datos.apellido_paterno.trim())) {
    errores.apellido_paterno = 'Escribe tu apellido paterno sin números.'
  }
  if (datos.apellido_materno.trim() !== '' && !LETRAS.test(datos.apellido_materno.trim())) {
    errores.apellido_materno = 'El apellido materno no lleva números.'
  }
  if (edad === null || edad < 3 || edad > 99) {
    errores.fecha_nacimiento = 'Escribe una fecha válida; la edad debe estar entre 3 y 99 años.'
  }
  if (datos.sexo !== 'M' && datos.sexo !== 'F') {
    errores.sexo = 'Elige una rama para continuar.'
  }
  if (datos.tipo_bicicleta !== 'MTB' && datos.tipo_bicicleta !== 'E-Bike') {
    errores.tipo_bicicleta = 'Elige el tipo de bicicleta.'
  }
  if (datos.categoria_id === null) {
    errores.categoria_id = 'Elige una categoría para competir.'
  }
  if (datos.ruta !== 'infantil' && datos.ruta !== '40' && datos.ruta !== '80') {
    errores.ruta = 'Elige una ruta.'
  }
  if (datos.kit === '' || !ctx.kits.some((k) => k.nombre === datos.kit)) {
    errores.kit = 'Elige el kit que quieres apartar.'
  } else if (ctx.kitConJersey(datos.kit) && datos.talla_jersey === '') {
    errores.talla_jersey = 'Elige la talla de tu jersey.'
  }
  if (!CORREO.test(datos.email.trim())) {
    errores.email = 'Escribe un correo electrónico válido.'
  }
  if (soloDigitos(datos.telefono).length !== 10) {
    errores.telefono = 'Escribe los 10 dígitos de tu teléfono.'
  }
  if (datos.contacto_emergencia_nombre.trim() === '') {
    errores.contacto_emergencia_nombre = 'Escribe el nombre de tu contacto de emergencia.'
  }
  if (soloDigitos(datos.contacto_emergencia_tel).length !== 10) {
    errores.contacto_emergencia_tel = 'Escribe los 10 dígitos del contacto de emergencia.'
  }
  if (!datos.deslinde || !datos.privacidad) {
    errores.deslinde = 'Necesitamos tu consentimiento para registrar tu participación.'
  }

  return errores
}

/** Errores que corresponden a un control concreto (para bloquear el avance). */
export function erroresDeControl(
  errores: ErroresFormulario,
  campos: CampoFormulario[],
): ErroresFormulario {
  const salida: ErroresFormulario = {}
  for (const campo of campos) {
    const mensaje = errores[campo]
    if (mensaje !== undefined) salida[campo] = mensaje
  }
  return salida
}

export interface EntradaPayload {
  folio: string
  creadoEn: string
  datos: DatosFormulario
  categoria: Categoria
  kit: Kit
  anioEvento: number
  kitConJersey: boolean
}

/** Arma el payload del §7. Lanza si falta categoría o kit (no debería pasar). */
export function crearPayload(entrada: EntradaPayload): PayloadRegistro {
  const { datos, categoria, kit, folio, creadoEn, anioEvento, kitConJersey } = entrada
  const edad = edadNominal(datos.fecha_nacimiento, anioEvento)
  if (edad === null) throw new Error('No fue posible construir el registro: fecha inválida.')
  if (datos.sexo === '') throw new Error('No fue posible construir el registro: falta la rama.')
  if (datos.ruta === '') throw new Error('No fue posible construir el registro: falta la ruta.')

  return {
    folio,
    creado_en: creadoEn,
    participante: {
      nombre: capitalizar(datos.nombre),
      apellido_paterno: capitalizar(datos.apellido_paterno),
      apellido_materno: capitalizar(datos.apellido_materno),
      fecha_nacimiento: fechaParaPayload(datos.fecha_nacimiento),
      edad_nominal: edad,
      sexo: datos.sexo,
      equipo: datos.equipo.trim() === '' ? 'Independiente' : datos.equipo.trim(),
      email: datos.email.trim(),
      telefono: soloDigitos(datos.telefono),
    },
    competencia: {
      categoria_id: categoria.id,
      categoria_clave: categoria.clave,
      categoria_nombre: categoria.nombre,
      ruta: datos.ruta,
      tipo_bicicleta: datos.tipo_bicicleta,
    },
    kit: {
      nombre: kit.nombre,
      precio: kit.precio,
      talla_jersey: kitConJersey && datos.talla_jersey !== '' ? datos.talla_jersey : null,
    },
    emergencia: {
      nombre: capitalizar(datos.contacto_emergencia_nombre),
      telefono: soloDigitos(datos.contacto_emergencia_tel),
      tipo_sangre: datos.tipo_sangre.trim() === '' ? null : datos.tipo_sangre.trim(),
    },
    consentimiento: {
      deslinde: datos.deslinde,
      privacidad: datos.privacidad,
    },
    origen: 'web',
  }
}

/** Mensaje de WhatsApp con lo que el usuario ya capturó (no reinicia nada). */
export function mensajeWhatsApp(datos: DatosFormulario, anioEvento: number, evento: string): string {
  const oVacio = (v: string) => (v.trim() === '' ? '___' : v.trim())
  const nombre = `${datos.nombre} ${datos.apellido_paterno} ${datos.apellido_materno}`.trim()
  const rama = datos.sexo === 'M' ? 'Masculino' : datos.sexo === 'F' ? 'Femenino' : '___'
  const ruta =
    datos.ruta === 'infantil' ? 'Circuito infantil' : datos.ruta === '' ? '___' : `${datos.ruta} KM`
  return [
    `Hola, quiero inscribirme al ${evento} ${anioEvento}.`,
    `Nombre: ${oVacio(nombre)} / Fecha de nacimiento: ${oVacio(fechaParaPayload(datos.fecha_nacimiento))} / Sexo: ${rama} / Ruta: ${ruta} / Kit: ${oVacio(datos.kit)}`,
  ].join('\n')
}

/** Resumen para compartir el registro ya hecho. */
export function mensajeResumen(payload: PayloadRegistro, evento: string): string {
  const p = payload.participante
  return [
    `Registro ${payload.folio} — ${evento}.`,
    `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno}`.trim(),
    `Categoría ${payload.competencia.categoria_clave} · ${payload.competencia.categoria_nombre}`,
    `Ruta ${payload.competencia.ruta === 'infantil' ? 'circuito infantil' : `${payload.competencia.ruta} km`} · ${payload.kit.nombre}`,
  ].join('\n')
}
