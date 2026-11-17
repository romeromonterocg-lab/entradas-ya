"""Conexión a PostgreSQL y creación de tablas."""
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from .config import DB_DSN


@contextmanager
def conexion():
    """Abre una conexión, hace commit si todo sale bien y rollback si hay error."""
    with psycopg.connect(DB_DSN, row_factory=dict_row) as conn:
        yield conn


def inicializar():
    with conexion() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS eventos (
                id              SERIAL PRIMARY KEY,
                organizador_id  INTEGER      NOT NULL,
                nombre          VARCHAR(150) NOT NULL,
                fecha           TIMESTAMPTZ  NOT NULL,
                lugar           VARCHAR(150) NOT NULL,
                imagen_url      VARCHAR(500),
                descripcion     TEXT,
                estado          VARCHAR(20)  NOT NULL DEFAULT 'borrador'
                                CHECK (estado IN ('borrador', 'publicado', 'cancelado')),
                creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sectores (
                id               SERIAL PRIMARY KEY,
                evento_id        INTEGER       NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
                nombre           VARCHAR(50)   NOT NULL,
                precio           NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
                cupo_total       INTEGER       NOT NULL CHECK (cupo_total > 0),
                cupo_disponible  INTEGER       NOT NULL CHECK (cupo_disponible >= 0),
                CHECK (cupo_disponible <= cupo_total)
            )
        """)
        # Una reserva por orden: permite liberar sin duplicar (idempotente)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reservas (
                orden_id    VARCHAR(64) PRIMARY KEY,
                sector_id   INTEGER     NOT NULL REFERENCES sectores(id),
                cantidad    INTEGER     NOT NULL CHECK (cantidad > 0),
                estado      VARCHAR(20) NOT NULL DEFAULT 'activa'
                            CHECK (estado IN ('activa', 'liberada')),
                creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
