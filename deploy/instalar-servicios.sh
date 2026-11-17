#!/usr/bin/env bash
# Registra los servicios en systemd (arrancan solos y se reinician si fallan)
# y configura Nginx como única puerta de entrada. Se ejecuta UNA sola vez:
#   bash deploy/instalar-servicios.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
USUARIO="$(whoami)"

# servicio | comando de arranque
SERVICIOS=(
  "auth|/usr/bin/node src/index.js"
  "events|$RAIZ/events/venv/bin/python run.py"
  "payments|$RAIZ/payments/bin/payments"
  "tickets|$RAIZ/tickets/venv/bin/python run.py"
  "notifications|/usr/bin/node src/index.js"
  "orders|/usr/bin/dotnet $RAIZ/orders/bin/publicado/orders.dll"
  "checkin|$RAIZ/checkin/bin/checkin"
)

for linea in "${SERVICIOS[@]}"; do
  s="${linea%%|*}"; cmd="${linea#*|}"
  echo ">> systemd: entradasya-$s"
  sudo tee "/etc/systemd/system/entradasya-$s.service" > /dev/null <<UNIT
[Unit]
Description=EntradasYa - servicio $s
After=network.target postgresql.service

[Service]
User=$USUARIO
WorkingDirectory=$RAIZ/$s
EnvironmentFile=$RAIZ/$s/.env
ExecStart=$cmd
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
done

echo ">> systemd: mailpit (SMTP 1025, interfaz web en /mailpit/)"
sudo tee /etc/systemd/system/mailpit.service > /dev/null <<UNIT
[Unit]
Description=Mailpit - correo de prueba
After=network.target

[Service]
User=$USUARIO
ExecStart=/usr/local/bin/mailpit --smtp 127.0.0.1:1025 --listen 127.0.0.1:8025 --webroot /mailpit/
Restart=always

[Install]
WantedBy=multi-user.target
UNIT

echo ">> Nginx"
sudo cp "$RAIZ/deploy/nginx-entradasya.conf" /etc/nginx/sites-available/entradasya
sudo ln -sf /etc/nginx/sites-available/entradasya /etc/nginx/sites-enabled/entradasya
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t

sudo systemctl daemon-reload
sudo systemctl enable --now mailpit
for linea in "${SERVICIOS[@]}"; do sudo systemctl enable "entradasya-${linea%%|*}"; done
sudo systemctl enable nginx

echo ">> Primer despliegue"
bash "$RAIZ/deploy/desplegar.sh"
