# DIRECCIÓN DE DISEÑO — Reto Puma Bike
### Para ejecutar en Claude Code sobre el proyecto existente en **React + TypeScript**. Solo interfaz: el backend va aparte.

---

## 0. REGLA DE ORO

**El fondo oscuro no es negociable.** No propongas fondo claro, no lo "sugieras como alternativa", no lo dejes como opción en un tema. La página es oscura.

Todo lo demás en este documento sí es discutible: si algo te parece mala decisión, dilo **antes** de construir, en el reporte del §10, y propón alternativa. Después construye lo que aquí se pide.

---

## 1. LA TESIS

El problema del diseño anterior no era que fuera oscuro. Era que **no sabía nada del lugar**. Fondo negro + degradado dorado + video de fondo sirve igual para un maratón que para un torneo de gaming. Si le puedes cambiar el nombre al evento y el diseño sigue funcionando, no es identidad.

Lo específico de este evento no es "MTB". Es el **Valle del Mezquital**: tepetate, mezquite, polvo blanco de terracería, nombres hñähñu en la ruta (Dajiedhi, Boxaxni, El Rincón, Santiago de El Jaguey), el convento de Actopan, barbacoa y ximbo en la meta, 8:00 a.m. y sol duro.

Y el vocabulario visual del deporte no es "hero con degradado": es el **roadbook**, la tira impresa de kilometrajes, flechas y perfil de elevación que el ciclista lleva pegada al manubrio. **Eso es lo que vamos a construir.**

El negro entonces no es "modo oscuro". Es **noche de vísperas**: la carrera arranca de madrugada, el evento se arma cuando todavía está oscuro. La página vive en esa hora, y la luz entra solo donde tiene que entrar.

---

## 2. PALETA

```css
:root {
  --noche:      #12100D;  /* fondo base. Negro CÁLIDO, no #000 ni gris azulado. */
  --carbon:     #1C1915;  /* superficies elevadas, tarjetas, franjas */
  --borde:      #2B2620;  /* reglas y divisiones, 1px */
  --cal:        #F4EFE5;  /* texto principal. Blanco encalado, NUNCA #FFF */
  --tepetate:   #C9B392;  /* texto secundario, metadatos, polvo */
  --oro-puma:   #D4A02A;  /* acento de marca */
  --mezquite:   #5C6650;  /* verde matorral, superficies de mapa */
  --crono:      #4EC3D9;  /* SOLO datos medidos */
}
```

Dos reglas semánticas. Son las que hacen que se vea diseñado por alguien y no generado:

1. **Cálido = lugar y relato. Frío = medición.** El `--crono` no decora jamás. Aparece únicamente donde hay un número que salió de un cronómetro o de un GPS: tiempos, dorsales, kilometrajes, desnivel, posiciones, estados DNF/DNS/DSQ. Ningún botón, ningún borde decorativo, ningún ícono lo usa.
2. **El oro es escaso.** Máximo **un** elemento en oro por pantalla visible. Es el color de lo que premia: el CTA principal, o el 1º lugar del podio, o la marca en el header — nunca los tres a la vez. Si un bloque necesita jerarquía y el oro ya está usado, resuélvelo con tamaño, peso o espacio.

Nada de `#000000` puro y nada de `#FFFFFF` puro en toda la hoja de estilos. El negro tiene tierra adentro y el blanco tiene cal.

---

## 3. EL RITMO: DÓNDE ENTRA LA LUZ

La página es oscura, pero **no es plana**. Tres secciones —y solo tres— se voltean a fondo claro (`--cal` de fondo, `--noche` de texto), a sangre completa, sin transición suave: corte duro.

1. **Patrocinadores.** Los 34 logos vienen con fondo blanco. Hoy flotan como recortes sobre negro. En una franja clara se integran solos y dejan de verse pegados. Esto es un problema real resuelto por el diseño, no un capricho.
2. **Colección** (el jersey). Producto sobre fondo claro, como catálogo.
3. **El formulario de inscripción.** Es el momento de conversión y un formulario largo se llena mejor sobre claro. Además marca que "aquí cambia el modo".

