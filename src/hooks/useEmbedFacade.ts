import { useState } from 'react'

/**
 * Fachada de carga diferida para embeds (Komoot / YouTube): portada estática y
 * el iframe se monta solo tras el primer clic.
 */
export function useEmbedFacade(): { cargado: boolean; cargar: () => void } {
  const [cargado, setCargado] = useState(false)
  return { cargado, cargar: () => setCargado(true) }
}
