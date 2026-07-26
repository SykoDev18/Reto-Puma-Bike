"""Esquemas de la API. Espejo de `src/types/registro.ts`.

El front YA envía esta forma ANIDADA (participante / competencia / kit /
emergencia / consentimiento). La API la acepta tal cual: cambiarla obligaría a
tocar el front, y el front no se toca.
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Mismo regex de nombres que `src/lib/registro.ts`.
LETRAS = re.compile(r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\s-]+$")
CORREO = re.compile(r"^\S+@\S+\.\S+$")
DDMMAAAA = re.compile(r"^\d{2}/\d{2}/\d{4}$")


def solo_digitos(valor: str, max_largo: int = 10) -> str:
    return re.sub(r"\D", "", valor)[:max_largo]


class _Base(BaseModel):
    # Rechaza campos que no están en el contrato: si el front empieza a mandar
    # algo nuevo, se entera aquí y no en producción.
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class PayloadParticipante(_Base):
    nombre: str = Field(min_length=1, max_length=80)
    apellido_paterno: str = Field(min_length=1, max_length=80)
    apellido_materno: str = Field(default="", max_length=80)
    fecha_nacimiento: str  # DD/MM/AAAA
    edad_nominal: int
    sexo: Literal["M", "F"]
    equipo: str = Field(default="", max_length=80)
    email: str = Field(max_length=120)
    telefono: str

    @field_validator("nombre", "apellido_paterno")
    @classmethod
    def _sin_numeros(cls, v: str) -> str:
        if not LETRAS.match(v):
            raise ValueError("no puede llevar números ni símbolos")
        return v

    @field_validator("apellido_materno")
    @classmethod
    def _materno_opcional(cls, v: str) -> str:
        if v and not LETRAS.match(v):
            raise ValueError("no puede llevar números ni símbolos")
        return v

    @field_validator("fecha_nacimiento")
    @classmethod
    def _forma_de_fecha(cls, v: str) -> str:
        if not DDMMAAAA.match(v):
            raise ValueError("debe venir como DD/MM/AAAA")
        return v

    @field_validator("email")
    @classmethod
    def _correo(cls, v: str) -> str:
        if not CORREO.match(v):
            raise ValueError("correo inválido")
        return v

    @field_validator("telefono")
    @classmethod
    def _diez_digitos(cls, v: str) -> str:
        d = solo_digitos(v)
        if len(d) != 10:
            raise ValueError("deben ser 10 dígitos")
        return d


class PayloadCompetencia(_Base):
    categoria_id: int
    categoria_clave: str
    categoria_nombre: str
    ruta: Literal["infantil", "40", "80"]
    tipo_bicicleta: Literal["MTB", "E-Bike"]


class PayloadKit(_Base):
    nombre: str
    precio: int = Field(ge=0)
    talla_jersey: str | None = None


class PayloadEmergencia(_Base):
    nombre: str = Field(min_length=1, max_length=80)
    telefono: str
    tipo_sangre: str | None = None

    @field_validator("telefono")
    @classmethod
    def _diez_digitos(cls, v: str) -> str:
        d = solo_digitos(v)
        if len(d) != 10:
            raise ValueError("deben ser 10 dígitos")
        return d


class PayloadConsentimiento(_Base):
    deslinde: bool
    privacidad: bool


class PayloadTutor(_Base):
    """Todavía NO lo manda el front. Existe desde ahora para que activar
    `EXIGIR_TUTOR` sea cambiar una línea, no desplegar dos cosas a la vez."""

    nombre: str = Field(min_length=1, max_length=120)
    telefono: str
    consentimiento: bool

    @field_validator("telefono")
    @classmethod
    def _diez_digitos(cls, v: str) -> str:
        d = solo_digitos(v)
        if len(d) != 10:
            raise ValueError("deben ser 10 dígitos")
        return d


class PayloadRegistro(_Base):
    # El cliente puede mandarlo; se IGNORA. El servidor emite el suyo.
    folio: str | None = None
    creado_en: str | None = None
    participante: PayloadParticipante
    competencia: PayloadCompetencia
    kit: PayloadKit
    emergencia: PayloadEmergencia
    consentimiento: PayloadConsentimiento
    tutor: PayloadTutor | None = None
    peso_90_mas: bool = False
    origen: Literal["web", "whatsapp", "admin"] = "web"


# --------------------------------------------------------------------------
# Respuestas
# --------------------------------------------------------------------------


class DatosPago(BaseModel):
    """Lo que se le dice a la persona para que transfiera.

    NUNCA incluye número de tarjeta. Para recibir un depósito basta la CLABE;
    una tarjeta publicada habilita cargos en comercios que solo piden número y
    vencimiento.
    """

    banco: str
    beneficiario: str
    cuenta: str
    clabe: str
    instruccion: str


class RespuestaRegistro(BaseModel):
    folio: str
    estado: str
    monto_esperado: int
    datos_pago: DatosPago


class RespuestaConsulta(BaseModel):
    """Vista MÍNIMA del propio registro.

    Deliberadamente sin `email`, `telefono`, `emergencia_*`, `tipo_sangre`,
    `notas` ni datos del tutor: esta ruta es pública y no puede ser una fuga
    del padrón.
    """

    folio: str
    nombre_completo: str
    categoria_clave: str
    categoria_nombre: str
    ruta: str
    kit_nombre: str
    estado: str
    creado_en: str


class CategoriaOfrecida(BaseModel):
    id: int
    clave: str
    nombre: str


class ErrorElegibilidad(BaseModel):
    """422 cuando la categoría recibida no es de las que el motor ofrece.

    Se devuelven las que sí aplican para que el front pueda corregir sin
    adivinar.
    """

    detalle: str
    edad_nominal: int | None
    recomendada: CategoriaOfrecida | None
    alternativas: list[CategoriaOfrecida]