El resto —hero, ruta, categorías, resultados, hoteles, footer— es oscuro.

Efecto: bajar por la página se siente como amanecer y volver a entrar a la sombra. Y el negro deja de ser default para volverse una decisión.

---

## 4. TIPOGRAFÍA

- **Display — `Anybody`** (variable, Google Fonts; ejes de peso **y ancho**). Casi nadie la usa y está diseñada a partir de números de dorsal. Úsala en mayúsculas.
  El eje de **ancho codifica información**, no es adorno: expandida al máximo en los títulos de ruta y distancia (el evento presume "100% camino ancho y rodable" — el tipo es literalmente ancho), y condensada en etiquetas técnicas, claves de categoría y metadatos. La tipografía dice lo mismo que el texto.
- **Cuerpo — `Source Serif 4`**. Una serif hace que se lea como documentación impresa de ruta, no como landing de SaaS. Es la decisión que más va a extrañar quien esté acostumbrado a Inter en todo; es justo por eso.
  Sobre fondo oscuro, corrige: tamaño base 18px, interlineado 1.65, peso 400 en párrafos cortos y **300 nunca**, color `--cal` (nunca blanco puro) y `text-rendering: optimizeLegibility`. Si un párrafo pasa de 75 caracteres por línea, está mal.
- **Datos — `Martian Mono`**. Tiempos, dorsales, km, desnivel, posiciones, claves de categoría, folios. Es la fuente del sistema de cronometraje dentro de la página.

**Prohibidas:** Bebas Neue, Anton, Archivo Black, Oswald, Montserrat, Inter. Son la respuesta automática a "tipografía deportiva" y se nota a un kilómetro.

---

## 5. EL ESQUELETO: LA PÁGINA ES UN ROADBOOK

El perfil de elevación **no es una sección**. Es la columna vertebral del sitio.

Una línea SVG continua —el perfil real de la ruta larga, 74.48 km / +2,130 m— corre por el costado izquierdo de toda la página. Las secciones cuelgan de ella como notas de roadbook, ancladas a kilómetros reales del recorrido.

```
 KM   perfil
  |
 0.0  ╭─╴  ┌────────────────────────────────────────┐
  ●   │    │  RETO PUMA BIKE · CUARTA EDICIÓN       │
  |   │    │  Pabellón Gastronómico · 8:00 AM       │
  |   │    └────────────────────────────────────────┘
 8.4  ╰─╮  ┌────────────────────────────────────────┐
  |     │  │  DAJIEDHI — primera subida             │
  |     │  │  [foto terracería]      +420 m         │
 22.1  ╭╯  └────────────────────────────────────────┘
  |    │   ┌──── mapa Komoot + abastecimientos ─────┐
 48.9 ─╯   └────────────────────────────────────────┘
  ▲
 huella de puma = posición de scroll
```

- En **desktop** la línea vive en una columna fija de ~90px a la izquierda, con las marcas de kilometraje en `Martian Mono`, tamaño 11px, color `--tepetate`.
- En **móvil** se colapsa a una barra horizontal delgada, fija en la parte inferior: `KM 34 · +1,120 m · siguiente: EL RINCÓN`, que actualiza conforme haces scroll. Es el único elemento persistente y es el que la gente va a recordar.
- La **huella de puma** (SVG) marca tu posición sobre el perfil y avanza con el scroll.

**Esto también resuelve la navegación.** El menú deja de ser siete palabras en fila: es el índice del roadbook, con kilómetros como marcadores de sección. Los números encodean algo verdadero.
Criterio general: **si numerar no significa nada, no numeres.** Nada de `01 / 02 / 03` decorativos.

> **Dependencia dura:** esto necesita datos reales de elevación. Ver §11. Si no los tienes al construir, usa el perfil `assets/data/perfil-80.json` con datos de ejemplo y **déjalo marcado**, pero no dibujes una curva inventada bonita y la pases como real.

---

## 6. COMPONENTE FIRMA: LA PLACA DE DORSAL

