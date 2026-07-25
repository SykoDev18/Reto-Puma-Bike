import { useState } from 'react'
import type { CategoriaResultado } from '../types/resultados'
import { aCSV, BOM_UTF8 } from '../lib/resultados'
import { CONFIG } from '../data/config'

const nf = new Intl.NumberFormat('es-MX')

function descargar(categorias: readonly CategoriaResultado[], sufijo: string): void {
  // El BOM va PRIMERO. Sin él, Excel en español abre "Hernández" como
  // "HernÃ¡ndez", y en estos datos hay Hernández, Olguín, Muñoz y Zúñiga.
  const blob = new Blob([BOM_UTF8, aCSV(categorias)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `reto-puma-bike-${CONFIG.anioEvento}-resultados${sufijo}.csv`
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

/**
 * CSV armado en el cliente desde el JSON ya cargado: sin red y sin backend.
 * Los dos botones dicen exactamente qué exportan — si hay una categoría abierta,
 * el primero baja SOLO esa y lo declara en su propia etiqueta.
 */
export function DescargaCSV({
  todas,
  activa,
}: {
  todas: readonly CategoriaResultado[]
  activa: CategoriaResultado | null
}) {
  const [error, setError] = useState<string | null>(null)
  const total = todas.reduce((suma, c) => suma + c.corredores.length, 0)

  const intentar = (categorias: readonly CategoriaResultado[], sufijo: string) => {
    setError(null)
    try {
      descargar(categorias, sufijo)
    } catch {
      setError('Este navegador no dejó guardar el archivo. Intenta desde otro.')
    }
  }

  return (
    <div className="csv">
      {activa === null ? null : (
        <button
          className="boton boton--linea"
          type="button"
          onClick={() => intentar([activa], `-${activa.id}`)}
        >
          Descargar {activa.nombre} · {activa.ruta} km ({activa.corredores.length})
        </button>
      )}
      <button className="boton boton--linea" type="button" onClick={() => intentar(todas, '')}>
        Descargar las {todas.length} categorías ({nf.format(total)} corredores)
      </button>
      <p className="csv__nota medida serif">
        Archivo separado por comas, con la columna de estado y codificación UTF-8 con BOM: abre
        directo en Excel en español, con los acentos correctos.
      </p>
      {error === null ? null : (
        <p className="campo__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
