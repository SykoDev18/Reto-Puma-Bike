import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DATOS_INICIALES,
  capitalizar,
  crearPayload,
  erroresDeControl,
  fechaHoraIsoLocal,
  fechaParaPayload,
  folioNuevo,
  isoAPartes,
  mascaraTelefono,
  mensajeWhatsApp,
  partesAIso,
  rutaEsFija,
  rutaPermitida,
  soloDigitos,
  validarRegistro,
  CONTROLES,
} from './registro.ts'
import { CATEGORIAS } from '../data/categorias.ts'
import { CONFIG } from '../data/config.ts'
import type { DatosFormulario } from '../types/registro'

const kitPuma = CONFIG.kits.find((k) => k.nombre === 'Kit Puma')!
const kitHuellita = CONFIG.kits.find((k) => k.nombre === 'Kit Huellita')!
const conJersey = (nombre: string) =>
  CONFIG.kits.some((k) => k.nombre === nombre && k.incluye.some((i) => /jersey/i.test(i)))
const ctx = { anioEvento: CONFIG.anioEvento, kits: CONFIG.kits, kitConJersey: conJersey }

const completo: DatosFormulario = {
  ...DATOS_INICIALES,
  nombre: 'juan carlos',
  apellido_paterno: 'hernández',
  apellido_materno: 'vargas',
  fecha_nacimiento: '1992-08-14',
  sexo: 'M',
  tipo_bicicleta: 'MTB',
  categoria_id: 26,
  ruta: '80',
  equipo: 'Club Ciclista Ninis',
  kit: 'Kit Puma',
  talla_jersey: 'G',
  email: 'juan@correo.com',
  telefono: '77 2123 4567',
  contacto_emergencia_nombre: 'maría vargas',
  contacto_emergencia_tel: '7729876543',
  tipo_sangre: 'O+',
  deslinde: true,
  privacidad: true,
}

test('formato de fecha: ISO -> DD/MM/AAAA y de vuelta', () => {
  assert.equal(fechaParaPayload('1992-08-14'), '14/08/1992')
  assert.equal(fechaParaPayload('no-es-fecha'), '')
  assert.deepEqual(isoAPartes('1992-08-14'), { dia: '14', mes: '08', anio: '1992' })
  assert.equal(partesAIso('14', '8', '1992'), '1992-08-14')
})

test('partesAIso rechaza fechas que no existen', () => {
  assert.equal(partesAIso('31', '2', '1992'), '')
  assert.equal(partesAIso('30', '13', '1992'), '')
  assert.equal(partesAIso('1', '1', '92'), '')
  assert.equal(partesAIso('', '1', '1992'), '')
})

test('teléfono: solo dígitos y máscara legible', () => {
  assert.equal(soloDigitos('77 2123 4567'), '7721234567')
  assert.equal(soloDigitos('772-123-4567-999'), '7721234567')
  assert.equal(mascaraTelefono('7721234567'), '77 2123 4567')
  assert.equal(mascaraTelefono('77'), '77')
  assert.equal(mascaraTelefono('7721'), '77 21')
})

test('capitalizar respeta acentos y apóstrofos', () => {
  assert.equal(capitalizar('juan carlos'), 'Juan Carlos')
  assert.equal(capitalizar('  MARÍA  '), 'María')
  assert.equal(capitalizar("mamut's"), "Mamut'S")
})

test('rutaPermitida sale de MAPA_RUTAS y respeta la elección válida', () => {
  assert.equal(rutaPermitida('Infantiles', '80'), 'infantil')
  assert.equal(rutaPermitida('Grupo Menor', '80'), '40')
  assert.equal(rutaPermitida('Grupo Mayor', '40'), '40')
  assert.equal(rutaPermitida('Grupo Mayor', ''), '80')
  assert.equal(rutaEsFija('Infantiles'), true)
  assert.equal(rutaEsFija('Grupo Mayor'), false)
})

test('folio con el formato del cronometraje', () => {
  assert.equal(folioNuevo(2026, 123), 'RPB2026-000123')
})

test('un formulario completo no tiene errores', () => {
  assert.deepEqual(validarRegistro(completo, ctx), {})
})

test('validación: mensajes específicos por campo', () => {
  const e = validarRegistro(DATOS_INICIALES, ctx)
  assert.ok(e.nombre && e.apellido_paterno && e.fecha_nacimiento && e.sexo)
  assert.ok(e.categoria_id && e.ruta && e.kit && e.email && e.telefono)
  assert.ok(e.contacto_emergencia_nombre && e.contacto_emergencia_tel && e.deslinde)
  assert.equal(e.apellido_materno, undefined, 'el materno es opcional')
  assert.equal(e.equipo, undefined, 'el equipo es opcional')
  assert.equal(e.tipo_sangre, undefined, 'el tipo de sangre es opcional')
})

test('validación: nombres con números se rechazan', () => {
  const e = validarRegistro({ ...completo, nombre: 'Juan 3' }, ctx)
  assert.ok(e.nombre)
})