Un solo componente reutilizable que imita la placa numérica que se amarra al manubrio: fondo `--cal`, número en `Martian Mono` peso alto, borde `--noche` grueso, radio **2px**, y dos perforaciones circulares arriba (parte del SVG, no un pseudo-elemento improvisado).

Se usa para, y solo para:
- el número de edición en el hero (`04`),
- distancia y desnivel de cada ruta,
- la clave de cada categoría (`X`, `RV`, `EBF`, `N`…),
- la posición en los podios (`1`, `2`, `3`),
- el folio del registro en el modal de confirmación.

Es el único elemento claro que aparece dentro de las secciones oscuras. Por eso funciona: es una cita de la franja de luz.

---

## 7. MOVIMIENTO

Tres cosas. Ninguna más.

1. La línea del perfil se dibuja con `stroke-dashoffset` conforme bajas.
2. La huella sube por el perfil marcando la posición de scroll.
3. El eje de **ancho** de `Anybody` se expande ligeramente cuando un título entra al viewport (`font-variation-settings` con transición).

Con `prefers-reduced-motion: reduce`: el perfil aparece dibujado, la huella se queda en su sitio, los títulos nacen expandidos. Todo sigue teniendo sentido.

Nada de parallax, nada de partículas, nada de contadores que se disparan al hacer scroll excepto la cuenta regresiva del hero.

---

## 8. LISTA NEGRA

Estos son reflejos por default. Si alguno aparece en la entrega, la entrega se rechaza:

- Hero oscuro a sangre con overlay en degradado, título centrado y dos botones tipo píldora.
- Degradado dorado en textos o fondos. El oro es plano.
- Grid de tres tarjetas con íconos de librería (Lucide, Feather, Font Awesome). Los íconos que se usen son SVG propios y son pocos.
- Glassmorphism, `backdrop-filter`, bordes de 1px semitransparentes blancos.
- Acento neón sobre casi-negro.
- Contador de cuenta regresiva en cuatro cuadritos con fondo.
- `border-radius` mayor a 2px en cualquier elemento. Aquí todo es duro: placas, reglas, franjas.
- Sombras difusas grandes. El sol del Mezquital hace sombras cortas y contrastadas, o ninguna. Si necesitas separar dos superficies, usa una regla de 1px en `--borde` o un cambio de fondo, no una sombra.
- `text-transform: uppercase` en párrafos. Solo en display y etiquetas.
- Emojis como íconos de interfaz.

---

## 8.5 IMPLEMENTACIÓN EN REACT + TYPESCRIPT

El proyecto ya existe y está en React + TS. **No lo migres, no cambies de bundler, no metas una segunda tecnología de estilos.** Trabajas dentro de lo que hay.

### Lo primero: detectar, no asumir
El bundler ya lo sabemos: **Vite**. En el gate del §10 reporta lo demás: versión de React, sistema de estilos (Tailwind / CSS Modules / styled-components / CSS plano), router, alias de imports en `vite.config.ts` y `tsconfig.json`, plugins ya instalados, y qué componentes existentes se reutilizan vs. se reescriben. Adapta esta dirección a eso.

### Tokens
Pase lo que pase, los tokens del §2 viven como **CSS custom properties en `:root`**, en un solo archivo (`src/styles/tokens.css`). Si el proyecto usa Tailwind, se exponen en el theme apuntando a las variables (`colors: { noche: 'var(--noche)', ... }`) — una sola fuente de verdad, nunca dos paletas.

**Cero valores hex fuera de ese archivo.** Ni en componentes, ni en SVG inline, ni en estilos inline.

### La franja clara, sin prop drilling
Las tres secciones claras del §3 se implementan invirtiendo custom properties heredadas, no pasando props ni con `dark:`:

```css
.superficie { background: var(--fondo); color: var(--texto); }
:root                { --fondo: var(--noche); --texto: var(--cal); }
.superficie--clara   { --fondo: var(--cal);   --texto: var(--noche); }
```

Así ningún componente necesita saber en qué franja vive. `<PlacaDorsal>` se ve correcta en ambos contextos sin una sola condicional.

