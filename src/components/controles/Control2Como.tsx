import type { CampoFormulario, DatosFormulario, ErroresFormulario, RutaElegida } from '../../types/registro'
import type { Categoria, ResultadoElegibilidad, TipoBicicleta } from '../../types/roadbook'
import { CONFIG, urlWhatsApp } from '../../data/config'
import { MAPA_RUTAS, NOMBRE_RUTA } from '../../data/categorias'
import { rutaEsFija } from '../../lib/registro'
import { plural } from '../../lib/texto'
import { CampoTexto } from '../CampoTexto'
import { GrupoRadio } from '../GrupoRadio'
import type { OpcionRadio } from '../GrupoRadio'

/** Por qué esta categoría: se explica con los datos reales, no con genéricos. */
function porQue(categoria: Categoria, edad: number, anioEvento: number): string {
  if (categoria.abierta) {
    if (categoria.requiereEbike) return 'Categoría de bicicleta eléctrica, sin límite de edad.'
    if (categoria.requierePeso) return `Categoría abierta para ${categoria.requierePeso} kg o más.`
    return 'Categoría abierta: no depende de tu edad.'
  }
  return `Porque tu edad para ${anioEvento} es ${edad} y esta categoría va de ${categoria.descripcionEdad.toLocaleLowerCase('es-MX')}.`
}

