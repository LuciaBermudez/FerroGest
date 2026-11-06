const pool = require('../config/db');

async function listar(req, res) {
  try {
    const [filas] = await pool.query('SELECT id_categoria, nombre FROM categoria ORDER BY nombre');
    res.json(filas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

async function crear(req, res) {
  const nombre = req.body.nombre?.trim();
  if (!nombre) {
    return res.status(400).json({ mensaje: 'El nombre es obligatorio' });
  }

  try {
    const [resultado] = await pool.query('INSERT INTO categoria (nombre) VALUES (?)', [nombre]);
    res.status(201).json({ id_categoria: resultado.insertId, nombre });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe una categoría con ese nombre' });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

module.exports = { listar, crear };