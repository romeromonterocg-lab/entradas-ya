// Crea un usuario con cualquier rol (uso administrativo, desde la terminal).
// Uso: npm run crear-usuario -- "<nombre>" <correo> <password> <rol>
// Ej:  npm run crear-usuario -- "Ana Organizadora" ana@test.com 123456 organizador
const bcrypt = require('bcryptjs');
const { pool, inicializar } = require('./db');

const ROLES = ['cliente', 'organizador', 'portero'];
const [nombre, correo, password, rol] = process.argv.slice(2);

async function main() {
  if (!nombre || !correo || !password || !ROLES.includes(rol)) {
    console.log('Uso: npm run crear-usuario -- "<nombre>" <correo> <password> <cliente|organizador|portero>');
    process.exit(1);
  }
  await inicializar();
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    'INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id',
    [nombre.trim(), correo.trim().toLowerCase(), hash, rol]
  );
  console.log(`Usuario creado: id=${rows[0].id} correo=${correo} rol=${rol}`);
}

main()
  .catch((err) => {
    console.error(err.code === '23505' ? 'Ese correo ya está registrado' : `Error: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
