# FASE 0 — Plan del backend, sin código

**Reto Puma Bike · API pública, panel de administración y puente con el cronometraje**
Documento para aprobar antes de escribir una línea. Nada de esto está construido todavía.

---

## 0. Estado de los insumos — leer primero

### 0.1 · Los dos documentos rectores no están en el repo

El encargo cita como rectores `CONTRATO-CRONOMETRAJE.md` y «`CONTRATO_RED.md` del repo».
**Ninguno de los dos existe.** Verificado con `find . -iname "*contrato*"` → sin resultados.

Lo que sí es verificable y sobre lo que está construido este plan:

| Fuente | Qué aporta | Confianza |
|---|---|---|
| `public/data/resultados-2026.json` | 781 corredores reales, 21 categorías. Es el §3 del contrato de cronometraje, materializado | Alta — es el artefacto |
| `src/types/resultados.ts` | El contrato de resultados ya tipado y consumido por el sitio | Alta |
| `src/types/registro.ts` | `PayloadRegistro`: la forma exacta que el front ya envía | Alta |
| `src/lib/categorias.ts` | `categoriasElegibles()` y `edadNominal()` — el motor a portar | Alta |
| `src/data/categorias.ts` | Las 28 categorías del catálogo, con `id`, `clave`, `grupo`, rangos | Alta |
| Enunciado del encargo | Columnas de `participantes`, host en `192.168.0.10:8765`, `POST /rpc` | Media — sin el documento no se puede cotejar |

**Queda BLOQUEADO por falta de documento** (no impide arrancar la Fase 1, sí la Fase 2):

1. **El esquema de autenticación del RPC.** §6.2 pide que `POST /api/resultados` use «`X-Auth-Token`, mismo esquema que el RPC». No puedo espejar un esquema que no puedo leer. En §6 propongo uno y queda marcado como *a confirmar*.
2. **El esquema completo de la tabla `participantes` del host.** Solo conozco las 9 columnas que el propio encargo lista. Para generar un `.db` que el host acepte con `ATTACH` hace falta el `CREATE TABLE` real: tipos, `NOT NULL`, índices y claves.
3. **La interfaz de `DataStore`.** §6.1 exige que toda escritura del host pase por ahí. Es código del host; este backend no lo toca, pero la guía de importación idempotente que entreguemos tiene que citar su API real.

> **Petición concreta:** los dos `.md`, y el `CREATE TABLE participantes` tal como está hoy en el host.

### 0.2 · Cifras del encargo que NO cuadran con los datos reales

Contrasté las afirmaciones del §6.2 contra `resultados-2026.json`. Tres no se sostienen:

| El encargo dice | Lo que hay en el archivo | Resuelto |
|---|---|---|
| «los **7 malformados** [de tiempo] se rechazan o se normalizan» | **Cero.** Los 663 tiempos no nulos cumplen `HH:MM:SS.CC` sin excepción | Confirmado: los 7 existían en los **PDF originales** y se normalizaron al generar el JSON (`04:05:48:71` → `04:05:48.71`). El encargo hablaba de la fuente; el archivo es la salida ya limpia |
| «hubo **33** registros con problemas» (§6.2) | **32** marcados: 15 `REVISION` + 17 `SIN_TIEMPO` | Confirmado: **32**. El 33 contaba dos veces un registro que aparece en dos categorías |

La regla 1 (formato de tiempo) se construye igual, porque protege contra lo que manda el sistema de cronometraje, que sí produce esos errores. Pero **no se prueba contra este archivo**: su resultado correcto aquí es cero. Ver §5, fixture B.

### 0.3 · El archivo ya viene validado — el validador debe ser idempotente

Dato que cambia el diseño: los 15 `REVISION` de `resultados-2026.json` **ya traen en `nota` el motivo**, y cada motivo corresponde a una de las siete reglas:

| Nota en el archivo | Regla |
|---|---|
| «La posición 2 está asignada a más de un corredor» | R2 |
| «Posición 72 fuera de rango: la categoría tiene 14 clasificados» | R2 (variante) |
| «Su tiempo es menor al del primer lugar…» | R3 |
| «Registra 0/1 vueltas pero tiene tiempo» / «…posición y tiempo» | R4 |
| «El dorsal 25 / 127 aparece en más de un registro» | R6 |
| «Registro sin nombre en el padrón» | R7 |

