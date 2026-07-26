"""El catálogo compartido no puede quedarse viejo.

`compartido/categorias.json` y `compartido/casos-elegibilidad.json` se generan
desde el front. Si alguien cambia `src/data/categorias.ts` o
`src/lib/categorias.ts` y no regenera, el backend seguiría validando con el
catálogo anterior — y aceptaría categorías que el front ya no ofrece.

Este test vuelve a correr los generadores y compara. Se salta si no hay Node,
para no romper un entorno de despliegue que solo tiene Python.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
COMPARTIDO = RAIZ / "compartido"

GENERADORES = {
    "categorias.json": "backend/scripts/exportar_catalogo.ts",
    "casos-elegibilidad.json": "backend/scripts/exportar_casos.ts",
}

sin_node = pytest.mark.skipif(
    shutil.which("node") is None,
    reason="Node no está disponible; el chequeo de sincronía corre en CI",
)


def _regenerar(script: str) -> None:
    subprocess.run(
        ["node", "--experimental-strip-types", script],
        cwd=RAIZ,
        check=True,
        capture_output=True,
    )


@sin_node
@pytest.mark.parametrize("archivo,script", GENERADORES.items())
def test_el_archivo_compartido_esta_al_dia(archivo: str, script: str, tmp_path) -> None:
    ruta = COMPARTIDO / archivo
    antes = ruta.read_text(encoding="utf-8")

    respaldo = tmp_path / archivo
    respaldo.write_text(antes, encoding="utf-8")
    try:
        _regenerar(script)
        despues = ruta.read_text(encoding="utf-8")
    finally:
        # Se restaura pase lo que pase: un test no deja el repo sucio.
        ruta.write_text(antes, encoding="utf-8")

    assert antes == despues, (
        f"{archivo} quedó desincronizado del front.\n"
        f"Regenera con:  node --experimental-strip-types {script}"
    )


def test_el_catalogo_tiene_las_28_categorias_con_id_unico() -> None:
    datos = json.loads((COMPARTIDO / "categorias.json").read_text(encoding="utf-8"))
    categorias = datos["categorias"]
    assert len(categorias) == 28
    ids = [c["id"] for c in categorias]
    assert len(ids) == len(set(ids)), "hay ids repetidos en el catálogo"


def test_el_fixture_cubre_los_cinco_casos_exigidos() -> None:
    datos = json.loads((COMPARTIDO / "casos-elegibilidad.json").read_text(encoding="utf-8"))
    nombres = " | ".join(c["nombre"] for c in datos["casos"])
    for exigido in ("Máster 30 Varonil", "Infantil C Femenil", "HUECO", "E-Bike", "Mamut"):
        assert exigido in nombres, f"falta el caso exigido: {exigido}"
