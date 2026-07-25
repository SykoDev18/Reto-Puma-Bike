import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { EntradaIndice } from '../types/resultados'
import { buscar, contarCoincidencias, ROTULO_ESTADO } from '../lib/resultados'

const LIMITE = 8
const ESPERA_MS = 150

/**
 * Un solo campo: nombre parcial o dorsal, sin distinguir mayúsculas ni acentos.
 *
 * El texto que se escribe vive AQUÍ y no sube a la página: por eso teclear no
 * re-renderiza los podios ni las filas de la tabla. Lo único que sube es la
 * entrada elegida, que es un evento discreto.
 */
export function BuscadorResultados({
  indice,
  onElegir,
}: {
  indice: readonly EntradaIndice[]
  onElegir: (entrada: EntradaIndice) => void
}) {
  const [texto, setTexto] = useState('')
  const [consulta, setConsulta] = useState('')
  const idCampo = useId()
  const idLista = `${idCampo}-lista`
  const campoRef = useRef<HTMLInputElement>(null)

  // Debounce: el índice tiene 781 entradas y no hace falta recorrerlo por tecla.
  useEffect(() => {
    const id = window.setTimeout(() => setConsulta(texto), ESPERA_MS)
    return () => window.clearTimeout(id)
  }, [texto])

  const sugerencias = useMemo(() => buscar(indice, consulta, LIMITE), [indice, consulta])
  const total = useMemo(() => contarCoincidencias(indice, consulta), [indice, consulta])

  const hayConsulta = consulta.trim() !== ''
  const sobran = total - sugerencias.length

  const elegir = (entrada: EntradaIndice) => {
    onElegir(entrada)
    setTexto('')
    setConsulta('')
    campoRef.current?.blur()
  }

  return (
    <div className="buscador">
      <label className="buscador__rot" htmlFor={idCampo}>
        Busca tu resultado
      </label>
      <input
        id={idCampo}
        ref={campoRef}
        className="buscador__campo"
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Tu nombre o tu dorsal"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        role="combobox"
        aria-expanded={hayConsulta}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-describedby={`${idCampo}-ayuda`}
      />
      <p className="buscador__ayuda" id={`${idCampo}-ayuda`}>
        Escribe parte de tu nombre —con o sin acentos— o el número de tu dorsal.
      </p>

      {/* aria-live: quien usa lector de pantalla se entera de cuántas hay. */}
      <p className="visually-hidden" role="status">
        {hayConsulta ? `${total} coincidencias` : ''}
      </p>

      {hayConsulta ? (
        total === 0 ? (
          <p className="buscador__vacio serif">
            No encontramos a nadie con «{consulta}». Revisa cómo viene escrito en tu dorsal, o
            búscate por número. Si tu categoría es infantil, todavía no está publicada.
          </p>
        ) : (
          <>
            {/* NUNCA se elige por el usuario: si hay varias, se muestran todas
                con dorsal y categoría y él escoge. Hay nombres repetidos con
                dorsales distintos y hasta dorsales repetidos. */}
            <ul className="sugerencias" id={idLista} role="listbox" aria-label="Coincidencias">
              {sugerencias.map((entrada) => (
                <li key={entrada.n} role="option" aria-selected={false}>
                  <button className="sugerencia" type="button" onClick={() => elegir(entrada)}>
                    <span className="sugerencia__dorsal dato">{entrada.dorsal}</span>
                    <span className="sugerencia__cuerpo">
                      <b className="sugerencia__nombre">{entrada.nombre}</b>
                      <span className="sugerencia__meta">
                        {entrada.categoriaNombre} · {entrada.ruta} km ·{' '}
                        {ROTULO_ESTADO[entrada.corredor.estado]}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {sobran > 0 ? (
              <p className="buscador__mas">
                Hay {total} coincidencias. Escribe un poco más para ver las {sobran} restantes.
              </p>
            ) : null}
          </>
        )
      ) : null}
    </div>
  )
}
