"""Modelos de la base. Fase 1: solo `Registro` y `Bitacora`.

Los campos del bloque «espejo» llevan EXACTAMENTE los nombres de la tabla
`participantes` del sistema de cronometraje. No se traducen ni se mejoran: si
cambian, la importación al host se rompe.

`numero_corredor` NO existe aquí a propósito. Lo asigna el comité al entregar
el kit, dentro del sistema de cronometraje. Duplicar la fuente de verdad de los
dorsales es la vía más rápida a corromper los resultados.
"""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, SQLModel

ESTADOS_REGISTRO = ("pendiente", "pagado", "cancelado")


class Registro(SQLModel, table=True):
    __tablename__ = "registro"

    id: int | None = Field(default=None, primary_key=True)
    folio: str = Field(unique=True, index=True)  # RPB2026-000123-7K9F
    creado_en: datetime
    edicion: int = Field(index=True)

    # ---- espejo de `participantes` del host — NO RENOMBRAR ----------------
    nombre: str
    apellido_paterno: str
    apellido_materno: str | None = None
    fecha_nacimiento: str  # DD/MM/AAAA, como en el host
    sexo: str  # 'M' | 'F'
    equipo: str | None = None
    categoria_id: int
    categoria_clave: str
    ruta: str  # '40' | '80' | 'infantil'
    tipo_bicicleta: str  # 'MTB' | 'E-Bike'

    # ---- no viaja al host --------------------------------------------------
    email: str
    telefono: str
    kit_nombre: str
    kit_precio: int
    talla_jersey: str | None = None  # CÓDIGO de talla, no la etiqueta
    emergencia_nombre: str
    emergencia_telefono: str
    # Dato SENSIBLE. Opcional, nunca obligatorio, fuera del export general del
    # padrón y fuera de toda vista pública. Aislado a propósito para poder
    # eliminarlo con una migración de una línea si el comité confirma que el
    # servicio médico no lo usa.
    tipo_sangre: str | None = None

    # ---- reglas de negocio que hay que poder auditar después --------------
    # Habilita Mamut's. Sin esto el servidor no puede re-verificar la categoría.
    peso_90_mas: bool = False
    # REGISTRO HISTÓRICO, no caché: es la edad con la que se asignó la
    # categoría al inscribir. Si `ANIO_EVENTO` cambia, NO se recalcula.
    edad_nominal: int

    # ---- estado administrativo ---------------------------------------------
    estado: str = Field(default="pendiente", index=True)
    # La MISMA referencia puede repetirse en varios registros: en eventos
    # locales es común que alguien de un club transfiera por ocho corredores en
    # un solo movimiento, o que un papá pague por él y sus dos hijos.
    pago_referencia: str | None = Field(default=None, index=True)
    # Lo que de verdad entró, separado del precio del kit. Sin esto, el «dinero
    # por cobrar» asume que todos pagan exactamente el precio, y eso no
    # sobrevive al primer depósito con comisión ni al que transfirió de más.
    monto_recibido: int | None = None
    pago_verificado_por: str | None = None
    pago_verificado_en: datetime | None = None
    notas: str | None = None

    # ---- consentimiento ----------------------------------------------------
    deslinde: bool = False
    privacidad: bool = False
    privacidad_aceptada_en: datetime | None = None
    aviso_privacidad_version: str | None = None

    # ---- menores -----------------------------------------------------------
    # Nullables desde Fase 1 aunque el front todavía no los mande: la exigencia
    # vive en `config.EXIGIR_TUTOR`, no en el esquema.
    es_menor: bool = False
    tutor_nombre: str | None = None
    tutor_telefono: str | None = None
    consentimiento_tutor: bool = False


class PublicacionResultados(SQLModel, table=True):
    """Cada publicación de resultados, versionada.

    Se guardan TRES cosas, y la distinción importa:

    · `json_crudo`      — lo que mandó el cronometraje, sin tocar.
    · `json_publicado`  — exactamente lo que se sirvió en el sitio.
    · `validador_version` — con qué reglas se produjo lo publicado.

    Están separados porque **revertir** y **revalidar** son dos intenciones
    distintas y fusionarlas produce versiones que nunca existieron:

    · Revertir restaura `json_publicado` TAL CUAL. Si alguien tiene una captura
      de pantalla donde aparece en 3º, al revertir sigue en 3º. En un evento
      donde la gente sube su resultado al grupo de WhatsApp, esto no es un
      detalle: una v1 «mejorada» por un validador nuevo es una v1 que nunca
      estuvo publicada, y no hay forma de explicarle a alguien por qué cambió.
    · Revalidar reprocesa `json_crudo` con el validador actual y crea una
      versión NUEVA. Nunca sobrescribe.
    """

    __tablename__ = "publicacion_resultados"

    id: int | None = Field(default=None, primary_key=True)
    edicion: int = Field(index=True)
    version: int
    generado_en: str  # el que trae el archivo del host
    publicado_en: datetime
    publicado_por: str
    parcial: bool = False
    nota_parcial: str | None = None
    json_crudo: str  # lo recibido del host, TAL CUAL
    json_publicado: str  # lo que se sirvió: es lo que restaura revertir
    validador_version: str  # con qué reglas se produjo `json_publicado`
    reporte_validacion: str  # JSON del reporte
    activa: bool = Field(default=False, index=True)
    total_corredores: int = 0
    total_marcados: int = 0
    # Si vino de revalidar, de qué versión salió. `None` si es una subida.
    origen_version: int | None = None


