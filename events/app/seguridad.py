"""Validación local del JWT emitido por auth (sin llamar a auth)."""
import jwt
from fastapi import Depends, Header, HTTPException

from .config import JWT_SECRET


def usuario_opcional(authorization: str | None = Header(default=None)) -> dict | None:
    if not authorization:
        return None
    tipo, _, token = authorization.partition(" ")
    if tipo != "Bearer" or not token:
        raise HTTPException(401, "Formato de token inválido")
    try:
        datos = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Token inválido o vencido")
    return {"id": int(datos["sub"]), "rol": datos["rol"]}


def usuario_requerido(usuario: dict | None = Depends(usuario_opcional)) -> dict:
    if usuario is None:
        raise HTTPException(401, "Falta el token")
    return usuario


def organizador(usuario: dict = Depends(usuario_requerido)) -> dict:
    if usuario["rol"] != "organizador":
        raise HTTPException(403, "Solo un organizador puede hacer esto")
    return usuario
