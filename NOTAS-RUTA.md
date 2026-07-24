# Notas — Página de Ruta (React + Vite)

Primera página del rediseño "Roadbook", ahora en **React 19 + TypeScript + Vite**
(migración aprobada). Orden §9: primitivas → página de Ruta. Se entrega Ruta
sola y se espera revisión antes de seguir.

## Cómo correr / previsualizar
- Dev: `npm run dev` (o `node_modules/.bin/vite`). Abre `/` → página de Ruta.
- Tipos: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → **limpio**.
- Tests puros: `node --test src/lib/*.test.ts` → **12/12** (usa el runner nativo de Node, sin dependencias nuevas).
- Requiere servidor (Vite); no se abre con `file://`. Este es el costo del stack React+Vite que ya habíamos advertido.

## Arquitectura (§8.5)
- `src/styles/tokens.css` — **única fuente de color** (paleta §2 + fuentes + patrón de franja). Cero hex fuera de aquí (verificado en CSS y TSX).
- `src/styles/roadbook.css` — clases de componentes; todo color vía `var(--*)` o `color-mix()`.
- `src/types/roadbook.ts` — `PuntoPerfil`, `Hito`, `Ruta`, y tipos de categoría (union types estrictos). Sin `any`, sin `as`.
- `src/lib/perfil.ts` — funciones puras (path SVG, desnivel acumulado, próximo hito) + tests.
- `src/lib/categorias.ts` — `categoriasElegibles()` pura/tipada/sin DOM (portada de `js/inscripcion.js`) + tests.
- `src/data/rutas.ts` — datos tipados, **generados** del perfil digitalizado.
- `src/hooks/` — `useReducedMotion`, `useScrollProgress` (ref + rAF + `setProperty('--progreso')`, sin setState), `useHitoActivo` (IntersectionObserver, estado solo al cambiar de hito), `useEmbedFacade`.
- `src/components/` — primitivas: `PlacaDorsal`, `Dato`, `TituloAncho`, `Perfil`, `FranjaClara`, `EmbedFacade`; y `Riel`, `Cabecera`, `Nota`, `BarraKm`.
- `src/pages/PaginaRuta.tsx` + `src/App.tsx`.

## Rendimiento (criterio duro del §12)
El scroll **no pasa por el estado de React**: `--progreso` va por CSS (perfil se
dibuja con `stroke-dashoffset`, la huella con `top`) y el kilometraje de texto se
escribe por DOM directo. Medido: **18 renders de `PaginaRuta` en un scroll de 120
frames de toda la página** (mount ×2 de StrictMode + los ~9 cambios de hito ×2).
En producción (sin StrictMode) serían ~9. No hay re-render por frame.

## SUPUESTOS (marcados en pantalla y en datos)
- **Km de poblados/abastecimientos**: no hay dato oficial; repartidos y rotulados con "km supuesto" (`supuesto:true` en `rutas.ts`). Falta la lista del comité.
- **Perfil de elevación**: DERIVADO de las gráficas Komoot (`RutaC/RutaI.webp`), calibrado con la cuadrícula. Sustituir por GPX oficial (IDs en `rutas.ts`). El desnivel mostrado (2130/1457) es el oficial, no el del resampleo.
- **Riel = ruta seleccionada** (larga por defecto).
- **Logo**: `src/assets/logo_retopuma.webp` dentro de una placa de cal en el header.

## Qué quedó del intento estático (heredado, a limpiar)
- `index.html` ahora es la entrada de React (antes era la home estática; recuperable por git).
- `rutas.html`, `css/sistema.css`, `js/ruta-app.js` son la versión vanilla previa, **superseded** por la app React. Se pueden borrar cuando confirmes.
- Las otras páginas estáticas (`categorias.html`, etc.) siguen sin migrar; el nav las enlaza como heredadas hasta agregar router.

## Pendiente para producción
- Km reales + GPX oficial → reemplazan los SUPUESTOS.
- Router (react-router u otro) para las demás páginas; hoy `/` = Ruta.
- Migrar Resultados → Categorías → Inscripciones → Inicio → Colección → Hoteles (orden §9).
