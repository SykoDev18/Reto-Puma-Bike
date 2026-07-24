import test from 'node:test'
import assert from 'node:assert/strict'
import { categoriasElegibles } from './categorias.ts'

test('niño de 6 años varonil cae en Infantil AA', () => {
  const r = categoriasElegibles({ edadNominal: 6, sexo: 'M' })
  assert.equal(r.infantiles, true)
  assert.equal(r.recomendada?.clave, 'AA')
  assert.equal(r.recomendada?.rama, 'V')
})

test('mujer de 35 recomienda Máster 30 Femenil (H)', () => {
  const r = categoriasElegibles({ edadNominal: 35, sexo: 'F' })
  assert.equal(r.infantiles, false)
  assert.equal(r.recomendada?.clave, 'H')
})

test('E-Bike solo ofrece categorías E-Bike de la rama', () => {
  const r = categoriasElegibles({ edadNominal: 40, sexo: 'M', tipoBicicleta: 'E-Bike' })
  assert.equal(r.soloEbike, true)
  assert.equal(r.recomendada, null)
  assert.ok(r.alternativas.length > 0)
  assert.ok(r.alternativas.every((c) => c.requiereEbike === true))
})

test('Mamut\'s solo es alternativa si marca 90 kg o más', () => {
  const sin = categoriasElegibles({ edadNominal: 35, sexo: 'M', peso90mas: false })
  assert.ok(!sin.alternativas.some((c) => c.clave === 'M'))
  const con = categoriasElegibles({ edadNominal: 35, sexo: 'M', peso90mas: true })
  assert.ok(con.alternativas.some((c) => c.clave === 'M'))
})

test('edad fuera de rango (2 o 100) no arroja categoría', () => {
  assert.equal(categoriasElegibles({ edadNominal: 2, sexo: 'M' }).recomendada, null)
  assert.equal(categoriasElegibles({ edadNominal: 100, sexo: 'F' }).recomendada, null)
})

test('sexo vacío no elige categoría', () => {
  const r = categoriasElegibles({ edadNominal: 30, sexo: '' })
  assert.equal(r.recomendada, null)
  assert.equal(r.alternativas.length, 0)
})
