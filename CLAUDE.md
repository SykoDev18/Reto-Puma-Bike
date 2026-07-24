# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Reto Puma Bike is a Spanish-language site for a mountain-biking event in Actopan, Hidalgo. **The production site is a static, no-build, multi-page site** — `index.html`, `rutas.html`, `categorias.html`, `inscripciones.html`, `resultados.html`, `coleccion.html`, `hoteles.html` — that loads shared CSS and native ES modules directly in the browser. There is no server, database, or bundler in the request path.

The repo also still contains a `src/` + `vite.config.ts` + `package.json` React/TypeScript scaffold left over from before the project pivoted to plain HTML/CSS/JS. Per `docs/superpowers/specs/2026-07-23-reto-puma-bike-design.md`: "Se sustituye el esqueleto Vite/React existente por archivos estáticos porque el encargo exige abrir el sitio sin una compilación." That scaffold is unused boilerplate (the default Vite React template, not wired into any page) — don't build real site features into it, and don't assume `npm run build` produces the deployed site.

## Commands

- Run the business-rule tests: `node --test tests/inscripcion.test.mjs` (no `test` script is defined in `package.json`).
- Preview the actual site: open `index.html` directly in a browser, or serve the repo root with any static file server. No build step or dev server is needed.
- `npm run dev` / `npm run build` / `npm run lint` / `npm run preview` only operate on the unused `src/` Vite/React scaffold. `eslint.config.js` only targets `**/*.{ts,tsx}`, so `npm run lint` does not lint the real site's `js/*.js` — there is currently no linter wired up for the production code.

## Architecture

- **Config-driven:** `js/config.js` (`CONFIG`) is the single source of truth for edition, year, date, venue, contact, routes, and kit pricing. `CONFIG.estado` (`'preevento'` | `'postevento'`) is the one flag that switches navigation, hero content, and closes registration — check it before adding any other pre/post-event branching.
- **Data contracts (`data/*.js`):** `categorias.js`, `patrocinadores.js`, `hoteles.js`, `resultados.js` export plain arrays/objects meant to be swapped out by a future backend. UI modules only ever read from these — never hardcode category/sponsor/result data in HTML or JS.
- **Shared UI (`js/main.js`):** builds header/footer/nav, the pre/post-event toggle, countdown, scroll-reveal, the accessible iframe "facade" pattern used for lazy-loading YouTube/Komoot embeds (`iniciarFacades`), and cross-page data rendering (sponsors, featured categories/routes/kits). Runs on every page via `DOMContentLoaded`.
- **Registration logic (`js/inscripcion.js`):** the eligibility/validation/payload functions (`edadNominal`, `categoriasElegibles`, `rutaPermitida`, `validarRegistro`, `crearPayload`) are pure and DOM-free by design — this is what `tests/inscripcion.test.mjs` exercises via `node --test`. DOM wiring (`iniciarFormulario`) lives further down in the same file; keep that split when editing. Age (`edadNominal`) is nominal — `CONFIG.anioEvento - birth year`, not an actual-birthday calculation. The age-group-to-route mapping (`MAPA_RUTAS` in `config.js`) is explicitly flagged in-code as pending committee confirmation.
- **Backend integration point:** `js/inscripcion.js` has one `// TODO BACKEND: POST /api/registros` marker where the form payload is currently only `console.log`ged. The payload shape is a timing-system contract shared with the committee — don't change its field names without checking `tests/inscripcion.test.mjs`.
- **Results (`js/resultados.js`):** renders per-category results (podium + searchable table) from `data/resultados.js` and generates a client-side CSV download — no network calls.
- **CSS load order:** `css/tokens.css` (design tokens: colors, type) → `css/base.css` → `css/components.css`, loaded in that order by every page.

## Conventions

- Identifiers, UI copy, and comments across the JS/data modules are in Spanish (`es-MX`); match that when editing those files.
- Only YouTube and Komoot embeds may load external content, and only through the lazy `data-facade` iframe pattern in `js/main.js` — everything else is local assets/data.
- `docs/superpowers/plans/` and `docs/superpowers/specs/` hold the original implementation plan and design spec for the static-site rebuild — useful background on intentional decisions (e.g. why the Vite scaffold was abandoned), not living documents to keep updated.
