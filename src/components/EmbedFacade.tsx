import { useEmbedFacade } from '../hooks/useEmbedFacade'

/** Fachada de embed: portada estática hasta el primer clic (Komoot / YouTube). */
export function EmbedFacade({
  src,
  titulo,
  etiqueta,
  imagen,
  alto = 460,
}: {
  src: string
  titulo: string
  etiqueta?: string
  imagen?: string
  alto?: number
}) {
  const { cargado, cargar } = useEmbedFacade()
  return (
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
            Cargar mapa
          </button>
        </>
      )}
    </div>
  )
}
