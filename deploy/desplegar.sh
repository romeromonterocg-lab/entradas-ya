#!/usr/bin/env bash
# Compila e instala la última versión de los 8 servicios y los reinicia.
# Lo usa el pipeline en cada cambio de main, y también se puede correr a mano:
#   bash deploy/desplegar.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$PATH:/usr/local/go/bin"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $*"; }

log "Node: auth y notifications"
for s in auth notifications; do
  (cd "$RAIZ/$s" && npm ci --omit=dev --no-audit --no-fund)
done

log "Python: events y tickets"
for s in events tickets; do
  (cd "$RAIZ/$s" && { [ -d venv ] || python3 -m venv venv; } && venv/bin/pip install -q -r requirements.txt)
done
mkdir -p "$RAIZ/tickets/storage"

log "Go: payments y checkin"
for s in payments checkin; do
  (cd "$RAIZ/$s" && go build -o "bin/$s" .)
done

log ".NET: orders"
(cd "$RAIZ/orders" && dotnet publish -c Release -o bin/publicado --nologo -v q)

log "Web: build de React"
(cd "$RAIZ/web" && npm ci --no-audit --no-fund && npm run build)
sudo mkdir -p /var/www/entradasya
sudo rsync -a --delete "$RAIZ/web/dist/" /var/www/entradasya/

log "Reiniciando servicios"
for s in auth events payments tickets notifications orders checkin; do
  sudo systemctl restart "entradasya-$s"
done
sudo systemctl reload nginx

log "Verificando /health"
sleep 5
fallos=0
for p in auth:3001 events:3002 payments:3003 tickets:3004 notifications:3005 orders:3006 checkin:3007; do
  if curl -fsS -m 5 "http://localhost:${p#*:}/health" > /dev/null; then
    log "${p%%:*} OK"
  else
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] ${p%%:*} no responde /health"; fallos=1
  fi
done
exit $fallos
