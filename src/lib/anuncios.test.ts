import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  agruparPorMes,
  armarTablero,
  contarPorTipo,
  estaVigente,
  etiquetaMes,
  fechaCorta,
  fechaLarga,
  masRecientes,
  porFechaDesc,
  validarAnuncios,
} from './anuncios.ts'
import type { Aviso } from '../types/anuncios'

const crudo: unknown = JSON.parse(readFileSync('public/data/anuncios.json', 'utf8'))
const DATOS = validarAnuncios(crudo)

// Hoy, en el mundo del sitio: la 4ª edición se corrió el 05.07.2026.
const HOY = '2026-07-25'

const porId = (id: string): Aviso => {
  const a = DATOS.avisos.find((x) => x.id === id)
  assert.ok(a, `falta el aviso ${id}`)
  return a
}

// ---------------------------------------------------------------------------
// La regla de la página: sin texto real no se publica
// ---------------------------------------------------------------------------

test('TODOS los avisos traen cuerpo con texto real, ninguno es solo imagen', () => {
  assert.equal(DATOS.avisos.length, 8)
  for (const a of DATOS.avisos) {
    assert.ok(a.cuerpo.trim().length > 40, `el aviso ${a.id} no tiene cuerpo suficiente`)
  }
})

test('toda imagen trae alt descriptivo y ninguno dice solo "aviso"', () => {
  const conImagen = DATOS.avisos.filter((a) => a.imagen !== undefined)
  assert.equal(conImagen.length, 1)
  for (const a of conImagen) {
    assert.ok(a.imagenAlt !== undefined && a.imagenAlt.length > 30)
    assert.equal(/^aviso\.?$/i.test(a.imagenAlt ?? ''), false)
  }
})

test('la validación RECHAZA un aviso sin cuerpo', () => {
  assert.throws(() =>
    validarAnuncios({
      actualizado: '2026-07-18',
      avisos: [{ id: '001', fecha: '2026-07-18', tipo: 'logistica', titulo: 'X', cuerpo: '   ' }],
    }),
  )
})

test('la validación RECHAZA una imagen sin alt', () => {
  assert.throws(() =>
    validarAnuncios({
      actualizado: '2026-07-18',
      avisos: [
        {
          id: '001',
          fecha: '2026-07-18',
          tipo: 'logistica',
          titulo: 'X',
          cuerpo: 'Un cuerpo de texto suficientemente largo para pasar.',
          imagen: '/img/x.webp',
        },
      ],
    }),
  )
})

test('la validación RECHAZA un tipo inventado y un objeto vacío', () => {
  assert.throws(() =>
    validarAnuncios({
      actualizado: '2026-07-18',
      avisos: [
        { id: '001', fecha: '2026-07-18', tipo: 'chisme', titulo: 'X', cuerpo: 'Texto largo.' },
      ],
    }),
  )
  assert.throws(() => validarAnuncios({}))
  assert.throws(() => validarAnuncios(null))
})

// ---------------------------------------------------------------------------
// Vigencia: lo caduco baja solo, pero no se borra
// ---------------------------------------------------------------------------

test('sin vigenteHasta un aviso no caduca nunca', () => {
  assert.equal(estaVigente(porId('012'), HOY), true)
  assert.equal(estaVigente(porId('012'), '2030-01-01'), true)
})

test('el último día de vigencia cuenta como vigente', () => {
  const kits = porId('010') // vigenteHasta 2026-07-04
  assert.equal(estaVigente(kits, '2026-07-03'), true)
  assert.equal(estaVigente(kits, '2026-07-04'), true)
  assert.equal(estaVigente(kits, '2026-07-05'), false)
})

