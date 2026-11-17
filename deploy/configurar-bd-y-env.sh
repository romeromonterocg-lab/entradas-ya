#!/usr/bin/env bash
# Configuración inicial del servidor Ubuntu (se ejecuta UNA sola vez).
# - Crea un usuario y una base de datos por servicio en PostgreSQL, con contraseñas al azar.
# - Escribe el archivo .env de cada servicio (los secretos NUNCA se suben a GitHub).
#
# Uso (desde la carpeta del proyecto):   bash deploy/configurar-bd-y-env.sh <IP_PUBLICA>
# Ejemplo:                                bash deploy/configurar-bd-y-env.sh 18.227.61.63
set -euo pipefail

IP="${1:?Falta la IP pública. Uso: bash deploy/configurar-bd-y-env.sh <IP_PUBLICA>}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
SECRETOS="$HOME/.entradasya-secretos"

azar() { openssl rand -hex "${1:-24}"; }

# Los secretos compartidos se guardan en un archivo del servidor para poder reutilizarlos
if [ -f "$SECRETOS" ]; then
  echo ">> Usando secretos existentes de $SECRETOS"
  # shellcheck disable=SC1090
  source "$SECRETOS"
else
  JWT_SECRET="$(azar 32)"
  INTERNAL_TOKEN="$(azar 24)"
  for s in auth events orders payments tickets checkin; do
    declare "PASS_${s}=$(azar 16)"
  done
  {
    echo "JWT_SECRET=$JWT_SECRET"
    echo "INTERNAL_TOKEN=$INTERNAL_TOKEN"
    for s in auth events orders payments tickets checkin; do
      v="PASS_${s}"; echo "PASS_${s}=${!v}"
    done
  } > "$SECRETOS"
  chmod 600 "$SECRETOS"
  echo ">> Secretos nuevos guardados en $SECRETOS"
fi

# 1) Bases de datos: un usuario y una base por servicio
for s in auth events orders payments tickets checkin; do
  v="PASS_${s}"; pass="${!v}"
  echo ">> PostgreSQL: ${s}_user / ${s}_db"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${s}_user') THEN
    CREATE ROLE ${s}_user LOGIN PASSWORD '${pass}';
  ELSE
    ALTER ROLE ${s}_user WITH LOGIN PASSWORD '${pass}';
  END IF;
END \$\$;
SQL
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${s}_db'" | grep -q 1; then
    sudo -u postgres createdb -O "${s}_user" "${s}_db"
  fi
done

# 2) Archivos .env
escribir() { # escribir <servicio> <contenido>
  echo ">> .env de $1"
  printf '%s\n' "$2" > "$RAIZ/$1/.env"
  chmod 600 "$RAIZ/$1/.env"
}

escribir auth "PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=auth_db
DB_USER=auth_user
DB_PASSWORD=$PASS_auth
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=8h"

escribir events "PORT=3002
DB_HOST=localhost
DB_PORT=5432
DB_NAME=events_db
DB_USER=events_user
DB_PASSWORD=$PASS_events
JWT_SECRET=$JWT_SECRET"

escribir payments "PORT=3003
DB_HOST=localhost
DB_PORT=5432
DB_NAME=payments_db
DB_USER=payments_user
DB_PASSWORD=$PASS_payments
INTERNAL_TOKEN=$INTERNAL_TOKEN"

mkdir -p "$RAIZ/tickets/storage"
escribir tickets "PORT=3004
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tickets_db
DB_USER=tickets_user
DB_PASSWORD=$PASS_tickets
JWT_SECRET=$JWT_SECRET
INTERNAL_TOKEN=$INTERNAL_TOKEN
PDF_DIR=$RAIZ/tickets/storage"

escribir notifications "PORT=3005
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_TIMEOUT_MS=5000
MAIL_FROM=\"EntradasYa <no-reply@entradasya.local>\"
WEB_URL=http://$IP
INTERNAL_TOKEN=$INTERNAL_TOKEN"

escribir orders "PORT=3006
DB_HOST=localhost
DB_PORT=5432
DB_NAME=orders_db
DB_USER=orders_user
DB_PASSWORD=$PASS_orders
JWT_SECRET=$JWT_SECRET
INTERNAL_TOKEN=$INTERNAL_TOKEN
EVENTS_URL=http://localhost:3002
PAYMENTS_URL=http://localhost:3003
TICKETS_URL=http://localhost:3004
NOTIFICATIONS_URL=http://localhost:3005
HTTP_TIMEOUT_MS=5000"

escribir checkin "PORT=3007
DB_HOST=localhost
DB_PORT=5432
DB_NAME=checkin_db
DB_USER=checkin_user
DB_PASSWORD=$PASS_checkin
JWT_SECRET=$JWT_SECRET
INTERNAL_TOKEN=$INTERNAL_TOKEN
TICKETS_URL=http://localhost:3004
HTTP_TIMEOUT_MS=5000"

echo
echo "LISTO: 6 bases de datos y 7 archivos .env creados."
sudo -u postgres psql -c "\l" | grep _db
