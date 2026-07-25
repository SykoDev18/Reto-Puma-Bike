import { useRef } from 'react'
import { CONFIG } from '../data/config'
import { BotonCopiar } from './BotonCopiar'

/**
 * Datos para transferir. Como TEXTO, nunca como imagen del flyer bancario: el
 * flyer del comité trae impreso un número de tarjeta y esa imagen no se publica.
 *
 * Aquí solo van banco, beneficiario, cuenta y CLABE, que sirven únicamente para
 * RECIBIR. No hay tarjeta, no hay QR de pago y no hay formulario que capture
 * datos bancarios de nadie. Si alguien pide agregar la tarjeta "para que sea más
 * fácil", la respuesta es no: habilita cargos en comercios que solo piden número
 * y vencimiento.
 */
export function DatosPago() {
  const cuentaRef = useRef<HTMLSpanElement>(null)
  const clabeRef = useRef<HTMLSpanElement>(null)
  const { banco, beneficiario, cuenta, clabe, instruccion } = CONFIG.pago

  return (
    <div className="pago">
      <dl className="pago__lista">
        <div className="pago__fila">
          <dt>Banco</dt>
          <dd>{banco}</dd>
        </div>
        <div className="pago__fila">
          <dt>Beneficiario</dt>
          <dd>{beneficiario}</dd>
        </div>
        <div className="pago__fila">
          <dt>Cuenta</dt>
          <dd>
            {/* `cifra` y no `dato`: un número de cuenta no lo midió un
                cronómetro ni un GPS. Monoespaciada sí, --crono no. */}
            <span className="cifra pago__numero" ref={cuentaRef}>
              {cuenta}
            </span>
            <BotonCopiar valor={cuenta} etiqueta="la cuenta" objetivoRef={cuentaRef} />
          </dd>
        </div>
        <div className="pago__fila">
          <dt>CLABE</dt>
          <dd>
            <span className="cifra pago__numero" ref={clabeRef}>
              {clabe}
            </span>
            <BotonCopiar valor={clabe} etiqueta="la CLABE" objetivoRef={clabeRef} />
          </dd>
        </div>
      </dl>
      <p className="pago__instruccion serif">{instruccion}</p>
    </div>
  )
}
