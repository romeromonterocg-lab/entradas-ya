-- Ejecutar como usuario postgres:  psql -U postgres -f orders/db/init.sql
-- Crea el usuario y la base de datos del servicio orders.
-- Cambiar la contraseña en el servidor.

CREATE USER orders_user WITH PASSWORD 'orders_pass_dev';
CREATE DATABASE orders_db OWNER orders_user;

-- La tabla "ordenes" la crea el servicio automáticamente al iniciar.
