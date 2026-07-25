import type { CampoFormulario, DatosFormulario, ErroresFormulario, TallaJersey } from '../../types/registro'
import type { Kit } from '../../data/config'
import { GrupoRadio } from '../GrupoRadio'
import type { OpcionRadio } from '../GrupoRadio'

const TALLAS: TallaJersey[] = ['CH', 'M', 'G', 'XG', '2XG']
const nf = new Intl.NumberFormat('es-MX')

/** CONTROL 3 · KM 34 — Tu kit. */
export function Control3Kit({
  datos,
  errores,
  kits,
  kitConJersey,
  onCampo,
}: {
  datos: DatosFormulario
  errores: ErroresFormulario
  kits: Kit[]
  kitConJersey: (nombre: string) => boolean
  onCampo: <C extends CampoFormulario>(campo: C, valor: DatosFormulario[C]) => void
}) {
  const elegido = kits.find((k) => k.nombre === datos.kit) ?? null
  const pideTalla = elegido !== null && kitConJersey(elegido.nombre)

  const opciones: Array<OpcionRadio<string>> = kits.map((kit) => ({
    valor: kit.nombre,
    etiqueta: kit.nombre,
    contenido: (
      <>
        <span className="opcion__precio">
          <span className="cifra">${nf.format(kit.precio)}</span>
          <span className="opcion__moneda">MXN</span>
        </span>
        <ul className="opcion__incluye">
          {kit.incluye.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </>
    ),
  }))

  return (
    <>
      <GrupoRadio<string>
        nombre="kit"
        leyenda="Kit"
        valor={datos.kit === '' ? null : datos.kit}
        error={errores.kit}
        onCambio={(v) => onCampo('kit', v)}
        variante="tarjeta"
        opciones={opciones}
      />

      {/* La talla aparece SOLO si el kit trae jersey: nada de campos deshabilitados. */}
      {pideTalla ? (
        <GrupoRadio<TallaJersey>
          nombre="talla_jersey"
          leyenda="Talla del jersey"
          valor={datos.talla_jersey === '' ? null : datos.talla_jersey}
          error={errores.talla_jersey}
          onCambio={(v) => onCampo('talla_jersey', v)}
          opciones={TALLAS.map((t) => ({ valor: t, etiqueta: t }))}
        />
      ) : null}

      {elegido ? (
        <p className="total">
          <span className="total__rot">Total a pagar</span>
          <span className="total__monto cifra">${nf.format(elegido.precio)}</span>
          <span className="total__moneda">MXN</span>
        </p>
      ) : null}

      <p className="aviso aviso--pista serif">
        El pago se realiza al recoger tu kit. Aquí solo apartas tu lugar.
      </p>
    </>
  )
}
