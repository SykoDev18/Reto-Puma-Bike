# Pendientes que NO resuelve el backend

Tres cosas que salieron de la Fase 2 y que se resuelven fuera de este código.
Ninguna bloquea lo entregado.

---

## 1. El límite de edad tiene que salir del nombre — cambio del FRONT

**No aplicado a propósito.** Toca `src/`, y el front no se toca desde aquí.

### El problema

En `src/lib/categorias.ts`, dos guardias de elegibilidad comparan por nombre:

```ts
if (categoria.nombre.startsWith('Elite') && edad < 16) return false
if (categoria.nombre.startsWith('Rodadores') && edad < 13) return false
```

Dos defectos, y el segundo es el grave:

1. **El de Rodadores es inalcanzable.** Ese filtro solo corre en la rama no
   infantil, es decir con `edad >= 13`, así que `edad < 13` nunca es cierto.
2. **La comparación es por cadena de texto.** En el catálogo la categoría se
   llama `Rodadores Femenil`. En los datos reales del cronometraje se llama
   **`RODADORAS FEMENIL`** — con A y en mayúsculas. `startsWith('Rodadores')`
   no la encuentra.

Hoy no truena porque el catálogo y los resultados son archivos distintos. Pero
el catálogo hay que alinearlo con los nombres que de verdad usa el comité —
`MÁSTER 50 FEMENIL` tampoco existe en él, y llegó en los resultados como
`clave_provisional`. El día que se alineen, esta guarda deja de aplicar **en
silencio**. Una regla de elegibilidad que depende de cómo se escribió un nombre
es una bomba de tiempo.

### El cambio propuesto

El límite deja de deducirse del nombre y se vuelve dato.

```diff
  // src/types/roadbook.ts
  export interface Categoria {
    …
    requierePeso?: number
    requiereEbike?: boolean
+   /** Edad nominal mínima para que se ofrezca como alternativa abierta. */
+   edadMinima?: number
  }
```

```diff
  // src/data/categorias.ts
- { id: 19, nombre: 'Rodadores Varonil', clave: 'RV', …, abierta: true },
+ { id: 19, nombre: 'Rodadores Varonil', clave: 'RV', …, abierta: true, edadMinima: 13 },
- { id: 20, nombre: 'Rodadores Femenil', clave: 'RF', …, abierta: true },
+ { id: 20, nombre: 'Rodadores Femenil', clave: 'RF', …, abierta: true, edadMinima: 13 },
- { id: 23, nombre: 'Elite Varonil',     clave: 'X',  …, abierta: true },
+ { id: 23, nombre: 'Elite Varonil',     clave: 'X',  …, abierta: true, edadMinima: 16 },
- { id: 28, nombre: 'Elite Femenil',     clave: 'Y',  …, abierta: true },
+ { id: 28, nombre: 'Elite Femenil',     clave: 'Y',  …, abierta: true, edadMinima: 16 },
```

```diff
  // src/lib/categorias.ts — filtro de alternativas
    if (categoria.requierePeso && !peso90mas) return false
    if (categoria.clave === 'M' && !peso90mas) return false
-   if (categoria.nombre.startsWith('Elite') && edad < 16) return false
-   if (categoria.nombre.startsWith('Rodadores') && edad < 13) return false
+   if (edad < (categoria.edadMinima ?? 0)) return false
    return true
```

> Los `id` del diff hay que confirmarlos contra `src/data/categorias.ts`: aquí
> se citan los del ejemplo de la revisión, no se verificaron uno por uno.

### Qué pasa cuando se entregue

El comportamiento observable **no cambia**: los mismos casos, el mismo
resultado, pero sin depender de una cadena. La secuencia es:

1. El front aplica el cambio.
2. Se regenera el fixture:
   `node --experimental-strip-types backend/scripts/exportar_catalogo.ts`
   `node --experimental-strip-types backend/scripts/exportar_casos.ts`
3. Los tests de los dos lados deben seguir en verde **sin tocarlos**. Si alguno
   falla, el cambio alteró comportamiento y hay que revisarlo.

El puerto de Python (`backend/app/dominio/elegibilidad.py`) se ajusta en el
mismo paso, y ahí sí borro el `startswith`.

---

## 2. `DNS` no es lo mismo que `DNF` — pregunta para el host

Hoy los 99 abandonos caen todos en `DNF` porque el dato de origen no los
distingue. El contrato ya tiene los dos estados.

Importa por algo concreto: el sitio le muestra a un `DNF` el mensaje

> *«No terminaste esta edición. Ahí estuviste, y eso ya es más de lo que la
> mayoría intenta.»*

**A alguien que nunca llegó a la salida, eso le dice algo falso.**

**Pregunta para el sistema de cronometraje:** ¿hay lectura de chip en la salida?

- **Sí la hay** → se puede separar quien arrancó y abandonó (`DNF`) de quien
  nunca se presentó (`DNS`), y el export debería traer la diferencia. El
  validador ya preserva ambos estados sin tocarlos: no hay que cambiar nada
  del backend, solo que el archivo los traiga.
- **No la hay** → todos se quedan en `DNF` y hay que **suavizar el mensaje del
  front** para que funcione en los dos casos.

No lo resolví por mi cuenta porque depende de hardware que no puedo consultar.

---

## 3. Los tres insumos que siguen bloqueados

Fase 2 se entregó completa salvo dos piezas, que son justo las que dependen de
documentos que no están en el repo:

| Pendiente | Necesita |
|---|---|
| `POST /api/resultados` con `X-Auth-Token` | El esquema de auth del `POST /rpc` |
| `GET /admin/export/padron.db` | El `CREATE TABLE participantes` real del host |
| Guía de importación idempotente | La superficie pública de `DataStore` |

Lo demás de Fase 2 —el validador, el versionado, la reversión y el estático—
no depende del host y está entregado.
