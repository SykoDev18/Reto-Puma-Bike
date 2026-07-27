"""Publicación de resultados: versionado, JSON estático, reversión y revalidado.

La ruta de LECTURA es estática. El backend escribe un archivo y el servidor web
lo sirve directo; ninguna petición pública toca SQLite.

Motivo medido: el pico son 800 corredores más familia consultando en la hora
posterior a la meta, desde datos móviles. Un archivo estático absorbe eso; un
endpoint dinámico contra SQLite, no necesariamente.
"""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from .. import config
from ..modelos import PublicacionResultados, SubidaResultados
from .validador import VALIDADOR_VERSION, Reporte, validar


def ruta_estatica(edicion: int, base: Path | None = None) -> Path:
    destino = base if base is not None else config.RUTA_PUBLICA
    return destino / f"resultados-{edicion}.json"


def escribir_atomico(ruta: Path, contenido: str) -> None:
    """Escribe a un temporal y renombra.

    Sin esto, alguien puede leer medio JSON justo en el momento de mayor
    tráfico y el sitio muestra un error de parseo. `os.replace` es atómico
    dentro del mismo sistema de archivos.
    """
    ruta.parent.mkdir(parents=True, exist_ok=True)
    tmp = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=ruta.parent,
            prefix=f".{ruta.name}.",
            suffix=".tmp",
            delete=False,
        ) as f:
            tmp = Path(f.name)
            f.write(contenido)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, ruta)
        tmp = None
    finally:
        if tmp is not None and tmp.exists():
            tmp.unlink()


def _serializar(datos: dict[str, Any]) -> str:
    # `ensure_ascii=False`: el JSON lleva Hernández, Zúñiga y Muñoz, y se sirve
    # como UTF-8. Escaparlos engordaría el archivo sin ganar nada.
    return json.dumps(datos, ensure_ascii=False, indent=2) + "\n"


def _reporte_a_dict(reporte: Reporte) -> dict[str, Any]:
    return {
        "validador_version": VALIDADOR_VERSION,
        "resumen": reporte.resumen(),
        "hallazgos": [asdict(h) for h in reporte.hallazgos],
        "cambios_de_estado": reporte.cambios_de_estado,
    }


def siguiente_version(s: Session, edicion: int) -> int:
    previas = s.exec(
        select(PublicacionResultados).where(PublicacionResultados.edicion == edicion)
    ).all()
    return max((p.version for p in previas), default=0) + 1


def activa(s: Session, edicion: int) -> PublicacionResultados | None:
    return s.exec(
        select(PublicacionResultados)
        .where(PublicacionResultados.edicion == edicion)
        .where(PublicacionResultados.activa == True)  # noqa: E712
    ).first()


def historial(s: Session, edicion: int) -> list[PublicacionResultados]:
    return list(
        s.exec(
            select(PublicacionResultados)
            .where(PublicacionResultados.edicion == edicion)
            .order_by(PublicacionResultados.version.desc())
        ).all()
    )


def desactualizada(publicacion: PublicacionResultados) -> bool:
    """¿Se publicó con un validador distinto del actual?

    Es un AVISO para el admin, no un bloqueo: la publicación sigue siendo
    válida y es lo que la gente ya vio.
    """
    return publicacion.validador_version != VALIDADOR_VERSION


def _guardar(
    s: Session,
    *,
    edicion: int,
    crudo: dict[str, Any],
    normalizado: dict[str, Any],
    reporte: Reporte,
    publicado_por: str,
    origen_version: int | None,
    base_estatica: Path | None,
) -> PublicacionResultados:
    """Crea una versión nueva, la activa y escribe el estático."""
    # Se desactivan las anteriores ANTES de escribir: si algo falla a media
    # escritura, no quedan dos versiones activas.
    for previa in s.exec(
        select(PublicacionResultados).where(PublicacionResultados.edicion == edicion)
    ).all():
        previa.activa = False
        s.add(previa)

    publicado = _serializar(normalizado)
    publicacion = PublicacionResultados(
        edicion=edicion,
        version=siguiente_version(s, edicion),
        generado_en=str(crudo.get("generado_en", "")),
        publicado_en=datetime.now(timezone.utc),
        publicado_por=publicado_por,
        parcial=bool(crudo.get("parcial", False)),
        nota_parcial=crudo.get("nota_parcial"),
        json_crudo=_serializar(crudo),
        json_publicado=publicado,
        validador_version=VALIDADOR_VERSION,
        reporte_validacion=json.dumps(_reporte_a_dict(reporte), ensure_ascii=False),
        activa=True,
        total_corredores=reporte.total_corredores,
        total_marcados=len(reporte.marcas),
        origen_version=origen_version,
    )
    s.add(publicacion)
    s.commit()
    s.refresh(publicacion)

    escribir_atomico(ruta_estatica(edicion, base_estatica), publicado)
    return publicacion


