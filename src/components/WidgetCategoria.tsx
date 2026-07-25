import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Categoria, Sexo } from '../types/roadbook'
import { CONFIG, urlWhatsApp } from '../data/config'
import { categoriasElegibles, edadNominal } from '../lib/categorias'
import { PlacaDorsal } from './PlacaDorsal'
import { plural } from '../lib/texto'

export interface ResultadoWidget {
  edad: number | null
  sexo: Sexo | ''
  recomendada: Categoria | null
  alternativas: Categoria[]
  /** true cuando hay edad y rama válidas pero NO existe categoría por edad. */
  sinCategoriaPorEdad: boolean
}

/**
 * "¿Cuál me toca?": los dos campos y el motor puro de categorías.
 * ÚNICO widget del proyecto: el Inicio lo usa en variante 'compacto' y la
 * página de Categorías en 'completo'. No hay una segunda copia.
 *
 * Nunca disfraza un hueco de los datos: si no hay categoría por edad para esa
 * combinación (el caso femenil 16-18), lo dice y ofrece las abiertas.
 */
export function WidgetCategoria({
  variante = 'compacto',
  onResultado,
}: {
  variante?: 'compacto' | 'completo'
  onResultado?: (resultado: ResultadoWidget) => void
}) {
  const [fecha, setFecha] = useState('')
  const [sexo, setSexo] = useState<Sexo | ''>('')
  const idFecha = useId()
  const idSexo = useId()

  const edad = useMemo(() => (fecha ? edadNominal(fecha, CONFIG.anioEvento) : null), [fecha])
  const elegibles = useMemo(
    () => (edad !== null && sexo !== '' ? categoriasElegibles({ edadNominal: edad, sexo }) : null),
    [edad, sexo],
  )

  const incompleto = edad === null || sexo === ''
  const fueraDeRango = edad !== null && (edad < 3 || edad > 99)
  const recomendada = elegibles?.recomendada ?? null
  const alternativas = elegibles?.alternativas ?? []
  const sinCategoriaPorEdad =
    !incompleto && !fueraDeRango && recomendada === null && alternativas.length > 0

  // Avisa al contenedor (la página de Categorías resalta el eje con esto).
  // onResultado vive en un ref para que su identidad no vuelva a disparar el
  // efecto, y las dependencias son solo valores estables (`elegibles` está
  // memoizado): así no hay bucle de renders.
  const onResultadoRef = useRef(onResultado)
  onResultadoRef.current = onResultado
  useEffect(() => {
    const rec = elegibles?.recomendada ?? null
    const alts = elegibles?.alternativas ?? []
    onResultadoRef.current?.({
      edad,
      sexo,
      recomendada: rec,
      alternativas: alts,
      sinCategoriaPorEdad: rec === null && alts.length > 0,
    })
  }, [edad, sexo, elegibles])

  const ramaTexto = sexo === 'F' ? 'Femenil' : 'Varonil'
  const mensajeWa = `Hola, tengo ${edad ?? '__'} años para ${CONFIG.anioEvento} (rama ${ramaTexto.toLowerCase()}) y quiero saber en qué categoría me toca competir.`

  return (
    <div className={variante === 'completo' ? 'widget widget--completo' : 'widget'}>
      <div className="widget__campos">
        <div className="campo">
          <label className="campo__rot" htmlFor={idFecha}>
            Fecha de nacimiento
          </label>
          <input
            id={idFecha}
            className="campo__input"
            type="date"
            value={fecha}
            min="1926-01-01"
            max={`${CONFIG.anioEvento - 3}-12-31`}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>

        <div className="campo">
          <span className="campo__rot" id={idSexo}>
            Rama
          </span>
          <div className="selector" role="group" aria-labelledby={idSexo}>
            <button type="button" aria-pressed={sexo === 'M'} onClick={() => setSexo('M')}>
              Varonil
            </button>
            <button type="button" aria-pressed={sexo === 'F'} onClick={() => setSexo('F')}>
              Femenil
            </button>
          </div>
        </div>
      </div>

      <div className="widget__salida" aria-live="polite">
        {incompleto ? (
          <p className="medida serif widget__pista">
            Escribe tu fecha de nacimiento y elige rama para ver la categoría que te toca.
          </p>
        ) : fueraDeRango ? (
          <p className="medida serif widget__pista">
            El reto admite de 3 a 99 años. Escríbenos y te ubicamos.
          </p>
        ) : recomendada ? (
          <>
            <PlacaDorsal numero={recomendada.clave} etiqueta="clave" variante="placa--clave" />
            <div className="widget__detalle">
              <p className="widget__nombre">{recomendada.nombre}</p>
              <p className="medida serif">
                Tu edad para {CONFIG.anioEvento} es <span className="cifra">{edad}</span> años, por
                eso te toca {recomendada.nombre}. Se calcula con tu año de nacimiento, no con tu
                cumpleaños.
              </p>
              <p className="medida serif widget__meta">
                {recomendada.grupo} · {recomendada.descripcionEdad} ·{' '}
                <span className="cifra">{recomendada.vueltas}</span>{' '}
                {plural(recomendada.vueltas, 'vuelta')}
              </p>
              <a className="boton boton--linea" href={`#/inscripciones?categoria=${recomendada.id}`}>
                Inscribirme en esta categoría
              </a>
            </div>
          </>
        ) : sinCategoriaPorEdad ? (
          // EL HUECO DE LOS DATOS, sin maquillar (femenil 16-18).
          <div className="widget__detalle widget__detalle--hueco">
            <p className="widget__nombre">Sin categoría por edad</p>
            <p className="medida serif">
              Para <span className="cifra">{edad}</span> años en rama {ramaTexto.toLowerCase()} no
              existe una categoría por edad en esta edición. Puedes competir en:
            </p>
            <ul className="widget__alternativas">
              {alternativas.map((alt) => (
                <li key={alt.id}>
                  <PlacaDorsal numero={alt.clave} etiqueta="clave" variante="placa--clave" />
                  <span>
                    <b>{alt.nombre}</b>
                    <span className="medida"> · {alt.descripcionEdad}</span>
                  </span>
                  <a className="enlace-duro" href={`#/inscripciones?categoria=${alt.id}`}>
                    Inscribirme
                  </a>
                </li>
              ))}
            </ul>
            <a
              className="enlace-duro"
              href={urlWhatsApp(mensajeWa)}
              target="_blank"
              rel="noreferrer"
            >
              Preguntar al comité por WhatsApp
            </a>
          </div>
        ) : (
          <div className="widget__detalle">
            <p className="medida serif">
              No encontramos una categoría automática para ese perfil.
            </p>
            <a
              className="enlace-duro"
              href={urlWhatsApp(mensajeWa)}
              target="_blank"
              rel="noreferrer"
            >
              Preguntar al comité por WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
