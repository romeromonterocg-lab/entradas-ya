"""Servicio events: eventos, sectores y cupos."""
import time
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import db
from .logger import log
from .seguridad import organizador, usuario_opcional, usuario_requerido


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    try:
        db.inicializar()
        log.info("Conexión a la BD correcta, tablas listas")
    except Exception as e:
        log.error(f"No se pudo conectar a la BD: {e}")
        raise SystemExit(1)
    yield


app = FastAPI(title="EntradasYa - events", lifespan=ciclo_de_vida)


@app.middleware("http")
async def log_peticiones(request: Request, call_next):
    inicio = time.time()
    respuesta = await call_next(request)
    ms = int((time.time() - inicio) * 1000)
    log.info(f"{request.method} {request.url.path} -> {respuesta.status_code} ({ms} ms)")
    return respuesta


# ---------- Modelos (lo que se recibe en el body) ----------

class SectorIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    precio: float = Field(ge=0)
    cupo: int = Field(gt=0)


class EventoIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    fecha: datetime
    lugar: str = Field(min_length=1, max_length=150)
    imagen_url: str | None = None
    descripcion: str | None = None
    sectores: list[SectorIn] = []


class EventoUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=150)
    fecha: datetime | None = None
    lugar: str | None = Field(default=None, min_length=1, max_length=150)
    imagen_url: str | None = None
    descripcion: str | None = None


class ReservaIn(BaseModel):
    orden_id: str = Field(min_length=1, max_length=64)
    sector_id: int
    cantidad: int = Field(gt=0, le=6)


# ---------- Utilidades ----------

def _evento_con_sectores(conn, evento_id: int) -> dict | None:
    evento = conn.execute("SELECT * FROM eventos WHERE id = %s", (evento_id,)).fetchone()
    if not evento:
        return None
    sectores = conn.execute(
        "SELECT id, nombre, precio, cupo_total, cupo_disponible FROM sectores "
        "WHERE evento_id = %s ORDER BY id",
        (evento_id,),
    ).fetchall()
    for s in sectores:
        s["precio"] = float(s["precio"])
    evento["sectores"] = sectores
    return evento


def _evento_propio(conn, evento_id: int, usuario: dict) -> dict:
    evento = _evento_con_sectores(conn, evento_id)
    if not evento:
        raise HTTPException(404, "Evento no encontrado")
    if evento["organizador_id"] != usuario["id"]:
        raise HTTPException(403, "Este evento no es tuyo")
    return evento


# ---------- Health ----------

@app.get("/health")
def health():
    try:
        with db.conexion() as conn:
            conn.execute("SELECT 1")
        return {"status": "ok", "servicio": "events", "db": "ok"}
    except Exception as e:
        log.error(f"Health: sin conexión a la BD: {e}")
        return JSONResponse(
            status_code=503,
            content={"status": "error", "servicio": "events", "db": "sin conexión"},
        )


# ---------- Eventos ----------

@app.get("/eventos")
def listar_eventos(mios: bool = False, usuario: dict | None = Depends(usuario_opcional)):
    """Cartelera: solo publicados. Con ?mios=true el organizador ve todos los suyos."""
    with db.conexion() as conn:
        if mios:
            if not usuario or usuario["rol"] != "organizador":
                raise HTTPException(403, "Solo un organizador puede ver sus eventos")
            filas = conn.execute(
                "SELECT id FROM eventos WHERE organizador_id = %s ORDER BY fecha",
                (usuario["id"],),
            ).fetchall()
        else:
            filas = conn.execute(
                "SELECT id FROM eventos WHERE estado = 'publicado' ORDER BY fecha"
            ).fetchall()
        return [_evento_con_sectores(conn, f["id"]) for f in filas]


@app.get("/eventos/{evento_id}")
def ver_evento(evento_id: int, usuario: dict | None = Depends(usuario_opcional)):
    with db.conexion() as conn:
        evento = _evento_con_sectores(conn, evento_id)
    es_dueno = usuario and evento and evento["organizador_id"] == usuario["id"]
    if not evento or (evento["estado"] != "publicado" and not es_dueno):
        raise HTTPException(404, "Evento no encontrado")
    return evento


