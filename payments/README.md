# payments

**Tecnología:** Go 1.25+ (net/http + pgx)

Pasarela de pago **simulada** (no usa dinero real). Servicio **interno**: solo orders puede llamarlo.

- Regla fija: tarjeta terminada en **0000** → `rechazado`. Cualquier otra → `aprobado`.
- No cobra dos veces la misma orden: si llega repetida, devuelve la transacción original.
- Registra cada transacción con monto, fecha y resultado. De la tarjeta solo guarda los últimos 4 dígitos.

## Requisitos
- Go 1.25 o superior (https://go.dev/dl/)
- PostgreSQL 16 o 17

## Base de datos
Ejecutar una sola vez como usuario `postgres` (desde la raíz del proyecto):
```bash
psql -U postgres -f payments/db/init.sql
```
Crea el usuario `payments_user` y la base `payments_db`. La tabla `transacciones` la crea el servicio al iniciar.

## Variables de entorno
| Variable | Ejemplo | Descripción |
|---|---|---|
| `PORT` | `3003` | Puerto del servicio |
| `DB_HOST` | `localhost` | Servidor PostgreSQL |
| `DB_PORT` | `5432` | Puerto PostgreSQL |
| `DB_NAME` | `payments_db` | Base de datos |
| `DB_USER` | `payments_user` | Usuario de la BD |
| `DB_PASSWORD` | `payments_pass_dev` | Contraseña de la BD |
| `INTERNAL_TOKEN` | `clave_interna` | Clave que orders envía en `X-Internal-Token` (mismo valor en orders) |

## Cómo ejecutar
```bash
cd payments
cp .env.example .env      # en Windows: copy .env.example .env  (luego editar valores)
go run .
```
Para compilar un ejecutable: `go build -o payments .` (en Windows genera `payments.exe`).

## Endpoints
Todas las rutas de `/pagos` exigen el header `X-Internal-Token: <INTERNAL_TOKEN>`.

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/health` | — | `{ status, servicio, db }` (503 si no hay BD) |
| POST | `/pagos` | `{ orden_id, monto, tarjeta }` | 201 transacción nueva / 200 si la orden ya se cobró |
| GET | `/pagos/{orden_id}` | — | transacción de esa orden (404 si no existe) |

Ejemplo de respuesta:
```json
{
  "id": 1, "orden_id": "abc-123", "monto": 300, "tarjeta": "4242",
  "resultado": "aprobado", "motivo": null, "creado_en": "2026-11-17T10:00:00Z"
}
```
Tarjetas de prueba: `4242424242424242` (aprobada), `4111111111110000` (rechazada).

## Health check
`GET /health`
