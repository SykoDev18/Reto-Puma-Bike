"""Emisión y verificación del folio.

El folio lo emite el SERVIDOR. El front hoy lo genera con `Math.random()`
(`PaginaInscripciones.tsx`, marcado como supuesto): si el cliente manda uno, se
descarta en silencio — no es un error del usuario.

Forma: `RPB2026-000123-7K9F`
       └┬┘ └─┬┘ └──┬─┘ └─┬┘
        │    │     │     └── sufijo aleatorio: impide barrer el padrón
        │    │     └──────── consecutivo: legible y dictable por teléfono
        │    └────────────── edición
        └─────────────────── prefijo

El consecutivo solo es cómodo para las personas; la seguridad la da el sufijo
más el segundo factor (fecha de nacimiento) que exige la consulta.
"""

from __future__ import annotations

import re
import secrets

from .. import config

_FOLIO = re.compile(r"^([A-Z]+)(\d{4})-(\d{6})-([A-Z0-9]+)$")


def sufijo_aleatorio() -> str:
    """`secrets`, no `random`: `random` es predecible a partir de su semilla."""
    return "".join(
        secrets.choice(config.ALFABETO_FOLIO) for _ in range(config.LARGO_SUFIJO_FOLIO)
    )


def emitir(edicion: int, consecutivo: int) -> str:
    return f"{config.PREFIJO_FOLIO}{edicion}-{consecutivo:06d}-{sufijo_aleatorio()}"


def es_valido(folio: str) -> bool:
    """Forma correcta. No dice nada sobre si existe: eso lo responde la BD."""
    m = _FOLIO.match(folio.strip().upper())
    if m is None:
        return False
    return all(c in config.ALFABETO_FOLIO for c in m.group(4))


def normalizar(folio: str) -> str:
    """La gente lo teclea desde una captura de WhatsApp: se acepta con espacios
    y en minúsculas."""
    return folio.strip().upper().replace(" ", "")