@app.post("/eventos", status_code=201)
def crear_evento(datos: EventoIn, usuario: dict = Depends(organizador)):
    with db.conexion() as conn:
        evento = conn.execute(
            "INSERT INTO eventos (organizador_id, nombre, fecha, lugar, imagen_url, descripcion) "
            "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
            (usuario["id"], datos.nombre, datos.fecha, datos.lugar, datos.imagen_url, datos.descripcion),
        ).fetchone()
        for s in datos.sectores:
            conn.execute(
                "INSERT INTO sectores (evento_id, nombre, precio, cupo_total, cupo_disponible) "
                "VALUES (%s, %s, %s, %s, %s)",
                (evento["id"], s.nombre, s.precio, s.cupo, s.cupo),
            )
        log.info(f"Evento creado: id={evento['id']} organizador={usuario['id']}")
        return _evento_con_sectores(conn, evento["id"])


@app.put("/eventos/{evento_id}")
def editar_evento(evento_id: int, datos: EventoUpdate, usuario: dict = Depends(organizador)):
    cambios = datos.model_dump(exclude_unset=True)
    with db.conexion() as conn:
        evento = _evento_propio(conn, evento_id, usuario)
        if evento["estado"] == "cancelado":
            raise HTTPException(409, "No se puede editar un evento cancelado")
        if cambios:
            columnas = ", ".join(f"{c} = %s" for c in cambios)
            conn.execute(
                f"UPDATE eventos SET {columnas} WHERE id = %s",
                (*cambios.values(), evento_id),
            )
        return _evento_con_sectores(conn, evento_id)


@app.post("/eventos/{evento_id}/sectores", status_code=201)
def agregar_sector(evento_id: int, s: SectorIn, usuario: dict = Depends(organizador)):
    with db.conexion() as conn:
        evento = _evento_propio(conn, evento_id, usuario)
        if evento["estado"] == "cancelado":
            raise HTTPException(409, "El evento está cancelado")
        conn.execute(
            "INSERT INTO sectores (evento_id, nombre, precio, cupo_total, cupo_disponible) "
            "VALUES (%s, %s, %s, %s, %s)",
            (evento_id, s.nombre, s.precio, s.cupo, s.cupo),
        )
        return _evento_con_sectores(conn, evento_id)


@app.post("/eventos/{evento_id}/publicar")
def publicar_evento(evento_id: int, usuario: dict = Depends(organizador)):
    with db.conexion() as conn:
        evento = _evento_propio(conn, evento_id, usuario)
        if evento["estado"] != "borrador":
            raise HTTPException(409, f"Solo se publica un borrador (estado actual: {evento['estado']})")
        if not evento["sectores"]:
            raise HTTPException(409, "El evento necesita al menos un sector para publicarse")
        conn.execute("UPDATE eventos SET estado = 'publicado' WHERE id = %s", (evento_id,))
        log.info(f"Evento publicado: id={evento_id}")
        return _evento_con_sectores(conn, evento_id)


@app.post("/eventos/{evento_id}/cancelar")
def cancelar_evento(evento_id: int, usuario: dict = Depends(organizador)):
    with db.conexion() as conn:
        _evento_propio(conn, evento_id, usuario)
        conn.execute("UPDATE eventos SET estado = 'cancelado' WHERE id = %s", (evento_id,))
        log.info(f"Evento cancelado: id={evento_id}")
        return _evento_con_sectores(conn, evento_id)


@app.get("/eventos/{evento_id}/resumen")
def resumen_ventas(evento_id: int, usuario: dict = Depends(organizador)):
    """Entradas vendidas e ingresos por sector (para el organizador)."""
    with db.conexion() as conn:
        evento = _evento_propio(conn, evento_id, usuario)
    sectores = []
    for s in evento["sectores"]:
        vendidas = s["cupo_total"] - s["cupo_disponible"]
        sectores.append({
            "sector": s["nombre"],
            "vendidas": vendidas,
            "cupo_total": s["cupo_total"],
            "ingresos": round(vendidas * s["precio"], 2),
        })
    return {
        "evento_id": evento_id,
        "nombre": evento["nombre"],
        "total_vendidas": sum(x["vendidas"] for x in sectores),
        "total_ingresos": round(sum(x["ingresos"] for x in sectores), 2),
        "sectores": sectores,
    }


