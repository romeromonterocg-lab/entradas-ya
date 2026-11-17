-- Ejecutar como usuario postgres:  psql -U postgres -f payments/db/init.sql
-- Crea el usuario y la base de datos del servicio payments.
-- Cambiar la contraseña en el servidor.

CREATE USER payments_user WITH PASSWORD 'payments_pass_dev';
CREATE DATABASE payments_db OWNER payments_user;

-- La tabla "transacciones" la crea el servicio automáticamente al iniciar.