def publicar(
    s: Session,
    crudo: dict[str, Any],
    *,
    edicion: int,
    publicado_por: str,
    base_estatica: Path | None = None,
) -> tuple[PublicacionResultados, Reporte]:
    """Valida una subida del host y publica una versión nueva.

    La validación NO bloquea: se publica todo y se marca lo dudoso. Con la
    gente esperando en la meta, «todo o nada» significa no publicar nada.
    """
    normalizado, reporte = validar(crudo)
    publicacion = _guardar(
        s,
        edicion=edicion,
        crudo=crudo,
        normalizado=normalizado,
        reporte=reporte,
        publicado_por=publicado_por,
        origen_version=None,
        base_estatica=base_estatica,
    )
    return publicacion, reporte


# ===========================================================================
# Subida manual — el camino PRINCIPAL, no el respaldo
# ===========================================================================
#
# El día del evento el host de cronometraje vive en un router dedicado SIN
# internet: no puede hacer `POST /api/resultados`. El flujo real es
#
#     host (sin señal) → exporta JSON a USB → alguien con señal lo sube
#
# y probablemente desde un celular en el Pabellón, no desde una laptop. Por eso
# la subida de archivo es el camino de la meta y el endpoint autenticado queda
# para las correcciones posteriores, cuando ya hay conectividad.


class ErrorSubida(Exception):
    pass


def registrar_subida(
    s: Session,
    contenido: bytes,
    *,
    edicion: int,
    subido_por: str,
    nombre_archivo: str,
) -> tuple[SubidaResultados, Reporte]:
    """Valida un archivo subido y lo guarda SIN publicar.

    Nada se publica sin que alguien haya visto el reporte. El crudo se guarda
    aquí mismo: si el archivo resulta malo y se descarta, queremos saber que
    pasó y con qué.
    """
    try:
        crudo = json.loads(contenido.decode("utf-8-sig"))
    except UnicodeDecodeError as e:
        raise ErrorSubida("El archivo no está en UTF-8.") from e
    except json.JSONDecodeError as e:
        raise ErrorSubida(f"El archivo no es un JSON válido: {e.msg} (línea {e.lineno}).") from e

    if not isinstance(crudo, dict) or not isinstance(crudo.get("categorias"), list):
        raise ErrorSubida("El JSON no trae una lista de `categorias`: no parece un export de resultados.")

    normalizado, reporte = validar(crudo)
    subida = SubidaResultados(
        edicion=edicion,
        subido_por=subido_por,
        subido_en=datetime.now(timezone.utc),
        nombre_archivo=nombre_archivo[:120],
        json_crudo=_serializar(crudo),
        reporte_validacion=json.dumps(_reporte_a_dict(reporte), ensure_ascii=False),
        total_corredores=reporte.total_corredores,
        total_marcados=len(reporte.marcas),
        resultado="pendiente",
    )
    s.add(subida)
    s.commit()
    s.refresh(subida)
    # `normalizado` no se persiste todavía: se recalcula al publicar.
    del normalizado
    return subida, reporte


