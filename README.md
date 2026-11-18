# EntradasYa v1

Plataforma de venta de entradas para eventos. Proyecto de la materia **Contenedores**.

En la v1 **no se usan contenedores**: los 8 servicios se instalan a mano en un servidor Ubuntu.

## Servicios

| Carpeta | Tecnología | Puerto | Base de datos | Descripción |
|---|---|---|---|---|
| [web](web/) | React + Vite | 5173 (desarrollo) | — | Interfaz para cliente, organizador y portero |
| [auth](auth/) | Node.js (Express) | 3001 | auth_db | Registro, login y JWT |
| [events](events/) | Python FastAPI | 3002 | events_db | Eventos, sectores y cupos |
| [payments](payments/) | Go | 3003 | payments_db | Pago simulado (**interno**) |
| [tickets](tickets/) | Python FastAPI | 3004 | tickets_db + carpeta de PDFs | Entradas en PDF con QR y validación |
| [notifications](notifications/) | Node.js | 3005 | — (solo logs) | Correos a Mailpit (**interno**) |
| [orders](orders/) | .NET 8 | 3006 | orders_db | Orquesta la compra |
| [checkin](checkin/) | Go | 3007 | checkin_db | Ingreso al evento |

Cada servicio tiene su propio README con requisitos, variables de entorno y pasos para ejecutarlo.

## Cómo se conecta todo

```
Navegador ──► Nginx (puerto 80) ──► /            → web (archivos de React)
                                 ├─► /api/auth/   → auth
                                 ├─► /api/events/ → events
                                 ├─► /api/orders/ → orders ──► events, payments, tickets, notifications
                                 ├─► /api/tickets/→ tickets
                                 ├─► /api/checkin/→ checkin ──► tickets
                                 └─► /mailpit/    → Mailpit (correos de prueba)
```

- **payments** y **notifications** no se exponen: solo los llama orders desde dentro del servidor.
- Comunicación solo por **HTTP + JSON**, con timeout en cada llamada.
- Login con **JWT** (emitido por auth; los demás lo validan con el mismo `JWT_SECRET`).
- Llamadas internas con el header `X-Internal-Token` (`INTERNAL_TOKEN`).
- Cada servicio tiene `GET /health` y escribe logs con fecha, nivel y mensaje.

## Desarrollo local (Windows)

Requisitos: PostgreSQL, Node.js 20+, Python 3.12, Go 1.25+, .NET 8 SDK y Mailpit.

1. Crear la base de datos de cada servicio con su `db/init.sql` (`psql -U postgres -f auth/db/init.sql`, etc.).
2. En cada servicio, copiar `.env.example` como `.env` y completarlo.
3. Iniciar cada servicio según su README y abrir **http://localhost:5173**.

## Despliegue en el servidor Ubuntu

Servidor: máquina virtual de **VirtualBox** con **Ubuntu Server 24.04 LTS** (4 GB de RAM, 2 CPU, 25 GB de disco).
Red NAT con reenvío de puertos: `127.0.0.1:2222 → 22` (SSH) y `127.0.0.1:8088 → 80` (web).
La plataforma se abre en **http://localhost:8088** y los correos en **http://localhost:8088/mailpit/**.
(Antes estuvo en AWS EC2; los mismos scripts sirven para cualquier Ubuntu.) Los scripts están en [deploy/](deploy/).

1. **Programas** (una vez): `git`, `postgresql`, `nginx`, Node.js 22, `python3-venv`, `dotnet-sdk-8.0`, Go (desde go.dev) y Mailpit.
2. **Código**: `git clone git@github.com:romeromonterocg-lab/entradas-ya.git` (con una Deploy key de solo lectura).
3. **Bases de datos y `.env`** (una vez; genera contraseñas y secretos al azar dentro del servidor):
   ```bash
   bash deploy/configurar-bd-y-env.sh <IP_PUBLICA>
   ```
4. **Servicios en systemd + Nginx + primer despliegue** (una vez):
   ```bash
   bash deploy/instalar-servicios.sh
   ```
5. **Actualizar** después de cada cambio (compila todo, reinicia y revisa `/health`):
   ```bash
   bash deploy/desplegar.sh
   ```

Los servicios se llaman `entradasya-<servicio>` en systemd y arrancan solos al encender el servidor.
Ver logs: `journalctl -u entradasya-orders -f`.

Si la IP pública cambia (al detener y encender la instancia), volver a ejecutar el paso 3 con la nueva IP.

## Pipeline (GitHub Actions)

Cada `git push` a `main` actualiza el servidor solo. El pipeline está en
[.github/workflows/desplegar.yml](.github/workflows/desplegar.yml) y corre en un
**self-hosted runner** instalado dentro del servidor Ubuntu (servicio de systemd `actions.runner.*`).

1. GitHub detecta el cambio en `main` y le pasa el trabajo al runner.
2. El runner trae la última versión (`git fetch` + `git reset --hard origin/main`).
3. Ejecuta `deploy/desplegar.sh`: compila, reinicia los servicios y revisa `/health`.
4. El resultado (✅ o ❌) se ve en la pestaña **Actions** del repositorio.

Instalación del runner (una vez): GitHub → Settings → Actions → Runners → *New self-hosted runner* (Linux x64),
ejecutar los comandos de *Download* y *Configure*, y luego `sudo ./svc.sh install && sudo ./svc.sh start`.
El usuario del servidor tiene permiso `sudo` sin contraseña **solo** para los comandos del despliegue
(`/etc/sudoers.d/entradasya`).

## Cómo trabajar en equipo

```bash
git clone https://github.com/romeromonterocg-lab/entradas-ya.git
git pull          # descargar avances
git add . && git commit -m "servicio: cambio" && git push
```

Problemas encontrados y cómo se resolvieron: ver [docs/bitacora.md](docs/bitacora.md).
