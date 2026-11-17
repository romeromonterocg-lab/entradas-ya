# web

**Tecnología:** React 18 + Vite 5 (react-router, html5-qrcode)

Interfaz única para los tres roles. No guarda datos: todo lo pide a los servicios a través de `/api` (Nginx).

| Rol | Pantallas |
|---|---|
| Cliente | Registro, login, cartelera, detalle del evento, compra, mis compras, mis entradas (descarga PDF) |
| Organizador | Mis eventos, crear/editar evento, agregar sectores, publicar/cancelar, ventas e ingresos |
| Portero | Elegir evento, escanear QR con la cámara o escribir el código, resultado verde/rojo, contador |

## Rutas de la API (las mismas que usará Nginx)
| Prefijo | Servicio |
|---|---|
| `/api/auth/` | auth (3001) |
| `/api/events/` | events (3002) |
| `/api/tickets/` | tickets (3004) |
| `/api/orders/` | orders (3006) |
| `/api/checkin/` | checkin (3007) |

payments y notifications **no** se exponen.

## Requisitos
- Node.js 20 o superior
- Los servicios del backend en ejecución

## Variables de entorno
| Variable | Ejemplo | Descripción |
|---|---|---|
| `VITE_API_URL` | `/api` | Prefijo de la API (se fija al compilar) |
| `DEV_AUTH_URL` | `http://localhost:3001` | Solo desarrollo: proxy hacia auth |
| `DEV_EVENTS_URL` | `http://localhost:3002` | Solo desarrollo: proxy hacia events |
| `DEV_TICKETS_URL` | `http://localhost:3004` | Solo desarrollo: proxy hacia tickets |
| `DEV_ORDERS_URL` | `http://localhost:3006` | Solo desarrollo: proxy hacia orders |
| `DEV_CHECKIN_URL` | `http://localhost:3007` | Solo desarrollo: proxy hacia checkin |

## Cómo ejecutar
Desarrollo (Vite hace de proxy, como Nginx):
```bash
cd web
cp .env.example .env      # en Windows: copy .env.example .env
npm install
npm run dev               # http://localhost:5173
```

Producción (archivos estáticos que sirve Nginx):
```bash
npm run build             # genera la carpeta dist/
```

La cámara del portero solo funciona en `localhost` o con HTTPS (regla del navegador).

## Health check
`GET /health.json` → `{ "status": "ok", "servicio": "web" }`
