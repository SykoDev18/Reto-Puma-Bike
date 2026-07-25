import { useId } from 'react'
import type { ReactNode } from 'react'

export interface OpcionRadio<T extends string | number> {
  valor: T
  etiqueta: string
  /** Contenido rico de la tarjeta (precio, explicación, placa…). */
  contenido?: ReactNode
  insignia?: string
  deshabilitada?: boolean
}

/**
 * Grupo de radios REALES: son `<input type="radio">` nativos con el mismo
 * `name`, así que el navegador ya da navegación con flechas, roving tabindex y
 * anuncio correcto en lector de pantalla. Nada de `<div onClick>`.
 *
 * `variante='tarjeta'` los presenta como tarjetas grandes (categorías, kits);
 * `'linea'` como botones anchos (rama, tipo de bicicleta).
 */
export function GrupoRadio<T extends string | number>({
  nombre,
  leyenda,
  valor,
  opciones,
  onCambio,
  error,
  descripcion,
  variante = 'linea',
}: {
  nombre: string
  leyenda: string
  valor: T | null
  opciones: Array<OpcionRadio<T>>
  onCambio: (valor: T) => void
  error?: string
  descripcion?: ReactNode
  variante?: 'linea' | 'tarjeta'
}) {
  const id = useId()
  const idError = `${id}-error`
  const idDesc = `${id}-desc`
  const describe = [error ? idError : null, descripcion ? idDesc : null]
    .filter(Boolean)
    .join(' ')

  return (
    <fieldset className={`radios radios--${variante}`}>
      <legend className="campo__rot">{leyenda}</legend>
      {descripcion ? (
        <p className="campo__ayuda" id={idDesc}>
          {descripcion}
        </p>
      ) : null}

      <div
        className="radios__lista"
        role="radiogroup"
        aria-label={leyenda}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe === '' ? undefined : describe}
      >
        {opciones.map((opcion) => (
          <label
            className="opcion"
            key={String(opcion.valor)}
            data-elegida={opcion.valor === valor ? 'si' : undefined}
            data-deshabilitada={opcion.deshabilitada ? 'si' : undefined}
          >
            <input
              className="opcion__radio"
              type="radio"
              name={nombre}
              value={String(opcion.valor)}
              checked={opcion.valor === valor}
              disabled={opcion.deshabilitada}
              onChange={() => onCambio(opcion.valor)}
            />
            <span className="opcion__cuerpo">
              {opcion.insignia ? <span className="opcion__insignia">{opcion.insignia}</span> : null}
              <span className="opcion__etiqueta">{opcion.etiqueta}</span>
              {opcion.contenido ? <span className="opcion__extra">{opcion.contenido}</span> : null}
            </span>
          </label>
        ))}
      </div>

      {error ? (
        <p className="campo__error" id={idError} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
