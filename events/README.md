# events

**Tecnología:** Python 3.10+ con FastAPI

Eventos, sectores y cupos. Reserva y libera cupos cuando orders lo pide. Nunca vende más que el cupo disponible.

## Requisitos
- Python 3.10 o superior
- PostgreSQL 16 o 17

## Base de datos
Ejecutar una sola vez como usuario `postgres` (desde la raíz del proyecto):
```bash
psql -U postgres -f events/db/init.sql
```
Crea el usuario `events_user` y la base `events_db`. Las tablas (`eventos`, `sectores`, `reservas`) las crea el servicio al iniciar.

## Variables de entorno
| Variable | Ejemplo | Descripción |
|---|---|---|
| `PORT` | `3002` | Puerto del servicio |
| `DB_HOST` | `localhost` | Servidor PostgreSQL |
| `DB_PORT` | `5432` | Puerto PostgreSQL |
| `DB_NAME` | `events_db` | Base de datos |
| `DB_USER` | `events_user` | Usuario de la BD |
| `DB_PASSWORD` | `events_pass_dev` | Contraseña de la BD |
| `JWT_SECRET` | (igual que auth) | Secreto para validar los tokens |

## Cómo ejecutar
```bash
cd events
python -m venv venv
# Windows:  venv\Scripts\activate      Linux:  source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # en Windows: copy .env.example .env  (luego editar valores)
python run.py
```
Documentación interactiva: http://localhost:3002/docs

## Endpoints
Token: `Authorization: Bearer <token>` (emitido por auth).

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| GET | `/health` | todos | Estado del servicio y de la BD |
| GET | `/eventos` | todos | Cartelera (solo publicados) |
| GET | `/eventos?mios=true` | organizador | Todos sus eventos (cualquier estado) |
| GET | `/eventos/{id}` | todos | Detalle con sectores |
| POST | `/eventos` | organizador | Crear evento (queda en `borrador`) |
| PUT | `/eventos/{id}` | organizador dueño | Editar datos del evento |
| POST | `/eventos/{id}/sectores` | organizador dueño | Agregar sector `{nombre, precio, cupo}` |
| POST | `/eventos/{id}/publicar` | organizador dueño | borrador → publicado (requiere ≥1 sector) |
| POST | `/eventos/{id}/cancelar` | organizador dueño | → cancelado |
| GET | `/eventos/{id}/resumen` | organizador dueño | Vendidas e ingresos por sector |
| POST | `/reservas` | orders | `{orden_id, sector_id, cantidad}` → reserva cupos (409 "Agotado") |
| POST | `/reservas/{orden_id}/liberar` | orders | Devuelve los cupos de esa orden |

Ejemplo de creación:
```json
{
  "nombre": "Concierto de prueba",
  "fecha": "2026-12-20T21:00:00-04:00",
  "lugar": "Estadio",
  "descripcion": "Banda local",
  "sectores": [
    { "nombre": "General", "precio": 50, "cupo": 100 },
    { "nombre": "VIP", "precio": 150, "cupo": 20 }
  ]
}
```

Reglas de reservas:
- La reserva es atómica: si no alcanza el cupo responde `409 Agotado` y no descuenta nada.
- Repetir la misma `orden_id` no descuenta dos veces. Liberar dos veces no suma dos veces.

## Health check
`GET /health`