/** CONTROL 2 · KM 12 — Cómo compites. */
export function Control2Como({
  datos,
  errores,
  edad,
  elegibles,
  categoriaElegida,
  onCampo,
  onBlur,
}: {
  datos: DatosFormulario
  errores: ErroresFormulario
  edad: number | null
  elegibles: ResultadoElegibilidad | null
  categoriaElegida: Categoria | null
  onCampo: <C extends CampoFormulario>(campo: C, valor: DatosFormulario[C]) => void
  onBlur: (campo: CampoFormulario) => void
}) {
  const faltaBase = edad === null || datos.sexo === ''
  const recomendada = elegibles?.recomendada ?? null
  const alternativas = elegibles?.alternativas ?? []
  const sinCategoriaPorEdad = !faltaBase && recomendada === null && alternativas.length > 0
  const ramaTexto = datos.sexo === 'F' ? 'femenil' : 'varonil'

  const opciones: Array<OpcionRadio<number>> = []
  if (recomendada) {
    opciones.push({
      valor: recomendada.id,
      etiqueta: `${recomendada.clave} · ${recomendada.nombre}`,
      insignia: 'Te toca esta',
      contenido: (
        <>
          <span className="opcion__porque">{porQue(recomendada, edad ?? 0, CONFIG.anioEvento)}</span>
          <span className="opcion__meta">
            {recomendada.grupo} · <span className="cifra">{recomendada.vueltas}</span>{' '}
            {plural(recomendada.vueltas, 'vuelta')}
          </span>
        </>
      ),
    })
  }
  for (const alt of alternativas) {
    opciones.push({
      valor: alt.id,
      etiqueta: `${alt.clave} · ${alt.nombre}`,
      contenido: (
        <>
          <span className="opcion__porque">{porQue(alt, edad ?? 0, CONFIG.anioEvento)}</span>
          <span className="opcion__meta">
            {alt.grupo} · <span className="cifra">{alt.vueltas}</span>{' '}
            {plural(alt.vueltas, 'vuelta')}
          </span>
        </>
      ),
    })
  }

  // Aviso NO bloqueante: compite fuera de su grupo de edad.
  const fueraDeGrupo =
    recomendada !== null && categoriaElegida !== null && categoriaElegida.id !== recomendada.id

  const grupoElegido = categoriaElegida?.grupo ?? null
  const rutasPosibles: RutaElegida[] = grupoElegido ? MAPA_RUTAS[grupoElegido] : []
  const rutaFija = grupoElegido ? rutaEsFija(grupoElegido) : false

  return (
    <>
      <GrupoRadio<TipoBicicleta>
        nombre="tipo_bicicleta"
        leyenda="Tipo de bicicleta"
        valor={datos.tipo_bicicleta}
        error={errores.tipo_bicicleta}
        onCambio={(v) => onCampo('tipo_bicicleta', v)}
        opciones={[
          { valor: 'MTB', etiqueta: 'MTB' },
          { valor: 'E-Bike', etiqueta: 'E-Bike' },
        ]}
      />

      {datos.sexo === 'M' ? (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={datos.peso_90_mas}
            onChange={(e) => onCampo('peso_90_mas', e.target.checked)}
          />
          <span>
            Peso 90 kg o más
            <span className="checkbox__nota">
              Habilita la categoría Mamut&apos;s. Se verifica al recoger el kit.
            </span>
          </span>
        </label>
      ) : null}

      {faltaBase ? (
        <p className="aviso aviso--pista serif">
          Completa tu fecha de nacimiento y tu rama en el control anterior para ver las categorías
          que te tocan.
        </p>
      ) : sinCategoriaPorEdad ? (
        // EL HUECO DE LOS DATOS (femenil 16-18). No se esconde.
        <div className="aviso aviso--hueco">
          <p className="aviso__titulo">Sin categoría por edad</p>
          <p className="serif">
            Para <span className="cifra">{edad}</span> años en rama {ramaTexto} no existe una
            categoría por edad en esta edición. Puedes competir en las abiertas de abajo, o
            escríbenos y lo revisamos contigo.
          </p>
          <a
            className="enlace-duro"
            href={urlWhatsApp(
              `Hola, tengo ${edad} años para ${CONFIG.anioEvento} (rama ${ramaTexto}) y no encuentro categoría por edad. ¿Me ayudan?`,
            )}
            target="_blank"
            rel="noreferrer"
          >
            Preguntar al comité por WhatsApp
          </a>
        </div>
      ) : null}

      {elegibles?.soloEbike ? (
        <p className="aviso aviso--pista serif">
          Con bicicleta eléctrica solo se compite en las categorías E-Bike de tu rama, porque la
          asistencia cambia por completo la comparación de tiempos.
        </p>
      ) : null}

      {opciones.length > 0 ? (
        <GrupoRadio<number>
          nombre="categoria_id"
          leyenda="Categoría"
          valor={datos.categoria_id}
          error={errores.categoria_id}
          onCambio={(v) => onCampo('categoria_id', v)}
          variante="tarjeta"
          descripcion={
            recomendada
              ? 'La primera es la que te toca por edad. Debajo, las abiertas en las que también puedes competir.'
              : 'Categorías abiertas disponibles para tu perfil.'
          }
          opciones={opciones}
        />
      ) : null}

      {fueraDeGrupo && recomendada ? (
        <p className="aviso aviso--ojo serif">
          Vas a competir fuera de tu grupo de edad. Está permitido, pero no podrás premiar en{' '}
          {recomendada.nombre}.
        </p>
      ) : null}

      {grupoElegido ? (
        rutaFija ? (
          <p className="aviso aviso--pista serif">
            Tu ruta es <strong>{NOMBRE_RUTA[rutasPosibles[0]]}</strong>, porque corresponde a{' '}
            {grupoElegido}.
          </p>
        ) : (
          <GrupoRadio<RutaElegida>
            nombre="ruta"
            leyenda="Ruta"
            valor={datos.ruta === '' ? null : datos.ruta}
            error={errores.ruta}
            onCambio={(v) => onCampo('ruta', v)}
            descripcion={`Sugerida para ${grupoElegido}. Puedes cambiarla.`}
            opciones={rutasPosibles.map((r) => ({ valor: r, etiqueta: NOMBRE_RUTA[r] }))}
          />
        )
      ) : null}

      <CampoTexto
        etiqueta="Equipo o club"
        valor={datos.equipo}
        onCambio={(v) => onCampo('equipo', v)}
        onBlur={() => onBlur('equipo')}
        placeholder="Independiente"
        opcional
        ancho="largo"
      />
    </>
  )
}
