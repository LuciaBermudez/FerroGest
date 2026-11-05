require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function main() {
  const clave = process.argv[2];
  if (!clave || clave.length < 8) {
    console.error('Uso: node src/scripts/seed-admin.js <contraseña de al menos 8 caracteres>');
    process.exit(1);
  }

  const correo = 'admin@ferrogest.com';

  const [existe] = await pool.query('SELECT id_usuario FROM usuario WHERE correo = ?', [correo]);
  if (existe.length > 0) {
    console.log('El administrador ya existe.');
    process.exit(0);
  }

  const [roles] = await pool.query("SELECT id_rol FROM rol WHERE nombre = 'Administrador'");
  const hash = await bcrypt.hash(clave, 10);

  await pool.query(
    'INSERT INTO usuario (id_rol, nombre_completo, correo, contrasena_hash) VALUES (?, ?, ?, ?)',
    [roles[0].id_rol, 'Administrador', correo, hash]
  );

  console.log(`Administrador creado: ${correo}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});