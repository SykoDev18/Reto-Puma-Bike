import test from 'node:test'
import assert from 'node:assert/strict'
import { construirEje, filaDeEdad, longitudBarra, EDAD_TOPE } from './eje.ts'
import { CATEGORIAS } from '../data/categorias.ts'
import type { Categoria } from '../types/roadbook'

const eje = construirEje(CATEGORIAS)

test('las filas salen de los datos y respetan los tramos reales', () => {
  assert.deepEqual(
    eje.filas.map((f) => f.etiqueta),
    ['≤4', '5-6', '7-8', '9-10', '11-12', '13-15', '16-18', '19-29', '30-39', '40-49', '50-59', '60+'],
  )
})

test('las categorías abiertas no tienen posición en el eje', () => {
  const clavesEnEje = eje.barras.map((b) => b.categoria.clave)
  for (const clave of ['X', 'Y', 'RV', 'RF', 'EBV', 'EBF', 'M']) {
    assert.equal(clavesEnEje.includes(clave), false, `${clave} no debe estar en el eje`)
  }
  assert.equal(eje.barras.length, CATEGORIAS.filter((c) => !c.abierta).length)
})

test('EL HALLAZGO: femenil no tiene categoría por edad de 16 a 18', () => {
  const huecosF = eje.huecos.filter((h) => h.rama === 'F')
  assert.equal(huecosF.length, 1)
  assert.equal(huecosF[0].etiqueta, '16-18')
  assert.equal(eje.filas[huecosF[0].filaInicio].desde, 16)
  assert.equal(eje.filas[huecosF[0].filaFin].hasta, 18)
})

test('varonil cubre el eje completo, sin huecos', () => {
  assert.equal(eje.huecos.filter((h) => h.rama === 'V').length, 0)
})

test('la longitud de la barra es proporcional a los años que cubre', () => {
  const panales = eje.barras.find((b) => b.categoria.clave === 'Pv')
  const master20 = eje.barras.find((b) => b.categoria.clave === 'L')
  assert.ok(panales && master20)
  assert.equal(panales.anios, 5) // 0 a 4
  assert.equal(master20.anios, 11) // 19 a 29
  const largoPanales = longitudBarra(panales, eje)
  const largoMaster20 = longitudBarra(master20, eje)
  assert.ok(
    largoMaster20 > largoPanales,
    `Máster 20 (${largoMaster20}%) debe dibujarse más largo que Pañales (${largoPanales}%)`,
  )
  // La diferencia tiene que ser VISIBLE, no de un punto porcentual.
  assert.ok(largoMaster20 - largoPanales > 20, 'la diferencia debe leerse a simple vista')
  // Un rango abierto ocupa el carril completo: no se le inventa un tope.
  const master40F = eje.barras.find((b) => b.categoria.clave === 'E')
  assert.ok(master40F)
  assert.equal(longitudBarra(master40F, eje), 100)
})

test('Máster 40 Femenil (40 y más) abarca varias filas', () => {
  const e = eje.barras.find((b) => b.categoria.clave === 'E')
  assert.ok(e)
  assert.equal(eje.filas[e.filaInicio].desde, 40)
  assert.equal(eje.filas[e.filaFin].hasta, null) // llega al tramo abierto
  assert.ok(e.filaFin > e.filaInicio)
})

test('filaDeEdad ubica una edad nominal en su tramo', () => {
  assert.equal(eje.filas[filaDeEdad(eje, 34)].etiqueta, '30-39')
  assert.equal(eje.filas[filaDeEdad(eje, 11)].etiqueta, '11-12')
  assert.equal(eje.filas[filaDeEdad(eje, 17)].etiqueta, '16-18')
  assert.equal(eje.filas[filaDeEdad(eje, EDAD_TOPE)].etiqueta, '60+')
  assert.equal(filaDeEdad(eje, 200), -1)
})

test('si la lista crece, el eje absorbe la categoría nueva sin tocar el layout', () => {
  const nueva: Categoria = {
    id: 99,
    nombre: 'Juvenil Mayor Femenil',
    clave: 'JF',
    grupo: 'Grupo Mayor',
    rama: 'F',
    edadMin: 16,
    edadMax: 18,
    descripcionEdad: '16 a 18 años',
    vueltas: 4,
    abierta: false,
  }
  const conNueva = construirEje([...CATEGORIAS, nueva])
  assert.equal(conNueva.filas.length, eje.filas.length, 'no cambia el número de tramos')
  assert.equal(conNueva.huecos.filter((h) => h.rama === 'F').length, 0, 'se cierra el hueco')
})

test('eje vacío no revienta', () => {
  const vacio = construirEje([])
  assert.deepEqual(vacio.filas, [])
  assert.deepEqual(vacio.barras, [])
  assert.deepEqual(vacio.huecos, [])
})
