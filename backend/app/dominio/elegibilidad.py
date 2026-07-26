"""Motor de elegibilidad de categorías — puerto 1:1 de `src/lib/categorias.ts`.

REGLA DE ESTE ARCHIVO: es un PUERTO, no una reimplementación. Cada decisión de
orden, cada caso borde y cada comparación replican el TS aunque en Python se
escribirían distinto. Si algo aquí te parece mejorable, el lugar de discutirlo
es el front: si los dos motores divergen, el servidor aceptaría una categoría
que el front no ofrecería y tendríamos a alguien corriendo donde no va.

La equivalencia se prueba con `compartido/casos-elegibilidad.json`, un fixture
que consumen el test de TypeScript y el de Python.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .categorias import CATEGORIAS, Categoria

# El TS usa -Infinity/+Infinity para los rangos abiertos.
INFINITO_NEG = float("-inf")
INFINITO_POS = float("inf")

_ISO = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
_DDMMAAAA = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")


@dataclass(frozen=True, slots=True)
class EntradaElegibilidad:
    edad_nominal: int | None
    sexo: str
    tipo_bicicleta: str = "MTB"
    peso_90_mas: bool = False


@dataclass(frozen=True, slots=True)
class ResultadoElegibilidad:
    recomendada: Categoria | None
    alternativas: list[Categoria] = field(default_factory=list)
    sin_coincidencia: bool = False
    infantiles: bool = False
    solo_ebike: bool = False

    def permitidas(self) -> list[Categoria]:
        """Todo lo que el usuario puede elegir legítimamente. Es lo que usa la
        API para aceptar o rechazar la `categoria_id` que llegó."""
        salida: list[Categoria] = []
        if self.recomendada is not None:
            salida.append(self.recomendada)
        salida.extend(self.alternativas)
        return salida


def _rama_desde_sexo(sexo: str) -> str:
    return "V" if sexo == "M" else "F" if sexo == "F" else ""


def _limite_inferior(c: Categoria) -> float:
    return INFINITO_NEG if c.edadMin is None else c.edadMin


def _limite_superior(c: Categoria) -> float:
    return INFINITO_POS if c.edadMax is None else c.edadMax


def edad_nominal(fecha_nacimiento: str, anio_evento: int) -> int | None:
    """Edad NOMINAL: año del evento menos año de nacimiento. NO es la edad
    cumplida — es la regla con la que el comité asigna categoría.

    Acepta las DOS formas que circulan en el sistema, y esa es la razón de que
    exista esta función en vez de reusar la del TS tal cual:
      · `YYYY-MM-DD` — lo que captura el formulario
      · `DD/MM/AAAA` — lo que viaja en el payload y lo que guarda el host

    El TS solo parsea la primera. Confundirlas es el error fácil de este puente:
    `05/07/2026` leído como ISO daría un año absurdo y una categoría inventada.
    """
    texto = fecha_nacimiento.strip()

    m = _ISO.match(texto)
    if m:
        anio, mes, dia = int(m.group(1)), int(m.group(2)), int(m.group(3))
    else:
        m = _DDMMAAAA.match(texto)
        if not m:
            return None
        dia, mes, anio = int(m.group(1)), int(m.group(2)), int(m.group(3))

    # Mismo rango laxo que el TS: valida forma, no calendario. El día 31/02 lo
    # rechaza `partes_a_iso` en la capa de captura, no aquí.
    if mes < 1 or mes > 12 or dia < 1 or dia > 31:
        return None
    return anio_evento - anio


def categorias_elegibles(entrada: EntradaElegibilidad) -> ResultadoElegibilidad:
    """Puerto de `categoriasElegibles()`. Mismo orden y mismos cortes."""
    edad = entrada.edad_nominal
    rama = _rama_desde_sexo(entrada.sexo)

    if rama == "" or edad is None or edad < 3 or edad > 99:
        return ResultadoElegibilidad(recomendada=None, alternativas=[], sin_coincidencia=False)

    de_la_rama = [c for c in CATEGORIAS() if c.rama == rama]
    infantiles = edad <= 12
    por_grupo = (
        [c for c in de_la_rama if c.grupo == "Infantiles"]
        if infantiles
        else [c for c in de_la_rama if c.grupo != "Infantiles"]
    )

    if infantiles:
        recomendada = next(
            (
                c
                for c in por_grupo
                if not c.abierta and _limite_inferior(c) <= edad <= _limite_superior(c)
            ),
            None,
        )
        return ResultadoElegibilidad(
            recomendada=recomendada,
            alternativas=[],
            sin_coincidencia=recomendada is None,
            infantiles=True,
        )

    if entrada.tipo_bicicleta == "E-Bike":
        alternativas = [c for c in por_grupo if c.requiereEbike]
        return ResultadoElegibilidad(
            recomendada=None,
            alternativas=alternativas,
            sin_coincidencia=len(alternativas) == 0,
            infantiles=False,
            solo_ebike=True,
        )

    candidatas = [
        c for c in por_grupo if not c.abierta and _limite_inferior(c) <= edad <= _limite_superior(c)
    ]
    # El TS ordena por AMPLITUD del rango: gana la categoría más específica.
    # `sorted` es estable, igual que `Array.prototype.sort` en V8 — importa
    # cuando dos rangos miden lo mismo.
    candidatas = sorted(candidatas, key=lambda c: _limite_superior(c) - _limite_inferior(c))
    recomendada = candidatas[0] if candidatas else None

    alternativas: list[Categoria] = []
    for c in por_grupo:
        if not c.abierta or c.requiereEbike:
            continue
        if c.requierePeso is not None and not entrada.peso_90_mas:
            continue
        if c.clave == "M" and not entrada.peso_90_mas:
            continue
        if c.nombre.startswith("Elite") and edad < 16:
            continue
        if c.nombre.startswith("Rodadores") and edad < 13:
            continue
        alternativas.append(c)

    return ResultadoElegibilidad(
        recomendada=recomendada,
        alternativas=alternativas,
        sin_coincidencia=recomendada is None,
        infantiles=False,
    )
