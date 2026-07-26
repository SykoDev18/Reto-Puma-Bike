"""Panel del comité: autenticación, conciliación de pagos, padrón y bitácora.

Lo que se prueba aquí es sobre todo lo que NO debe pasar: que se pueda ver el
padrón sin sesión, que un POST ajeno cambie un pago, o que la bitácora guarde
teléfonos.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlmodel import Session, select

from app import config, seguridad
from app.dominio import conciliacion
from app.modelos import Bitacora, Registro, Usuario

CONTRASENA = "contraseña larga y buena ñ"


@pytest.fixture
def admin(s: Session) -> Usuario:
    u = Usuario(
        usuario="ana",
        hash_contrasena=seguridad.hashear(CONTRASENA),
        nombre="Ana Bastida",
        rol="admin",
    )
    s.add(u)
    s.commit()
    s.refresh(u)
    return u


def _registro(s: Session, folio: str, *, dias: int = 0, estado: str = "pendiente") -> Registro:
    # El nombre varía con el folio: el índice único de persona rechaza dos
    # registros idénticos en la misma edición, que es justo lo que debe hacer.
    sufijo = folio.split("-")[1]
    r = Registro(
        folio=folio,
        creado_en=datetime.now(timezone.utc) - timedelta(days=dias),
        edicion=config.EDICION,
        nombre=f"Mizraim{sufijo}",
        apellido_paterno="Rosales",
        apellido_materno="Rodríguez",
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
        tipo_sangre="O+",
        edad_nominal=34,
        estado=estado,
    )
    s.add(r)
    s.commit()
    s.refresh(r)
    return r


def _entrar(cliente, usuario: str = "ana", contrasena: str = CONTRASENA):
    return cliente.post(
        "/admin/entrar",
        data={"usuario": usuario, "contrasena": contrasena},
        follow_redirects=False,
    )


def _csrf(cliente) -> str:
    return seguridad.token_csrf(cliente.cookies.get(seguridad.NOMBRE_COOKIE))


# ==========================================================================
# Sin sesión no hay panel
# ==========================================================================


@pytest.mark.parametrize(
    "ruta",
    [
        "/admin/",
        "/admin/padron",
        "/admin/bitacora",
        "/admin/export/padron.csv",
        "/admin/export/medico.csv",
    ],
)
def test_ninguna_ruta_del_panel_se_abre_sin_sesion(cliente, ruta) -> None:
    """El padrón tiene teléfonos, correos y contactos de emergencia de ~950
    personas. Ni una sola ruta puede quedar sin sesión."""
    r = cliente.get(ruta, follow_redirects=False)
    assert r.status_code == 303
    assert r.headers["location"] == "/admin/entrar"


def test_el_export_no_se_puede_bajar_con_una_cookie_inventada(cliente) -> None:
    cliente.cookies.set(seguridad.NOMBRE_COOKIE, "cookie-falsificada", path="/admin")
    r = cliente.get("/admin/export/padron.csv", follow_redirects=False)
    assert r.status_code == 303


# ==========================================================================
# Autenticación
# ==========================================================================


def test_entrar_con_credenciales_correctas(cliente, admin) -> None:
    r = _entrar(cliente)
    assert r.status_code == 303
    assert r.headers["location"] == "/admin/"
    assert cliente.cookies.get(seguridad.NOMBRE_COOKIE)


def test_la_cookie_es_httponly_secure_y_samesite_strict(cliente, admin) -> None:
    r = _entrar(cliente)
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=strict" in cookie
    assert "secure" in cookie
    # Acotada al panel: no viaja en las peticiones públicas del sitio.
    assert "path=/admin" in cookie


def test_usuario_inexistente_y_contrasena_mala_dan_EL_MISMO_mensaje(cliente, admin) -> None:
    """Distinguirlos permitiría averiguar qué usuarios existen."""
    a = cliente.post("/admin/entrar", data={"usuario": "ana", "contrasena": "mala"})
    b = cliente.post("/admin/entrar", data={"usuario": "nadie", "contrasena": "mala"})
    assert a.status_code == b.status_code == 401
    assert "Usuario o contraseña incorrectos" in a.text
    assert "Usuario o contraseña incorrectos" in b.text


def test_se_bloquea_tras_cinco_intentos_fallidos(cliente, admin, s) -> None:
    for _ in range(seguridad.MAX_INTENTOS):
        cliente.post("/admin/entrar", data={"usuario": "ana", "contrasena": "mala"})
    # Ahora ni con la buena entra.
    r = _entrar(cliente)
    assert r.status_code == 401
    assert "Demasiados intentos" in r.text

    s.refresh(admin)
    assert seguridad.esta_bloqueado(admin)


def test_la_contrasena_nunca_se_guarda_en_claro(s, admin) -> None:
    assert admin.hash_contrasena.startswith("$argon2id$")
    assert CONTRASENA not in admin.hash_contrasena
    assert seguridad.verificar(admin.hash_contrasena, CONTRASENA)
    assert not seguridad.verificar(admin.hash_contrasena, "otra cosa")


def test_una_cuenta_desactivada_no_entra(cliente, admin, s) -> None:
    admin.activo = False
    s.add(admin)
    s.commit()
    r = _entrar(cliente)
    assert r.status_code == 401
    assert "desactivada" in r.text


def test_salir_borra_la_cookie(cliente, admin) -> None:
    _entrar(cliente)
    csrf = _csrf(cliente)
    r = cliente.post("/admin/salir", data={"csrf": csrf}, follow_redirects=False)
    assert r.status_code == 303
    assert cliente.get("/admin/", follow_redirects=False).status_code == 303


# ==========================================================================
# CSRF
# ==========================================================================


def test_sin_token_csrf_no_se_puede_marcar_un_pago(cliente, admin, s) -> None:
    """Sin esto, cualquier sitio puede hacer que el navegador del comité envíe
    un POST mientras la sesión está abierta."""
    _entrar(cliente)
    r = _registro(s, "RPB2026-000001-AAAA")
    respuesta = cliente.post(f"/admin/registros/{r.folio}/pagar", data={})
    assert respuesta.status_code == 403
    s.refresh(r)
    assert r.estado == "pendiente"


def test_un_token_csrf_de_otra_sesion_no_sirve(cliente, admin, s) -> None:
    _entrar(cliente)
    r = _registro(s, "RPB2026-000001-AAAA")
    ajeno = seguridad.token_csrf("otra-sesion-cualquiera")
    respuesta = cliente.post(f"/admin/registros/{r.folio}/pagar", data={"csrf": ajeno})
    assert respuesta.status_code == 403


# ==========================================================================
# Conciliación de pagos
# ==========================================================================


def test_marcar_pagado_registra_quien_y_cuando(cliente, admin, s) -> None:
    _entrar(cliente)
    r = _registro(s, "RPB2026-000001-AAAA")
    respuesta = cliente.post(
        f"/admin/registros/{r.folio}/pagar",
        data={"csrf": _csrf(cliente), "referencia": "TRANSF-9931"},
        follow_redirects=False,
    )
    assert respuesta.status_code == 303
    s.refresh(r)
    assert r.estado == "pagado"
    assert r.pago_verificado_por == "ana"
    assert r.pago_verificado_en is not None
    assert r.pago_referencia == "TRANSF-9931"


def test_marcar_pagado_dos_veces_no_pisa_a_quien_verifico_primero(s, admin) -> None:
    """Dos personas del comité pueden tener la misma pantalla abierta."""
    r = _registro(s, "RPB2026-000001-AAAA")
    conciliacion.marcar_pagado(s, r.folio, verificado_por="ana", referencia="A")
    conciliacion.marcar_pagado(s, r.folio, verificado_por="beto", referencia="B")
    s.refresh(r)
    assert r.pago_verificado_por == "ana"
    assert r.pago_referencia == "A"


def test_los_que_llevan_mas_esperando_van_arriba(s) -> None:
    _registro(s, "RPB2026-000001-AAAA", dias=1)
    _registro(s, "RPB2026-000002-BBBB", dias=12)
    _registro(s, "RPB2026-000003-CCCC", dias=5)
    lista = conciliacion.pendientes(s, config.EDICION)
    assert [p.dias_esperando for p in lista] == [12, 5, 1]
    assert lista[0].urgente is True
    assert lista[2].urgente is False


def test_el_tablero_cuenta_los_tres_estados(cliente, admin, s) -> None:
    _registro(s, "RPB2026-000001-AAAA", estado="pagado")
    _registro(s, "RPB2026-000002-BBBB", estado="pendiente", dias=9)
    _registro(s, "RPB2026-000003-CCCC", estado="cancelado")
    _entrar(cliente)
    pagina = cliente.get("/admin/").text
    assert "RPB2026-000002-BBBB" in pagina  # el pendiente aparece
    assert "9d" in pagina  # y su espera
    conteos = conciliacion.conteos(s, config.EDICION)
    assert (conteos.pagados, conteos.pendientes, conteos.cancelados) == (1, 1, 1)


def test_no_se_puede_marcar_pagado_algo_cancelado(s) -> None:
    r = _registro(s, "RPB2026-000001-AAAA", estado="cancelado")
    with pytest.raises(conciliacion.ErrorConciliacion, match="cancelado"):
        conciliacion.marcar_pagado(s, r.folio, verificado_por="ana")


def test_cancelar_es_reversible(s) -> None:
    """La gente se equivoca de fila."""
    r = _registro(s, "RPB2026-000001-AAAA")
    conciliacion.cancelar(s, r.folio, motivo="pidió reembolso")
    s.refresh(r)
    assert r.estado == "cancelado"
    assert "reembolso" in r.notas
    conciliacion.reactivar(s, r.folio)
    s.refresh(r)
    assert r.estado == "pendiente"


def test_el_dinero_por_cobrar_solo_suma_pendientes(s) -> None:
    _registro(s, "RPB2026-000001-AAAA", estado="pendiente")
    _registro(s, "RPB2026-000002-BBBB", estado="pagado")
    assert conciliacion.dinero_pendiente(s, config.EDICION) == 750


# ==========================================================================
# Padrón
# ==========================================================================


def test_el_padron_filtra_por_texto_estado_y_ruta(cliente, admin, s) -> None:
    _registro(s, "RPB2026-000001-AAAA", estado="pagado")
    otro = _registro(s, "RPB2026-000002-BBBB", estado="pendiente")
    otro.apellido_paterno = "Zúñiga"
    otro.ruta = "40"
    s.add(otro)
    s.commit()

    assert len(conciliacion.buscar(s, config.EDICION)) == 2
    assert len(conciliacion.buscar(s, config.EDICION, estado="pagado")) == 1
    assert len(conciliacion.buscar(s, config.EDICION, ruta="40")) == 1
    assert len(conciliacion.buscar(s, config.EDICION, texto="zúñiga")) == 1
    assert len(conciliacion.buscar(s, config.EDICION, texto="000001")) == 1
    assert len(conciliacion.buscar(s, config.EDICION, texto="7721199093")) == 2


def test_el_export_del_padron_no_lleva_tipo_de_sangre(cliente, admin, s) -> None:
    _registro(s, "RPB2026-000001-AAAA", estado="pagado")
    _entrar(cliente)
    csv = cliente.get("/admin/export/padron.csv").text
    assert "O+" not in csv
    assert "numero_corredor" in csv


def test_el_export_medico_va_aparte_y_queda_en_la_bitacora(cliente, admin, s) -> None:
    """El tipo de sangre es dato sensible: sale solo por su propia puerta y
    cada descarga deja rastro."""
    _registro(s, "RPB2026-000001-AAAA", estado="pagado")
    _entrar(cliente)
    respuesta = cliente.get("/admin/export/medico.csv")
    assert "O+" in respuesta.text
    assert "tipo_sangre" in respuesta.text

    acciones = [b.accion for b in s.exec(select(Bitacora)).all()]
    assert "medico.exportar" in acciones


# ==========================================================================
# Bitácora
# ==========================================================================


def test_toda_accion_queda_registrada_con_usuario(cliente, admin, s) -> None:
    _entrar(cliente)
    r = _registro(s, "RPB2026-000001-AAAA")
    cliente.post(f"/admin/registros/{r.folio}/pagar", data={"csrf": _csrf(cliente)})

    entradas = s.exec(select(Bitacora)).all()
    acciones = {b.accion for b in entradas}
    assert "sesion.inicio" in acciones
    assert "pago.verificar" in acciones
    pago = next(b for b in entradas if b.accion == "pago.verificar")
    assert pago.usuario == "ana"
    assert pago.entidad_id == r.folio


def test_la_bitacora_no_guarda_datos_personales(cliente, admin, s) -> None:
    _entrar(cliente)
    r = _registro(s, "RPB2026-000001-AAAA")
    cliente.post(f"/admin/registros/{r.folio}/pagar", data={"csrf": _csrf(cliente)})
    cliente.get("/admin/export/padron.csv")

    todo = " ".join(
        f"{b.usuario} {b.accion} {b.entidad_id} {b.detalle}"
        for b in s.exec(select(Bitacora)).all()
    ).lower()
    for prohibido in ("mizraim", "rosales", "7721199093", "example.mx", "o+"):
        assert prohibido not in todo, prohibido


def test_los_intentos_fallidos_quedan_registrados(cliente, admin, s) -> None:
    cliente.post("/admin/entrar", data={"usuario": "ana", "contrasena": "mala"})
    acciones = [b.accion for b in s.exec(select(Bitacora)).all()]
    assert "sesion.fallida" in acciones
