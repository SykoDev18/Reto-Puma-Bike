"""Anuncios y hospedaje: alta, edición y regeneración del JSON estático.

El admin escribe en la BD y **al guardar regenera el estático**. El sitio nunca
consulta la base: lee un archivo que sirve NGINX.

Aquí se hace cumplir de verdad la regla de la página de Avisos:

    · `cuerpo` con texto real es OBLIGATORIO, aunque el aviso traiga imagen.
    · si hay `imagen`, `imagen_alt` es obligatorio.

En el front era una validación en el borde de la carga; aquí es el punto donde
un aviso sin texto simplemente no se puede guardar.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from .. import config
from ..modelos import Aviso, Lugar
from .publicacion import escribir_atomico

TIPOS_AVISO = ("convocatoria", "logistica", "resultados", "patrocinadores")
TIPOS_LUGAR = ("hotel", "comida")


class ErrorContenido(Exception):
    def __init__(self, campo: str, mensaje: str) -> None:
        super().__init__(mensaje)
        self.campo = campo
        self.mensaje = mensaje


def _texto(valor: Any) -> str:
    return (valor or "").strip() if isinstance(valor, str) else ""


# ---------------------------------------------------------------------------
# Avisos
# ---------------------------------------------------------------------------


def validar_aviso(datos: dict[str, Any]) -> None:
    """Las reglas que hacen que un aviso valga la pena publicarse."""
    if not _texto(datos.get("clave")):
        raise ErrorContenido("clave", "El aviso necesita una clave, por ejemplo «012».")
    if not _texto(datos.get("fecha")):
        raise ErrorContenido("fecha", "El aviso necesita fecha.")
    if datos.get("tipo") not in TIPOS_AVISO:
        raise ErrorContenido("tipo", f"El tipo debe ser uno de: {', '.join(TIPOS_AVISO)}.")
    if not _texto(datos.get("titulo")):
        raise ErrorContenido("titulo", "El aviso necesita título.")

    # LA REGLA. Un flyer acompaña, nunca sustituye: Google no lo lee, un lector
    # de pantalla tampoco, y a 360px se lee mal.
    cuerpo = _texto(datos.get("cuerpo"))
    if not cuerpo:
        raise ErrorContenido(
            "cuerpo",
            "Un aviso sin texto no se publica, aunque traiga imagen. "
            "Escribe el contenido: es lo que puede leer un buscador, un lector "
            "de pantalla y quien lo abra desde un celular.",
        )

    imagen = _texto(datos.get("imagen"))
    if imagen and not _texto(datos.get("imagen_alt")):
        raise ErrorContenido(
            "imagen_alt",
            "Si el aviso lleva imagen, describe qué se ve en ella. Sin esa "
            "descripción, la información se pierde para quien usa lector de "
            "pantalla.",
        )

    enlace_texto = _texto(datos.get("enlace_texto"))
    enlace_url = _texto(datos.get("enlace_url"))
    if bool(enlace_texto) != bool(enlace_url):
        raise ErrorContenido("enlace_url", "El enlace necesita texto Y dirección.")


def guardar_aviso(s: Session, datos: dict[str, Any], *, id_: int | None = None) -> Aviso:
    validar_aviso(datos)
    clave = _texto(datos["clave"])

    existente = s.exec(select(Aviso).where(Aviso.clave == clave)).first()
    if existente is not None and existente.id != id_:
        raise ErrorContenido("clave", f"Ya hay un aviso con la clave «{clave}».")

    aviso = s.get(Aviso, id_) if id_ else None
    if id_ and aviso is None:
        raise ErrorContenido("id", "Ese aviso no existe.")
    if aviso is None:
        aviso = Aviso(clave=clave, fecha="", tipo="", titulo="", cuerpo="")

    aviso.clave = clave
    aviso.fecha = _texto(datos["fecha"])
    aviso.tipo = str(datos["tipo"])
    aviso.titulo = _texto(datos["titulo"])
    aviso.cuerpo = _texto(datos["cuerpo"])
    aviso.imagen = _texto(datos.get("imagen")) or None
    aviso.imagen_alt = _texto(datos.get("imagen_alt")) or None
    aviso.enlace_texto = _texto(datos.get("enlace_texto")) or None
    aviso.enlace_url = _texto(datos.get("enlace_url")) or None
    aviso.fijado = bool(datos.get("fijado"))
    aviso.vigente_hasta = _texto(datos.get("vigente_hasta")) or None
    aviso.publicado = bool(datos.get("publicado", True))
    aviso.actualizado_en = datetime.now(timezone.utc)

    s.add(aviso)
    s.commit()
    s.refresh(aviso)
    return aviso


def _aviso_a_json(a: Aviso) -> dict[str, Any]:
    """Forma EXACTA del contrato que ya consume el sitio (`src/types/anuncios.ts`)."""
    salida: dict[str, Any] = {
        "id": a.clave,
        "fecha": a.fecha,
        "tipo": a.tipo,
        "titulo": a.titulo,
        "cuerpo": a.cuerpo,
    }
    if a.imagen:
        salida["imagen"] = a.imagen
        salida["imagenAlt"] = a.imagen_alt
    if a.enlace_texto and a.enlace_url:
        salida["enlace"] = {"texto": a.enlace_texto, "url": a.enlace_url}
    if a.fijado:
        salida["fijado"] = True
    if a.vigente_hasta:
        salida["vigenteHasta"] = a.vigente_hasta
    return salida


def regenerar_anuncios(s: Session, *, base: Path | None = None) -> Path:
    """Reescribe `anuncios.json`. Se llama en CADA guardado."""
    avisos = s.exec(select(Aviso).where(Aviso.publicado == True)).all()  # noqa: E712
    ordenados = sorted(avisos, key=lambda a: (a.fecha, a.clave), reverse=True)
    datos = {
        "actualizado": max((a.fecha for a in ordenados), default=""),
        "avisos": [_aviso_a_json(a) for a in ordenados],
    }
    destino = (base if base is not None else config.RUTA_PUBLICA) / "anuncios.json"
    escribir_atomico(destino, _serializar(datos))
    return destino


# ---------------------------------------------------------------------------
# Hospedaje
# ---------------------------------------------------------------------------


def validar_lugar(datos: dict[str, Any]) -> None:
    if datos.get("tipo") not in TIPOS_LUGAR:
        raise ErrorContenido("tipo", f"El tipo debe ser uno de: {', '.join(TIPOS_LUGAR)}.")
    if not _texto(datos.get("nombre")):
        raise ErrorContenido("nombre", "El lugar necesita nombre.")
    if not _texto(datos.get("descripcion")):
        raise ErrorContenido(
            "descripcion",
            "Escribe una descripción: sin ella la tarjeta queda vacía y no sirve "
            "de nada a quien busca dónde quedarse.",
        )
    imagen = _texto(datos.get("imagen"))
    if imagen and not _texto(datos.get("imagen_alt")):
        raise ErrorContenido("imagen_alt", "Si hay imagen, describe qué se ve en ella.")


def guardar_lugar(s: Session, datos: dict[str, Any], *, id_: int | None = None) -> Lugar:
    validar_lugar(datos)
    lugar = s.get(Lugar, id_) if id_ else None
    if id_ and lugar is None:
        raise ErrorContenido("id", "Ese lugar no existe.")
    if lugar is None:
        lugar = Lugar(tipo="hotel", nombre="", descripcion="")

    lugar.tipo = str(datos["tipo"])
    lugar.nombre = _texto(datos["nombre"])
    lugar.descripcion = _texto(datos["descripcion"])
    lugar.direccion = _texto(datos.get("direccion")) or None
    lugar.telefono = _texto(datos.get("telefono")) or None
    lugar.mapa_url = _texto(datos.get("mapa_url")) or None
    lugar.imagen = _texto(datos.get("imagen")) or None
    lugar.imagen_alt = _texto(datos.get("imagen_alt")) or None
    lugar.convenio = _texto(datos.get("convenio")) or None
    lugar.patrocinador = bool(datos.get("patrocinador"))
    lugar.orden = int(datos.get("orden") or 0)
    lugar.publicado = bool(datos.get("publicado", True))

    s.add(lugar)
    s.commit()
    s.refresh(lugar)
    return lugar


def _lugar_a_json(l: Lugar) -> dict[str, Any]:
    salida: dict[str, Any] = {
        "id": l.id,
        "tipo": l.tipo,
        "nombre": l.nombre,
        "descripcion": l.descripcion,
    }
    for campo, valor in (
        ("direccion", l.direccion),
        ("telefono", l.telefono),
        ("mapaUrl", l.mapa_url),
        ("convenio", l.convenio),
    ):
        if valor:
            salida[campo] = valor
    if l.imagen:
        salida["imagen"] = l.imagen
        salida["imagenAlt"] = l.imagen_alt
    if l.patrocinador:
        salida["patrocinador"] = True
    return salida


def regenerar_hospedaje(s: Session, *, base: Path | None = None) -> Path:
    lugares = s.exec(select(Lugar).where(Lugar.publicado == True)).all()  # noqa: E712
    ordenados = sorted(lugares, key=lambda x: (x.orden, x.nombre))
    datos = {
        "hoteles": [_lugar_a_json(x) for x in ordenados if x.tipo == "hotel"],
        "comida": [_lugar_a_json(x) for x in ordenados if x.tipo == "comida"],
    }
    destino = (base if base is not None else config.RUTA_PUBLICA) / "hospedaje.json"
    escribir_atomico(destino, _serializar(datos))
    return destino


def _serializar(datos: dict[str, Any]) -> str:
    import json

    return json.dumps(datos, ensure_ascii=False, indent=2) + "\n"