test('un FIJADO vencido sale de fijados y baja al archivo, sin desaparecer', () => {
  const kits = porId('010')
  assert.equal(kits.fijado, true)

  // Antes de vencer: arriba.
  const antes = armarTablero(DATOS.avisos, '2026-07-03')
  assert.ok(antes.fijados.some((a) => a.id === '010'))

  // Después: ya no está fijado, pero SIGUE publicado en el archivo.
  const despues = armarTablero(DATOS.avisos, HOY)
  assert.equal(despues.fijados.some((a) => a.id === '010'), false)
  assert.equal(despues.archivo.some((a) => a.id === '010'), true)

  // Y no se perdió nada por el camino.
  assert.equal(despues.fijados.length + despues.archivo.length, DATOS.avisos.length)
})

test('hoy quedan dos fijados vigentes, el más reciente primero', () => {
  const { fijados } = armarTablero(DATOS.avisos, HOY)
  assert.deepEqual(fijados.map((a) => a.id), ['014', '013'])
})

// ---------------------------------------------------------------------------
// Orden y agrupación
// ---------------------------------------------------------------------------

test('el orden es del más reciente al más viejo', () => {
  const ordenados = [...DATOS.avisos].sort(porFechaDesc)
  assert.deepEqual(
    ordenados.map((a) => a.id),
    ['014', '013', '012', '011', '010', '009', '008', '007'],
  )
})

test('a igual fecha desempata el folio mayor', () => {
  const base: Aviso = {
    id: '001', fecha: '2026-07-01', tipo: 'logistica', titulo: 'A', cuerpo: 'x',
  }
  const otro: Aviso = { ...base, id: '002', titulo: 'B' }
  assert.deepEqual([base, otro].sort(porFechaDesc).map((a) => a.id), ['002', '001'])
})

test('se agrupa por mes conservando el orden', () => {
  const grupos = agruparPorMes([...DATOS.avisos].sort(porFechaDesc))
  assert.deepEqual(grupos.map((g) => g.clave), ['2026-07', '2026-06'])
  assert.equal(grupos[0].etiqueta, 'Julio 2026')
  assert.deepEqual(grupos[0].avisos.map((a) => a.id), ['014', '013', '012', '011', '010'])
  assert.deepEqual(grupos[1].avisos.map((a) => a.id), ['009', '008', '007'])
})

test('los 3 más recientes del Inicio excluyen lo vencido', () => {
  const tres = masRecientes(DATOS.avisos, HOY)
  assert.deepEqual(tres.map((a) => a.id), ['014', '013', '012'])
  // El 010 es más reciente que el 008, pero ya venció: no se asoma al Inicio.
  assert.equal(tres.some((a) => a.id === '010'), false)
})

// ---------------------------------------------------------------------------
// Formato de fecha: sin `new Date`, para que no se corra un día por zona
// ---------------------------------------------------------------------------

test('las fechas se formatean sin corrimiento de zona horaria', () => {
  assert.equal(fechaCorta('2026-07-18'), '18 JUL 2026')
  assert.equal(fechaCorta('2026-01-01'), '01 ENE 2026')
  assert.equal(fechaLarga('2026-07-18'), '18 de julio de 2026')
  assert.equal(fechaLarga('2026-12-05'), '5 de diciembre de 2026')
  assert.equal(etiquetaMes('2026-06'), 'Junio 2026')
})

test('el conteo por tipo cubre los cuatro filtros', () => {
  const cuenta = contarPorTipo(DATOS.avisos)
  assert.equal(cuenta.convocatoria + cuenta.logistica + cuenta.resultados + cuenta.patrocinadores, 8)
  assert.equal(cuenta.resultados, 2)
  assert.equal(cuenta.logistica, 4)
})

// ---------------------------------------------------------------------------
// Seguridad: ningún dato bancario de más
// ---------------------------------------------------------------------------

test('los avisos NO contienen datos bancarios', () => {
  const todo = JSON.stringify(DATOS)
  // Ningún número largo suelto: ni tarjeta, ni CLABE, ni cuenta.
  assert.equal(/\d{11,}/.test(todo), false)
  assert.equal(/clabe/i.test(todo), false)
})
