"""`POST /api/registros` y `GET /api/registros/{folio}`.

El front valida por conveniencia; estas pruebas fijan que el servidor valide
por seguridad, aunque la petición no venga del formulario.
"""

from __future__ import annotations

import re

import pytest

from app import config
from app.dominio import folio as folio_mod


# --------------------------------------------------------------------------
# Alta feliz
# --------------------------------------------------------------------------


def test_alta_devuelve_folio_del_servidor_y_monto(cliente, payload) -> None:
    r = cliente.post("/api/registros", json=payload)
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["estado"] == "pendiente"
    assert cuerpo["monto_esperado"] == 750
    assert folio_mod.es_valido(cuerpo["folio"])


def test_el_folio_del_cliente_se_ignora_en_silencio(cliente, payload) -> None:
    """El front lo genera hoy con `Math.random()`. No es error del usuario:
    se descarta sin ruido y manda el del servidor."""
    payload["folio"] = "RPB2026-000123"
    r = cliente.post("/api/registros", json=payload)
    assert r.status_code == 201
    assert r.json()["folio"] != "RPB2026-000123"


def test_el_folio_no_es_adivinable(cliente, payload) -> None:
    r = cliente.post("/api/registros", json=payload)
    folio = r.json()["folio"]
    assert re.match(r"^RPB2026-\d{6}-[A-Z0-9]{4}$", folio), folio
    sufijo = folio.split("-")[-1]
    # Sin 0/O ni 1/I: se dicta por teléfono y se teclea desde una captura.
    assert all(c in config.ALFABETO_FOLIO for c in sufijo)
    assert not set(sufijo) & set("01OI")


def test_los_datos_de_pago_no_traen_tarjeta(cliente, payload) -> None:
    """Para recibir un depósito basta la CLABE. Una tarjeta publicada habilita
    cargos en comercios que solo piden número y vencimiento."""
    r = cliente.post("/api/registros", json=payload)
    pago = r.json()["datos_pago"]
    assert set(pago) == {"banco", "beneficiario", "cuenta", "clabe", "instruccion"}
    texto = " ".join(str(v) for v in pago.values())
    assert "tarjeta" not in texto.lower()
    assert not re.search(r"\b\d{16}\b", texto)


def test_capitaliza_nombres_respetando_acentos(cliente, payload, s) -> None:
    payload["participante"]["nombre"] = "  josé   luis "
    payload["participante"]["apellido_paterno"] = "PÉREZ"
    r = cliente.post("/api/registros", json=payload)
    assert r.status_code == 201
    consulta = cliente.get(
        f"/api/registros/{r.json()['folio']}", params={"fnac": "14/08/1992"}
    )
    assert consulta.json()["nombre_completo"].startswith("José Luis Pérez")


# --------------------------------------------------------------------------
# La edad nominal la calcula el servidor
# --------------------------------------------------------------------------


def test_ignora_la_edad_nominal_que_manda_el_cliente(cliente, payload, s) -> None:
    """Si el cliente miente sobre su edad para colarse a otra categoría, el
    servidor recalcula y lo rechaza."""
    payload["participante"]["edad_nominal"] = 12  # mentira
    r = cliente.post("/api/registros", json=payload)
    # 34 nominales reales -> Máster 30 sigue siendo elegible, así que pasa,
    # pero la edad guardada es la del servidor.
    assert r.status_code == 201
    from sqlmodel import select

    from app.modelos import Registro

    guardado = s.exec(select(Registro)).first()
    assert guardado.edad_nominal == 34


def test_menor_de_edad_se_marca_aunque_no_se_exija_tutor(cliente, payload, s) -> None:
    payload["participante"]["fecha_nacimiento"] = "10/05/2015"
    payload["participante"]["sexo"] = "F"
    payload["competencia"] = {
        "categoria_id": 10,
        "categoria_clave": "CF",
        "categoria_nombre": "Infantil C Femenil",
        "ruta": "infantil",
        "tipo_bicicleta": "MTB",
    }
    r = cliente.post("/api/registros", json=payload)
    assert r.status_code == 201, r.text
    from sqlmodel import select

    from app.modelos import Registro

    guardado = s.exec(select(Registro)).first()
    assert guardado.es_menor is True
    assert guardado.edad_nominal == 11


def test_con_EXIGIR_TUTOR_un_menor_sin_tutor_se_rechaza(cliente, payload, monkeypatch) -> None:
    """El flag existe para poder activar la regla el día que el front entregue
    el bloque de tutor, sin desplegar dos cosas a la vez."""
    monkeypatch.setattr(config, "EXIGIR_TUTOR", True)
    payload["participante"]["fecha_nacimiento"] = "10/05/2015"
    payload["participante"]["sexo"] = "F"
    payload["competencia"] = {
        "categoria_id": 10,
        "categoria_clave": "CF",
        "categoria_nombre": "Infantil C Femenil",
        "ruta": "infantil",
        "tipo_bicicleta": "MTB",
    }
    r = cliente.post("/api/registros", json=payload)
    assert r.status_code == 422
    assert r.json()["detail"]["codigo"] == "falta_tutor"

    payload["tutor"] = {
        "nombre": "Ana Gómez",
        "telefono": "7721234567",
        "consentimiento": True,
    }
    assert cliente.post("/api/registros", json=payload).status_code == 201