Entonces, al revalidar este archivo el validador **debe reproducir exactamente esas marcas, no acumularlas**. Revalidar dos veces tiene que dar el mismo resultado: mismo `estado`, misma `nota`, sin escalar `OK → REVISION → algo peor`. Es un requisito de prueba de la Fase 2.

### 0.4 · Lo que las siete reglas detectan hoy, medido

```
R1  tiempo malformado ...................  0
R2  posición repetida ...................  1   EBV-40 pos. 2
    hueco en la numeración ..............  3   EBV-40:10 · Y-80:2 · N-40:32
R3  más rápido que el 1º ................  4   Y-80:375 · W-80:143 · W-80:835 · W-80:792
R4  vueltas incompletas con pos./tiempo ..  4   JLV-40:146 · W-80:59 · Z-40:127 · RV-40:668
R5  vueltas completas sin tiempo en OK ...  0   (ya vienen como SIN_TIEMPO; la regla es preventiva)
R6  dorsal duplicado ...................   2   dorsales 25 y 127
R7  nombre vacío o placeholder .........   1   dorsal 852, «(sin nombre)»
```

**Nota sobre R3 — corregida.** El encargo mencionaba solo el dorsal 375; son **cuatro** (375 en `Y-80`; 143, 835 y 792 en `W-80`). En la primera versión de este plan afirmé que los tres de `W-80` venían como `OK`: **era falso**, no había leído su `estado`. Los cuatro ya están en `REVISION` con la nota «Su tiempo es menor al del primer lugar. Posible ruta o lectura de chip cruzada» — eran las cuatro filas rojas del PDF oficial.

Consecuencia: **aplicar R3 no cambia ningún resultado publicado**, así que marca automáticamente. La regla replica un juicio que el comité ya emitió a mano.

---

## 1. Arquitectura — la frontera

Se respeta la separación del §0 del encargo, sin excepciones.

```
INTERNET                                    │   RED LOCAL DEL EVENTO (sin salida)
┌──────────────────────────────────┐        │   ┌────────────────────────────┐
│ api.retopumabike.mx              │        │   │ HOST DE CRONOMETRAJE       │
│ FastAPI + SQLite                 │        │   │ 192.168.0.10:8765 POST /rpc│
│                                  │        │   │ dueño de la BD de carrera  │
│ escribe → /var/www/data/*.json ──┼──┐     │   └────────────────────────────┘
└──────────────────────────────────┘  │     │
                 │                    │     │
    ① padron.csv │                    │     │
       (USB, manual)                  │     │
                 ▼                    │     │
        ② resultados.json ────────────┼─────┘
           (USB o subida al admin)    │
                                      ▼
                          NGINX sirve estáticos
                          el sitio hace fetch
```

**Invariantes que el código debe hacer imposibles de violar:**

- El backend **no conoce** la IP del host. No hay cliente HTTP hacia `192.168.0.10` en ninguna parte del código. Si aparece, es un bug de arquitectura.
- El backend **no expone** ninguna ruta que escriba en la base de la carrera.
- El intercambio es **por archivo, iniciado por una persona**: nadie sincroniza nada solo.

### 1.1 · La ruta de lectura es estática, siempre

Los tres JSON públicos (`resultados-{anio}.json`, `anuncios.json`, `hospedaje.json`) **se escriben a disco** cuando el admin guarda, y NGINX los sirve directo. Ninguna petición pública toca SQLite.

Motivo medido: el pico es de 800 corredores más familia consultando en la hora posterior a la meta, desde datos móviles. Un archivo estático con `Cache-Control` corto absorbe eso; SQLite con escrituras concurrentes del admin, no necesariamente.

Escritura **atómica**: se escribe a `.tmp` y se hace `os.replace()`. Sin eso, alguien puede leer medio JSON y el sitio muestra un error de parseo justo en el momento de mayor tráfico.

