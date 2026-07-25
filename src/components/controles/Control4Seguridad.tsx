import type { CampoFormulario, DatosFormulario, ErroresFormulario } from '../../types/registro'
import { mascaraTelefono } from '../../lib/registro'
import { CampoTexto } from '../CampoTexto'

const TIPOS_SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']

/** CONTROL 4 · KM 58 — Seguridad. */
export function Control4Seguridad({
  datos,
  errores,
  onCampo,
  onBlur,
}: {
  datos: DatosFormulario
  errores: ErroresFormulario
  onCampo: <C extends CampoFormulario>(campo: C, valor: DatosFormulario[C]) => void
  onBlur: (campo: CampoFormulario) => void
}) {
  return (
    <>
      <p className="aviso aviso--pista serif">
        Esto es para poder ayudarte si algo pasa en la ruta.
      </p>

      <div className="rejilla-campos">
        <CampoTexto
          etiqueta="Correo electrónico"
          valor={datos.email}
          onCambio={(v) => onCampo('email', v)}
          onBlur={() => onBlur('email')}
          error={errores.email}
          tipo="email"
          inputMode="email"
          autoComplete="email"
          ancho="largo"
        />
        <CampoTexto
          etiqueta="Teléfono"
          valor={datos.telefono}
          onCambio={(v) => onCampo('telefono', mascaraTelefono(v))}
          onBlur={() => onBlur('telefono')}
          error={errores.telefono}
          tipo="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="55 1234 5678"
          ancho="medio"
        />
      </div>

      <div className="rejilla-campos">
        <CampoTexto
          etiqueta="Contacto de emergencia"
          valor={datos.contacto_emergencia_nombre}
          onCambio={(v) => onCampo('contacto_emergencia_nombre', v)}
          onBlur={() => onBlur('contacto_emergencia_nombre')}
          error={errores.contacto_emergencia_nombre}
          ayuda="Alguien que no venga contigo a la carrera."
          ancho="largo"
        />
        <CampoTexto
          etiqueta="Teléfono de emergencia"
          valor={datos.contacto_emergencia_tel}
          onCambio={(v) => onCampo('contacto_emergencia_tel', mascaraTelefono(v))}
          onBlur={() => onBlur('contacto_emergencia_tel')}
          error={errores.contacto_emergencia_tel}
          tipo="tel"
          inputMode="tel"
          placeholder="55 1234 5678"
          ancho="medio"
        />
      </div>

      <div className="campo campo--corto">
        <label className="campo__rot" htmlFor="tipo_sangre">
          Tipo de sangre<span className="campo__opcional"> (opcional)</span>
        </label>
        <select
          id="tipo_sangre"
          className="campo__input"
          value={datos.tipo_sangre}
          onChange={(e) => onCampo('tipo_sangre', e.target.value)}
        >
          <option value="">No lo sé</option>
          {TIPOS_SANGRE.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Deslinde y privacidad en <details>, no en un modal. */}
      <details className="legal">
        <summary className="legal__titulo">Deslinde de responsabilidad y aviso de privacidad</summary>
        <div className="legal__texto serif">
          <p>
            Participo por voluntad propia y declaro estar en condiciones físicas para recorrer la
            ruta que elegí. Libero al comité organizador, a los patrocinadores y a las autoridades
            de responsabilidad por accidentes, lesiones o pérdidas materiales durante el evento.
          </p>
          <p>
            Acepto usar casco durante todo el recorrido y seguir las indicaciones del staff.
            Autorizo el uso de mi nombre y de las fotografías del evento para su difusión.
          </p>
          <p>
            Mis datos se usan únicamente para el registro, el cronometraje y el contacto en caso de
            emergencia. No se comparten con terceros ajenos al evento.
          </p>
        </div>
      </details>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={datos.deslinde && datos.privacidad}
          aria-invalid={errores.deslinde ? true : undefined}
          onChange={(e) => {
            onCampo('deslinde', e.target.checked)
            onCampo('privacidad', e.target.checked)
          }}
        />
        <span>
          Leí y acepto el deslinde y el aviso de privacidad.
          {errores.deslinde ? (
            <span className="campo__error" role="alert">
              {errores.deslinde}
            </span>
          ) : null}
        </span>
      </label>
    </>
  )
}
