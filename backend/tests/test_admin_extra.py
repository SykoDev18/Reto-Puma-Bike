"""Los añadidos de la revisión de Fase 3.

Cierre de inscripciones, depósito compartido, edición de registro, pantalla de
publicación y contenido (anuncios y hospedaje).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlmodel import Session, select

from app import config, seguridad
from app.dominio import conciliacion, contenido, edicion, publicacion
from app.dominio.registros import ErrorRegistro
from app.modelos import Aviso, Bitacora, Lugar, Registro, SubidaResultados, Usuario

RAIZ = Path(__file__).resolve().parents[2]
CONTRASENA = "contraseña larga y buena ñ"


@pytest.fixture
def admin(s: Session) -> Usuario:
    u = Usuario(
        usuario="ana",
        hash_contrasena=seguridad.hashear(CONTRASENA),
        nombre="Ana",
        rol="admin",
    )
    s.add(u)
    s.commit()
    return u


def _reg(s: Session, folio: str, **cambios) -> Registro:
    base = dict(
        folio=folio,
        creado_en=datetime.now(timezone.utc),
        edicion=config.EDICION,
        nombre=f"Persona{folio.split('-')[1]}",
        apellido_paterno="Rosales",
        apellido_materno=None,
        fecha_nacimiento="14/08/1992",
        sexo="M",
        categoria_id=26,
        categoria_clave="N",
        ruta="80",
        tipo_bicicleta="MTB",
        email="m@example.mx",
        telefono="7721199093",
        kit_nombre="Kit Puma",
        kit_precio=750,
        emergencia_nombre="Ana Rosales",
        emergencia_telefono="7721234567",
        edad_nominal=34,
        estado="pendiente",
    )
    base.update(cambios)
    r = Registro(**base)
    s.add(r)
    s.commit()
    s.refresh(r)
    return r


def _entrar(cliente):
    return cliente.post(
        "/admin/entrar", data={"usuario": "ana", "contrasena": CONTRASENA},
        follow_redirects=False,
    )


def _csrf(cliente) -> str:
    return seguridad.token_csrf(cliente.cookies.get(seguridad.NOMBRE_COOKIE))


# ==========================================================================
# Cierre de inscripciones
# ==========================================================================


def test_con_inscripciones_cerradas_el_POST_responde_403(cliente, payload, monkeypatch) -> None:
    """Sin esto, la única forma de cerrar sería apagar el servidor."""
    monkeypatch.setattr(config, "INSCRIPCIONES_ABIERTAS", False)
    r = cliente.post("/api/registros", json=payload)
    assert r.status_code == 403
    assert r.json()["detail"]["codigo"] == "inscripciones_cerradas"
    assert "WhatsApp" in r.json()["detail"]["detalle"]


def test_el_front_puede_consultar_si_estan_abiertas(cliente, monkeypatch) -> None:
    assert cliente.get("/api/inscripciones/estado").json()["abiertas"] is True
    monkeypatch.setattr(config, "INSCRIPCIONES_ABIERTAS", False)
    cuerpo = cliente.get("/api/inscripciones/estado").json()
    assert cuerpo["abiertas"] is False
    assert cuerpo["mensaje"]


# ==========================================================================
# Un depósito, varios inscritos
# ==========================================================================


def test_marcar_varios_con_una_sola_referencia(s) -> None:
    a = _reg(s, "RPB2026-000001-AAAA")
    b = _reg(s, "RPB2026-000002-BBBB")
    c = _reg(s, "RPB2026-000003-CCCC", kit_nombre="Kit Huellita", kit_precio=350)

    conciliacion.marcar_pagados(
        s, [a.folio, b.folio, c.folio],
        verificado_por="ana", referencia="TRANSF-77", monto_recibido=1850,
    )
    for r in (a, b, c):
        s.refresh(r)
        assert r.estado == "pagado"
        assert r.pago_referencia == "TRANSF-77"
        assert r.pago_verificado_por == "ana"

    # La suma de lo recibido cuadra EXACTO con el depósito.
    assert a.monto_recibido + b.monto_recibido + c.monto_recibido == 1850


def test_el_sobrante_del_deposito_queda_en_el_ultimo(s) -> None:
    """Un depósito con comisión o de más no puede descuadrar la suma."""
    a = _reg(s, "RPB2026-000001-AAAA")
    b = _reg(s, "RPB2026-000002-BBBB")
    conciliacion.marcar_pagados(
        s, [a.folio, b.folio], verificado_por="ana", monto_recibido=1490
    )
    s.refresh(a)
    s.refresh(b)
    assert a.monto_recibido == 750
    assert b.monto_recibido == 740  # 1490 - 750
    assert a.monto_recibido + b.monto_recibido == 1490


def test_el_deposito_muestra_quienes_lo_comparten_y_si_cuadra(s) -> None:
    a = _reg(s, "RPB2026-000001-AAAA")
    b = _reg(s, "RPB2026-000002-BBBB")
    conciliacion.marcar_pagados(
        s, [a.folio, b.folio], verificado_por="ana", referencia="DEP-1", monto_recibido=1500
    )
    d = conciliacion.por_referencia(s, config.EDICION, "DEP-1")
    assert d is not None
    assert len(d.registros) == 2
    assert d.esperado == 1500
    assert d.recibido == 1500
    assert d.cuadra is True


def test_un_descuadre_se_ve(s) -> None:
    a = _reg(s, "RPB2026-000001-AAAA")
    conciliacion.marcar_pagados(
        s, [a.folio], verificado_por="ana", referencia="DEP-2", monto_recibido=700
    )
    d = conciliacion.por_referencia(s, config.EDICION, "DEP-2")
    assert d.cuadra is False
    assert d.recibido - d.esperado == -50


def test_solo_lista_referencias_con_mas_de_un_registro(s) -> None:
    a = _reg(s, "RPB2026-000001-AAAA")
    b = _reg(s, "RPB2026-000002-BBBB")
    c = _reg(s, "RPB2026-000003-CCCC")
    conciliacion.marcar_pagados(s, [a.folio, b.folio], verificado_por="ana", referencia="JUNTOS")
    conciliacion.marcar_pagado(s, c.folio, verificado_por="ana", referencia="SOLO")
    compartidos = conciliacion.depositos_compartidos(s, config.EDICION)
    assert [d.referencia for d in compartidos] == ["JUNTOS"]


def test_marcar_varios_por_HTTP_deja_una_sola_entrada_de_bitacora(cliente, admin, s) -> None:
    _entrar(cliente)
    a = _reg(s, "RPB2026-000001-AAAA")
    b = _reg(s, "RPB2026-000002-BBBB")
    respuesta = cliente.post(
        "/admin/registros/pagar-varios",
        data={"csrf": _csrf(cliente), "folios": [a.folio, b.folio],
              "referencia": "CLUB-1", "monto": "1500"},
        follow_redirects=False,
    )
    assert respuesta.status_code == 303
    lote = [x for x in s.exec(select(Bitacora)).all() if x.accion == "pago.verificar_lote"]
    assert len(lote) == 1
    assert json.loads(lote[0].detalle)["cuantos"] == 2


# ==========================================================================
# Editar un registro
# ==========================================================================


def test_editar_cambia_datos_y_devuelve_el_antes_y_despues(s) -> None:
    r = _reg(s, "RPB2026-000001-AAAA")
    _, cambios = edicion.editar(s, r.folio, {"equipo": "Gordo Bike", "ruta": "40"})
    campos = {c.campo for c in cambios}
    assert campos == {"equipo", "ruta"}
    cambio_ruta = next(c for c in cambios if c.campo == "ruta")
    assert (cambio_ruta.antes, cambio_ruta.despues) == ("80", "40")


def test_editar_NO_permite_una_categoria_que_el_motor_no_ofrece(s) -> None:
    """Un admin no puede meter a alguien donde el motor no lo pondría: eso
    reaparecería el día de la carrera."""
    r = _reg(s, "RPB2026-000001-AAAA")
    with pytest.raises(ErrorRegistro) as e:
        edicion.editar(s, r.folio, {"categoria_id": 10})  # Infantil C Femenil
    assert e.value.codigo == "categoria_no_elegible"


def test_cambiar_la_fecha_recalcula_edad_y_exige_categoria_valida(s) -> None:
    r = _reg(s, "RPB2026-000001-AAAA")
    # A los 11 nominales, Máster 30 Varonil deja de ser elegible.
    with pytest.raises(ErrorRegistro) as e:
        edicion.editar(s, r.folio, {"fecha_nacimiento": "10/05/2015"})
    assert e.value.codigo == "categoria_no_elegible"

    # Con la categoría infantil correcta sí pasa, y se recalcula todo.
    _, cambios = edicion.editar(
        s, r.folio,
        {"fecha_nacimiento": "10/05/2015", "sexo": "F", "categoria_id": 10, "ruta": "infantil"},
    )
    s.refresh(r)
    assert r.edad_nominal == 11
    assert r.categoria_clave == "CF"
    assert r.es_menor is True
    assert {c.campo for c in cambios} >= {"edad_nominal", "categoria_clave", "es_menor"}


def test_editar_respeta_el_mapa_de_rutas(s) -> None:
    r = _reg(s, "RPB2026-000001-AAAA")
    with pytest.raises(ErrorRegistro) as e:
        edicion.editar(s, r.folio, {"ruta": "infantil"})
    assert e.value.codigo == "ruta_no_permitida"


def test_el_folio_y_la_fecha_de_alta_NO_se_pueden_editar(s) -> None:
    r = _reg(s, "RPB2026-000001-AAAA")
    for campo in ("folio", "creado_en", "edicion", "estado"):
        with pytest.raises(ErrorRegistro) as e:
            edicion.editar(s, r.folio, {campo: "lo que sea"})
        assert e.value.codigo == "campo_no_editable"


def test_editar_rechaza_una_talla_fuera_de_la_escala(s) -> None:
    r = _reg(s, "RPB2026-000001-AAAA")
    with pytest.raises(ErrorRegistro) as e:
        edicion.editar(s, r.folio, {"talla_jersey": "XL"})
    assert e.value.codigo == "talla_invalida"


def test_la_bitacora_de_edicion_omite_el_valor_de_los_datos_sensibles(s) -> None:
    r = _reg(s, "RPB2026-000001-AAAA")
    _, cambios = edicion.editar(
        s, r.folio, {"tipo_sangre": "AB-", "emergencia_telefono": "7729998888"}
    )
    registrado = json.dumps([c.para_bitacora() for c in cambios], ensure_ascii=False)
    assert "AB-" not in registrado
    assert "7729998888" not in registrado
    assert "dato sensible" in registrado


def test_editar_por_HTTP_queda_en_bitacora_con_los_cambios(cliente, admin, s) -> None:
    _entrar(cliente)
    r = _reg(s, "RPB2026-000001-AAAA")
    respuesta = cliente.post(
        f"/admin/registros/{r.folio}/editar",
        data={
            "csrf": _csrf(cliente), "nombre": r.nombre,
            "apellido_paterno": "Zúñiga", "apellido_materno": "",
            "fecha_nacimiento": "14/08/1992", "sexo": "M", "equipo": "",
            "tipo_bicicleta": "MTB", "categoria_id": 26, "ruta": "80",
            "kit_nombre": "Kit Puma", "kit_precio": 750, "talla_jersey": "",
            "emergencia_nombre": "Ana Rosales", "emergencia_telefono": "7721234567",
            "tipo_sangre": "", "notas": "",
        },
        follow_redirects=False,
    )
    assert respuesta.status_code == 303
    s.refresh(r)
    assert r.apellido_paterno == "Zúñiga"
    entrada = next(b for b in s.exec(select(Bitacora)).all() if b.accion == "registro.editar")
    detalle = json.loads(entrada.detalle)
    assert any(c["campo"] == "apellido_paterno" for c in detalle["cambios"])


# ==========================================================================
# Pantalla de publicación — el camino de la meta
# ==========================================================================


@pytest.fixture
def archivo_real() -> bytes:
    return (RAIZ / "public" / "data" / "resultados-2026.json").read_bytes()


def test_subir_valida_pero_NO_publica(cliente, admin, s, archivo_real) -> None:
    """Nada se publica sin que alguien haya visto el reporte."""
    _entrar(cliente)
    respuesta = cliente.post(
        "/admin/resultados/subir",
        data={"csrf": _csrf(cliente)},
        files={"archivo": ("resultados.json", archivo_real, "application/json")},
        follow_redirects=False,
    )
    assert respuesta.status_code == 303
    subida = s.exec(select(SubidaResultados)).first()
    assert subida.resultado == "pendiente"
    assert subida.total_marcados == 32
    assert publicacion.activa(s, config.EDICION) is None


def test_subir_un_archivo_que_no_es_json_da_un_error_claro(cliente, admin, s) -> None:
    _entrar(cliente)
    respuesta = cliente.post(
        "/admin/resultados/subir",
        data={"csrf": _csrf(cliente)},
        files={"archivo": ("malo.json", b"esto no es json", "application/json")},
    )
    assert respuesta.status_code == 422
    assert "no es un JSON válido" in respuesta.text


def test_subir_un_json_que_no_es_de_resultados_se_rechaza(cliente, admin, s) -> None:
    _entrar(cliente)
    respuesta = cliente.post(
        "/admin/resultados/subir",
        data={"csrf": _csrf(cliente)},
        files={"archivo": ("otro.json", b'{"hola": 1}', "application/json")},
    )
    assert respuesta.status_code == 422
    assert "no parece un export de resultados" in respuesta.text


def test_publicar_una_subida_escribe_el_estatico(cliente, admin, s, archivo_real, tmp_path,
                                                 monkeypatch) -> None:
    monkeypatch.setattr(config, "RUTA_PUBLICA", tmp_path)
    _entrar(cliente)
    cliente.post(
        "/admin/resultados/subir",
        data={"csrf": _csrf(cliente)},
        files={"archivo": ("resultados.json", archivo_real, "application/json")},
    )
    subida = s.exec(select(SubidaResultados)).first()
    respuesta = cliente.post(
        f"/admin/resultados/{subida.id}/publicar",
        data={"csrf": _csrf(cliente)},
        follow_redirects=False,
    )
    assert respuesta.status_code == 303
    s.refresh(subida)
    assert subida.resultado == "publicada"
    assert subida.publicacion_id is not None
    assert (tmp_path / f"resultados-{config.EDICION}.json").exists()


def test_publicar_puede_marcar_parcial(s, archivo_real, tmp_path) -> None:
    """El día del evento el 40 y el 80 km terminan con horas de diferencia."""
    subida, _ = publicacion.registrar_subida(
        s, archivo_real, edicion=2026, subido_por="ana", nombre_archivo="x.json"
    )
    pub, _ = publicacion.publicar_subida(
        s, subida.id, publicado_por="ana", parcial=True,
        nota_parcial="Faltan las infantiles.", base_estatica=tmp_path,
    )
    assert pub.parcial is True
    assert pub.nota_parcial == "Faltan las infantiles."
    publicado = json.loads((tmp_path / "resultados-2026.json").read_text(encoding="utf-8"))
    assert publicado["parcial"] is True


def test_descartar_conserva_el_crudo(s, archivo_real) -> None:
    """Si alguien sube un archivo malo y lo descarta, queremos saber que pasó."""
    subida, _ = publicacion.registrar_subida(
        s, archivo_real, edicion=2026, subido_por="ana", nombre_archivo="x.json"
    )
    publicacion.descartar_subida(s, subida.id, motivo="venía incompleto")
    s.refresh(subida)
    assert subida.resultado == "descartada"
    assert subida.motivo_descarte == "venía incompleto"
    assert json.loads(subida.json_crudo)["categorias"]


def test_no_se_puede_publicar_una_subida_ya_resuelta(s, archivo_real, tmp_path) -> None:
    subida, _ = publicacion.registrar_subida(
        s, archivo_real, edicion=2026, subido_por="ana", nombre_archivo="x.json"
    )
    publicacion.descartar_subida(s, subida.id)
    with pytest.raises(publicacion.ErrorSubida, match="descartada"):
        publicacion.publicar_subida(s, subida.id, publicado_por="ana", base_estatica=tmp_path)


def test_acepta_un_archivo_con_BOM(s, archivo_real) -> None:
    """Windows y Excel meten BOM sin avisar."""
    subida, reporte = publicacion.registrar_subida(
        s, b"\xef\xbb\xbf" + archivo_real, edicion=2026,
        subido_por="ana", nombre_archivo="con-bom.json",
    )
    assert subida.total_corredores == 781
    assert len(reporte.marcas) == 32


# ==========================================================================
# Anuncios: la regla del cuerpo obligatorio
# ==========================================================================


def _aviso(**cambios) -> dict:
    base = {
        "clave": "001", "fecha": "2026-07-18", "tipo": "logistica",
        "titulo": "Entrega de kits", "cuerpo": "Habrá una segunda entrega el sábado.",
    }
    base.update(cambios)
    return base


def test_un_aviso_SIN_CUERPO_no_se_guarda_aunque_traiga_imagen(s) -> None:
    """Es la regla de la página de Avisos y aquí es donde se hace cumplir."""
    with pytest.raises(contenido.ErrorContenido) as e:
        contenido.guardar_aviso(s, _aviso(cuerpo="   ", imagen="/img/x.webp", imagen_alt="algo"))
    assert e.value.campo == "cuerpo"
    assert "sin texto no se publica" in e.value.mensaje


def test_una_imagen_sin_descripcion_no_se_guarda(s) -> None:
    with pytest.raises(contenido.ErrorContenido) as e:
        contenido.guardar_aviso(s, _aviso(imagen="/img/x.webp"))
    assert e.value.campo == "imagen_alt"


def test_un_tipo_inventado_se_rechaza(s) -> None:
    with pytest.raises(contenido.ErrorContenido) as e:
        contenido.guardar_aviso(s, _aviso(tipo="chisme"))
    assert e.value.campo == "tipo"


def test_no_se_repite_la_clave(s) -> None:
    contenido.guardar_aviso(s, _aviso())
    with pytest.raises(contenido.ErrorContenido) as e:
        contenido.guardar_aviso(s, _aviso(titulo="Otro"))
    assert e.value.campo == "clave"


def test_guardar_regenera_el_json_estatico(s, tmp_path) -> None:
    contenido.guardar_aviso(s, _aviso())
    contenido.guardar_aviso(s, _aviso(clave="002", fecha="2026-07-20", titulo="Otro aviso"))
    destino = contenido.regenerar_anuncios(s, base=tmp_path)

    datos = json.loads(destino.read_text(encoding="utf-8"))
    assert [a["id"] for a in datos["avisos"]] == ["002", "001"]  # más reciente primero
    assert datos["actualizado"] == "2026-07-20"
    # Forma EXACTA del contrato que ya consume el sitio.
    assert set(datos["avisos"][0]) >= {"id", "fecha", "tipo", "titulo", "cuerpo"}


def test_el_estatico_usa_camelCase_como_el_contrato_del_front(s, tmp_path) -> None:
    contenido.guardar_aviso(
        s,
        _aviso(
            imagen="/img/avisos/kit.webp",
            imagen_alt="Flyer del kit de la tercera edición.",
            enlace_texto="Ver la colección", enlace_url="#/coleccion",
            vigente_hasta="2026-08-31", fijado=True,
        ),
    )
    datos = json.loads(contenido.regenerar_anuncios(s, base=tmp_path).read_text(encoding="utf-8"))
    aviso = datos["avisos"][0]
    assert aviso["imagenAlt"] == "Flyer del kit de la tercera edición."
    assert aviso["enlace"] == {"texto": "Ver la colección", "url": "#/coleccion"}
    assert aviso["vigenteHasta"] == "2026-08-31"
    assert aviso["fijado"] is True


def test_un_aviso_oculto_no_sale_al_estatico(s, tmp_path) -> None:
    contenido.guardar_aviso(s, _aviso(publicado=False))
    datos = json.loads(contenido.regenerar_anuncios(s, base=tmp_path).read_text(encoding="utf-8"))
    assert datos["avisos"] == []


def test_por_HTTP_un_aviso_sin_cuerpo_devuelve_422_con_el_motivo(cliente, admin, s) -> None:
    _entrar(cliente)
    respuesta = cliente.post(
        "/admin/anuncios",
        data={"csrf": _csrf(cliente), "clave": "001", "fecha": "2026-07-18",
              "tipo": "logistica", "titulo": "Sin texto", "cuerpo": ""},
    )
    assert respuesta.status_code == 422
    assert "sin texto no se publica" in respuesta.text
    assert s.exec(select(Aviso)).first() is None


# ==========================================================================
# Hospedaje
# ==========================================================================


def test_un_lugar_sin_descripcion_no_se_guarda(s) -> None:
    with pytest.raises(contenido.ErrorContenido) as e:
        contenido.guardar_lugar(s, {"tipo": "hotel", "nombre": "Hotel X", "descripcion": ""})
    assert e.value.campo == "descripcion"


def test_el_hospedaje_se_separa_por_tipo_en_el_estatico(s, tmp_path) -> None:
    contenido.guardar_lugar(
        s, {"tipo": "hotel", "nombre": "Casa Blanca", "descripcion": "Céntrico.",
            "convenio": "15% para corredores", "orden": 1}
    )
    contenido.guardar_lugar(
        s, {"tipo": "comida", "nombre": "Barbacoa Don Chon", "descripcion": "Ximbo.", "orden": 2}
    )
    datos = json.loads(contenido.regenerar_hospedaje(s, base=tmp_path).read_text(encoding="utf-8"))
    assert [h["nombre"] for h in datos["hoteles"]] == ["Casa Blanca"]
    assert [c["nombre"] for c in datos["comida"]] == ["Barbacoa Don Chon"]
    assert datos["hoteles"][0]["convenio"] == "15% para corredores"


def test_guardar_hospedaje_por_HTTP_regenera_y_anota(cliente, admin, s, tmp_path,
                                                     monkeypatch) -> None:
    monkeypatch.setattr(config, "RUTA_PUBLICA", tmp_path)
    _entrar(cliente)
    respuesta = cliente.post(
        "/admin/hospedaje",
        data={"csrf": _csrf(cliente), "tipo": "hotel", "nombre": "Hotel Sendero",
              "descripcion": "A cinco minutos del Pabellón.", "orden": "1"},
        follow_redirects=False,
    )
    assert respuesta.status_code == 303
    assert (tmp_path / "hospedaje.json").exists()
    assert s.exec(select(Lugar)).first().nombre == "Hotel Sendero"
    assert "lugar.guardar" in {b.accion for b in s.exec(select(Bitacora)).all()}


# ==========================================================================
# Las pantallas nuevas siguen exigiendo sesión
# ==========================================================================


@pytest.mark.parametrize(
    "ruta", ["/admin/resultados", "/admin/anuncios", "/admin/hospedaje", "/admin/depositos"]
)
def test_las_pantallas_nuevas_no_se_abren_sin_sesion(cliente, ruta) -> None:
    r = cliente.get(ruta, follow_redirects=False)
    assert r.status_code == 303
    assert r.headers["location"] == "/admin/entrar"
