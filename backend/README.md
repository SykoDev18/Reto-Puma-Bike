# Backend — Reto Puma Bike

API pública de inscripciones y, más adelante, panel del comité y puente con el
sistema de cronometraje. **Fase 1 entregada.**

Plan completo y decisiones: [`docs/backend/FASE-0-PLAN.md`](../docs/backend/FASE-0-PLAN.md).

## Correr

```bash
python -m venv .venv
.venv/Scripts/pip install fastapi "uvicorn[standard]" sqlmodel jinja2 \
    python-multipart "passlib[argon2]" itsdangerous pytest httpx

.venv/Scripts/python -m pytest          # 84 pruebas
.venv/Scripts/python -m uvicorn app.main:app --reload
# documentación interactiva en http://127.0.0.1:8000/docs
```

## La frontera con el cronometraje

**No existe ninguna conexión en vivo con el host** (`192.168.0.10:8765`), ni la
va a haber. El día del evento no hay internet y la base de la carrera es del
host. El intercambio es por archivo, en dos momentos y siempre iniciado por una
persona:

1. **Padrón → host.** `app/exportacion/padron.py` genera el CSV con las columnas
   exactas de `participantes`. Se lleva en USB.
2. **Resultados → sitio.** Fase 2.

Si algún día aparece en este código un cliente HTTP hacia esa red, es un bug de
arquitectura, no una mejora.

## Una sola fuente de verdad para las categorías

El catálogo vive en el **front** (`src/data/categorias.ts`). De ahí se genera:

```bash
node --experimental-strip-types backend/scripts/exportar_catalogo.ts
node --experimental-strip-types backend/scripts/exportar_casos.ts
```

- `compartido/categorias.json` — las 28 categorías que lee el motor de Python.
- `compartido/casos-elegibilidad.json` — casos de prueba con la salida esperada
  **calculada por el motor de TypeScript**.

Ese segundo archivo lo consumen los dos lados:

| Prueba | Protege contra |
|---|---|
| `src/lib/elegibilidad-compartida.test.ts` | que alguien cambie el motor del front sin querer |
| `backend/tests/test_elegibilidad.py` | que el puerto de Python diverja del front |
| `backend/tests/test_catalogo_sincronizado.py` | que el JSON se quede viejo |

Si el motor de Python y el de TS dan distinto, el servidor aceptaría una
categoría que el front no ofrece: alguien corriendo donde no le toca el día de
la carrera. Por eso se prueba, no se supone.

## Decisiones que no son obvias

- **El folio lo emite el servidor** (`RPB2026-000123-7K9F`) y el del cliente se
  descarta en silencio. El sufijo aleatorio impide barrer el padrón; la consulta
  exige además la fecha de nacimiento. Folio inexistente y fecha equivocada
  devuelven el **mismo 404**: un 403 confirmaría que el folio existe.
- **`numero_corredor` no se guarda aquí.** Lo asigna el comité en el host al
  entregar el kit.
- **`edad_nominal` es registro histórico, no caché.** Es la edad con la que se
  asignó la categoría. Si cambia `ANIO_EVENTO`, no se recalcula.
- **`EXIGIR_TUTOR = False`** hasta que el front entregue el bloque de tutor.
  Activarlo antes dejaría a los infantiles sin poder inscribirse.
- **`tipo_sangre`** es dato sensible: opcional, fuera del export general del
  padrón y fuera de toda vista pública.
- **Sin pasarela de pagos.** Transferencia y comprobante por WhatsApp.
- **Ningún número de tarjeta**, en ningún archivo ni comentario.

## Estructura

```
app/
  config.py            flags y constantes (EXIGIR_TUTOR, TALLAS, folio)
  bd.py                motor, WAL, índice único, migración defensiva, bitácora
  modelos.py           Registro y Bitacora
  esquemas.py          contrato de la API (espejo de src/types/registro.ts)
  dominio/
    categorias.py      carga del catálogo compartido
    elegibilidad.py    PUERTO 1:1 de src/lib/categorias.ts
    registros.py       reglas de negocio: validar, crear, consultar
    folio.py           emisión y verificación
  api/registros.py     rutas públicas
  exportacion/padron.py  CSV para el host
```
