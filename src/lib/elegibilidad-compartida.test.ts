// El otro extremo del contrato compartido con el backend.
//
// `compartido/casos-elegibilidad.json` congela el comportamiento del motor del
// front, y el test de Python (`backend/tests/test_elegibilidad.py`) se mide
// contra el mismo archivo. Este test protege el lado de acá: si alguien cambia
// `categoriasElegibles()` sin querer, falla aquí antes de que el backend note
// la divergencia.
//
// Si el cambio es intencional: regenerar con
//   node --experimental-strip-types backend/scripts/exportar_casos.ts
// y revisar el diff del JSON, que es justamente el registro de qué cambió.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { categoriasElegibles, edadNominal } from './categorias.ts'
import type { Categoria } from '../types/roadbook'

interface CategoriaResumen {
  id: number
  clave: string
  nombre: string
}

interface Caso {
  nombre: string
  entrada: {
    fecha_nacimiento: string
    sexo: string
    tipo_bicicleta: 'MTB' | 'E-Bike'
    peso_90_mas: boolean
  }
  esperado: {
    edad_nominal: number | null
    recomendada: CategoriaResumen | null
    alternativas: CategoriaResumen[]
    sin_coincidencia: boolean
    infantiles: boolean
    solo_ebike: boolean
  }
}

const fixture: { anio_evento: number; casos: Caso[] } = JSON.parse(
  readFileSync('compartido/casos-elegibilidad.json', 'utf8'),
)

const aIso = (ddmmaaaa: string): string => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmaaaa)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

const resumir = (c: Categoria): CategoriaResumen => ({
  id: c.id,
  clave: c.clave,
  nombre: c.nombre,
})

test('el fixture compartido no está vacío ni desincronizado', () => {
  assert.equal(fixture.anio_evento, 2026)
  assert.ok(fixture.casos.length >= 20, 'faltan casos en el fixture')
})

for (const caso of fixture.casos) {
  test(`caso compartido: ${caso.nombre}`, () => {
    const edad = edadNominal(aIso(caso.entrada.fecha_nacimiento), fixture.anio_evento)
    assert.equal(edad, caso.esperado.edad_nominal)

    const r = categoriasElegibles({
      edadNominal: edad,
      sexo: caso.entrada.sexo,
      tipoBicicleta: caso.entrada.tipo_bicicleta,
      peso90mas: caso.entrada.peso_90_mas,
    })

    assert.deepEqual(
      r.recomendada ? resumir(r.recomendada) : null,
      caso.esperado.recomendada,
    )
    assert.deepEqual(r.alternativas.map(resumir), caso.esperado.alternativas)
    assert.equal(r.sinCoincidencia, caso.esperado.sin_coincidencia)
    assert.equal(r.infantiles, caso.esperado.infantiles)
    assert.equal(r.soloEbike === true, caso.esperado.solo_ebike)
  })
}
