// Patrocinadores: los logos reales viven en src/assets/Patrocinadores*.
// Se resuelven con import.meta.glob (nativo de Vite, sin dependencias nuevas).
//
// SUPUESTO: no existe un mapeo oficial archivo -> nombre comercial. Los nombres
// de abajo se derivaron del nombre de archivo cruzándolo con la lista del comité;
// los que no se pudieron confirmar quedan con el nombre del archivo "prettificado".
// SUPUESTO: los 8 marcados como principales están por confirmar con el comité
// (la dirección pide mostrar primero y más grandes a los ocho principales).

export interface Patrocinador {
  slug: string
  nombre: string
  logo: string
  principal: boolean
}

/** Nombres confirmados o muy probables, por nombre de archivo (sin extensión). */
const NOMBRES: Record<string, string> = {
  ahc: 'Asociación de Ciclismo del Estado de Hidalgo',
  CVM: 'Ciclismo y Atletismo Valle del Mezquital',
  Valle: 'Valle del Mezquital',
  diamante: 'Diamante Pinturas Actopan',
  logomagdalena: 'Farmacia Magdalena',
  logopillos: "Pillo's Bike MTB",
  sannicolas: 'Pastes San Nicolás',
  Ninis: 'Club Ciclista Ninis',
  'logo perez': 'Taller Pérez',
  'logo farmaymás': 'Farma y Más',
  logoGORDOBIKEPNG: 'Gordo Bike',
  logoagustinos: 'Agustinos',
  logoboxthas: 'Boxthás',
  logonora: 'Nora',
  logosubaru: 'Subaru',
  logoimportane: 'Importane',
  delatostada: 'De la Tostada',
  Donchon: 'Don Chon',
  DrSalinas: 'Dr. Salinas',
  DrSalvador: 'Dr. Salvador',
  Frailes: 'Los Frailes',
  Mariscos: 'Mariscos',
  SraLeo: 'Sra. Leo',
  ALTARA: 'Altara',
  Axelne: 'Axelne',
  PEIK: 'PEIK',
  ala: 'Ala',
  daxi: 'Daxi',
  diente: 'Diente',
  kira: 'Kira',
  yolo: 'Yolo',
  CL: 'CL',
}

/** SUPUESTO: selección de principales pendiente de confirmar. */
const PRINCIPALES = new Set([
  'ahc',
  'CVM',
  'Donchon',
  'diamante',
  'logomagdalena',
  'logopillos',
  'sannicolas',
  'logoGORDOBIKEPNG',
])

const modulos: Record<string, unknown> = import.meta.glob(
  '../assets/Patrocinadores*/*.webp',
  { eager: true, query: '?url', import: 'default' },
)

const nombreArchivo = (ruta: string): string => {
  const ultimo = ruta.split('/').pop() ?? ruta
  return ultimo.replace(/\.webp$/i, '')
}

/** Prettifica un nombre de archivo sin mapeo: "logoNoraBike" -> "Nora Bike". */
const prettificar = (base: string): string => {
  const limpio = base.replace(/^logo[\s_-]?/i, '').replace(/PNG$/i, '')
  const separado = limpio.replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2').replace(/[_-]+/g, ' ')
  const texto = separado.trim() || base
  return texto.charAt(0).toLocaleUpperCase('es-MX') + texto.slice(1)
}

// Validación en el borde: import.meta.glob devuelve `unknown`; solo aceptamos
// entradas cuya URL sea realmente una cadena.
export const PATROCINADORES: Patrocinador[] = Object.entries(modulos)
  .flatMap(([ruta, url]) => {
    if (typeof url !== 'string') return []
    const base = nombreArchivo(ruta)
    const patrocinador: Patrocinador = {
      slug: base.toLocaleLowerCase('es-MX').replace(/[^a-z0-9]+/g, '-'),
      nombre: NOMBRES[base] ?? prettificar(base),
      logo: url,
      principal: PRINCIPALES.has(base),
    }
    return [patrocinador]
  })
  // Principales primero; dentro de cada grupo, alfabético es-MX.
  .sort((a, b) => {
    if (a.principal !== b.principal) return a.principal ? -1 : 1
    return a.nombre.localeCompare(b.nombre, 'es-MX')
  })