def publicar_subida(
    s: Session,
    subida_id: int,
    *,
    publicado_por: str,
    parcial: bool | None = None,
    nota_parcial: str | None = None,
    base_estatica: Path | None = None,
) -> tuple[PublicacionResultados, Reporte]:
    """Publica una subida que ya se revisó."""
    subida = s.get(SubidaResultados, subida_id)
    if subida is None:
        raise ErrorSubida("Esa subida no existe.")
    if subida.resultado != "pendiente":
        raise ErrorSubida(f"Esa subida ya está {subida.resultado}.")

    crudo = json.loads(subida.json_crudo)
    # El operador puede marcar parcial para publicar el 40 km sin esperar al
    # 80: el día del evento las rutas terminan con horas de diferencia.
    if parcial is not None:
        crudo["parcial"] = parcial
    if nota_parcial is not None:
        crudo["nota_parcial"] = nota_parcial.strip() or None

    publicacion, reporte = publicar(
        s,
        crudo,
        edicion=subida.edicion,
        publicado_por=publicado_por,
        base_estatica=base_estatica,
    )
    subida.resultado = "publicada"
    subida.publicacion_id = publicacion.id
    s.add(subida)
    s.commit()
    return publicacion, reporte


def descartar_subida(s: Session, subida_id: int, *, motivo: str = "") -> SubidaResultados:
    """Descarta sin publicar. El crudo se conserva a propósito."""
    subida = s.get(SubidaResultados, subida_id)
    if subida is None:
        raise ErrorSubida("Esa subida no existe.")
    if subida.resultado != "pendiente":
        raise ErrorSubida(f"Esa subida ya está {subida.resultado}.")
    subida.resultado = "descartada"
    subida.motivo_descarte = motivo.strip() or None
    s.add(subida)
    s.commit()
    s.refresh(subida)
    return subida


def subidas(s: Session, edicion: int) -> list[SubidaResultados]:
    return list(
        s.exec(
            select(SubidaResultados)
            .where(SubidaResultados.edicion == edicion)
            .order_by(SubidaResultados.subido_en.desc())
        ).all()
    )


def revertir(
    s: Session,
    *,
    edicion: int,
    version: int,
    base_estatica: Path | None = None,
) -> PublicacionResultados:
    """Restaura EXACTAMENTE lo que se sirvió en esa versión.

    No revalida. Es a propósito: si entre medias se corrigió el validador,
    reprocesar produciría una versión que nunca estuvo publicada. Alguien con
    una captura donde aparece en 3º se encontraría en 4º sin explicación
    posible.

    Para reprocesar con las reglas nuevas está `revalidar()`, que crea una
    versión nueva en vez de disfrazar una vieja.
    """
    objetivo = s.exec(
        select(PublicacionResultados)
        .where(PublicacionResultados.edicion == edicion)
        .where(PublicacionResultados.version == version)
    ).first()
    if objetivo is None:
        raise ValueError(f"No existe la versión {version} de la edición {edicion}.")

    for p in s.exec(
        select(PublicacionResultados).where(PublicacionResultados.edicion == edicion)
    ).all():
        p.activa = p.id == objetivo.id
        s.add(p)
    s.commit()
    s.refresh(objetivo)

    # Byte por byte lo que estuvo publicado. Sin pasar por el validador.
    escribir_atomico(ruta_estatica(edicion, base_estatica), objetivo.json_publicado)
    return objetivo


def revalidar(
    s: Session,
    *,
    edicion: int,
    version: int,
    publicado_por: str,
    base_estatica: Path | None = None,
) -> tuple[PublicacionResultados, Reporte]:
    """Reprocesa el crudo de una versión con el validador ACTUAL.

    Crea una versión NUEVA; nunca sobrescribe la original. Así, si el comité
    quiere volver, la versión previa sigue intacta y con su propio
    `validador_version`.
    """
    origen = s.exec(
        select(PublicacionResultados)
        .where(PublicacionResultados.edicion == edicion)
        .where(PublicacionResultados.version == version)
    ).first()
    if origen is None:
        raise ValueError(f"No existe la versión {version} de la edición {edicion}.")

    crudo = json.loads(origen.json_crudo)
    normalizado, reporte = validar(crudo)
    publicacion = _guardar(
        s,
        edicion=edicion,
        crudo=crudo,
        normalizado=normalizado,
        reporte=reporte,
        publicado_por=publicado_por,
        origen_version=version,
        base_estatica=base_estatica,
    )
    return publicacion, reporte
