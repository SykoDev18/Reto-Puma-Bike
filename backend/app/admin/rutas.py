"""Panel del comité. HTML server-side con Jinja2, sin build step.

Son cinco pantallas que usan tres personas: una SPA de administración sería más
código, más superficie y más cosas que se pueden romper, a cambio de nada.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from .. import config, seguridad
from ..bd import anotar, sesion
from ..dominio import conciliacion
from ..dominio.categorias import catalogo
from ..dominio.conciliacion import ErrorConciliacion
from ..exportacion import padron as exp_padron
from ..modelos import Bitacora, Usuario

router = APIRouter(prefix="/admin", tags=["admin"])
plantillas = Jinja2Templates(directory=str(Path(__file__).resolve().parent.parent / "plantillas"))


def obtener_sesion():
    with sesion() as s:
        yield s


# ---------------------------------------------------------------------------
# Dependencias de sesión
# ---------------------------------------------------------------------------


def usuario_actual(peticion: Request, s: Session = Depends(obtener_sesion)) -> Usuario:
    """Exige sesión. Sin ella, no hay panel ni exportaciones.

    Ninguna ruta de este router puede quedar sin esta dependencia: el padrón
    contiene teléfonos, correos y contactos de emergencia de ~950 personas.
    """
    token = peticion.cookies.get(seguridad.NOMBRE_COOKIE)
    nombre = seguridad.leer_sesion(token) if token else None
    if nombre is None:
        raise HTTPException(
            status_code=status.HTTP_303_SEE_OTHER,
            headers={"Location": "/admin/entrar"},
        )
    u = s.exec(select(Usuario).where(Usuario.usuario == nombre)).first()
    if u is None or not u.activo:
        raise HTTPException(
            status_code=status.HTTP_303_SEE_OTHER,
            headers={"Location": "/admin/entrar"},
        )
    return u


def exigir_csrf(peticion: Request, csrf: str = Form(default="")) -> None:
    token = peticion.cookies.get(seguridad.NOMBRE_COOKIE) or ""
    if not seguridad.csrf_valido(token, csrf):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF inválido")


def _contexto(peticion: Request, u: Usuario | None = None, **extra) -> dict:
    token = peticion.cookies.get(seguridad.NOMBRE_COOKIE) or ""
    base = {
        "request": peticion,
        "usuario": u,
        "csrf": seguridad.token_csrf(token) if token else "",
        "edicion": config.EDICION,
    }
    base.update(extra)
    return base


# ---------------------------------------------------------------------------
# Entrar y salir
# ---------------------------------------------------------------------------


@router.get("/entrar", response_class=HTMLResponse)
def formulario_entrar(peticion: Request) -> Response:
    return plantillas.TemplateResponse(
        request=peticion, name="entrar.html", context=_contexto(peticion)
    )


@router.post("/entrar")
def entrar(
    peticion: Request,
    usuario: str = Form(...),
    contrasena: str = Form(...),
    s: Session = Depends(obtener_sesion),
) -> Response:
    u, motivo = seguridad.autenticar(s, usuario, contrasena)
    if u is None:
        mensajes = {
            "bloqueado": "Demasiados intentos fallidos. Espera 15 minutos.",
            "inactivo": "Esta cuenta está desactivada.",
            # Mismo mensaje para usuario inexistente y contraseña equivocada:
            # distinguirlos permitiría averiguar qué usuarios existen.
            "credenciales": "Usuario o contraseña incorrectos.",
        }
        anotar(
            s,
            usuario=usuario.strip().lower()[:40],
            accion="sesion.fallida",
            entidad="usuario",
            entidad_id=usuario.strip().lower()[:40],
            detalle={"motivo": motivo},
            ip=peticion.client.host if peticion.client else None,
        )
        s.commit()
        return plantillas.TemplateResponse(
            request=peticion,
            name="entrar.html",
            context=_contexto(peticion, error=mensajes.get(motivo, mensajes["credenciales"])),
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    respuesta = RedirectResponse("/admin/", status_code=status.HTTP_303_SEE_OTHER)
    respuesta.set_cookie(
        seguridad.NOMBRE_COOKIE,
        seguridad.firmar_sesion(u.usuario),
        httponly=True,
        secure=config.COOKIES_SEGURAS,
        samesite="strict",
        max_age=int(seguridad.DURACION_SESION.total_seconds()),
        path="/admin",
    )
    anotar(
        s,
        usuario=u.usuario,
        accion="sesion.inicio",
        entidad="usuario",
        entidad_id=u.usuario,
        ip=peticion.client.host if peticion.client else None,
    )
    s.commit()
    return respuesta


@router.post("/salir")
def salir(peticion: Request, _: None = Depends(exigir_csrf)) -> Response:
    respuesta = RedirectResponse("/admin/entrar", status_code=status.HTTP_303_SEE_OTHER)
    respuesta.delete_cookie(seguridad.NOMBRE_COOKIE, path="/admin")
    return respuesta


# ---------------------------------------------------------------------------
# 1 · Conciliación de pagos — la pantalla de todos los días
# ---------------------------------------------------------------------------


@router.get("/", response_class=HTMLResponse)
def tablero(
    peticion: Request,
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    return plantillas.TemplateResponse(
        request=peticion,
        name="conciliacion.html",
        context=_contexto(
            peticion,
            u,
            pendientes=conciliacion.pendientes(s, config.EDICION),
            conteos=conciliacion.conteos(s, config.EDICION),
            dinero=conciliacion.dinero_pendiente(s, config.EDICION),
            dias_urgente=conciliacion.DIAS_URGENTE,
        ),
    )


@router.post("/registros/{folio}/pagar")
def marcar_pagado(
    folio: str,
    peticion: Request,
    referencia: str = Form(default=""),
    _: None = Depends(exigir_csrf),
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    try:
        registro = conciliacion.marcar_pagado(
            s, folio, verificado_por=u.usuario, referencia=referencia
        )
    except ErrorConciliacion as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    anotar(
        s,
        usuario=u.usuario,
        accion="pago.verificar",
        entidad="registro",
        entidad_id=registro.folio,
        # Sin datos personales: el folio identifica, el nombre no hace falta.
        detalle={"monto": registro.kit_precio, "referencia": bool(referencia.strip())},
        ip=peticion.client.host if peticion.client else None,
    )
    s.commit()
    return RedirectResponse("/admin/", status_code=status.HTTP_303_SEE_OTHER)


@router.post("/registros/{folio}/cancelar")
def cancelar(
    folio: str,
    peticion: Request,
    motivo: str = Form(default=""),
    _: None = Depends(exigir_csrf),
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    try:
        registro = conciliacion.cancelar(s, folio, motivo=motivo)
    except ErrorConciliacion as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    anotar(
        s,
        usuario=u.usuario,
        accion="registro.cancelar",
        entidad="registro",
        entidad_id=registro.folio,
        ip=peticion.client.host if peticion.client else None,
    )
    s.commit()
    return RedirectResponse("/admin/", status_code=status.HTTP_303_SEE_OTHER)


@router.post("/registros/{folio}/reactivar")
def reactivar(
    folio: str,
    peticion: Request,
    _: None = Depends(exigir_csrf),
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    try:
        registro = conciliacion.reactivar(s, folio)
    except ErrorConciliacion as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    anotar(
        s,
        usuario=u.usuario,
        accion="registro.reactivar",
        entidad="registro",
        entidad_id=registro.folio,
        ip=peticion.client.host if peticion.client else None,
    )
    s.commit()
    return RedirectResponse("/admin/padron", status_code=status.HTTP_303_SEE_OTHER)


# ---------------------------------------------------------------------------
# 2 · Padrón
# ---------------------------------------------------------------------------


@router.get("/padron", response_class=HTMLResponse)
def padron(
    peticion: Request,
    q: str = "",
    estado: str = "",
    ruta: str = "",
    categoria: str = "",
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    categoria_id = int(categoria) if categoria.isdigit() else None
    registros = conciliacion.buscar(
        s,
        config.EDICION,
        texto=q,
        estado=estado or None,
        categoria_id=categoria_id,
        ruta=ruta or None,
    )
    return plantillas.TemplateResponse(
        request=peticion,
        name="padron.html",
        context=_contexto(
            peticion,
            u,
            registros=registros,
            filtros={"q": q, "estado": estado, "ruta": ruta, "categoria": categoria},
            categorias=catalogo().categorias,
            conteos=conciliacion.conteos(s, config.EDICION),
        ),
    )


@router.get("/export/padron.csv")
def exportar_padron(
    peticion: Request,
    incluir_pendientes: int = 0,
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    filas = exp_padron.filas_padron(
        s, config.EDICION, incluir_pendientes=bool(incluir_pendientes)
    )
    anotar(
        s,
        usuario=u.usuario,
        accion="padron.exportar",
        entidad="padron",
        entidad_id=str(config.EDICION),
        detalle={"filas": len(filas), "incluye_pendientes": bool(incluir_pendientes)},
        ip=peticion.client.host if peticion.client else None,
    )
    s.commit()
    return Response(
        content=exp_padron.a_bytes(filas),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="padron-{config.EDICION}.csv"'
        },
    )


@router.get("/export/medico.csv")
def exportar_medico(
    peticion: Request,
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    """Export SEPARADO con tipo de sangre, para el servicio médico.

    Va aparte del padrón general a propósito: el tipo de sangre es dato
    sensible y no tiene por qué viajar en el archivo que se lleva al host de
    cronometraje. Cada generación queda en la bitácora.
    """
    filas = exp_padron.filas_padron(s, config.EDICION, incluir_pendientes=True)
    anotar(
        s,
        usuario=u.usuario,
        accion="medico.exportar",
        entidad="padron",
        entidad_id=str(config.EDICION),
        detalle={"filas": len(filas), "motivo": "uso del servicio médico"},
        ip=peticion.client.host if peticion.client else None,
    )
    s.commit()
    return Response(
        content=exp_padron.a_bytes_medico(filas),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="medico-{config.EDICION}.csv"'
        },
    )


# ---------------------------------------------------------------------------
# 3 · Bitácora
# ---------------------------------------------------------------------------


@router.get("/bitacora", response_class=HTMLResponse)
def bitacora(
    peticion: Request,
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    entradas = s.exec(
        select(Bitacora).order_by(Bitacora.ocurrido_en.desc()).limit(300)
    ).all()
    return plantillas.TemplateResponse(
        request=peticion, name="bitacora.html", context=_contexto(peticion, u, entradas=entradas)
    )
