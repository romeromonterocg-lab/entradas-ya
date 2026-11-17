// Toda la configuración sale de variables de entorno (requerimiento 8.1)
require('dotenv').config();

const requeridas = ['SMTP_HOST', 'SMTP_PORT', 'MAIL_FROM', 'INTERNAL_TOKEN'];
const faltan = requeridas.filter((v) => !process.env[v]);
if (faltan.length > 0) {
  console.error(`${new Date().toISOString()} [ERROR] Faltan variables de entorno: ${faltan.join(', ')}`);
  process.exit(1);
}

module.exports = {
  port: Number(process.env.PORT || 3005),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    timeoutMs: Number(process.env.SMTP_TIMEOUT_MS || 5000),
  },
  mailFrom: process.env.MAIL_FROM,
  webUrl: (process.env.WEB_URL || 'http://localhost').replace(/\/$/, ''),
  internalToken: process.env.INTERNAL_TOKEN,
};
