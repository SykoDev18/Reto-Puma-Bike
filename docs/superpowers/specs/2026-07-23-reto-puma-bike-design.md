# Reto Puma Bike 2026 — Diseño

## Objetivo

Reconstruir el sitio público del Reto Puma Bike como un sitio estático, multipágina y sin compilación. Debe informar, orientar la inscripción y presentar resultados de cronometraje a partir de módulos de datos locales.

## Dirección visual

- Fondo `#0E0E0F` y superficies `#1B1C1E`; el oro Puma `#E9B949` es el acento de navegación y acción.
- Archivo Black construye la voz competitiva de los titulares, Inter mantiene la lectura y JetBrains Mono distingue todos los datos de carrera.
- La placa de dorsal, con dos perforaciones superiores y borde negro, es la firma funcional: identifica edición, rutas, categorías, podios y folios.
- Un divisor de huellas de bajo contraste articula las secciones. No se añaden adornos que compitan con la información.
- El cian `#29A8E0` se limita a tiempos, distancias, desnivel, posiciones y otros datos de cronometraje.

## Arquitectura

El navegador abre siete documentos HTML que comparten `css/tokens.css`, `css/base.css`, `css/components.css` y módulos ES. `js/config.js` concentra los datos anuales; `data/*.js` son contratos reemplazables por el futuro backend. `js/main.js` aporta la navegación, el estado pre/postevento, revelados, facades y componentes compartidos. `js/inscripcion.js` mantiene puras las reglas de categoría y construye el formulario; `js/resultados.js` renderiza resultados y exporta CSV.

## Decisiones explícitas

- Se sustituye el esqueleto Vite/React existente por archivos estáticos porque el encargo exige abrir el sitio sin una compilación.
- Se reutilizarán los recursos locales presentes cuando encajen; los recursos nuevos se representan con SVG locales rotulados hasta que el comité los sustituya.
- La regla de rutas queda centralizada en `MAPA_RUTAS` con el comentario de confirmación pedido por el comité.
- El estado por defecto es `preevento`; una sola bandera en `CONFIG` controla el modo posterior al evento.

## Validación

Los módulos de reglas se prueban con Node para las edades, restricciones de E-Bike, alternativas abiertas y formatos de payload. La comprobación final abre cada HTML, ejecuta lint sintáctico de módulos y prueba el flujo de formulario con teclado.
