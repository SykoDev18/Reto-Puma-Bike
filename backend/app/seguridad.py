"""Autenticación del panel: contraseñas, sesión y CSRF.

Tres o cuatro personas del comité, cinco pantallas. No hace falta OAuth ni un
proveedor de identidad: hace falta que esté bien hecho lo poco que hay.
"""

from __future__ import annotations

import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlmodel import Session, select

from .modelos import Usuario

# argon2id con los parámetros por defecto de la librería, que ya son los
# recomendados. Nunca `hashlib` a mano: un hash sin sal ni coste de memoria se
# rompe con una tabla precomputada.
_hasher = PasswordHasher()

DURACION_SESION = timedelta(hours=8)
MAX_INTENTOS = 5
BLOQUEO = timedelta(minutes=15)

# En producción se pasa por entorno. El default aleatorio hace que, si alguien
# olvida configurarlo, las sesiones simplemente no sobrevivan al reinicio — que
# es molesto pero seguro, en vez de cómodo e inseguro.
SECRETO = os.getenv("RPB_SECRETO", secrets.token_urlsafe(32))
_serializador = URLSafeTimedSerializer(SECRETO, salt="sesion-admin")

NOMBRE_COOKIE = "rpb_sesion"


# ---------------------------------------------------------------------------
# Contraseñas
# ---------------------------------------------------------------------------


def hashear(contrasena: str) -> str:
    return _hasher.hash(contrasena)


def verificar(hash_guardado: str, contrasena: str) -> bool:
    try:
        return _hasher.verify(hash_guardado, contrasena)
    except (VerifyMismatchError, InvalidHashError, Exception):
        return False


def necesita_rehash(hash_guardado: str) -> bool:
    try:
        return _hasher.check_needs_rehash(hash_guardado)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Sesión
# ---------------------------------------------------------------------------


def firmar_sesion(usuario: str) -> str:
    return _serializador.dumps({"u": usuario})


def leer_sesion(token: str) -> str | None:
    try:
        datos = _serializador.loads(token, max_age=int(DURACION_SESION.total_seconds()))
    except BadSignature:
        return None
    except Exception:
        return None
    return datos.get("u") if isinstance(datos, dict) else None


def ahora() -> datetime:
    return datetime.now(timezone.utc)


def _aware(momento: datetime | None) -> datetime | None:
    """SQLite devuelve datetimes sin zona; se les asume UTC al compararlos."""
    if momento is None:
        return None
    return momento if momento.tzinfo else momento.replace(tzinfo=timezone.utc)


def esta_bloqueado(u: Usuario) -> bool:
    hasta = _aware(u.bloqueado_hasta)
    return hasta is not None and hasta > ahora()


def autenticar(s: Session, usuario: str, contrasena: str) -> tuple[Usuario | None, str]:
    """Devuelve `(usuario, motivo)`. `motivo` es '' si entró.

    El mensaje de fallo es **el mismo** para usuario inexistente y contraseña
    equivocada: distinguirlos permite averiguar qué usuarios existen.
    """
    u = s.exec(select(Usuario).where(Usuario.usuario == usuario.strip().lower())).first()

    if u is None:
        # Se gasta el mismo tiempo que en un intento real para no filtrar por
        # latencia qué usuarios existen.
        _hasher.hash(contrasena)
        return None, "credenciales"

    if not u.activo:
        return None, "inactivo"

    if esta_bloqueado(u):
        return None, "bloqueado"

    if not verificar(u.hash_contrasena, contrasena):
        u.intentos_fallidos += 1
        if u.intentos_fallidos >= MAX_INTENTOS:
            u.bloqueado_hasta = ahora() + BLOQUEO
            u.intentos_fallidos = 0
        s.add(u)
        s.commit()
        return None, "credenciales"

    if necesita_rehash(u.hash_contrasena):
        u.hash_contrasena = hashear(contrasena)
    u.intentos_fallidos = 0
    u.bloqueado_hasta = None
    u.ultimo_acceso = ahora()
    s.add(u)
    s.commit()
    return u, ""


# ---------------------------------------------------------------------------
# CSRF
# ---------------------------------------------------------------------------


def token_csrf(sesion: str) -> str:
    """Token ligado a la sesión (patrón sincronizador).

    Sin esto, un sitio cualquiera puede hacer que el navegador del comité
    envíe un POST a `/admin/registros/X/pagar` mientras la sesión está abierta.
    """
    return hmac.new(SECRETO.encode(), sesion.encode(), "sha256").hexdigest()


def csrf_valido(sesion: str, recibido: str | None) -> bool:
    if not recibido:
        return False
    return hmac.compare_digest(token_csrf(sesion), recibido)
