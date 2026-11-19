const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuario.model');

// Hash válido de una contraseña que nadie conoce. Se compara cuando el correo
// no existe para que el tiempo de respuesta no revele qué cuentas están registradas.
const HASH_FICTICIO = '$2b$10$I4SJqY9M3fzro9rsrSoCK.jKX4a8EpIgiLoIHQlU620wtN5dpUrHa';

async function login(req, res) {
  const correo = typeof req.body.correo === 'string' ? req.body.correo.trim().toLowerCase() : '';
  const contrasena = typeof req.body.contrasena === 'string' ? req.body.contrasena : '';

  if (!correo || !contrasena) {
    return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
  }

  try {
    const usuario = await Usuario.buscarPorCorreo(correo);
    const hash = usuario?.contrasena_hash || HASH_FICTICIO;
    const coincide = await bcrypt.compare(contrasena, hash);
    const valido = Boolean(usuario && usuario.activo && coincide);

    // Mismo mensaje si el usuario no existe, está inactivo o la contraseña falla:
    // así no se revela qué correos están registrados
    if (!valido) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: usuario.id_usuario, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id_usuario,
        nombre: usuario.nombre_completo,
        correo: usuario.correo,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

async function perfil(req, res) {
  try {
    const usuario = await Usuario.buscarActivoPorId(req.usuario.id);

    if (!usuario) {
      return res.status(401).json({ mensaje: 'Usuario no disponible' });
    }

    res.json(usuario);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
}

module.exports = { login, perfil };