---

## 2. Esquema de base de datos

### 2.1 · `registro`

Los campos del bloque «espejo» llevan **exactamente** los nombres de la tabla `participantes` del host. No se traducen ni se mejoran.

```python
class Registro(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    folio: str = Field(unique=True, index=True)      # RPB2026-000123-7K9F
    creado_en: datetime
    edicion: int                                      # 2026

    # --- espejo de `participantes` (NO renombrar) ---
    nombre: str
    apellido_paterno: str
    apellido_materno: str | None
    fecha_nacimiento: str                             # DD/MM/AAAA
    sexo: str                                         # 'M' | 'F'
    equipo: str | None
    categoria_id: int
    categoria_clave: str
    ruta: str                                         # '40' | '80' | 'infantil'
    tipo_bicicleta: str                               # 'MTB' | 'E-Bike'

    # --- no viaja al host ---
    email: str
    telefono: str
    kit_nombre: str
    kit_precio: int
    talla_jersey: str | None
    emergencia_nombre: str
    emergencia_telefono: str
    tipo_sangre: str | None

    # --- estado administrativo ---
    estado: str                                       # 'pendiente'|'pagado'|'cancelado'
    pago_referencia: str | None
    pago_verificado_por: str | None
    pago_verificado_en: datetime | None
    notas: str | None

    # --- menores ---
    es_menor: bool
    tutor_nombre: str | None
    tutor_telefono: str | None
    consentimiento_tutor: bool = False
```

**Añadidos al modelo del encargo, con justificación** (cuatro campos):

| Campo | Por qué |
|---|---|
| `peso_90_mas: bool` | El motor de elegibilidad lo necesita para autorizar *Mamut's* (`clave='M'`). Sin él, el servidor no puede re-verificar la categoría y la validación server-side queda coja. Ya viaja en el formulario del front |
| `edad_nominal: int` | Se deriva, pero se **congela** al registrar. Si dentro de un año cambia `anio_evento`, un `SELECT` histórico seguiría dando la edad correcta de aquella edición |
| `privacidad_aceptada_en: datetime` | §7 exige «registro de cuándo se aceptó» el aviso. Sin marca de tiempo no hay constancia |
| `aviso_privacidad_version: str` | Si el aviso cambia, hay que saber cuál aceptó cada quien. Un booleano no lo resuelve |

**`numero_corredor` NO existe en este esquema.** Lo asigna el comité en el host al entregar el kit. Duplicarlo aquí es la vía más rápida a resultados corrompidos.

**Índices:** `folio` (único), `(edicion, estado)` para la pantalla de conciliación, y un **único natural** `(edicion, nombre, apellido_paterno, apellido_materno, fecha_nacimiento)` que es el que rechaza duplicados en 409.

### 2.2 · Resto de tablas

```python
class Aviso(SQLModel, table=True):
    id: int | None; clave: str            # "012", el folio visible
    fecha: str                            # ISO YYYY-MM-DD
    tipo: str                             # convocatoria|logistica|resultados|patrocinadores
    titulo: str
    cuerpo: str                           # NOT NULL y no vacío — se valida en el servidor
    imagen: str | None
    imagen_alt: str | None                # obligatorio si hay imagen
    enlace_texto: str | None; enlace_url: str | None
    fijado: bool = False
    vigente_hasta: str | None
    publicado: bool = True

class Lugar(SQLModel, table=True):        # hospedaje y comida
    id: int | None; tipo: str             # 'hotel' | 'comida'
    nombre: str; descripcion: str
    direccion: str | None; telefono: str | None
    mapa_url: str | None; imagen: str | None; imagen_alt: str | None
    convenio: str | None                  # tarifa acordada con el evento
    patrocinador: bool = False
    orden: int = 0

class PublicacionResultados(SQLModel, table=True):
    id: int | None; edicion: int
    version: int                          # sube en cada publicación
    generado_en: str                      # el del archivo del host
    publicado_en: datetime; publicado_por: str
    parcial: bool; nota_parcial: str | None
    json_crudo: str                       # lo recibido, TAL CUAL, sin tocar
    reporte_validacion: str               # JSON del reporte
    activa: bool                          # solo una por edición
    total_corredores: int; total_marcados: int

class Usuario(SQLModel, table=True):
    id: int | None; usuario: str          # unique
    hash_contrasena: str                  # argon2id
    nombre: str; rol: str                 # 'admin' | 'comite'
    activo: bool = True
    intentos_fallidos: int = 0
    bloqueado_hasta: datetime | None
    ultimo_acceso: datetime | None

class Bitacora(SQLModel, table=True):
    id: int | None; ocurrido_en: datetime
    usuario: str; accion: str             # 'pago.verificar', 'resultados.publicar', ...
    entidad: str; entidad_id: str
    detalle: str | None                   # JSON, SIN datos personales
    ip: str | None
```

