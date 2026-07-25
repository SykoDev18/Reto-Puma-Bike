# Reto Puma Bike — sitio 2026 (React + TypeScript + Vite)

## Cómo correrlo

```bash
npm install
npm run dev                     # desarrollo
npm run build && npm run preview # producción (verificar siempre aquí)
npx tsc -b                      # tipos, debe salir limpio
node --test --experimental-strip-types src/lib/*.test.ts   # lógica pura
```

El sitio **requiere compilación**: es una SPA con enrutado por hash. Vistas
migradas: `#/` (Inicio) · `#/ruta` · `#/categorias` · `#/inscripciones` ·
`#/resultados` · `#/coleccion` · `#/anuncios` (con enlace directo por aviso,
`#/anuncios/012`). `#/hoteles` existe como ruta *"Próximamente"* honesta hasta
que se construya.

Las páginas `.html` heredadas (`categorias.html`, `rutas.html`,
`inscripciones.html`, `resultados.html`, `coleccion.html`, `hoteles.html`) están
**borradas**: caían al fallback del router y mostraban el Inicio como si fueran
esa sección. `index.html` se queda porque es el punto de entrada de Vite.

## Arquitectura

- **Tokens y color:** `src/styles/tokens.css` es el ÚNICO archivo con valores hex.
  Todo lo demás usa `var(--*)` o `color-mix()`. Las franjas claras se logran
  invirtiendo `--fondo` / `--texto-color` por herencia (`.superficie--clara`),
  sin props de tema ni condicionales en los componentes.
- **Datos (contratos):** `src/data/` — `categorias.ts` (las 28 categorías y
  `MAPA_RUTAS`), `config.ts` (evento, kits, contacto), `rutas.ts` (perfiles),
  `patrocinadores.ts`.
- **Resultados:** `public/data/resultados-2026.json` (177 kB, 781 corredores, 21
  categorías) se carga con `fetch`, **no se importa**: si entrara al bundle lo
  pagaría también quien solo abre el Inicio. Se valida en el borde
  (`validarResultados`) y el tipo vive en `src/types/resultados.ts`. La clave
  única de una competencia es `id` (`N-40` ≠ `N-80`): la misma categoría corrió
  las dos rutas y son dos podios distintos. **El catálogo del front no manda
  sobre el cronometraje:** tres categorías llegan con `clave_provisional: true` y
  se renderizan igual; hay que corregir el catálogo, no esconderlas.
- **Lógica pura y testeada:** `src/lib/` — `categorias.ts` (`categoriasElegibles`,
  `edadNominal`), `eje.ts` (construye el eje de edad desde los datos), `perfil.ts`,
  `texto.ts`. Sin DOM: el backend puede reutilizarlas tal cual.
- **Rendimiento:** el scroll NO pasa por el estado de React. Un solo listener con
  `requestAnimationFrame` escribe `--progreso` sobre un ref y el CSS mueve el
  perfil y la huella. El estado solo cambia en eventos discretos.
- **Cero dependencias nuevas:** solo React, React DOM y Vite.

## Seguridad de los datos de pago — NO NEGOCIABLE

El flyer del comité trae impreso un **número de tarjeta de débito**. **No está
en el repo y no debe entrar nunca**, ni en un componente, ni en un JSON, ni en
un comentario. Verificable con `grep -rn "4169" .` → sin resultados.

- Para recibir un depósito **basta la CLABE**. Una tarjeta publicada en una
  página indexable habilita cargos en comercios que solo piden número y
  vencimiento; cuenta y CLABE solo sirven para **recibir**.
- Los datos van como **texto** (`CONFIG.pago` → `<DatosPago>`), con botón de
  copiar. **Ninguna imagen del flyer bancario se publica**, justamente porque
  llevaría la tarjeta impresa.
- No hay pasarela, ni QR de pago, ni formulario que capture datos bancarios.

## Avisos: por qué un JSON y no la API de Facebook

