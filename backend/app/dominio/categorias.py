"""Catálogo de categorías, leído de `compartido/categorias.json`.

Ese JSON lo genera `backend/scripts/exportar_catalogo.ts` desde
`src/data/categorias.ts`, que es la ÚNICA fuente de verdad del catálogo.
Aquí no se escribe ninguna categoría a mano: una copia mantenida a mano acaba
divergiendo, y una divergencia aquí pone corredores en la categoría equivocada
el día de la carrera.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

Rama = Literal["V", "F"]
Grupo = Literal["Infantiles", "Grupo Menor", "Grupo Mayor"]
RutaAsignada = Literal["infantil", "40", "80"]

# backend/app/dominio/categorias.py -> raíz del repo
RAIZ = Path(__file__).resolve().parents[3]
RUTA_CATALOGO = RAIZ / "compartido" / "categorias.json"


@dataclass(frozen=True, slots=True)
class Categoria:
    """Espejo de la `interface Categoria` de `src/types/roadbook.ts`.

    Los nombres conservan el camelCase del origen (`edadMin`, `requiereEbike`)
    a propósito: son el contrato con el front, no nombres nuevos.
    """

    id: int
    nombre: str
    clave: str
    grupo: str
    rama: str
    edadMin: int | None
    edadMax: int | None
    descripcionEdad: str
    vueltas: int
    abierta: bool
    rodadas: str | None = None
    requierePeso: int | None = None
    requiereEbike: bool = False


@dataclass(frozen=True, slots=True)
class Catalogo:
    categorias: tuple[Categoria, ...]
    mapa_rutas: dict[str, tuple[str, ...]]
    orden_grupos: tuple[str, ...]

    def por_id(self, categoria_id: int) -> Categoria | None:
        for c in self.categorias:
            if c.id == categoria_id:
                return c
        return None


@lru_cache(maxsize=1)
def catalogo() -> Catalogo:
    """Carga el catálogo una sola vez. `encoding='utf-8'` explícito: en Windows
    el default es cp1252 y `Pañales` reventaría la lectura."""
    crudo = json.loads(RUTA_CATALOGO.read_text(encoding="utf-8"))
    categorias = tuple(
        Categoria(
            id=c["id"],
            nombre=c["nombre"],
            clave=c["clave"],
            grupo=c["grupo"],
            rama=c["rama"],
            edadMin=c["edadMin"],
            edadMax=c["edadMax"],
            descripcionEdad=c["descripcionEdad"],
            vueltas=c["vueltas"],
            abierta=c["abierta"],
            rodadas=c.get("rodadas"),
            requierePeso=c.get("requierePeso"),
            requiereEbike=bool(c.get("requiereEbike", False)),
        )
        for c in crudo["categorias"]
    )
    return Catalogo(
        categorias=categorias,
        mapa_rutas={g: tuple(r) for g, r in crudo["mapa_rutas"].items()},
        orden_grupos=tuple(crudo["orden_grupos"]),
    )


def CATEGORIAS() -> tuple[Categoria, ...]:
    return catalogo().categorias


def MAPA_RUTAS() -> dict[str, tuple[str, ...]]:
    return catalogo().mapa_rutas
