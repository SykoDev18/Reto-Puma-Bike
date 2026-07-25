// Fuente única de verdad del evento (portado de js/config.js, ahora tipado).
// El backend va aparte: aquí no hay lógica de red.

export type EstadoEvento = 'preevento' | 'postevento'

export interface Kit {
  nombre: string
  precio: number
  incluye: string[]
}

export interface Config {
  evento: string
  edicion: string
  numeroEdicion: string
  anioEvento: number
  /** ISO (YYYY-MM-DD). La hora de arranque se aplica en horaArranqueIso. */
  fecha: string
  fechaTexto: string
  fechaCorta: string
  horaArranque: string
  horaArranqueIso: string
  sede: string
  sedeCorta: string
  salidaMeta: string
  estado: EstadoEvento
  videoHeroId: string
  contacto: {
    email: string
    direccion: string
    /** Formato internacional sin '+', tal como lo pide wa.me. */
    whatsapp: string
    /** El mismo número, formateado para leerse en pantalla. */
    whatsappVisible: string
  }
  redes: { facebook: string; instagram: string; youtube: string }
  /**
   * Datos para recibir transferencias.
   *
   * SEGURIDAD — NO NEGOCIABLE: aquí NUNCA va un número de tarjeta, ni siquiera
   * en un comentario. Para recibir un depósito basta la CLABE; una tarjeta
   * publicada en una página indexable habilita cargos en comercios que solo
   * piden número y vencimiento. Cuenta y CLABE solo sirven para RECIBIR.
   * Por lo mismo, ninguna imagen del flyer bancario se publica: los datos van
   * como texto, que además se puede copiar.
   */
  pago: {
    banco: string
    beneficiario: string
    cuenta: string
    clabe: string
    instruccion: string
  }
  kits: Kit[]
  /**
   * Cierre de la edición que YA se corrió, para el estado 'postevento'.
   * `finishers` es `number | null`: con `null` la interfaz omite el conteo en
   * vez de publicar una cifra que no está confirmada.
   */
  edicionCorrida: {
    etiqueta: string
    finishers: number | null
    /** Categorías con resultados PUBLICADOS (no las del catálogo). */
    categoriasPublicadas: number
  }
}

export const CONFIG: Config = {
  evento: 'Reto Puma Bike',
  edicion: 'Cuarta Edición',
  numeroEdicion: '04',
  anioEvento: 2026,
  fecha: '2026-07-05',
  fechaTexto: '5 de julio, 2026',
  fechaCorta: '05.07.2026',
  horaArranque: '8:00 AM',
  // Actopan (CDMX, UTC-6). Se usa para la cuenta regresiva.
  horaArranqueIso: '2026-07-05T08:00:00-06:00',
  sede: 'Actopan, Hidalgo',
  sedeCorta: 'Actopan, Hgo.',
  salidaMeta: 'Pabellón Gastronómico',
  // La 4ª edición ya se corrió (05.07.2026). `fecha` y `anioEvento` NO cambian:
  // las edades nominales se calculan contra el año del evento, no contra hoy.
  estado: 'postevento',
  videoHeroId: 'iGJ1h3ychoo',
  contacto: {
    email: 'retopumabike@gmail.com',
    direccion: 'Libertad 1, Aviación, 42506 Actopan, Hgo.',
    whatsapp: '5217721199093',
    whatsappVisible: '772 119 9093',
  },
  redes: {
    facebook: 'https://www.facebook.com/p/RETO-PUMA-BIKE-100092370199634/',
    instagram: 'https://www.instagram.com/reto_puma_bike_',
    youtube: 'https://www.youtube.com/@RetoPumaBike-v8h',
  },
  pago: {
    banco: 'BanCoppel',
    beneficiario: 'Laura Delia Bastida González',
    cuenta: '10046851116',
    clabe: '137463100468511169',
    instruccion: 'Manda tu comprobante por WhatsApp con tu nombre completo y categoría.',
  },
  kits: [
    {
      nombre: 'Kit Huellita',
      precio: 350,
      incluye: ['Número de competidor', 'Placa para bicicleta', 'Medalla', 'Abastecimientos'],
    },
    {
      nombre: 'Kit Puma',
      precio: 750,
      incluye: [
        'Número de competidor',
        'Placa para bicicleta',
        'Medalla',
        'Abastecimientos',
        'Jersey de la edición',
      ],
    },
  ],
  // `finishers: null` a propósito. En `resultados-2026.json` hay 650 corredores
  // con tiempo publicable, pero faltan las categorías infantiles (el JSON viene
  // con `parcial: true`), así que ningún número de aquí sería el total real.
  // Con `null` la interfaz OMITE el conteo en vez de publicar una cifra falsa.
  // SUPUESTO: `categoriasPublicadas` (21) se declara aquí y no se lee del JSON
  // para que el Inicio no tenga que descargar 177 kB solo para pintar una línea.
  // Debe moverse en el mismo commit que el JSON si cambia el número.
  edicionCorrida: { etiqueta: '4ª edición', finishers: null, categoriasPublicadas: 21 },
}

/** Enlace de WhatsApp con mensaje prellenado. */
export function urlWhatsApp(mensaje: string): string {
  return `https://wa.me/${CONFIG.contacto.whatsapp}?text=${encodeURIComponent(mensaje)}`
}
