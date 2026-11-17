# Bitácora del proyecto

Problemas de instalación, versiones y despliegue encontrados durante el desarrollo de EntradasYa v1, y cómo se resolvieron.

## Desarrollo local (Windows 10)

| Fecha | Integrante | Problema | Solución |
|---|---|---|---|
| 17/11/2026 | Carlo Gabriel Romero | Después de instalar PostgreSQL 17, el comando `psql --version` da error en PowerShell: *"El término 'psql' no se reconoce como nombre de un cmdlet..."* | El instalador no agrega PostgreSQL al PATH. Se agregó `C:\Program Files\PostgreSQL\17\bin` a la variable PATH del usuario y se reabrió VS Code. |
| 17/11/2026 | Carlo Gabriel Romero | Al entrar con `psql -U postgres` aparece: *"WARNING: Console code page (850) differs from Windows code page (1252)"*. | Es solo un aviso de la consola de Windows: algunas tildes pueden verse mal en psql. No afecta a las bases de datos, así que se ignoró. |
| 17/11/2026 | Carlo Gabriel Romero | events (Python) rechazaba el token emitido por auth (Node.js) con *"Token inválido o vencido"*, aunque el secreto JWT era el mismo. | La librería PyJWT 2.10 exige que el campo `sub` del token sea texto y auth lo enviaba como número. Se cambió auth para emitir `sub` como texto (`"1"` en lugar de `1`), que es lo que indica el estándar JWT. Se actualizó el acuerdo del token. |
| 17/11/2026 | Carlo Gabriel Romero | Después de cambiar el código de auth, el servicio seguía respondiendo con el comportamiento anterior. | El servidor iniciado con `npm start` carga el código una sola vez. Hay que detenerlo (Ctrl + C) y volver a iniciarlo. Para desarrollar se usa `npm run dev`, que se reinicia solo con cada cambio. |
| 17/11/2026 | Carlo Gabriel Romero | `go version` da error: el comando no se reconoce. | Go no estaba instalado. Se instaló Go 1.27 (`winget install --id GoLang.Go -e`) y se reabrió VS Code. |
| 17/11/2026 | Carlo Gabriel Romero | Al preparar payments, `go mod tidy` subió la versión mínima del proyecto a Go 1.25. | La librería pgx v5 (conexión a PostgreSQL) exige Go 1.25 o superior. Se dejó así y se indicó en los README de payments y checkin. En Ubuntu habrá que instalar Go desde go.dev, porque el paquete de `apt` puede ser más antiguo. |
| 17/11/2026 | Carlo Gabriel Romero | Mailpit no estaba instalado y el comando `mailpit` no se reconocía después de instalarlo. | Se instaló con `winget install --id axllent.mailpit -e`. winget modifica el PATH, así que hay que reabrir VS Code para que lo reconozca. |
| 17/11/2026 | Carlo Gabriel Romero | orders necesitaba el correo del cliente para enviar la confirmación, pero el token solo traía id y rol, y el documento no permite que orders llame a auth. | Se agregaron `correo` y `nombre` al token que emite auth. orders los lee del token sin llamar a otro servicio. |
| 17/11/2026 | Carlo Gabriel Romero | `dotnet --version` dice *"No .NET SDKs were found"*, aunque .NET aparecía instalado. | En la PC solo estaba el *runtime* (sirve para ejecutar) y no el *SDK* (sirve para compilar). Se instaló el SDK con `winget install --id Microsoft.DotNet.SDK.8 -e` (versión 8.0.428). |
| 17/11/2026 | Carlo Gabriel Romero | En el correo de confirmación, el botón "Ver y descargar mis entradas" no abría nada. | El enlace usa la variable `WEB_URL` de notifications, que apuntaba a `http://localhost` (donde estará Nginx). En desarrollo la web corre en `http://localhost:5173`, así que se cambió `WEB_URL` en el `.env` local. En el servidor se usará la dirección real. |

## Despliegue en Ubuntu (Azure)

| Fecha | Integrante | Problema | Solución |
|---|---|---|---|
| | | | |
