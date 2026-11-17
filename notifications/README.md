# notifications

**Tecnología:** Node.js 20 + Express + Nodemailer

Envía los correos del sistema por SMTP. En la v1 van a **Mailpit**, que los muestra en una web sin enviarlos de verdad.
Servicio **interno**: solo orders lo llama. No usa base de datos, solo deja registro en sus logs.

## Requisitos
- Node.js 20 o superior
- Mailpit (https://mailpit.axllent.org)
  - Windows: `winget install --id axllent.mailpit -e`
  - Ubuntu: `sudo bash < <(curl -sL https://raw.githubusercontent.com/axllent/mailpit/develop/install.sh)`

## Iniciar Mailpit
```bash
mailpit
```
- SMTP en el puerto **1025** (aquí envía notifications)
- Web en **http://localhost:8025** (aquí se ven los correos)

## Variables de entorno
| Variable | Ejemplo | Descripción |
|---|---|---|
| `PORT` | `3005` | Puerto del servicio |
| `SMTP_HOST` | `localhost` | Servidor SMTP (Mailpit) |
| `SMTP_PORT` | `1025` | Puerto SMTP de Mailpit |
| `SMTP_TIMEOUT_MS` | `5000` | Tiempo máximo para hablar con el SMTP |
| `MAIL_FROM` | `"EntradasYa <no-reply@entradasya.local>"` | Remitente |
| `WEB_URL` | `http://localhost` | Base del enlace "ver mis entradas" |
| `INTERNAL_TOKEN` | (igual que los demás servicios) | Clave que orders envía en `X-Internal-Token` |

## Cómo ejecutar
```bash
cd notifications
cp .env.example .env     # en Windows: copy .env.example .env  (luego editar valores)
npm install
npm start
```

## Endpoints
Las rutas `/notificaciones/*` exigen el header `X-Internal-Token`.

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/health` | — | `{ status, servicio, smtp }` (503 si no llega a Mailpit) |
| POST | `/notificaciones/compra` | ver abajo | 202 enviado / 502 si falló el SMTP |
| POST | `/notificaciones/bienvenida` | `{ correo, nombre }` | 202 enviado / 502 si falló el SMTP |

Body de `/notificaciones/compra`:
```json
{
  "correo": "cliente@test.com", "nombre": "Cliente", "orden_id": "abc-123",
  "evento": "Concierto de prueba", "fecha": "2026-12-20T21:00:00-04:00",
  "lugar": "Estadio", "sector": "VIP", "cantidad": 2, "total": 300,
  "entradas": ["EY-PW6U-V2BD", "EY-D6P9-ZNWZ"]
}
```

Si el correo falla, orders igual da la compra por válida (requisito del proyecto).

## Health check
`GET /health`