`json_crudo` guarda lo recibido sin normalizar. Es lo que hace **reversible** una publicación: volver a la versión anterior es reescribir el estático desde el crudo de esa versión.

---

## 3. Endpoints

### 3.1 · Públicos

| Método | Ruta | Entrada | Salida |
|---|---|---|---|
| `GET` | `/api/salud` | — | `{"estado":"ok","version":"1.2.0","bd":"ok"}` |
| `GET` | `/api/resultados/{anio}` | — | **302 → el estático.** No consulta la BD |
| `GET` | `/api/anuncios` | — | **302 → el estático** |
| `GET` | `/api/hospedaje` | — | **302 → el estático** |
| `POST` | `/api/registros` | `PayloadRegistro` (§3.2) | `201 {folio, estado, monto_esperado, datos_pago}` |
| `GET` | `/api/registros/{folio}` | `?fnac=DD/MM/AAAA` | `200` vista mínima (§3.3) |

Los tres `GET` de datos existen **solo por compatibilidad de nombres**: redirigen al archivo. Se documenta que el consumo correcto es el estático directo, que es lo que el sitio ya hace.

### 3.2 · `POST /api/registros`

**Acepta la forma anidada que el front YA envía** (`src/types/registro.ts`), no una plana:

```jsonc
{
  "folio": "RPB2026-000123",      // se IGNORA: lo emite el servidor
  "creado_en": "2026-03-15T10:22:31-06:00",
  "participante": { "nombre","apellido_paterno","apellido_materno",
                    "fecha_nacimiento":"DD/MM/AAAA","edad_nominal","sexo",
                    "equipo","email","telefono" },
  "competencia":  { "categoria_id","categoria_clave","categoria_nombre",
                    "ruta","tipo_bicicleta" },
  "kit":          { "nombre","precio","talla_jersey" },
  "emergencia":   { "nombre","telefono","tipo_sangre" },
  "consentimiento": { "deslinde","privacidad" },
  "origen": "web"
}
```

**Validación server-side, en este orden:**

1. **Forma** — Pydantic. `fecha_nacimiento` con `DD/MM/AAAA` estricto (ojo: el motor TS parsea `YYYY-MM-DD`; el payload viaja `DD/MM/AAAA`. Es el error fácil de este puente).
2. **Campos** — teléfono exactamente 10 dígitos; correo con formato; nombres sin números (mismo regex que el front); `deslinde` y `privacidad` en `true` o se rechaza.
3. **Edad nominal** — `anio_evento − anio_nacimiento`. **No** es la edad cumplida. Se recalcula en el servidor y si no coincide con la que mandó el cliente, manda la del servidor.
4. **Elegibilidad** — se re-corre `categorias_elegibles()` (§4). Si la `categoria_id` recibida no está entre recomendada + alternativas → **422** con las que sí aplican.
5. **Ruta** — contra `MAPA_RUTAS[grupo]`. Infantiles solo `'infantil'`.
6. **Kit y talla** — el kit debe existir; si incluye jersey, la talla es obligatoria y de la escala vigente (**ver §9, conflicto abierto**).
7. **Menor de edad** — si `edad_nominal < 18`: `tutor_nombre`, `tutor_telefono` y `consentimiento_tutor` obligatorios. Sin ellos, **422**. (**Ver §9: hoy el front no los manda.**)
8. **Duplicado** — clave natural `(edicion, nombre completo, fecha_nacimiento)` → **409** con el folio existente. Nunca un segundo registro.