# ---------- Reservas (las usa orders) ----------

@app.post("/reservas", status_code=201)
def reservar(datos: ReservaIn, usuario: dict = Depends(usuario_requerido)):
    """Reserva cupos de forma atómica: nunca se vende más que el cupo disponible."""
    with db.conexion() as conn:
        previa = conn.execute(
            "SELECT * FROM reservas WHERE orden_id = %s", (datos.orden_id,)
        ).fetchone()
        if previa:
            if previa["estado"] == "activa":
                return _detalle_reserva(conn, previa)  # repetida: no descuenta dos veces
            raise HTTPException(409, "Esa orden ya fue liberada")

        sector = conn.execute(
            "SELECT s.*, e.estado AS evento_estado FROM sectores s "
            "JOIN eventos e ON e.id = s.evento_id WHERE s.id = %s",
            (datos.sector_id,),
        ).fetchone()
        if not sector:
            raise HTTPException(404, "Sector no encontrado")
        if sector["evento_estado"] != "publicado":
            raise HTTPException(409, "El evento no está a la venta")

        # El WHERE garantiza que solo descuenta si alcanza el cupo
        actualizado = conn.execute(
            "UPDATE sectores SET cupo_disponible = cupo_disponible - %s "
            "WHERE id = %s AND cupo_disponible >= %s RETURNING id",
            (datos.cantidad, datos.sector_id, datos.cantidad),
        ).fetchone()
        if not actualizado:
            raise HTTPException(409, "Agotado")

        reserva = conn.execute(
            "INSERT INTO reservas (orden_id, sector_id, cantidad) VALUES (%s, %s, %s) RETURNING *",
            (datos.orden_id, datos.sector_id, datos.cantidad),
        ).fetchone()
        log.info(f"Reserva: orden={datos.orden_id} sector={datos.sector_id} cantidad={datos.cantidad}")
        return _detalle_reserva(conn, reserva)


@app.post("/reservas/{orden_id}/liberar")
def liberar(orden_id: str, usuario: dict = Depends(usuario_requerido)):
    """Devuelve los cupos de una orden (ej. pago rechazado). Repetirlo no suma de nuevo."""
    with db.conexion() as conn:
        reserva = conn.execute(
            "SELECT * FROM reservas WHERE orden_id = %s FOR UPDATE", (orden_id,)
        ).fetchone()
        if not reserva:
            raise HTTPException(404, "Reserva no encontrada")
        if reserva["estado"] == "activa":
            conn.execute(
                "UPDATE sectores SET cupo_disponible = cupo_disponible + %s WHERE id = %s",
                (reserva["cantidad"], reserva["sector_id"]),
            )
            conn.execute(
                "UPDATE reservas SET estado = 'liberada' WHERE orden_id = %s", (orden_id,)
            )
            log.info(f"Reserva liberada: orden={orden_id} cantidad={reserva['cantidad']}")
        return {"orden_id": orden_id, "estado": "liberada"}


def _detalle_reserva(conn, reserva: dict) -> dict:
    info = conn.execute(
        "SELECT s.nombre AS sector, s.precio, e.id AS evento_id, e.nombre AS evento, "
        "e.fecha, e.lugar FROM sectores s JOIN eventos e ON e.id = s.evento_id WHERE s.id = %s",
        (reserva["sector_id"],),
    ).fetchone()
    precio = float(info["precio"])
    return {
        "orden_id": reserva["orden_id"],
        "estado": reserva["estado"],
        "evento_id": info["evento_id"],
        "evento": info["evento"],
        "fecha": info["fecha"],
        "lugar": info["lugar"],
        "sector_id": reserva["sector_id"],
        "sector": info["sector"],
        "cantidad": reserva["cantidad"],
        "precio_unitario": precio,
        "total": round(precio * reserva["cantidad"], 2),
    }