### El punto crítico de rendimiento
**El scroll no pasa por el estado de React.** Un `useState` que se actualiza en cada frame re-renderiza el árbol 60 veces por segundo y mata la página en un celular de gama media — que es exactamente el dispositivo de tu público.

El patrón correcto: **un solo listener con `requestAnimationFrame` que escribe custom properties sobre un ref**, y la línea del perfil y la huella se mueven por CSS.

```ts
el.style.setProperty('--progreso', String(p));   // sí
setProgreso(p);                                   // no
```

El estado de React solo cambia cuando cambia el **hito activo** (de Dajiedhi a El Rincón), detectado con `IntersectionObserver` — no el kilometraje continuo.

### Hooks a crear
`useReducedMotion()` · `useScrollProgress(ref)` · `useHitoActivo(hitos)` · `useEmbedFacade()` (carga diferida de Komoot y YouTube: portada estática y el `<iframe>` se monta al primer clic).

### Primitivas antes que páginas
Construye estos componentes primero, tipados y aislados:
`<PlacaDorsal>` · `<Dato>` (monoespaciada + `--crono`) · `<TituloAncho>` (eje `wdth` de Anybody vía `font-variation-settings` con una custom property animable) · `<Perfil>` (SVG generado desde `PuntoPerfil[]`) · `<FranjaClara>` · `<EmbedFacade>`.

El path del perfil se arma con una **función pura y testeable** en `src/lib/perfil.ts`. No lo dibujes a mano y no metas una librería de charts para una polilínea.

### Tipado
```ts
// src/types/roadbook.ts
export interface PuntoPerfil { km: number; altitud: number }
export interface Hito { km: number; nombre: string; tipo: 'poblado' | 'abasto' | 'cima' | 'meta' }
export interface Ruta {
  id: 'corta' | 'larga'; etiqueta: string; km: number; desnivel: number;
  komootId: string; perfil: PuntoPerfil[]; hitos: Hito[];
}
```
Las categorías van con union types estrictos (`rama: 'V' | 'F'`, `grupo: 'Infantiles' | 'Grupo Menor' | 'Grupo Mayor'`) y el motor `categoriasElegibles()` es una **función pura sin DOM** en `src/lib/categorias.ts`, con tests. La vamos a reutilizar desde el backend.

Sin `any`, sin `as` para callar al compilador. Los datos que vengan de fuera se validan en el borde.

### Dependencias
**No agregues ninguna.** Nada de framer-motion, GSAP, react-scroll-parallax, recharts, lucide-react. Todo lo de esta dirección se hace con SVG, CSS y dos hooks. Si de verdad crees que necesitas una librería, pídela en el gate del §10 con justificación.

---

## 9. ORDEN DE CONSTRUCCIÓN

**Construye primero las primitivas del §8.5, y luego la página de Ruta — no el inicio.** Es la más difícil —perfil, mapa oscuro, datos en `--crono`, tipografía expandida, franja de kilometraje— y si esa queda bien, el resto es repetición del sistema. Si empiezas por el hero vas a resolverlo con el reflejo genérico y ya no lo vas a soltar.

Orden: **Ruta → Resultados → Categorías → Inscripciones → Inicio → Colección → Hoteles.**

Entrega Ruta sola, terminada, y espera revisión antes de seguir.

---

## 10. GATE OBLIGATORIO: INVENTARIO ANTES DE CONSTRUIR

**Antes de escribir una línea de CSS**, haz esto y detente:

0. Reporta el stack detectado (§8.5): bundler, versión de React, sistema de estilos, router, alias, y qué componentes existentes se conservan, se adaptan o se reescriben.
1. Recorre `/assets/` y lista lo que existe: ruta del archivo, dimensiones, formato, y si tiene fondo transparente o sólido.
2. Compara contra lo que esta dirección necesita.
3. Devuelve un reporte con exactamente esta forma y **espera respuesta**:

