// Funciones puras del perfil de elevación. Sin DOM, testeables.
import type { PuntoPerfil, Hito } from '../types/roadbook'

export interface RangoAltitud {
  min: number
  max: number
}

export function rangoAltitud(perfil: PuntoPerfil[]): RangoAltitud {
  if (perfil.length === 0) return { min: 0, max: 1 }
  let min = perfil[0].altitud
  let max = perfil[0].altitud
  for (const p of perfil) {
    if (p.altitud < min) min = p.altitud
    if (p.altitud > max) max = p.altitud
  }
  return { min, max }
}

export interface OpcionesPerfil {
  alto: number
  xIzq: number
  xDer: number
}

/**
 * Path SVG vertical del perfil: y = kilómetro, x = altitud normalizada.
 * Pura y testeable; no dibuja a mano ni usa librería de charts.
 */
export function construirPathVertical(
  perfil: PuntoPerfil[],
  kmTotal: number,
  opts: OpcionesPerfil,
): string {
  if (perfil.length === 0 || kmTotal <= 0) return ''
  const { min, max } = rangoAltitud(perfil)
  const span = max - min || 1
  return perfil
    .map((p, i) => {
      const y = (p.km / kmTotal) * opts.alto
      const x = opts.xIzq + ((p.altitud - min) / span) * (opts.xDer - opts.xIzq)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

export interface OpcionesPerfilHorizontal {
  ancho: number
  alto: number
  /** Margen superior/inferior para que la cresta no toque el borde del SVG. */
  margen?: number
}

/**
 * Path SVG horizontal del perfil: x = kilómetro, y = altitud invertida (0 arriba).
 * Se usa en los mini-perfiles de las tarjetas de ruta. Pura y testeable.
 */
export function construirPathHorizontal(
  perfil: PuntoPerfil[],
  kmTotal: number,
  opts: OpcionesPerfilHorizontal,
): string {
  if (perfil.length === 0 || kmTotal <= 0) return ''
  const margen = opts.margen ?? 0
  const utilizable = Math.max(0, opts.alto - margen * 2)
  const { min, max } = rangoAltitud(perfil)
  const span = max - min || 1
  return perfil
    .map((p, i) => {
      const x = (p.km / kmTotal) * opts.ancho
      const y = margen + (1 - (p.altitud - min) / span) * utilizable
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

/** Ascenso positivo acumulado (m) hasta cierto km. */
export function desnivelAcumulado(perfil: PuntoPerfil[], kmObjetivo: number): number {
  let acc = 0
  for (let i = 1; i < perfil.length; i++) {
    if (perfil[i].km > kmObjetivo) break
    const delta = perfil[i].altitud - perfil[i - 1].altitud
    if (delta > 0) acc += delta
  }
  return Math.round(acc)
}

/** Primer hito estrictamente después de kmActual (para "siguiente: …"). */
export function proximoHito(hitos: Hito[], kmActual: number): Hito | null {
  return hitos.find((h) => h.km > kmActual + 0.05) ?? null
}
