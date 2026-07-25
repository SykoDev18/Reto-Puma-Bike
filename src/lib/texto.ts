/** Concordancia de número: 1 vuelta / 2 vueltas. Pura y testeable. */
export function plural(cantidad: number, singular: string, pluralForma?: string): string {
  return cantidad === 1 ? singular : (pluralForma ?? `${singular}s`)
}