# --------------------------------------------------------------------------
# Elegibilidad: el mismo motor que el front
# --------------------------------------------------------------------------


def test_rechaza_una_categoria_que_el_front_no_ofreceria(cliente, payload) -> None:
    """Un hombre de 34 no puede correr Infantil C Femenil aunque lo pida."""
    payload["competencia"]["categoria_id"] = 10
    payload["competencia"]["categoria_clave"] = "CF"
    r = cliente.post("/api/registros", json=payload)
    assert r.status_code == 422
    detalle = r.json()["detail"]
    assert detalle["codigo"] == "categoria_no_elegible"
    # Devuelve lo que SÍ puede elegir, para que el front corrija sin adivinar.
    assert detalle["recomendada"]["clave"] == "N"
    assert isinstance(detalle["alternativas"], list)


def test_rechaza_mamuts_sin_declarar_peso(cliente, payload) -> None:
    payload["competencia"]["categoria_id"] = 12
    payload["competencia"]["categoria_clave"] = "M"
    payload["competencia"]["ruta"] = "40"
    payload["peso_90_mas"] = False
    assert cliente.post("/api/registros", json=payload).status_code == 422


def test_acepta_mamuts_declarando_peso(cliente, payload) -> None:
    payload["competencia"]["categoria_id"] = 12
    payload["competencia"]["categoria_clave"] = "M"
    payload["competencia"]["ruta"] = "40"
    payload["peso_90_mas"] = True
    assert cliente.post("/api/registros", json=payload).status_code == 201


def test_rechaza_clave_que_no_corresponde_al_id(cliente, payload) -> None:
    payload["competencia"]["categoria_clave"] = "X"
    r = cliente.post("/api/registros", json=payload)
    assert r.status_code == 422
    assert r.json()["detail"]["codigo"] == "clave_inconsistente"


def test_rechaza_ruta_que_el_grupo_no_corre(cliente, payload) -> None:
    payload["competencia"]["ruta"] = "infantil"
    r = cliente.post("/api/registros", json=payload)
    assert r.status_code == 422
    assert r.json()["detail"]["codigo"] == "ruta_no_permitida"


def test_infantiles_solo_corren_el_circuito_infantil(cliente, payload) -> None:
    payload["participante"]["fecha_nacimiento"] = "10/05/2015"
    payload["participante"]["sexo"] = "F"
    payload["competencia"] = {
        "categoria_id": 10,
        "categoria_clave": "CF",
        "categoria_nombre": "Infantil C Femenil",
        "ruta": "40",  # no le toca
        "tipo_bicicleta": "MTB",
    }
    r = cliente.post("/api/registros", json=payload)
    assert r.status_code == 422
    assert r.json()["detail"]["codigo"] == "ruta_no_permitida"


# --------------------------------------------------------------------------
# Validación de campos
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "campo,valor",
    [
        ("telefono", "772119909"),  # 9 dígitos
        ("telefono", "abc"),
        ("email", "no-es-correo"),
        ("nombre", "Mizraim3"),
        ("fecha_nacimiento", "1992-08-14"),  # ISO, no DD/MM/AAAA
        ("fecha_nacimiento", "14-08-1992"),
    ],
)
def test_rechaza_campos_invalidos(cliente, payload, campo, valor) -> None:
    payload["participante"][campo] = valor
    assert cliente.post("/api/registros", json=payload).status_code == 422


def test_rechaza_sin_consentimiento(cliente, payload) -> None:
    payload["consentimiento"]["privacidad"] = False
    r = cliente.post("/api/registros", json=payload)
    assert r.status_code == 422
    assert r.json()["detail"]["codigo"] == "sin_consentimiento"


def test_rechaza_talla_fuera_de_la_escala(cliente, payload) -> None:
    """La escala canónica es la mexicana: CH·M·G·XG·2XG·3XG-4XG."""
    payload["kit"]["talla_jersey"] = "XL"  # escala de Colección, no la vigente
    r = cliente.post("/api/registros", json=payload)
    assert r.status_code == 422
    assert r.json()["detail"]["codigo"] == "talla_invalida"


def test_acepta_toda_la_escala_vigente(cliente, payload) -> None:
    for i, talla in enumerate(config.TALLAS):
        payload["participante"]["nombre"] = f"Persona{chr(65 + i)}"
        payload["kit"]["talla_jersey"] = talla
        r = cliente.post("/api/registros", json=payload)
        assert r.status_code == 201, f"{talla}: {r.text}"


def test_rechaza_campos_desconocidos(cliente, payload) -> None:
    """Si el front empieza a mandar algo nuevo, nos enteramos aquí."""
    payload["participante"]["curp"] = "XXXX000000XXXXXX00"
    assert cliente.post("/api/registros", json=payload).status_code == 422


