import { useEmbedFacade } from '../hooks/useEmbedFacade'

/**
 * Fachada de embed: portada estática hasta el primer clic (Komoot / YouTube).
 * El <iframe> no existe en el primer render, así que no hay petición a terceros
 * al abrir la página.
 */
export function EmbedFacade({
  src,
  titulo,
  etiqueta,
  imagen,
  alto = 460,
  textoBoton = 'Cargar mapa',
  pie,
}: {
  src: string
  titulo: string
  etiqueta?: string
  imagen?: string
  alto?: number
  textoBoton?: string
  /** Pie en monoespaciada bajo la ventana (p. ej. "SALIDA · TERCERA EDICIÓN"). */
  pie?: string
}) {
  const { cargado, cargar } = useEmbedFacade()
  const ventana = (
    <div className="facade" style={imagen ? { backgroundImage: `url("${imagen}")` } : undefined}>
      {cargado ? (
        <iframe
          src={src}
          title={titulo}
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ height: alto }}
        />
      ) : (
        <>
          {etiqueta ? <span className="facade__nota">{etiqueta}</span> : null}
          <button className="boton boton--linea" type="button" onClick={cargar}>
            {textoBoton}
          </button>
        </>
      )}
    </div>
  )

  if (!pie) return ventana
  return (
    <figure className="ventana">
      {ventana}
      <figcaption className="ventana__pie">{pie}</figcaption>
    </figure>
  )
}
