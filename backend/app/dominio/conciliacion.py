"""Conciliación de pagos: la pantalla que el comité usa todos los días.

El flujo real del evento es:

    se inscribe → transfiere → manda comprobante por WhatsApp → alguien verifica

Hasta ese último paso la inscripción **no vale**. Por eso la pantalla principal
no es «lista de inscritos», es «pendientes por verificar»: lo que hay que hacer
hoy, no lo que ya pasó.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlmodel import Session, select

from ..modelos import Registro

ESTADOS = ("pendiente", "pagado", "cancelado")

# A partir de aquí el registro sube al principio de la lista. Una semana sin
# verificar suele significar que el comprobante se perdió en el WhatsApp del
# comité, no que la persona no pagó.
DIAS_URGENTE = 7


@dataclass(frozen=True, slots=True)
class Pendiente:
    registro: Registro
    dias_esperando: int

    @property
    def urgente(self) -> bool:
        return self.dias_esperando >= DIAS_URGENTE


@dataclass(frozen=True, slots=True)
class Conteos:
    pagados: int
    pendientes: int
    cancelados: int

    @property
    def total(self) -> int:
        return self.pagados + self.pendientes + self.cancelados


def ahora() -> datetime:
    return datetime.now(timezone.utc)


def _dias_desde(momento: datetime) -> int:
    # SQLite devuelve datetimes sin zona; se les asume UTC.
    referencia = momento if momento.tzinfo else momento.replace(tzinfo=timezone.utc)
    return max(0, (ahora() - referencia).days)


def conteos(s: Session, edicion: int) -> Conteos:
    registros = s.exec(select(Registro).where(Registro.edicion == edicion)).all()
    return Conteos(
        pagados=sum(1 for r in registros if r.estado == "pagado"),
        pendientes=sum(1 for r in registros if r.estado == "pendiente"),
        cancelados=sum(1 for r in registros if r.estado == "cancelado"),
    )


def dinero_pendiente(s: Session, edicion: int) -> int:
    return sum(
        r.kit_precio
        for r in s.exec(
            select(Registro)
            .where(Registro.edicion == edicion)
            .where(Registro.estado == "pendiente")
        ).all()
    )


def pendientes(s: Session, edicion: int) -> list[Pendiente]:
    """Pendientes por verificar, **los más viejos primero**.

    El orden no es cosmético: un registro de hace diez días es el que tiene a
    alguien esperando respuesta.
    """
    registros = s.exec(
        select(Registro)
        .where(Registro.edicion == edicion)
        .where(Registro.estado == "pendiente")
    ).all()
    lista = [Pendiente(registro=r, dias_esperando=_dias_desde(r.creado_en)) for r in registros]
    return sorted(lista, key=lambda p: (-p.dias_esperando, p.registro.folio))


class ErrorConciliacion(Exception):
    pass


def marcar_pagado(
    s: Session,
    folio: str,
    *,
    verificado_por: str,
    referencia: str | None = None,
) -> Registro:
    r = s.exec(select(Registro).where(Registro.folio == folio)).first()
    if r is None:
        raise ErrorConciliacion(f"No existe el folio {folio}.")
    if r.estado == "cancelado":
        raise ErrorConciliacion(
            f"El folio {folio} está cancelado. Reactívalo antes de marcarlo pagado."
        )
    if r.estado == "pagado":
        # No es un error: dos personas del comité pueden abrir la misma
        # pantalla. Se deja como estaba y no se pisa quién lo verificó primero.
        return r

    r.estado = "pagado"
    r.pago_referencia = (referencia or "").strip() or None
    r.pago_verificado_por = verificado_por
    r.pago_verificado_en = ahora()
    s.add(r)
    s.commit()
    s.refresh(r)
    return r


def cancelar(s: Session, folio: str, *, motivo: str | None = None) -> Registro:
    r = s.exec(select(Registro).where(Registro.folio == folio)).first()
    if r is None:
        raise ErrorConciliacion(f"No existe el folio {folio}.")
    r.estado = "cancelado"
    if motivo:
        r.notas = ((r.notas + " · ") if r.notas else "") + motivo.strip()
    s.add(r)
    s.commit()
    s.refresh(r)
    return r


def reactivar(s: Session, folio: str) -> Registro:
    """Devuelve un cancelado a pendiente. Cancelar no puede ser irreversible:
    la gente se equivoca de fila."""
    r = s.exec(select(Registro).where(Registro.folio == folio)).first()
    if r is None:
        raise ErrorConciliacion(f"No existe el folio {folio}.")
    if r.estado != "cancelado":
        raise ErrorConciliacion(f"El folio {folio} no está cancelado.")
    r.estado = "pendiente"
    s.add(r)
    s.commit()
    s.refresh(r)
    return r


def buscar(
    s: Session,
    edicion: int,
    *,
    texto: str = "",
    estado: str | None = None,
    categoria_id: int | None = None,
    ruta: str | None = None,
) -> list[Registro]:
    """Padrón con filtros. La búsqueda es por folio, nombre o teléfono."""
    consulta = select(Registro).where(Registro.edicion == edicion)
    if estado in ESTADOS:
        consulta = consulta.where(Registro.estado == estado)
    if categoria_id is not None:
        consulta = consulta.where(Registro.categoria_id == categoria_id)
    if ruta:
        consulta = consulta.where(Registro.ruta == ruta)

    registros = list(s.exec(consulta.order_by(Registro.apellido_paterno)).all())

    q = texto.strip().lower()
    if q:
        registros = [
            r
            for r in registros
            if q in r.folio.lower()
            or q in f"{r.nombre} {r.apellido_paterno} {r.apellido_materno or ''}".lower()
            or q in r.telefono
        ]
    return registros