```
DISPONIBLE
  assets/img/xxx.jpg   1920×1080   se usará en: hero de Ruta

FALTA — BLOQUEANTE (no puedo construir sin esto)
  [nombre]   [formato y tamaño requerido]   [en qué sección se usa]   [por qué no se puede sustituir]

FALTA — PUEDO IMPROVISAR (dime si prefieres darme el real)
  [nombre]   [qué voy a usar mientras: placeholder / SVG generado / recorte de otra]

SIRVE PERO NO IDEAL
  [archivo]   [problema: resolución baja / fondo sólido / recorte vertical]   [qué necesitaría]
```

4. Si algo de esta dirección de diseño te parece un error, dilo aquí en máximo 5 líneas, con la alternativa. Recordatorio: el fondo oscuro no está a discusión.

**No pidas aclaraciones fuera de este reporte.** Donde haya ambigüedad después del gate, decide lo más razonable, márcalo con `// SUPUESTO:` y anótalo en el README.

---

## 11. LO QUE PROBABLEMENTE VAS A NECESITAR PEDIR

Adelanto de lo que esta dirección exige y que quizá no esté en `/assets`. Verifícalo contra lo que sí hay:

**Datos (no imágenes) — bloqueante para el esqueleto:**
- Perfil de elevación real de las dos rutas: GPX exportado de Komoot, o un JSON de pares `{km, altitud}` con 100–300 puntos por ruta.
- Kilómetro aproximado de cada punto de paso (Dajiedhi, La Estancia, El Rincón, Boxaxni, Santiago de El Jaguey) y de los abastecimientos.

**Imágenes que la dirección necesita específicamente:**
- Paisaje horizontal del Mezquital a contraluz de mañana, 2400px de ancho mínimo, con cielo en la mitad superior (ahí va texto).
- Detalle cerrado de llanta sobre terracería con polvo — se usa como textura de transición entre secciones.
- Foto de meta o de cronometraje en el Pabellón Gastronómico.
- Logo del evento en **SVG o PNG con fondo transparente**, en versión clara (para fondo oscuro) y oscura (para la franja de patrocinadores).
- Jersey frente y espalda, PNG con fondo transparente.
- Fotos de podio/premiación de la edición anterior, horizontales.
- Los 34 logos de patrocinadores: PNG, fondo transparente o blanco, mínimo 600px del lado mayor.

**Lo que tú puedes generar sin pedir nada:**
- La huella de puma en SVG.
- Las placas de dorsal (son CSS + SVG).
- El patrón de textura de polvo (ruido SVG sutil, opacidad ≤ 4%).

---

## 12. CRITERIOS DE ACEPTACIÓN

- [ ] No existe `#000000` ni `#FFFFFF` en la hoja de estilos.
- [ ] `--crono` aparece únicamente sobre números medidos. Búscalo en el CSS y justifica cada uso.
- [ ] No hay más de un elemento en `--oro-puma` por pantalla visible.
- [ ] `border-radius` máximo en todo el proyecto: 2px.
- [ ] El perfil de elevación es continuo entre secciones y responde al scroll.
- [ ] La barra inferior de móvil muestra kilometraje real y cambia al hacer scroll.
- [ ] Las tres franjas claras (patrocinadores, colección, formulario) están a sangre y con corte duro.
- [ ] Ningún ítem de la lista negra del §8 aparece.
- [ ] A 360px de ancho no hay scroll horizontal en ninguna página.
- [ ] Con `prefers-reduced-motion` el sitio es plenamente utilizable y no pierde información.
- [ ] Contraste AA en todo texto; `:focus-visible` siempre visible y en `--crono` o `--oro-puma`, nunca outline default del navegador.

**React + TypeScript:**
- [ ] `tsc --noEmit` pasa limpio. Cero `any`, cero `as` para silenciar el compilador.
- [ ] Al hacer scroll, React DevTools (Profiler, "Highlight updates") **no muestra re-renders continuos**. Solo repinta al cambiar de hito.
- [ ] Cero valores hex fuera de `tokens.css`.
- [ ] Las franjas claras funcionan por herencia de custom properties, sin props de tema ni condicionales en los componentes.
- [ ] No se agregó ninguna dependencia nueva sin aprobación explícita.
- [ ] `categoriasElegibles()` es pura, tipada, sin DOM, y tiene tests.