`public/data/anuncios.json` existe para que el comité actualice el sitio **sin
recompilar** y, más adelante, desde un admin del backend. La alternativa —leer
las publicaciones de la página de Facebook— exige *Page Public Content Access*,
App Review y verificación de negocio, y las versiones de la API caducan cada
pocos meses: semanas de trámite y mantenimiento permanente para un evento que
publica cada dos semanas. Además un post de Facebook no es contenido de este
sitio (emoji, hashtags y flyers con el texto quemado), y el plugin `<iframe>` de
Meta no se puede estilar y carga rastreadores de terceros. **En el sitio solo hay
enlaces a las redes**, al pie de Avisos.

**Regla de la página, validada en el borde:** todo aviso lleva `cuerpo` con texto
real y toda imagen lleva `imagenAlt`. `validarAnuncios()` **lanza** si falta
alguno de los dos, para que el error se vea al cargar y no en silencio. Un flyer
acompaña; nunca sustituye.

`anuncios.json` se entrega con **8 avisos de ejemplo** en el tono del evento
(fijados, uno vencido, uno con imagen, uno con enlace). Son material de relleno:
hay que sustituirlos por los comunicados reales.

## Decisiones pendientes del comité

### 1. No hay categoría femenil por edad de 16 a 18 años  ← BLOQUEANTE DE DATOS

Varonil tiene *Juvenil Mayor Varonil* (clave `J`, 16–18). **Femenil no tiene
equivalente.** No es un error de la interfaz: la página lo dibuja
explícitamente en el eje de edad, con línea punteada, y ofrece las alternativas
reales (*Elite Femenil* `Y` y *Rodadores Femenil* `RF`) más un enlace a WhatsApp.
El test `src/lib/eje.test.ts` fija este hallazgo, y también verifica que al
agregar la categoría faltante el hueco se cierra solo, sin tocar el layout.
**Decisión requerida:** crear la categoría o confirmar que se compite en abiertas.

### 2. El evento ya se corrió: `CONFIG.estado = 'postevento'`

La 4ª edición fue el **5 de julio de 2026**. `fecha` y `anioEvento` NO cambiaron
(las edades nominales se calculan contra el año del evento), solo `estado`.
Efectos, sin tocar layout: la cuenta regresiva del Inicio pasa a
«4ª edición · 21 categorías · resultados publicados», el CTA dorado cambia a
*Ver resultados*, Resultados se destaca en el índice de la cabecera y las
inscripciones quedan cerradas con aviso y pre-registro a la 5ª.

**Decisión requerida:** `edicionCorrida.categoriasPublicadas` (21) está declarada
a mano en `config.ts` para que el Inicio no descargue 177 kB solo para pintar una
línea. Si cambia el JSON de resultados, hay que moverla en el mismo commit.

### 3. Reglas de negocio marcadas en el código

- `MAPA_RUTAS` (`src/data/categorias.ts`): Infantiles → circuito infantil;
  Grupo Menor → 40 km; Grupo Mayor → 80 o 40 km.
- Edades mínimas de las abiertas (`BandaAbiertas.tsx`): Elite desde 16,
  Rodadores desde 13.
- Vueltas y ruta por grupo se **derivan** de los datos; no están escritas en el JSX.
- Premiación al competir fuera del rango de edad: requiere validación.

## Supuestos (`// SUPUESTO:` en el código)

- **Perfiles de elevación:** digitalizados de las gráficas Komoot
  (`src/assets/Ruta/RutaC.webp` y `RutaI.webp`), no de un GPX oficial. Sustituir
  por el GPX de los tours `2985431690` (larga) y `2986084630` (corta).
- **Kilómetros de los puntos de paso:** aproximados; los marcados con
  `supuesto: true` se muestran con la etiqueta «km supuesto» en la página de Ruta.
- **`EDAD_TOPE = 70`** en `src/lib/eje.ts`: solo escala visualmente los rangos
  abiertos («60 y más»); no es un límite del evento.
- **Patrocinadores:** los nombres se derivaron del nombre de archivo cruzado con
  la lista del comité (no existe un mapeo oficial), y la selección de los 8
  principales está por confirmar.
