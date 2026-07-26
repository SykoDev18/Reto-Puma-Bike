"""El validador de resultados.

Dos fixtures con papeles distintos:

  **A · `resultados-2026.json`** — los datos reales. El validador debe
  reproducir EXACTAMENTE 32 marcas: 15 REVISION y 17 SIN_TIEMPO. Cero de
  regla 1, porque esos 7 tiempos malformados ya venían normalizados desde los
  PDF. Este fixture prueba que no inventamos marcas, no que cazamos errores.

  **B · sintético** — los errores crudos que la regla 1 sí debe cazar. Este es
  el termómetro de verdad del validador.
"""

from __future__ import annotations

import io
import json
from collections import Counter
from pathlib import Path

import pytest

from app.dominio.validador import (
    NOTA_MAS_RAPIDO,
    NOTA_SIN_TIEMPO,
    a_centesimas,
    normalizar_tiempo,
    validar,
)

RAIZ = Path(__file__).resolve().parents[2]
REALES = RAIZ / "public" / "data" / "resultados-2026.json"
SINTETICO = Path(__file__).resolve().parent / "datos" / "resultados-malformados.json"


def _cargar(ruta: Path) -> dict:
    return json.loads(ruta.read_text(encoding="utf-8"))


@pytest.fixture
def reales() -> dict:
    return _cargar(REALES)


def _estados(datos: dict) -> Counter:
    return Counter(r["estado"] for c in datos["categorias"] for r in c["corredores"])


def _buscar(datos: dict, cat_id: str, dorsal: int, pos=...) -> dict:
    for c in datos["categorias"]:
        if c["id"] != cat_id:
            continue
        for r in c["corredores"]:
            if r["dorsal"] == dorsal and (pos is ... or r["posicion"] == pos):
                return r
    raise AssertionError(f"no está {cat_id} #{dorsal}")


# ==========================================================================
# FIXTURE A — los datos reales: exactamente 32 marcas
# ==========================================================================


def test_A_reproduce_exactamente_32_marcas(reales) -> None:
    salida, reporte = validar(reales)
    estados = _estados(salida)
    assert estados["REVISION"] == 15, reporte.por_regla()
    assert estados["SIN_TIEMPO"] == 17
    assert estados["REVISION"] + estados["SIN_TIEMPO"] == 32
    assert len(reporte.marcas) == 32


def test_A_no_toca_los_650_OK_ni_los_99_DNF(reales) -> None:
    salida, _ = validar(reales)
    estados = _estados(salida)
    assert estados["OK"] == 650
    assert estados["DNF"] == 99
    assert sum(estados.values()) == 781


def test_A_la_regla_1_no_encuentra_nada(reales) -> None:
    """Los 7 malformados existían en los PDF y ya venían normalizados en el
    JSON. Aquí su resultado correcto es cero."""
    _, reporte = validar(reales)
    assert reporte.por_regla().get(1, 0) == 0
    assert not [h for h in reporte.hallazgos if h.regla == 1]


def test_A_ningun_estado_cambia_respecto_del_archivo(reales) -> None:
    """El archivo ya viene validado por el comité. Revalidar no debe mover
    NADA: ni marcar de más ni limpiar lo marcado."""
    _, reporte = validar(reales)
    assert reporte.cambios_de_estado == []


def test_A_el_reparto_por_regla_es_el_esperado(reales) -> None:
    _, reporte = validar(reales)
    assert reporte.por_regla() == {
        2: 3,  # 2 posiciones repetidas (EBV-40) + 1 fuera de rango (Y-80 #638)
        3: 4,  # Y-80 #375 y W-80 #143/#835/#792
        4: 4,  # JLV-40 #146, W-80 #59, Z-40 #127, RV-40 #668
        5: 17,  # los SIN_TIEMPO
        6: 3,  # N-80 #25 (x2) y Z-40 #127 (el que no lleva posición)
        7: 1,  # JLV-40 #852
    }


def test_A_los_huecos_se_reportan_pero_no_se_renumeran(reales) -> None:
    """En N-40 falta la posición 32 y en Y-80 falta el 2º lugar. Cerrar el
    hueco sería inventar un resultado."""
    salida, reporte = validar(reales)
    avisos = [h for h in reporte.avisos if h.regla == 2]
    assert len(avisos) == 2

    # N-40 tiene hueco pero NADIE fuera de rango (74 ≤ 81 corredores): el hueco
    # explica el rango. Se reporta suelto.
    assert ("N-40", "Falta la posición 32 en la numeración.") in {
        (h.categoria_id, h.mensaje) for h in avisos
    }

    # Y las posiciones publicadas siguen siendo las del sistema.
    n40 = next(c for c in salida["categorias"] if c["id"] == "N-40")
    posiciones = {r["posicion"] for r in n40["corredores"] if r["posicion"] is not None}
    assert 32 not in posiciones
    assert 31 in posiciones and 33 in posiciones


