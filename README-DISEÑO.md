# Reto Puma Bike — sitio 2026 (React + TypeScript + Vite)

## Cómo correrlo

```bash
npm install
npm run dev                     # desarrollo
npm run build && npm run preview # producción (verificar siempre aquí)
npx tsc -b                      # tipos, debe salir limpio
node --test --experimental-strip-types src/lib/*.test.ts   # lógica pura
```

El sitio **requiere compilación**: es una SPA con enrutado por hash. Vistas migradas:
`#/` (Inicio) · `#/ruta` (Ruta) · `#/categorias` (Categorías). Las páginas
`inscripciones.html`, `resultados.html`, `coleccion.html` y `hoteles.html`
**todavía no están migradas** y no forman parte de `dist/`: sus enlaces caen al
fallback de la SPA hasta que se construyan.

## Arquitectura

- **Tokens y color:** `src/styles/tokens.css` es el ÚNICO archivo con valores hex.
  Todo lo demás usa `var(--*)` o `color-mix()`. Las franjas claras se logran
  invirtiendo `--fondo` / `--texto-color` por herencia (`.superficie--clara`),
  sin props de tema ni condicionales en los componentes.
- **Datos (contratos):** `src/data/` — `categorias.ts` (las 28 categorías y
  `MAPA_RUTAS`), `config.ts` (evento, kits, contacto), `rutas.ts` (perfiles),
  `patrocinadores.ts`.
- **Lógica pura y testeada:** `src/lib/` — `categorias.ts` (`categoriasElegibles`,
  `edadNominal`), `eje.ts` (construye el eje de edad desde los datos), `perfil.ts`,
  `texto.ts`. Sin DOM: el backend puede reutilizarlas tal cual.
- **Rendimiento:** el scroll NO pasa por el estado de React. Un solo listener con
  `requestAnimationFrame` escribe `--progreso` sobre un ref y el CSS mueve el
  perfil y la huella. El estado solo cambia en eventos discretos.
- **Cero dependencias nuevas:** solo React, React DOM y Vite.

## Decisiones pendientes del comité

### 1. No hay categoría femenil por edad de 16 a 18 años  ← BLOQUEANTE DE DATOS

Varonil tiene *Juvenil Mayor Varonil* (clave `J`, 16–18). **Femenil no tiene
equivalente.** No es un error de la interfaz: la página lo dibuja
explícitamente en el eje de edad, con línea punteada, y ofrece las alternativas
reales (*Elite Femenil* `Y` y *Rodadores Femenil* `RF`) más un enlace a WhatsApp.
El test `src/lib/eje.test.ts` fija este hallazgo, y también verifica que al
agregar la categoría faltante el hueco se cierra solo, sin tocar el layout.
**Decisión requerida:** crear la categoría o confirmar que se compite en abiertas.

### 2. La fecha configurada del evento ya pasó

`CONFIG.fecha` es `2026-07-05` y `CONFIG.estado` sigue en `'preevento'`, así que
la cuenta regresiva del Inicio informa que el pelotón ya arrancó. Hay que poner
la fecha real de la 4ª edición **o** cambiar `estado` a `'postevento'`. El código
soporta ambos sin cambios de layout.

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
- **Finishers de la 3ª edición:** sin dato oficial; `edicionAnterior.finishers`
  es `null` y la interfaz dice «finishers por confirmar» en vez de inventar cifra.
- **Número de WhatsApp:** `+52 772 119 9093`, tomado del sitio anterior.

## Assets que faltan

- Logo del evento en **SVG/PNG transparente**, versión clara y oscura.
  Hoy se usa `src/assets/logo_retopuma.webp`, que además **pesa 736 kB** para un
  espacio de 40×40 en la cabecera: necesita versión optimizada.
- `og-inicio.jpg` de 1200×630 y **URL absoluta** en `index.html`: hoy el
  `og:image` es relativo y `.webp`, así que la vista previa de WhatsApp no es
  confiable. Está marcado como PENDIENTE en el propio `index.html`.
- Jersey de la 4ª edición con fondo transparente (las tomas actuales son de la
  edición anterior y traen fondo sólido).
- Variantes responsive de imágenes (800/1600/2400). No hay `sharp`/`cwebp` en el
  entorno; se sirven a un solo tamaño con `width`/`height` y `loading="lazy"`.

## Integración con backend

El punto de envío del formulario sigue pendiente de migrar junto con la página de
Inscripciones. El contrato de cronometraje vive en `src/data/categorias.ts`:
**claves, rangos y vueltas no se cambian sin el comité**, porque cualquier cambio
rompe la importación de registros.