**Respuesta 201:**
```json
{ "folio": "RPB2026-000123-7K9F",
  "estado": "pendiente",
  "monto_esperado": 750,
  "datos_pago": { "banco":"BanCoppel", "beneficiario":"…", "clabe":"…",
                  "instruccion":"Manda tu comprobante por WhatsApp…" } }
```
`datos_pago` **nunca** incluye número de tarjeta (PROMPT 05 §1.1).

### 3.3 · `GET /api/registros/{folio}` — no puede ser una fuga del padrón

**Decisión: las dos defensas a la vez.**

1. **Folio con sufijo aleatorio.** `RPB2026-000123-7K9F` — 4 caracteres de un alfabeto sin ambigüedades (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, sin `0/O/1/I`), de `secrets.choice`. 32⁴ ≈ 1.05 M por consecutivo.
2. **Segundo factor obligatorio.** `?fnac=DD/MM/AAAA` debe coincidir. Sin él o con él mal → **404**, nunca 403 (un 403 confirma que el folio existe).

Dos defensas y no una porque el consecutivo sigue siendo enumerable: el sufijo evita el barrido, la fecha evita que un folio filtrado en una captura de WhatsApp sirva a un tercero.

**Devuelve solo esto:**
```json
{ "folio","nombre_completo","categoria_nombre","categoria_clave",
  "ruta","kit_nombre","estado","creado_en" }
```
**Nunca** `email`, `telefono`, `emergencia_*`, `tipo_sangre`, `notas` ni datos del tutor. La ruta lleva además su propio rate limit (§8): 10/min por IP.

### 3.4 · Admin (sesión obligatoria, HTML server-side)

```
GET  /admin/entrar          POST /admin/entrar          POST /admin/salir
GET  /admin/                          → conciliación (§5.1), pantalla inicial
POST /admin/registros/{folio}/pagar   → marcar pagado + referencia + quién
POST /admin/registros/{folio}/cancelar
GET  /admin/padron                    → tabla con búsqueda y filtros
GET  /admin/export/padron.csv         ?incluir_pendientes=0|1
GET  /admin/export/padron.db
GET|POST /admin/anuncios[/{id}]       → alta y edición
GET|POST /admin/hospedaje[/{id}]
GET  /admin/resultados                → historial de publicaciones
POST /admin/resultados/subir          → valida y muestra reporte, NO publica
POST /admin/resultados/publicar       → escribe el estático, sube versión
POST /admin/resultados/revertir/{v}   → reactiva una versión previa
GET  /admin/bitacora
POST /admin/respaldo                  → respaldo manual bajo demanda
```

`POST /api/resultados` (§6.3) es la variante por token para subir desde el host sin abrir el navegador.

---

## 4. El motor de categorías en Python

Puerto 1:1 de `src/lib/categorias.ts`. **Misma lógica, mismo orden, mismos casos borde.** El catálogo de 28 categorías se genera desde `src/data/categorias.ts` a un `categorias.py`, con un test que falla si divergen.

Reglas que hay que portar sin suavizar:

- `edad_nominal = anio_evento − anio_nacimiento`.
- Fuera de `3..99` → sin categoría.
- `edad ≤ 12` → solo Infantiles; sin alternativas.
- `tipo_bicicleta == 'E-Bike'` → **solo** categorías con `requiereEbike`; `recomendada = None` y todo va en `alternativas`.
- La recomendada es la de **rango de edad más estrecho** entre las que cubren la edad (el `sort` por amplitud del TS).
- Alternativas abiertas: excluye E-Bike; *Mamut's* solo con `peso_90_mas`; Elite desde 16; Rodadores desde 13.

**Casos de prueba compartidos** (los mismos que ya pasan en TS):

