import { useId } from 'react'

/**
 * Campo con etiqueta ARRIBA, error DEBAJO y `aria-describedby`/`aria-invalid`.
 * No valida mientras se escribe: el contenedor decide cuándo mostrar el error
 * (en blur o al intentar avanzar).
 */
export function CampoTexto({
  etiqueta,
  valor,
  onCambio,
  onBlur,
  error,
  tipo = 'text',
  ayuda,
  opcional,
  autoComplete,
  inputMode,
  maxLength,
  placeholder,
  ancho,
}: {
  etiqueta: string
  valor: string
  onCambio: (valor: string) => void
  onBlur?: () => void
  error?: string
  tipo?: 'text' | 'email' | 'tel' | 'date' | 'number'
  ayuda?: string
  opcional?: boolean
  autoComplete?: string
  inputMode?: 'text' | 'numeric' | 'email' | 'tel'
  maxLength?: number
  placeholder?: string
  ancho?: 'corto' | 'medio' | 'largo'
}) {
  const id = useId()
  const idError = `${id}-error`
  const idAyuda = `${id}-ayuda`
  const describe = [error ? idError : null, ayuda ? idAyuda : null].filter(Boolean).join(' ')

  return (
    <div className={ancho ? `campo campo--${ancho}` : 'campo'}>
      <label className="campo__rot" htmlFor={id}>
        {etiqueta}
        {opcional ? <span className="campo__opcional"> (opcional)</span> : null}
      </label>
      <input
        id={id}
        className="campo__input"
        type={tipo}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe === '' ? undefined : describe}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
      />
      {ayuda ? (
        <p className="campo__ayuda" id={idAyuda}>
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p className="campo__error" id={idError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
