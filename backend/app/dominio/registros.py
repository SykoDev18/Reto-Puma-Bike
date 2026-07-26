"""Reglas de negocio del registro. Sin FastAPI y sin HTTP: puro dominio.

El front valida por conveniencia; esto valida por seguridad. Todo lo que el
formulario comprueba se vuelve a comprobar aquí, porque nadie garantiza que la
petición venga del formulario.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone

from sqlalchemy import func
from sqlmodel import Session, select

from .. import config
from ..esquemas import PayloadRegistro
from ..modelos import Registro
from . import folio as folio_mod
from .categorias import Categoria, MAPA_RUTAS, catalogo
from .elegibilidad import EntradaElegibilidad, categorias_elegibles, edad_nominal


class ErrorRegistro(Exception):
    """Error de negocio con un código que la capa HTTP traduce a un status."""

    def __init__(self, codigo: str, mensaje: str, extra: dict | None = None) -> None:
        super().__init__(mensaje)
        self.codigo = codigo
        self.mensaje = mensaje
        self.extra = extra or {}


def capitalizar(valor: str) -> str:
    """Puerto de `capitalizar()` de `src/lib/registro.ts`: respeta acentos y
    apóstrofos (`O'Brien`, `José Luis`)."""
    limpio = " ".join(valor.strip().split()).lower()
    return re.sub(
        r"(^|\s|')(\w)",
        lambda m: f"{m.group(1)}{m.group(2).upper()}",
        limpio,
        flags=re.UNICODE,
    )


def _clave_persona(nombre: str, paterno: str, materno: str, fecha: str) -> str:
    """Clave natural para detectar duplicados.

    Se normaliza sin acentos y sin mayúsculas: «José Pérez» y «jose perez» son
    la misma persona inscribiéndose dos veces, no dos corredores.
    """
    crudo = f"{nombre}|{paterno}|{materno}|{fecha}".lower()
    sin_acentos = "".join(
        c for c in unicodedata.normalize("NFD", crudo) if unicodedata.category(c) != "Mn"
    )
    return " ".join(sin_acentos.split())


def _siguiente_consecutivo(s: Session, edicion: int) -> int:
    total = s.exec(
        select(func.count()).select_from(Registro).where(Registro.edicion == edicion)
    ).one()
    return int(total) + 1


def buscar_duplicado(s: Session, payload: PayloadRegistro, edicion: int) -> Registro | None:
    """Mismo nombre completo + fecha de nacimiento en la misma edición."""
    p = payload.participante
    objetivo = _clave_persona(
        capitalizar(p.nombre),
        capitalizar(p.apellido_paterno),
        capitalizar(p.apellido_materno),
        p.fecha_nacimiento,
    )
    candidatos = s.exec(select(Registro).where(Registro.edicion == edicion)).all()
    for r in candidatos:
        if (
            _clave_persona(
                r.nombre, r.apellido_paterno, r.apellido_materno or "", r.fecha_nacimiento
            )
            == objetivo
        ):
            return r
    return None


def validar(payload: PayloadRegistro, anio_evento: int) -> tuple[Categoria, int]:
    """Valida negocio y devuelve `(categoria, edad_nominal)` ya resueltos.

    Orden deliberado: primero lo que define la identidad (edad), luego lo que
    depende de ella (categoría, ruta, tutor). Lanza `ErrorRegistro` al primer
    problema real.
    """
    p = payload.participante
    c = payload.competencia

    # 1 ---- Edad nominal. La calcula el SERVIDOR; la del cliente es una pista.
    edad = edad_nominal(p.fecha_nacimiento, anio_evento)
    if edad is None:
        raise ErrorRegistro("fecha_invalida", "La fecha de nacimiento no es válida.")
    if edad < 3 or edad > 99:
        raise ErrorRegistro(
            "edad_fuera_de_rango",
            "La edad nominal debe estar entre 3 y 99 años.",
            {"edad_nominal": edad},
        )

    # 2 ---- La categoría tiene que existir en el catálogo.
    categoria = catalogo().por_id(c.categoria_id)
    if categoria is None:
        raise ErrorRegistro(
            "categoria_inexistente",
            f"La categoría {c.categoria_id} no existe en el catálogo.",
        )

    # 3 ---- Y tiene que ser una de las que el motor ofrece. Este es el punto
    # que impide que alguien corra donde no le toca: si el servidor aceptara
    # una categoría que el front no ofrecería, el error solo se vería el día
    # de la carrera.
    resultado = categorias_elegibles(
        EntradaElegibilidad(
            edad_nominal=edad,
            sexo=p.sexo,
            tipo_bicicleta=c.tipo_bicicleta,
            peso_90_mas=payload.peso_90_mas,
        )
    )
    permitidas = resultado.permitidas()
    if categoria.id not in {x.id for x in permitidas}:
        raise ErrorRegistro(
            "categoria_no_elegible",
            f"Con {edad} años nominales, {p.sexo} y {c.tipo_bicicleta}, "
            f"«{categoria.nombre}» no es una categoría elegible.",
            {
                "edad_nominal": edad,
                "recomendada": resultado.recomendada,
                "alternativas": resultado.alternativas,
            },
        )

    # 4 ---- La clave debe corresponder al id (detecta payloads inconsistentes).
    if c.categoria_clave != categoria.clave:
        raise ErrorRegistro(
            "clave_inconsistente",
            f"La clave «{c.categoria_clave}» no corresponde a la categoría "
            f"{categoria.id} («{categoria.clave}»).",
        )

    # 5 ---- Ruta permitida para el grupo de esa categoría.
    permitidas_ruta = MAPA_RUTAS().get(categoria.grupo, ())
    if c.ruta not in permitidas_ruta:
        raise ErrorRegistro(
            "ruta_no_permitida",
            f"El grupo «{categoria.grupo}» solo puede correr: "
            f"{', '.join(permitidas_ruta)}.",
            {"permitidas": list(permitidas_ruta)},
        )

    # 6 ---- Kit y talla.
    if payload.kit.talla_jersey is not None and payload.kit.talla_jersey not in config.TALLAS:
        raise ErrorRegistro(
            "talla_invalida",
            f"La talla «{payload.kit.talla_jersey}» no está en la escala vigente.",
            {"tallas": list(config.TALLAS)},
        )

    # 7 ---- Consentimiento. Sin esto no hay registro que valga.
    if not payload.consentimiento.deslinde or not payload.consentimiento.privacidad:
        raise ErrorRegistro(
            "sin_consentimiento",
            "Falta el consentimiento de deslinde y de aviso de privacidad.",
        )

    # 8 ---- Menores. La exigencia vive en un flag: los campos ya existen, pero
    # activarla antes de que el front entregue el bloque de tutor dejaría a los
    # infantiles sin poder inscribirse.
    if config.EXIGIR_TUTOR and edad < config.EDAD_MAYORIA:
        t = payload.tutor
        if t is None or not t.consentimiento:
            raise ErrorRegistro(
                "falta_tutor",
                "Un menor de edad necesita nombre, teléfono y consentimiento "
                "del padre, madre o tutor.",
                {"edad_nominal": edad},
            )

    return categoria, edad


def crear(
    s: Session,
    payload: PayloadRegistro,
    *,
    anio_evento: int = config.ANIO_EVENTO,
) -> Registro:
    """Valida, resuelve duplicados y persiste. Emite el folio del servidor."""
    categoria, edad = validar(payload, anio_evento)
    edicion = anio_evento

    existente = buscar_duplicado(s, payload, edicion)
    if existente is not None:
        raise ErrorRegistro(
            "duplicado",
            "Esta persona ya está registrada en esta edición.",
            {"folio": existente.folio, "estado": existente.estado},
        )

    p = payload.participante
    ahora = datetime.now(timezone.utc)
    consecutivo = _siguiente_consecutivo(s, edicion)

    registro = Registro(
        # El folio del cliente se DESCARTA: aquí se emite el bueno.
        folio=folio_mod.emitir(edicion, consecutivo),
        creado_en=ahora,
        edicion=edicion,
        nombre=capitalizar(p.nombre),
        apellido_paterno=capitalizar(p.apellido_paterno),
        apellido_materno=capitalizar(p.apellido_materno) or None,
        fecha_nacimiento=p.fecha_nacimiento,
        sexo=p.sexo,
        equipo=(p.equipo.strip() or None),
        categoria_id=categoria.id,
        categoria_clave=categoria.clave,
        ruta=payload.competencia.ruta,
        tipo_bicicleta=payload.competencia.tipo_bicicleta,
        email=p.email.strip(),
        telefono=p.telefono,
        kit_nombre=payload.kit.nombre,
        kit_precio=payload.kit.precio,
        talla_jersey=payload.kit.talla_jersey,
        emergencia_nombre=capitalizar(payload.emergencia.nombre),
        emergencia_telefono=payload.emergencia.telefono,
        tipo_sangre=(payload.emergencia.tipo_sangre or None),
        peso_90_mas=payload.peso_90_mas,
        edad_nominal=edad,
        estado="pendiente",
        deslinde=payload.consentimiento.deslinde,
        privacidad=payload.consentimiento.privacidad,
        privacidad_aceptada_en=ahora,
        aviso_privacidad_version=config.VERSION_AVISO_PRIVACIDAD,
        es_menor=edad < config.EDAD_MAYORIA,
        tutor_nombre=capitalizar(payload.tutor.nombre) if payload.tutor else None,
        tutor_telefono=payload.tutor.telefono if payload.tutor else None,
        consentimiento_tutor=bool(payload.tutor and payload.tutor.consentimiento),
    )
    s.add(registro)
    s.commit()
    s.refresh(registro)
    return registro


def consultar(s: Session, folio: str, fecha_nacimiento: str) -> Registro | None:
    """Consulta del PROPIO registro, con segundo factor.

    Devuelve `None` tanto si el folio no existe como si la fecha no coincide:
    quien llama responde 404 en ambos casos. Un 403 confirmaría que el folio
    existe, que es justo lo que no queremos filtrar.
    """
    normalizado = folio_mod.normalizar(folio)
    if not folio_mod.es_valido(normalizado):
        return None
    registro = s.exec(select(Registro).where(Registro.folio == normalizado)).first()
    if registro is None:
        return None
    if registro.fecha_nacimiento != fecha_nacimiento.strip():
        return None
    return registro