def test_A_el_hueco_y_el_fuera_de_rango_se_reportan_como_UN_solo_error(reales) -> None:
    """En Y-80 falta la 2 y sobra la 72: es un «2» capturado como «72», y el
    tiempo del #638 lo confirma.

    Decirle al comité «la 72 probablemente es 2, revísala» es una tarea de
    confirmación; decirle «hay dos anomalías de posición» es una investigación.
    """
    salida, reporte = validar(reales)
    hipotesis = [h for h in reporte.avisos if h.categoria_id == "Y-80" and h.regla == 2]
    assert len(hipotesis) == 1
    mensaje = hipotesis[0].mensaje
    assert "72" in mensaje and "#638" in mensaje
    assert "debería ser 2" in mensaje
    assert "el tiempo corresponde al lugar 2" in mensaje

    # Pero NO se renumera: la posición sigue siendo 72 y el registro marcado.
    r = _buscar(salida, "Y-80", 638)
    assert r["posicion"] == 72
    assert r["estado"] == "REVISION"


def test_la_hipotesis_no_se_inventa_cuando_el_patron_no_encaja() -> None:
    """Sin exactamente un hueco y exactamente un fuera de rango, o si los
    dígitos no encajan, se reportan por separado."""
    datos = {
        "categorias": [
            {
                "id": "X-1",
                "corredores": [
                    {"dorsal": 1, "nombre": "A", "posicion": 1, "tiempo": "01:00:00.00",
                     "vueltas_hechas": 1, "vueltas_totales": 1, "estado": "OK"},
                    # Hueco en 2, y un fuera de rango que NO contiene el "2".
                    {"dorsal": 2, "nombre": "B", "posicion": 3, "tiempo": "01:01:00.00",
                     "vueltas_hechas": 1, "vueltas_totales": 1, "estado": "OK"},
                    {"dorsal": 3, "nombre": "C", "posicion": 99, "tiempo": "01:02:00.00",
                     "vueltas_hechas": 1, "vueltas_totales": 1, "estado": "OK"},
                ],
            }
        ]
    }
    _, reporte = validar(datos)
    mensajes = [h.mensaje for h in reporte.avisos if h.regla == 2]
    assert mensajes == ["Falta la posición 2 en la numeración."]


# --- Los casos con nombre y apellido --------------------------------------


def test_A_el_campeon_de_master_50_queda_SIN_TIEMPO_no_OK(reales) -> None:
    """Z-40 #577 ganó su categoría sin tiempo registrado. No es un ausente:
    es el campeón. Conserva la posición 1."""
    salida, _ = validar(reales)
    r = _buscar(salida, "Z-40", 577)
    assert r["posicion"] == 1
    assert r["tiempo"] is None
    assert r["estado"] == "SIN_TIEMPO"
    assert r["nota"] == NOTA_SIN_TIEMPO


def test_A_los_cuatro_mas_rapidos_que_el_primero(reales) -> None:
    salida, _ = validar(reales)
    for cat, dorsal in (("Y-80", 375), ("W-80", 143), ("W-80", 835), ("W-80", 792)):
        r = _buscar(salida, cat, dorsal)
        assert r["estado"] == "REVISION", f"{cat} #{dorsal}"
        assert r["nota"] == NOTA_MAS_RAPIDO


def test_A_la_posicion_72_de_una_categoria_de_14(reales) -> None:
    salida, _ = validar(reales)
    r = _buscar(salida, "Y-80", 638)
    assert r["estado"] == "REVISION"
    assert r["nota"] == "Posición 72 fuera de rango: la categoría tiene 14 clasificados."


def test_A_dos_corredores_en_la_misma_posicion_2(reales) -> None:
    salida, _ = validar(reales)
    for dorsal in (84, 680):
        r = _buscar(salida, "EBV-40", dorsal)
        assert r["estado"] == "REVISION"
        assert r["nota"] == "La posición 2 está asignada a más de un corredor."
    # No se reordenan: los dos conservan la posición 2.
    ebv = next(c for c in salida["categorias"] if c["id"] == "EBV-40")
    assert [r["posicion"] for r in ebv["corredores"][:4]] == [1, 2, 2, 3]


def test_A_el_registro_sin_nombre(reales) -> None:
    salida, _ = validar(reales)
    r = _buscar(salida, "JLV-40", 852)
    assert r["nombre"] == "(sin nombre)"
    assert r["estado"] == "REVISION"
    assert r["nota"] == "Registro sin nombre en el padrón."


def test_A_precedencia_R4_gana_a_R6_en_el_dorsal_127(reales) -> None:
    """El #127 de Z-40 con posición tiene vueltas incompletas Y dorsal
    duplicado. El comité le puso la nota de vueltas; el validador reproduce
    esa precedencia."""
    salida, _ = validar(reales)
    con_posicion = _buscar(salida, "Z-40", 127, pos=35)
    sin_posicion = _buscar(salida, "Z-40", 127, pos=None)
    assert con_posicion["nota"] == "Registra 0/1 vueltas pero tiene posición y tiempo."
    assert sin_posicion["nota"] == "El dorsal 127 aparece en más de un registro."


