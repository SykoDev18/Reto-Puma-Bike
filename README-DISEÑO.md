# Reto Puma Bike — sitio estático 2026

## Abrir el sitio

No requiere compilación ni dependencias. Abre `index.html` en un navegador moderno; las otras páginas son `rutas.html`, `categorias.html`, `inscripciones.html`, `resultados.html`, `coleccion.html` y `hoteles.html`. Los módulos ES y los datos viven junto a las páginas, sin llamadas a APIs.

## Configuración anual

Edita únicamente `js/config.js` para cambiar edición, año, fecha, estado, rutas, contacto y kits. `CONFIG.estado = 'postevento'` cambia la navegación, el hero y cierra el formulario. Las categorías, patrocinadores, hoteles y resultados se alimentan desde `data/`.

## Imágenes

Las fotos históricas locales actuales se conservan en `src/assets/` y se usan en la maqueta para no depender de bancos externos. `assets/img/` contiene el logo y divisor temporales. Antes de publicar, sustituye o agrega ahí los archivos definidos por el brief: `hero-fallback`, `og-image`, `edicion-2026-equipo`, mapas de las dos rutas, frente/espalda de jersey, avisos y logos de patrocinadores. Mantén los nombres descriptivos, dimensiones solicitadas y texto alternativo equivalente.

## Integración futura

El punto de envío está marcado en `js/inscripcion.js` con `// TODO BACKEND: POST /api/registros`. El payload que se imprime en consola sigue el contrato de cronometraje y el dorsal no se asigna desde el formulario. Los contratos reemplazables son `data/categorias.js`, `data/patrocinadores.js`, `data/hoteles.js` y `data/resultados.js`.

## Reglas pendientes de confirmar

- `MAPA_RUTAS` refleja la propuesta entregada: Infantiles → infantil; Grupo Menor → 40; Grupo Mayor → 80 o 40.
- El número de WhatsApp se tomó como supuesto del sitio anterior: `+52 772 119 9093`.
- Los teléfonos de hospedaje se muestran como “Consulta disponibilidad” hasta recibir datos confirmados.
- Las categorías abiertas permiten una alternativa, pero las reglas de premiación fuera de rango requieren validación del comité.

## Pruebas

Ejecuta `node --test tests/inscripcion.test.mjs` para validar la edad nominal, elegibilidad, E-Bike, rutas, fecha y estructura del payload. El sitio respeta foco visible, navegación por teclado, reducción de movimiento, objetivos táctiles y diseño de tabla móvil.