test('validación: la talla solo es obligatoria si el kit trae jersey', () => {
  const sinTalla = { ...completo, kit: kitPuma.nombre, talla_jersey: '' as const }
  assert.ok(validarRegistro(sinTalla, ctx).talla_jersey, 'Kit Puma exige talla')
  const huellita = { ...completo, kit: kitHuellita.nombre, talla_jersey: '' as const }
  assert.equal(validarRegistro(huellita, ctx).talla_jersey, undefined, 'Kit Huellita no la exige')
})

test('validación: edad fuera de 3 a 99 se rechaza', () => {
  assert.ok(validarRegistro({ ...completo, fecha_nacimiento: '2025-01-01' }, ctx).fecha_nacimiento)
  assert.ok(validarRegistro({ ...completo, fecha_nacimiento: '1900-01-01' }, ctx).fecha_nacimiento)
})

test('erroresDeControl solo devuelve los del control pedido', () => {
  const todos = validarRegistro(DATOS_INICIALES, ctx)
  const control1 = erroresDeControl(todos, CONTROLES[0].campos)
  assert.ok(control1.nombre)
  assert.equal(control1.email, undefined, 'el correo es del control 4')
})

test('el payload tiene la estructura EXACTA del contrato', () => {
  const categoria = CATEGORIAS.find((c) => c.id === 26)!
  const payload = crearPayload({
    folio: 'RPB2026-000123',
    creadoEn: '2026-03-15T10:22:31-06:00',
    datos: completo,
    categoria,
    kit: kitPuma,
    anioEvento: CONFIG.anioEvento,
    kitConJersey: true,
  })

  assert.deepEqual(Object.keys(payload), [
    'folio',
    'creado_en',
    'participante',
    'competencia',
    'kit',
    'emergencia',
    'consentimiento',
    'origen',
  ])
  assert.deepEqual(payload.participante, {
    nombre: 'Juan Carlos',
    apellido_paterno: 'Hernández',
    apellido_materno: 'Vargas',
    fecha_nacimiento: '14/08/1992',
    edad_nominal: 34,
    sexo: 'M',
    equipo: 'Club Ciclista Ninis',
    email: 'juan@correo.com',
    telefono: '7721234567',
  })
  assert.deepEqual(payload.competencia, {
    categoria_id: 26,
    categoria_clave: 'N',
    categoria_nombre: 'Máster 30 Varonil',
    ruta: '80',
    tipo_bicicleta: 'MTB',
  })
  assert.deepEqual(payload.kit, { nombre: 'Kit Puma', precio: 750, talla_jersey: 'G' })
  assert.deepEqual(payload.emergencia, {
    nombre: 'María Vargas',
    telefono: '7729876543',
    tipo_sangre: 'O+',
  })
  assert.deepEqual(payload.consentimiento, { deslinde: true, privacidad: true })
  assert.equal(payload.origen, 'web')
})

test('el payload sin jersey manda talla en null y equipo por defecto', () => {
  const categoria = CATEGORIAS.find((c) => c.id === 26)!
  const payload = crearPayload({
    folio: 'RPB2026-000001',
    creadoEn: '2026-03-15T10:22:31-06:00',
    datos: { ...completo, equipo: '   ', tipo_sangre: '' },
    categoria,
    kit: kitHuellita,
    anioEvento: CONFIG.anioEvento,
    kitConJersey: false,
  })
  assert.equal(payload.kit.talla_jersey, null)
  assert.equal(payload.participante.equipo, 'Independiente')
  assert.equal(payload.emergencia.tipo_sangre, null)
})

test('mensaje de WhatsApp arrastra lo ya capturado', () => {
  const parcial: DatosFormulario = {
    ...DATOS_INICIALES,
    nombre: 'Ana',
    apellido_paterno: 'Ruiz',
    sexo: 'F',
    fecha_nacimiento: '2009-03-01',
  }
  const texto = mensajeWhatsApp(parcial, CONFIG.anioEvento, CONFIG.evento)
  assert.ok(texto.includes('Ana Ruiz'))
  assert.ok(texto.includes('01/03/2009'))
  assert.ok(texto.includes('Femenino'))
  assert.ok(texto.includes('Ruta: ___'), 'lo que falta queda en blanco, no inventado')
})

test('los controles cubren los campos obligatorios del formulario', () => {
  const cubiertos = new Set(CONTROLES.flatMap((c) => c.campos))
  const errores = validarRegistro(DATOS_INICIALES, ctx)
  for (const campo of Object.keys(errores)) {
    assert.ok(cubiertos.has(campo as keyof DatosFormulario), `${campo} no vive en ningún control`)
  }
})

test('fechaHoraIsoLocal usa desplazamiento local, no UTC con Z', () => {
  const texto = fechaHoraIsoLocal(new Date(2026, 2, 15, 10, 22, 31))
  assert.match(texto, /^2026-03-15T10:22:31[+-]\d{2}:\d{2}$/)
  assert.equal(texto.includes('Z'), false)
})
