"""Exportación del padrón: la salida ① del puente con el cronometraje.

Lo que se prueba aquí es lo que hace que el host pueda importar sin depurar a
mano: columnas exactas, BOM para Excel, `numero_corredor` vacío, y una clave
natural que permita reimportar sin duplicar.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

import pytest
from sqlmodel import Session

from app.exportacion.padron import BOM, COLUMNAS, a_csv, a_bytes, filas_padron
from app.modelos import Registro


def _registro(**cambios) -> Registro:
    base = dict(
        folio="RPB2026-000001-7K9F",
        creado_en=datetime.now(timezone.utc),
        edicion=2026,
        nombre="Mizraim",
        apellido_paterno="Rosales",
        apellido_materno="Rodríguez",
        fecha_nacimiento="14/08/1992",
        sexo="M",
        equipo=None,
        categoria_id=26,
        categoria_clave="N",
        ruta="80",
        tipo_bicicleta="MTB",
        email="m@example.mx",
        telefono="7721199093",
        kit_nombre="Kit Puma",
        kit_precio=750,
        talla_jersey="G",
        emergencia_nombre="Ana Rosales",
        emergencia_telefono="7721234567",
        tipo_sangre="O+",
        edad_nominal=34,
        estado="pagado",
    )
    base.update(cambios)
    return Registro(**base)


@pytest.fixture
def poblada(s: Session) -> Session:
    s.add(_registro())
    s.add(
        _registro(
            folio="RPB2026-000002-ABCD",
            nombre="Zúñiga",
            apellido_paterno="Muñoz",
            apellido_materno="Olguín",
            fecha_nacimiento="01/02/1985",
            categoria_id=27,
            categoria_clave="W",
            estado="pendiente",
        )
    )
    s.add(
        _registro(
            folio="RPB2026-000003-EFGH",
            nombre="Cancelada",
            apellido_paterno="Persona",
            fecha_nacimiento="03/03/1990",
            sexo="F",
            categoria_id=24,
            categoria_clave="H",
            estado="cancelado",
        )
    )
    s.commit()
    return s


# --------------------------------------------------------------------------
# Contrato de columnas
# --------------------------------------------------------------------------


def test_las_columnas_son_las_del_host_en_su_orden() -> None:
    assert COLUMNAS == (
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


def test_el_encabezado_del_csv_coincide_exactamente(poblada) -> None:
    texto = a_csv(filas_padron(poblada, 2026))
    encabezado = texto.lstrip(BOM).splitlines()[0]
    assert encabezado == ",".join(COLUMNAS)


def test_numero_corredor_va_vacio(poblada) -> None:
    """Lo asigna el comité en el host al entregar el kit. Mandarlo desde aquí
    duplicaría la fuente de verdad de los dorsales."""
    texto = a_csv(filas_padron(poblada, 2026))
    filas = list(csv.DictReader(io.StringIO(texto.lstrip(BOM))))
    assert filas, "no hay filas que revisar"
    for fila in filas:
        assert fila["numero_corredor"] == ""


def test_el_csv_no_lleva_datos_personales_de_contacto(poblada) -> None:
    """El host solo necesita identidad y competencia. Correo, teléfono,
    contacto de emergencia y tipo de sangre NO viajan."""
    texto = a_csv(filas_padron(poblada, 2026, incluir_pendientes=True))
    for prohibido in ("@example.mx", "7721199093", "7721234567", "O+", "Kit Puma"):
        assert prohibido not in texto


# --------------------------------------------------------------------------
# Excel en español
# --------------------------------------------------------------------------


def test_lleva_BOM_utf8_al_inicio(poblada) -> None:
    """Sin BOM, Excel en español abre «Hernández» como «HernÃ¡ndez»."""
    crudo = a_bytes(filas_padron(poblada, 2026, incluir_pendientes=True))
    assert crudo[:3] == b"\xef\xbb\xbf"


def test_los_acentos_sobreviven_la_ida_y_vuelta(poblada) -> None:
    crudo = a_bytes(filas_padron(poblada, 2026, incluir_pendientes=True))
    texto = crudo.decode("utf-8-sig")  # como lo abre Excel
    filas = list(csv.DictReader(io.StringIO(texto)))
    apellidos = {f["apellido_paterno"] for f in filas}
    maternos = {f["apellido_materno"] for f in filas}
    assert "Muñoz" in apellidos
    assert "Rodríguez" in maternos
    assert "Olguín" in maternos


def test_usa_CRLF_que_es_lo_que_espera_excel(poblada) -> None:
    texto = a_csv(filas_padron(poblada, 2026, incluir_pendientes=True))
    assert "\r\n" in texto
    cuerpo = texto.lstrip(BOM)
    assert cuerpo.count("\r\n") == cuerpo.count("\n")


# --------------------------------------------------------------------------
# Qué se exporta
# --------------------------------------------------------------------------


def test_por_defecto_solo_van_los_pagados(poblada) -> None:
    """Quien no pagó no corre; meterlo al host obligaría a depurarlo a mano el
    día de la entrega de kits."""
    filas = filas_padron(poblada, 2026)
    assert len(filas) == 1
    assert filas[0].estado == "pagado"


def test_con_incluir_pendientes_van_los_dos_pero_no_el_cancelado(poblada) -> None:
    filas = filas_padron(poblada, 2026, incluir_pendientes=True)
    estados = sorted(f.estado for f in filas)
    assert estados == ["pagado", "pendiente"]
    assert "cancelado" not in estados


def test_no_mezcla_ediciones(poblada) -> None:
    poblada.add(
        _registro(
            folio="RPB2025-000001-ZZZZ",
            edicion=2025,
            nombre="Del",
            apellido_paterno="Pasado",
            fecha_nacimiento="09/09/1980",
        )
    )
    poblada.commit()
    assert all(f.edicion == 2026 for f in filas_padron(poblada, 2026))


# --------------------------------------------------------------------------
# Reimportación idempotente del lado del host
# --------------------------------------------------------------------------


def test_la_clave_natural_del_csv_permite_reimportar_sin_duplicar(poblada) -> None:
    """El host importa con `INSERT OR REPLACE` sobre nombre completo + fecha de
    nacimiento. Este test fija que esa clave sea única en lo que exportamos:
    si no lo fuera, reimportar tras las inscripciones tardías duplicaría gente.
    """
    texto = a_csv(filas_padron(poblada, 2026, incluir_pendientes=True))
    filas = list(csv.DictReader(io.StringIO(texto.lstrip(BOM))))
    claves = [
        (f["nombre"], f["apellido_paterno"], f["apellido_materno"], f["fecha_nacimiento"])
        for f in filas
    ]
    assert len(claves) == len(set(claves))


def test_exportar_dos_veces_da_el_mismo_archivo(poblada) -> None:
    primero = a_csv(filas_padron(poblada, 2026, incluir_pendientes=True))
    segundo = a_csv(filas_padron(poblada, 2026, incluir_pendientes=True))
    assert primero == segundo


def test_el_equipo_vacio_sale_como_cadena_vacia_no_como_None(poblada) -> None:
    """«None» impreso en un CSV se importa como el texto «None»."""
    texto = a_csv(filas_padron(poblada, 2026, incluir_pendientes=True))
    assert "None" not in texto
