const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({ ...config.db, connectionTimeoutMillis: 3000 });

// Crea la tabla si no existe
async function inicializar() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id            SERIAL PRIMARY KEY,
      nombre        VARCHAR(100) NOT NULL,
      correo        VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(100) NOT NULL,
      rol           VARCHAR(20)  NOT NULL DEFAULT 'cliente'
                    CHECK (rol IN ('cliente', 'organizador', 'portero')),
      creado_en     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

module.exports = { pool, inicializar };
