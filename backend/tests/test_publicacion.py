"""Publicación de resultados: versionado, estático y reversión."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.dominio.publicacion import (
    activa,
    desactualizada,
    escribir_atomico,
    historial,
    publicar,
    revalidar,
    revertir,
    ruta_estatica,
)

RAIZ = Path(__file__).resolve().parents[2]


@pytest.fixture
def crudo() -> dict:
    return json.loads(
        (RAIZ / "public" / "data" / "resultados-2026.json").read_text(encoding="utf-8")
    )


@pytest.fixture
def destino(tmp_path) -> Path:
    return tmp_path / "publico"


# --------------------------------------------------------------------------
# Publicar
# --------------------------------------------------------------------------


def test_publicar_escribe_el_estatico_y_no_bloquea(s, crudo, destino) -> None:
    """32 marcas y aun así se publican los 781: la validación marca, no
    detiene. Con la gente esperando en la meta, «todo o nada» es no publicar."""
    pub, reporte = publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)

    assert pub.version == 1
    assert pub.activa is True
    assert pub.total_corredores == 781
    assert pub.total_marcados == 32

    archivo = ruta_estatica(2026, destino)
    assert archivo.exists()
    publicado = json.loads(archivo.read_text(encoding="utf-8"))
    corredores = [r for c in publicado["categorias"] for r in c["corredores"]]
    assert len(corredores) == 781
    assert len(reporte.marcas) == 32


def test_el_estatico_conserva_los_acentos_sin_escapar(s, crudo, destino) -> None:
    publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    texto = ruta_estatica(2026, destino).read_text(encoding="utf-8")
    assert "Hernández" in texto or "Zúñiga" in texto
    assert "\\u00e1" not in texto  # sin escapes: se sirve como UTF-8


def test_guarda_el_crudo_sin_normalizar(s, crudo, destino) -> None:
    """Es lo que hace reversible la publicación."""
    pub, _ = publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    guardado = json.loads(pub.json_crudo)
    assert guardado == crudo


def test_el_reporte_queda_guardado_con_la_publicacion(s, crudo, destino) -> None:
    pub, _ = publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    reporte = json.loads(pub.reporte_validacion)
    assert reporte["resumen"]["marcados"] == 32
    assert reporte["resumen"]["por_regla"] == {"2": 3, "3": 4, "4": 4, "5": 17, "6": 3, "7": 1}


def test_publica_quien_lo_hizo_y_cuando(s, crudo, destino) -> None:
    pub, _ = publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    assert pub.publicado_por == "ana"
    assert pub.publicado_en is not None
    assert pub.generado_en == crudo["generado_en"]


def test_conserva_el_aviso_de_publicacion_parcial(s, crudo, destino) -> None:
    """Faltan las categorías infantiles y el sitio tiene que poder decirlo."""
    pub, _ = publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    assert pub.parcial is True
    assert pub.nota_parcial
    publicado = json.loads(ruta_estatica(2026, destino).read_text(encoding="utf-8"))
    assert publicado["parcial"] is True


# --------------------------------------------------------------------------
# Versionado
# --------------------------------------------------------------------------


def test_cada_publicacion_sube_la_version_y_solo_una_queda_activa(s, crudo, destino) -> None:
    p1, _ = publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    p2, _ = publicar(s, crudo, edicion=2026, publicado_por="beto", base_estatica=destino)
    p3, _ = publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)

    assert [p1.version, p2.version, p3.version] == [1, 2, 3]
    s.refresh(p1)
    s.refresh(p2)
    assert (p1.activa, p2.activa, p3.activa) == (False, False, True)
    assert activa(s, 2026).version == 3


def test_no_mezcla_ediciones(s, crudo, destino) -> None:
    publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    otra = dict(crudo, anio=2027)
    pub, _ = publicar(s, otra, edicion=2027, publicado_por="ana", base_estatica=destino)
    assert pub.version == 1
    assert activa(s, 2026).edicion == 2026
    assert ruta_estatica(2027, destino).exists()


# --------------------------------------------------------------------------
# Reversión — los resultados se corrigen
# --------------------------------------------------------------------------


def test_revertir_reactiva_la_version_y_reescribe_el_estatico(s, crudo, destino) -> None:
    publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)

    # Una segunda publicación con un dato corregido...
    corregido = json.loads(json.dumps(crudo))
    corregido["categorias"][0]["corredores"][0]["nombre"] = "NOMBRE CORREGIDO"
    publicar(s, corregido, edicion=2026, publicado_por="beto", base_estatica=destino)
    publicado = json.loads(ruta_estatica(2026, destino).read_text(encoding="utf-8"))
    assert publicado["categorias"][0]["corredores"][0]["nombre"] == "NOMBRE CORREGIDO"

    # ...y volver atrás devuelve el contenido anterior.
    objetivo = revertir(s, edicion=2026, version=1, base_estatica=destino)
    assert objetivo.version == 1
    assert activa(s, 2026).version == 1
    vuelto = json.loads(ruta_estatica(2026, destino).read_text(encoding="utf-8"))
    assert vuelto["categorias"][0]["corredores"][0]["nombre"] != "NOMBRE CORREGIDO"


def test_revertir_restaura_BYTE_POR_BYTE_lo_que_estuvo_publicado(s, crudo, destino) -> None:
    """El punto de separar revertir de revalidar.

    Si alguien tiene una captura de pantalla donde aparece en 3º, al revertir
    tiene que seguir en 3º. Una v1 reprocesada por un validador nuevo es una v1
    que nunca existió, y no hay forma de explicarle el cambio a esa persona.
    """
    p1, _ = publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    lo_que_vio_la_gente = ruta_estatica(2026, destino).read_text(encoding="utf-8")

    publicar(s, crudo, edicion=2026, publicado_por="beto", base_estatica=destino)
    revertir(s, edicion=2026, version=1, base_estatica=destino)

    assert ruta_estatica(2026, destino).read_text(encoding="utf-8") == lo_que_vio_la_gente
    assert ruta_estatica(2026, destino).read_text(encoding="utf-8") == p1.json_publicado


def test_revertir_NO_reaplica_el_validador(s, crudo, destino, monkeypatch) -> None:
    """Aunque las reglas cambien, revertir sirve lo mismo que se sirvió."""
    publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    original = ruta_estatica(2026, destino).read_text(encoding="utf-8")
    publicar(s, crudo, edicion=2026, publicado_por="beto", base_estatica=destino)

    # Se "rompe" el validador: si revertir lo usara, el resultado cambiaría.
    from app.dominio import publicacion as mod

    def validador_distinto(datos):
        raise AssertionError("revertir no debe llamar al validador")

    monkeypatch.setattr(mod, "validar", validador_distinto)
    revertir(s, edicion=2026, version=1, base_estatica=destino)
    assert ruta_estatica(2026, destino).read_text(encoding="utf-8") == original


# --------------------------------------------------------------------------
# Revalidar — la otra intención, que sí reprocesa
# --------------------------------------------------------------------------


def test_revalidar_crea_una_version_NUEVA_y_no_sobrescribe(s, crudo, destino) -> None:
    p1, _ = publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    p2, reporte = revalidar(
        s, edicion=2026, version=1, publicado_por="beto", base_estatica=destino
    )

    assert p2.version == 2
    assert p2.origen_version == 1
    assert p2.activa is True
    assert len(reporte.marcas) == 32

    # La original sigue intacta y con su propio contenido publicado.
    s.refresh(p1)
    assert p1.version == 1
    assert p1.activa is False
    assert p1.json_publicado  # no se tocó
    assert len(historial(s, 2026)) == 2


def test_revalidar_parte_del_crudo_no_de_lo_publicado(s, crudo, destino) -> None:
    p1, _ = publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    p2, _ = revalidar(
        s, edicion=2026, version=1, publicado_por="ana", base_estatica=destino
    )
    assert json.loads(p2.json_crudo) == json.loads(p1.json_crudo) == crudo


def test_revalidar_una_version_inexistente_falla_claro(s, crudo, destino) -> None:
    publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    with pytest.raises(ValueError, match="No existe la versión 9"):
        revalidar(s, edicion=2026, version=9, publicado_por="ana", base_estatica=destino)


def test_cada_publicacion_registra_con_que_validador_se_hizo(s, crudo, destino) -> None:
    from app.dominio.validador import VALIDADOR_VERSION

    pub, _ = publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    assert pub.validador_version == VALIDADOR_VERSION
    assert desactualizada(pub) is False

    # Si mañana cambian las reglas, el admin lo AVISA, no lo bloquea.
    pub.validador_version = "0.9"
    assert desactualizada(pub) is True


def test_revertir_a_una_version_inexistente_falla_claro(s, crudo, destino) -> None:
    publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    with pytest.raises(ValueError, match="No existe la versión 9"):
        revertir(s, edicion=2026, version=9, base_estatica=destino)


def test_revertir_no_borra_el_historico(s, crudo, destino) -> None:
    publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    publicar(s, crudo, edicion=2026, publicado_por="beto", base_estatica=destino)
    revertir(s, edicion=2026, version=1, base_estatica=destino)

    from sqlmodel import select

    from app.modelos import PublicacionResultados

    todas = s.exec(select(PublicacionResultados)).all()
    assert len(todas) == 2, "revertir no puede borrar versiones"


def test_publicar_despues_de_revertir_sigue_la_numeracion(s, crudo, destino) -> None:
    publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    publicar(s, crudo, edicion=2026, publicado_por="beto", base_estatica=destino)
    revertir(s, edicion=2026, version=1, base_estatica=destino)
    nueva, _ = publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    assert nueva.version == 3, "la versión no se reutiliza"


# --------------------------------------------------------------------------
# Escritura atómica
# --------------------------------------------------------------------------


def test_la_escritura_es_atomica_y_no_deja_temporales(tmp_path) -> None:
    """Sin esto alguien puede leer medio JSON justo en el pico de tráfico."""
    destino = tmp_path / "sub" / "archivo.json"
    escribir_atomico(destino, '{"a":1}\n')
    assert destino.read_text(encoding="utf-8") == '{"a":1}\n'

    escribir_atomico(destino, '{"a":2}\n')
    assert destino.read_text(encoding="utf-8") == '{"a":2}\n'

    sobrantes = [p.name for p in destino.parent.iterdir() if p.name != destino.name]
    assert sobrantes == [], f"quedaron temporales: {sobrantes}"


def test_publicar_es_idempotente_en_el_contenido(s, crudo, destino) -> None:
    """Publicar el mismo crudo dos veces produce el mismo archivo: el
    validador no acumula marcas entre publicaciones."""
    publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    primero = ruta_estatica(2026, destino).read_text(encoding="utf-8")
    publicar(s, crudo, edicion=2026, publicado_por="ana", base_estatica=destino)
    assert ruta_estatica(2026, destino).read_text(encoding="utf-8") == primero
