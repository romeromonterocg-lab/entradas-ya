-- Ejecutar como usuario postgres:  psql -U postgres -f tickets/db/init.sql
-- Crea el usuario y la base de datos del servicio tickets.
-- Cambiar la contraseña en el servidor.

CREATE USER tickets_user WITH PASSWORD 'tickets_pass_dev';
CREATE DATABASE tickets_db OWNER tickets_user;

-- La tabla "entradas" la crea el servicio automáticamente al iniciar.