| Entrada | Esperado |
|---|---|
| `14/08/1992`, `M`, MTB, 2026 | edad 34 → **Máster 30 Varonil** |
| mujer con 17 nominales | **hueco documentado**: no hay categoría femenil 16–18. `sinCoincidencia = true` y alternativas (Elite `Y`, Rodadoras `RF`) |
| cualquiera con `E-Bike` | solo categorías E-Bike; `recomendada = None` |
| 4 años, `F` | Infantil Pañales Femenil (`Pf`), sin alternativas |
| 34, `M`, MTB, `peso_90_mas=False` | *Mamut's* **no** aparece en alternativas |
| 34, `M`, MTB, `peso_90_mas=True` | *Mamut's* sí aparece |

La prueba de oro: un archivo de casos en JSON, consumido por el test de TS **y** por el de Python. Si divergen, falla en CI, no en la carrera.

---

## 5. Validador de resultados — las siete reglas

Entrada: el JSON del host. Salida: `(resultados_normalizados, reporte)`.

```python
class Hallazgo(BaseModel):
    regla: int                 # 1..7
    categoria_id: str          # "N-80"
    dorsal: int | None
    severidad: str             # 'marca' | 'aviso'
    mensaje: str               # va a `nota` del corredor
    accion: str                # 'REVISION' | 'SIN_TIEMPO' | 'normalizado' | 'ninguna'
```

| # | Regla | Acción |
|---|---|---|
| 1 | Tiempo estricto `HH:MM:SS.CC` | Normaliza lo recuperable (`H:MM:SS.C`), rechaza el resto → `REVISION` |
| 2 | Sin posiciones repetidas ni fuera de rango dentro de `categoria+ruta` | `REVISION` a los implicados. **Los huecos se reportan pero NO se renumeran** |
| 3 | Ningún tiempo menor al del 1º con posición mayor | `REVISION` |
| 4 | `vueltas_hechas < vueltas_totales` ⟹ sin posición ni tiempo | Si los tiene → `REVISION` |
| 5 | Vueltas completas sin tiempo | `SIN_TIEMPO`, nunca `OK` |
| 6 | Dorsal único por edición | `REVISION` a todas las apariciones |
| 7 | Nombre no vacío | `REVISION`, se conserva «(sin nombre)» |

**La validación no bloquea.** Publica todo, marca lo dudoso, entrega el reporte. Con 800 corredores y la gente esperando en la meta, «todo o nada» significa no publicar nada — y en la 4ª edición eso habría dejado fuera al campeón de Máster 50, que terminó sin tiempo.

**Un hueco NO se cierra.** `N-40` no tiene posición 32 y `Y-80` no tiene 2ª lugar. Renumerar sería inventar un resultado. Se reporta y se publica como viene.

**Prueba de aceptación de la Fase 2 — dos fixtures, cada uno con su papel:**

**Fixture A — `resultados-2026.json`, los datos reales.** El validador reproduce **exactamente 32 marcas**: 15 `REVISION` (con su motivo) y 17 `SIN_TIEMPO`. Ni una más. R1 devuelve **0** hallazgos, y eso es lo correcto.

**Fixture B — sintético, el termómetro de verdad.** Se construye con los errores crudos que la regla 1 debe cazar, incluidos los 7 originales de los PDF:

```text
04:05:48:71   05:45:25:74   03:16:05:69   05.08:02.70
 5:35:45.95   04:22.07.63   04:04.25.23
```

Más un dorsal duplicado, una posición faltante y un nombre vacío. **Este es el archivo contra el que se mide el validador**, no el real.

**Idempotencia (criterio de aceptación):** `validar(validar(x)) == validar(x)`. Validar dos veces no acumula notas, no escala estados y no duplica marcas.

---

## 6. Seguridad

### 6.1 · Admin
- **argon2id** vía `passlib` (`bcrypt` como alternativa). Nunca `hashlib` a mano.
- Sesión en cookie firmada: `HttpOnly`, `Secure`, `SameSite=Strict`, expiración 8 h.
- **CSRF** por token en todos los `POST` del admin (patrón sincronizador).
- Bloqueo tras **5** intentos fallidos, 15 min, por usuario.
- Usuarios creados **por CLI** (`python -m app.cli crear-usuario`). Sin registro público.

