"""Aplicación FastAPI. Fase 1: solo lo público de inscripciones.

Lo que NO hay aquí, a propósito:
  · ninguna conexión al host de cronometraje (192.168.0.10). Si algún día
    aparece un cliente HTTP hacia esa red, es un bug de arquitectura.
  · ninguna ruta que exponga el padrón sin sesión.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .admin.rutas import router as router_admin
from .api.registros import router as router_registros
from .bd import crear_tablas

# CORS restringido al dominio del sitio, nunca `*`.
ORIGENES = [
    o.strip()
    for o in os.getenv(
        "RPB_ORIGENES",
        "https://retopumabike.mx,https://www.retopumabike.mx,http://localhost:5173",
    ).split(",")
    if o.strip()
]

@asynccontextmanager
async def ciclo_de_vida(_app: FastAPI) -> AsyncIterator[None]:
    crear_tablas()
    yield


app = FastAPI(
    title="Reto Puma Bike — API",
    version="1.0.0-fase1",
    description="Inscripciones y datos públicos. No toca el sistema de cronometraje.",
    lifespan=ciclo_de_vida,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(router_registros)
app.include_router(router_admin)


@app.get("/")
def raiz() -> dict:
    return {"servicio": "reto-puma-bike", "edicion": config.EDICION}
