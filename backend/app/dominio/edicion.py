"""Edición de un registro desde el panel.

Existe por una razón práctica: alguien se va a inscribir en la categoría
equivocada o va a querer cambiar de ruta o de talla. **Si el panel no lo
permite, alguien va a editar la base a mano** — y ahí se pierden la bitácora y
la validación de una sola vez.

Dos reglas que no se negocian:

1. **La categoría la recalcula el motor**, no se escribe libre. Cambiar sexo,
   fecha o tipo de bicicleta vuelve a correr `categorias_elegibles()` y solo se
   acepta lo elegible. Un admin no puede meter a alguien donde el motor no lo
   pondría: eso reaparecería el día de la carrera.
2. **Todo cambio va a la bitácora con valor anterior y nuevo.** Si alguien
   reclama que su categoría cambió, tiene que haber registro de quién y cuándo.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlmodel import Session, select

from .. import config
from ..modelos import Registro
from .categorias import Categoria, MAPA_RUTAS, catalogo
from .elegibilidad import EntradaElegibilidad, categorias_elegibles, edad_nominal
from .registros import ErrorRegistro, capitalizar

# `folio` y `creado_en` NO están y no deben estar: el folio es el identificador
# que la persona ya tiene en su WhatsApp y la fecha de alta es un hecho.
CAMPOS_EDITABLES = (
    "nombre",
    "apellido_paterno",
    "apellido_materno",
    "fecha_nacimiento",
    "sexo",
    "equipo",
    "ruta",
    "tipo_bicicleta",
    "categoria_id",
    "kit_nombre",
    "kit_precio",
    "talla_jersey",
    "emergencia_nombre",
    "emergencia_telefono",
    "tipo_sangre",
    "peso_90_mas",
    "notas",
    "tutor_nombre",
    "tutor_telefono",
)

# Campos cuyo valor anterior NO se escribe en la bitácora por ser dato
# personal. Se registra QUE cambiaron, no a qué.
SENSIBLES = ("emergencia_telefono", "tipo_sangre", "tutor_telefono")


@dataclass(frozen=True, slots=True)
class Cambio:
    campo: str
    antes: Any
    despues: Any

    def para_bitacora(self) -> dict[str, Any]:
        if self.campo in SENSIBLES:
            return {"campo": self.campo, "cambio": "sí", "valor": "(dato sensible, omitido)"}
        return {"campo": self.campo, "antes": self.antes, "despues": self.despues}


def opciones_de_categoria(
    *,
    fecha_nacimiento: str,
    sexo: str,
    tipo_bicicleta: str,
    peso_90_mas: bool,
    anio_evento: int = config.ANIO_EVENTO,
) -> list[Categoria]:
    """Lo que el motor permitiría para esos datos. Es lo único que el panel
    puede ofrecer en el selector de categoría."""
    edad = edad_nominal(fecha_nacimiento, anio_evento)
    if edad is None:
        return []
    resultado = categorias_elegibles(
        EntradaElegibilidad(
            edad_nominal=edad,
            sexo=sexo,
            tipo_bicicleta=tipo_bicicleta,
            peso_90_mas=peso_90_mas,
        )
    )
    return resultado.permitidas()


def _normalizar(campo: str, valor: Any) -> Any:
    if valor is None:
        return None
    if campo in ("nombre", "apellido_paterno", "apellido_materno", "emergencia_nombre", "tutor_nombre"):
        texto = capitalizar(str(valor))
        return texto or None
    if campo in ("equipo", "notas", "talla_jersey", "tipo_sangre"):
        texto = str(valor).strip()
        return texto or None
    if campo in ("categoria_id", "kit_precio"):
        return int(valor)
    if campo == "peso_90_mas":
        return bool(valor)
    return str(valor).strip() if isinstance(valor, str) else valor


def editar(
    s: Session,
    folio: str,
    cambios: dict[str, Any],
    *,
    anio_evento: int = config.ANIO_EVENTO,
) -> tuple[Registro, list[Cambio]]:
    """Aplica cambios validados. Devuelve `(registro, cambios_aplicados)`."""
    r = s.exec(select(Registro).where(Registro.folio == folio)).first()
    if r is None:
        raise ErrorRegistro("no_encontrado", f"No existe el folio {folio}.")

    desconocidos = set(cambios) - set(CAMPOS_EDITABLES)
    if desconocidos:
        raise ErrorRegistro(
            "campo_no_editable",
            f"Estos campos no se pueden editar: {', '.join(sorted(desconocidos))}.",
        )

    # Se arma el estado RESULTANTE y se valida completo, no campo por campo:
    # cambiar la fecha puede invalidar la categoría que ya estaba puesta.
    propuesto = {campo: getattr(r, campo) for campo in CAMPOS_EDITABLES}
    for campo, valor in cambios.items():
        propuesto[campo] = _normalizar(campo, valor)

    edad = edad_nominal(str(propuesto["fecha_nacimiento"]), anio_evento)
    if edad is None:
        raise ErrorRegistro("fecha_invalida", "La fecha de nacimiento no es válida.")
    if edad < 3 or edad > 99:
        raise ErrorRegistro(
            "edad_fuera_de_rango", "La edad nominal debe estar entre 3 y 99 años."
        )
    if propuesto["sexo"] not in ("M", "F"):
        raise ErrorRegistro("sexo_invalido", "El sexo debe ser M o F.")
    if propuesto["tipo_bicicleta"] not in ("MTB", "E-Bike"):
        raise ErrorRegistro("bicicleta_invalida", "El tipo de bicicleta no es válido.")

    # --- La categoría la decide el MOTOR ---------------------------------
    permitidas = opciones_de_categoria(
        fecha_nacimiento=str(propuesto["fecha_nacimiento"]),
        sexo=str(propuesto["sexo"]),
        tipo_bicicleta=str(propuesto["tipo_bicicleta"]),
        peso_90_mas=bool(propuesto["peso_90_mas"]),
        anio_evento=anio_evento,
    )
    categoria = catalogo().por_id(int(propuesto["categoria_id"]))
    if categoria is None:
        raise ErrorRegistro("categoria_inexistente", "Esa categoría no existe.")
    if categoria.id not in {c.id for c in permitidas}:
        raise ErrorRegistro(
            "categoria_no_elegible",
            f"Con {edad} años nominales, {propuesto['sexo']} y "
            f"{propuesto['tipo_bicicleta']}, «{categoria.nombre}» no es elegible.",
            {"edad_nominal": edad, "alternativas": permitidas},
        )

    rutas = MAPA_RUTAS().get(categoria.grupo, ())
    if propuesto["ruta"] not in rutas:
        raise ErrorRegistro(
            "ruta_no_permitida",
            f"El grupo «{categoria.grupo}» solo corre: {', '.join(rutas)}.",
            {"permitidas": list(rutas)},
        )

    if propuesto["talla_jersey"] and propuesto["talla_jersey"] not in config.TALLAS:
        raise ErrorRegistro(
            "talla_invalida", f"La talla «{propuesto['talla_jersey']}» no está vigente."
        )

    # --- Aplicar, registrando el antes y el después ------------------------
    aplicados: list[Cambio] = []
    for campo in CAMPOS_EDITABLES:
        antes = getattr(r, campo)
        despues = propuesto[campo]
        if antes != despues:
            setattr(r, campo, despues)
            aplicados.append(Cambio(campo=campo, antes=antes, despues=despues))

    # Derivados que se recalculan solos, sin pasar por `cambios`.
    if r.edad_nominal != edad:
        aplicados.append(Cambio(campo="edad_nominal", antes=r.edad_nominal, despues=edad))
        r.edad_nominal = edad
    if r.categoria_clave != categoria.clave:
        aplicados.append(
            Cambio(campo="categoria_clave", antes=r.categoria_clave, despues=categoria.clave)
        )
        r.categoria_clave = categoria.clave
    es_menor = edad < config.EDAD_MAYORIA
    if r.es_menor != es_menor:
        aplicados.append(Cambio(campo="es_menor", antes=r.es_menor, despues=es_menor))
        r.es_menor = es_menor

    if aplicados:
        s.add(r)
        s.commit()
        s.refresh(r)
    return r, aplicados
