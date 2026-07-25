import test from 'node:test'
import assert from 'node:assert/strict'
import { categoriasElegibles, edadNominal } from './categorias.ts'

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

test('edadNominal usa el año, no el cumpleaños', () => {
  // Nació en diciembre de 1990: para el evento de 2026 la edad nominal es 36,
  // aunque el 5 de julio de 2026 todavía tenga 35 años reales.
  assert.equal(edadNominal('1990-12-31', 2026), 36)
  assert.equal(edadNominal('1990-01-01', 2026), 36)
  assert.equal(edadNominal('2020-06-15', 2026), 6)
})

test('edadNominal rechaza fechas inválidas', () => {
  assert.equal(edadNominal('', 2026), null)
  assert.equal(edadNominal('05/07/1990', 2026), null)
  assert.equal(edadNominal('1990-13-01', 2026), null)
  assert.equal(edadNominal('1990-12-32', 2026), null)
})
