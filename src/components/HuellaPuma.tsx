/**
 * Huella de puma en SVG propio (sin librerías de iconos). Usa currentColor para
 * heredar el color del contexto, así sirve en el riel y como marcador del eje.
 */
export function HuellaPuma({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        <path d="M50 92c-14 0-25-8-25-19 0-10 11-16 25-16s25 6 25 16c0 11-11 19-25 19z" />
        <ellipse cx="21" cy="47" rx="8" ry="12" />
        <ellipse cx="39" cy="33" rx="8.5" ry="13.5" />
        <ellipse cx="61" cy="33" rx="8.5" ry="13.5" />
        <ellipse cx="79" cy="47" rx="8" ry="12" />
      </g>
    </svg>
  )
}
