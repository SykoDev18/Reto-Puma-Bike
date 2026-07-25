import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  aCSV,
  aCentesimas,
  BOM_UTF8,
  buscar,
  celdaCsv,
  clasificados,
  construirIndice,
  contarCoincidencias,
  diferenciaConPrimero,
  formatearDiferencia,
  normalizar,
  ordenarCorredores,
  permiteTarjeta,
  podio,
  porDorsal,
  tiempoDelPrimero,
  validarResultados,
} from './resultados.ts'
import type { CategoriaResultado, Corredor } from '../types/resultados'

// Los datos REALES de la 4ª edición, leídos de donde los sirve el sitio.
const crudo: unknown = JSON.parse(readFileSync('public/data/resultados-2026.json', 'utf8'))
const RES = validarResultados(crudo)
const INDICE = construirIndice(RES)

const categoria = (id: string): CategoriaResultado => {
  const c = RES.categorias.find((x) => x.id === id)
  assert.ok(c, `falta la categoría ${id}`)
  return c
}

const porNumero = (dorsal: number): Corredor => {
  const entradas = porDorsal(INDICE, dorsal)
  assert.equal(entradas.length, 1, `el dorsal ${dorsal} no es único`)
  return entradas[0].corredor
}

// ---------------------------------------------------------------------------
// El archivo cumple el contrato
// ---------------------------------------------------------------------------

test('el JSON pasa la validación del borde y trae 21 categorías / 781 corredores', () => {
  assert.equal(RES.categorias.length, 21)
  assert.equal(INDICE.length, 781)
  assert.equal(RES.parcial, true)
  assert.ok(RES.nota_parcial)
})

test('la validación RECHAZA datos que no cumplen el contrato', () => {
  assert.throws(() => validarResultados({ evento: 'x' }))
  assert.throws(() => validarResultados(null))
  assert.throws(() =>
    validarResultados({
      ...RES,
      categorias: [{ ...categoria('N-80'), corredores: [{ dorsal: 1, estado: 'INVENTADO' }] }],
    }),
  )
})

test('las tres categorías con clave provisional se conservan, no se filtran', () => {
  const provisionales = RES.categorias.filter((c) => c.clave_provisional).map((c) => c.id)
  assert.deepEqual(provisionales.sort(), ['JLF-40', 'JLV-40', 'ZF-40'])
})

test('MÁSTER 30 VARONIL son DOS competencias distintas: N-40 y N-80', () => {
  const mismas = RES.categorias.filter((c) => c.nombre === 'MÁSTER 30 VARONIL')
  assert.equal(mismas.length, 2)
  assert.deepEqual(
    mismas.map((c) => `${c.id}:${c.corredores.length}`),
    ['N-40:81', 'N-80:61'],
  )
  // Y sus podios no se tocan entre sí.
  assert.notEqual(podio(categoria('N-40'))[0].dorsal, podio(categoria('N-80'))[0].dorsal)
})

// ---------------------------------------------------------------------------
// Búsqueda: nunca elige por el usuario
// ---------------------------------------------------------------------------

test('normalizar quita acentos y mayúsculas', () => {
  assert.equal(normalizar('  HERNÁNDEZ  '), 'hernandez')
  assert.equal(normalizar('Zúñiga Olguín'), 'zuniga olguin')
})

test('buscar "Hernandez" sin acento encuentra a los "Hernández"', () => {
  const total = contarCoincidencias(INDICE, 'hernandez')
  assert.equal(total, 76)
  const conAcento = buscar(INDICE, 'Hernández', 100)
  const sinAcento = buscar(INDICE, 'Hernandez', 100)
  assert.deepEqual(
    conAcento.map((e) => e.n),
    sinAcento.map((e) => e.n),
  )
})

test('y también al que viene mal acentuado en el padrón: "HÉRNANDEZ"', () => {
  // Caso real de estos datos. Buscar por acento exacto la dejaría fuera de su
  // propio resultado; normalizar la encuentra igual.
  const hallados = buscar(INDICE, 'hernandez', 200).map((e) => e.nombre)
  assert.ok(hallados.includes('VANESSA HÉRNANDEZ ORDOÑEZ'))
})

