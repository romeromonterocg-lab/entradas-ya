# orders

**Tecnología:** .NET 8 (ASP.NET Core Minimal API + Npgsql)

Gestiona las compras y coordina a los demás servicios: **events → payments → tickets → notifications**.

- Máximo 6 entradas por compra.
- Estados: `pendiente`, `pagada`, `rechazada`, `cancelada`.
- Sin cupo → orden `cancelada` con motivo "Agotado".
- Pago rechazado → libera los cupos en events y la orden queda `rechazada`.
- Si el correo falla, la compra sigue siendo válida (`correo_enviado: false`).
- El cliente ve el historial de sus compras.

## Requisitos
- .NET 8 SDK (https://dotnet.microsoft.com/download/dotnet/8.0)
  - Windows: `winget install --id Microsoft.DotNet.SDK.8 -e`
- PostgreSQL 16 o 17
- events, payments, tickets y notifications en ejecución

## Base de datos
Ejecutar una sola vez como usuario `postgres` (desde la raíz del proyecto):
```bash
psql -U postgres -f orders/db/init.sql
```
Crea el usuario `orders_user` y la base `orders_db`. La tabla `ordenes` la crea el servicio al iniciar.

## Variables de entorno
| Variable | Ejemplo | Descripción |
|---|---|---|
| `PORT` | `3006` | Puerto del servicio |
| `DB_HOST` | `localhost` | Servidor PostgreSQL |
| `DB_PORT` | `5432` | Puerto PostgreSQL |
| `DB_NAME` | `orders_db` | Base de datos |
| `DB_USER` | `orders_user` | Usuario de la BD |
| `DB_PASSWORD` | `orders_pass_dev` | Contraseña de la BD |
| `JWT_SECRET` | (igual que auth) | Para validar el token del cliente |
| `INTERNAL_TOKEN` | (igual que los servicios internos) | Se envía en `X-Internal-Token` |
| `EVENTS_URL` | `http://localhost:3002` | Dirección de events |
| `PAYMENTS_URL` | `http://localhost:3003` | Dirección de payments |
| `TICKETS_URL` | `http://localhost:3004` | Dirección de tickets |
| `NOTIFICATIONS_URL` | `http://localhost:3005` | Dirección de notifications |
| `HTTP_TIMEOUT_MS` | `5000` | Tiempo máximo de cada llamada a otro servicio |

## Cómo ejecutar
```bash
cd orders
cp .env.example .env      # en Windows: copy .env.example .env  (luego editar valores)
dotnet run
```
Para publicar un ejecutable: `dotnet publish -c Release -o out` y luego `dotnet out/orders.dll`.

## Endpoints
Todas (menos `/health`) requieren `Authorization: Bearer <token>` de un cliente.

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/health` | — | `{ status, servicio, db }` (503 si no hay BD) |
| POST | `/ordenes` | `{ sector_id, cantidad, tarjeta }` | 201 orden `pagada` con sus `entradas` |
| GET | `/ordenes` | — | Historial de compras del cliente |
| GET | `/ordenes/{id}` | — | Detalle de una orden propia |

Respuestas de error de `POST /ordenes` (siempre incluyen la `orden` creada):
| Código | Cuándo |
|---|---|
| 400 | Cantidad fuera de 1–6 o datos inválidos |
| 402 | Pago rechazado (tarjeta terminada en 0000). Cupos liberados |
| 403 | El usuario no es cliente |
| 404 | Sector inexistente |
| 409 | "Agotado" o evento no está a la venta |
| 503 | Algún servicio no respondió a tiempo |

## Health check
`GET /health`
