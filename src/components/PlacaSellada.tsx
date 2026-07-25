import { useState } from 'react'
import type { CategoriaResultado, EntradaIndice } from '../types/resultados'
import { CONFIG, urlWhatsApp } from '../data/config'
import { diferenciaConPrimero, ordinal, permiteTarjeta, tiempoDelPrimero } from '../lib/resultados'
import { descargarTarjeta } from '../lib/tarjeta'
import { PlacaDorsal } from './PlacaDorsal'

const MENSAJE_QUINTA = `Hola, quiero que me avisen cuando abran las inscripciones de la 5ª edición del ${CONFIG.evento}.`

/**
 * LA PLACA SELLADA. Es el mismo componente <PlacaDorsal> que en Inscripciones se
 * construye con el número en `---`: aquí llega con dorsal real, posición y
 * tiempo. Buscar tu nombre no devuelve una fila de tabla, devuelve tu placa
 * terminada — el cierre del roadbook.
 */
export function PlacaSellada({
  entrada,
  categoria,
  onVerCategoria,
}: {
  entrada: EntradaIndice
  categoria: CategoriaResultado
  onVerCategoria: () => void
}) {
  const [generando, setGenerando] = useState(false)
  const [errorTarjeta, setErrorTarjeta] = useState<string | null>(null)

  const c = entrada.corredor
  const base = tiempoDelPrimero(categoria)
  const diferencia = diferenciaConPrimero(c, base)
  const total = categoria.corredores.length
  const esDNF = c.estado === 'DNF' || c.estado === 'DNS' || c.estado === 'DSQ'
  const enRevision = c.estado === 'REVISION'

  const bajarTarjeta = async () => {
    setGenerando(true)
    setErrorTarjeta(null)
    try {
      await descargarTarjeta({
        dorsal: c.dorsal,
        nombre: c.nombre,
        categoria: categoria.nombre,
        ruta: categoria.ruta,
        tiempo: c.tiempo,
        posicion: c.posicion,
        totalCategoria: total,
        edicion: CONFIG.edicion,
        anio: CONFIG.anioEvento,
        sede: CONFIG.sede,
      })
    } catch {
      setErrorTarjeta('No se pudo generar la imagen en este navegador. Intenta desde otro.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <article className="sellada" data-estado={c.estado}>
      <div className="sellada__placa">
        <PlacaDorsal numero={c.dorsal} etiqueta="dorsal" variante="placa--grande" />
      </div>

      <div className="sellada__cuerpo">
        <h3 className="sellada__nombre">{c.nombre}</h3>
        <p className="sellada__categoria">
          {categoria.nombre} · <span className="dato">{categoria.ruta}</span> km
          {categoria.clave_provisional ? (
            <span className="flag" title="Categoría fuera del catálogo del sistema">
              clave provisional
            </span>
          ) : null}
        </p>

        {esDNF ? (
          /* Un DNF se muestra con dignidad: sin posición, sin tiempo, en
             --tepetate. Una línea, seca y cálida. Nada de épica. */
          <div className="sellada__dnf">
            <p className="serif">
              No terminaste esta edición. Ahí estuviste, y eso ya es más de lo que la mayoría
              intenta. Te esperamos en la quinta.
            </p>
            <a
              className="boton boton--linea"
              href={urlWhatsApp(MENSAJE_QUINTA)}
              target="_blank"
              rel="noreferrer"
            >
              Avísenme de la quinta
            </a>
          </div>
        ) : (
          <>
            <dl className="sellada__lectura">
              <div className="sellada__dato">
                <dt>Posición</dt>
                <dd>
                  {c.posicion === null ? (
                    <span className="sellada__vacio">—</span>
                  ) : (
                    <>
                      <span className="dato sellada__posicion">{ordinal(c.posicion)}</span>
                      <span className="sellada__de">de {total}</span>
                    </>
                  )}
                </dd>
              </div>
              <div className="sellada__dato">
                <dt>Tiempo</dt>
                <dd>
                  {c.tiempo === null ? (
                    <span className="sellada__vacio">—</span>
                  ) : (
                    <span className="dato sellada__tiempo">{c.tiempo}</span>
                  )}
                </dd>
              </div>
              <div className="sellada__dato">
                <dt>Con el 1º</dt>
                <dd>
                  {diferencia === null ? (
                    <span className="sellada__vacio">—</span>
                  ) : (
                    <span className="dato sellada__dif">{diferencia}</span>
                  )}
                </dd>
              </div>
              <div className="sellada__dato">
                <dt>Vueltas</dt>
                <dd>
                  <span className="dato">
                    {c.vueltas_hechas}/{c.vueltas_totales}
                  </span>
                </dd>
              </div>
            </dl>

            {c.nota ? (
              <p className={enRevision ? 'sellada__nota sellada__nota--revision' : 'sellada__nota'}>
                {c.nota}
              </p>
            ) : null}

            {enRevision ? (
              /* No se reparte una tarjeta de un dato que va a cambiar. */
              <p className="sellada__sin-tarjeta serif">
                Tu resultado está en revisión por el comité. En cuanto se confirme podrás
                descargarlo.
              </p>
            ) : permiteTarjeta(c.estado) ? (
              <div className="sellada__acciones">
                <button
                  className="boton boton--linea"
                  type="button"
                  onClick={bajarTarjeta}
                  disabled={generando}
                >
                  {generando ? 'Generando…' : 'Descargar mi resultado'}
                </button>
                {errorTarjeta === null ? null : (
                  <p className="campo__error" role="alert">
                    {errorTarjeta}
                  </p>
                )}
              </div>
            ) : null}
          </>
        )}

        <button className="enlace-duro sellada__ir" type="button" onClick={onVerCategoria}>
          Ver mi categoría completa
        </button>
      </div>
    </article>
  )
}
