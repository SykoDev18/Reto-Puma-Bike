// Tarjeta de finisher: se dibuja en un <canvas> y se exporta a PNG. Sin
// html2canvas, sin servidor y sin dependencias — funciona sin conexión.
//
// Formato 4:5 (1080x1350): es el que WhatsApp y las historias de Instagram no
// recortan. Es la pieza que va a circular por Actopan, así que se diseña como
// pieza terminada, no como captura de pantalla.

export interface DatosTarjeta {
  dorsal: number
  nombre: string
  categoria: string
  ruta: string
  /** `null` cuando el estado es SIN_TIEMPO: se imprime "TIEMPO NO REGISTRADO". */
  tiempo: string | null
  posicion: number | null
  totalCategoria: number
  edicion: string
  anio: number
  sede: string
}

const ANCHO = 1080
const ALTO = 1350

/** Paleta leída de los tokens: cero hex fuera de `tokens.css`, también aquí. */
interface Paleta {
  noche: string
  carbon: string
  borde: string
  cal: string
  tepetate: string
  oro: string
  crono: string
}

// Respaldo solo por si el canvas se dibujara antes de que exista el CSS (no
// debería pasar: la página ya está pintada cuando el usuario pide la tarjeta).
const RESPALDO: Paleta = {
  noche: 'rgb(18,16,13)',
  carbon: 'rgb(28,25,21)',
  borde: 'rgb(43,38,32)',
  cal: 'rgb(244,239,229)',
  tepetate: 'rgb(201,179,146)',
  oro: 'rgb(212,160,42)',
  crono: 'rgb(78,195,217)',
}

function leerPaleta(): Paleta {
  if (typeof document === 'undefined') return RESPALDO
  const estilos = getComputedStyle(document.documentElement)
  const token = (nombre: string, respaldo: string): string => {
    const valor = estilos.getPropertyValue(nombre).trim()
    return valor === '' ? respaldo : valor
  }
  return {
    noche: token('--noche', RESPALDO.noche),
    carbon: token('--carbon', RESPALDO.carbon),
    borde: token('--borde', RESPALDO.borde),
    cal: token('--cal', RESPALDO.cal),
    tepetate: token('--tepetate', RESPALDO.tepetate),
    oro: token('--oro-puma', RESPALDO.oro),
    crono: token('--crono', RESPALDO.crono),
  }
}

// ---------------------------------------------------------------------------
// Tipografía
// ---------------------------------------------------------------------------

const DISPLAY = "'Anybody', 'Arial Narrow', sans-serif"
const DATOS = "'Martian Mono', 'Consolas', monospace"
const SERIF = "'Source Serif 4', Georgia, serif"

/**
 * El canvas dibuja con la fuente que haya CARGADA en ese momento: si no se
 * espera, sale Arial. `document.fonts.ready` resuelve cuando terminaron las
 * cargas en curso, y `load()` fuerza las tres familias por si alguna no se usó
 * todavía en la página. Si algo falla, los respaldos del sistema ya están en la
 * cadena de `font-family` y la tarjeta sigue saliendo legible.
 */
export async function esperarFuentes(): Promise<void> {
  if (typeof document === 'undefined' || document.fonts === undefined) return
  const familias = ['700 64px Anybody', '800 72px "Martian Mono"', '400 28px "Source Serif 4"']
  await Promise.all(familias.map((f) => document.fonts.load(f).catch(() => [])))
  await document.fonts.ready
}

/**
 * `font-stretch` dentro de `ctx.font` no está soportado en todos los motores.
 * Se aplica por la propiedad dedicada cuando existe y si no, la variable se
 * dibuja en su ancho normal: cambia el aire, no la legibilidad.
 */
function ancho(ctx: CanvasRenderingContext2D, valor: 'condensed' | 'normal' | 'expanded'): void {
  if ('fontStretch' in ctx) ctx.fontStretch = valor
}

