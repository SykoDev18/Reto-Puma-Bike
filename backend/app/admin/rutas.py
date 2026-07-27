"""Panel del comité. HTML server-side con Jinja2, sin build step.

Son cinco pantallas que usan tres personas: una SPA de administración sería más
código, más superficie y más cosas que se pueden romper, a cambio de nada.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from .. import config, seguridad
from ..bd import anotar, sesion
from ..dominio import conciliacion, contenido, edicion, publicacion
from ..dominio.categorias import catalogo
from ..dominio.conciliacion import ErrorConciliacion
from ..dominio.registros import ErrorRegistro
from ..exportacion import padron as exp_padron
from ..modelos import Aviso, Bitacora, Lugar, Registro, SubidaResultados, Usuario

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


@router.post("/registros/pagar-varios")
def pagar_varios(
    peticion: Request,
    folios: list[str] = Form(default=[]),
    referencia: str = Form(default=""),
    monto: str = Form(default=""),
    _: None = Depends(exigir_csrf),
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    """Un depósito, varios inscritos.

    Es el caso común de un club que transfiere por ocho corredores en un solo
    movimiento. Sin esto son ocho clics y ocho capturas de la misma referencia.
    """
    if not folios:
        return RedirectResponse("/admin/", status_code=status.HTTP_303_SEE_OTHER)
    total = int(monto) if monto.strip().isdigit() else None
    try:
        registros = conciliacion.marcar_pagados(
            s, folios, verificado_por=u.usuario, referencia=referencia, monto_recibido=total
        )
    except ErrorConciliacion as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    anotar(
        s,
        usuario=u.usuario,
        accion="pago.verificar_lote",
        entidad="registro",
        entidad_id=",".join(r.folio for r in registros),
        detalle={
            "cuantos": len(registros),
            "esperado": sum(r.kit_precio for r in registros),
            "recibido": total,
            "referencia": bool(referencia.strip()),
        },
        ip=peticion.client.host if peticion.client else None,
    )
    s.commit()
    return RedirectResponse("/admin/", status_code=status.HTTP_303_SEE_OTHER)


@router.get("/depositos", response_class=HTMLResponse)
def depositos(
    peticion: Request,
    ref: str = "",
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    """Quiénes comparten una referencia y si cuadra contra el estado de cuenta."""
    return plantillas.TemplateResponse(
        request=peticion,
        name="depositos.html",
        context=_contexto(
            peticion,
            u,
            buscado=conciliacion.por_referencia(s, config.EDICION, ref) if ref else None,
            ref=ref,
            compartidos=conciliacion.depositos_compartidos(s, config.EDICION),
        ),
    )


# ---------------------------------------------------------------------------
# 2b · Editar un registro
# ---------------------------------------------------------------------------


@router.get("/registros/{folio}/editar", response_class=HTMLResponse)
def formulario_editar(
    folio: str,
    peticion: Request,
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    registro = s.exec(select(Registro).where(Registro.folio == folio)).first()
    if registro is None:
        raise HTTPException(status_code=404, detail="No existe ese folio")
    return plantillas.TemplateResponse(
        request=peticion,
        name="editar.html",
        context=_contexto(
            peticion,
            u,
            registro=registro,
            opciones=edicion.opciones_de_categoria(
                fecha_nacimiento=registro.fecha_nacimiento,
                sexo=registro.sexo,
                tipo_bicicleta=registro.tipo_bicicleta,
                peso_90_mas=registro.peso_90_mas,
            ),
            tallas=config.TALLAS,
            kits=config.KITS,
        ),
    )


@router.post("/registros/{folio}/editar")
def guardar_edicion(
    folio: str,
    peticion: Request,
    nombre: str = Form(...),
    apellido_paterno: str = Form(...),
    apellido_materno: str = Form(default=""),
    fecha_nacimiento: str = Form(...),
    sexo: str = Form(...),
    equipo: str = Form(default=""),
    tipo_bicicleta: str = Form(...),
    peso_90_mas: bool = Form(default=False),
    categoria_id: int = Form(...),
    ruta: str = Form(...),
    kit_nombre: str = Form(...),
    kit_precio: int = Form(...),
    talla_jersey: str = Form(default=""),
    emergencia_nombre: str = Form(...),
    emergencia_telefono: str = Form(...),
    tipo_sangre: str = Form(default=""),
    notas: str = Form(default=""),
    _: None = Depends(exigir_csrf),
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    cambios = {
        "nombre": nombre,
        "apellido_paterno": apellido_paterno,
        "apellido_materno": apellido_materno,
        "fecha_nacimiento": fecha_nacimiento,
        "sexo": sexo,
        "equipo": equipo,
        "tipo_bicicleta": tipo_bicicleta,
        "peso_90_mas": peso_90_mas,
        "categoria_id": categoria_id,
        "ruta": ruta,
        "kit_nombre": kit_nombre,
        "kit_precio": kit_precio,
        "talla_jersey": talla_jersey,
        "emergencia_nombre": emergencia_nombre,
        "emergencia_telefono": emergencia_telefono,
        "tipo_sangre": tipo_sangre,
        "notas": notas,
    }
    try:
        registro, aplicados = edicion.editar(s, folio, cambios)
    except ErrorRegistro as e:
        registro = s.exec(select(Registro).where(Registro.folio == folio)).first()
        return plantillas.TemplateResponse(
            request=peticion,
            name="editar.html",
            context=_contexto(
                peticion,
                u,
                registro=registro,
                error=e.mensaje,
                opciones=edicion.opciones_de_categoria(
                    fecha_nacimiento=fecha_nacimiento,
                    sexo=sexo,
                    tipo_bicicleta=tipo_bicicleta,
                    peso_90_mas=peso_90_mas,
                ),
                tallas=config.TALLAS,
                kits=config.KITS,
            ),
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        )

    if aplicados:
        # Con valor anterior y nuevo: si alguien reclama que su categoría
        # cambió, tiene que haber registro de quién y cuándo.
        anotar(
            s,
            usuario=u.usuario,
            accion="registro.editar",
            entidad="registro",
            entidad_id=registro.folio,
            detalle={"cambios": [c.para_bitacora() for c in aplicados]},
            ip=peticion.client.host if peticion.client else None,
        )
        s.commit()
    return RedirectResponse(
        f"/admin/registros/{registro.folio}/editar", status_code=status.HTTP_303_SEE_OTHER
    )


# ---------------------------------------------------------------------------
# 4 · Publicación de resultados
# ---------------------------------------------------------------------------


@router.get("/resultados", response_class=HTMLResponse)
def resultados(
    peticion: Request,
    subida: int | None = None,
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    pendiente = s.get(SubidaResultados, subida) if subida else None
    reporte = json.loads(pendiente.reporte_validacion) if pendiente else None
    return plantillas.TemplateResponse(
        request=peticion,
        name="resultados.html",
        context=_contexto(
            peticion,
            u,
            historial=publicacion.historial(s, config.EDICION),
            activa=publicacion.activa(s, config.EDICION),
            subidas=publicacion.subidas(s, config.EDICION),
            pendiente=pendiente,
            reporte=reporte,
            desactualizada=publicacion.desactualizada,
        ),
    )


@router.post("/resultados/subir")
async def subir_resultados(
    peticion: Request,
    archivo: UploadFile = File(...),
    _: None = Depends(exigir_csrf),
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    """Camino PRINCIPAL: el host no tiene internet el día del evento."""
    contenido = await archivo.read()
    try:
        subida, _reporte = publicacion.registrar_subida(
            s,
            contenido,
            edicion=config.EDICION,
            subido_por=u.usuario,
            nombre_archivo=archivo.filename or "resultados.json",
        )
    except publicacion.ErrorSubida as e:
        return plantillas.TemplateResponse(
            request=peticion,
            name="resultados.html",
            context=_contexto(
                peticion,
                u,
                error=str(e),
                historial=publicacion.historial(s, config.EDICION),
                activa=publicacion.activa(s, config.EDICION),
                subidas=publicacion.subidas(s, config.EDICION),
                pendiente=None,
                reporte=None,
                desactualizada=publicacion.desactualizada,
            ),
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        )

    anotar(
        s,
        usuario=u.usuario,
        accion="resultados.subir",
        entidad="subida",
        entidad_id=str(subida.id),
        detalle={"corredores": subida.total_corredores, "marcados": subida.total_marcados},
        ip=peticion.client.host if peticion.client else None,
    )
    s.commit()
    # Se redirige a la MISMA pantalla con el reporte: nada se publica sin que
    # alguien lo haya visto.
    return RedirectResponse(
        f"/admin/resultados?subida={subida.id}", status_code=status.HTTP_303_SEE_OTHER
    )


@router.post("/resultados/{subida_id}/publicar")
def publicar_subida(
    subida_id: int,
    peticion: Request,
    parcial: bool = Form(default=False),
    nota_parcial: str = Form(default=""),
    _: None = Depends(exigir_csrf),
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    try:
        pub, reporte = publicacion.publicar_subida(
            s,
            subida_id,
            publicado_por=u.usuario,
            parcial=parcial,
            nota_parcial=nota_parcial,
        )
    except publicacion.ErrorSubida as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    anotar(
        s,
        usuario=u.usuario,
        accion="resultados.publicar",
        entidad="publicacion",
        entidad_id=f"v{pub.version}",
        detalle={
            "corredores": pub.total_corredores,
            "marcados": len(reporte.marcas),
            "parcial": pub.parcial,
        },
        ip=peticion.client.host if peticion.client else None,
    )
    s.commit()
    return RedirectResponse("/admin/resultados", status_code=status.HTTP_303_SEE_OTHER)


@router.post("/resultados/{subida_id}/descartar")
def descartar_subida(
    subida_id: int,
    peticion: Request,
    motivo: str = Form(default=""),
    _: None = Depends(exigir_csrf),
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    try:
        subida = publicacion.descartar_subida(s, subida_id, motivo=motivo)
    except publicacion.ErrorSubida as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    anotar(
        s,
        usuario=u.usuario,
        accion="resultados.descartar",
        entidad="subida",
        entidad_id=str(subida.id),
        detalle={"motivo": bool(motivo.strip())},
        ip=peticion.client.host if peticion.client else None,
    )
    s.commit()
    return RedirectResponse("/admin/resultados", status_code=status.HTTP_303_SEE_OTHER)


@router.post("/resultados/revertir/{version}")
def revertir_publicacion(
    version: int,
    peticion: Request,
    _: None = Depends(exigir_csrf),
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    try:
        pub = publicacion.revertir(s, edicion=config.EDICION, version=version)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    anotar(
        s,
        usuario=u.usuario,
        accion="resultados.revertir",
        entidad="publicacion",
        entidad_id=f"v{pub.version}",
        ip=peticion.client.host if peticion.client else None,
    )
    s.commit()
    return RedirectResponse("/admin/resultados", status_code=status.HTTP_303_SEE_OTHER)


@router.post("/resultados/revalidar/{version}")
def revalidar_publicacion(
    version: int,
    peticion: Request,
    _: None = Depends(exigir_csrf),
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    try:
        pub, _reporte = publicacion.revalidar(
            s, edicion=config.EDICION, version=version, publicado_por=u.usuario
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    anotar(
        s,
        usuario=u.usuario,
        accion="resultados.revalidar",
        entidad="publicacion",
        entidad_id=f"v{pub.version}",
        detalle={"origen": version},
        ip=peticion.client.host if peticion.client else None,
    )
    s.commit()
    return RedirectResponse("/admin/resultados", status_code=status.HTTP_303_SEE_OTHER)


# ---------------------------------------------------------------------------
# 5 · Anuncios y hospedaje
# ---------------------------------------------------------------------------


@router.get("/anuncios", response_class=HTMLResponse)
def anuncios(
    peticion: Request,
    editar_id: int | None = None,
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    return plantillas.TemplateResponse(
        request=peticion,
        name="anuncios.html",
        context=_contexto(
            peticion,
            u,
            avisos=s.exec(select(Aviso).order_by(Aviso.fecha.desc())).all(),
            actual=s.get(Aviso, editar_id) if editar_id else None,
            tipos=contenido.TIPOS_AVISO,
        ),
    )


@router.post("/anuncios")
def guardar_anuncio(
    peticion: Request,
    id_: str = Form(default="", alias="id"),
    clave: str = Form(...),
    fecha: str = Form(...),
    tipo: str = Form(...),
    titulo: str = Form(...),
    cuerpo: str = Form(default=""),
    imagen: str = Form(default=""),
    imagen_alt: str = Form(default=""),
    enlace_texto: str = Form(default=""),
    enlace_url: str = Form(default=""),
    fijado: bool = Form(default=False),
    vigente_hasta: str = Form(default=""),
    publicado: bool = Form(default=True),
    _: None = Depends(exigir_csrf),
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    datos = {
        "clave": clave, "fecha": fecha, "tipo": tipo, "titulo": titulo,
        "cuerpo": cuerpo, "imagen": imagen, "imagen_alt": imagen_alt,
        "enlace_texto": enlace_texto, "enlace_url": enlace_url,
        "fijado": fijado, "vigente_hasta": vigente_hasta, "publicado": publicado,
    }
    try:
        aviso = contenido.guardar_aviso(s, datos, id_=int(id_) if id_.isdigit() else None)
    except contenido.ErrorContenido as e:
        return plantillas.TemplateResponse(
            request=peticion,
            name="anuncios.html",
            context=_contexto(
                peticion, u,
                avisos=s.exec(select(Aviso).order_by(Aviso.fecha.desc())).all(),
                actual=None, tipos=contenido.TIPOS_AVISO,
                error=e.mensaje, campo_error=e.campo, borrador=datos,
            ),
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        )

    # Al guardar se REGENERA el estático: el sitio nunca consulta la base.
    contenido.regenerar_anuncios(s)
    anotar(
        s, usuario=u.usuario, accion="aviso.guardar", entidad="aviso",
        entidad_id=aviso.clave,
        ip=peticion.client.host if peticion.client else None,
    )
    s.commit()
    return RedirectResponse("/admin/anuncios", status_code=status.HTTP_303_SEE_OTHER)


@router.get("/hospedaje", response_class=HTMLResponse)
def hospedaje(
    peticion: Request,
    editar_id: int | None = None,
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    return plantillas.TemplateResponse(
        request=peticion,
        name="hospedaje.html",
        context=_contexto(
            peticion,
            u,
            lugares=s.exec(select(Lugar).order_by(Lugar.orden, Lugar.nombre)).all(),
            actual=s.get(Lugar, editar_id) if editar_id else None,
            tipos=contenido.TIPOS_LUGAR,
        ),
    )


@router.post("/hospedaje")
def guardar_hospedaje(
    peticion: Request,
    id_: str = Form(default="", alias="id"),
    tipo: str = Form(...),
    nombre: str = Form(...),
    descripcion: str = Form(default=""),
    direccion: str = Form(default=""),
    telefono: str = Form(default=""),
    mapa_url: str = Form(default=""),
    imagen: str = Form(default=""),
    imagen_alt: str = Form(default=""),
    convenio: str = Form(default=""),
    patrocinador: bool = Form(default=False),
    orden: int = Form(default=0),
    publicado: bool = Form(default=True),
    _: None = Depends(exigir_csrf),
    u: Usuario = Depends(usuario_actual),
    s: Session = Depends(obtener_sesion),
) -> Response:
    datos = {
        "tipo": tipo, "nombre": nombre, "descripcion": descripcion,
        "direccion": direccion, "telefono": telefono, "mapa_url": mapa_url,
        "imagen": imagen, "imagen_alt": imagen_alt, "convenio": convenio,
        "patrocinador": patrocinador, "orden": orden, "publicado": publicado,
    }
    try:
        lugar = contenido.guardar_lugar(s, datos, id_=int(id_) if id_.isdigit() else None)
    except contenido.ErrorContenido as e:
        return plantillas.TemplateResponse(
            request=peticion,
            name="hospedaje.html",
            context=_contexto(
                peticion, u,
                lugares=s.exec(select(Lugar).order_by(Lugar.orden, Lugar.nombre)).all(),
                actual=None, tipos=contenido.TIPOS_LUGAR,
                error=e.mensaje, campo_error=e.campo, borrador=datos,
            ),
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        )

    contenido.regenerar_hospedaje(s)
    anotar(
        s, usuario=u.usuario, accion="lugar.guardar", entidad="lugar",
        entidad_id=str(lugar.id),
        ip=peticion.client.host if peticion.client else None,
    )
    s.commit()
    return RedirectResponse("/admin/hospedaje", status_code=status.HTTP_303_SEE_OTHER)


# ---------------------------------------------------------------------------
# 6 · Bitácora
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
