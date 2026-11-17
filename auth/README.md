# auth

**Tecnología:** Node.js 20 + Express

Registro, login y emisión de JWT (id + rol). Roles: `cliente`, `organizador`, `portero`.
Las contraseñas se guardan cifradas con bcrypt.

## Requisitos
- Node.js 20 o superior
- PostgreSQL 16 o 17

## Base de datos
Ejecutar una sola vez como usuario `postgres`:
```bash
psql -U postgres -f db/init.sql
```
Esto crea el usuario `auth_user` y la base `auth_db`. La tabla `usuarios` la crea el servicio al iniciar.

## Variables de entorno
| Variable | Ejemplo | Descripción |
|---|---|---|
| `PORT` | `3001` | Puerto del servicio |
| `DB_HOST` | `localhost` | Servidor PostgreSQL |
| `DB_PORT` | `5432` | Puerto PostgreSQL |
| `DB_NAME` | `auth_db` | Base de datos |
| `DB_USER` | `auth_user` | Usuario de la BD |
| `DB_PASSWORD` | `auth_pass_dev` | Contraseña de la BD |
| `JWT_SECRET` | `un_secreto_largo` | Secreto para firmar tokens (igual en todos los servicios) |
| `JWT_EXPIRES_IN` | `8h` | Duración del token |

## Cómo ejecutar
```bash
cd auth
cp .env.example .env     # en Windows: copy .env.example .env  (luego editar valores)
npm install
npm start
```

## Endpoints
| Método | Ruta | Body / Header | Respuesta |
|---|---|---|---|
| GET | `/health` | — | `{ status, servicio, db }` (503 si no hay BD) |
| POST | `/register` | `{ nombre, correo, password }` | 201 usuario creado con rol `cliente` (409 si el correo existe) |
| POST | `/login` | `{ correo, password }` | `{ token, usuario }` (401 si falla) |
| GET | `/me` | `Authorization: Bearer <token>` | datos del usuario |

## Crear organizadores y porteros
El registro público solo crea clientes. Los demás roles se crean desde la terminal:
```bash
npm run crear-usuario -- "Ana Organizadora" ana@test.com 123456 organizador
npm run crear-usuario -- "Pedro Portero" pedro@test.com 123456 portero
```

## Token (contrato con los demás servicios)
- Algoritmo HS256, firmado con `JWT_SECRET`.
- Payload: `{ "sub": "<id como texto>", "rol": "cliente" | "organizador" | "portero", "correo", "nombre", "iat", "exp" }`.
- `correo` y `nombre` van en el token para que orders pueda enviar el correo de confirmación sin llamar a auth.
- Los demás servicios lo validan por su cuenta con el mismo `JWT_SECRET`.

## Health check
`GET /health`
