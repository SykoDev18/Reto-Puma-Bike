"""CLI de administración.

Los usuarios del panel se crean AQUÍ, nunca por una ruta web: un registro
público de administradores es una puerta abierta.

    python -m app.cli crear-usuario ana "Ana Bastida" --rol admin
    python -m app.cli listar-usuarios
    python -m app.cli desbloquear ana
"""

from __future__ import annotations

import argparse
import getpass
import sys

from sqlmodel import select

from .bd import crear_tablas, sesion
from .modelos import Usuario
from .seguridad import hashear


def _pedir_contrasena() -> str:
    """Se pide por `getpass` y no por argumento: un argumento queda en el
    historial del shell y en la lista de procesos."""
    primera = getpass.getpass("Contraseña: ")
    if len(primera) < 12:
        print("La contraseña debe tener al menos 12 caracteres.", file=sys.stderr)
        raise SystemExit(1)
    segunda = getpass.getpass("Repítela: ")
    if primera != segunda:
        print("No coinciden.", file=sys.stderr)
        raise SystemExit(1)
    return primera


def crear_usuario(args: argparse.Namespace) -> None:
    crear_tablas()
    nombre_usuario = args.usuario.strip().lower()
    with sesion() as s:
        if s.exec(select(Usuario).where(Usuario.usuario == nombre_usuario)).first():
            print(f"El usuario «{nombre_usuario}» ya existe.", file=sys.stderr)
            raise SystemExit(1)
        contrasena = args.contrasena or _pedir_contrasena()
        s.add(
            Usuario(
                usuario=nombre_usuario,
                hash_contrasena=hashear(contrasena),
                nombre=args.nombre,
                rol=args.rol,
            )
        )
        s.commit()
    print(f"Usuario «{nombre_usuario}» creado con rol {args.rol}.")


def listar_usuarios(_args: argparse.Namespace) -> None:
    crear_tablas()
    with sesion() as s:
        for u in s.exec(select(Usuario)).all():
            estado = "activo" if u.activo else "inactivo"
            bloqueo = f" · bloqueado hasta {u.bloqueado_hasta}" if u.bloqueado_hasta else ""
            print(f"{u.usuario:<16} {u.rol:<8} {estado}{bloqueo}")


def desbloquear(args: argparse.Namespace) -> None:
    crear_tablas()
    with sesion() as s:
        u = s.exec(select(Usuario).where(Usuario.usuario == args.usuario.lower())).first()
        if u is None:
            print("No existe ese usuario.", file=sys.stderr)
            raise SystemExit(1)
        u.bloqueado_hasta = None
        u.intentos_fallidos = 0
        s.add(u)
        s.commit()
    print(f"Usuario «{args.usuario}» desbloqueado.")


def principal(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="app.cli", description="Administración del backend")
    sub = parser.add_subparsers(dest="comando", required=True)

    p = sub.add_parser("crear-usuario", help="Crea un usuario del panel")
    p.add_argument("usuario")
    p.add_argument("nombre")
    p.add_argument("--rol", choices=("admin", "comite"), default="comite")
    # Solo para pruebas automatizadas; en uso real se pide por getpass.
    p.add_argument("--contrasena", help=argparse.SUPPRESS)
    p.set_defaults(func=crear_usuario)

    p = sub.add_parser("listar-usuarios", help="Lista los usuarios")
    p.set_defaults(func=listar_usuarios)

    p = sub.add_parser("desbloquear", help="Quita el bloqueo por intentos fallidos")
    p.add_argument("usuario")
    p.set_defaults(func=desbloquear)

    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    principal()
