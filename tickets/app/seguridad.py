"""Validación del JWT de auth (clientes) y de la clave interna (orders, checkin)."""
import hmac

import jwt
from fastapi import Header, HTTPException

from .config import INTERNAL_TOKEN, JWT_SECRET


def usuario_requerido(authorization: str | None = Header(default=None)) -> dict:
    if not authorization:
        raise HTTPException(401, "Falta el token")
    tipo, _, token = authorization.partition(" ")
    if tipo != "Bearer" or not token:
        raise HTTPException(401, "Formato de token inválido")
    try:
        datos = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Token inválido o vencido")
    return {"id": int(datos["sub"]), "rol": datos["rol"]}


def solo_interno(x_internal_token: str | None = Header(default=None)) -> None:
    if not x_internal_token or not hmac.compare_digest(x_internal_token, INTERNAL_TOKEN):
        raise HTTPException(401, "Servicio interno: falta o es incorrecta la clave X-Internal-Token")
