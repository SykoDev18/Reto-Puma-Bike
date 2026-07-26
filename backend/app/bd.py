"""Motor de base de datos y migración defensiva.

Sin Alembic: a esta escala (~1,000 inscritos al año) `ALTER TABLE` defensivo
dentro de try/except alcanza, y es lo mismo que hace el host de cronometraje.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone

from sqlalchemy import event, text
from sqlmodel import Session, SQLModel, create_engine

from . import config
from .modelos import Bitacora  # noqa: F401  (necesario para create_all)
from .modelos import Registro  # noqa: F401

config.RUTA_DATOS.mkdir(parents=True, exist_ok=True)

motor = create_engine(
    config.URL_BD,
    echo=False,
    connect_args={"check_same_thread": False},
)


@event.listens_for(motor, "connect")
def _configurar_sqlite(conexion, _registro) -> None:
    """WAL para que una lectura larga del admin no bloquee una inscripción, y
    claves foráneas activas (SQLite las ignora por defecto)."""
    cur = conexion.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA busy_timeout=5000")
    cur.close()


# Único natural que rechaza duplicados: la misma persona no se inscribe dos
# veces en la misma edición. Va como índice de BD además de la comprobación en
# la API, porque dos peticiones simultáneas pueden pasar ambas la consulta.
INDICE_UNICO_PERSONA = """
CREATE UNIQUE INDEX IF NOT EXISTS ix_registro_persona_edicion
ON registro (edicion, nombre, apellido_paterno, ifnull(apellido_materno,''), fecha_nacimiento)
"""


def crear_tablas() -> None:
    SQLModel.metadata.create_all(motor)
    with motor.begin() as cx:
        cx.execute(text(INDICE_UNICO_PERSONA))


def migrar_columna(tabla: str, columna: str, definicion: str) -> None:
    """`ALTER TABLE` defensivo: agrega la columna si falta, calla si ya está.

    Es el patrón del host. Permite desplegar sin coordinar migraciones.
    """
    with motor.begin() as cx:
        existentes = {fila[1] for fila in cx.execute(text(f"PRAGMA table_info({tabla})"))}
        if columna not in existentes:
            cx.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {columna} {definicion}"))


@contextmanager
def sesion() -> Iterator[Session]:
    with Session(motor) as s:
        yield s


def ahora() -> datetime:
    return datetime.now(timezone.utc)


def anotar(
    s: Session,
    *,
    usuario: str,
    accion: str,
    entidad: str,
    entidad_id: str,
    detalle: dict | None = None,
    ip: str | None = None,
) -> None:
    """Escribe en la bitácora.

    `detalle` NUNCA debe llevar datos personales. Se serializa aquí para que
    quien llame no tenga que acordarse de hacerlo, y para tener un solo lugar
    donde auditar qué se está guardando.
    """
    s.add(
        Bitacora(
            ocurrido_en=ahora(),
            usuario=usuario,
            accion=accion,
            entidad=entidad,
            entidad_id=entidad_id,
            detalle=json.dumps(detalle, ensure_ascii=False) if detalle else None,
            ip=ip,
        )
    )
