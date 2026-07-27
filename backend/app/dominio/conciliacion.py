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
    monto_recibido: int | None = None,
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
    r.monto_recibido = monto_recibido if monto_recibido is not None else r.kit_precio
    r.pago_verificado_por = verificado_por
    r.pago_verificado_en = ahora()
    s.add(r)
    s.commit()
    s.refresh(r)
    return r


def marcar_pagados(
    s: Session,
    folios: list[str],
    *,
    verificado_por: str,
    referencia: str | None = None,
    monto_recibido: int | None = None,
) -> list[Registro]:
    """Un depósito, varios inscritos.

    Es el caso común de un evento local: alguien de un club transfiere por
    ocho corredores en un solo movimiento. Sin esto son ocho clics y ocho
    capturas de la misma referencia.

    `monto_recibido` es el TOTAL del depósito y se reparte: a cada registro se
    le asigna lo que le toca según su kit, y el sobrante (o faltante) queda en
    el último para que la suma cuadre exactamente contra el estado de cuenta.
    """
    registros: list[Registro] = []
    for folio in folios:
        r = s.exec(select(Registro).where(Registro.folio == folio)).first()
        if r is None:
            raise ErrorConciliacion(f"No existe el folio {folio}.")
        if r.estado == "cancelado":
            raise ErrorConciliacion(f"El folio {folio} está cancelado.")
        registros.append(r)

    por_verificar = [r for r in registros if r.estado != "pagado"]
    if not por_verificar:
        return registros

    momento = ahora()
    ref = (referencia or "").strip() or None
    asignados = 0
    for i, r in enumerate(por_verificar):
        r.estado = "pagado"
        r.pago_referencia = ref
        if monto_recibido is None:
            r.monto_recibido = r.kit_precio
        elif i < len(por_verificar) - 1:
            r.monto_recibido = r.kit_precio
            asignados += r.kit_precio
        else:
            # Al último le toca el resto: así la suma de `monto_recibido`
            # cuadra con el depósito aunque traiga comisión o venga de más.
            r.monto_recibido = monto_recibido - asignados
        r.pago_verificado_por = verificado_por
        r.pago_verificado_en = momento
        s.add(r)
    s.commit()
    for r in registros:
        s.refresh(r)
    return registros


@dataclass(frozen=True, slots=True)
class Deposito:
    """Los registros que comparten una referencia, para cuadrar contra el
    estado de cuenta."""

    referencia: str
    registros: list[Registro]

    @property
    def esperado(self) -> int:
        return sum(r.kit_precio for r in self.registros)

    @property
    def recibido(self) -> int:
        return sum(r.monto_recibido or 0 for r in self.registros)

    @property
    def cuadra(self) -> bool:
        return self.recibido == self.esperado


def por_referencia(s: Session, edicion: int, referencia: str) -> Deposito | None:
    """Quiénes comparten esa referencia y cuánto suman.

    Es lo que permite cuadrar: si el depósito fue de $2,250 y los tres
    seleccionados suman $2,250, cuadra.
    """
    ref = referencia.strip()
    if not ref:
        return None
    registros = list(
        s.exec(
            select(Registro)
            .where(Registro.edicion == edicion)
            .where(Registro.pago_referencia == ref)
            .order_by(Registro.folio)
        ).all()
    )
    return Deposito(referencia=ref, registros=registros) if registros else None


def depositos_compartidos(s: Session, edicion: int) -> list[Deposito]:
    """Todas las referencias usadas por más de un registro."""
    registros = s.exec(
        select(Registro)
        .where(Registro.edicion == edicion)
        .where(Registro.pago_referencia.is_not(None))
    ).all()
    por_ref: dict[str, list[Registro]] = {}
    for r in registros:
        por_ref.setdefault(r.pago_referencia or "", []).append(r)
    return [
        Deposito(referencia=ref, registros=sorted(rs, key=lambda x: x.folio))
        for ref, rs in sorted(por_ref.items())
        if len(rs) > 1
    ]


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