function espaciado(ctx: CanvasRenderingContext2D, px: number): void {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`
}

/** Reduce el tamaño hasta que el texto quepa en `maxAncho`. */
function ajustar(
  ctx: CanvasRenderingContext2D,
  texto: string,
  familia: string,
  peso: number,
  tamInicial: number,
  maxAncho: number,
  tamMinimo = 22,
): number {
  let tam = tamInicial
  ctx.font = `${peso} ${tam}px ${familia}`
  while (ctx.measureText(texto).width > maxAncho && tam > tamMinimo) {
    tam -= 2
    ctx.font = `${peso} ${tam}px ${familia}`
  }
  return tam
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

/** La placa de dorsal, igual que el componente: cal, borde grueso, 2 perforaciones. */
function dibujarPlaca(
  ctx: CanvasRenderingContext2D,
  paleta: Paleta,
  dorsal: number,
  centroX: number,
  arriba: number,
): number {
  const texto = String(dorsal)
  ctx.save()
  espaciado(ctx, -4)
  const tamNumero = ajustar(ctx, texto, DATOS, 800, 132, 380, 80)
  const anchoPlaca = Math.max(300, ctx.measureText(texto).width + 110)
  const altoPlaca = 254
  const x = centroX - anchoPlaca / 2

  // Cuerpo. Radio 2px, como toda la interfaz.
  ctx.fillStyle = paleta.cal
  ctx.strokeStyle = paleta.noche
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.roundRect(x, arriba, anchoPlaca, altoPlaca, 2)
  ctx.fill()
  ctx.stroke()

  // Las dos perforaciones del manubrio.
  ctx.fillStyle = paleta.noche
  for (const dx of [-46, 46]) {
    ctx.beginPath()
    ctx.arc(centroX + dx, arriba + 38, 15, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.font = `800 ${tamNumero}px ${DATOS}`
  ctx.fillStyle = paleta.noche
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Centro desplazado hacia abajo: las perforaciones ocupan la franja de arriba.
  ctx.fillText(texto, centroX, arriba + altoPlaca / 2 + 34)
  ctx.restore()

  return arriba + altoPlaca
}

/** Huella de puma, el mismo trazo que el SVG del riel. */
function dibujarHuella(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  tam: number,
): void {
  const e = tam / 100
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(e, e)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(50, 74, 25, 18, 0, 0, Math.PI * 2)
  ctx.fill()
  const dedos: Array<[number, number, number, number]> = [
    [21, 47, 8, 12],
    [39, 33, 8.5, 13.5],
    [61, 33, 8.5, 13.5],
    [79, 47, 8, 12],
  ]
  for (const [cx, cy, rx, ry] of dedos) {
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function regla(ctx: CanvasRenderingContext2D, color: string, y: number, x1: number, x2: number) {
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
}

// ---------------------------------------------------------------------------
// La tarjeta
// ---------------------------------------------------------------------------

/**
 * Dibuja la tarjeta completa. Llama antes a `esperarFuentes()`: sin eso el
 * canvas usa la fuente de respaldo del sistema.
 */
export function dibujarTarjeta(canvas: HTMLCanvasElement, datos: DatosTarjeta): void {
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('El navegador no permitió dibujar la tarjeta')

  const p = leerPaleta()
  canvas.width = ANCHO
  canvas.height = ALTO

  const centro = ANCHO / 2
  const margen = 84

  // ---- Fondo: noche con un marco de 1px, como las secciones del sitio -----
  ctx.fillStyle = p.noche
  ctx.fillRect(0, 0, ANCHO, ALTO)
  ctx.strokeStyle = p.borde
  ctx.lineWidth = 4
  ctx.strokeRect(30, 30, ANCHO - 60, ALTO - 60)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // ---- Cabecera -----------------------------------------------------------
  ancho(ctx, 'expanded')
  espaciado(ctx, 2)
  const tamMarca = ajustar(ctx, 'RETO PUMA BIKE', DISPLAY, 800, 74, ANCHO - margen * 2)
  ctx.font = `800 ${tamMarca}px ${DISPLAY}`
  ctx.fillStyle = p.cal
  ctx.fillText('RETO PUMA BIKE', centro, 168)

  ancho(ctx, 'condensed')
  espaciado(ctx, 8)
  ctx.font = `700 26px ${DISPLAY}`
  ctx.fillStyle = p.tepetate
  ctx.fillText(`${datos.edicion.toUpperCase()} · ${datos.anio}`, centro, 214)
  espaciado(ctx, 0)
  ancho(ctx, 'normal')

  regla(ctx, p.borde, 252, margen, ANCHO - margen)

  // ---- Placa sellada ------------------------------------------------------
  const finPlaca = dibujarPlaca(ctx, p, datos.dorsal, centro, 322)

  // ---- Identidad ----------------------------------------------------------
  ctx.textBaseline = 'alphabetic'
  ancho(ctx, 'normal')
  const nombre = datos.nombre.toUpperCase()
  const tamNombre = ajustar(ctx, nombre, DISPLAY, 800, 62, ANCHO - margen * 2, 26)
  ctx.font = `800 ${tamNombre}px ${DISPLAY}`
  ctx.fillStyle = p.cal
  ctx.fillText(nombre, centro, finPlaca + 116)

  ancho(ctx, 'condensed')
  espaciado(ctx, 4)
  const linea = `${datos.categoria} · ${datos.ruta} KM`
  const tamCat = ajustar(ctx, linea, DISPLAY, 700, 30, ANCHO - margen * 2, 18)
  ctx.font = `700 ${tamCat}px ${DISPLAY}`
  ctx.fillStyle = p.tepetate
  ctx.fillText(linea, centro, finPlaca + 166)
  espaciado(ctx, 0)
  ancho(ctx, 'normal')

  regla(ctx, p.borde, finPlaca + 222, margen, ANCHO - margen)

  // ---- El dato: tiempo en --crono, grande, sin truncar centésimas ---------
  const yTiempo = finPlaca + 356
  if (datos.tiempo === null) {
    // SIN_TIEMPO: se dice, no se disimula. La posición sí se muestra abajo.
    ancho(ctx, 'condensed')
    espaciado(ctx, 6)
    const tamAviso = ajustar(ctx, 'TIEMPO NO REGISTRADO', DISPLAY, 700, 40, ANCHO - margen * 2, 22)
    ctx.font = `700 ${tamAviso}px ${DISPLAY}`
    ctx.fillStyle = p.tepetate
    ctx.fillText('TIEMPO NO REGISTRADO', centro, yTiempo)
    espaciado(ctx, 0)
    ancho(ctx, 'normal')
  } else {
    espaciado(ctx, -3)
    const tamTiempo = ajustar(ctx, datos.tiempo, DATOS, 700, 100, ANCHO - margen * 2, 40)
    ctx.font = `700 ${tamTiempo}px ${DATOS}`
    ctx.fillStyle = p.crono
    ctx.fillText(datos.tiempo, centro, yTiempo)
    espaciado(ctx, 0)
  }

  // ---- Posición -----------------------------------------------------------
  if (datos.posicion !== null) {
    espaciado(ctx, 1)
    ctx.font = `700 38px ${DATOS}`
    ctx.fillStyle = p.cal
    ctx.fillText(
      `${datos.posicion}º de ${datos.totalCategoria} · ${datos.ruta} KM`,
      centro,
      yTiempo + 84,
    )
    espaciado(ctx, 0)
  }

  // ---- Pie ----------------------------------------------------------------
  regla(ctx, p.borde, ALTO - 236, margen, ANCHO - margen)

  ancho(ctx, 'condensed')
  espaciado(ctx, 10)
  ctx.font = `700 26px ${DISPLAY}`
  ctx.fillStyle = p.tepetate
  ctx.fillText(datos.sede.toUpperCase(), centro, ALTO - 178)
  espaciado(ctx, 0)
  ancho(ctx, 'normal')

  // Tres huellas: la firma del roadbook. Es el único adorno de la pieza.
  const huella = 46
  for (let i = 0; i < 3; i += 1) {
    dibujarHuella(ctx, p.borde, centro - huella * 1.9 + i * huella * 1.5, ALTO - 140, huella)
  }

  ctx.font = `400 22px ${SERIF}`
  ctx.fillStyle = p.tepetate
  ctx.fillText('retopumabike · Valle del Mezquital', centro, ALTO - 62)
}

/** Nombre del archivo que baja al teléfono. */
export function nombreArchivoTarjeta(datos: DatosTarjeta): string {
  return `reto-puma-bike-${datos.anio}-dorsal-${datos.dorsal}.png`
}

/**
 * Dibuja y descarga el PNG. El canvas se crea AQUÍ, cuando el usuario pide la
 * tarjeta: no existe en el render inicial de la página.
 */
export async function descargarTarjeta(datos: DatosTarjeta): Promise<void> {
  await esperarFuentes()
  const canvas = document.createElement('canvas')
  dibujarTarjeta(canvas, datos)

  const blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, 'image/png'))
  if (blob === null) throw new Error('No se pudo generar la imagen de la tarjeta')

  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivoTarjeta(datos)
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
