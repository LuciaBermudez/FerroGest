const Categoria = require('../models/categoria.model');

async function listar(req, res) {
  try {
    res.json(await Categoria.listar());
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
    const id = await Categoria.crear(nombre);
    res.status(201).json({ id_categoria: id, nombre });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe una categoría con ese nombre' });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

module.exports = { listar, crear };