import test from 'node:test'
import assert from 'node:assert/strict'
import { rangoAltitud, construirPathVertical, desnivelAcumulado, proximoHito } from './perfil.ts'
import type { PuntoPerfil, Hito } from '../types/roadbook'

const perfil: PuntoPerfil[] = [
  { km: 0, altitud: 2000 },
  { km: 1, altitud: 2100 },
  { km: 2, altitud: 2050 },
  { km: 3, altitud: 2150 },
]

test('rangoAltitud toma min y max', () => {
  assert.deepEqual(rangoAltitud(perfil), { min: 2000, max: 2150 })
})

test('rangoAltitud vacío no revienta', () => {
  assert.deepEqual(rangoAltitud([]), { min: 0, max: 1 })
})

test('desnivelAcumulado suma solo las subidas', () => {
  // 0->1 +100, 1->2 -50 (ignora), 2->3 +100 => 200
  assert.equal(desnivelAcumulado(perfil, 3), 200)
  assert.equal(desnivelAcumulado(perfil, 1), 100)
  assert.equal(desnivelAcumulado(perfil, 0), 0)
})

test('construirPathVertical empieza en M y mapea el primer punto al origen', () => {
  const d = construirPathVertical(perfil, 3, { alto: 1000, xIzq: 0, xDer: 10 })
  assert.ok(d.startsWith('M0.00 0.00'))
  assert.ok(d.includes('L'))
})

test('construirPathVertical vacío devuelve cadena vacía', () => {
  assert.equal(construirPathVertical([], 3, { alto: 1, xIzq: 0, xDer: 1 }), '')
  assert.equal(construirPathVertical(perfil, 0, { alto: 1, xIzq: 0, xDer: 1 }), '')
})

test('proximoHito devuelve el siguiente o null', () => {
  const hitos: Hito[] = [
    { km: 0, nombre: 'Salida', tipo: 'salida' },
    { km: 10, nombre: 'El Rincón', tipo: 'poblado' },
  ]
  assert.equal(proximoHito(hitos, 5)?.nombre, 'El Rincón')
  assert.equal(proximoHito(hitos, 20), null)
})
