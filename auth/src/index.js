const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('./config');
const log = require('./logger');
const { pool, inicializar } = require('./db');

const app = express();
app.use(express.json());

// Log de cada petición
app.use((req, res, next) => {
  res.on('finish', () => log.info(`${req.method} ${req.originalUrl} -> ${res.statusCode}`));
  next();
});

function usuarioPublico(u) {
  return { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol };
}

// GET /health -> ¿el servicio funciona y tiene conexión a su BD?
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', servicio: 'auth', db: 'ok' });
  } catch (err) {
    log.error(`Health: sin conexión a la BD: ${err.message}`);
    res.status(503).json({ status: 'error', servicio: 'auth', db: 'sin conexión' });
  }
});

// POST /register  { nombre, correo, password }
// El registro público SIEMPRE crea clientes. Organizadores y porteros se crean con: npm run crear-usuario
app.post('/register', async (req, res) => {
  const { nombre, correo, password } = req.body || {};
  const rol = 'cliente';

  if (!nombre || !correo || !password) {
    return res.status(400).json({ error: 'nombre, correo y password son obligatorios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING *',
      [nombre.trim(), correo.trim().toLowerCase(), hash, rol]
    );
    log.info(`Usuario registrado: id=${rows[0].id} rol=${rol}`);
    res.status(201).json(usuarioPublico(rows[0]));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }
    log.error(`Error en registro: ${err.message}`);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /login  { correo, password } -> { token, usuario }
app.post('/login', async (req, res) => {
  const { correo, password } = req.body || {};
  if (!correo || !password) {
    return res.status(400).json({ error: 'correo y password son obligatorios' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [
      correo.trim().toLowerCase(),
    ]);
    const usuario = rows[0];
    if (!usuario || !(await bcrypt.compare(password, usuario.password_hash))) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { sub: String(usuario.id), rol: usuario.rol, correo: usuario.correo, nombre: usuario.nombre }, config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: config.jwtExpiresIn,
    });
    log.info(`Login correcto: id=${usuario.id}`);
    res.json({ token, usuario: usuarioPublico(usuario) });
  } catch (err) {
    log.error(`Error en login: ${err.message}`);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /me  (Authorization: Bearer <token>) -> datos del usuario del token
app.get('/me', async (req, res) => {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Falta el token' });
  }
  try {
    const datos = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [datos.sub]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuarioPublico(rows[0]));
  } catch (err) {
    res.status(401).json({ error: 'Token inválido o vencido' });
  }
});

async function iniciar() {
  try {
    await inicializar();
    log.info('Conexión a la BD correcta, tabla usuarios lista');
  } catch (err) {
    log.error(`No se pudo conectar a la BD: ${err.message}`);
    process.exit(1);
  }
  app.listen(config.port, () => log.info(`auth escuchando en el puerto ${config.port}`));
}

iniciar();
