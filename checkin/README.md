# checkin

**Tecnología:** Go 1.25+ (net/http + pgx + golang-jwt)

Controla el ingreso a los eventos. Recibe el código escaneado por el portero y el evento donde trabaja,
pide a **tickets** que lo valide y registra el ingreso (fecha, hora y portero).

Rechaza el ingreso indicando el motivo:
- **Código inválido** (no existe)
- **Entrada de otro evento**
- **Entrada ya utilizada** (con la hora del primer ingreso)

## Requisitos
- Go 1.25 o superior (https://go.dev/dl/)
- PostgreSQL 16 o 17
- tickets en ejecución

## Base de datos
Ejecutar una sola vez como usuario `postgres` (desde la raíz del proyecto):
```bash
psql -U postgres -f checkin/db/init.sql
```
Crea el usuario `checkin_user` y la base `checkin_db`. La tabla `ingresos` la crea el servicio al iniciar.

## Variables de entorno
| Variable | Ejemplo | Descripción |
|---|---|---|
| `PORT` | `3007` | Puerto del servicio |
| `DB_HOST` | `localhost` | Servidor PostgreSQL |
| `DB_PORT` | `5432` | Puerto PostgreSQL |
| `DB_NAME` | `checkin_db` | Base de datos |
| `DB_USER` | `checkin_user` | Usuario de la BD |
| `DB_PASSWORD` | `checkin_pass_dev` | Contraseña de la BD |
| `JWT_SECRET` | (igual que auth) | Para validar el token del portero |
| `INTERNAL_TOKEN` | (igual que tickets) | Se envía a tickets en `X-Internal-Token` |
| `TICKETS_URL` | `http://localhost:3004` | Dirección de tickets |
| `HTTP_TIMEOUT_MS` | `5000` | Tiempo máximo de la llamada a tickets |

## Cómo ejecutar
```bash
cd checkin
cp .env.example .env      # en Windows: copy .env.example .env  (luego editar valores)
go run .
```
Para compilar: `go build -o checkin .` (en Windows genera `checkin.exe`).

## Endpoints
Requieren `Authorization: Bearer <token>`.

| Método | Ruta | Quién | Body / Respuesta |
|---|---|---|---|
| GET | `/health` | todos | `{ status, servicio, db }` |
| POST | `/ingresos` | portero | `{ codigo, evento_id }` → `{ permitido, motivo?, codigo, evento, sector, fecha_hora?, primer_ingreso? }` |
| GET | `/eventos/{id}/ingresos` | portero, organizador | `{ evento_id, ingresos, ultimo_ingreso }` |

`POST /ingresos` responde **200** tanto si se permite como si se rechaza (`permitido: false` + `motivo`),
para que la pantalla del portero lo muestre claramente. Responde 503 si tickets no está disponible.

## Health check
`GET /health`
