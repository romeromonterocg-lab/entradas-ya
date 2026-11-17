-- Ejecutar como usuario postgres (psql -U postgres -f db/init.sql)
-- Crea el usuario y la base de datos del servicio auth.
-- Cambiar la contraseña en el servidor.

CREATE USER auth_user WITH PASSWORD 'auth_pass_dev';
CREATE DATABASE auth_db OWNER auth_user;

-- La tabla "usuarios" la crea el servicio automáticamente al iniciar.
