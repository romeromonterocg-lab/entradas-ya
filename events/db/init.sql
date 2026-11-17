-- Ejecutar como usuario postgres:  psql -U postgres -f events/db/init.sql
-- Crea el usuario y la base de datos del servicio events.
-- Cambiar la contraseña en el servidor.

CREATE USER events_user WITH PASSWORD 'events_pass_dev';
CREATE DATABASE events_db OWNER events_user;

-- Las tablas las crea el servicio automáticamente al iniciar.
