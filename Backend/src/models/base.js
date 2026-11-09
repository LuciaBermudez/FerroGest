const pool = require('../config/db');

// Si se recibe una conexión (dentro de una transacción) se usa esa; si no, el pool
const bd = (conexion) => conexion ?? pool;

module.exports = { bd };