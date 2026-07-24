# Reto Puma Bike 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a static, responsive Spanish-language website for the 2026 Reto Puma Bike event with local-data registration and results interactions.

**Architecture:** Seven HTML documents load shared CSS and ES modules directly. Event configuration and the replaceable backend contracts live in isolated data modules; UI modules consume those contracts without network calls.

**Tech Stack:** Semantic HTML5, modern CSS, native ES modules, Node's built-in test runner for pure rule tests.

## Global Constraints

- No backend, database, server, external API calls, framework runtime or compilation step.
- All user-facing copy is Mexican Spanish; dynamic lists come from `data/*.js`.
- Meet keyboard, focus, reduced-motion, 44px target, and 360px responsive requirements.
- Use local image assets or named local SVG placeholders; only YouTube and Komoot embeds may be external and must use facades/lazy loading.
- `CONFIG.estado` alone switches between pre-event and post-event UI.

---

### Task 1: Static foundation and shared design system

**Files:** Create `css/tokens.css`, `css/base.css`, `css/components.css`, `js/config.js`, `assets/img/*`, and shared HTML shell conventions in all seven pages.

- [ ] Write the static HTML shell tests that assert all seven entry pages have a main landmark, skip link, navigation, footer, page-specific title, and module script.
- [ ] Add CSS tokens for every stipulated color and type role, then implement the responsive primitives, dorsal plate, buttons, cards, focus state and reduced-motion rules.
- [ ] Add the event configuration as the sole source of dates, routes, kits, contact information and state.
- [ ] Run `node --test tests/site-shell.test.mjs`; expected: seven passing page-shell tests.

### Task 2: Local data contracts and pure business rules

**Files:** Create `data/categorias.js`, `data/patrocinadores.js`, `data/hoteles.js`, `data/resultados.js`, `js/inscripcion.js`, `tests/inscripcion.test.mjs`.

- [ ] Write failing tests for nominal age, feminine infant classification, male master classification, E-Bike exclusivity, 17-year feminine fallback, date formatting and route resolution.
- [ ] Implement `edadNominal`, `categoriasElegibles`, `rutaPermitida`, `validarRegistro` and `crearPayload` as exported functions with no DOM access.
- [ ] Populate the category contract exactly, and create representative sponsor, hotel and six-category results contracts.
- [ ] Run `node --test tests/inscripcion.test.mjs`; expected: all business-rule assertions pass.

### Task 3: Shared navigation and progressive interactions

**Files:** Create `js/main.js`; modify all HTML pages.

- [ ] Implement the responsive fixed navigation, active link handling, mobile dialog-like menu, footer year, post-event mutation, reveal observer and accessible iframe facade initializer.
- [ ] Ensure facade buttons add only their own `iframe` on activation and preserve an accessible title.
- [ ] Manually verify Tab, Escape and 360px menu behavior on each page.

### Task 4: Home, routes and event information

**Files:** Create `index.html`, `rutas.html`; modify common CSS and `js/main.js` only when a shared component needs it.

- [ ] Build the hero with its mobile fallback, count-down, event summary, route cards, category sampler, kits, collection CTA, sponsors and keyboard-controlled notices.
- [ ] Build both route narratives, metrics, populated towns, safety recommendations and Komoot facades.
- [ ] Verify no route facts or kit prices are duplicated in HTML and both pages work with JavaScript disabled for core content.

### Task 5: Categories and registration flow

**Files:** Create `categorias.html`, `inscripciones.html`; extend `js/inscripcion.js`.

- [ ] Render category filters and the eligibility mini-widget from the data module.
- [ ] Build live field validation, eligibility cards, controlled route adjustment, session draft recovery, WhatsApp encoding and focus-trapped confirmation dialog.
- [ ] Verify each acceptance scenario in the brief and inspect `console.log` payload structure.

### Task 6: Results, collection and hotels

**Files:** Create `resultados.html`, `coleccion.html`, `hoteles.html`, `js/resultados.js`.

- [ ] Render category/search-selectable results, mobile cards, podiums, tolerant empty values and client-side CSV download.
- [ ] Build the local jersey gallery/WhatsApp handoff and local-data hotel cards.
- [ ] Verify the empty result category, DNF/DNS/DSQ treatment and generated CSV columns.

### Task 7: Documentation and quality pass

**Files:** Create `README-DISEÑO.md`; modify all affected assets/pages only for fixes.

- [ ] Document direct opening, placeholder replacement, every backend marker and pending business assumptions.
- [ ] Run `node --test`, parse every HTML and every JS module, then inspect a production-like static preview at 360px and desktop.
- [ ] Check links, metadata, JSON-LD, no horizontal overflow and the pre/post-event toggle.
