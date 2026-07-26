"""El motor de Python tiene que dar EXACTAMENTE lo mismo que el de TypeScript.

Se mide contra `compartido/casos-elegibilidad.json`, generado por el motor del
front. Si este test falla, el puerto divergió — y una divergencia significa que
el servidor aceptaría una categoría que el front no ofrece, es decir, alguien
corriendo donde no le toca.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.dominio.categorias import CATEGORIAS, catalogo
from app.dominio.elegibilidad import (
    EntradaElegibilidad,
    categorias_elegibles,
    edad_nominal,
)

RAIZ = Path(__file__).resolve().parents[2]
CASOS = json.loads(
    (RAIZ / "compartido" / "casos-elegibilidad.json").read_text(encoding="utf-8")
)
ANIO = CASOS["anio_evento"]


def _resumir(c) -> dict:
    return {"id": c.id, "clave": c.clave, "nombre": c.nombre}


@pytest.mark.parametrize("caso", CASOS["casos"], ids=lambda c: c["nombre"])
def test_paridad_con_typescript(caso: dict) -> None:
    entrada = caso["entrada"]
    esperado = caso["esperado"]

    edad = edad_nominal(entrada["fecha_nacimiento"], ANIO)
    assert edad == esperado["edad_nominal"], "la edad nominal no coincide con el front"

    r = categorias_elegibles(
        EntradaElegibilidad(
            edad_nominal=edad,
            sexo=entrada["sexo"],
            tipo_bicicleta=entrada["tipo_bicicleta"],
            peso_90_mas=entrada["peso_90_mas"],
        )
    )

    obtenido = {
        "recomendada": _resumir(r.recomendada) if r.recomendada else None,
        "alternativas": [_resumir(c) for c in r.alternativas],
        "sin_coincidencia": r.sin_coincidencia,
        "infantiles": r.infantiles,
        "solo_ebike": r.solo_ebike,
    }
    assert obtenido["recomendada"] == esperado["recomendada"]
    # El ORDEN importa: el front lo usa para pintar la lista de alternativas.
    assert obtenido["alternativas"] == esperado["alternativas"]
    assert obtenido["sin_coincidencia"] == esperado["sin_coincidencia"]
    assert obtenido["infantiles"] == esperado["infantiles"]
    assert obtenido["solo_ebike"] == esperado["solo_ebike"]


# --------------------------------------------------------------------------
# La edad nominal es por AÑO, no por cumpleaños. Es la regla del comité.
# --------------------------------------------------------------------------


def test_edad_nominal_es_por_anio_no_por_cumpleanos() -> None:
    # Nacido el 31 de diciembre: el 5 de julio de 2026 tiene 33 años cumplidos,
    # pero su edad NOMINAL es 34 y por eso corre Máster 30.
    assert edad_nominal("31/12/1992", 2026) == 34
    assert edad_nominal("01/01/1992", 2026) == 34


def test_edad_nominal_acepta_las_dos_formas_de_fecha() -> None:
    """El formulario captura ISO; el payload viaja DD/MM/AAAA. Confundirlas es
    el error fácil de este puente."""
    assert edad_nominal("1992-08-14", 2026) == 34
    assert edad_nominal("14/08/1992", 2026) == 34
    assert edad_nominal("  14/08/1992  ", 2026) == 34


def test_edad_nominal_rechaza_basura() -> None:
    for malo in ("", "14-08-1992", "1992/08/14", "99/99/9999", "abc", "2026"):
        assert edad_nominal(malo, 2026) is None, f"debió rechazar {malo!r}"


def test_no_confunde_ddmmaaaa_con_iso() -> None:
    """`05/07/2026` es 5 de julio de 2026. Si se leyera como ISO daría un año
    absurdo y con él una categoría inventada."""
    assert edad_nominal("05/07/2026", 2026) == 0


# --------------------------------------------------------------------------
# Catálogo
# --------------------------------------------------------------------------


def test_el_catalogo_carga_las_28_categorias() -> None:
    assert len(CATEGORIAS()) == 28
    claves = {c.clave for c in CATEGORIAS()}
    for clave in ("N", "X", "Y", "RV", "RF", "EBV", "EBF", "M", "Pv", "Pf"):
        assert clave in claves


def test_el_catalogo_conserva_los_acentos() -> None:
    """En Windows el default es cp1252: sin `encoding='utf-8'` esto reventaría."""
    nombres = {c.nombre for c in CATEGORIAS()}
    assert "Infantil Pañales Varonil" in nombres
    assert any("Máster" in n for n in nombres)


def test_mapa_rutas_coincide_con_el_front() -> None:
    mapa = catalogo().mapa_rutas
    assert mapa["Infantiles"] == ("infantil",)
    assert mapa["Grupo Menor"] == ("40",)
    assert mapa["Grupo Mayor"] == ("80", "40")


# --------------------------------------------------------------------------
# Los cinco casos exigidos, escritos a mano además del fixture: si alguien
# regenera el fixture con un motor roto, estos siguen fallando.
# --------------------------------------------------------------------------


def _elegir(fecha: str, sexo: str, bici: str = "MTB", peso: bool = False):
    return categorias_elegibles(
        EntradaElegibilidad(edad_nominal(fecha, 2026), sexo, bici, peso)
    )


def test_caso_master_30_varonil() -> None:
    r = _elegir("14/08/1992", "M")
    assert r.recomendada is not None
    assert r.recomendada.nombre == "Máster 30 Varonil"
    assert r.recomendada.clave == "N"


def test_caso_infantil_c_femenil() -> None:
    r = _elegir("10/05/2015", "F")
    assert r.recomendada is not None
    assert r.recomendada.nombre == "Infantil C Femenil"
    assert r.infantiles is True
    assert r.alternativas == []


def test_caso_hueco_femenil_de_17_anios() -> None:
    """EL HALLAZGO documentado del front: no hay categoría femenil por edad
    entre 16 y 18. No se inventa una; se ofrecen las abiertas."""
    r = _elegir("03/03/2009", "F")
    assert r.recomendada is None
    assert r.sin_coincidencia is True
    claves = [c.clave for c in r.alternativas]
    assert "Y" in claves, "Elite Femenil debe ofrecerse"
    assert "RF" in claves, "Rodadores Femenil debe ofrecerse"


def test_caso_ebike_solo_ofrece_ebike_de_su_rama() -> None:
    for sexo, esperada in (("M", "EBV"), ("F", "EBF")):
        r = _elegir("14/08/1992", sexo, bici="E-Bike")
        assert r.solo_ebike is True
        assert r.recomendada is None
        assert [c.clave for c in r.alternativas] == [esperada]


def test_caso_mamuts_depende_del_peso_y_es_solo_varonil() -> None:
    sin_peso = [c.clave for c in _elegir("14/08/1992", "M", peso=False).alternativas]
    con_peso = [c.clave for c in _elegir("14/08/1992", "M", peso=True).alternativas]
    assert "M" not in sin_peso
    assert "M" in con_peso
    # Nunca en femenil, ni marcando el peso.
    femenil = [c.clave for c in _elegir("14/08/1992", "F", peso=True).alternativas]
    assert "M" not in femenil
