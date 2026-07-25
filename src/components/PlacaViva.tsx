import type { Categoria } from '../types/roadbook'
import type { DatosFormulario } from '../types/registro'
import { PerforacionesPlaca } from './PlacaDorsal'

/** Iniciales del segundo nombre: "Juan Carlos" -> "Juan C." */
function nombreCorto(datos: DatosFormulario): string {
  const partes = datos.nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return ''
  const primero = partes[0]
  const resto = partes.slice(1).map((p) => `${p.charAt(0).toLocaleUpperCase('es-MX')}.`)
  return [primero, ...resto].join(' ')
}

function apellidos(datos: DatosFormulario): string {
  return `${datos.apellido_paterno} ${datos.apellido_materno}`.trim()
}

/**
 * La placa que se arma en vivo mientras se llena el formulario. El usuario no
 * está llenando campos: está construyendo un objeto que quiere ver terminado.
 *
 * Es DECORATIVA para lectores de pantalla (aria-hidden): todo lo que muestra ya
 * está en los campos del formulario, así que repetirlo solo estorbaría.
 *
 * `numero_corredor` NUNCA se captura aquí: se asigna al recoger el kit.
 */
export function PlacaViva({
  datos,
  categoria,
  precioKit,
}: {
  datos: DatosFormulario
  categoria: Categoria | null
  precioKit: number | null
}) {
  const nombre = nombreCorto(datos)
  const apes = apellidos(datos)
  const nombreCompleto = [nombre, apes].filter((s) => s !== '').join(' ')

  const rutaTexto =
    datos.ruta === 'infantil' ? 'Circuito infantil' : datos.ruta === '' ? '' : `${datos.ruta} km`
  // Solo cuenta como capturada cuando hay ruta: `tipo_bicicleta` trae un valor
  // por defecto y marcaría la ranura como llena sin que el usuario elija nada.
  const rutaCapturada = datos.ruta !== ''
  const lineaRuta = rutaCapturada ? `${rutaTexto} · ${datos.tipo_bicicleta}` : ''
  const lineaKit = [datos.kit, datos.talla_jersey].filter((s) => s !== '').join(' · ')

  return (
    <figure className="placa-viva" aria-hidden="true">
      <div className="placa-viva__cuerpo">
        <PerforacionesPlaca />

        <span className="placa-viva__numero">
          <b>---</b>
          <small>número</small>
        </span>

        <span className="placa-viva__ranura" data-llena={nombreCompleto !== '' ? 'si' : undefined}>
          {nombreCompleto !== '' ? nombreCompleto : 'Tu nombre'}
        </span>

        <span className="placa-viva__ranura placa-viva__ranura--categoria" data-llena={categoria ? 'si' : undefined}>
          {categoria ? (
            <>
              <span className="placa-viva__clave">{categoria.clave}</span>
              {categoria.nombre}
            </>
          ) : (
            'Tu categoría'
          )}
        </span>

        <span
          className="placa-viva__ranura placa-viva__ranura--datos"
          data-llena={rutaCapturada ? 'si' : undefined}
        >
          {rutaCapturada ? lineaRuta : 'Ruta y bicicleta'}
        </span>

        <span className="placa-viva__ranura placa-viva__ranura--datos" data-llena={lineaKit !== '' ? 'si' : undefined}>
          {lineaKit !== '' ? lineaKit : 'Tu kit'}
          {precioKit !== null ? <span className="placa-viva__precio"> ${precioKit}</span> : null}
        </span>
      </div>
      <figcaption className="placa-viva__pie">
        Tu número se asigna cuando recoges tu kit.
      </figcaption>
    </figure>
  )
}
