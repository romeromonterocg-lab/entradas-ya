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
            CREATE TABLE IF NOT EXISTS entradas (
                id          SERIAL PRIMARY KEY,
                codigo      VARCHAR(32)   NOT NULL UNIQUE,
                orden_id    VARCHAR(64)   NOT NULL,
                usuario_id  INTEGER       NOT NULL,
                evento_id   INTEGER       NOT NULL,
                evento      VARCHAR(150)  NOT NULL,
                fecha       TIMESTAMPTZ   NOT NULL,
                lugar       VARCHAR(150)  NOT NULL,
                sector      VARCHAR(50)   NOT NULL,
                precio      NUMERIC(10,2) NOT NULL,
                numero      INTEGER       NOT NULL,  -- 1..N dentro de la orden
                estado      VARCHAR(20)   NOT NULL DEFAULT 'valida'
                            CHECK (estado IN ('valida', 'anulada')),
                pdf         VARCHAR(255)  NOT NULL,
                creado_en   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
                UNIQUE (orden_id, numero)
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_entradas_usuario ON entradas (usuario_id)")