test('"Renato Romo Gordo" devuelve LOS DOS dorsales, no elige uno', () => {
  const hallados = buscar(INDICE, 'renato romo gordo')
  assert.deepEqual(
    hallados.map((e) => e.dorsal).sort((a, b) => a - b),
    [695, 713],
  )
})

test('"Luis Amador Aldana Aldana" también devuelve los dos', () => {
  assert.deepEqual(
    buscar(INDICE, 'luis amador aldana aldana')
      .map((e) => e.dorsal)
      .sort((a, b) => a - b),
    [540, 541],
  )
})

test('buscar por dorsal usa prefijo y respeta el límite de 8', () => {
  assert.equal(buscar(INDICE, '647')[0].dorsal, 647)
  assert.ok(buscar(INDICE, '6').length <= 8)
  assert.equal(buscar(INDICE, '').length, 0)
})

test('hay dorsales REPETIDOS: 25 y 127 devuelven dos registros cada uno', () => {
  assert.equal(porDorsal(INDICE, 25).length, 2)
  assert.equal(porDorsal(INDICE, 127).length, 2)
  // Y `n` los distingue, que es lo que permite compartir el enlace correcto.
  const [a, b] = porDorsal(INDICE, 25)
  assert.notEqual(a.n, b.n)
})

// ---------------------------------------------------------------------------
// Tiempos: se deciden por centésimas
// ---------------------------------------------------------------------------

test('aCentesimas parsea HH:MM:SS.CC y rechaza lo demás', () => {
  assert.equal(aCentesimas('03:21:08.74'), (3 * 3600 + 21 * 60 + 8) * 100 + 74)
  assert.equal(aCentesimas(null), null)
  assert.equal(aCentesimas('03:21:08'), null)
})

test('la diferencia NO se redondea: Elite Varonil se decide por 4.29 s', () => {
  const elite = categoria('X-80')
  const base = tiempoDelPrimero(elite)
  assert.equal(elite.corredores[0].tiempo, '03:01:42.41')
  assert.equal(elite.corredores[1].tiempo, '03:01:46.70')
  assert.equal(diferenciaConPrimero(elite.corredores[1], base), '+00:04.29')
})

test('formatearDiferencia agrega la hora solo cuando hace falta, y firma el signo', () => {
  assert.equal(formatearDiferencia(429), '+00:04.29')
  assert.equal(formatearDiferencia(360000), '+1:00:00.00')
  assert.equal(formatearDiferencia(-8015), '−01:20.15')
})

test('un dato en REVISION puede ser MÁS rápido que el 1º: la diferencia sale negativa', () => {
  const y80 = categoria('Y-80')
  const rara = porNumero(375)
  const diferencia = diferenciaConPrimero(rara, tiempoDelPrimero(y80))
  assert.ok(diferencia !== null && diferencia.startsWith('−'))
})

// ---------------------------------------------------------------------------
// Podios: se agrupan por categoría + ruta y no se maquillan
// ---------------------------------------------------------------------------

test('dorsal 647 es 1º de N-80 con 03:21:08.74 y admite tarjeta', () => {
  const c = porNumero(647)
  assert.equal(c.posicion, 1)
  assert.equal(c.tiempo, '03:21:08.74')
  assert.equal(c.estado, 'OK')
  assert.equal(permiteTarjeta(c.estado), true)
  // 61 corren la categoría (lo que dice la tarjeta) pero solo 43 traen posición.
  assert.equal(categoria('N-80').corredores.length, 61)
  assert.equal(clasificados(categoria('N-80')), 43)
})

test('Z-40 tiene un CAMPEÓN SIN TIEMPO: se conserva en 1º y no se promueve al 2º', () => {
  const z40 = categoria('Z-40')
  const primero = podio(z40)[0]
  assert.equal(primero.dorsal, 577)
  assert.equal(primero.posicion, 1)
  assert.equal(primero.tiempo, null)
  assert.equal(primero.estado, 'SIN_TIEMPO')
  assert.ok(primero.nota)
  // Sin tiempo del 1º no hay diferencia calculable: no se inventa otra base.
  assert.equal(tiempoDelPrimero(z40), null)
  assert.equal(diferenciaConPrimero(z40.corredores[1], tiempoDelPrimero(z40)), null)
  // Y sí puede descargar tarjeta, sin tiempo.
  assert.equal(permiteTarjeta(primero.estado), true)
})

