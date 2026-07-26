"""Validador de resultados: las siete reglas del contrato de cronometraje.

DOS PRINCIPIOS, y los dos vienen de la carrera real:

1. **No bloquea.** Publica todo y marca lo dudoso. Con 800 corredores y la gente
   esperando en la meta, «todo o nada» significa no publicar nada — y en la 4ª
   edición eso habría dejado fuera al campeón de Máster 50, que terminó sin
   tiempo registrado.

2. **Es idempotente.** `validar(validar(x)) == validar(x)`. El archivo que manda
   el host ya viene con estados asignados; revalidar tiene que reproducir las
   mismas marcas, no acumularlas ni escalarlas.

El estado se DERIVA de los hechos (vueltas, tiempo, posición, nombre, dorsal),
no del estado que trae el archivo. La única excepción son `DNF`/`DNS`/`DSQ`: son
juicios que solo el sistema de cronometraje puede emitir —nadie puede deducir
desde los datos si alguien abandonó o nunca se presentó— así que se preservan.
"""

from __future__ import annotations

import copy
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any

# Versión de las REGLAS, no del archivo. Cada publicación guarda con qué
# versión se produjo, para que el admin pueda avisar «esto se publicó con
# reglas viejas» sin bloquear nada. Súbela cuando cambie el comportamiento
# observable del validador, no cuando se toque un comentario.
VALIDADOR_VERSION = "1.0"

# Formato estricto del contrato. Las centésimas son parte del dato: en Elite
# Varonil el 1º y el 2º se separan por 4.29 segundos.
TIEMPO_ESTRICTO = re.compile(r"^\d{2}:[0-5]\d:[0-5]\d\.\d{2}$")

# Estados que no se pueden derivar de los datos y por eso se preservan.
ESTADOS_DE_JUICIO = ("DNF", "DNS", "DSQ")

PLACEHOLDER_NOMBRE = "(sin nombre)"

NOTA_SIN_TIEMPO = "Completó el recorrido; el cronómetro no registró tiempo."
NOTA_MAS_RAPIDO = (
    "Su tiempo es menor al del primer lugar. Posible ruta o lectura de chip cruzada."
)


@dataclass(frozen=True, slots=True)
class Hallazgo:
    regla: int
    categoria_id: str
    dorsal: int | None
    severidad: str  # 'marca' | 'aviso'
    mensaje: str
    accion: str  # 'REVISION' | 'SIN_TIEMPO' | 'normalizado' | 'ninguna'


@dataclass
class Reporte:
    hallazgos: list[Hallazgo] = field(default_factory=list)
    total_corredores: int = 0
    cambios_de_estado: list[dict[str, Any]] = field(default_factory=list)

    @property
    def marcas(self) -> list[Hallazgo]:
        return [h for h in self.hallazgos if h.severidad == "marca"]

    @property
    def avisos(self) -> list[Hallazgo]:
        return [h for h in self.hallazgos if h.severidad == "aviso"]

    def por_regla(self) -> dict[int, int]:
        return dict(Counter(h.regla for h in self.marcas))

    def resumen(self) -> dict[str, Any]:
        return {
            "total_corredores": self.total_corredores,
            "marcados": len(self.marcas),
            "avisos": len(self.avisos),
            "por_regla": self.por_regla(),
            "cambios_de_estado": len(self.cambios_de_estado),
        }


# ---------------------------------------------------------------------------
# Regla 1 — formato de tiempo
# ---------------------------------------------------------------------------

# Formas que sí se pueden recuperar sin adivinar. Salen de los PDF oficiales:
# el separador de centésimas llegó como ':' o el de minutos como '.'.
_RECUPERABLES = (
    # 04:05:48:71  -> los dos puntos finales son centésimas
    (re.compile(r"^(\d{1,2}):([0-5]\d):([0-5]\d):(\d{2})$"), r"\1:\2:\3.\4"),
    # 04:22.07.63  -> el primer punto era separador de minutos
    (re.compile(r"^(\d{1,2}):([0-5]\d)\.([0-5]\d)\.(\d{2})$"), r"\1:\2:\3.\4"),
    # 05.08:02.70  -> el punto inicial era separador de horas
    (re.compile(r"^(\d{1,2})\.([0-5]\d):([0-5]\d)\.(\d{2})$"), r"\1:\2:\3.\4"),
    # 04:04.25.23 ya cubierto arriba;  5:35:45.95 -> falta el cero de la hora
    (re.compile(r"^(\d):([0-5]\d):([0-5]\d)\.(\d{2})$"), r"0\1:\2:\3.\4"),
)


