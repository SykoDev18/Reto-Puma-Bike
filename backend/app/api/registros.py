"""Rutas públicas de inscripción."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlmodel import Session

from .. import config
from ..bd import anotar, sesion
from ..dominio import registros as servicio
from ..dominio.categorias import catalogo
from ..dominio.registros import ErrorRegistro
from ..esquemas import (
    CategoriaOfrecida,
    DatosPago,
    PayloadRegistro,
    RespuestaConsulta,
    RespuestaRegistro,
)

router = APIRouter(prefix="/api", tags=["registros"])

# SIN número de tarjeta, en ningún caso. Ver PROMPT 05 §1.1.
DATOS_PAGO = DatosPago(
    banco="BanCoppel",
    beneficiario="Laura Delia Bastida González",
    cuenta="10046851116",
    clabe="137463100468511169",
    instruccion="Manda tu comprobante por WhatsApp con tu nombre completo y categoría.",
)


def obtener_sesion():
    with sesion() as s:
        yield s


# Los códigos que NO son culpa del cliente-formulario sino de elegibilidad
# reciben 422 con el detalle de qué sí se puede elegir.
_ESTADOS = {
    "duplicado": status.HTTP_409_CONFLICT,
    "fecha_invalida": status.HTTP_422_UNPROCESSABLE_CONTENT,
    "edad_fuera_de_rango": status.HTTP_422_UNPROCESSABLE_CONTENT,
    "categoria_inexistente": status.HTTP_422_UNPROCESSABLE_CONTENT,
    "categoria_no_elegible": status.HTTP_422_UNPROCESSABLE_CONTENT,
    "clave_inconsistente": status.HTTP_422_UNPROCESSABLE_CONTENT,
    "ruta_no_permitida": status.HTTP_422_UNPROCESSABLE_CONTENT,
    "talla_invalida": status.HTTP_422_UNPROCESSABLE_CONTENT,
    "sin_consentimiento": status.HTTP_422_UNPROCESSABLE_CONTENT,
    "falta_tutor": status.HTTP_422_UNPROCESSABLE_CONTENT,
}


def _cuerpo_error(e: ErrorRegistro) -> dict:
    cuerpo: dict = {"codigo": e.codigo, "detalle": e.mensaje}
    if e.codigo == "duplicado":
        cuerpo["folio"] = e.extra.get("folio")
        cuerpo["estado"] = e.extra.get("estado")
    if e.codigo == "categoria_no_elegible":
        rec = e.extra.get("recomendada")
        cuerpo["edad_nominal"] = e.extra.get("edad_nominal")
        cuerpo["recomendada"] = (
            CategoriaOfrecida(id=rec.id, clave=rec.clave, nombre=rec.nombre).model_dump()
            if rec
            else None
        )
        cuerpo["alternativas"] = [
            CategoriaOfrecida(id=a.id, clave=a.clave, nombre=a.nombre).model_dump()
            for a in e.extra.get("alternativas", [])
        ]
    if e.codigo in ("ruta_no_permitida", "talla_invalida"):
        cuerpo.update(e.extra)
    return cuerpo


@router.post(
    "/registros",
    response_model=RespuestaRegistro,
    status_code=status.HTTP_201_CREATED,
)
def crear_registro(
    payload: PayloadRegistro,
    peticion: Request,
    s: Session = Depends(obtener_sesion),
) -> RespuestaRegistro:
    # El cierre se controla por configuración: apagar el servidor no puede ser
    # la forma de dejar de recibir inscripciones.
    if not config.INSCRIPCIONES_ABIERTAS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"codigo": "inscripciones_cerradas", "detalle": config.MENSAJE_CERRADO},
        )
    try:
        registro = servicio.crear(s, payload)
    except ErrorRegistro as e:
        raise HTTPException(
            status_code=_ESTADOS.get(e.codigo, status.HTTP_400_BAD_REQUEST),
            detail=_cuerpo_error(e),
        ) from e

    # Bitácora SIN datos personales: folio y categoría sí, nombre y teléfono no.
    anotar(
        s,
        usuario="publico",
        accion="registro.crear",
        entidad="registro",
        entidad_id=registro.folio,
        detalle={
            "categoria_id": registro.categoria_id,
            "ruta": registro.ruta,
            "kit": registro.kit_nombre,
            "origen": payload.origen,
        },
        ip=peticion.client.host if peticion.client else None,
    )
    s.commit()

    return RespuestaRegistro(
        folio=registro.folio,
        estado=registro.estado,
        monto_esperado=registro.kit_precio,
        datos_pago=DATOS_PAGO,
    )


@router.get("/registros/{folio}", response_model=RespuestaConsulta)
def consultar_registro(
    folio: str,
    fnac: str = Query(
        ...,
        description="Fecha de nacimiento DD/MM/AAAA. Segundo factor obligatorio.",
    ),
    s: Session = Depends(obtener_sesion),
) -> RespuestaConsulta:
    """Consulta del propio registro.

    Dos defensas: el folio trae sufijo aleatorio (no se puede barrer el padrón)
    y además exige la fecha de nacimiento (un folio filtrado en una captura de
    WhatsApp no le sirve a un tercero).

    Folio inexistente y fecha equivocada devuelven **el mismo 404**: un 403
    confirmaría que el folio existe.
    """
    registro = servicio.consultar(s, folio, fnac)
    if registro is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"codigo": "no_encontrado", "detalle": "No encontramos ese registro."},
        )

    completo = " ".join(
        x for x in (registro.nombre, registro.apellido_paterno, registro.apellido_materno) if x
    )
    categoria = catalogo().por_id(registro.categoria_id)

    return RespuestaConsulta(
        folio=registro.folio,
        nombre_completo=completo,
        categoria_clave=registro.categoria_clave,
        categoria_nombre=categoria.nombre if categoria else "",
        ruta=registro.ruta,
        kit_nombre=registro.kit_nombre,
        estado=registro.estado,
        creado_en=registro.creado_en.isoformat(),
    )


@router.get("/salud")
def salud() -> dict:
    return {"estado": "ok", "edicion": config.EDICION}


@router.get("/inscripciones/estado")
def estado_inscripciones() -> dict:
    """Para que el front sepa si mostrar el formulario o el aviso de cerrado,
    sin tener que intentar un envío y comerse un 403."""
    return {
        "abiertas": config.INSCRIPCIONES_ABIERTAS,
        "mensaje": None if config.INSCRIPCIONES_ABIERTAS else config.MENSAJE_CERRADO,
    }