def test_guarda_constancia_del_consentimiento(cliente, payload, s) -> None:
    cliente.post("/api/registros", json=payload)
    from sqlmodel import select

    from app.modelos import Registro

    guardado = s.exec(select(Registro)).first()
    assert guardado.privacidad is True
    assert guardado.privacidad_aceptada_en is not None
    assert guardado.aviso_privacidad_version == config.VERSION_AVISO_PRIVACIDAD


# --------------------------------------------------------------------------
# Duplicados
# --------------------------------------------------------------------------


def test_duplicado_devuelve_409_con_el_folio_existente(cliente, payload) -> None:
    primero = cliente.post("/api/registros", json=payload)
    assert primero.status_code == 201
    segundo = cliente.post("/api/registros", json=payload)
    assert segundo.status_code == 409
    detalle = segundo.json()["detail"]
    assert detalle["codigo"] == "duplicado"
    assert detalle["folio"] == primero.json()["folio"]


def test_el_duplicado_no_distingue_acentos_ni_mayusculas(cliente, payload) -> None:
    """«José Pérez» y «jose perez» son la misma persona inscribiéndose dos
    veces, no dos corredores."""
    cliente.post("/api/registros", json=payload)
    payload["participante"]["nombre"] = "MIZRAIM"
    payload["participante"]["apellido_materno"] = "RODRIGUEZ"  # sin acento
    assert cliente.post("/api/registros", json=payload).status_code == 409


def test_envio_repetido_no_crea_dos_registros(cliente, payload, s) -> None:
    """Sobrevive al doble clic y al reintento del navegador."""
    for _ in range(4):
        cliente.post("/api/registros", json=payload)
    from sqlmodel import select

    from app.modelos import Registro

    assert len(s.exec(select(Registro)).all()) == 1


# --------------------------------------------------------------------------
# Consulta por folio: no puede ser una fuga del padrón
# --------------------------------------------------------------------------


def test_consulta_con_folio_y_fecha_correctos(cliente, payload) -> None:
    folio = cliente.post("/api/registros", json=payload).json()["folio"]
    r = cliente.get(f"/api/registros/{folio}", params={"fnac": "14/08/1992"})
    assert r.status_code == 200
    assert r.json()["categoria_clave"] == "N"


def test_la_consulta_NO_devuelve_datos_de_contacto(cliente, payload) -> None:
    folio = cliente.post("/api/registros", json=payload).json()["folio"]
    cuerpo = cliente.get(f"/api/registros/{folio}", params={"fnac": "14/08/1992"}).json()
    prohibidos = ("email", "telefono", "emergencia", "tipo_sangre", "notas", "tutor")
    texto = str(cuerpo).lower()
    for campo in prohibidos:
        assert campo not in cuerpo
    assert "mizraim@example.mx" not in texto
    assert "7721199093" not in texto
    assert "o+" not in texto


def test_sin_segundo_factor_no_se_puede_consultar(cliente, payload) -> None:
    folio = cliente.post("/api/registros", json=payload).json()["folio"]
    assert cliente.get(f"/api/registros/{folio}").status_code == 422


def test_fecha_equivocada_da_404_no_403(cliente, payload) -> None:
    """Un 403 confirmaría que el folio existe. Los dos casos dan el MISMO 404."""
    folio = cliente.post("/api/registros", json=payload).json()["folio"]
    malo = cliente.get(f"/api/registros/{folio}", params={"fnac": "01/01/1990"})
    inexistente = cliente.get(
        "/api/registros/RPB2026-999999-AAAA", params={"fnac": "14/08/1992"}
    )
    assert malo.status_code == 404
    assert inexistente.status_code == 404
    assert malo.json() == inexistente.json()


def test_el_folio_se_acepta_en_minusculas_y_con_espacios(cliente, payload) -> None:
    """La gente lo teclea desde una captura de WhatsApp."""
    folio = cliente.post("/api/registros", json=payload).json()["folio"]
    r = cliente.get(f"/api/registros/{folio.lower()}", params={"fnac": "14/08/1992"})
    assert r.status_code == 200


def test_folio_con_forma_invalida_da_404(cliente) -> None:
    for malo in ("basura", "RPB2026-000001", "RPB2026-000001-0OI1"):
        r = cliente.get(f"/api/registros/{malo}", params={"fnac": "14/08/1992"})
        assert r.status_code == 404, malo


# --------------------------------------------------------------------------
# Bitácora
# --------------------------------------------------------------------------


def test_la_bitacora_no_guarda_datos_personales(cliente, payload, s) -> None:
    cliente.post("/api/registros", json=payload)
    from sqlmodel import select

    from app.modelos import Bitacora

    entradas = s.exec(select(Bitacora)).all()
    assert len(entradas) == 1
    entrada = entradas[0]
    assert entrada.accion == "registro.crear"
    texto = f"{entrada.detalle}".lower()
    for prohibido in ("mizraim", "rosales", "7721199093", "example.mx", "o+"):
        assert prohibido.lower() not in texto
