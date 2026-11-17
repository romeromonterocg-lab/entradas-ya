# EntradasYa v1

Plataforma de venta de entradas para eventos. Proyecto de la materia **Contenedores**.

## Servicios

| Carpeta | Tecnología | Descripción |
|---|---|---|
| [web](web/) | React + Vite | Interfaz para los 3 roles |
| [auth](auth/) | Node.js | Usuarios y JWT |
| [events](events/) | Python FastAPI | Eventos, sectores y cupos |
| [orders](orders/) | .NET 8 | Orquesta la compra |
| [payments](payments/) | Go | Pago simulado (interno) |
| [tickets](tickets/) | Python | PDF + QR y validación |
| [notifications](notifications/) | Node.js | Correos a Mailpit (interno) |
| [checkin](checkin/) | Go | Ingreso al evento |

Infraestructura: Nginx, PostgreSQL (una BD por servicio), Mailpit, carpeta local para PDFs.

## Cómo trabajar en equipo

```bash
git clone https://github.com/romeromonterocg-lab/entradas-ya.git
git pull          # descargar avances
git add . && git commit -m "servicio: cambio" && git push
```

Problemas encontrados: ver [docs/bitacora.md](docs/bitacora.md).
