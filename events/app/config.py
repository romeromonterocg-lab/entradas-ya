"""Toda la configuración sale de variables de entorno (requerimiento 8.1)."""
import os
import sys

from dotenv import load_dotenv

load_dotenv()

_requeridas = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET"]
_faltan = [v for v in _requeridas if not os.getenv(v)]
if _faltan:
    print(f"[ERROR] Faltan variables de entorno: {', '.join(_faltan)}", file=sys.stderr)
    sys.exit(1)

PORT = int(os.getenv("PORT", "3002"))
DB_DSN = (
    f"host={os.getenv('DB_HOST')} port={os.getenv('DB_PORT', '5432')} "
    f"dbname={os.getenv('DB_NAME')} user={os.getenv('DB_USER')} "
    f"password={os.getenv('DB_PASSWORD')} connect_timeout=3"
)
JWT_SECRET = os.getenv("JWT_SECRET")
