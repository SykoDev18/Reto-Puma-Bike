from __future__ import annotations

import copy
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

from app import bd
from app.api import registros as api_registros
from app.main import app


@pytest.fixture
def motor():
    """Base en memoria, aislada por test."""
    m = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(m)
    from sqlalchemy import text

    with m.begin() as cx:
        cx.execute(text(bd.INDICE_UNICO_PERSONA))
    return m


@pytest.fixture
def s(motor) -> Iterator[Session]:
    with Session(motor) as sesion:
        yield sesion


@pytest.fixture
def cliente(motor) -> Iterator[TestClient]:
    def sesion_de_prueba():
        with Session(motor) as sesion:
            yield sesion

    from app.admin import rutas as admin_rutas

    app.dependency_overrides[api_registros.obtener_sesion] = sesion_de_prueba
    app.dependency_overrides[admin_rutas.obtener_sesion] = sesion_de_prueba
    # El panel exige HTTPS en la cookie; el cliente de pruebas usa http.
    with TestClient(app, base_url="https://pruebas") as c:
        yield c
    app.dependency_overrides.clear()


PAYLOAD_BASE = {
    "folio": "RPB2026-000123",  # el servidor lo ignora
    "creado_en": "2026-03-15T10:22:31-06:00",
    "participante": {
        "nombre": "Mizraim",
        "apellido_paterno": "Rosales",
        "apellido_materno": "Rodríguez",
        "fecha_nacimiento": "14/08/1992",
        "edad_nominal": 34,
        "sexo": "M",
        "equipo": "Independiente",
        "email": "mizraim@example.mx",
        "telefono": "7721199093",
    },
    "competencia": {
        "categoria_id": 26,
        "categoria_clave": "N",
        "categoria_nombre": "Máster 30 Varonil",
        "ruta": "80",
        "tipo_bicicleta": "MTB",
    },
    "kit": {"nombre": "Kit Puma", "precio": 750, "talla_jersey": "G"},
    "emergencia": {
        "nombre": "Ana Rosales",
        "telefono": "7721234567",
        "tipo_sangre": "O+",
    },
    "consentimiento": {"deslinde": True, "privacidad": True},
    "peso_90_mas": False,
    "origen": "web",
}


@pytest.fixture
def payload() -> dict:
    return copy.deepcopy(PAYLOAD_BASE)
