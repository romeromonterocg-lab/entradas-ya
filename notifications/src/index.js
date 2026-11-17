const crypto = require('crypto');
const express = require('express');
const nodemailer = require('nodemailer');
const config = require('./config');
const log = require('./logger');
const plantillas = require('./plantillas');

const transporte = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false,
  ignoreTLS: true, // Mailpit no usa TLS en desarrollo
  connectionTimeout: config.smtp.timeoutMs,
  greetingTimeout: config.smtp.timeoutMs,
  socketTimeout: config.smtp.timeoutMs,
});

const app = express();
app.use(express.json());

// Log de cada petición
app.use((req, res, next) => {
  const inicio = Date.now();
  res.on('finish', () =>
    log.info(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio} ms)`)
  );
  next();
});

// Servicio interno: solo orders (u otros servicios) con la clave
function soloInterno(req, res, next) {
  const recibido = Buffer.from(req.get('X-Internal-Token') || '');
  const esperado = Buffer.from(config.internalToken);
  if (recibido.length !== esperado.length || !crypto.timingSafeEqual(recibido, esperado)) {
    return res.status(401).json({ error: 'Servicio interno: falta o es incorrecta la clave X-Internal-Token' });
  }
  next();
}

const correoValido = (c) => typeof c === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);

async function enviar(para, { asunto, texto, html }) {
  const info = await transporte.sendMail({ from: config.mailFrom, to: para, subject: asunto, text: texto, html });
  return info.messageId;
}

// GET /health -> ¿el servicio funciona y llega al servidor SMTP?
app.get('/health', async (req, res) => {
  try {
    await transporte.verify();
    res.json({ status: 'ok', servicio: 'notifications', smtp: 'ok' });
  } catch (err) {
    log.error(`Health: sin conexión al SMTP: ${err.message}`);
    res.status(503).json({ status: 'error', servicio: 'notifications', smtp: 'sin conexión' });
  }
});

// POST /notificaciones/compra
// { correo, nombre, orden_id, evento, fecha, lugar, sector, cantidad, total, entradas: [codigos] }
app.post('/notificaciones/compra', soloInterno, async (req, res) => {
  const d = req.body || {};
  const faltan = ['correo', 'nombre', 'orden_id', 'evento', 'fecha', 'lugar', 'sector', 'cantidad', 'total']
    .filter((c) => d[c] === undefined || d[c] === null || d[c] === '');
  if (faltan.length) return res.status(400).json({ error: `Faltan campos: ${faltan.join(', ')}` });
  if (!correoValido(d.correo)) return res.status(400).json({ error: 'correo inválido' });

  try {
    const id = await enviar(d.correo, plantillas.compra(d, config.webUrl));
    log.info(`Correo de compra enviado: orden=${d.orden_id} para=${d.correo} id=${id}`);
    res.status(202).json({ enviado: true, orden_id: d.orden_id });
  } catch (err) {
    log.error(`No se pudo enviar correo de compra (orden=${d.orden_id}): ${err.message}`);
    res.status(502).json({ enviado: false, error: 'No se pudo enviar el correo' });
  }
});

// POST /notificaciones/bienvenida  { correo, nombre }  (opcional)
app.post('/notificaciones/bienvenida', soloInterno, async (req, res) => {
  const { correo, nombre } = req.body || {};
  if (!correoValido(correo) || !nombre) return res.status(400).json({ error: 'correo y nombre son obligatorios' });
  try {
    const id = await enviar(correo, plantillas.bienvenida({ nombre }, config.webUrl));
    log.info(`Correo de bienvenida enviado: para=${correo} id=${id}`);
    res.status(202).json({ enviado: true });
  } catch (err) {
    log.error(`No se pudo enviar correo de bienvenida: ${err.message}`);
    res.status(502).json({ enviado: false, error: 'No se pudo enviar el correo' });
  }
});

app.listen(config.port, () => {
  log.info(`notifications escuchando en el puerto ${config.port} (SMTP ${config.smtp.host}:${config.smtp.port})`);
});