class Aviso(SQLModel, table=True):
    """Comunicado del comité. Alimenta `public/data/anuncios.json`.

    REGLA QUE SE HACE CUMPLIR AQUÍ: `cuerpo` con texto real es obligatorio,
    aunque el aviso traiga imagen. Google no lee un flyer, un lector de
    pantalla tampoco, y a 360px un flyer cuadrado se lee mal. Y si hay
    `imagen`, `imagen_alt` es obligatorio.
    """

    __tablename__ = "aviso"

    id: int | None = Field(default=None, primary_key=True)
    clave: str = Field(unique=True, index=True)  # "012", el folio visible
    fecha: str  # ISO YYYY-MM-DD
    tipo: str  # convocatoria | logistica | resultados | patrocinadores
    titulo: str
    cuerpo: str
    imagen: str | None = None
    imagen_alt: str | None = None
    enlace_texto: str | None = None
    enlace_url: str | None = None
    fijado: bool = False
    vigente_hasta: str | None = None
    publicado: bool = True
    actualizado_en: datetime | None = None


class Lugar(SQLModel, table=True):
    """Hospedaje y comida. Alimenta `public/data/hospedaje.json`."""

    __tablename__ = "lugar"

    id: int | None = Field(default=None, primary_key=True)
    tipo: str = Field(default="hotel", index=True)  # 'hotel' | 'comida'
    nombre: str
    descripcion: str
    direccion: str | None = None
    telefono: str | None = None
    mapa_url: str | None = None
    imagen: str | None = None
    imagen_alt: str | None = None
    convenio: str | None = None  # tarifa acordada con el evento
    patrocinador: bool = False
    orden: int = 0
    publicado: bool = True


class SubidaResultados(SQLModel, table=True):
    """Un archivo de resultados subido al panel, antes de decidir qué hacer.

    Existe porque **nada se publica sin que alguien haya visto el reporte**:
    primero se sube y se valida, después se publica o se descarta. El crudo se
    guarda en LOS DOS casos — si alguien sube un archivo malo y lo descarta,
    queremos saber que pasó.
    """

    __tablename__ = "subida_resultados"

    id: int | None = Field(default=None, primary_key=True)
    edicion: int = Field(index=True)
    subido_por: str
    subido_en: datetime
    nombre_archivo: str
    json_crudo: str
    reporte_validacion: str
    total_corredores: int = 0
    total_marcados: int = 0
    resultado: str = Field(default="pendiente", index=True)  # pendiente|publicada|descartada
    publicacion_id: int | None = None
    motivo_descarte: str | None = None


class Usuario(SQLModel, table=True):
    """Usuarios del panel. Se crean por CLI: no hay registro público."""

    __tablename__ = "usuario"

    id: int | None = Field(default=None, primary_key=True)
    usuario: str = Field(unique=True, index=True)
    hash_contrasena: str  # argon2id — nunca la contraseña
    nombre: str
    rol: str = "comite"  # 'admin' | 'comite'
    activo: bool = True
    # Bloqueo por intentos fallidos: sin esto, una contraseña débil de un
    # comité de voluntarios se adivina por fuerza bruta en una tarde.
    intentos_fallidos: int = 0
    bloqueado_hasta: datetime | None = None
    ultimo_acceso: datetime | None = None


class Bitacora(SQLModel, table=True):
    """Auditoría. En un evento con dinero de por medio y varias personas del
    comité tocando el sistema, la bitácora resuelve discusiones.

    `detalle` es JSON y NUNCA lleva datos personales: folio y categoría sí,
    nombre, teléfono, correo y tipo de sangre no.
    """

    __tablename__ = "bitacora"

    id: int | None = Field(default=None, primary_key=True)
    ocurrido_en: datetime
    usuario: str
    accion: str = Field(index=True)  # 'registro.crear', 'padron.exportar', ...
    entidad: str
    entidad_id: str
    detalle: str | None = None
    ip: str | None = None
