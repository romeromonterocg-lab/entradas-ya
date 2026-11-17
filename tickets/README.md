# tickets

**Tecnología:** Python 3.10+ con FastAPI, ReportLab (PDF) y qrcode

Genera una entrada por cada asiento comprado, con código único (ej. `EY-K7PM-3XQ9`) y un PDF con QR.
Guarda los PDF en una carpeta local. Permite al cliente descargarlas y a checkin validar códigos.

## Requisitos
- Python 3.10 o superior
- PostgreSQL 16 o 17

## Base de datos
Ejecutar una sola vez como usuario `postgres` (desde la raíz del proyecto):
```bash
psql -U postgres -f tickets/db/init.sql
```
Crea el usuario `tickets_user` y la base `tickets_db`. La tabla `entradas` la crea el servicio al iniciar.

## Variables de entorno
| Variable | Ejemplo | Descripción |
|---|---|---|
| `PORT` | `3004` | Puerto del servicio |
| `DB_HOST` | `localhost` | Servidor PostgreSQL |
| `DB_PORT` | `5432` | Puerto PostgreSQL |
| `DB_NAME` | `tickets_db` | Base de datos |
| `DB_USER` | `tickets_user` | Usuario de la BD |
| `DB_PASSWORD` | `tickets_pass_dev` | Contraseña de la BD |
| `JWT_SECRET` | (igual que auth) | Para validar el token de los clientes |
| `INTERNAL_TOKEN` | (igual que payments/orders/checkin) | Clave de las llamadas internas |
| `PDF_DIR` | `./storage` | Carpeta donde se guardan los PDF (se crea sola) |

## Cómo ejecutar
```bash
cd tickets
python -m venv venv
# Windows:  venv\Scripts\activate      Linux:  source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # en Windows: copy .env.example .env  (luego editar valores)
python run.py
```
Documentación interactiva: http://localhost:3004/docs

## Endpoints
| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| GET | `/health` | todos | Estado del servicio, la BD y la carpeta de PDFs |
| POST | `/entradas` | orders (`X-Internal-Token`) | Emite N entradas + PDFs. Repetir la orden devuelve las mismas |
| GET | `/validar/{codigo}` | checkin (`X-Internal-Token`) | `{ existe, evento_id, valida, motivo }` |
| GET | `/entradas/mias` | cliente (`Bearer`) | Entradas del usuario del token |
| GET | `/entradas/{codigo}/pdf` | cliente dueño (`Bearer`) | Descarga el PDF |

Body de `POST /entradas` (lo arma orders con los datos que devuelve la reserva de events):
```json
{
  "orden_id": "abc-123", "usuario_id": 1, "evento_id": 1,
  "evento": "Concierto de prueba", "fecha": "2026-12-20T21:00:00-04:00",
  "lugar": "Estadio", "sector": "VIP", "precio_unitario": 150, "cantidad": 2
}
```

Nota: tickets dice si un código **existe y es válido**. Si ya se usó lo controla **checkin** (es quien registra los ingresos).

## Health check
`GET /health`