- **Finishers de la 4ª edición:** `edicionCorrida.finishers` es `null`. Hay 650
  corredores con tiempo publicable, pero el JSON viene con `parcial: true`
  (faltan las infantiles), así que ningún número sería el total real. Con `null`
  la interfaz **omite** el conteo en vez de publicar una cifra falsa.
- **Desempate de dorsales repetidos en la URL:** los dorsales 25 y 127 aparecen
  dos veces cada uno. La URL compartible es `#/resultados?dorsal=647`; cuando el
  dorsal es ambiguo se agrega `&n=<índice global>`. Ese índice es estable
  mientras no cambie el JSON — si se republica, un enlace con `&n` puede señalar
  a otro registro, pero el `dorsal` sigue resolviendo a la lista de candidatos.
- **`font-stretch` y `letter-spacing` en canvas:** se aplican por
  `ctx.fontStretch` / `ctx.letterSpacing` solo si el motor los soporta. Donde no,
  la tarjeta se dibuja con el ancho normal de la variable: cambia el aire, no la
  legibilidad.
- **Número de WhatsApp:** `+52 772 119 9093`, tomado del sitio anterior.

### 4. El jersey no trae lo que dice el encargo  ← REVISAR CON EL COMITÉ

Se pidió rotular el jersey con «el convento de Actopan en el frente y huellas de
puma en la espalda». **Las tomas que hay no muestran eso**: el frente lleva la
cara del puma, el logotipo *Reto Puma* y zarpazos; la espalda, la mascota
ciclista y zarpazos. El pie de foto describe lo que se ve, no lo que se pidió.
Si el arte de la 4ª edición sí lleva convento y huellas, hacen falta las tomas
nuevas (ver abajo) y el texto se corrige solo.

## Assets que faltan

- Logo del evento en **SVG/PNG transparente**, versión clara y oscura.
  Hoy se usa `src/assets/logo_retopuma.webp`, que además **pesa 736 kB** para un
  espacio de 40×40 en la cabecera: necesita versión optimizada.
- `og-inicio.jpg` de 1200×630 y **URL absoluta** en `index.html`: hoy el
  `og:image` es relativo y `.webp`, así que la vista previa de WhatsApp no es
  confiable. Está marcado como PENDIENTE en el propio `index.html`.
- **Jersey de la 4ª edición**, frente y espalda, PNG con **fondo transparente** y
  ≥1600px del lado mayor. Las tomas actuales (`src/assets/Anuncio/jersey3.webp`
  y `jersey2.webp`) son de la edición anterior, traen **fondo blanco sólido** y
  una sombra horneada en el pixel. En Colección se compensan con
  `mix-blend-mode: multiply`, que las funde con el `--cal` de la franja clara —
  por eso ahí no se nota el recuadro. **Sobre fondo oscuro sí se notaría**, así
  que esas tomas no se pueden reusar fuera de la zona de luz.
- **Detalle del estampado** (1200×1200) para la ficha de la pieza: no existe.
- **Medalla sobre fondo contrastante.** `Catalogo/Medallas/10.webp` es plata
  sobre blanco: en la tira de archivo (escala de grises sobre `--cal`) se ve
  como un hueco, y trae su rótulo horneado. Por eso quedó **fuera** de la tira.
- **Flyers de avisos de la edición actual.** Los tres que hay son de ediciones
  pasadas (`Aviso1` = kit de la 3ª, `Aviso2` = escuela Gordo Bike de enero 2025,
  `Aviso3` = convocatoria de la **2ª**, con 60/40 km en Santiago de Anaya). Los
  `alt` que tenía el Inicio los describían mal a los tres; al unificar el
  carrusel con `anuncios.json` esos textos desaparecieron. Solo se publica
  `Aviso1`, rotulado explícitamente como tercera edición.
- Variantes responsive de imágenes (800/1600/2400). No hay `sharp`/`cwebp` en el
  entorno; se sirven a un solo tamaño con `width`/`height` y `loading="lazy"`.

## Integración con backend

El punto de envío del formulario sigue pendiente de migrar junto con la página de
Inscripciones. El contrato de cronometraje vive en `src/data/categorias.ts`:
**claves, rangos y vueltas no se cambian sin el comité**, porque cualquier cambio
rompe la importación de registros.