def normalizar_tiempo(tiempo: str) -> tuple[str | None, bool]:
    """Devuelve `(tiempo_normalizado, se_tuvo_que_corregir)`.

    `(None, True)` significa que no se pudo recuperar sin adivinar: se marca en
    vez de inventar un tiempo, porque un tiempo inventado decide un podio.
    """
    limpio = tiempo.strip()
    if TIEMPO_ESTRICTO.match(limpio):
        return limpio, False
    for patron, reemplazo in _RECUPERABLES:
        if patron.match(limpio):
            candidato = patron.sub(reemplazo, limpio)
            if TIEMPO_ESTRICTO.match(candidato):
                return candidato, True
    return None, True


def a_centesimas(tiempo: str | None) -> int | None:
    if tiempo is None:
        return None
    m = re.match(r"^(\d+):([0-5]\d):([0-5]\d)\.(\d{2})$", tiempo.strip())
    if m is None:
        return None
    h, mi, s, cc = (int(g) for g in m.groups())
    return ((h * 60 + mi) * 60 + s) * 100 + cc


# ---------------------------------------------------------------------------
# El validador
# ---------------------------------------------------------------------------


def validar(datos: dict[str, Any]) -> tuple[dict[str, Any], Reporte]:
    """Valida y normaliza. No muta la entrada."""
    salida = copy.deepcopy(datos)
    reporte = Reporte()

    categorias = salida.get("categorias", [])

    # --- R1 va en una PASADA PREVIA, sobre todo el archivo ------------------
    # Tiene que correr antes que las demás porque R3 compara contra el tiempo
    # del 1º: si ese tiempo todavía está malformado, `a_centesimas` devuelve
    # None, R3 no puede evaluarse y la SEGUNDA validación —ya con el tiempo
    # normalizado— daría un resultado distinto. Es decir: sin esta separación
    # el validador no es idempotente.
    ya_marcados = _normalizar_tiempos(categorias, reporte)

    # --- R6 se evalúa sobre TODA la edición, no por categoría ---------------
    cuenta_dorsales: Counter[int] = Counter()
    for c in categorias:
        for r in c.get("corredores", []):
            cuenta_dorsales[r.get("dorsal")] += 1

    for c in categorias:
        cat_id = c.get("id", "?")
        corredores = c.get("corredores", [])
        reporte.total_corredores += len(corredores)

        # --- Contexto de la categoría --------------------------------------
        total_en_categoria = len(corredores)
        posiciones = [r.get("posicion") for r in corredores if r.get("posicion") is not None]
        repetidas = {p for p, n in Counter(posiciones).items() if n > 1}
        clasificados = len(posiciones)

        # Base para R3: el tiempo del 1º. Si el 1º no tiene tiempo (pasa: en
        # Z-40 el campeón es SIN_TIEMPO), no hay base y R3 no puede evaluarse.
        primero = next((r for r in corredores if r.get("posicion") == 1), None)
        base = a_centesimas(primero.get("tiempo")) if primero else None

        # --- Huecos: se REPORTAN, nunca se renumeran -----------------------
        # Renumerar sería inventar un resultado. En N-40 falta la posición 32 y
        # en Y-80 falta el 2º lugar; los dos se publican tal cual.
        en_rango = [p for p in posiciones if p <= total_en_categoria]
        faltantes: list[int] = []
        if en_rango:
            faltantes = sorted(set(range(1, max(en_rango) + 1)) - set(en_rango))
        fuera_de_rango = [
            r for r in corredores
            if r.get("posicion") is not None and r["posicion"] > total_en_categoria
        ]

        hipotesis = _hipotesis_de_captura(
            corredores, faltantes, fuera_de_rango, base, cat_id
        )
        if hipotesis is not None:
            # Un solo hallazgo en vez de dos sueltos: la diferencia entre
            # mandar al comité a investigar y mandarlo a confirmar.
            reporte.hallazgos.append(hipotesis)
        else:
            for p in faltantes:
                reporte.hallazgos.append(
                    Hallazgo(
                        regla=2,
                        categoria_id=cat_id,
                        dorsal=None,
                        severidad="aviso",
                        mensaje=f"Falta la posición {p} en la numeración.",
                        accion="ninguna",
                    )
                )

        for r in corredores:
            if id(r) in ya_marcados:
                continue  # R1 ya lo marcó; primera regla que dispara, gana
            _validar_corredor(
                r,
                cat_id=cat_id,
                total_en_categoria=total_en_categoria,
                clasificados=clasificados,
                repetidas=repetidas,
                base=base,
                cuenta_dorsales=cuenta_dorsales,
                reporte=reporte,
            )

    return salida, reporte


