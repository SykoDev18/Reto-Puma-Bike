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
    pago_referencia: str | None = None
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
