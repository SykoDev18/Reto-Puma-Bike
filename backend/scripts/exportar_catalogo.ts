// Exporta el catálogo de categorías del FRONT a `compartido/categorias.json`,
// que es lo que lee el motor de Python.
//
// Existe para que el catálogo tenga UNA sola fuente de verdad: `src/data/
// categorias.ts`. Mantener a mano una copia en Python garantiza que en algún
// momento diverjan, y una divergencia aquí significa corredores en la categoría
// equivocada el día de la carrera.
//
// Uso:  node --experimental-strip-types backend/scripts/exportar_catalogo.ts
// El test `test_catalogo.py` vuelve a correrlo y falla si el JSON quedó viejo.
import { writeFileSync } from 'node:fs'
import { CATEGORIAS, MAPA_RUTAS, ORDEN_GRUPOS } from '../../src/data/categorias.ts'

const salida = {
  _generado_por: 'backend/scripts/exportar_catalogo.ts',
  _fuente: 'src/data/categorias.ts',
  _nota: 'NO editar a mano. Regenerar con el script.',
  orden_grupos: ORDEN_GRUPOS,
  mapa_rutas: MAPA_RUTAS,
  categorias: CATEGORIAS,
}

const ruta = 'compartido/categorias.json'
writeFileSync(ruta, `${JSON.stringify(salida, null, 2)}\n`, 'utf8')
console.log(`${ruta}: ${CATEGORIAS.length} categorías`)