def _hipotesis_de_captura(
    corredores: list[dict[str, Any]],
    faltantes: list[int],
    fuera_de_rango: list[dict[str, Any]],
    base: int | None,
    cat_id: str,
) -> Hallazgo | None:
    """¿El hueco y la posición fuera de rango son el mismo error de captura?

    En los datos reales pasa en `Y-80`: falta la posición 2 y sobra la 72, y el
    tiempo del #638 es el segundo mejor de la categoría. Es un `2` capturado
    como `72`.

    Cuando el patrón encaja —exactamente un hueco, exactamente una posición
    fuera de rango, y el hueco es prefijo o sufijo de esa posición— se emite
    UNA observación con la hipótesis en vez de dos hallazgos sueltos.

    Sigue siendo un REPORTE. No se renumera nada: la posición la pone el
    sistema de cronometraje y corregirla es decisión del comité.
    """
    if len(faltantes) != 1 or len(fuera_de_rango) != 1:
        return None

    hueco = faltantes[0]
    sospechoso = fuera_de_rango[0]
    posicion = sospechoso["posicion"]
    texto_hueco, texto_pos = str(hueco), str(posicion)
    if texto_hueco == texto_pos:
        return None
    if not (texto_pos.startswith(texto_hueco) or texto_pos.endswith(texto_hueco)):
        return None

    mensaje = (
        f"La posición {posicion} (#{sospechoso.get('dorsal')}) probablemente "
        f"debería ser {hueco}: falta esa posición en la numeración"
    )

    # Si además el tiempo corresponde a ese lugar, la hipótesis se sostiene
    # sola y conviene decirlo: le ahorra al comité la comprobación.
    propio = a_centesimas(sospechoso.get("tiempo"))
    if propio is not None and base is not None:
        # Se cuentan solo los tiempos IGUALES O MAYORES al del 1º. Un tiempo
        # por debajo del ganador no es una posición válida —es justo lo que
        # marca R3— y contarlo correría el lugar hacia abajo. En Y-80 pasa:
        # sin este filtro, el #375 (más rápido que el 1º) haría parecer que el
        # #638 es tercero.
        mas_rapidos = sum(
            1
            for r in corredores
            if (t := a_centesimas(r.get("tiempo"))) is not None and base <= t < propio
        )
        lugar_por_tiempo = mas_rapidos + 1
        if lugar_por_tiempo == hueco:
            mensaje += f" y el tiempo corresponde al lugar {hueco}"
    mensaje += "."

    return Hallazgo(
        regla=2,
        categoria_id=cat_id,
        dorsal=sospechoso.get("dorsal"),
        severidad="aviso",
        mensaje=mensaje,
        accion="ninguna",
    )


def _normalizar_tiempos(categorias: list[dict[str, Any]], reporte: Reporte) -> set[int]:
    """Aplica la regla 1 a todo el archivo. Devuelve los registros ya marcados.

    Lo recuperable se corrige (el separador llegó mal, pero los dígitos son los
    que son) y se deja constancia. Lo irrecuperable se marca: un tiempo
    inventado decide un podio.
    """
    marcados: set[int] = set()
    for c in categorias:
        cat_id = c.get("id", "?")
        for r in c.get("corredores", []):
            tiempo = r.get("tiempo")
            if tiempo is None:
                continue
            normalizado, corregido = normalizar_tiempo(tiempo)
            if normalizado is None:
                estado_entrante = r.get("estado")
                mensaje = f"El tiempo «{tiempo}» no tiene el formato HH:MM:SS.CC."
                reporte.hallazgos.append(
                    Hallazgo(
                        regla=1,
                        categoria_id=cat_id,
                        dorsal=r.get("dorsal"),
                        severidad="marca",
                        mensaje=mensaje,
                        accion="REVISION",
                    )
                )
                r["estado"] = "REVISION"
                r["nota"] = mensaje
                marcados.add(id(r))
                _cerrar(r, estado_entrante, reporte, cat_id)
            elif corregido:
                r["tiempo"] = normalizado
                reporte.hallazgos.append(
                    Hallazgo(
                        regla=1,
                        categoria_id=cat_id,
                        dorsal=r.get("dorsal"),
                        severidad="aviso",
                        mensaje=f"Tiempo «{tiempo}» normalizado a «{normalizado}».",
                        accion="normalizado",
                    )
                )
    return marcados


