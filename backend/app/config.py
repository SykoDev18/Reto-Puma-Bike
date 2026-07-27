"""Configuración del backend. Un solo lugar, sin magia."""

from __future__ import annotations

import os
from pathlib import Path

RAIZ_REPO = Path(__file__).resolve().parents[2]

# --- Evento ---------------------------------------------------------------
ANIO_EVENTO = int(os.getenv("RPB_ANIO_EVENTO", "2026"))
EDICION = ANIO_EVENTO

# --- Base de datos --------------------------------------------------------
RUTA_DATOS = Path(os.getenv("RPB_DATOS", str(RAIZ_REPO / "backend" / "datos")))
URL_BD = os.getenv("RPB_BD", f"sqlite:///{RUTA_DATOS / 'reto.db'}")

# --- Dónde se escriben los JSON estáticos que sirve el servidor web -------
RUTA_PUBLICA = Path(os.getenv("RPB_PUBLICO", str(RAIZ_REPO / "public" / "data")))

# --- Menores --------------------------------------------------------------
# El bloque de tutor todavía NO existe en el formulario del front. Si la
# exigencia se activa antes que el front, NINGÚN menor podrá inscribirse — y
# hay categorías desde "Pañales, 4 años y menos".
#
# Los campos ya existen en el modelo (nullables) desde la Fase 1. Esto se pone
# en True el día que el front entregue el bloque: una línea, sin despliegue
# coordinado.
EXIGIR_TUTOR = os.getenv("RPB_EXIGIR_TUTOR", "0") == "1"
EDAD_MAYORIA = 18

# --- Aviso de privacidad --------------------------------------------------
# Se guarda la versión aceptada por cada quien: si el aviso cambia, hay que
# poder saber cuál firmó cada persona. Un booleano no lo resuelve.
VERSION_AVISO_PRIVACIDAD = os.getenv("RPB_VERSION_AVISO", "2026-01")

# --- Tallas ---------------------------------------------------------------
# Escala MEXICANA, la del formulario ya publicado y la del proveedor local.
# Se guarda el CÓDIGO, no la etiqueta, para poder remapear si el proveedor
# cambia de escala sin tocar los registros existentes.
TALLAS: dict[str, str] = {
    "CH": "Chica",
    "M": "Mediana",
    "G": "Grande",
    "XG": "Extra grande",
    "2XG": "2 Extra grande",
    "3XG-4XG": "3 a 4 Extra grande",
}

# --- Folio ----------------------------------------------------------------
PREFIJO_FOLIO = "RPB"
# Sin 0/O ni 1/I: un folio se dicta por teléfono y se teclea desde una captura.
ALFABETO_FOLIO = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
LARGO_SUFIJO_FOLIO = 4

# --- Panel de administración ----------------------------------------------
# `Secure` en la cookie exige HTTPS. Se apaga solo para desarrollo local, donde
# no hay certificado; en producción NUNCA debe quedar en False.
COOKIES_SEGURAS = os.getenv("RPB_COOKIES_SEGURAS", "1") == "1"

# --- Cierre de inscripciones ----------------------------------------------
# Sin esto, la única forma de detener las inscripciones el día que el comité
# cierre sería apagar el servidor.
INSCRIPCIONES_ABIERTAS = os.getenv("RPB_INSCRIPCIONES", "1") == "1"
MENSAJE_CERRADO = os.getenv(
    "RPB_MENSAJE_CERRADO",
    "Las inscripciones en línea están cerradas. Escríbenos por WhatsApp para "
    "confirmar si quedan lugares.",
)

# Kits de la edición. Espejo de `CONFIG.kits` del front; el panel los ofrece al
# editar un registro para no escribir precios a mano.
KITS: dict[str, int] = {"Kit Huellita": 350, "Kit Puma": 750}
