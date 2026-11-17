"""Servicio tickets: genera entradas (PDF + QR), permite descargarlas y valida códigos."""
import secrets
import time
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from . import db
from .config import PDF_DIR
from .logger import log
from .pdf import generar_pdf
from .seguridad import solo_interno, usuario_requerido

ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sin 0/O ni 1/I para que se lea fácil


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    try:
        PDF_DIR.mkdir(parents=True, exist_ok=True)
        db.inicializar()
        log.info(f"Conexión a la BD correcta, tablas listas. PDFs en {PDF_DIR}")
    except Exception as e:
        log.error(f"No se pudo iniciar: {e}")
        raise SystemExit(1)
    yield


app = FastAPI(title="EntradasYa - tickets", lifespan=ciclo_de_vida)


@app.middleware("http")
async def log_peticiones(request: Request, call_next):
    inicio = time.time()
    respuesta = await call_next(request)
    ms = int((time.time() - inicio) * 1000)
    log.info(f"{request.method} {request.url.path} -> {respuesta.status_code} ({ms} ms)")
    return respuesta


class EmitirIn(BaseModel):
    orden_id: str = Field(min_length=1, max_length=64)
    usuario_id: int
    evento_id: int
    evento: str = Field(min_length=1, max_length=150)
    fecha: datetime
    lugar: str = Field(min_length=1, max_length=150)
    sector: str = Field(min_length=1, max_length=50)
    precio_unitario: float = Field(ge=0)
    cantidad: int = Field(gt=0, le=6)


def _nuevo_codigo() -> str:
    parte = lambda: "".join(secrets.choice(ALFABETO) for _ in range(4))
    return f"EY-{parte()}-{parte()}"


def _publica(e: dict) -> dict:
    return {
        "codigo": e["codigo"],
        "orden_id": e["orden_id"],
        "evento_id": e["evento_id"],
        "evento": e["evento"],
        "fecha": e["fecha"],
        "lugar": e["lugar"],
        "sector": e["sector"],
        "precio": float(e["precio"]),
        "numero": e["numero"],
        "estado": e["estado"],
        "pdf_url": f"/entradas/{e['codigo']}/pdf",
    }


# ---------- Health ----------

@app.get("/health")
def health():
    try:
        with db.conexion() as conn:
            conn.execute("SELECT 1")
        if not PDF_DIR.is_dir():
            raise RuntimeError("no existe la carpeta de PDFs")
        return {"status": "ok", "servicio": "tickets", "db": "ok", "pdf_dir": "ok"}
    except Exception as e:
        log.error(f"Health: {e}")
        return JSONResponse(status_code=503, content={"status": "error", "servicio": "tickets", "detalle": str(e)})


# ---------- Interno: lo usa orders ----------

@app.post("/entradas", status_code=201, dependencies=[Depends(solo_interno)])
def emitir(datos: EmitirIn):
    """Genera una entrada (con su PDF) por cada asiento. Repetir la misma orden no duplica."""
    with db.conexion() as conn:
        existentes = conn.execute(
            "SELECT * FROM entradas WHERE orden_id = %s ORDER BY numero", (datos.orden_id,)
        ).fetchall()
        if existentes:
            log.info(f"Orden {datos.orden_id} ya tenía entradas: se devuelven las mismas")
            return [_publica(e) for e in existentes]

        nuevas = []
        for numero in range(1, datos.cantidad + 1):
            codigo = _nuevo_codigo()
            fila = {
                "codigo": codigo, "orden_id": datos.orden_id, "usuario_id": datos.usuario_id,
                "evento_id": datos.evento_id, "evento": datos.evento, "fecha": datos.fecha,
                "lugar": datos.lugar, "sector": datos.sector, "precio": datos.precio_unitario,
                "numero": numero, "pdf": f"{codigo}.pdf",
            }
            generar_pdf(PDF_DIR / fila["pdf"], fila)
            nuevas.append(conn.execute(
                "INSERT INTO entradas (codigo, orden_id, usuario_id, evento_id, evento, fecha, lugar, "
                "sector, precio, numero, pdf) VALUES (%(codigo)s, %(orden_id)s, %(usuario_id)s, "
                "%(evento_id)s, %(evento)s, %(fecha)s, %(lugar)s, %(sector)s, %(precio)s, %(numero)s, "
                "%(pdf)s) RETURNING *",
                fila,
            ).fetchone())
        log.info(f"Emitidas {len(nuevas)} entradas para orden={datos.orden_id}")
        return [_publica(e) for e in nuevas]


# ---------- Interno: lo usa checkin ----------

@app.get("/validar/{codigo}", dependencies=[Depends(solo_interno)])
def validar(codigo: str):
    """Informa si el código existe, a qué evento pertenece y si es válido."""
    with db.conexion() as conn:
        e = conn.execute("SELECT * FROM entradas WHERE codigo = %s", (codigo.strip().upper(),)).fetchone()
    if not e:
        return {"codigo": codigo, "existe": False, "valida": False, "motivo": "Código inválido"}
    return {
        "codigo": e["codigo"],
        "existe": True,
        "evento_id": e["evento_id"],
        "evento": e["evento"],
        "sector": e["sector"],
        "valida": e["estado"] == "valida",
        "motivo": None if e["estado"] == "valida" else "Entrada anulada",
    }


# ---------- Cliente ----------

@app.get("/entradas/mias")
def mis_entradas(usuario: dict = Depends(usuario_requerido)):
    with db.conexion() as conn:
        filas = conn.execute(
            "SELECT * FROM entradas WHERE usuario_id = %s ORDER BY creado_en DESC, numero",
            (usuario["id"],),
        ).fetchall()
    return [_publica(e) for e in filas]


@app.get("/entradas/{codigo}/pdf")
def descargar(codigo: str, usuario: dict = Depends(usuario_requerido)):
    with db.conexion() as conn:
        e = conn.execute("SELECT * FROM entradas WHERE codigo = %s", (codigo.upper(),)).fetchone()
    if not e or e["usuario_id"] != usuario["id"]:
        raise HTTPException(404, "Entrada no encontrada")
    ruta = PDF_DIR / e["pdf"]
    if not ruta.is_file():
        log.error(f"Falta el archivo PDF {ruta}")
        raise HTTPException(500, "El PDF no está disponible")
    return FileResponse(ruta, media_type="application/pdf", filename=f"entrada-{e['codigo']}.pdf")
