// Motor de elegibilidad de categorías. Puro, tipado, sin DOM. Reutilizable
// por el backend. Portado de js/inscripcion.js (edad nominal = año de evento
// menos año de nacimiento, no cumpleaños real).
import type {
  Categoria,
  EntradaElegibilidad,
  ResultadoElegibilidad,
  Rama,
} from '../types/roadbook'
// Extensión explícita: así el runner de `node --test` resuelve el módulo igual
// que Vite (tsconfig tiene allowImportingTsExtensions).
import { CATEGORIAS } from '../data/categorias.ts'


const ramaDesdeSexo = (sexo: string): Rama | '' =>
  sexo === 'M' ? 'V' : sexo === 'F' ? 'F' : ''
const limiteInferior = (categoria: Categoria): number => categoria.edadMin ?? -Infinity
const limiteSuperior = (categoria: Categoria): number => categoria.edadMax ?? Infinity

/**
 * Edad NOMINAL: año del evento menos año de nacimiento (no es la edad real por
 * cumpleaños). Es la regla que usa el comité para asignar categoría.
 * Devuelve null si la fecha no es un ISO YYYY-MM-DD válido.
 */
export function edadNominal(fechaNacimiento: string, anioEvento: number): number | null {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaNacimiento)
  if (!coincidencia) return null
  const anio = Number(coincidencia[1])
  const mes = Number(coincidencia[2])
  const dia = Number(coincidencia[3])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return anioEvento - anio
}

export function categoriasElegibles(entrada: EntradaElegibilidad): ResultadoElegibilidad {
  const { edadNominal: edad, sexo, tipoBicicleta = 'MTB', peso90mas = false } = entrada
  const rama = ramaDesdeSexo(sexo)

  if (rama === '' || edad === null || edad < 3 || edad > 99) {
    return { recomendada: null, alternativas: [], sinCoincidencia: false, infantiles: false }
  }

  const deLaRama = CATEGORIAS.filter((categoria) => categoria.rama === rama)
  const infantiles = edad <= 12
  const porGrupo = infantiles
    ? deLaRama.filter((categoria) => categoria.grupo === 'Infantiles')
    : deLaRama.filter((categoria) => categoria.grupo !== 'Infantiles')

  if (infantiles) {
    const recomendada =
      porGrupo.find(
        (categoria) =>
          !categoria.abierta &&
          edad >= limiteInferior(categoria) &&
          edad <= limiteSuperior(categoria),
      ) ?? null
    return { recomendada, alternativas: [], sinCoincidencia: !recomendada, infantiles: true }
  }

  if (tipoBicicleta === 'E-Bike') {
    const alternativas = porGrupo.filter((categoria) => categoria.requiereEbike === true)
    return {
      recomendada: null,
      alternativas,
      sinCoincidencia: alternativas.length === 0,
      infantiles: false,
      soloEbike: true,
    }
  }

  const recomendadas = porGrupo
    .filter(
      (categoria) =>
        !categoria.abierta &&
        edad >= limiteInferior(categoria) &&
        edad <= limiteSuperior(categoria),
    )
    .sort(
      (a, b) =>
        limiteSuperior(a) - limiteInferior(a) - (limiteSuperior(b) - limiteInferior(b)),
    )
  const recomendada = recomendadas[0] ?? null

  const alternativas = porGrupo.filter((categoria) => {
    if (!categoria.abierta || categoria.requiereEbike) return false
    if (categoria.requierePeso && !peso90mas) return false
    if (categoria.clave === 'M' && !peso90mas) return false
    if (categoria.nombre.startsWith('Elite') && edad < 16) return false
    if (categoria.nombre.startsWith('Rodadores') && edad < 13) return false
    return true
  })

  return { recomendada, alternativas, sinCoincidencia: !recomendada, infantiles: false }
}