test('EBV-40 tiene DOS corredores en posición 2: el podio los muestra a ambos', () => {
  const p = podio(categoria('EBV-40'))
  assert.deepEqual(
    p.map((c) => c.posicion),
    [1, 2, 2, 3],
  )
  // Sin reordenar: el orden es el que trae el sistema.
  assert.deepEqual(
    p.map((c) => c.dorsal),
    [679, 84, 680, 564],
  )
  assert.equal(p[1].estado, 'REVISION')
  assert.equal(p[2].estado, 'REVISION')
})

test('una categoría de 3 corredoras tiene podio completo de 3', () => {
  assert.equal(categoria('EBF-40').corredores.length, 3)
  assert.equal(podio(categoria('EBF-40')).length, 3)
})

test('las posiciones NO se renumeran: en N-40 falta la 32', () => {
  const posiciones = categoria('N-40')
    .corredores.map((c) => c.posicion)
    .filter((p): p is number => p !== null)
  assert.equal(posiciones.includes(32), false)
  assert.equal(posiciones.includes(31), true)
  assert.equal(posiciones.includes(33), true)
})

test('dorsal 375 está en REVISION con motivo y NO admite tarjeta', () => {
  const c = porNumero(375)
  assert.equal(c.estado, 'REVISION')
  assert.ok(c.nota)
  assert.equal(permiteTarjeta(c.estado), false)
})

test('dorsal 852 llega sin nombre en el padrón y se muestra como "(sin nombre)"', () => {
  const c = porNumero(852)
  assert.equal(c.nombre, '(sin nombre)')
  assert.equal(c.estado, 'REVISION')
})

test('un DNF no tiene posición ni tiempo y no admite tarjeta', () => {
  const c = porNumero(695)
  assert.equal(c.estado, 'DNF')
  assert.equal(c.posicion, null)
  assert.equal(c.tiempo, null)
  assert.equal(permiteTarjeta(c.estado), false)
})

// ---------------------------------------------------------------------------
// Orden de la tabla
// ---------------------------------------------------------------------------

test('los DNF caen al final en cualquier sentido de orden', () => {
  const n40 = categoria('N-40')
  for (const sentido of ['asc', 'desc'] as const) {
    const ordenados = ordenarCorredores(n40.corredores, 'posicion', sentido)
    const primerSinPosicion = ordenados.findIndex((c) => c.posicion === null)
    const ultimoConPosicion = ordenados.map((c) => c.posicion !== null).lastIndexOf(true)
    assert.ok(primerSinPosicion > ultimoConPosicion)
  }
})

test('ordenar por nombre usa la comparación de es-MX y no destruye los datos', () => {
  const n40 = categoria('N-40')
  const ordenados = ordenarCorredores(n40.corredores, 'nombre')
  assert.equal(ordenados.length, n40.corredores.length)
  assert.equal(n40.corredores[0].dorsal, categoria('N-40').corredores[0].dorsal)
})

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

test('el CSV lleva encabezado con estado, una fila por corredor y acentos intactos', () => {
  const csv = aCSV(RES.categorias)
  const lineas = csv.split('\r\n')
  assert.equal(lineas.length, 782) // encabezado + 781
  assert.ok(lineas[0].includes('estado'))
  assert.ok(lineas[0].includes('categoria_id'))
  assert.ok(csv.includes('Hernández') || csv.includes('Hernandez'))
  assert.ok(csv.includes('03:21:08.74'))
})

test('el CSV filtrado exporta SOLO lo filtrado', () => {
  const soloN80 = aCSV([categoria('N-80')])
  assert.equal(soloN80.split('\r\n').length, 62) // encabezado + 61
})

test('las celdas con coma o comilla se escapan', () => {
  assert.equal(celdaCsv('Rosales, Mizraim'), '"Rosales, Mizraim"')
  assert.equal(celdaCsv('el "rápido"'), '"el ""rápido"""')
  assert.equal(celdaCsv(null), '')
  assert.equal(celdaCsv(3), '3')
})

test('el BOM es U+FEFF: sin él Excel en español rompe los acentos', () => {
  assert.equal(BOM_UTF8, '﻿')
  assert.equal(BOM_UTF8.length, 1)
})
