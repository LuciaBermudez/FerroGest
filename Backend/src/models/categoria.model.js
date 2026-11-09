const { bd } = require('./base');

async function listar() {
  const [filas] = await bd().query('SELECT id_categoria, nombre FROM categoria ORDER BY nombre');
  return filas;
}

async function crear(nombre) {
  const [r] = await bd().query('INSERT INTO categoria (nombre) VALUES (?)', [nombre]);
  return r.insertId;
}

module.exports = { listar, crear };