def test_A_el_dorsal_25_duplicado_marca_las_dos_apariciones(reales) -> None:
    salida, _ = validar(reales)
    n80 = next(c for c in salida["categorias"] if c["id"] == "N-80")
    apariciones = [r for r in n80["corredores"] if r["dorsal"] == 25]
    assert len(apariciones) == 2
    for r in apariciones:
        assert r["estado"] == "REVISION"
        assert r["nota"] == "El dorsal 25 aparece en más de un registro."


# ==========================================================================
# IDEMPOTENCIA — el criterio de aceptación de la fase
# ==========================================================================


def test_validar_dos_veces_da_lo_mismo(reales) -> None:
    """`validar(validar(x)) == validar(x)`. Sin esto, cada republicación
    escalaría estados y acumularía notas."""
    una, r1 = validar(reales)
    dos, r2 = validar(una)
    assert una == dos
    assert r1.resumen() == r2.resumen()
    assert r2.cambios_de_estado == []


def test_idempotente_tambien_sobre_el_sintetico() -> None:
    datos = _cargar(SINTETICO)
    una, _ = validar(datos)
    dos, r2 = validar(una)
    assert una == dos
    assert r2.cambios_de_estado == [], r2.cambios_de_estado


def test_no_muta_la_entrada(reales) -> None:
    antes = json.dumps(reales, sort_keys=True)
    validar(reales)
    assert json.dumps(reales, sort_keys=True) == antes


# ==========================================================================
# FIXTURE B — el sintético: aquí la regla 1 sí tiene trabajo
# ==========================================================================


def test_B_normaliza_los_siete_tiempos_de_los_PDF() -> None:
    """Los 7 malformados originales. Se recuperan sin adivinar: el separador
    llegó mal, pero los dígitos son los que son."""
    casos = {
        "04:05:48:71": "04:05:48.71",
        "05:45:25:74": "05:45:25.74",
        "03:16:05:69": "03:16:05.69",
        "05.08:02.70": "05:08:02.70",
        "5:35:45.95": "05:35:45.95",
        "04:22.07.63": "04:22:07.63",
        "04:04.25.23": "04:04:25.23",
    }
    for crudo, esperado in casos.items():
        normalizado, corregido = normalizar_tiempo(crudo)
        assert normalizado == esperado, f"{crudo} -> {normalizado}"
        assert corregido is True


def test_B_lo_irrecuperable_se_marca_no_se_inventa() -> None:
    """Un tiempo inventado decide un podio. Si no se puede recuperar sin
    adivinar, se marca."""
    for basura in ("no es un tiempo", "99:99:99.99", "", "1:2:3", "04:05"):
        normalizado, _ = normalizar_tiempo(basura)
        assert normalizado is None, basura


def test_B_el_validador_normaliza_y_avisa() -> None:
    datos = _cargar(SINTETICO)
    salida, reporte = validar(datos)

    normalizados = [h for h in reporte.hallazgos if h.accion == "normalizado"]
    assert len(normalizados) == 7, [h.mensaje for h in normalizados]

    # Y el tiempo publicado ya es el bueno.
    r = _buscar(salida, "TEST-40", 101)
    assert r["tiempo"] == "04:05:48.71"


def test_B_caza_las_demas_anomalias() -> None:
    datos = _cargar(SINTETICO)
    salida, reporte = validar(datos)
    reglas = reporte.por_regla()

    assert reglas.get(1, 0) >= 1, "el tiempo irrecuperable"
    assert reglas.get(6, 0) >= 2, "el dorsal duplicado"
    assert reglas.get(7, 0) >= 1, "el nombre vacío"
    assert any(h.regla == 2 and h.severidad == "aviso" for h in reporte.hallazgos), (
        "la posición faltante"
    )

    irrecuperable = _buscar(salida, "TEST-40", 108)
    assert irrecuperable["estado"] == "REVISION"
    assert "no tiene el formato" in irrecuperable["nota"]


def test_B_el_nombre_vacio_queda_con_placeholder() -> None:
    salida, _ = validar(_cargar(SINTETICO))
    r = _buscar(salida, "TEST-40", 110)
    assert r["nombre"] == "(sin nombre)"
    assert r["estado"] == "REVISION"


# ==========================================================================
# Utilidades
# ==========================================================================


def test_a_centesimas_no_pierde_las_centesimas() -> None:
    """En Elite Varonil el 1º y el 2º se separan por 4.29 segundos."""
    assert a_centesimas("03:01:42.41") == ((3 * 60 + 1) * 60 + 42) * 100 + 41
    assert a_centesimas("03:01:46.70") - a_centesimas("03:01:42.41") == 429
    assert a_centesimas(None) is None
    assert a_centesimas("basura") is None


def test_el_reporte_resume_sin_datos_personales(reales) -> None:
    _, reporte = validar(reales)
    resumen = reporte.resumen()
    assert resumen["total_corredores"] == 781
    assert resumen["marcados"] == 32
    # El resumen lleva dorsales y categorías, nunca nombres.
    assert "nombre" not in json.dumps(resumen)