### 6.2 · Cabeceras y transporte
HTTPS obligatorio · HSTS · `X-Content-Type-Options: nosniff` · `X-Frame-Options: DENY` · CSP básica en el admin · **CORS restringido al dominio del sitio**, jamás `*`.

### 6.3 · `POST /api/resultados`
Header `X-Auth-Token` contra un secreto de entorno, comparado con `secrets.compare_digest` (tiempo constante). Registra en `Bitacora` y limita a 5/hora.

> **A CONFIRMAR:** el encargo pide «mismo esquema que el RPC» y ese documento no está (§0.1). Si el RPC usa HMAC del cuerpo con secreto compartido en vez de token plano, esto cambia. **No se implementa hasta tener el documento.**

---

## 7. Hosting y persistencia de SQLite

**Recomendación: VPS pequeño con disco propio** (Hetzner CX22, DigitalOcean, o similar) con NGINX al frente. ~4–6 €/mes.

Motivo: el encargo advierte que SQLite necesita volumen persistente. En plataformas de contenedores efímeros (Render free, Railway sin volumen, Heroku, Vercel, Cloud Run) **el primer redeploy borra las inscripciones**. Un VPS elimina la clase entera de problema, y además NGINX sirve los estáticos —que es la ruta caliente— sin pasar por Python.

**La verificación es obligatoria antes de decidir**, y es esta:

```bash
# 1. desplegar   2. crear un registro de prueba   3. forzar un redeploy
# 4. consultar el mismo folio
curl "https://api.../api/registros/RPB2026-000001-XXXX?fnac=01/01/1990"
```
Si tras el redeploy responde **404**, el disco es efímero y **esa plataforma queda descartada**. No se da por buena la documentación del proveedor: se prueba.

**Disposición en disco:**
```
/srv/retopuma/
  app/                      código
  datos/reto.db             SQLite (WAL activado)
  publico/data/*.json       estáticos que sirve NGINX
  respaldos/                fuera del disco de la BD (§8)
```

---

## 8. Operación

- **Respaldo diario** por `cron`: `sqlite3 .backup` (consistente en caliente, a diferencia de copiar el archivo), cifrado con `age`, subido a almacenamiento externo. Retención 30 días.
- **Respaldo manual** desde el admin antes de cada importación o publicación.
- **La restauración se prueba**, no se supone: un `restaurar.sh` que baja el último respaldo, lo descifra, lo abre y cuenta los registros. Es un criterio de aceptación.
- **Rate limiting** en `POST /api/registros`: 5/hora por IP y 200/hora global, más **honeypot** (campo señuelo oculto) en vez de captcha.
- **Logs con rotación y SIN datos personales.** Se registra folio y categoría; nunca nombre, teléfono, correo ni tipo de sangre.
- `GET /api/salud` para monitoreo.

---

## 9. Conflictos de contrato con el frontend — RESUELTOS

Siete puntos donde el encargo y el sitio construido no coincidían. Todos decididos.

| # | Conflicto | Decisión |
|---|---|---|
| 1 | **Tallas incompatibles.** `src/types/registro.ts` usa `CH·M·G·XG·2XG`; Colección publica `XS·S·M·L·XL·2XL·3XL` | Gana la **escala mexicana**, ampliada: `CH · M · G · XG · 2XG · 3XG-4XG`. Es la del formulario ya publicado y la del proveedor local. Se guarda el **código**, no la etiqueta, para poder remapear. *Colección se corrige: cambio pendiente del front* |
| 2 | **El folio lo genera el cliente** con `Math.random()` (`PaginaInscripciones.tsx:326`) | **El servidor lo emite.** Si el cliente manda `folio`, se descarta **en silencio** — no es un error del usuario |
| 3 | **El front no tiene bloque de tutor** | Los campos existen desde Fase 1, **nullables**. La exigencia vive en el flag `EXIGIR_TUTOR = False`; se activa cambiando una línea el día que el front entregue el bloque. **Sin despliegues simultáneos** |
| 4 | **Formato de fecha cruzado.** El payload viaja `DD/MM/AAAA`; `edadNominal()` en TS parsea `YYYY-MM-DD` | El puerto en Python parsea `DD/MM/AAAA` en el borde, con test de ida y vuelta |
| 5 | **`peso_90_mas` no está en el modelo** pero el motor lo necesita para *Mamut's* | Se agrega (§2.1) |
| 6 | **Consentimiento sin constancia** | Se agregan `privacidad_aceptada_en` y `aviso_privacidad_version` (§2.1) |
| 7 | **Dos catálogos de categorías** (28 en el front, 21 en resultados con 3 provisionales) | El catálogo del cronometraje manda. **Pendiente de reconciliar con el comité**; no bloquea Fase 1 |

