// Toda la configuración sale de variables de entorno (requerimiento 8.1)
require('dotenv').config();

const requeridas = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];
const faltan = requeridas.filter((v) => !process.env[v]);
if (faltan.length > 0) {
  console.error(`${new Date().toISOString()} [ERROR] Faltan variables de entorno: ${faltan.join(', ')}`);
  process.exit(1);
}

module.exports = {
  port: Number(process.env.PORT || 3001),
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
};