def _validar_corredor(
    r: dict[str, Any],
    *,
    cat_id: str,
    total_en_categoria: int,
    clasificados: int,
    repetidas: set[int],
    base: int | None,
    cuenta_dorsales: Counter,
    reporte: Reporte,
) -> None:
    """Aplica las reglas en orden y se queda con la PRIMERA que dispara.

    El orden importa: un registro con vueltas incompletas Y dorsal duplicado
    (el #127 de Z-40) lleva la nota de R4, no la de R6. Es lo que hizo el
    comité a mano y es lo que hay que reproducir.
    """
    estado_entrante = r.get("estado")
    dorsal = r.get("dorsal")
    posicion = r.get("posicion")
    hechas = r.get("vueltas_hechas", 0)
    totales = r.get("vueltas_totales", 0)
    nombre = (r.get("nombre") or "").strip()

    def marcar(regla: int, mensaje: str, estado: str = "REVISION") -> None:
        reporte.hallazgos.append(
            Hallazgo(
                regla=regla,
                categoria_id=cat_id,
                dorsal=dorsal,
                severidad="marca",
                mensaje=mensaje,
                accion=estado,
            )
        )
        r["estado"] = estado
        r["nota"] = mensaje

    # R1 ya corrió en la pasada previa: aquí el tiempo ya está normalizado.
    tiempo = r.get("tiempo")

    # --- R2 · posiciones ---------------------------------------------------
    if posicion is not None:
        if posicion in repetidas:
            marcar(2, f"La posición {posicion} está asignada a más de un corredor.")
            _cerrar(r, estado_entrante, reporte, cat_id)
            return
        # Fuera de rango se mide contra el TOTAL de la categoría, no contra los
        # clasificados: cuando falta una posición (N-40 sin la 32) el último
        # clasificado excede la cuenta sin que eso sea un error.
        if posicion > total_en_categoria:
            marcar(
                2,
                f"Posición {posicion} fuera de rango: la categoría tiene "
                f"{clasificados} clasificados.",
            )
            _cerrar(r, estado_entrante, reporte, cat_id)
            return

    # --- R3 · más rápido que el 1º ----------------------------------------
    propio = a_centesimas(tiempo)
    if base is not None and propio is not None and posicion is not None and posicion > 1:
        if propio < base:
            marcar(3, NOTA_MAS_RAPIDO)
            _cerrar(r, estado_entrante, reporte, cat_id)
            return

    # --- R4 · vueltas incompletas -----------------------------------------
    if hechas < totales and (posicion is not None or tiempo is not None):
        if posicion is not None and tiempo is not None:
            que = "posición y tiempo"
        elif tiempo is not None:
            que = "tiempo"
        else:
            que = "posición"
        marcar(4, f"Registra {hechas}/{totales} vueltas pero tiene {que}.")
        _cerrar(r, estado_entrante, reporte, cat_id)
        return

    # --- R5 · vuelta completa sin tiempo ----------------------------------
    # Nunca queda como OK: terminó, pero el cronómetro no lo registró. Es el
    # caso del campeón de Máster 50.
    if hechas >= totales and totales > 0 and tiempo is None:
        marcar(5, NOTA_SIN_TIEMPO, estado="SIN_TIEMPO")
        _cerrar(r, estado_entrante, reporte, cat_id)
        return

    # --- R6 · dorsal duplicado --------------------------------------------
    if dorsal is not None and cuenta_dorsales[dorsal] > 1:
        marcar(6, f"El dorsal {dorsal} aparece en más de un registro.")
        _cerrar(r, estado_entrante, reporte, cat_id)
        return

    # --- R7 · nombre ------------------------------------------------------
    if nombre == "" or nombre == PLACEHOLDER_NOMBRE:
        r["nombre"] = PLACEHOLDER_NOMBRE
        marcar(7, "Registro sin nombre en el padrón.")
        _cerrar(r, estado_entrante, reporte, cat_id)
        return

    # --- Ninguna regla disparó --------------------------------------------
    # DNF/DNS/DSQ se preservan: nadie puede deducir de los datos si alguien
    # abandonó o si nunca se presentó. Lo demás queda OK y sin nota.
    if estado_entrante in ESTADOS_DE_JUICIO:
        r["estado"] = estado_entrante
    else:
        r["estado"] = "OK"
        r.pop("nota", None)
    _cerrar(r, estado_entrante, reporte, cat_id)


def _cerrar(r: dict[str, Any], estado_entrante: str | None, reporte: Reporte, cat_id: str) -> None:
    """Anota si el estado cambió respecto de lo que traía el archivo.

    Sirve para que el comité vea qué se movió al revalidar: un registro que
    estaba en REVISION y quedó limpio es tan importante como uno nuevo marcado.
    """
    if estado_entrante is not None and r.get("estado") != estado_entrante:
        reporte.cambios_de_estado.append(
            {
                "categoria_id": cat_id,
                "dorsal": r.get("dorsal"),
                "antes": estado_entrante,
                "despues": r.get("estado"),
            }
        )
