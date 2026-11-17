-- Ejecutar como usuario postgres:  psql -U postgres -f checkin/db/init.sql
-- Crea el usuario y la base de datos del servicio checkin.
-- Cambiar la contraseña en el servidor.

CREATE USER checkin_user WITH PASSWORD 'checkin_pass_dev';
CREATE DATABASE checkin_db OWNER checkin_user;

-- La tabla "ingresos" la crea el servicio automáticamente al iniciar.