**`edad_nominal` almacenada es registro histórico, NO caché.** Es la edad con la que se asignó la categoría al inscribir. Si `anio_evento` cambia, **no se recalcula**: se conserva lo que se usó.

### 9.1 · Tipo de sangre — decisión operativa

Se **conserva**, opcional y nunca obligatorio, con estas restricciones:

- **Fuera del export general del padrón.** Solo en un export específico marcado *«uso del servicio médico»*, con su propia entrada en `Bitacora` cada vez que se genera.
- Nunca en `GET /api/registros/{folio}` ni en ninguna vista pública.
- Campo **aislado**, para poder eliminarlo con una migración de una línea.

Razón de conservarlo: evento de montaña con ~950 participantes y traslado hospitalario a Pachuca. Si el servicio médico lo usa, quitarlo es un retroceso de seguridad; volver a pedirlo a 950 personas cuesta mucho más que aislarlo.

**Pendiente del comité, no bloqueante:** ¿el servicio médico lo consulta, o se imprime en el brazalete? Si es no a las dos, se elimina.

---

## 10. Dependencias

| Paquete | Para qué | Por qué no otra cosa |
|---|---|---|
| `fastapi` | API y validación | Pedido por el encargo. Pydantic da el espejo de los `interface` de TS |
| `uvicorn[standard]` | Servidor ASGI | Estándar de facto |
| `sqlmodel` | ORM + Pydantic en un modelo | Pedido por el encargo. Evita duplicar modelo y esquema |
| `jinja2` | Plantillas del admin | Pedido. Cinco pantallas, tres usuarios: HTML server-side, sin build |
| `python-multipart` | Formularios y subida del JSON | Requisito de FastAPI para `multipart/form-data` |
| `passlib[argon2]` | Hash de contraseñas | §5 exige argon2/bcrypt y prohíbe hacerlo a mano |
| `itsdangerous` | Firma de cookie de sesión y token CSRF | Ya es dependencia transitiva de Starlette |
| `slowapi` | Rate limiting | Alternativa: escribirlo con SQLite. **Se decide en Fase 4**, no ahora |

**No se agregan:** Alembic (SQLite + `ALTER TABLE` defensivo alcanza a esta escala), Celery, Redis, Postgres, ni pasarela de pagos.
**Desarrollo:** `pytest`, `httpx`, `ruff`.

---

## 11. Qué se construye en cada fase

| Fase | Entrega | Prueba que la cierra |
|---|---|---|
| **1 · Núcleo** | Modelos, `POST /api/registros` completo, consulta por folio, CSV del padrón, motor de categorías portado | Los 6 casos compartidos dan igual en Python y TS; el CSV abre en Excel es-MX con acentos |
| **2 · Resultados** | Las 7 reglas, versionado, JSON estático, reversión | Reproduce los 32 marcados de `resultados-2026.json`; idempotente; R1 = 0 |
| **3 · Admin** | Autenticación, conciliación, padrón, anuncios, hospedaje, publicación, bitácora | Un aviso sin cuerpo se rechaza; toda acción queda en bitácora |
| **4 · Endurecimiento** | Rate limiting, respaldos, logs, salud, CORS, cabeceras, `.db`, aviso de privacidad, menores | **Restauración de respaldo probada de verdad**; logs sin datos personales |

---

## 12. Lo que este plan NO hace

Sincronización en vivo con el host · pasarela de pagos · cuentas de corredor · admin como SPA ·
tocar el frontend · renombrar campos del contrato de cronometraje · guardar el número de tarjeta del comité.
