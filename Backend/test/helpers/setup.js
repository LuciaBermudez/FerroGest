const path = require('node:path');

// Carga .env.test ANTES de requerir la app o el pool de conexiones.
// Si el archivo no existe, los valores deben venir del entorno.
require('dotenv').config({
  path: path.join(__dirname, '..', '..', '.env.test'),
  quiet: true,
});

const DB_NAME = process.env.DB_NAME || '';

// Barrera de seguridad: esta suite nunca debe apuntar a la base real.
if (!DB_NAME.endsWith('_test')) {
  throw new Error(
    `Las pruebas solo pueden ejecutarse contra una base de datos terminada en "_test". DB_NAME actual: "${DB_NAME}"`
  );
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('Falta JWT_SECRET (mínimo 32 caracteres) para ejecutar las pruebas');
}
