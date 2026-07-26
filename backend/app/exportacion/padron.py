"""Exportación del padrón para el sistema de cronometraje.

Es la salida ① del puente: un archivo que alguien lleva en USB al host. No hay
—ni habrá— conexión en vivo entre este servidor y la red del evento.
"""

from __future__ import annotations

import csv
import io

from sqlmodel import Session, select

from ..modelos import Registro

# Columnas EXACTAS de la tabla `participantes` del host, en este orden.
# No se agregan, no se reordenan y no se renombran: el importador del host las
# lee por posición y por nombre.
COLUMNAS = (
    "numero_corredor",
    "nombre",
    "apellido_paterno",
    "apellido_materno",
    "fecha_nacimiento",
    "sexo",
    "equipo",
    "categoria_id",
    "ruta",
)

# Sin esto, Excel en español abre «Hernández» como «HernÃ¡ndez».
BOM = "﻿"


def filas_padron(s: Session, edicion: int, *, incluir_pendientes: bool = False) -> list[Registro]:
    consulta = select(Registro).where(Registro.edicion == edicion)
    if not incluir_pendientes:
        # El default es solo pagados: quien no pagó no corre, y meterlo al host
        # obligaría a depurarlo a mano el día de la entrega de kits.
        consulta = consulta.where(Registro.estado == "pagado")
    else:
        consulta = consulta.where(Registro.estado != "cancelado")
    return list(s.exec(consulta.order_by(Registro.categoria_id, Registro.apellido_paterno)).all())


def a_csv(registros: list[Registro]) -> str:
    """CSV con BOM UTF-8 y CRLF, que es lo que Excel espera.

    `numero_corredor` va VACÍO a propósito: lo asigna el comité en el host al
    entregar el kit. Mandarlo desde aquí duplicaría la fuente de verdad de los
    dorsales.
    """
    buffer = io.StringIO(newline="")
    escritor = csv.writer(buffer, lineterminator="\r\n")
    escritor.writerow(COLUMNAS)
    for r in registros:
        escritor.writerow(
            [
                "",  # numero_corredor — lo pone el host
                r.nombre,
                r.apellido_paterno,
                r.apellido_materno or "",
                r.fecha_nacimiento,
                r.sexo,
                r.equipo or "",
                r.categoria_id,
                r.ruta,
            ]
        )
    return BOM + buffer.getvalue()


def a_bytes(registros: list[Registro]) -> bytes:
    return a_csv(registros).encode("utf-8")
